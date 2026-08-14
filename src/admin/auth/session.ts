/* =============================================================================
   Admin session — the ONE resolved RBAC matrix for this browser tab.
   -----------------------------------------------------------------------------
   Replaces IBData.TeamStore.current() / IBTeam.currentUser(). Fetched once at
   boot (RequireSession, on first mount of the shell) and re-fetched on sign-in
   (AdminAuth); everything else — can(), the sidebar identity, the nav — just
   reads the cached value. A module-level singleton rather than React context
   because `can()` is called as a plain function from dozens of non-hook call
   sites (views, modals ported verbatim from the prototype), exactly as
   IBTeam.can() was.

   can()/canWrite() implement the rule from the API contract verbatim:
     level = modules[key]?.level ?? 0
     if (level < 1) return false
     min   = actions[key + "." + (action || "view")] ?? 3
     return level >= min
   isFullAccess short-circuits to true. An unresolved matrix DENIES — there is
   no permissive fallback here (unlike the old prototype-era can()), because an
   unavailable authorization service must deny on a real server.
   ============================================================================= */
import AdminOpsService from "../../api/modules/adminOps";
import type { MePermissions } from "../../api/modules/adminOps";
import { TokenService } from "../../api/apiService/authHelper/TokenService";

let session: MePermissions | null = null;
let inflight: Promise<MePermissions | null> | null = null;

export function getSession(): MePermissions | null {
  return session;
}

/** Fetch `me/permissions/` and cache it. Concurrent callers share one request.
 * Pass `force` to re-fetch (sign-in) rather than serve the cached value. */
export async function loadSession(force = false): Promise<MePermissions | null> {
  if (!force && session) return session;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await AdminOpsService.mePermissions();
      /* `name` is null on the wire whenever the account has no UserProfile row
         — the API says "there is no profile name" rather than inventing one,
         which is right. Every consumer here wants something printable, and
         two of them slice it (`name.split(" ")[0]`, the initials pair), so
         normalise ONCE at the boundary instead of guarding six call sites.
         The username is a real identifier, not a fabricated name. */
      session = res.data
        ? { ...res.data, user: { ...res.data.user, name: res.data.user?.name || res.data.user?.username || "" } }
        : res.data;
      return session;
    } catch {
      session = null;
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearSession() {
  session = null;
  inflight = null;
  TokenService.clearTokens();
}

/** role: null, or every module at level 0 — a successful sign-in that implies
 * no access yet. This IS the "pending" state; not an error. */
export function isZeroAccess(s: MePermissions): boolean {
  if (s.isFullAccess) return false;
  if (!s.role) return true;
  return !s.modules.some((m) => m.level > 0);
}

export function can(moduleKey: string, action?: string): boolean {
  if (!session) return false;
  if (session.isFullAccess) return true;
  const mod = session.modules.find((m) => m.key === moduleKey);
  const level = mod ? mod.level : 0;
  if (level < 1) return false;
  const min = session.actions[moduleKey + "." + (action || "view")] ?? 3;
  return level >= min;
}
export const canWrite = (moduleKey: string, action?: string) => can(moduleKey, action || "edit");

/** Module labels a session actually holds (level > 0) — the auth screen's
 * "Effective access" chip row and the shell's account popover both read this,
 * so the two can never list different things for the same session. */
export function grantsOf(s: MePermissions): string[] {
  if (s.isFullAccess) return ["Everything"];
  return s.modules.filter((m) => m.level > 0).map((m) => m.label);
}

/** "Who did this" for the local-only engines (Deals/Invoices/Plans/Quotations)
 * that still simulate their writes client-side. `isFullAccess` is the direct
 * successor of the old `role === "super_admin"` grant those engines' own
 * `isHead()` checks read, so it is mapped through. A named role with no full
 * access must NOT pass through as its server role name — these engines branch
 * on that literal string (`isHead()` treats "sales_head"/"ops_manager" as
 * head-level), so forwarding the name would let an admin hand out head
 * authority under a read-only grant just by naming a role right. There is no
 * legacy-key equivalent for a named role, so it maps to null: the engines'
 * name comparisons all miss, `isHead()` is false, and callers fall through to
 * owner scoping — exactly what the level matrix already says for a non-full
 * session. */
export function currentActor(): { name: string; role: string | null; id: number | string } {
  if (!session || !session.user) return { name: "", role: null, id: "system" };
  return {
    name: session.user.name,
    role: session.isFullAccess ? "super_admin" : null,
    id: session.user.id,
  };
}
