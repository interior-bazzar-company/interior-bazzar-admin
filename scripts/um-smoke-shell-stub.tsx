/* Stands in for admin/shell/ShellContext during the render smoke test.
   The real provider portals into document.body and there is no jsdom here; the
   module only ever calls useShell(), so a no-op services object is a faithful
   stand-in for what it consumes. Everything else is exported because
   AdminShell imports it at module scope. */
import type { ReactNode } from "react";

const noop = () => {};
export const useShell = () => ({
  drawer: noop, modal: noop, closeLayer: noop, layerKind: null,
  openPop: noop, closePop: noop, popAnchor: null,
  toast: noop, banner: noop, bannerState: null, closeBanner: noop,
  stub: noop, shortcuts: noop,
});
export const ShellProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
export const LS = { get: (_k: string, d: unknown) => d, set: noop, del: noop };
export const setTheme = noop;
export const currentTheme = () => "dark";
export const resolvedTheme = () => "dark";
/* AdminShell imports this at module scope to build the theme switch. The real
   list lives in ShellContext; a stand-in only has to have the same shape. */
export const THEMES = [
  { id: "light", label: "Light", hint: "Ink on paper" },
  { id: "dark", label: "Dark", hint: "Ink inverted" },
  { id: "system", label: "System", hint: "Follow the operating system" },
];
export const bootAppearance = noop;
