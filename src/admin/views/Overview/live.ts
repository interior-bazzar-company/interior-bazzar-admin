/* =============================================================================
   Overview — the executive snapshot's live sources (d3, 2026-09-11).
   -----------------------------------------------------------------------------
   Collected, Receivable and the Collections / Team / Delivery health cells used
   to be read off the Finance and Team seed stores. They now read the backend,
   on the REAL clock:

     Collected   deal payments (paymentDate; a payment and its reversal cancel
                 out, whatever their dates) + plan purchases (PAID or REFUNDED,
                 by verifiedAt, rupees less any refund, ₹0 free plans are not
                 payments) + other income (recorded, by valueDate, every kind).
                 "N payments" counts the first two only — income is not a
                 customer payment.
     Receivable  installments still due or failed whose due date is in the
                 period.
     Collections failed installments, whatever their due date.
     Team        attendance days in the period: present = not unclosed,
                 on time = present and not late.
     Delivery    every task: delayed over open (not completed / cancelled).

   The rest of the page (Finance section, attention list, signals) still reads
   the seed stores through `fin` / `team` in store.ts and is untouched here.

   Nothing is invented: a source that has not answered is `loading`, a refusal
   or failure is `error`, and no rows is a real zero or the health cell's own
   "no …" wording — never a seed figure in its place.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type {
  AttendanceDayRow, DealPaymentRow, IncomeRow, InstallmentRow, PlanPaymentRow, PlanPaymentsListResponse, WorkItemRow,
} from "../../../api/modules/adminOps";
import { healthOf, todayLocal } from "./derive";
import type { DealMetrics, HealthCell, Period } from "./derive";

export type LiveState = "off" | "loading" | "ready" | "error";

interface Raw {
  ledger: DealPaymentRow[]; plans: PlanPaymentRow[]; income: IncomeRow[]; installments: InstallmentRow[];
  days: AttendanceDayRow[]; work: WorkItemRow[];
}
const NONE: Raw = { ledger: [], plans: [], income: [], installments: [], days: [], work: [] };

/** Every page of a list endpoint. ponytail: sequential pages; fine at
 *  hundreds of rows, parallelise if a list ever runs to thousands. */
async function every<R extends { total: number }, T>(page: (pageNo: number) => Promise<R>, pick: (r: R) => T[]): Promise<T[]> {
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
      ]).then(([ledger, plans, income, installments]) => {
        if (live) setS((x) => ({ ...x, money: "ready", raw: { ...x.raw, ledger, plans, income, installments } }));
      }).catch(() => { if (live) setS((x) => ({ ...x, money: "error" })); });
    }
    if (on.team) {
      Promise.all([
        every((n) => call(AdminOpsService.attendanceDays({ member: "all", start: p.from, end: p.to, pageNo: n, pageSize: 1000 })), (r) => r.days),
        every((n) => call(AdminOpsService.work({ assignee: "all", pageNo: n, pageSize: 500 })), (r) => r.items),
      ]).then(([days, work]) => {
        if (live) setS((x) => ({ ...x, team: "ready", raw: { ...x.raw, days, work } }));
      }).catch(() => { if (live) setS((x) => ({ ...x, team: "error" })); });
    }
    return () => { live = false; };
  }, [p.prevFrom, p.from, p.to, on.money, on.team, nonce]);

  return { ...s, retry: () => setNonce((n) => n + 1) };
}

/* ------------------------------------------------------------------ money --- */
/** Local calendar date of an ISO timestamp (verifiedAt is UTC on the wire). */
const ymd = (v: string | null | undefined) => {
  if (!v) return "";
  if (v.length <= 10) return v;
  const d = new Date(v);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const within = (d: string, from: string, to: string) => !!d && d >= from && d <= to;
/** "19500.0" rupees -> 1950000 paise. */
const paiseOf = (rupees: string | null | undefined) => Math.round((parseFloat(rupees || "0") || 0) * 100);

export interface MoneyWindow { collectedPaise: number; otherInPaise: number; collectedN: number }
export interface LiveMoney {
  cur: MoneyWindow; prev: MoneyWindow;
  totals: { outstandingPaise: number; dueN: number; failedN: number };
  failed: { n: number; paise: number }; overdue: { n: number; paise: number };
}

function windowOf(r: Raw, from: string, to: string): MoneyWindow {
  const deal = r.ledger.filter((x) => x.type === "payment" && !x.reversed && within(ymd(x.paymentDate), from, to));
  const plans = r.plans
    .map((x) => ({ at: ymd(x.verifiedAt), net: paiseOf(x.amount) - (x.orderStatus === "REFUNDED" ? paiseOf(x.refundAmount) : 0) }))
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
  const present = r.days.filter((d) => inDept(d.member.id) && d.state !== "unclosed");
  const late = present.filter((d) => d.isLate).length;
  const items = r.work.filter((i) => inDept(i.assignee.id));
  const key = (i: WorkItemRow) => i.status?.key;
  return {
    span: { onTimePct: present.length ? Math.round(((present.length - late) / present.length) * 100) : null },
    work: {
      total: items.length,
      completed: items.filter((i) => key(i) === "completed").length,
      cancelled: items.filter((i) => key(i) === "cancelled").length,
      delayed: items.filter((i) => i.delayed).length,
    },
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
  if (moneySt === "loading" || moneySt === "error") out.push(pending("collections", "Collections", "#/finance?flag=failed", moneySt));
  if (teamSt === "loading" || teamSt === "error") {
    out.push(pending("team", "Team", "#/attendance?face=history", teamSt));
    out.push(pending("delivery", "Delivery", "#/work?status=delayed", teamSt));
  }
  return out.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}
