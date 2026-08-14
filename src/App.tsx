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
