// Telemetry endpoint client. Configure via REACT_APP_TELEMETRY_URL.
// Both endpoints are no-ops if the URL is not set (offline / no infra deployed).

const BASE_URL = process.env.REACT_APP_TELEMETRY_URL || '';

const isEnabled = () => Boolean(BASE_URL);

export const sendRound = async (payload) => {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/round`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // keepalive lets the request finish if the page is unloading.
      keepalive: true,
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

export const fetchStats = async () => {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/stats`);
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

export const telemetryEnabled = isEnabled;
