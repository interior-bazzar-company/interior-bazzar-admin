/* =====================================================================
   ROLES — what a responsibility means, as a per-module level.
   ---------------------------------------------------------------------
   Rewired onto GET /api/v1/admin/roles/, which returns the module
   inventory — each with the VERBS it supports — AND the roles in one call.
   Same module list `me/permissions/` uses to drive the nav, so this page and
   the sidebar can never disagree about what a "module" is.

     /roles       every role, and how many people hold it (userCount,
                  given by the server — no separate members fetch)
     /roles/:id   the role drawer — its per-module levels

   A role carries an ACTIVE/INACTIVE status (`isActive`). Inactive is not a
   soft delete: the role keeps its name, its matrix and its members, but the
   server drops it from every permission resolve, so it grants nothing —
   which is why an inactive row wears the exception rail. `isSystem` is
   separate — it protects every system-seeded role from edit and delete, not
   just Super Admin.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AdminOpsService from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import type { RolesModuleDef } from "../../../api/modules/adminOps";
import { Button, EmptyState, FilterBar, FilterChips, ListSkeleton, ListTable, PageHeader, Pill, qs, Rail, SearchField, StatStrip, TbTitle } from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { HIDDEN_MODULES } from "../../auth/session";
import { useShell } from "../../shell/ShellContext";
import type { Ops, Role } from "../teamShared";
import RoleDrawer from "./RoleDrawer";
import { RoleModal } from "./roleModals";

/* WHAT THIS ROLE CAN REACH, at a glance. `view` is the gate, so a module
   without it is not granted however many other verbs carry a tick — count
   what the server would actually honour, and say how many verbs deep the
   grant goes so "reads Deals" and "runs Deals" do not look identical. */
function ModuleChips({ role, mods }: { role: Role; mods: RolesModuleDef[] }) {
  if (role.isFullAccess) return <Pill xs tone="brand" text="everything" title="A wildcard: every module, every verb, including ones added later" />;
  const held = mods.filter((m) => (role.modules[m.key] || []).indexOf("view") >= 0);
  if (!held.length) return <span className="text-sm text-quaternary">nothing yet</span>;
  const shown = held.slice(0, 5);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((m) => {
        const verbs = role.modules[m.key] || [];
        return <Pill key={m.key} xs tone="neutral" title={verbs.join(", ")}
          text={verbs.length > 1 ? m.label + " ·" + verbs.length : m.label} />;
      })}
      {held.length > shown.length
        ? <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset"
            title={held.slice(shown.length).map((m) => m.label).join(", ")}>
            +{held.length - shown.length}
          </span>
        : null}
    </span>
  );
}

export default function Roles() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { drawer, modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<{ modules: RolesModuleDef[]; roles: Role[] } | null>(null);

  const p: Record<string, string> = { q: sp.get("q") || "" };

  const ops = useMemo<Ops>(() => {
    const refresh = () => setTick((t) => t + 1);
    return {
      done: (msg: string, hash?: string) => {
        closeLayer(); toast(msg); if (hash) go(hash); refresh();
      },
      toast, modal, closeLayer, go, refresh,
    };
  }, [closeLayer, toast, modal, go]);

  useEffect(() => {
    let cancelled = false;
    AdminOpsService.listRoles()
      /* Same hidden set the nav uses: a module with no screen anywhere must not
         be offerable as a grant either, or the matrix hands out access to a
         page that does not exist. */
      .then((res) => { if (!cancelled) setData({
        roles: res.data.roles || [],
        modules: (res.data.modules || []).filter((m) => !HIDDEN_MODULES.has(m.key)),
      }); })
      .catch((e) => { if (!cancelled) { setData({ modules: [], roles: [] }); toast(errMessage(e), "bad"); } });
    return () => { cancelled = true; };
  }, [tick, toast]);

  const crumbs = useMemo(() => (id ? undefined : <TbTitle label="Roles" to="#/roles" />), [id]);
  usePageChrome({ crumbs, parent: id ? "#/roles" + qs(p) : null });

  /* Wide, because the matrix inside it is one column per verb. */
  useEffect(() => {
    if (!id || !data) return;
    const r = data.roles.find((x) => String(x.id) === id);
    if (!r) { toast("404 role_not_found.", "bad"); go("#/roles"); return; }
    drawer(<RoleDrawer role={r} mods={data.modules} ops={ops} />, undefined, "xl");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick, data]);

  /* …and it closes itself when the id goes away — deleting a role otherwise
     left its drawer open over a list that no longer listed it. Same line Plans,
     Quotations and Invoices already carry. */
  useEffect(() => { if (!id) return; return () => closeLayer(); }, [id, closeLayer]);

  /* ----------------------------------------------------------- filters -- */
  function setSearch(name: string, value: string) {
    const q: Record<string, string> = { ...p, [name]: value };
    go("#/roles" + qs(q));
  }
  function unfilter(k: string) {
    if (k === "*" || k === "q") {
      const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
      if (el) el.value = "";
    }
    go("#/roles");
  }

  if (!data) return <ListSkeleton />;

  /* -------------------------------------------------------------- rows -- */
  let rows: Role[] = data.roles.slice();
  if (p.q) {
    const s = p.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().indexOf(s) >= 0);
  }
  rows.sort((a, b) => {
    if (a.isFullAccess !== b.isFullAccess) return a.isFullAccess ? -1 : 1;
    return b.userCount - a.userCount;
  });

  const filtered = !!p.q;
  const inactive = data.roles.filter((r) => !r.isActive).length;
  const system = data.roles.filter((r) => r.isSystem).length;
  const cells: (StatCell | "sep")[] = [
    { k: "roles", v: data.roles.length },
    "sep",
    { k: "inactive", v: inactive, dot: inactive ? "warn" : "neutral", tone: inactive ? "warn" : "",
      title: "Deactivated roles — still assigned, but grant nothing" },
    "sep",
    { k: "protected", v: system, dot: "sys",
      title: "System roles — cannot be edited or deleted" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Roles"
        meta={<>
          <span>{data.roles.length} responsibilit{data.roles.length === 1 ? "y" : "ies"}</span>
          <span>{data.modules.length} modules to grant</span>
        </>}
        actions={can("roles", "create")
          ? <Button color="primary" ico="plus" data-act="rl-new"
              onClick={() => modal(<RoleModal role={null} mods={data.modules} ops={ops} />, "xl")}>
              New role
            </Button>
          : null}
      />

      <FilterBar
        search={<SearchField ph="Search role…" val={p.q} onFilter={setSearch} />}
        chips={filtered ? <FilterChips params={p} labels={{ q: "Search" }} onUnfilter={unfilter} /> : null}
      />

      <StatStrip cells={cells} />

      {rows.length ? (
        <ListTable min="52rem" head={<tr>
          <th className="rail" /><th scope="col">Role</th><th scope="col">Status</th>
          <th scope="col">Modules granted</th><th scope="col" className="n">Members</th>
          <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
        </tr>}>
          {rows.map((r) => {
            const editable = can("roles", "edit") && !r.isSystem;
            const to = "#/roles/" + r.id;
            return (
              <tr key={r.id} className="clickable" data-go={to} onClick={() => go(to)}>
                <Rail tone={r.isActive ? undefined : "warn"}
                  title={r.isActive ? undefined : "Inactive — the server ignores every tick on it"} />
                <td className="cell-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {r.name}
                    {r.isSystem ? <Pill xs tone="sys" text="protected" title="Defined by the system" /> : null}
                  </span>
                </td>
                <td>{r.isActive
                  ? <Pill dot tone="ok" text="Active" />
                  : <Pill dot tone="warn" text="Inactive" title="Still assigned, but grants nothing" />}</td>
                <td><ModuleChips role={r} mods={data.modules} /></td>
                <td className="n">{r.userCount || <span className="text-quaternary">—</span>}</td>
                <td className="acts" onClick={(e) => e.stopPropagation()}>
                  {editable ? (
                    <Button color="secondary" size="xs" ico="edit" data-act="rl-edit" data-ref={r.id}
                      onClick={() => modal(<RoleModal role={r} mods={data.modules} ops={ops} />, "xl")}>
                      Edit
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </ListTable>
      ) : (
        <EmptyState icon="shield"
          title={filtered ? "No roles match" : "No roles yet"}
          body={filtered
            ? "Nothing matches that name. Clear the search to see them all."
            : "A role is a named set of capabilities — one row per module, one tick per verb. Create one and assign it to members."}
          action={filtered
            ? <Button color="secondary" ico="x" data-unfilter="*" onClick={() => unfilter("*")}>Clear the search</Button>
            : can("roles", "create")
              ? <Button color="primary" ico="plus" data-act="rl-new"
                  onClick={() => modal(<RoleModal role={null} mods={data.modules} ops={ops} />, "xl")}>New role</Button>
              : null} />
      )}
    </div>
  );
}
