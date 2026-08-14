/* =====================================================================
   TEAM + ROLES — the pieces both surfaces genuinely share.
   ---------------------------------------------------------------------
   Ported from the top of views-team.js, which registered BOTH V.team and
   V.roles out of one file. The split into two route folders is the app's
   convention; this is the half that would otherwise be copied twice.

   The split those two surfaces encode is the module's whole idea. A
   MEMBER is an identity — a person, an account, a status. A ROLE is a
   responsibility — a name and a set of capabilities. Nobody's permissions
   are edited on their own record; you change what a role means, or you
   change which roles somebody holds.

   Passwords are never rendered. The one generated at creation is shown
   once, in the dialog that created it, and never again by any path.

   NO VIEW MAY EVER BRANCH ON A ROLE NAME (TEAM_OPERATION §0.3). Ask
   `can(moduleKey, action)`; the resolution lives in IBTeam, and it reads
   the user record fresh every time it is asked.
   ===================================================================== */
import type { ReactNode } from "react";
import { IBData, IBTeam } from "../engines";
import { moduleKeys, moduleLabel } from "../shell/modules";
import { Icon, Notice, Pill, avatarTone, cap, initials } from "../ui";

/* The engines are typed `any` on purpose (engines/index.d.ts) — they are
   ~6000 lines of ES5 that HTTP calls replace later. These aliases name the
   shapes without pretending they are checked. */
/* eslint-disable @typescript-eslint/no-explicit-any -- the engines are `any`;
   `unknown` here would only force a cast at every single field read. */
export type Member = Record<string, any>;
export type Role = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Who is doing this. Resolved from the user record, never from a copy. */
export function actor(): Member {
  return IBTeam.currentUser() || { name: "System" };
}

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

/* ------------------------------------------------------------- pieces -- */
const STATUS_TONE: Record<string, string> = {
  active: "ok", inactive: "", suspended: "bad", locked: "warn", pending: "",
};
export function StatusPill({ s }: { s?: string }) {
  return <Pill text={cap(s || "unknown")} tone={STATUS_TONE[s || ""] || ""} />;
}

export function rolesOf(u: Member): Role[] {
  return IBTeam.roleIdsOf(u).map((r: string) => IBTeam.roleOf(r)).filter(Boolean);
}

export function RoleChips({ u }: { u: Member }) {
  const rs = rolesOf(u);
  if (!rs.length) return <span className="faint">no role</span>;
  return (
    <span className="dls-tags">
      {rs.map((r) => (
        <span
          key={r.role_id}
          className={"pill xs" + (r.is_super ? " brand" : "") + (r.status === "active" ? "" : " dead")}
          title={r.name + (r.status === "active" ? "" : " · inactive, grants nothing")}
        >
          {r.name}
        </span>
      ))}
    </span>
  );
}

export function whenever(ms?: number | null): ReactNode {
  if (!ms) return <span className="faint">never</span>;
  return IBData.fmtDate(new Date(ms).toISOString().slice(0, 10));
}

/* The one place a member's face gets drawn — a photo when they have one,
   the same initials-on-a-tint circle as everywhere else in the app when
   they don't, so a member without a photo never looks unfinished. */
export function Avatar({ u, size }: { u?: Member; size?: string }) {
  const cls = "av" + (size ? " " + size : "");
  if (u && u.avatar_url) return <span className={cls}><img src={u.avatar_url} alt="" /></span>;
  return <span className={cls + " " + avatarTone(u && u.name)}>{initials(u && u.name)}</span>;
}

/* ------------------------------------------------------ the inventory -- */
/* The permission subject list is MODULES[] itself — the same array nav,
   the router and breadcrumbs read. A module added there gets permissions
   with no second registration, which is why this does not hand-write a
   list. IBTeam.modules() does exactly this in the prototype by reaching
   for window.IBShell; here the inventory is a real import. */
export function matrixModules(): { key: string; label: string; actions: string[] }[] {
  const MA: Record<string, string[]> = IBTeam.MODULE_ACTIONS;
  const seen: Record<string, boolean> = {};
  const out: { key: string; label: string; actions: string[] }[] = [];
  moduleKeys().concat(Object.keys(MA)).forEach((k) => {
    if (seen[k]) return;
    seen[k] = true;
    /* Anything without a declared action list is view-only rather than
       silently ungoverned. */
    out.push({ key: k, label: moduleLabel(k), actions: MA[k] || ["view"] });
  });
  return out;
}

/* =========================================================== THE MATRIX == */
/* One row per module, one column per action THAT MODULE ACTUALLY HAS.

   The empty cells are the point. Giving every module the same seven verbs
   would produce a grid mostly full of permissions that grant nothing, and a
   reader cannot tell a deliberate "no" from a meaningless one. A dash means
   the module has no such action; an unticked box means it has one and this
   role does not get it.

   Row and column "all" toggles exist because a matrix filled in by hand,
   thirty boxes at a time, is a matrix filled in wrong. */
const MATRIX_COLS = ["view", "create", "edit", "export", "status", "issue", "cancel",
                     "stage", "payment", "close", "accept", "pricing", "archive", "roles"];

function toggleAll(sel: string) {
  const boxes = Array.prototype.slice.call(document.querySelectorAll(sel)) as HTMLInputElement[];
  if (!boxes.length) return;
  const turnOn = boxes.some((x) => !x.checked);
  boxes.forEach((x) => { x.checked = turnOn; });
}

export function MatrixTable({ role, editable }: { role: Role | null; editable?: boolean }) {
  const mods = matrixModules();
  /* Only columns some module on screen actually uses, so the table is as
     wide as the product and no wider. */
  const cols = MATRIX_COLS.filter((a) => mods.some((m) => m.actions.indexOf(a) >= 0));

  if (role && role.is_super)
    return (
      <Notice ico="shield" text={
        <><b>Super Admin holds everything by definition.</b> There is no matrix to show: it resolves
          to a wildcard, so a module added tomorrow is covered without anybody remembering to tick a
          box.</>
      } />
    );

  const perms: Record<string, boolean> = (role && role.permissions) || {};
  return (
    <div className="tw scroll">
      <table className="tbl tm-matrix" id={editable ? "rlMatrix" : undefined}
             style={{ minWidth: 200 + cols.length * 78 + "px" }}>
        <thead>
          <tr>
            <th>Module</th>
            {cols.map((a) => (
              <th key={a} className="c">
                {IBTeam.ACTION_LABEL[a] || a}
                {editable ? (
                  <div>
                    <button type="button" className="tm-all" data-col={a}
                            title="Toggle this action on every module that has it"
                            onClick={() => toggleAll('#rlMatrix input[data-perm$=".' + a + '"]')}>all</button>
                  </div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mods.map((m) => (
            <tr key={m.key}>
              <td>
                <b>{m.label}</b>
                {editable ? (
                  <> <button type="button" className="tm-all" data-row={m.key}
                             title="Toggle every action this module has"
                             onClick={() => toggleAll('#rlMatrix input[data-perm^="' + m.key + '."]')}>all</button></>
                ) : null}
              </td>
              {cols.map((a) => {
                if (m.actions.indexOf(a) < 0)
                  return <td key={a} className="c faint" title={m.label + " has no " + a + " action"}>—</td>;
                const on = !!perms[m.key + "." + a];
                if (!editable)
                  return <td key={a} className="c">{on ? <Icon name="check" size="sm" /> : <span className="faint">·</span>}</td>;
                return (
                  <td key={a} className="c">
                    <label className="check tm-cell">
                      <input type="checkbox" data-perm={m.key + "." + a} defaultChecked={on}
                             {...(a === "view" ? { "data-view": "1" } : {})} />
                      <span></span>
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Reads the editable matrix straight out of the DOM, the way the prototype
    did — the checkboxes are uncontrolled, exactly as they were when the view
    was an HTML string. */
export function readMatrix(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  Array.prototype.forEach.call(
    document.querySelectorAll("#rlMatrix input[data-perm]"),
    (i: HTMLInputElement) => { if (i.checked) out[i.getAttribute("data-perm") as string] = true; }
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

export type EngineErr = { ok: false; http: number; code: string; detail: string };

/** The prototype's `#tmErr` slot. A refused mutation is RENDERED, never
    swallowed — the engine's own http + code + detail, in the dialog that
    tried it. */
export function ErrSlot({ err }: { err: EngineErr | null }) {
  return (
    <div id="tmErr">
      {err ? (
        <Notice tone="bad" text={
          <><b>{err.http} <span className="mono">{err.code}</span></b>
            <div style={{ marginTop: 3 }}>{err.detail}</div></>
        } />
      ) : null}
    </div>
  );
}

/** A checkbox list of roles, shared by "Add member" and "Roles". Uncontrolled
    and read back through `#tmRoles input:checked`, as the prototype did. */
export function RolePicks({ roles, held }: { roles: Role[]; held?: string[] }) {
  return (
    <div id="tmRoles">
      {roles.map((r) => (
        <label className="check" style={{ marginBottom: 6 }} key={r.role_id}>
          <input type="checkbox" data-role={r.role_id}
                 defaultChecked={!!held && held.indexOf(r.role_id) >= 0} />
          <span>
            <b>{r.name}</b>
            {held && r.status !== "active" ? <> <span className="pill xs">inactive</span></> : null}
            <div className="help">{r.description || ""}</div>
          </span>
        </label>
      ))}
    </div>
  );
}

export function readRolePicks(): string[] {
  return Array.prototype.map.call(
    document.querySelectorAll("#tmRoles input:checked"),
    (i: HTMLInputElement) => i.getAttribute("data-role")
  ) as string[];
}
