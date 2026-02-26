import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
    MapPin, Clock, Calendar, Heart, Navigation, ChevronLeft,
    Share2, Tag, Loader2, ImageIcon
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from 'date-fns';
import SaleMap from '../components/map/SaleMap';

const saleTypeLabels = {
    garage_sale: 'Garage Sale',
    yard_sale: 'Yard Sale',
    estate_sale: 'Estate Sale',
    moving_sale: 'Moving Sale',
    multi_family: 'Multi-Family',
    clearing_sale: 'Clearing Sale',
    auction: 'Auction',
    street_sale: 'Street Sale',
};

export default function ListingDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const saleId = urlParams.get('id');
    const queryClient = useQueryClient();

    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [promoIndex, setPromoIndex] = useState(0);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [saleId]);

    useEffect(() => {
        const checkAuth = async () => {
            const authenticated = await firebase.auth.isAuthenticated();
            setIsAuthenticated(authenticated);
            if (authenticated) {
                const userData = await firebase.auth.me();
                setUser(userData);
            }
        };
        checkAuth();
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

    // Rotate promotional messages every 5 seconds
    useEffect(() => {
        if (allPromotions.length === 0) return;
        const interval = setInterval(() => {
            setPromoIndex((prevIndex) => (prevIndex + 1) % allPromotions.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [allPromotions.length]);

    const { data: sale, isLoading: saleLoading } = useQuery({
        queryKey: ['sale', saleId],
        queryFn: async () => {
            const sales = await firebase.entities.GarageSale.filter({ id: saleId });
            return sales[0];
        },
        enabled: !!saleId,
    });

    const { data: savedListings = [] } = useQuery({
        queryKey: ['savedListings', user?.email],
        queryFn: () => firebase.entities.SavedListing.filter({ user_email: user?.email }),
        enabled: !!user?.email,
    });

    const isSaved = savedListings.some(s => s.garage_sale_id === saleId);
    const [lastWasSaved, setLastWasSaved] = useState(false);

    const saveMutation = useMutation({
        mutationFn: async () => {
            // Check current state at mutation time, not from closure
            const currentSavedListings = await firebase.entities.SavedListing.filter({ user_email: user?.email });
            const currentIsSaved = currentSavedListings.some(s => s.garage_sale_id === saleId);
            
            console.log('Save mutation called. currentIsSaved:', currentIsSaved, 'saleId:', saleId);
            
            if (currentIsSaved) {
                const saved = currentSavedListings.find(s => s.garage_sale_id === saleId);
                console.log('Deleting saved listing:', saved);
                if (!saved) throw new Error('Saved listing not found');
                await firebase.entities.SavedListing.delete(saved.id);
                setLastWasSaved(true);
            } else {
                console.log('Creating saved listing for:', saleId);
                await firebase.entities.SavedListing.create({
                    garage_sale_id: saleId,
                    user_email: user.email,
                });
                setLastWasSaved(false);
            }
        },
        onSuccess: () => {
            console.log('Save mutation succeeded, invalidating query');
            // Invalidate both the current page's query and the SavedListings page query
            queryClient.invalidateQueries({ queryKey: ['savedListings', user?.email] });
            queryClient.invalidateQueries({ queryKey: ['savedListings'] });
            toast.success(lastWasSaved ? 'Removed from favourites' : 'Saved to favourites');
        },
        onError: (error) => {
            console.error('Save mutation failed:', error);
            toast.error('Failed to save: ' + error.message);
        },
    });

    const handleGetDirections = () => {
        if (sale?.latitude && sale?.longitude) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${sale.latitude},${sale.longitude}`;
            window.open(url, '_blank');
        } else if (sale?.address) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sale.address)}`;
            window.open(url, '_blank');
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: sale?.title,
                    text: `Check out this garage sale: ${sale?.title}`,
                    url: window.location.href,
                });
            } catch (err) {
                // User cancelled
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Link copied to clipboard');
        }
    };

    if (saleLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <Tag className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-2xl font-semibold text-[#1e3a5f] mb-2">Listing Not Found</h1>
                <p className="text-slate-500 mb-6">This listing may have been removed or expired.</p>
                <Link to={createPageUrl('Home')}>
                    <Button className="bg-[#1e3a5f] hover:bg-[#152a45]">
                        Back to Home
                    </Button>
                </Link>
            </div>
        );
    }

    if (!sale || !sale.start_date || !sale.end_date) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-700 mb-2">Listing not found</h2>
                    <p className="text-slate-500 mb-4">This listing is missing required information</p>
                    <Link to={createPageUrl('Home')}>
                        <Button>Back to Home</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const startDate = parseISO(sale.start_date);
    const endDate = parseISO(sale.end_date);
    const durationDays = differenceInDays(endDate, startDate) + 1;

    return (
        <div style={{ backgroundColor: '#f5f1e8' }} className="min-h-screen overflow-hidden pb-24 md:pb-8">
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
            
            {/* Back Button & Save */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-56 md:pt-16 relative z-10 py-4">
                <div className="flex items-center justify-between">
                    <Link to={createPageUrl('Home')}>
                        <Button variant="ghost" className="gap-2 text-slate-600 hover:text-[#1e3a5f]">
                            <ChevronLeft className="w-4 h-4" />
                            Back to listings
                        </Button>
                    </Link>
                    
                    {isAuthenticated && (
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                            variant={isSaved ? "default" : "outline"}
                            className={`gap-2 ${isSaved ? 'bg-[#1e3a5f] hover:bg-[#152a45]' : ''}`}
                        >
                            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                            {isSaved ? 'Saved to Favourites' : 'Save to Favourites'}
                        </Button>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Image Gallery */}
                    <div className="space-y-4">
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 shadow-lg">
                            {sale.photos && sale.photos.length > 0 ? (
                                <img
                                    src={sale.photos[selectedImageIndex]}
                                    alt={sale.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                                    <ImageIcon className="w-20 h-20 text-slate-300" />
                                </div>
                            )}
                        </div>
                        
                        {sale.photos && sale.photos.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {sale.photos.map((photo, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedImageIndex(index)}
                                        className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                                            selectedImageIndex === index
                                                ? 'border-[#102a43] shadow-lg'
                                                : 'border-transparent opacity-70 hover:opacity-100'
                                        }`}
                                    >
                                        <img
                                            src={photo}
                                            alt={`${sale.title} ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Details */}
                    <div className="space-y-6">
                        {/* Header */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                {sale.sale_type && (
                                    <Badge className="bg-[#1e3a5f] text-white">
                                        {saleTypeLabels[sale.sale_type]}
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-3xl font-bold text-[#1e3a5f] mb-2">
                                {sale.title}
                            </h1>
                        </div>

                        {/* Date & Time */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-[#1e3a5f] mb-4">When</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-[#1e3a5f]" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-[#1e40af]">
                                            {format(startDate, 'EEEE, MMMM d')}
                                            {durationDays > 1 && ` - ${format(endDate, 'EEEE, MMMM d')}`}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {durationDays} {durationDays === 1 ? 'day' : 'days'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-[#1e3a5f]" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-[#1e40af]">
                                            {sale.start_time} - {sale.end_time}
                                        </p>
                                        <p className="text-sm text-slate-500">Daily hours</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-[#1e3a5f] mb-4">Where</h3>
                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-5 h-5 text-[#1e3a5f]" />
                                </div>
                                <div>
                                    <p className="font-medium text-[#1e3a5f]">{sale.address}</p>
                                    {sale.suburb && (
                                        <p className="text-sm text-slate-600">{sale.suburb}</p>
                                    )}
                                    {sale.postcode && (
                                        <p className="text-sm text-slate-500">{sale.postcode}</p>
                                    )}
                                </div>
                            </div>
                            
                            {sale.latitude && sale.longitude && (
                                <div className="h-48 rounded-xl overflow-hidden">
                                    <SaleMap
                                        sales={[sale]}
                                        center={[sale.latitude, sale.longitude]}
                                        zoom={15}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        {sale.description && (
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                <h3 className="font-semibold text-[#1e3a5f] mb-3">About This Sale</h3>
                                <p className="text-slate-600 whitespace-pre-wrap">{sale.description}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 md:static md:mt-8 md:bg-transparent md:border-0 md:p-0 md:max-w-7xl md:mx-auto md:px-4 md:pb-8">
                <div className="flex gap-3 max-w-7xl mx-auto">
                    <Button
                        variant="outline"
                        onClick={handleShare}
                        className="flex-shrink-0"
                        aria-label="Share this listing"
                    >
                        <Share2 className="w-5 h-5" />
                    </Button>
                    
                    <Button
                        onClick={handleGetDirections}
                        className="flex-1 bg-[#1e3a5f] hover:bg-[#152a45] gap-2"
                    >
                        <Navigation className="w-5 h-5" />
                        Get Directions
                    </Button>
                </div>
            </div>
        </div>
    );
}