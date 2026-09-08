/* =============================================================================
   Overview — deals intelligence. Where the money is sitting, who is carrying
   it, and which deals need a hand on them this week.
   ============================================================================= */
import { useState } from "react";
import { STAGES } from "../Deals/adapter";
import { Avatar, ChartFrame, Pill, Segmented } from "../../ui";
import { inr } from "../../ui/format";
import { BarRows } from "../charts";
import type { BarRow } from "../charts";
import { daysBetween, shortDate } from "./derive";
import type { DealMetrics, DealRec, RiskDeal } from "./derive";
import { Empty, Gone, Go, Money, Section, Stamp, Tip, rowLink } from "./bits";
import type { OverviewData } from "./store";
import { dealState } from "./top";

type Lens = "risk" | "soon" | "value" | "age";
const LIMIT = 6;

const REASON: Record<RiskDeal["reason"], string> = {
  stalled: "stalled", next_overdue: "next action late", close_passed: "close date passed",
};

function DealRow({ d, signal, today }: { d: DealRec; signal: React.ReactNode; today: string }) {
  const st = STAGES[d.stage];
  const to = "#/deals/" + encodeURIComponent(d.deal_id);
  return (
    <tr {...rowLink(to)}>
      <td>
        <div className="ov-deal">
          <b className="trunc">{d.customer_name}</b>
          <span className="trunc">{d.business_name || d.deal_id}{d.stage_since ? " · " + daysBetween(d.stage_since, today) + "d in stage" : ""}</span>
        </div>
      </td>
      <td>{st ? <Pill text={st.label} tone={st.tone} xs /> : null}</td>
      <td className="n">{d.deal_value === null ? <span className="faint">—</span> : <Money paise={d.deal_value} />}</td>
      <td className="ov-owner">{d.owner_id ? <><Avatar name={d.owner_id} sm /><span className="trunc">{d.owner_id}</span></> : <span className="unassigned">unassigned</span>}</td>
      <td className="ov-signal">{signal}</td>
    </tr>
  );
}

function LensTable({ m, lens, today }: { m: DealMetrics; lens: Lens; today: string }) {
  const rows: { d: DealRec; signal: React.ReactNode }[] =
    lens === "risk" ? m.atRisk.slice(0, LIMIT).map((r) => ({
      d: r.d, signal: <span className={r.reason === "stalled" ? "bad" : "warn"}>{REASON[r.reason]}{r.reason !== "stalled" ? " · " + r.days + "d" : ""}</span> }))
    : lens === "soon" ? m.closingSoon.slice(0, LIMIT).map((d) => ({
      d, signal: <span>closes {shortDate(String(d.expected_close_date))} · {daysBetween(today, String(d.expected_close_date))}d</span> }))
    : lens === "value" ? m.biggest.slice(0, LIMIT).map((d) => ({
      d, signal: <span className="faint">{d.expected_close_date ? "closes " + shortDate(d.expected_close_date) : "no close date"}</span> }))
    : m.aging.slice(0, LIMIT).map((d) => ({
      d, signal: <span className={daysBetween(String(d.stage_since), today) > 30 ? "warn" : undefined}>{daysBetween(String(d.stage_since), today)}d since {STAGES[d.stage]?.label || "stage"}</span> }));
  if (!rows.length) {
    const why = lens === "risk" ? ["Nothing is stalled, late or past its close date.", "A quiet list is the goal, not a missing one."]
      : lens === "soon" ? ["No open deal is due to close in the next 14 days.", "Set expected close dates on deals to plan the month."]
      : lens === "value" ? ["No open deal carries a value yet.", "Add a value on a deal to rank it here."]
      : ["No open deal has a stage date.", "Stage dates arrive with the deal."];
    return <Empty title={why[0]} why={why[1]} tone={lens === "risk" ? "ok" : undefined} />;
  }
  return (
    <div className="tw flat">
      <table className="tbl ov-tbl">
        <thead><tr><th>Deal</th><th>Stage</th><th className="n">Value</th><th>Owner</th><th>Signal</th></tr></thead>
        <tbody>{rows.map((r) => <DealRow key={r.d.deal_id} d={r.d} signal={r.signal} today={today} />)}</tbody>
      </table>
    </div>
  );
}

const thousands = (paise: number) => Math.round(paise / 100000);

export function DealsIntel({ d }: { d: OverviewData }) {
  const [lens, setLens] = useState<Lens>("risk");
  const ds = dealState(d);
  const m = d.deals;
  const today = d.clocks.deals.today;

  if (ds !== "ok") {
    return (
      <Section id="ov-deals" title="Deals" right={<Stamp clock={d.clocks.deals} />}>
        {ds === "loading" ? <div className="ov-plot-sk tall" aria-hidden="true" />
          : ds === "error" ? <Empty title="Deals did not load." why={<button type="button" className="btn xs" onClick={d.retryDeals}>Retry</button>} />
          : <Gone what="Deals" needs="deals access" />}
      </Section>
    );
  }
  /* ORDERED STAGES ON A ONE-HUE RAMP, but NOT the funnel chart. FunnelChart
     prints the drop between stages — "67% of previous" — which is a reading
     about FLOW, and this is a snapshot of where deals sit right now: a stage
     with more deals than the one before it is normal here and printed as
     "150% of previous", which is a number nobody can act on. Bar rows on the
     ordinal ramp keep the order and the hue and drop the ratio. */
  const stages: BarRow[] = m!.byStage.map((s, i) => ({
    key: s.key, label: s.label, value: s.n, tone: "o" + (i + 1),
    hint: s.n ? <Money paise={s.value} /> : <span className="faint">—</span>,
    title: s.n ? inr(s.value) + " across " + s.n + (s.n === 1 ? " deal" : " deals") : "no deals here",
  }));
  const anyStage = stages.some((s) => s.value > 0);
  const owners: BarRow[] = m!.byOwner.slice(0, 8).map((o) => ({
    key: o.name, label: <span className="ov-owner"><Avatar name={o.name} sm /><span className="trunc">{o.name}</span></span>,
    value: thousands(o.value), hint: <>{o.open} open · {o.won} won</>,
    title: inr(o.value) + " open · " + o.open + " deals · " + o.won + " won in period",
  }));
  const lensOptions = [
    { v: "risk", l: <>At risk{m!.atRisk.length ? <span className="ct">{m!.atRisk.length}</span> : null}</> },
    { v: "soon", l: <>Closing soon{m!.closingSoon.length ? <span className="ct">{m!.closingSoon.length}</span> : null}</> },
    { v: "value", l: "Highest value" },
    { v: "age", l: "Longest in stage" },
  ];

  return (
    <Section id="ov-deals" title="Deals" desc={m!.open + " open · " + inr(m!.openValue, { compact: true }) + (m!.avgWon !== null ? " · avg won " + inr(m!.avgWon, { compact: true }) : "")}
      right={<><Stamp clock={d.clocks.deals} /><Go to="#/deals?view=board">Pipeline</Go></>}>
      <div className="ov-2col">
        <ChartFrame title={<>Pipeline by stage<Tip k="funnel" /></>}
          right={m!.stalled ? <Go to="#/deals?stalled=1" cls="warn">{m!.stalled} stalled · <Money paise={m!.stalledValue} /></Go> : null}>
          {anyStage
            ? <BarRows rows={stages} unit="deals at each stage now · value beside each" />
            : <Empty title="No deals in the pipeline." why="Add a deal, or clear the owner filter." />}
        </ChartFrame>
        <ChartFrame title={<>By owner<Tip k="byowner" /></>}>
          {owners.length
            ? <BarRows rows={owners} unit="₹ thousand of open pipeline" />
            : <Empty title="No owned deals." why="Deals without an owner do not appear here." />}
        </ChartFrame>
      </div>
      <div className="card ov-lens">
        <header className="card-h">
          <h3>Deals that need a look<Tip k="lens" /></h3>
          <span className="r"><Segmented sm label="Lens" options={lensOptions} value={lens} onPick={(v) => setLens(v as Lens)} /></span>
        </header>
        <div className="card-b tight">
          <LensTable m={m!} lens={lens} today={today} />
        </div>
      </div>
    </Section>
  );
}
