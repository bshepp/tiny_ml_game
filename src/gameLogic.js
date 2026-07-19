// Pure game logic — no React, no TF.js. Safe to unit-test directly.

export const MOVE_NAMES = ['Rock', 'Paper', 'Scissors'];

export const MOVE_EMOJI = { Rock: '🗿', Paper: '📄', Scissors: '✂️' };

export const SEQUENCE_LENGTH = 5;
export const FEATURES_PER_STEP = 3;
export const SEQUENCE_FEATURES = SEQUENCE_LENGTH * FEATURES_PER_STEP; // 15

/**
 * Returns the move that beats `move`.
 * Rock -> Paper, Paper -> Scissors, Scissors -> Rock.
 */
export const getCounterMove = (move) => {
  const idx = MOVE_NAMES.indexOf(move);
  if (idx === -1) return MOVE_NAMES[Math.floor(Math.random() * 3)];
  return MOVE_NAMES[(idx + 1) % 3];
};

/**
 * Determines the round outcome from the player's perspective.
 */
export const getResult = (playerMove, aiMove) => {
  if (playerMove === aiMove) return 'tie';
  if (
    (playerMove === 'Rock' && aiMove === 'Scissors') ||
    (playerMove === 'Scissors' && aiMove === 'Paper') ||
    (playerMove === 'Paper' && aiMove === 'Rock')
  ) {
    return 'win';
  }
  return 'loss';
};

/**
 * Encodes the last 5 games into a flat 15-feature vector,
 * normalized to 0..1. Each step contributes (playerIdx, aiIdx, resultIdx).
 *
 * Short histories are right-aligned: the most recent game always occupies
 * the final timestep, with zero-padding at the front. Otherwise the GRU and
 * transformer would see the padding as the most recent moves.
 */
export const encodeGameSequence = (history) => {
  const sequence = new Array(SEQUENCE_FEATURES).fill(0);
  const recent = history.slice(-SEQUENCE_LENGTH);
  const offset = SEQUENCE_LENGTH - recent.length;

  recent.forEach((game, idx) => {
    const playerIdx = MOVE_NAMES.indexOf(game.playerMove);
    const aiIdx = MOVE_NAMES.indexOf(game.aiMove);
    const resultIdx = game.result === 'win' ? 0 : game.result === 'loss' ? 1 : 2;

    if (playerIdx !== -1 && aiIdx !== -1) {
      const step = offset + idx;
      sequence[step * FEATURES_PER_STEP] = playerIdx / 2;
      sequence[step * FEATURES_PER_STEP + 1] = aiIdx / 2;
      sequence[step * FEATURES_PER_STEP + 2] = resultIdx / 2;
    }
  });

  return sequence;
};

/**
 * Shannon entropy (base 3, normalized to 0..1) of player moves over a history window.
 * 1.0 = perfectly unpredictable across Rock/Paper/Scissors; 0.0 = always the same move.
 */
export const playerMoveEntropy = (history, windowSize = 20) => {
  if (!history || history.length === 0) return 1;
  const window = history.slice(-windowSize);
  const counts = { Rock: 0, Paper: 0, Scissors: 0 };
  window.forEach((g) => {
    if (counts[g.playerMove] !== undefined) counts[g.playerMove] += 1;
  });
  const total = counts.Rock + counts.Paper + counts.Scissors;
  if (total === 0) return 1;
  let h = 0;
  Object.values(counts).forEach((c) => {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log(p);
    }
  });
  // Normalize by ln(3) so a uniform distribution = 1.
  return h / Math.log(3);
};
