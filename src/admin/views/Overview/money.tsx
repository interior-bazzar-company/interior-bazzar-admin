/* =============================================================================
   Overview — the finance snapshot. Everything here is Finance's own
   arithmetic (overview(), subTotals(), atRisk(), monthPoints()) read for the
   selected period; not one rupee is added on this page.

   THREE READINGS, IN ORDER: what the period did (six tiles), how it moved
   (the two plots — composition beside net), and what is not where it should
   be (the exception list, with payroll under it). Money in and out sits here
   rather than in Business performance because a reader asking about cash is
   asking about cash, not about deals.
   ============================================================================= */
import { Card, ChartFrame, Icon, ListTable, Rail } from "../../ui";
import { inr } from "../../ui/format";
import { fmtMonth } from "../Finance/store";
import { ColumnChart, SignedColumns } from "../charts";
import type { ColumnPoint, Series, SignedPoint } from "../charts";
import { Gone, Go, Kpi, Money, Section, Stamp, Tip, Empty, rowLink } from "./bits";
import type { OverviewData } from "./store";

/** Lakh to two places for the axis; the exact figure rides as `display`. */
const lakh = (paise: number) => Math.round(paise / 100000) / 100;
/** Thousands of rupees for an axis. The exact figure rides in the tooltip. */
const thousands = (paise: number) => Math.round(paise / 100000);

const MONEY: Series[] = [
  { key: "in", label: "In", slot: 1 },
  { key: "out", label: "Out", slot: 3 },
];

const RISK_TONE: Record<string, string> = {
  bad: "text-error-primary",
  warn: "text-warning-primary",
  mute: "text-quaternary",
};

export function Finance({ d }: { d: OverviewData }) {
  const f = d.fin;
  const of = "vs prev " + d.periods.finance.days + "d";
  if (!f) {
    return (
      <Section id="ov-finance" title="Finance">
        <Card tight><Gone what="Finance" needs="finance access" /></Card>
      </Section>
    );
  }
  const inNow = f.cur.collectedPaise + f.cur.otherInPaise;
  const inPrev = f.prev.collectedPaise + f.prev.otherInPaise;
  const money: ColumnPoint[] = f.flow.map((x) => ({ key: x.key, label: x.label, values: { in: thousands(x.collected), out: thousands(x.out) } }));
  const anyMoney = money.some((p) => p.values.in || p.values.out);
  const net: SignedPoint[] = f.months.map((m) => ({ key: m.month, label: fmtMonth(m.month).slice(0, 3), value: lakh(m.netPaise), display: inr(m.netPaise) }));
  const years: { label: string; n: number }[] = [];
  f.months.forEach((m) => {
    const y = m.month.slice(0, 4);
    const last = years[years.length - 1];
    if (last && last.label === y) last.n += 1; else years.push({ label: y, n: 1 });
  });

  return (
    <Section id="ov-finance" title="Finance" desc={d.periods.finance.label + " · cash, not profit"}
      right={<><Stamp clock={d.clocks.finance} /><Go to="#/finance-analytics">Analytics</Go></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi k="Net" tip="net" v={<Money paise={f.cur.netPaise} />} tone={f.cur.netPaise < 0 ? "bad" : undefined}
          s={f.cur.salaryN ? undefined : "no salary run paid into this period"}
          now={f.cur.netPaise} before={f.prev.netPaise} of={of} to="#/finance-analytics" />
        <Kpi k="In" tip="collected" v={<Money paise={inNow} />} s={inr(f.cur.collectedPaise, { compact: true }) + " subscriptions"}
          now={inNow} before={inPrev} of={of} to="#/finance" />
        <Kpi k="Out" v={<Money paise={f.cur.outPaise} />} s={inr(f.cur.otherOutPaise, { compact: true }) + " spend · " + inr(f.cur.refundsPaidPaise, { compact: true }) + " refunds"}
          now={f.cur.outPaise} before={f.prev.outPaise} good="down" of={of} to="#/finance-transactions" />
        <Kpi k="Due in 30 days" tip="duesoon" v={<Money paise={f.dueSoon.paise} />} s={f.dueSoon.n + " installment" + (f.dueSoon.n === 1 ? "" : "s")} to="#/finance?flag=due" />
        <Kpi k="Failed to pay" v={f.failed.n ? <Money paise={f.failed.paise} /> : "—"} s={f.failed.n ? f.failed.n + " installment" + (f.failed.n === 1 ? "" : "s") : "nothing bounced"}
          tone={f.failed.n ? "bad" : "ok"} to="#/finance?flag=failed" />
        <Kpi k="Refunds owed" v={f.refundsOwed.n ? <Money paise={f.refundsOwed.paise} /> : "—"}
          s={f.refundsOwed.n ? f.refundsOwed.n + " approved, not sent" : f.refundsOpen ? f.refundsOpen + " request" + (f.refundsOpen === 1 ? "" : "s") + " to decide" : "nothing waiting"}
          tone={f.refundsOwed.n ? "warn" : undefined} to="#/finance-refunds" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartFrame
          title={<span className="inline-flex items-center gap-1.5">Money in and out<Tip k="moneyflow" /></span>}
          right={<Stamp clock={d.clocks.finance} />}
        >
          {anyMoney
            ? <ColumnChart series={MONEY} points={money} labelSeries="in" unit="₹ thousand · in is collections plus other income, out is salaries, spend and refunds" />
            : <Empty title="No money moved in this period." why="Nothing was collected or paid out between these dates on the Finance clock." />}
        </ChartFrame>
        <ChartFrame
          title="Net by month"
          right={<span className="label-mono">{f.months.length} month{f.months.length === 1 ? "" : "s"}</span>}
        >
          {f.months.length > 1
            ? <SignedColumns points={net} groups={years} unit="₹ lakh · collected + other income − salaries − spend − refunds" />
            : <Empty title="One month is not a trend." why="Appears as months accumulate in the records." />}
        </ChartFrame>
      </div>

      {/* THE EXCEPTION LIST — never added together, because each line is a
          different kind of problem and a total across them would be a number
          nobody could act on. Payroll rides in the foot: it is the one
          obligation that is not a row in this table. */}
      <Card
        flush
        tight
        className="overflow-hidden"
        title="Not where it should be"
        sub="Never added together — each line is a different kind of problem."
        foot={
          d.pay ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="label-mono inline-flex items-center gap-1.5">Payroll<Tip k="payroll" /></span>
              {d.pay.openRun
                ? <span className="text-sm text-secondary">Run <b className="font-mono font-medium text-primary tnum">{d.pay.openRun}</b> open · {d.pay.people ? d.pay.people + " unpaid · " : ""}<Money paise={d.pay.owedPaise} /> owed</span>
                : <span className="text-sm text-success-primary">No run open · nothing owed</span>}
              <span className="ml-auto"><Go to="#/finance-salaries">Salaries</Go></span>
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="label-mono">Payroll</span>
              <span className="text-sm text-tertiary">Withheld — needs Salaries A/C access.</span>
            </span>
          )
        }
      >
        {f.risk.length ? (
          <ListTable
            className="rounded-none ring-0"
            head={
              <tr>
                <th className="rail" />
                <th scope="col">What</th>
                <th scope="col" className="n">Amount</th>
                <th scope="col">How many</th>
                <th scope="col" className="acts" />
              </tr>
            }
          >
            {f.risk.map((r) => (
              <tr key={r.key} {...(r.to ? rowLink(r.to) : {})}>
                <Rail tone={r.tone} />
                <td className="cell-1">{r.label}</td>
                <td className={"n whitespace-nowrap " + (RISK_TONE[r.tone] || "")}>{r.paise !== null ? inr(r.paise, { compact: true }) : r.figure}</td>
                <td className="whitespace-nowrap text-xs text-tertiary">{r.count}</td>
                {/* The row is the link; a chevron says so where Finance's own
                    table spelled out "the 2 that failed" — which wrapped to
                    two lines in a column a third the width it has there. */}
                <td className="acts">{r.to ? <Icon name="chevr" size="xs" className="text-fg-quaternary" /> : null}</td>
              </tr>
            ))}
          </ListTable>
        ) : (
          <Empty title="Everything is where it should be." tone="ok" />
        )}
      </Card>
    </Section>
  );
}
