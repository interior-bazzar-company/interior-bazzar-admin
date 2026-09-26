/* =============================================================================
   Overview — the executive snapshot's live sources (d3, 2026-09-11).
   -----------------------------------------------------------------------------
   Collected, Receivable and the Collections / Team / Delivery health cells used
   to be read off the Finance and Team seed stores. They now read the backend,
   on the REAL clock:

     Collected   deal payments (paymentDate; a payment and its reversal cancel
                 out, whatever their dates) + plan purchases (PAID or REFUNDED,
                 by verifiedAt, at their full amount — see planCashPaise — ₹0
                 free plans are not payments) + other income (recorded, by
                 valueDate, every kind).
                 "N payments" counts the first two only — income is not a
                 customer payment.
     Receivable  installments still due or failed whose due date is in the
                 period.
     Collections failed installments, whatever their due date.
     Team        attendance days in the period: present = not unclosed,
                 on time = present and not late.
     Delivery    every task: delayed over open (not completed / cancelled).

   The Finance section (d5) reads financeLive.ts and the attention list (d6)
   reads both files; Operations (d7) reads useOperationsLive below; the planning
   signals (d8) read the deals list, the Finance section's reads, Operations and
   useSignalsLive below -- no seed store any more.

   Nothing is invented: a source that has not answered is `loading`, a refusal
   or failure is `error`, and no rows is a real zero or the health cell's own
   "no …" wording — never a seed figure in its place.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type {
  AdminUserRow, AgreementRow, AttendanceDayRow, DailyPlanRow, DailyReportRow, DealPaymentRow, IncomeRow, InstallmentRow,
  LeaveRow, OverviewOperations, OverviewSignals, PlanPaymentRow, PlanPaymentsListResponse, RefundRow, WorkItemRow,
  WorkSettingsRow,
} from "../../../api/modules/adminOps";
import { addDays, healthOf, todayLocal } from "./derive";
/* ONE ON-TIME RULE for the whole panel — Attendance Analytics owns it, this
   page reads it, so "76% arrived on time" and "ON TIME 0%" can only ever
   differ by the days each one counts, never by the arithmetic. */
import { onTimePctOf } from "../Team/store";
import type { AttentionTeam, DealMetrics, HealthCell, OwnerStat, Period } from "./derive";

export type LiveState = "off" | "loading" | "ready" | "error";

interface Raw {
  ledger: DealPaymentRow[]; plans: PlanPaymentRow[]; income: IncomeRow[]; installments: InstallmentRow[];
  /** Plan payments that have a SETTLED refund request — see planCashPaise. */
  settled: Set<number>;
  days: AttendanceDayRow[]; work: WorkItemRow[];
  /** Tasks FINISHED inside the period, asked of the server by completion date
   *  (overview/d4). `work` above stays the whole book, which is what the
   *  Delivery health cell and the open / overdue counts read. */
  doneWork: WorkItemRow[];
}
const NONE: Raw = { ledger: [], plans: [], income: [], installments: [], settled: new Set(), days: [], work: [], doneWork: [] };

/** Every page of a list endpoint. ponytail: sequential pages; fine at
 *  hundreds of rows, parallelise if a list ever runs to thousands. */
export async function every<R extends { total: number }, T>(page: (pageNo: number) => Promise<R>, pick: (r: R) => T[]): Promise<T[]> {
  const out: T[] = [];
  for (let n = 1; ; n++) {
    const got = await page(n);
    const rows = pick(got) || [];
    out.push(...rows);
    if (!rows.length || out.length >= got.total) return out;
  }
}

/** The rows the snapshot needs, fetched once per window. Money covers the
 *  previous period too (for "vs prev"); team covers the period. */
export function useLive(p: Period, on: { money: boolean; team: boolean }) {
  const [s, setS] = useState<{ money: LiveState; team: LiveState; raw: Raw }>(
    { money: on.money ? "loading" : "off", team: on.team ? "loading" : "off", raw: NONE });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    const span = { start: p.prevFrom, end: p.to };
    setS((x) => ({ ...x, money: on.money ? "loading" : "off", team: on.team ? "loading" : "off" }));
    if (on.money) {
      Promise.all([
        every((n) => call(AdminOpsService.dealPayments({ ...span, pageNo: n, pageSize: 200 })), (r) => r.payments),
        every((n) => call<PlanPaymentsListResponse>(AdminOpsService.payments({ ...span, status: "PAID,REFUNDED", pageNo: n, pageSize: 100 })), (r) => r.payments),
        every((n) => call(AdminOpsService.income({ ...span, state: "recorded", pageNo: n, pageSize: 500 })), (r) => r.income),
        every((n) => call(AdminOpsService.installments({ status: "due,failed", pageNo: n, pageSize: 500 })), (r) => r.installments),
        /* Refused (no refunds grant) is an empty set: every REFUNDED payment
           then nets its refund off, which is the only place it is counted. */
        every((n) => call(AdminOpsService.refunds({ pageNo: n, pageSize: 500 })), (r) => r.refunds).catch(() => [] as RefundRow[]),
      ]).then(([ledger, plans, income, installments, refunds]) => {
        const settled = settledRefundPayments(refunds);
        if (live) setS((x) => ({ ...x, money: "ready", raw: { ...x.raw, ledger, plans, income, installments, settled } }));
      }).catch(() => { if (live) setS((x) => ({ ...x, money: "error" })); });
    }
    if (on.team) {
      Promise.all([
        /* includeMissing: the table has to show who did NOT come in, and an
           absence is the lack of a row — see AttendanceDayRow. */
        every((n) => call(AdminOpsService.attendanceDays({
          member: "all", start: p.from, end: p.to, includeMissing: "1", pageNo: n, pageSize: 1000 })), (r) => r.days),
        every((n) => call(AdminOpsService.work({ assignee: "all", pageNo: n, pageSize: 500 })), (r) => r.items),
        every((n) => call(AdminOpsService.work({
          assignee: "all", status: "completed", completedFrom: p.from, completedTo: p.to, pageNo: n, pageSize: 500 })), (r) => r.items),
      ]).then(([days, work, doneWork]) => {
        if (live) setS((x) => ({ ...x, team: "ready", raw: { ...x.raw, days, work, doneWork } }));
      }).catch(() => { if (live) setS((x) => ({ ...x, team: "error" })); });
    }
    return () => { live = false; };
  }, [p.prevFrom, p.from, p.to, on.money, on.team, nonce]);

  return { ...s, retry: () => setNonce((n) => n + 1) };
}

/* ------------------------------------------------------------------ money --- */
/** Local calendar date of an ISO timestamp (verifiedAt is UTC on the wire). */
export const ymd = (v: string | null | undefined) => {
  if (!v) return "";
  if (v.length <= 10) return v;
  const d = new Date(v);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
export const within = (d: string, from: string, to: string) => !!d && d >= from && d <= to;
/** "19500.0" rupees -> 1950000 paise. */
export const paiseOf = (rupees: string | null | undefined) => Math.round((parseFloat(rupees || "0") || 0) * 100);

/** The plan payments a settled refund request points at. */
export const settledRefundPayments = (refunds: { settledAt: string | null; payment: { id: number } | null }[]) =>
  new Set(refunds.filter((r) => !!r.settledAt && !!r.payment).map((r) => (r.payment as { id: number }).id));

/** A plan purchase's cash IN, in paise — its full amount. THE ONE RULE for it;
 *  the snapshot, the Finance section and Finance Analytics all call this.
 *
 *  A refund is money OUT on the day it is sent (its settled refund request),
 *  so it is not also taken off the payment: doing both took every refund off
 *  net twice. The exception is a payment marked REFUNDED with no settled
 *  request behind it — the one-step refund from before requests existed —
 *  which nothing else counts, so it still nets off here. The server's net-cash
 *  trajectory (SignalsController) applies the same rule. */
export const planCashPaise = (x: PlanPaymentRow, settled: Set<number>) =>
  paiseOf(x.amount) - (x.orderStatus === "REFUNDED" && !settled.has(x.id) ? paiseOf(x.refundAmount) : 0);

export interface MoneyWindow { collectedPaise: number; otherInPaise: number; collectedN: number }
export interface LiveMoney {
  cur: MoneyWindow; prev: MoneyWindow;
  totals: { outstandingPaise: number; dueN: number; failedN: number };
  failed: { n: number; paise: number }; overdue: { n: number; paise: number };
}

function windowOf(r: Raw, from: string, to: string): MoneyWindow {
  const deal = r.ledger.filter((x) => x.type === "payment" && !x.reversed && within(ymd(x.paymentDate), from, to));
  const plans = r.plans
    .map((x) => ({ at: ymd(x.verifiedAt), net: planCashPaise(x, r.settled) }))
    .filter((x) => x.net > 0 && within(x.at, from, to));
  const income = r.income.filter((x) => within(ymd(x.valueDate), from, to));
  return {
    collectedPaise: deal.reduce((a, x) => a + x.amountPaise, 0) + plans.reduce((a, x) => a + x.net, 0),
    otherInPaise: income.reduce((a, x) => a + x.amountPaise, 0),
    collectedN: deal.length + plans.length,
  };
}

export function liveMoney(r: Raw, p: Period): LiveMoney {
  const owed = r.installments.filter((x) => within(x.dueDate, p.from, p.to));
  const isFailed = (x: InstallmentRow) => x.status?.key === "failed";
  const failed = r.installments.filter(isFailed);
  const today = todayLocal();
  const overdue = r.installments.filter((x) => x.status?.key === "due" && x.dueDate < today);
  const sum = (xs: InstallmentRow[]) => xs.reduce((a, x) => a + x.amountPaise, 0);
  return {
    cur: windowOf(r, p.from, p.to), prev: windowOf(r, p.prevFrom, p.prevTo),
    totals: { outstandingPaise: sum(owed), dueN: owed.filter((x) => !isFailed(x)).length, failedN: owed.filter(isFailed).length },
    failed: { n: failed.length, paise: sum(failed) }, overdue: { n: overdue.length, paise: sum(overdue) },
  };
}

/* ------------------------------------------------------------------- team --- */
export interface LiveTeam {
  span: { onTimePct: number | null };
  work: { total: number; completed: number; cancelled: number; delayed: number };
}

/** `dept` is a ROLE name (see store.ts useDepartments): a member is in it when
 *  their account holds that role, the same rule the Team section applies. */
export function liveTeam(r: Raw, dept: string | undefined, rolesOf: Map<string, string[]>): LiveTeam {
  const inDept = (id: number) => !dept || (rolesOf.get(String(id)) || []).indexOf(dept) >= 0;
  /* PRESENT IS A DAY SOMEBODY OPENED. The list now also carries the days that
     do not exist (d4), and an absence is not an attendance: the start time is
     what separates them, and an unclosed day still counts for nobody. */
  const present = r.days.filter((d) => inDept(d.member.id) && !!d.startedAt && d.state.key !== "unclosed");
  const late = present.filter((d) => d.isLate).length;
  const items = r.work.filter((i) => inDept(i.assignee.id));
  const key = (i: WorkItemRow) => i.status?.key;
  return {
    span: { onTimePct: onTimePctOf(present.length, late) },
    work: {
      total: items.length,
      completed: items.filter((i) => key(i) === "completed").length,
      cancelled: items.filter((i) => key(i) === "cancelled").length,
      delayed: items.filter((i) => i.delayed).length,
    },
  };
}

/* ------------------------------------------------------------ team table --- */
const TERMINAL = ["completed", "cancelled"];

export interface TeamPerson { memberId: string; name: string; designation: string }
export interface TeamTableRow {
  m: TeamPerson; open: number; late: number; done: number;
  onTime: number | null; stateLabel: string; deals: OwnerStat | null;
}
export interface LiveTeamTable { members: TeamPerson[]; rows: TeamTableRow[]; maxOpen: number; done: number }

/** One row per ACTIVE member of the roster (`GET /admin/users/`), with their
 *  attendance and tasks for the period read off the same two lists the health
 *  strip uses. The backend has no job title — the subtitle is the role or
 *  roles the account holds, the same vocabulary the Department filter lists
 *  (overview/d1, d4 Q1). Deals and Collected keep coming from the deals API
 *  through `owners`, untouched. */
export function liveTeamRows(r: Raw, people: AdminUserRow[], dept: string | undefined,
  rolesOf: Map<string, string[]>, owners: Map<string, OwnerStat>, today: string): LiveTeamTable {
  const inDept = (id: string) => !dept || (rolesOf.get(id) || []).indexOf(dept) >= 0;
  const members = people.filter((u) => u.isActive !== false && inDept(String(u.id)));
  const rows: TeamTableRow[] = members.map((u) => {
    const id = String(u.id);
    const mine = r.work.filter((i) => String(i.assignee.id) === id);
    const days = r.days.filter((d) => String(d.member.id) === id);
    const present = days.filter((d) => !!d.startedAt && d.state.key !== "unclosed");
    const late = present.filter((d) => d.isLate).length;
    const now = days.filter((d) => d.businessDate === today)[0];
    return {
      m: { memberId: id, name: u.name || u.username, designation: (rolesOf.get(id) || []).join(" · ") },
      open: mine.filter((i) => TERMINAL.indexOf(i.status?.key) < 0).length,
      late: mine.filter((i) => i.delayed).length,
      done: r.doneWork.filter((i) => String(i.assignee.id) === id).length,
      onTime: onTimePctOf(present.length, late),
      /* The day's name is the backend's own label (team/d2), weekly off
         included -- not a list kept here (d14). */
      stateLabel: now ? now.state.label : "",
      deals: owners.get(id) || owners.get(u.name) || null,
    };
  }).sort((a, b) => (b.deals?.collected || 0) - (a.deals?.collected || 0) || b.done - a.done || a.late - b.late);
  const ids = members.map((u) => String(u.id));
  return {
    members: rows.map((x) => x.m), rows,
    maxOpen: Math.max(0, ...rows.map((x) => x.open)),
    done: r.doneWork.filter((i) => ids.indexOf(String(i.assignee.id)) >= 0).length,
  };
}

/* -------------------------------------------------------------- attention --- */
/** The attention list's team rows beyond what the table already reads
 *  (overview/d6): today's plans, reports and attendance, leave waiting,
 *  agreements running out within a week, and who answers to whom.
 *
 *  Each read is asked only when the session may see everybody's -- plans and
 *  reports on reports.acknowledge, the rest on full access -- and `asked`
 *  remembers which, so a read that was never made cannot turn into "nobody
 *  filed a plan". */
interface AttnRaw {
  asked: { reports: boolean; full: boolean };
  plans: DailyPlanRow[]; reports: DailyReportRow[]; days: AttendanceDayRow[]; leave: LeaveRow[];
  agreements: AgreementRow[]; settings: WorkSettingsRow[];
}
const ATTN_NONE: AttnRaw = {
  asked: { reports: false, full: false }, plans: [], reports: [], days: [], leave: [], agreements: [], settings: [] };

export function useAttentionLive(today: string, on: { reports: boolean; full: boolean }) {
  const [s, setS] = useState<{ state: LiveState; raw: AttnRaw }>(
    { state: on.reports || on.full ? "loading" : "off", raw: ATTN_NONE });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!on.reports && !on.full) { setS({ state: "off", raw: ATTN_NONE }); return; }
    let live = true;
    setS((x) => ({ ...x, state: "loading" }));
    const day = { start: today, end: today };
    const none = Promise.resolve([] as never[]);
    Promise.all([
      on.reports ? every((n) => call(AdminOpsService.dailyPlans({ member: "all", ...day, pageNo: n, pageSize: 500 })), (r) => r.plans) : none,
      on.reports ? every((n) => call(AdminOpsService.dailyReports({ member: "all", ...day, pageNo: n, pageSize: 500 })), (r) => r.reports) : none,
      on.full ? every((n) => call(AdminOpsService.attendanceDays({ member: "all", ...day, pageNo: n, pageSize: 1000 })), (r) => r.days) : none,
      on.full ? every((n) => call(AdminOpsService.leave({ member: "all", state: "requested,escalated", pageNo: n, pageSize: 500 })), (r) => r.leave) : none,
      on.full ? every((n) => call(AdminOpsService.agreements({
        member: "all", state: "sent,viewed", expiresFrom: today, expiresTo: addDays(today, 7), pageNo: n, pageSize: 500 })), (r) => r.agreements) : none,
      /* Own row only without full access -- which is then nobody's manager. */
      call(AdminOpsService.attendanceSettings()).then((r) => r.settings),
    ]).then(([plans, reports, days, leave, agreements, settings]) => {
      if (live) setS({ state: "ready", raw: { asked: { ...on }, plans, reports, days, leave, agreements, settings } });
    }).catch(() => { if (live) setS((x) => ({ ...x, state: "error" })); });
    return () => { live = false; };
  }, [today, on.reports, on.full, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...s, retry: () => setNonce((n) => n + 1) };
}

/* ------------------------------------------------------------ operations --- */
/** The Operations card (d7): one read, every count worked out on the server
 *  (GET overview/operations/). `forbidden` is a 403, which the card turns into
 *  its "needs access" line; any other refusal or failure is `error`. */
export type OpsState = LiveState | "forbidden";
export function useOperationsLive(p: Period, role: string | undefined) {
  const [s, setS] = useState<{ state: OpsState; data: OverviewOperations | null }>({ state: "loading", data: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setS({ state: "loading", data: null });
    AdminOpsService.overviewOperations({ start: p.from, end: p.to, role }).then((r) => {
      if (!live) return;
      if (r.response === false) setS({ state: r.code === 403 ? "forbidden" : "error", data: null });
      else setS({ state: "ready", data: r.data });
    }).catch(() => { if (live) setS({ state: "error", data: null }); });
    return () => { live = false; };
  }, [p.from, p.to, role, nonce]);

  return { ...s, retry: () => setNonce((n) => n + 1) };
}

/* --------------------------------------------------------------- signals --- */
/** Net cash by month + away soon for the planning signals (d8), one read
 *  (GET overview/signals/). Real clock; `role` narrows away. */
export function useSignalsLive(role: string | undefined) {
  const [s, setS] = useState<{ state: LiveState; data: OverviewSignals | null }>({ state: "loading", data: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setS({ state: "loading", data: null });
    AdminOpsService.overviewSignals({ role }).then((r) => {
      if (!live) return;
      setS(r.response === false ? { state: "error", data: null } : { state: "ready", data: r.data });
    }).catch(() => { if (live) setS({ state: "error", data: null }); });
    return () => { live = false; };
  }, [role, nonce]);

  return { ...s, retry: () => setNonce((n) => n + 1) };
}

/** The team half of attentionItems, off the live reads. Members are the Team
 *  table's (active, in the department), so every row here is about somebody
 *  the table lists. The rules are the panel's own (Team/store.ts attentionOf,
 *  eodDue, leaveQueue): a plan and an EOD are owed only by somebody who reports
 *  to someone, and an EOD only once their day has closed. */
export function attentionTeam(a: AttnRaw, work: WorkItemRow[], table: LiveTeamTable, now = new Date()): AttentionTeam {
  const ids = new Set(table.members.map((m) => m.memberId));
  const inDept = (id: number) => ids.has(String(id));
  const settings = new Map(a.settings.map((x) => [String(x.member.id), x]));
  const clock = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const filed = (rows: { member: { id: number }; submittedAt: string | null }[], id: string) =>
    rows.some((x) => String(x.member.id) === id && !!x.submittedAt);
  const owing = a.asked.reports ? table.members.filter((m) => settings.get(m.memberId)?.reportsTo) : [];
  return {
    members: table.members,
    rows: table.rows,
    attention: {
      delayed: work.filter((i) => i.delayed && inDept(i.assignee.id)).map((i) => ({
        itemId: String(i.id), title: i.title, assigneeId: String(i.assignee.id), priority: i.priority?.key, dueDate: i.dueDate })),
      noPlan: owing.filter((m) => !filed(a.plans, m.memberId)).map((m) => ({ member: m })),
      noEod: owing.filter((m) => clock > (settings.get(m.memberId)?.autoCloseAt || "20:00") && !filed(a.reports, m.memberId))
        .map((m) => ({ member: m })),
      unacknowledged: a.reports.filter((r) => inDept(r.member.id) && !!r.submittedAt && !r.acknowledgedAt),
    },
    today: { unclosed: a.days.filter((d) => inDept(d.member.id) && d.state.key === "unclosed").length },
    /* The whole queue, as the panel's leaveQueue("all") counted it. Nobody is
       outside an admin's scope, so nothing is ever "unrouted" from here. */
    leave: { total: a.leave.length, unrouted: [] },
    expiring: a.agreements.filter((x) => inDept(x.member.id)).map((x) => ({
      agreementId: String(x.id), memberId: String(x.member.id), title: x.title, expiresAt: x.expiresAt, state: x.state.key })),
  };
}

/* ----------------------------------------------------------------- health --- */
const ORDER = ["pipeline", "collections", "team", "delivery"];
const pending = (key: string, label: string, to: string, st: LiveState): HealthCell =>
  ({ key, label, to, tone: "mute", why: st === "loading" ? "loading…" : "could not load" });

/** healthOf on the live sources, with a cell that SAYS so while a source is
 *  answering or has failed — rather than the cell silently missing. */
export function liveHealth(deals: DealMetrics | null, money: LiveMoney | null, moneySt: LiveState,
  team: LiveTeam | null, teamSt: LiveState): HealthCell[] {
  const out = healthOf(deals, money, team);
  if (moneySt === "loading" || moneySt === "error") out.push(pending("collections", "Collections", "#/finance?flag=due", moneySt));
  if (teamSt === "loading" || teamSt === "error") {
    out.push(pending("team", "Team", "#/attendance?face=history", teamSt));
    out.push(pending("delivery", "Delivery", "#/work?status=delayed", teamSt));
  }
  return out.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}
