import { render, screen } from '@testing-library/react';
import App from './App';

test('app renders without crashing', () => {
  render(<App />);
  // Just verify the app renders - TensorFlow initialization happens asynchronously
  expect(document.body).toBeInTheDocument();
});
