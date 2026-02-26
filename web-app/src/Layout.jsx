import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { firebase } from '@/api/firebaseClient';
import { Plus, Heart, User, Home, Shield, LogOut } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Layout({ children, currentPageName }) {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const authenticated = await firebase.auth.isAuthenticated();
            setIsAuthenticated(authenticated);
            if (authenticated) {
                const userData = await firebase.auth.me();
                setUser(userData);
            }
        };
        checkAuth();
    }, []);

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

    const navItems = [
        { name: 'Home', page: 'Home', icon: Home, requiresAuth: false },
        { name: 'Create Listing', page: 'CreateListing', icon: Plus, requiresAuth: false },
        { name: 'Favourites', page: 'SavedListings', icon: Heart, requiresAuth: false },
        { name: 'Profile', page: 'Profile', icon: User, requiresAuth: true },
        { name: 'Admin', page: 'AdminDashboard', icon: Shield, requiresAuth: 'admin' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <style>{`
                :root {
                    --primary: #1e3a5f;
                    --primary-light: #2d4a6f;
                    --primary-dark: #152a45;
                    --accent: #f97316;
                    --accent-light: #fb923c;
                }
            `}</style>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 w-full h-20 flex items-center">
                <div className="w-full px-4 sm:px-6 relative flex items-center justify-center">
                        {/* Logo */}
                        <Link to={createPageUrl('Home')} className="absolute -left-20 flex items-center flex-shrink-0">
                            <img 
                                src="/Logo Webpage.png" 
                                alt="Urban Garage Sale" 
                                className="h-36 w-auto"
                                style={{ minWidth: '324px', objectFit: 'contain' }}
                            />
                        </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const hasAccess = item.requiresAuth === false || 
                                            (item.requiresAuth === true && isAuthenticated) ||
                                            (item.requiresAuth === 'admin' && user?.role === 'admin');
                            
                            return (
                                <div
                                    key={item.page}
                                    style={{ visibility: !hasAccess ? 'hidden' : 'visible' }}
                                >
                                    <Link
                                        to={createPageUrl(item.page)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            currentPageName === item.page
                                                ? 'bg-[#1e3a5f] text-white'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {item.name}
                                    </Link>
                                </div>
                            );
                        })}
                    </nav>

                    {/* Auth Buttons - Desktop */}
                    <div className="absolute right-4 hidden md:flex items-center gap-3 flex-shrink-0">
                            {isAuthenticated ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="text-slate-600 hover:text-slate-900"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Log Out
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => window.location.href = '/login'}
                                    className="bg-[#1e3a5f] hover:bg-[#152a45] text-white"
                                >
                                    Sign Up / Log In
                                </Button>
                            )}
                        </div>

                    {/* Auth Buttons - Mobile */}
                    <div className="absolute right-4 md:hidden flex items-center gap-2 flex-shrink-0">
                        {isAuthenticated ? (
                            <button
                                onClick={handleLogout}
                                className="p-2 text-slate-600 hover:text-slate-900"
                                title="Log Out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        ) : (
                            <Button
                                onClick={() => window.location.href = '/login'}
                                className="bg-[#1e3a5f] hover:bg-[#152a45] text-white text-xs py-1 px-2"
                            >
                                Sign Up / Log In
                            </Button>
                        )}
                    </div>


                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20 md:pb-0 flex-1">
                {children}
            </main>

            {/* Footer Ribbon - Desktop Only */}
            <footer className="bg-[#001f3f] text-white hidden md:block">
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
                </div>
            </footer>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FF9500] border-t border-orange-400 z-40 w-full">
                <div className="flex justify-around items-center h-20">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const hasAccess = item.requiresAuth === false || 
                                        (item.requiresAuth === true && isAuthenticated) ||
                                        (item.requiresAuth === 'admin' && user?.role === 'admin');
                        
                        if (!hasAccess) return null;
                        
                        return (
                            <Link
                                key={item.page}
                                to={createPageUrl(item.page)}
                                className={`flex flex-col items-center justify-center w-16 h-20 transition-colors ${
                                    currentPageName === item.page
                                        ? 'text-white bg-orange-600'
                                        : 'text-white hover:text-orange-100'
                                }`}
                            >
                                <Icon className="w-5 h-5 mb-1" />
                                <span className="text-xs font-medium">{item.name.split(' ')[0]}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}