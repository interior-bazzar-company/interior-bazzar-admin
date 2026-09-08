/* =============================================================================
   Overview — what happened. The executive snapshot, the health strip and the
   two performance charts: the first thing an admin reads, and the only part of
   the page that has to work in ten seconds.
   ============================================================================= */
import type { ReactElement } from "react";
import { ChartFrame } from "../../ui";
import { go } from "../../ui/nav";
import { ColumnChart, Spark } from "../charts";
import type { ColumnPoint, Series } from "../charts";
import { Dot, Empty, Gone, Kpi, Loading, Money, Section, Stamp, Tip } from "./bits";
import type { OverviewData } from "./store";

type DealState = "gone" | "loading" | "forbidden" | "error" | "ok";
export const dealState = (d: OverviewData): DealState =>
  !d.gates.deals ? "gone"
    : d.deals ? "ok"
    : d.api.forbidden ? "forbidden"
    : d.api.error ? "error"
    : "loading";

const NA = { v: "—" as const, tone: "mute" as const };

export function Snapshot({ d }: { d: OverviewData }) {
  const ds = dealState(d);
  const ofD = "vs prev " + d.periods.deals.days + "d";
  const ofF = "vs prev " + d.periods.finance.days + "d";
  const fin = d.fin, deals = d.deals, team = d.team;

  /* One of four states for a deals tile: answering, refused, failed, or a
     figure. A refusal and a failure are different facts and print as such. */
  const dealTile = (k: string, tip: string, render: () => ReactElement) => {
    if (ds === "ok") return render();
    if (ds === "loading") return <Loading k={k} tip={tip} />;
    if (ds === "forbidden") return <Kpi k={k} tip={tip} {...NA} s="not in your access" />;
    if (ds === "error") return <Kpi k={k} tip={tip} {...NA} s="could not load"
      foot={<button type="button" className="btn xs" onClick={d.retryDeals}>Retry</button>} />;
    return <Kpi k={k} tip={tip} {...NA} s="not in your access" />;
  };
  const collected = (o: { collectedPaise: number; otherInPaise: number }) => o.collectedPaise + o.otherInPaise;

  return (
    <Section id="ov-snapshot" title="Executive snapshot" desc={d.periods.deals.label}
      right={<><Stamp clock={d.clocks.deals} /><Stamp clock={d.clocks.finance} /></>}>
      <div className="tiles ov-tiles">
        {fin
          ? <Kpi k="Collected" tip="collected" v={<Money paise={collected(fin.cur)} />}
              s={fin.cur.collectedN + " payment" + (fin.cur.collectedN === 1 ? "" : "s") + " in"}
              now={collected(fin.cur)} before={collected(fin.prev)} of={ofF} to="#/finance-analytics" />
          : <Kpi k="Collected" tip="collected" {...NA} s="not in your access" />}

        {dealTile("Pipeline value", "pipeline", () => (
          <Kpi k="Pipeline value" tip="pipeline" v={<Money paise={deals!.openValue} />}
            s={deals!.open + " open" + (deals!.unquoted ? " · " + deals!.unquoted + " without a value" : "")}
            to="#/deals?view=board" />
        ))}
        {dealTile("Won", "won", () => (
          <Kpi k="Won" tip="won" v={String(deals!.won.n)} s={<Money paise={deals!.won.value} />}
            now={deals!.won.n} before={deals!.wonPrev.n} kind="n" of={ofD} to="#/deals?stage=5"
            foot={deals!.wonSeries.length > 1 ? <Spark values={deals!.wonSeries} tone="s1" label="Won per slice" /> : null} />
        ))}
        {dealTile("Conversion", "conversion", () => (
          <Kpi k="Conversion" tip="conversion" v={deals!.conversion === null ? "—" : deals!.conversion + "%"}
            s={deals!.won.n + " won · " + deals!.lost.n + " lost"}
            now={deals!.conversion} before={deals!.conversionPrev} kind="pts" of={ofD} to="#/deals?view=board" />
        ))}

        {fin
          ? <Kpi k="Receivable" tip="outstanding" v={<Money paise={fin.totals.outstandingPaise} />}
              s={fin.totals.dueN + " due · " + fin.totals.failedN + " failed"}
              tone={fin.totals.failedN ? "warn" : undefined} to="#/finance?flag=due" />
          : <Kpi k="Receivable" tip="outstanding" {...NA} s="not in your access" />}
        {team
          ? <Kpi k="Team today" tip="team" v={<>{team.today.present}<span className="u"> / {team.members.length}</span></>}
              s={team.today.late + " late · " + team.today.onLeave + " on leave"} to="#/attendance" />
          : <Kpi k="Team today" tip="team" {...NA} s="not in your access" />}
        {team
          ? <Kpi k="Overdue tasks" tip="overdue" v={String(team.work.delayed)}
              s={(team.work.total - team.work.completed - team.work.cancelled) + " open"}
              tone={team.work.delayed ? "warn" : undefined} to="#/work?status=delayed" />
          : <Kpi k="Overdue tasks" tip="overdue" {...NA} s="not in your access" />}
        {d.intake
          ? <Kpi k="Enquiries · 7 days" tip="enquiries" v={String(d.intake.week)} s={d.intake.today + " today"}
              to="#/business-enquiries?received=7d" />
          : <Kpi k="Enquiries · 7 days" tip="enquiries" {...NA} s="not in your access" />}
      </div>

      {d.health.length ? (
        <div className="ov-health" role="list" aria-label="Business health">
          <span className="ov-health-k">Health<Tip k="health" /></span>
          {d.health.map((h) => (
            <button type="button" className="ov-health-c" role="listitem" key={h.key} data-go={h.to} onClick={() => go(h.to)}>
              <Dot tone={h.tone} />
              <b>{h.label}</b>
              <span>{h.why}</span>
            </button>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

const FLOW: Series[] = [
  { key: "created", label: "Created", slot: 1 },
  { key: "won", label: "Won", slot: 2 },
  { key: "lost", label: "Lost", slot: 3 },
];
const MONEY: Series[] = [
  { key: "in", label: "In", slot: 1 },
  { key: "out", label: "Out", slot: 3 },
];
/** Thousands of rupees for an axis. The exact figure rides in the tooltip. */
const thousands = (paise: number) => Math.round(paise / 100000);

export function Performance({ d }: { d: OverviewData }) {
  const ds = dealState(d);
  const flow: ColumnPoint[] = d.deals
    ? d.deals.flow.map((f) => ({ key: f.key, label: f.label, values: { created: f.created, won: f.won, lost: f.lost } }))
    : [];
  const moved = flow.some((p) => p.values.created || p.values.won || p.values.lost);
  const money: ColumnPoint[] = d.fin
    ? d.fin.flow.map((f) => ({ key: f.key, label: f.label, values: { in: thousands(f.collected), out: thousands(f.out) } }))
    : [];
  const anyMoney = money.some((p) => p.values.in || p.values.out);
  const grain = d.periods.deals.grain === "day" ? "by day" : d.periods.deals.grain === "week" ? "by week" : "by month";

  return (
    <Section id="ov-performance" title="Business performance" desc={d.periods.deals.label + " · " + grain}>
      <div className="ov-2col">
        <ChartFrame title={<>Deal flow<Tip k="dealflow" /></>} right={<Stamp clock={d.clocks.deals} />}>
          {ds === "ok" && moved
            ? <ColumnChart series={FLOW} points={flow} labelSeries="won" unit="deals · created by created date, won and lost by the date they got there" />
            : ds === "ok" ? <Empty title="No deal was created, won or lost in this period." why="Widen the period, or check the owner filter." />
            : ds === "loading" ? <div className="ov-plot-sk" aria-hidden="true" />
            : ds === "error" ? <Empty title="Deals did not load." why={<button type="button" className="btn xs" onClick={d.retryDeals}>Retry</button>} />
            : <Gone what="Deals" needs="deals access" />}
        </ChartFrame>
        <ChartFrame title={<>Money in and out<Tip k="moneyflow" /></>} right={<Stamp clock={d.clocks.finance} />}>
          {d.fin
            ? anyMoney
              ? <ColumnChart series={MONEY} points={money} labelSeries="in" unit="₹ thousand · in is collections plus other income, out is salaries, spend and refunds" />
              : <Empty title="No money moved in this period." why="Nothing was collected or paid out between these dates on the Finance clock." />
            : <Gone what="Finance" needs="finance access" />}
        </ChartFrame>
      </div>
    </Section>
  );
}
