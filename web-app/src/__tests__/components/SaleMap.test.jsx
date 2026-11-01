import React from 'react';
import { render } from '@testing-library/react';
import SaleMap from '@/components/map/SaleMap';

const mockMap = { fitBounds: jest.fn(), setView: jest.fn() };

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  useMap: () => mockMap,
}));

const start_date = '2026-11-07';
const sales = [
  { id: 'a', latitude: -38.1, longitude: 144.3, start_date },
  { id: 'b', latitude: -38.2, longitude: 144.5, start_date },
  { id: 'no-location', start_date },
];
const renderMap = (props) => render(<SaleMap {...props} />);

beforeEach(() => jest.clearAllMocks());

describe('SaleMap', () => {
  it('frames every pin when no location is given', () => {
    renderMap({ sales });

    expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(mockMap.fitBounds.mock.calls[0][0]).toEqual([[-38.1, 144.3], [-38.2, 144.5]]);
  });

  it('keeps the viewer\'s position when a page redraws with the same listings', () => {
    const { rerender } = renderMap({ sales });

    rerender(<SaleMap sales={[...sales]} />);

    expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('frames the pins again after a new search', () => {
    const { rerender } = renderMap({ sales });

    rerender(<SaleMap sales={[{ id: 'c', latitude: -37.8, longitude: 144.9, start_date }]} />);

    expect(mockMap.fitBounds).toHaveBeenCalledTimes(2);
    expect(mockMap.fitBounds.mock.calls[1][0]).toEqual([[-37.8, 144.9]]);
  });

  it('has nothing to frame when no listing has a location', () => {
    renderMap({ sales: [{ id: 'no-location', start_date }] });

    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });

  it('stays on the location it was given', () => {
    renderMap({ sales, center: [-38.1, 144.3], zoom: 15 });

    expect(mockMap.setView).toHaveBeenCalledWith([-38.1, 144.3], 15);
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });
});
