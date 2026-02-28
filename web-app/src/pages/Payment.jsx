import React, { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Check, Loader2, ArrowLeft, AlertCircle, QrCode, DollarSign } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Payment() {
    const queryClient = useQueryClient();
    const urlParams = new URLSearchParams(window.location.search);
    const saleId = urlParams.get('id');
    const sessionId = urlParams.get('session_id');
    const tab = urlParams.get('tab') || 'buyer'; // 'buyer' or 'seller'

    const [user, setUser] = useState(null);
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [promoIndex, setPromoIndex] = useState(0);
    const [activeTab, setActiveTab] = useState(tab);
    const [sellerStats, setSellerStats] = useState({ totalEarnings: 0, totalSales: 0 });
    const [quickAmounts] = useState([5, 10, 20, 50, 100]);

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

    const handleCheckout = async () => {
        if (!saleId) {
            toast.error('Sale ID is missing');
            return;
        }
        
        setProcessingPayment(true);
        try {
            const result = await firebase.functions.invoke('createStripeCheckout', {
                saleId: saleId,
                saleTitle: sale?.title || 'Garage Sale Listing',
            });

            if (result?.url) {
                window.location.href = result.url;
            } else {
                throw new Error('No checkout URL returned from server');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            toast.error('Failed to start payment: ' + error.message);
            setProcessingPayment(false);
        }
    };

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

                if (saleId) {
                    try {
                        const sales = await firebase.entities.GarageSale.filter({ id: saleId });
                        if (sales[0] && sales[0].created_by === userData.email) {
                            setSale(sales[0]);
                        }
                    } catch (error) {
                        console.error('Error fetching sale:', error);
                    }
                }

                // If returning from Stripe checkout with session_id
                if (sessionId) {
                    setProcessingPayment(true);
                    try {
                        // Verify payment
                        const result = await firebase.functions.invoke('verifyStripePayment', {
                            sessionId: sessionId,
                            saleId: saleId,
                        });

                        if (result?.success) {
                            // Create payment record in Firestore
                            await firebase.entities.Payment.create({
                                garage_sale_id: saleId,
                                user_email: userData.email,
                                amount: 10,
                                status: 'completed',
                                payment_method: 'stripe',
                                transaction_id: sessionId,
                            });

                            // Update listing status to pending_approval
                            await firebase.entities.GarageSale.update(saleId, {
                                status: 'pending_approval',
                                payment_status: 'paid',
                            });

                            setPaymentSuccess(true);
                            // Invalidate queries to refresh data in admin dashboard
                            await queryClient.invalidateQueries({ queryKey: ['allPayments'] });
                            await queryClient.invalidateQueries({ queryKey: ['allListings'] });
                            if (userData?.email) {
                                await queryClient.invalidateQueries({ queryKey: ['userListings', userData.email] });
                            }
                            toast.success('Payment successful! Your listing is pending approval.');
                        } else {
                            toast.error('Payment verification failed: ' + (result?.message || 'Unknown error'));
                        }
                    } catch (error) {
                        console.error('Payment verification error:', error);
                        toast.error('Failed to verify payment: ' + error.message);
                    } finally {
                        setProcessingPayment(false);
                    }
                }

                setLoading(false);
            } catch (error) {
                console.error('Payment page init error:', error);
                toast.error('An error occurred');
                setLoading(false);
            }
        };
        init();
    }, [sessionId, saleId, queryClient]);

    if (loading || processingPayment) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
                <p className="text-slate-600">
                    {processingPayment ? 'Verifying your payment...' : 'Loading...'}
                </p>
            </div>
        );
    }

    if (paymentSuccess) {
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
                    <Card className="max-w-md w-full border-green-200 bg-green-50">
                        <CardHeader className="text-center pb-4">
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                            <CardTitle className="text-2xl text-green-900">Payment Successful!</CardTitle>
                            <CardDescription className="text-green-700">
                                Your listing has been submitted for review
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert className="border-green-200 bg-white">
                                <AlertCircle className="w-4 h-4 text-green-600" />
                                <AlertDescription className="text-green-900">
                                    Your listing is pending approval. You'll receive an email once it's live.
                                </AlertDescription>
                            </Alert>

                            <div className="flex flex-col gap-3">
                                <Link to={createPageUrl('Profile')} className="w-full">
                                    <Button variant="outline" className="w-full">
                                        View My Listings
                                    </Button>
                                </Link>
                                <Link to={createPageUrl('Home')} className="w-full">
                                    <Button className="w-full bg-[#1e3a5f] hover:bg-[#152a45]">
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

    // If no session_id, show payment checkout
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
                        <CardTitle>Payment Options</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="buyer" className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="hidden sm:inline">Buyer Payment</span>
                                    <span className="sm:hidden">Buyer</span>
                                </TabsTrigger>
                                <TabsTrigger value="seller" className="flex items-center gap-2">
                                    <QrCode className="w-4 h-4" />
                                    <span className="hidden sm:inline">Seller (Urban Pay)</span>
                                    <span className="sm:hidden">Seller</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* BUYER TAB - Original Stripe Payment */}
                            <TabsContent value="buyer" className="space-y-4">
                                <Alert>
                                    <AlertCircle className="w-4 h-4" />
                                    <AlertDescription>
                                        Complete payment for your listing to get it approved.
                                    </AlertDescription>
                                </Alert>

                                <div className="bg-slate-100 rounded-lg p-4 text-center">
                                    <p className="text-sm text-slate-600 mb-2">Listing Fee</p>
                                    <p className="text-3xl font-bold text-[#1e3a5f]">$10.00</p>
                                    <p className="text-xs text-slate-500 mt-2">One-time fee to list your garage sale</p>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Button 
                                        onClick={handleCheckout} 
                                        disabled={processingPayment}
                                        className="w-full bg-[#1e3a5f] hover:bg-[#152a45]"
                                    >
                                        {processingPayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        {processingPayment ? 'Processing...' : 'Pay $10.00 with Stripe'}
                                    </Button>
                                    <Link to={createPageUrl('Profile')}>
                                        <Button variant="outline" className="w-full">
                                            <ArrowLeft className="w-4 h-4 mr-2" />
                                            Back to My Listings
                                        </Button>
                                    </Link>
                                </div>
                            </TabsContent>

                            {/* SELLER TAB - Urban Pay */}
                            <TabsContent value="seller" className="space-y-4">
                                <Alert className="border-blue-200 bg-blue-50">
                                    <QrCode className="w-4 h-4 text-blue-600" />
                                    <AlertDescription className="text-blue-900">
                                        Accept payments from buyers during your garage sale with Urban Pay
                                    </AlertDescription>
                                </Alert>

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
                                <Alert className="border-slate-200 bg-slate-50">
                                    <AlertCircle className="w-4 h-4 text-slate-600" />
                                    <AlertDescription className="text-sm text-slate-700">
                                        <strong>Urban Pay:</strong> Real-time payment processing for your garage sale. Accept card and cash payments with live earnings tracking.
                                        <br />
                                        <a href="https://urban-garage-sale.vercel.app" className="text-blue-600 hover:underline text-xs mt-1 inline-block">Learn more →</a>
                                    </AlertDescription>
                                </Alert>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}