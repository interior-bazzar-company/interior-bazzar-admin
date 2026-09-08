/* =============================================================================
   Overview — the derivations. Pure, and the only arithmetic on the page.
   -----------------------------------------------------------------------------
   THE OVERVIEW OWNS NO RECORDS. Every figure here is computed from what the
   modules already hold — the Deals API's list, the Finance store, the Team
   store — by calling THEIR derivations wherever one exists (overview(),
   subTotals(), workTotals(), isDelayed(), attentionOf() …) so that a tile on
   this page and the module it drills into cannot disagree. What is new here is
   only the arithmetic no module does on its own: a period window, the
   comparison with the period before it, the join between a deal's owner and a
   team member, and the ranked attention list.

   FOUR CLOCKS, STATED. Deals and Enquiries are live and run on the real clock.
   Finance and Team are frontend-first seeds with their own fixed `asOf`, so
   "the last 30 days" lands on different calendar dates in each. Rather than
   pretend one clock, every function takes `today` as an argument, the page
   passes each source its own, and each section stamps the clock it ran on.
   The check suite pins `today` for the same reason the Enquiries clock check
   does — see scripts/check-overview.cjs.

   Everything takes `today` and returns plain data. No hook, no React, no
   fetch: scripts/check-overview.cjs bundles this file and asserts the rules.
   ============================================================================= */
import { STAGES } from "../Deals/adapter";
import { inr } from "../../ui/format";
import {
  atRisk, installmentRows, matchedPct, monthPoints, overview, refundQueue, runsNewestFirst,
  salaryTotals, subTotals,
} from "../Finance/store";
import type { MonthPoint, Overview as FinOverview, RiskRow, SubTotals } from "../Finance/store";
import {
  attendanceTotals, attentionOf, dayRows, isDelayed, isTerminal, leaveQueue, missingDocs,
  readAgreements, readItems, readLeave, readMembers, reviewRows, spanRows, spanTotals,
  unopenedAgreements, workTotals,
} from "../Team/store";
import type {
  Agreement, Attention, AttendanceState, AttendanceTotals, LeaveQueue, LeaveRequest, Member,
  SpanTotals, WorkItem, WorkTotals,
} from "../Team/store";
import metricsDoc from "../../../content/overview/metrics.json";

/* ------------------------------------------------------------ vocabulary --- */
export interface MetricDef { label: string; what: string; how: string; includes: string; period: string }
const METRICS = metricsDoc.metrics as Record<string, MetricDef>;
export const metric = (k: string): MetricDef | null => METRICS[k] || null;

/* ----------------------------------------------------------------- dates --- */
export const DAY = 86400000;
const parse = (d: string) => {
  const p = d.slice(0, 10).split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
};
const iso = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const addDays = (d: string, n: number) => { const x = parse(d); x.setDate(x.getDate() + n); return iso(x); };
/** Whole days from `a` to `b`; positive when `b` is later. */
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
export const todayLocal = () => iso(new Date());
const monthOf = (d: string) => d.slice(0, 7);
const monthEnd = (m: string) => { const [y, mo] = m.split("-").map(Number); return iso(new Date(y, mo, 0)); };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (d: string) => Number(d.slice(8, 10)) + " " + MONTHS[Number(d.slice(5, 7)) - 1];
export const shortMonth = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
const dateOnly = (v: string | null | undefined) => (v ? v.slice(0, 10) : null);

/* ---------------------------------------------------------------- period --- */
export type PeriodKey = "7d" | "30d" | "3m" | "6m" | "12m" | "custom";
export type Grain = "day" | "week" | "month";
export const PRESETS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "3m", label: "3 months", days: 91 },
  { key: "6m", label: "6 months", days: 182 },
  { key: "12m", label: "12 months", days: 365 },
];
export interface Period {
  key: PeriodKey; from: string; to: string; prevFrom: string; prevTo: string;
  days: number; grain: Grain; label: string;
}

/** The window a period key means, ending at `today` for that source's clock.
 *  A custom range is absolute — the same dates on every clock — and a custom
 *  range that is missing or inverted falls back to 30 days rather than to an
 *  empty chart. The previous period is the same number of days immediately
 *  before, so every "vs previous" on the page compares like with like. */
export function periodFor(key: string | undefined, today: string, from?: string, to?: string): Period {
  let k: PeriodKey = "30d";
  let f = "", t = "";
  if (key === "custom" && from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to) {
    k = "custom"; f = from; t = to;
  } else {
    const preset = PRESETS.find((p) => p.key === key) || PRESETS[1];
    k = preset.key; t = today; f = addDays(today, -(preset.days - 1));
  }
  const days = daysBetween(f, t) + 1;
  const grain: Grain = days <= 14 ? "day" : days <= 120 ? "week" : "month";
  const label = k === "custom" ? shortDate(f) + " – " + shortDate(t) : "last " + (PRESETS.find((p) => p.key === k) as { label: string }).label;
  return { key: k, from: f, to: t, prevFrom: addDays(f, -days), prevTo: addDays(f, -1), days, grain, label };
}

export interface Bucket { key: string; label: string; from: string; to: string }
/** The slices a period is charted in: days for a week, weeks for a quarter,
 *  months beyond that. Every slice is clipped to the period so the first and
 *  last never claim dates outside it. */
export function bucketsOf(p: Period): Bucket[] {
  const out: Bucket[] = [];
  if (p.grain === "month") {
    let m = monthOf(p.from);
    while (m <= monthOf(p.to)) {
      const f = m === monthOf(p.from) ? p.from : m + "-01";
      const t = m === monthOf(p.to) ? p.to : monthEnd(m);
      out.push({ key: m, label: shortMonth(m), from: f, to: t });
      const [y, mo] = m.split("-").map(Number);
      m = (mo === 12 ? y + 1 : y) + "-" + String(mo === 12 ? 1 : mo + 1).padStart(2, "0");
    }
    return out;
  }
  const step = p.grain === "day" ? 1 : 7;
  for (let f = p.from; f <= p.to; f = addDays(f, step)) {
    const t = addDays(f, step - 1) > p.to ? p.to : addDays(f, step - 1);
    out.push({ key: f, label: p.grain === "day" ? shortDate(f) : shortDate(f), from: f, to: t });
  }
  return out;
}
const inRange = (d: string | null | undefined, from: string, to: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
const bucketIndex = (bs: Bucket[], d: string | null | undefined) =>
  d ? bs.findIndex((b) => inRange(d, b.from, b.to)) : -1;

/** Percentage change, or null when there is nothing to compare against. */
export const pctChange = (now: number, before: number): number | null =>
  before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null;
/** Points of difference between two rates. */
export const ptsChange = (now: number | null, before: number | null): number | null =>
  now === null || before === null ? null : Math.round((now - before) * 10) / 10;

/* ----------------------------------------------------------------- deals --- */
/** The adapted deal row — the fields this page reads off `useDealsApi().list`. */
export interface DealRec {
  deal_id: string; customer_name: string; business_name: string;
  stage: number; priority: number; deal_value: number | null; owner_id: string | null;
  created_at: string | null; stage_since: string | null; expected_close_date: string | null;
  next_action: { date: string; note: string } | null; is_stalled: boolean;
  revenue_collected: number; outstanding: number;
}
const stageInt = (key: string) => Number(Object.keys(STAGES).find((k) => STAGES[Number(k)].key === key) || 0);
export const WON = stageInt("won");
export const LOST = stageInt("lost");
export const isOpen = (d: DealRec) => d.stage < WON;
const value = (d: DealRec) => d.deal_value || 0;
const sumValue = (ds: DealRec[]) => ds.reduce((a, d) => a + value(d), 0);

export type Reason = "stalled" | "next_overdue" | "close_passed";
export interface RiskDeal { d: DealRec; reason: Reason; days: number }
export interface FlowPoint { key: string; label: string; created: number; won: number; lost: number }
export interface OwnerRow { name: string; open: number; value: number; won: number; wonValue: number; collected: number }
export interface StageRow { stage: number; key: string; label: string; tone: string; n: number; value: number }
export interface DealMetrics {
  total: number; open: number; openValue: number; unquoted: number;
  stalled: number; stalledValue: number;
  won: { n: number; value: number }; wonPrev: { n: number; value: number };
  lost: { n: number }; lostPrev: { n: number };
  conversion: number | null; conversionPrev: number | null; avgWon: number | null;
  byStage: StageRow[]; byOwner: OwnerRow[];
  flow: FlowPoint[]; wonSeries: number[]; convSeries: number[];
  atRisk: RiskDeal[]; closingSoon: DealRec[]; biggest: DealRec[]; aging: DealRec[];
  expectedThisMonth: { n: number; value: number };
  collected: number; outstanding: number;
}

const closedIn = (ds: DealRec[], stage: number, from: string, to: string) =>
  ds.filter((d) => d.stage === stage && inRange(d.stage_since, from, to));
const rate = (won: number, lost: number) => (won + lost ? Math.round((won / (won + lost)) * 1000) / 10 : null);

export function dealMetrics(list: DealRec[], p: Period, today: string): DealMetrics {
  const open = list.filter(isOpen);
  const wonNow = closedIn(list, WON, p.from, p.to);
  const lostNow = closedIn(list, LOST, p.from, p.to);
  const wonPrev = closedIn(list, WON, p.prevFrom, p.prevTo);
  const lostPrev = closedIn(list, LOST, p.prevFrom, p.prevTo);
  const valued = wonNow.filter((d) => d.deal_value !== null);
  const stalled = open.filter((d) => d.is_stalled);

  const bs = bucketsOf(p);
  const flow: FlowPoint[] = bs.map((b) => ({ key: b.key, label: b.label, created: 0, won: 0, lost: 0 }));
  list.forEach((d) => {
    const c = bucketIndex(bs, d.created_at);
    if (c >= 0) flow[c].created += 1;
    if (d.stage === WON || d.stage === LOST) {
      const s = bucketIndex(bs, d.stage_since);
      if (s >= 0) flow[s][d.stage === WON ? "won" : "lost"] += 1;
    }
  });

  const owners = new Map<string, OwnerRow>();
  const ownerRow = (name: string) => {
    let r = owners.get(name);
    if (!r) { r = { name, open: 0, value: 0, won: 0, wonValue: 0, collected: 0 }; owners.set(name, r); }
    return r;
  };
  list.forEach((d) => {
    if (!d.owner_id) return;
    const r = ownerRow(d.owner_id);
    r.collected += d.revenue_collected || 0;
    if (isOpen(d)) { r.open += 1; r.value += value(d); }
  });
  wonNow.forEach((d) => { if (d.owner_id) { const r = ownerRow(d.owner_id); r.won += 1; r.wonValue += value(d); } });

  const byStage: StageRow[] = Object.keys(STAGES).map(Number).filter((s) => s !== LOST).sort((a, b) => a - b)
    .map((s) => {
      const at = list.filter((d) => d.stage === s);
      return { stage: s, key: STAGES[s].key, label: STAGES[s].label, tone: STAGES[s].tone, n: at.length, value: sumValue(at) };
    });

  const atRiskRows: RiskDeal[] = [];
  open.forEach((d) => {
    const close = dateOnly(d.expected_close_date);
    const next = d.next_action ? dateOnly(d.next_action.date) : null;
    if (d.is_stalled) atRiskRows.push({ d, reason: "stalled", days: d.stage_since ? daysBetween(d.stage_since, today) : 0 });
    else if (next && next < today) atRiskRows.push({ d, reason: "next_overdue", days: daysBetween(next, today) });
    else if (close && close < today) atRiskRows.push({ d, reason: "close_passed", days: daysBetween(close, today) });
  });
  atRiskRows.sort((a, b) => value(b.d) - value(a.d) || b.days - a.days);

  const soonTo = addDays(today, 14);
  const closingSoon = open.filter((d) => inRange(d.expected_close_date, today, soonTo))
    .sort((a, b) => String(a.expected_close_date).localeCompare(String(b.expected_close_date)) || value(b) - value(a));
  const biggest = open.slice().sort((a, b) => value(b) - value(a));
  const aging = open.filter((d) => d.stage_since).sort((a, b) => String(a.stage_since).localeCompare(String(b.stage_since)));
  const thisMonth = open.filter((d) => d.expected_close_date && monthOf(d.expected_close_date) === monthOf(today));

  return {
    total: list.length, open: open.length, openValue: sumValue(open),
    unquoted: open.filter((d) => d.deal_value === null).length,
    stalled: stalled.length, stalledValue: sumValue(stalled),
    won: { n: wonNow.length, value: sumValue(wonNow) }, wonPrev: { n: wonPrev.length, value: sumValue(wonPrev) },
    lost: { n: lostNow.length }, lostPrev: { n: lostPrev.length },
    conversion: rate(wonNow.length, lostNow.length), conversionPrev: rate(wonPrev.length, lostPrev.length),
    avgWon: valued.length ? Math.round(sumValue(valued) / valued.length) : null,
    byStage, byOwner: Array.from(owners.values()).sort((a, b) => b.value - a.value || b.open - a.open),
    flow, wonSeries: flow.map((f) => f.won),
    convSeries: flow.map((f) => (f.won + f.lost ? Math.round((f.won / (f.won + f.lost)) * 100) : 0)),
    atRisk: atRiskRows, closingSoon, biggest, aging,
    expectedThisMonth: { n: thisMonth.length, value: sumValue(thisMonth) },
    collected: list.reduce((a, d) => a + (d.revenue_collected || 0), 0),
    outstanding: list.reduce((a, d) => a + (d.outstanding || 0), 0),
  };
}

/* --------------------------------------------------------------- finance --- */
export interface MoneyPoint { key: string; label: string; collected: number; out: number; net: number }
export interface FinanceMetrics {
  cur: FinOverview; prev: FinOverview; totals: SubTotals; flow: MoneyPoint[]; months: MonthPoint[];
  risk: RiskRow[]; dueSoon: { n: number; paise: number }; overdue: { n: number; paise: number };
  failed: { n: number; paise: number }; refundsOwed: { n: number; paise: number }; refundsOpen: number;
  matched: number | null; bankUnexplained: number;
}
export function financeMetrics(p: Period, today: string): FinanceMetrics {
  const cur = overview(p.from, p.to);
  const prev = overview(p.prevFrom, p.prevTo);
  const flow = bucketsOf(p).map((b) => {
    const o = overview(b.from, b.to);
    return { key: b.key, label: b.label, collected: o.collectedPaise + o.otherInPaise, out: o.outPaise, net: o.netPaise };
  });
  const all = monthPoints();
  const want = Math.min(12, Math.max(3, Math.ceil(p.days / 30)));
  const months = all.slice(-want);
  const inst = installmentRows();
  const sum = (rows: typeof inst) => rows.reduce((a, r) => a + r.i.amountPaise, 0);
  const due = inst.filter((r) => r.i.status === "due");
  const soon = due.filter((r) => r.i.dueDate >= today && r.i.dueDate <= addDays(today, 30));
  const late = due.filter((r) => r.i.dueDate < today);
  const failed = inst.filter((r) => r.i.status === "fail_to_pay");
  const rq = refundQueue();
  const risk = atRisk(p.from, p.to);
  const unexplained = risk.find((r) => r.key === "unexplained");
  return {
    cur, prev, totals: subTotals(), flow, months, risk,
    dueSoon: { n: soon.length, paise: sum(soon) }, overdue: { n: late.length, paise: sum(late) },
    failed: { n: failed.length, paise: sum(failed) },
    refundsOwed: { n: rq.approved.length, paise: rq.approved.reduce((a, r) => a + r.r.amountPaise, 0) },
    refundsOpen: rq.open.length, matched: matchedPct(),
    bankUnexplained: unexplained ? Number(String(unexplained.count).replace(/\D/g, "")) || 0 : 0,
  };
}

export interface Payroll { owedPaise: number; people: number; openRun: string | null; openRunPaise: number }
/** Read only when the session holds Salaries A/C — the caller gates it. */
export function payrollMetrics(): Payroll {
  const t = salaryTotals();
  const open = runsNewestFirst().find((r) => r.state === "open") || null;
  return { owedPaise: t.unpaidPaise, people: t.unpaidPeople, openRun: open ? open.month : null, openRunPaise: open ? open.totalNetPaise : 0 };
}

/* ------------------------------------------------------------------ team --- */
export interface OwnerStat { open: number; won: number; value: number; collected: number }
export interface TeamRow {
  m: Member; open: number; late: number; done: number; dueWeek: number;
  onTime: number | null; state: AttendanceState | null; deals: OwnerStat | null;
}
export interface TeamMetrics {
  members: Member[]; departments: string[]; today: AttendanceTotals; work: WorkTotals; span: SpanTotals;
  done: number; dueWeek: number; rows: TeamRow[]; maxOpen: number; attention: Attention; leave: LeaveQueue;
  unopened: Agreement[]; expiring: Agreement[]; docsMissing: { m: Member; missing: string[] }[];
  onLeaveSoon: LeaveRequest[]; dueSoonByMember: { m: Member; n: number }[];
}
export function teamMetrics(p: Period, today: string, dept: string | undefined, owners: Map<string, OwnerStat>): TeamMetrics {
  const active = readMembers().filter((m) => m.status === "active");
  const departments = Array.from(new Set(active.map((m) => m.department).filter(Boolean))).sort();
  const members = dept ? active.filter((m) => m.department === dept) : active;
  const ids = new Set(members.map((m) => m.memberId));
  const items = readItems().filter((i) => ids.has(i.assigneeId));
  const openItems = items.filter((i) => !isTerminal(i.status));
  const weekTo = addDays(today, 7);
  const dueWeekOf = (rows: WorkItem[]) => rows.filter((i) => !isTerminal(i.status) && !!i.dueDate && i.dueDate >= today && i.dueDate <= weekTo);
  const doneOf = (rows: WorkItem[]) => rows.filter((i) => i.status === "completed" && inRange(i.completedAt, p.from, p.to));
  const day = dayRows(today, "all").filter((r) => ids.has(r.member.memberId));
  const span = spanRows(p.from, p.to, "all").filter((r) => ids.has(r.member.memberId));
  const review = reviewRows(today, "all").filter((r) => ids.has(r.member.memberId));
  const rows: TeamRow[] = members.map((m) => {
    const mine = items.filter((i) => i.assigneeId === m.memberId);
    const sp = span.find((r) => r.member.memberId === m.memberId);
    const d = day.find((r) => r.member.memberId === m.memberId);
    return {
      m, open: mine.filter((i) => !isTerminal(i.status)).length, late: mine.filter((i) => isDelayed(i, today)).length,
      done: doneOf(mine).length, dueWeek: dueWeekOf(mine).length,
      onTime: sp && sp.present ? Math.round(((sp.present - sp.late) / sp.present) * 100) : null,
      state: d ? d.state : null, deals: owners.get(m.memberId) || owners.get(m.name) || null,
    };
  }).sort((a, b) => (b.deals?.collected || 0) - (a.deals?.collected || 0) || b.done - a.done || a.late - b.late);
  const expTo = addDays(today, 7);
  return {
    members, departments, today: attendanceTotals(day), work: workTotals(items), span: spanTotals(span),
    done: doneOf(items).length, dueWeek: dueWeekOf(items).length, rows,
    maxOpen: Math.max(0, ...rows.map((r) => r.open)), attention: attentionOf(review), leave: leaveQueue("all"),
    unopened: unopenedAgreements("all").filter((a) => ids.has(a.memberId)),
    expiring: readAgreements().filter((a) => (a.state === "sent" || a.state === "viewed") && !!a.expiresAt
      && a.expiresAt.slice(0, 10) >= today && a.expiresAt.slice(0, 10) <= expTo && ids.has(a.memberId)),
    docsMissing: members.map((m) => ({ m, missing: missingDocs(m.memberId) })).filter((x) => x.missing.length),
    onLeaveSoon: readLeave().filter((l) => l.state === "approved" && ids.has(l.memberId) && l.toDate >= today && l.fromDate <= addDays(today, 14)),
    dueSoonByMember: members.map((m) => ({ m, n: dueWeekOf(openItems.filter((i) => i.assigneeId === m.memberId)).length }))
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n),
  };
}

/* ---------------------------------------------------------------- health --- */
export type Tone = "ok" | "warn" | "bad" | "mute";
export interface HealthCell { key: string; label: string; tone: Tone; why: string; to: string }
export function healthOf(deals: DealMetrics | null, fin: FinanceMetrics | null, team: TeamMetrics | null): HealthCell[] {
  const out: HealthCell[] = [];
  if (deals) {
    const share = deals.open ? (deals.stalled / deals.open) * 100 : null;
    out.push({
      key: "pipeline", label: "Pipeline", to: "#/deals?stalled=1",
      tone: share === null ? "mute" : share < 15 ? "ok" : share < 35 ? "warn" : "bad",
      why: share === null ? "no open deals" : deals.stalled + " of " + deals.open + " open deals stalled",
    });
  }
  if (fin) {
    out.push({
      key: "collections", label: "Collections", to: "#/finance?flag=" + (fin.failed.n ? "failed" : "due"),
      tone: fin.failed.n ? "bad" : fin.overdue.n ? "warn" : "ok",
      why: fin.failed.n ? fin.failed.n + " failed installment" + (fin.failed.n === 1 ? "" : "s")
        : fin.overdue.n ? fin.overdue.n + " installment" + (fin.overdue.n === 1 ? "" : "s") + " past due" : "nothing failed or past due",
    });
  }
  if (team) {
    const ot = team.span.onTimePct;
    out.push({
      key: "team", label: "Team", to: "#/attendance?face=history",
      tone: ot === null ? "mute" : ot >= 85 ? "ok" : ot >= 65 ? "warn" : "bad",
      why: ot === null ? "no attendance in the period" : Math.round(ot) + "% arrived on time",
    });
    const share = team.work.total - team.work.completed - team.work.cancelled;
    const pct = share ? (team.work.delayed / share) * 100 : null;
    out.push({
      key: "delivery", label: "Delivery", to: "#/work?status=delayed",
      tone: pct === null ? "mute" : pct < 10 ? "ok" : pct < 30 ? "warn" : "bad",
      why: pct === null ? "no open tasks" : team.work.delayed + " of " + share + " open tasks overdue",
    });
  }
  return out;
}

/* ------------------------------------------------------------- attention --- */
export type Severity = "bad" | "warn" | "info";
export type Area = "deals" | "finance" | "team";
export interface AttentionItem {
  id: string; severity: Severity; area: Area; title: string; sub: string; metric: string;
  to: string; toLabel: string; rank: number;
}
const SEV: Record<Severity, number> = { bad: 0, warn: 1, info: 2 };
const plural = (n: number, one: string, many?: string) => n + " " + (n === 1 ? one : many || one + "s");
const cmp = (v: number) => inr(v, { compact: true });
/** A deal is "big" for ranking when it sits in the top quarter of the open
 *  pipeline by value; with fewer than four deals every valued deal is big. */
const bigLine = (deals: DealMetrics) => {
  const vs = deals.biggest.map(value).filter((v) => v > 0);
  return vs.length >= 4 ? vs[Math.floor(vs.length / 4)] : 0;
};

export function attentionItems(deals: DealMetrics | null, fin: FinanceMetrics | null, pay: Payroll | null,
  team: TeamMetrics | null, today: string): AttentionItem[] {
  const out: AttentionItem[] = [];
  const push = (i: Omit<AttentionItem, "rank"> & { rank?: number }) => out.push({ rank: 0, ...i });

  if (deals) {
    const big = bigLine(deals);
    deals.atRisk.forEach(({ d, reason, days }) => {
      const v = value(d);
      const who = d.customer_name + (d.business_name ? " · " + d.business_name : "");
      const stage = STAGES[d.stage] ? STAGES[d.stage].label : "";
      const title = reason === "stalled" ? (v ? cmp(v) + " deal stalled" : "Deal stalled")
        : reason === "next_overdue" ? (v ? cmp(v) + " deal — next action " + plural(days, "day") + " late" : "Next action " + plural(days, "day") + " late")
        : (v ? cmp(v) + " deal past its close date" : "Deal past its close date");
      push({
        id: "deal:" + d.deal_id, area: "deals", severity: v >= big && big > 0 ? "bad" : "warn",
        title, sub: who + " · " + stage, metric: reason === "stalled" ? plural(days, "day") + " in stage" : plural(days, "day") + " over",
        to: "#/deals/" + encodeURIComponent(d.deal_id), toLabel: "View deal", rank: v,
      });
    });
    if (deals.conversionPrev !== null && deals.conversion !== null && deals.conversion <= deals.conversionPrev - 15) {
      push({
        id: "deals:conversion", area: "deals", severity: "warn", title: "Conversion fell " + (deals.conversionPrev - deals.conversion).toFixed(0) + " points",
        sub: "Won share of closed deals vs the previous period", metric: deals.conversion + "% from " + deals.conversionPrev + "%",
        to: "#/deals?view=board", toLabel: "Pipeline",
      });
    }
  }
  if (fin) {
    if (fin.failed.n) push({
      id: "fin:failed", area: "finance", severity: "bad", title: cmp(fin.failed.paise) + " failed to pay",
      sub: plural(fin.failed.n, "installment") + " bounced and not retried", metric: inr(fin.failed.paise),
      to: "#/finance?flag=failed", toLabel: "Subscriptions", rank: fin.failed.paise,
    });
    if (fin.overdue.n) push({
      id: "fin:overdue", area: "finance", severity: "warn", title: cmp(fin.overdue.paise) + " past due",
      sub: plural(fin.overdue.n, "installment") + " due and unpaid", metric: inr(fin.overdue.paise),
      to: "#/finance?flag=due", toLabel: "Subscriptions", rank: fin.overdue.paise,
    });
    if (fin.refundsOwed.n) push({
      id: "fin:refunds", area: "finance", severity: "warn", title: cmp(fin.refundsOwed.paise) + " refund approved, not paid",
      sub: plural(fin.refundsOwed.n, "refund") + " waiting on settlement", metric: inr(fin.refundsOwed.paise),
      to: "#/finance-refunds?flag=owed", toLabel: "Refunds", rank: fin.refundsOwed.paise,
    });
    if (fin.refundsOpen) push({
      id: "fin:refund-requests", area: "finance", severity: "info", title: plural(fin.refundsOpen, "refund request") + " to decide",
      sub: "Requested and not yet approved or declined", metric: String(fin.refundsOpen),
      to: "#/finance-refunds", toLabel: "Refunds",
    });
    if (fin.bankUnexplained) push({
      id: "fin:bank", area: "finance", severity: "warn", title: plural(fin.bankUnexplained, "bank line") + " unexplained",
      sub: "The statement window cannot close", metric: fin.matched === null ? "—" : Math.round(fin.matched) + "% matched",
      to: "#/finance-analytics", toLabel: "Reconciliation",
    });
    const drop = pctChange(fin.cur.collectedPaise + fin.cur.otherInPaise, fin.prev.collectedPaise + fin.prev.otherInPaise);
    if (drop !== null && drop <= -20) push({
      id: "fin:collections", area: "finance", severity: "warn", title: "Collections down " + Math.abs(drop).toFixed(0) + "%",
      sub: "Against the previous period of the same length", metric: inr(fin.cur.collectedPaise + fin.cur.otherInPaise),
      to: "#/finance-analytics", toLabel: "Analytics",
    });
  }
  if (pay && pay.openRun) push({
    id: "fin:payroll", area: "finance", severity: pay.owedPaise ? "warn" : "info", title: "Payroll " + pay.openRun + " still open",
    sub: pay.people ? plural(pay.people, "person", "people") + " not yet paid" : "Run created, nothing paid yet",
    metric: inr(pay.openRunPaise), to: "#/finance-salaries", toLabel: "Salaries A/C", rank: pay.openRunPaise,
  });
  if (team) {
    const a = team.attention;
    a.delayed.filter((i) => i.priority === "urgent" || i.priority === "high").slice(0, 6).forEach((i) => {
      const who = team.members.find((m) => m.memberId === i.assigneeId);
      const over = i.dueDate ? daysBetween(i.dueDate, today) : 0;
      push({
        id: "work:" + i.itemId, area: "team", severity: i.priority === "urgent" ? "bad" : "warn",
        title: (i.priority === "urgent" ? "Urgent" : "High-priority") + " task " + plural(over, "day") + " overdue",
        sub: i.title + (who ? " · " + who.name : ""), metric: plural(over, "day"),
        to: "#/work?item=" + encodeURIComponent(i.itemId), toLabel: "Open task", rank: over,
      });
    });
    team.rows.filter((r) => r.late >= 3).forEach((r) => push({
      id: "load:" + r.m.memberId, area: "team", severity: "warn", title: r.m.name + " has " + plural(r.late, "overdue item"),
      sub: plural(r.open, "open item") + " in hand", metric: r.late + " late",
      to: "#/work?member=" + r.m.memberId + "&face=board", toLabel: "Their board", rank: r.late,
    }));
    if (a.noEod.length) push({
      id: "team:eod", area: "team", severity: "warn", title: plural(a.noEod.length, "end-of-day report") + " owed",
      sub: a.noEod.map((r) => r.member.name.split(" ")[0]).slice(0, 4).join(", ") + (a.noEod.length > 4 ? "…" : ""),
      metric: String(a.noEod.length), to: "#/reports?face=actions", toLabel: "Reports",
    });
    if (a.noPlan.length) push({
      id: "team:plan", area: "team", severity: "info", title: plural(a.noPlan.length, "member") + " started without a plan",
      sub: a.noPlan.map((r) => r.member.name.split(" ")[0]).slice(0, 4).join(", ") + (a.noPlan.length > 4 ? "…" : ""),
      metric: String(a.noPlan.length), to: "#/reports", toLabel: "Reports",
    });
    if (a.unacknowledged.length) push({
      id: "team:unread", area: "team", severity: "info", title: plural(a.unacknowledged.length, "report") + " not yet read",
      sub: "Submitted and waiting on a manager", metric: String(a.unacknowledged.length),
      to: "#/reports?face=actions", toLabel: "Reports",
    });
    if (team.today.unclosed) push({
      id: "team:unclosed", area: "team", severity: "warn", title: plural(team.today.unclosed, "day") + " never closed",
      sub: "A shift left open past its auto-close time", metric: String(team.today.unclosed),
      to: "#/attendance", toLabel: "Attendance",
    });
    if (team.leave.total) push({
      id: "team:leave", area: "team", severity: "info", title: plural(team.leave.total, "leave request") + " waiting",
      sub: team.leave.unrouted.length ? team.leave.unrouted.length + " with nobody to decide it" : "On a manager's desk",
      metric: String(team.leave.total), to: "#/reports?face=actions", toLabel: "Decide",
    });
    team.expiring.forEach((ag) => {
      const who = team.members.find((m) => m.memberId === ag.memberId);
      push({
        id: "agr:" + ag.agreementId, area: "team", severity: "warn", title: "Agreement expires in " + plural(daysBetween(today, String(ag.expiresAt).slice(0, 10)), "day"),
        sub: ag.title + (who ? " · " + who.name : ""), metric: ag.state === "sent" ? "unopened" : "viewed, unsigned",
        to: "#/agreements", toLabel: "Agreements",
      });
    });
  }
  return out.sort((a, b) => SEV[a.severity] - SEV[b.severity] || b.rank - a.rank || a.title.localeCompare(b.title));
}

/* --------------------------------------------------------------- signals --- */
export interface Signal {
  id: string; title: string; value: string; sub: string; tone?: Tone; to?: string; toLabel?: string; spark?: number[];
}
export function planningSignals(deals: DealMetrics | null, fin: FinanceMetrics | null, pay: Payroll | null,
  team: TeamMetrics | null, dealsToday: string): Signal[] {
  const out: Signal[] = [];
  if (deals) {
    const e = deals.expectedThisMonth;
    out.push({
      id: "close", title: "Expected to close in " + MONTHS[Number(dealsToday.slice(5, 7)) - 1],
      value: e.n ? cmp(e.value) : "—", sub: e.n ? plural(e.n, "open deal") + " with a close date this month" : "no open deal has a close date this month",
      tone: e.n ? undefined : "mute", to: "#/deals?sort=close", toLabel: "By close date",
    });
    const top = deals.biggest.filter((d) => value(d) > 0).slice(0, 3);
    if (top.length) out.push({
      id: "big", title: "Largest open deals", value: cmp(sumValue(top)),
      sub: top.map((d) => d.customer_name + " " + cmp(value(d)) + (d.expected_close_date ? " · " + shortDate(d.expected_close_date) : "")).join(" · "),
      to: "#/deals?sort=value", toLabel: "By value",
    });
  }
  if (fin) {
    const last = fin.months.slice(-3);
    if (last.length >= 2) {
      const a = last[0].netPaise, b = last[last.length - 1].netPaise;
      const dir = b > a ? "rising" : b < a ? "falling" : "flat";
      out.push({
        id: "trajectory", title: "Net cash trajectory", value: dir, tone: dir === "falling" ? "warn" : dir === "rising" ? "ok" : "mute",
        sub: last.map((m) => shortMonth(m.month) + " " + cmp(m.netPaise)).join(" → "), spark: last.map((m) => Math.round(m.netPaise / 100)),
        to: "#/finance-analytics", toLabel: "Analytics",
      });
    }
    const owed = fin.dueSoon.paise + (pay ? pay.owedPaise : 0);
    out.push({
      id: "obligations", title: "Next 30 days", value: owed ? cmp(owed) : "—",
      sub: [fin.dueSoon.n ? cmp(fin.dueSoon.paise) + " due from " + plural(fin.dueSoon.n, "installment") : "no installments fall due",
        pay ? (pay.owedPaise ? cmp(pay.owedPaise) + " payroll owed" : "payroll clear") : "payroll not in your access"].join(" · "),
      to: "#/finance?flag=due", toLabel: "Due",
    });
  }
  if (team) {
    const load = team.dueSoonByMember.slice(0, 3);
    out.push({
      id: "workload", title: "Due in the next 7 days", value: team.dueWeek ? plural(team.dueWeek, "item") : "—",
      sub: load.length ? load.map((x) => x.m.name.split(" ")[0] + " " + x.n).join(" · ") : "nothing is due this week",
      tone: team.dueWeek ? undefined : "mute", to: "#/work?due=week", toLabel: "This week",
    });
    const away = team.onLeaveSoon;
    out.push({
      id: "capacity", title: "Away in the next 14 days", value: away.length ? plural(away.length, "member") : "nobody",
      sub: away.length ? away.map((l) => (team.members.find((m) => m.memberId === l.memberId)?.name.split(" ")[0] || "?") + " " + shortDate(l.fromDate) + "–" + shortDate(l.toDate)).join(" · ") : "no approved leave ahead",
      tone: away.length ? "warn" : "mute", to: "#/attendance", toLabel: "Attendance",
    });
  }
  return out;
}
