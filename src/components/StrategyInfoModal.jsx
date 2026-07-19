import React, { useEffect, useRef } from 'react';
import { MODEL_ARCHITECTURES, ARCH_LABELS, ARCH_DESCRIPTIONS } from '../models';

const STRATEGY_DETAILS = [
  {
    key: 'learning',
    name: 'Learning',
    emoji: '🤖',
    summary: 'Neural network learns your style.',
    body: 'After every round it trains on your most recent games and predicts what you\'ll play next. It then plays the move that beats that prediction. Predictions are sampled from a probability distribution (not argmax), with randomness annealing from 30% down to 5% as it gathers more data — so it commits to learned patterns over time. Pick the network architecture below.',
  },
  {
    key: 'pattern',
    name: 'Pattern',
    emoji: '🧠',
    summary: 'Detects patterns in your play.',
    body: 'A simple frequency counter over your last several moves. It picks the move that beats whatever you have played most often recently. No neural network involved.',
  },
  {
    key: 'counter',
    name: 'Counter',
    emoji: '🔄',
    summary: 'Counters your last move.',
    body: 'Always plays the move that beats whatever you played last round. Trivially exploitable once you notice it, but surprisingly effective against players who fall into streaks.',
  },
  {
    key: 'random',
    name: 'Random',
    emoji: '🎲',
    summary: 'Completely random moves.',
    body: 'Uniform 1/3 chance for each move. The Nash-equilibrium baseline — unbeatable in expectation, but also unable to exploit any tendency you have.',
  },
];

const ARCH_DETAILS = {
  dense:
    'Three fully-connected layers (128 → 64 → 32 → 3) with ReLU, L2 regularization, and dropout. Treats the 15 input features as a flat vector — fast and a strong baseline, but blind to the temporal order of your moves.',
  gru:
    'Reshapes the 15 features into a (5 step × 3 feature) sequence and runs it through a GRU recurrent cell, then a small dense head. Better at picking up order-sensitive patterns like "after a loss I always switch."',
  transformer:
    'A single self-attention head (d_model = 8) with Q/K/V projections, scaled dot-product attention, residual + layer-norm, feed-forward, and global average pooling. ~1k parameters total, but architecturally the same family as modern LLMs.',
};

const StrategyInfoModal = ({ open, onClose }) => {
  const closeBtnRef = useRef(null);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current = document.activeElement;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // aria-modal promises the background is inert — keep Tab inside the
      // dialog so keyboard focus can't wander into the dimmed page.
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    closeBtnRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/60 motion-safe:transition-colors overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-info-title"
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8 motion-safe:transition-colors"
      >
        <div className="flex items-start justify-between mb-4">
          <h2
            id="strategy-info-title"
            className="text-2xl font-bold text-gray-900 dark:text-gray-50"
          >
            How the AI plays
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-4 -mt-1 -mr-1 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 motion-safe:transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <section aria-labelledby="strategy-info-strategies-heading" className="mb-6">
          <h3
            id="strategy-info-strategies-heading"
            className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3"
          >
            AI strategies
          </h3>
          <ul className="space-y-3">
            {STRATEGY_DETAILS.map((s) => (
              <li
                key={s.key}
                className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg motion-safe:transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-gray-50">
                  <span aria-hidden="true">{s.emoji} </span>
                  {s.name}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{s.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="strategy-info-arch-heading">
          <h3
            id="strategy-info-arch-heading"
            className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1"
          >
            Neural model architectures
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            Available when the <strong>Learning</strong> strategy is selected. All three take the
            same input (5 most recent rounds × 3 features each = 15 numbers) and output a 3-way
            softmax over Rock / Paper / Scissors.
          </p>
          <ul className="space-y-3">
            {MODEL_ARCHITECTURES.map((arch) => (
              <li
                key={arch}
                className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg motion-safe:transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-gray-50">
                  {ARCH_LABELS[arch]}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {ARCH_DETAILS[arch] || ARCH_DESCRIPTIONS[arch]}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 motion-safe:transition-colors font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default StrategyInfoModal;
