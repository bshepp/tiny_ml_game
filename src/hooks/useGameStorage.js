import { useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'tiny-ml-game-data';

const isStorageAvailable = () => {
  try {
    const testKey = '__tiny_ml_game_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

export const useGameStorage = (gameHistory, setGameHistory) => {
  // The save effect must not run until state has diverged from the caller's
  // initial value. A boolean "loaded" flag is not enough: both mount effects
  // run in the same commit, so a flag set by the load effect is already true
  // when the save effect fires with the still-empty initial state — and under
  // StrictMode's double-invoked effects that overwrites real persisted
  // history with []. Reference equality against the initial value is immune
  // to effect ordering.
  const initialHistoryRef = useRef(gameHistory);
  const storageOkRef = useRef(null);
  if (storageOkRef.current === null) {
    storageOkRef.current = isStorageAvailable();
  }

  // Load data from localStorage on mount
  useEffect(() => {
    if (!storageOkRef.current) return;
    try {
      const savedData = window.localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.gameHistory && Array.isArray(parsedData.gameHistory)) {
          setGameHistory(parsedData.gameHistory);
        }
      }
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  }, [setGameHistory]);

  // Save data to localStorage whenever gameHistory changes (after initial load)
  useEffect(() => {
    if (gameHistory === initialHistoryRef.current || !storageOkRef.current) return;
    try {
      const dataToSave = {
        gameHistory,
        lastUpdated: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      // Silently swallow QuotaExceededError / Safari private-mode SecurityError.
      if (error?.name !== 'QuotaExceededError' && error?.name !== 'SecurityError') {
        console.error('Error saving game data:', error);
      }
    }
  }, [gameHistory]);

  // Clear saved data
  const clearStorage = useCallback(() => {
    try {
      if (storageOkRef.current) window.localStorage.removeItem(STORAGE_KEY);
      setGameHistory([]);
    } catch (error) {
      console.error('Error clearing game data:', error);
    }
  }, [setGameHistory]);

  return { clearStorage };
};
