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
        <div role="alert" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "40px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: "#6b7280", maxWidth: 420 }}>An unexpected error occurred while showing this page.</p>
          <button
            type="button"
            style={{ padding: "10px 22px", borderRadius: 999, fontWeight: 600, cursor: "pointer", background: "#0f3d2e", color: "#fff", border: "none" }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
