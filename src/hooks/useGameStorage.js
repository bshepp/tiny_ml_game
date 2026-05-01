import { useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'tiny-ml-game-data';

export const useGameStorage = (gameHistory, setGameHistory) => {
  // Track whether we've completed the initial load. Without this, the
  // "save on change" effect would fire on mount with the empty default
  // state and overwrite any persisted history before the load effect runs.
  const hasLoadedRef = useRef(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
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
    if (!hasLoadedRef.current) return;
    try {
      const dataToSave = {
        gameHistory,
        lastUpdated: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving game data:', error);
    }
  }, [gameHistory]);

  // Clear saved data
  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setGameHistory([]);
    } catch (error) {
      console.error('Error clearing game data:', error);
    }
  }, [setGameHistory]);

  return { clearStorage };
};