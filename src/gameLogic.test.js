import {
  MOVE_NAMES,
  getCounterMove,
  getResult,
  encodeGameSequence,
  playerMoveEntropy,
  SEQUENCE_FEATURES,
} from './gameLogic';

describe('getCounterMove', () => {
  test('Rock -> Paper, Paper -> Scissors, Scissors -> Rock', () => {
    expect(getCounterMove('Rock')).toBe('Paper');
    expect(getCounterMove('Paper')).toBe('Scissors');
    expect(getCounterMove('Scissors')).toBe('Rock');
  });

  test('returns a valid move for unknown input', () => {
    const out = getCounterMove('Lizard');
    expect(MOVE_NAMES).toContain(out);
  });
});

describe('getResult', () => {
  test('ties when moves match', () => {
    expect(getResult('Rock', 'Rock')).toBe('tie');
    expect(getResult('Paper', 'Paper')).toBe('tie');
  });

  test('player wins canonical pairs', () => {
    expect(getResult('Rock', 'Scissors')).toBe('win');
    expect(getResult('Scissors', 'Paper')).toBe('win');
    expect(getResult('Paper', 'Rock')).toBe('win');
  });

  test('player loses canonical pairs', () => {
    expect(getResult('Scissors', 'Rock')).toBe('loss');
    expect(getResult('Paper', 'Scissors')).toBe('loss');
    expect(getResult('Rock', 'Paper')).toBe('loss');
  });
});

describe('encodeGameSequence', () => {
  test('returns a 15-length zero vector for empty history', () => {
    const seq = encodeGameSequence([]);
    expect(seq).toHaveLength(SEQUENCE_FEATURES);
    expect(seq.every((v) => v === 0)).toBe(true);
  });

  test('only encodes the last 5 games', () => {
    const game = { playerMove: 'Rock', aiMove: 'Paper', result: 'loss' };
    const history = Array(10).fill(game);
    const seq = encodeGameSequence(history);
    expect(seq).toHaveLength(SEQUENCE_FEATURES);
    // All five steps populated
    for (let i = 0; i < 5; i++) {
      expect(seq[i * 3]).toBe(0); // Rock idx 0
      expect(seq[i * 3 + 1]).toBe(0.5); // Paper idx 1 / 2
      expect(seq[i * 3 + 2]).toBe(0.5); // loss idx 1 / 2
    }
  });

  test('normalizes Scissors=1 and win=0 correctly (single game, last slot)', () => {
    const seq = encodeGameSequence([{ playerMove: 'Scissors', aiMove: 'Scissors', result: 'win' }]);
    // Right-aligned: a single game occupies the most-recent timestep (slot 4).
    expect(seq[12]).toBe(1);
    expect(seq[13]).toBe(1);
    expect(seq[14]).toBe(0);
    // Earlier timesteps are padding.
    expect(seq.slice(0, 12).every((v) => v === 0)).toBe(true);
  });

  test('right-aligns short histories so the latest game is always at the last timestep', () => {
    const older = { playerMove: 'Rock', aiMove: 'Rock', result: 'tie' };
    const latest = { playerMove: 'Paper', aiMove: 'Scissors', result: 'loss' };
    const seq = encodeGameSequence([older, older, latest]);

    // Latest game must sit at timestep 4 regardless of history length,
    // so the recurrent/attention models see padding as the distant past,
    // not as the most recent moves.
    expect(seq[12]).toBe(0.5); // Paper
    expect(seq[13]).toBe(1); // Scissors
    expect(seq[14]).toBe(0.5); // loss
    // The two older games fill timesteps 2 and 3; 0 and 1 are padding.
    expect(seq[6]).toBe(0); // Rock at timestep 2
    expect(seq[8]).toBe(1); // tie
    expect(seq.slice(0, 6).every((v) => v === 0)).toBe(true);
  });
});

describe('playerMoveEntropy', () => {
  test('returns 1 for empty history', () => {
    expect(playerMoveEntropy([])).toBe(1);
  });

  test('returns 0 when all moves are the same', () => {
    const history = Array(10).fill({ playerMove: 'Rock', aiMove: 'Paper', result: 'loss' });
    expect(playerMoveEntropy(history)).toBe(0);
  });

  test('returns ~1 for a uniform distribution', () => {
    const history = [];
    ['Rock', 'Paper', 'Scissors'].forEach((m) => {
      for (let i = 0; i < 6; i++) history.push({ playerMove: m, aiMove: 'Rock', result: 'tie' });
    });
    expect(playerMoveEntropy(history)).toBeCloseTo(1, 5);
  });
});
