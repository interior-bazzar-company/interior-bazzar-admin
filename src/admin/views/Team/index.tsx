/* =====================================================================
   TEAM — members, and the queue of people asking to get back in.
   ---------------------------------------------------------------------
   Ported from V.team in views-team.js. The list shell the Sales pages and
   Plans use: a topbar title, a command row, one stat strip, the filters,
   and a table in a viewport-bounded body.

     /team        who is on the team, and what they may do
     /team/:id    the member drawer
     /roles       what a responsibility means, as a matrix (its own folder)

   A MEMBER is an identity; a ROLE is a responsibility. Nobody's
   permissions are edited on their own record — you change what a role
   means, or which roles somebody holds. That is why "Sales Agent" is
   editable in one place instead of eleven.

   Registering on the sign-in page writes the SAME `ib_team_users` store
   through IBData.TeamStore, so the person appears here pending a role,
   holding zero access, and the sidebar badge goes up by one. Everything
   below reads and writes through TeamStore / IBTeam only.
   ===================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { IBTeam } from "../../engines";
import {
  EmptyState, FilterChips, Icon, SearchField, Select, StatStrip, qs, cap,
} from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { Avatar, RoleChips, StatusPill, whenever } from "../teamShared";
import type { Member, Ops } from "../teamShared";
import MemberDrawer from "./MemberDrawer";
import { MemberNewModal } from "./memberModals";
import AccessRequests, { pendingRequests } from "./AccessRequests";

/* An account rots in two ways: it can sign in and do nothing, or it is
   locked out and nobody has noticed. */
function urgency(u: Member): { cls: string; why: string } | null {
  if (u.status === "locked")
    return { cls: "u-bad", why: "Locked after " + (u.failedAttempts || 5) + " failed attempts" };
  if (u.status === "active" && !IBTeam.roleIdsOf(u).length)
    return { cls: "u-warn", why: "Active with no role — can sign in, can do nothing" };
  return null;
}

export default function Team() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { drawer, modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);

  const p: Record<string, string> = {
    q: sp.get("q") || "", role: sp.get("role") || "", status: sp.get("status") || "",
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

  /* ------------------------------------------------------------ chrome -- */
  const crumbs = useMemo(() => (id ? undefined : <span className="tb-title">Team</span>), [id]);
  usePageChrome({ crumbs, parent: id ? "#/team" + qs(p) : null });

  /* The drawer is the record. It re-opens itself on every data change, which
     is how the prototype's `render()` behaved after a write. */
  useEffect(() => {
    if (!id) return;
    if (!IBTeam.memberOf(id)) { toast("404 member_not_found.", "bad"); go("#/team"); return; }
    drawer(<MemberDrawer id={id} ops={ops} />);
    /* `drawer` and `ops` are stable; re-running on the shell's own layer state
       would re-open the drawer forever. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  /* ----------------------------------------------------------- filters -- */
  const typing = useRef<number | undefined>(undefined);
  function setFilter(name: string, value: string) {
    const q: Record<string, string> = { ...p };
    q[name] = value;
    go("#/team" + (id ? "/" + id : "") + qs(q));
  }
  /* 220ms, the prototype's own debounce: a filtered list lives in the URL so
     it survives a refresh and can be linked, but not one entry per keystroke. */
  function setSearch(name: string, value: string) {
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => setFilter(name, value), 220);
  }
  function unfilter(k: string) {
    /* The search box is uncontrolled — the same defaultValue input the
       prototype re-created on every render — so clearing its chip has to
       clear the field itself. Keying it off `q` instead would remount it
       on the first keystroke and take the caret with it. */
    if (k === "*" || k === "q") {
      const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
      if (el) el.value = "";
    }
    const q: Record<string, string> = {};
    if (k !== "*") Object.keys(p).forEach((x) => { if (x !== k) q[x] = p[x]; });
    else if (p.tab) q.tab = p.tab;
    go("#/team" + qs(q));
  }
  function route(k: string, v: string) {
    const q: Record<string, string> = { ...p };
    q[k] = String(p[k] || "") === String(v) ? "" : v;
    return "#/team" + qs(q);
  }

  /* -------------------------------------------------------------- rows -- */
  const all: Member[] = IBTeam.members();
  let rows = all.slice();
  if (p.role) rows = rows.filter((u) => IBTeam.roleIdsOf(u).indexOf(p.role) >= 0);
  if (p.status) rows = rows.filter((u) => u.status === p.status);
  if (p.q) {
    const s = p.q.toLowerCase();
    rows = rows.filter((u) =>
      (u.name + " " + u.email + " " + (u.username || "") + " " +
       (u.designation || "") + " " + (u.phone || "")).toLowerCase().indexOf(s) >= 0);
  }
  rows.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));

  const byStatus: Record<string, number> = {};
  all.forEach((u) => { byStatus[u.status] = (byStatus[u.status] || 0) + 1; });
  const noRole = all.filter((u) => !IBTeam.roleIdsOf(u).length).length;
  const waiting = pendingRequests();
  const filtered = !!(p.q || p.role || p.status);

  const cells: (StatCell | "sep")[] = [
    { k: "members", v: all.length, to: route("status", ""), on: !p.status && !p.role },
    "sep",
    { k: "active", v: byStatus.active || 0, dot: "ok",
      to: route("status", "active"), on: p.status === "active",
      title: "Can sign in" },
    { k: "inactive", v: byStatus.inactive || 0,
      to: route("status", "inactive"), on: p.status === "inactive",
      title: "Cannot sign in — the account exists but is switched off" },
    { k: "suspended", v: byStatus.suspended || 0, dot: byStatus.suspended ? "bad" : "",
      tone: byStatus.suspended ? "bad" : "",
      to: route("status", "suspended"), on: p.status === "suspended" },
    "sep",
    /* The one number on this page that is a problem rather than a fact: an
       account that can sign in and then do nothing. */
    { k: "no role", v: noRole, dot: noRole ? "warn" : "", tone: noRole ? "warn" : "",
      title: "Signed-in and granted nothing — a successful login never implies access" },
    "sep",
    { k: "roles", v: IBTeam.allRoles().length, to: "#/roles", title: "Open Roles" },
  ];

  function tabTo(k: string) {
    const q: Record<string, string> = { ...p };
    q.tab = k === "members" ? "" : k;
    return "#/team" + qs(q);
  }

  return (
    <div className="dls">
      {/* Two collections behind one module: the people, and the people asking
          to get back in. Same `?tab=` convention the Platform surfaces use. */}
      <div className="dls-chips">
        <div className="tabs">
          <button className={tab === "members" ? "on" : ""} data-go={tabTo("members")}
                  onClick={() => go(tabTo("members"))}>Members<span className="n">{all.length}</span></button>
          <button className={tab === "requests" ? "on" : ""} data-go={tabTo("requests")}
                  onClick={() => go(tabTo("requests"))}>
            Access requests{waiting ? <span className="n">{waiting}</span> : null}
          </button>
        </div>
      </div>

      {tab === "members" ? (
        <>
          <div className="dls-cmd">
            <SearchField ph="Search name, email, username or designation…" val={p.q}
                         onFilter={setSearch} />
            <Select key={"role:" + p.role} name="role" label="Role"
              options={IBTeam.allRoles().map((r: Record<string, string>) => ({ v: r.role_id, l: r.name }))}
              value={p.role} onFilter={setFilter} />
            <Select key={"status:" + p.status} name="status" label="Status"
              options={["active", "inactive", "suspended", "locked"].map((st) => ({ v: st, l: cap(st) }))}
              value={p.status} onFilter={setFilter} />
            <span className="spacer"></span>
            {can("team", "create") ? (
              <button className="btn pri" data-act="tm-new"
                      onClick={() => modal(<MemberNewModal ops={ops} />, "wide")}>
                <Icon name="plus" />Add member
              </button>
            ) : null}
          </div>

          <StatStrip cells={cells} />

          {filtered ? (
            <div className="dls-chips">
              <FilterChips params={p} labels={{ q: "Search", role: "Role", status: "Status" }}
                           onUnfilter={unfilter} />
            </div>
          ) : null}

          <div className="dls-body">
            {rows.length ? (
              <table className="tbl dls-tbl">
                <thead>
                  <tr>
                    <th style={{ width: "3px" }}></th><th>Member</th><th>Designation</th><th>Role</th>
                    <th>Status</th><th>Last sign-in</th><th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const un = urgency(u);
                    return (
                      <tr key={u.id}
                          className={"clickable" + (un ? " " + un.cls : "") + (u.status === "active" ? "" : " dim")}
                          data-go={"#/team/" + u.id} onClick={() => go("#/team/" + u.id)}>
                        <td className="rail"><i title={un ? un.why : undefined}></i></td>
                        <td>
                          <div className="cell-1" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Avatar u={u} />
                            <span>{u.name}
                              {IBTeam.isSuper(u) ? <> <span className="pill brand xs">Super Admin</span></> : null}
                            </span>
                          </div>
                          <div className="cell-2 mono">{u.username || "—"} · {u.email}</div>
                        </td>
                        <td>{u.designation || "—"}</td>
                        <td><RoleChips u={u} /></td>
                        <td><StatusPill s={u.status} /></td>
                        <td>{whenever(u.lastLogin)}</td>
                        <td><div className="cell-2">{whenever(u.registeredAt)}</div></td>
                      </tr>
                    );
                  })}
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
                            onClick={() => modal(<MemberNewModal ops={ops} />, "wide")}>Add member</button>}
              />
            )}
          </div>
        </>
      ) : (
        <div className="dls-body"><AccessRequests ops={ops} /></div>
      )}
    </div>
  );
}
