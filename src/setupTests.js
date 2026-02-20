// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock TensorFlow.js for JSDOM environment
jest.mock('@tensorflow/tfjs');

// Suppress console errors from TensorFlow and model initialization during tests.
// These are expected in JSDOM since WebGL/WebAssembly aren't available.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('TensorFlow') ||
        args[0].includes('WebGL') ||
        args[0].includes('Error initializing model'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
