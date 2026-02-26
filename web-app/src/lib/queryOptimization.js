import { useMemo } from 'react';

/**
 * Query Optimization Utilities
 * Memoizes expensive selectors and filters
 */

/**
 * Filter listings by criteria - memoized to prevent unnecessary recalculations
 */
export function useFilteredListings(listings, searchCriteria) {
  return useMemo(() => {
    if (!searchCriteria || Object.keys(searchCriteria).length === 0) {
      return listings;
    }

    return listings.filter((listing) => {
      // Filter by sale type
      if (searchCriteria.saleType && searchCriteria.saleType !== 'all') {
        if (listing.sale_type !== searchCriteria.saleType) return false;
      }

      // Filter by postcode
      if (searchCriteria.postcode) {
        if (listing.postcode !== searchCriteria.postcode) return false;
      }

      // Filter by distance (if coordinates provided)
      if (searchCriteria.distance && searchCriteria.userLatitude && searchCriteria.userLongitude) {
        const distance = calculateDistance(
          searchCriteria.userLatitude,
          searchCriteria.userLongitude,
          listing.latitude,
          listing.longitude
        );
        if (distance > parseInt(searchCriteria.distance)) return false;
      }

      return true;
    });
  }, [listings, searchCriteria]);
}

/**
 * Check if listing is saved by user - memoized
 */
export function useIsListingSaved(listingId, savedListings) {
  return useMemo(() => {
    return savedListings.some((s) => s.garage_sale_id === listingId);
  }, [listingId, savedListings]);
}

/**
 * Group listings by proximity - useful for map/cluster views
 */
export function useGroupedListings(listings) {
  return useMemo(() => {
    const groups = {};
    listings.forEach((listing) => {
      const key = `${Math.round(listing.latitude * 2) / 2},${Math.round(listing.longitude * 2) / 2}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(listing);
    });
    return groups;
  }, [listings]);
}

/**
 * Helper function to calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
