import React, { useEffect, useRef, useState } from 'react';

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter address",
  className = "",
}) {
  const inputRef = useRef(null);
  const [predictions, setPredictions] = useState([]);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    initializeAutocomplete();
  }, []);

  const initializeAutocomplete = async () => {
    // Wait for Google Maps API to be available
    let attempts = 0;
    while (!window.google?.maps?.places?.AutocompleteService && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // @ts-ignore
    if (!window.google?.maps?.places?.AutocompleteService) {
      console.error('AutocompleteService not available');
      return;
    }

    try {
      console.log('Initializing Autocomplete Service...');
      
      // @ts-ignore
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      
      // Create a hidden map for PlacesService
      // @ts-ignore
      mapRef.current = new window.google.maps.Map(document.createElement('div'));
      // @ts-ignore
      placesServiceRef.current = new window.google.maps.places.PlacesService(mapRef.current);

      console.log('Autocomplete Service initialized');
    } catch (error) {
      console.error('Failed to initialize Autocomplete Service:', error);
    }
  };

  const handleInputChange = async (e) => {
    const value = e.target.value;
    onChange?.(value);

    if (!value || value.length < 2) {
      setPredictions([]);
      return;
    }

    if (!autocompleteServiceRef.current) return;

    try {
      // @ts-ignore
      const result = await autocompleteServiceRef.current.getPlacePredictions({
        input: value,
        componentRestrictions: { country: ['AU', 'NZ'] },
        types: ['address'],
      });

      console.log('Predictions:', result.predictions);
      setPredictions(result.predictions || []);
    } catch (error) {
      console.error('Error getting predictions:', error);
    }
  };

  const handleSelectPrediction = (prediction) => {
    if (!placesServiceRef.current) return;

    console.log('Selected prediction:', prediction);

    // @ts-ignore
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
      },
      (place, status) => {
        // @ts-ignore
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          console.log('Place details:', place);
          handlePlaceSelected(place);
          setPredictions([]);
          if (inputRef.current) {
            inputRef.current.value = place.formatted_address || '';
          }
        } else {
          console.error('Places Service error:', status);
        }
      }
    );
  };

  const handlePlaceSelected = (place) => {
    let streetNumber = '';
    let streetName = '';
    let suburb = '';
    let state = '';
    let postcode = '';

    const addressComponents = place.address_components || [];
    console.log('Address components:', addressComponents);

    addressComponents.forEach((component) => {
      const types = component.types || [];
      const longName = component.long_name || '';
      const shortName = component.short_name || '';

      if (types.includes('street_number')) {
        streetNumber = longName;
      }
      if (types.includes('route')) {
        streetName = longName;
      }
      if (types.includes('locality')) {
        suburb = longName;
      }
      if (types.includes('administrative_area_level_1')) {
        state = shortName;
      }
      if (types.includes('postal_code')) {
        postcode = longName;
      }
    });

    // Fallback: If state or postcode not found, extract from formatted_address
    // Australian format: "Address, Suburb STATE POSTCODE, Country"
    if ((!state || !postcode) && place.formatted_address) {
      const formatted = place.formatted_address;
      console.log('Fallback parsing from formatted_address:', formatted);
      
      // Try to extract state (2 letter code) and postcode (4 digits) using one pattern
      // Looks for "STATE POSTCODE" pattern like "VIC 3226"
      if (!state || !postcode) {
        const statePostcodeMatch = formatted.match(/\b([A-Z]{2})\s+(\d{4})\b/);
        if (statePostcodeMatch) {
          state = statePostcodeMatch[1];
          postcode = statePostcodeMatch[2];
          console.log('Extracted state:', state, 'postcode:', postcode);
        }
      }
    }

    const address = `${streetNumber} ${streetName}`.trim() || place.formatted_address;

    const result = {
      address,
      latitude: place.geometry?.location?.lat?.(),
      longitude: place.geometry?.location?.lng?.(),
      suburb,
      state,
      postcode,
      place_id: place.place_id,
    };

    console.log('Final result with fallback:', result);

    onChange?.(address);
    onSelect?.(result);
  };

  return (
    <div className={className}>
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          onChange={handleInputChange}
          style={{
            width: '100%',
            border: '1px solid #e5e7eb',
            borderRadius: '0.375rem',
            padding: '8px',
            fontFamily: 'inherit',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
        
        {predictions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderTop: 'none',
              borderRadius: '0 0 0.375rem 0.375rem',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            {predictions.map((prediction, index) => (
              <div
                key={index}
                onClick={() => handleSelectPrediction(prediction)}
                style={{
                  padding: '10px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                {prediction.description}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
