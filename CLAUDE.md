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

Single-page React app. No routing, no backend. UI, ML wiring, and game state live in `src/App.js`. Pure logic helpers extracted to `src/gameLogic.js`.

### Key Files

- **App.js** — Main component: tabs (Game/Stats/About), model lifecycle (per arch), game state, AI strategies, theme, telemetry wiring, UI rendering
- **models.js** — Model factory: `MODEL_ARCHITECTURES`, `ARCH_LABELS`, `ARCH_DESCRIPTIONS`, `createModel(arch)`. Three architectures share the same 15-feature input and 3-class softmax output:
  - `dense` — original 128→64→32→3 MLP with L2+dropout
  - `gru` — reshape to (5,3) → GRU(32) → dense(16) → dense(3)
  - `transformer` — functional-API self-attention (single head, d_model=8): Q/K/V dense → scaled dot-product (`tf.layers.dot` + softmax) → residual+layerNorm → feed-forward → residual+layerNorm → globalAveragePooling1d → dense(3)
- **api.js** — Telemetry HTTP client. `sendRound(payload)`, `fetchStats()`, `telemetryEnabled()`. All no-op when `REACT_APP_TELEMETRY_URL` is unset.
- **components/Tabs.js** — Accessible tablist with roving tabindex + arrow-key navigation
- **components/StatsTab.js** — Global stats dashboard, fetches from telemetry API; degrades gracefully when no API is configured
- **components/AboutTab.js** — Project info, runtime info (TF.js backend), privacy notes, consent reset button
- **components/ConsentBanner.js** — Fixed bottom-right opt-in prompt for anonymous telemetry
- **gameLogic.js** — Pure helpers: `MOVE_NAMES`, `MOVE_EMOJI`, `getCounterMove`, `getResult`, `encodeGameSequence`, `playerMoveEntropy`, sequence constants
- **hooks/useGameStorage.js** — localStorage persistence for game history (with feature detection)
- **hooks/useModelStorage.js** — IndexedDB persistence for trained TF.js model
- **hooks/useTelemetry.js** — Consent state (`tiny-ml-game-consent`), stable session id (`tiny-ml-game-session-id`), `recordRound(payload)` fire-and-forget
- **infra/** — Terraform for AWS Lambda Function URL + DynamoDB. See `infra/README.md`.
- **\_\_mocks\_\_/@tensorflow/tfjs.js** — Full TF.js mock for Jest/JSDOM tests (extended with `tf.input`, `layerNormalization`, `reshape`, `add`, `softmax`, `dot`, `globalAveragePooling1d`, chainable `apply` for the functional API)

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

Training: After each game in "learning" strategy, trains on the last 10 games with a 20% validation split. Each sample uses only the games that preceded it as context, so the label isn't leaked into the input.

### Prediction Sampling

`predictNextMove` does not use `argmax`. It blends model probabilities with a uniform distribution and samples. The randomness factor anneals from 0.30 down to a 0.05 floor as history grows (`Math.max(0.05, 0.30 - 0.01 * history.length)`), letting the model commit to learned patterns over time. The resulting distribution is exposed via `lastProbabilities` and rendered as live bars in the UI.

### State Flow

1. `initializeModel()` runs on mount — tries to load saved model from IndexedDB, falls back to creating new one
2. `useGameStorage` loads saved game history from localStorage
3. Player clicks move → `handlePlayerMove()`
4. AI strategy calculates response (switch on `aiStrategy`)
5. Result added to `gameHistory` (capped at 50)
6. If "learning" mode: `trainModel()` runs async after 100ms delay (trains on last `TRAINING_BATCH_SIZE = 25` games)
7. Stats recompute via `useMemo` (`winRate`, `lift = winRate − 33`, `predictability` from `playerMoveEntropy`)
8. History auto-saves to localStorage
9. Model auto-saves to IndexedDB on a `AUTO_SAVE_DEBOUNCE_MS = 1500` debounce (timer cleared on unmount)

### Error Handling

If model initialization fails, the app:
- Displays an inline error banner with a Retry button
- Falls back to "random" strategy
- Disables the "learning" strategy option (shows "model unavailable")
- Keeps the game fully playable with non-ML strategies

### Memory Management

TensorFlow.js tensors must be manually disposed. The codebase uses `tf.tidy` wherever practical:

```javascript
const { xs, ys } = tf.tidy(() => ({
  xs: tf.tensor2d(inputs),
  ys: tf.tensor2d(labels),
}));
try {
  await model.fit(xs, ys, { epochs: 5, validationSplit: 0.2 });
} finally {
  xs.dispose();
  ys.dispose();
}
```

The initial warm-up call in `initializeModel()` is wrapped in `tf.tidy` so no intermediate tensors leak.

### Move Data

Moves are defined as two constants:
```javascript
const MOVE_NAMES = ['Rock', 'Paper', 'Scissors'];
const MOVE_EMOJI = { Rock: '🗿', Paper: '📄', Scissors: '✂️' };
```

### Tailwind Note

Dynamic class names like `bg-${color}-50` don't work with Tailwind JIT. Use static class mappings (see `STAT_CARD_STYLES` / `STAT_VALUE_STYLES` in App.js) where each map value is a complete literal class string. Tailwind's JIT scans those literals directly, so no `safelist` is needed.

## Tabs

The main UI is split into three tabs (`activeTab` state in `App.js`, rendered by `components/Tabs.js`):

- **🎮 Game** — the playable interface (existing UI)
- **🌍 Global Stats** — `StatsTab` fetches `${REACT_APP_TELEMETRY_URL}/stats` and renders aggregate counts, outcomes, move distribution, win rate by strategy, and win rate by model architecture. Shows a friendly "telemetry not configured" message when `REACT_APP_TELEMETRY_URL` is empty.
- **ℹ️ About** — `AboutTab` shows project info, the active TF.js backend, telemetry status, and a "Reset consent" button.

Each tab panel is a `role="tabpanel"` with `id="tabpanel-{id}"` matching the `aria-controls` on the tab.

## Model Architecture Selector

A `<select id="model-arch-select">` directly above the strategy radiogroup lets the player switch between `dense`, `gru`, and `transformer`. Switching:

1. Persists the choice to `tiny-ml-game-model-arch` in localStorage
2. Triggers `initializeModel(true)` to rebuild the network with the new factory
3. Disables itself while loading or training to prevent mid-training swaps

`createAdvancedModel` is now a one-line wrapper around `createModel(modelArch)` from `models.js`.

## Telemetry (opt-in)

Disabled by default. Activates only when `REACT_APP_TELEMETRY_URL` is set at build time **and** the user clicks "Accept" on the consent banner.

- `useTelemetry()` exposes `{consent, grant, deny, reset, recordRound, enabled, sessionId}`
- After every round in `handlePlayerMove`, the app calls `telemetry.recordRound({sequence, strategy, modelArch})` — the hook adds `sessionId`, `schemaVersion`, and `timestamp` and fires-and-forgets via `fetch(..., {keepalive: true})`
- `ConsentBanner` is mounted only when `telemetry.enabled && telemetry.consent === null`
- No IP, no fingerprint, no cookies. Backend stores rounds with a 90-day TTL (DynamoDB auto-deletes)

See `infra/README.md` for the AWS deployment.

## Hosting

Deployed via `npm run deploy` (gh-pages) to `roshambot.briansheppard.com`. The custom domain is set up via:

- `public/CNAME` containing `roshambot.briansheppard.com`
- `package.json` `homepage` field pointing at the same URL
- A DNS CNAME record at `briansheppard.com` zone pointing `roshambot` → `bshepp.github.io`



Class-based dark mode (`darkMode: 'class'` in `tailwind.config.js`). Theme is stored in `tiny-ml-game-theme` (`'light'` | `'dark'`).

- `getInitialTheme()` resolves: saved value → `matchMedia('(prefers-color-scheme: dark)')` → `'light'`
- A `matchMedia` change listener tracks OS theme **only** when the user hasn't made a manual choice (tracked via `userSetThemeRef`)
- The toggle button (top-right) sets `userSetThemeRef.current = true`, flips `theme`, and persists
- An effect adds/removes the `dark` class on `document.documentElement`

All color-bearing components ship matching `dark:` variants; transitions are gated behind `motion-safe:` to honor `prefers-reduced-motion`.

## Accessibility (Section 508 / WCAG 2.1 AA)

- Skip link to `<main id="main-content" tabIndex={-1}>`
- Sectioning landmarks via `<section aria-labelledby>` with visible `<h2>` headings; emoji prefixes are `aria-hidden`
- Errors use `role="alert"`; the result region uses `role="status"` with `aria-live="polite"` and `aria-atomic="true"`
- Loading spinner exposes `role="status"`
- Strategy picker is a true `role="radiogroup"` with `role="radio"`/`aria-checked` items, roving `tabindex`, and full arrow-key + Home/End navigation (skipping disabled options)
- Move buttons announce their keyboard shortcut: e.g. `aria-label="Play Rock (shortcut R)"`
- Global R / P / S keyboard shortcuts (ignored when typing in an input/textarea/contenteditable or when modifier keys are held)
- All interactive elements have `focus-visible:ring-4` rings tuned for both light and dark themes
- Game history rendered as `<ul><li>` with descriptive `aria-label` per entry; emoji glyphs use `role="img" aria-label={moveName}`
- Color contrast bumped to AA (e.g. move buttons `bg-blue-600` instead of `bg-blue-500`)

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
  saveModel,         // Save current model to IndexedDB
  loadModel,         // Load saved model (returns null if none)
  deleteModel,       // Delete saved model
  checkModelExists,  // Sync hasSavedModel state with IndexedDB contents
  isSaving,          // Boolean: save in progress
  isLoadingModel,    // Boolean: load in progress
  hasSavedModel,     // Boolean: saved model exists
  lastSaved          // ISO timestamp of last save
} = useModelStorage();
```

## Known Limitations

- Training is synchronous and can briefly block UI on slower devices
- App.js is still large (~700 lines) — pure logic now lives in `gameLogic.js`, but UI/state could benefit from further decomposition
- TF.js model initialization has a CJS/ESM interop issue in JSDOM that causes fallback to non-ML mode in tests
- Full `@tensorflow/tfjs` bundle is shipped (no per-backend split yet)

## Storage Hooks

`useGameStorage` uses a `hasLoadedRef` guard to skip the first save effect. Without it, the save effect would run on mount with the empty default state and overwrite persisted history before the load effect completed.

Both `useGameStorage` and `useModelStorage` feature-detect localStorage availability (private mode, disabled storage, quota errors) and silently no-op when unavailable instead of crashing.

## Test Setup

`src/setupTests.js` polyfills `window.matchMedia` (used by the theme system) with a plain (non-`jest.fn`) implementation so that `jest.clearAllMocks()` calls in test suites don't strip the implementation out.

## Adding Features

**New AI strategy:**
1. Add to `strategyDescriptions` object
2. Add case in `handlePlayerMove()` switch

**Modify network architecture:**
1. Update `createAdvancedModel()`
2. Adjust `encodeGameSequence()` if input shape changes
3. Update input shape constant (currently `[15]`)
