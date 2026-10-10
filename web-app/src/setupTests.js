// src/setupTests.js
// Global test setup. Modules are NOT mocked globally: each test mocks only the boundary it
// needs (usually the Firebase SDK or the network), so tests run the app's real code.
import '@testing-library/jest-dom';

// jsdom has no matchMedia; some UI components query it.
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
