import { geocode } from '@/lib/geocode';

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
