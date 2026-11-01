import { directionsUrl, fullHomeAddress, orderStopsFrom, saleLocation } from '@/lib/route';

const home = { lat: -33.87, lng: 151.2 };
const sale = (id, latitude, longitude) => ({ id, latitude, longitude });

describe('fullHomeAddress', () => {
  it('adds the state and postcode to a street-only address', () => {
    expect(fullHomeAddress({ address: '12 Smith St', state: 'VIC', postcode: '3226' }))
      .toBe('12 Smith St, VIC 3226, Australia');
  });

  it('does not repeat a postcode or country the address already has', () => {
    expect(fullHomeAddress({ address: '12 Smith St, Ocean Grove VIC 3226, Australia', state: 'VIC', postcode: '3226' }))
      .toBe('12 Smith St, Ocean Grove VIC 3226, Australia');
  });

  it('copes with a missing state or postcode', () => {
    expect(fullHomeAddress({ address: '12 Smith St', state: '', postcode: '' })).toBe('12 Smith St, Australia');
    expect(fullHomeAddress({ address: '12 Smith St', state: 'VIC' })).toBe('12 Smith St, VIC, Australia');
  });

  it('has nothing to return without a street address', () => {
    expect(fullHomeAddress({ address: '  ', state: 'VIC', postcode: '3226' })).toBeUndefined();
    expect(fullHomeAddress(null)).toBeUndefined();
  });
});

describe('orderStopsFrom', () => {
  it('visits the stop closest to home first, whatever order they were saved in', () => {
    const far = sale('far', -33.87, 151.5);
    const near = sale('near', -33.87, 151.21);
    const middle = sale('middle', -33.87, 151.3);

    expect(orderStopsFrom(home, [far, near, middle]).map((s) => s.id)).toEqual(['near', 'middle', 'far']);
  });

  it('continues from the last stop rather than doubling back past home', () => {
    const east1 = sale('east1', -33.87, 151.21);
    const west = sale('west', -33.87, 151.17);
    const east2 = sale('east2', -33.87, 151.23);

    expect(orderStopsFrom(home, [west, east2, east1]).map((s) => s.id)).toEqual(['east1', 'east2', 'west']);
  });

  it('leaves the original list untouched', () => {
    const sales = [sale('far', -33.87, 151.5), sale('near', -33.87, 151.21)];
    orderStopsFrom(home, sales);
    expect(sales.map((s) => s.id)).toEqual(['far', 'near']);
  });
});

describe('directionsUrl', () => {
  const params = (url) => new URL(url).searchParams;

  it('starts at the origin and ends at the last stop, with the rest as waypoints in order', () => {
    const query = params(directionsUrl('1 Main St, Sydney NSW', ['-33.1,151.1', '-33.2,151.2', '-33.3,151.3']));

    expect(query.get('api')).toBe('1');
    expect(query.get('origin')).toBe('1 Main St, Sydney NSW');
    expect(query.get('waypoints')).toBe('-33.1,151.1|-33.2,151.2');
    expect(query.get('destination')).toBe('-33.3,151.3');
  });

  it('has no waypoints for a single stop', () => {
    const query = params(directionsUrl('1 Main St', ['-33.1,151.1']));

    expect(query.get('destination')).toBe('-33.1,151.1');
    expect(query.has('waypoints')).toBe(false);
  });

  it('leaves out the origin when there is no home address', () => {
    expect(params(directionsUrl(undefined, ['-33.1,151.1'])).has('origin')).toBe(false);
  });

  describe('on Apple phones and tablets', () => {
    const mobile = (userAgent) => ({ userAgent, maxTouchPoints: 5 });
    const iPhone = (version) => mobile(`Mozilla/5.0 (iPhone; CPU iPhone OS ${version} like Mac OS X) AppleWebKit/605.1.15`);
    const iPad = (version) => mobile(`Mozilla/5.0 (iPad; CPU OS ${version} like Mac OS X) AppleWebKit/605.1.15`);
    const desktopSafari = (version) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`;
    const stops = ['-33.1,151.1', '-33.2,151.2', '-33.3,151.3'];

    it.each(['18_4', '18_6', '26_0'])('routes every stop through Apple Maps on iOS %s', (version) => {
      const url = directionsUrl('1 Main St, Sydney NSW', stops, iPhone(version));
      const query = params(url);

      expect(new URL(url).origin + new URL(url).pathname).toBe('https://maps.apple.com/directions');
      expect(query.get('mode')).toBe('driving');
      expect(query.get('source')).toBe('1 Main St, Sydney NSW');
      expect(query.getAll('waypoint')).toEqual(['-33.1,151.1', '-33.2,151.2']);
      expect(query.get('destination')).toBe('-33.3,151.3');
    });

    it('starts from the device when there is no home address', () => {
      expect(params(directionsUrl(undefined, stops, iPhone('18_4'))).has('source')).toBe(false);
    });

    it.each(['17_7', '18_3', '18_3_2'])('stays on Google Maps on iOS %s', (version) => {
      expect(directionsUrl('1 Main St', stops, iPhone(version))).toContain('https://www.google.com/maps/dir/');
    });

    it.each([
      ['an iPad asking for the mobile site', iPad('18_4')],
      ['an iPad asking for the desktop site', mobile(desktopSafari('18.4'))],
      ['a Mac using Safari', { userAgent: desktopSafari('18.4'), maxTouchPoints: 0 }],
      ['a Mac using an older Safari', { userAgent: desktopSafari('17.6'), maxTouchPoints: 0 }],
      ['a Mac using Chrome', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        maxTouchPoints: 0,
      }],
    ])('routes through Apple Maps on %s', (_name, device) => {
      expect(directionsUrl('1 Main St', stops, device)).toContain('https://maps.apple.com/directions?');
    });

    it.each([
      ['an older iPad asking for the mobile site', iPad('18_3')],
      ['an older iPad asking for the desktop site', mobile(desktopSafari('18.3'))],
    ])('stays on Google Maps on %s', (_name, device) => {
      expect(directionsUrl('1 Main St', stops, device)).toContain('https://www.google.com/maps/dir/');
    });
  });

  it('stays on Google Maps on other devices', () => {
    const android = {
      userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
      maxTouchPoints: 5,
    };

    expect(directionsUrl('1 Main St', ['-33.1,151.1'], android)).toContain('https://www.google.com/maps/dir/');
  });
});

describe('saleLocation', () => {
  it('prefers coordinates and falls back to the address', () => {
    expect(saleLocation({ latitude: -33.1, longitude: 151.1, address: '1 Main St' })).toBe('-33.1,151.1');
    expect(saleLocation({ address: '1 Main St' })).toBe('1 Main St');
  });
});
