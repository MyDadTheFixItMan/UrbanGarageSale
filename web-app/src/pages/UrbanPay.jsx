import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { AlertCircle, Smartphone, RefreshCw, CreditCard, DollarSign, Smartphone as SmartphoneIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

export default function UrbanPay() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sellerStats, setSellerStats] = useState({ totalEarnings: 0, totalSales: 0 });
    const [quickAmounts] = useState([5, 10, 20, 50, 100]);
    const [promoIndex, setPromoIndex] = useState(0);
    const [cashAmount, setCashAmount] = useState('');
    const [cashDescription, setCashDescription] = useState('');
    const [isRecordingCash, setIsRecordingCash] = useState(false);
    const [isRefreshingStats, setIsRefreshingStats] = useState(false);
    const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false);
    const [cardAmount, setCardAmount] = useState('');
    const [cardDescription, setCardDescription] = useState('');
    const [isProcessingCard, setIsProcessingCard] = useState(false);
    const [showCashModal, setShowCashModal] = useState(false);
    const [showCardModal, setShowCardModal] = useState(false);

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

    // Fetch seller stats from Firestore
    async function refreshSellerStats() {
        if (!user || !user.id) {
            console.warn('refreshSellerStats: No user or user.id');
            return;
        }
        
        console.log('Refreshing seller stats for user:', user.id);
        setIsRefreshingStats(true);
        try {
            const statsDoc = await firebase.firestore.collection('sellerStats').doc(user.id).get();
            console.log('Stats doc exists:', statsDoc.exists);
            
            if (statsDoc.exists) {
                const data = statsDoc.data();
                console.log('Seller stats data:', data);
                setSellerStats(data);
            } else {
                console.log('No stats document yet, initializing with zeros');
                // If document doesn't exist yet, initialize with zeros
                setSellerStats({ totalEarnings: 0, totalSales: 0 });
            }
        } catch (error) {
            console.error('Error fetching seller stats:', error.message, error.code);
            toast.error(`Failed to load seller stats: ${error.message}`);
        } finally {
            setIsRefreshingStats(false);
        }
    }

    // Rotate promotional messages every 5 seconds
    useEffect(() => {
        if (allPromotions.length === 0) return;
        const interval = setInterval(() => {
            setPromoIndex((prevIndex) => (prevIndex + 1) % allPromotions.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [allPromotions.length]);

    async function recordCardPayment() {
        if (!cardAmount || parseFloat(cardAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (!cardDescription || !cardDescription.trim()) {
            toast.error('Please enter a description');
            return;
        }

        setIsProcessingCard(true);

        try {
            const currentUser = firebase.auth.getCurrentUser();
            if (!currentUser) {
                throw new Error('Not authenticated');
            }

            const token = await currentUser.getIdToken();
            
            // Create payment intent
            const response = await fetch('https://urban-garage-sale.vercel.app/api/urbanPayment/createPaymentIntent', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: parseFloat(cardAmount),
                    description: cardDescription.trim(),
                    sellerId: currentUser.uid,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: errorData
                });
                throw new Error(errorData.error || `Failed to create payment (${response.status})`);
            }

            const data = await response.json();
            
            // Log the payment intent for testing
            console.log('Payment intent created:', data.paymentIntentId);
            
            // Now record the sale in Firestore
            const recordSaleResponse = await fetch('https://urban-garage-sale.vercel.app/api/urbanPayment/recordTapToPaySale', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: parseFloat(cardAmount),
                    description: cardDescription.trim(),
                    paymentIntentId: data.paymentIntentId,
                    currency: 'aud',
                    paymentMethod: 'tap_to_pay',
                }),
            });

            if (!recordSaleResponse.ok) {
                const errorData = await recordSaleResponse.json().catch(() => ({}));
                console.error('Record Sale Error:', errorData);
                throw new Error(errorData.error || 'Failed to record sale in database');
            }

            const saleData = await recordSaleResponse.json();
            console.log('Sale recorded:', saleData.saleId);
            console.log('Payment status:', saleData.paymentStatus);
            
            if (saleData.paymentStatus === 'succeeded') {
              toast.success('Card payment processed successfully!');
            } else if (saleData.paymentStatus === 'requires_action') {
              toast.success('Payment is awaiting confirmation. You may see it shortly.');
            } else {
              toast.success(`Payment recorded with status: ${saleData.paymentStatus}`);
            }
            
            // Reset form
            setCardAmount('');
            setCardDescription('');
            
            // Close modal
            setShowCardModal(false);
            
            // Refresh stats
            refreshSellerStats();
        } catch (error) {
            console.error('Card payment error:', error);
            toast.error(error.message || 'Failed to process card payment');
        } finally {
            setIsProcessingCard(false);
        }
    }

    async function recordCashSale() {
        console.log('[recordCashSale] Starting...');
        
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
            console.log('[recordCashSale] User:', user?.id);
            
            if (!user || !user.id) {
                throw new Error('User not authenticated');
            }

            // Use Firestore Web SDK directly
            const saleData = {
                sellerId: user.id,
                amount: parseFloat(cashAmount),
                description: cashDescription.trim(),
                paymentMethod: 'cash',
                status: 'completed',
                createdAt: new Date(),
            };

            console.log('[recordCashSale] Creating sale document:', saleData);
            
            // Create the sale document
            const saleRef = await firebase.firestore.collection('sales').add(saleData);
            console.log('[recordCashSale] Sale created:', saleRef.id);

            // Update seller stats
            console.log('[recordCashSale] Updating seller stats...');
            const statsRef = firebase.firestore.collection('sellerStats').doc(user.id);
            const statsDoc = await statsRef.get();

            if (statsDoc.exists) {
                const currentStats = statsDoc.data();
                await statsRef.update({
                    totalEarnings: (currentStats.totalEarnings || 0) + parseFloat(cashAmount),
                    completedEarnings: (currentStats.completedEarnings || 0) + parseFloat(cashAmount),
                    totalSales: (currentStats.totalSales || 0) + 1,
                    completedSales: (currentStats.completedSales || 0) + 1,
                    lastSaleDate: new Date(),
                });
            } else {
                await statsRef.set({
                    totalEarnings: parseFloat(cashAmount),
                    completedEarnings: parseFloat(cashAmount),
                    pendingEarnings: 0,
                    totalSales: 1,
                    completedSales: 1,
                    pendingSales: 0,
                    lastSaleDate: new Date(),
                });
            }

            console.log('[recordCashSale] Stats updated');
            
            toast.success(`Cash sale recorded! $${parseFloat(cashAmount).toFixed(2)}`);
            
            // Reset form
            setCashAmount('');
            setCashDescription('');
            setShowCashModal(false);
            
            // Refresh stats
            await refreshSellerStats();
            
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

                // Enforce 2FA - redirect if not enabled
                const is2FAEnabled = await firebase.auth.is2FAEnabled();
                if (!is2FAEnabled) {
                    toast.error('Two-Factor Authentication is required. Please complete setup on your Profile page.');
                    setTimeout(() => {
                        window.location.href = '/profile';
                    }, 2000);
                    return;
                }

                const userData = await firebase.auth.me();
                setUser(userData);

                // Load seller stats after user is set
                await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay to ensure state update
                setLoading(false);
            } catch (error) {
                console.error('Urban Pay page init error:', error);
                toast.error('An error occurred');
                setLoading(false);
            }
        };
        init();
    }, []);

    // Load seller stats and card payments status when user is available
    useEffect(() => {
        if (user) {
            refreshSellerStats();
            // Check if card payments are enabled
            setCardPaymentsEnabled(user.stripeConnectId ? true : false);
        }
    }, [user]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-[#FF9500] rounded-full animate-spin" />
                <p className="text-slate-600">Loading...</p>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f5f1e8' }} className="min-h-screen overflow-hidden pb-24 md:pb-0">
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
                        top: '60px',
                        zIndex: 1,
                        opacity: 0.4,
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
                
                <section className="relative bg-[#f5f1e8] py-16 px-4 sm:px-6 overflow-hidden">
                <div className="max-w-4xl mx-auto pt-2 md:pt-4 relative z-10">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                            <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#1e3a5f]">Urban Pay</h1>
                            <p className="text-slate-500">Accept payments from buyers during your garage sale</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-6 relative z-20 mt-8">
                        <div className="space-y-6">
                        {/* Seller Stats */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-slate-700">Your Earnings</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={refreshSellerStats}
                                    disabled={isRefreshingStats}
                                    className="h-8 w-8 p-0"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRefreshingStats ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                                    <p className="text-xs text-slate-600 font-semibold">Total Earnings</p>
                                    <p className="text-2xl font-bold text-[#1e3a5f] mt-1">${typeof sellerStats.totalEarnings === 'number' ? sellerStats.totalEarnings.toFixed(2) : '0.00'}</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                                    <p className="text-xs text-slate-600 font-semibold">Total Sales</p>
                                    <p className="text-2xl font-bold text-green-600 mt-1">{typeof sellerStats.totalSales === 'number' ? sellerStats.totalSales : 0}</p>
                                </div>
                            </div>
                        </div>



                        {/* Cash Sale & Card Payments - Side by Side */}
                        <div className="grid grid-cols-2 gap-4 sm:gap-6">
                            {/* Cash Sale Box */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-6 flex flex-col">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <DollarSign className="w-5 h-5 text-amber-700" />
                                    </div>
                                    <h3 className="text-base sm:text-lg font-semibold text-amber-900">Cash Sale</h3>
                                </div>
                                <p className="text-xs sm:text-sm text-amber-800 mb-6 flex-1">Record cash payments from your customers right away.</p>
                                <Button 
                                    onClick={() => setShowCashModal(true)}
                                    className="w-full bg-green-600 hover:bg-green-700 text-sm sm:text-base"
                                >
                                    Add Cash Sale
                                </Button>
                            </div>

                            {/* Card Payments Box */}
                            {cardPaymentsEnabled ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <CreditCard className="w-5 h-5 text-blue-700" />
                                        </div>
                                        <h3 className="text-base sm:text-lg font-semibold text-blue-900">Tap to Pay</h3>
                                    </div>
                                    <p className="text-xs sm:text-sm text-blue-800 mb-6 flex-1">Process card payments using your phone with Tap to Pay.</p>
                                    <Button 
                                        onClick={() => setShowCardModal(true)}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
                                    >
                                        Add Card Payment
                                    </Button>
                                </div>
                            ) : (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 sm:p-6 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                            <CreditCard className="w-5 h-5 text-purple-700" />
                                        </div>
                                        <h3 className="text-base sm:text-lg font-semibold text-purple-900">Tap to Pay</h3>
                                    </div>
                                    <p className="text-xs sm:text-sm text-purple-800 mb-6 flex-1">Enable card payments in your <Link to={createPageUrl('Profile')} className="underline font-semibold">Profile Settings</Link> to accept Tap to Pay.</p>
                                    <Button 
                                        disabled
                                        variant="outline"
                                        className="w-full opacity-50 cursor-not-allowed text-sm sm:text-base"
                                    >
                                        Disabled
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Cash Sale Modal */}
                        <Dialog open={showCashModal} onOpenChange={setShowCashModal}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Record Cash Sale</DialogTitle>
                                    <DialogDescription>
                                        Enter the amount and item description for this cash transaction.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Amount ($)</label>
                                        <input 
                                            type="number" 
                                            placeholder="0.00" 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                            value={cashAmount}
                                            onChange={(e) => setCashAmount(e.target.value)}
                                            disabled={isRecordingCash}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Item Description</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g., Vintage lamp, Books bundle, Furniture" 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                            value={cashDescription}
                                            onChange={(e) => setCashDescription(e.target.value)}
                                            disabled={isRecordingCash}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setShowCashModal(false)}
                                        disabled={isRecordingCash}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            recordCashSale();
                                        }}
                                        disabled={isRecordingCash}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {isRecordingCash ? 'Recording...' : 'Record Sale'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Card Payment Modal */}
                        <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Process Card Payment</DialogTitle>
                                    <DialogDescription>
                                        Enter the amount and item description for this card transaction.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Amount ($)</label>
                                        <input 
                                            type="number" 
                                            placeholder="0.00" 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={cardAmount}
                                            onChange={(e) => setCardAmount(e.target.value)}
                                            disabled={isProcessingCard}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-1 block">Item Description</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g., Vintage lamp, Books bundle, Furniture" 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={cardDescription}
                                            onChange={(e) => setCardDescription(e.target.value)}
                                            disabled={isProcessingCard}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setShowCardModal(false)}
                                        disabled={isProcessingCard}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            recordCardPayment();
                                        }}
                                        disabled={isProcessingCard}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        {isProcessingCard ? 'Processing...' : 'Process Payment'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

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
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
