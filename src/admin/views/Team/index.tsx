/* =====================================================================
   TEAM — members, and the queue of people asking to get back in.
   ---------------------------------------------------------------------
   Rewired onto interior_admin's real user endpoints (v1/admin/users/,
   AdminUserViews) instead of IBData.TeamStore's localStorage store.

     /team        who is on the team, and what they may do
     /team/:id    the member page — identity AND the operational half, tabbed
     /roles       what a responsibility means, as a matrix (its own folder)

   KNOWN LIMITATION, not a bug here: the list endpoint
   (`getSelfCreatedUsersController`) returns only members the SIGNED-IN
   admin created, not the whole team. There is no "everyone" endpoint yet.
   Of the fields the old local engine had, active/last sign-in/added are now
   real (AdminUserTasks._accountFacts) and render in the drawer; designation,
   avatar, the locked/suspended statuses and the failed-attempt count have no
   column behind them and stay off the screen rather than being invented.
   ===================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AdminOpsService from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import {
  EmptyState, FilterChips, Icon, Pill, SearchField, Select, StatStrip, TbTitle, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { Avatar, RoleChips } from "../teamShared";
import type { Member, Ops, Role } from "../teamShared";
import { ListSkeleton } from "../../ui";
import MemberPage from "./MemberPage";
import { adoptPeople } from "./adopt";
import { RESOURCE_KIND, labelOf, missingDocs, readMember, readMembers, useMembers, useResources } from "./store";
import { opOf } from "./member/ops";
import { MemberNewModal } from "./memberModals";
import AccessRequests, { pendingRequests } from "./AccessRequests";

export default function Team() {
  const { id, sub } = useParams();
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Member[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const p: Record<string, string> = {
    q: sp.get("q") || "", role: sp.get("role") || "", dept: sp.get("dept") || "",
    tab: sp.get("tab") || "",
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

  useMembers();
  useResources();

  useEffect(() => {
    let cancelled = false;
    Promise.all([AdminOpsService.users(), AdminOpsService.listRoles()])
      .then(([u, r]) => {
        if (cancelled) return;
        /* The operational seed puts on the live roster's faces before anything
           renders against it — see adopt.ts. It is guarded because it must not
           be able to cost us the list: a re-key that fails leaves the seed's own
           ids in place, which is a worse demo and a working page. */
        try { adoptPeople(u.data); } catch { /* the seed keeps its own ids */ }
        setRows(u.data);
        setRoles(r.data.roles);
      })
      /* An empty list is a claim ("nobody here"); a failed read is not. Say
         which one this is, or a down service reads as an empty team. */
      .catch((e) => { if (!cancelled) { setRows([]); setRoles([]); toast(errMessage(e), "bad"); } });
    return () => { cancelled = true; };
  }, [tick]);

  /* ------------------------------------------------------------ chrome -- */
  const crumbs = useMemo(() => {
    if (!id) return <span className="tb-title">Team</span>;
    const u = (rows || []).find((x) => String(x.id) === id);
    const name = u ? u.name : readMember(id)?.name || "Member";
    /* ON AN OPERATION PAGE THE CRUMB SAYS BOTH. The name is the way back to the
       person; the operation is where you are. A topbar that named only the
       person on `/team/58/leave` would leave the deepest page in the module
       looking identical to the one above it. */
    const op = sub ? opOf(sub) : null;
    if (!op) return <TbTitle label={name} to="#/team" />;
    return (
      <>
        <TbTitle label={name} to={"#/team/" + id} />
        <span className="tb-sep">/</span>
        <span className="tb-title is-here">{op.label}</span>
      </>
    );
  }, [id, rows, sub]);
  /* Up from an operation is the member, not the roster. */
  usePageChrome({
    crumbs,
    parent: id ? (sub ? "#/team/" + id : "#/team" + qs(p)) : null,
  }, (id || "") + "/" + (sub || "") + p.tab);

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

  /* A ROW IS A PERSON AND IT OPENS THEIR PAGE. The drawer is gone: identity,
     access, attendance, work, reports, documents and pay are one screen with
     tabs, and the admin actions moved into its header. */
  if (id) {
    const u = rows.find((x) => String(x.id) === id) || null;
    return <MemberPage id={id} sub={sub || ""} live={u} roles={roles} ops={ops} />;
  }

  /* -------------------------------------------------------------- rows -- */
  let list = rows.slice();
  const depts = uniq(readMembers().map((m) => m.department).filter(Boolean) as string[]);
  if (p.role) list = list.filter((u) => u.roles.some((r) => String(r.id) === p.role));
  if (p.dept) list = list.filter((u) => (readMember(String(u.id))?.department || "") === p.dept);
  if (p.q) {
    const s = p.q.toLowerCase();
    list = list.filter((u) =>
      (u.name + " " + u.email + " " + (u.username || "") + " " + (u.phone || "")).toLowerCase().indexOf(s) >= 0);
  }

  const noRole = rows.filter((u) => !u.roles.length).length;
  const noDocs = rows.filter((u) => missingDocs(String(u.id)).length).length;
  const waiting = pendingRequests();
  const filtered = !!(p.q || p.role || p.dept);

  const cells: (StatCell | "sep")[] = [
    { k: "members", v: rows.length, to: "#/team", on: !p.role && !p.q },
    "sep",
    { k: "no role", v: noRole, dot: noRole ? "warn" : "", tone: noRole ? "warn" : "",
      title: "Signed-in and granted nothing — a successful login never implies access" },
    "sep",
    /* A COUNT, NEVER A GATE. Nothing in the panel blocks on a missing document —
       a hard gate would stop somebody working on their first day over a scan. */
    { k: "documents short", v: noDocs, dot: noDocs ? "warn" : "", tone: noDocs ? "warn" : "",
      title: "Members missing at least one required document. Nothing blocks on it." },
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
            {/* DEPARTMENT IS A FILTER, NOT AN ANSWER. `department` is already a
                string on every member, so filtering by it costs nothing. It
                does NOT settle what "my JD team" means — if that turns out to
                be a second company rather than a department, the roster needs a
                tenancy switch and this control is the wrong shape entirely. */}
            {depts.length ? (
              <Select key={"dept:" + p.dept} name="dept" label="Department"
                options={depts.map((d) => ({ v: d, l: d }))}
                value={p.dept} onFilter={setFilter} />
            ) : null}
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
              <FilterChips params={p} labels={{ q: "Search", role: "Role", dept: "Department" }}
                onUnfilter={unfilter} />
            </div>
          ) : null}

          <div className="dls-body">
            {list.length ? (
              <table className="tbl dls-tbl">
                <thead>
                  <tr>
                    <th style={{ width: "3px" }}></th><th>Member</th>
                    <th style={{ width: "220px" }}>Reports to</th>
                    <th style={{ width: "230px" }}>Role</th>
                    <th style={{ width: "190px" }}>Documents</th>
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
                      <td><ReportsTo id={String(u.id)} /></td>
                      <td><RoleChips u={u} /></td>
                      <td><DocsCell id={String(u.id)} /></td>
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

/* ================================================== two derived columns === */

/** WHO REVIEWS THIS PERSON, one level and never transitive. It is the same
 *  `reportsTo` the leave inbox routes on and the member page derives `senior`
 *  from — a second hierarchy for the word "captain" would give the module two
 *  answers to the same question and they would drift within a month. */
function ReportsTo({ id }: { id: string }) {
  const m = readMember(id);
  if (!m) return <span className="faint">—</span>;
  if (!m.reportsTo) return <span className="dim">nobody</span>;
  const s = readMember(m.reportsTo);
  return (
    <>
      <span className="cell-1">{s ? s.name : "—"}</span>
      <span className="cell-2">{m.department || m.designation}</span>
    </>
  );
}

/** MISSING DOCUMENTS, ON THE ROW. This is the whole enforcement: it shows here,
 *  on the member's own page and in the roster filter, and nothing anywhere
 *  blocks on it. Naming which ones are short is what makes the column
 *  actionable — "2 missing" sends somebody hunting. */
function DocsCell({ id }: { id: string }) {
  const m = readMember(id);
  if (!m) return <span className="faint">—</span>;
  const missing = missingDocs(id);
  if (!missing.length) return <Pill text="Complete" tone="ok" />;
  return (
    <>
      <Pill text={missing.length + " missing"} tone="warn" />
      <span className="cell-2">{missing.map((k) => labelOf(RESOURCE_KIND, k)).join(", ")}</span>
    </>
  );
}

/** Distinct, order preserved. */
function uniq(list: string[]): string[] {
  const out: string[] = [];
  list.forEach((x) => { if (out.indexOf(x) < 0) out.push(x); });
  return out.sort();
}
