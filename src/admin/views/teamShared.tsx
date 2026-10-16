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
import { Avatar as UIAvatar, Icon, Notice, Pill, errorHeadline } from "../ui";
import { getGroupOf } from "../shell/modules";
import { AppExceptions } from "../../api/apiService";
import type { AdminRole, AdminUserRole, AdminUserRow, RoleActionDef, RoleModules, RolesModuleDef } from "../../api/modules/adminOps";

const MODULE_GROUP_FALLBACK: Record<string, string> = {
  overview: "Overview",
  deals: "Sales",
  enquiries: "Sales",
  quotations: "Sales",
  invoices: "Sales",
  projects: "Client Ops",
  vendors: "Client Ops",
  boq: "Client Ops",
  orders: "Client Ops",
  execution: "Client Ops",
  users: "Business Ops",
  "business-enquiries": "Business Ops",
  team: "Team",
  roles: "Team",
  attendance: "Team",
  work: "Team",
  reports: "Team",
  resources: "Resources",
  agreements: "Resources",
  finance: "Finance",
  "finance-installments": "Finance",
  "finance-salaries": "Finance",
  "finance-transactions": "Finance",
  "finance-refunds": "Finance",
  "finance-analytics": "Finance",
  plans: "Catalogue",
  products: "Catalogue",
  categories: "Catalogue",
  catalogue: "Catalogue",
  audit: "Settings",
  settings: "Settings",
};

const MATRIX_GROUP_ORDER = [
  "Overview",
  "Sales",
  "Client Ops",
  "Business Ops",
  "Team",
  "Resources",
  "Finance",
  "Catalogue",
  "Settings",
];

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

  /* Group modules by their sidebar category so permissions are organized into collapsible sections,
     and within each module only show the verbs applicable to that module (no horizontal scrolling). */
  const navGroups = getGroupOf();
  const groups: { key: string; label: string; items: RoleModuleDef[] }[] = [];
  const byGroup: Record<string, { key: string; label: string; items: RoleModuleDef[] }> = {};
  mods.forEach((m) => {
    const resolved =
      MODULE_GROUP_FALLBACK[m.key] ||
      navGroups[m.key] ||
      m.groupLabel ||
      (m.key.startsWith("finance") ? "Finance" : "Settings");
    const gKey = resolved.toLowerCase().replace(/\s+/g, "-");
    if (!byGroup[gKey]) {
      byGroup[gKey] = { key: gKey, label: resolved, items: [] };
      groups.push(byGroup[gKey]);
    }
    byGroup[gKey].items.push(m);
  });
  groups.sort((a, b) => {
    const ia = MATRIX_GROUP_ORDER.indexOf(a.label);
    const ib = MATRIX_GROUP_ORDER.indexOf(b.label);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return (
    <div
      id={editable ? "rlMatrix" : undefined}
      className="max-h-[70vh] w-full overflow-y-auto scrollbar-thin rounded-xl bg-primary ring-1 ring-secondary divide-y divide-border-secondary"
      role="region"
      aria-label="Permissions by module group"
    >
      {groups.map((g) => (
        <details key={g.key} open className="group/sec">
          <summary className="flex cursor-pointer list-none items-center justify-between bg-secondary px-4 py-2.5 text-xs font-semibold tracking-wider text-secondary uppercase select-none hover:bg-secondary_hover">
            <span className="flex items-center gap-2">
              <Icon name="chevr" size="xs" className="transition-transform group-open/sec:rotate-90" />
              <span>{g.label}</span>
              <span className="font-mono text-2xs font-normal text-quaternary">({g.items.length})</span>
            </span>
          </summary>
          <div className="divide-y divide-border-secondary">
            {g.items.map((m) => {
              const held = grants![m.key] || [];
              const actions = (m.actions || [])
                .slice()
                .sort((a, b) => (a.key === VIEW ? -1 : b.key === VIEW ? 1 : a.minLevel - b.minLevel || (a.key < b.key ? -1 : 1)));
              return (
                <div key={m.key} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between hover:bg-primary_hover">
                  <div className="flex shrink-0 items-center gap-2 sm:w-52 sm:pt-0.5">
                    <b className="text-sm font-medium text-primary">{m.label}</b>
                    {editable && actions.length ? (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center rounded bg-secondary px-1.5 py-0.5 text-2xs font-semibold text-secondary ring-1 ring-secondary ring-inset transition hover:bg-secondary_hover hover:text-primary"
                        data-act="rl-row-all"
                        title={"Grant all verbs for " + m.label}
                        onClick={(e) => setAll(e.currentTarget, m.key, null)}
                      >
                        Grant all
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {actions.map((a) => {
                      const isHeld = held.indexOf(a.key) >= 0;
                      return editable ? (
                        <label
                          key={a.key}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-1 text-xs ring-1 ring-secondary ring-inset hover:bg-secondary"
                          title={(a as { label?: string }).label || a.key}
                        >
                          <NativeCheck
                            data-mod={m.key}
                            data-verb={a.key}
                            aria-label={m.label + " " + a.key}
                            defaultChecked={isHeld}
                            onChange={(e) => onToggle(m, a.key, e.currentTarget.checked)}
                          />
                          <Pill xs tone={levelTone(a.minLevel)} text={a.key} />
                        </label>
                      ) : (
                        <span
                          key={a.key}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs ring-1 ring-inset",
                            isHeld ? "bg-secondary text-primary ring-secondary" : "text-quaternary ring-transparent opacity-50"
                          )}
                        >
                          {isHeld ? <Icon name="check" size="xs" className="text-fg-success-primary" /> : null}
                          <Pill xs tone={isHeld ? levelTone(a.minLevel) : "neutral"} text={a.key} />
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
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
          <b>{errorHeadline(err.http)}</b>
          {err.message ? <div className="mt-0.5">{err.message}</div> : null}
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
