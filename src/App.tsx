import UserRoutes from "./routes";
import { store } from "./redux/store";
import { Provider } from "react-redux";
import ParentContextProvider from "./context";
import { BrowserRouter as Router } from "react-router-dom";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { ShellProvider } from "./admin/shell/ShellContext";

function App() {
  return (
    <ErrorBoundary>
      <ParentContextProvider>
        <Provider store={store}>
          <Router>
            {/* No RouterProvider: the panel's own navigation goes through
                ui/nav.ts and react-router's own <Link>. The react-aria
                RouterProvider that used to sit here existed only so that an
                <a> inside an Untitled UI component would route instead of
                hard-navigating, and there are no such components any more. */}
            <ShellProvider>
              <UserRoutes />
            </ShellProvider>
          </Router>
        </Provider>
      </ParentContextProvider>
    </ErrorBoundary>
  );
}

export default App;
