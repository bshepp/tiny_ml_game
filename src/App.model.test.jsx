import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as tf from '@tensorflow/tfjs';
import App from './App';

const META_KEY = 'tiny-ml-game-model-meta';
const MODEL_KEY = 'indexeddb://tiny-ml-game-model';

describe('Model persistence and architecture identity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    tf.io.listModels.mockResolvedValue({});
  });

  test('skips loading a saved model trained with a different architecture', async () => {
    tf.io.listModels.mockResolvedValue({ [MODEL_KEY]: {} });
    localStorage.setItem('tiny-ml-game-model-arch', 'dense');
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ exists: true, lastSaved: '2026-07-18T00:00:00.000Z', arch: 'gru' })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    expect(tf.loadLayersModel).not.toHaveBeenCalled();
    expect(screen.getByText(/New model/i)).toBeInTheDocument();
  });

  test('loads the saved model when the architecture matches', async () => {
    tf.io.listModels.mockResolvedValue({ [MODEL_KEY]: {} });
    localStorage.setItem('tiny-ml-game-model-arch', 'dense');
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ exists: true, lastSaved: '2026-07-18T00:00:00.000Z', arch: 'dense' })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    expect(tf.loadLayersModel).toHaveBeenCalledWith(MODEL_KEY);
    expect(screen.getByText(/Loaded from storage/i)).toBeInTheDocument();
  });

  test('saving the model records the current architecture in metadata', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save model/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /save model/i }));

    await waitFor(() => {
      const meta = JSON.parse(localStorage.getItem(META_KEY));
      expect(meta.arch).toBe('dense');
    });
  });

  test('Reset AI Model discards the saved model', async () => {
    tf.io.listModels.mockResolvedValue({ [MODEL_KEY]: {} });
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ exists: true, lastSaved: '2026-07-18T00:00:00.000Z', arch: 'dense' })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset ai model/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /reset ai model/i }));

    await waitFor(() => {
      expect(tf.io.removeModel).toHaveBeenCalledWith(MODEL_KEY);
    });
    await waitFor(() => {
      expect(localStorage.getItem(META_KEY)).toBeNull();
    });
  });
});
