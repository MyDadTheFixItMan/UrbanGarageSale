import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export const RECAPTCHA_CONTAINER_ID = 'recaptcha-container-login';

// Each new code replaces the last, and Google and phone carriers hold back texts to a number
// that gets many in a short time, so a code can't be resent straight away.
export const RESEND_COOLDOWN_SECONDS = 60;

// The SMS code step of signing in to an account with 2FA, as a popup over the sign-in page.
// Firebase has no session until completeMfaSignIn() succeeds. The parent sends the first code:
// `sending` is true until it has gone, and `error` is set if it failed. Mount it to open it,
// so each attempt starts blank.
export default function SecondFactorDialog({ phoneHint, sending = false, error: sendError, onVerified, onCancel }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [resent, setResent] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const wasSending = useRef(sending);
    // A code sent since the first one failed makes that failure out of date.
    const shownError = error || (resent ? '' : sendError);

    // Start the wait once the first code has gone.
    useEffect(() => {
        if (wasSending.current && !sending && !sendError) setCooldown(RESEND_COOLDOWN_SECONDS);
        wasSending.current = sending;
    }, [sending, sendError]);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        if (code.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }
        setLoading(true);
        try {
            await firebase.auth.completeMfaSignIn(code);
            await onVerified();
        } catch (err) {
            setError(err.message || '2FA verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setResending(true);
        try {
            await firebase.auth.sendMfaSignInCode(RECAPTCHA_CONTAINER_ID);
            setResent(true);
            setCooldown(RESEND_COOLDOWN_SECONDS);
            toast.success('A new code has been sent');
        } catch (err) {
            setError(err.message);
        } finally {
            setResending(false);
        }
    };

    const sendingNow = sending || resending;
    let resendLabel = 'Resend code';
    if (sendingNow) resendLabel = 'Sending code...';
    else if (cooldown > 0) resendLabel = `Resend code in ${cooldown}s`;

    const handleOpenChange = (next) => {
        if (!next && !loading) onCancel();
    };

    return (
        <Dialog open onOpenChange={handleOpenChange}>
            {/* Only the X, Escape or "Back to Sign In" close it: a stray tap on the page, or on
                reCAPTCHA's challenge (which sits outside the dialog), must not lose the sign-in. */}
            <DialogContent
                className="w-[calc(100%-2rem)] max-w-md rounded-2xl"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Enter Verification Code</DialogTitle>
                    <DialogDescription>
                        {sending ? 'Sending a 6-digit code to your phone:' : 'We sent a 6-digit code to your phone:'} <br />
                        <span className="font-medium">{phoneHint}</span>
                    </DialogDescription>
                </DialogHeader>

                {shownError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-red-700 text-sm">{shownError}</p>
                    </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-700 mb-2">
                            Verification Code
                        </label>
                        <input
                            id="mfa-code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            maxLength="6"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent text-center text-2xl tracking-widest"
                        />
                        <p className="text-xs text-slate-500 mt-1">Enter the 6-digit code</p>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2 rounded-lg"
                    >
                        {loading ? 'Verifying...' : 'Verify Code'}
                    </Button>

                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={sendingNow || cooldown > 0}
                        className="w-full text-slate-600 hover:text-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-sm py-1"
                    >
                        {resendLabel}
                    </button>

                    <button type="button" onClick={onCancel} disabled={loading} className="w-full text-[#1e3a5f] hover:text-[#152a45] text-sm font-medium py-2">
                        Back to Sign In
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
