import { useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';

const MODEL_STORAGE_KEY = 'indexeddb://tiny-ml-game-model';
const MODEL_META_KEY = 'tiny-ml-game-model-meta';

/**
 * Hook for persisting and loading TensorFlow.js models using IndexedDB
 */
export const useModelStorage = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [lastSaved, setLastSaved] = useState(() => {
    try {
      const meta = localStorage.getItem(MODEL_META_KEY);
      return meta ? JSON.parse(meta).lastSaved : null;
    } catch {
      return null;
    }
  });
  const [hasSavedModel, setHasSavedModel] = useState(() => {
    try {
      const meta = localStorage.getItem(MODEL_META_KEY);
      return meta ? JSON.parse(meta).exists : false;
    } catch {
      return false;
    }
  });

  /**
   * Save the current model to IndexedDB
   */
  const saveModel = useCallback(async (model) => {
    if (!model || isSaving) return false;

    setIsSaving(true);
    try {
      await model.save(MODEL_STORAGE_KEY);
      
      const now = new Date().toISOString();
      const meta = { exists: true, lastSaved: now };
      localStorage.setItem(MODEL_META_KEY, JSON.stringify(meta));
      
      setLastSaved(now);
      setHasSavedModel(true);
      
      console.log('Model saved successfully to IndexedDB');
      return true;
    } catch (error) {
      console.error('Error saving model:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving]);

  /**
   * Load a previously saved model from IndexedDB
   * Returns the loaded model or null if no model exists
   */
  const loadModel = useCallback(async () => {
    setIsLoadingModel(true);
    try {
      const model = await tf.loadLayersModel(MODEL_STORAGE_KEY);
      console.log('Model loaded successfully from IndexedDB');
      return model;
    } catch (error) {
      // Model doesn't exist yet - this is expected on first run
      if (error.message?.includes('not found') || error.message?.includes('Cannot find')) {
        console.log('No saved model found, will create new one');
      } else {
        console.error('Error loading model:', error);
      }
      
      // Clear stale metadata
      localStorage.removeItem(MODEL_META_KEY);
      setHasSavedModel(false);
      setLastSaved(null);
      
      return null;
    } finally {
      setIsLoadingModel(false);
    }
  }, []);

  /**
   * Delete the saved model from IndexedDB
   */
  const deleteModel = useCallback(async () => {
    try {
      // TensorFlow.js provides a way to delete models from IndexedDB
      const models = await tf.io.listModels();
      const modelKey = MODEL_STORAGE_KEY;
      
      if (models[modelKey]) {
        await tf.io.removeModel(modelKey);
      }
      
      localStorage.removeItem(MODEL_META_KEY);
      setHasSavedModel(false);
      setLastSaved(null);
      
      console.log('Saved model deleted');
      return true;
    } catch (error) {
      console.error('Error deleting model:', error);
      return false;
    }
  }, []);

  /**
   * Check if a saved model exists
   */
  const checkModelExists = useCallback(async () => {
    try {
      const models = await tf.io.listModels();
      const exists = !!models[MODEL_STORAGE_KEY];
      setHasSavedModel(exists);
      
      if (!exists) {
        localStorage.removeItem(MODEL_META_KEY);
        setLastSaved(null);
      }
      
      return exists;
    } catch (error) {
      console.error('Error checking for saved model:', error);
      return false;
    }
  }, []);

  return {
    saveModel,
    loadModel,
    deleteModel,
    checkModelExists,
    isSaving,
    isLoadingModel,
    hasSavedModel,
    lastSaved,
  };
};

