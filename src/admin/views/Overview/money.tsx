/* =============================================================================
   Overview — the finance snapshot. Everything here is Finance's own
   arithmetic (overview(), subTotals(), atRisk(), monthPoints()) read for the
   selected period; not one rupee is added on this page.
   ============================================================================= */
import { ChartFrame, Icon } from "../../ui";
import { inr } from "../../ui/format";
import { fmtMonth } from "../Finance/store";
import { SignedColumns } from "../charts";
import type { SignedPoint } from "../charts";
import { Gone, Go, Kpi, Money, Section, Stamp, Tip, Empty, rowLink } from "./bits";
import type { OverviewData } from "./store";

/** Lakh to two places for the axis; the exact figure rides as `display`. */
const lakh = (paise: number) => Math.round(paise / 100000) / 100;

export function Finance({ d }: { d: OverviewData }) {
  const f = d.fin;
  const of = "vs prev " + d.periods.finance.days + "d";
  if (!f) {
    return (
      <Section id="ov-finance" title="Finance"><Gone what="Finance" needs="finance access" /></Section>
    );
  }
  const inNow = f.cur.collectedPaise + f.cur.otherInPaise;
  const inPrev = f.prev.collectedPaise + f.prev.otherInPaise;
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
      <div className="tiles c3 ov-tiles">
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

      <div className="ov-2col">
        <ChartFrame title="Net by month" right={<span className="faint">{f.months.length} month{f.months.length === 1 ? "" : "s"}</span>}>
          {f.months.length > 1
            ? <SignedColumns points={net} groups={years} unit="₹ lakh · collected + other income − salaries − spend − refunds" />
            : <Empty title="One month is not a trend." why="Appears as months accumulate in the records." />}
        </ChartFrame>
        <ChartFrame title="Not where it should be" note="Never added together — each line is a different kind of problem.">
          {f.risk.length ? (
            <table className="tbl ov-risk">
              <tbody>
                {f.risk.map((r) => (
                  <tr key={r.key} {...(r.to ? rowLink(r.to) : {})}>
                    <td><span className={"ov-rail " + r.tone} />{r.label}</td>
                    <td className={"n tnum ov-nowrap " + r.tone}>{r.paise !== null ? inr(r.paise, { compact: true }) : r.figure}</td>
                    <td className="faint ov-nowrap">{r.count}</td>
                    {/* The row is the link; a chevron says so where Finance's own
                        table spelled out "the 2 that failed" — which wrapped to
                        two lines in a column a third the width it has there. */}
                    <td className="n ov-chev">{r.to ? <Icon name="chevr" size="xs" /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty title="Everything is where it should be." tone="ok" />}
          {d.pay
            ? <div className="ov-payroll">
                <span className="eyebrow bare">Payroll<Tip k="payroll" /></span>
                {d.pay.openRun
                  ? <span>Run <b className="mono">{d.pay.openRun}</b> open · {d.pay.people ? d.pay.people + " unpaid · " : ""}<Money paise={d.pay.owedPaise} /> owed</span>
                  : <span className="ok">No run open · nothing owed</span>}
                <Go to="#/finance-salaries">Salaries</Go>
              </div>
            : <div className="ov-payroll mute"><span className="eyebrow bare">Payroll</span><span>Withheld — needs Salaries A/C access.</span></div>}
        </ChartFrame>
      </div>
    </Section>
  );
}
