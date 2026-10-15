import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { firebase } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '../utils';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import OAuthButtons, { signInWithProvider } from './login/OAuthButtons';
import SecondFactorForm, { RECAPTCHA_CONTAINER_ID } from './login/SecondFactorForm';
import SignUpForm from './login/SignUpForm';
import { oauthErrorMessage } from './login/loginForms';

const INPUT_CLASS = 'w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent';

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 px-4 font-medium text-center transition-colors ${
        active ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f]' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { checkAppState } = useAuth();
  const [promoIndex, setPromoIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('signin');

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);

  // The SMS step: null, or { phoneHint, error } while it is showing.
  const [secondFactor, setSecondFactor] = useState(null);

  const { data: allPromotions = [] } = useQuery({
    queryKey: ['allPromotions'],
    queryFn: async () => {
      try {
        return await firebase.firestore.collection('promotions').getDocs('sequence', 'asc');
      } catch (error) {
        console.error('Error fetching promotions:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // Rotate promotional messages every 5 seconds
  useEffect(() => {
    if (allPromotions.length === 0) return;
    const interval = setInterval(() => {
      setPromoIndex((prevIndex) => (prevIndex + 1) % allPromotions.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [allPromotions.length]);

  const finishSignIn = async () => {
    await checkAppState();
    navigate(createPageUrl('Home'));
  };

  // Firebase refuses to finish signing in a 2FA account until the SMS code is confirmed,
  // so there is no session to use until completeMfaSignIn() succeeds.
  const startSecondFactor = async (mfaError) => {
    setActiveTab('signin');
    setSecondFactor({ phoneHint: mfaError.phoneHint || 'your mobile', error: '' });
    try {
      await firebase.auth.sendMfaSignInCode(RECAPTCHA_CONTAINER_ID);
      toast.success('Verification code sent to your phone');
    } catch (smsError) {
      setSecondFactor((prev) => prev && { ...prev, error: smsError.message });
      toast.error(smsError.message);
    }
  };

  const cancelSecondFactor = () => {
    setSecondFactor(null);
    setSignInEmail('');
    setSignInPassword('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSignInError('');
    setSignInLoading(true);
    try {
      await firebase.auth.login(signInEmail, signInPassword);
      await finishSignIn();
    } catch (err) {
      if (err.mfaRequired) {
        await startSecondFactor(err);
        return;
      }
      setSignInError(err.message || 'Sign in failed');
      toast.error(err.message || 'Sign in failed');
    } finally {
      setSignInLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider) => {
    setSignInLoading(true);
    setSignInError('');
    try {
      await signInWithProvider(provider);
      toast.success(`Signed in with ${provider}!`);
      navigate(createPageUrl('Home'));
    } catch (err) {
      if (err.mfaRequired) {
        await startSecondFactor(err);
        return;
      }
      console.error(`${provider} OAuth error:`, err);
      const message = oauthErrorMessage(err, 'Sign in', provider);
      setSignInError(message);
      toast.error(message);
    } finally {
      setSignInLoading(false);
    }
  };

  const handleExistingEmail = (email) => {
    setSignInEmail(email);
    setActiveTab('signin');
  };

  return (
    <div style={{ backgroundColor: '#f5f1e8' }} className="min-h-screen flex flex-col overflow-x-hidden pb-32 md:pb-8">
      {/* Watermark */}
      <style>{`
          @media (min-width: 768px) {
              .watermark-page {
                  top: -90px !important;
              }
          }
      `}</style>
      <img
        src="/Logo Webpage.png"
        alt="watermark"
        className="fixed left-0 pointer-events-none watermark-page"
        style={{
          width: '1200px',
          height: 'auto',
          clipPath: 'polygon(0 0, 46% 0, 46% 100%, 0 100%)',
          top: '35px',
          zIndex: 5,
          opacity: 0.35,
          objectFit: 'contain'
        }}
      />

      {/* Advertising Ribbon */}
      {allPromotions.length > 0 && (
        <div className="bg-gradient-to-r from-[#FF9500] to-[#f97316] text-white py-3 px-4 text-center shadow-lg fixed top-20 left-0 right-0 z-30 w-full" style={{ backgroundColor: 'rgb(255, 149, 0)' }}>
          <p className="text-sm sm:text-base font-semibold">
            {allPromotions[promoIndex]?.message}
          </p>
        </div>
      )}

      <section className="relative bg-[#f5f1e8] py-0 sm:py-8 md:py-16 px-4 sm:px-6 overflow-hidden -mt-2">
        <div className="max-w-md mx-auto pt-24 sm:pt-2 md:pt-4 relative z-10">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-12 sm:mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1e3a5f]">Account</h2>
              <p className="text-slate-500">Log in or create an account</p>
            </div>
          </div>

          {/* Login/Sign Up Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mt-15 sm:mt-0">
            <div className="flex border-b border-slate-200 mb-6">
              <TabButton active={activeTab === 'signin'} onClick={() => setActiveTab('signin')}>Log In</TabButton>
              <TabButton active={activeTab === 'signup'} onClick={() => setActiveTab('signup')}>Sign Up</TabButton>
            </div>

            {/* Invisible reCAPTCHA for 2FA SMS codes (always mounted) */}
            <div id={RECAPTCHA_CONTAINER_ID}></div>

            {activeTab === 'signin' && (
              <>
                {signInError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{signInError}</p>
                  </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label htmlFor="signin-email" className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address
                    </label>
                    <input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="signin-password" className="block text-sm font-medium text-slate-700 mb-2">
                      Password
                    </label>
                    <input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="••••••••"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={signInLoading}
                    className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2 rounded-lg"
                  >
                    {signInLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>

                <Link
                  to={createPageUrl('ResetPassword')}
                  className="block w-full mt-4 text-[#1e3a5f] hover:text-[#152a45] text-sm font-medium text-center"
                >
                  Forgot password?
                </Link>

                {secondFactor ? (
                  <SecondFactorForm
                    phoneHint={secondFactor.phoneHint}
                    error={secondFactor.error}
                    onVerified={async () => {
                      setSecondFactor(null);
                      await finishSignIn();
                      toast.success('Signed in');
                    }}
                    onCancel={cancelSecondFactor}
                  />
                ) : (
                  <OAuthButtons onSelect={handleOAuthSignIn} disabled={signInLoading} label="Or continue with" />
                )}
              </>
            )}

            {activeTab === 'signup' && (
              <SignUpForm onExistingEmail={handleExistingEmail} onSecondFactor={startSecondFactor} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
