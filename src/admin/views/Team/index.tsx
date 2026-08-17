/* =====================================================================
   TEAM — members, and the queue of people asking to get back in.
   ---------------------------------------------------------------------
   Rewired onto interior_admin's real user endpoints (v1/admin/users/,
   AdminUserViews) instead of IBData.TeamStore's localStorage store.

     /team        who is on the team, and what they may do
     /team/:id    the member drawer
     /roles       what a responsibility means, as a matrix (its own folder)

   KNOWN LIMITATION, not a bug here: the list endpoint
   (`getSelfCreatedUsersController`) returns only members the SIGNED-IN
   admin created, not the whole team. There is no "everyone" endpoint yet.
   See the report for the full list of fields the old local engine had that
   the real user record does not (status/lifecycle, designation, avatar,
   last sign-in, registration date) — those columns and controls are gone
   rather than shown against data that doesn't exist.
   ===================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AdminOpsService from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import {
  EmptyState, FilterChips, Icon, SearchField, Select, StatStrip, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { Avatar, RoleChips } from "../teamShared";
import type { Member, Ops, Role } from "../teamShared";
import { ListSkeleton } from "../../ui";
import MemberDrawer from "./MemberDrawer";
import { MemberNewModal } from "./memberModals";
import AccessRequests, { pendingRequests } from "./AccessRequests";

export default function Team() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { drawer, modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Member[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const p: Record<string, string> = {
    q: sp.get("q") || "", role: sp.get("role") || "", tab: sp.get("tab") || "",
  };
  const tab = p.tab === "requests" ? "requests" : "members";

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
    Promise.all([AdminOpsService.users(), AdminOpsService.listRoles()])
      .then(([u, r]) => {
        if (cancelled) return;
        setRows(u.data);
        setRoles(r.data.roles);
      })
      /* An empty list is a claim ("nobody here"); a failed read is not. Say
         which one this is, or a down service reads as an empty team. */
      .catch((e) => { if (!cancelled) { setRows([]); setRoles([]); toast(errMessage(e), "bad"); } });
    return () => { cancelled = true; };
  }, [tick]);

  /* ------------------------------------------------------------ chrome -- */
  const crumbs = useMemo(() => (id ? undefined : <span className="tb-title">Team</span>), [id]);
  usePageChrome({ crumbs, parent: id ? "#/team" + qs(p) : null });

  /* The drawer is the record. It re-opens itself on every data change, which
     is how the prototype's `render()` behaved after a write. */
  useEffect(() => {
    if (!id || !rows) return;
    const u = rows.find((x) => String(x.id) === id);
    if (!u) { toast("404 member_not_found.", "bad"); go("#/team"); return; }
    drawer(<MemberDrawer member={u} roles={roles} ops={ops} />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick, rows]);

  /* …and it closes itself when the id goes away. Without this, deleting a
     member left their drawer on screen — over a list that no longer had them —
     still offering Edit and Delete on a record the server had dropped. Same
     line Plans, Quotations and Invoices already carry. */
  useEffect(() => { if (!id) return; return () => closeLayer(); }, [id, closeLayer]);

  /* ----------------------------------------------------------- filters -- */
  const typing = useRef<number | undefined>(undefined);
  function setFilter(name: string, value: string) {
    const q: Record<string, string> = { ...p };
    q[name] = value;
    go("#/team" + (id ? "/" + id : "") + qs(q));
  }
  function setSearch(name: string, value: string) {
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => setFilter(name, value), 220);
  }
  function unfilter(k: string) {
    if (k === "*" || k === "q") {
      const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
      if (el) el.value = "";
    }
    const q: Record<string, string> = {};
    if (k !== "*") Object.keys(p).forEach((x) => { if (x !== k) q[x] = p[x]; });
    else if (p.tab) q.tab = p.tab;
    go("#/team" + qs(q));
  }

  function tabTo(k: string) {
    const q: Record<string, string> = { ...p };
    q.tab = k === "members" ? "" : k;
    return "#/team" + qs(q);
  }

  if (!rows) return <ListSkeleton />;

  /* -------------------------------------------------------------- rows -- */
  let list = rows.slice();
  if (p.role) list = list.filter((u) => u.roles.some((r) => String(r.id) === p.role));
  if (p.q) {
    const s = p.q.toLowerCase();
    list = list.filter((u) =>
      (u.name + " " + u.email + " " + (u.username || "") + " " + (u.phone || "")).toLowerCase().indexOf(s) >= 0);
  }

  const noRole = rows.filter((u) => !u.roles.length).length;
  const waiting = pendingRequests();
  const filtered = !!(p.q || p.role);

  const cells: (StatCell | "sep")[] = [
    { k: "members", v: rows.length, to: "#/team", on: !p.role && !p.q },
    "sep",
    { k: "no role", v: noRole, dot: noRole ? "warn" : "", tone: noRole ? "warn" : "",
      title: "Signed-in and granted nothing — a successful login never implies access" },
    "sep",
    { k: "roles", v: roles.length, to: "#/roles", title: "Open Roles" },
  ];

  return (
    <div className="dls">
      {/* Two collections behind one module: the people, and the people asking
          to get back in. Same `?tab=` convention the Platform surfaces use. */}
      <div className="dls-chips">
        <div className="tabs">
          <button className={tab === "members" ? "on" : ""} data-go={tabTo("members")}
                  onClick={() => go(tabTo("members"))}>Members<span className="n">{rows.length}</span></button>
          <button className={tab === "requests" ? "on" : ""} data-go={tabTo("requests")}
                  onClick={() => go(tabTo("requests"))}>
            Access requests{waiting ? <span className="n">{waiting}</span> : null}
          </button>
        </div>
      </div>

      {tab === "members" ? (
        <>
          <div className="dls-cmd">
            <SearchField ph="Search name, email or username…" val={p.q} onFilter={setSearch} />
            <Select key={"role:" + p.role} name="role" label="Role"
              options={roles.map((r) => ({ v: String(r.id), l: r.name }))}
              value={p.role} onFilter={setFilter} />
            <span className="spacer"></span>
            {can("team", "create") ? (
              <button className="btn pri" data-act="tm-new"
                      onClick={() => modal(<MemberNewModal roles={roles} ops={ops} />, "wide")}>
                <Icon name="plus" />Add member
              </button>
            ) : null}
          </div>

          <StatStrip cells={cells} />

          {filtered ? (
            <div className="dls-chips">
              <FilterChips params={p} labels={{ q: "Search", role: "Role" }} onUnfilter={unfilter} />
            </div>
          ) : null}

          <div className="dls-body">
            {list.length ? (
              <table className="tbl dls-tbl">
                <thead>
                  <tr>
                    <th style={{ width: "3px" }}></th><th>Member</th><th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.id} className={"clickable" + (u.roles.length ? "" : " u-warn")}
                        data-go={"#/team/" + u.id} onClick={() => go("#/team/" + u.id)}>
                      <td className="rail"><i title={u.roles.length ? undefined : "Active with no role — can sign in, can do nothing"}></i></td>
                      <td>
                        <div className="cell-1" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar u={u} />
                          <span>{u.name}
                            {u.isSuperAdmin ? <> <span className="pill brand xs">Full access</span></> : null}
                          </span>
                        </div>
                        <div className="cell-2 mono">{u.username || "—"} · {u.email}</div>
                      </td>
                      <td><RoleChips u={u} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon="team"
                title={filtered ? "No members match these filters" : "No team members"}
                body={filtered
                  ? "Nothing matches. Clear a filter to widen the search."
                  : "Members are created here by an admin — there is no public signup."}
                action={filtered
                  ? <button className="btn" data-unfilter="*" onClick={() => unfilter("*")}>Clear all filters</button>
                  : <button className="btn pri" data-act="tm-new"
                            onClick={() => modal(<MemberNewModal roles={roles} ops={ops} />, "wide")}>Add member</button>}
              />
            )}
          </div>
        </>
      ) : (
        <div className="dls-body"><AccessRequests /></div>
      )}
    </div>
  );
}
