import { useEffect, useCallback } from 'react';

const STORAGE_KEY = 'tiny-ml-game-data';

export const useGameStorage = (gameHistory, setGameHistory) => {
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
    }
  }, [setGameHistory]);

  // Save data to localStorage whenever gameHistory changes
  useEffect(() => {
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