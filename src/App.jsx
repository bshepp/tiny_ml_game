import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import { useGameStorage } from './hooks/useGameStorage';
import { useModelStorage } from './hooks/useModelStorage';
import { useTelemetry } from './hooks/useTelemetry';
import {
  MOVE_NAMES,
  MOVE_EMOJI,
  getCounterMove,
  getResult,
  encodeGameSequence,
  playerMoveEntropy,
  SEQUENCE_FEATURES,
} from './gameLogic';
import { createModel, MODEL_ARCHITECTURES, ARCH_LABELS, ARCH_DESCRIPTIONS } from './models';
import Tabs from './components/Tabs';
import ErrorBoundary from './components/ErrorBoundary';
import StatsTab from './components/StatsTab';
import AboutTab from './components/AboutTab';
import ConsentBanner from './components/ConsentBanner';
import StrategyInfoModal from './components/StrategyInfoModal';
import './App.css';

const MODEL_ARCH_STORAGE_KEY = 'tiny-ml-game-model-arch';

const MAX_HISTORY = 50;
const TRAINING_BATCH_SIZE = 25;
const AUTO_SAVE_DEBOUNCE_MS = 1500;
const THEME_STORAGE_KEY = 'tiny-ml-game-theme';
const SHORTCUTS_STORAGE_KEY = 'tiny-ml-game-shortcuts';

// Renders text with emoji wrapped in aria-hidden spans, so live regions
// announce the words but not the glyphs ("You win!" rather than
// "You win! party popper").
const EMOJI_SPLIT_RE = /(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/gu;
const TextWithHiddenEmoji = ({ text }) =>
  text.split(EMOJI_SPLIT_RE).map((part, i) =>
    /^\p{Extended_Pictographic}/u.test(part) ? (
      // eslint-disable-next-line react/no-array-index-key
      <span key={i} aria-hidden="true">{part}</span>
    ) : (
      // eslint-disable-next-line react/no-array-index-key
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );

const GameError = ({ message, onRetry }) => (
  <div
    role="alert"
    className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4 motion-safe:transition-colors"
  >
    <div className="flex items-center">
      <div className="text-red-500 dark:text-red-300 mr-3" aria-hidden="true">⚠️</div>
      <div>
        <h3 className="text-red-800 dark:text-red-100 font-medium">Error</h3>
        <p className="text-red-700 dark:text-red-200 text-sm mt-1">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300 motion-safe:transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div role="status" className="flex items-center space-x-2">
    <div
      aria-hidden="true"
      className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-300"
    ></div>
    <span className="text-sm text-gray-700 dark:text-gray-200">Initializing AI...</span>
  </div>
);

// Static class maps. Full literal strings so Tailwind's JIT picks them up via content scan.
const STAT_CARD_STYLES = {
  blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-700 text-blue-700 dark:text-blue-200',
  green: 'bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-700 text-green-700 dark:text-green-200',
  red: 'bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-700 text-red-700 dark:text-red-200',
  gray: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200',
  purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-700 text-purple-700 dark:text-purple-200',
};
const STAT_VALUE_STYLES = {
  blue: 'text-blue-700 dark:text-blue-200',
  green: 'text-green-700 dark:text-green-200',
  red: 'text-red-700 dark:text-red-200',
  gray: 'text-gray-800 dark:text-gray-100',
  purple: 'text-purple-700 dark:text-purple-200',
};

const StatCard = ({ label, value, color = 'blue', srLabel }) => (
  <div
    className={`${STAT_CARD_STYLES[color] || STAT_CARD_STYLES.blue} border rounded-lg p-4 text-center motion-safe:transition-colors`}
  >
    <div className={`text-2xl font-bold ${STAT_VALUE_STYLES[color] || STAT_VALUE_STYLES.blue}`}>
      {value}
    </div>
    <div className="text-sm">{srLabel ? <span className="sr-only">{srLabel}: </span> : null}{label}</div>
  </div>
);

// Theme management — class-based dark mode on <html>.
const getInitialTheme = () => {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const App = () => {
  const [playerMove, setPlayerMove] = useState(null);
  const [aiMove, setAiMove] = useState(null);
  const [message, setMessage] = useState('🎮 Choose your move to start!');
  const [model, setModel] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [aiStrategy, setAiStrategy] = useState('learning');
  const [strategyInfoOpen, setStrategyInfoOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [modelAccuracy, setModelAccuracy] = useState(0);
  const [modelStatus, setModelStatus] = useState('new'); // 'new', 'loaded', 'trained'
  const [lastProbabilities, setLastProbabilities] = useState(null); // [pRock, pPaper, pScissors] of player's NEXT predicted move
  const [theme, setTheme] = useState(getInitialTheme);
  const [modelArch, setModelArchState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(MODEL_ARCH_STORAGE_KEY);
      if (MODEL_ARCHITECTURES.includes(saved)) return saved;
    } catch { /* ignore */ }
    return 'dense';
  });
  const [activeTab, setActiveTab] = useState('game');
  const [tfBackend, setTfBackend] = useState('initializing');
  // Single-key shortcuts need an off-switch (WCAG 2.1.4 Character Key Shortcuts).
  const [shortcutsEnabled, setShortcutsEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(SHORTCUTS_STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  });

  const toggleShortcuts = useCallback((enabled) => {
    setShortcutsEnabled(enabled);
    try {
      window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch { /* ignore */ }
  }, []);

  const telemetry = useTelemetry();

  // Refs
  const autoSaveTimerRef = useRef(null);
  const userSetThemeRef = useRef(false);
  const resultRegionRef = useRef(null);
  // Latest history, readable synchronously. handlePlayerMove is async, so two
  // overlapping calls would otherwise both build on the same stale closure
  // and the second would silently discard the first round.
  const gameHistoryRef = useRef(gameHistory);
  const roundIdRef = useRef(0);
  // Re-entrancy guard for trainModel. Must be a ref, not the isTraining
  // state: the 100ms-delayed timers capture render-time closures, so two
  // quick rounds would both see stale isTraining=false and overlap fit().
  const isTrainingRef = useRef(false);

  useEffect(() => {
    gameHistoryRef.current = gameHistory;
  }, [gameHistory]);

  // Add data persistence
  const { clearStorage } = useGameStorage(gameHistory, setGameHistory);

  // Add model persistence
  const {
    saveModel,
    loadModel,
    deleteModel,
    checkModelExists,
    isSaving,
    isLoadingModel,
    hasSavedModel,
    lastSaved,
  } = useModelStorage();

  // Apply theme class to <html> and persist user choice.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    if (userSetThemeRef.current) {
      try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
    }
  }, [theme]);

  // React to OS theme changes only when user has not explicitly chosen.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      let saved = null;
      try { saved = window.localStorage.getItem(THEME_STORAGE_KEY); } catch { /* ignore */ }
      if (saved === 'light' || saved === 'dark') return;
      setTheme(e.matches ? 'dark' : 'light');
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    userSetThemeRef.current = true;
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // Sync hasSavedModel with the actual IndexedDB contents on mount,
  // so stale localStorage metadata can't claim a model that no longer exists.
  useEffect(() => {
    checkModelExists();
  }, [checkModelExists]);

  const createAdvancedModel = useCallback(() => createModel(modelArch), [modelArch]);

  const initializeModel = useCallback(async (forceNew = false) => {
    setIsLoading(true);
    setError(null);

    try {
      await tf.ready();
      try { setTfBackend(tf.getBackend && tf.getBackend()); } catch { /* ignore */ }

      let loadedModel = null;
      if (!forceNew) {
        try {
          loadedModel = await loadModel(modelArch);
        } catch (err) {
          // No saved model — fall through to creating a new one.
        }
      }

      let activeModel;
      if (loadedModel) {
        activeModel = loadedModel;
        setModelStatus('loaded');
        setMessage('🧠 Loaded trained AI model — an AI-powered game with machine learning.\nChoose Rock, Paper, or Scissors!');
      } else {
        activeModel = createAdvancedModel();
        setModelStatus('new');
        setMessage('AI ready — an AI-powered game with machine learning.\nChoose Rock, Paper, or Scissors!');
        setModelAccuracy(0);
      }

      // Warm up the model with dummy data
      tf.tidy(() => {
        const dummyInput = tf.zeros([1, SEQUENCE_FEATURES]);
        activeModel.predict(dummyInput);
      });

      setModel(activeModel);
    } catch (err) {
      console.error('Error initializing model:', err);
      setError('Failed to initialize AI model. Falling back to basic strategies.');
      setAiStrategy('random');
    } finally {
      setIsLoading(false);
    }
  }, [createAdvancedModel, loadModel, modelArch]);

  // Initialize model on mount only
  useEffect(() => {
    initializeModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist model arch + reinit when the user picks a different architecture.
  // Compares against the previous value rather than using a "has mounted"
  // flag: refs survive StrictMode's simulated remount, so a flag would make
  // the re-run effect force-recreate the model on every dev remount.
  const prevArchRef = useRef(modelArch);
  useEffect(() => {
    try { window.localStorage.setItem(MODEL_ARCH_STORAGE_KEY, modelArch); } catch { /* ignore */ }
    if (prevArchRef.current === modelArch) return;
    prevArchRef.current = modelArch;
    initializeModel(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelArch]);

  const setModelArch = useCallback((arch) => {
    if (!MODEL_ARCHITECTURES.includes(arch)) return;
    setModelArchState(arch);
  }, []);

  // Cleanup model and pending timers on unmount
  useEffect(() => {
    return () => {
      if (model) model.dispose();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [model]);

  const predictNextMove = useCallback(async (history) => {
    if (!model || history.length < 3) {
      setLastProbabilities(null);
      return MOVE_NAMES[Math.floor(Math.random() * 3)];
    }

    let input = null;
    let prediction = null;

    try {
      const sequence = encodeGameSequence(history);
      input = tf.tensor2d([sequence]);
      prediction = model.predict(input);
      const probabilities = await prediction.data();

      // Anneal exploration: start ~30% random, settle near 5% as the model
      // sees more games. Without sampling at all the AI would be deterministic.
      const randomFactor = Math.max(0.05, 0.3 - 0.01 * history.length);
      const adjustedProbs = Array.from(probabilities, (p) =>
        p * (1 - randomFactor) + randomFactor / 3
      );
      const total = adjustedProbs.reduce((s, p) => s + p, 0) || 1;
      const normalized = adjustedProbs.map((p) => p / total);
      setLastProbabilities(normalized);

      let r = Math.random();
      let predictedMoveIndex = normalized.length - 1;
      for (let i = 0; i < normalized.length; i++) {
        r -= normalized[i];
        if (r <= 0) {
          predictedMoveIndex = i;
          break;
        }
      }
      const predictedMove = MOVE_NAMES[predictedMoveIndex];

      return getCounterMove(predictedMove);
    } catch (err) {
      console.error('Prediction error:', err);
      setLastProbabilities(null);
      return MOVE_NAMES[Math.floor(Math.random() * 3)];
    } finally {
      if (input) input.dispose();
      if (prediction) prediction.dispose();
    }
  }, [model]);

  const trainModel = useCallback(async (history) => {
    if (!model || history.length < TRAINING_BATCH_SIZE || isTrainingRef.current) {
      return;
    }

    isTrainingRef.current = true;
    setIsTraining(true);

    try {
      const trainingData = history.slice(-TRAINING_BATCH_SIZE);
      const startIdx = history.length - trainingData.length;
      const inputs = [];
      const labels = [];

      trainingData.forEach((game, idx) => {
        // Use only games up to (but not including) this one as the
        // sequence context, so the label isn't leaked into the input.
        const prevHistory = history.slice(0, startIdx + idx);
        const sequence = encodeGameSequence(prevHistory);
        const playerMoveIdx = MOVE_NAMES.indexOf(game.playerMove);

        if (playerMoveIdx !== -1) {
          inputs.push(sequence);
          const label = new Array(3).fill(0);
          label[playerMoveIdx] = 1;
          labels.push(label);
        }
      });

      if (inputs.length > 0) {
        const tensors = tf.tidy(() => ({
          xs: tf.tensor2d(inputs),
          ys: tf.tensor2d(labels),
        }));

        try {
          const trainResult = await model.fit(tensors.xs, tensors.ys, {
            epochs: 3,
            batchSize: Math.min(inputs.length, 8),
            verbose: 0,
            validationSplit: 0.2,
          });

          // Prefer validation accuracy — training accuracy on ≤20 samples
          // wildly overstates model skill.
          const h = trainResult.history;
          const accuracy = h.val_acc || h.val_accuracy || h.acc || h.accuracy;
          if (accuracy && accuracy.length > 0) {
            const newAccuracy = Math.round(accuracy[accuracy.length - 1] * 100);
            setModelAccuracy(newAccuracy);
            setModelStatus('trained');
          }
        } finally {
          tensors.xs.dispose();
          tensors.ys.dispose();
        }

        // Debounced auto-save: collapse rapid bursts into one write.
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
          saveModel(model, modelArch);
          autoSaveTimerRef.current = null;
        }, AUTO_SAVE_DEBOUNCE_MS);
      }
    } catch (err) {
      console.error('Training error:', err);
    } finally {
      isTrainingRef.current = false;
      setIsTraining(false);
    }
  }, [model, saveModel, modelArch]);

  const handlePlayerMove = useCallback(async (move) => {
    setPlayerMove(move);
    setMessage('🤔 AI is thinking...');

    let aiChoice;

    try {
      switch (aiStrategy) {
        case 'random':
          aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
          break;
        case 'counter': {
          const lastPlayerMove = gameHistory.length > 0
            ? gameHistory[gameHistory.length - 1].playerMove
            : null;
          aiChoice = lastPlayerMove ? getCounterMove(lastPlayerMove) : MOVE_NAMES[Math.floor(Math.random() * 3)];
          break;
        }
        case 'learning':
          aiChoice = await predictNextMove(gameHistory);
          break;
        case 'pattern':
          if (gameHistory.length >= 3) {
            const lastThree = gameHistory.slice(-3).map((g) => g.playerMove);
            const mostCommon = lastThree.reduce((a, b, _, arr) =>
              arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length ? a : b
            );
            aiChoice = getCounterMove(mostCommon);
          } else {
            aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
          }
          break;
        default:
          aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
      }
    } catch (err) {
      console.error('Error in AI decision:', err);
      aiChoice = MOVE_NAMES[Math.floor(Math.random() * 3)];
    }

    setAiMove(aiChoice);

    const result = getResult(move, aiChoice);
    const resultMessage = result === 'win'
      ? 'You win! 🎉'
      : result === 'loss'
        ? 'AI wins! 🤖'
        : "It's a tie! 🤝";

    setMessage(resultMessage);

    const newHistory = [...gameHistoryRef.current, {
      playerMove: move,
      aiMove: aiChoice,
      result,
      timestamp: new Date().toLocaleTimeString(),
      id: `${Date.now()}-${(roundIdRef.current += 1)}`,
    }];
    const trimmedHistory = newHistory.length > MAX_HISTORY
      ? newHistory.slice(-MAX_HISTORY)
      : newHistory;

    gameHistoryRef.current = trimmedHistory;
    setGameHistory(trimmedHistory);

    // Anonymous telemetry (only if user opted in via consent banner).
    // The Lambda requires playerMove/aiMove/result at top level.
    telemetry.recordRound({
      playerMove: move,
      aiMove: aiChoice,
      result,
      sequence: trimmedHistory.slice(-6).map((g) => ({
        playerMove: g.playerMove,
        aiMove: g.aiMove,
        result: g.result,
      })),
      strategy: aiStrategy,
      modelArch,
    });

    if (aiStrategy === 'learning' && trimmedHistory.length >= 5) {
      setTimeout(() => trainModel(trimmedHistory), 100);
    }
  }, [aiStrategy, gameHistory, predictNextMove, trainModel, telemetry, modelArch]);

  // Keyboard shortcuts: R / P / S to play. Active only on the game tab with no
  // modal open, can be turned off entirely (WCAG 2.1.4), and must not swallow
  // typing in form controls (including the arch <select>'s type-ahead).
  useEffect(() => {
    const handler = (e) => {
      if (isLoading || e.repeat || !shortcutsEnabled) return;
      if (activeTab !== 'game' || strategyInfoOpen) return;
      const target = e.target;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const map = { r: 'Rock', p: 'Paper', s: 'Scissors' };
      const move = map[key];
      if (!move) return;
      e.preventDefault();
      handlePlayerMove(move);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePlayerMove, isLoading, shortcutsEnabled, activeTab, strategyInfoOpen]);

  const stats = useMemo(() => {
    if (gameHistory.length === 0) {
      return { wins: 0, losses: 0, ties: 0, winRate: 0, lift: 0 };
    }
    const counts = gameHistory.reduce((acc, game) => {
      if (game.result === 'win') acc.wins++;
      else if (game.result === 'loss') acc.losses++;
      else acc.ties++;
      return acc;
    }, { wins: 0, losses: 0, ties: 0 });
    const winRate = Math.round((counts.wins / gameHistory.length) * 100);
    // Lift over the 33.3% baseline a uniformly random player would expect.
    const lift = Math.round(winRate - 100 / 3);
    return { ...counts, winRate, lift };
  }, [gameHistory]);

  const predictability = useMemo(
    () => Math.round((1 - playerMoveEntropy(gameHistory, 20)) * 100),
    [gameHistory]
  );

  const strategyDescriptions = {
    learning: '🤖 Neural network learns your style (starts training at 25 rounds)',
    pattern: '🧠 Detects patterns in your play',
    counter: '🔄 Counters your last move',
    random: '🎲 Completely random moves',
  };
  const strategyKeys = Object.keys(strategyDescriptions);

  // Roving tabindex for the strategy radiogroup.
  const onStrategyKeyDown = (e) => {
    const idx = strategyKeys.indexOf(aiStrategy);
    let next = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (idx + 1) % strategyKeys.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (idx - 1 + strategyKeys.length) % strategyKeys.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = strategyKeys.length - 1;
    if (next === null) return;
    // Skip disabled "learning" if model is unavailable.
    let attempts = 0;
    while (strategyKeys[next] === 'learning' && !model && attempts < strategyKeys.length) {
      next = (next + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1) + strategyKeys.length) % strategyKeys.length;
      attempts++;
    }
    e.preventDefault();
    setAiStrategy(strategyKeys[next]);
    const el = document.getElementById(`strategy-${strategyKeys[next]}`);
    if (el) el.focus();
  };

  const playerWonClass = (r) =>
    r === 'win' ? 'text-green-700 dark:text-green-300'
      : r === 'loss' ? 'text-red-700 dark:text-red-300'
        : 'text-gray-700 dark:text-gray-300';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-slate-900 p-4 motion-safe:transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-700 focus:text-white focus:rounded"
      >
        Skip to main content
      </a>
      <div className="max-w-4xl mx-auto">
        {error && <GameError message={error} onRetry={() => initializeModel()} />}

        <main id="main-content" tabIndex={-1}>
        <div className="flex items-center justify-between gap-2 mb-4">
          <Tabs
            tabs={[
              { id: 'game', label: '🎮 Game' },
              { id: 'stats', label: '🌍 Global Stats' },
              { id: 'about', label: 'ℹ️ About' },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="shrink-0 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 motion-safe:transition-colors"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="ml-2 text-sm font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {activeTab === 'stats' && (
          <div role="tabpanel" id="tabpanel-stats" aria-labelledby="tab-stats">
            <ErrorBoundary>
              <StatsTab />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'about' && (
          <div role="tabpanel" id="tabpanel-about" aria-labelledby="tab-about">
            <AboutTab
              backend={tfBackend}
              telemetryStatus={
                !telemetry.enabled
                  ? 'not configured for this build'
                  : telemetry.consent === 'granted'
                    ? 'enabled (you accepted)'
                    : telemetry.consent === 'denied'
                      ? 'disabled (you declined)'
                      : 'awaiting your choice'
              }
              onResetConsent={telemetry.reset}
            />
          </div>
        )}

        {activeTab === 'game' && (
        <div role="tabpanel" id="tabpanel-game" aria-labelledby="tab-game">
        <section
          aria-labelledby="game-heading"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 motion-safe:transition-colors"
        >
          <div className="text-center mb-6">
            <h1 id="game-heading" className="text-4xl font-bold text-gray-900 dark:text-gray-50">
              Rock Paper Scissors
            </h1>
          </div>

          {isLoading && (
            <div className="flex justify-center mb-6">
              <LoadingSpinner />
            </div>
          )}

          <div
            ref={resultRegionRef}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-center mb-6"
          >
            <p className="text-xl font-medium text-gray-800 dark:text-gray-100 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg motion-safe:transition-colors whitespace-pre-line">
              <TextWithHiddenEmoji text={message} />
            </p>
          </div>

          <div
            role="group"
            aria-label="Choose your move (keyboard shortcuts: R, P, S)"
            className="flex justify-center space-x-4 mb-6"
          >
            {MOVE_NAMES.map((move) => (
              <button
                key={move}
                type="button"
                onClick={() => handlePlayerMove(move)}
                disabled={isLoading}
                aria-label={`Play ${move} (shortcut ${move[0]})`}
                className="group flex flex-col items-center p-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 motion-safe:transition-all motion-safe:duration-200 motion-safe:transform motion-safe:hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <span className="text-4xl mb-2" aria-hidden="true">{MOVE_EMOJI[move]}</span>
                <span className="text-lg font-medium">{move}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-center mb-6 -mt-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={shortcutsEnabled}
                onChange={(e) => toggleShortcuts(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              />
              Keyboard shortcuts (R / P / S)
            </label>
          </div>

          {playerMove && aiMove && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 mb-6 motion-safe:transition-colors">
              <div className="flex justify-center items-center space-x-8">
                <div className="text-center">
                  <div className="text-6xl mb-2" role="img" aria-label={playerMove}>{MOVE_EMOJI[playerMove]}</div>
                  <div className="text-lg font-medium text-gray-700 dark:text-gray-200">You chose</div>
                  <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{playerMove}</div>
                </div>
                <div className="text-4xl text-gray-700 dark:text-gray-200" aria-hidden="true">VS</div>
                <div className="text-center">
                  <div className="text-6xl mb-2" role="img" aria-label={aiMove}>{MOVE_EMOJI[aiMove]}</div>
                  <div className="text-lg font-medium text-gray-700 dark:text-gray-200">AI chose</div>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">{aiMove}</div>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section
            aria-labelledby="stats-heading"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
          >
            <h2 id="stats-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">
              <span aria-hidden="true">📊 </span>Game Statistics
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <StatCard label="Wins" value={stats.wins} color="green" />
              <StatCard label="Losses" value={stats.losses} color="red" />
              <StatCard label="Ties" value={stats.ties} color="gray" />
              <StatCard label="Win Rate" value={`${stats.winRate}%`} color="blue" />
            </div>
            {gameHistory.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <StatCard
                  label="Lift vs Random"
                  value={`${stats.lift >= 0 ? '+' : ''}${stats.lift}%`}
                  color={stats.lift >= 0 ? 'green' : 'red'}
                  srLabel="Win rate compared to a random baseline of 33%"
                />
                <StatCard
                  label="Predictability"
                  value={`${predictability}%`}
                  color="purple"
                  srLabel="Based on Shannon entropy of your last 20 moves"
                />
              </div>
            )}

            {aiStrategy === 'learning' && (
              <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-3 motion-safe:transition-colors">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-200">AI Model Accuracy</span>
                  <span className="text-lg font-bold text-purple-700 dark:text-purple-200">{modelAccuracy}%</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-purple-700 dark:text-purple-300">
                    Status: {modelStatus === 'loaded' ? '📂 Loaded from storage' :
                      modelStatus === 'trained' ? '🎓 Trained' : '🆕 New model'}
                  </span>
                </div>
                {gameHistory.length < TRAINING_BATCH_SIZE ? (
                  <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    Training begins after {TRAINING_BATCH_SIZE} rounds — {TRAINING_BATCH_SIZE - gameHistory.length} more to go. Until then the network plays mostly at random.
                  </div>
                ) : (
                  <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    Retrains on your last {TRAINING_BATCH_SIZE} rounds after every move.
                  </div>
                )}
                {isTraining && (
                  <div className="flex items-center mt-2" role="status">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-purple-700 dark:border-purple-200 mr-2" aria-hidden="true"></div>
                    <span className="text-xs text-purple-700 dark:text-purple-200">Training...</span>
                  </div>
                )}
                {isSaving && (
                  <div className="flex items-center mt-2" role="status">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-green-700 dark:border-green-300 mr-2" aria-hidden="true"></div>
                    <span className="text-xs text-green-700 dark:text-green-300">Saving model...</span>
                  </div>
                )}
                {lastSaved && !isSaving && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    <span aria-hidden="true">💾 </span>Last saved: {new Date(lastSaved).toLocaleString()}
                  </div>
                )}
                {playerMove && aiMove && lastProbabilities && (
                  <div className="mt-3" aria-label="Model's predicted distribution for your next move">
                    <div className="text-xs font-medium text-purple-800 dark:text-purple-200 mb-1">Predicted next move (you):</div>
                    {MOVE_NAMES.map((m, i) => (
                      <div key={m} className="flex items-center text-xs mb-1">
                        <span className="w-16 text-purple-800 dark:text-purple-200">{m}</span>
                        <div className="flex-1 bg-purple-200 dark:bg-purple-800 rounded h-2 mr-2">
                          <div
                            className="bg-purple-600 dark:bg-purple-300 h-2 rounded motion-safe:transition-all"
                            style={{ width: `${Math.round(lastProbabilities[i] * 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-purple-800 dark:text-purple-200">
                          {Math.round(lastProbabilities[i] * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section
            aria-labelledby="strategy-heading"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="strategy-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
                <span aria-hidden="true">🤖 </span>AI Strategy
              </h2>
              <button
                type="button"
                onClick={() => setStrategyInfoOpen(true)}
                aria-label="About AI strategies and model architectures"
                className="ml-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-purple-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 motion-safe:transition-colors text-sm font-bold"
                title="About AI strategies"
              >
                <span aria-hidden="true">ℹ</span>
              </button>
            </div>

            {aiStrategy === 'learning' && (
              <div className="mb-4">
                <label htmlFor="model-arch-select" className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
                  Neural model architecture
                </label>
                <select
                  id="model-arch-select"
                  value={modelArch}
                  onChange={(e) => setModelArch(e.target.value)}
                  disabled={isLoading || isTraining}
                  className="w-full p-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300"
                >
                  {MODEL_ARCHITECTURES.map((arch) => (
                    <option key={arch} value={arch}>{ARCH_LABELS[arch]}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {ARCH_DESCRIPTIONS[modelArch]}
                </p>
              </div>
            )}

            <div
              role="radiogroup"
              aria-labelledby="strategy-heading"
              onKeyDown={onStrategyKeyDown}
              className="space-y-2 mb-4"
            >
              {strategyKeys.map((strategy) => {
                const description = strategyDescriptions[strategy];
                const needsModel = strategy === 'learning' && !model;
                const checked = aiStrategy === strategy;
                // If the checked radio is disabled (learning while the model
                // loads), hand its tab stop to the first enabled option so
                // the whole group doesn't fall out of the Tab order.
                const checkedIsDisabled = aiStrategy === 'learning' && !model;
                const isFallbackTabStop =
                  checkedIsDisabled && strategy === strategyKeys.find((s) => s !== 'learning');
                return (
                  <button
                    id={`strategy-${strategy}`}
                    key={strategy}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={(checked && !needsModel) || isFallbackTabStop ? 0 : -1}
                    onClick={() => !needsModel && setAiStrategy(strategy)}
                    disabled={needsModel}
                    className={`w-full text-left p-3 rounded-lg motion-safe:transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 ${
                      checked
                        ? 'bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-400 dark:border-purple-500 text-purple-900 dark:text-purple-100'
                        : 'bg-gray-50 dark:bg-gray-900 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100'
                    } ${needsModel ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-medium capitalize">{strategy}</div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {description}{needsModel && ' (model unavailable)'}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {aiStrategy === 'learning' && (
                <>
                  <button
                    type="button"
                    onClick={() => saveModel(model, modelArch)}
                    disabled={!model || isSaving || isTraining}
                    className="w-full px-4 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300 motion-safe:transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? '💾 Saving...' : '💾 Save Model'}
                  </button>
                  {hasSavedModel && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteModel();
                        initializeModel(true);
                      }}
                      disabled={isLoadingModel}
                      className="w-full px-4 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 motion-safe:transition-colors font-medium disabled:opacity-50"
                    >
                      <span aria-hidden="true">🗑️ </span>Delete Saved Model
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={async () => {
                  // A reset must also discard the persisted model, or a
                  // reload would resurrect the pre-reset weights.
                  await deleteModel();
                  initializeModel(true);
                }}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300 motion-safe:transition-colors font-medium"
              >
                <span aria-hidden="true">🔄 </span>Reset AI Model
              </button>
              <button
                type="button"
                onClick={clearStorage}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-400 motion-safe:transition-colors font-medium"
              >
                <span aria-hidden="true">🗑️ </span>Clear Game History
              </button>
            </div>
          </section>
        </div>

        {gameHistory.length > 0 && (
          <section
            aria-labelledby="history-heading"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mt-6 motion-safe:transition-colors"
          >
            <h2 id="history-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">
              <span aria-hidden="true">📚 </span>Recent Game History
            </h2>
            <ul className="max-h-64 overflow-y-auto space-y-2">
              {gameHistory.slice(-10).reverse().map((game) => (
                <li
                  key={game.id}
                  aria-label={`At ${game.timestamp}, you played ${game.playerMove}, AI played ${game.aiMove}, ${game.result === 'win' ? 'you won' : game.result === 'loss' ? 'AI won' : 'tie'}`}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg motion-safe:transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl" role="img" aria-label={game.playerMove}>{MOVE_EMOJI[game.playerMove]}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300" aria-hidden="true">vs</span>
                    <span className="text-2xl" role="img" aria-label={game.aiMove}>{MOVE_EMOJI[game.aiMove]}</span>
                  </div>
                  <div className="text-center">
                    <span className={`font-bold ${playerWonClass(game.result)}`}>
                      {game.result === 'win' ? 'You Won!' : game.result === 'loss' ? 'AI Won!' : 'Tie!'}
                    </span>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{game.timestamp}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        </div>
        )}
        </main>
        <footer className="max-w-6xl mx-auto px-4 pb-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <a
            href="https://github.com/bshepp/tiny_ml_game"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-700 dark:hover:text-purple-300 underline focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 rounded"
          >
            github.com/bshepp/tiny_ml_game
          </a>
        </footer>
      </div>
      {telemetry.enabled && telemetry.consent === null && (
        <ConsentBanner onAccept={telemetry.grant} onDecline={telemetry.deny} />
      )}
      <StrategyInfoModal open={strategyInfoOpen} onClose={() => setStrategyInfoOpen(false)} />
    </div>
  );
};

export default App;