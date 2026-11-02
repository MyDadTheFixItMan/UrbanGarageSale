import { addressDetails, displayAddress } from '@/lib/addressDetails';
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
