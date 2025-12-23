# CLAUDE.md

Development guide for the Rock Paper Scissors ML game.

## Commands

```bash
npm start      # Dev server at localhost:3000
npm test       # Jest tests (TensorFlow.js tests fail in JSDOM)
npm run build  # Production build
```

## Architecture

Single-page React app. All game logic in `src/App.js`.

### Key Components

**App.js** - Main component containing:
- Neural network model (TensorFlow.js sequential model)
- Game state management (useState hooks)
- AI strategy implementations
- UI rendering

**hooks/useGameStorage.js** - localStorage persistence for game history

### Neural Network

```
Input: 15 features (5 recent games × 3 values each)
       - player move (0-1 normalized)
       - AI move (0-1 normalized)  
       - result (0-1 normalized)

Hidden: Dense(128, relu, L2, dropout 0.3)
        Dense(64, relu, L2, dropout 0.2)
        Dense(32, relu)

Output: Dense(3, softmax) → probability for Rock/Paper/Scissors
```

Training: After each game when using "learning" strategy, trains on last 10 games with 20% validation split.

### State Flow

1. `initializeModel()` runs on mount, creates TensorFlow model
2. `useGameStorage` loads saved game history from localStorage
3. Player clicks move → `handlePlayerMove()`
4. AI strategy calculates response
5. Result added to `gameHistory`
6. If "learning" mode: `trainModel()` runs async
7. Stats recompute via `useMemo`
8. History auto-saves to localStorage

### Memory Management

TensorFlow.js tensors must be manually disposed. Pattern used:

```javascript
let tensor = null;
try {
  tensor = tf.tensor2d(...);
  // use tensor
} finally {
  if (tensor) tensor.dispose();
}
```

### Tailwind Note

Dynamic class names like `bg-${color}-50` don't work with Tailwind JIT. Use static class mappings instead (see `colorStyles` object in App.js).

## Testing

TensorFlow.js is mocked in `src/__mocks__/@tensorflow/tfjs.js` for Jest/JSDOM compatibility. The mock provides stub implementations for all TF.js APIs used in the app, allowing component tests to run without WebGL/WebAssembly.

## Model Persistence

The trained neural network model is saved to IndexedDB using TensorFlow.js's built-in model saving:

- **Auto-save**: Model auto-saves every 10 games when using "learning" strategy
- **Manual save**: "Save Model" button in the UI
- **Load on startup**: Automatically loads saved model if available
- **Storage location**: IndexedDB (`indexeddb://tiny-ml-game-model`)
- **Metadata**: Model metadata stored in localStorage (`tiny-ml-game-model-meta`)

### useModelStorage Hook

```javascript
const { 
  saveModel,      // Save current model to IndexedDB
  loadModel,      // Load saved model (returns null if none)
  deleteModel,    // Delete saved model
  isSaving,       // Boolean: save in progress
  isLoadingModel, // Boolean: load in progress  
  hasSavedModel,  // Boolean: saved model exists
  lastSaved       // ISO timestamp of last save
} = useModelStorage();
```

## Known Limitations

- Training is synchronous and can briefly block UI on slower devices

## Adding Features

**New AI strategy:**
1. Add to `strategyDescriptions` object
2. Add case in `handlePlayerMove()` switch

**Modify network architecture:**
1. Update `createAdvancedModel()`
2. Adjust `encodeGameSequence()` if input shape changes
3. Update input shape constant (currently `[15]`)
