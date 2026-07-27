import UserRoutes from "./routes";
import { store } from "./redux/store";
import { Provider } from "react-redux";
import ParentContextProvider from "./context";
import { BrowserRouter as Router } from "react-router-dom";
import ErrorBoundary from "./components/shared/ErrorBoundary";

function App() {

  return (
    <ErrorBoundary>
      <ParentContextProvider>
        <Provider store={store}>
          <Router>
            {/* <ScrollToTop /> */}
            <UserRoutes />

          </Router>
        </Provider>
      </ParentContextProvider>
    </ErrorBoundary>
  );
}

export default App;