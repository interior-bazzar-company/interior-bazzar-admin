import UserRoutes from "./routes";
import { store } from "./redux/store";
import { Provider } from "react-redux";
import ParentContextProvider from "./context";
import { BrowserRouter as Router } from "react-router-dom";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { ShellProvider } from "./admin/shell/ShellContext";
import { RouteProvider } from "./providers/router-provider";

function App() {
  return (
    <ErrorBoundary>
      <ParentContextProvider>
        <Provider store={store}>
          <Router>
            {/* Untitled UI's links and menu items call the router through
                react-aria's RouterProvider; without it an <a> inside a
                library component would hard-navigate. */}
            <RouteProvider>
              <ShellProvider>
                <UserRoutes />
              </ShellProvider>
            </RouteProvider>
          </Router>
        </Provider>
      </ParentContextProvider>
    </ErrorBoundary>
  );
}

export default App;
