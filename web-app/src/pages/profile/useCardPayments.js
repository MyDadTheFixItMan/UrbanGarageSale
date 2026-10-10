import { useEffect, useState } from 'react';
import { toast } from "sonner";
import { firebase } from '@/api/firebaseClient';
import { API_BASE_URL, apiFetch } from '@/lib/api-base';

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

// Opens a centred popup and resolves when the user closes it.
function openPopupAndWait(url, name) {
    const width = 800;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(url, name, `width=${width},height=${height},left=${left},top=${top},popup=true`);
    if (!popup) throw new Error('Popup blocked - please allow popups');
    return new Promise((resolve) => {
        const timer = setInterval(() => {
            if (popup.closed) {
                clearInterval(timer);
                resolve();
            }
        }, 500);
    });
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
            })
            .catch((err) => {
                toast.error('Failed to link account: ' + err.message, { id: toastId });
            })
            .finally(cleanOAuthParams);
    }, [setUser]);

    const runPopupFlow = async ({ setBusy, loadingText, request, urlOf, popupName, successText, pendingText, failurePrefix, onOpened }) => {
        setBusy(true);
        const toastId = toast.loading(loadingText);
        try {
            const data = await request();
            const url = urlOf(data);
            if (!url) throw new Error('No Stripe URL received from server');
            toast.success('Opening Stripe...', { id: toastId });
            onOpened();
            await openPopupAndWait(url, popupName);
            const nowEnabled = await refresh();
            if (nowEnabled) toast.success(successText);
            else toast.info(pendingText);
        } catch (error) {
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
                address: user?.address,
                city: 'Sydney',
                state: 'NSW',
                postcode: '2000',
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
