/* =====================================================================
   TEAM + ROLES — the pieces both surfaces genuinely share.
   ---------------------------------------------------------------------
   Rewired onto the real server: members are interior_admin's `v1/admin/
   users/` (AdminUserViews), roles are `v1/admin/roles/` (RolesViews). The
   split those two surfaces encode is still the module's whole idea — a
   MEMBER is an identity, a ROLE is a responsibility, and nobody's
   permissions are edited on their own record — but the SHAPE of a
   responsibility changed: a role is no longer a bag of per-action booleans
   ("deals.stage", "invoices.cancel", …), it is one LEVEL per module
   (0 none · 1 read · 2 write · 3 sensitive), because that is what
   `me/permissions/` and `roles/` actually carry.

   Passwords are never rendered. Creating a member takes one from the admin
   (the server has no "generate and show once" path); resetting one now
   EMAILS a fresh password instead — see memberModals.tsx.

   NO VIEW MAY EVER BRANCH ON A ROLE NAME (TEAM_OPERATION §0.3). Ask
   `can(moduleKey, action)`; the resolution lives in admin/auth/session.ts,
   read fresh from the server at boot and on sign-in.
   ===================================================================== */
import type { ReactNode } from "react";
import { Notice, Pill, avatarTone, cap } from "../ui";
import { AppExceptions } from "../../api/apiService";
import type { AdminRole, AdminUserRole, AdminUserRow, RolesModuleDef } from "../../api/modules/adminOps";

export type Member = AdminUserRow;
export type Role = AdminRole;
export type RoleModuleDef = RolesModuleDef;

/* The four services a write path needs, built once per view and passed to
   the drawers and modals — which the shell renders in a portal, outside the
   view's own tree, so React context cannot reach them. */
export type Ops = {
  /** closeLayer + toast + (optional) navigate + re-read the store */
  done: (msg: string, hash?: string) => void;
  toast: (msg: ReactNode, tone?: string) => void;
  modal: (node: ReactNode, size?: string) => void;
  closeLayer: () => void;
  /** the prototype's `data-go` — takes the same `#/team/u1` hash string */
  go: (hash: string) => void;
  /** re-read the store and redraw, the React form of the prototype's S.render() */
  refresh: () => void;
};

/* ------------------------------------------------------------- levels -- */
export const LEVELS = [0, 1, 2, 3] as const;
export const LEVEL_LABEL: Record<number, string> = { 0: "None", 1: "Read", 2: "Write", 3: "Sensitive" };
export function levelTone(n: number): string {
  return n >= 3 ? "bad" : n === 2 ? "warn" : n === 1 ? "ok" : "";
}

export function rolesOf(u: Member): AdminUserRole[] {
  return u.roles || [];
}

export function RoleChips({ u }: { u: Member }) {
  const rs = rolesOf(u);
  if (!rs.length) return <span className="faint">no role</span>;
  return (
    <span className="dls-tags">
      {rs.map((r) => (
        <span key={r.id} className="pill xs">{r.name}</span>
      ))}
    </span>
  );
}

/* The one place a member's face gets drawn — initials-on-a-tint circle. The
   real user record carries no photo field (the prototype's avatar upload had
   nowhere on the server to land), so this is the only form a face takes now. */
export function Avatar({ u, size }: { u?: Member | null; size?: string }) {
  const cls = "av" + (size ? " " + size : "");
  return <span className={cls + " " + avatarTone(u && u.name)}>{u ? cap(u.name).slice(0, 1) + cap((u.name.split(" ")[1] || "")).slice(0, 1) : ""}</span>;
}

/* ------------------------------------------------------ the inventory -- */
/* Read straight off the resolved session's module list (or the roles
   editor's own `modules[]`, which is the same inventory) — never a second,
   hand-kept list of what a role can possibly govern. */
export function matrixModules(mods: RoleModuleDef[]): RoleModuleDef[] {
  return mods.slice().sort((a, b) => a.displayOrder - b.displayOrder);
}

/* =========================================================== THE MATRIX == */
/* One row per module, one column: the LEVEL that module is held at. A role
   with `isFullAccess` resolves to a wildcard server-side, so there is
   nothing here to tick — same idea the old per-action matrix used for
   Super Admin, carried through to the one-number-per-module shape. */
export function LevelMatrix({
  mods, levels, editable,
}: {
  mods: RoleModuleDef[];
  levels: Record<string, number> | null;
  editable?: boolean;
}) {
  if (!levels)
    return (
      <Notice ico="shield" text={
        <><b>Full access holds everything by definition.</b> There is no matrix to show: it resolves to
          a wildcard, so a module added tomorrow is covered without anybody picking a level.</>
      } />
    );
  return (
    <div className="tw scroll">
      <table className="tbl tm-matrix" id={editable ? "rlMatrix" : undefined}>
        <thead>
          <tr><th>Module</th><th className="c">Level</th></tr>
        </thead>
        <tbody>
          {mods.map((m) => {
            const lvl = levels[m.key] || 0;
            return (
              <tr key={m.key}>
                <td><b>{m.label}</b></td>
                <td className="c">
                  {editable ? (
                    <select className="inp" data-perm={m.key} defaultValue={String(lvl)}>
                      {LEVELS.map((n) => <option key={n} value={n}>{LEVEL_LABEL[n]}</option>)}
                    </select>
                  ) : (
                    <Pill text={LEVEL_LABEL[lvl]} tone={levelTone(lvl)} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Reads the editable matrix straight out of the DOM, uncontrolled, the way
    the prototype's checkbox matrix did. A level of 0 is simply omitted —
    the server treats a missing key as level 0 already. */
export function readLevelMatrix(): Record<string, number> {
  const out: Record<string, number> = {};
  Array.prototype.forEach.call(
    document.querySelectorAll("#rlMatrix select[data-perm]"),
    (s: HTMLSelectElement) => {
      const v = Number(s.value);
      if (v > 0) out[s.getAttribute("data-perm") as string] = v;
    }
  );
  return out;
}

/* ============================================================= WRITES === */
/** The prototype's `val(id)`: these forms are uncontrolled (ui/Field renders
    defaultValue), so the DOM is the state, same as it was. */
export function val(id: string): string {
  const e = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return e ? e.value : "";
}

/* The real API's error envelope is `{ message, code, response }`, not the
   local engine's `{ ok:false, http, code, detail }` — `code` here is numeric
   (an HTTP-status-shaped number), and there is one message string, not a
   separate slug + detail. ErrSlot renders exactly that, nothing invented. */
export type EngineErr = { http: number; message: string };

export function errOf(e: unknown): EngineErr {
  if (e instanceof AppExceptions) return { http: e.code, message: e.message || "Unexpected error." };
  return { http: 0, message: "Could not reach the server. Try again." };
}

/** A refused write is RENDERED, never swallowed — the server's own http +
    message, in the dialog that tried it. */
export function ErrSlot({ err }: { err: EngineErr | null }) {
  return (
    <div id="tmErr">
      {err ? <Notice tone="bad" text={<b>{err.http} — {err.message}</b>} /> : null}
    </div>
  );
}

/** A checkbox list of roles, shared by "Add member" and "Roles". Uncontrolled
    and read back through `#tmRoles input:checked`, as the prototype did.
    Role ids are numeric now (the RBAC Role model's pk), not "ROL-003". */
export function RolePicks({ roles, held }: { roles: Role[]; held?: number[] }) {
  return (
    <div id="tmRoles">
      {roles.map((r) => (
        <label className="check" style={{ marginBottom: 6 }} key={r.id}>
          <input type="checkbox" data-role={r.id}
                 defaultChecked={!!held && held.indexOf(r.id) >= 0} />
          <span>
            <b>{r.name}</b>
            {r.isSystem ? <> <span className="pill xs">protected</span></> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function readRolePicks(): number[] {
  return Array.prototype.map.call(
    document.querySelectorAll("#tmRoles input:checked"),
    (i: HTMLInputElement) => Number(i.getAttribute("data-role"))
  ) as number[];
}
