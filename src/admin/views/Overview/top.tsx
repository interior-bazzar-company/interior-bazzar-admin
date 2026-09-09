/* =============================================================================
   Overview — what happened. The executive snapshot, the health strip and the
   two performance plots: the first thing an admin reads, and the only part of
   the page that has to work in ten seconds.

   SIX TILES, NOT EVERY FIGURE THE PAGE HOLDS. A snapshot that prints
   everything is a list, and a list is read left to right rather than at a
   glance. What is here is the company in six numbers — money in, money owed,
   the pipeline, what closed, at what rate, and what is arriving. Team and task
   counts belong to the sections that own them, further down, where the reader
   is already asking about people.
   ============================================================================= */
import type { ReactElement } from "react";
import { Button, ChartFrame, Eyebrow } from "../../ui";
import { inr } from "../../ui/format";
import { BarRows, ColumnChart, Spark } from "../charts";
import type { BarRow, ColumnPoint, Series } from "../charts";
import { Empty, Go, Gone, HealthStrip, Kpi, Loading, Money, PlotSkeleton, Section, Stamp, Tip } from "./bits";
import type { OverviewData } from "./store";

type DealState = "gone" | "loading" | "forbidden" | "error" | "ok";
export const dealState = (d: OverviewData): DealState =>
  !d.gates.deals ? "gone"
    : d.deals ? "ok"
    : d.api.forbidden ? "forbidden"
    : d.api.error ? "error"
    : "loading";

const NA = { v: "—" as const, tone: "mute" as const };

/** The one control a failed figure gets: try the read again, in the tile, on
 *  the tile's own foot line. Nothing else about the tile changes. */
export function Retry({ onPress }: { onPress: () => void }) {
  return (
    <Button size="xs" color="link-color" ico="refresh" onClick={onPress}>
      Retry
    </Button>
  );
}

export function Snapshot({ d }: { d: OverviewData }) {
  const ds = dealState(d);
  const ofD = "vs prev " + d.periods.deals.days + "d";
  const ofF = "vs prev " + d.periods.finance.days + "d";
  const fin = d.fin, deals = d.deals;

  /* One of four states for a deals tile: answering, refused, failed, or a
     figure. A refusal and a failure are different facts and print as such. */
  const dealTile = (k: string, tip: string, render: () => ReactElement) => {
    if (ds === "ok") return render();
    if (ds === "loading") return <Loading k={k} tip={tip} />;
    if (ds === "error") return <Kpi k={k} tip={tip} {...NA} s="could not load" foot={<Retry onPress={d.retryDeals} />} />;
    return <Kpi k={k} tip={tip} {...NA} s="not in your access" />;
  };
  const collected = (o: { collectedPaise: number; otherInPaise: number }) => o.collectedPaise + o.otherInPaise;

  return (
    <Section id="ov-snapshot" title="Executive snapshot" desc={d.periods.deals.label}
      right={<><Stamp clock={d.clocks.deals} /><Stamp clock={d.clocks.finance} /></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        {/* The intake counter answers with a total or with nothing; a backend
            that returns no total leaves the topbar's own zeros standing, so
            the tile prints a zero rather than the word `undefined`. */}
        {d.intake
          ? <Kpi k="Enquiries · 7 days" tip="enquiries" v={String(Number(d.intake.week) || 0)} s={(Number(d.intake.today) || 0) + " today"}
              to="#/business-enquiries?received=7d" />
          : <Kpi k="Enquiries · 7 days" tip="enquiries" {...NA} s="not in your access" />}
      </div>

      {/* FOUR ONE-LINE VERDICTS. Not numbers again — a reading of them, and a
          way into the list that produced each. */}
      {d.health.length ? (
        <div className="flex flex-col gap-2">
          <Eyebrow bare>
            <span className="inline-flex items-center gap-1.5">Health<Tip k="health" /></span>
          </Eyebrow>
          <HealthStrip cells={d.health} />
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

/* THE TREND BESIDE THE RANKING. One asks "what moved over the period", the
   other "where does it stand right now"; together they are the whole of
   performance, and neither is readable without the other. */
export function Performance({ d }: { d: OverviewData }) {
  const ds = dealState(d);
  const m = d.deals;
  const flow: ColumnPoint[] = m
    ? m.flow.map((f) => ({ key: f.key, label: f.label, values: { created: f.created, won: f.won, lost: f.lost } }))
    : [];
  const moved = flow.some((p) => p.values.created || p.values.won || p.values.lost);
  const grain = d.periods.deals.grain === "day" ? "by day" : d.periods.deals.grain === "week" ? "by week" : "by month";

  /* ORDERED STAGES ON A ONE-HUE RAMP, but NOT the funnel chart. FunnelChart
     prints the drop between stages — "67% of previous" — which is a reading
     about FLOW, and this is a snapshot of where deals sit right now: a stage
     with more deals than the one before it is normal here and printed as
     "150% of previous", which is a number nobody can act on. Bar rows on the
     ordinal ramp keep the order and the hue and drop the ratio. */
  const stages: BarRow[] = m
    ? m.byStage.map((s, i) => ({
        key: s.key, label: s.label, value: s.n, tone: "o" + (i + 1),
        hint: s.n ? <Money paise={s.value} /> : <span className="text-quaternary">—</span>,
        title: s.n ? inr(s.value) + " across " + s.n + (s.n === 1 ? " deal" : " deals") : "no deals here",
      }))
    : [];
  const anyStage = stages.some((s) => s.value > 0);

  return (
    <Section id="ov-performance" title="Business performance" desc={d.periods.deals.label + " · " + grain}
      right={<Stamp clock={d.clocks.deals} />}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartFrame
          title={<span className="inline-flex items-center gap-1.5">Deal flow<Tip k="dealflow" /></span>}
          right={<Stamp clock={d.clocks.deals} />}
        >
          {ds === "ok" && moved
            ? <ColumnChart series={FLOW} points={flow} labelSeries="won" unit="deals · created by created date, won and lost by the date they got there" />
            : ds === "ok" ? <Empty title="No deal was created, won or lost in this period." why="Widen the period, or check the owner filter." />
            : ds === "loading" ? <PlotSkeleton tall />
            : ds === "error" ? <Empty title="Deals did not load." why={<Retry onPress={d.retryDeals} />} />
            : <Gone what="Deals" needs="deals access" />}
        </ChartFrame>

        <ChartFrame
          title={<span className="inline-flex items-center gap-1.5">Pipeline by stage<Tip k="funnel" /></span>}
          right={ds === "ok" && m!.stalled
            ? <Go to="#/deals?stalled=1" cls="warn">{m!.stalled} stalled · <Money paise={m!.stalledValue} /></Go>
            : null}
        >
          {ds === "ok" && anyStage
            ? <BarRows rows={stages} unit="deals at each stage now · value beside each" />
            : ds === "ok" ? <Empty title="No deals in the pipeline." why="Add a deal, or clear the owner filter." />
            : ds === "loading" ? <PlotSkeleton tall />
            : ds === "error" ? <Empty title="Deals did not load." why={<Retry onPress={d.retryDeals} />} />
            : <Gone what="Deals" needs="deals access" />}
        </ChartFrame>
      </div>
    </Section>
  );
}
