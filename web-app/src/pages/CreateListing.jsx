import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { usePromotions } from '@/lib/usePromotions';
import { createPageUrl } from '../utils';
import { formatAud } from '@/lib/format';
import { LISTING_FEE_AUD } from '@/lib/pricing';
import { Loader2, Save, Send, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { geocode } from '@/lib/geocode';
import { BasicInfoSection, LocationSection, DateTimeSection } from './createListing/ListingSections';
import PhotosSection from './createListing/PhotosSection';
import {
    EMPTY_FORM, formFromListing, isPaid, isPaidOrApproved, listingFormProblem, isInFreePeriod, buildSaleData,
} from './createListing/listingForm';

const goToProfile = () => { window.location.href = createPageUrl('Profile'); };

async function coordinatesFor(form) {
    if (form.latitude && form.longitude) return { lat: form.latitude, lng: form.longitude };
    try {
        const result = await geocode(form.address);
        if (result) return { lat: result.lat, lng: result.lng };
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    throw new Error('Failed to geocode address. Please check the address and try again.');
}

// Sends the seller to Stripe Checkout for the listing fee.
async function startCheckout(saleId) {
    if (window.self !== window.top) {
        toast.error('Checkout only works from published apps. Please open this app in a new tab.');
        return;
    }
    try {
        toast.success('Redirecting to payment...');
        const result = await firebase.functions.invoke('createStripeCheckout', { saleId });
        if (!result.url) throw new Error('No checkout URL returned');
        window.location.href = result.url;
    } catch (error) {
        console.error('Payment error:', error);
        toast.error('Failed to start payment. Please try again.');
    }
}

export default function CreateListing() {
    const editId = new URLSearchParams(window.location.search).get('edit');
    const queryClient = useQueryClient();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Paid or approved listings keep their dates and location (enforced by firestore.rules).
    const [isActiveEdit, setIsActiveEdit] = useState(false);
    // Payment status of the listing being edited; paid listings keep their status on save.
    const [editPaymentStatus, setEditPaymentStatus] = useState(null);
    const [promoIndex, setPromoIndex] = useState(0);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const allPromotions = usePromotions();

    // The free listing period. Firestore rules make the final decision on whether a listing is free.
    const { data: appSettings = {} } = useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            try {
                return (await firebase.entities.AppSettings.get()) || { is_active: false };
            } catch (error) {
                console.warn('Could not load app settings:', error.message);
                return { is_active: false };
            }
        },
        staleTime: 1000 * 60 * 5,
        retry: 1,
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
            const authenticated = await firebase.auth.isAuthenticated();
            if (!authenticated) {
                window.location.href = '/login';
                return;
            }
            const userData = await firebase.auth.me();

            // Enforce 2FA - redirect if not enabled
            const is2FAEnabled = await firebase.auth.is2FAEnabled();
            if (!is2FAEnabled) {
                toast.error('Two-Factor Authentication is required. Please enable 2FA on your Profile page.');
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

            setUser(userData);

            if (editId) {
                const [listing] = await firebase.entities.GarageSale.filter({ id: editId });
                if (listing && listing.user_id === userData.id) {
                    setIsActiveEdit(isPaidOrApproved(listing));
                    setEditPaymentStatus(listing.payment_status || null);
                    setFormData(formFromListing(listing));
                }
            }
            setLoading(false);
        };
        init();
    }, [editId]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handlePhotosChange = (update) => {
        setFormData(prev => ({ ...prev, ...update({ photos: prev.photos, thumbnails: prev.thumbnails }) }));
    };

    const createMutation = useMutation({
        mutationFn: async ({ asDraft, isFree }) => {
            // Google Places validated the address when it was selected; suburb and postcode come from it.
            if (!formData.suburb || !formData.postcode) {
                throw new Error('Please select a valid Australian address with suburb and postcode.');
            }
            const coords = await coordinatesFor(formData);
            const alreadyPaid = Boolean(editId) && isPaid(editPaymentStatus);
            const saleData = buildSaleData(formData, {
                asDraft, isFree, alreadyPaid, coords, locked: Boolean(editId) && isActiveEdit,
            });

            if (editId) {
                await firebase.entities.GarageSale.update(editId, saleData);
                return { id: editId, asDraft, isFree: isFree && !alreadyPaid, alreadyPaid };
            }
            const result = await firebase.entities.GarageSale.create(saleData);
            return { id: result.id, asDraft, isFree, alreadyPaid: false };
        },
        onSuccess: async ({ id, asDraft, isFree, alreadyPaid }) => {
            queryClient.invalidateQueries({ queryKey: ['userListings', user?.email] });

            if (alreadyPaid) {
                toast.success('Listing updated');
                goToProfile();
            } else if (asDraft) {
                toast.success('Draft saved successfully');
                goToProfile();
            } else if (isFree) {
                try {
                    // A $0 payment record for the free listing (allowed by firestore.rules)
                    await firebase.entities.Payment.create({
                        garage_sale_id: id,
                        user_id: user?.id,
                        amount: 0,
                        currency: 'AUD',
                        status: 'completed',
                        payment_method: 'free_period',
                        created_at: new Date(),
                    });
                    toast.success('🎉 Free listing period! Your listing is now live!');
                    setTimeout(goToProfile, 1500);
                } catch (error) {
                    console.error('Error creating payment record:', error);
                    toast.error(`Error finalizing free listing: ${error.message}`);
                }
            } else {
                await startCheckout(id);
            }
        },
        onError: (error) => {
            console.error('Failed to save listing:', error);
            toast.error(`Failed to save listing: ${error.message}`);
        }
    });

    const freePeriod = isInFreePeriod(appSettings, formData.start_date);

    const handleSubmit = (asDraft) => {
        const problem = listingFormProblem(formData);
        if (problem) {
            toast.error(problem);
            return;
        }
        createMutation.mutate({ asDraft, isFree: !asDraft && freePeriod });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f1e8] overflow-hidden pb-24 md:pb-8">
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
                    top: '60px'
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
                <div className="flex items-center gap-3 mb-1 sm:mb-8">
                    <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[#1e3a5f]">Create Listing</h1>
                        <p className="text-slate-500">Add a new garage sale to the platform</p>
                    </div>
                </div>

                {/* Pricing Info */}
                <Alert className="mb-6 border-[#FF9500]/30 bg-[#FF9500]/10">
                    <AlertDescription className="text-[#1e3a5f] text-center">
                        Listings are <strong>{formatAud(LISTING_FEE_AUD, { withCode: true })}</strong> to publish. Drafts are free and will be saved for 2 days.
                    </AlertDescription>
                </Alert>

                <div className="space-y-8">
                    <BasicInfoSection form={formData} onChange={handleInputChange} />
                    <LocationSection form={formData} onChange={handleInputChange} locked={isActiveEdit} />
                    <DateTimeSection form={formData} onChange={handleInputChange} locked={isActiveEdit} />
                    <PhotosSection photos={formData.photos} onChange={handlePhotosChange} userId={user?.id} />

                    {freePeriod && (
                        <Alert className="bg-green-50 border-green-200">
                            <AlertDescription className="text-green-700 font-medium">
                                ✨ Free Listing Period Active! Your listing will be published for FREE.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="outline"
                            onClick={() => handleSubmit(true)}
                            disabled={createMutation.isPending}
                            className="flex-1 h-12 gap-2"
                        >
                            <Save className="w-5 h-5" />
                            Save as Draft
                        </Button>
                        <Button
                            onClick={() => handleSubmit(false)}
                            disabled={createMutation.isPending}
                            className={`flex-1 h-12 gap-2 ${freePeriod ? 'bg-green-600 hover:bg-green-700' : 'bg-[#1e3a5f] hover:bg-[#152a45]'}`}
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    {freePeriod ? 'Publish FREE' : 'Publish my Sale'}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
            </section>
        </div>
    );
}
