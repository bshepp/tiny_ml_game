# Rock Paper Scissors with ML

A browser-based Rock Paper Scissors game where you play against AI opponents, including a neural network that learns your playing patterns using TensorFlow.js. Everything runs client-side -- no server required.

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:3000

## AI Strategies

| Strategy | Description |
|----------|-------------|
| **Random** | Uniform random selection |
| **Counter** | Beats your previous move |
| **Pattern** | Finds the most common move in your last 3 plays |
| **Learning** | Neural network trained on your game history |

## How the Learning AI Works

The neural network:
- Takes your last 5 game results as input (player move, AI move, outcome)
- Predicts your next move
- Plays the counter to that prediction
- Retrains after every game

Architecture: `Dense(128, relu, L2) → Dropout(0.3) → Dense(64, relu, L2) → Dropout(0.2) → Dense(32, relu) → Softmax(3)`

The AI includes 20% randomization to avoid being too predictable itself.

## Persistence

- **Game history** is saved to localStorage and persists between sessions (max 50 games)
- **Trained model** is saved to IndexedDB and reloaded on next visit
- Model auto-saves every 10 games when using "Learning" strategy
- Manual save/delete controls available in the UI

## Tech Stack

- React 19 (Create React App)
- TensorFlow.js 4.22
- Tailwind CSS 3

## Project Structure

```
src/
├── App.js                          # Game component, ML logic, and UI
├── hooks/
│   ├── useGameStorage.js           # localStorage persistence for game history
│   └── useModelStorage.js          # IndexedDB persistence for trained model
├── __mocks__/@tensorflow/tfjs.js   # TensorFlow.js mock for tests
├── App.test.js                     # Component and integration tests
├── index.js                        # Entry point
├── index.css                       # Tailwind directives
├── App.css                         # Custom animations
└── setupTests.js                   # Jest setup + TF.js mock config
```

## Development

```bash
npm start       # Dev server at localhost:3000
npm test        # Jest tests (TF.js mocked for JSDOM)
npm run build   # Production build
npm run deploy  # Deploy to GitHub Pages
```

No environment variables or API keys required.

## Notes

- The neural network runs entirely in-browser -- no server required
- If ML initialization fails, the game remains playable with non-ML strategies (random, counter, pattern)
- TensorFlow.js is fully mocked in tests for JSDOM compatibility

## License

MIT
