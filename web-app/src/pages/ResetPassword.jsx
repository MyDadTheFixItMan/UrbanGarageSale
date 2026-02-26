import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get('oobCode');
    const mode = searchParams.get('mode');
    
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [promoIndex, setPromoIndex] = useState(0);
    const [isConfirmingReset, setIsConfirmingReset] = useState(mode === 'resetPassword' && !!oobCode);

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

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!email) {
            setError('Please enter your email address');
            return;
        }

        setLoading(true);

        try {
            await firebase.auth.resetPassword(email);
            setSuccess('Password reset email sent! Check your inbox.');
            setEmail('');
            setTimeout(() => {
                window.location.href = createPageUrl('Login');
            }, 3000);
        } catch (err) {
            setError(err.message || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPasswordReset = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!newPassword) {
            setError('Please enter a new password');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            await firebase.auth.confirmPasswordResetCode(oobCode, newPassword);
            setSuccess('Password reset successful! Redirecting to login...');
            setTimeout(() => {
                window.location.href = createPageUrl('Login');
            }, 2000);
        } catch (err) {
            setError(err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] overflow-hidden pb-24 md:pb-0">
            {/* Watermark U Shape */}
            <style>{`
                @media (min-width: 768px) {
                    .watermark-page {
                        top: -90px !important;
                    }
                }
            `}</style>
            <img 
                src="/Logo Webpage.png" 
                alt="" 
                className="fixed left-0 pointer-events-none watermark-page"
                style={{
                    width: '1200px',
                    height: 'auto',
                    opacity: 0.35,
                    zIndex: 5,
                    objectFit: 'contain',
                    clipPath: 'polygon(0 0, 46% 0, 46% 100%, 0 100%)',
                    top: '35px'
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

            <section className="relative bg-[#f5f1e8] overflow-hidden">
                <div className="max-w-md mx-auto px-4 sm:px-6 pt-32 md:pt-20 pb-12 relative z-10">
                    <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
                        {/* Back Link */}
                        <Link to={createPageUrl('Login')} className="inline-flex items-center gap-2 text-[#1e3a5f] hover:text-[#152a45] text-sm font-medium mb-6">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Login
                        </Link>

                        {!isConfirmingReset ? (
                            <>
                                <div className="mb-8">
                                    <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Reset Your Password</h1>
                                    <p className="text-slate-600 text-sm">
                                        Enter your email address and we'll send you a link to reset your password.
                                    </p>
                                </div>

                                {error && (
                                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-700 text-sm">{error}</p>
                                    </div>
                                )}

                                {success && (
                                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-green-700 text-sm">{success}</p>
                                    </div>
                                )}

                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div>
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            className="mt-1.5"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Reset Email'
                                        )}
                                    </Button>
                                </form>

                                <div className="mt-6 pt-6 border-t text-center">
                                    <p className="text-slate-600 text-sm mb-3">Know your password?</p>
                                    <Link to={createPageUrl('Login')} className="inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#1e3a5f] font-medium rounded-lg transition-colors">
                                        Back to Sign In
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-8">
                                    <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Create New Password</h1>
                                    <p className="text-slate-600 text-sm">
                                        Please enter your new password below.
                                    </p>
                                </div>

                                {error && (
                                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-700 text-sm">{error}</p>
                                    </div>
                                )}

                                {success && (
                                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-green-700 text-sm">{success}</p>
                                    </div>
                                )}

                                <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                                    <div>
                                        <Label htmlFor="newPassword">New Password</Label>
                                        <Input
                                            id="newPassword"
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            className="mt-1.5"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
                                    </div>

                                    <div>
                                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm new password"
                                            className="mt-1.5"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-[#1e3a5f] hover:bg-[#152a45] text-white font-semibold py-2"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Resetting...
                                            </>
                                        ) : (
                                            'Reset Password'
                                        )}
                                    </Button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
