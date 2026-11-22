import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { formatAud } from '@/lib/format';
import { LISTING_STATUS } from '@/lib/listings';
import { CARD_FEES, describeCardFee } from '@/lib/pricing';
import { Smartphone, RefreshCw, CreditCard, Banknote, FileText, ChevronRight, Plus, ShieldCheck } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

// Full class names (not built from the accent) so Tailwind keeps them in the build.
const ACCENTS = {
    orange: 'bg-brand-orange/10 text-brand-orange-dark',
    teal: 'bg-brand-teal/10 text-brand-teal',
    muted: 'bg-slate-100 text-slate-400',
};

function PaymentOptionCard({ accent, icon: Icon, title, badge, children, action }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl ${ACCENTS[accent]} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5" />
                </div>
                {badge}
            </div>
            <h3 className="text-lg font-semibold text-navy">{title}</h3>
            <p className="text-sm text-slate-600 mt-1 mb-5 flex-1">{children}</p>
            {action}
        </div>
    );
}

function StatusBadge({ on, children }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${on ? 'bg-brand-teal/10 text-brand-teal' : 'bg-slate-100 text-slate-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-brand-teal' : 'bg-slate-400'}`} />
            {children}
        </span>
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
            // Only live listings, as in the mobile app: drafts and unpaid listings can't take sales.
            const sales = (await firebase.firestore.collection('garageSales').queryDocs('user_id', '==', user.id))
                .filter((sale) => sale.status === LISTING_STATUS.ACTIVE);
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
    const salesCount = typeof sellerStats.totalSales === 'number' ? sellerStats.totalSales : 0;

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-4 border-navy border-t-brand-orange rounded-full animate-spin" />
                <p className="text-slate-600">Loading...</p>
            </div>
        );
    }

    return (
        <div className="bg-brand-cream min-h-screen overflow-hidden pb-24 md:pb-0">
            {/* Watermark */}
            <style>{`
                @media (min-width: 768px) {
                    .watermark-page {
                        top: -90px !important;
                    }
                }
            `}</style>
            <img
                src="/logo-web.webp"
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
                <div className="bg-brand-orange-dark text-white py-3 px-4 text-center shadow-lg fixed top-20 left-0 right-0 z-30 w-full">
                    <p className="text-sm sm:text-base font-semibold">
                        {allPromotions[promoIndex]?.message}
                    </p>
                </div>
            )}

            <section className="relative bg-brand-cream py-16 px-4 sm:px-6 overflow-hidden">
                <div className="max-w-4xl mx-auto pt-2 md:pt-4 relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                            <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-navy">Urban Pay</h1>
                            <p className="text-slate-500">Take payments from buyers on the day of your sale</p>
                        </div>
                    </div>

                    <div className="space-y-6 relative z-20">
                            {/* Earnings */}
                            <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white shadow-sm p-5 sm:p-7">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-white/70">Total earnings</p>
                                        <p className="text-3xl sm:text-4xl font-bold mt-1 tracking-tight">{formatAud(sellerStats.totalEarnings)}</p>
                                        <p className="text-sm text-white/70 mt-1">
                                            from {salesCount} {salesCount === 1 ? 'sale' : 'sales'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={refreshSellerStats}
                                        disabled={isRefreshingStats}
                                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-60 flex-shrink-0"
                                        aria-label="Refresh earnings"
                                        title="Refresh earnings"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isRefreshingStats ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                                <div className="mt-5 pt-4 border-t border-white/15">
                                    <button
                                        type="button"
                                        onClick={loadSalesList}
                                        disabled={isLoadingSales}
                                        className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-brand-orange transition-colors disabled:opacity-60"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {isLoadingSales ? 'Loading sales…' : 'View sales history'}
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Ways to take payment */}
                            <div>
                                <h2 className="text-lg font-semibold text-navy mb-3">Take a payment</h2>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <PaymentOptionCard
                                        accent="orange"
                                        icon={Banknote}
                                        title="Cash sale"
                                        action={(
                                            <Button onClick={() => setShowCashModal(true)} className="w-full bg-brand-orange-dark hover:bg-brand-orange-darker text-white gap-2">
                                                <Plus className="w-4 h-4" />
                                                Add Cash Sale
                                            </Button>
                                        )}
                                    >
                                        Record a cash payment as soon as a buyer pays, so your earnings stay up to date.
                                    </PaymentOptionCard>

                                    {cardPaymentsEnabled ? (
                                        <PaymentOptionCard
                                            accent="teal"
                                            icon={CreditCard}
                                            title="Tap to Pay"
                                            badge={<StatusBadge on>Ready</StatusBadge>}
                                            action={(
                                                <Button variant="outline" onClick={() => toast.info(CARD_PAYMENT_NOTICE)} className="w-full border-navy/20 text-navy hover:bg-navy/5 gap-2">
                                                    <Smartphone className="w-4 h-4" />
                                                    How to take a card payment
                                                </Button>
                                            )}
                                        >
                                            Take contactless card payments on your phone in the Urban Pay app. A fee of {describeCardFee(CARD_FEES.tap_to_pay)} (incl. GST) per sale comes out of your payout.
                                        </PaymentOptionCard>
                                    ) : (
                                        <PaymentOptionCard
                                            accent="muted"
                                            icon={CreditCard}
                                            title="Tap to Pay"
                                            badge={<StatusBadge on={false}>Not set up</StatusBadge>}
                                            action={(
                                                <Link to={createPageUrl('Profile')} className="block">
                                                    <Button variant="outline" className="w-full border-navy/20 text-navy hover:bg-navy/5 gap-2">
                                                        Set up card payments
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                            )}
                                        >
                                            Turn on card payments in your profile to take contactless payments on your phone.
                                        </PaymentOptionCard>
                                    )}
                                </div>
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

                            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
                                <ShieldCheck className="w-5 h-5 text-brand-teal flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-600">
                                    Card payments are processed securely by Stripe and appear here once they go through. Cash sales you record count towards your earnings straight away.
                                </p>
                            </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
