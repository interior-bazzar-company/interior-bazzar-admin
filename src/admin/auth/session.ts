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
     held = modules[key]?.actions ?? []
     if (!held.includes("view")) return false     // view is the gate
     return held.includes(action || "view")
   That set is the SAME one the server refuses with (Permissions.can_with_grants),
   so a button this greys out is a button the API would 403 — never a UI-only
   guess. isFullAccess short-circuits to true, which also covers verbs that have
   no ModuleAction row yet. An unresolved matrix DENIES — there is no permissive
   fallback here (unlike the old prototype-era can()), because an unavailable
   authorization service must deny on a real server.
   ============================================================================= */
import AdminOpsService from "../../api/modules/adminOps";
import type { MePermissions } from "../../api/modules/adminOps";
import { TokenService } from "../../api/apiService/authHelper/TokenService";
import { isServiceError } from "../../api/apiService";

let session: MePermissions | null = null;
let inflight: Promise<MePermissions | null> | null = null;
let unreachable = false;

/** Modules the server still sends that this panel does not show anywhere —
 *  not in the nav, not in the effective-access chips.
 *    design    the design-system gallery: a reference page used to BUILD this
 *              admin, not a thing anyone administers.
 *    payments  no screen was ever built for it; the route only ever rendered
 *              the "in your access, no surface yet" notice. Payment is already
 *              where it belongs — recorded against the invoice that received
 *              it, in Invoices.
 *  ponytail: hidden here rather than by deleting the server's Module rows,
 *  because those rows still carry the grants issued against them; drop them
 *  server-side and this set goes with them. Lives in this file (not modules.ts)
 *  because modules.ts already imports from here — the other direction would
 *  be a cycle. */
export const HIDDEN_MODULES = new Set(["design", "payments"]);

/** THE MIRROR IMAGE OF HIDDEN_MODULES, AND NOW EMPTY — keep it that way.
 *
 *  A key here makes `can()` answer TRUE UNCONDITIONALLY for that module, for
 *  every signed-in account, before it ever looks at a grant. That is only ever
 *  safe while the module has no server data to leak and no server write to
 *  authorise, and the rule has always been that a key leaves on the commit
 *  that gives it either.
 *
 *  It did not. `attendance`, `work`, `reports`, `resources` and `agreements`
 *  all grew real Module rows, real verbs and real grants, and their keys stayed
 *  here — so the sidebar handed all five to everybody while the roles grid and
 *  the effective-access list, which read the session's real grants, showed the
 *  truth. That is the whole of the three-way disagreement between the sidebar,
 *  the access list and the grid: a sales manager was given Agreements and Data
 *  Forms with a working "New template", and a client ops executive was shown
 *  ten modules over a seven-module grant.
 *
 *  `finance-analytics` was the worst of them, because it had no Module row at
 *  all: it could be neither granted nor withheld, and this set opened the
 *  company's money to every account. Backend migration 0067 seeds its row, so
 *  it is a normal module now like the rest.
 *
 *  WHAT TO DO INSTEAD when a module is genuinely being built frontend-first:
 *  seed its Module row on the server FIRST — a row costs one migration and it
 *  is what makes the surface grantable — then build the screen behind
 *  `can(key)` like every other module. A row with no endpoints behind it
 *  refuses nothing and leaks nothing; a key in this set refuses nothing and
 *  leaks everything. */
export const PROTO_MODULES = new Set<string>([]);

export function getSession(): MePermissions | null {
  return session;
}

/** Why the last `loadSession()` came back empty. "Down" is NOT "denied": a
 *  restarting backend must not read as a withdrawn account, and it must not
 *  clear the tokens on this device — the guard shows a retry screen instead of
 *  signing the user out over a failed fetch. Reset on every attempt. */
export function sessionUnreachable(): boolean {
  return unreachable;
}

/** Fetch `me/permissions/` and cache it. Concurrent callers share one request.
 * Pass `force` to re-fetch (sign-in) rather than serve the cached value. */
export async function loadSession(force = false): Promise<MePermissions | null> {
  if (!force && session) return session;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      unreachable = false;
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
    } catch (e) {
      unreachable = isServiceError(e);
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
  /* THE RECENTS LIST IS RECORD REFERENCES, NOT A PREFERENCE. `ib_admin_recents`
     holds the last twelve deal/quotation/invoice ids opened on this browser, and
     leaving it behind survives sign-out: the next person to sign in on a shared
     machine reads the previous one's deal refs straight out of the command
     palette. It matters more now the pipeline is per-user — those refs are
     exactly what that person is not allowed to see. Tokens were already
     cleared here; the references are the same kind of thing. */
  try {
    window.localStorage.removeItem("ib_admin_recents");
  } catch {
    /* Private mode, or storage disabled. Nothing to clear and nothing to say. */
  }
}

/** role: null, or every module at level 0 — a successful sign-in that implies
 * no access yet. This IS the "pending" state; not an error. */
export function isZeroAccess(s: MePermissions): boolean {
  if (s.isFullAccess) return false;
  if (!s.role) return true;
  return !s.modules.some((m) => m.actions.length > 0);
}

/** WHAT `edit` MEANS on a module whose server verbs are named per write. The
 *  Finance screens gate every write on one `can(key, "edit")`, but the server
 *  has no `edit` there: payroll writes are approve / pay / hold (`propose` is
 *  seeded and no view accepts it), and a transaction's detail write is cancel.
 *  ponytail: any held write verb opens every button and the server refuses the
 *  one not held; per-verb gates when the Finance markup is reopened. */
export const EDIT_MEANS: Record<string, string[]> = {
  "finance-salaries": ["approve", "pay", "hold"],
  "finance-transactions": ["cancel"],
};

export function can(moduleKey: string, action?: string): boolean {
  if (!session) return false;
  /* Empty, and the set's own comment says why it must stay that way. Kept as
     a one-line escape hatch rather than deleted so the next frontend-first
     module reaches for a Module row instead of reinventing this. */
  if (PROTO_MODULES.has(moduleKey)) return true;
  if (session.isFullAccess) return true;
  const held = session.modules.find((m) => m.key === moduleKey)?.actions || [];
  /* `view` is the gate: without it the module is not this session's at all, so
     no other verb on it counts however it got granted. */
  if (held.indexOf("view") < 0) return false;
  const want = action || "view";
  return ((want === "edit" && EDIT_MEANS[moduleKey]) || [want]).some((v) => held.indexOf(v) >= 0);
}
export const canWrite = (moduleKey: string, action?: string) => can(moduleKey, action || "edit");

/* ================================================== RECORD SCOPE ========
   HOW MUCH of a module this session sees — NOT what it may do to it. Deals,
   Quotations and Invoices are narrowed by who owns the deal, and until now
   that narrowing had exactly two settings: full access saw everything and
   everybody else saw their own rows, whatever the roles grid said. A sales
   manager owns nothing on her team's desk and accounts own no deals at all,
   so both were shown an empty list and told the company pipeline was empty.

   The server resolves the same three words off the same two grants
   (DealsController.visible_to / scope_of), so a tile's wording and the rows
   under it cannot disagree. Absence of both grants is "own", which is what
   every role had before and what a new role still gets.

   NOTE it goes through can(), so `view` gates it and full access
   short-circuits to "all" — the same two rules as every other grant. */
export type Scope = "own" | "team" | "all";
export function scopeOf(moduleKey: string): Scope {
  if (can(moduleKey, "scope_all")) return "all";
  if (can(moduleKey, "scope_team")) return "team";
  return "own";
}
/** Is this list WIDER than the signed-in person? The one test that decides
 *  whether an Owner filter is worth offering — on a list of one person it
 *  filters nothing, which is why it used to be full-access only. */
export const wideScope = (moduleKey: string) => scopeOf(moduleKey) !== "own";
/** SAY WHOSE LIST THIS IS, and never say "yours" over a list that is not.
 *  `sep` is what joins it to a tile label ("12 total · your team"); pass ""
 *  for a bare word. An `all` scope returns nothing at all: the unqualified
 *  reading is the true one, and that is the wording full access always had. */
export function scopeLabel(moduleKey: string, sep = " · "): string {
  const s = scopeOf(moduleKey);
  return s === "all" ? "" : sep + (s === "team" ? "your team" : "yours");
}
export function scopeOnly(moduleKey: string): string {
  const s = scopeOf(moduleKey);
  return s === "all" ? "" : s === "team" ? " — your team only" : " — yours only";
}

/** Module labels a session actually holds — the auth screen's "Effective
 * access" chip row and the shell's account popover both read this, so the two
 * can never list different things for the same session. Since PROTO_MODULES
 * emptied, this and `can()` answer off the same grants, which is what makes
 * the sidebar and this list agree. */
export function grantsOf(s: MePermissions): string[] {
  if (s.isFullAccess) return ["Everything"];
  return s.modules
    .filter((m) => m.actions.indexOf("view") >= 0 && !HIDDEN_MODULES.has(m.key))
    .map((m) => m.label);
}

/** THE VERBS A SESSION HOLDS ON ONE MODULE, `View` INCLUDED.
 *
 *  The effective-access list used to drop `view` and print the rest — "Deals —
 *  Create · Edit · Change stage" — on the reasoning that view is implied by
 *  the module being listed at all. It is not implied, it is THE GATE: a module
 *  whose `view` was stripped refuses every other verb however they are ticked,
 *  and it rendered identically to a healthy one. That is the screen an admin
 *  opens during an outage to find out what somebody can actually do.
 *
 *  So `view` prints first and by name. Anything else keeps its order. */
export function verbsOf(s: MePermissions, moduleKey: string): string[] {
  if (s.isFullAccess) return ["Everything"];
  const held = s.modules.find((m) => m.key === moduleKey)?.actions || [];
  if (!held.length) return [];
  const rest = held.filter((a) => a !== "view").slice().sort();
  return (held.indexOf("view") >= 0 ? ["view"] : []).concat(rest);
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
