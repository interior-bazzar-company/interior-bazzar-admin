/* =============================================================================
   Finance · Subscriptions ▸ Analytics. Every subscription ever recorded, read
   back as four figures and four charts.

   IT SITS BESIDE THE RECORDS IT DERIVES FROM, the same move Salaries A/C made
   when payroll analytics stopped living one page away. Somebody asking "which
   plan is actually selling" got there from this page; having to leave it to
   ask was the whole friction.

   ALL TIME, NOT A PERIOD, and every caption says so. The list tab beside this
   one carries the period figures — Collected · August 2026 — and repeating
   them here in a different shape would put the same word over two different
   numbers. What this tab answers is the question a month cannot: across
   everything recorded, where did the money come from and where is it stuck.

   NO MONEY ARITHMETIC. Every amount arrives as integer paise from the store's
   own `SubRow` fields and is printed by `inr()`. The one division is the
   display scaler feeding the chart kit, it is named `thousands`, and nothing
   it returns is ever printed as an amount.

   ONE CUT PER CHART. A month, a plan, a source and an installment state are
   four different ways of cutting the same rupees, so they never share an axis
   — putting them side by side would count every rupee four times and draw a
   total that means nothing.
   ============================================================================= */
import type { ReactNode } from "react";
import { Block, Blocks } from "./Frame";
import { Unavailable } from "./bits";
import InfoTip from "./InfoTip";
import { BarRows, ColumnChart } from "../charts";
import type { BarRow, Series } from "../charts";
import { SUB_SOURCES, fmtMonth, inr, useMonthPoints, useSubRows } from "./store";

/* The chart kit takes plain numbers and prints them with `toLocaleString`, so
   an axis fed integer paise would read 6,77,320. This converts FOR THE MARKS
   ONLY — every rupee figure on this page comes from `inr()` on the paise. */
const thousands = (paise: number) => Math.round(paise / 100000);

/* One series, so the kit draws no legend and the block title names it. Slot 1
   is money that arrived, here and everywhere else in the panel. */
const COLLECTED: Series[] = [{ key: "collected", label: "Collected", slot: 1 }];

/* ============================================================== pieces === */

/** One headline figure with its definition behind the i. A tile, not a chart:
 *  a single number has no shape to see.
 *
 *  THE SAME ANATOMY AS THE LIST TAB'S STRIP, deliberately — label and i, the
 *  figure, a second figure of a different KIND beside it where there is one,
 *  then a line that says what the number counts and offers to show it. Two
 *  strips in one module that read differently make a reader work out twice
 *  what they are looking at.
 *
 *  `action` crosses to the Subscriptions tab with that filter applied: the
 *  charts here are never narrowed — a chart narrowed by a filter is a chart
 *  whose caption lies — so "show only these" takes you to the records, which
 *  is where narrowing belongs. */
function Tile({ label, value, sub, tone, tip, aside, action }: {
  label: string; value: ReactNode; sub: ReactNode; tone?: string; tip: ReactNode;
  aside?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className={"fin-mt " + (tone || "")}>
      <div className="k">{label}{tip}</div>
      <div className="v">{value}{aside ? <span className="fin-mt-aside">{aside}</span> : null}</div>
      <div className="s">{sub}{action ? <> · {action}</> : null}</div>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);

/* ================================================================ page === */

export default function SubAnalytics({ onQueue }: {
  /** Cross to the Subscriptions tab with one of the strip's queues applied.
   *  Narrowing belongs to the records, never to the charts. */
  onQueue: (flag: string) => void;
}) {
  const rows = useSubRows();
  const months = useMonthPoints().filter((m) => m.subscriptionsPaise > 0);

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
    const all = rows.flatMap((r) => r.s.installments);
    const of = (st: string) => all.filter((i) => i.status === st);
    return [
      { key: "paid", label: "Paid", tone: "st-ok", n: of("paid").length },
      { key: "due", label: "Due", tone: "st-mute", n: of("due").length },
      { key: "fail_to_pay", label: "Fail to pay", tone: "st-bad", n: of("fail_to_pay").length },
      { key: "cancelled", label: "Cancelled", tone: "st-mute", n: of("cancelled").length },
    ]
      .filter((r) => r.n > 0)
      .map((r) => ({
        key: r.key, label: r.label, value: r.n, tone: r.tone,
        hint: <>{inr(all.filter((i) => i.status === r.key)
          .reduce((n, i) => n + i.amountPaise, 0))}</>,
        title: plural(r.n, "installment", "installments") + " · " + r.label,
      }));
  })();

  if (!rows.length) {
    return (
      <Blocks>
        <Block wide title="Nothing to read back yet">
          <Unavailable title="No subscription has been recorded."
            why="Every figure on this tab is derived from the records beside it. The first sale
              recorded fills all four charts at once — nothing here is seeded, forecast or
              carried over from anywhere else." />
        </Block>
      </Blocks>
    );
  }

  return (
    <Blocks>
      {/* ============================================================ the money === */}
      <Block wide title="The money · every subscription recorded"
        right={<span className="fin-sum">
          {plural(rows.length, "subscription", "subscriptions")} recorded
        </span>}>
        <div className="fin-money-strip">
          <Tile label="Expected collection" value={inr(agreedPaise)}
            sub={plural(rows.length, "sale", "sales") + " ever recorded"}
            tip={<InfoTip label="Expected collection"
              intro={<>The <b>whole contracted value</b> of every subscription ever recorded — each
                one's own agreed total, summed. The three figures beside it are its parts: what has
                arrived, what is still to come, and what did not clear.</>}
              rows={[
                { label: "Counts", hint: "every subscription in the module: active, completed, cancelled and defaulting alike." },
                { label: "Is not revenue", hint: "it is what was agreed, not what arrived — Collected is the part that has." },
                { label: "Caution", hint: "a cancelled subscription keeps the total it was agreed at. Cancelling forward stops the schedule; it does not rewrite what was sold." },
              ]} />} />

          <Tile label="Collected" tone="ok" value={inr(collectedPaise)}
            aside={<>
              <b className="tnum">{activeN}</b> active
              <InfoTip label="Active subscriptions"
                intro={<>Subscriptions running right now — <b>a level, read at this moment</b>, not a total for any period.</>}
                rows={[
                  { label: "Counts", hint: "every subscription still being served: paid up front or still paying." },
                  { label: "Excludes", hint: "completed, cancelled, refunded — and defaulting, which leaves the moment an installment fails." },
                  { label: "Caution", hint: "it does not explain the figure beside it. Money collected all time includes subscriptions that are no longer active." },
                ]} />
            </>}
            sub={plural(collectedN, "installment", "installments") + " settled"}
            action={collectedN ? <button className="lnk" onClick={() => onQueue("settled")}>show only these</button> : null}
            tip={<InfoTip label="Collected"
              intro={<>Money that <b>actually arrived</b>, summed across every installment recorded
                as paid, all time.</>}
              rows={[
                { label: "Counts", hint: "an installment the moment a payment is recorded against it and its receipt is issued." },
                { label: "Excludes", hint: "reversed payments — a reversal puts the installment back to unpaid and this figure drops with it." },
                { label: "Not the same as the list's tile", hint: "that one is one period; this is everything ever collected." },
              ]} />} />

          <Tile label="Expected installments" tone={duePaise ? "mute" : "ok"} value={inr(duePaise)}
            sub={dueN
              ? plural(dueN, "installment", "installments") + " · expected"
              : "every installment that exists has been settled"}
            action={dueN ? <button className="lnk" onClick={() => onQueue("due")}>show only these</button> : null}
            tip={<InfoTip label="Expected installments"
              intro={<>Installments that are <b>due — the absence of an event</b>. Nothing has
                happened to them: they have not been paid and they have not failed.</>}
              rows={[
                { label: "Counts", hint: "every unpaid installment on every live schedule, whether its date has passed or not." },
                { label: "Expected, not earned", hint: "each one is a row that already exists, dated when the subscription was recorded — it is not a forecast, and it is not revenue." },
                { label: "Excludes", hint: "cancelled installments, and anything that failed — a failure is an event and it is counted beside this." },
              ]} />} />

          <Tile label="Fail installments" tone={failedN ? "bad" : "mute"}
            value={<>{inr(failedPaise)}{failedN ? <span className="fin-count"> · {failedN}</span> : null}</>}
            sub={failedN
              ? plural(failedN, "installment", "installments") + " did not clear, each with its evidence on the record"
              : "every installment that fell due has cleared"}
            action={failedN ? <button className="lnk" onClick={() => onQueue("failed")}>show only these</button> : null}
            tip={<InfoTip label="Fail installments"
              intro={<>Installments recorded as <b>fail to pay</b> — a decline, a cancelled mandate,
                or a due date that demonstrably passed.</>}
              rows={[
                { label: "Always evidenced", hint: "a failure cannot be recorded without a reason from the closed list and a note. There is no state here meaning 'probably failed'." },
                { label: "Is not written off", hint: "the money is still owed; the subscription reads defaulting until the installment is settled or the subscription is cancelled." },
              ]} />} />
        </div>
      </Block>

      {/* ============================================================ over time === */}
      <Block wide title="Collected, month by month"
        desc="every subscription payment, by the date the bank credited it"
        right={<span className="fin-sum">
          {plural(months.length, "month", "months")} with money in {months.length === 1 ? "it" : "them"}
        </span>}
        foot={<>The axis is in thousands so the ticks stay readable at 38 pixels of gutter; every
          exact amount is on the strip above and on the record that produced it. Months come from
          the payments themselves, so a month nothing was collected in is absent rather than drawn
          as a zero — and a bar is dated by the VALUE DATE, when the money reached the account,
          never by when the sale was recorded.</>}>
        {months.length ? (
          <ColumnChart series={COLLECTED} labelSeries="collected"
            points={months.map((m) => ({
              key: m.month,
              label: fmtMonth(m.month),
              values: { collected: thousands(m.subscriptionsPaise) },
            }))}
            unit="₹ thousand · hover or tab a month for its figure" />
        ) : (
          <Unavailable title="Nothing has been collected yet."
            why="This series is built from recorded payments, not from a calendar. A bar appears
              the moment an installment is settled with a value date." />
        )}
      </Block>

      {/* ================================================================ by plan === */}
      <Block title="Which plans are selling"
        desc="collected to date, by plan"
        foot={<>Ordered by money collected, not by how many were sold — the question this answers is
          which plan is carrying the revenue. The count rides beside each bar because a plan that
          sells often for little and one that sells rarely for a lot are two different businesses.
          Grouped on the plan's id, so renaming a plan does not split it in two.</>}>
        {planRows.length
          ? <BarRows rows={planRows} unit="₹ thousand · collected, all time" />
          : <Unavailable title="No plan has collected anything yet."
              why="A plan appears here once money has arrived against a subscription sold on it." />}
      </Block>

      {/* ============================================================== by source === */}
      <Block title="Where the sales came from"
        desc="subscriptions recorded, by channel"
        foot={<>Both are recorded identically and neither is worth more than the other — the
          difference is who typed it, and it is what channel analytics and CAC read. The count
          leads because that is what this split is about; the money beside it is a label, not a
          second axis.</>}>
        {sourceRows.length
          ? <BarRows rows={sourceRows} unit="subscriptions · hover a bar for the money" />
          : <Unavailable title="No subscription carries a source."
              why="Every recorded sale carries one, so this appears with the first record." />}
      </Block>

      {/* ========================================================= installments === */}
      <Block wide title="Every installment, by state"
        desc="the whole schedule of every subscription, counted"
        foot={<>The installment is the unit that gets paid, invoiced, receipted and — when it does
          not clear — recorded as fail to pay, so this is the module's real workload in one row
          each. <b>Due is the absence of an event</b> and wears no warning colour for that reason:
          nothing has happened to those installments. Nothing here waits on anybody's approval —
          there is no state meaning "recorded but not yet believed".</>}>
        <BarRows rows={instRows} unit="installments · hover a bar for what it is worth" />
      </Block>
    </Blocks>
  );
}
