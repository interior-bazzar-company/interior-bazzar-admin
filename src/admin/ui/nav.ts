/* =============================================================================
   ui/nav — the one navigate function every shared component calls.
   -----------------------------------------------------------------------------
   In the prototype `data-go="#/deals/IB-1"` was a delegated click: one listener
   on the shell read the attribute and set location.hash. Nothing in the render
   helpers knew what a router was, and that is worth keeping — so ui/ imports no
   router. The shell calls setGo() once when it mounts; until then go() is a
   no-op, which is exactly what a click before the router exists should do.
   ============================================================================= */
export let goFn: (hash: string) => void = () => {};
export const setGo = (fn: (hash: string) => void) => { goFn = fn; };
export const go = (hash: string) => goFn(hash);
