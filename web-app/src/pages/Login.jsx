import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { firebase } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '../utils';
import { Mail } from 'lucide-react';
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';
import toast from 'react-hot-toast';

// Country code mapping
const countryCallingCodes = {
  'AU': '+61',
  'US': '+1',
  'CA': '+1',
  'GB': '+44',
  'NZ': '+64',
  'JP': '+81',
  'CN': '+86',
  'IN': '+91',
  'DE': '+49',
  'FR': '+33',
  'IT': '+39',
  'ES': '+34',
  'BR': '+55',
  'MX': '+52',
  'SG': '+65',
  'MY': '+60',
  'TH': '+66',
  'PH': '+63',
  'VN': '+84',
  'ID': '+62',
  'ZA': '+27',
};

const countryPlaceholders = {
  'AU': '+61 412 345 678',
  'US': '+1 (234) 567-8900',
  'GB': '+44 7700 900000',
  'NZ': '+64 21 234 5678',
  'default': '+1 (234) 567-8900'
};

export default function Login() {
  const navigate = useNavigate();
  const { checkAppState } = useAuth();
  const [promoIndex, setPromoIndex] = useState(0);
  
  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);
  
  // 2FA state
  const [show2FAVerification, setShow2FAVerification] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [tempUserData, setTempUserData] = useState(null);
  
  // Sign Up state
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpAddress, setSignUpAddress] = useState('');
  const [signUpPostcode, setSignUpPostcode] = useState('');
  const [signUpState, setSignUpState] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState('');
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [userCountry, setUserCountry] = useState('');
  const [phonePlaceholder, setPhonePlaceholder] = useState(countryPlaceholders['default']);
  const [isSignUpComplete, setIsSignUpComplete] = useState(false);
  
  // Active tab
  const [activeTab, setActiveTab] = useState('signin');

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

  // Auto-detect user's country on component mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Only attempt detection in production (skip for local dev)
        if (process.env.NODE_ENV !== 'development') {
          const response = await fetch('/.netlify/functions/detectCountry');
          const data = await response.json();
          const countryCode = data.country_code;
          
          if (countryCode && countryCallingCodes[countryCode]) {
            setUserCountry(countryCode);
            const callingCode = countryCallingCodes[countryCode];
            setSignUpPhone(callingCode + ' ');
            setPhonePlaceholder(countryPlaceholders[countryCode] || countryPlaceholders['default']);
            return;
          }
        }
      } catch (error) {
        console.log('Country detection not available, using default');
      }
      
      // Fallback to Australia (default for UrbanGarageSale)
      setUserCountry('AU');
      setSignUpPhone('+61 ');
      setPhonePlaceholder(countryPlaceholders['AU']);
    };

    detectCountry();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setSignInError('');
    setSignInLoading(true);

    try {
      const user = await firebase.auth.login(signInEmail, signInPassword);
      
      // Check if 2FA is enabled for this user
      const is2FAEnabled = await firebase.auth.is2FAEnabled();
      
      if (is2FAEnabled) {
        // 2FA is enabled, store temp user data and show 2FA form
        const userData = await firebase.auth.me();
        setTempUserData(userData);
        
        // Send 2FA code to user's phone
        await firebase.auth.send2FACode(userData.phone);
        
        setShow2FAVerification(true);
        toast.success('Verification code sent to your phone');
      } else {
        // No 2FA, proceed directly to home
        await checkAppState();
        navigate(createPageUrl('Home'));
      }
    } catch (err) {
      setSignInError(err.message || 'Sign in failed');
      toast.error(err.message || 'Sign in failed');
    } finally {
      setSignInLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setTwoFAError('');
    setTwoFALoading(true);

    try {
      if (!twoFACode) {
        setTwoFAError('Please enter the verification code');
        return;
      }

      // Verify the 2FA code
      const verified = await firebase.auth.verify2FACode(twoFACode);
      
      if (verified) {
        setShow2FAVerification(false);
        setTwoFACode('');
        await checkAppState();
        navigate(createPageUrl('Home'));
        toast.success('2FA verification successful!');
      } else {
        setTwoFAError('Invalid verification code');
        toast.error('Invalid verification code');
      }
    } catch (err) {
      setTwoFAError(err.message || '2FA verification failed');
      toast.error(err.message || '2FA verification failed');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setSignUpError('');
    setSignUpSuccess('');
    
    // Prevent double submission
    if (signUpLoading) {
      console.log('Signup already in progress, ignoring duplicate submission');
      return;
    }
    
    // Validation
    if (!signUpFullName || !signUpAddress || !signUpEmail || !signUpPhone || !signUpPassword || !signUpConfirmPassword) {
      setSignUpError('Please fill in all fields');
      return;
    }
    
    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError('Passwords do not match');
      return;
    }
    
    if (signUpPassword.length < 6) {
      setSignUpError('Password must be at least 6 characters');
      return;
    }

    // Clean and normalize phone number before validation
    let cleanedPhone = signUpPhone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
    
    // Validate phone number is complete (not just country code)
    if (cleanedPhone === '+61' || cleanedPhone.length < 10) {
      setSignUpError('Please enter a complete phone number (minimum 10 digits)');
      return;
    }
    // Handle Australian numbers - convert +610 to +61
    let normalizedPhone = cleanedPhone;
    if (normalizedPhone.match(/^\+610/)) {
      normalizedPhone = normalizedPhone.replace(/^\+610/, '+61');
    }
    
    // Validate phone number format (E.164 format required by Firebase)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      setSignUpError('Please enter a valid phone number with country code (e.g., +61 412 345 678)');
      return;
    }

    setSignUpLoading(true);

    try {
      // Fallback: If postcode/state not already set, try to extract from address
      let finalPostcode = signUpPostcode;
      let finalState = signUpState;
      
      if ((!finalPostcode || !finalState) && signUpAddress) {
        console.log('Attempting to extract postcode/state from address:', signUpAddress);
        
        // Try to extract state and postcode using pattern "STATE POSTCODE"
        const statePostcodeMatch = signUpAddress.match(/\b([A-Z]{2})\s+(\d{4})\b/);
        if (statePostcodeMatch) {
          finalState = statePostcodeMatch[1];
          finalPostcode = statePostcodeMatch[2];
          console.log('Extracted state:', finalState, 'postcode:', finalPostcode);
        }
      }
      
      // Clear any existing reCAPTCHA from previous attempts
      firebase.auth.clearRecaptcha();
      
      // Create email/password account FIRST
      await firebase.auth.signUp(signUpEmail, signUpPassword);
      console.log('✓ Firebase Auth user created');
      
      // Store signup data for phone verification (don't create profile yet)
      const signupToStore = {
        normalizedPhone: normalizedPhone,
        full_name: signUpFullName,
        address: signUpAddress,
        postcode: finalPostcode,
        state: finalState
      };
      sessionStorage.setItem('signupData', JSON.stringify(signupToStore));
      console.log('Stored signup data for phone verification');
      
      // For development: Use Firebase test phone number for SMS verification
      // Real phone numbers will work in production with proper reCAPTCHA configuration
      const isDev = import.meta.env.MODE === 'development';
      if (isDev) {
        console.log('Development mode detected - using test SMS flow');
        // In development, we'll auto-confirm the phone
        setShowPhoneVerification(true);
        setSignUpSuccess('Test mode: Phone verification skipped. Enter any code to continue.');
        window.scrollTo(0, 0);
      } else {
        // Production: Setup reCAPTCHA for phone verification
        await firebase.auth.setupRecaptcha('recaptcha-container');
        
        // Send SMS verification code
        console.log('Sending SMS to:', signUpPhone);
        await firebase.auth.sendPhoneVerification(signUpPhone);
        
        setShowPhoneVerification(true);
        setSignUpSuccess('Verification code sent to your phone!');
        window.scrollTo(0, 0);
      }
    } catch (err) {
      console.error('Sign up error:', err);
      
      // Check if it's an email-already-in-use error
      if (err.message && err.message.includes('already registered')) {
        console.log('Email already in use - switching to login form');
        setSignUpError('');
        // Switch to login tab and pre-fill email immediately
        setSignInEmail(signUpEmail);
        setActiveTab('signin');
        toast.info('This email is already registered. Please sign in instead.');
      } else {
        setSignUpError(err.message || 'Failed to create account or send verification code');
        toast.error(err.message || 'Failed to create account');
      }
      firebase.auth.clearRecaptcha();
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleVerifyPhoneCode = async (e) => {
    e.preventDefault();
    setVerificationError('');
    
    if (!verificationCode) {
      setVerificationError('Please enter the verification code');
      return;
    }

    setSignUpLoading(true);

    try {
      // In development mode, skip Firebase phone verification
      // In production, verify the actual SMS code
      const isDev = import.meta.env.MODE === 'development';
      
      if (!isDev) {
        // Production: Verify the phone code with Firebase
        await firebase.auth.verifyPhoneCode(verificationCode);
        console.log('✓ Phone code verified');
      } else {
        // Development: Accept any code
        console.log('Development mode: Skipping Firebase verification, accepting code:', verificationCode);
      }
      
      // Get signup data from sessionStorage (stored during signup step)
      const signupDataStr = sessionStorage.getItem('signupData');
      let signupData = null;
      
      if (signupDataStr) {
        signupData = JSON.parse(signupDataStr);
        console.log('Retrieved signup data from session:', signupData);
      } else {
        console.warn('⚠️ No signup data found in session, using form values');
      }
      
      const profileData = {
        phone: signupData?.normalizedPhone || signUpPhone.replace(/[\s\-\(\)]/g, ''),
        phone_verified: true,  // Mark as verified (development uses test mode, production uses real SMS)
        full_name: signupData?.full_name || signUpFullName,
        address: signupData?.address || signUpAddress,
        postcode: signupData?.postcode || signUpPostcode,
        state: signupData?.state || signUpState,
        created_date: new Date().toISOString(),
        role: 'user'
      };
      
      console.log('Profile data to save:', {
        phone: profileData.phone,
        full_name: profileData.full_name,
        address: profileData.address,
        postcode: profileData.postcode,
        state: profileData.state,
        phone_verified: profileData.phone_verified
      });
      
      // Update user profile to mark phone as verified and ensure all fields are set
      const user = firebase.auth.getCurrentUser();
      if (user) {
        console.log('Phone verification complete - updating Firestore profile:', profileData);
        await firebase.auth.updateProfile(profileData);
        console.log('✓ Profile updated with phone verification');
      }

      // Verify profile was created and contains address
      const verifyProfile = await firebase.auth.me();
      console.log('✓ Verified profile after update:', {
        full_name: verifyProfile.full_name,
        address: verifyProfile.address,
        postcode: verifyProfile.postcode,
        state: verifyProfile.state,
        phone_verified: verifyProfile.phone_verified
      });
      
      if (!verifyProfile.full_name) {
        console.warn('⚠️ Profile created but full_name is missing!');
      }
      if (!verifyProfile.address) {
        console.warn('⚠️ Profile created but address is missing!');
      }
      
      // Clean up session storage
      sessionStorage.removeItem('signupData');
      
      // Show success screen only
      setIsSignUpComplete(true);
      setVerificationCode('');
      setShowPhoneVerification(false);
      firebase.auth.clearRecaptcha();
      
      // Auto-navigate to Home after 3 seconds
      setTimeout(() => {
        navigate(createPageUrl('Home'));
      }, 3000);
    } catch (err) {
      setVerificationError(err.message || 'Verification failed');
    } finally {
      setSignUpLoading(false);
    }
  };

  
  // OAuth sign in/sign up handlers
  const handleOAuthSignIn = async (provider) => {
    setSignInLoading(true);
    setSignInError('');
    
    try {
      let user;
      
      if (provider === 'google') {
        user = await firebase.auth.signInWithGoogle();
      } else if (provider === 'facebook') {
        user = await firebase.auth.signInWithFacebook();
      } else if (provider === 'apple') {
        user = await firebase.auth.signInWithApple();
      }
      
      if (!user) {
        throw new Error('Failed to get user from OAuth provider');
      }
      
      console.log(`✓ ${provider} OAuth sign in successful:`, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      });
      
      // Check if profile already exists
      let existingProfile = await firebase.auth.me();
      
      if (!existingProfile || !existingProfile.full_name) {
        // Create or update profile with OAuth data
        const profileData = {
          email: user.email,
          full_name: user.displayName || user.email.split('@')[0],
          phone_verified: false,
          created_date: new Date().toISOString(),
          role: 'user'
        };
        
        console.log('Creating profile from OAuth data:', profileData);
        await firebase.auth.updateProfile(profileData);
        console.log('✓ Profile created from OAuth');
      } else {
        console.log('Profile already exists, skipping creation');
      }
      
      // Navigate to home
      toast.success(`Signed in with ${provider}!`);
      navigate(createPageUrl('Home'));
    } catch (err) {
      console.error(`${provider} OAuth error:`, err);
      let errorMsg = err.message || `Failed to sign in with ${provider}`;
      
      // Handle specific error cases
      if (err.message?.includes('popup-closed')) {
        errorMsg = 'Sign in was cancelled';
      } else if (err.message?.includes('popup-blocked')) {
        errorMsg = 'Sign in popup was blocked. Please allow popups for this site.';
      }
      
      setSignInError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSignInLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider) => {
    setSignUpLoading(true);
    setSignUpError('');
    
    try {
      let user;
      
      if (provider === 'google') {
        user = await firebase.auth.signInWithGoogle();
      } else if (provider === 'facebook') {
        user = await firebase.auth.signInWithFacebook();
      } else if (provider === 'apple') {
        user = await firebase.auth.signInWithApple();
      }
      
      if (!user) {
        throw new Error('Failed to get user from OAuth provider');
      }
      
      console.log(`✓ ${provider} OAuth sign up successful:`, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      });
      
      // Check if profile already exists
      let existingProfile = await firebase.auth.me();
      
      if (!existingProfile || !existingProfile.full_name) {
        // Create profile with OAuth data
        const profileData = {
          email: user.email,
          full_name: user.displayName || user.email.split('@')[0],
          phone_verified: false,
          created_date: new Date().toISOString(),
          role: 'user'
        };
        
        console.log('Creating profile from OAuth:', profileData);
        await firebase.auth.updateProfile(profileData);
        console.log('✓ Profile created from OAuth');
      }
      
      // Set signup complete to show success screen
      setIsSignUpComplete(true);
      setSignUpSuccess('');
      
      // Auto-navigate to Home after 3 seconds
      setTimeout(() => {
        navigate(createPageUrl('Home'));
      }, 3000);
      
      toast.success(`Account created with ${provider}!`);
    } catch (err) {
      console.error(`${provider} OAuth error:`, err);
      let errorMsg = err.message || `Failed to sign up with ${provider}`;
      
      // Handle specific error cases
      if (err.message?.includes('popup-closed')) {
        errorMsg = 'Sign up was cancelled';
      } else if (err.message?.includes('popup-blocked')) {
        errorMsg = 'Sign up popup was blocked. Please allow popups for this site.';
      }
      
      setSignUpError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    // Demo login removed
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
        <div className="max-w-md mx-auto pt-24 sm:pt-8 md:pt-20 relative z-10">
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
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              onClick={() => setActiveTab('signin')}
              className={`flex-1 py-2 px-4 font-medium text-center transition-colors ${
                activeTab === 'signin'
                  ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-2 px-4 font-medium text-center transition-colors ${
                activeTab === 'signup'
                  ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Sign In Tab */}
          {activeTab === 'signin' && (
            <>
              {signInError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{signInError}</p>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
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

              {/* 2FA Verification Form */}
              {show2FAVerification && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Enter Verification Code</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    We sent a 6-digit code to your phone: <br />
                    <span className="font-medium">{tempUserData?.phone}</span>
                  </p>

                  {twoFAError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-red-700 text-sm">{twoFAError}</p>
                    </div>
                  )}

                  <form onSubmit={handleVerify2FA} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength="6"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent text-center text-2xl tracking-widest"
                      />
                      <p className="text-xs text-slate-500 mt-1">Enter the 6-digit code</p>
                    </div>

                    <Button
                      type="submit"
                      disabled={twoFALoading}
                      className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2 rounded-lg"
                    >
                      {twoFALoading ? 'Verifying...' : 'Verify Code'}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setShow2FAVerification(false);
                        setTwoFACode('');
                        setTwoFAError('');
                        setTempUserData(null);
                        setSignInEmail('');
                        setSignInPassword('');
                      }}
                      className="w-full text-[#1e3a5f] hover:text-[#152a45] text-sm font-medium py-2"
                    >
                      Back to Sign In
                    </button>
                  </form>
                </div>
              )}

              {/* OAuth Divider */}
              {!show2FAVerification && (
                <>
                  <div className="my-6 flex items-center">
                    <div className="flex-1 border-t border-slate-300"></div>
                    <span className="px-2 text-xs text-slate-500">Or continue with</span>
                    <div className="flex-1 border-t border-slate-300"></div>
                  </div>

                  {/* OAuth Buttons */}
                  <div className="space-y-3">
                <button
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={signInLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </button>

                <button
                  onClick={() => handleOAuthSignIn('facebook')}
                  disabled={signInLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </button>

                <button
                  onClick={() => handleOAuthSignIn('apple')}
                  disabled={signInLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 13.5c-.91 0-1.82-.44-2.49-1.32-.67-.88-.67-2.04 0-2.92.67-.88 1.58-1.32 2.49-1.32s1.82.44 2.49 1.31c.67.88.67 2.04 0 2.93-.67.88-1.58 1.32-2.49 1.32zm-10.1 0c-.91 0-1.82-.44-2.49-1.32-.67-.88-.67-2.04 0-2.92.67-.88 1.58-1.32 2.49-1.32s1.82.44 2.49 1.31c.67.88.67 2.04 0 2.93-.67.88-1.58 1.32-2.49 1.32zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                  </svg>
                  Apple
                </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Sign Up Tab */}
          {activeTab === 'signup' && (
            <>
              {/* reCAPTCHA container - must persist across both form and verification */}
              <div id="recaptcha-container" className="mb-4"></div>

              {isSignUpComplete && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mb-4 flex justify-center">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Authentication Successful!</h2>
                    <p className="text-slate-600 mb-6">Your account has been created successfully.</p>
                    <p className="text-sm text-slate-500">Redirecting to home...</p>
                  </div>
                </div>
              )}

              {!isSignUpComplete && !showPhoneVerification && (
                <>
                  {signUpError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">{signUpError}</p>
                    </div>
                  )}

                  {signUpSuccess && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 text-sm">{signUpSuccess}</p>
                    </div>
                  )}

                  <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Address
                  </label>
                  <GooglePlacesAutocomplete
                    value={signUpAddress}
                    onChange={(val) => setSignUpAddress(val)}
                    onSelect={(place) => {
                      if (place.address) {
                        setSignUpAddress(place.address);
                        setSignUpPostcode(place.postcode || '');
                        setSignUpState(place.state || '');
                      }
                    }}
                    placeholder="123 Main Street, Sydney NSW 2000"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={signUpPhone}
                    onChange={(e) => setSignUpPhone(e.target.value)}
                    placeholder={phonePlaceholder}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Include country code (spaces and dashes optional)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={signUpLoading}
                  className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2 rounded-lg"
                >
                  {signUpLoading ? 'Sending verification code...' : 'Continue'}
                </Button>

                {/* OAuth Divider */}
                <div className="my-4 flex items-center">
                  <div className="flex-1 border-t border-slate-300"></div>
                  <span className="px-2 text-xs text-slate-500">Or sign up with</span>
                  <div className="flex-1 border-t border-slate-300"></div>
                </div>

                {/* OAuth Buttons */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleOAuthSignUp('google')}
                    disabled={signUpLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthSignUp('facebook')}
                    disabled={signUpLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthSignUp('apple')}
                    disabled={signUpLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 13.5c-.91 0-1.82-.44-2.49-1.32-.67-.88-.67-2.04 0-2.92.67-.88 1.58-1.32 2.49-1.32s1.82.44 2.49 1.31c.67.88.67 2.04 0 2.93-.67.88-1.58 1.32-2.49 1.32zm-10.1 0c-.91 0-1.82-.44-2.49-1.32-.67-.88-.67-2.04 0-2.92.67-.88 1.58-1.32 2.49-1.32s1.82.44 2.49 1.31c.67.88.67 2.04 0 2.93-.67.88-1.58 1.32-2.49 1.32zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                    </svg>
                    Apple
                  </button>
                </div>
              </form>

              <p className="text-xs text-slate-500 mt-4 text-center">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
                </>
              )}

              {!isSignUpComplete && showPhoneVerification && (
                <>
                  {verificationError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-700 text-sm">{verificationError}</p>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Verify Your Phone</h3>
                    <p className="text-sm text-slate-600">
                      We sent a verification code to<br />
                      <span className="font-medium">{signUpPhone}</span>
                    </p>
                  </div>

                  <form onSubmit={handleVerifyPhoneCode} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Verification Code
                      </label>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength="6"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent text-center text-2xl tracking-widest"
                      />
                      <p className="text-xs text-slate-500 mt-1">Enter the 6-digit code</p>
                    </div>

                    <Button
                      type="submit"
                      disabled={signUpLoading}
                      className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2 rounded-lg"
                    >
                      {signUpLoading ? 'Verifying...' : 'Verify & Create Account'}
                    </Button>
                  </form>

                  <button
                    onClick={() => {
                      setShowPhoneVerification(false);
                      setVerificationCode('');
                      firebase.auth.clearRecaptcha();
                    }}
                    className="w-full mt-4 text-[#1e3a5f] hover:text-[#152a45] text-sm font-medium"
                  >
                    Back to Sign Up
                  </button>
                </>
              )}
            </>
          )}
        </div>
        </div>
      </section>
    </div>
  );
}
