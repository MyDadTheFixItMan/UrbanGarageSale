import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const RECAPTCHA_ID = 'recaptcha-container-2fa';

// Enrols the user's mobile as a Firebase multi-factor (SMS) second factor.
// After this, Firebase requires the SMS code at every sign-in.
export default function TwoFactorSetupDialog({ open, onOpenChange, defaultPhone = '', onEnabled }) {
    const [step, setStep] = useState('phone'); // 'phone' | 'code' | 'verify-email'
    const [phone, setPhone] = useState(defaultPhone);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const reset = () => {
        setStep('phone');
        setCode('');
        setError('');
        setLoading(false);
    };

    const handleOpenChange = (next) => {
        if (!next) reset();
        onOpenChange(next);
    };

    const sendCode = async () => {
        setError('');
        setLoading(true);
        try {
            await firebase.auth.startMfaEnrollment(phone, RECAPTCHA_ID);
            setStep('code');
        } catch (err) {
            if (err.emailNotVerified) {
                setStep('verify-email');
            } else {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const resendVerificationEmail = async () => {
        setError('');
        setLoading(true);
        try {
            await firebase.auth.sendVerificationEmail();
            setError('Verification email sent. Click the link in it, then come back and try again.');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmCode = async (e) => {
        e.preventDefault();
        if (code.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const result = await firebase.auth.finishMfaEnrollment(code);
            reset();
            onEnabled(result);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Turn on two-factor authentication</DialogTitle>
                    <DialogDescription>
                        Each time you sign in we'll text a code to your mobile. You need this to create listings and use Urban Pay.
                    </DialogDescription>
                </DialogHeader>

                {/* Invisible reCAPTCHA used by Firebase when sending the SMS */}
                <div id={RECAPTCHA_ID}></div>

                {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
                )}

                {step === 'phone' && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="twofa-phone">Mobile number</Label>
                            <Input
                                id="twofa-phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="0412 345 678"
                                autoComplete="tel"
                            />
                        </div>
                        <Button onClick={sendCode} disabled={loading || !phone} className="w-full bg-[#1e3a5f] hover:bg-[#152a45]">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send code'}
                        </Button>
                    </div>
                )}

                {step === 'code' && (
                    <form onSubmit={confirmCode} className="space-y-4">
                        <div>
                            <Label htmlFor="twofa-code">Code sent to {phone}</Label>
                            <Input
                                id="twofa-code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                className="text-center text-2xl tracking-widest"
                            />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full bg-[#1e3a5f] hover:bg-[#152a45]">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Turn on 2FA'}
                        </Button>
                        <button type="button" onClick={sendCode} disabled={loading} className="w-full text-sm text-slate-600 hover:text-slate-800">
                            Resend code
                        </button>
                    </form>
                )}

                {step === 'verify-email' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-700">
                            Please verify your email address first. Click the link in the email we sent you, then try again.
                        </p>
                        <Button onClick={resendVerificationEmail} disabled={loading} variant="outline" className="w-full">
                            Resend verification email
                        </Button>
                        <Button onClick={sendCode} disabled={loading} className="w-full bg-[#1e3a5f] hover:bg-[#152a45]">
                            I've verified my email
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
