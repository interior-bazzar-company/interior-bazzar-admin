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
import { SUB_SOURCES, daysPast, fmtMonth, inr, useMonthPoints, useSubRows, useSubsLoading } from "./store";

/* Lakh to two decimal places (`₹61.27L`) for the chart kit. */
const lakh = (paise: number) => Math.round(paise / 100000) / 100;

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
  const loading = useSubsLoading();
  const liveMonths = useMonthPoints();
  const rows = year ? all.filter((r) => r.s.startDate.slice(0, 4) === year) : all;

  /* COLLECTED BY MONTH, using the module's canonical monthly cash-in series
     (deal ledger by paymentDate + plan purchases by verifiedAt) so Oct 2026
     (₹61.27L) and Sept 2026 (₹2.90L) match Finance Analytics and Overview
     100%. Falls back to per-subscription installment value dates only while the
     live month series is still loading. */
  const months = (() => {
    if (liveMonths.length) {
      return liveMonths
        .filter((m) => (!year || m.month.startsWith(year)) && m.subscriptionsPaise > 0)
        .map((m) => ({ month: m.month, paise: m.subscriptionsPaise }));
    }
    const byMonth = new Map<string, number>();
    rows.forEach((r) => r.s.installments.forEach((i) => {
      if (i.status !== "paid" || !i.payment) return;
      const m = i.payment.valueDate.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + i.payment.amountPaise);
    }));
    return Array.from(byMonth.entries())
      .filter(([, paise]) => paise > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, paise]) => ({ month, paise }));
  })();

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
  const grossAgreedPaise = rows.reduce((n, r) => n + r.s.totalPaise, 0);
  const agreedPaise = collectedPaise + duePaise + failedPaise;
  const cancelledPaise = Math.max(0, grossAgreedPaise - agreedPaise);

  /* BY PLAN. Grouped on the canonical planId so website purchases and sales
     quotations of the same plan merge into a single row. */
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
      key, label: v.label, value: Math.round(v.paise / 100),
      display: inr(v.paise),
      hint: <>{plural(v.subs, "sale", "sales")}</>,
      title: v.label + " · " + inr(v.paise) + " collected across " + plural(v.subs, "sale", "sales"),
    }));

  /* WHERE THE SALE CAME FROM. Bar width scales by collected rupee revenue so a
     higher-revenue channel never renders a shorter bar than a lower-revenue
     channel; subscription count and revenue share ride as the hint. */
  const totalSourcePaise = rows.reduce((n, r) => n + r.paidPaise, 0);
  const sourceRows: BarRow[] = SUB_SOURCES
    .map((src: { key: string; label: string }) => {
      const mine = rows.filter((r) => r.s.source === src.key);
      const paidPaise = mine.reduce((n, r) => n + r.paidPaise, 0);
      const pctShare = totalSourcePaise > 0 ? Math.round((paidPaise / totalSourcePaise) * 100) : 0;
      return {
        key: src.key, label: src.label,
        value: Math.round(paidPaise / 100),
        display: inr(paidPaise),
        hint: <>{plural(mine.length, "sale", "sales")} · {pctShare}% of revenue</>,
        title: plural(mine.length, "subscription", "subscriptions") + " recorded as " + src.label + " · " + inr(paidPaise) + " collected",
      };
    })
    .filter((r) => r.value > 0);

  /* UNPAID INSTALLMENTS, BY AGING. Replaces the duplicate state summary (which
     merely repeated the 4 KPI tiles at the top of the page) with an aging breakdown
     of the outstanding schedule (due + fail_to_pay). */
  const agingRows: BarRow[] = (() => {
    const unpaid = rows.flatMap((r) => r.s.installments)
      .filter((i) => i.status === "due" || i.status === "fail_to_pay");
    const buckets = [
      { key: "upcoming", label: "Upcoming (not yet due)", tone: "st-mute",
        items: unpaid.filter((i) => daysPast(i.dueDate) <= 0) },
      { key: "overdue_30", label: "1–30 days overdue", tone: "st-warn",
        items: unpaid.filter((i) => { const d = daysPast(i.dueDate); return d >= 1 && d <= 30; }) },
      { key: "overdue_60", label: "31–60 days overdue", tone: "st-bad",
        items: unpaid.filter((i) => { const d = daysPast(i.dueDate); return d >= 31 && d <= 60; }) },
      { key: "overdue_60p", label: "Over 60 days overdue", tone: "st-bad",
        items: unpaid.filter((i) => daysPast(i.dueDate) > 60) },
    ];
    return buckets
      .filter((b) => b.items.length > 0)
      .map((b) => {
        const paise = b.items.reduce((n, i) => n + i.amountPaise, 0);
        return {
          key: b.key, label: b.label, value: b.items.length, tone: b.tone,
          hint: <>{inr(paise)}</>,
          title: plural(b.items.length, "installment", "installments") + " · " + inr(paise) + " · " + b.label,
        };
      });
  })();

  if (loading && !all.length) {
    return (
      <Unavailable
        title="Loading subscription analytics…"
        why="Reading sales and installment schedules from the server." />
    );
  }

  if (!rows.length) {
    return (
      <Unavailable
        title={year ? "No subscription started in " + year + "." : "No subscription has been recorded."}
        why="Every figure on this tab is derived from the records beside it." />
    );
  }

  const tiles: TileProps[] = [
    {
      k: <>Expected collection<InfoTip label="Expected collection"
        intro={<>The <b>active contracted value</b> across all live schedules — the sum of what has
          been collected ({inr(collectedPaise)}), what is due ({inr(duePaise)}), and what failed to
          clear ({inr(failedPaise)}).</>}
        rows={[
          { label: "Reconciles", hint: "Collected + Expected installments + Fail installments = Expected collection." },
          { label: "Gross contracted", hint: inr(grossAgreedPaise) + " total contracted (" + inr(cancelledPaise) + " on cancelled or expired schedules)." },
        ]} /></>,
      v: inr(agreedPaise),
      s: plural(rows.length, "sale", "sales") + " recorded" + (cancelledPaise ? " · " + inr(cancelledPaise) + " cancelled/expired" : ""),
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
              values: { collected: lakh(m.paise) },
            }))}
            unit="₹ lakh · by the date the bank credited it" />
        ) : (
          <Unavailable title="Nothing has been collected yet."
            why="A bar appears the moment an installment is settled with a value date." />
        )}
      </ChartFrame>

      <Blocks>
        {/* ================================================================ by plan === */}
        <ChartFrame title="Which plans are selling">
          {planRows.length
            ? <BarRows rows={planRows} unit="₹ · collected" />
            : <Unavailable title="No plan has collected anything yet."
                why="A plan appears here once money has arrived against a subscription sold on it." />}
        </ChartFrame>

        {/* ============================================================== by source === */}
        <ChartFrame title="Where the sales came from">
          {sourceRows.length
            ? <BarRows rows={sourceRows} unit="₹ · collected by source" />
            : <Unavailable title="No subscription carries a source."
                why="Every recorded sale carries one, so this appears with the first record." />}
        </ChartFrame>
      </Blocks>

      {/* ========================================================= installments === */}
      <ChartFrame title="Outstanding installments, by aging"
        right={<span className="label-mono">{inr(duePaise + failedPaise)} outstanding across {dueN + failedN} installments</span>}>
        {agingRows.length
          ? <BarRows rows={agingRows} unit="installments · hover a bar for what it is worth" />
          : <Unavailable title="No outstanding installments."
              why="Every installment on this scope has been settled or cancelled." />}
      </ChartFrame>
    </div>
  );
}
