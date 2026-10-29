import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { createPageUrl } from '@/utils';
import OAuthButtons, { signInWithProvider } from './OAuthButtons';
import { PHONE_PREFIX, PHONE_PLACEHOLDER, normalizePhone, signUpProblem, postcodeAndState, oauthErrorMessage } from './loginForms';

const INPUT_CLASS = 'w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent';

function Field({ id, label, hint, children }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
            {children}
            {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
    );
}

function SignUpComplete() {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
                <div className="mb-4 flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Account created</h2>
                <p className="text-slate-600 mb-2">We've emailed you a verification link.</p>
                <p className="text-slate-600 mb-6">Once your email is verified, turn on two-factor authentication in your Profile to create listings and use Urban Pay.</p>
                <p className="text-sm text-slate-500">Taking you to your Profile...</p>
            </div>
        </div>
    );
}

// The Sign Up tab. `onExistingEmail(email)` switches to Log In for an address that already has
// an account; `onSecondFactor(error)` starts the SMS step when an OAuth account has 2FA on.
export default function SignUpForm({ onExistingEmail, onSecondFactor }) {
    const navigate = useNavigate();
    const [fields, setFields] = useState({
        fullName: '', address: '', postcode: '', state: '', email: '',
        phone: PHONE_PREFIX, password: '', confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [complete, setComplete] = useState(false);

    const set = (name) => (e) => setFields((prev) => ({ ...prev, [name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (loading) return;

        const problem = signUpProblem(fields);
        if (problem) {
            setError(problem);
            return;
        }

        setLoading(true);
        try {
            // Firebase emails a verification link; a verified email is needed before the mobile
            // number can be enrolled for 2FA in the Profile page.
            await firebase.auth.signUp(fields.email, fields.password);
            await firebase.auth.updateProfile({
                phone: normalizePhone(fields.phone).phone,
                phone_verified: false,
                full_name: fields.fullName,
                address: fields.address,
                ...postcodeAndState(fields.address, fields.postcode, fields.state),
                created_date: new Date().toISOString(),
                role: 'user',
            });
            setComplete(true);
            setTimeout(() => navigate(createPageUrl('Profile')), 5000);
        } catch (err) {
            console.error('Sign up error:', err);
            if (err.code === 'auth/email-already-in-use') {
                onExistingEmail(fields.email);
                toast.info(err.message);
            } else {
                setError(err.message || 'Failed to create account');
                toast.error(err.message || 'Failed to create account');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOAuth = async (provider) => {
        setLoading(true);
        setError('');
        try {
            await signInWithProvider(provider);
            setComplete(true);
            setTimeout(() => navigate(createPageUrl('Home')), 3000);
            toast.success(`Account created with ${provider}!`);
        } catch (err) {
            if (err.mfaRequired) {
                await onSecondFactor(err);
                return;
            }
            console.error(`${provider} OAuth error:`, err);
            const message = oauthErrorMessage(err, 'Sign up', provider);
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (complete) return <SignUpComplete />;

    return (
        <>
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <Field id="signup-name" label="Full Name">
                    <input id="signup-name" type="text" value={fields.fullName} onChange={set('fullName')}
                        placeholder="John Doe" className={INPUT_CLASS} />
                </Field>

                <Field id="signup-address" label="Address">
                    <GooglePlacesAutocomplete
                        id="signup-address"
                        value={fields.address}
                        onChange={(address) => setFields((prev) => ({ ...prev, address }))}
                        onSelect={(place) => {
                            if (place.address) {
                                setFields((prev) => ({ ...prev, address: place.address, postcode: place.postcode || '', state: place.state || '' }));
                            }
                        }}
                        placeholder="123 Main Street, Sydney NSW 2000"
                        className="w-full"
                    />
                </Field>

                <Field id="signup-email" label="Email Address">
                    <input id="signup-email" type="email" value={fields.email} onChange={set('email')}
                        placeholder="you@example.com" className={INPUT_CLASS} />
                </Field>

                <Field id="signup-phone" label="Phone Number" hint="Include country code (spaces and dashes optional)">
                    <input id="signup-phone" type="tel" value={fields.phone} onChange={set('phone')}
                        placeholder={PHONE_PLACEHOLDER} className={INPUT_CLASS} />
                </Field>

                <Field id="signup-password" label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters, with letters and numbers`}>
                    <input id="signup-password" type="password" value={fields.password} onChange={set('password')}
                        placeholder="••••••••" className={INPUT_CLASS} />
                </Field>

                <Field id="signup-confirm" label="Confirm Password">
                    <input id="signup-confirm" type="password" value={fields.confirmPassword} onChange={set('confirmPassword')}
                        placeholder="••••••••" className={INPUT_CLASS} />
                </Field>

                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2 rounded-lg"
                >
                    {loading ? 'Creating account...' : 'Create Account'}
                </Button>

                <OAuthButtons onSelect={handleOAuth} disabled={loading} label="Or sign up with" compact />
            </form>

            <p className="text-xs text-slate-500 mt-4 text-center">
                By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
        </>
    );
}
