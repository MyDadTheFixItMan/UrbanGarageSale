import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { usePromotions } from '@/lib/usePromotions';
import { createPageUrl } from '../utils';
import { formatAud } from '@/lib/format';
import { LISTING_STATUS } from '@/lib/listings';
import { LISTING_FEE_AUD } from '@/lib/pricing';
import { Loader2, Save, Send, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { geocode } from '@/lib/geocode';
import { profileProblem } from './login/loginForms';
import { BasicInfoSection, LocationSection, DateTimeSection } from './createListing/ListingSections';
import PhotosSection from './createListing/PhotosSection';
import {
    EMPTY_FORM, formFromListing, isPaidOrApproved, listingFormProblem, isInFreePeriod, buildSaleData, liveEditData,
} from './createListing/listingForm';

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

// Sends the seller to Stripe Checkout for the listing fee. Resolves to false if it couldn't.
async function startCheckout(saleId) {
    if (window.self !== window.top) {
        toast.error('Checkout only works from published apps. Please open this app in a new tab.');
        return false;
    }
    try {
        toast.success('Redirecting to payment...');
        const result = await firebase.functions.invoke('createStripeCheckout', { saleId });
        if (!result.url) throw new Error('No checkout URL returned');
        window.location.href = result.url;
        return true;
    } catch (error) {
        console.error('Payment error:', error);
        toast.error('Failed to start payment. Your listing is saved: press Pay on it in My Listings to try again.');
        return false;
    }
}

export default function CreateListing() {
    const editId = new URLSearchParams(window.location.search).get('edit');
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    // Set from the first click until a save fails, so a double click can't save the listing twice
    // (the button's disabled state only arrives with the next render). A save that works leaves the page.
    const saving = useRef(false);
    // Set once the listing is saved, so leaving the page no longer warns about unsaved changes.
    const saved = useRef(false);
    // An in-app move keeps the toasts that a full page load would wipe.
    const goToProfile = () => navigate(createPageUrl('Profile'));

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // On a paid or approved listing only the title, description, sale type and photos can change.
    // Changes to an approved one wait for an admin, and buyers keep seeing it as approved until
    // then (both enforced by firestore.rules). Null when creating or editing an unpaid listing.
    const [liveListing, setLiveListing] = useState(null);
    const isActiveEdit = Boolean(liveListing);
    const needsReapproval = liveListing?.status === LISTING_STATUS.ACTIVE;
    // Changes already sent for this listing, if any, and the form as it was opened.
    const [liveEdit, setLiveEdit] = useState(null);
    const [openedForm, setOpenedForm] = useState(EMPTY_FORM);
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
            // Accounts made with Google, Facebook or Apple start without an address or phone number.
            const missing = profileProblem(userData);
            if (missing) {
                toast.error(`Please complete your profile before creating a listing. ${missing}`);
                goToProfile();
                return;
            }

            setUser(userData);

            if (editId) {
                const [listing] = await firebase.entities.GarageSale.filter({ id: editId });
                if (listing && listing.user_id === userData.id) {
                    const edit = listing.status === LISTING_STATUS.ACTIVE ? await firebase.entities.ListingEdit.get(editId) : null;
                    const form = formFromListing({ ...listing, ...(edit ? liveEditData(edit) : {}) });
                    if (isPaidOrApproved(listing)) setLiveListing(listing);
                    setLiveEdit(edit);
                    setOpenedForm(form);
                    setFormData(form);
                }
            }
            setLoading(false);
        };
        init();
    }, [editId]);

    // Warns before a refresh, closing the tab or leaving the site would lose typed changes.
    const unsaved = !loading && JSON.stringify(formData) !== JSON.stringify(openedForm);
    useEffect(() => {
        if (!unsaved) return;
        const warn = (event) => {
            if (saved.current) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [unsaved]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handlePhotosChange = (update) => {
        setFormData(prev => ({ ...prev, ...update({ photos: prev.photos, thumbnails: prev.thumbnails }) }));
    };

    const createMutation = useMutation({
        mutationFn: async ({ asDraft, isFree }) => {
            if (isActiveEdit) {
                const changes = liveEditData(formData);
                if (JSON.stringify(changes) === JSON.stringify(liveEditData(openedForm))) {
                    return { liveEdit: 'unchanged' };
                }
                if (needsReapproval) {
                    await firebase.entities.ListingEdit.submit(editId, changes);
                    return { liveEdit: 'sent' };
                }
                await firebase.entities.GarageSale.update(editId, changes);
                return { liveEdit: 'saved' };
            }

            // Google Places validated the address when it was selected; suburb and postcode come from it.
            if (!formData.suburb || !formData.postcode) {
                throw new Error('Please select a valid Australian address with suburb and postcode.');
            }
            const coords = await coordinatesFor(formData);
            const saleData = buildSaleData(formData, { asDraft, isFree, coords });

            if (editId) {
                await firebase.entities.GarageSale.update(editId, saleData);
                return { id: editId, asDraft, isFree };
            }
            const result = await firebase.entities.GarageSale.create(saleData);
            return { id: result.id, asDraft, isFree };
        },
        onSuccess: async ({ id, asDraft, isFree, liveEdit: liveEditResult }) => {
            saved.current = true;
            queryClient.invalidateQueries({ queryKey: ['userListings'] });

            if (liveEditResult) {
                toast.success({
                    unchanged: 'No changes to save',
                    sent: 'Changes sent for approval. Your listing stays live as it is until then.',
                    saved: 'Listing updated',
                }[liveEditResult]);
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
                    toast.success("🎉 Free listing period! Your listing is pending approval. You'll receive an email once it's live.");
                    setTimeout(goToProfile, 1500);
                } catch (error) {
                    console.error('Error creating payment record:', error);
                    toast.error(`Error finalizing free listing: ${error.message}`);
                }
            } else {
                // Retrying here would save the listing a second time, so a failed start goes to the profile.
                if (!(await startCheckout(id))) goToProfile();
            }
        },
        onError: (error) => {
            console.error('Failed to save listing:', error);
            toast.error(`Failed to save listing: ${error.message}`);
        }
    });

    const freePeriod = !isActiveEdit && isInFreePeriod(appSettings, formData.start_date);

    const handleSubmit = (asDraft) => {
        if (saving.current) return;
        const problem = listingFormProblem(formData, { datesLocked: isActiveEdit, asDraft });
        if (problem) {
            toast.error(problem);
            return;
        }
        saving.current = true;
        createMutation.mutate({ asDraft, isFree: !asDraft && freePeriod }, {
            onError: () => { saving.current = false; },
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-navy" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-cream overflow-hidden pb-24 md:pb-8">
            {/* Watermark U Shape */}
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
                    opacity: 0.35,
                    zIndex: 5,
                    objectFit: 'contain',
                    clipPath: 'polygon(0 0, 46% 0, 46% 100%, 0 100%)',
                    top: '60px'
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
                {/* Header */}
                <div className="flex items-center gap-3 mb-1 sm:mb-8">
                    <div className="w-12 h-12 rounded-xl bg-navy flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-navy">{isActiveEdit ? 'Edit Listing' : 'Create Listing'}</h1>
                        <p className="text-slate-500">
                            {isActiveEdit ? 'You can change the title, description, sale type and photos' : 'Add a new garage sale to the platform'}
                        </p>
                    </div>
                </div>

                {needsReapproval && (
                    <Alert className="mb-6 border-brand-orange/30 bg-brand-orange/10">
                        <AlertDescription className="text-navy text-center">
                            Changes need admin approval. <strong>Buyers keep seeing your listing as it is now until they're approved.</strong>
                        </AlertDescription>
                    </Alert>
                )}

                {liveEdit?.status === 'pending' && (
                    <Alert className="mb-6 bg-blue-50 border-blue-200">
                        <AlertDescription className="text-blue-700 text-center">
                            These changes are waiting for approval. Sending new ones replaces them.
                        </AlertDescription>
                    </Alert>
                )}

                {liveEdit?.status === 'refused' && (
                    <Alert className="mb-6 bg-red-50 border-red-200">
                        <AlertDescription className="text-red-700 text-center">
                            <strong>These changes weren't approved:</strong>{' '}
                            <span className="whitespace-pre-line break-words">{liveEdit.refusal_reason}</span>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Pricing Info */}
                {!isActiveEdit && (
                    <Alert className="mb-6 border-brand-orange/30 bg-brand-orange/10">
                        <AlertDescription className="text-navy text-center">
                            Listings are <strong>{formatAud(LISTING_FEE_AUD, { withCode: true })}</strong> (incl. GST) to publish. Drafts are free. Anything not paid for is saved for 2 days, then deleted.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-8">
                    <BasicInfoSection form={formData} onChange={handleInputChange} />
                    <LocationSection form={formData} onChange={handleInputChange} locked={isActiveEdit} />
                    <DateTimeSection form={formData} onChange={handleInputChange} locked={isActiveEdit} />
                    <PhotosSection photos={formData.photos} onChange={handlePhotosChange} userId={user?.id} />

                    {freePeriod && (
                        <Alert className="bg-green-50 border-green-200">
                            <AlertDescription className="text-green-700 font-medium">
                                ✨ Free Listing Period Active! Your listing is FREE and will go live once it's approved.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {!isActiveEdit && (
                            <Button
                                variant="outline"
                                onClick={() => handleSubmit(true)}
                                disabled={createMutation.isPending}
                                className="flex-1 h-12 gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Save as Draft
                            </Button>
                        )}
                        <Button
                            onClick={() => handleSubmit(false)}
                            disabled={createMutation.isPending}
                            className={`flex-1 h-12 gap-2 ${freePeriod ? 'bg-green-600 hover:bg-green-700' : 'bg-navy hover:bg-navy-dark'}`}
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isActiveEdit ? (
                                <>
                                    <Save className="w-5 h-5" />
                                    {needsReapproval ? 'Send for Approval' : 'Save Changes'}
                                </>
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
