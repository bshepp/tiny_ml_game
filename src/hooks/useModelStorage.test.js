import { renderHook, act } from '@testing-library/react';
import * as tf from '@tensorflow/tfjs';
import { useModelStorage } from './useModelStorage';

const META_KEY = 'tiny-ml-game-model-meta';

describe('useModelStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('double-saving does not start a second model.save', async () => {
    let resolveSave;
    const model = { save: vi.fn(() => new Promise((resolve) => { resolveSave = resolve; })) };
    const { result } = renderHook(() => useModelStorage());

    let p1;
    let p2;
    act(() => {
      p1 = result.current.saveModel(model, 'dense');
      p2 = result.current.saveModel(model, 'dense');
    });
    expect(model.save).toHaveBeenCalledTimes(1);

    resolveSave({});
    await act(async () => {
      await p1;
      await p2;
    });
  });

  test('transient load errors keep the saved-model metadata', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ exists: true, lastSaved: '2026-07-19T00:00:00.000Z', arch: 'dense' })
    );
    tf.loadLayersModel.mockRejectedValueOnce(new Error('database temporarily unavailable'));

    const { result } = renderHook(() => useModelStorage());
    let loaded;
    await act(async () => {
      loaded = await result.current.loadModel('dense');
    });

    expect(loaded).toBeNull();
    // A transient failure is not proof the model is gone.
    expect(localStorage.getItem(META_KEY)).not.toBeNull();
    expect(result.current.hasSavedModel).toBe(true);
    spy.mockRestore();
  });

  test('a genuinely missing model still clears stale metadata', async () => {
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ exists: true, lastSaved: '2026-07-19T00:00:00.000Z', arch: 'dense' })
    );
    tf.loadLayersModel.mockRejectedValueOnce(new Error('Cannot find model with path indexeddb://tiny-ml-game-model'));

    const { result } = renderHook(() => useModelStorage());
    let loaded;
    await act(async () => {
      loaded = await result.current.loadModel('dense');
    });

    expect(loaded).toBeNull();
    expect(localStorage.getItem(META_KEY)).toBeNull();
    expect(result.current.hasSavedModel).toBe(false);
  });
});
