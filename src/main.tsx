/* ONE STYLESHEET. `globals.css` is the whole design system — Tailwind, Untitled
   UI's theme, the panel's brand layer — in one known order. There is no
   component sheet and no module sheet under or over it. */
import "./styles/globals.css";
import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootAppearance } from "./admin/shell/ShellContext";

// One preference drives the whole design system: light, dark or system,
// painted as `data-theme` AND the `dark-mode` class on <html>. Set before the
// first render so the panel cannot flash the wrong theme (index.html did the
// same before this script even loaded).
bootAppearance();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
