import React, { useState, useEffect, useTransition } from 'react';
import { firebase, getSuburbCoordinates } from '@/api/firebaseClient';
import { Map, List, Tag, Search, Loader2, Heart, MapPin, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import SaleMap from '../components/map/SaleMap';
import { saleWhenLabel, formatDistanceKm } from '@/lib/format';
import { coverImage, SALE_TYPE_LABELS } from '@/lib/listings';
import { calculateDistance } from '@/api/firebase/listingSearch';
import ListingPlaceholder from '@/components/listings/ListingPlaceholder';
import { useToggleSaved } from '@/lib/useToggleSaved';

export default function Home() {
    const [, startTransition] = useTransition();
    const [viewMode, setViewMode] = useState('list');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    // Where the last search measured from, so cards can show how far away each sale is.
    const [searchOrigin, setSearchOrigin] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [promoIndex, setPromoIndex] = useState(0);
    const [saleTypeIndex, setSaleTypeIndex] = useState(0);
    const saleTypeLabels = ['Garage', 'Clearing', 'Street', 'Yard', 'Estate', 'Moving'];
    const [filters, setFilters] = useState({
        postcode: '',
        distance: '25',
        saleType: 'all',
    });

    // Restore the last search's filters and search again, so a sale that has since been deleted,
    // rejected or changed never shows. Results used to be saved here too; clear any left behind.
    useEffect(() => {
        localStorage.removeItem('homeSearchResults');
        const savedFilters = localStorage.getItem('homeSearchFilters');
        if (!savedFilters) return;
        try {
            const restored = JSON.parse(savedFilters);
            setFilters(restored);
            if (restored.postcode) runSearch(restored, { quiet: true });
        } catch (error) {
            console.error('Error parsing saved filters:', error);
        }
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
        staleTime: 1000 * 60 * 30, // 30 minutes
        gcTime: 1000 * 60 * 60, // 60 minutes cache
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const [enableSavedListingsQuery, setEnableSavedListingsQuery] = useState(false);

    const { data: savedListings = [] } = useQuery({
        queryKey: ['savedListings', user?.email],
        queryFn: async () => {
            if (!user?.email) return [];
            const results = await firebase.entities.SavedListing.mine();
            return results;
        },
        enabled: enableSavedListingsQuery && !!user?.email,
        staleTime: 1000 * 60 * 30, // Keep data fresh for 30 minutes before refetching
        gcTime: 1000 * 60 * 60, // Keep in cache for 60 minutes
        throwOnError: false,
        suspense: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const saveFavoriteMutation = useToggleSaved();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const authenticated = await firebase.auth.isAuthenticated();
                setIsAuthenticated(authenticated);
                if (authenticated) {
                    const userData = await firebase.auth.me();
                    setUser(userData);
                }
            } catch (error) {
                console.error('Auth check error:', error);
            }
        };
        checkAuth();
    }, []);

    // Defer SavedListings query to avoid blocking on initial page load
    useEffect(() => {
        if (!user?.email) return;
        const timer = setTimeout(() => {
            setEnableSavedListingsQuery(true);
        }, 2000); // Wait 2 seconds before enabling the query to let page render
        return () => clearTimeout(timer);
    }, [user?.email]);

    // Rotate promotional messages every 5 seconds
    useEffect(() => {
        if (allPromotions.length === 0) return;

        const interval = setInterval(() => {
            setPromoIndex((prevIndex) => (prevIndex + 1) % allPromotions.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [allPromotions.length]);

    // Rotate sale type text every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setSaleTypeIndex((prevIndex) => (prevIndex + 1) % saleTypeLabels.length);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Save filters to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('homeSearchFilters', JSON.stringify(filters));
    }, [filters]);

    const requestGeolocation = () => {
        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setUserLocation({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        });
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        });
                    },
                    (error) => {
                        console.log('Geolocation permission denied or unavailable:', error);
                        resolve(null);
                    }
                );
            } else {
                resolve(null);
            }
        });
    };

    // Takes the filters as an argument because the search on page load runs before state updates.
    // `quiet` skips the result messages for that search.
    const runSearch = async (filters, { quiet = false } = {}) => {
        let location = userLocation;
        
        if (!filters.postcode && !location) {
            // Request geolocation when user clicks search without entering a postcode
            const asking = toast.loading('Requesting your location...');
            location = await requestGeolocation();
            toast.dismiss(asking);
        }
        
        if (!filters.postcode && !location) {
            toast.error('Please enter a suburb/postcode or enable location access');
            return;
        }

        // Set searching immediately
        startTransition(() => setIsSearching(true));
        
        // Defer the actual search work to avoid blocking the event handler
        setTimeout(async () => {
            try {
                // Build filter object
                const searchFilters = {
                    status: 'active',
                    saleType: filters.saleType !== 'all' ? filters.saleType : undefined,
                    distance: filters.distance,
                };

                // Try to get coordinates from suburb/postcode input
                let searchLatitude = location?.latitude;
                let searchLongitude = location?.longitude;
                // Set when typed text is neither a known suburb nor a postcode.
                let placeUnknown = false;

                if (filters.postcode) {
                    // Use the suburb lookup function (which now supports async geocoding)
                    try {
                        const suburbData = await getSuburbCoordinates(filters.postcode);
                        if (suburbData) {
                            searchLatitude = suburbData.lat;
                            searchLongitude = suburbData.lng;
                            console.log(`✓ Found suburb coordinates: ${filters.postcode} -> lat=${searchLatitude}, lng=${searchLongitude}`);
                        } else {
                            console.log(`✗ Suburb "${filters.postcode}" not found in lookup, using user location or defaulting to search by postcode`);
                            searchFilters.postcode = filters.postcode;
                            placeUnknown = !/^\d{4}$/.test(filters.postcode.trim());
                        }
                    } catch (error) {
                        console.warn(`⚠️  Error looking up suburb "${filters.postcode}":`, error.message);
                        // Fallback to postcode search
                        searchFilters.postcode = filters.postcode;
                    }
                }

                // Add coordinates if available
                if (searchLatitude !== undefined && searchLongitude !== undefined) {
                    searchFilters.userLatitude = searchLatitude;
                    searchFilters.userLongitude = searchLongitude;
                }

                // Fetch filtered sales
                const results = await firebase.entities.GarageSale.filter(searchFilters);
                
                // Defer state update to prevent blocking the UI
                startTransition(() => {
                    if (!quiet) {
                        if (results.length === 0 && placeUnknown) {
                            toast.info(`We couldn't find "${filters.postcode}". Try a suburb name or a 4-digit postcode.`);
                        } else if (results.length === 0) {
                            toast.info('No listings found in your search area');
                        } else {
                            toast.success(`Found ${results.length} listing${results.length !== 1 ? 's' : ''}`);
                        }
                    }

                    setSearchResults(results);
                    setSearchOrigin(searchFilters.userLatitude !== undefined
                        ? { latitude: searchFilters.userLatitude, longitude: searchFilters.userLongitude }
                        : null);
                });
            } catch (error) {
                console.error('Search error:', error);
                toast.error('Failed to search listings');
            } finally {
                startTransition(() => setIsSearching(false));
            }
        }, 0);
    };

    const handleSearch = () => runSearch(filters);

    return (
        <div className="min-h-screen bg-brand-cream overflow-hidden pb-24 md:pb-0">
            {/* Watermark U Shape */}
            <style>{`
                @media (min-width: 768px) {
                    .watermark-home {
                        top: -90px !important;
                    }
                }
            `}</style>
            <img 
                src="/logo-web.webp" 
                alt="" 
                className="fixed left-0 pointer-events-none watermark-home"
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

            {/* Advertising Ribbon - Rotates every 5 seconds */}
            {allPromotions.length > 0 && (
                <div className="bg-brand-orange-dark text-white py-3 px-4 text-center shadow-lg fixed top-20 left-0 right-0 z-30 w-full">
                    <p className="text-sm sm:text-base font-semibold">
                        {allPromotions[promoIndex]?.message}
                    </p>
                </div>
            )}

            {/* Hero Section */}
            {/* Extra top space when the fixed promo strip is showing, so a two-line message on a phone doesn't cover the heading. */}
            <section className={`relative bg-brand-cream pb-16 px-4 sm:px-6 overflow-hidden ${allPromotions.length > 0 ? 'pt-24' : 'pt-16'}`}>
                <div className="max-w-7xl mx-auto pt-2 md:pt-4 relative z-10">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-navy-dark mb-4">
                            Discover Local{' '}
                            {/* Every label sits in the same grid cell, so the space is always as wide as the longest and the line doesn't shift. */}
                            <span className="inline-grid text-center text-brand-orange-dark">
                                {saleTypeLabels.map((label, index) => (
                                    <span key={label} className={`col-start-1 row-start-1 ${index === saleTypeIndex ? '' : 'invisible'}`}>
                                        {label}
                                    </span>
                                ))}
                            </span>{' '}
                            Sales
                        </h1>
                        <p className="text-lg text-slate-700 max-w-2xl mx-auto">
                            Find unique treasures in your neighbourhood.
                        </p>
                    </div>

                    {/* Search Box */}
                    <div className="max-w-4xl mx-auto relative z-20">
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label htmlFor="search-location" className="block text-slate-800 text-sm font-medium mb-2">Suburb or Postcode</label>
                                    <input
                                        id="search-location"
                                        type="text"
                                        placeholder="Start typing..."
                                        className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                                        value={filters.postcode}
                                        onChange={(e) => setFilters({ ...filters, postcode: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="search-sale-type" className="block text-slate-800 text-sm font-medium mb-2">Sale Type</label>
                                    <Select value={filters.saleType} onValueChange={(value) => startTransition(() => setFilters({ ...filters, saleType: value }))}>
                                        <SelectTrigger id="search-sale-type" className="bg-white border-slate-300">
                                            <SelectValue placeholder="All Types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            <SelectItem value="garage_sale">Garage Sale</SelectItem>
                                            <SelectItem value="yard_sale">Yard Sale</SelectItem>
                                            <SelectItem value="estate_sale">Estate Sale</SelectItem>
                                            <SelectItem value="moving_sale">Moving Sale</SelectItem>
                                            <SelectItem value="multi_family">Multi-Family Sale</SelectItem>
                                            <SelectItem value="clearing_sale">Clearing Sale</SelectItem>
                                            <SelectItem value="street_sale">Street Sale</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label htmlFor="search-distance" className="block text-slate-800 text-sm font-medium mb-2">Distance</label>
                                    <Select value={filters.distance} onValueChange={(value) => startTransition(() => setFilters({ ...filters, distance: value }))}>
                                        <SelectTrigger id="search-distance" className="bg-white border-slate-300">
                                            <SelectValue placeholder="Distance" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5 km</SelectItem>
                                            <SelectItem value="25">25 km</SelectItem>
                                            <SelectItem value="50">50 km</SelectItem>
                                            <SelectItem value="100">100 km</SelectItem>
                                            <SelectItem value="200">200 km</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex justify-center mt-4">
                                <Button 
                                    onClick={handleSearch}
                                    disabled={isSearching}
                                    className="bg-brand-orange-dark text-white hover:bg-brand-orange-darker gap-2 font-semibold px-8 h-11 rounded-xl disabled:opacity-50"
                                >
                                    {isSearching ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Search className="w-5 h-5" />
                                    )}
                                    {isSearching ? 'Searching...' : 'Search'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">
                {/* View Toggle */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-navy">Popular This Weekend</h2>
                        <p className="text-sm text-slate-600">Browse listings in your area</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`font-medium flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                viewMode === 'list'
                                    ? 'bg-navy text-white'
                                    : 'text-navy hover:bg-slate-100'
                            }`}
                        >
                            <List className="w-4 h-4" />
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`font-medium flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                viewMode === 'map'
                                    ? 'bg-navy text-white'
                                    : 'text-navy hover:bg-slate-100'
                            }`}
                        >
                            <Map className="w-4 h-4" />
                            Map
                        </button>
                    </div>
                </div>

                {/* Content Results */}
                {searchResults.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Tag className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-navy mb-2">
                            {searchResults.length === 0 && filters.postcode ? 'No listings found' : 'Search for listings'}
                        </h3>
                        <p className="text-slate-600">
                            {searchResults.length === 0 && filters.postcode 
                                ? 'Try adjusting your filters or expanding your distance' 
                                : 'Enter a postcode and click Search to find garage sales'}
                        </p>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResults
                            .reduce((unique, sale) => {
                                if (!unique.find(s => s.id === sale.id)) {
                                    unique.push(sale);
                                }
                                return unique;
                            }, [])
                            .filter(sale => {
                                // Filter out past-dated listings
                                if (!sale.end_date) return true;
                                const now = new Date();
                                now.setHours(0, 0, 0, 0);
                                let endDate = new Date(sale.end_date);
                                endDate.setHours(23, 59, 59, 999);
                                return endDate >= now;
                            })
                            .map((sale) => {
                            const isSaved = savedListings.some(s => s.garage_sale_id === sale.id);
                            const when = saleWhenLabel(sale);
                            const distance = searchOrigin && sale.latitude && sale.longitude
                                ? formatDistanceKm(calculateDistance(searchOrigin.latitude, searchOrigin.longitude, sale.latitude, sale.longitude))
                                : '';
                            return (
                                <div key={sale.id} className="relative">
                                    <Link to={createPageUrl(`ListingDetails?id=${sale.id}`)} className="block h-full">
                                        <div className="h-full bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden cursor-pointer">
                                            <div className="aspect-video relative">
                                                {coverImage(sale) ? (
                                                    <img src={coverImage(sale)} alt={sale.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <ListingPlaceholder />
                                                )}
                                                <span className="absolute bottom-3 left-3 text-xs font-semibold bg-white/95 text-navy px-3 py-1 rounded-full shadow-sm">
                                                    {SALE_TYPE_LABELS[sale.sale_type] ?? 'Sale'}
                                                </span>
                                            </div>
                                            <div className="p-4">
                                                {when && (
                                                    <p className="flex items-center gap-1.5 text-sm font-bold text-brand-orange-dark mb-1">
                                                        <CalendarClock className="w-4 h-4 flex-shrink-0" />
                                                        {when}
                                                    </p>
                                                )}
                                                <h3 className="text-lg font-bold text-navy leading-snug mb-1 line-clamp-2">{sale.title}</h3>
                                                <p className="flex items-center gap-1.5 text-sm text-slate-600">
                                                    <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                                    <span>
                                                        <span className="font-semibold">{sale.suburb || sale.postcode}</span>
                                                        {distance && <span> · {distance}</span>}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                    {isAuthenticated && (
                                        <button
                                            type="button"
                                            onClick={() => saveFavoriteMutation.mutate(sale.id)}
                                            className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow z-40"
                                            aria-label={isSaved ? 'Remove from favourites' : 'Save to favourites'}
                                            disabled={saveFavoriteMutation.isPending}
                                        >
                                            <Heart
                                                className={`w-5 h-5 transition-colors ${isSaved ? 'fill-red-500 text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                                            />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-[600px] rounded-lg overflow-hidden shadow-md">
                        <SaleMap sales={searchResults.filter(sale => {
                            // Filter out past-dated listings for map view
                            if (!sale.end_date) return true;
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            let endDate = new Date(sale.end_date);
                            endDate.setHours(23, 59, 59, 999);
                            return endDate >= now;
                        })} />
                    </div>
                )}
            </section>

        </div>
    );
}
