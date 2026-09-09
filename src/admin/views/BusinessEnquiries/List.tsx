/* =============================================================================
   Business Enquiries — the queue.
   -----------------------------------------------------------------------------
   The bands every list workspace in this panel renders, in the panel's order:
   page header → filter bar → attention strip → table → pager. What is different
   here is what the list IS.

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
import {
  Alert, Button, DateInput, EmptyState, FilterBar, FilterChips, Icon, ListSkeleton, ListTable,
  Pagination, PageHeader, Pill, Rail, qs, SearchField, Select, StatStrip,
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import ExportModal from "./ExportModal";
import { can } from "../../shell/AdminShell";
import {
  AgeCell, attentionTone, InfoNote, ProtoBar, SourceChip, StatusPill, statusDot, TagChips,
  TierBadge, UrgencyChip,
} from "./bits";
import { RowMenu } from "./menus";
import {
  RECEIVED_RANGES, SORT_OPTIONS, SOURCES, STATES, TAGS, TIERS, VOCAB, assignedName,
  businessDirectory, checklistMissing, countsFromServer, everReached, fetchAllMatching,
  isWorking,
  lastResponse, place, receivedLabel, resetStore, statusOf,
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

/* THE FILTER CHIPS' WORDS, once — the bar builds the controls from them and the
   chips row reads the same object, so a filter cannot be added to one and
   missed by the other. */
const LABELS: Record<string, string> = {
  q: "Search", status: "Status", category: "Category", city: "City",
  urgency: "Urgency", tier: "Tier", business: "Business", tag: "Tag",
  source: "From", received: "Received", state: "State",
};

/* The urgency ramp, by vocabulary position: soonest first. Four tone words
   rather than a colour each, so the dot in the dropdown is the same object the
   rest of the panel draws. */
const URGENCY_RAMP = ["bad", "warn", "info", "neutral"];

/* =============================================================================
   THE ATTENTION STRIP — what needs a human, and nothing else.
   -----------------------------------------------------------------------------
   It had grown to fifteen cells: every lifecycle state, both ownership
   questions, and every flag. (Ownership and callbacks have since been removed
   from the module outright — see the 2026-08-21 changelog.) At that size it had
   stopped being an attention surface and become a second copy of the Status
   dropdown, printed permanently across the top of the page. A row where
   everything is highlighted highlights nothing.

   What is TONED is what somebody has to do something about today — New
   (nobody has contacted this customer at all), Qualified (frozen, waiting on
   the routing decision) and No match yet (a supply gap, not a bad enquiry).
   Each is a different KIND of thing to do, which is why three is the number
   rather than one. The rest are read-outs: states you look things up BY, and
   they carry the count and the filter without the colour.

   A row in the table wears the SAME tone as the cell it is counted in — see
   `attentionTone` in bits.tsx. One judgement, two places.

   There was a fifth, "SLA breached", and it was the only cell measuring a
   BUSINESS rather than us. It went with the SLA logic on 2026-08-21, and with
   it went the strip's ability to show a hand-off going quiet. Nothing replaced
   it; see that day's changelog entry.
   ============================================================================= */
/* THE TOOLTIP TEXT, from content rather than from here. Each cell says what its
   number counts and what pressing it filters to — the second half matters most,
   because a count and the filter behind it can drift apart and the number IS the
   control. `check:wiring` asserts they agree.

   Two lines rather than one string with a blank line in it, because the two
   halves answer different questions and the second is ruled off and quietened.
   That is also why this is a `tip` and no longer a `title`: the native tooltip
   cannot draw a rule, cannot be themed, truncates, waits about a second, and
   never opens on keyboard focus — so the help was unreachable without a mouse.

   LOOKED UP WHEN THE CELL RENDERS, never at module scope. `VOCAB` is `{}` until
   bootBusinessEnquiries() has answered — that is the whole design of the boot
   gate — so a module-level `VOCAB.attentionCells.forEach(...)` reads `undefined`
   the instant this file is imported and throws before React mounts anything. It
   took the entire panel down, not just this module: every route imports through
   the registry, so one throw at import time left `#root` empty on every page,
   including the login screen. */
const helpFor = (k: string) => {
  const h = (VOCAB.attentionCells || []).filter((c) => c.key === k)[0];
  return h ? (
    <>
      <span className="block">{h.counts}</span>
      <span className="mt-1.5 block border-t border-white/20 pt-1.5 font-normal">{h.does}</span>
    </>
  ) : undefined;
};

export function AttnStrip({ m, p }: { m: Counts; p: Params }) {
  const statusRoute = (s: string) =>
    listHash(merge(omit(p, ["tag"]), { status: p.status === s ? "" : s }));

  /* The tone comes from the same function the row rail reads, and only when the
     number is non-zero: a red 0 is an alarm about nothing. */
  const cell = (k: string, label: string, status: string, v: number): StatCell => ({
    k: label,
    v,
    to: statusRoute(status),
    on: p.status === status,
    tip: helpFor(k),
    dot: statusDot(status),
    tone: v ? attentionTone(status) : undefined,
  });

  const cells: (StatCell | "sep")[] = [
    {
      k: "in the queue", v: m.total, tip: helpFor("total"),
      to: listHash(omit(p, ["status", "tag"])),
      on: !p.status && !p.tag,
    },
    "sep",
    cell("New", "New", "generated", m.byStatus.generated || 0),
    cell("processing", "Processing", "processing", m.byStatus.processing || 0),
    cell("qualified", "Qualified", "qualified", m.byStatus.qualified || 0),
    cell("no match yet", "No match yet", "no_match", m.noEligible),
    "sep",
    cell("assigned", "Assigned", "assigned", m.byStatus.assigned || 0),
    "sep",
    { ...cell("converted", "Converted", "converted", m.converted), tone: m.converted ? "ok" : undefined },
    cell("rejected", "Rejected", "invalid", m.invalid),
  ];

  return <StatStrip cells={cells} />;
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
  /* `total` is the server's count over the whole filtered set. Read defensively
     because the pager arithmetic below divides by it: a response that arrives
     without one must fall back to what is on screen rather than paging into
     NaN. */
  const total = page.total || rows.length;
  const pages = Math.max(1, Math.ceil(total / (page.pageSize || 1)));

  const onExport = async () => {
    try {
      /* FETCHES EVERY MATCHING ROW FIRST, not the page on screen. An export
         that quietly held fifty of two hundred is the exact failure this
         dialog exists to prevent, and it would look like a complete file. */
      const everything = await fetchAllMatching(p);
      shell.modal(
        <ExportModal filtered={everything} all={everything} p={p}
          onClose={shell.closeLayer}
          onDone={(msg, tone) => { shell.closeLayer(); toast(msg, tone); }} />,
        "lg");
    } catch {
      toast("Could not read the full set to export.", "bad");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ProtoBar
        onReset={() => { resetStore(); toast("Simulated writes discarded."); }} />

      <PageHeader
        title="Business Enquiries"
        meta={
          <>
            <span><b className="font-medium text-secondary tnum">{total.toLocaleString()}</b> {filtered ? "matching" : "in the queue"}</span>
            {filtered ? <span>{activeFilters} filter{activeFilters === 1 ? "" : "s"} on</span> : null}
            <span>as of {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
          </>
        }
        actions={
          <>
            <Button
              color="secondary" ico="download" data-act="be-export"
              /* The count rides ON the button, so "Export" can never be read as
                 "export the page you can see". */
              title={narrowed
                ? "Export the " + total + " enquiries these filters match"
                : "Export all " + total + " enquiries"}
              onClick={onExport}
            >
              Export <span className="tnum">{total.toLocaleString()}</span>
            </Button>
            {can("business-enquiries", "create")
              ? <Button color="primary" ico="plus" data-act="be-create" onClick={onCreate}>New enquiry</Button>
              : null}
          </>
        }
      />

      <FilterBar
        search={
          <SearchField ph="Search reference, name, phone, or what they said…"
            val={p.q} onFilter={onSearch} />
        }
        filters={
          <>
            {/* A status carries its own tone, so the list can be scanned by
                colour — and it is the same dot the rows use. */}
            <Select name="status" label="Status" value={p.status} onFilter={onFilter}
              options={VOCAB.statuses.map((x) => ({ v: x.key, l: x.label, dot: statusDot(x.key) }))} />
            <Select name="category" label="Category" value={p.category} onFilter={onFilter}
              options={VOCAB.categories.map((x) => ({ v: x, l: x }))} />
            <Select name="city" label="City" value={p.city} onFilter={onFilter}
              options={VOCAB.cities.map((x) => ({ v: x, l: x }))} />
            <Select name="state" label="State" value={p.state} onFilter={onFilter}
              options={STATES.map((x) => ({ v: x, l: x }))} />
            {/* A ramp, not four arbitrary colours: the sooner they want to
                start, the hotter the dot, and the last band is neutral because
                it is not a date at all. Ordinal data should look ordinal, and
                the order is the vocabulary's, soonest first. */}
            <Select name="urgency" label="Urgency" value={p.urgency} onFilter={onFilter}
              options={VOCAB.urgency.map((u, i) => ({
                v: u.key, l: u.label, dot: URGENCY_RAMP[i] || "neutral",
              }))} />
            <Select name="tier" label="Tier" value={p.tier} onFilter={onFilter}
              options={TIERS.map((t) => ({ v: t.key, l: t.label, badge: t.key }))} />
            <Select name="source" label="From" value={p.source} onFilter={onFilter}
              options={SOURCES.map((x) => ({ v: x.key, l: x.label }))} />
            {/* Tags are chips everywhere else in the module; a list of plain
                words would have been the one place they are not. */}
            <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter}
              options={TAGS.map((t) => ({ v: t.slug, l: t.label, chip: { tone: t.tone, auto: t.auto } }))} />
            {/* Business is a filter and never a column you can sort a
                leaderboard by: it answers "what have we given them lately?",
                which is a fairness question, and fairness is a scoring factor. */}
            <Select name="business" label="Business" value={p.business} onFilter={onFilter}
              options={businesses.map((b) => ({ v: b, l: b }))} />
            <Select name="received" label="Received" value={p.received} onFilter={onFilter}
              options={RECEIVED_RANGES.map((r) => ({ v: r.key, l: r.label }))} />
            {/* The two ends of a custom window appear only when one is asked
                for, and they sit in the filter row rather than in a second
                band, because they are one filter with the range above them. */}
            {p.received === "custom" ? (
              <>
                <DateInput value={p.from || ""} max={p.to || undefined} ariaLabel="Received from"
                  onChange={(v) => onFilter("from", v)} />
                <DateInput value={p.to || ""} min={p.from || undefined} ariaLabel="Received up to"
                  onChange={(v) => onFilter("to", v)} />
              </>
            ) : null}
          </>
        }
        /* SORT IS NOT A FILTER, and sitting in the same row as ten of them said
           it was. The default is the empty value: unassigned first, then newest
           — the server's own order. It answers "what still needs doing": a lead
           nobody has been given, and the one somebody just typed and is looking
           for.

           FROM THE VOCABULARY, like every other control here. The keys are what
           the server's sorter implements — offering one it does not would be a
           menu entry that silently does nothing — and the first row is the
           default order, which is where the closed control gets its label. */
        right={
          <Select name="sort" label={"Sort: " + (SORT_OPTIONS[0]?.label || "")}
            value={p.sort} onFilter={onFilter}
            options={SORT_OPTIONS.slice(1).map((o) => ({ v: o.key, l: o.label }))} />
        }
        /* `from`/`to` are folded into the range chip — three chips for one date
           window reads as three filters, and removing one of them leaves a
           half-set range nobody asked for. `page` is in the URL like a filter
           but is not one: a chip reading "page: 2" invites somebody to clear it
           as if it were narrowing the results, and the pager already says where
           they are. */
        chips={
          <FilterChips
            params={{
              ...omit(p, ["sort", "tab", "page", "received", "from", "to"]),
              ...(p.received ? { received: receivedLabel(p) } : {}),
            }}
            onUnfilter={(k) => onUnfilter(k === "received" ? "received+from+to" : k)}
            labels={LABELS} />
        }
      />

      {page.counts ? <AttnStrip m={countsFromServer(page.counts)} p={p} /> : null}

      {page.error ? <Alert tone="bad" title="The queue did not load.">{page.error}</Alert> : null}

      {rows.length ? (
        <>
          <ListTable min="58rem" head={
            /* The two cells that carry sentences are given a width so the
               browser stops taking it from the identity column — a reference
               and a phone number wrapping mid-line is the one thing in this row
               nobody can read at a glance. */
            <tr>
              <th className="rail" />
              <th scope="col" className="w-72">Enquiry</th>
              <th scope="col">Category · location</th>
              <th scope="col">Urgency</th>
              <th scope="col">Status</th>
              <th scope="col" className="w-48">Last response</th>
              <th scope="col" className="n w-20">Received</th>
              <th scope="col" className="acts w-24"><span className="sr-only">Actions</span></th>
            </tr>
          }>
            {rows.map((e) => (
              <Row key={e.enquiryId} e={e} p={p} sel={sel} load={businessLoad(all)} />
            ))}
          </ListTable>

          <Pagination
            page={page.pageNo} pages={pages} total={total} pageSize={page.pageSize}
            shown={rows.length} unit={total === 1 ? "enquiry" : "enquiries"} alwaysCount
            onPage={onPage} />
        </>
      ) : (
        <EmptyState icon="inbox"
          title={filtered
            ? p.q
              ? <>Nothing matches “{p.q}”</>
              : "No enquiries match these filters"
            : "No enquiries yet"}
          body={filtered
            ? "Nothing in the queue matches " + activeFilters + " active filter"
              + (activeFilters === 1 ? "" : "s") + ". Clear one to widen the search."
            : "Enquiries arrive from funnel pages, the website and the portal — or you add one by hand for a call, a walk-in or a referral. However it arrives, it is qualified by a person before it can be matched."}
          action={filtered
            ? <Button color="secondary" ico="x" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</Button>
            : can("business-enquiries", "create")
              ? <Button color="primary" ico="plus" onClick={onCreate}>New enquiry</Button>
              : null} />
      )}

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
  if (last) {
    return (
      <span className="line-clamp-2 max-w-48 text-secondary" title={last.response || ""}>
        {last.response}
      </span>
    );
  }
  if (e.contactLog.length) {
    return (
      <span className="text-tertiary" title="Attempted, never reached">
        {e.contactLog.length} attempt{e.contactLog.length === 1 ? "" : "s"}, no response
        {everReached(e) ? "" : " yet"}
      </span>
    );
  }
  return <span className="text-warning-primary">Not contacted</span>;
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

function Row({ e, p, sel, load }: {
  e: Enquiry; p: Params; sel: string | null; load: Record<string, number>;
}) {
  const to = enquiryHash(e.enquiryId, p);
  const tone = attentionTone(e.status);
  const holder = assignedName(e);
  const held = holder ? load[holder] || 0 : 0;
  const terminal = statusOf(e.status).terminal;

  return (
    <tr
      className={"clickable" + (sel === e.enquiryId ? " on" : "")}
      data-go={to}
      onClick={() => go(to)}
    >
      <Rail tone={tone} title={tone ? statusOf(e.status).label : undefined} />

      <td className="cell-1">
        <div className="flex items-center gap-1.5">
          <span className={terminal ? "text-secondary" : undefined}>{e.customer.name}</span>
          <TierBadge tier={e.tier} />
        </div>
        {/* ONE LINE, NEVER TWO. A reference and a phone number are things people
            read character by character and copy whole; broken across a line
            they are neither. `whitespace-nowrap` is also what tells the table
            how wide this column has to be — without it the browser takes the
            space for the prose columns and wraps the identity instead. */}
        <div className="cell-2 font-mono whitespace-nowrap">
          {e.enquiryId} · {e.customer.phone}
        </div>
        {/* THE CHIP LINE: where it came from, then how the work is going.
            Provenance lost its own column — it is never sorted on, and that
            column was what pushed the row menu off the right edge at 1440 — so
            it rides here with the other chips instead. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <SourceChip source={e.source} />
          <TagChips tags={e.tags} max={3} />
            {/* THAT there are internal notes, never what they say. Somebody
                scanning the queue should know a colleague has already written
                something here before they pick it up — the text itself lives on
                the record and goes nowhere else. */}
          {e.remarks.length ? (
            <Pill xs tone="neutral" ico="note" text={String(e.remarks.length)}
              title={e.remarks.length + " internal remark" + (e.remarks.length === 1 ? "" : "s")} />
          ) : null}
        </div>
      </td>

      <td className="cell-1">
        <div>{e.requirement.category || <span className="text-quaternary">—</span>}</div>
        <div className="cell-2">{place(e)}</div>
      </td>

      <td><UrgencyChip urgency={e.qualification.urgency} /></td>

      {/* THE STATE, AND THE ONE FACT THAT STATE IMPLIES. The two are never both
          true: an enquiry still being qualified owes a checklist, and one that
          has been routed owes a business. So they share a line rather than each
          holding a column — and the column that went is what was pushing this
          row's menu off the right edge. Who is holding it is still a filter of
          its own, and the live figure is on the name. */}
      <td>
        <StatusPill status={e.status} />
        {isWorking(e.status) ? (
          <div className="mt-1 text-xs text-tertiary tnum">{4 - checklistMissing(e).length} of 4 confirmed</div>
        ) : holder ? (
          <div
            className="mt-1 flex items-center gap-1 text-xs text-tertiary"
            title={holder + " is holding " + held + " live enquir" + (held === 1 ? "y" : "ies")
              + " right now, across the whole queue — not just the rows in view."}
          >
            <Icon name="arrow" size="xs" className="shrink-0 text-fg-quaternary" />
            <span className="max-w-32 truncate">{holder}</span>
          </div>
        ) : null}
      </td>

      {/* THE COLUMN THAT MAKES THE QUEUE READABLE. Category and city are the
          same on half these rows; what the customer actually said is never the
          same, and it is what tells an operator which one to open. */}
      <td><LastResponseCell e={e} /></td>

      <td className="n"><AgeCell e={e} /></td>

      {/* The menu is inside a clickable row, so the press must stop here or
          every menu item would also open the record behind it. */}
      <td className="acts" onClick={(ev) => ev.stopPropagation()}>
        <RowMenu e={e} to={to} onOpen={go} />
      </td>
    </tr>
  );
}
