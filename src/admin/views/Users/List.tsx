/* =============================================================================
   Users    and    Members
   -----------------------------------------------------------------------------
   ONE component, two scopes. They ask different questions of the same
   population — "who is registered at all" and "who is or was a paying member" —
   and they read the SAME derived classification to answer them. Built as two
   components they would have grown two definitions of member within a month.

   The scope is not a filter and produces no chip: clearing the filters on
   Members leaves you on Members, showing all of them.

   Two columns carry the point of the module. CLASSIFICATION is derived;
   MEMBERSHIP is the raw status underneath it. Side by side, so the difference
   between a Paused Member and a plain User is visible rather than asserted.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, FilterChips, Icon, SearchField, Select, StatStrip } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { ClassPill, Completeness, TermCell, WhoCell } from "./bits";
import AssignMembership from "./AssignMembership";
import {
  CITIES, CLASSIFICATIONS, FILTER_LABELS, MEMBERSHIP_STATUSES, REGISTERED_RANGES,
  MEMBER_CLASSES, REGISTRATION_SOURCES, SORT_OPTIONS, TAGS, ago, applyFilters, applySort,
  bandCounts, countsOf,
  filterValueLabel, fmtDate, paginate, usePlansInUse,
} from "./store";
import type { UserRow } from "./store";


export default function List({ rows, p, onView, onFilter, onSearch, onUnfilter, onPage, scope }:
  FaceProps & { scope: "users" | "members" }) {
  const { toast, modal, closeLayer } = useShell();
  const members = scope === "members";
  /* The plans people actually hold, not a catalogue this module does not own.
     A filter that offers a plan nobody has is a filter with a guaranteed empty
     result in it. */
  const plans = usePlansInUse();

  /* The scope narrows the POPULATION before any filter runs, so every count in
     the strip is a count of what this screen is about. */
  const population = members
    ? rows.filter((r) => MEMBER_CLASSES.indexOf(r.classification) >= 0)
    : rows;

  const filtered = applyFilters(population, p);
  const page = paginate(applySort(filtered, p.sort), Number(p.page) || 1);
  const c = countsOf(population);
  const narrowed = Object.keys(p).some((k) => p[k] && ["view", "sort", "page"].indexOf(k) < 0);

  const off = (k: string, v: string) => (p[k] === v ? undefined : v);
  /* The strip leads with the figure the rest of it divides up, the way Deals
     and Business Enquiries do. Without it the cells are a set of parts with no
     stated whole, and nobody can tell whether they are meant to add up. It
     clears the breakdown filters rather than every filter: a search or a city
     is the scope you chose, and a cell called Total should not silently throw
     that away. */
  const totalCell: StatCell = {
    k: "Total", v: c.total,
    on: !p.cls && !p.flag && !p.status,
    to: hash(p, { cls: undefined, flag: undefined, status: undefined }),
    tip: members
      ? <>Everyone who holds a term or ever held one. The breakdown beside it splits this number and nothing overlaps.</>
      : <>Every registered user in scope, members and non-members alike. The cells beside it are its parts.</>,
  };
  const cells: (StatCell | "sep")[] = members
    ? [
        totalCell,
        "sep",
        { k: "Active", v: c.activeMembers, dot: "ok", on: p.cls === "active_member",
          to: hash(p, { cls: off("cls", "active_member") }),
          tip: <>Entitled right now: an Active term inside its own dates. Paused and suspended members are customers too and are counted beside this, never inside it.</> },
        { k: "Paused", v: c.paused, dot: "warn", on: p.cls === "paused_member",
          to: hash(p, { cls: off("cls", "paused_member") }),
          tip: <>Temporary and resumable. The term survives and this is not churn.</> },
        { k: "Suspended", v: c.suspended, dot: "bad", on: p.cls === "suspended_member",
          to: hash(p, { cls: off("cls", "suspended_member") }),
          tip: <>Entitlements administratively withheld. The account itself still works.</> },
        "sep",
        { k: "Past Members", v: c.formerMembers, on: p.cls === "former_member",
          to: hash(p, { cls: off("cls", "former_member") }),
          tip: <>Held a term once, holds none now. The win-back pool — a reading of history rather than a state anybody set.</> },
        { k: "Expiring soon", v: c.expiringSoon, dot: "warn", on: p.flag === "expiring",
          to: hash(p, { flag: off("flag", "expiring") }),
          tip: <>Active terms inside the renewal window. The window is an assumption — UM-OD-11.</> },
      ]
    : [
        totalCell,
        "sep",
        { k: "Users", v: c.normal, on: p.cls === "normal",
          to: hash(p, { cls: off("cls", "normal") }),
          tip: <>Registered, with no term that has ever entitled them. A user whose only term is Pending Activation is here, not in Past Members — nothing has been granted yet.</> },
        { k: "Active members", v: c.activeMembers, dot: "ok", on: p.cls === "active_member",
          to: hash(p, { cls: off("cls", "active_member") }),
          tip: <>Derived from membership state at read time. There is no stored flag behind this number.</> },
        { k: "Paused", v: c.paused, dot: "warn", on: p.cls === "paused_member",
          to: hash(p, { cls: off("cls", "paused_member") }) },
        { k: "Suspended", v: c.suspended, dot: "bad", on: p.cls === "suspended_member",
          to: hash(p, { cls: off("cls", "suspended_member") }) },
        { k: "Past Members", v: c.formerMembers, on: p.cls === "former_member",
          to: hash(p, { cls: off("cls", "former_member") }) },
        "sep",
        { k: "Pending", v: c.pending, dot: "warn", on: p.flag === "pending",
          to: hash(p, { flag: off("flag", "pending") }),
          tip: <>A term exists and grants nothing. No entitlement snapshot is taken until somebody activates it.</> },
        { k: "Incomplete", v: c.incompleteProfiles, dot: "warn", on: p.flag === "incomplete",
          to: hash(p, { flag: off("flag", "incomplete") }),
          tip: <>Missing at least one field the current profile schema requires. Graded against profile v1.</> },
        { k: "Deactivated", v: c.deactivated, on: p.status === "deactivated",
          to: hash(p, { status: off("status", "deactivated") }),
          tip: <>An account status, not a membership classification. Their profile, terms and audit trail are all still here.</> },
      ];

  const onAssign = (r: UserRow) => modal(
    <AssignMembership row={r} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide");

  return (
    <Frame view={scope} onView={onView} toast={toast}
      counts={bandCounts(rows)}
      cmd={<>
        <SearchField ph="Name, email, phone, user ID, business or reference…"
          val={p.q} onFilter={onSearch} />
        <Select name="cls" label="Classification" value={p.cls} onFilter={onFilter}
          options={CLASSIFICATIONS
            .filter((x) => !members || MEMBER_CLASSES.indexOf(x.key) >= 0)
            .map((x) => ({ v: x.key, l: x.label }))} />
        <Select name="ms" label="Membership" value={p.ms} onFilter={onFilter}
          options={MEMBERSHIP_STATUSES.map((x) => ({ v: x.key, l: x.label }))} />
        <Select name="plan" label="Plan" value={p.plan} onFilter={onFilter}
          options={plans.map((x) => ({ v: x.code, l: x.name }))} />
        <Select name="city" label="City" value={p.city} onFilter={onFilter}
          options={CITIES.map((x) => ({ v: x, l: x }))} />
        <Select name="src" label="Via" value={p.src} onFilter={onFilter}
          options={REGISTRATION_SOURCES.map((x) => ({ v: x.key, l: x.label }))} />
        <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter}
          options={TAGS.map((x) => ({ v: x.slug, l: x.label }))} />
        <Select name="registered" label="Registered" value={p.registered} onFilter={onFilter}
          options={REGISTERED_RANGES.map((x) => ({ v: x.key, l: x.label }))} />
        {p.registered === "custom" ? (
          <>
            <input type="date" className="um-date" value={p.from || ""} aria-label="Registered from"
              onChange={(e) => onFilter("from", e.target.value)} />
            <input type="date" className="um-date" value={p.to || ""} aria-label="Registered up to"
              onChange={(e) => onFilter("to", e.target.value)} />
          </>
        ) : null}
        <span className="spacer" />
        {/* Sort is not a filter and does not share the grid with ten of them. */}
        <Select name="sort" label={"Sort: " + (SORT_OPTIONS[0]?.label || "")} value={p.sort}
          onFilter={onFilter} options={SORT_OPTIONS.slice(1).map((o) => ({ v: o.key, l: o.label }))} />
      </>}
      bands={<>
        <StatStrip cells={cells} />
        {/* `.dls-chips` is the band wrapper, not decoration: it supplies the
            page gutter and cancels the chiprow's own negative margin, so the
            chips line up with the command row above and the table below. */}
        <div className="dls-chips">
          {/* `view`, `sort` and `page` sit in the URL like filters and are not
              filters. A chip reading "view: members" invites somebody to clear
              the screen they are on. */}
          <FilterChips
            params={Object.keys(p)
              .filter((k) => ["view", "sort", "page", "from", "to"].indexOf(k) < 0 && p[k])
              .reduce((o, k) => { o[k] = filterValueLabel(k, p[k] as string); return o; },
                {} as Record<string, string>)}
            labels={FILTER_LABELS}
            onUnfilter={(k) => onUnfilter(k === "registered" ? "registered+from+to" : k)} />
        </div>
      </>}>

      {page.rows.length ? (
        <table className="tbl dls-tbl um-tbl">
          <thead>
            <tr>
              <th className="rail" />
              <th>User</th>
              <th>Classification</th>
              <th>Current term</th>
              <th>Profile</th>
              <th>Registered</th>
              <th>Last seen</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((r) => <Row key={r.user.userId} r={r} p={p} onAssign={onAssign} />)}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={narrowed ? "search" : "inbox"}
          title={narrowed
            ? "Nothing matches those filters"
            : members ? "Nobody has bought a membership yet" : "No registered users yet"}
          body={narrowed
            ? "The counts in the strip above are for this whole view, so one of them has somebody in it."
            : members
              ? "Members appear the moment a term activates. Until then everyone is a User in the directory."
              : "Users arrive from the website, the portal, campaign funnels and referrals. The registration event creates the record; nobody creates one here."}
          action={narrowed
            ? <button className="btn" onClick={() => onUnfilter("*")}>Clear all filters</button>
            : null} />
      )}

      {page.pages > 1 ? (
        <div className="um-pager">
          <button className="btn sm" disabled={page.pageNo <= 1} onClick={() => onPage(page.pageNo - 1)}>
            <Icon name="chevl" size="sm" />Previous
          </button>
          <span className="tnum">
            {(page.pageNo - 1) * page.pageSize + 1}–{(page.pageNo - 1) * page.pageSize + page.rows.length}
            {" of "}{page.total}
          </span>
          <button className="btn sm" disabled={page.pageNo >= page.pages} onClick={() => onPage(page.pageNo + 1)}>
            Next<Icon name="chevr" size="sm" />
          </button>
        </div>
      ) : null}
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */

function hash(p: Record<string, string | undefined>, extra: Record<string, string | undefined>) {
  const o: Record<string, string> = {};
  Object.keys(p).forEach((k) => { if (p[k] && k !== "page") o[k] = p[k] as string; });
  Object.keys(extra).forEach((k) => {
    if (extra[k]) o[k] = extra[k] as string; else delete o[k];
  });
  const q = Object.keys(o).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(o[k])).join("&");
  return "#/users" + (q ? "?" + q : "");
}

function Row({ r, p, onAssign }: {
  r: UserRow; p: Record<string, string | undefined>; onAssign: (r: UserRow) => void;
}) {
  const u = r.user;
  /* The rail is the only place a row raises its voice, and it has three states
     rather than one per status: something is waiting on a person, something is
     restricted, or nothing. A colour per status turns the table into a paint
     chart nobody can scan. */
  const rail = r.current?.status === "pending" ? "warn"
    : r.current?.status === "suspended" ? "bad"
    : r.expiringSoon ? "warn" : "";
  /* THE WHOLE LIST STATE TRAVELS WITH THE LINK — every filter, the sort and the
     page — so the record's Back button is a return and not a reset. */
  const carried = Object.keys(p)
    .filter((k) => p[k] && ["tab", "term"].indexOf(k) < 0)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
    .join("&");
  const to = "#/users/" + encodeURIComponent(u.userId) + (carried ? "?" + carried : "");
  return (
    <tr className={"clickable" + (u.userStatus === "deactivated" ? " dim" : "")}
      onClick={() => go(to)}>
      <td className="rail"><i className={rail} /></td>
      <td><WhoCell r={r} /></td>
      <td><ClassPill k={r.classification} /></td>
      <td><TermCell r={r} /></td>
      <td><Completeness pct={r.completeness} missing={r.missingFields} bare /></td>
      <td>
        <div className="cell-1">{fmtDate(u.registeredAt)}</div>
        <div className="cell-2">{ago(u.registeredAt)}</div>
      </td>
      <td className="cell-2">{ago(u.lastActivityAt)}</td>
      <td className="tight" onClick={(e) => e.stopPropagation()}>
        {/* NOT `.rowact`. That class fades a row action in on hover, which is
            right for a secondary verb on a busy table and wrong for the one
            action this module exists to make easy — a conversion CTA nobody can
            see until they hover is one nobody finds, and it is unreachable on
            touch entirely. */}
        {r.classification === "normal" && u.userStatus === "active" && can("users", "create")
          ? <button className="btn sm pri" onClick={() => onAssign(r)}>Assign</button>
          : <Icon name="chevr" size="sm" />}
      </td>
    </tr>
  );
}
