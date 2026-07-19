import React from 'react';

const ConsentBanner = ({ onAccept, onDecline }) => (
  <div
    role="status"
    aria-label="Anonymous data collection"
    className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-md z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-2xl shadow-2xl p-4 motion-safe:transition-colors"
  >
    <h2 className="text-base font-bold text-gray-900 dark:text-gray-50 mb-1">
      Help improve the AI?
    </h2>
    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
      Roshambot can collect anonymous game rounds (your moves, the AI&apos;s moves, the
      strategy + model architecture in use) to power the global Stats tab. No accounts,
      no personal data, no cookies. You can change your mind anytime.
    </p>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onAccept}
        className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 motion-safe:transition-colors font-medium text-sm"
      >
        Accept
      </button>
      <button
        type="button"
        onClick={onDecline}
        className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-400 motion-safe:transition-colors font-medium text-sm"
      >
        No thanks
      </button>
    </div>
  </div>
);

export default ConsentBanner;
