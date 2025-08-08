# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a sophisticated Rock Paper Scissors game built with React 19.0.0 and TensorFlow.js 4.22.0. The application features multiple AI strategies including a neural network that learns player patterns in real-time. The project uses modern React patterns with hooks, Tailwind CSS for styling, and localStorage for data persistence.

## Common Commands

### Development
```bash
# Start development server
npm start

# Run tests (note: TensorFlow.js tests fail in JSDOM due to canvas limitations)
npm test

# Build for production
npm run build

# Install dependencies
npm install
```

### Key Testing Considerations
- Tests run with React Testing Library and Jest
- TensorFlow.js integration causes canvas-related failures in JSDOM test environment
- Tests that don't involve TensorFlow.js functionality should work normally
- For ML-related testing, consider using headless browser environments

## Architecture Overview

### Core Application Structure
- **Single Page Application**: Built as a React SPA with the main game logic in `src/App.js`
- **State Management**: Uses React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`) with custom `useGameStorage` hook
- **AI Engine**: TensorFlow.js neural network with multiple strategy modes (random, counter, pattern, learning)
- **Data Persistence**: localStorage via custom hook for game history and statistics

### Key Components and Logic

#### Main App Component (`src/App.js`)
- **Neural Network Architecture**: Multi-layer model with:
  - Input: 15 features (5 moves × 3 dimensions: player move, AI move, result)
  - Hidden layers: Dense(128) → Dropout(0.3) → Dense(64) → Dropout(0.2) → Dense(32)
  - Output: Dense(3) with softmax for move probabilities
  - Regularization: L2 regularization and dropout to prevent overfitting

- **AI Strategies**:
  - `random`: Completely random moves
  - `counter`: Counters the player's last move
  - `pattern`: Analyzes last 3 moves for patterns
  - `learning`: Uses neural network to predict and counter player moves

- **Game Flow**:
  1. Player selects move → `handlePlayerMove()`
  2. AI strategy determines response
  3. Results calculated and stored in `gameHistory`
  4. Neural network trains on batch when using 'learning' strategy
  5. Statistics and UI updated via React state

#### Data Storage Hook (`src/hooks/useGameStorage.js`)
- Manages localStorage persistence for game history
- Auto-saves on game history changes
- Provides `clearStorage()` method for data reset
- Storage key: `'tiny-ml-game-data'`

### TensorFlow.js Integration Details

#### Model Initialization
- **Model Creation**: `createAdvancedModel()` builds the neural network
- **Warm-up**: Dummy prediction run to initialize model
- **Memory Management**: Proper tensor disposal to prevent memory leaks
- **Error Handling**: Falls back to basic strategies if ML initialization fails

#### Training Process
- **Trigger**: Trains after each game when using 'learning' strategy and history ≥ 5 games
- **Batch Size**: Uses last 10 games (`TRAINING_BATCH_SIZE`)
- **Training Data**: Sequences of 5 moves encoded as normalized features
- **Validation**: 20% validation split to monitor accuracy
- **Performance**: Real-time accuracy tracking displayed to user

#### Prediction Logic
- **Input Encoding**: `encodeGameSequence()` converts game history to model input
- **Prediction**: Model predicts player's next move
- **Strategy**: AI counters the predicted move
- **Randomization**: 20% random factor to avoid being too predictable

### Styling and UI
- **Tailwind CSS**: Modern utility-first styling
- **Responsive Design**: Mobile-friendly grid layouts
- **Component Styling**: Reusable `StatCard` component for metrics
- **Custom Theme**: Extended Tailwind config with primary colors
- **Loading States**: Spinner components and disabled states during AI processing

### Data Flow
1. **Game History**: Array of game objects with `{ playerMove, aiMove, result, timestamp, id }`
2. **Statistics**: Computed via `useMemo` for wins/losses/ties/winRate
3. **Model State**: Tracks loading, training, accuracy, and error states
4. **Persistence**: Auto-saves to localStorage on state changes

### Performance Considerations
- **Memory Management**: Explicit tensor disposal in TensorFlow.js operations
- **History Limits**: `MAX_HISTORY = 50` to prevent excessive memory usage
- **Debounced Training**: 100ms delay before training to avoid blocking UI
- **Memoization**: Strategic use of `useCallback` and `useMemo` for expensive operations

### Error Handling
- **ML Failures**: Graceful fallback to random strategy if neural network fails
- **Storage Errors**: Console logging with continued functionality
- **Training Errors**: Model continues working with previous weights
- **Prediction Errors**: Falls back to random moves

## Development Notes

### Working with TensorFlow.js
- Always dispose tensors after use to prevent memory leaks
- Test ML functionality in browser environment, not Jest/JSDOM
- Use `tf.ready()` before model operations
- Handle async operations properly with loading states

### State Management Patterns
- Use `useCallback` for functions passed as dependencies
- Use `useMemo` for expensive computations (statistics)
- Custom hooks for complex state logic (storage)
- Proper cleanup in `useEffect` return functions

### Adding New AI Strategies
1. Add strategy key to `strategyDescriptions` object
2. Implement logic in `handlePlayerMove()` switch statement
3. Consider training requirements and data dependencies
4. Test fallback behavior for edge cases

### Modifying Neural Network
- Update `createAdvancedModel()` for architecture changes
- Adjust `encodeGameSequence()` if input format changes
- Update training parameters in `trainModel()`
- Consider backward compatibility with existing saved models