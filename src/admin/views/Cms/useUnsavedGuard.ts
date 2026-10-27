/* useUnsavedGuard(dirty, message?) — warn before unsaved edits are lost.

   The panel uses a plain <BrowserRouter> (App.tsx), not a data router, so
   react-router's useBlocker is unavailable and shared files are not touched.

   COVERED
     · tab close / reload / external navigation  — `beforeunload` while dirty.
     · browser Back                               — while dirty a SENTINEL entry
       for the same URL sits on top of history. Back pops only the sentinel, so
       the route does not change and the editor stays mounted; then we ask. OK
       goes back for real, Cancel puts the sentinel back. (A popstate listener
       alone cannot block: the router's own listener runs first and unmounts
       the editor before any prompt.)
     · in-app navigation that a caller wraps:    `if (!confirmLeave()) return;`
   NOT COVERED
     · <Link>/navigate()/go() calls that are not wrapped in confirmLeave()
       (sidebar, breadcrumbs, other modules) — they leave without a prompt.
     · Only one guard is live at a time (the most recently mounted dirty one). */
import { useEffect } from "react";

const DEFAULT_MSG = "You have unsaved changes. Leave without saving?";
const MARK = "cmsUnsavedGuard";
let live: { dirty: boolean; message: string } | null = null;

export function confirmLeave(): boolean {
  return !live?.dirty || window.confirm(live.message);
}

export function useUnsavedGuard(dirty: boolean, message: string = DEFAULT_MSG) {
  useEffect(() => {
    const me = { dirty, message };
    live = me;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!me.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    if (!dirty) {
      return () => {
        window.removeEventListener("beforeunload", onUnload);
        if (live === me) live = null;
      };
    }

    const url = window.location.href;
    const push = () => window.history.pushState({ ...(window.history.state || {}), [MARK]: true }, "", url);
    if (!window.history.state?.[MARK]) push();
    let leaving = false;
    const onPop = () => {
      if (leaving || window.history.state?.[MARK]) return;   // still on (or back onto) the sentinel
      if (window.confirm(me.message)) {
        leaving = true;
        live = null;
        window.history.back();                               // past the real entry too
      } else {
        push();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("popstate", onPop);
      if (live === me) live = null;
      // Clean again (saved) while the sentinel is still on top: drop it, so
      // Back is one press again. After an in-app navigation the top is the
      // new page, which carries no mark, and nothing is popped.
      if (!leaving && window.history.state?.[MARK] && window.location.href === url) window.history.back();
    };
  }, [dirty, message]);
}
