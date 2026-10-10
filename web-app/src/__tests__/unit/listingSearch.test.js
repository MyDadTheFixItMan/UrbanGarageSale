import { geohashForLocation } from 'geofire-common';
import {
  withGeohash,
  calculateDistance,
  hasEnded,
  isWithinRadius,
  refineListingResults,
  radiusKm,
} from '@/api/firebase/listingSearch';

const NOW = new Date(2026, 9, 9, 15, 0); // 9 Oct 2026, 3 pm local time
const MELBOURNE_CBD = { lat: -37.8136, lng: 144.9631 };
const searchFrom = (distance) => ({ distance, userLatitude: MELBOURNE_CBD.lat, userLongitude: MELBOURNE_CBD.lng });

describe('withGeohash', () => {
  it('adds a geohash when the write has valid coordinates', () => {
    const result = withGeohash({ title: 'Sale', latitude: '-37.8136', longitude: 144.9631 });
    expect(result.geohash).toBe(geohashForLocation([-37.8136, 144.9631]));
    expect(result.title).toBe('Sale');
  });

  it('leaves writes without usable coordinates unchanged', () => {
    const partial = { latitude: -37.8 };
    expect(withGeohash(partial)).toBe(partial);
    expect(withGeohash({ latitude: 'abc', longitude: 1 }).geohash).toBeUndefined();
    expect(withGeohash({ latitude: null, longitude: null }).geohash).toBeUndefined();
  });
});

describe('calculateDistance', () => {
  it('is zero for the same point and symmetric', () => {
    expect(calculateDistance(-37.8, 144.9, -37.8, 144.9)).toBe(0);
    expect(calculateDistance(-37.8, 144.9, -33.9, 151.2)).toBeCloseTo(calculateDistance(-33.9, 151.2, -37.8, 144.9));
  });

  it('gives the Melbourne to Sydney distance to within a few km', () => {
    expect(calculateDistance(MELBOURNE_CBD.lat, MELBOURNE_CBD.lng, -33.8688, 151.2093)).toBeGreaterThan(705);
    expect(calculateDistance(MELBOURNE_CBD.lat, MELBOURNE_CBD.lng, -33.8688, 151.2093)).toBeLessThan(720);
  });
});

describe('hasEnded', () => {
  it('treats a sale ending today as still running', () => {
    expect(hasEnded({ end_date: '2026-10-09' }, NOW)).toBe(false);
  });

  it('treats a sale that ended yesterday as past', () => {
    expect(hasEnded({ end_date: '2026-10-08' }, NOW)).toBe(true);
  });

  it('reads Firestore Timestamps and Dates', () => {
    expect(hasEnded({ end_date: { toDate: () => new Date(2026, 9, 1) } }, NOW)).toBe(true);
    expect(hasEnded({ end_date: new Date(2026, 9, 20) }, NOW)).toBe(false);
  });

  it('does not modify the listing it checks', () => {
    const end = new Date(2026, 9, 9, 8, 0);
    hasEnded({ end_date: end }, NOW);
    expect(end.getHours()).toBe(8);
  });

  it('keeps listings without an end date', () => {
    expect(hasEnded({}, NOW)).toBe(false);
  });
});

describe('radius search', () => {
  it('defaults to 25 km when the distance is not a number', () => {
    expect(radiusKm({ distance: 'abc' })).toBe(25);
    expect(radiusKm({ distance: '10' })).toBe(10);
  });

  it('includes listings inside the radius and excludes ones outside or without coordinates', () => {
    const fitzroy = { latitude: -37.7984, longitude: 144.9783 }; // ~2 km
    const geelong = { latitude: -38.1499, longitude: 144.3617 }; // ~65 km
    expect(isWithinRadius(fitzroy, searchFrom(5))).toBe(true);
    expect(isWithinRadius(geelong, searchFrom(25))).toBe(false);
    expect(isWithinRadius({}, searchFrom(25))).toBe(false);
  });
});

describe('refineListingResults', () => {
  const current = { id: 'a', end_date: '2026-10-10', latitude: -37.7984, longitude: 144.9783 };
  const ended = { id: 'b', end_date: '2026-10-01', latitude: -37.7984, longitude: 144.9783 };
  const farAway = { id: 'c', end_date: '2026-10-10', latitude: -38.1499, longitude: 144.3617 };

  it('drops past listings unless includePast is set', () => {
    expect(refineListingResults([current, ended], {}, NOW).map((l) => l.id)).toEqual(['a']);
    expect(refineListingResults([current, ended], { includePast: true }, NOW).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('applies the radius only when a location is given', () => {
    expect(refineListingResults([current, farAway], searchFrom(10), NOW).map((l) => l.id)).toEqual(['a']);
    expect(refineListingResults([current, farAway], {}, NOW).map((l) => l.id)).toEqual(['a', 'c']);
  });

  it('removes duplicates returned by overlapping geohash cells', () => {
    expect(refineListingResults([current, { ...current }], {}, NOW)).toHaveLength(1);
  });
});
