// ── ErrorBoundary ── last-resort catch for render-time throws so one broken
// view can't blank the whole admin console.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Changes to this clear a showing error. Use it INSTEAD of `key` for that
   *  job: a key change destroys and rebuilds the children on every change,
   *  which threw away a healthy view's state (and its fetched data) on every
   *  navigation. This only fires when there is an error to clear. */
  resetKey?: string;
}
interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey)
      this.setState({ hasError: false });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 20px", textAlign: "center", color: "var(--text)" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 600, letterSpacing: "-.02em" }}>Something went wrong</h1>
          <p style={{ color: "var(--text-3)", maxWidth: 420 }}>An unexpected error occurred while showing this page.</p>
          {/* The panel's own primary button, so the last-resort screen is on
              the same tokens as everything it stands in for. */}
          <button type="button" className="btn pri" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
