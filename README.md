# Rock Paper Scissors with ML

A browser-based Rock Paper Scissors game where you can play against AI opponents, including one that learns your playing patterns using TensorFlow.js.

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

Architecture: `Dense(128) → Dropout → Dense(64) → Dropout → Dense(32) → Softmax(3)`

The AI gets better at predicting you over time, but includes 20% randomization to avoid being too predictable itself.

## Tech Stack

- React 19
- TensorFlow.js 4.22
- Tailwind CSS 3

## Project Structure

```
src/
├── App.js                 # Main game component + ML logic
├── hooks/
│   └── useGameStorage.js  # localStorage persistence
└── index.js               # Entry point
```

## Development

```bash
npm start     # Dev server
npm test      # Tests (note: TensorFlow tests fail in JSDOM)
npm run build # Production build
```

## Notes

- Game history is saved to localStorage and persists between sessions
- Maximum 50 games stored to limit memory usage
- The neural network runs entirely in-browser - no server required
- If ML initialization fails, the app falls back to random strategy

## License

MIT
