/* =============================================================================
   Finance — Salaries A/C ▸ Analytics. The wage bill over one calendar year.

   FOUR FIGURES AND THREE CHARTS. Nothing else.

   This page used to carry six blocks: a strip, two charts, a department chart,
   six decision metrics with year-on-year arrows, and a per-person walk behind a
   picker with a twelve-row table under it — plus an eight-column month table.
   It answered every question anybody could think of and was, in use, confusing:
   two wide tables of exact figures sat under charts of the same figures, so
   every number appeared twice in two shapes and a reader had to work out which
   one they were meant to be reading.

   THE TABLES WENT FIRST, and they went entirely. A table is the right form for
   records somebody acts on one at a time — which is exactly what the
   Transactions and Accounts tabs beside this one are, and they do it better,
   because a row there opens the slip that produced it. A table on an ANALYTICS
   tab is a chart whose shape nobody can see.

   What is left is three questions, one chart each:

     1  the year, month by month     what went out, and what has not
     2  by department                committed pay against earned pay
     3  by person                    the same split, everybody side by side

   The strip above them carries four totals, each with its formula behind an i.

   NO MONEY ARITHMETIC IN THIS FILE. Every amount arrives as integer paise from
   `payrollYear.ts` and is printed by `inr()`. The only division is the
   scale-for-display helper feeding the chart kit; it is named, and it is never
   printed as an amount.

   ONE CLOCK. Which months have started comes from `asOf` in module.json, so a
   screenshot taken next March still says the year ended in August 2026.
   ============================================================================= */
import type { ReactNode } from "react";
import { Block, Blocks } from "./Frame";
import { Unavailable } from "./bits";
import InfoTip, { PayrollMetricTip } from "./InfoTip";
import { ColumnChart } from "../charts";
import type { Series } from "../charts";
import { inr, pct } from "./store";
import type { Params } from "./store";
import {
  yearLabel, useDepartmentYear, useEmployeeTotals, useHeadcount, usePayrollYears, usePayrollYear,
} from "./payrollYear";
import type { PayrollYear } from "./payrollYear";

/* ------------------------------------------------------------ scaling --- */
/* The chart kit takes plain numbers and prints them with `toLocaleString`, so
   an axis fed integer paise would read 5,78,20,000. This converts FOR THE MARKS
   ONLY — no rupee figure on this page comes from it. The y-axis gutter is 38px
   and a tick reading 6,00,000 does not fit in it; every caption says so. */
const thousands = (paise: number) => Math.round(paise / 100000);

/* Fixed slot order, assigned once and never cycled, so a colour means one thing
   across all three charts: slot 1 is money committed or gone, slot 2 is money
   that had to be earned or has not left yet. */
const FLOW: Series[] = [
  { key: "paid", label: "Paid out", slot: 1 },
  { key: "unpaid", label: "Not yet paid", slot: 2 },
];
const MIX: Series[] = [
  { key: "fixed", label: "Base salary", slot: 1 },
  { key: "incentive", label: "Incentive", slot: 2 },
];

/* ============================================================== pieces === */

/** One headline figure, with its formula and its caution behind the i.
 *
 *  `value` is a node rather than an amount because one of the five is a COUNT
 *  of people. Formatting it as money would have been the easy way to keep the
 *  signature and a lie on the face of the tile. */
function Tile({ k, label, value, sub, tone }: {
  k: string; label: string; value: ReactNode; sub: ReactNode; tone?: string;
}) {
  return (
    <div className={"fin-mt " + (tone || "")}>
      <div className="k">{label}<PayrollMetricTip k={k} /></div>
      {value === null
        ? <p className="fin-na">No run has been opened in this year.</p>
        : <div className="v">{value}</div>}
      <div className="s">{sub}</div>
    </div>
  );
}

/** A dropdown for a choice that ALWAYS has a value.
 *
 *  Deliberately not the panel's `Select`, which carries a blank first option
 *  because it is built for FILTERS, where empty means "not filtering". Neither
 *  of these is a filter: a year is always some year and a grouping is always
 *  some grouping, so a blank option would be an entry that either does nothing
 *  or silently means "the default" — and both readings are worse than not
 *  offering it. Same `.selectbox` chrome, so it looks like every other dropdown
 *  in the panel; controlled rather than `defaultValue`, so it cannot drift from
 *  the URL that actually decides what is drawn. */
function Picker({ label, value, options, onPick }: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <span className="fin-picker">
      <span className="fin-picker-l">{label}</span>
      {/* PLAIN `.selectbox`, NOT `.on`. The `on` modifier tints the control with
          the brand and is the panel's "this filter is active" state — it means
          a filter is narrowing the list, and it is green so somebody can see at
          a glance which controls are doing that. Neither of these is a filter,
          so both would have been permanently green: a signal that never varies
          is not a signal, and it made two ordinary dropdowns look like applied
          filters somebody ought to clear. */}
      <span className="selectbox">
        <select aria-label={label} value={value} onChange={(e) => onPick(e.target.value)}>
          {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </span>
    </span>
  );
}

/** The year dropdown. It governs every figure on the page, so it belongs in the
 *  command row and not inside any one block. */
export function YearSwitch({ year, onPick }: { year: string; onPick: (year: string) => void }) {
  const years = usePayrollYears();
  /* One year is not a choice. A dropdown with a single option is a control that
     looks like it does something and does not. */
  if (years.length < 2) return <span className="fin-sum">Year <b>{yearLabel(year)}</b></span>;
  return (
    <Picker label="Year" value={year} onPick={onPick}
      options={years.map((y) => ({ v: y, l: yearLabel(y) }))} />
  );
}

/* =========================================================== the totals == */

/* THE PROSE THAT STOOD UNDER THIS BLOCK AND THE ONE BELOW IS GONE, and so is
   the banner above them. It was three paragraphs of caution laid out as card
   footers, which is the worst place for a rule: it is the widest text on the
   page, it wraps against nothing, and it is read once and then never again
   while the figures beside it are read every day. Every rule it carried is
   still here — behind the `i` on the tile or the chart it governs, which is
   where somebody actually asks the question. Nothing was deleted; it moved to
   where it is asked for. */
function Totals({ y, year }: { y: PayrollYear; year: string }) {
  const t = y.totals;
  const head = useHeadcount(year);
  return (
    <Block wide title={"The wage bill · " + yearLabel(y.year)}
      right={<span className="fin-sum">
        {t.monthsRun} of 12 month{t.monthsRun === 1 ? "" : "s"} run
      </span>}>
      <div className="fin-money-strip">
        {/* THE ONE FIGURE THAT MOVES WHEN AN ACCOUNT IS OPENED, and it leads for
            that reason. Everything after it is derived from SLIPS, so adding
            somebody to the payroll changes none of them until a run is opened
            and paid — correct for money, and no feedback at all for the person
            who just added them. */}
        <Tile k="payroll_headcount" label="On the payroll"
          value={<span className="tnum">{head.active}</span>}
          sub={head.openedInYear
            ? head.openedInYear + " opened in " + yearLabel(year) + " · " + inr(head.monthlyPaise) + " a month"
            : inr(head.monthlyPaise) + " a month, committed"} />
        <Tile k="payroll_cost" label="Payroll, the year"
          value={t.monthsRun ? inr(t.grossPaise) : null}
          sub={t.peopleEver + " " + (t.peopleEver === 1 ? "person" : "people") + " across the year"} />
        <Tile k="payroll_paid" label="Paid out" value={t.monthsRun ? inr(t.paidPaise) : null}
          tone={t.paidPaise ? "ok" : ""}
          sub={"net, after " + inr(t.deductionsPaise) + " of deductions"} />
        <Tile k="payroll_owed" label="Still owed"
          value={t.monthsRun ? inr(t.unpaidPaise + t.heldPaise) : null}
          tone={t.unpaidPaise + t.heldPaise ? "warn" : "mute"}
          sub={t.unpaidPaise + t.heldPaise
            ? (t.heldPaise ? inr(t.heldPaise) + " of it held" : "issued and not yet paid")
            : "everybody is paid up"} />
        <Tile k="payroll_incentive" label="Incentives"
          value={t.monthsRun ? inr(t.incentivePaise) : null}
          sub={t.grossPaise
            ? pct(Math.round((t.incentivePaise / t.grossPaise) * 1000) / 10) + " of the wage bill"
            : "nothing earned yet"} />
      </div>
    </Block>
  );
}

/* ========================================================== the chart === */

/** ONE CHART, THREE GROUPINGS.
 *
 *  It was three blocks stacked — the year, then departments, then people —
 *  and they could not be merged into one axis, which is worth stating because
 *  it is the reason this is a switch and not a wider chart: a month, a
 *  department and a person are three different ways of cutting the SAME
 *  rupees, so putting them side by side on one axis would count every rupee
 *  three times and draw a total that means nothing.
 *
 *  What they can share is one block and one frame. The switch says which cut
 *  is on screen; the legend and the caption follow it.
 *
 *  THE SERIES FOLLOW THE GROUPING, and that is deliberate rather than sloppy.
 *  Paid against not-yet-paid is a question only a MONTH can answer — a
 *  department does not have a due date — and it is a NET figure, where the
 *  committed-against-earned split is a division of GROSS. Forcing one pair of
 *  series across all three would have meant either dropping the paid/unpaid
 *  reading entirely or drawing a net bar beside a gross one, and the second is
 *  the kind of chart whose column heights quietly mean nothing. The legend
 *  sits directly above the marks and changes with them, so at no point are two
 *  different meanings on screen at once. */

/* `member` rather than `person`, which is what it was: the account this chart
   counts belongs to a TEAM MEMBER, and that is the word the rest of the panel
   uses for them. */
const GROUPINGS = [
  { v: "month", l: "By month" },
  { v: "department", l: "By department" },
  { v: "member", l: "By member" },
];

function Chart({ year, by, onPick }: {
  year: string; by: string; onPick: (k: string) => void;
}) {
  const y = usePayrollYear(year);
  const dept = useDepartmentYear(year);
  const people = useEmployeeTotals(year);

  const isMonth = by === "month";
  const series = isMonth ? FLOW : MIX;

  const points = isMonth
    ? y.months.map((m) => ({
      key: m.month,
      label: m.label,
      values: {
        paid: thousands(m.paidPaise),
        unpaid: thousands(m.unpaidPaise + m.heldPaise),
      },
    }))
    : by === "department"
      ? dept.map((r) => ({
        key: r.department,
        label: r.department,
        values: { fixed: thousands(r.fixedPaise), incentive: thousands(r.incentivePaise) },
      }))
      : people.map((r) => ({
        key: r.salaryAccountId,
        label: r.shortName,
        values: { fixed: thousands(r.fixedPaise), incentive: thousands(r.incentivePaise) },
      }));

  /* Empty for a real reason, and the reason differs by grouping. */
  const empty = isMonth
    ? !y.months.some((m) => m.hasRun)
    : points.length === 0;

  /* THE CAUTIONS THAT WERE A CARD FOOTER, behind the i on the title instead.
     They are real rules and none of them was dropped — but a paragraph under a
     chart is read once, and a rule about what a chart means has to be readable
     at the moment somebody doubts it. */
  const tip = (
    <InfoTip label={"the " + by + " view"}
      intro={isMonth
        ? <>Net <b>paid</b> against net <b>not yet paid</b>, per month.</>
        : <>Gross <b>base salary</b> against <b>incentive</b> earned, before deductions.</>}
      rows={[
        { label: "Window", hint: "January to December — the calendar year, NOT the April-to-March "
          + "one the books, TDS and PF close on, so a total here will not match a filed return." },
        isMonth
          ? { label: "Why two bars", hint: "Paid and not-yet-paid partition each month exactly: "
            + "every slip is in one and none is in both, so the pair reads against one baseline "
            + "without double-counting." }
          : { label: "Why two bars", hint: "They are halves of one gross figure, so something "
            + "almost all base pay and something a fifth incentive are different SHAPES rather "
            + "than two similar totals." },
        { label: "Grouped, not stacked", hint: isMonth
          ? "What a month still owes is not part of what it cost, and a stack would claim it was."
          : "The question is the ratio between the two, and a stack makes a ratio the hardest "
            + "thing on the chart to see." },
        isMonth
          ? { label: "Empty columns", hint: "Months that have not happened stay on the chart. A "
            + "run nobody opened and a month nobody was paid look identical once a chart omits "
            + "them. A held slip counts as not yet paid here; why it is held is on the slip." }
          : { label: "Paid slips only", hint: "A slip nobody has paid is a commitment rather than "
            + "a cost. A fixed monthly Performance allowance is committed pay under a hopeful "
            + "name and is counted on the left, where it belongs." },
        { label: "Three cuts, one set of rupees", hint: "A month, a department and a person are "
          + "three ways of cutting the same money, so they cannot share an axis — side by side "
          + "every rupee would be counted three times." },
      ]} />
  );

  const right = (
    <span className="fin-groupby">
      <Picker label="Group by" value={by} options={GROUPINGS} onPick={onPick} />
    </span>
  );

  return (
    <Block wide title={<>Payroll · {yearLabel(year)}{tip}</>} right={right}>
      {empty ? (
        <Unavailable
          title={isMonth
            ? "No run has been opened in " + yearLabel(year) + "."
            : "Nobody was paid in " + yearLabel(year) + "."}
          why={isMonth
            ? "This year is built from the salary runs themselves, not from a calendar. It fills in the moment a run is opened for one of its months."
            : "This sums the PAID slips of the year. It appears with the first paid run."} />
      ) : (
        <ColumnChart series={series} points={points}
          labelSeries={isMonth ? "paid" : "fixed"}
          unit={"₹ thousand · " + yearLabel(year) + " · "
            + (isMonth ? "net paid against net owed" : "gross, before deductions")
            + " · hover or tab a column for both figures"} />
      )}
    </Block>
  );
}
/* ============================================================== face ==== */

/** Guards `?by=` off the URL: an unknown grouping falls back to the month view
 *  rather than rendering a chart with no points and an empty-state that would
 *  claim nobody had been paid. */
const resolveBy = (raw: string | undefined): string =>
  (raw && GROUPINGS.some((g) => g.v === raw) ? raw : "month");

export default function Payroll({ year, p, onParams }: {
  year: string; p: Params; onParams: (patch: Params) => void;
}) {
  const y = usePayrollYear(year);
  const by = resolveBy(p.by);
  return (
    /* THE BANNER THAT STOOD HERE IS GONE. It was a six-line standing notice above
       every reading of this page, and a caution that appears whether or not
       anybody is asking is a caution people learn to look past — which is worse
       than not having written it, because it feels like it was communicated.
       Its one load-bearing sentence — that this is the calendar year and a total
       here will NOT match a filed return — is now the first row behind the i on
       the chart, next to the figures it qualifies. */
    <Blocks>
      <Totals y={y} year={year} />
      <Chart year={year} by={by} onPick={(k) => onParams({ by: k === "month" ? undefined : k })} />
    </Blocks>
  );
}
