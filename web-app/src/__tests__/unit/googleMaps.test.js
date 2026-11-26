// lib/googleMaps.js: the Maps script is added once, on first use, and a failed load can be retried.

let loadGoogleMaps;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  document.head.innerHTML = '';
  delete window.google;
  ({ loadGoogleMaps } = require('@/lib/googleMaps'));
});

afterEach(() => {
  jest.useRealTimers();
  delete window.google;
});

const scripts = () => document.head.querySelectorAll('script#google-maps-js');

test('adds the script once and resolves when Google calls back', async () => {
  const first = loadGoogleMaps();
  const second = loadGoogleMaps();
  expect(scripts()).toHaveLength(1);
  expect(scripts()[0].src).toContain('libraries=places');
  expect(scripts()[0].src).toContain('callback=__ugsGoogleMapsLoaded');

  window.google = { maps: { importLibrary: jest.fn() } };
  window.__ugsGoogleMapsLoaded();
  await expect(first).resolves.toBe(window.google.maps);
  await expect(second).resolves.toBe(window.google.maps);
  await expect(loadGoogleMaps()).resolves.toBe(window.google.maps);
  expect(scripts()).toHaveLength(1);
});

test('does not add the script when Maps is already on the page', async () => {
  window.google = { maps: { importLibrary: jest.fn() } };
  await expect(loadGoogleMaps()).resolves.toBe(window.google.maps);
  expect(scripts()).toHaveLength(0);
});

test('gives up after 10 seconds, and the next call tries again', async () => {
  const attempt = loadGoogleMaps();
  jest.advanceTimersByTime(10000);
  await expect(attempt).rejects.toThrow('Google Maps did not load');
  expect(scripts()).toHaveLength(0);

  loadGoogleMaps();
  expect(scripts()).toHaveLength(1);
});

test('a script that fails to download rejects', async () => {
  const attempt = loadGoogleMaps();
  scripts()[0].onerror(new Event('error'));
  await expect(attempt).rejects.toThrow('Google Maps did not load');
});
