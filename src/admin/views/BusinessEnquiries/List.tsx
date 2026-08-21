/* =============================================================================
   Business Enquiries — the list.
   -----------------------------------------------------------------------------
   Five bands, the same five every list workspace in this panel renders: command
   row, attention strip, active filters, rows. What is different here is what
   the list IS.

   The old routing queue held unassigned enquiries and REMOVED them on assign —
   one audit line was all that survived. This list holds an enquiry for its
   whole life: Ready → Assigned → Delivered → Acknowledged → outcome.
   Assignment is a transition, not a deletion, which is why the table has a
   State column and an Assigned-to column that keep working after the routing
   decision is made.

   One thing is deliberately absent: a money column, and any field behind one.
   Not a filter, sort, score input or export column, anywhere.

   The Create button was the other one, and it came back — see NewEnquiry.tsx.
   The three guarantees it was protecting (a submission id, a duplicate check, a
   qualification gate) are kept by the FORM rather than by the button not
   existing, which is what they always needed to be.
   ============================================================================= */
import { useState } from "react";
import { EmptyState, FilterChips, Icon, ListSkeleton, SearchField, Select, StatStrip, qs } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import ExportModal from "./ExportModal";
import { can } from "../../shell/AdminShell";
import {
  AgeCell, FollowUpCell, InfoNote, OwnerCell, ProtoBar, SourceChip, StatusPill, TagChips,
  TierBadge, UrgencyChip,
} from "./bits";
import {
  RECEIVED_RANGES, SOURCES, STATES, TAGS, TEAM, TIERS, VOCAB, ageLabel, assignedName,
  businessDirectory, checklistMissing, countsFromServer, everReached, fetchAllMatching,
  followUpOverdue, lastResponse, place,
  receivedLabel, resetStore, runSlaSweep, statusOf,
} from "./store";
import type { Counts, Enquiry, PageState, Params } from "./store";

const ROUTE = "#/business-enquiries";

export const merge = (p: Params, extra: Record<string, string>): Params => {
  const o: Params = { ...p };
  Object.keys(extra).forEach((k) => { o[k] = extra[k]; });
  return o;
};
export const omit = (p: Params, keys: string[]): Params => {
  const o: Params = {};
  Object.keys(p).forEach((k) => { if (keys.indexOf(k) < 0) o[k] = p[k]; });
  return o;
};
export const listHash = (p: Params) => ROUTE + qs(p as Record<string, string>);
export const enquiryHash = (id: string, p: Params) =>
  ROUTE + "/" + encodeURIComponent(id) + qs(p as Record<string, string>);

/* =============================================================================
   THE ATTENTION STRIP — what needs a human, and nothing else.
   -----------------------------------------------------------------------------
   It had grown to fifteen cells: every lifecycle state, both ownership
   questions, and every flag. At that size it had stopped being an attention
   surface and become a second copy of the Status dropdown, printed permanently
   across the top of the page. A row where everything is highlighted highlights
   nothing.

   FIVE CELLS SURVIVE, and the test each one passes is the same: somebody has to
   DO something about this number today.

     untouched     nobody has contacted this customer at all
     overdue       we promised to ring back and did not
     ready         qualified, matched, and waiting on a routing decision
     SLA breached  a business has had it for a day and not answered
     no eligible   matching found nobody — a supply gap, not a bad enquiry

   Each is a different KIND of failure — ours, ours, ours-pending,
   theirs, nobody's — which is why five is the number rather than three.

   What went, and where it went instead. Nothing lost a filter:

     in qualification, assigned, delivered,     → the Status filter
     acknowledged, converted, invalid
     mine, unclaimed                            → the Owner filter
     callback due (scheduled, not yet late)     → the "Callback soonest" sort

   Those are states you look things up BY, not work waiting to be done, and they
   already have a control each. The strip is for the second kind.

   The rest are still one press away rather than gone — "rest hide", not "rest
   delete" — and the row expands automatically when one of the hidden filters is
   active, because a filter you cannot see is a filter you cannot clear.
   ============================================================================= */
export function AttnStrip({ m, p }: { m: Counts; p: Params }) {
  const [open, setOpen] = useState(false);

  const statusRoute = (s: string) =>
    listHash(merge(omit(p, ["flag", "tag"]), { status: p.status === s ? "" : s }));
  const flagRoute = (f: string) =>
    listHash(merge(omit(p, ["status", "tag"]), { flag: p.flag === f ? "" : f }));
  const tagRoute = (t: string) =>
    listHash(merge(omit(p, ["status", "flag"]), { tag: p.tag === t ? "" : t }));
  const ownerRoute = (o: string) =>
    listHash(merge(omit(p, ["flag"]), { owner: p.owner === o ? "" : o }));

  /* A hidden cell that is CURRENTLY the active filter has to be visible, or the
     only way back to the full list is the chip row and a guess. */
  const secondaryOn =
    p.owner === "__mine" || p.owner === "__none" || p.flag === "followup" ||
    ["generated", "assigned", "delivered", "acknowledged", "converted", "invalid"]
      .indexOf(p.status || "") >= 0;
  const showAll = open || secondaryOn;
  /* Expanded by a filter rather than by a press — the distinction the button
     label depends on. */
  const heldOpen = secondaryOn && !open;

  const primary: (StatCell | "sep")[] = [
    { k: "total", v: m.total,
      to: listHash(omit(p, ["status", "flag", "tag", "owner"])),
      on: !p.status && !p.flag && !p.tag && !p.owner },
    "sep",
    /* Ours, and the worst of the five: nobody has spoken to this customer. */
    { k: "untouched", v: m.untouched, to: tagRoute("new-enquiry"),
      on: p.tag === "new-enquiry", tone: m.untouched ? "bad" : "" },
    /* Also ours, and worse in kind — we said we would ring and did not. */
    { k: "overdue", v: m.callbackOverdue, to: flagRoute("overdue"),
      on: p.flag === "overdue", tone: m.callbackOverdue ? "bad" : "" },
    /* Ours, pending: the routing decision this module exists to make. */
    { k: "ready", v: m.byStatus.ready || 0, to: statusRoute("ready"),
      on: p.status === "ready", tone: (m.byStatus.ready || 0) ? "warn" : "" },
    "sep",
    /* Theirs: a business has had it for a day and said nothing. */
    { k: "SLA breached", v: m.breached, to: flagRoute("breached"),
      on: p.flag === "breached", tone: m.breached ? "bad" : "" },
    /* Nobody's fault — a coverage gap, and the only cell here that is a
       business-development worklist rather than an operations one. */
    { k: "no eligible", v: m.noEligible, to: flagRoute("no_eligible"),
      on: p.flag === "no_eligible", tone: m.noEligible ? "warn" : "" },
  ];

  const secondary: (StatCell | "sep")[] = [
    "sep",
    { k: "mine", v: m.mine, to: ownerRoute("__mine"), on: p.owner === "__mine" },
    { k: "unclaimed", v: m.unowned, to: ownerRoute("__none"), on: p.owner === "__none" },
    { k: "in qualification", v: m.qualifying, to: statusRoute("generated"), on: p.status === "generated" },
    { k: "callback due", v: m.callbackDue - m.callbackOverdue, to: flagRoute("followup"), on: p.flag === "followup" },
    "sep",
    { k: "assigned", v: m.byStatus.assigned || 0, to: statusRoute("assigned"), on: p.status === "assigned" },
    { k: "delivered", v: m.byStatus.delivered || 0, to: statusRoute("delivered"), on: p.status === "delivered" },
    { k: "acknowledged", v: m.byStatus.acknowledged || 0, to: statusRoute("acknowledged"), on: p.status === "acknowledged" },
    "sep",
    { k: "converted", v: m.converted, to: statusRoute("converted"), on: p.status === "converted", tone: "ok" },
    { k: "invalid", v: m.invalid, to: statusRoute("invalid"), on: p.status === "invalid" },
  ];

  const hidden = secondary.filter((c) => c !== "sep").length;

  return (
    <div className="be-attn">
      <StatStrip cells={showAll ? primary.concat(secondary) : primary} />
      {/* Held open, not merely expanded, while one of the hidden filters is
          active: the row is only showing because of that filter, so the control
          says so instead of offering a "Fewer" that cannot work. A disabled
          button labelled with the thing it will not do reads as broken. */}
      <button className="be-attn-more" aria-expanded={showAll}
        disabled={heldOpen}
        title={heldOpen
          ? "One of these counts is the active filter — clear it to collapse the row"
          : undefined}
        onClick={() => setOpen(!open)}>
        {heldOpen ? "Filtered" : showAll ? "Fewer" : "+" + hidden + " more"}
      </button>
    </div>
  );
}

export default function List({ all, page, onPage, p, sel, onFilter, onSearch, onUnfilter, toast, onCreate }: {
  all: Enquiry[];
  page: PageState;
  onPage: (n: number) => void;
  p: Params;
  sel: string | null;
  onFilter: (name: string, value: string) => void;
  onSearch: (name: string, value: string) => void;
  onUnfilter: (key: string) => void;
  toast: (msg: string, tone?: string) => void;
  onCreate: () => void;
}) {
  const shell = useShell();
  /* The skeleton is for the FIRST read only. Once a query has answered, an
     empty result is a real answer — "nothing matches these filters" — and
     showing a skeleton for it would read as still loading, forever. */
  if (page.loading && !all.length) return <ListSkeleton />;

  /* Filtered, ordered and cut server-side. Doing any of it again here would be
     a second implementation of the same rules over one page of the answer. */
  const rows = all;
  /* From the business DIRECTORY, not from the rows on screen: with a page, the
     dropdown would otherwise offer only the businesses this page happens to
     mention and silently lose the filter you wanted. */
  const businesses = Array.from(
    new Set(businessDirectory().map((b) => b.name).filter(Boolean))).sort();
  const activeFilters = Object.keys(omit(p, ["sort", "tab", "page"])).filter((k) => p[k]).length;
  const filtered = activeFilters > 0;
  /* Whether the export would differ from "everything" — the button says so, and
     the dialog leads with it. */
  const narrowed = filtered;
  const pages = Math.max(1, Math.ceil(page.total / (page.pageSize || 1)));
  const firstOnPage = page.total ? (page.pageNo - 1) * page.pageSize + 1 : 0;
  const lastOnPage = (page.pageNo - 1) * page.pageSize + rows.length;

  return (
    <div className="dls be-list">
      <ProtoBar
        onReset={() => { resetStore(); toast("Simulated writes discarded."); }}
        onSweep={() => {
          const n = runSlaSweep();
          toast(n ? n + " enquiry flagged as breached." : "Nothing past its acknowledgement threshold.");
        }} />

      {/* ============================================================ COMMANDS ===
          Two bands, and the split is by KIND rather than by how much fits on a
          line: the first is what you do, the second is what you are looking at.

          Everything used to be one flex row — search, eleven selects and three
          buttons — which wrapped differently at every window width and moved
          Export somewhere new each time. Then the filters went into a popover,
          which hid them, and then into the table header, which gave the page a
          second search box. This is the version that admits the problem was
          never WHERE the filters live but that a ragged wrap has no alignment
          to read: they are a grid now, every control the same width, so a
          wrapped row lines up under the one above it instead of drifting. */}
      <div className="be-actions">
        <SearchField ph="Search reference, name, phone, or what they said…"
          val={p.q} onFilter={onSearch} />
        <span className="spacer" />
        <button className={"btn be-exportbtn" + (narrowed ? " narrowed" : "")}
          data-act="be-export"
          title={narrowed
            ? "Export the " + page.total + " enquiries these filters match"
            : "Export all " + page.total + " enquiries"}
          /* FETCHES EVERY MATCHING ROW FIRST, not the page on screen. An export
             that quietly held fifty of two hundred is the exact failure this
             dialog exists to prevent, and it would look like a complete file. */
          onClick={async () => {
            try {
              const everything = await fetchAllMatching(p);
              shell.modal(
                <ExportModal filtered={everything} all={everything} p={p}
                  onClose={shell.closeLayer}
                  onDone={(msg, tone) => { shell.closeLayer(); toast(msg, tone); }} />,
                "wide");
            } catch {
              toast("Could not read the full set to export.", "bad");
            }
          }}>
          <Icon name="download" />Export
          <span className="ct tnum">{page.total}</span>
        </button>
        {can("business-enquiries", "create")
          ? <button className="btn pri" data-act="be-create" onClick={onCreate}>
              <Icon name="plus" />Add enquiry
            </button>
          : null}
      </div>

      <div className="be-filters-grid">
        <Select name="status" label="Status" value={p.status} onFilter={onFilter}
          options={VOCAB.statuses.map((x) => ({ v: x.key, l: x.label }))} />
        <Select name="owner" label="Owner" value={p.owner} onFilter={onFilter}
          options={[{ v: "__mine", l: "Mine" }, { v: "__none", l: "Unclaimed" }]
            .concat(TEAM.map((t) => ({ v: t.name, l: t.name })))} />
        <Select name="category" label="Category" value={p.category} onFilter={onFilter}
          options={VOCAB.categories.map((x) => ({ v: x, l: x }))} />
        <Select name="city" label="City" value={p.city} onFilter={onFilter}
          options={VOCAB.cities.map((x) => ({ v: x, l: x }))} />
        <Select name="state" label="State" value={p.state} onFilter={onFilter}
          options={STATES.map((x) => ({ v: x, l: x }))} />
        <Select name="urgency" label="Urgency" value={p.urgency} onFilter={onFilter}
          options={VOCAB.urgency.map((u) => ({ v: u.key, l: u.label }))} />
        <Select name="tier" label="Tier" value={p.tier} onFilter={onFilter}
          options={TIERS.map((t) => ({ v: t.key, l: t.label }))} />
        <Select name="source" label="From" value={p.source} onFilter={onFilter}
          options={SOURCES.map((x) => ({ v: x.key, l: x.label }))} />
        <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter}
          options={TAGS.map((t) => ({ v: t.slug, l: t.label }))} />
        {/* Business is a filter and never a column you can sort a leaderboard
            by: it answers "what have we given them lately?", which is a
            fairness question, and fairness is a scoring factor. */}
        <Select name="business" label="Business" value={p.business} onFilter={onFilter}
          options={businesses.map((b) => ({ v: b, l: b }))} />
        <Select name="received" label="Received" value={p.received} onFilter={onFilter}
          options={RECEIVED_RANGES.map((r) => ({ v: r.key, l: r.label }))} />
        {/* The default is the empty value: unassigned first, then newest. It
            answers "what still needs doing" — a lead nobody has been given, and
            the one somebody just typed and is looking for. Needs attention is
            still here and still the right choice for working a backlog; it just
            stopped being what the queue opens on, because it sorted every
            breached row above the enquiry you added thirty seconds ago. */}
        <Select name="sort" label="Sort: Unassigned, newest" value={p.sort} onFilter={onFilter}
          options={[
            { v: "attention", l: "Needs attention" },
            { v: "touch", l: "Least worked first" },
            { v: "followup", l: "Callback soonest" },
            { v: "age", l: "Oldest first" },
            { v: "step", l: "Lifecycle step" },
            { v: "tier", l: "Tier" },
          ]} />
        {/* The two ends of a custom window appear only when one is asked for,
            and take a full grid cell each so they line up with the selects
            rather than squeezing in beside one. */}
        {p.received === "custom" ? (
          <>
            <input type="date" className="be-date" value={p.from || ""} aria-label="Received from"
              onChange={(ev) => onFilter("from", ev.target.value)} />
            <input type="date" className="be-date" value={p.to || ""} aria-label="Received up to"
              onChange={(ev) => onFilter("to", ev.target.value)} />
          </>
        ) : null}
      </div>

      {page.counts ? <AttnStrip m={countsFromServer(page.counts)} p={p} /> : null}

      {/* `from`/`to` are folded into the range chip — three chips for one
          date window reads as three filters, and removing one of them leaves a
          half-set range nobody asked for. */}
      <FilterChips
        params={{
          /* `page` is in the URL like a filter but is not one — a chip reading
             "page: 2" invites somebody to clear it as if it were narrowing the
             results, and the pager already says where they are. */
          ...omit(p, ["sort", "tab", "page", "received", "from", "to"]),
          ...(p.received ? { received: receivedLabel(p) } : {}),
        }}
        onUnfilter={(k) => onUnfilter(k === "received" ? "received+from+to" : k)}
        labels={{
          q: "Search", status: "Status", category: "Category", city: "City",
          urgency: "Urgency", tier: "Tier", business: "Business", flag: "Flag", tag: "Tag",
          owner: "Owner", source: "From", received: "Received", state: "State",
        }} />

      <div className="dls-body">
        {rows.length
          ? <Rows rows={rows} p={p} sel={sel} />
          : <EmptyState icon="inbox"
              title={filtered ? "No enquiries match these filters" : "No enquiries yet"}
              body={filtered
                ? "Nothing in the queue matches. Clear a filter to widen the search."
                : "Enquiries arrive from funnel pages, the website and the portal — or you add one by hand for a call, a walk-in or a referral. However it arrives, it is qualified by a person before it can be matched."}
              action={filtered
                ? <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</button>
                : can("business-enquiries", "create")
                  ? <button className="btn pri" onClick={onCreate}><Icon name="plus" />Add enquiry</button>
                  : null} />}
      </div>

      {/* THE PAGER. Inline styles, like the audit log's — this is one row of
          controls and adding a stylesheet rule for it would be the only thing
          in the file that needed one. */}
      {page.total > page.pageSize ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 2px" }}>
          <button className="btn" data-act="be-prev"
            disabled={page.pageNo <= 1 || page.loading}
            onClick={() => onPage(page.pageNo - 1)}>Previous</button>
          <button className="btn" data-act="be-next"
            disabled={page.pageNo >= pages || page.loading}
            onClick={() => onPage(page.pageNo + 1)}>Next</button>
          <span className="faint" style={{ fontSize: "var(--text-sm)" }}>
            {page.loading ? "Loading…" : <>
              Showing <b className="tnum">{firstOnPage}</b>–<b className="tnum">{lastOnPage}</b>
              {" of "}<b className="tnum">{page.total}</b>
              {" · page "}<b className="tnum">{page.pageNo}</b> of <b className="tnum">{pages}</b>
            </>}
          </span>
        </div>
      ) : null}

      {page.error
        ? <div className="help bad" style={{ padding: "12px 2px" }}>{page.error}</div>
        : null}

      <InfoNote ico="alert" short={<><b>An enquiry is not a deal.</b></>}>
        This module routes a customer opportunity to a subscribed business; Deals is Interior bazzar
        selling a subscription. A converted enquiry is the business's revenue and is never summed into
        ours — the two records must never share an axis on any dashboard.
      </InfoNote>
    </div>
  );
}

/* Three states, and the difference between them matters more than the text:
   something was said, nothing was said yet but we have tried, or nobody has
   tried at all. The third is the one an operator should feel bad about. */
function LastResponseCell({ e }: { e: Enquiry }) {
  const last = lastResponse(e);
  if (last) return <span className="be-resp" title={last.response || ""}>{last.response}</span>;
  if (e.contactLog.length) {
    return (
      <span className="be-resp none" title="Attempted, never reached">
        {e.contactLog.length} attempt{e.contactLog.length === 1 ? "" : "s"}, no response
        {everReached(e) ? "" : " yet"}
      </span>
    );
  }
  return <span className="be-resp untouched">Not contacted</span>;
}

function Rows({ rows, p, sel }: { rows: Enquiry[]; p: Params; sel: string | null }) {
  return (
    <table className="tbl be-tbl">
      <thead>
        <tr>
          <th style={{ width: "3px" }}></th>
          <th>Enquiry</th>
          <th>Tier</th>
          <th>From</th>
          <th>Category · location</th>
          <th>Urgency</th>
          <th>Owner</th>
          <th>Callback</th>
          <th>Status</th>
          <th>Last response</th>
          <th>Assigned to</th>
          <th className="n">Age</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const to = enquiryHash(e.enquiryId, p);
          /* Ordered by who is waiting on whom: a customer we promised to ring
             back, then a business we are waiting on, then a supply gap. */
          const rail = followUpOverdue(e) || e.sla.breached ? "bad"
            : e.exception ? "warn"
            : e.status === "ready" ? "rd" : "";
          const dim = statusOf(e.status).terminal;
          return (
            <tr key={e.enquiryId}
              className={"clickable" + (rail ? " be-r-" + rail : "") + (dim ? " dim" : "") +
                (sel === e.enquiryId ? " on" : "")}
              data-go={to} onClick={() => go(to)}>
              <td className="rail"><i /></td>
              <td>
                <div className="cell-1">
                  {e.customer.name}
                  {e.exception ? <> <span className="pill warn xs">No eligible business</span></> : null}
                </div>
                <div className="cell-2 mono">{e.enquiryId} · {e.customer.phone}</div>
                <TagChips tags={e.tags} max={3} />
                {/* THAT there are internal notes, never what they say. Somebody
                    scanning the queue should know a colleague has already
                    written something here before they pick it up — the text
                    itself lives on the record and goes nowhere else. */}
                {e.remarks.length
                  ? <span className="be-rmk" title={e.remarks.length + " internal remark" + (e.remarks.length === 1 ? "" : "s")}>
                      <Icon name="doc" size="sm" />{e.remarks.length}
                    </span>
                  : null}
              </td>
              <td><TierBadge tier={e.tier} /></td>
              <td><SourceChip source={e.source} /></td>
              <td>
                <div className="cell-1">{e.requirement.category || <span className="faint">—</span>}</div>
                <div className="cell-2">{place(e)}</div>
              </td>
              <td><UrgencyChip urgency={e.qualification.urgency} /></td>
              <td><OwnerCell owner={e.owner} /></td>
              <td><FollowUpCell e={e} /></td>
              <td>
                <StatusPill status={e.status} />
                {e.sla.breached && e.sla.dueAt
                  ? <div className="cell-2 be-late">SLA +{ageLabel(e.sla.dueAt)}</div>
                  : null}
                {/* For an enquiry still being qualified, the useful second line
                    is not an SLA — it is how far through the checklist it is. */}
                {e.status === "generated"
                  ? <div className="cell-2">{4 - checklistMissing(e).length} of 4 confirmed</div>
                  : null}
              </td>
              {/* THE COLUMN THAT MAKES THE QUEUE READABLE. Category and city are
                  the same on half these rows; what the customer actually said is
                  never the same, and it is what tells an operator which one to
                  open. Truncated by CSS, in full on hover. */}
              <td className="be-resp-c">{<LastResponseCell e={e} />}</td>
              <td>{assignedName(e) || <span className="faint">—</span>}</td>
              <td className="n"><AgeCell e={e} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
