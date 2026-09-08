/* Untitled UI first — Tailwind's layers (theme, base, utilities) go under
   the panel's unlayered component CSS, so the panel's classes always win
   on an element they share, and a library component (which carries none of
   them) is styled entirely by the library. */
import "./styles/untitled/globals.css";
import "./styles/admin-theme.css";
import App from "./App.tsx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootAppearance } from "./admin/shell/ShellContext";

// Two attributes on <html> drive the whole design system. Set before the first
// render so the panel never flashes the wrong theme, the way the prototype's
// inline <head> script did it.

bootAppearance();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
