import React from 'react';

const AboutTab = ({ backend, telemetryStatus, onResetConsent }) => (
  <div className="space-y-6">
    <section
      aria-labelledby="about-heading"
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
    >
      <h2 id="about-heading" className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">
        About Roshambot
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-3">
        A pocket-sized neural network learning Rock Paper Scissors against you, in your
        browser. No backend required to play; everything trains on-device with TensorFlow.js.
      </p>
      <p className="text-gray-700 dark:text-gray-300 mb-3">
        You can pick which model architecture the AI uses — a simple MLP, a recurrent GRU,
        or a tiny self-attention Transformer. Each one sees the same encoded last-5-rounds
        sequence and predicts your next move.
      </p>
      <p className="text-gray-700 dark:text-gray-300">
        Source on{' '}
        <a
          href="https://github.com/bshepp/tiny_ml_game"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-700 dark:text-purple-300 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 rounded"
        >
          GitHub
        </a>.
      </p>
    </section>

    <section
      aria-labelledby="runtime-heading"
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
    >
      <h2 id="runtime-heading" className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-3">
        Runtime
      </h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-600 dark:text-gray-300">TF.js backend</dt>
        <dd className="font-mono text-gray-900 dark:text-gray-100">{backend || 'unknown'}</dd>
        <dt className="text-gray-600 dark:text-gray-300">Telemetry</dt>
        <dd className="font-mono text-gray-900 dark:text-gray-100">{telemetryStatus}</dd>
      </dl>
      {onResetConsent && (
        <button
          type="button"
          onClick={onResetConsent}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-400 text-sm"
        >
          Reset data-collection choice
        </button>
      )}
    </section>

    <section
      aria-labelledby="privacy-heading"
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 motion-safe:transition-colors"
    >
      <h2 id="privacy-heading" className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-3">
        Privacy
      </h2>
      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
        <li>No accounts, no logins, no cookies.</li>
        <li>Game history and trained weights stay on your device unless you accept the data-collection prompt.</li>
        <li>If you accept, only anonymized round records are sent: the moves, the result, the strategy, and the model architecture.</li>
        <li>A random session id is generated per browser so rounds can be grouped without identifying you.</li>
      </ul>
    </section>
  </div>
);

export default AboutTab;
