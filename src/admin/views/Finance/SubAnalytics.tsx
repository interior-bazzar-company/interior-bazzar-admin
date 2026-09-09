/* =============================================================================
   Finance · Subscriptions ▸ Analytics. The sales read back as four figures and
   four charts, over one year or over all of them.

   IT SITS BESIDE THE RECORDS IT DERIVES FROM, the same move Salaries A/C made
   when payroll analytics stopped living one page away. Somebody asking "which
   plan is actually selling" got there from this page; having to leave it to
   ask was the whole friction.

   THE YEAR IS THE SCOPE, and it is the year a subscription STARTED in — the
   same date the list's own filter narrows on, so "2026" means one thing on
   both tabs. Every figure and every chart on the page follows it, including
   when the money arrived: a sale made in 2026 keeps its collections in this
   year's reading even if an installment lands in January. Scoping the money
   by its value date instead would put two different meanings of "2026" on one
   page.

   THE CAPTIONS ARE GONE. Every block carried a paragraph under it explaining
   the chart above; they were the widest text on the page, read once and never
   again, and the rule each one carried is either in the title, behind the `i`
   on the figure it governs, or was never load-bearing. What is left is a
   title, the marks, and the axis unit.

   NO MONEY ARITHMETIC. Every amount arrives as integer paise from the store's
   own `SubRow` fields and is printed by `inr()`. The one division is the
   display scaler feeding the chart kit, it is named `thousands`, and nothing
   it returns is ever printed as an amount.

   ONE CUT PER CHART. A month, a plan, a source and an installment state are
   four different ways of cutting the same rupees, so they never share an axis
   — putting them side by side would count every rupee four times and draw a
   total that means nothing.
   ============================================================================= */
import { Button, ChartFrame, Tiles } from "../../ui";
import type { TileProps } from "../../ui";
import { Blocks } from "./Frame";
import { Unavailable } from "./bits";
import InfoTip from "./InfoTip";
import { BarRows, ColumnChart } from "../charts";
import type { BarRow, Series } from "../charts";
import { SUB_SOURCES, fmtMonth, inr, useSubRows } from "./store";

/* The chart kit takes plain numbers and prints them with `toLocaleString`, so
   an axis fed integer paise would read 6,77,320. This converts FOR THE MARKS
   ONLY — every rupee figure on this page comes from `inr()` on the paise. */
const thousands = (paise: number) => Math.round(paise / 100000);

/* One series, so the kit draws no legend and the block title names it. Slot 1
   is money that arrived, here and everywhere else in the panel. */
const COLLECTED: Series[] = [{ key: "collected", label: "Collected", slot: 1 }];

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);

/* ================================================================ page === */

export default function SubAnalytics({ year, onQueue }: {
  /** `""` is every year. Otherwise the calendar year a subscription STARTED
   *  in — the same date the list filters on, so the word means one thing on
   *  both tabs. */
  year: string;
  /** Cross to the Subscriptions tab with one of the strip's queues applied.
   *  Narrowing belongs to the records, never to the charts. */
  onQueue: (flag: string) => void;
}) {
  const all = useSubRows();
  const rows = year ? all.filter((r) => r.s.startDate.slice(0, 4) === year) : all;

  /* COLLECTED BY MONTH, off the payments of these subscriptions rather than
     off the module's own month series — the rest of the page is scoped to a
     year of sales, and a chart reading a different set of payments would put
     a total under this title that none of the figures above it agree with.
     A month is the VALUE DATE's month: when the money reached the account. */
  const byMonth = new Map<string, number>();
  rows.forEach((r) => r.s.installments.forEach((i) => {
    if (i.status !== "paid" || !i.payment) return;
    const m = i.payment.valueDate.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) || 0) + i.payment.amountPaise);
  }));
  const months = Array.from(byMonth.entries())
    .filter(([, paise]) => paise > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, paise]) => ({ month, paise }));

  /* THE FOUR FIGURES, summed off the store's own per-subscription fields so
     this tab and the list beside it cannot disagree about what "collected"
     means. */
  const collectedPaise = rows.reduce((n, r) => n + r.paidPaise, 0);
  const duePaise = rows.reduce((n, r) => n + r.duePaise, 0);
  const failedPaise = rows.reduce((n, r) => n + r.failedPaise, 0);
  const collectedN = rows.reduce((n, r) => n + r.paidN, 0);
  const dueN = rows.reduce((n, r) => n + r.dueN, 0);
  const failedN = rows.reduce((n, r) => n + r.failedN, 0);
  const activeN = rows.filter((r) => r.s.status === "active").length;
  const agreedPaise = rows.reduce((n, r) => n + r.s.totalPaise, 0);

  /* BY PLAN. Grouped on the plan's own id rather than its printed name: two
     plans can be renamed into the same words, and an id cannot. */
  const plans = new Map<string, { label: string; paise: number; subs: number }>();
  rows.forEach((r) => {
    const cur = plans.get(r.s.planId) || { label: r.s.planName, paise: 0, subs: 0 };
    cur.paise += r.paidPaise;
    cur.subs += 1;
    plans.set(r.s.planId, cur);
  });
  const planRows: BarRow[] = Array.from(plans.entries())
    .sort((a, b) => b[1].paise - a[1].paise || a[1].label.localeCompare(b[1].label))
    .map(([key, v]) => ({
      key, label: v.label, value: thousands(v.paise),
      hint: <>{inr(v.paise)} · {plural(v.subs, "sale", "sales")}</>,
      title: v.label + " · " + inr(v.paise) + " collected across " + plural(v.subs, "sale", "sales"),
    }));

  /* WHERE THE SALE CAME FROM. The count leads because that is what the split
     is about — how business arrives — and the money rides as the hint, which
     is a label and never a second axis. */
  const sourceRows: BarRow[] = SUB_SOURCES
    .map((src: { key: string; label: string }) => {
      const mine = rows.filter((r) => r.s.source === src.key);
      return {
        key: src.key, label: src.label, value: mine.length,
        hint: <>{inr(mine.reduce((n, r) => n + r.paidPaise, 0))} collected</>,
        title: plural(mine.length, "subscription", "subscriptions") + " recorded as " + src.label,
      };
    })
    .filter((r) => r.value > 0);

  /* EVERY INSTALLMENT, BY STATE. Counted off the installments themselves so
     cancelled rows are visible rather than quietly missing from a total, and
     wearing the module's own state colours: paid is ok, failed is bad, due
     and cancelled are neutral — `due` is the ABSENCE of an event, and
     painting it as a warning would say something happened that has not. */
  const instRows: BarRow[] = (() => {
    const every = rows.flatMap((r) => r.s.installments);
    const of = (st: string) => every.filter((i) => i.status === st);
    return [
      { key: "paid", label: "Paid", tone: "st-ok", n: of("paid").length },
      { key: "due", label: "Due", tone: "st-mute", n: of("due").length },
      { key: "fail_to_pay", label: "Fail to pay", tone: "st-bad", n: of("fail_to_pay").length },
      { key: "cancelled", label: "Cancelled", tone: "st-mute", n: of("cancelled").length },
    ]
      .filter((r) => r.n > 0)
      .map((r) => ({
        key: r.key, label: r.label, value: r.n, tone: r.tone,
        hint: <>{inr(every.filter((i) => i.status === r.key)
          .reduce((n, i) => n + i.amountPaise, 0))}</>,
        title: plural(r.n, "installment", "installments") + " · " + r.label,
      }));
  })();

  if (!rows.length) {
    return (
      <Unavailable
        title={year ? "No subscription started in " + year + "." : "No subscription has been recorded."}
        why="Every figure on this tab is derived from the records beside it." />
    );
  }

  /* THE FOUR HEADLINE FIGURES, on the panel's own stat tile — the label with
     its `i`, the figure, what it counts, and where to go and see it. A tile
     rather than a chart because a single number has no shape to see.

     `foot` crosses to the Subscriptions tab with that filter applied: the
     charts here are never narrowed — a chart narrowed by a filter is a chart
     whose caption lies — so "show only these" takes you to the records, which
     is where narrowing belongs. */
  const tiles: TileProps[] = [
    {
      k: <>Expected collection<InfoTip label="Expected collection"
        intro={<>The <b>whole contracted value</b> of every subscription ever recorded — each
          one's own agreed total, summed. The three figures beside it are its parts: what has
          arrived, what is still to come, and what did not clear.</>}
        rows={[
          { label: "Counts", hint: "every subscription in the module: active, completed, cancelled and defaulting alike." },
          { label: "Is not revenue", hint: "it is what was agreed, not what arrived — Collected is the part that has." },
          { label: "Caution", hint: "a cancelled subscription keeps the total it was agreed at. Cancelling forward stops the schedule; it does not rewrite what was sold." },
        ]} /></>,
      v: inr(agreedPaise),
      s: plural(rows.length, "sale", "sales") + " recorded",
    },
    {
      k: <>Collected<InfoTip label="Collected"
        intro={<>Money that <b>actually arrived</b>, summed across every installment recorded
          as paid, all time.</>}
        rows={[
          { label: "Counts", hint: "an installment the moment a payment is recorded against it and its receipt is issued." },
          { label: "Excludes", hint: "reversed payments — a reversal puts the installment back to unpaid and this figure drops with it." },
          { label: "Not the same as the list's tile", hint: "that one is one period; this is everything ever collected." },
        ]} /></>,
      v: inr(collectedPaise),
      tone: "ok",
      s: plural(collectedN, "installment", "installments") + " settled",
      foot: <>
        <span className="inline-flex items-center gap-1 text-tertiary tnum">
          <b className="font-medium text-secondary">{activeN}</b> active
          <InfoTip label="Active subscriptions"
            intro={<>Subscriptions running right now — <b>a level, read at this moment</b>, not a total for any period.</>}
            rows={[
              { label: "Counts", hint: "every subscription still being served: paid up front or still paying." },
              { label: "Excludes", hint: "completed, cancelled, refunded — and defaulting, which leaves the moment an installment fails." },
              { label: "Caution", hint: "it does not explain the figure beside it. Money collected all time includes subscriptions that are no longer active." },
            ]} />
        </span>
        {collectedN
          ? <Button color="link-color" size="sm" onClick={() => onQueue("settled")}>show only these</Button>
          : null}
      </>,
    },
    {
      k: <>Expected installments<InfoTip label="Expected installments"
        intro={<>Installments that are <b>due — the absence of an event</b>. Nothing has
          happened to them: they have not been paid and they have not failed.</>}
        rows={[
          { label: "Counts", hint: "every unpaid installment on every live schedule, whether its date has passed or not." },
          { label: "Expected, not earned", hint: "each one is a row that already exists, dated when the subscription was recorded — it is not a forecast, and it is not revenue." },
          { label: "Excludes", hint: "cancelled installments, and anything that failed — a failure is an event and it is counted beside this." },
        ]} /></>,
      v: inr(duePaise),
      tone: duePaise ? undefined : "ok",
      s: dueN
        ? plural(dueN, "installment", "installments") + " · expected"
        : "every installment that exists has been settled",
      foot: dueN
        ? <Button color="link-color" size="sm" onClick={() => onQueue("due")}>show only these</Button>
        : null,
    },
    {
      k: <>Fail installments<InfoTip label="Fail installments"
        intro={<>Installments recorded as <b>fail to pay</b> — a decline, a cancelled mandate,
          or a due date that demonstrably passed.</>}
        rows={[
          { label: "Always evidenced", hint: "a failure cannot be recorded without a reason from the closed list and a note. There is no state here meaning 'probably failed'." },
          { label: "Is not written off", hint: "the money is still owed; the subscription reads defaulting until the installment is settled or the subscription is cancelled." },
        ]} /></>,
      v: inr(failedPaise),
      tone: failedN ? "bad" : undefined,
      s: failedN
        ? plural(failedN, "installment", "installments") + " did not clear, each with its evidence on the record"
        : "every installment that fell due has cleared",
      foot: failedN
        ? <Button color="link-color" size="sm" onClick={() => onQueue("failed")}>show only these</Button>
        : null,
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-md font-semibold text-primary">The money · {year || "all time"}</h2>
          <span className="label-mono">{plural(rows.length, "subscription", "subscriptions")}</span>
        </div>
        <Tiles cols={4} list={tiles} />
      </section>

      {/* ============================================================ over time === */}
      <ChartFrame title="Collected, month by month">
        {months.length ? (
          <ColumnChart series={COLLECTED} labelSeries="collected"
            points={months.map((m) => ({
              key: m.month,
              label: fmtMonth(m.month),
              values: { collected: thousands(m.paise) },
            }))}
            unit="₹ thousand · by the date the bank credited it" />
        ) : (
          <Unavailable title="Nothing has been collected yet."
            why="A bar appears the moment an installment is settled with a value date." />
        )}
      </ChartFrame>

      <Blocks>
        {/* ================================================================ by plan === */}
        <ChartFrame title="Which plans are selling">
          {planRows.length
            ? <BarRows rows={planRows} unit="₹ thousand · collected" />
            : <Unavailable title="No plan has collected anything yet."
                why="A plan appears here once money has arrived against a subscription sold on it." />}
        </ChartFrame>

        {/* ============================================================== by source === */}
        <ChartFrame title="Where the sales came from">
          {sourceRows.length
            ? <BarRows rows={sourceRows} unit="subscriptions · hover a bar for the money" />
            : <Unavailable title="No subscription carries a source."
                why="Every recorded sale carries one, so this appears with the first record." />}
        </ChartFrame>
      </Blocks>

      {/* ========================================================= installments === */}
      {/* Due wears no warning colour on purpose: it is the ABSENCE of an
          event, and a tint would claim something happened that has not. */}
      <ChartFrame title="Every installment, by state">
        <BarRows rows={instRows} unit="installments · hover a bar for what it is worth" />
      </ChartFrame>
    </div>
  );
}
