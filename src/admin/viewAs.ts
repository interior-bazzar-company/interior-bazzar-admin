/* =====================================================================
   VIEW AS — the read-only impersonation target, held OUTSIDE React so the
   API client (apiService, which the SPA's whole routing sits on top of)
   can read it on every GET without a hook. `localStorage` is what makes
   it survive a reload; the pub/sub is what makes the banner and anything
   else watching it re-render the moment it changes.

   The call to POST users/<id>/view-as/ (AdminOpsService.viewAsUser) is the
   AUDIT of starting a look — it does not itself change what later requests
   see. Setting the target here is the second half: every GET after this
   carries `X-View-As: <id>` (apiService/index.ts), which is what the
   server actually keys the read-only, filtered response on
   (app_ib/authentication.py). Any other method with that header is refused
   server-side, so nothing here needs to special-case POST/PUT/DELETE.
   ===================================================================== */
const KEY = "ib_admin_view_as";

export interface ViewAsTarget {
  id: number;
  name: string;
}

function readStored(): ViewAsTarget | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ViewAsTarget) : null;
  } catch {
    return null;
  }
}

let current: ViewAsTarget | null = readStored();
const listeners = new Set<() => void>();

export function getViewAs(): ViewAsTarget | null {
  return current;
}

export function setViewAs(target: ViewAsTarget): void {
  current = target;
  try {
    localStorage.setItem(KEY, JSON.stringify(target));
  } catch {
    /* private window / storage blocked — the session still holds it in memory */
  }
  listeners.forEach((l) => l());
}

export function clearViewAs(): void {
  current = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up if it never wrote */
  }
  listeners.forEach((l) => l());
}

/** For `useSyncExternalStore` — the banner's only consumer today. */
export function subscribeViewAs(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
