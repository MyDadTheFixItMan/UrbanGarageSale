import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Map, List, Tag, Search, Loader2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function Home() {
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState('list');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [userLocation, setUserLocation] = useState(null);
    const [promoIndex, setPromoIndex] = useState(0);
    const [saleTypeIndex, setSaleTypeIndex] = useState(0);
    const saleTypeLabels = ['Garage', 'Clearing', 'Street', 'Yard', 'Estate', 'Moving'];
    const [filters, setFilters] = useState({
        postcode: '',
        distance: '25',
        saleType: 'all',
    });

    // Load saved filters and search results from localStorage on mount
    useEffect(() => {
        const savedFilters = localStorage.getItem('homeSearchFilters');
        const savedResults = localStorage.getItem('homeSearchResults');
        
        if (savedFilters) {
            try {
                setFilters(JSON.parse(savedFilters));
            } catch (error) {
                console.error('Error parsing saved filters:', error);
            }
        }
        
        if (savedResults) {
            try {
                setSearchResults(JSON.parse(savedResults));
            } catch (error) {
                console.error('Error parsing saved results:', error);
            }
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
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const { data: savedListings = [] } = useQuery({
        queryKey: ['savedListings', user?.email],
        queryFn: async () => {
            if (!user?.email) return [];
            const results = await firebase.entities.SavedListing.filter({ user_email: user.email });
            return results;
        },
        enabled: !!user?.email,
    });

    const [lastWasSaved, setLastWasSaved] = useState(false);

    const saveFavoriteMutation = useMutation({
        mutationFn: async (saleId) => {
            // Re-fetch current state at mutation time, not from closure
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
            queryClient.invalidateQueries({ queryKey: ['savedListings', user?.email] });
            toast.success(lastWasSaved ? 'Removed from favourites' : 'Saved to favourites');
        },
        onError: (error) => {
            console.error('Save mutation failed:', error);
            toast.error('Failed to update favorite');
        },
    });

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

        // Try to get user's geolocation
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (error) => {
                    console.log('Geolocation permission denied or unavailable:', error);
                }
            );
        }
    }, []);

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

    // Save filters and search results to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('homeSearchFilters', JSON.stringify(filters));
    }, [filters]);

    useEffect(() => {
        if (searchResults.length > 0) {
            localStorage.setItem('homeSearchResults', JSON.stringify(searchResults));
        }
    }, [searchResults]);

    // Auto-search when user location is available
    useEffect(() => {
        if (userLocation && !isSearching && searchResults.length === 0) {
            console.log('User location detected, performing automatic search within 25km');
            performSearch(userLocation);
        }
    }, [userLocation]);

    const performSearch = async (location = userLocation, searchFilters = {}) => {
        if (!location) {
            toast.error('Location not available. Please enable location access or enter a suburb.');
            return;
        }

        setIsSearching(true);
        try {
            const filters = {
                saleType: searchFilters.saleType !== 'all' ? searchFilters.saleType : undefined,
                distance: searchFilters.distance || '25',
                userLatitude: location.latitude,
                userLongitude: location.longitude,
            };

            console.log('Search filters:', filters);

            // Fetch filtered sales
            const results = await firebase.entities.GarageSale.filter(filters);
            
            console.log('Search results:', results);
            
            if (results.length === 0) {
                toast.info('No listings found in your search area');
            } else {
                toast.success(`Found ${results.length} listing${results.length !== 1 ? 's' : ''}`);
            }
            
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Failed to search listings');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearch = async () => {
        console.log('Search button clicked!');
        console.log('Filters:', filters);
        console.log('User Location:', userLocation);
        
        if (!filters.postcode && !userLocation) {
            toast.error('Please enter a suburb/postcode or enable location access');
            return;
        }

        setIsSearching(true);
        try {
            // Build filter object
            const searchFilters = {
                saleType: filters.saleType !== 'all' ? filters.saleType : undefined,
                distance: filters.distance,
            };

            // Try to get coordinates from suburb/postcode input
            let searchLatitude = userLocation?.latitude;
            let searchLongitude = userLocation?.longitude;

            if (filters.postcode) {
                // Use the suburb lookup function (which now supports async geocoding)
                try {
                    const suburbData = await window.firebaseSuburbLookup?.(filters.postcode);
                    if (suburbData) {
                        searchLatitude = suburbData.lat;
                        searchLongitude = suburbData.lng;
                        console.log(`✓ Found suburb coordinates: ${filters.postcode} -> lat=${searchLatitude}, lng=${searchLongitude}`);
                    } else {
                        console.log(`✗ Suburb "${filters.postcode}" not found in lookup, using user location or defaulting to search by postcode`);
                        searchFilters.postcode = filters.postcode;
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

            console.log('Search filters:', searchFilters);

            // Fetch filtered sales
            const results = await firebase.entities.GarageSale.filter(searchFilters);
            
            console.log('Search results:', results);
            
            if (results.length === 0) {
                toast.info('No listings found in your search area');
            } else {
                toast.success(`Found ${results.length} listing${results.length !== 1 ? 's' : ''}`);
            }
            
            setSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Failed to search listings');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f1e8] overflow-hidden pb-24 md:pb-0">
            {/* Watermark U Shape */}
            <style>{`
                @media (min-width: 768px) {
                    .watermark-home {
                        top: -90px !important;
                    }
                }
            `}</style>
            <img 
                src="/Logo Webpage.png" 
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
                <div className="bg-gradient-to-r from-[#FF9500] to-[#f97316] text-white py-3 px-4 text-center shadow-lg fixed top-20 left-0 right-0 z-30 w-full" style={{ backgroundColor: 'rgb(255, 149, 0)' }}>
                    <p className="text-sm sm:text-base font-semibold">
                        {allPromotions[promoIndex]?.message}
                    </p>
                </div>
            )}

            {/* Hero Section */}
            <section className="relative bg-[#f5f1e8] py-16 px-4 sm:px-6 overflow-hidden">
                <div className="max-w-7xl mx-auto pt-2 md:pt-4 relative z-10">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#001f3f] mb-4">
                            Discover Local <span className="inline-block w-44 text-[#FF9500] mr-2">{saleTypeLabels[saleTypeIndex]}</span> Sales
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
                                    <label className="block text-slate-800 text-sm font-medium mb-2">Suburb or Postcode</label>
                                    <input
                                        type="text"
                                        placeholder="Start typing..."
                                        className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800"
                                        value={filters.postcode}
                                        onChange={(e) => setFilters({ ...filters, postcode: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-800 text-sm font-medium mb-2">Sale Type</label>
                                    <Select value={filters.saleType} onValueChange={(value) => setFilters({ ...filters, saleType: value })}>
                                        <SelectTrigger className="bg-white border-slate-300">
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
                                    <label className="block text-slate-800 text-sm font-medium mb-2">Distance</label>
                                    <Select value={filters.distance} onValueChange={(value) => setFilters({ ...filters, distance: value })}>
                                        <SelectTrigger className="bg-white border-slate-300">
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
                                    className="bg-[#f97316] text-white hover:bg-[#ea580c] gap-2 font-semibold px-8 h-11 rounded-xl disabled:opacity-50"
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
                        <h2 className="text-2xl font-bold text-[#1e3a5f]">Popular This Weekend</h2>
                        <p className="text-sm text-slate-600">Browse listings in your area</p>
                    </div>
                    
                    <Link to={createPageUrl('Home')} className="text-[#1e3a5f] hover:text-[#152a45] font-medium flex items-center gap-2">
                        <Map className="w-4 h-4" />
                        Map
                    </Link>
                </div>

                {/* Content Results */}
                {searchResults.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Tag className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-[#1e3a5f] mb-2">
                            {searchResults.length === 0 && filters.postcode ? 'No listings found' : 'Search for listings'}
                        </h3>
                        <p className="text-slate-600">
                            {searchResults.length === 0 && filters.postcode 
                                ? 'Try adjusting your filters or expanding your distance' 
                                : 'Enter a postcode and click Search to find garage sales'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResults.map((sale) => {
                            const isSaved = savedListings.some(s => s.garage_sale_id === sale.id);
                            return (
                                <div key={sale.id} className="relative">
                                    <Link to={createPageUrl(`ListingDetails?id=${sale.id}`)}>
                                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden cursor-pointer">
                                            <div className="aspect-video bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center relative">
                                                {sale.photos && sale.photos.length > 0 ? (
                                                    <img src={sale.photos[0]} alt={sale.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Tag className="w-12 h-12 text-slate-400" />
                                                )}
                                            </div>
                                            <div className="p-4">
                                                <h3 className="font-semibold text-[#1e3a5f] mb-2 line-clamp-2">{sale.title}</h3>
                                                <p className="text-sm text-slate-600 mb-3">
                                                    <span className="font-medium">{sale.suburb}</span>
                                                    {sale.postcode && <span>, {sale.postcode}</span>}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs bg-[#f97316] text-white px-3 py-1 rounded-full">
                                                        {sale.sale_type === 'garage_sale' ? 'Garage Sale' : 'Sale'}
                                                    </span>
                                                    {sale.start_date && (
                                                        <span className="text-xs text-slate-500">
                                                            {new Date(sale.start_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                    {isAuthenticated && (
                                        <button
                                            type="button"
                                            onClick={() => saveFavoriteMutation.mutate(sale.id)}
                                            className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-shadow z-40"
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
                )}
            </section>

        </div>
    );
}
