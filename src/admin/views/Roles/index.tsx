/* =====================================================================
   ROLES — what a responsibility means, as a per-module level.
   ---------------------------------------------------------------------
   Rewired onto GET /api/v1/admin/roles/, which returns the module
   inventory AND the roles in one call — the same module list `me/
   permissions/` uses to drive the nav, so this page and the sidebar can
   never disagree about what a "module" is.

     /roles       every role, and how many people hold it (userCount,
                  given by the server — no separate members fetch)
     /roles/:id   the role drawer — its per-module levels

   Roles carry no active/inactive status in this contract (unlike the old
   local engine) — a role exists or it doesn't. `isSystem` replaces the old
   "Super Admin is protected" special case for every system-seeded role,
   not just one.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AdminOpsService from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import type { RolesModuleDef } from "../../../api/modules/adminOps";
import { EmptyState, FilterChips, Icon, SearchField, StatStrip, qs } from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { HIDDEN_MODULES } from "../../auth/session";
import { useShell } from "../../shell/ShellContext";
import type { Ops, Role } from "../teamShared";
import { ListSkeleton } from "../../ui";
import RoleDrawer from "./RoleDrawer";
import { RoleModal } from "./roleModals";

function ModuleChips({ role, mods }: { role: Role; mods: RolesModuleDef[] }) {
  if (role.isFullAccess) return <span className="pill brand xs">everything</span>;
  const held = mods.filter((m) => (role.modules[m.key] || 0) > 0);
  if (!held.length) return <span className="faint">nothing yet</span>;
  return (
    <span className="dls-tags">
      {held.slice(0, 5).map((m) => <span className="pill xs" key={m.key}>{m.label}</span>)}
      {held.length > 5 ? <span className="pill xs faint">+{held.length - 5}</span> : null}
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
        roles: res.data.roles,
        modules: res.data.modules.filter((m) => !HIDDEN_MODULES.has(m.key)),
      }); })
      .catch((e) => { if (!cancelled) { setData({ modules: [], roles: [] }); toast(errMessage(e), "bad"); } });
    return () => { cancelled = true; };
  }, [tick]);

  const crumbs = useMemo(() => (id ? undefined : <span className="tb-title">Roles</span>), [id]);
  usePageChrome({ crumbs, parent: id ? "#/roles" + qs(p) : null });

  useEffect(() => {
    if (!id || !data) return;
    const r = data.roles.find((x) => String(x.id) === id);
    if (!r) { toast("404 role_not_found.", "bad"); go("#/roles"); return; }
    drawer(<RoleDrawer role={r} mods={data.modules} ops={ops} />);
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
  const cells: (StatCell | "sep")[] = [
    { k: "roles", v: data.roles.length },
    "sep",
    { k: "protected", v: data.roles.filter((r) => r.isSystem).length,
      title: "System roles — cannot be edited or deleted" },
  ];

  return (
    <div className="dls">
      <div className="dls-cmd">
        <SearchField ph="Search role…" val={p.q} onFilter={setSearch} />
        <span className="spacer"></span>
        {can("roles", "create") ? (
          <button className="btn pri" data-act="rl-new"
                  onClick={() => modal(<RoleModal role={null} mods={data.modules} ops={ops} />, "wide")}>
            <Icon name="plus" />Create role
          </button>
        ) : null}
      </div>

      <StatStrip cells={cells} />

      {filtered ? (
        <div className="dls-chips">
          <FilterChips params={p} labels={{ q: "Search" }} onUnfilter={unfilter} />
        </div>
      ) : null}

      <div className="dls-body">
        {rows.length ? (
          <table className="tbl dls-tbl">
            <thead>
              <tr>
                <th style={{ width: "3px" }}></th><th>Role</th><th>Modules granted</th>
                <th className="n">Members</th><th className="c">Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const editable = can("roles", "edit") && !r.isSystem;
                return (
                  <tr key={r.id} className="clickable"
                      data-go={"#/roles/" + r.id} onClick={() => go("#/roles/" + r.id)}>
                    <td className="rail"><i></i></td>
                    <td>
                      <div className="cell-1">{r.name}
                        {r.isSystem ? <> <span className="pill brand xs">protected</span></> : null}
                      </div>
                    </td>
                    <td><ModuleChips role={r} mods={data.modules} /></td>
                    <td className="n tnum">{r.userCount || <span className="faint">—</span>}</td>
                    <td className="c">
                      {editable ? (
                        <button className="btn sm" data-act="rl-edit" data-ref={r.id}
                                title={"Edit " + r.name}
                                onClick={(e) => { e.stopPropagation(); modal(<RoleModal role={r} mods={data.modules} ops={ops} />, "wide"); }}>
                          Edit
                        </button>
                      ) : (
                        <span className="faint" title={r.isSystem
                          ? "This role is defined by the system"
                          : "You do not have permission to edit roles"}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon="shield" title="No roles match"
                      body="A role is a named set of capabilities. Create one and assign it to members." />
        )}
      </div>
    </div>
  );
}
