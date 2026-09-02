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
import type { ReactNode } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, FilterChips, Icon, SearchField, Select } from "../../ui";
import { go } from "../../ui/nav";
import { Frame, ViewBand } from "./Frame";
import type { FaceProps } from "./Frame";
import { InstStrip, Money, SourceTag, SubPill } from "./bits";
import InfoTip, { MetricTip } from "./InfoTip";
import { RecordSubModal } from "./SubModals";
import SubAnalytics from "./SubAnalytics";
import {
  FILTER_LABELS, PERIOD, SUB_SOURCES, SUB_STATUSES,
  applySubFilters, filterValueLabel, fmtDate, inr, useOverview, useSubRows,
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

  /* A queue tile toggles: pressing the filter it already applied clears it,
     because the only other way back is to hunt for the chip. */
  const queue = (flag: string) => () => onFilter("flag", p.flag === flag ? "" : flag);
  const queueLabel = (flag: string) => (p.flag === flag ? "clear this filter" : "show only these");

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
            page: undefined,
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
        <span className="spacer" />
        {writable
          ? <button className="btn pri" onClick={onRecord}>
              <Icon name="plus" size="sm" />Record a subscription
            </button>
          : null}
      </>}
      bands={tab === "analytics" ? null : <>
        {/* THE MONEY STRIP READS OUT; IT DOES NOT ASSERT. Each tile carries the
            metric's own definition behind the i button, so the figure means the
            same thing here as it does on Analytics six months from now. The two
            queue tiles carry their own filter link rather than becoming buttons
            themselves — a tile with an i button inside it cannot also be one
            big click target without swallowing the i. */}
        <div className="fin-money-strip">
          {/* WHAT CAME IN, AND WHO IS STILL PAYING — one tile, two numbers,
              kept visibly apart because they are not the same KIND of number.
              The money is a period sum: everything collected in August, some
              of it from subscriptions that have since completed, defaulted or
              been refunded. The count is a level read right now. Run them
              together and the tile quietly claims these four produced that
              figure, which is not true of any month. */}
          <MTile tone="ok" pair on={p.flag === "settled"}
            label={<>Collected · {PERIOD.label}<MetricTip k="collected" /></>}
            value={inr(o.collectedPaise)}
            aside={<>
              <b className="tnum">{activeN}</b> active
              <InfoTip label="Active subscriptions"
                intro={<>Subscriptions running right now — <b>a level, read at this moment</b>, not a total for the period.</>}
                rows={[
                  { label: "Counts", hint: "every subscription still being served: paid up front or still paying." },
                  { label: "Excludes", hint: "completed, cancelled, refunded — and defaulting, which leaves the moment an installment fails." },
                  { label: "Caution", hint: "it does not explain the figure beside it. Money collected this month includes subscriptions that are no longer active." },
                ]} />
            </>}
            sub={o.collectedN + " installment" + (o.collectedN === 1 ? "" : "s") + " settled"}
            action={rows.some((r) => r.paidN > 0)
              ? <button className="lnk" onClick={queue("settled")}>{queueLabel("settled")}</button>
              : null} />

          <MTile tone="mute" on={p.flag === "due"}
            label={<>Due in the next 30 days<MetricTip k="due_next" /></>}
            value={inr(o.dueNextPaise)}
            sub={o.dueNextN + " installment" + (o.dueNextN === 1 ? "" : "s") + " · expected"}
            action={rows.some((r) => !!r.dueNext)
              ? <button className="lnk" onClick={queue("due")}>{queueLabel("due")}</button>
              : null} />

          {/* LAST, and last on purpose: it is the one a person acts on, so it
              ends the strip rather than interrupting it. */}
          <MTile tone={o.failedN ? "bad" : "mute"} on={p.flag === "failed"}
            label={<>Fail to pay<MetricTip k="failed" /></>}
            value={<>{inr(o.failedPaise)} <span className="fin-count">· {o.failedN}</span></>}
            sub={o.failedN
              ? o.failedN + " installment" + (o.failedN === 1 ? "" : "s") + " did not clear, each with its evidence on the record"
              : "every installment that fell due has cleared"}
            action={o.failedN
              ? <button className="lnk" onClick={queue("failed")}>{queueLabel("failed")}</button>
              : null} />
        </div>

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

/** One money read-out. A div, not a button: the i button and the filter link
 *  both live inside it, and nesting either inside a clickable tile would make
 *  the tile's own click target a guess. */
/** A money tile. `aside` is a SECOND figure of a different kind sitting
 *  beside the first — same tile, its own baseline and its own weight, so a
 *  reader cannot take it for part of the headline number. */
function MTile({ label, value, sub, tone, on, action, aside, pair }: {
  label: ReactNode; value: ReactNode; sub: ReactNode; tone?: string; on?: boolean;
  action?: ReactNode; aside?: ReactNode; pair?: boolean;
}) {
  return (
    <div className={"fin-mt" + (tone ? " " + tone : "") + (on ? " on" : "") + (pair ? " pair" : "")}>
      <span className="k">{label}</span>
      <span className="v">{value}{aside ? <span className="fin-mt-aside">{aside}</span> : null}</span>
      <span className="s">{sub}{action ? <> · {action}</> : null}</span>
    </div>
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
