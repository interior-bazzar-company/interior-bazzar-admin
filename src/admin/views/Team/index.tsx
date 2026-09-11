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
import AdminOpsService from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import {
  Button, EmptyState, FilterBar, FilterChips, ListSkeleton, ListTable, MoreMenu, PageHeader,
  Pagination, Person, Pill, Rail, SearchField, Select, StatStrip, Tabs, TbTitle, fmtDate, qs,
} from "../../ui";
import type { MenuItem, StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { RoleChips } from "../teamShared";
import type { Member, Ops, Role } from "../teamShared";
import MemberPage from "./MemberPage";
import { adoptPeople } from "./adopt";
import { DOCUMENT_KIND, labelOf, missingDocs, readMember, readMembers, useMembers, useDocuments } from "./store";
import { opOf } from "./member/ops";
import {
  MemberDeleteModal, MemberEditModal, MemberNewModal, MemberRolesModal, MemberSendCredentialsModal,
} from "./memberModals";
import AccessRequests, { pendingRequests } from "./AccessRequests";

const CHIP_LABELS = { q: "Search", role: "Role", dept: "Department" };
const PAGE_SIZE = 25;

export default function Team() {
  const { id, sub } = useParams();
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Member[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(1);

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
  useDocuments();

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

  /* A narrower list is a different list: page 4 of it does not exist. */
  useEffect(() => { setPage(1); }, [p.q, p.role, p.dept, p.tab]);

  /* ------------------------------------------------------------ chrome -- */
  const crumbs = useMemo(() => {
    /* "Members", matching the sidebar row that opens this — see LABEL_OVERRIDE
       in shell/modules.ts. The crumb is written out here rather than read from
       the module item because this page also renders the member and operation
       crumbs below, and one source for all three is what keeps them a chain. */
    if (!id) return <TbTitle label="Members" to="#/team" />;
    const u = (rows || []).find((x) => String(x.id) === id);
    const name = u ? u.name : readMember(id)?.name || "Member";
    /* ON AN OPERATION PAGE THE CRUMB SAYS BOTH. The name is the way back to the
       person; the operation is where you are. A topbar that named only the
       person on `/team/58/leave` would leave the deepest page in the module
       looking identical to the one above it. */
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
  /* Typing is debounced, and the caret is handed back afterwards — the input is
     remounted by the new `q` in the URL, so the focus has to be re-asked for. */
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

  /* A ROW IS A PERSON AND IT OPENS THEIR PAGE. The drawer is gone: identity,
     access, attendance, work, reports, documents and pay are one screen with
     its own launcher, and the admin actions moved into its header. */
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

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const at = Math.min(page, pages);
  const shown = list.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE);

  const cells: (StatCell | "sep")[] = [
    { k: "members", v: rows.length, to: "#/team" + qs({ tab: p.tab }), on: !filtered },
    "sep",
    { k: "no role", v: noRole, dot: noRole ? "warn" : "neutral", tone: noRole ? "warn" : "",
      title: "Signed-in and granted nothing — a successful login never implies access" },
    "sep",
    /* A COUNT, NEVER A GATE. Nothing in the panel blocks on a missing document —
       a hard gate would stop somebody working on their first day over a scan. */
    { k: "documents short", v: noDocs, dot: noDocs ? "warn" : "neutral", tone: noDocs ? "warn" : "",
      title: "Members missing at least one required document. Nothing blocks on it." },
    "sep",
    { k: "roles", v: roles.length, to: "#/roles", title: "Open Roles" },
  ];

  const addMember = can("team", "create")
    ? (
      <Button color="primary" ico="plus" data-act="tm-new"
        onClick={() => modal(<MemberNewModal roles={roles} ops={ops} />, "lg")}>
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
          <span>{roles.length} role{roles.length === 1 ? "" : "s"}</span>
          {filtered ? <span>{list.length} shown</span> : null}
        </>}
        actions={tab === "members" ? addMember : null}
        /* Two collections behind one module: the people, and the people asking
           to get back in. Same `?tab=` convention the Platform surfaces use. */
        tabs={<Tabs cur={tab} items={[
          { k: "members", label: "Members", n: rows.length, quiet: true, to: tabTo("members") },
          { k: "requests", label: "Access requests", n: waiting, to: tabTo("requests") },
        ]} />}
      />

      {tab === "members" ? (
        <>
          <FilterBar
            search={<SearchField key={"q:" + p.q} ph="Search name, email or username…" val={p.q} onFilter={setSearch} />}
            filters={<>
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
            </>}
            chips={filtered
              ? <FilterChips params={p} labels={CHIP_LABELS} onUnfilter={unfilter} />
              : null}
          />

          <StatStrip cells={cells} />

          {shown.length ? (
            <>
              <ListTable min="66rem" head={<tr>
                <th className="rail" />
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Department</th>
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
                        <Person name={u.name} sub={(u.username || "—") + " · " + u.email} to={to} />
                      </td>
                      <td>
                        {/* Superuser is not a role, so it is not a role chip —
                            but it is the loudest thing about an account and it
                            belongs in the column a reader scans for access. */}
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {u.isSuperAdmin
                            ? <Pill xs tone="brand" text="Full access" title="Superuser — every module, by definition" />
                            : null}
                          <RoleChips u={u} />
                        </span>
                      </td>
                      <td><ReportsTo id={String(u.id)} /></td>
                      <td><DocsCell id={String(u.id)} /></td>
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
                        <RowMenu u={u} roles={roles} ops={ops} />
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
      ) : (
        <AccessRequests />
      )}
    </div>
  );
}

/* ===================================================== the row's actions === */

/* Locked actions are ABSENT, not greyed — a disabled row action invites a
   click and a support ticket. Delete goes last and apart: `MoreMenu` pulls a
   `bad` item under its own separator. */
function RowMenu({ u, roles, ops }: { u: Member; roles: Role[]; ops: Ops }) {
  const items: MenuItem[] = [
    { icon: "user", label: "Open member", act: () => ops.go("#/team/" + u.id) },
  ];
  if (can("team", "edit"))
    items.push({ icon: "edit", label: "Edit member", act: () => ops.modal(<MemberEditModal u={u} ops={ops} />) });
  if (can("team", "roles"))
    items.push({ icon: "shield", label: "Roles", act: () => ops.modal(<MemberRolesModal u={u} roles={roles} ops={ops} />) });
  if (can("team", "edit"))
    items.push({ icon: "lock", label: "Send new password", act: () => ops.modal(<MemberSendCredentialsModal u={u} ops={ops} />) });
  if (can("team", "status"))
    items.push({ icon: "trash", label: "Delete member", tone: "bad", act: () => ops.modal(<MemberDeleteModal u={u} ops={ops} />) });
  return <MoreMenu small align="right" items={items} />;
}

/* ================================================== two derived columns === */

/** WHO REVIEWS THIS PERSON, one level and never transitive. It is the same
 *  `reportsTo` the leave inbox routes on and the member page derives `senior`
 *  from — a second hierarchy for the word "captain" would give the module two
 *  answers to the same question and they would drift within a month. */
function ReportsTo({ id }: { id: string }) {
  const m = readMember(id);
  if (!m) return <span className="text-quaternary">—</span>;
  return (
    <>
      <span className="font-medium text-primary">{m.department || m.designation}</span>
      <span className="block cell-2">
        {m.reportsTo ? "reports to " + (readMember(m.reportsTo)?.name || "—") : "reports to nobody"}
      </span>
    </>
  );
}

/** MISSING DOCUMENTS, ON THE ROW. This is the whole enforcement: it shows here,
 *  on the member's own page and in the roster filter, and nothing anywhere
 *  blocks on it. Naming which ones are short is what makes the column
 *  actionable — "2 missing" sends somebody hunting. */
function DocsCell({ id }: { id: string }) {
  const m = readMember(id);
  if (!m) return <span className="text-quaternary">—</span>;
  const missing = missingDocs(id);
  if (!missing.length) return <Pill xs tone="ok" text="Complete" />;
  /* NAMED, BUT NOT ALL OF THEM. "2 missing" sends somebody hunting; four
     document names down a table row is three lines of noise on every row. Two
     names and a count is the trade, and the full list is on the title. */
  const names = missing.map((k) => labelOf(DOCUMENT_KIND, k));
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
