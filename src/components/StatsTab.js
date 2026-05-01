// Global stats dashboard. Fetches aggregate stats from the telemetry API
// and renders simple bar charts. Degrades gracefully when no API is configured.

import React, { useEffect, useState } from 'react';
import { fetchStats, telemetryEnabled } from '../api';

const Bar = ({ label, value, total, color = 'purple' }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorClass = {
    purple: 'bg-purple-500 dark:bg-purple-400',
    green: 'bg-green-500 dark:bg-green-400',
    red: 'bg-red-500 dark:bg-red-400',
    blue: 'bg-blue-500 dark:bg-blue-400',
    yellow: 'bg-yellow-500 dark:bg-yellow-400',
  }[color] || 'bg-purple-500 dark:bg-purple-400';

  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700 dark:text-gray-200 font-medium capitalize">{label}</span>
        <span className="text-gray-600 dark:text-gray-300" aria-hidden="true">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label}: ${value} of ${total} (${pct} percent)`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
      >
        <div
          className={`h-full motion-safe:transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const StatsTab = () => {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = async () => {
    setState({ loading: true, error: null, data: null });
    if (!telemetryEnabled()) {
      setState({ loading: false, error: 'no-api', data: null });
      return;
    }
    const res = await fetchStats();
    if (res.ok) setState({ loading: false, error: null, data: res.data });
    else setState({ loading: false, error: res.error || 'fetch-failed', data: null });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.loading) {
    return (
      <div role="status" className="text-center py-12 text-gray-700 dark:text-gray-300">
        Loading global stats…
      </div>
    );
  }

  if (state.error === 'no-api') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-gray-700 dark:text-gray-300">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">
          Global Stats
        </h2>
        <p>
          The global stats backend isn&apos;t configured for this build. Set the
          <code className="mx-1 px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">REACT_APP_TELEMETRY_URL</code>
          environment variable at build time and deploy the AWS infra in
          <code className="mx-1 px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">infra/</code>
          to enable it.
        </p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl p-6 text-red-800 dark:text-red-200">
        <p className="mb-3">Couldn&apos;t load global stats: {state.error}</p>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = state.data || {};
  const totalRounds = data.totalRounds || 0;
  const byMove = data.byMove || {};
  const byResult = data.byResult || {};
  const byStrategy = data.byStrategy || {};
  const byArch = data.byArch || {};

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="global-summary-heading"
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
      >
        <h2 id="global-summary-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">
          <span aria-hidden="true">🌍 </span>Global Stats
        </h2>
        <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mb-1">
          {totalRounds.toLocaleString()}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">total rounds played by everyone</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section
          aria-labelledby="byresult-heading"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
        >
          <h2 id="byresult-heading" className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-3">
            Outcomes
          </h2>
          <Bar label="player wins" value={byResult.win || 0} total={totalRounds} color="green" />
          <Bar label="ai wins" value={byResult.loss || 0} total={totalRounds} color="red" />
          <Bar label="ties" value={byResult.tie || 0} total={totalRounds} color="yellow" />
        </section>

        <section
          aria-labelledby="bymove-heading"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
        >
          <h2 id="bymove-heading" className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-3">
            Player move distribution
          </h2>
          <Bar label="rock" value={byMove.Rock || 0} total={totalRounds} color="blue" />
          <Bar label="paper" value={byMove.Paper || 0} total={totalRounds} color="purple" />
          <Bar label="scissors" value={byMove.Scissors || 0} total={totalRounds} color="green" />
        </section>
      </div>

      {Object.keys(byStrategy).length > 0 && (
        <section
          aria-labelledby="bystrategy-heading"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
        >
          <h2 id="bystrategy-heading" className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-3">
            Win rate by AI strategy
          </h2>
          <ul className="space-y-2">
            {Object.entries(byStrategy).map(([k, v]) => (
              <li key={k} className="flex justify-between text-sm">
                <span className="capitalize text-gray-800 dark:text-gray-100">{k}</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {v.n?.toLocaleString?.() || 0} rounds · player wins {Math.round((v.winRate || 0) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(byArch).length > 0 && (
        <section
          aria-labelledby="byarch-heading"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
        >
          <h2 id="byarch-heading" className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-3">
            Win rate by model architecture
          </h2>
          <ul className="space-y-2">
            {Object.entries(byArch).map(([k, v]) => (
              <li key={k} className="flex justify-between text-sm">
                <span className="capitalize text-gray-800 dark:text-gray-100">{k}</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {v.n?.toLocaleString?.() || 0} rounds · player wins {Math.round((v.winRate || 0) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-400"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default StatsTab;
