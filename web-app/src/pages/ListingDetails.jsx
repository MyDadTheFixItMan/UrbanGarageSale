import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';
import { canBeSaved, canBeShared, hasFinished, SALE_TYPE_LABELS } from '@/lib/listings';
import { listingShareUrl, openShareSheet, shareSheetData, SHARE_CHANNELS } from '@/lib/share';
import ListingPlaceholder from '@/components/listings/ListingPlaceholder';
import ShareListingDialog from '@/components/listings/ShareListingDialog';
import { usePromotions } from '@/lib/usePromotions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
    MapPin, Clock, Calendar, Heart, Navigation, ChevronLeft,
    Share2, Tag, Loader2, Printer
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from 'date-fns';
import SaleMap from '../components/map/SaleMap';
import { printAfterDialogCloses, paperSizes } from '../utils/printGarageSaleSign';
import { AU_WEEKDAY_DATE, formatTimeAU } from '@/lib/format';
import { useToggleSaved } from '@/lib/useToggleSaved';
import { directionsUrl, saleLocation } from '@/lib/route';
import { ADMIN_TABS } from './admin/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// The home page searches near the visitor (it asks for their location) with ?near=me.
const NEARBY_SALES_URL = `${createPageUrl('Home')}?near=me`;

export default function ListingDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const saleId = urlParams.get('id');
    // Opened from the admin dashboard: go back to the tab it was opened from.
    const adminTab = ADMIN_TABS.includes(urlParams.get('adminTab')) ? urlParams.get('adminTab') : null;
    const backUrl = adminTab ? createPageUrl(`AdminDashboard?tab=${adminTab}`) : createPageUrl('Home');
    // The seller's "your sale is live" email links here with ?share=1, to open the share options.
    const shareRequested = urlParams.get('share') === '1';

    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [promoIndex, setPromoIndex] = useState(0);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [selectedPrintSize, setSelectedPrintSize] = useState('A4');
    const [shareOpen, setShareOpen] = useState(false);
    const [sharingFromEmail, setSharingFromEmail] = useState(false);

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

    const allPromotions = usePromotions();

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
            // null, not undefined: React Query treats undefined as a failure and tries again,
            // which kept people from an old link waiting before the "finished" page showed.
            return sales[0] ?? null;
        },
        enabled: !!saleId,
    });

    const { data: savedListings = [] } = useQuery({
        queryKey: ['savedListings', user?.email],
        queryFn: () => firebase.entities.SavedListing.mine(),
        enabled: !!user?.email,
    });

    const isSaved = savedListings.some(s => s.garage_sale_id === saleId);
    const saveMutation = useToggleSaved();

    // Opens the share options once the sale has loaded, then takes ?share=1 out of the address so
    // a reload, or a copy of the address, doesn't open them again.
    useEffect(() => {
        if (!shareRequested || !sale || !canBeShared(sale)) return;
        setSharingFromEmail(true);
        setShareOpen(true);
        const params = new URLSearchParams(window.location.search);
        params.delete('share');
        window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params}`);
    }, [shareRequested, sale]);

    // Same links as Route to All: Apple Maps on Apple devices, Google Maps elsewhere.
    const handleGetDirections = () => {
        const location = saleLocation(sale);
        if (location) window.open(directionsUrl(undefined, [location]), '_blank');
    };

    // Only the seller prints signs for their sale, and gets the flyer and post text for sharing it.
    const isOwner = Boolean(user?.id) && user.id === sale?.user_id;

    // Sellers get every way to share. Visitors go straight to their device's share sheet, or get
    // the share options where there isn't one.
    const handleShare = async () => {
        if (isOwner) {
            setShareOpen(true);
            return;
        }
        const url = listingShareUrl(window.location.origin, sale.id, SHARE_CHANNELS.SHARE_SHEET);
        if (await openShareSheet(shareSheetData(sale, url)) === 'unavailable') setShareOpen(true);
    };

    const handlePrintSignConfirm = () => {
        if (sale && isOwner) {
            setPrintDialogOpen(false);
            printAfterDialogCloses(sale, selectedPrintSize);
            setSelectedPrintSize('A4');
            toast.success('Opening print poster window...');
        }
    };

    if (saleLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-navy" />
            </div>
        );
    }

    // Usually an old shared link to a sale that has since finished (finished sales are no longer
    // public), so point people at the sales that are on instead.
    if (!sale) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
                <Tag className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-2xl font-semibold text-navy mb-2">This sale has finished</h1>
                <p className="text-slate-500 mb-6 max-w-sm">
                    It's over or has been taken down, but there are other sales on near you.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link to={NEARBY_SALES_URL}>
                        <Button className="w-full bg-navy hover:bg-navy-dark gap-2">
                            <MapPin className="w-4 h-4" />
                            Find sales near you
                        </Button>
                    </Link>
                    <Link to={createPageUrl('CreateListing')}>
                        <Button variant="outline" className="w-full">
                            List your own sale
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (!sale || !sale.start_date || !sale.end_date) {
        return (
            <div className="min-h-screen bg-brand-cream flex items-center justify-center">
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

    // Only sales buyers can see are worth sharing: not ones awaiting approval or finished.
    const shareable = canBeShared(sale);
    const finished = hasFinished(sale);

    // Shown under the title on wide screens, and pinned to the bottom of the screen otherwise.
    const actionButtons = (
        <div className="flex gap-3">
            {shareable && (
                <Button
                    variant="outline"
                    onClick={handleShare}
                    className="flex-shrink-0 bg-white"
                    aria-label="Share this listing"
                >
                    <Share2 className="w-5 h-5" />
                </Button>
            )}

            {isOwner && (
                <Button
                    variant="outline"
                    onClick={() => setPrintDialogOpen(true)}
                    className="flex-shrink-0 bg-white"
                    aria-label="Print garage sale sign"
                    title="Print this garage sale sign"
                >
                    <Printer className="w-5 h-5" />
                </Button>
            )}

            {/* Visitors only have the suburb (the public copy has no address), so directions
                need signing in. */}
            {isAuthenticated ? (
                <Button
                    onClick={handleGetDirections}
                    className="flex-1 bg-navy hover:bg-navy-dark gap-2"
                >
                    <Navigation className="w-5 h-5" />
                    Get Directions
                </Button>
            ) : (
                <Link to={createPageUrl('Login')} className="flex-1">
                    <Button className="w-full bg-navy hover:bg-navy-dark gap-2">
                        <Navigation className="w-5 h-5" />
                        Sign in for directions
                    </Button>
                </Link>
            )}
        </div>
    );

    const startDate = parseISO(sale.start_date);
    const endDate = parseISO(sale.end_date);
    const durationDays = differenceInDays(endDate, startDate) + 1;

    return (
        <div className="bg-brand-cream min-h-screen overflow-clip pb-4 md:pb-8">
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
                <div className="bg-brand-orange-dark text-white py-3 px-4 text-center shadow-lg fixed top-20 left-0 right-0 z-30 w-full">
                    <p className="text-sm sm:text-base font-semibold">
                        {allPromotions[promoIndex]?.message}
                    </p>
                </div>
            )}
            
            {/* Back Button & Save */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 md:pt-16 pb-4 relative z-10">
                <div className="flex items-center justify-between">
                    <Link to={backUrl}>
                        <Button variant="ghost" className="gap-2 text-slate-600 hover:text-navy">
                            <ChevronLeft className="w-4 h-4" />
                            Back to listings
                        </Button>
                    </Link>
                    
                    {isAuthenticated && canBeSaved(sale) && (
                        <Button
                            onClick={() => saveMutation.mutate(saleId)}
                            disabled={saveMutation.isPending}
                            variant={isSaved ? "default" : "outline"}
                            className={`gap-2 ${isSaved ? 'bg-navy hover:bg-navy-dark' : ''}`}
                        >
                            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                            {isSaved ? 'Saved to Favourites' : 'Save to Favourites'}
                        </Button>
                    )}
                </div>
            </div>

            {/* A sale that's over: its seller or an admin looking back at it, or anyone before the
                nightly job takes it down. */}
            {finished && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 mb-6">
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="font-medium text-navy">This sale has finished.</p>
                        <Link to={NEARBY_SALES_URL}>
                            <Button variant="outline" className="gap-2">
                                <MapPin className="w-4 h-4" />
                                Find sales near you
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                {/* The header is in the page once: above the photos on phones, and at the top of the
                    right-hand column on desktop, where the photos span both rows beside it. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[auto_1fr] gap-4 lg:gap-x-8 lg:gap-y-6">
                    {/* Header */}
                    <div className="lg:col-start-2 lg:row-start-1">
                        <div className="flex items-center gap-2 mb-3">
                            {sale.sale_type && (
                                <Badge className="bg-navy text-white">
                                    {SALE_TYPE_LABELS[sale.sale_type]}
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-navy mb-2">
                            {sale.title}
                        </h1>
                        <div className="hidden lg:block mt-4">{actionButtons}</div>
                    </div>

                    {/* Image Gallery. On desktop both columns stretch to the same height, and the
                        description and Where boxes grow so their bottoms line up. */}
                    <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:row-span-2">
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 shadow-lg">
                            {sale.photos && sale.photos.length > 0 ? (
                                <img
                                    src={sale.photos[selectedImageIndex]}
                                    alt={sale.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <ListingPlaceholder saleType={sale.sale_type} />
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
                                                ? 'border-navy shadow-lg'
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
                        {/* Description, under the photos */}
                        {sale.description && (
                            <div className="lg:flex-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                <h3 className="font-semibold text-navy mb-3">About This Sale</h3>
                                <p className="text-slate-600 whitespace-pre-wrap">{sale.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-col gap-6 mt-4 lg:mt-0 lg:col-start-2 lg:row-start-2">
                        {/* Date & Time */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-navy mb-4">When</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-navy" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-navy">
                                            {format(startDate, AU_WEEKDAY_DATE)}
                                            {durationDays > 1 && ` - ${format(endDate, AU_WEEKDAY_DATE)}`}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {durationDays} {durationDays === 1 ? 'day' : 'days'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-navy" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-navy">
                                            {formatTimeAU(sale.start_time)}–{formatTimeAU(sale.end_time)}
                                        </p>
                                        <p className="text-sm text-slate-500">Daily hours</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="lg:flex-1 flex flex-col bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                            <h3 className="font-semibold text-navy mb-4">Where</h3>
                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-5 h-5 text-navy" />
                                </div>
                                {sale.address ? (
                                    <div>
                                        <p className="font-medium text-navy">{sale.address}</p>
                                        {sale.suburb && (
                                            <p className="text-sm text-slate-600">{sale.suburb}</p>
                                        )}
                                        {sale.postcode && (
                                            <p className="text-sm text-slate-500">{sale.postcode}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-medium text-navy">
                                            {[sale.suburb, sale.state, sale.postcode].filter(Boolean).join(' ')}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            <Link to={createPageUrl('Login')} className="text-navy underline">Sign in</Link> to see the street address.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {sale.latitude && sale.longitude && (
                                // The map fills the box's spare height on desktop, never shorter than on phones.
                                <div className="relative h-48 lg:h-auto lg:min-h-64 lg:flex-1 rounded-xl overflow-hidden">
                                    <div className="absolute inset-0">
                                        <SaleMap
                                            sales={[sale]}
                                            center={[sale.latitude, sale.longitude]}
                                            zoom={sale.approximate_location ? 13 : 15}
                                        />
                                    </div>
                                </div>
                            )}
                            {sale.approximate_location && (
                                <p className="text-xs text-slate-500 mt-2">The map shows the area, not the house.</p>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Bottom Actions on phones and tablets: they stick just above the mobile bottom nav, or the
                screen edge on tablets. Needs the page's overflow-clip, not overflow-hidden. */}
            <div className="sticky bottom-20 md:bottom-0 z-30 mt-8 bg-white border-t p-4 lg:hidden">
                <div className="max-w-7xl mx-auto">{actionButtons}</div>
            </div>

            <ShareListingDialog
                listing={sale}
                open={shareOpen}
                onOpenChange={setShareOpen}
                promote={isOwner || sharingFromEmail}
            />

            {/* Print Size Selection Dialog */}
            <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Print Garage Sale Sign</DialogTitle>
                        <DialogDescription>
                            Select the paper size for your garage sale sign
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-3">
                            {Object.entries(paperSizes).map(([key, size]) => (
                                <label key={key} className="flex items-center p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="radio"
                                        name="paper-size"
                                        value={key}
                                        checked={selectedPrintSize === key}
                                        onChange={(e) => setSelectedPrintSize(e.target.value)}
                                        className="w-4 h-4"
                                    />
                                    <span className="ml-3 font-medium text-slate-700">{size.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button 
                            className="bg-navy hover:bg-navy-dark"
                            onClick={handlePrintSignConfirm}
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            Print Sign
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}