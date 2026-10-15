import React from 'react';
import { firebase } from '@/api/firebaseClient';
import { profileFromOAuthUser } from './loginForms';

const SIGN_IN = {
    google: () => firebase.auth.signInWithGoogle(),
    facebook: () => firebase.auth.signInWithFacebook(),
    apple: () => firebase.auth.signInWithApple(),
};

// Signs in with Google / Facebook / Apple and creates the profile on first sign-in.
// Throws (with err.mfaRequired) when the account has 2FA and the SMS step is needed.
export async function signInWithProvider(provider) {
    const user = await SIGN_IN[provider]();
    if (!user) throw new Error('Failed to get user from OAuth provider');

    const profile = await firebase.auth.me();
    if (!profile?.full_name) {
        await firebase.auth.updateProfile(profileFromOAuthUser(user));
    }
    return user;
}

const ICONS = {
    google: (
        <svg className="w-full h-full" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    ),
    facebook: (
        <svg className="w-full h-full text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    ),
    apple: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.05 13.5c-.91 0-1.82-.44-2.49-1.32-.67-.88-.67-2.04 0-2.92.67-.88 1.58-1.32 2.49-1.32s1.82.44 2.49 1.31c.67.88.67 2.04 0 2.93-.67.88-1.58 1.32-2.49 1.32zm-10.1 0c-.91 0-1.82-.44-2.49-1.32-.67-.88-.67-2.04 0-2.92.67-.88 1.58-1.32 2.49-1.32s1.82.44 2.49 1.31c.67.88.67 2.04 0 2.93-.67.88-1.58 1.32-2.49 1.32zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        </svg>
    ),
};

const LABELS = { google: 'Google', facebook: 'Facebook', apple: 'Apple' };

// Google / Facebook / Apple buttons. `compact` is the smaller style used under the sign-up form.
export default function OAuthButtons({ onSelect, disabled, label, compact = false }) {
    return (
        <>
            <div className={`${compact ? 'my-4' : 'my-6'} flex items-center`}>
                <div className="flex-1 border-t border-slate-300"></div>
                <span className="px-2 text-xs text-slate-500">{label}</span>
                <div className="flex-1 border-t border-slate-300"></div>
            </div>
            <div className={compact ? 'space-y-2' : 'space-y-3'}>
                {Object.keys(LABELS).map((provider) => (
                    <button
                        key={provider}
                        type="button"
                        onClick={() => onSelect(provider)}
                        disabled={disabled}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed${compact ? ' text-sm' : ''}`}
                    >
                        <span className={compact ? 'w-4 h-4' : 'w-5 h-5'}>{ICONS[provider]}</span>
                        {LABELS[provider]}
                    </button>
                ))}
            </div>
        </>
    );
}
