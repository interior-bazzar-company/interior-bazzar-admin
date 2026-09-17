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
import {
  Button, DateRange, EmptyState, FilterChips, ListSkeleton, ListTable, MoreMenu, Notice, Pagination,
  Rail, SearchField, Select, Skeleton, StatStrip, copyToClipboard,
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { ClassPill, Completeness, WhoCell } from "./bits";
import {
  CITIES, CLASSIFICATIONS, FILTER_LABELS, REGISTERED_RANGES,
  REGISTRATION_SOURCES, SORT_OPTIONS, TAGS, ago, applyFilters, applySort,
  bandCounts, countsOf, filterValueLabel, fmtDate, primaryCityOf,
  profileUrl, useUserTotals, useUsersPageState, useUsersVocab,
} from "./store";
import type { Params, UserRow } from "./store";

export default function List({ rows, p, onView, onFilter, onSearch, onUnfilter, onPage, onParams }: FaceProps) {
  const { toast } = useShell();
  const totals = useUserTotals();
  /* The filter bar's own options come from the server. Until the read lands the
     dropdowns are empty, and if it fails the bar says so rather than offering a
     stale set that would filter on values nobody holds. */
  const vocab = useUsersVocab();

  /* THE SERVER FILTERS, SORTS AND PAGES (GET platform-users). `rows` is already
     the page it sent. If that read FAILED, the rows still held are filtered and
     sorted here instead, so the list narrows the way the bar says rather than
     sitting on a page that ignores it -- and the notice below says why. */
  const listing = useUsersPageState();
  const pageRows = listing.error ? applySort(applyFilters(rows, p), p.sort) : rows;
  const page = listing.error
    ? { rows: pageRows, total: pageRows.length, pageNo: 1, pageSize: Math.max(1, pageRows.length), pages: 1 }
    : { rows: pageRows, total: listing.total, pageNo: listing.pageNo, pageSize: listing.pageSize, pages: listing.pages };
  /* THE WHOLE STRIP IS THE SERVER'S NOW (v2/total-users). `countsOf` still
     runs -- the table, the record and the analytics tiles read it -- but not a
     figure on this strip comes from it any more. Deactivated is total minus
     active rather than a fourth count: the server already states both, and a
     third number that could disagree with their difference would be a bug
     waiting to happen. */
  const c = {
    ...countsOf(rows),
    total: totals.data?.totalUsers ?? 0,
    active: totals.data?.activeUsers ?? 0,
    deactivated: (totals.data?.totalUsers ?? 0) - (totals.data?.activeUsers ?? 0),
    incompleteProfiles: totals.data?.incompleteProfiles ?? 0,
  };
  /** The day the server counted, not the seed's clock. */
  const AS_OF = totals.data ? fmtDate(totals.data.asOf + "T00:00:00") : "";
  /* A figure that has not arrived is a skeleton, and one that failed is a dash
     — never a 0 that reads as a real count. */
  const live = (n: number) => (totals.data ? n : totals.error ? "—" : <Skeleton className="h-5" w={28} />);
  const narrowed = Object.keys(p).some((k) => p[k] && ["view", "sort", "page"].indexOf(k) < 0);

  const off = (k: string, v: string) => (p[k] === v ? undefined : v);
  /* The strip leads with the figure the rest of it divides up, the way Deals
     and Business Enquiries do. Without it the cells are a set of parts with no
     stated whole, and nobody can tell whether they are meant to add up. It
     clears the breakdown filters rather than every filter: a search or a city
     is the scope you chose, and a cell called Total should not silently throw
     that away. */
  const cells: (StatCell | "sep")[] = [
    { k: "Total", v: live(c.total),
      on: !p.flag && !p.status,
      to: hash(p, { flag: undefined, status: undefined }),
      tip: <>Every registered identity in scope. The cells beside it are its parts.</> },
    "sep",
    { k: "Active", v: live(c.active), dot: "ok", on: p.status === "active",
      to: hash(p, { status: off("status", "active") }),
      tip: <>The account works. It says nothing about whether they are paying — that is a Finance question, asked of the subscription that holds the money.</> },
    { k: "Deactivated", v: live(c.deactivated), dot: "neutral", on: p.status === "deactivated",
      to: hash(p, { status: off("status", "deactivated") }),
      tip: <>Administratively disabled. Their profile, commercial links and audit trail are all still here.</> },
    "sep",
    { k: "Incomplete", v: live(c.incompleteProfiles), dot: "warn", on: p.flag === "incomplete",
      to: hash(p, { flag: off("flag", "incomplete") }),
      tip: <>Business and shop accounts whose profile has not met the go-live checklist yet. Accounts without one are not counted.</> },
  ];

  return (
    <Frame view="users" onView={onView}
      counts={bandCounts(totals.data)}
      title="Users Management"
      /* THE SCOPE, UNFILTERED ON PURPOSE: how big the base is and how much of
         it is live must not change meaning because somebody narrowed the list
         below them — which is exactly what would happen if they were counted
         off the filtered set. */
      meta={totals.data ? <>
        <span><b className="font-medium text-secondary tnum">{c.total.toLocaleString("en-IN")}</b> registered</span>
        <span><b className="font-medium text-secondary tnum">{c.active.toLocaleString("en-IN")}</b> active</span>
        <span>as of {AS_OF}</span>
      </> : totals.error
        ? <span className="text-error-primary">Could not load the user count — {totals.error}</span>
        : <Skeleton w={220} />}
      /* KEYED ON THEIR VALUE. SearchField and Select are uncontrolled, so
         clearing a chip left the old text in the box and the old choice in the
         dropdown — the pattern Audit and Invoices already use. */
      search={<SearchField key={"q" + (p.q || "")} ph="Name, email, phone, user ID, business or reference…"
        val={p.q} onFilter={onSearch} />}
      cmd={<>
        <Select key={"status" + (p.status || "")} name="status" label="Account" value={p.status} onFilter={onFilter}
          options={CLASSIFICATIONS.map((x) => ({ v: x.key, l: x.label, dot: x.key === "active" ? "ok" : "neutral" }))} />
        <Select key={"city" + (p.city || "")} name="city" label="City" value={p.city} onFilter={onFilter}
          options={CITIES.map((x) => ({ v: x.key, l: x.label }))} />
        <Select key={"src" + (p.src || "")} name="src" label="Via" value={p.src} onFilter={onFilter}
          options={REGISTRATION_SOURCES.map((x) => ({ v: x.key, l: x.label }))} />
        <Select key={"tag" + (p.tag || "")} name="tag" label="Tag" value={p.tag} onFilter={onFilter}
          options={TAGS.map((x) => ({ v: x.slug, l: x.label, chip: { tone: x.tone } }))} />
        <Select key={"reg" + (p.registered || "")} name="registered" label="Registered" value={p.registered} onFilter={onFilter}
          options={REGISTERED_RANGES.map((x) => ({ v: x.key, l: x.label }))} />
        {p.registered === "custom" ? (
          /* TWO DATES, ONE NAVIGATION. Pushing them through `onFilter` twice
             navigates twice and the second call reads a stale `p`. */
          <DateRange from={p.from} to={p.to} labelFrom="Registered from" labelTo="Registered up to"
            onChange={(from, to) => onParams({ from: from || undefined, to: to || undefined })} />
        ) : null}
      </>}
      /* Sort is not a filter: it does not narrow anything and it produces no
         chip, so it sits at the far end of the row on its own. */
      right={
        <Select key={"sort" + (p.sort || "")} name="sort" label="Sort" value={p.sort}
          allLabel={SORT_OPTIONS[0]?.label || "Default order"}
          onFilter={onFilter} options={SORT_OPTIONS.slice(1).map((o) => ({ v: o.key, l: o.label }))} />
      }
      chips={<>
        {/* THE OPTIONS DID NOT ARRIVE. The controls stay where they are — the
            applied filters in the URL are still valid and still listed below —
            but nobody should wonder why every dropdown is empty. */}
        {vocab.error
          ? <Notice tone="bad" ico="alert"
              text={<>The filter options did not load — {vocab.error}</>} />
          : null}
        {/* `view`, `sort` and `page` sit in the URL like filters and are not
           filters. A chip reading "view: analytics" invites somebody to clear
           the screen they are on. */}
        <FilterChips
          params={Object.keys(p)
            .filter((k) => ["view", "sort", "page", "from", "to"].indexOf(k) < 0 && p[k])
            .reduce((o, k) => { o[k] = filterValueLabel(k, p[k] as string); return o; },
              {} as Record<string, string>)}
          labels={FILTER_LABELS}
          onUnfilter={(k) => onUnfilter(k === "registered" ? "registered+from+to" : k)} />
      </>}
      bands={<StatStrip cells={cells} />}>

      {listing.error ? (
        <Notice tone="bad" ico="alert"
          text={<>The user list did not load — {listing.error}. Showing only the rows already loaded, filtered here.</>} />
      ) : null}

      {listing.loading && !page.rows.length ? (
        /* The first read has not landed: the table's shape, not "No registered users yet". */
        <ListSkeleton rows={8} />
      ) : page.rows.length ? (
        <ListTable min="66rem" head={<tr>
          <th className="rail" />
          <th>User</th>
          <th>Handle</th>
          <th>Account</th>
          <th>Profile</th>
          <th>Works in</th>
          <th>Registered</th>
          <th>Last seen</th>
          <th className="acts" />
        </tr>}>
          {page.rows.map((r) => <Row key={r.user.userId} r={r} p={p} toast={toast} />)}
        </ListTable>
      ) : (
        <EmptyState icon={narrowed ? "search" : "inbox"}
          title={narrowed ? "Nothing matches those filters" : "No registered users yet"}
          body={narrowed
            ? "The counts in the strip above are for the whole view before any filter."
            : "Users arrive from the website, the portal, campaign funnels and referrals. The registration event creates the record; nobody creates one here."}
          action={narrowed
            ? <Button color="secondary" ico="x" onClick={() => onUnfilter("*")}>Clear all filters</Button>
            : null} />
      )}

      {/* THE SHARED PAGER. This was a hand-built Previous/Next pair with its
          own rule — one of three pagers in the panel, and the only one that
          could not jump to a page. `Pagination` keeps the range it printed
          ("21–40 of 241") and adds the numbered window, so nothing is lost and
          the control is the same one every other list uses. */}
      <Pagination
        page={page.pageNo}
        pages={page.pages}
        total={page.total}
        pageSize={page.pageSize}
        shown={page.rows.length}
        unit="users"
        onPage={onPage}
      />
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

function Row({ r, p, toast }: {
  r: UserRow;
  p: Params;
  toast: (msg: string, tone?: string) => void;
}) {
  const u = r.user;
  /* The rail is the only place a row raises its voice, and there is exactly
     one thing left in this module worth raising it for: a live account whose
     profile is not finished, which is the one gap somebody here can close.
     A colour per state would turn the table into a paint chart nobody scans. */
  const rail = r.classification === "active" && r.completeness !== null && r.completeness < 100 ? "warn" : undefined;
  /* THE WHOLE LIST STATE TRAVELS WITH THE LINK — every filter, the sort and the
     page — so the record's Back button is a return and not a reset. */
  const carried = Object.keys(p)
    .filter((k) => p[k] && k !== "tab")
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
    .join("&");
  const to = "#/users/" + encodeURIComponent(u.userId) + (carried ? "?" + carried : "");
  const area = u.profile.targetAreas || [];
  const city = primaryCityOf(u.profile);

  const copy = (text: string, said: string) => {
    copyToClipboard(text).then((line) => toast(line === "Copied." ? said : line, "ok"));
  };

  return (
    <tr className={"clickable" + (u.userStatus === "deactivated" ? " opacity-70" : "")}
      tabIndex={0} role="link" aria-label={"Open " + u.identity.name}
      onClick={() => go(to)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
      <Rail tone={rail} title={rail ? "Live account, unfinished profile" : undefined} />
      <td><WhoCell r={r} to={to} /></td>
      <td className="mono">
        {u.profile.username
          ? <span className="text-secondary">@{u.profile.username}</span>
          : <span className="text-quaternary">—</span>}
      </td>
      <td><ClassPill k={r.classification} /></td>
      <td>
        {r.completeness === null
          /* Nothing to grade: no business, shop or architect profile. A bar at
             0% would read as a profile somebody abandoned. */
          ? <span className="text-sm text-tertiary">No business profile</span>
          : <Completeness pct={r.completeness} missing={r.missingFields} bare />}
      </td>
      <td>
        {city ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-secondary">{city}</span>
            {area.length ? (
              <span className="truncate text-xs text-tertiary">
                {area.map((a) => a.state).join(", ")}
                {area.length > 1 ? null : area[0].cities.length > 1 ? " · +" + (area[0].cities.length - 1) + " more" : null}
              </span>
            ) : null}
          </span>
        ) : <span className="text-quaternary">—</span>}
      </td>
      <td className="mono">
        <span className="flex min-w-0 flex-col leading-tight">
          <span>{fmtDate(u.registeredAt)}</span>
          <span className="text-xs font-sans text-tertiary">{ago(u.registeredAt)}</span>
        </span>
      </td>
      <td className="mono">{ago(u.lastActivityAt)}</td>
      <td className="acts" onClick={(e) => e.stopPropagation()}>
        <MoreMenu small align="right" label="" items={[
          { icon: "user", label: "Open the record", act: () => go(to) },
          { icon: "note", label: "Open notes & tags", act: () => go(to + (carried ? "&" : "?") + "tab=notes") },
          { icon: "link", label: "Copy the profile link", disabled: !u.profile.username,
            act: () => copy(profileUrl(u.profile.username || ""), "Profile link copied.") },
          { icon: "copy", label: "Copy the user ID", act: () => copy(u.userId, "User ID copied.") },
        ]} />
      </td>
    </tr>
  );
}
