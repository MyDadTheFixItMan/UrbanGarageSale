const HANDYAPI_BASE_URL = 'https://data.melbourne.vic.gov.au/api/v2/catalog/datasets/street-addresses/exports/json';

export const handyApiService = {
  async autocomplete(searchText) {
    try {
      const response = await fetch(HANDYAPI_BASE_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`API error: ${response.status}`, response);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('API response:', data);
      
      // Filter data based on search text
      const query = searchText.toLowerCase();
      const results = Array.isArray(data) ? data.filter(item => {
        const suburb = (item.suburb || item.locality || '').toLowerCase();
        const postcode = (item.postcode || '').toString();
        return suburb.includes(query) || postcode.includes(query);
      }).slice(0, 10) : [];

      return results;
    } catch (error) {
      console.error('API autocomplete failed:', error);
      throw error;
    }
  },

  async validate(suburb, postcode) {
    try {
      const response = await fetch(HANDYAPI_BASE_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Validate: Total records in dataset:', Array.isArray(data) ? data.length : 'not an array');
      
      // Log first few items to see data structure
      if (Array.isArray(data) && data.length > 0) {
        console.log('Validate: First item sample:', data[0]);
      }
      
      // Debug: show all suburbs that contain the search term
      if (Array.isArray(data)) {
        const matchingSuburbs = data.filter(item =>
          (item.suburb || item.locality || '').toLowerCase().includes(suburb.toLowerCase())
        );
        console.log(`Validate: Found ${matchingSuburbs.length} suburbs matching "${suburb}"`);
        if (matchingSuburbs.length > 0) {
          console.log('Validate: First matching suburbs:', matchingSuburbs.slice(0, 3));
        }
      }
      
      const found = Array.isArray(data) ? data.find(item => {
        const itemSuburb = (item.suburb || item.locality || '').toLowerCase();
        const itemPostcode = String(item.postcode);
        const searchSuburb = suburb.toLowerCase();
        const searchPostcode = String(postcode);
        
        console.log(`Validate: Checking - "${itemSuburb}" === "${searchSuburb}" && "${itemPostcode}" === "${searchPostcode}"`);
        
        return itemSuburb === searchSuburb && itemPostcode === searchPostcode;
      }) : null;

      console.log(`Validate result: found=${!!found}, isValid=${!!found}`);
      return { isValid: !!found };
    } catch (error) {
      console.error('API validate failed:', error);
      throw error;
    }
  },

  async geocode(address) {
    try {
      const response = await fetch(HANDYAPI_BASE_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const query = address.toLowerCase();
      const found = Array.isArray(data) ? data.find(item =>
        (item.address || '').toLowerCase().includes(query)
      ) : null;

      if (found && found.latitude && found.longitude) {
        return {
          latitude: parseFloat(found.latitude),
          longitude: parseFloat(found.longitude),
        };
      }

      // Default to Melbourne if not found
      console.warn('Address not found in dataset. Using Melbourne coordinates.');
      return {
        latitude: -37.8136,
        longitude: 144.9631,
      };
    } catch (error) {
      console.error('API geocode failed:', error);
      throw error;
    }
  },
};
