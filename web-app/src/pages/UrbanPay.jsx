import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { AlertCircle, Smartphone } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function UrbanPay() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sellerStats, setSellerStats] = useState({ totalEarnings: 0, totalSales: 0 });
    const [quickAmounts] = useState([5, 10, 20, 50, 100]);
    const [promoIndex, setPromoIndex] = useState(0);
    const [cashAmount, setCashAmount] = useState('');
    const [cashDescription, setCashDescription] = useState('');
    const [isRecordingCash, setIsRecordingCash] = useState(false);

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

    async function recordCashSale() {
        if (!cashAmount || parseFloat(cashAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (!cashDescription || !cashDescription.trim()) {
            toast.error('Please enter a description');
            return;
        }

        setIsRecordingCash(true);

        try {
            // Get current user and token
            const currentUser = firebase.auth.getCurrentUser();
            if (!currentUser) {
                throw new Error('Not authenticated');
            }

            const token = await currentUser.getIdToken();
            const response = await fetch('https://urban-garage-sale.vercel.app/api/urbanPayment/recordSale', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: parseFloat(cashAmount),
                    description: cashDescription.trim(),
                    paymentMethod: 'cash',
                    sellerId: currentUser.uid,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed: ${response.status}`);
            }

            toast.success(`Cash sale recorded! $${parseFloat(cashAmount).toFixed(2)}`);
            
            // Reset form to empty strings (not undefined)
            setCashAmount('');
            setCashDescription('');
            
        } catch (error) {
            console.error('Error recording cash sale:', error);
            toast.error('Failed to record cash sale: ' + error.message);
        } finally {
            setIsRecordingCash(false);
        }
    }

    useEffect(() => {
        const init = async () => {
            try {
                const authenticated = await firebase.auth.isAuthenticated();
                if (!authenticated) {
                    window.location.href = '/login';
                    return;
                }

                const userData = await firebase.auth.me();
                setUser(userData);

                setLoading(false);
            } catch (error) {
                console.error('Urban Pay page init error:', error);
                toast.error('An error occurred');
                setLoading(false);
            }
        };
        init();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-[#FF9500] rounded-full animate-spin" />
                <p className="text-slate-600">Loading...</p>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f5f1e8' }} className="min-h-screen flex flex-col overflow-hidden pb-24 md:pb-0">
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
                className="fixed left-0 top-0 z-5 opacity-35 watermark-page"
                style={{
                    width: '1200px',
                    height: 'auto',
                    clipPath: 'polygon(0 0, 46% 0, 46% 100%, 0 100%)',
                    top: '35px',
                    pointerEvents: 'none'
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
            
            <div className="flex-1 flex items-center justify-center p-4 pt-32 md:pt-4 relative z-10">
                <Card className="max-w-2xl w-full">
                    <CardHeader className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Smartphone className="w-6 h-6 text-[#FF9500]" />
                            <CardTitle className="text-2xl">Urban Pay</CardTitle>
                        </div>
                        <CardDescription>
                            Accept payments from buyers during your garage sale
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Seller Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                                <p className="text-xs text-slate-600 font-semibold">Total Earnings</p>
                                <p className="text-2xl font-bold text-[#1e3a5f] mt-1">${sellerStats.totalEarnings.toFixed(2)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                                <p className="text-xs text-slate-600 font-semibold">Total Sales</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">{sellerStats.totalSales}</p>
                            </div>
                        </div>



                        {/* Quick Amount Buttons */}
                        <div>
                            <p className="text-sm font-semibold text-slate-700 mb-2">Quick Amounts</p>
                            <div className="grid grid-cols-5 gap-2">
                                {quickAmounts.map(amount => (
                                    <Button 
                                        key={amount}
                                        variant="outline"
                                        className="text-sm font-semibold hover:bg-[#1e3a5f] hover:text-white"
                                        onClick={() => setCashAmount(amount.toString())}
                                        disabled={isRecordingCash}
                                    >
                                        ${amount}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Manual Entry */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-amber-900 mb-2">Manual Sale Entry</p>
                            <p className="text-xs text-amber-800 mb-3">For cash payments - enter amount and description</p>
                            <div className="space-y-2">
                                <input 
                                    type="number" 
                                    placeholder="Amount ($)" 
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={cashAmount}
                                    onChange={(e) => setCashAmount(e.target.value)}
                                    disabled={isRecordingCash}
                                />
                                <input 
                                    type="text" 
                                    placeholder="Item description" 
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                    value={cashDescription}
                                    onChange={(e) => setCashDescription(e.target.value)}
                                    disabled={isRecordingCash}
                                />
                                <Button 
                                    onClick={recordCashSale}
                                    disabled={isRecordingCash}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                >
                                    {isRecordingCash ? 'Recording...' : 'Record Cash Sale'}
                                </Button>
                            </div>
                        </div>

                        {/* Urban Pay Info */}
                        <Alert className="border-blue-200 bg-blue-50">
                            <Smartphone className="w-4 h-4 text-blue-600" />
                            <AlertDescription className="text-sm text-blue-900">
                                <strong>Urban Pay:</strong> Real-time payment processing with Tap to Pay. Accept contactless payments directly on your phone with live earnings tracking.
                            </AlertDescription>
                        </Alert>

                        <div className="flex gap-2">
                            <Link to={createPageUrl('Home')} className="flex-1">
                                <Button variant="outline" className="w-full">
                                    Back to Home
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
