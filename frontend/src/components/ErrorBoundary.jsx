import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Catches render-time errors in a subtree so a transient data shape (e.g. while
// the backend is mid-restart) never white-screens the whole dashboard. Shows a
// friendly fallback with a local retry that re-mounts the subtree — no full
// page reload required.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, key: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  retry = () => this.setState((s) => ({ error: null, key: s.key + 1 }));

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mb-4">
            <AlertTriangle className="text-amber-600" size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">This view hit a snag</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-5">
            The dashboard stayed up. This is usually a transient data gap (e.g. the
            backend reconnecting). Retry — no reload needed.
          </p>
          <button
            onClick={this.retry}
            className="px-5 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-2"
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}

export default ErrorBoundary;
