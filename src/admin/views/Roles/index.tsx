/* =====================================================================
   ROLES — what a responsibility means, as a matrix.
   ---------------------------------------------------------------------
   Ported from V.roles in views-team.js, on the same list shell Team uses.

     /roles       every role, and how many people hold it
     /roles/:id   the role drawer — its matrix, and its holders

   A role is a responsibility: a name and a set of capabilities. The
   matrix is built from the SAME module inventory the nav and the router
   read (shell/modules.ts), so a module added there gets a permission
   column without anybody writing a second list.
   ===================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { IBTeam } from "../../engines";
import { EmptyState, FilterChips, Icon, Pill, SearchField, Select, StatStrip, cap, qs } from "../../ui";
import type { StatCell } from "../../ui";
import { moduleLabel } from "../../shell/modules";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import type { Member, Ops, Role } from "../teamShared";
import RoleDrawer from "./RoleDrawer";
import { RoleModal } from "./roleModals";

function ModuleChips({ role }: { role: Role }) {
  if (role.is_super) return <span className="pill brand xs">everything</span>;
  const mods: string[] = IBTeam.grantedModules(role);
  if (!mods.length) return <span className="faint">nothing yet</span>;
  return (
    <span className="dls-tags">
      {mods.slice(0, 5).map((k) => <span className="pill xs" key={k}>{moduleLabel(k)}</span>)}
      {mods.length > 5 ? <span className="pill xs faint">+{mods.length - 5}</span> : null}
    </span>
  );
}

export default function Roles() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { drawer, modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);

  const p: Record<string, string> = { q: sp.get("q") || "", status: sp.get("status") || "" };

  const ops = useMemo<Ops>(() => {
    const refresh = () => setTick((t) => t + 1);
    return {
      done: (msg: string, hash?: string) => {
        closeLayer(); toast(msg); if (hash) go(hash); refresh();
      },
      toast, modal, closeLayer, go, refresh,
    };
  }, [closeLayer, toast, modal, go]);

  const crumbs = useMemo(() => (id ? undefined : <span className="tb-title">Roles</span>), [id]);
  usePageChrome({ crumbs, parent: id ? "#/roles" + qs(p) : null });

  useEffect(() => {
    if (!id) return;
    if (!IBTeam.roleOf(id)) { toast("404 role_not_found.", "bad"); go("#/roles"); return; }
    drawer(<RoleDrawer id={id} ops={ops} />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  /* ----------------------------------------------------------- filters -- */
  const typing = useRef<number | undefined>(undefined);
  function setFilter(name: string, value: string) {
    const q: Record<string, string> = { ...p };
    q[name] = value;
    go("#/roles" + (id ? "/" + id : "") + qs(q));
  }
  function setSearch(name: string, value: string) {
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => setFilter(name, value), 220);
  }
  function unfilter(k: string) {
    /* Uncontrolled search box — clearing the chip clears the field. See Team. */
    if (k === "*" || k === "q") {
      const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
      if (el) el.value = "";
    }
    const q: Record<string, string> = {};
    if (k !== "*") Object.keys(p).forEach((x) => { if (x !== k) q[x] = p[x]; });
    go("#/roles" + qs(q));
  }

  /* -------------------------------------------------------------- rows -- */
  const all: Role[] = IBTeam.allRoles();
  let rows = all.slice();
  if (p.status) rows = rows.filter((r) => r.status === p.status);
  if (p.q) {
    const s = p.q.toLowerCase();
    rows = rows.filter((r) => (r.name + " " + (r.description || "")).toLowerCase().indexOf(s) >= 0);
  }
  const mem: Member[] = IBTeam.members();
  const holders = (r: Role) =>
    mem.filter((u) => IBTeam.roleIdsOf(u).indexOf(r.role_id) >= 0).length;
  rows.sort((a, b) => {
    if (a.is_super !== b.is_super) return a.is_super ? -1 : 1;
    return holders(b) - holders(a);
  });

  const me = IBTeam.currentUser();
  const filtered = !!(p.q || p.status);

  const cells: (StatCell | "sep")[] = [
    { k: "roles", v: all.length },
    "sep",
    { k: "active", v: all.filter((r) => r.status === "active").length, dot: "ok" },
    { k: "inactive", v: all.filter((r) => r.status !== "active").length,
      title: "An inactive role grants nothing, even to members who hold it" },
    "sep",
    { k: "members", v: mem.length, to: "#/team", title: "Open Team" },
  ];

  return (
    <div className="dls">
      <div className="dls-cmd">
        <SearchField ph="Search role or description…" val={p.q} onFilter={setSearch} />
        <Select key={"status:" + p.status} name="status" label="Status"
                options={[{ v: "active", l: "Active" }, { v: "inactive", l: "Inactive" }]}
                value={p.status} onFilter={setFilter} />
        <span className="spacer"></span>
        {can("roles", "create") ? (
          <button className="btn pri" data-act="rl-new"
                  onClick={() => modal(<RoleModal role={null} ops={ops} />, "wide")}>
            <Icon name="plus" />Create role
          </button>
        ) : null}
      </div>

      <StatStrip cells={cells} />

      {filtered ? (
        <div className="dls-chips">
          <FilterChips params={p} labels={{ q: "Search", status: "Status" }} onUnfilter={unfilter} />
        </div>
      ) : null}

      <div className="dls-body">
        {rows.length ? (
          <table className="tbl dls-tbl">
            <thead>
              <tr>
                <th style={{ width: "3px" }}></th><th>Role</th><th>Modules granted</th>
                <th className="n">Members</th><th>Status</th><th className="c">Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const n = holders(r);
                /* Editing a role is the point of this page, so it is on the row
                   rather than two clicks into a drawer. The row still opens the
                   drawer for everything else — who holds it, what it resolves
                   to — and a button inside a clickable row wins the click. */
                const iHold = !!(me && IBTeam.roleIdsOf(me).indexOf(r.role_id) >= 0 && !IBTeam.isSuper(me));
                const editable = can("roles", "edit") && !r.is_super && !iHold;
                return (
                  <tr key={r.role_id} className={"clickable" + (r.status === "active" ? "" : " dim")}
                      data-go={"#/roles/" + r.role_id} onClick={() => go("#/roles/" + r.role_id)}>
                    <td className="rail"><i></i></td>
                    <td>
                      <div className="cell-1">{r.name}
                        {r.is_super ? <> <span className="pill brand xs">protected</span></> : null}
                      </div>
                      <div className="cell-2">{r.description || "—"}</div>
                    </td>
                    <td><ModuleChips role={r} /></td>
                    <td className="n tnum">{n || <span className="faint">—</span>}</td>
                    <td><Pill text={cap(r.status)} tone={r.status === "active" ? "ok" : ""} /></td>
                    <td className="c">
                      {/* Deliberately NOT `.rowact`, which is opacity:0 until the
                          row is hovered. That convention is right for a secondary
                          action on a dense table; it is wrong here, because "where
                          do I edit a role" was the question this column exists to
                          answer, and a control you find by accident does not answer
                          it. Same reasoning the redesign applied to the sidebar
                          collapse button. */}
                      {editable ? (
                        <button className="btn sm" data-act="rl-edit" data-ref={r.role_id}
                                title={"Edit " + r.name}
                                onClick={(e) => { e.stopPropagation(); modal(<RoleModal role={r} ops={ops} />, "wide"); }}>
                          Edit
                        </button>
                      ) : (
                        <span className="faint" title={r.is_super
                          ? "Super Admin is defined by the system"
                          : iHold ? "You hold this role — somebody else has to change it"
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
