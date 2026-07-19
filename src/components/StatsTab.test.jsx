import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import StatsTab from './StatsTab';
import { fetchStats } from '../api';

vi.mock('../api', () => ({
  fetchStats: vi.fn(),
  telemetryEnabled: vi.fn().mockReturnValue(true),
  sendRound: vi.fn(),
}));

const statsData = (overrides = {}) => ({
  totalRounds: 5,
  byMove: {},
  byResult: {},
  byStrategy: {},
  byArch: {},
  ...overrides,
});

describe('StatsTab robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders malformed per-strategy entries as zero instead of crashing', async () => {
    fetchStats.mockResolvedValueOnce({
      ok: true,
      data: statsData({ byStrategy: { learning: null, pattern: { n: 3, winRate: 0.5 } } }),
    });

    render(<StatsTab />);

    expect(await screen.findByText(/win rate by ai strategy/i)).toBeInTheDocument();
    expect(screen.getByText(/0 rounds · player wins 0%/)).toBeInTheDocument();
    expect(screen.getByText(/3 rounds · player wins 50%/)).toBeInTheDocument();
  });

  test('a stale slow response does not overwrite a newer one', async () => {
    let resolveStale;
    fetchStats
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveStale = resolve; })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, data: statsData({ totalRounds: 42 }) })
      );

    // StrictMode double-invokes the mount effect, issuing two loads whose
    // responses arrive out of order.
    render(
      <StrictMode>
        <StatsTab />
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    resolveStale({ ok: true, data: statsData({ totalRounds: 7 }) });
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });
});
