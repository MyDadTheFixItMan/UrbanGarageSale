/**
 * Google Places API Service
 * Provides address autocomplete and geocoding using Google Places API
 * Uses UrbanGarageSale backend functions to avoid CORS issues
 */

import { firebase } from './firebaseClient';

export const googlePlacesService = {
  /**
   * Get autocomplete suggestions via backend function
   */
  async autocomplete(input) {
    try {
      const response = await fetch('/api/googlePlacesAutocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'autocomplete',
          input: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        return data.predictions || [];
      } else if (data.status === 'INVALID_REQUEST') {
        console.warn('Invalid request to Places API:', data.error_message);
        return [];
      } else {
        throw new Error(`Places API error: ${data.status}`);
      }
    } catch (error) {
      console.error('Google Places autocomplete error:', error);
      throw error;
    }
  },

  /**
   * Get place details via backend function
   */
  async getPlaceDetails(placeId) {
    try {
      const response = await fetch('/api/googlePlacesAutocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'details',
          placeId: placeId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK') {
        return data.result;
      } else {
        throw new Error(`Places API error: ${data.status}`);
      }
    } catch (error) {
      console.error('Google Places details error:', error);
      throw error;
    }
  },

  /**
   * Extract address components from Google Place
   */
  parseAddressComponents(place) {
    const addressComponents = place.address_components || [];
    const result = {
      address: place.formatted_address || '',
      latitude: place.geometry?.location?.lat,
      longitude: place.geometry?.location?.lng,
      suburb: '',
      state: '',
      postcode: '',
    };

    addressComponents.forEach((component) => {
      const types = component.types || [];

      if (types.includes('locality')) {
        result.suburb = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        result.state = component.short_name; // e.g., 'NSW', 'VIC'
      }
      if (types.includes('postal_code')) {
        result.postcode = component.long_name;
      }
    });

    return result;
  },

  /**
   * Check if Google Places API is loaded (not needed anymore since using backend)
   */
  isLoaded() {
    return true; // Always true since we use backend
  },
};
