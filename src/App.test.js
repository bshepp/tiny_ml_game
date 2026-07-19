import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

    const counterRadios = screen.getAllByRole('radio', { name: /counter/i });
    const strategyButton = counterRadios.find((btn) => btn.textContent.includes('Counters'));
    expect(strategyButton).toHaveClass('bg-purple-100');
  });

  test('disables learning strategy when model is unavailable', async () => {
    // Force model initialization to fail so we deterministically exercise
    // the fallback UI (rather than relying on an incidental JSDOM error).
    const tf = require('@tensorflow/tfjs');
    tf.loadLayersModel.mockRejectedValueOnce(new Error('not found'));
    tf.sequential.mockImplementationOnce(() => {
      throw new Error('test: model unavailable');
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/model unavailable/i)).toBeInTheDocument();
    });

    const learningRadios = screen.getAllByRole('radio', { name: /learning/i });
    const strategyButton = learningRadios.find((btn) => btn.textContent.includes('Neural'));
    expect(strategyButton).toBeDisabled();
  });

  test('learning strategy is available once the model initializes', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rock/i })).toBeEnabled();
    });

    // Model init must have succeeded: no error banner, and the learning
    // strategy (the default) is selectable rather than "(model unavailable)".
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const learningRadios = screen.getAllByRole('radio', { name: /learning/i });
    const strategyButton = learningRadios.find((btn) => btn.textContent.includes('Neural'));
    expect(strategyButton).toBeEnabled();
    expect(strategyButton).not.toHaveTextContent(/model unavailable/i);
  });

  test('rapid successive moves are all recorded', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    // Two clicks before the first (async) round resolves — neither may be lost.
    fireEvent.click(screen.getByRole('button', { name: /play rock/i }));
    fireEvent.click(screen.getByRole('button', { name: /play scissors/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
  });

  test('holding a shortcut key down does not auto-repeat moves', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'r', repeat: true });

    await waitFor(() => {
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });
    // Let any (buggy) auto-repeated round land before asserting the count.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  test('shortcuts do not play while the strategy info modal is open', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /about ai strategies/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'r' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  test('shortcuts do not play from other tabs', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('tab', { name: /about/i }));
    fireEvent.keyDown(window, { key: 'r' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    fireEvent.click(screen.getByRole('tab', { name: /game/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeInTheDocument();
    });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  test('typing in the architecture select does not play a move', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    const select = screen.getByLabelText(/neural model architecture/i);
    select.focus();
    fireEvent.keyDown(select, { key: 's' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  test('keyboard shortcuts can be turned off and back on', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play rock/i })).toBeEnabled();
    });

    const toggle = screen.getByRole('checkbox', { name: /keyboard shortcuts/i });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    fireEvent.keyDown(window, { key: 'r' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    fireEvent.click(toggle);
    fireEvent.keyDown(window, { key: 'r' });
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
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
