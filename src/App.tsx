import UserRoutes from "./routes";
import { store } from "./redux/store";
import { Provider } from "react-redux";
import { BrowserRouter as Router } from "react-router-dom";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { ShellProvider } from "./admin/shell/ShellContext";
import { RouteProvider } from "./providers/route-provider";

function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <Router>
          {/* React Aria's router bridge: an `href` inside any library component
              (a nav row, a linked table row, a menu item) navigates client-side
              through react-router instead of hard-reloading the panel. The
              panel's own `go()` in ui/nav.ts routes through the same navigate. */}
          <RouteProvider>
            <ShellProvider>
              <UserRoutes />
            </ShellProvider>
          </RouteProvider>
        </Router>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
