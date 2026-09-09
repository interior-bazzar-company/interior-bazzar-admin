// ── ErrorBoundary ── last-resort catch for render-time throws so one broken
// view can't blank the whole admin console.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";

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
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.setState({ hasError: false });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-primary">Something went wrong</h1>
          <p className="max-w-md text-sm text-tertiary">An unexpected error occurred while showing this page. Nothing was changed.</p>
          <Button color="secondary" size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
