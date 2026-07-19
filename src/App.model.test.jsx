import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { StrictMode } from 'react';
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

  test('a round with training leaks no mock tensors', async () => {
    const rounds = Array.from({ length: 25 }, (_, i) => ({
      playerMove: 'Rock',
      aiMove: 'Paper',
      result: 'loss',
      timestamp: '10:00:00',
      id: i + 1,
    }));
    localStorage.setItem(
      'tiny-ml-game-data',
      JSON.stringify({ gameHistory: rounds, lastUpdated: Date.now() })
    );

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /play rock/i }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    // Prediction + training ran (non-vacuity guards)…
    expect(tf.tensor2d).toHaveBeenCalled();
    // …and every tensor created along the way was disposed.
    expect(tf.memory().numTensors).toBe(0);
  });

  test('overlapping rounds do not start a second training run', async () => {
    const rounds = Array.from({ length: 25 }, (_, i) => ({
      playerMove: 'Rock',
      aiMove: 'Paper',
      result: 'loss',
      timestamp: '10:00:00',
      id: i + 1,
    }));
    localStorage.setItem(
      'tiny-ml-game-data',
      JSON.stringify({ gameHistory: rounds, lastUpdated: Date.now() })
    );

    let resolveFit;
    const hangingFit = vi.fn(() => new Promise((resolve) => { resolveFit = resolve; }));
    const model = {
      predict: vi.fn(() => ({
        data: () => Promise.resolve(new Float32Array([0.33, 0.33, 0.34])),
        dispose: vi.fn(),
      })),
      fit: hangingFit,
      dispose: vi.fn(),
      save: vi.fn().mockResolvedValue({}),
    };
    tf.io.listModels.mockResolvedValue({ [MODEL_KEY]: {} });
    localStorage.setItem('tiny-ml-game-model-arch', 'dense');
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ exists: true, lastSaved: '2026-07-19T00:00:00.000Z', arch: 'dense' })
    );
    tf.loadLayersModel.mockResolvedValueOnce(model);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /play rock/i }));
    fireEvent.click(screen.getByRole('button', { name: /play scissors/i }));

    // Both 100ms training timers fire while the first fit is still pending;
    // only one fit may be in flight at a time.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(hangingFit).toHaveBeenCalledTimes(1);

    // Displayed accuracy must come from the validation split, not the
    // (optimistic) training accuracy.
    resolveFit({ history: { acc: [0.9], val_acc: [0.62] } });
    await waitFor(() => {
      expect(screen.getByText('62%')).toBeInTheDocument();
    });
  });

  test('StrictMode remount does not force-recreate the model', async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The saved model loads on both double-invoked mount effects; the arch
    // effect must not add a spurious forced re-create (which would build a
    // fresh network via tf.sequential and discard the loaded one).
    expect(tf.loadLayersModel).toHaveBeenCalled();
    expect(tf.sequential).not.toHaveBeenCalled();
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
