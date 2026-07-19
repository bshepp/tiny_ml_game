import React from 'react';

// Catches render-time errors in a subtree (e.g. unexpected API data shapes)
// and shows a recoverable fallback instead of white-screening the whole app.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unexpected render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl p-6 text-red-800 dark:text-red-200"
        >
          <p className="mb-3">Something went wrong rendering this panel.</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
