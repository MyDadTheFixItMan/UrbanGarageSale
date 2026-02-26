// src/__tests__/mocks/firebase.js
export const mockFirebase = {
  auth: {
    isAuthenticated: jest.fn().mockResolvedValue(true),
    me: jest.fn().mockResolvedValue({
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    }),
    login: jest.fn().mockResolvedValue({ email: 'test@example.com' }),
    logout: jest.fn().mockResolvedValue(null),
  },
  entities: {
    GarageSale: {
      create: jest.fn().mockResolvedValue({ id: 'listing-123' }),
      update: jest.fn().mockResolvedValue({ id: 'listing-123' }),
      filter: jest.fn().mockResolvedValue([
        {
          id: 'listing-123',
          title: 'Test Garage Sale',
          address: '123 Main St',
          suburb: 'Springfield',
          postcode: '3000',
          sale_type: 'garage_sale',
          start_date: '2026-02-26',
          end_date: '2026-02-27',
          start_time: '08:00',
          end_time: '15:00',
          photos: [],
          description: 'Test listing',
        },
      ]),
      delete: jest.fn().mockResolvedValue(null),
    },
    SavedListing: {
      create: jest.fn().mockResolvedValue({ id: 'saved-123' }),
      filter: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(null),
    },
  },
  storage: {
    uploadImage: jest.fn().mockResolvedValue(
      'https://example.com/image.jpg'
    ),
    deleteImage: jest.fn().mockResolvedValue(null),
  },
  firestore: {
    collection: jest.fn().mockReturnValue({
      getDocs: jest.fn().mockResolvedValue([
        {
          id: 'promo-1',
          message: 'Welcome to Urban Garage Sales!',
          sequence: 1,
        },
      ]),
    }),
  },
};

jest.mock('@/api/firebaseClient', () => ({
  firebase: mockFirebase,
}));
