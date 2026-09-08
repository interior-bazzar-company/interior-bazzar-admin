/* ONE STYLESHEET. `admin-theme.css` is the component layer and it `@import`s
   `tokens.css` from its own first line, so the whole design system arrives as
   a single import in a single, known order. There is no library sheet under it
   and no refinement sheet over it — the cascade has one author. */
import "./styles/admin-theme.css";
import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootAppearance } from "./admin/shell/ShellContext";

// One attribute on <html> drives the whole design system: data-theme, which is
// "light" or "dark" and is never anything else. Set before the first render so
// the panel cannot flash the wrong theme, the way the prototype's inline <head>
// script did it.

bootAppearance();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
