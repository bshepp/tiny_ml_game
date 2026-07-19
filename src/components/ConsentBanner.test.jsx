import { render, screen, fireEvent } from '@testing-library/react';
import ConsentBanner from './ConsentBanner';

describe('ConsentBanner', () => {
  test('is announced to screen readers when it appears', () => {
    render(<ConsentBanner onAccept={() => {}} onDecline={() => {}} />);
    // role="status" announces the banner on mount/remount (e.g. after
    // "Reset data-collection choice" brings it back mid-session).
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('offers working accept and decline actions', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(<ConsentBanner onAccept={onAccept} onDecline={onDecline} />);

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /decline|no thanks/i }));
    expect(onDecline).toHaveBeenCalled();
  });
});
