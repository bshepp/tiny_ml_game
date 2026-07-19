import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const Bomb = ({ defused }) => {
  if (!defused) throw new Error('boom');
  return <div>all good</div>;
};

describe('ErrorBoundary', () => {
  test('shows an alert fallback instead of white-screening when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb defused={false} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  test('retry resets the boundary and re-renders children', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <Bomb defused={false} />
      </ErrorBoundary>
    );
    rerender(
      <ErrorBoundary>
        <Bomb defused />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('all good')).toBeInTheDocument();
    spy.mockRestore();
  });
});
