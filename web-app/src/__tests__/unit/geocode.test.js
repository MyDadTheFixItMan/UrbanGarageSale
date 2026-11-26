import { geocode } from '@/lib/geocode';
import { getPostcodeForLocation } from '@/api/firebase/services';
jest.mock('@/api/firebase/app', () => ({ db: {} }));

function stubMaps(lookup) {
  window.google = {
    maps: {
      importLibrary: async () => ({
        Geocoder: class {
          geocode = lookup;
        },
      }),
    },
  };
}

afterEach(() => {
  jest.useRealTimers();
  delete window.google;
});

describe('geocode', () => {
  it('returns the first match', async () => {
    stubMaps(async () => ({
      results: [{ geometry: { location: { lat: () => -38.27, lng: () => 144.52 } } }],
    }));

    await expect(geocode('Ocean Grove VIC')).resolves.toEqual({ lat: -38.27, lng: 144.52, components: [] });
  });

  it('gives up when Google never answers', async () => {
    jest.useFakeTimers();
    stubMaps(() => new Promise(() => {}));

    const lookup = geocode('Ocean Grove VIC');
    const outcome = expect(lookup).rejects.toThrow('Google Maps did not respond');
    await jest.advanceTimersByTimeAsync(8000);

    await outcome;
  });
});

describe('getPostcodeForLocation', () => {
  const place = (components) => async () => ({ results: [{ address_components: components }] });
  const AU = { long_name: 'Australia', short_name: 'AU', types: ['country', 'political'] };

  it("returns the postcode at the visitor's location", async () => {
    stubMaps(place([{ long_name: 'Geelong', types: ['locality'] }, { long_name: '3220', types: ['postal_code'] }, AU]));
    await expect(getPostcodeForLocation(-38.15, 144.36)).resolves.toBe('3220');
  });

  it('falls back to the suburb when Google has no postcode there', async () => {
    stubMaps(place([{ long_name: 'Geelong', types: ['locality'] }, AU]));
    await expect(getPostcodeForLocation(-38.15, 144.36)).resolves.toBe('Geelong');
  });

  it('returns nothing outside Australia, or when the lookup fails', async () => {
    stubMaps(place([{ long_name: '0600', types: ['postal_code'] }, { long_name: 'New Zealand', short_name: 'NZ', types: ['country'] }]));
    await expect(getPostcodeForLocation(-41.29, 174.78)).resolves.toBeNull();
    stubMaps(async () => { throw new Error('denied'); });
    await expect(getPostcodeForLocation(-38.15, 144.36)).resolves.toBeNull();
  });
});
