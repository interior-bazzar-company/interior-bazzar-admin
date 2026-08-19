/* =====================================================================
   TEAM + ROLES — the pieces both surfaces genuinely share.
   ---------------------------------------------------------------------
   Rewired onto the real server: members are interior_admin's `v1/admin/
   users/` (AdminUserViews), roles are `v1/admin/roles/` (RolesViews). The
   split those two surfaces encode is still the module's whole idea — a
   MEMBER is an identity, a ROLE is a responsibility, and nobody's
   permissions are edited on their own record.

   A responsibility is a set of TICKED VERBS: {moduleKey: [actionKey]}. It was
   briefly one LEVEL per module (0..3), and that tier could not say "may read
   the deals list but may not POST a new one" — deals.create and deals.edit
   both sat at write, so granting either granted both. The server stores one
   row per (role, action) now (RoleActionAccess) and `can()` is a set-membership
   test, so the checkbox grid below is literally what the API enforces.

   Passwords are never rendered. Creating a member takes one from the admin
   (the server has no "generate and show once" path); resetting one now
   EMAILS a fresh password instead — see memberModals.tsx.

   NO VIEW MAY EVER BRANCH ON A ROLE NAME (TEAM_OPERATION §0.3). Ask
   `can(moduleKey, action)`; the resolution lives in admin/auth/session.ts,
   read fresh from the server at boot and on sign-in.
   ===================================================================== */
import type { ReactNode } from "react";
import { Icon, Notice, avatarTone, cap } from "../ui";
import { AppExceptions } from "../../api/apiService";
import type { AdminRole, AdminUserRole, AdminUserRow, RoleActionDef, RoleModules, RolesModuleDef } from "../../api/modules/adminOps";

export type Member = AdminUserRow;
export type Role = AdminRole;
export type RoleModuleDef = RolesModuleDef;
export type { RoleActionDef, RoleModules };

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

/* ------------------------------------------------------------ actions -- */
/* `view` is the gate on both sides of the wire: a module whose view is not
   granted is refused entirely, whatever else was ticked on it. */
export const VIEW = "view";
/** How sensitive a verb is — colours the column head, authorizes nothing. */
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
/* One row per module, one column per VERB — a tick is a grant, and what is
   ticked here is byte-for-byte what the API enforces (RoleActionAccess). A
   role with `isFullAccess` resolves to a wildcard server-side, so there is
   nothing here to tick. */
export function ActionMatrix({
  mods, grants, editable,
}: {
  mods: RoleModuleDef[];
  /** null = full access: a wildcard server-side, so there is nothing to tick */
  grants: RoleModules | null;
  editable?: boolean;
}) {
  if (!grants)
    return (
      <Notice ico="shield" text={
        <><b>Full access holds everything by definition.</b> There is no matrix to show: it resolves to
          a wildcard, so a module — or a verb — added tomorrow is covered without anybody ticking a box.</>
      } />
    );

  /* One column per DISTINCT verb across every module, least sensitive first so
     `view` leads and the destructive ones sit together on the right. A module
     that does not support a verb gets a dash, not an unticked box: there is no
     permission being withheld there. */
  const cols: RoleActionDef[] = [];
  const seen: Record<string, boolean> = {};
  mods.forEach((m) => (m.actions || []).forEach((a) => {
    if (!seen[a.key]) { seen[a.key] = true; cols.push(a); }
  }));
  cols.sort((a, b) => (a.minLevel - b.minLevel) || (a.key < b.key ? -1 : 1));

  const box = (m: RoleModuleDef, verb: string) =>
    "#rlMatrix input[data-mod=\"" + m.key + "\"][data-verb=\"" + verb + "\"]";

  /* Ticking any verb implies view, and clearing view clears the row — because
     that is exactly what the server does with the grant. Without this an admin
     can save a role whose every box is ticked and which grants nothing. */
  function onToggle(m: RoleModuleDef, verb: string, on: boolean) {
    if (verb === VIEW && !on) {
      (m.actions || []).forEach((a) => {
        const el = document.querySelector(box(m, a.key)) as HTMLInputElement | null;
        if (el) el.checked = false;
      });
      return;
    }
    if (verb !== VIEW && on) {
      const el = document.querySelector(box(m, VIEW)) as HTMLInputElement | null;
      if (el) el.checked = true;
    }
  }

  /* One "all" handler for both the row and the column toggle: flip every box it
     covers to the opposite of what the button last did, then re-apply the view
     gate to each module it touched so the shortcut cannot save a dead grant. */
  function setAll(btn: HTMLElement, moduleKey: string | null, verb: string | null) {
    const on = btn.getAttribute("data-on") !== "1";
    btn.setAttribute("data-on", on ? "1" : "0");
    const sel = "#rlMatrix input[data-mod]"
      + (moduleKey ? "[data-mod=\"" + moduleKey + "\"]" : "")
      + (verb ? "[data-verb=\"" + verb + "\"]" : "");
    const touched: Record<string, boolean> = {};
    Array.prototype.forEach.call(document.querySelectorAll(sel), (el: HTMLInputElement) => {
      el.checked = on;
      touched[el.getAttribute("data-mod") as string] = true;
    });
    Object.keys(touched).forEach((key) => {
      const m = mods.filter((x) => x.key === key)[0];
      if (!m) return;
      const el = document.querySelector(box(m, VIEW)) as HTMLInputElement | null;
      if (!el) return;
      if (on && verb !== VIEW) el.checked = true;          // any verb implies view
      if (!on && verb === VIEW) onToggle(m, VIEW, false);  // clearing view clears the row
    });
  }

  return (
    <div className="tw scroll">
      <table className="tbl tm-matrix" id={editable ? "rlMatrix" : undefined}>
        <thead>
          <tr>
            <th>Module</th>
            {cols.map((c) => (
              <th className="c" key={c.key} title={
                c.minLevel >= 3 ? "Sensitive" : c.minLevel === 1 ? "Read" : "Write"}>
                <span className={"pill xs " + levelTone(c.minLevel)}>{c.key}</span>
                {editable ? (
                  <div><button type="button" className="tm-all" data-act="rl-col-all"
                               onClick={(e) => setAll(e.currentTarget, null, c.key)}>all</button></div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mods.map((m) => {
            const held = grants![m.key] || [];
            const offers: Record<string, boolean> = {};
            (m.actions || []).forEach((a) => { offers[a.key] = true; });
            return (
              <tr key={m.key}>
                <td>
                  <b>{m.label}</b>
                  {editable && (m.actions || []).length ? (
                    <> <button type="button" className="tm-all" data-act="rl-row-all"
                               onClick={(e) => setAll(e.currentTarget, m.key, null)}>all</button></>
                  ) : null}
                </td>
                {cols.map((c) => (
                  <td className="c" key={c.key}>
                    {!offers[c.key] ? (
                      <span className="faint" title="This module has no such action">—</span>
                    ) : editable ? (
                      <label className="check tm-cell">
                        <input type="checkbox" data-mod={m.key} data-verb={c.key}
                               aria-label={m.label + " " + c.key}
                               defaultChecked={held.indexOf(c.key) >= 0}
                               onChange={(e) => onToggle(m, c.key, e.currentTarget.checked)} />
                      </label>
                    ) : held.indexOf(c.key) >= 0 ? (
                      <Icon name="check" />
                    ) : (
                      <span className="faint">·</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Reads the editable matrix straight out of the DOM, uncontrolled, the way the
    prototype's checkbox matrix did. A module with nothing ticked is simply
    omitted — the server treats a missing key as no grant already. */
export function readActionMatrix(): RoleModules {
  const out: RoleModules = {};
  Array.prototype.forEach.call(
    document.querySelectorAll("#rlMatrix input[data-mod]:checked"),
    (i: HTMLInputElement) => {
      const key = i.getAttribute("data-mod") as string;
      (out[key] = out[key] || []).push(i.getAttribute("data-verb") as string);
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
            {r.isActive ? null : <> <span className="pill xs" title="Grants nothing while inactive">inactive</span></>}
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
