import React, { useState, useEffect, useMemo } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { MapPin, Mail, Phone, Pencil, Plus, Loader2, Tag, Clock, FileText, CreditCard } from 'lucide-react';
import TwoFactorSetupDialog from '@/components/TwoFactorSetupDialog';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { printListingPoster } from '../utils/printGarageSaleSign';
import { groupProfileListings } from './profile/profileListings';
import { useCardPayments } from './profile/useCardPayments';
import ProfileListingCard from './profile/ProfileListingCard';
import { EditProfileDialog, ChangePasswordDialog, PrintSignDialog, StripeSetupDialog } from './profile/ProfileDialogs';

const DONE_BUTTON = 'bg-green-100 border border-green-300 text-green-700 hover:bg-green-100 cursor-not-allowed opacity-75';
const ACTION_BUTTON = 'bg-[#1e3a5f] text-white hover:bg-[#152a45]';

function usePromoRotation(count) {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        if (count === 0) return;
        const interval = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
        return () => clearInterval(interval);
    }, [count]);
    return index;
}

function DetailItem({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-500" />
            </div>
            <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-medium text-[#1e3a5f]">{value}</p>
            </div>
        </div>
    );
}

function ListingGrid({ loading, listings, empty, onDelete, onPrint }) {
    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#1e3a5f]" />
            </div>
        );
    }
    if (listings.length === 0) {
        return <div className="text-center py-12 bg-white rounded-xl border">{empty}</div>;
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
                <ProfileListingCard key={listing.id} listing={listing} onDelete={onDelete} onPrint={onPrint} />
            ))}
        </div>
    );
}

export default function Profile() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('active');
    const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
    const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
    const [printingListing, setPrintingListing] = useState(null);
    const cardPayments = useCardPayments(user, setUser);

    useEffect(() => {
        const init = async () => {
            if (!(await firebase.auth.isAuthenticated())) {
                window.location.href = '/login';
                return;
            }
            setUser(await firebase.auth.me());
        };
        init();
    }, []);

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

    const { data: userListings = [], isLoading: listingsLoading } = useQuery({
        queryKey: ['userListings', user?.id],
        queryFn: () => firebase.entities.GarageSale.filter({ user_id: user.id }),
        enabled: !!user?.id,
    });
    const listings = useMemo(() => groupProfileListings(userListings), [userListings]);

    const deleteMutation = useMutation({
        mutationFn: (id) => firebase.entities.GarageSale.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userListings'] });
            toast.success('Listing deleted');
        },
        onError: (error) => toast.error('Failed to delete listing: ' + error.message),
    });

    // Called once the mobile is enrolled as a Firebase second factor.
    const handle2FAEnabled = async ({ signInAgain }) => {
        setTwoFADialogOpen(false);
        setUser((prev) => ({ ...prev, two_fa_enabled: true }));
        if (signInAgain) {
            // This session started before 2FA existed; a fresh sign-in (password + SMS) is needed.
            toast.success('2FA is on. Please sign in again with your password and SMS code.');
            await firebase.auth.logout();
            window.location.href = '/login';
            return;
        }
        toast.success('Two-factor authentication is on');
    };

    const handlePrint = (listing) => {
        printListingPoster(listing);
        setPrintingListing(null);
        toast.success('Opening print poster window...');
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
            </div>
        );
    }

    const cardEnabled = cardPayments.enabled;
    const closeStripeDialog = () => setStripeDialogOpen(false);

    return (
        <div className="min-h-screen bg-[#f5f1e8] overflow-hidden pb-24 md:pb-0">
            <PrintSignDialog listing={printingListing} onClose={() => setPrintingListing(null)} onPrint={handlePrint} />

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
                    zIndex: 5,
                    opacity: 0.35,
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
                <div className="max-w-7xl mx-auto pt-2 md:pt-4 relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
                            <Pencil className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-[#1e3a5f]">My Profile</h2>
                            <p className="text-slate-500">Manage your account information and listings</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-6 mb-8 shadow-sm">
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d4a6f] flex items-center justify-center text-white text-2xl font-semibold">
                                    {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-[#1e3a5f]">{user.full_name || 'User'}</h1>
                                    <p className="text-slate-500">{user.email}</p>
                                </div>
                            </div>

                            <div className="flex flex-row gap-2 w-full md:w-auto">
                                <EditProfileDialog
                                    user={user}
                                    onSaved={(data) => {
                                        setUser((prev) => ({ ...prev, ...data }));
                                        queryClient.invalidateQueries({ queryKey: ['admin'] });
                                    }}
                                />
                                <ChangePasswordDialog email={user.email} />

                                <Button
                                    onClick={cardEnabled ? undefined : () => setStripeDialogOpen(true)}
                                    disabled={cardPayments.creating || cardEnabled}
                                    size="sm"
                                    className={`gap-2 flex-1 font-medium ${cardEnabled ? DONE_BUTTON : ACTION_BUTTON}`}
                                    title={cardEnabled && user.stripeAccountType ? `Account type: ${user.stripeAccountType === 'created' ? 'Created' : 'Linked'}` : ''}
                                >
                                    {cardPayments.creating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <CreditCard className="w-4 h-4" />
                                            {cardEnabled ? <>Card Payments <span className="text-lg ml-0.5">✓</span></> : 'Enable Card Payments'}
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={user.two_fa_enabled ? undefined : () => setTwoFADialogOpen(true)}
                                    disabled={user.two_fa_enabled}
                                    size="sm"
                                    className={`gap-2 flex-1 font-medium ${user.two_fa_enabled ? DONE_BUTTON : ACTION_BUTTON}`}
                                >
                                    {user.two_fa_enabled ? <>2FA On <span className="text-lg ml-0.5">✓</span></> : 'Enable 2FA'}
                                </Button>
                                <TwoFactorSetupDialog
                                    open={twoFADialogOpen}
                                    onOpenChange={setTwoFADialogOpen}
                                    defaultPhone={user.phone || ''}
                                    onEnabled={handle2FAEnabled}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
                            {user.phone && <DetailItem icon={Phone} label="Phone" value={user.phone} />}
                            {user.address && <DetailItem icon={MapPin} label="Address" value={user.address} />}
                            <DetailItem icon={Mail} label="Email" value={user.email} />
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative bg-[#f5f1e8] -mt-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 pt-0 pb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-[#1e3a5f]">My Listings</h2>
                        <Link to={createPageUrl('CreateListing')}>
                            <Button className="bg-[#1e3a5f] hover:bg-[#152a45] gap-2">
                                <Plus className="w-4 h-4" />
                                New Listing
                            </Button>
                        </Link>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-white border mb-6">
                            <TabsTrigger value="active" className="gap-2">
                                Active
                                {listings.active.length > 0 && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700">{listings.active.length}</Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="drafts" className="gap-2">
                                Drafts
                                {listings.drafts.length > 0 && (
                                    <Badge variant="secondary" className="bg-slate-100">{listings.drafts.length}</Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="past">Past</TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="w-full">
                            <ListingGrid
                                loading={listingsLoading}
                                listings={listings.active}
                                onDelete={deleteMutation.mutate}
                                onPrint={setPrintingListing}
                                empty={(
                                    <>
                                        <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 mb-4">No active listings</p>
                                        <Link to={createPageUrl('CreateListing')}>
                                            <Button className="bg-[#1e3a5f] hover:bg-[#152a45]">Create Your First Listing</Button>
                                        </Link>
                                    </>
                                )}
                            />
                        </TabsContent>
                        <TabsContent value="drafts" className="w-full">
                            <ListingGrid
                                listings={listings.drafts}
                                onDelete={deleteMutation.mutate}
                                onPrint={setPrintingListing}
                                empty={(
                                    <>
                                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500">No draft listings</p>
                                    </>
                                )}
                            />
                        </TabsContent>
                        <TabsContent value="past" className="w-full">
                            <ListingGrid
                                listings={listings.past}
                                onDelete={deleteMutation.mutate}
                                onPrint={setPrintingListing}
                                empty={(
                                    <>
                                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500">No past listings</p>
                                    </>
                                )}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </section>

            <StripeSetupDialog
                open={stripeDialogOpen}
                onOpenChange={setStripeDialogOpen}
                creating={cardPayments.creating}
                linking={cardPayments.linking}
                onCreate={() => cardPayments.createAccount(closeStripeDialog)}
                onLink={() => cardPayments.linkExistingAccount(closeStripeDialog)}
            />
        </div>
    );
}
