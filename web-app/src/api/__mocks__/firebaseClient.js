// src/api/__mocks__/firebaseClient.js

// Use a module-level counter for creating unique IDs per test
let listingCreateCounter = 0;

// Export reset function to be called in test setup
export const __resetMocks = () => {
  listingCreateCounter = 0;
};

export const firebase = {
  auth: {
    isAuthenticated: jest.fn().mockResolvedValue(true),
    me: jest.fn().mockResolvedValue({ 
      id: 'user_123',
      uid: 'user_123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user'
    }),
    login: jest.fn().mockResolvedValue({ 
      id: 'user_123', 
      email: 'user@example.com',
      name: 'Test User',
      role: 'user'
    }),
    logout: jest.fn().mockResolvedValue(true),
  },
  entities: {
    GarageSale: {
      create: jest.fn().mockImplementation((data) => {
        listingCreateCounter += 1;
        return Promise.resolve({ 
          id: `listing_${122 + listingCreateCounter}`,  // Start at listing_123
          createdBy: 'user@example.com',
          status: 'pending',  // New listings should be pending for approval
          title: data.title || 'Test Listing',
          description: data.description || 'Test Description',
          address: data.address || '123 Main St',
          suburb: data.suburb || 'Kew',
          postcode: data.postcode || '3101',
          state: data.state || 'VIC',
          startDate: data.startDate || '2026-03-01',
          endDate: data.endDate || '2026-03-02',
          startTime: data.startTime || '08:00',
          endTime: data.endTime || '15:00',
          saleType: data.saleType || data.sale_type || 'garage_sale',
          photos: data.photos || [],
          ...data,
        });
      }),
      get: jest.fn().mockResolvedValue({ 
        id: 'listing_123',
        title: 'Test Listing',
        description: 'Test Description',
        address: '123 Main St',
        suburb: 'Kew',
        postcode: '3101',
        state: 'VIC',
        startDate: '2026-03-01',
        endDate: '2026-03-02',
        startTime: '08:00',
        endTime: '15:00',
        saleType: 'garage_sale',
        status: 'active',
        createdBy: 'user@example.com',
        photos: [],
      }),
      filter: jest.fn().mockImplementation((filters) => {
        const allListings = [
          { 
            id: 'listing_1', 
            title: 'Sale 1',
            description: 'Vintage furniture and books',
            status: 'active',
            suburb: 'Kew',
            startDate: '2026-03-01',
            endDate: '2026-03-02',
            createdBy: 'user@example.com',
            saleType: 'garage_sale',
          },
          { 
            id: 'listing_2', 
            title: 'Sale 2', 
            description: 'Household items and clothing',
            status: 'active',
            suburb: 'Kew',
            startDate: '2026-03-01',
            endDate: '2026-03-02',
            createdBy: 'user@example.com',
            saleType: 'garage_sale',
          },
          { 
            id: 'listing_3', 
            title: 'Estate Sale',
            description: 'Estate items',
            status: 'active',
            suburb: 'Carlton',
            startDate: '2026-03-01',
            endDate: '2026-03-02',
            createdBy: 'user@example.com',
            saleType: 'estate_sale',
          },
        ];
        
        // Filter by saleType if specified
        if (filters.saleType) {
          return Promise.resolve(
            allListings.filter(l => l.saleType === filters.saleType)
          );
        }
        
        // Filter by suburb if specified
        if (filters.suburb) {
          return Promise.resolve(
            allListings.filter(l => l.suburb === filters.suburb)
          );
        }
        
        // Return all if no filters
        return Promise.resolve(allListings);
      }),
      update: jest.fn().mockImplementation((id, data) =>
        Promise.resolve({ id, ...data })
      ),
      delete: jest.fn().mockResolvedValue(true),
    },
    SavedListing: {
      create: jest.fn().mockResolvedValue({ 
        id: 'saved_123',
        userId: 'user_123',
        saleId: 'listing_456',
        savedAt: new Date(),
      }),
      get: jest.fn().mockResolvedValue({ 
        id: 'saved_123',
        userId: 'user_123',
        saleId: 'listing_456',
        savedAt: new Date(),
      }),
      filter: jest.fn().mockImplementation((filters) => {
        // Return mock saved listings
        if (filters.userId) {
          return Promise.resolve([
            {
              id: 'saved_1',
              userId: filters.userId,
              saleId: 'listing_1',
              listingId: 'listing_1',
              savedAt: new Date(),
            },
            {
              id: 'saved_2',
              userId: filters.userId,
              saleId: 'listing_2',
              listingId: 'listing_2',
              savedAt: new Date(),
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      delete: jest.fn().mockResolvedValue(true),
    },
    Payment: {
      create: jest.fn().mockImplementation((data) => Promise.resolve({
        id: 'payment_123',
        ...data,  // Preserve original data like listingId, buyerEmail, etc
      })),
      get: jest.fn().mockImplementation((id) => {
        // Return null for invalid IDs
        if (id === 'payment_invalid') {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: 'payment_123',
          saleId: 'listing_456',
          amount: 10.00,
          status: 'completed',
          createdAt: new Date(),
        });
      }),
      filter: jest.fn().mockResolvedValue([]),
    },
    EmailLog: {
      create: jest.fn().mockResolvedValue({ 
        id: 'email_log_123',
        to: 'user@example.com',
        template: 'payment_confirmation',
        status: 'delivered',
        sentAt: new Date(),
      }),
    },
    AppSettings: {
      get: jest.fn().mockResolvedValue({
        isActive: true,
        freeListingStart: '2026-03-01',
        freeListingEnd: '2026-03-31',
      }),
    },
  },
  storage: {
    uploadImage: jest.fn().mockResolvedValue('https://example.com/image.jpg'),
    deleteImage: jest.fn().mockResolvedValue(true),
  },
  firestore: {
    collection: jest.fn(() => ({
      getDocs: jest.fn().mockResolvedValue({ 
        docs: [],
        empty: true,
      }),
    })),
  },
  functions: {
    invoke: jest.fn().mockResolvedValue({
      url: 'https://stripe.com/checkout/test',
      sessionId: 'cs_test_123',
    }),
  },};