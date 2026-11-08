import { useEffect, useState } from 'react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import { AU_STATES } from '@/api/firebase/entities';
import { API_BASE_URL, apiFetch } from '@/lib/api-base';

const STRIPE_POPUP_NAMES = ['stripeOnboarding', 'stripeOAuth'];

// The seller's address for their Stripe account. Anything missing or invalid is left out, and
// Stripe asks for it during sign-up.
export function stripeAddress(user) {
    const state = String(user?.state || '').toUpperCase();
    const postcode = String(user?.postcode || '');
    return {
        address: user?.address,
        city: user?.suburb || undefined,
        state: AU_STATES.includes(state) ? state : undefined,
        postcode: /^\d{4}$/.test(postcode) ? postcode : undefined,
    };
}

// POSTs to our API as the signed-in user and returns the JSON body.
async function postApi(path, body) {
    const currentUser = firebase.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    const token = await currentUser.getIdToken();
    const response = await apiFetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }
    return data;
}

// Asks Stripe (via our API) whether the user's connected account can take card payments.
// Returns null if the status could not be checked.
async function verifiedCardPayments() {
    try {
        const data = await postApi('/api/urbanPayment/verifyStripeConnectStatus');
        return data.cardPaymentsEnabled === true;
    } catch (error) {
        console.warn('Could not verify Stripe status:', error.message);
        return null;
    }
}

// Opens an empty centred popup. It must open during the click itself: browsers (Safari above
// all) block popups opened after waiting for the server.
function openBlankPopup(name) {
    const width = 800;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open('about:blank', name, `width=${width},height=${height},left=${left},top=${top},popup=true`);
    if (!popup) throw new Error('Popup blocked - please allow popups');
    return popup;
}

// Resolves when the user closes the popup.
function waitForClose(popup) {
    return new Promise((resolve) => {
        const timer = setInterval(() => {
            if (popup.closed) {
                clearInterval(timer);
                resolve();
            }
        }, 500);
    });
}

// Stripe returns to this page inside the popup. Closing it hands back to waitForClose in the
// main window, which refreshes the status. Does nothing in a normal tab.
function closeIfStripePopup() {
    if (window.opener || STRIPE_POPUP_NAMES.includes(window.name)) window.close();
}

function cleanOAuthParams() {
    window.history.replaceState({}, document.title, window.location.pathname + '?tab=payments');
}

// Card payments (Stripe Connect) state for the profile page: checks the account on load,
// finishes the OAuth redirect, and runs the "create" and "link existing" popup flows.
export function useCardPayments(user, setUser) {
    const [enabled, setEnabled] = useState(false);
    const [creating, setCreating] = useState(false);
    const [linking, setLinking] = useState(false);

    // Re-reads the profile and Stripe status after a popup closes. Returns true if enabled.
    const refresh = async () => {
        const updated = await firebase.auth.me();
        setUser(updated);
        if (!updated.stripeConnectId) {
            setEnabled(false);
            return false;
        }
        const verified = await verifiedCardPayments();
        const result = verified ?? (updated.cardPaymentsEnabled === true);
        setEnabled(result);
        return result;
    };

    // Initial status: trust Stripe over the stored flag when it can be checked.
    const stripeConnectId = user?.stripeConnectId;
    const storedEnabled = user?.cardPaymentsEnabled === true;
    useEffect(() => {
        if (!stripeConnectId) {
            setEnabled(false);
            return;
        }
        let cancelled = false;
        verifiedCardPayments().then((verified) => {
            if (!cancelled) setEnabled(verified ?? storedEnabled);
        });
        return () => { cancelled = true; };
    }, [stripeConnectId, storedEnabled]);

    // Stripe onboarding finished: its return URL has ?success=true.
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('success') === 'true') closeIfStripePopup();
    }, []);

    // Stripe OAuth redirects back here with ?code=&state= (or ?error=).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        const code = params.get('code');
        const state = params.get('state');
        if (error) {
            toast.error('Stripe connection failed: ' + error);
            cleanOAuthParams();
            return;
        }
        if (!code || !state) return;

        const toastId = toast.loading('Completing Stripe connection...');
        postApi('/api/urbanPayment/handleStripeOAuthCallback', { code, state })
            .then(async (data) => {
                setUser(await firebase.auth.me());
                setEnabled(data.cardPaymentsEnabled === true);
                toast.success('Stripe account linked successfully!', { id: toastId });
                closeIfStripePopup();
            })
            .catch((err) => {
                toast.error('Failed to link account: ' + err.message, { id: toastId });
            })
            .finally(cleanOAuthParams);
    }, [setUser]);

    const runPopupFlow = async ({ setBusy, loadingText, request, urlOf, popupName, successText, pendingText, failurePrefix, onOpened }) => {
        setBusy(true);
        const toastId = toast.loading(loadingText);
        let popup = null;
        try {
            popup = openBlankPopup(popupName);
            const data = await request();
            const url = urlOf(data);
            if (!url) throw new Error('No Stripe URL received from server');
            toast.success('Opening Stripe...', { id: toastId });
            onOpened();
            popup.location.href = url;
            await waitForClose(popup);
            const nowEnabled = await refresh();
            if (nowEnabled) toast.success(successText);
            else toast.info(pendingText);
        } catch (error) {
            if (popup && !popup.closed) popup.close();
            toast.error(`${failurePrefix}: ${error.message}`, { id: toastId });
        } finally {
            setBusy(false);
        }
    };

    const createAccount = (onOpened) => {
        const currentUser = firebase.currentUser;
        const [firstName, ...rest] = (user?.full_name || '').split(' ');
        return runPopupFlow({
            setBusy: setCreating,
            loadingText: 'Setting up your Stripe account...',
            request: () => postApi('/api/urbanPayment/enableStripeConnect', {
                email: currentUser?.email,
                firstName: firstName || 'Seller',
                lastName: rest.join(' ') || currentUser?.email?.split('@')[0],
                ...stripeAddress(user),
                refreshUrl: window.location.href,
                returnUrl: window.location.href,
            }),
            urlOf: (data) => data.onboardingUrl || data.url,
            popupName: 'stripeOnboarding',
            successText: '🎉 Card payments enabled!',
            pendingText: 'Stripe onboarding in progress. Please complete all requirements.',
            failurePrefix: 'Failed',
            onOpened,
        });
    };

    const linkExistingAccount = (onOpened) => runPopupFlow({
        setBusy: setLinking,
        loadingText: 'Connecting to Stripe...',
        request: () => postApi('/api/urbanPayment/initiateStripeOAuth', {
            email: firebase.currentUser?.email,
            redirectUri: window.location.origin,
        }),
        urlOf: (data) => data.oauthUrl,
        popupName: 'stripeOAuth',
        successText: '🎉 Stripe account linked successfully!',
        pendingText: 'Account linked. Waiting for Stripe verification.',
        failurePrefix: 'Failed to connect Stripe',
        onOpened,
    });

    return { enabled, creating, linking, createAccount, linkExistingAccount };
}
