import { addressDetails, areaPoint, displayAddress, needsAreaPoint } from '@/lib/addressDetails';
import { geocode } from '@/lib/geocode';

jest.mock('@/lib/geocode', () => ({ geocode: jest.fn() }));

const oceanGrove = {
  components: [
    { short_name: 'Ocean Grove', types: ['locality'] },
    { short_name: 'VIC', types: ['administrative_area_level_1'] },
    { short_name: '3226', types: ['postal_code'] },
  ],
};

beforeEach(() => jest.clearAllMocks());

describe('addressDetails', () => {
  it('keeps what a picked suggestion already supplied, without a lookup', async () => {
    await expect(addressDetails('26 Seawind Place', { suburb: 'Ocean Grove', postcode: '3226', state: 'VIC' })).resolves.toEqual({ suburb: 'Ocean Grove', postcode: '3226', state: 'VIC' });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('reads them from a typed address that includes them, without a lookup', async () => {
    await expect(addressDetails('1 Main St, Geelong VIC 3220', { suburb: 'Geelong' })).resolves.toEqual({ suburb: 'Geelong', postcode: '3220', state: 'VIC' });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('looks them up for a typed address without them', async () => {
    geocode.mockResolvedValue(oceanGrove);

    await expect(addressDetails('26 Seawind Place Ocean Grove')).resolves.toEqual({ suburb: 'Ocean Grove', postcode: '3226', state: 'VIC' });
    expect(geocode).toHaveBeenCalledWith('26 Seawind Place Ocean Grove', { country: 'AU' });
  });

  it('leaves them blank when the address can\'t be found', async () => {
    geocode.mockResolvedValue(null);

    await expect(addressDetails('nowhere at all')).resolves.toEqual({ suburb: '', postcode: '', state: '' });
  });

  it('still saves when the lookup fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    geocode.mockRejectedValue(new Error('Google Maps did not respond'));

    await expect(addressDetails('26 Seawind Place')).resolves.toEqual({ suburb: '', postcode: '', state: '' });
    warn.mockRestore();
  });

  it('does no lookup without an address', async () => {
    await expect(addressDetails('  ')).resolves.toEqual({ suburb: '', postcode: '', state: '' });
    expect(geocode).not.toHaveBeenCalled();
  });
});

describe('displayAddress', () => {
  it('joins the street with the suburb, state and postcode', () => {
    expect(displayAddress({ address: '25 Moorabool Street', suburb: 'Geelong', state: 'VIC', postcode: '3220' }))
      .toBe('25 Moorabool Street, Geelong VIC 3220');
  });

  it('does not repeat a whole address saved on an older profile', () => {
    expect(displayAddress({ address: '1 Main St, Geelong VIC 3220', state: 'VIC', postcode: '3220' }))
      .toBe('1 Main St, Geelong VIC 3220');
  });

  it('copes with parts missing', () => {
    expect(displayAddress({ address: '26 Seawind Place Ocean Grove' })).toBe('26 Seawind Place Ocean Grove');
    expect(displayAddress({})).toBe('');
  });
});

describe('areaPoint', () => {
  it('rounds the address map point to about 1 km', async () => {
    geocode.mockResolvedValue({ lat: -38.256789, lng: 144.523456, components: [] });
    await expect(areaPoint('26 Seawind Place Ocean Grove')).resolves.toEqual({ area_lat: -38.26, area_lng: 144.52 });
  });

  it('is empty when the address is not found or the lookup fails', async () => {
    geocode.mockResolvedValueOnce(null);
    await expect(areaPoint('nowhere')).resolves.toEqual({ area_lat: null, area_lng: null });
    geocode.mockRejectedValueOnce(new Error('Google Maps did not respond'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(areaPoint('somewhere')).resolves.toEqual({ area_lat: null, area_lng: null });
    await expect(areaPoint('  ')).resolves.toEqual({ area_lat: null, area_lng: null });
  });
});

describe('needsAreaPoint', () => {
  it('is needed for a new or changed address, or one without an area yet', () => {
    expect(needsAreaPoint({ address: '1 Main St', area_lat: -38.1 })).toBe(false);
    expect(needsAreaPoint({ address: '1 Main St', area_lat: -38.1 }, '2 High St')).toBe(true);
    expect(needsAreaPoint({ address: '1 Main St' })).toBe(true);
    expect(needsAreaPoint({ address: '1 Main St', area_lat: null })).toBe(true);
    expect(needsAreaPoint({})).toBe(false);
    expect(needsAreaPoint(undefined, '1 Main St')).toBe(true);
  });
});
