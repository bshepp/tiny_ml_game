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

## Known Limitations

- TensorFlow.js can't run in JSDOM, so ML tests require browser environment
- Model is not persisted - resets on page refresh (only game history is saved)
- Training is synchronous and can briefly block UI on slower devices

## Adding Features

**New AI strategy:**
1. Add to `strategyDescriptions` object
2. Add case in `handlePlayerMove()` switch

**Modify network architecture:**
1. Update `createAdvancedModel()`
2. Adjust `encodeGameSequence()` if input shape changes
3. Update input shape constant (currently `[15]`)
