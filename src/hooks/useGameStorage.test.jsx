import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { useGameStorage } from './useGameStorage';

const STORAGE_KEY = 'tiny-ml-game-data';

const useHost = () => {
  const [history, setHistory] = useState([]);
  useGameStorage(history, setHistory);
  return history;
};

const rounds = [
  { playerMove: 'Rock', aiMove: 'Paper', result: 'loss', timestamp: '10:00:00', id: 1 },
  { playerMove: 'Paper', aiMove: 'Rock', result: 'win', timestamp: '10:01:00', id: 2 },
];

describe('useGameStorage load/save ordering', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('does not destroy persisted history on mount under StrictMode', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ gameHistory: rounds, lastUpdated: 1 }));

    const { result } = renderHook(useHost, { wrapper: StrictMode });

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
    });
    // The persisted copy must survive the double-invoked mount effects.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.gameHistory).toHaveLength(2);
  });

  test('does not write an empty record on mount when nothing was saved', async () => {
    renderHook(useHost, { wrapper: StrictMode });

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
