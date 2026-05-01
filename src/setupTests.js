// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock TensorFlow.js for JSDOM environment
jest.mock('@tensorflow/tfjs');

// JSDOM doesn't implement matchMedia; the app uses it for theme detection.
// Use a plain function (not jest.fn) so jest.clearAllMocks() doesn't strip it.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Suppress console errors from TensorFlow and model initialization during tests.
// These are expected in JSDOM since WebGL/WebAssembly aren't available.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('TensorFlow') ||
        args[0].includes('WebGL') ||
        args[0].includes('Error initializing model') ||
        args[0].includes('Error checking for saved model'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
