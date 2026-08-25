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
export const setDensity = noop;
export const currentTheme = () => "system";
export const currentDensity = () => "cosy";
export const bootAppearance = noop;
