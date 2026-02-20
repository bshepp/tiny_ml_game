# CLAUDE.md

Development guide for the Rock Paper Scissors ML game.

## Commands

```bash
npm start       # Dev server at localhost:3000
npm test        # Jest tests (TF.js mocked for JSDOM)
npm run build   # Production build
npm run deploy  # Deploy to GitHub Pages
```

## Architecture

Single-page React app. No routing, no backend. All game logic, ML, and UI live in `src/App.js`.

### Key Files

- **App.js** — Main component: neural network model, game state, AI strategies, UI rendering
- **hooks/useGameStorage.js** — localStorage persistence for game history
- **hooks/useModelStorage.js** — IndexedDB persistence for trained TF.js model
- **\_\_mocks\_\_/@tensorflow/tfjs.js** — Full TF.js mock for Jest/JSDOM tests

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

Training: After each game in "learning" strategy, trains on last 10 games with 20% validation split.

### State Flow

1. `initializeModel()` runs on mount — tries to load saved model from IndexedDB, falls back to creating new one
2. `useGameStorage` loads saved game history from localStorage
3. Player clicks move → `handlePlayerMove()`
4. AI strategy calculates response (switch on `aiStrategy`)
5. Result added to `gameHistory` (capped at 50)
6. If "learning" mode: `trainModel()` runs async after 100ms delay
7. Stats recompute via `useMemo`
8. History auto-saves to localStorage
9. Model auto-saves to IndexedDB every 10 games

### Error Handling

If model initialization fails, the app:
- Displays an inline error banner with a Retry button
- Falls back to "random" strategy
- Disables the "learning" strategy option (shows "model unavailable")
- Keeps the game fully playable with non-ML strategies

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

### Move Data

Moves are defined as two constants:
```javascript
const MOVE_NAMES = ['Rock', 'Paper', 'Scissors'];
const MOVE_EMOJI = { Rock: '🗿', Paper: '📄', Scissors: '✂️' };
```

### Tailwind Note

Dynamic class names like `bg-${color}-50` don't work with Tailwind JIT. Use static class mappings instead (see `colorStyles` object in App.js).

## Testing

TensorFlow.js is mocked in `src/__mocks__/@tensorflow/tfjs.js` for Jest/JSDOM compatibility. The mock provides stub implementations for all TF.js APIs used in the app.

Key test behaviors:
- Model initialization fails in JSDOM (expected) — tests verify graceful degradation
- Tests use `fireEvent` (not `userEvent.setup()` — project uses @testing-library/user-event v13)
- Console errors for TF.js and model initialization are suppressed in `setupTests.js`

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
  saveModel,       // Save current model to IndexedDB
  loadModel,       // Load saved model (returns null if none)
  deleteModel,     // Delete saved model
  isSaving,        // Boolean: save in progress
  isLoadingModel,  // Boolean: load in progress
  hasSavedModel,   // Boolean: saved model exists
  lastSaved        // ISO timestamp of last save
} = useModelStorage();
```

## Known Limitations

- Training is synchronous and can briefly block UI on slower devices
- All game logic lives in App.js (~600 lines) — could benefit from decomposition
- TF.js model initialization has a CJS/ESM interop issue in JSDOM that causes fallback to non-ML mode in tests

## Adding Features

**New AI strategy:**
1. Add to `strategyDescriptions` object
2. Add case in `handlePlayerMove()` switch

**Modify network architecture:**
1. Update `createAdvancedModel()`
2. Adjust `encodeGameSequence()` if input shape changes
3. Update input shape constant (currently `[15]`)
