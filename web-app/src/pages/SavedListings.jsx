import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
    Heart, Loader2, MapPin, Clock, Navigation, Tag, Route
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SavedListings() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
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
            const authenticated = await firebase.auth.isAuthenticated();
            if (!authenticated) {
                window.location.href = '/login';
                return;
            }
            const userData = await firebase.auth.me();
            setUser(userData);
            setLoading(false);
        };
        init();
    }, []);

    const { data: savedListings = [], isLoading: savedLoading } = useQuery({
        queryKey: ['savedListings', user?.email],
        queryFn: async () => {
            const results = await firebase.entities.SavedListing.filter({ user_email: user?.email });
            console.log('SavedListings.jsx: Fetched saved listings:', results);
            results.forEach(sl => {
                console.log('SavedListings.jsx: Saved listing details -', sl);
            });
            return results;
        },
        enabled: !!user?.email,
    });

    const { data: allSales = [] } = useQuery({
        queryKey: ['allSales'],
        queryFn: async () => {
            const results = await firebase.entities.GarageSale.filter({});
            console.log('SavedListings.jsx: Fetched all sales:', results);
            return results;
        },
        enabled: !!user?.email,
    });

    const savedSales = savedListings
        .map(saved => {
            console.log('SavedListings.jsx: Looking for sale with id:', saved.garage_sale_id);
            const found = allSales.find(sale => sale.id === saved.garage_sale_id);
            console.log('SavedListings.jsx: Found sale:', found);
            return found;
        })
        .filter(Boolean)
        // Deduplicate by sale ID to avoid duplicate keys
        .reduce((unique, sale) => {
            if (!unique.find(s => s.id === sale.id)) {
                unique.push(sale);
            }
            return unique;
        }, []);
    
    console.log('SavedListings.jsx: Final savedSales:', savedSales);

    const removeMutation = useMutation({
        mutationFn: async (savedId) => {
            await firebase.entities.SavedListing.delete(savedId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['savedListings'] });
            toast.success('Removed from favourites');
        },
    });

    const handleGetDirections = (sale) => {
        if (sale?.latitude && sale?.longitude) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${sale.latitude},${sale.longitude}`;
            window.open(url, '_blank');
        } else if (sale?.address) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sale.address)}`;
            window.open(url, '_blank');
        }
    };

    const handleRouteAll = () => {
        const validSales = savedSales.filter(s => s.latitude && s.longitude);

        if (validSales.length === 0) return;

        let url = `https://www.google.com/maps/dir/?api=1`;

        if (validSales.length === 1) {
            url += `&destination=${validSales[0].latitude},${validSales[0].longitude}`;
        } else {
            const destination = validSales[validSales.length - 1];
            const waypoints = validSales.slice(0, -1).map(s => `${s.latitude},${s.longitude}`).join('|');

            url += `&destination=${destination.latitude},${destination.longitude}`;
            url += `&waypoints=${waypoints}`;
        }
        window.open(url, '_blank');
    };

    const getDateLabel = (sale) => {
        const startDate = parseISO(sale.start_date);
        if (isToday(startDate)) return 'Today';
        if (isTomorrow(startDate)) return 'Tomorrow';
        return format(startDate, 'EEE, MMM d');
    };

    if (loading || savedLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
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
                    top: '35px',
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
            <div className="max-w-4xl mx-auto pt-2 md:pt-4 relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                            <Heart className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#1e3a5f]">Favourite Listings</h1>
                            <p className="text-slate-500">
                                {savedSales.length} {savedSales.length === 1 ? 'sale' : 'sales'} saved
                            </p>
                        </div>
                    </div>

                    {savedSales.length > 1 && (
                        <Button
                            onClick={handleRouteAll}
                            className="bg-[#1e3a5f] hover:bg-[#152a45] gap-2"
                        >
                            <Route className="w-4 h-4" />
                            Route to All
                        </Button>
                    )}
                </div>
            </div>
            </section>

            <section className="relative bg-[#f5f1e8]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 py-8 -mt-20 sm:mt-0 md:-mt-8">

                {savedSales.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border relative z-20">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Heart className="w-10 h-10 text-slate-300" />
                        </div>
                        <h2 className="text-xl font-semibold text-[#1e3a5f] mb-2">
                            No Favourite Listings
                        </h2>
                        <p className="text-slate-500 mb-6 max-w-md mx-auto">
                            Save garage sales to your favourites to easily find them later and plan your route.
                        </p>
                        <Link to={createPageUrl('Home')}>
                            <Button className="bg-[#1e3a5f] hover:bg-[#152a45]">
                                Browse Sales
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4 relative z-20">
                        {savedSales.map((sale) => {
                            const savedRecord = savedListings.find(s => s.garage_sale_id === sale.id);
                            
                            return (
                                <div
                                    key={savedRecord?.id || sale.id}
                                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300"
                                >
                                    <div className="flex flex-col sm:flex-row">
                                        {/* Image */}
                                        <Link
                                            to={createPageUrl(`ListingDetails?id=${sale.id}`)}
                                            className="w-full sm:w-48 h-48 sm:h-auto flex-shrink-0 bg-slate-100"
                                        >
                                            {sale.photos && sale.photos.length > 0 ? (
                                                <img
                                                    src={sale.photos[0]}
                                                    alt={sale.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Tag className="w-12 h-12 text-slate-300" />
                                                </div>
                                            )}
                                        </Link>

                                        {/* Content */}
                                        <div className="flex-1 p-6">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <Badge className="bg-[#1e3a5f]/10 text-[#1e3a5f] mb-2">
                                                        {getDateLabel(sale)}
                                                    </Badge>
                                                    <Link to={createPageUrl(`ListingDetails?id=${sale.id}`)}>
                                                        <h3 className="text-lg font-semibold text-[#1e3a5f] hover:text-[#2d4a6f] transition-colors">
                                                            {sale.title}
                                                        </h3>
                                                    </Link>
                                                </div>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-400 hover:text-red-500 hover:bg-red-50"
                                                        >
                                                            <Heart className="w-5 h-5 fill-current" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Remove from Favourites?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                               This will remove the listing from your favourites.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => removeMutation.mutate(savedRecord.id)}
                                                                className="bg-red-500 hover:bg-red-600"
                                                            >
                                                                Remove
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>

                                            <div className="space-y-2 text-sm text-slate-500 mb-4">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-slate-400" />
                                                    <span>{sale.address}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-slate-400" />
                                                    <span>{sale.start_time} - {sale.end_time}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <Link to={createPageUrl(`ListingDetails?id=${sale.id}`)}>
                                                    <Button variant="outline" size="sm">
                                                        View Details
                                                    </Button>
                                                </Link>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleGetDirections(sale)}
                                                    className="bg-[#1e3a5f] hover:bg-[#152a45] gap-2"
                                                >
                                                    <Route className="w-4 h-4" />
                                                    Route
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            </section>
        </div>
    );
}