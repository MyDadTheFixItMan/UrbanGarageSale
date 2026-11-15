// Pure helpers for listing search: no Firebase SDK imports, so they can be unit tested directly.
import { geohashForLocation } from 'geofire-common';

// Search limits: radius searches read only the geohash cells covering the radius, capped per
// cell; searches without a location are capped outright, so no search downloads every listing.
export const MAX_LISTINGS_PER_CELL = 100;
export const MAX_LISTINGS_UNLOCATED = 200;
export const DEFAULT_RADIUS_KM = 25;

// Adds a geohash (used for radius search) whenever a write carries coordinates.
export function withGeohash(data) {
  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  if (data.latitude == null || data.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return data;
  }
  return { ...data, geohash: geohashForLocation([lat, lng]) };
}

export function hasLocationFilter(filters) {
  return Boolean(filters.distance) && filters.userLatitude !== undefined && filters.userLongitude !== undefined;
}

export function radiusKm(filters) {
  return parseInt(filters.distance) || DEFAULT_RADIUS_KM;
}

// Distance between two coordinates in kilometres (Haversine formula).
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// A listing has ended once its end_date (string, Date or Firestore Timestamp) is before today.
// Listings without an end_date are treated as current.
export function hasEnded(listing, now = new Date()) {
  if (!listing.end_date) return false;

  let endDate = listing.end_date;
  if (typeof endDate === 'string') {
    endDate = new Date(endDate);
  } else if (endDate.toDate) {
    endDate = endDate.toDate();
  } else {
    endDate = new Date(endDate);
  }
  endDate.setHours(23, 59, 59, 999); // End of that day

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return endDate < startOfToday;
}

// A listing date (YYYY-MM-DD string, Date or Firestore Timestamp) as a local YYYY-MM-DD string.
export function toLocalIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// True if the sale runs on `day` (YYYY-MM-DD): any day from start_date to end_date counts, so a
// three-day sale matches each of its three days. A missing start or end leaves that side open.
export function runsOnDate(listing, day) {
  const start = toLocalIsoDate(listing.start_date);
  const end = toLocalIsoDate(listing.end_date) || start;
  return (!start || start <= day) && (!end || day <= end);
}

// True if the listing has coordinates within radius of the searcher.
export function isWithinRadius(listing, filters) {
  if (!listing.latitude || !listing.longitude) return false;
  const distance = calculateDistance(filters.userLatitude, filters.userLongitude, listing.latitude, listing.longitude);
  return distance <= radiusKm(filters);
}

// Applies the in-memory part of a listing search (past listings, sale date, radius) and removes duplicates
// that appear when geohash cells overlap.
export function refineListingResults(results, filters = {}, now = new Date()) {
  let refined = results;
  if (!filters.includePast) {
    refined = refined.filter((listing) => !hasEnded(listing, now));
  }
  if (filters.saleDate) {
    refined = refined.filter((listing) => runsOnDate(listing, filters.saleDate));
  }
  if (hasLocationFilter(filters)) {
    refined = refined.filter((listing) => isWithinRadius(listing, filters));
  }
  return Array.from(new Map(refined.map((item) => [item.id, item])).values());
}
