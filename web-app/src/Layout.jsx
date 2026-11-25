import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { firebase } from '@/api/firebaseClient';
import { Plus, Heart, User, Home, Shield, LogOut, Smartphone } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { BUSINESS_NAME, BUSINESS_ABN } from '@/lib/business';
import { profileProblem, normalizePhone } from '@/pages/login/loginForms';
import { toast } from 'sonner';
import { PAGE_META, pageDocumentTitle } from '@/lib/seo/site';

// Loaded only for someone who needs it, so the address lookup isn't in every page's download.
const CompleteProfileDialog = lazy(() => import('@/pages/profile/ProfileDialogs')
    .then((module) => ({ default: module.CompleteProfileDialog })));

const TwoFactorSetupDialog = lazy(() => import('@/components/TwoFactorSetupDialog'));

const SignInPromptDialog = lazy(() => import('@/components/SignInPromptDialog'));

// Texting the 2FA code automatically is skipped if it was done in the last few minutes (say, before
// a page refresh): repeated texts to one number make Google and carriers hold later ones.
const AUTO_SEND_GAP_MS = 10 * 60 * 1000;
function claimAutoSend(uid, now = Date.now()) {
    const key = `twofa-autosent-${uid}`;
    try {
        if (now - Number(sessionStorage.getItem(key) || 0) < AUTO_SEND_GAP_MS) return false;
        sessionStorage.setItem(key, String(now));
    } catch {
        // Storage blocked: send anyway; the Resend limit still applies.
    }
    return true;
}

// Every account needs 2FA, so a signed-in account without it gets this, after its profile is
// complete (the code goes to the mobile in the profile). Mounted only while needed, so the
// automatic send is decided once each time it appears.
function RequiredTwoFactor({ user, onEnabled, onSignOut }) {
    const [autoSend] = useState(() => claimAutoSend(user.id));
    return (
        <Suspense fallback={null}>
            <TwoFactorSetupDialog
                open
                required
                autoSend={autoSend}
                defaultPhone={user.phone || ''}
                onEnabled={onEnabled}
                onSignOut={onSignOut}
            />
        </Suspense>
    );
}

// Pages someone with an unfinished profile can still use: signing in and up (a new account's
// details are saved just after it's created), resetting a password, and reading the Terms and
// Privacy Policy.
const PROFILE_OPTIONAL_PAGES = ['Login', 'ResetPassword', 'Terms', 'Privacy'];

export default function Layout({ children, currentPageName }) {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    // False until Firebase has said whether anyone is signed in.
    const [authKnown, setAuthKnown] = useState(false);
    // The page whose "please sign in" popup is showing, if any.
    const [signInPromptPage, setSignInPromptPage] = useState(null);

    // Follows logins as they happen: signing up changes pages without reloading this header.
    useEffect(() => firebase.auth.onAuthStateChanged(async (authUser) => {
        setIsAuthenticated(!!authUser);
        setAuthKnown(true);
        setUser(authUser ? await firebase.auth.me() : null);
    }), []);

    // The browser tab's title. The sale and suburb pages set their own (not in PAGE_META).
    useEffect(() => {
        const title = currentPageName !== 'ListingDetails' && pageDocumentTitle(currentPageName);
        if (title) document.title = title;
    }, [currentPageName]);

    // Read again on each page: sign-up saves the profile after the sign-in event above.
    useEffect(() => {
        if (!firebase.auth.getCurrentUser()) return;
        firebase.auth.me().then(setUser).catch(() => {});
    }, [currentPageName]);

    // Whether the signed-in account has 2FA (null until known).
    const [twoFAEnabled, setTwoFAEnabled] = useState(null);
    useEffect(() => {
        if (!user) {
            setTwoFAEnabled(null);
            return;
        }
        firebase.auth.is2FAEnabled().then(setTwoFAEnabled).catch(() => setTwoFAEnabled(null));
    }, [user]);

    const mustFinishAccount = Boolean(user) && !user.profile_unavailable &&
        !PROFILE_OPTIONAL_PAGES.includes(currentPageName);
    const needsProfile = mustFinishAccount && Boolean(profileProblem(user));
    const needsTwoFactor = mustFinishAccount && !needsProfile && twoFAEnabled === false;

    // Called once the mobile is enrolled as a Firebase second factor.
    const handleTwoFactorEnabled = async ({ signInAgain, phone }) => {
        setTwoFAEnabled(true);
        // Someone who used a different number for 2FA keeps their profile in step with it.
        const enrolled = normalizePhone(phone).phone;
        if (enrolled && enrolled !== user?.phone) {
            firebase.auth.updateProfile({ phone: enrolled })
                .then(() => setUser((prev) => ({ ...prev, phone: enrolled })))
                .catch((error) => console.warn('Profile phone not updated:', error.message));
        }
        if (signInAgain) {
            // This session started before 2FA existed; a fresh sign-in (with the SMS code) is needed.
            toast.success('Two-step sign-in is on. Please sign in again; we\'ll text you a code.');
            await firebase.auth.logout();
            window.location.href = '/login';
            return;
        }
        toast.success('Two-step sign-in is on');
    };

    const handleLogout = async () => {
        try {
            await firebase.auth.logout();
            setIsAuthenticated(false);
            setUser(null);
            // Redirect to home page after logout
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    // shortName labels the mobile bottom bar, where there is room for one word. Items with
    // signInPrompt are shown to everyone, but someone signed out gets a popup asking them to sign in.
    const navItems = [
        { name: 'Home', shortName: 'Home', page: 'Home', icon: Home, requiresAuth: false },
        { name: 'Create Listing', shortName: 'Create', page: 'CreateListing', icon: Plus, requiresAuth: false, signInPrompt: true },
        { name: 'Favourites', shortName: 'Favourites', page: 'SavedListings', icon: Heart, requiresAuth: false, signInPrompt: true },
        { name: 'Urban Pay', shortName: 'Pay', page: 'UrbanPay', icon: Smartphone, requiresAuth: true },
        { name: 'Profile', shortName: 'Profile', page: 'Profile', icon: User, requiresAuth: true },
        { name: 'Admin', shortName: 'Admin', page: 'AdminDashboard', icon: Shield, requiresAuth: 'admin' },
    ];

    const visibleNavItems = navItems.filter((item) =>
        item.requiresAuth === false ||
        (item.requiresAuth === true && isAuthenticated) ||
        (item.requiresAuth === 'admin' && user?.role === 'admin')
    );

    // Before Firebase answers, the link works as normal; the page itself sends anyone signed out
    // to the login page.
    const handleNavClick = (item) => (event) => {
        if (item.signInPrompt && authKnown && !isAuthenticated) {
            event.preventDefault();
            setSignInPromptPage(item.page);
        }
    };

    return (
        <div className="min-h-screen bg-brand-cream flex flex-col pb-20 md:pb-0">
            {/* Header: logo, menu and log in/out. The three-column grid keeps the menu centred. */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 w-full h-20 flex items-center">
                <div className="w-full px-4 sm:px-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Link to={createPageUrl('Home')} className="justify-self-start flex-shrink-0">
                        <img
                            src="/logo-header.webp"
                            alt="Urban Garage Sales"
                            width="383"
                            height="176"
                            className="h-12 md:h-14 w-auto"
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {visibleNavItems.map((item) => (
                            <Link
                                key={item.page}
                                to={createPageUrl(item.page)}
                                onClick={handleNavClick(item)}
                                aria-current={currentPageName === item.page ? 'page' : undefined}
                                className={`px-2.5 lg:px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                                    currentPageName === item.page
                                        ? 'bg-navy text-white'
                                        : 'text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>

                    <div className="justify-self-end col-start-3 flex items-center gap-2">
                        {isAuthenticated ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="text-slate-700 hover:text-slate-900"
                                aria-label="Log Out"
                            >
                                <LogOut className="w-4 h-4 lg:mr-2" />
                                <span className="hidden lg:inline">Log Out</span>
                            </Button>
                        ) : (
                            <Button
                                onClick={() => window.location.href = '/login'}
                                className="bg-navy hover:bg-navy-dark text-white text-xs md:text-sm px-3 md:px-4"
                            >
                                Sign Up / Log In
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 flex-1">
                {children}
            </main>

            {/* Footer Ribbon */}
            <footer className="bg-navy-dark text-white">
                <div className="w-full px-4 py-4 md:py-6">
                    <div className="flex items-center justify-center md:justify-center">
                        <nav className="flex items-center gap-4 md:gap-6 flex-wrap justify-center">
                            <Link to={PAGE_META.About.path} className="text-xs md:text-sm hover:text-slate-300 transition-colors">About</Link>
                            <span className="text-xs md:text-sm text-slate-400">•</span>
                            <Link to={PAGE_META.Contact.path} className="text-xs md:text-sm hover:text-slate-300 transition-colors">Contact</Link>
                            <span className="text-xs md:text-sm text-slate-400">•</span>
                            <Link to={PAGE_META.Privacy.path} className="text-xs md:text-sm hover:text-slate-300 transition-colors">Privacy</Link>
                            <span className="text-xs md:text-sm text-slate-400">•</span>
                            <Link to={PAGE_META.Terms.path} className="text-xs md:text-sm hover:text-slate-300 transition-colors">Terms</Link>
                        </nav>
                    </div>
                    <p className="mt-2 text-center text-xs text-slate-300">
                        © {new Date().getFullYear()} {BUSINESS_NAME}{BUSINESS_ABN && ` · ABN ${BUSINESS_ABN}`}
                    </p>
                </div>
            </footer>

            {/* Mobile Bottom Navigation: white so the labels stay readable, with the current page in orange. */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-40 w-full">
                <div className="flex justify-around items-stretch h-20">
                    {visibleNavItems.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = currentPageName === item.page;
                        return (
                            <Link
                                key={item.page}
                                to={createPageUrl(item.page)}
                                onClick={handleNavClick(item)}
                                aria-current={isCurrent ? 'page' : undefined}
                                className={`flex-1 flex flex-col items-center justify-center border-t-[3px] transition-colors ${
                                    isCurrent
                                        ? 'text-brand-orange-dark border-brand-orange'
                                        : 'text-slate-600 border-transparent hover:text-navy'
                                }`}
                            >
                                <Icon className="w-5 h-5 mb-1" />
                                <span className={`text-xs ${isCurrent ? 'font-bold' : 'font-medium'}`}>{item.shortName}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {signInPromptPage && (
                <Suspense fallback={null}>
                    <SignInPromptDialog page={signInPromptPage} onClose={() => setSignInPromptPage(null)} />
                </Suspense>
            )}
            {needsProfile && (
                <Suspense fallback={null}>
                    <CompleteProfileDialog
                        user={user}
                        onSaved={(saved) => setUser((prev) => ({ ...prev, ...saved }))}
                        onSignOut={handleLogout}
                    />
                </Suspense>
            )}
            {needsTwoFactor && (
                <RequiredTwoFactor key={user.id} user={user} onEnabled={handleTwoFactorEnabled} onSignOut={handleLogout} />
            )}
        </div>
    );
}
