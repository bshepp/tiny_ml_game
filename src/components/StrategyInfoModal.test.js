import { render, screen, fireEvent } from '@testing-library/react';
import StrategyInfoModal from './StrategyInfoModal';

describe('StrategyInfoModal accessibility', () => {
  test('moves initial focus to the close button', () => {
    render(<StrategyInfoModal open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
  });

  test('traps Tab focus inside the dialog', () => {
    render(<StrategyInfoModal open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const closeBtn = screen.getByRole('button', { name: /close/i });
    const gotIt = screen.getByRole('button', { name: /got it/i });

    // Tab on the last focusable wraps to the first…
    gotIt.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(closeBtn).toHaveFocus();

    // …and Shift+Tab on the first wraps to the last.
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(gotIt).toHaveFocus();
  });

  test('locks background scroll while open and restores it on close', () => {
    const { rerender } = render(<StrategyInfoModal open onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<StrategyInfoModal open={false} onClose={() => {}} />);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  test('restores focus to the previously focused element on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'info';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<StrategyInfoModal open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();

    rerender(<StrategyInfoModal open={false} onClose={() => {}} />);
    expect(trigger).toHaveFocus();

    document.body.removeChild(trigger);
  });

  test('closes on Escape', () => {
    const onClose = jest.fn();
    render(<StrategyInfoModal open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
