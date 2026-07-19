import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { sendRound } from './api';

// Mock the API module so telemetry is "configured" and we can inspect the
// exact payload the app would POST to the Lambda.
jest.mock('./api', () => ({
  sendRound: jest.fn().mockResolvedValue({ ok: true }),
  fetchStats: jest.fn().mockResolvedValue({}),
  telemetryEnabled: jest.fn().mockReturnValue(true),
}));

describe('Telemetry payload contract', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('posts rounds matching the Lambda schema (top-level move fields)', async () => {
    localStorage.setItem('tiny-ml-game-consent', 'granted');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /rock/i }));

    await waitFor(() => {
      expect(sendRound).toHaveBeenCalledTimes(1);
    });

    const payload = sendRound.mock.calls[0][0];

    // The Lambda's validateRound hard-requires these three at top level.
    expect(payload.playerMove).toBe('Rock');
    expect(['Rock', 'Paper', 'Scissors']).toContain(payload.aiMove);
    expect(['win', 'loss', 'tie']).toContain(payload.result);

    expect(payload.strategy).toBe('learning');
    expect(payload.modelArch).toBe('dense');
    expect(payload.sessionId).toEqual(expect.any(String));
    expect(payload.schemaVersion).toBe(1);

    // Sequence: at most 6 recent rounds, each with exactly the three keys
    // the Lambda accepts, the last entry being this round.
    expect(Array.isArray(payload.sequence)).toBe(true);
    expect(payload.sequence.length).toBeLessThanOrEqual(6);
    payload.sequence.forEach((entry) => {
      expect(Object.keys(entry).sort()).toEqual(['aiMove', 'playerMove', 'result']);
    });
    expect(payload.sequence[payload.sequence.length - 1]).toEqual({
      playerMove: payload.playerMove,
      aiMove: payload.aiMove,
      result: payload.result,
    });
  });

  test('does not post when consent has not been granted', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /rock/i }));

    await waitFor(() => {
      expect(screen.getByText(/You win!|AI wins!|It's a tie!/i)).toBeInTheDocument();
    });
    expect(sendRound).not.toHaveBeenCalled();
  });
});
