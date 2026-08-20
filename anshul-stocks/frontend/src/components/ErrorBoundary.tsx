import React from 'react';

/**
 * ErrorBoundary — catches render-time errors in its subtree and shows a small
 * inline error state INSTEAD of letting React unmount the entire application
 * (which is what produces the "blank dark screen" bug).
 *
 * The fallback can be:
 *  - a React node  → rendered as-is
 *  - a function    → receives (error, reset) and must return a React node
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?:
    | React.ReactNode
    | ((error: Error, reset: () => void) => React.ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { fallback, children } = this.props;

    if (error) {
      if (typeof fallback === 'function') {
        return fallback(error, this.reset) as React.ReactNode;
      }
      if (fallback !== undefined) {
        return fallback;
      }
      // Generic default fallback — never blank the page.
      return (
        <div
          className="p-4 rounded-2xl bg-[#111827] border border-red-500/40 text-sm text-red-300 space-y-2 max-w-2xl"
          role="alert"
        >
          <p className="font-semibold">⚠️ Something went wrong rendering this content.</p>
          {error.message && (
            <p className="text-xs font-mono text-red-400/90 break-words">{error.message}</p>
          )}
          <button
            onClick={this.reset}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
