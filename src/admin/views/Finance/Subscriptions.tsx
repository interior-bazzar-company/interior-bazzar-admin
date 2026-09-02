/* =============================================================================
   Finance · Subscriptions — sales that happened, paid in installments.
   -----------------------------------------------------------------------------
   This is not a pipeline and it is not a forecast. Every row is a sale that was
   closed — by the sales team against a deal, or by the customer themselves on
   the website — and the money against it arrives one installment at a time.

   THE INSTALLMENT IS THE UNIT. The subscription is what was agreed; the
   installment is what gets paid, invoiced, receipted and, when it does not
   clear, recorded as FAIL TO PAY. So the table gives the whole schedule its own
   column rather than a progress bar: five cells you can read at a glance beat a
   percentage nobody can act on.

   NOTHING HERE IS AWAITING VERIFICATION. `Due` is the absence of an event —
   nothing has happened to that installment yet. `Fail to pay` is the presence
   of one: a decline, a cancelled mandate, or a due date that demonstrably
   passed, and the record carries the evidence. There is no third state meaning
   "recorded but not yet believed", here or at the API.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, FilterChips, Icon, SearchField, Select, StatStrip } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame, ViewBand } from "./Frame";
import type { FaceProps } from "./Frame";
import { InstStrip, Money, SourceTag, SubPill } from "./bits";
import { RecordSubModal } from "./SubModals";
import SubAnalytics from "./SubAnalytics";
import {
  FILTER_LABELS, PERIOD, SUB_SOURCES, SUB_STATUSES,
  applySubFilters, filterValueLabel, fmtDate, inr, startedOptions, useOverview, useSubRows,
} from "./store";
import type { Params, SubRow } from "./store";

export default function Subscriptions({ p, onFilter, onSearch, onUnfilter, onParams }: FaceProps) {
  const { toast, modal, closeLayer } = useShell();
  const rows = useSubRows();
  const o = useOverview();
  const shown = applySubFilters(rows, p);
  const writable = can("finance", "edit");

  /* TWO READINGS OF ONE BOOK OF SALES: the RECORDS, which somebody acts on one
     at a time, and what they add up to. The band is a sub-switch and not a
     section — Subscriptions is one sidebar row, and both tabs are it.

     SUBSCRIPTIONS IS THE LANDING TAB: the grain of daily work here is "where
     is every sale and what is failing", and Analytics is one press away
     carrying ?tab=analytics. It reads the subscriptions and nothing else, so
     it belongs beside the records it derives from — the same move Salaries
     A/C made with payroll. */
  const tab = p.tab === "analytics" ? "analytics" : "subscriptions";

  /* `view` is the record type you are looking at and `page` is a position in a
     list. Neither narrows anything, so neither counts as a filter — a chip
     reading "view: subscriptions" invites somebody to clear the screen. */
  const narrowed = Object.keys(p).some((k) => p[k] && ["view", "page", "tab"].indexOf(k) < 0);

  const activeN = rows.filter((r) => r.s.status === "active").length;

  /* A queue cell TOGGLES: pressing the filter it already applied clears it,
     because the only other way back is to hunt for the chip. The strip
     navigates rather than calling back — every cell in every strip in this
     panel is a link, so the address bar always says what is on screen. */
  const queueHash = (flag: string) => {
    const o: Record<string, string> = {};
    Object.keys(p).forEach((k) => { if (p[k] && ["flag", "page", "tab"].indexOf(k) < 0) o[k] = p[k] as string; });
    if (p.flag !== flag) o.flag = flag;
    const q = Object.keys(o)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(o[k])).join("&");
    return "#/finance" + (q ? "?" + q : "");
  };

  const onRecord = () => modal(
    <RecordSubModal onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide");

  return (
    <Frame toast={toast}
      tabs={
        <ViewBand cur={tab}
          items={[
            { k: "subscriptions", label: "Subscriptions", icon: "coin", n: rows.length },
            /* NO COUNT ON ANALYTICS. The badge beside Subscriptions says how
               many records are behind the tab; what is behind this one is
               every one of them read four ways, and a number there would
               invite somebody to read it as a fifth. */
            { k: "analytics", label: "Analytics", icon: "chart" },
          ]}
          onPick={(k) => onParams({
            tab: k === "subscriptions" ? undefined : k,
            /* The filters belong to the list. Carrying one onto a tab that
               shows no filter control would narrow a page with something
               nobody can see or clear. */
            q: undefined, source: undefined, status: undefined, flag: undefined, plan: undefined,
            started: undefined, page: undefined,
          })} />
      }
      cmd={tab === "analytics" ? <>
        {/* NO FILTERS ON THIS TAB, and that is the rule rather than an
            omission: a chart narrowed by a search box is a chart whose total
            no longer matches its own caption. The scope is stated instead. */}
        <span className="fin-sum">
          Every subscription ever recorded · all time, not {PERIOD.label}
        </span>
        <span className="spacer" />
      </> : <>
        {/* KEYED ON THEIR VALUE. SearchField and Select are uncontrolled, so
            clearing a chip otherwise left the old text in the box. */}
        <SearchField key={"q" + (p.q || "")} val={p.q} onFilter={onSearch}
          ph="Customer, subscription ID, deal, plan, UTR or invoice number…" />
        <Select key={"source" + (p.source || "")} name="source" label="Source" value={p.source}
          onFilter={onFilter} options={SUB_SOURCES.map((s) => ({ v: s.key, l: s.label }))} />
        <Select key={"status" + (p.status || "")} name="status" label="Status" value={p.status}
          onFilter={onFilter} options={SUB_STATUSES.map((s) => ({ v: s.key, l: s.label }))} />
        <Select key={"flag" + (p.flag || "")} name="flag" label="Queue" value={p.flag}
          onFilter={onFilter} options={[
            { v: "failed", l: "Has a failed installment" },
            { v: "due", l: "Has something still to pay" },
          ]} />
        {/* WHEN IT STARTED — one filter, three grains. The dropdown carries the
            years and their months, read off the records themselves so it can
            never offer a month nothing was sold in; the date box beside it
            names one day. Both write the same `started` param, because they
            are two ways of saying one thing and two params would be two
            filters that could contradict each other. */}
        <Select key={"started" + (p.started || "")} name="started" label="Started"
          value={/^\d{4}(-\d{2})?$/.test(p.started || "") ? p.started : ""}
          onFilter={onFilter} options={startedOptions(rows)} />
        <DayPick
          value={/^\d{4}-\d{2}-\d{2}$/.test(p.started || "") ? (p.started as string) : ""}
          onPick={(v) => onFilter("started", v)} />
        <span className="spacer" />
        {writable
          ? <button className="btn pri" onClick={onRecord}>
              <Icon name="plus" size="sm" />Record a subscription
            </button>
          : null}
      </>}
      bands={tab === "analytics" ? null : <>
        {/* THE STRIP EVERY LIST IN THIS PANEL CARRIES: a count, its label, the
            money it stands for — one row, each cell a filter. It replaced three
            tiles that said the same three things at four times the height and
            matched no other list in the module.

            THE CELL IS THE FILTER now, which is what cost the i buttons: a
            tile could carry an `i` beside its label because it was a div, and
            a cell is a button — an i inside it would swallow half its own
            click target. The definitions moved to `tip`, the strip's own
            description channel, which is how Salaries A/C carries the same
            cautions on the same control.

            EACH CELL IS ONE PERIOD, deliberately unlike the topbar above it,
            which is all time. The label says which. */}
        <StatStrip cells={([
          { k: <>Collected · {PERIOD.label} <b className="tnum">{inr(o.collectedPaise)}</b></>,
            v: o.collectedN, dot: "ok", on: p.flag === "settled",
            to: rows.some((r) => r.paidN > 0) ? queueHash("settled") : undefined,
            tip: <>Installments settled in {PERIOD.label} and what they came to.
              Money that <b>actually arrived</b> — some of it from subscriptions that have since
              completed, defaulted or been refunded, so it does not describe the {activeN} running
              right now.</> },
          "sep",
          { k: <>Expected installments <b className="tnum">{inr(o.dueNextPaise)}</b></>,
            v: o.dueNextN, on: p.flag === "due",
            to: rows.some((r) => !!r.dueNext) ? queueHash("due") : undefined,
            tip: <>Due in the next 30 days: the one installment genuinely in front of each customer.
              <b> Expected, not earned</b> — every one is a row that already exists, and none of it
              is revenue until it is collected.</> },
          /* LAST, and last on purpose: it is the one a person acts on, so it
             ends the strip rather than interrupting it. */
          { k: <>Fail to pay <b className="tnum">{inr(o.failedPaise)}</b></>,
            v: o.failedN, dot: o.failedN ? "bad" : "", on: p.flag === "failed",
            to: o.failedN ? queueHash("failed") : undefined,
            tip: o.failedN
              ? <>Installments that <b>did not clear</b> — a decline, a cancelled mandate, or a due
                date that demonstrably passed. Each carries its evidence on the record; none of it
                is written off.</>
              : <>Every installment that fell due has cleared.</> },
        ] as (StatCell | "sep")[])} />

        {/* `.dls-chips` supplies the page gutter and cancels the chiprow's own
            negative margin, so the chips line up with the row above. */}
        <div className="dls-chips">
          <FilterChips
            params={Object.keys(p)
              .filter((k) => ["view", "page", "tab"].indexOf(k) < 0 && p[k])
              .reduce((acc, k) => { acc[k] = filterValueLabel(k, p[k] as string); return acc; },
                {} as Record<string, string>)}
            labels={FILTER_LABELS}
            onUnfilter={onUnfilter} />
        </div>
      </>}>

      {tab === "analytics" ? (
        /* The strip's queues cross back to the records with that filter
           applied — the charts are never narrowed, so "show only these" goes
           where narrowing means something. */
        <SubAnalytics onQueue={(flag) => onParams({ tab: undefined, flag })} />
      ) : shown.length ? (
        <table className="tbl dls-tbl fin-tbl">
          <thead>
            <tr>
              <th className="rail" />
              <th>Subscription</th>
              <th>Plan</th>
              <th className="num">Total</th>
              <th>Schedule</th>
              <th>What is next</th>
              <th>Source</th>
              <th>Status</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => <Row key={r.s.subscriptionId} r={r} p={p} />)}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={narrowed ? "search" : "cash"}
          title={narrowed ? "Nothing matches those filters" : "No subscription has been recorded yet"}
          body={narrowed
            ? <>The money strip above counts every subscription in the module, before any filter.
                {p.flag === "failed"
                  ? " Nothing is failing right now, which is the result this queue exists to show."
                  : ""}</>
            : <>A row lands here the moment a sale is recorded: the sales team closes a deal and
                records the payment against its invoice, or a customer buys on the website and the
                gateway credit is recorded against the schedule. Nothing arrives on its own, and
                nothing here is a forecast — a row exists because a sale happened.</>}
          action={narrowed
            ? <button className="btn" onClick={() => onUnfilter("*")}>Clear all filters</button>
            : writable
              ? <button className="btn pri" onClick={onRecord}>
                  <Icon name="plus" size="sm" />Record a subscription
                </button>
              : null} />
      )}
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */

/** THE EXACT-DAY HALF OF THE STARTED FILTER.
 *
 *  A bare `<input type="date">` prints `dd-mm-yyyy` at rest: a placeholder
 *  pretending to be a value, and the widest thing in a command row of
 *  dropdowns that each say one word. So this is a calendar icon until a day
 *  is picked and the day itself once one is, with an ✕ to let go of it.
 *
 *  THE NATIVE INPUT IS STILL THE CONTROL — laid transparent over the icon
 *  rather than replaced by a calendar of our own. The platform's picker, its
 *  keyboard handling, its locale and its accessibility come free, and none of
 *  its chrome is on screen. A hand-rolled month grid would be a second date
 *  picker in a panel that would then have two. */
function DayPick({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const on = !!value;
  return (
    <span className={"fin-datepick" + (on ? " on" : "")}
      title={on ? "Started on " + fmtDate(value) : "Started on one exact day"}>
      <label className="hit">
        <Icon name="calendar" size="sm" />
        {on ? <span className="d">{fmtDate(value)}</span> : null}
        <input type="date" value={value} aria-label="Started on one exact day"
          onChange={(e) => onPick(e.target.value)} />
      </label>
      {on ? (
        <button type="button" className="x" aria-label="Clear the day"
          onClick={() => onPick("")}>
          <Icon name="x" size="sm" />
        </button>
      ) : null}
    </span>
  );
}

/** "due in 4 days" / "6 days overdue". One fragment, and it never says late
 *  about a date that has not passed. */
function dueWords(days: number): { text: string; tone: string } {
  if (days < 0) return { text: Math.abs(days) + (days === -1 ? " day" : " days") + " overdue", tone: "bad" };
  if (days === 0) return { text: "due today", tone: "warn" };
  if (days <= 7) return { text: "due in " + days + (days === 1 ? " day" : " days"), tone: "warn" };
  return { text: "due in " + days + " days", tone: "" };
}

function Row({ r, p }: { r: SubRow; p: Params }) {
  const s = r.s;
  /* The rail has two states, not one per status: something failed, or nothing
     did. A colour per status turns the table into a paint chart. */
  const rail = r.needsAttention ? "bad" : s.status === "cancelled" || s.status === "refunded" ? "warn" : "";

  /* THE WHOLE LIST STATE TRAVELS WITH THE LINK, so the record's Back button is
     a return and not a reset. */
  const carried = Object.keys(p)
    .filter((k) => p[k] && ["tab", "inst"].indexOf(k) < 0)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
    .join("&");
  const to = "#/finance/" + encodeURIComponent(s.subscriptionId) + (carried ? "?" + carried : "");

  const next = r.next;
  const words = next && r.nextDueInDays !== null ? dueWords(r.nextDueInDays) : null;

  return (
    <tr className={"clickable" + (s.status === "cancelled" ? " dim" : "")}
      tabIndex={0} role="link" aria-label={"Open " + s.subscriptionId + " · " + s.customer.name}
      onClick={() => go(to)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
      <td className="rail"><i className={rail} /></td>
      <td>
        <div className="cell-1">{s.customer.name}</div>
        <div className="cell-2">
          <span className="mono">{s.subscriptionId}</span>
        </div>
      </td>
      <td>
        <div className="cell-1">{s.planName}</div>
        <div className="cell-2">{s.cycleMonths} months · from {fmtDate(s.startDate)}</div>
      </td>
      <td className="num">
        <div className="cell-1"><Money paise={s.totalPaise} /></div>
        <div className="cell-2">{inr(r.paidPaise)} collected</div>
      </td>
      <td>
        {/* One cell per installment, in order, coloured by what happened to it.
            A bar reading "60%" would hide which two failed. */}
        <InstStrip items={s.installments.map((i) => ({
          seq: i.seq, status: i.status,
          label: "Installment " + i.seq + " of " + i.of + " · " + inr(i.amountPaise) + " · due " + fmtDate(i.dueDate),
        }))} />
        <div className="cell-2">{r.paidN} of {s.installments.length} paid</div>
      </td>
      <td>
        {next && words ? (
          <>
            <div className="cell-1"><Money paise={next.amountPaise} /></div>
            <div className={"cell-2 fin-late" + (words.tone ? " " + words.tone : "")}>
              {next.status === "fail_to_pay" ? "failed · " : ""}{words.text}
            </div>
          </>
        ) : (
          <span className="faint">nothing outstanding</span>
        )}
      </td>
      <td><SourceTag k={s.source} /></td>
      <td><SubPill k={s.status} /></td>
      <td className="tight"><Icon name="chevr" size="sm" /></td>
    </tr>
  );
}
