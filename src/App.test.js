import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders game title', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Rock Paper Scissors/i)).toBeInTheDocument();
    });
  });

  test('renders all three move buttons', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rock/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /paper/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scissors/i })).toBeInTheDocument();
  });

  test('shows result after clicking a move', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /rock/i }));

    await waitFor(() => {
      expect(screen.getByText(/You win!|AI wins!|It's a tie!/i)).toBeInTheDocument();
    });
  });

  test('displays game statistics section', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Game Statistics/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Wins')).toBeInTheDocument();
    expect(screen.getByText('Losses')).toBeInTheDocument();
    expect(screen.getByText('Ties')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
  });

  test('displays all AI strategy options', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/AI Strategy/i)).toBeInTheDocument();
    });
    expect(screen.getByText('random')).toBeInTheDocument();
    expect(screen.getByText('counter')).toBeInTheDocument();
    expect(screen.getByText('pattern')).toBeInTheDocument();
    expect(screen.getByText('learning')).toBeInTheDocument();
  });

  test('shows game history after playing', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /rock/i }));

    await waitFor(() => {
      expect(screen.getByText(/Recent Game History/i)).toBeInTheDocument();
    });
  });

  test('can switch AI strategy', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('counter')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('counter'));

    const counterButtons = screen.getAllByRole('button', { name: /counter/i });
    const strategyButton = counterButtons.find((btn) => btn.textContent.includes('Counters'));
    expect(strategyButton).toHaveClass('bg-purple-100');
  });

  test('disables learning strategy when model is unavailable', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/model unavailable/i)).toBeInTheDocument();
    });

    const learningButtons = screen.getAllByRole('button', { name: /learning/i });
    const strategyButton = learningButtons.find((btn) => btn.textContent.includes('Neural'));
    expect(strategyButton).toBeDisabled();
  });

  test('has reset and clear buttons', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reset AI Model/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Clear Game History/i })).toBeInTheDocument();
  });
});

describe('localStorage Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('can store and retrieve game data structure', () => {
    const gameData = {
      gameHistory: [
        { playerMove: 'Rock', aiMove: 'Scissors', result: 'win', timestamp: '12:00:00', id: 1 },
      ],
      lastUpdated: Date.now(),
    };

    localStorage.setItem('tiny-ml-game-data', JSON.stringify(gameData));
    const retrieved = JSON.parse(localStorage.getItem('tiny-ml-game-data'));

    expect(retrieved.gameHistory).toHaveLength(1);
    expect(retrieved.gameHistory[0].result).toBe('win');
  });

  test('loads saved game history on mount', async () => {
    const savedData = {
      gameHistory: [
        { playerMove: 'Paper', aiMove: 'Rock', result: 'win', timestamp: '10:00:00', id: 123 },
        { playerMove: 'Rock', aiMove: 'Paper', result: 'loss', timestamp: '10:01:00', id: 124 },
      ],
      lastUpdated: Date.now(),
    };
    localStorage.setItem('tiny-ml-game-data', JSON.stringify(savedData));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Recent Game History/i)).toBeInTheDocument();
    });
  });

  test('clears game history when clear button is clicked', async () => {
    const savedData = {
      gameHistory: [
        { playerMove: 'Rock', aiMove: 'Scissors', result: 'win', timestamp: '10:00:00', id: 1 },
      ],
      lastUpdated: Date.now(),
    };
    localStorage.setItem('tiny-ml-game-data', JSON.stringify(savedData));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Recent Game History/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear Game History/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Recent Game History/i)).not.toBeInTheDocument();
    });
  });
});

describe('Model Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('model metadata can be stored in localStorage', () => {
    const modelMeta = {
      exists: true,
      lastSaved: new Date().toISOString(),
    };

    localStorage.setItem('tiny-ml-game-model-meta', JSON.stringify(modelMeta));
    const retrieved = JSON.parse(localStorage.getItem('tiny-ml-game-model-meta'));

    expect(retrieved.exists).toBe(true);
    expect(retrieved.lastSaved).toBeDefined();
  });
});
