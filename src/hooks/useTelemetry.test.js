import { renderHook, act } from '@testing-library/react';
import { useTelemetry } from './useTelemetry';

describe('useTelemetry consent state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('reset clears stored consent so the banner can return after reload', () => {
    localStorage.setItem('tiny-ml-game-consent', 'granted');

    const { result } = renderHook(() => useTelemetry());
    expect(result.current.consent).toBe('granted');

    act(() => {
      result.current.reset();
    });

    expect(result.current.consent).toBeNull();
    // A reload re-reads this key; anything other than null re-suppresses the banner.
    expect(localStorage.getItem('tiny-ml-game-consent')).toBeNull();
  });

  test('treats a legacy empty-string consent value as no choice', () => {
    localStorage.setItem('tiny-ml-game-consent', '');

    const { result } = renderHook(() => useTelemetry());

    expect(result.current.consent).toBeNull();
  });

  test('grant and deny persist their choice', () => {
    const { result } = renderHook(() => useTelemetry());

    act(() => {
      result.current.grant();
    });
    expect(localStorage.getItem('tiny-ml-game-consent')).toBe('granted');

    act(() => {
      result.current.deny();
    });
    expect(localStorage.getItem('tiny-ml-game-consent')).toBe('denied');
  });
});
