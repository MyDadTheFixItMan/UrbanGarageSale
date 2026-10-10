import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { formatAud } from '@/lib/format';
import { Smartphone, RefreshCw, CreditCard, DollarSign, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import CashSaleDialog from './urbanpay/CashSaleDialog';
import SalesHistoryDialog from './urbanpay/SalesHistoryDialog';
import { sortSalesNewestFirst } from './urbanpay/salesReport';

const EMPTY_STATS = { totalEarnings: 0, totalSales: 0 };

// The web dashboard has no card reader, so it cannot take card payments itself.
// Card sales are taken in the Urban Pay mobile app (Tap to Pay), which records them
// only after Stripe confirms the payment succeeded.
const CARD_PAYMENT_NOTICE = 'Card payments are taken with Tap to Pay in the Urban Pay mobile app. They will appear here once completed.';

// Urban Pay needs a signed-in user whose current session completed SMS 2FA.
function useUrbanPayUser() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const init = async () => {
            try {
                if (!(await firebase.auth.isAuthenticated())) {
                    window.location.href = '/login';
                    return;
                }
                if (!(await firebase.auth.is2FAEnabled())) {
                    toast.error('Two-Factor Authentication is required for Urban Pay. Please enable 2FA on your Profile page.');
                    setTimeout(() => {
                        window.location.href = '/profile';
                    }, 2000);
                    return;
                }
                // 2FA must have been completed in this sign-in (the server and Firestore rules check the same).
                if (!(await firebase.auth.hasSecondFactorSession())) {
                    toast.error('Please sign in again with your password and SMS code to continue.');
                    await firebase.auth.logout();
                    window.location.href = '/login';
                    return;
                }
                setUser(await firebase.auth.me());
            } catch (error) {
                console.error('Urban Pay page init error:', error);
                toast.error('An error occurred');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);
    return { user, loading };
}

function usePromoRotation(count) {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        if (count === 0) return;
        const interval = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
        return () => clearInterval(interval);
    }, [count]);
    return index;
}

// Full class names (not built from the tone) so Tailwind keeps them in the build.
const TONES = {
    amber: { box: 'bg-amber-50 border-amber-200', iconBox: 'bg-amber-100', icon: 'text-amber-700', title: 'text-amber-900', text: 'text-amber-800' },
    blue: { box: 'bg-blue-50 border-blue-200', iconBox: 'bg-blue-100', icon: 'text-blue-700', title: 'text-blue-900', text: 'text-blue-800' },
    purple: { box: 'bg-purple-50 border-purple-200', iconBox: 'bg-purple-100', icon: 'text-purple-700', title: 'text-purple-900', text: 'text-purple-800' },
};

function PaymentOptionCard({ tone, icon: Icon, title, children, action }) {
    const t = TONES[tone];
    return (
        <div className={`${t.box} border rounded-lg p-4 sm:p-6 flex flex-col`}>
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg ${t.iconBox} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${t.icon}`} />
                </div>
                <h3 className={`text-base sm:text-lg font-semibold ${t.title}`}>{title}</h3>
            </div>
            <p className={`text-xs sm:text-sm ${t.text} mb-6 flex-1`}>{children}</p>
            {action}
        </div>
    );
}

export default function UrbanPay() {
    const { user, loading } = useUrbanPayUser();
    const [sellerStats, setSellerStats] = useState(EMPTY_STATS);
    const [isRefreshingStats, setIsRefreshingStats] = useState(false);
    const [garageSales, setGarageSales] = useState([]);
    const [selectedGarageSaleId, setSelectedGarageSaleId] = useState('');
    const [isLoadingGarageSales, setIsLoadingGarageSales] = useState(false);
    const [salesList, setSalesList] = useState([]);
    const [isLoadingSales, setIsLoadingSales] = useState(false);
    const [showCashModal, setShowCashModal] = useState(false);
    const [showSalesListModal, setShowSalesListModal] = useState(false);

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
    const promoIndex = usePromoRotation(allPromotions.length);

    const refreshSellerStats = useCallback(async () => {
        if (!user?.id) return;
        setIsRefreshingStats(true);
        try {
            const statsDoc = await firebase.firestore.collection('sellerStats').doc(user.id).get();
            setSellerStats(statsDoc.exists ? statsDoc.data() : EMPTY_STATS);
        } catch (error) {
            console.error('Error fetching seller stats:', error.message, error.code);
            toast.error(`Failed to load seller stats: ${error.message}`);
        } finally {
            setIsRefreshingStats(false);
        }
    }, [user]);

    const loadGarageSales = useCallback(async () => {
        if (!user?.id) return;
        setIsLoadingGarageSales(true);
        try {
            const sales = await firebase.firestore.collection('garageSales').queryDocs('user_id', '==', user.id);
            setGarageSales(sales);
            // Auto-select the first garage sale
            setSelectedGarageSaleId((current) => current || sales[0]?.id || '');
        } catch (error) {
            console.error('Error loading garage sales:', error);
        } finally {
            setIsLoadingGarageSales(false);
        }
    }, [user]);

    async function loadSalesList() {
        if (!user?.id) {
            toast.error('User not authenticated');
            return;
        }
        setIsLoadingSales(true);
        try {
            // Firestore rules only allow reading your own sales.
            const userSales = await firebase.firestore.collection('sales').queryDocs('sellerId', '==', user.id);
            setSalesList(sortSalesNewestFirst(userSales));
            setShowSalesListModal(true);
        } catch (error) {
            console.error('Error loading sales list:', error);
            toast.error('Failed to load sales list: ' + error.message);
        } finally {
            setIsLoadingSales(false);
        }
    }

    useEffect(() => {
        refreshSellerStats();
        loadGarageSales();
    }, [refreshSellerStats, loadGarageSales]);

    const cardPaymentsEnabled = user?.cardPaymentsEnabled === true && !!user?.stripeConnectId;

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
                alt=""
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
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={loadSalesList}
                                            disabled={isLoadingSales}
                                            className="h-8 px-2"
                                            title="View sales list"
                                            aria-label="View sales list"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={refreshSellerStats}
                                            disabled={isRefreshingStats}
                                            className="h-8 w-8 p-0"
                                            aria-label="Refresh earnings"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isRefreshingStats ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                                        <p className="text-xs text-slate-600 font-semibold">Total Earnings</p>
                                        <p className="text-2xl font-bold text-[#1e3a5f] mt-1">{formatAud(sellerStats.totalEarnings)}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                                        <p className="text-xs text-slate-600 font-semibold">Total Sales</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">{typeof sellerStats.totalSales === 'number' ? sellerStats.totalSales : 0}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 sm:gap-6">
                                <PaymentOptionCard
                                    tone="amber"
                                    icon={DollarSign}
                                    title="Cash Sale"
                                    action={(
                                        <Button onClick={() => setShowCashModal(true)} className="w-full bg-green-600 hover:bg-green-700 text-sm sm:text-base">
                                            Add Cash Sale
                                        </Button>
                                    )}
                                >
                                    Record cash payments from your customers right away.
                                </PaymentOptionCard>

                                {cardPaymentsEnabled ? (
                                    <PaymentOptionCard
                                        tone="blue"
                                        icon={CreditCard}
                                        title="Tap to Pay"
                                        action={(
                                            <Button onClick={() => toast.info(CARD_PAYMENT_NOTICE)} className="w-full bg-blue-600 hover:bg-blue-700 text-sm sm:text-base">
                                                Add Card Payment
                                            </Button>
                                        )}
                                    >
                                        Process card payments using your phone with Tap to Pay.
                                    </PaymentOptionCard>
                                ) : (
                                    <PaymentOptionCard
                                        tone="purple"
                                        icon={CreditCard}
                                        title="Tap to Pay"
                                        action={(
                                            <Button disabled variant="outline" className="w-full opacity-50 cursor-not-allowed text-sm sm:text-base">
                                                Disabled
                                            </Button>
                                        )}
                                    >
                                        Enable card payments in your <Link to={createPageUrl('Profile')} className="underline font-semibold">Profile Settings</Link> to accept Tap to Pay.
                                    </PaymentOptionCard>
                                )}
                            </div>

                            <CashSaleDialog
                                open={showCashModal}
                                onOpenChange={setShowCashModal}
                                garageSales={garageSales}
                                garageSalesLoading={isLoadingGarageSales}
                                garageSaleId={selectedGarageSaleId}
                                onGarageSaleChange={setSelectedGarageSaleId}
                                onRecorded={refreshSellerStats}
                            />

                            <SalesHistoryDialog
                                open={showSalesListModal}
                                onOpenChange={setShowSalesListModal}
                                sales={salesList}
                                garageSales={garageSales}
                            />

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
