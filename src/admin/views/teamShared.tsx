/* =====================================================================
   TEAM + ROLES — the pieces both surfaces genuinely share.
   ---------------------------------------------------------------------
   Members are interior_admin's `v1/admin/users/`, roles are `v1/admin/roles/`.
   A MEMBER is an identity, a ROLE is a responsibility, and nobody's
   permissions are edited on their own record. A responsibility is a set of
   TICKED VERBS: {moduleKey: [actionKey]}, and the checkbox grid below is
   literally what the API enforces.

   NO VIEW MAY EVER BRANCH ON A ROLE NAME (TEAM_OPERATION §0.3). Ask
   `can(moduleKey, action)`.
   ===================================================================== */
import type { ReactNode } from "react";
import type React from "react";
import { cx } from "@/utils/cx";
import { Avatar as UIAvatar, Icon, Notice, Pill } from "../ui";
import { AppExceptions } from "../../api/apiService";
import type { AdminRole, AdminUserRole, AdminUserRow, RoleActionDef, RoleModules, RolesModuleDef } from "../../api/modules/adminOps";

export type Member = AdminUserRow;
export type Role = AdminRole;
export type RoleModuleDef = RolesModuleDef;
export type { RoleActionDef, RoleModules };

/* The four services a write path needs, built once per view and passed to the
   drawers and modals — which the shell renders in a portal, outside the view's
   own tree. */
export type Ops = {
  done: (msg: string, hash?: string) => void;
  toast: (msg: ReactNode, tone?: string) => void;
  modal: (node: ReactNode, size?: string) => void;
  closeLayer: () => void;
  go: (hash: string) => void;
  refresh: () => void;
};

export const VIEW = "view";
/** How sensitive a verb is — colours the column head, authorizes nothing. */
export function levelTone(n: number): string {
  return n >= 3 ? "bad" : n === 2 ? "warn" : n === 1 ? "ok" : "neutral";
}

export function rolesOf(u: Member): AdminUserRole[] {
  return u.roles || [];
}

export function RoleChips({ u }: { u: Member }) {
  const rs = rolesOf(u);
  if (!rs.length) return <span className="text-sm text-quaternary">no role</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {rs.map((r) => (
        <Pill key={r.id} xs tone="neutral" text={r.name} />
      ))}
    </span>
  );
}

/* The one place a member's face gets drawn. `size` keeps the legacy words. */
export function Avatar({ u, size }: { u?: Member | null; size?: string }) {
  return <UIAvatar name={u ? u.name : ""} sm={size === "sm"} lg={size === "lg"} xl={size === "xl"} />;
}

/* A NATIVE, UNCONTROLLED CHECKBOX — the matrix and the role picks are read back
   from the DOM by a document query, so the input has to be the real thing. The
   drawing is Untitled UI's: a 16px box that fills with the brand when checked,
   the tick riding on `peer-checked`. */
export function NativeCheck(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="relative inline-flex size-4 shrink-0">
      <input type="checkbox" {...props} className={cx("peer absolute inset-0 z-10 size-4 cursor-pointer appearance-none rounded outline-none", props.className)} />
      <span
        aria-hidden="true"
        className="pointer-events-none flex size-4 items-center justify-center rounded bg-primary ring-1 ring-primary ring-inset transition duration-100 peer-checked:bg-brand-solid peer-checked:ring-brand-solid peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring peer-disabled:opacity-50 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
      >
        <svg viewBox="0 0 14 14" fill="none" className="size-3 text-white">
          <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </span>
  );
}

export function matrixModules(mods: RoleModuleDef[]): RoleModuleDef[] {
  return mods.slice().sort((a, b) => a.displayOrder - b.displayOrder);
}

/* =========================================================== THE MATRIX == */
/* One row per module, one column per VERB — a tick is a grant, and what is
   ticked here is byte-for-byte what the API enforces. The matrix is
   UNCONTROLLED and read back from the DOM by `readActionMatrix`, exactly as
   the prototype did — the checkboxes are native so a document query finds
   them. */
export function ActionMatrix({ mods, grants, editable }: { mods: RoleModuleDef[]; grants: RoleModules | null; editable?: boolean }) {
  if (!grants)
    return (
      <Notice ico="shield">
        <b>Full access holds everything by definition.</b> There is no matrix to show: it resolves to a wildcard, so a module — or a verb — added tomorrow is covered without anybody
        ticking a box.
      </Notice>
    );

  const cols: RoleActionDef[] = [];
  const seen: Record<string, boolean> = {};
  mods.forEach((m) =>
    (m.actions || []).forEach((a) => {
      if (!seen[a.key]) {
        seen[a.key] = true;
        cols.push(a);
      }
    }),
  );
  cols.sort((a, b) => a.minLevel - b.minLevel || (a.key < b.key ? -1 : 1));

  const box = (m: RoleModuleDef, verb: string) => '#rlMatrix input[data-mod="' + m.key + '"][data-verb="' + verb + '"]';

  /* Ticking any verb implies view, and clearing view clears the row. */
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

  function setAll(btn: HTMLElement, moduleKey: string | null, verb: string | null) {
    const on = btn.getAttribute("data-on") !== "1";
    btn.setAttribute("data-on", on ? "1" : "0");
    const sel = "#rlMatrix input[data-mod]" + (moduleKey ? '[data-mod="' + moduleKey + '"]' : "") + (verb ? '[data-verb="' + verb + '"]' : "");
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
      if (on && verb !== VIEW) el.checked = true;
      if (!on && verb === VIEW) onToggle(m, VIEW, false);
    });
  }

  const allBtn = "ml-1 cursor-pointer rounded px-1 font-mono text-2xs font-medium text-quaternary outline-focus-ring hover:text-brand-secondary focus-visible:outline-2";

  return (
    <div className="w-full overflow-x-auto rounded-xl bg-primary ring-1 ring-secondary">
      <table className="w-full border-collapse text-sm" id={editable ? "rlMatrix" : undefined}>
        <thead>
          <tr className="border-b border-secondary bg-secondary">
            <th className="label-mono sticky left-0 z-10 bg-secondary px-3 py-2 text-left">Module</th>
            {cols.map((c) => (
              <th className="px-2 py-2 text-center" key={c.key} title={c.minLevel >= 3 ? "Sensitive" : c.minLevel === 1 ? "Read" : "Write"}>
                <Pill xs tone={levelTone(c.minLevel)} text={c.key} />
                {editable ? (
                  <div>
                    <button type="button" className={allBtn} data-act="rl-col-all" onClick={(e) => setAll(e.currentTarget, null, c.key)}>
                      all
                    </button>
                  </div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mods.map((m) => {
            const held = grants![m.key] || [];
            const offers: Record<string, boolean> = {};
            (m.actions || []).forEach((a) => {
              offers[a.key] = true;
            });
            return (
              <tr key={m.key} className="border-b border-secondary last:border-0 hover:bg-primary_hover">
                <td className="sticky left-0 z-10 bg-primary px-3 py-2 whitespace-nowrap">
                  <b className="font-medium text-primary">{m.label}</b>
                  {editable && (m.actions || []).length ? (
                    <button type="button" className={allBtn} data-act="rl-row-all" onClick={(e) => setAll(e.currentTarget, m.key, null)}>
                      all
                    </button>
                  ) : null}
                </td>
                {cols.map((c) => (
                  <td className="px-2 py-2 text-center" key={c.key}>
                    {!offers[c.key] ? (
                      <span className="text-quaternary" title="This module has no such action">
                        —
                      </span>
                    ) : editable ? (
                      <label className="inline-flex cursor-pointer items-center justify-center p-1">
                        <NativeCheck data-mod={m.key} data-verb={c.key} aria-label={m.label + " " + c.key} defaultChecked={held.indexOf(c.key) >= 0} onChange={(e) => onToggle(m, c.key, e.currentTarget.checked)} />
                      </label>
                    ) : held.indexOf(c.key) >= 0 ? (
                      <Icon name="check" size="sm" className="inline text-fg-success-primary" />
                    ) : (
                      <span className="text-quaternary">·</span>
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

/** Reads the editable matrix straight out of the DOM, uncontrolled. */
export function readActionMatrix(): RoleModules {
  const out: RoleModules = {};
  Array.prototype.forEach.call(document.querySelectorAll("#rlMatrix input[data-mod]:checked"), (i: HTMLInputElement) => {
    const key = i.getAttribute("data-mod") as string;
    (out[key] = out[key] || []).push(i.getAttribute("data-verb") as string);
  });
  return out;
}

/* ============================================================= WRITES === */
/** The prototype's `val(id)`: these forms are uncontrolled, so the DOM is the state. */
export function val(id: string): string {
  const e = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  return e ? e.value : "";
}

export type EngineErr = { http: number; message: string };

export function errOf(e: unknown): EngineErr {
  if (e instanceof AppExceptions) return { http: e.code, message: e.message || "Unexpected error." };
  return { http: 0, message: "Could not reach the server. Try again." };
}

/** A refused write is RENDERED, never swallowed. */
export function ErrSlot({ err }: { err: EngineErr | null }) {
  return (
    <div id="tmErr" className={cx(err && "mb-3")}>
      {err ? (
        <Notice tone="bad">
          <b>
            {err.http} — {err.message}
          </b>
        </Notice>
      ) : null}
    </div>
  );
}

/** A checkbox list of roles, shared by "Add member" and "Roles". Uncontrolled
    and read back through `#tmRoles input:checked`. */
export function RolePicks({ roles, held }: { roles: Role[]; held?: number[] }) {
  return (
    <div id="tmRoles" className="flex flex-col gap-2">
      {roles.map((r) => (
        <label key={r.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-primary_hover">
          <NativeCheck data-role={r.id} defaultChecked={!!held && held.indexOf(r.id) >= 0} className="mt-0.5" />
          <span className="flex flex-wrap items-center gap-1.5 text-sm">
            <b className="font-medium text-primary">{r.name}</b>
            {r.isActive ? null : <Pill xs tone="warn" text="inactive" title="Grants nothing while inactive" />}
            {r.isSystem ? <Pill xs tone="neutral" text="protected" /> : null}
          </span>
        </label>
      ))}
    </div>
  );
}

export function readRolePicks(): number[] {
  return Array.prototype.map.call(document.querySelectorAll("#tmRoles input:checked"), (i: HTMLInputElement) => Number(i.getAttribute("data-role"))) as number[];
}
