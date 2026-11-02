import React, { useState } from 'react';
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

// The SMS code step of signing in to an account with 2FA, as a popup over the sign-in page.
// Firebase has no session until completeMfaSignIn() succeeds. `error` is set by the parent
// when sending the code fails. Mount it to open it, so each attempt starts blank.
export default function SecondFactorDialog({ phoneHint, error: sendError, onVerified, onCancel }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const shownError = error || sendError;

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
        try {
            await firebase.auth.sendMfaSignInCode(RECAPTCHA_CONTAINER_ID);
            toast.success('A new code has been sent');
        } catch (err) {
            setError(err.message);
        }
    };

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
                        We sent a 6-digit code to your phone: <br />
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

                    <button type="button" onClick={handleResend} className="w-full text-slate-600 hover:text-slate-800 text-sm py-1">
                        Resend code
                    </button>

                    <button type="button" onClick={onCancel} disabled={loading} className="w-full text-[#1e3a5f] hover:text-[#152a45] text-sm font-medium py-2">
                        Back to Sign In
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
