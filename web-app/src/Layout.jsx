import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { firebase } from '@/api/firebaseClient';
import { Plus, Heart, User, Home, Shield, LogOut, Smartphone } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { BUSINESS_NAME, BUSINESS_ABN } from '@/lib/business';

export default function Layout({ children, currentPageName }) {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Follows logins as they happen: signing up changes pages without reloading this header.
    useEffect(() => firebase.auth.onAuthStateChanged(async (authUser) => {
        setIsAuthenticated(!!authUser);
        setUser(authUser ? await firebase.auth.me() : null);
    }), []);

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

    // shortName labels the mobile bottom bar, where there is room for one word.
    const navItems = [
        { name: 'Home', shortName: 'Home', page: 'Home', icon: Home, requiresAuth: false },
        { name: 'Create Listing', shortName: 'Create', page: 'CreateListing', icon: Plus, requiresAuth: false },
        { name: 'Favourites', shortName: 'Favourites', page: 'SavedListings', icon: Heart, requiresAuth: false },
        { name: 'Urban Pay', shortName: 'Pay', page: 'UrbanPay', icon: Smartphone, requiresAuth: true },
        { name: 'Profile', shortName: 'Profile', page: 'Profile', icon: User, requiresAuth: true },
        { name: 'Admin', shortName: 'Admin', page: 'AdminDashboard', icon: Shield, requiresAuth: 'admin' },
    ];

    const visibleNavItems = navItems.filter((item) =>
        item.requiresAuth === false ||
        (item.requiresAuth === true && isAuthenticated) ||
        (item.requiresAuth === 'admin' && user?.role === 'admin')
    );

    return (
        <div className="min-h-screen bg-brand-cream flex flex-col pb-20 md:pb-0">
            {/* Header: logo, menu and log in/out. The three-column grid keeps the menu centred. */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 w-full h-20 flex items-center">
                <div className="w-full px-4 sm:px-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Link to={createPageUrl('Home')} className="justify-self-start flex-shrink-0">
                        <img
                            src="/logo-header.webp"
                            alt="Urban Garage Sale"
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
                            <Link to={createPageUrl('About')} className="text-xs md:text-sm hover:text-slate-300 transition-colors">About</Link>
                            <span className="text-xs md:text-sm text-slate-400">•</span>
                            <Link to={createPageUrl('Contact')} className="text-xs md:text-sm hover:text-slate-300 transition-colors">Contact</Link>
                            <span className="text-xs md:text-sm text-slate-400">•</span>
                            <Link to={createPageUrl('Privacy')} className="text-xs md:text-sm hover:text-slate-300 transition-colors">Privacy</Link>
                            <span className="text-xs md:text-sm text-slate-400">•</span>
                            <Link to={createPageUrl('Terms')} className="text-xs md:text-sm hover:text-slate-300 transition-colors">Terms</Link>
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
        </div>
    );
}
