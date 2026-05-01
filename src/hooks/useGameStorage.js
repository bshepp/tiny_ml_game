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
  // Track whether we've completed the initial load. Without this, the
  // "save on change" effect would fire on mount with the empty default
  // state and overwrite any persisted history before the load effect runs.
  const hasLoadedRef = useRef(false);
  const storageOkRef = useRef(isStorageAvailable());

  // Load data from localStorage on mount
  useEffect(() => {
    if (!storageOkRef.current) {
      hasLoadedRef.current = true;
      return;
    }
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
    } finally {
      hasLoadedRef.current = true;
    }
  }, [setGameHistory]);

  // Save data to localStorage whenever gameHistory changes (after initial load)
  useEffect(() => {
    if (!hasLoadedRef.current || !storageOkRef.current) return;
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
