import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { AlertCircle, QrCode } from 'lucide-react';
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
                            <QrCode className="w-6 h-6 text-[#FF9500]" />
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

                        {/* QR Code Display */}
                        <div className="bg-white border-2 border-dashed border-[#1e3a5f] rounded-lg p-6 text-center">
                            <QrCode className="w-12 h-12 text-[#1e3a5f] mx-auto mb-3" />
                            <p className="text-sm font-semibold text-[#1e3a5f]">Your Payment QR Code</p>
                            <p className="text-xs text-slate-600 mt-1 mb-4">Buyers scan this to pay you directly</p>
                            
                            <div className="bg-slate-100 rounded-lg p-6 mb-4 flex items-center justify-center aspect-square">
                                <div className="text-center">
                                    <QrCode className="w-20 h-20 text-slate-400 mx-auto" />
                                    <p className="text-xs text-slate-500 mt-2">QR Code would display here</p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">Seller ID: {user?.uid?.substring(0, 8)}...</p>
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
                                    defaultValue="0"
                                />
                                <input 
                                    type="text" 
                                    placeholder="Item description" 
                                    className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                                <Button className="w-full bg-green-600 hover:bg-green-700">
                                    Record Cash Sale
                                </Button>
                            </div>
                        </div>

                        {/* Urban Pay Info */}
                        <Alert className="border-blue-200 bg-blue-50">
                            <QrCode className="w-4 h-4 text-blue-600" />
                            <AlertDescription className="text-sm text-blue-900">
                                <strong>Urban Pay:</strong> Real-time payment processing for your garage sale. Accept card and cash payments with live earnings tracking.
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
