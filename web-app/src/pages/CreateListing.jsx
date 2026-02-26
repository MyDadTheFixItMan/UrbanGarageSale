import React, { useState, useEffect, useRef } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { compressImage } from '@/lib/imageOptimization';
import {
    MapPin, Calendar, Image, Upload, X, Loader2,
    ChevronLeft, Save, Send, DollarSign, Info, Plus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addDays, format } from 'date-fns';
import { Alert, AlertDescription } from "@/components/ui/alert";
import GooglePlacesAutocomplete from '../components/GooglePlacesAutocomplete';

export default function CreateListing() {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [isActiveEdit, setIsActiveEdit] = useState(false);
    const [promoIndex, setPromoIndex] = useState(0);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        address: '',
        suburb: '',
        postcode: '',
        state: '',
        latitude: null,
        longitude: null,
        start_date: '',
        end_date: '',
        start_time: '08:00',
        end_time: '15:00',
        sale_type: 'garage_sale',
        photos: [],
    });

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

    const { data: appSettings = {} } = useQuery({
        queryKey: ['appSettings'],
        queryFn: async () => {
            try {
                // Try Firestore first
                const settings = await firebase.entities.AppSettings.get();
                if (settings && Object.keys(settings).length > 0) {
                    console.log('✓ Got app settings from Firestore:', settings);
                    return settings;
                }
            } catch (error) {
                console.warn('⚠️ Could not get settings from Firestore:', error.message);
            }
            
            // Fallback to localStorage
            try {
                const cached = localStorage.getItem('freeListingPeriod');
                if (cached) {
                    const settings = JSON.parse(cached);
                    console.log('✓ Got free listing period from localStorage:', settings);
                    return settings;
                }
            } catch (error) {
                console.warn('⚠️ Could not get settings from localStorage:', error.message);
            }
            
            return {};
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
        // Google Maps is already loaded in index.html
        // Just verify it's available, if not wait for it
        if (!window.google?.maps?.Geocoder) {
            const checkForGoogle = setInterval(() => {
                if (window.google?.maps?.Geocoder) {
                    clearInterval(checkForGoogle);
                }
            }, 100);
            setTimeout(() => clearInterval(checkForGoogle), 10000);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const authenticated = await firebase.auth.isAuthenticated();
            if (!authenticated) {
                window.location.href = '/login';
                return;
            }
            const userData = await firebase.auth.me();
            setUser(userData);

            if (editId) {
                const sales = await firebase.entities.GarageSale.filter({ id: editId });
                if (sales[0] && sales[0].created_by === userData.email) {
                    setIsActiveEdit(sales[0].status === 'active');
                    setFormData({
                        title: sales[0].title || '',
                        description: sales[0].description || '',
                        address: sales[0].address || '',
                        suburb: sales[0].suburb || '',
                        postcode: sales[0].postcode || '',
                        state: sales[0].state || '',
                        latitude: sales[0].latitude,
                        longitude: sales[0].longitude,
                        start_date: sales[0].start_date || '',
                        end_date: sales[0].end_date || '',
                        start_time: sales[0].start_time || '08:00',
                        end_time: sales[0].end_time || '15:00',
                        sale_type: sales[0].sale_type || 'garage_sale',
                        photos: sales[0].photos || [],
                    });
                }
            }
            setLoading(false);
        };
        init();
    }, [editId]);

    const handleInputChange = (field, value) => {
        console.log(`handleInputChange called: ${field} = ${value}`);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const validateImageDimensions = (file) => {
        return new Promise((resolve) => {
            const img = new window.Image();
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                const MAX_WIDTH = 2560;
                const MAX_HEIGHT = 1920;
                if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
                    resolve({ valid: false, width: img.width, height: img.height });
                } else {
                    resolve({ valid: true });
                }
            };
            img.onerror = () => resolve({ valid: true }); // Allow if can't read
            img.src = URL.createObjectURL(file);
        });
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        
        // Reset input immediately to allow re-selecting same file
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        
        if (!files.length) return;
        
        if (formData.photos.length + files.length > 5) {
            toast.error('Maximum 5 photos allowed');
            return;
        }

        setUploadingImages(true);

        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        
        let authUser = null;
        try {
            authUser = await firebase.auth.me();
        } catch (error) {
            toast.error('Not authenticated');
            setUploadingImages(false);
            return;
        }

        try {
            // Upload all files to Cloud Storage and collect their download URLs
            const uploadPromises = files.map(async (file) => {
                try {
                    // Type validation
                    if (!ALLOWED_TYPES.includes(file.type)) {
                        toast.error(`"${file.name}" - Only JPEG, PNG, or WEBP images allowed`);
                        return null;
                    }
                    
                    // Size validation
                    if (file.size > MAX_FILE_SIZE) {
                        toast.error(`"${file.name}" exceeds 5MB limit`);
                        return null;
                    }
                    
                    // Dimension validation
                    const dimCheck = await validateImageDimensions(file);
                    if (!dimCheck.valid) {
                        toast.error(`"${file.name}" exceeds max resolution (2560×1920). Current: ${dimCheck.width}×${dimCheck.height}`);
                        return null;
                    }
                    
                    // Optional: Compress image to reduce bandwidth (falls back to original if compression fails)
                    let fileToUpload = file;
                    try {
                        const originalSize = file.size;
                        const compressedFile = await compressImage(file);
                        const savings = ((originalSize - compressedFile.size) / originalSize * 100).toFixed(0);
                        if (compressedFile.size < originalSize) {
                            fileToUpload = compressedFile;
                            console.log(`📦 Image compressed: ${file.name} (saved ${savings}%)`);
                        }
                    } catch (compressionError) {
                        console.warn(`⚠️ Image compression skipped for ${file.name}, uploading original`);
                        // Continue with original file if compression fails
                    }
                    
                    // Upload to Cloud Storage
                    const timestamp = Date.now();
                    const randomStr = Math.random().toString(36).substring(2, 8);
                    const storagePath = `listings/${authUser.id}/${timestamp}-${randomStr}-${file.name}`;
                    
                    const downloadUrl = await firebase.storage.uploadImage(fileToUpload, storagePath);
                    toast.success(`"${file.name}" uploaded successfully`);
                    return downloadUrl;
                } catch (error) {
                    console.error('Upload error for', file.name, error);
                    toast.error(`"${file.name}" upload failed: ${error.message}`);
                    return null;
                }
            });

            // Wait for all files to be uploaded
            const uploadedUrls = await Promise.all(uploadPromises);
            const validUrls = uploadedUrls.filter(url => url !== null);

            setFormData(prev => ({
                ...prev,
                photos: [...prev.photos, ...validUrls],
            }));
        } finally {
            // Always reset uploading state, even if there's an error
            setUploadingImages(false);
        }
    };

    const removeImage = (index) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index),
        }));
    };

    const geocodeAddress = async (address) => {
        try {
            // Use REST API instead of legacy Geocoder library
            // This uses the newer Geocoding API endpoint
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=AIzaSyCmAD0m-2Z_-WomxpDvREimaPSp2CtjmEY&region=au`
            );
            
            if (!response.ok) {
                throw new Error(`Geocoding API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return { 
                    lat: location.lat, 
                    lng: location.lng 
                };
            }
            throw new Error('No coordinates returned');
        } catch (error) {
            console.error('Geocoding error:', error);
            throw new Error('Failed to geocode address. Please check the address and try again.');
        }
    };

    const validateSuburbPostcode = async () => {
        // Google Places API has already validated the address when it was selected
        // Just verify that suburb and postcode were successfully parsed
        if (!formData.suburb || !formData.postcode) {
            toast.error('Please select a valid Australian address with suburb and postcode.');
            return false;
        }
        return true;
    };

    const createMutation = useMutation({
        mutationFn: async ({ asDraft, isFree = false }) => {
            console.log('📝 mutationFn called with asDraft:', asDraft, 'isFree:', isFree);
            try {
                const isValid = await validateSuburbPostcode();
                if (!isValid) {
                    throw new Error('Invalid suburb/postcode combination');
                }
                console.log('✅ Suburb/postcode validation passed');

                let lat = formData.latitude;
                let lng = formData.longitude;

                if (!lat || !lng) {
                    console.log('📍 No coordinates, geocoding address...');
                    const coords = await geocodeAddress(formData.address);
                    lat = coords.lat;
                    lng = coords.lng;
                    console.log('✅ Geocoding complete:', { lat, lng });
                }

                const draftExpiry = asDraft
                    ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
                    : null;

                // If it's free period, create with active status directly
                let initialStatus = 'draft';
                if (asDraft) {
                    initialStatus = 'draft';
                } else if (isFree) {
                    console.log('🎉 Setting status to active (free period)');
                    initialStatus = 'active';
                } else {
                    initialStatus = 'pending_approval';
                }

                const saleData = {
                    ...formData,
                    latitude: lat,
                    longitude: lng,
                    status: initialStatus,
                    payment_status: isFree ? 'completed' : (asDraft ? 'pending' : 'pending'),
                    draft_expires_at: draftExpiry,
                    created_by: user?.email,
                };

                console.log('💾 Saving with saleData:', saleData);

                if (editId) {
                    console.log('📝 Updating existing listing:', editId);
                    await firebase.entities.GarageSale.update(editId, saleData);
                    console.log('✅ Listing updated');
                    return { id: editId, asDraft, isFree };
                } else {
                    console.log('✨ Creating new listing');
                    const result = await firebase.entities.GarageSale.create(saleData);
                    console.log('✅ Listing created with ID:', result.id);
                    return { id: result.id, asDraft, isFree };
                }
            } catch (error) {
                console.error('🔴 Error in mutationFn:', error);
                throw error;
            }
        },
        onSuccess: async ({ id, asDraft, isFree }) => {
            console.log('✨ onSuccess called with:', { id, asDraft, isFree });
            
            // Invalidate with the correct queryKey that includes user.email
            queryClient.invalidateQueries({ queryKey: ['userListings', user?.email] });
            
            if (asDraft) {
                console.log('📋 Draft mode - saving as draft');
                toast.success('Draft saved successfully');
                window.location.href = createPageUrl('Profile');
            } else if (isFree) {
                console.log('🎉 FREE LISTING MODE - Creating payment record and redirecting...');
                try {
                    // Create a $0 payment record for the free listing
                    console.log('💾 Creating $0 payment record for listing:', id);
                    await firebase.entities.Payment.create({
                        sale_id: id,
                        user_id: user?.uid,
                        amount: 0,
                        currency: 'usd',
                        status: 'completed',
                        payment_method: 'free_period',
                        created_at: new Date(),
                    });
                    console.log('✅ Payment record created successfully');
                    
                    toast.success('🎉 Free listing period! Your listing is now live!');
                    
                    // Redirect to profile after a short delay
                    setTimeout(() => {
                        console.log('🔄 Redirecting to Profile page');
                        window.location.href = createPageUrl('Profile');
                    }, 1500);
                } catch (error) {
                    console.error('❌ Error creating payment record:', error);
                    toast.error(`Error finalizing free listing: ${error.message}`);
                }
            } else {
                console.log('💰 PAID LISTING MODE - Proceeding with Stripe checkout');
                try {
                    // Check if running in iframe
                    if (window.self !== window.top) {
                        console.log('⚠️ Running in iframe');
                        toast.error('Checkout only works from published apps. Please open this app in a new tab.');
                        return;
                    }

                    toast.success('Redirecting to payment...');
                    console.log('🔗 Invoking createStripeCheckout function');
                    const result = await firebase.functions.invoke('createStripeCheckout', {
                        saleId: id,
                        saleTitle: formData.title,
                    });
                    console.log('✅ Stripe checkout URL received:', result);

                    if (result.url) {
                        console.log('🔄 Redirecting to Stripe checkout');
                        window.location.href = result.url;
                    } else {
                        throw new Error('No checkout URL returned');
                    }
                } catch (error) {
                    console.error('🔴 Payment error:', error);
                    toast.error('Failed to start payment. Please try again.');
                }
            }
        },
        onError: (error) => {
            console.error('🔴 MUTATION ERROR:', error);
            console.error('Error stack:', error.stack);
            console.error('Error message:', error.message);
            toast.error(`Failed to save listing: ${error.message}`);
        }
    });

    const isInFreePeriod = () => {
        console.log('🔍 Checking if listing qualifies for free period...');
        console.log('appSettings:', appSettings);
        
        if (!appSettings.is_active) {
            console.log('❌ Free period NOT active (is_active = false)');
            return false;
        }
        
        if (!formData.start_date) {
            console.log('❌ No listing start date - cannot check free period');
            return false;
        }
        
        let startDate = appSettings.free_listing_start;
        let endDate = appSettings.free_listing_end;
        
        // Convert Firestore Timestamps to Date objects if needed
        if (startDate && typeof startDate.toDate === 'function') {
            startDate = startDate.toDate().toISOString().split('T')[0];
        } else if (startDate && typeof startDate !== 'string') {
            startDate = new Date(startDate).toISOString().split('T')[0];
        }
        
        if (endDate && typeof endDate.toDate === 'function') {
            endDate = endDate.toDate().toISOString().split('T')[0];
        } else if (endDate && typeof endDate !== 'string') {
            endDate = new Date(endDate).toISOString().split('T')[0];
        }
        
        console.log('📌 Free period start:', startDate);
        console.log('📌 Free period end:', endDate);
        console.log('📌 Listing start date:', formData.start_date);
        
        const listingIsInPeriod = formData.start_date >= startDate && formData.start_date <= endDate;
        console.log(listingIsInPeriod ? '✅ Listing event qualifies for free period!' : '❌ Listing event is outside free period');
        
        return listingIsInPeriod;
    };

    // Direct check from localStorage - more reliable
    // Checks if the LISTING's dates fall within the free period
    const checkFreePeriodDirect = () => {
        try {
            const stored = localStorage.getItem('freeListingPeriod');
            if (!stored) {
                console.log('📭 No freeListingPeriod in localStorage');
                return false;
            }
            
            const settings = JSON.parse(stored);
            console.log('📦 Found localStorage settings:', settings);
            
            if (!settings.is_active) {
                console.log('❌ localStorage: is_active = false');
                return false;
            }
            
            // Check if the LISTING's start_date falls within the free period
            const listingStart = formData.start_date;
            if (!listingStart) {
                console.log('❌ No listing start date provided');
                return false;
            }
            
            console.log(`📅 Listing event date: ${listingStart}`);
            console.log(`📅 Free period: ${settings.free_listing_start} to ${settings.free_listing_end}`);
            
            // Check if listing's start date is within the free period
            const listingIsInPeriod = listingStart >= settings.free_listing_start && listingStart <= settings.free_listing_end;
            console.log(listingIsInPeriod ? '✅ Listing event is within free period!' : '❌ Listing event is outside free period');
            
            return listingIsInPeriod;
        } catch (error) {
            console.error('⚠️ Error checking localStorage:', error);
            return false;
        }
    };

    const validateForm = () => {
        console.log('Validating form with data:', formData);
        if (!formData.title.trim()) {
            toast.error('Please enter a title');
            console.log('Validation failed: title is empty');
            return false;
        }
        if (!formData.address.trim()) {
            toast.error('Please enter an address');
            console.log('Validation failed: address is empty');
            return false;
        }
        if (!formData.start_date) {
            toast.error('Please select a start date');
            console.log('Validation failed: start_date is empty', formData.start_date);
            return false;
        }
        if (!formData.end_date) {
            toast.error('Please select an end date');
            console.log('Validation failed: end_date is empty', formData.end_date);
            return false;
        }

        const startDate = new Date(formData.start_date);
        const endDate = new Date(formData.end_date);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

        if (daysDiff > 3) {
            toast.error('Sales can only run for a maximum of 3 consecutive days');
            console.log('Validation failed: daysDiff > 3', daysDiff);
            return false;
        }
        if (endDate < startDate) {
            toast.error('End date must be after start date');
            console.log('Validation failed: endDate < startDate');
            return false;
        }

        console.log('All validation checks passed');
        return true;
    };

    const handleSubmit = (asDraft) => {
        console.log('📍 handleSubmit called with asDraft:', asDraft);
        console.log('📋 formData.start_date:', formData.start_date);
        console.log('⚙️ appSettings:', appSettings);
        console.log('📦 localStorage:', localStorage.getItem('freeListingPeriod'));
        
        // Check if this will be a free listing
        const isFree = !asDraft && ((isInFreePeriod() || checkFreePeriodDirect()));
        console.log('💰 Is this a free listing?', isFree);
        
        const isValid = validateForm();
        console.log('✅ Form validation result:', isValid);
        if (!isValid) {
            console.log('❌ Form validation failed, returning');
            return;
        }
        console.log('🚀 Creating mutation with asDraft:', asDraft, 'isFree:', isFree);
        createMutation.mutate({ asDraft, isFree });
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

            <section className="relative bg-[#f5f1e8] py-0 sm:py-8 md:py-16 px-4 sm:px-6 overflow-hidden -mt-2 pt-24 sm:pt-0">
            <div className="max-w-3xl mx-auto pt-0 sm:pt-2 md:pt-4 relative z-20">
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
                        Listings are <strong>$10</strong> to publish. Drafts are free and will be saved for 2 days.
                    </AlertDescription>
                </Alert>

                </div>
            </section>

            <section className="relative bg-[#f5f1e8]">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-20 py-8 md:-mt-12">

                <div className="space-y-8">
                    {/* Basic Info */}
                    <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-[#1e3a5f] mb-6">Basic Information</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="title">Title *</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g., Moving Sale - Everything Must Go!"
                                    value={formData.title}
                                    onChange={(e) => handleInputChange('title', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Tell buyers what items you'll be selling..."
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    className="mt-1.5 min-h-[120px]"
                                />
                            </div>

                            <div>
                                <Label htmlFor="sale_type">Sale Type</Label>
                                <Select
                                    value={formData.sale_type}
                                    onValueChange={(value) => handleInputChange('sale_type', value)}
                                >
                                    <SelectTrigger className="mt-1.5" aria-label="Select sale type">
                                        <SelectValue placeholder="Choose a sale type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="garage_sale">Garage Sale</SelectItem>
                                        <SelectItem value="yard_sale">Yard Sale</SelectItem>
                                        <SelectItem value="estate_sale">Estate Sale</SelectItem>
                                        <SelectItem value="moving_sale">Moving Sale</SelectItem>
                                        <SelectItem value="multi_family">Multi-Family Sale</SelectItem>
                                        <SelectItem value="clearing_sale">Clearing Sale</SelectItem>
                                        <SelectItem value="auction">Auction</SelectItem>
                                        <SelectItem value="street_sale">Street Sale</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </section>

                    {/* Location */}
                    <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-[#1e3a5f] mb-6 flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            Location
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="address">Street Address *</Label>
                                <GooglePlacesAutocomplete
                                    id="address"
                                    value={formData.address || ''}
                                    onChange={(val) => handleInputChange('address', val)}
                                    onSelect={(place) => {
                                        if (place.address) {
                                            handleInputChange('address', place.address);
                                            handleInputChange('suburb', place.suburb);
                                            handleInputChange('postcode', place.postcode);
                                            handleInputChange('state', place.state);
                                            handleInputChange('latitude', place.latitude);
                                            handleInputChange('longitude', place.longitude);
                                        }
                                    }}
                                    placeholder="123 Main Street, Suburb NSW 2000"
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label htmlFor="suburb">Suburb & Postcode</Label>
                                <div className="grid grid-cols-2 gap-4 mt-1.5">
                                    <Input
                                        id="suburb"
                                        value={formData.suburb || ''}
                                        placeholder="Suburb (auto-filled)"
                                        readOnly
                                    />
                                    <Input
                                        id="postcode"
                                        value={formData.postcode || ''}
                                        placeholder="Postcode (auto-filled)"
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                <Label htmlFor="state">State</Label>
                                <select
                                    id="state"
                                    value={formData.state || ''}
                                    onChange={e => handleInputChange('state', e.target.value)}
                                    className="mt-1.5 border rounded px-3 py-2 w-full"
                                    disabled={!!formData.state}
                                >
                                    <option value="">Select State</option>
                                    <option value="NSW">New South Wales</option>
                                    <option value="VIC">Victoria</option>
                                    <option value="QLD">Queensland</option>
                                    <option value="SA">South Australia</option>
                                    <option value="WA">Western Australia</option>
                                    <option value="TAS">Tasmania</option>
                                    <option value="ACT">Australian Capital Territory</option>
                                    <option value="NT">Northern Territory</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Date & Time */}
                    <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-[#1e3a5f] mb-2 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Date & Time
                        </h2>
                        {isActiveEdit && (
                            <p className="text-xs text-slate-500 italic text-center mb-4">Cannot be changed once listing has been made active</p>
                        )}
                        <div className={!isActiveEdit ? "mt-4" : ""}></div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="start_date">Start Date *</Label>
                                    <Input
                                        id="start_date"
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => handleInputChange('start_date', e.target.value)}
                                        min={format(new Date(), 'yyyy-MM-dd')}
                                        className="mt-1.5"
                                        disabled={isActiveEdit}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="end_date">End Date *</Label>
                                    <Input
                                        id="end_date"
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => handleInputChange('end_date', e.target.value)}
                                        min={formData.start_date || format(new Date(), 'yyyy-MM-dd')}
                                        max={formData.start_date ? format(addDays(new Date(formData.start_date), 2), 'yyyy-MM-dd') : undefined}
                                        className="mt-1.5"
                                        disabled={isActiveEdit}
                                    />
                                </div>
                            </div>

                            <p className="text-sm text-slate-500 flex items-center gap-1">
                                <Info className="w-4 h-4" />
                                Maximum 3 consecutive days per listing
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="start_time">Daily Start Time</Label>
                                    <Input
                                        id="start_time"
                                        type="time"
                                        value={formData.start_time}
                                        onChange={(e) => handleInputChange('start_time', e.target.value)}
                                        className="mt-1.5"
                                        disabled={isActiveEdit}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="end_time">Daily End Time</Label>
                                    <Input
                                        id="end_time"
                                        type="time"
                                        value={formData.end_time}
                                        onChange={(e) => handleInputChange('end_time', e.target.value)}
                                        className="mt-1.5"
                                        disabled={isActiveEdit}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Photos */}
                    <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-semibold text-[#1e3a5f] mb-6 flex items-center gap-2">
                            <Image className="w-5 h-5" />
                            Photos
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {formData.photos.map((photo, index) => (
                                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                                        <img
                                            src={photo}
                                            alt={`Photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            onClick={() => removeImage(index)}
                                            className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                {formData.photos.length < 5 && (
                                    <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-[#1e3a5f] transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-[#1e3a5f]">
                                        {uploadingImages ? (
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : (
                                            <>
                                                <Upload className="w-6 h-6" />
                                                <span className="text-xs">Add Photo</span>
                                            </>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            multiple
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            <p className="text-sm text-slate-500">
                                Upload up to 5 images (JPEG, PNG, WEBP). Max 5MB and 2560×1920px each. First image will be the cover.
                            </p>
                        </div>
                    </section>

                    {/* Free Period Banner */}
                    {(isInFreePeriod() || checkFreePeriodDirect()) && (
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
                            className={`flex-1 h-12 gap-2 ${
                                (isInFreePeriod() || checkFreePeriodDirect())
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-[#1e3a5f] hover:bg-[#152a45]'
                            }`}
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    {(isInFreePeriod() || checkFreePeriodDirect()) ? 'Publish FREE' : 'Publish my Sale'}
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