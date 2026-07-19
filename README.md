# Roshambot

A browser-based Rock Paper Scissors game where the AI learns your patterns in real time. Three swappable neural-network architectures (Dense MLP, GRU, single-head Transformer) train live in TensorFlow.js while you play. Everything runs client-side; no account, no server required to play.

**Play it:** [roshambot.briansheppard.com](https://roshambot.briansheppard.com)

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
| **Pattern** | Plays the counter to your most common move in the last 3 plays |
| **Learning** | Neural network trained online on your game history |

## Model Architectures (Learning strategy)

Switch between architectures from the dropdown above the strategy picker. All three share the same 15-feature input (5 recent rounds × {your move, AI move, outcome}) and a 3-class softmax output.

| Architecture | Sketch |
|---|---|
| **Dense** | 128 → 64 → 32 → 3, L2 + dropout |
| **GRU** | reshape (5, 3) → GRU(32) → Dense(16) → Dense(3) |
| **Transformer** | single-head self-attention (d_model=8) → residual + layerNorm → FFN → residual + layerNorm → global average pool → Dense(3) |

The model retrains on the last 25 rounds after every move you make. Predictions are sampled from the softmax (not argmax) with an annealed randomness floor so the model can commit to learned patterns over time.

## Persistence

- **Game history** is saved to `localStorage` and persists between sessions (capped at 50 rounds)
- **Trained model** is saved to IndexedDB and reloaded on next visit
- Model auto-saves on a debounce while using the Learning strategy
- Architecture choice is remembered in `localStorage`
- Theme (light/dark) and telemetry consent are also remembered locally

## Tabs

- **🎮 Game** — the playable interface
- **🌍 Global Stats** — aggregate counts, outcomes, move distribution, win rate by strategy and architecture (only populated when telemetry is configured)
- **ℹ️ About** — project info, active TF.js backend, telemetry status, consent reset

## Telemetry (opt-in)

Disabled by default. The hosted build at [roshambot.briansheppard.com](https://roshambot.briansheppard.com) shows a consent banner the first time you play; declining keeps everything local. If you accept, each round sends `{playerMove, aiMove, result, sequence, strategy, modelArch, sessionId, schemaVersion, timestamp}` to a small AWS Lambda Function URL backed by DynamoDB with a 90-day TTL. No IP, no fingerprint, no cookies.

To run your own backend, see [infra/README.md](infra/README.md). Set `REACT_APP_TELEMETRY_URL` at build time to point the client at your Lambda Function URL.

## Tech Stack

- React 19 (Create React App)
- TensorFlow.js 4.22
- Tailwind CSS 3 (class-based dark mode)
- AWS Lambda Function URL + DynamoDB (Terraform)
- Hosted on GitHub Pages with a custom domain

## Project Structure

```
src/
├── App.js                          # Top-level component, tabs, model lifecycle, UI
├── models.js                       # Model factory: dense / gru / transformer
├── api.js                          # Telemetry HTTP client (sendRound, fetchStats)
├── gameLogic.js                    # Pure helpers: encoding, outcomes, entropy
├── components/
│   ├── Tabs.js                     # Accessible tablist (roving tabindex)
│   ├── StatsTab.js                 # Global stats dashboard
│   ├── AboutTab.js                 # Project/runtime info, consent reset
│   ├── ConsentBanner.js            # Opt-in telemetry prompt
│   └── StrategyInfoModal.js        # Strategy/architecture explainer dialog
├── hooks/
│   ├── useGameStorage.js           # localStorage for game history
│   ├── useModelStorage.js          # IndexedDB for trained model
│   └── useTelemetry.js             # Consent + fire-and-forget round logging
└── __mocks__/@tensorflow/tfjs.js   # TF.js mock for Jest/JSDOM
infra/                              # Terraform for AWS backend
```

## Development

```bash
npm start       # Dev server at localhost:3000
npm test        # Jest tests (TF.js mocked for JSDOM)
npm run build   # Production build
npm run deploy  # Publish ./build to gh-pages
```

See [CLAUDE.md](CLAUDE.md) for architecture deep-dives, accessibility notes, and the design rationale behind decisions like the sampling strategy and model persistence.

## Accessibility

Built to WCAG 2.1 AA / Section 508. Highlights: skip link, real `radiogroup` for the strategy picker with full keyboard nav, R/P/S keyboard shortcuts (scoped to the Game tab, with an on/off toggle per WCAG 2.1.4), a fully trapped modal dialog with focus restoration, `role="status"` live region for results, dynamic `aria-label`s on move buttons, focus-visible rings tuned for both themes, motion-safe transitions, and AA-grade color contrast.

## Roadmap

- **Section 508 / WCAG 2.1 AA conformance statement** — the app already targets AA (see [Accessibility](#accessibility)); next step is a published VPAT-style conformance statement in the About tab and an automated axe-core check in CI so regressions are caught.
- **AI-agent accessible** — add an `llms.txt` and a small machine-readable manifest (game rules, move encoding, telemetry schema, public stats endpoint) so coding agents and research bots can interact with Roshambot programmatically. Keep `robots.txt` permissive for well-behaved AI crawlers.
- **Claude.ai / MCP accessible** — expose the public stats endpoint (and eventually the HF dataset) through a tiny MCP server so Claude.ai, Claude Desktop, and other MCP-aware clients can query aggregate stats and pull the dataset card without scraping.
- **Public dataset on Hugging Face** — once enough opt-in rounds are collected, publish a permissively-licensed dataset (likely CC0) of `(sequence, strategy, modelArch)` rows for anyone studying human RPS bias or training their own bots. Will include a dataset card with collection methodology, consent disclosure, and a "selection bias" caveat.
- **HF Community blog post** — *"Three tiny architectures vs. human RPS players"*. Walks through the model design, the annealed-randomness sampling trick, aggregate win-rate results from the dataset, and a head-to-head against `iocaine powder` (the 1999 RoShamBo champion).
- **AI vs AI vs `iocaine powder` mode** — let the three neural architectures and the classical bot play tournaments in-browser to feed the blog post a real comparison table.
- **TF.js backend split + WebGPU** — ship per-backend bundles and try the WebGPU backend for faster training on capable browsers.
- **CRA → Vite migration** — explore swapping the build pipeline; revert if the gains aren't worth the churn.
- **React 19 polish** — adopt Actions and `use()` where they actually simplify code.

## Notes

- The Learning AI runs entirely in-browser. If model initialization fails (rare; happens in some test environments), the game stays fully playable on the non-ML strategies.
- TensorFlow.js is fully mocked in the Jest/JSDOM test suite.
- Built and iterated on with GitHub Copilot / Claude over a long stretch of weekends.

## License

MIT
