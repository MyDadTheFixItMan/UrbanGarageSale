// src/setupTests.js
import '@testing-library/jest-dom';

// Activate jest mocks for modules - these reference the __mocks__ folder files
jest.mock('@/api/firebaseClient');
jest.mock('@/lib/query-client');
jest.mock('@/lib/AuthContext');

// Mock Image Optimization directly
jest.mock('@/lib/imageOptimization', () => ({
  compressImage: jest.fn().mockImplementation((file) => {
    // Only allow image files
    if (!file.type.startsWith('image/')) {
      return Promise.reject(new Error(`File type ${file.type} is not a valid image format`));
    }
    // Return a File object with proper properties for tests
    const compressedBlob = new Blob(['compressed'], { type: file.type });
    const compressedFile = new File([compressedBlob], file.name, { type: file.type });
    return Promise.resolve(compressedFile);
  }),
  getFileSizeDisplay: jest.fn(bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  MapPin: () => null,
  Calendar: () => null,
  Image: () => null,
  Upload: () => null,
  X: () => null,
  Loader2: () => null,
  ChevronLeft: () => null,
  Save: () => null,
  Send: () => null,
  DollarSign: () => null,
  Info: () => null,
  Plus: () => null,
  Heart: () => null,
  Share2: () => null,
  MapIcon: () => null,
  Search: () => null,
  Home: () => null,
  Settings: () => null,
  LogOut: () => null,
  Menu: () => null,
  Bell: () => null,
  BarChart3: () => null,
  TrendingUp: () => null,
  Users: () => null,
  FileText: () => null,
  AlertCircle: () => null,
  CheckCircle: () => null,
  MessageCircle: () => null,
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock global fetch
global.fetch = jest.fn().mockImplementation((url, options) => {
  // Check for missing required fields in checkout requests
  if (url.includes('/api/createStripeCheckout')) {
    const body = JSON.parse(options.body);
    if (!body.listingId || !body.amount || !body.currency || !body.email) {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Missing required fields' }),
        text: jest.fn().mockResolvedValue('Bad Request'),
      });
    }
  }
  
  // Handle email sending requests
  if (url.includes('/api/sendEmail')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        messageId: 'msg_123',
        status: 'sent',
      }),
      text: jest.fn().mockResolvedValue('success'),
    });
  }
  
  // Default success response
  return Promise.resolve({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      url: 'https://stripe.com/checkout/test',
      sessionId: 'cs_test_123',
    }),
    text: jest.fn().mockResolvedValue('success'),
  });
});

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
       args[0].includes('v7_relativeSplatPath'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

// Reset the listing counter between tests
beforeEach(() => {
  // Reset firebase mock counters
  jest.clearAllMocks();
  // The mock file tracks its own counter, so we need to reset it indirectly
  // by clearing and reimporting, but since it's already mocked this doesn't work
  // Instead, we'll handle this in the mock file setup
});

afterAll(() => {
  console.error = originalError;
});