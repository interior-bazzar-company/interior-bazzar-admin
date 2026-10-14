/* =====================================================================
   TEAM — members, and the queue of people asking to get back in.
   ---------------------------------------------------------------------
   Rewired onto interior_admin's real user endpoints (v1/admin/users/,
   AdminUserViews) instead of IBData.TeamStore's localStorage store.

     /team        who is on the team, and what they may do
     /team/:id    the member page — identity AND the operational half, tabbed
     /roles       what a responsibility means, as a matrix (its own folder)

   THE PAGE READS TOP TO BOTTOM THE WAY THE QUESTION IS ASKED: what is this
   page and its one primary action (`PageHeader`), which collection
   (`Tabs`), how do I narrow it (`FilterBar`), what is in it (the stat
   strip, every cell its own filter), and then the roster as one queue
   table with the exception rail on the left. A row is a PERSON and it
   opens their page; the admin acts on that person ride behind the row's
   own menu, so the whole row stays a link to the record.

   KNOWN LIMITATION, not a bug here: the list endpoint
   (`getSelfCreatedUsersController`) returns only members the SIGNED-IN
   admin created, not the whole team. There is no "everyone" endpoint yet.
   Of the fields the old local engine had, active/last sign-in/added are now
   real (AdminUserTasks._accountFacts) and render on the row; the avatar,
   the locked/suspended statuses and the failed-attempt count have no
   column behind them and stay off the screen rather than being invented.
   ===================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import {
  Button, EmptyState, FilterBar, FilterChips, ListSkeleton, ListTable, MoreMenu, PageHeader,
  Pagination, Person, Pill, Rail, SearchField, Select, StatStrip, Tabs, TbTitle, fmtDate, qs,
} from "../../ui";
import type { MenuItem, StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { RoleChips } from "../teamShared";
import type { Member, Ops, Role } from "../teamShared";
import { getSession } from "../../auth/session";
import MemberPage from "./MemberPage";
import { isHumanEmployee, loadFailure, useMembers } from "./store";
import type { LoadPart } from "./store";
import { LoadNotice } from "./loadState";
import { opOf } from "./member/ops";
import {
  MemberDeleteModal, MemberEditModal, MemberNewModal, MemberRolesModal, MemberSendCredentialsModal,
} from "./memberModals";
import { MemberReinstateModal, MemberSuspendModal, MemberViewAsModal, isFullAccessMember } from "./member/statusModals";
import AccessRequests, { pendingRequests, usePendingRequests } from "./AccessRequests";
import Orphans from "./Orphans";

const CHIP_LABELS = { q: "Search", role: "Role" };
const PAGE_SIZE = 25;

export default function Team() {
  const { id, sub } = useParams();
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Member[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  /* The role registry was REFUSED, as opposed to being empty. The difference
     decides whether "no roles" is a fact about this company or a fact about
     the reader's own grant. */
  const [rolesDenied, setRolesDenied] = useState(false);
  /* A roster read that failed or was refused (team/d5) — said, never drawn as "No team members". */
  const [failed, setFailed] = useState<LoadPart | null>(null);
  const [page, setPage] = useState(1);

  const p: Record<string, string> = {
    q: sp.get("q") || "", role: sp.get("role") || "",
    tab: sp.get("tab") || "",
  };
  const tab = p.tab === "requests" ? "requests" : p.tab === "orphans" && can("team", "status") ? "orphans" : "members";

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
  const [requests, reloadRequests] = usePendingRequests();

  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.users())
      .then((u) => { if (!cancelled) { setRows(u); setFailed(null); } })
      .catch((e) => { if (!cancelled) { setRows([]); setFailed(loadFailure(e)); } });
    call(AdminOpsService.listRoles())
      .then((r) => { if (!cancelled) { setRoles(r.roles); setRolesDenied(false); } })
      .catch(() => { if (!cancelled) { setRoles([]); setRolesDenied(true); } });
    return () => { cancelled = true; };
  }, [tick]);

  /* A narrower list is a different list: page 4 of it does not exist. */
  useEffect(() => { setPage(1); }, [p.q, p.role, p.tab]);

  /* ------------------------------------------------------------ chrome -- */
  const crumbs = useMemo(() => {
    if (!id) return <TbTitle label="Members" to="#/team" />;
    const u = (rows || []).find((x) => String(x.id) === id);
    const name = u ? u.name : "Member";
    const op = sub ? opOf(sub) : null;
    if (!op) return <TbTitle label={name} to="#/team" />;
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <TbTitle label={name} to={"#/team/" + id} />
        <span aria-hidden="true" className="text-fg-quaternary">/</span>
        <span className="truncate text-sm font-semibold text-brand-secondary" aria-current="page">{op.label}</span>
      </span>
    );
  }, [id, rows, sub]);
  /* Up from an operation is the member, not the roster. */
  usePageChrome({
    crumbs,
    parent: id ? (sub ? "#/team/" + id : "#/team" + qs(p)) : null,
  }, (id || "") + "/" + (sub || "") + p.tab);

  /* ----------------------------------------------------------- filters -- */
  const typing = useRef<number | undefined>(undefined);
  const caret = useRef<number | null>(null);
  function setFilter(name: string, value: string) {
    const q: Record<string, string> = { ...p };
    q[name] = value;
    go("#/team" + (id ? "/" + id : "") + qs(q));
  }
  function setSearch(name: string, value: string) {
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => {
      const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
      caret.current = el ? el.selectionStart : null;
      setFilter(name, value);
    }, 220);
  }
  useEffect(() => {
    const at = caret.current;
    if (at === null) return;
    caret.current = null;
    const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(at, at); } catch { /* type=search may refuse */ }
  });
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
  const mine = getSession()?.user;
  /* No team.view: the roster is refused, but the viewer's own record still opens. */
  if (failed && mine && id === String(mine.id)) {
    const me = { id: Number(mine.id), username: mine.username || "", role: "", isSuperAdmin: !!getSession()?.isFullAccess,
      isVerified: true, name: mine.name || mine.username || "", email: mine.email || "", phone: "", roles: [] };
    return <MemberPage id={id} sub={sub || ""} live={me as unknown as Member} members={[me as unknown as Member]} roles={roles} rolesDenied={rolesDenied} ops={ops} />;
  }
  if (failed) {
    return (
      <LoadNotice what="The team" part={failed} onRetry={() => { setFailed(null); setRows(null); setTick((t) => t + 1); }} />
    );
  }

  if (id) {
    const u = rows.find((x) => String(x.id) === id) || null;
    return <MemberPage id={id} sub={sub || ""} live={u} members={rows} roles={roles} rolesDenied={rolesDenied} ops={ops} />;
  }

  /* -------------------------------------------------------------- rows -- */
  let list = rows.slice();
  if (p.role) {
    const rl = p.role.toLowerCase();
    list = list.filter((u) => u.roles.some((r) => String(r.id) === p.role || r.name.toLowerCase() === rl));
  }
  if (p.q) {
    const s = p.q.toLowerCase();
    list = list.filter((u) =>
      (u.name + " " + u.email + " " + (u.username || "") + " " + (u.phone || "")).toLowerCase().indexOf(s) >= 0);
  }

  const noRole = rows.filter((u) => !u.roles.length).length;
  const noDocs = rows.filter((u) => (u.missingDocuments || []).length).length;
  const waiting = pendingRequests(requests);
  const filtered = !!(p.q || p.role);
  const matchedRoleOpt = roles.find((r) => String(r.id) === p.role || r.name.toLowerCase() === p.role.toLowerCase());
  const roleSelectValue = matchedRoleOpt ? String(matchedRoleOpt.id) : p.role;

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const at = Math.min(page, pages);
  const shown = list.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE);

  const cells: (StatCell | "sep")[] = [
    { k: "members", v: rows.length, to: "#/team" + qs({ tab: p.tab }), on: !filtered },
    "sep",
    { k: "no role", v: noRole, dot: noRole ? "warn" : "neutral", tone: noRole ? "warn" : "",
      title: "Signed-in and granted nothing — a successful login never implies access" },
    "sep",
    { k: "documents short", v: noDocs, dot: noDocs ? "warn" : "neutral", tone: noDocs ? "warn" : "",
      title: "Members missing at least one required document. Nothing blocks on it." },
    "sep",
    { k: "roles", v: rolesDenied ? "—" : roles.length, to: "#/roles",
      title: rolesDenied ? "Reading the role registry needs Roles · View" : "Open Roles" },
  ];

  const addMember = can("team", "create")
    ? (
      <Button color="primary" ico="plus" data-act="tm-new"
        onClick={() => modal(<MemberNewModal roles={roles} members={rows} ops={ops} />, "lg")}>
        Add member
      </Button>
    )
    : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Members"
        meta={<>
          <span>{rows.length} on the roster</span>
          {rolesDenied ? null : <span>{roles.length} role{roles.length === 1 ? "" : "s"}</span>}
          {filtered ? <span>{list.length} shown</span> : null}
        </>}
        actions={tab === "members" ? addMember : null}
        tabs={<Tabs cur={tab} items={[
          { k: "members", label: "Members", n: rows.length, quiet: true, to: tabTo("members") },
          { k: "requests", label: "Access requests", n: waiting, to: tabTo("requests") },
          ...(can("team", "status")
            ? [{ k: "orphans", label: "Orphaned records", quiet: true, to: tabTo("orphans") }]
            : []),
        ]} />}
      />

      {tab === "members" ? (
        <>
          <FilterBar
            search={<SearchField key={"q:" + p.q} ph="Search name, email or username…" val={p.q} onFilter={setSearch} />}
            filters={<>
              <Select key={"role:" + roleSelectValue} name="role" label="Role"
                options={roles.map((r) => ({ v: String(r.id), l: r.name }))}
                value={roleSelectValue} onFilter={setFilter} />
            </>}
            chips={filtered
              ? <FilterChips params={{ ...p, role: matchedRoleOpt ? matchedRoleOpt.name : p.role }} labels={CHIP_LABELS} onUnfilter={unfilter} />
              : null}
          />

          <StatStrip cells={cells} />

          {shown.length ? (
            <>
              <ListTable min="66rem" head={<tr>
                <th className="rail" />
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Reports To</th>
                <th scope="col">Documents</th>
                <th scope="col">Account</th>
                <th scope="col">Last sign-in</th>
                <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
              </tr>}>
                {shown.map((u) => {
                  const to = "#/team/" + u.id;
                  return (
                    <tr key={u.id} className="clickable" data-go={to} onClick={() => go(to)}>
                      <Rail tone={u.roles.length ? undefined : "warn"}
                        title={u.roles.length ? undefined : "Active with no role — can sign in, can do nothing"} />
                      <td className="cell-1">
                        <Person name={u.name} sub={[u.username, u.email].filter(Boolean).join(" · ")} to={to} />
                      </td>
                      <td>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {u.isSuperAdmin
                            ? <Pill xs tone="brand" text="Full access" title="Superuser — every module, by definition" />
                            : null}
                          <RoleChips u={u} />
                        </span>
                      </td>
                      <td><ReportsTo u={u} /></td>
                      <td><DocsCell u={u} /></td>
                      <td>
                        {u.isActive === false
                          ? <Pill xs dot tone="bad" text="Inactive" />
                          : <Pill xs dot tone="ok" text="Active" />}
                      </td>
                      <td className="font-mono text-xs whitespace-nowrap tnum">
                        {u.lastLogin
                          ? fmtDate(u.lastLogin)
                          : <span className="text-quaternary">never</span>}
                      </td>
                      <td className="acts" onClick={(e) => e.stopPropagation()}>
                        <RowMenu u={u} roles={roles} members={rows} ops={ops} />
                      </td>
                    </tr>
                  );
                })}
              </ListTable>

              <Pagination page={at} pages={pages} total={list.length} unit="members"
                pageSize={PAGE_SIZE} shown={shown.length} alwaysCount onPage={setPage} />
            </>
          ) : (
            <EmptyState
              icon="team"
              title={filtered ? "No members match these filters" : "No team members"}
              body={filtered
                ? "Nothing matches. Clear a filter to widen the search."
                : "Members are created here by an admin — there is no public signup."}
              action={filtered
                ? <Button color="secondary" ico="x" data-unfilter="*" onClick={() => unfilter("*")}>Clear all filters</Button>
                : addMember}
            />
          )}
        </>
      ) : tab === "orphans" ? (
        <Orphans members={rows} onChanged={ops.refresh} />
      ) : (
        <AccessRequests q={requests} reload={reloadRequests} roles={roles} ops={ops} />
      )}
    </div>
  );
}

/* ===================================================== the row's actions === */

function RowMenu({ u, roles, members, ops }: { u: Member; roles: Role[]; members: Member[]; ops: Ops }) {
  const mine = getSession()?.user;
  const isSelf = mine != null && String(mine.id) === String(u.id);
  const items: MenuItem[] = [
    { icon: "user", label: "Open member", act: () => ops.go("#/team/" + u.id) },
  ];
  if (can("team", "edit"))
    items.push({ icon: "edit", label: "Edit member", act: () => ops.modal(<MemberEditModal u={u} roles={roles} members={members} ops={ops} />) });
  if (can("team", "roles"))
    items.push({ icon: "shield", label: "Roles", act: () => ops.modal(<MemberRolesModal u={u} roles={roles} ops={ops} />) });
  if (can("team", "edit"))
    items.push({ icon: "lock", label: "Send new password", act: () => ops.modal(<MemberSendCredentialsModal u={u} ops={ops} />) });
  if (!!getSession()?.isFullAccess && !isSelf && !isFullAccessMember(u, roles))
    items.push({ icon: "eye", label: "See as this member", act: () => ops.modal(<MemberViewAsModal u={u} ops={ops} />) });
  if (can("team", "status") && !isSelf) {
    if (u.isActive === false)
      items.push({ icon: "lock", label: "Reinstate member", act: () => ops.modal(<MemberReinstateModal u={u} ops={ops} />) });
    else
      items.push({ icon: "lock", label: "Suspend member", tone: "bad", act: () => ops.modal(<MemberSuspendModal u={u} members={members} ops={ops} />) });
  }
  if (can("team", "status"))
    items.push({ icon: "trash", label: "Delete member", tone: "bad", act: () => ops.modal(<MemberDeleteModal u={u} ops={ops} />) });
  return <MoreMenu small align="right" items={items} />;
}

/* ================================================== two derived columns === */

function ReportsTo({ u }: { u: Member }) {
  if (u.reportsTo?.name) {
    return <span className="font-medium text-primary">{u.reportsTo.name}</span>;
  }
  return <span className="text-quaternary">—</span>;
}

/** MISSING DOCUMENTS, ON THE ROW. This is the whole enforcement: it shows here,
 *  on the member's own page and in the roster filter, and nothing anywhere
 *  blocks on it. Naming which ones are short is what makes the column
 *  actionable — "2 missing" sends somebody hunting. */
function DocsCell({ u }: { u: Member }) {
  if (!isHumanEmployee(u)) return <span className="text-quaternary" title="Not applicable">—</span>;
  const missing = u.missingDocuments;
  if (!missing) return <span className="text-quaternary">—</span>;
  if (!missing.length) return <Pill xs tone="ok" text="Complete" />;
  /* NAMED, BUT NOT ALL OF THEM. "2 missing" sends somebody hunting; four
     document names down a table row is three lines of noise on every row. Two
     names and a count is the trade, and the full list is on the title. */
  const names = missing.map((d) => d.label);
  return (
    <>
      <Pill xs tone="warn" text={missing.length + " missing"} />
      <span className="block cell-2" title={names.join(", ")}>
        {names.slice(0, 2).join(", ")}{names.length > 2 ? " +" + (names.length - 2) : ""}
      </span>
    </>
  );
}

/** Distinct, order preserved. */
function uniq(list: string[]): string[] {
  const out: string[] = [];
  list.forEach((x) => { if (out.indexOf(x) < 0) out.push(x); });
  return out.sort();
}
