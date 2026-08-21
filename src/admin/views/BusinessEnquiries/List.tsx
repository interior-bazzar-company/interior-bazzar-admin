/* =============================================================================
   Business Enquiries — the list.
   -----------------------------------------------------------------------------
   Five bands, the same five every list workspace in this panel renders: command
   row, attention strip, active filters, rows. What is different here is what
   the list IS.

   The old routing queue held unassigned enquiries and REMOVED them on assign —
   one audit line was all that survived. This list holds an enquiry for its
   whole life: New → Processing → Qualified → Assigned → outcome.
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
import { EmptyState, FilterChips, Icon, ListSkeleton, SearchField, StatStrip, qs } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import ExportModal from "./ExportModal";
import { can } from "../../shell/AdminShell";
import {
  AgeCell, InfoNote, ProtoBar, SourceChip, StatusPill, TagChips,
  TierBadge, UrgencyChip,
} from "./bits";
import {
  RECEIVED_RANGES, SOURCES, STATES, TAGS, TIERS, VOCAB, assignedName,
  businessDirectory, checklistMissing, countsFromServer, everReached, fetchAllMatching,
  isWorking,
  lastResponse, place, receivedLabel, resetStore, statusOf,
} from "./store";
import { FilterSelect } from "./FilterSelect";
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
   questions, and every flag. (Ownership and callbacks have since been removed
   from the module outright — see the 2026-08-21 changelog.) At that size it had stopped being an attention
   surface and become a second copy of the Status dropdown, printed permanently
   across the top of the page. A row where everything is highlighted highlights
   nothing.

   FOUR CELLS SURVIVE, and the test each one passes is the same: somebody has to
   DO something about this number today.

     New             nobody has contacted this customer at all
     qualified       confirmed and frozen, waiting on the routing decision
     no match yet    matching found no business — a supply gap, not a bad enquiry

   Each is a different KIND of thing to do — ours-now, ours-pending, nobody's
   fault — which is why three is the number rather than one.

   There was a fifth, "SLA breached", and it was the only cell measuring a
   BUSINESS rather than us. It went with the SLA logic on 2026-08-21, and with
   it went the strip's ability to show a hand-off going quiet. Nothing replaced
   it; see that day's changelog entry.

   What went, and where it went instead. Nothing lost a filter:

     processing, assigned, converted,           → the Status filter
     rejected

   Those are states you look things up BY, not work waiting to be done, and they
   already have a control each. The strip is for the second kind.

   The rest are still one press away rather than gone — "rest hide", not "rest
   delete" — and the row expands automatically when one of the hidden filters is
   active, because a filter you cannot see is a filter you cannot clear.
   ============================================================================= */
/* THE TOOLTIP TEXT, from content rather than from here. Each cell says what its
   number counts and what pressing it filters to — the second half matters most,
   because a count and the filter behind it can drift apart and the number IS the
   control. `check:wiring` asserts they agree.

   Two elements rather than one string with a blank line in it, because the two
   halves answer different questions and the stylesheet rules the second one off
   and quietens it. That is also why this is a `tip` and no longer a `title`: the
   native tooltip cannot draw a rule, cannot be themed, truncates, waits about a
   second, and never opens on keyboard focus — so the help was unreachable
   without a mouse. A read-on-hover popover would be worse still: fourteen small
   targets in a row, each leaving something that has to be dismissed. */
const CELL_HELP: Record<string, { counts: string; does: string }> = {};
VOCAB.attentionCells.forEach((c) => { CELL_HELP[c.key] = c; });
const helpFor = (k: string) => {
  const h = CELL_HELP[k];
  return h ? <><span className="t">{h.counts}</span><span className="d">{h.does}</span></> : undefined;
};

export function AttnStrip({ m, p }: { m: Counts; p: Params }) {

  const statusRoute = (s: string) =>
    listHash(merge(omit(p, ["tag"]), { status: p.status === s ? "" : s }));

  const cells: (StatCell | "sep")[] = [
    { k: "total", v: m.total, tip: helpFor("total"),
      to: listHash(omit(p, ["status", "tag"])),
      on: !p.status && !p.tag },
    "sep",
    { k: "New", v: m.byStatus.generated || 0, to: statusRoute("generated"), tip: helpFor("New"),
      on: p.status === "generated", tone: (m.byStatus.generated || 0) ? "bad" : "" },
    { k: "processing", v: m.byStatus.processing || 0, to: statusRoute("processing"),
      on: p.status === "processing", tip: helpFor("processing") },
    { k: "qualified", v: m.byStatus.qualified || 0, to: statusRoute("qualified"), tip: helpFor("qualified"),
      on: p.status === "qualified", tone: (m.byStatus.qualified || 0) ? "warn" : "" },
    { k: "no match yet", v: m.noEligible, to: statusRoute("no_match"), tip: helpFor("no match yet"),
      on: p.status === "no_match", tone: m.noEligible ? "warn" : "" },
    "sep",
    { k: "assigned", v: m.byStatus.assigned || 0, to: statusRoute("assigned"),
      on: p.status === "assigned", tip: helpFor("assigned") },
    "sep",
    { k: "converted", v: m.converted, to: statusRoute("converted"), on: p.status === "converted",
      tone: "ok", tip: helpFor("converted") },
    { k: "rejected", v: m.invalid, to: statusRoute("invalid"), on: p.status === "invalid",
      tip: helpFor("rejected") },
  ];

  return (
    <div className="be-attn">
      <StatStrip cells={cells} />
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
        onReset={() => { resetStore(); toast("Simulated writes discarded."); }} />

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

      {/* SORT IS NOT A FILTER, and sharing a grid cell with ten of them said
          it was. It also did not fit: "Sort: Needs attention" is wider than a
          158px cell, so the control shipped reading "Sort: Needs attentio". It
          now sits in its own slot at the end of the band, ruled off, at whatever
          width its longest label needs. */}
      <div className="be-filterbar">
        <div className="be-filters-grid">
          {/* A status carries its own tone, so the list can be scanned by
              colour — and it is the same dot the rows use. */}
          <FilterSelect name="status" label="Status" value={p.status} onFilter={onFilter}
            options={VOCAB.statuses.map((x) => ({ v: x.key, l: x.label, dot: "s-" + x.key }))} />
          <FilterSelect name="category" label="Category" value={p.category} onFilter={onFilter}
            options={VOCAB.categories.map((x) => ({ v: x, l: x }))} />
          <FilterSelect name="city" label="City" value={p.city} onFilter={onFilter}
            options={VOCAB.cities.map((x) => ({ v: x, l: x }))} />
          <FilterSelect name="state" label="State" value={p.state} onFilter={onFilter}
            options={STATES.map((x) => ({ v: x, l: x }))} />
          {/* A ramp, not four arbitrary colours: the sooner they want to start,
              the hotter the dot, and "browsing" is hollow because it is not a
              date at all. Ordinal data should look ordinal. */}
          <FilterSelect name="urgency" label="Urgency" value={p.urgency} onFilter={onFilter}
            options={VOCAB.urgency.map((u) => ({ v: u.key, l: u.label, dot: "u-" + u.key }))} />
          <FilterSelect name="tier" label="Tier" value={p.tier} onFilter={onFilter}
            options={TIERS.map((t) => ({ v: t.key, l: t.label, badge: t.key }))} />
          <FilterSelect name="source" label="From" value={p.source} onFilter={onFilter}
            options={SOURCES.map((x) => ({ v: x.key, l: x.label }))} />
          {/* Tags are chips everywhere else in the module; a list of plain
              words would have been the one place they are not. */}
          <FilterSelect name="tag" label="Tag" value={p.tag} onFilter={onFilter}
            options={TAGS.map((t) => ({ v: t.slug, l: t.label, chip: { tone: t.tone, auto: t.auto } }))} />
          {/* Business is a filter and never a column you can sort a leaderboard
              by: it answers "what have we given them lately?", which is a
              fairness question, and fairness is a scoring factor. */}
          <FilterSelect name="business" label="Business" value={p.business} onFilter={onFilter}
            options={businesses.map((b) => ({ v: b, l: b }))} />
          <FilterSelect name="received" label="Received" value={p.received} onFilter={onFilter}
            options={RECEIVED_RANGES.map((r) => ({ v: r.key, l: r.label }))} />
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

        {/* The default is the empty value: unassigned first, then newest — the
            server's own order. It answers "what still needs doing": a lead
            nobody has been given, and the one somebody just typed and is
            looking for. Needs attention is still here and still the right
            choice for working a backlog; it just stopped being what the queue
            opens on. */}
        <div className="be-sortslot">
          <FilterSelect name="sort" label="Sort: Unassigned, newest" value={p.sort} onFilter={onFilter}
            options={[
              { v: "attention", l: "Needs attention" },
              { v: "touch", l: "Least worked first" },
              { v: "age", l: "Oldest first" },
              { v: "step", l: "Lifecycle step" },
              { v: "tier", l: "Tier" },
            ]} />
        </div>
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
          urgency: "Urgency", tier: "Tier", business: "Business", tag: "Tag",
          source: "From", received: "Received", state: "State",
        }} />

      <div className="dls-body">
        {rows.length
          ? <Rows rows={rows} p={p} sel={sel} load={businessLoad(all)} />
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

/* HOW MANY LIVE ENQUIRIES EACH BUSINESS IS HOLDING.
   Counted from the whole set and never from the filtered rows: the badge means
   "this business currently has N", and a number that shrank because somebody
   filtered by city would be answering a different question with the same mark.
   Live only — `assigned` is the one state where a business owes us something,
   so a business that converted forty last quarter does not read as buried. */
function businessLoad(all: Enquiry[]): Record<string, number> {
  const out: Record<string, number> = {};
  all.forEach((e) => {
    if (e.status !== "assigned") return;
    const n = assignedName(e);
    if (n) out[n] = (out[n] || 0) + 1;
  });
  return out;
}

function Rows({ rows, p, sel, load }: {
  rows: Enquiry[]; p: Params; sel: string | null; load: Record<string, number>;
}) {
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
          <th>Status</th>
          <th>Last response</th>
          <th>Assigned to</th>
          <th className="n">Age</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const to = enquiryHash(e.enquiryId, p);
          /* One rail state left: a supply gap, which is the only condition a
             row can be in that somebody has to act on from the list itself. */
          const rail = e.status === "no_match" ? "warn"
            : e.status === "qualified" ? "rd" : "";
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
                </div>
                <div className="cell-2 mono">
                  {e.enquiryId}{" · "}
                  {/* The number wraps as ONE unit. Unmasking it made the line
                      long enough to break, and a phone split across two lines
                      ("+91" / "98100 00027") is a number nobody can read or
                      copy at a glance. */}
                  <span className="nowrap">{e.customer.phone}</span>
                </div>
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
              <td>
                <StatusPill status={e.status} />
                {/* For an enquiry still being qualified, the useful second
                    line is how far through the checklist it is. */}
                {isWorking(e.status)
                  ? <div className="cell-2">{4 - checklistMissing(e).length} of 4 confirmed</div>
                  : null}
              </td>
              {/* THE COLUMN THAT MAKES THE QUEUE READABLE. Category and city are
                  the same on half these rows; what the customer actually said is
                  never the same, and it is what tells an operator which one to
                  open. Truncated by CSS, in full on hover. */}
              <td className="be-resp-c">{<LastResponseCell e={e} />}</td>
              <td>{assignedName(e)
                ? <span className="be-biz">
                    <span className="nm">{assignedName(e)}</span>
                    <span className={"ct tnum" + (load[assignedName(e)] ? "" : " zero")}
                      title={assignedName(e) + " is holding " + (load[assignedName(e)] || 0)
                        + " live enquir" + ((load[assignedName(e)] || 0) === 1 ? "y" : "ies")
                        + " right now, across the whole queue — not just the rows in view."}>
                      {load[assignedName(e)] || 0}
                    </span>
                  </span>
                : <span className="faint">—</span>}</td>
              <td className="n"><AgeCell e={e} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
