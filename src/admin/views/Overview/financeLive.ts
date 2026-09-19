/* =============================================================================
   Overview — the Finance section, on the backend (d5, 2026-09-12).
   -----------------------------------------------------------------------------
   THE SAME SIX TILES, THE SAME TWO PLOTS, THE SAME EXCEPTION LIST — read from
   the API instead of the Finance seed store, on the REAL clock:

     In      deal payments + plan purchases (full amount; a refund is counted
             once, under Out — see live.ts planCashPaise) + other income, by
             the date each landed.
     Out     spend that is not `excluded` + salary runs PAID inside the period
             + refunds actually settled. Taxes leave the bank and are counted
             apart, because they change no operating figure.
     Net     in − out. Nothing accrued, nothing forecast: this is cash.
     Due 30  installments falling due in the next thirty days.
     Failed  installments that failed, whenever they were due.
     Refunds approved and not yet sent, else what is waiting to be decided.

   ONE FETCH SPAN FOR BOTH READINGS. "Net by month" wants a year and the tiles
   want the period, so everything is fetched once over whichever is wider and
   sliced twice — see `spanFor`.

   Nothing is invented. A source that has not answered is `loading`, a refusal
   or a failure is `error`, and no rows is a real zero — never a seed figure in
   its place.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type {
  BankTotals, DealPaymentRow, IncomeRow, InstallmentRow, PlanPaymentRow, PlanPaymentsListResponse,
  RefundRow, SalariesResponse, SalaryRunRow, SpendRow, SpendTagTotal,
} from "../../../api/modules/adminOps";
import { every, planCashPaise, settledRefundPayments, within, ymd } from "./live";
import type { LiveState } from "./live";
import { inr } from "../../ui/format";
import { addDays, bucketsOf, todayLocal } from "./derive";
import type { Period } from "./derive";

interface Raw {
  ledger: DealPaymentRow[]; plans: PlanPaymentRow[]; income: IncomeRow[]; spend: SpendRow[];
  byTag: SpendTagTotal[]; salaries: SalariesResponse | null; refunds: RefundRow[];
  owed: { n: number; paise: number }; toDecide: number;
  installments: InstallmentRow[]; bank: BankTotals | null;
}
const NONE: Raw = {
  ledger: [], plans: [], income: [], spend: [], byTag: [], salaries: null, refunds: [],
  owed: { n: 0, paise: 0 }, toDecide: 0, installments: [], bank: null,
};

/** How many months "Net by month" draws for this period — the seed rule, kept:
 *  three at least, twelve at most, one per thirty days between. */
export const monthsWanted = (days: number) => Math.min(12, Math.max(3, Math.ceil(days / 30)));

const monthOf = (d: string) => d.slice(0, 7);
const firstOfMonth = (m: string) => m + "-01";
/** `n` months back from the month `d` is in, as YYYY-MM. */
function monthBack(d: string, n: number): string {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7)) - n;
  const yy = y + Math.floor((m - 1) / 12);
  const mm = ((m - 1) % 12 + 12) % 12 + 1;
  return yy + "-" + String(mm).padStart(2, "0");
}

/** The one window everything is fetched over: the period, its previous period
 *  (for "vs prev"), and enough months behind it for the trend. */
export function spanFor(p: Period): { start: string; end: string; months: string[] } {
  const want = monthsWanted(p.days);
  const firstMonth = monthBack(p.to, want - 1);
  const start = [p.prevFrom, firstOfMonth(firstMonth)].sort()[0];
  const months: string[] = [];
  for (let i = want - 1; i >= 0; i--) months.push(monthBack(p.to, i));
  return { start, end: p.to, months };
}

export function useFinanceLive(p: Period, on: boolean) {
  const [s, setS] = useState<{ state: LiveState; raw: Raw }>({ state: on ? "loading" : "off", raw: NONE });
  const [nonce, setNonce] = useState(0);
  const span = spanFor(p);

  useEffect(() => {
    if (!on) { setS({ state: "off", raw: NONE }); return; }
    let live = true;
    setS((x) => ({ ...x, state: "loading" }));
    const window = { start: span.start, end: span.end };
    Promise.all([
      every((n) => call(AdminOpsService.dealPayments({ ...window, pageNo: n, pageSize: 200 })), (r) => r.payments),
      every((n) => call<PlanPaymentsListResponse>(AdminOpsService.payments({ ...window, status: "PAID,REFUNDED", pageNo: n, pageSize: 100 })), (r) => r.payments),
      every((n) => call(AdminOpsService.income({ ...window, state: "recorded", pageNo: n, pageSize: 500 })), (r) => r.income),
      call(AdminOpsService.spend({ ...window, state: "recorded", pageSize: 500 })),
      call(AdminOpsService.salaries({ start: monthOf(span.start), end: monthOf(span.end) })),
      call(AdminOpsService.refunds({ pageSize: 500 })),
      every((n) => call(AdminOpsService.installments({ status: "due,failed", pageNo: n, pageSize: 500 })), (r) => r.installments),
      call(AdminOpsService.bankStatements()),
    ]).then(([ledger, plans, income, spend, salaries, refunds, installments, bank]) => {
      if (!live) return;
      setS({
        state: "ready",
        raw: {
          ledger, plans, income, spend: spend.spend, byTag: spend.byTag, salaries,
          refunds: refunds.refunds, owed: refunds.owed, toDecide: refunds.toDecide,
          installments, bank: bank.totals,
        },
      });
    }).catch(() => { if (live) setS((x) => ({ ...x, state: "error" })); });
    return () => { live = false; };
  }, [span.start, span.end, on, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...s, retry: () => setNonce((n) => n + 1) };
}

/* ------------------------------------------------------------------ money --- */
export interface MoneyWindow {
  collectedPaise: number; otherInPaise: number; collectedN: number;
  salaryPaise: number; salaryN: number; otherOutPaise: number; refundsPaidPaise: number;
  excludedPaise: number; outPaise: number; netPaise: number;
}
export interface RiskRow {
  key: string; label: string; paise: number | null; figure: string | null;
  count: string; tone: string; to: string | null;
}
export interface LiveFinance {
  cur: MoneyWindow; prev: MoneyWindow;
  flow: { key: string; label: string; collected: number; out: number; net: number }[];
  months: { month: string; netPaise: number }[];
  dueSoon: { n: number; paise: number }; overdue: { n: number; paise: number };
  failed: { n: number; paise: number };
  refundsOwed: { n: number; paise: number }; refundsOpen: number;
  risk: RiskRow[];
  matched: number | null; bankUnexplained: number;
}
export interface LivePayroll { owedPaise: number; people: number; openRun: string | null; openRunPaise: number }

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

function windowOf(r: Raw, from: string, to: string): MoneyWindow {
  const deal = r.ledger.filter((x) => x.type === "payment" && !x.reversed && within(ymd(x.paymentDate), from, to));
  /* One Set for the whole window, not one per payment: windowOf runs per bucket
     and per month, and the refund list does not change inside a call. */
  const settled = settledRefundPayments(r.refunds);
  const plans = r.plans
    .map((x) => ({ at: ymd(x.verifiedAt), net: planCashPaise(x, settled) }))
    .filter((x) => x.net > 0 && within(x.at, from, to));
  const income = r.income.filter((x) => within(ymd(x.valueDate), from, to));

  const spend = r.spend.filter((x) => within(ymd(x.valueDate), from, to));
  /* `excluded` is money out of the bank that is NOT an operating cost — taxes
     and statutory payments. It is counted, and counted apart. */
  const operating = spend.filter((x) => x.tag?.kind !== "excluded");
  const excluded = spend.filter((x) => x.tag?.kind === "excluded");
  /* A run is money out on the DAY IT WAS PAID, not the month it is for. */
  const runs = (r.salaries?.runs || []).filter((x) => !!x.paidAt && within(ymd(x.paidAt), from, to));
  const refundsPaid = r.refunds.filter((x) => !!x.settledAt && within(ymd(x.settledAt), from, to));

  const collectedPaise = sum(deal, (x) => x.amountPaise) + sum(plans, (x) => x.net);
  const otherInPaise = sum(income, (x) => x.amountPaise);
  const salaryPaise = sum(runs, (x) => x.totalNetPaise);
  const otherOutPaise = sum(operating, (x) => x.amountPaise);
  const refundsPaidPaise = sum(refundsPaid, (x) => x.amountPaise);
  const outPaise = salaryPaise + otherOutPaise + refundsPaidPaise;
  return {
    collectedPaise, otherInPaise, collectedN: deal.length + plans.length,
    salaryPaise, salaryN: sum(runs, (x) => x.slips), otherOutPaise, refundsPaidPaise,
    excludedPaise: sum(excluded, (x) => x.amountPaise),
    outPaise, netPaise: collectedPaise + otherInPaise - outPaise,
  };
}

const plural = (n: number, one: string) => n + " " + (n === 1 ? one : one + "s");

export function liveFinance(r: Raw, p: Period, months: string[]): LiveFinance {
  const today = todayLocal();
  const soonTo = addDays(today, 30);
  const inst = r.installments;
  const due = inst.filter((x) => x.status?.key === "due");
  const soon = due.filter((x) => x.dueDate >= today && x.dueDate <= soonTo);
  const late = due.filter((x) => x.dueDate < today);
  const failed = inst.filter((x) => x.status?.key === "failed");
  const paise = (xs: InstallmentRow[]) => sum(xs, (x) => x.amountPaise);

  const cur = windowOf(r, p.from, p.to);
  const over = r.byTag.filter((t) => t.overBudget);

  const risk: RiskRow[] = [
    /* Not `#/finance?flag=failed`: that queue filters SUBSCRIPTIONS and these
       are installments off accepted quotations, most of which have no
       subscription recorded against them yet -- see derive.ts attentionOf. */
    { key: "failed", label: "Fail to pay", paise: paise(failed), figure: null,
      count: plural(failed.length, "installment"), tone: "bad", to: "#/invoices?new=1" },
    { key: "due_next", label: "Due next 30 days", paise: paise(soon), figure: null,
      count: plural(soon.length, "installment"), tone: "mute", to: "#/finance?flag=due" },
  ];
  if (r.owed.n) {
    risk.push({ key: "owed", label: "Approved, not sent", paise: r.owed.paise, figure: null,
      count: plural(r.owed.n, "refund"), tone: "warn", to: "#/finance-refunds?flag=owed" });
  }
  over.forEach((t) => {
    risk.push({ key: "budget-" + t.key, label: "Over budget", paise: null,
      figure: (t.pctOfBudget ?? 0) + "% of budget", count: t.label, tone: "warn",
      to: "#/finance-transactions?tag=" + encodeURIComponent(t.key) });
  });
  if (r.bank && r.bank.unexplained) {
    risk.push({ key: "unexplained", label: "Bank lines nothing explains", paise: null,
      figure: "net " + inr(r.bank.variancePaise), count: plural(r.bank.unexplained, "line"),
      tone: "bad", to: null });
  }

  return {
    cur, prev: windowOf(r, p.prevFrom, p.prevTo),
    flow: bucketsOf(p).map((b) => {
      const w = windowOf(r, b.from, b.to);
      return { key: b.key, label: b.label, collected: w.collectedPaise + w.otherInPaise, out: w.outPaise, net: w.netPaise };
    }),
    /* Every month in the trend, whether or not anything happened in it: a gap
       drawn as a missing column reads as "no data", and zero is data. */
    months: months.map((m) => {
      const end = monthBack(m, -1) + "-01";
      const w = windowOf(r, firstOfMonth(m), addDays(end, -1));
      return { month: m, netPaise: w.netPaise };
    }),
    dueSoon: { n: soon.length, paise: paise(soon) },
    overdue: { n: late.length, paise: paise(late) },
    failed: { n: failed.length, paise: paise(failed) },
    refundsOwed: r.owed, refundsOpen: r.toDecide,
    risk,
    matched: r.bank ? r.bank.matchedPct : null,
    bankUnexplained: r.bank ? r.bank.unexplained : 0,
  };
}

/** The payroll line under the exception list: the run that is open, and what
 *  it still owes. Null when the session cannot see salaries. */
export function livePayroll(r: Raw): LivePayroll | null {
  const open: SalaryRunRow | null = r.salaries?.openRun || null;
  return {
    owedPaise: open ? open.owedPaise : 0, people: open ? open.unpaidPeople : 0,
    openRun: open ? open.month : null, openRunPaise: open ? open.totalNetPaise : 0,
  };
}
