/* =============================================================================
   The user directory.
   -----------------------------------------------------------------------------
   ONE question: who is registered. Identity, profile completeness, where they
   came from and whether the account is live — and nothing about what anybody
   has bought. A Members scope used to sit beside this one, reading a
   membership the module no longer holds; who is paying is now a question for
   the subscription that holds the money, and Finance asks it there.

   The column that carries the point of the screen is PROFILE. It is the one
   fact here somebody can act on: an incomplete profile is a call to make, and
   it is the default sort for exactly that reason.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { EmptyState, FilterChips, Icon, SearchField, Select, StatStrip } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { ClassPill, Completeness, WhoCell } from "./bits";
import {
  CITIES, CLASSIFICATIONS, FILTER_LABELS, REGISTERED_RANGES,
  REGISTRATION_SOURCES, SORT_OPTIONS, TAGS, ago, applyFilters, applySort,
  bandCounts, countsOf, filterValueLabel, fmtDate, paginate,
} from "./store";
import type { UserRow } from "./store";


export default function List({ rows, p, onView, onFilter, onSearch, onUnfilter, onPage }: FaceProps) {
  const { toast } = useShell();

  const filtered = applyFilters(rows, p);
  const page = paginate(applySort(filtered, p.sort), Number(p.page) || 1);
  const c = countsOf(rows);
  const narrowed = Object.keys(p).some((k) => p[k] && ["view", "sort", "page"].indexOf(k) < 0);

  const off = (k: string, v: string) => (p[k] === v ? undefined : v);
  /* The strip leads with the figure the rest of it divides up, the way Deals
     and Business Enquiries do. Without it the cells are a set of parts with no
     stated whole, and nobody can tell whether they are meant to add up. It
     clears the breakdown filters rather than every filter: a search or a city
     is the scope you chose, and a cell called Total should not silently throw
     that away. */
  const cells: (StatCell | "sep")[] = [
    { k: "Total", v: c.total,
      on: !p.flag && !p.status,
      to: hash(p, { flag: undefined, status: undefined }),
      tip: <>Every registered identity in scope. The cells beside it are its parts.</> },
    "sep",
    { k: "Active", v: c.active, dot: "ok", on: p.status === "active",
      to: hash(p, { status: off("status", "active") }),
      tip: <>The account works. It says nothing about whether they are paying — that is a Finance question, asked of the subscription that holds the money.</> },
    { k: "Deactivated", v: c.deactivated, on: p.status === "deactivated",
      to: hash(p, { status: off("status", "deactivated") }),
      tip: <>Administratively disabled. Their profile, commercial links and audit trail are all still here.</> },
    "sep",
    { k: "Incomplete", v: c.incompleteProfiles, dot: "warn", on: p.flag === "incomplete",
      to: hash(p, { flag: off("flag", "incomplete") }),
      tip: <>Missing at least one field the current profile schema requires. Graded against profile v1.</> },
  ];

  return (
    <Frame view="users" onView={onView} toast={toast}
      counts={bandCounts(rows)}
      cmd={<>
        {/* KEYED ON THEIR VALUE. SearchField and Select are uncontrolled, so
            clearing a chip left the old text in the box and the old choice in
            the dropdown — the pattern Audit and Invoices already use. */}
        <SearchField key={"q" + (p.q || "")} ph="Name, email, phone, user ID, business or reference…"
          val={p.q} onFilter={onSearch} />
        <Select key={"status" + (p.status || "")} name="status" label="Account" value={p.status} onFilter={onFilter}
          options={CLASSIFICATIONS.map((x) => ({ v: x.key, l: x.label }))} />
        <Select key={"city" + (p.city || "")} name="city" label="City" value={p.city} onFilter={onFilter}
          options={CITIES.map((x) => ({ v: x.key, l: x.label }))} />
        <Select key={"src" + (p.src || "")} name="src" label="Via" value={p.src} onFilter={onFilter}
          options={REGISTRATION_SOURCES.map((x) => ({ v: x.key, l: x.label }))} />
        <Select key={"tag" + (p.tag || "")} name="tag" label="Tag" value={p.tag} onFilter={onFilter}
          options={TAGS.map((x) => ({ v: x.slug, l: x.label }))} />
        <Select key={"reg" + (p.registered || "")} name="registered" label="Registered" value={p.registered} onFilter={onFilter}
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
        {/* Sort is not a filter and does not share the grid with the others. */}
        <Select key={"sort" + (p.sort || "")} name="sort" label={"Sort: " + (SORT_OPTIONS[0]?.label || "")} value={p.sort}
          onFilter={onFilter} options={SORT_OPTIONS.slice(1).map((o) => ({ v: o.key, l: o.label }))} />
      </>}
      bands={<>
        <StatStrip cells={cells} />
        {/* `.dls-chips` is the band wrapper, not decoration: it supplies the
            page gutter and cancels the chiprow's own negative margin, so the
            chips line up with the command row above and the table below. */}
        <div className="dls-chips">
          {/* `view`, `sort` and `page` sit in the URL like filters and are not
              filters. A chip reading "view: analytics" invites somebody to
              clear the screen they are on. */}
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
              <th>Account</th>
              <th>Profile</th>
              <th>Registered</th>
              <th>Last seen</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((r) => <Row key={r.user.userId} r={r} p={p} />)}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={narrowed ? "search" : "inbox"}
          title={narrowed ? "Nothing matches those filters" : "No registered users yet"}
          body={narrowed
            ? "The counts in the strip above are for the whole view before any filter."
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

function Row({ r, p }: { r: UserRow; p: Record<string, string | undefined> }) {
  const u = r.user;
  /* The rail is the only place a row raises its voice, and there is exactly
     one thing left in this module worth raising it for: a live account whose
     profile is not finished, which is the one gap somebody here can close.
     A colour per state would turn the table into a paint chart nobody scans. */
  const rail = r.classification === "active" && r.completeness < 100 ? "warn" : "";
  /* THE WHOLE LIST STATE TRAVELS WITH THE LINK — every filter, the sort and the
     page — so the record's Back button is a return and not a reset. */
  const carried = Object.keys(p)
    .filter((k) => p[k] && k !== "tab")
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
    .join("&");
  const to = "#/users/" + encodeURIComponent(u.userId) + (carried ? "?" + carried : "");
  return (
    <tr className={"clickable" + (u.userStatus === "deactivated" ? " dim" : "")}
      tabIndex={0} role="link" aria-label={"Open " + u.identity.name}
      onClick={() => go(to)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
      <td className="rail"><i className={rail} /></td>
      <td><WhoCell r={r} /></td>
      <td><ClassPill k={r.classification} /></td>
      <td><Completeness pct={r.completeness} missing={r.missingFields} bare /></td>
      <td>
        <div className="cell-1">{fmtDate(u.registeredAt)}</div>
        <div className="cell-2">{ago(u.registeredAt)}</div>
      </td>
      <td className="cell-2">{ago(u.lastActivityAt)}</td>
      <td className="tight"><Icon name="chevr" size="sm" /></td>
    </tr>
  );
}
