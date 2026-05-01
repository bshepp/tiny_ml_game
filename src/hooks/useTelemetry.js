// Anonymous telemetry consent + uploader.
// - Consent state is persisted to localStorage; default null = banner shown.
// - When granted, every game round is POSTed to the telemetry API (best effort).
// - Includes a stable per-browser sessionId (random uuid) so server can group rounds
//   without identifying the user.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendRound, telemetryEnabled } from '../api';

const CONSENT_KEY = 'tiny-ml-game-consent';
const SESSION_KEY = 'tiny-ml-game-session-id';

const safeGet = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const safeSet = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* no-op */ }
};

const randomId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

export const useTelemetry = () => {
  const [consent, setConsent] = useState(() => safeGet(CONSENT_KEY)); // 'granted' | 'denied' | null
  const sessionIdRef = useRef(null);

  if (sessionIdRef.current === null) {
    let id = safeGet(SESSION_KEY);
    if (!id) {
      id = randomId();
      safeSet(SESSION_KEY, id);
    }
    sessionIdRef.current = id;
  }

  const grant = useCallback(() => {
    safeSet(CONSENT_KEY, 'granted');
    setConsent('granted');
  }, []);

  const deny = useCallback(() => {
    safeSet(CONSENT_KEY, 'denied');
    setConsent('denied');
  }, []);

  const reset = useCallback(() => {
    safeSet(CONSENT_KEY, '');
    setConsent(null);
  }, []);

  const recordRound = useCallback((round) => {
    if (consent !== 'granted' || !telemetryEnabled()) return;
    // Fire-and-forget: never block the UI on telemetry.
    sendRound({
      sessionId: sessionIdRef.current,
      schemaVersion: 1,
      timestamp: new Date().toISOString(),
      ...round,
    }).catch(() => { /* swallow */ });
  }, [consent]);

  // Re-read consent if another tab updates it.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === CONSENT_KEY) setConsent(e.newValue || null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return useMemo(() => ({
    consent,
    grant,
    deny,
    reset,
    recordRound,
    enabled: telemetryEnabled(),
    sessionId: sessionIdRef.current,
  }), [consent, grant, deny, reset, recordRound]);
};
