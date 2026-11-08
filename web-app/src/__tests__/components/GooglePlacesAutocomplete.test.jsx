import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete';

const getPlacePredictions = jest.fn();
const getDetails = jest.fn();
let tokensMade = 0;

beforeEach(() => {
  jest.useFakeTimers();
  getPlacePredictions.mockReset().mockResolvedValue({
    predictions: [{ place_id: 'p1', description: '1 Main St, Geelong VIC' }],
  });
  getDetails.mockReset();
  tokensMade = 0;
  window.google = {
    maps: {
      Map: function Map() {},
      places: {
        AutocompleteService: function AutocompleteService() { return { getPlacePredictions }; },
        PlacesService: function PlacesService() { return { getDetails }; },
        AutocompleteSessionToken: function AutocompleteSessionToken() { this.n = ++tokensMade; },
        PlacesServiceStatus: { OK: 'OK' },
      },
    },
  };
});

afterEach(() => {
  jest.useRealTimers();
  delete window.google;
});

async function renderReady(props = {}) {
  render(<GooglePlacesAutocomplete aria-label="Address" {...props} />);
  await act(async () => {}); // let the service set itself up
  return screen.getByLabelText('Address');
}

async function type(input, value) {
  fireEvent.change(input, { target: { value } });
}

describe('GooglePlacesAutocomplete', () => {
  it('looks up suggestions once the seller pauses typing, not on every keystroke', async () => {
    const input = await renderReady();
    await type(input, '1 M');
    await type(input, '1 Ma');
    await type(input, '1 Mai');
    expect(getPlacePredictions).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(300); });
    expect(getPlacePredictions).toHaveBeenCalledTimes(1);
    expect(getPlacePredictions.mock.calls[0][0].input).toBe('1 Mai');
    expect(await screen.findByText('1 Main St, Geelong VIC')).toBeInTheDocument();
  });

  it('bills the suggestions and the chosen address as one session, then starts a new one', async () => {
    getDetails.mockImplementation((request, callback) => callback({
      formatted_address: '1 Main St, Geelong VIC 3220, Australia',
      address_components: [],
      place_id: 'p1',
    }, 'OK'));
    const onSelect = jest.fn();
    const input = await renderReady({ onSelect });

    await type(input, '1 Ma');
    await act(async () => { jest.advanceTimersByTime(300); });
    await type(input, '1 Main');
    await act(async () => { jest.advanceTimersByTime(300); });
    fireEvent.click(await screen.findByText('1 Main St, Geelong VIC'));

    const firstToken = getPlacePredictions.mock.calls[0][0].sessionToken;
    expect(firstToken).toBeDefined();
    expect(getPlacePredictions.mock.calls[1][0].sessionToken).toBe(firstToken);
    expect(getDetails.mock.calls[0][0].sessionToken).toBe(firstToken);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ state: 'VIC', postcode: '3220' }));

    await type(input, '2 Hi');
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(getPlacePredictions.mock.calls[2][0].sessionToken).not.toBe(firstToken);
  });

  it('clears suggestions without a lookup when the address is too short', async () => {
    const input = await renderReady();
    await type(input, '1');
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(getPlacePredictions).not.toHaveBeenCalled();
  });
});
