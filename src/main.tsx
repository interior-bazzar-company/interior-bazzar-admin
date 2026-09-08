/* Untitled UI first — Tailwind's layers (theme, base, utilities) go under
   the panel's unlayered component CSS, so the panel's classes always win
   on an element they share, and a library component (which carries none of
   them) is styled entirely by the library. */
import "./styles/untitled/globals.css";
import "./styles/admin-theme.css";
/* LAST, and from here rather than an @import at the foot of admin-theme.css:
   an @import is only valid at the TOP of a sheet, so one written at the bottom
   is dropped silently. Import order in this file IS the cascade order. */
import "./styles/components.css";
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
