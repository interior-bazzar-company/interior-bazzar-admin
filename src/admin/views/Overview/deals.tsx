/* =============================================================================
   Overview — deals intelligence. Who is carrying the pipeline, and which deals
   need a hand on them this week.

   The stage ranking moved up into Business performance, beside the flow chart,
   where the trend and the standing are read together. What is left here is the
   two things only this section can answer: WHOSE pipeline it is, and WHICH
   named deals want a person today.
   ============================================================================= */
import { useState } from "react";
import type { ReactNode } from "react";
import { STAGES } from "../Deals/adapter";
import { Avatar, Card, ChartFrame, ListTable, Pill, Rail, Segmented } from "../../ui";
import { inr } from "../../ui/format";
import { BarRows } from "../charts";
import type { BarRow } from "../charts";
import { daysBetween, shortDate } from "./derive";
import type { DealMetrics, DealRec, RiskDeal } from "./derive";
import { Empty, Go, Gone, Money, PlotSkeleton, Section, Stamp, Tip, rowLink } from "./bits";
import type { OverviewData } from "./store";
import { dealState, Retry } from "./top";

type Lens = "risk" | "soon" | "value" | "age";
type Row = { d: DealRec; signal: ReactNode; tone?: string };
const LIMIT = 6;

const REASON: Record<RiskDeal["reason"], string> = {
  stalled: "stalled", next_overdue: "next action late", close_passed: "close date passed",
};

function DealRow({ d, signal, tone, today }: Row & { today: string }) {
  const st = STAGES[d.stage];
  const to = "#/deals/" + encodeURIComponent(d.deal_id);
  return (
    <tr {...rowLink(to)}>
      <Rail tone={tone} />
      <td className="cell-1">
        <div className="max-w-56 truncate">{d.customer_name}</div>
        <div className="cell-2 max-w-56 truncate">
          {d.business_name || d.deal_id}{d.stage_since ? " · " + daysBetween(d.stage_since, today) + "d in stage" : ""}
        </div>
      </td>
      <td>{st ? <Pill text={st.label} tone={st.tone} xs /> : null}</td>
      <td className="n">{d.deal_value === null ? <span className="text-quaternary">—</span> : <Money paise={d.deal_value} />}</td>
      <td>
        {d.owner_id
          ? <span className="flex min-w-0 items-center gap-2"><Avatar name={d.owner_id} sm /><span className="max-w-32 truncate">{d.owner_id}</span></span>
          : <span className="text-quaternary">unassigned</span>}
      </td>
      <td className="whitespace-nowrap text-xs">{signal}</td>
    </tr>
  );
}

function LensTable({ m, lens, today }: { m: DealMetrics; lens: Lens; today: string }) {
  const rows: Row[] =
    lens === "risk" ? m.atRisk.slice(0, LIMIT).map((r) => ({
      d: r.d, tone: r.reason === "stalled" ? "bad" : "warn",
      signal: <span className={r.reason === "stalled" ? "text-error-primary" : "text-warning-primary"}>{REASON[r.reason]}{r.reason !== "stalled" ? " · " + r.days + "d" : ""}</span> }))
    : lens === "soon" ? m.closingSoon.slice(0, LIMIT).map((d) => ({
      d, signal: <span className="text-secondary">closes {shortDate(String(d.expected_close_date))} · {daysBetween(today, String(d.expected_close_date))}d</span> }))
    : lens === "value" ? m.biggest.slice(0, LIMIT).map((d) => ({
      d, signal: <span className="text-quaternary">{d.expected_close_date ? "closes " + shortDate(d.expected_close_date) : "no close date"}</span> }))
    : m.aging.slice(0, LIMIT).map((d) => {
      const age = daysBetween(String(d.stage_since), today);
      return { d, tone: age > 30 ? "warn" : undefined,
        signal: <span className={age > 30 ? "text-warning-primary" : "text-secondary"}>{age}d since {STAGES[d.stage]?.label || "stage"}</span> };
    });

  if (!rows.length) {
    const why = lens === "risk" ? ["Nothing is stalled, late or past its close date.", "A quiet list is the goal, not a missing one."]
      : lens === "soon" ? ["No open deal is due to close in the next 14 days.", "Set expected close dates on deals to plan the month."]
      : lens === "value" ? ["No open deal carries a value yet.", "Add a value on a deal to rank it here."]
      : ["No open deal has a stage date.", "Stage dates arrive with the deal."];
    return <Empty title={why[0]} why={why[1]} tone={lens === "risk" ? "ok" : undefined} />;
  }
  return (
    <ListTable
      className="rounded-none ring-0"
      min="42rem"
      head={
        <tr>
          <th className="rail" />
          <th scope="col">Deal</th>
          <th scope="col">Stage</th>
          <th scope="col" className="n">Value</th>
          <th scope="col">Owner</th>
          <th scope="col">Signal</th>
        </tr>
      }
    >
      {rows.map((r) => <DealRow key={r.d.deal_id} {...r} today={today} />)}
    </ListTable>
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
        <Card tight>
          {ds === "loading" ? <PlotSkeleton tall />
            : ds === "error" ? <Empty title="Deals did not load." why={<Retry onPress={d.retryDeals} />} />
            : <Gone what="Deals" needs="deals access" />}
        </Card>
      </Section>
    );
  }

  const owners: BarRow[] = m!.byOwner.slice(0, 8).map((o) => ({
    key: o.name,
    label: <span className="flex min-w-0 items-center gap-2"><Avatar name={o.name} sm /><span className="truncate">{o.name}</span></span>,
    value: thousands(o.value), hint: <>{o.open} open · {o.won} won</>,
    title: inr(o.value) + " open · " + o.open + " deals · " + o.won + " won in period",
  }));
  const count = (n: number) => (n ? <span className="tnum text-quaternary"> {n}</span> : null);
  const lensOptions = [
    { v: "risk", l: <>At risk{count(m!.atRisk.length)}</> },
    { v: "soon", l: <>Closing soon{count(m!.closingSoon.length)}</> },
    { v: "value", l: "Highest value" },
    { v: "age", l: "Longest in stage" },
  ];

  return (
    <Section id="ov-deals" title="Deals"
      desc={m!.open + " open · " + inr(m!.openValue, { compact: true }) + (m!.avgWon !== null ? " · avg won " + inr(m!.avgWon, { compact: true }) : "")}
      right={<><Stamp clock={d.clocks.deals} /><Go to="#/deals?view=board">Pipeline</Go></>}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="overflow-hidden lg:col-span-2"
          flush
          tight
          title={<span className="inline-flex items-center gap-1.5">Deals that need a look<Tip k="lens" /></span>}
          sub={<Stamp clock={d.clocks.deals} />}
          right={<Segmented sm label="Lens" options={lensOptions} value={lens} onPick={(v) => setLens(v as Lens)} />}
        >
          <LensTable m={m!} lens={lens} today={today} />
        </Card>

        {/* The frame stretches to the table beside it so the two columns end
            on one line; with three or four owners in it the rows are centred
            rather than stranded at the top of an empty panel. */}
        <ChartFrame title={<span className="inline-flex items-center gap-1.5">By owner<Tip k="byowner" /></span>}>
          <div className="flex h-full flex-col justify-center">
            {owners.length
              ? <BarRows rows={owners} unit="₹ thousand of open pipeline" />
              : <Empty title="No owned deals." why="Deals without an owner do not appear here." />}
          </div>
        </ChartFrame>
      </div>
    </Section>
  );
}
