/* =============================================================================
   Finance — the only file that knows where the money records live.
   -----------------------------------------------------------------------------
   FOUR THINGS GET RECORDED and nothing else: a subscription sale and its
   installments, a salary, a company expense or income, a refund. Analytics is
   not a fifth record type — it is those four read back, which is why no number
   on it can disagree with a list.

   A ROW IS A FACT. Everything here exists because something happened. There is
   no verification step, no approval state on a payment, no draft transaction.
   `fail_to_pay` looks like the exception and is not: it records a decline that
   occurred or a due date that demonstrably passed, and it carries the evidence.

   POSTED IS PERMANENT. Nothing edits or deletes a recorded row. A correction is
   a counter-entry, or a reversal written into the history with its reason.

   ONE CLOCK. `asOf` from module.json drives every "this month", "due in 30
   days" and "overdue by N". Never the browser clock. Writes stamp NOW plus the
   time the session has been open, so a row recorded now sits after the seed.

   INTEGER PAISE. A rupee never appears as a float anywhere in this file.

   NO API YET. Every write below is the client half of an endpoint named in
   src/proto/v-2.2.0.0/BACKEND-INTEGRATION.md; the sequence and the refusal
   text are what that endpoint has to keep.
   ============================================================================= */
import { useSyncExternalStore } from "react";
import moduleDoc from "../../../content/finance/module.json";
import subsDoc from "../../../content/finance/subscriptions.json";
import salariesDoc from "../../../content/finance/salaries.json";
import txnDoc from "../../../content/finance/transactions.json";
import refundsDoc from "../../../content/finance/refunds.json";
import invoicesDoc from "../../../content/finance/invoices.json";
import quotationsDoc from "../../../content/finance/quotations.json";
import teamMembersDoc from "../../../content/team/members.json";
import usersDoc from "../../../content/users/users.json";
import bankDoc from "../../../content/finance/bank.json";
import vocabDoc from "../../../content/finance/vocabularies.json";
import { getSession } from "../../auth/session";
import { inr } from "../../ui/format";
import type {
  Account, CompanyTxn, FinEvent, Installment, InstallmentPayment, Kpi, MonthPoint,
  Params, Payslip, Proof, Refund, RefundPolicy, SalaryAccount, SalaryComponent, SalaryRun,
  Subscription, Tag, TagKind, Tile,
} from "./types";

export { inr };
export type {
  Account, CompanyTxn, Customer, FinEvent, Installment, InstallmentFailure, InstallmentPayment,
  InstallmentStatus, Kpi, MonthPoint, Params, Payslip, Proof, Receipt, Refund, RefundOrigin,
  RefundPolicy, RefundState, RunState, SalaryAccount, SalaryComponent, SalaryRun, SubSource,
  Subscription, SubscriptionStatus, Tag, TagKind, Tile, TxnDirection, TxnState,
} from "./types";

/* ====================================================== the vocabulary === */

export const VOCAB = vocabDoc;
export const RECORD_TYPES = vocabDoc.recordTypes;
export const SUB_SOURCES = vocabDoc.subscriptionSources;
export const INSTALLMENT_STATUSES = vocabDoc.installmentStatuses;
export const FAILURE_REASONS = vocabDoc.failureReasons;
export const SUB_STATUSES = vocabDoc.subscriptionStatuses;
export const MODES = vocabDoc.modes;
export const RUN_STATES = vocabDoc.salaryRunStates;
export const TAG_KINDS = vocabDoc.tagKinds;
export const CREDIT_KINDS = vocabDoc.manualCreditKinds;
export const REFUND_ORIGINS = vocabDoc.refundOrigins;
export const REFUND_GROUNDS = vocabDoc.refundGrounds;
export const REFUND_POLICY = vocabDoc.refundPolicy;
export const REFUND_STATES = vocabDoc.refundStates;
export const TXN_STATES = vocabDoc.transactionStates;
export const EVENT_TYPES = vocabDoc.eventTypes;
export const METRICS = vocabDoc.metricDefinitions;
export const KPIS = vocabDoc.kpiDefinitions;
export const ROLES = vocabDoc.roles;
export const SLIP_RULE = vocabDoc.slipRule;
export const MODULE_RULE = vocabDoc.moduleRule;

export const COMPANY = invoicesDoc.company;
export const PERIOD = moduleDoc.period;
export const ACCOUNTS = moduleDoc.accounts as Account[];
export const BILL_THRESHOLD_PAISE = moduleDoc.billThresholdPaise;

type Keyed = { key: string };
const first = <T extends Keyed>(list: readonly T[], k: string) => list.filter((x) => x.key === k)[0] || null;

export const sourceMeta = (k: string) => first(SUB_SOURCES, k);
export const instStatusMeta = (k: string) => first(INSTALLMENT_STATUSES, k);
export const failureMeta = (k: string) => first(FAILURE_REASONS, k);
export const subStatusMeta = (k: string) => first(SUB_STATUSES, k);
export const runStateMeta = (k: string) => first(RUN_STATES, k);
export const tagKindMeta = (k: string) => first(TAG_KINDS, k);
export const originMeta = (k: string) => first(REFUND_ORIGINS, k);
export const groundMeta = (k: string) => first(REFUND_GROUNDS, k);
export const refundStateMeta = (k: string) => first(REFUND_STATES, k);
export const txnStateMeta = (k: string) => first(TXN_STATES, k);
export const eventMeta = (k: string) => first(EVENT_TYPES, k);
export const metric = (k: string) => first(METRICS, k);
export const kpiMeta = (k: string) => first(KPIS, k);
/* THE PAYROLL FACE HAS ITS OWN METRIC LIST, deliberately kept apart from the
   two above: the KPI tab renders every entry in `kpiDefinitions` grouped by
   `group`, so a payroll figure added there would silently appear on a page
   about subscriptions and refunds. A second list of payroll KPIs was here and
   is gone with the metrics block it annotated. */
export const PAYROLL_METRICS = vocabDoc.payrollMetricDefinitions;
export const payrollMetric = (k: string) => first(PAYROLL_METRICS, k);
export const decision = (id: string) => vocabDoc.openDecisions.filter((d) => d.id === id)[0] || null;
export const accountOf = (id: string) => ACCOUNTS.filter((a) => a.accountId === id)[0] || null;

/* =========================================================== the clock === */

export const NOW = new Date(moduleDoc.asOf).getTime();
export const DAY = 86400000;
const LOADED_AT = Date.now();
/** Session-relative, so a row recorded during a demo lands after the seed
 *  rather than jumping to whatever today actually is. */
export const stamp = () => new Date(NOW + (Date.now() - LOADED_AT)).toISOString();
export const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
export const monthOf = (d: string) => d.slice(0, 7);
export const inPeriod = (d: string, from = PERIOD.from, to = PERIOD.to) =>
  d.slice(0, 10) >= from && d.slice(0, 10) <= to;
export const todayIso = () => new Date(NOW).toISOString().slice(0, 10);
/** Positive when the date has passed. The only definition of "late". */
export const daysPast = (d: string) => daysBetween(ts(d), NOW);
/** The real length of a month. Loss of pay is a fraction of the month a
 *  person was actually employed for, not of a notional thirty. */
export const daysInMonth = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();

/* ======================================================== the snapshot === */

type Resolution = { targetId: string; kind: "write_off" | "carried_forward"; reason: string; by: string; at: string };
type Activity = { at: string; type: string; actor: string; ref: string; kind: string; note: string };

interface Snap {
  subscriptions: Subscription[];
  salaryAccounts: SalaryAccount[];
  salaryRuns: SalaryRun[];
  tags: Tag[];
  transactions: CompanyTxn[];
  refunds: Refund[];
  invoices: typeof invoicesDoc.invoices;
  quotations: typeof quotationsDoc.quotations;
  statements: typeof bankDoc.statements;
  resolutions: Resolution[];
  pendingImport: typeof bankDoc.pendingImport | null;
  activity: Activity[];
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function seed(): Snap {
  return {
    subscriptions: clone(subsDoc.subscriptions) as unknown as Subscription[],
    salaryAccounts: clone(salariesDoc.accounts) as unknown as SalaryAccount[],
    salaryRuns: clone(salariesDoc.runs) as unknown as SalaryRun[],
    tags: clone(txnDoc.tags) as unknown as Tag[],
    transactions: clone(txnDoc.transactions) as unknown as CompanyTxn[],
    refunds: clone(refundsDoc.requests) as unknown as Refund[],
    invoices: clone(invoicesDoc.invoices),
    quotations: clone(quotationsDoc.quotations),
    statements: clone(bankDoc.statements),
    resolutions: [],
    pendingImport: clone(bankDoc.pendingImport || null),
    activity: [],
  };
}

let snap: Snap = seed();
let version = 0;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;
/** The subscription primitive every `use…` hook in this module sits on.
 *  EXPORTED so `payroll.ts` can build its own hooks on the same store version
 *  rather than keeping a second subscription — two subscriptions to one
 *  snapshot is how a chart and the table beside it end up a render apart. */
export const useVersion = () => useSyncExternalStore(subscribe, getVersion, getVersion);

export function resetStore() { snap = seed(); seq = 0; emit(); }

/* ============================================================= readers === */

export const readSubscriptions = () => snap.subscriptions;
export const readSubscription = (id: string | null | undefined) =>
  (id ? snap.subscriptions.filter((s) => s.subscriptionId === id)[0] || null : null);
export const readSalaryAccounts = () => snap.salaryAccounts;
export const readSalaryAccount = (id: string | null | undefined) =>
  (id ? snap.salaryAccounts.filter((a) => a.salaryAccountId === id)[0] || null : null);
export const readRuns = () => snap.salaryRuns;
export const readRun = (id: string | null | undefined) =>
  (id ? snap.salaryRuns.filter((r) => r.runId === id)[0] || null : null);
export const readSlip = (id: string | null | undefined) => {
  if (!id) return null;
  for (const r of snap.salaryRuns) { const s = r.slips.filter((x) => x.slipId === id)[0]; if (s) return s; }
  return null;
};
export const runOfSlip = (slipId: string) =>
  snap.salaryRuns.filter((r) => r.slips.some((s) => s.slipId === slipId))[0] || null;
export const readTags = () => snap.tags;
export const tagOf = (key: string | null | undefined) =>
  (key ? snap.tags.filter((t) => t.tagKey === key)[0] || null : null);
export const readTransactions = () => snap.transactions;
export const readTransaction = (id: string | null | undefined) =>
  (id ? snap.transactions.filter((t) => t.txnId === id)[0] || null : null);
export const readRefunds = () => snap.refunds;
export const readRefund = (id: string | null | undefined) =>
  (id ? snap.refunds.filter((r) => r.refundId === id)[0] || null : null);
export const readInvoices = () => snap.invoices;

/** THE USER BASE, read for one job: a subscription is recorded against a real
 *  registered person, never a name somebody typed. Read from the Users
 *  module's SEED rather than from its store — Finance already reads
 *  invoices.json the same way, and a view reaching into another module's store
 *  couples the two modules' lifecycles for no gain. When the endpoint lands,
 *  this becomes one fetch and nothing else here changes.
 *
 *  Deactivated accounts are still listed: money that arrived from one is a
 *  fact, and hiding the payer would make the row unrecordable. */
export interface FinUser {
  userId: string; name: string; business: string | null; status: string; email: string;
}
interface SeedUser {
  userId: string; userStatus: string;
  identity: { name: string; email: string };
  profile: { businessName: string | null } | null;
}
export const readUsers = (): FinUser[] =>
  (usersDoc.users as unknown as SeedUser[]).map((u) => ({
    userId: u.userId,
    name: u.identity.name,
    business: u.profile ? u.profile.businessName : null,
    status: u.userStatus,
    email: u.identity.email,
  }));
export const readUser = (id: string | null | undefined) =>
  (id ? readUsers().filter((u) => u.userId === id)[0] || null : null);
export function useUsers(): FinUser[] { useVersion(); return readUsers(); }
export const readInvoice = (n: string | null | undefined) =>
  (n ? snap.invoices.filter((i) => i.invoiceNumber === n)[0] || null : null);
export const readStatements = () => snap.statements;
export const readResolutions = () => snap.resolutions;
export const readPendingImport = () => snap.pendingImport;
export const readActivity = () => snap.activity;

export interface PaymentHit { sub: Subscription; inst: Installment; pay: InstallmentPayment }

/** EVERY installment payment in the module, flattened — including ones whose
 *  installment was later cancelled. This is what a reference lookup, a bank
 *  match and a refund point at, so it must not hide anything. */
export function readPayments(): PaymentHit[] {
  const out: PaymentHit[] = [];
  snap.subscriptions.forEach((s) => s.installments.forEach((i) => { if (i.payment) out.push({ sub: s, inst: i, pay: i.payment }); }));
  return out;
}
export const readPayment = (paymentId: string | null | undefined) =>
  (paymentId ? readPayments().filter((r) => r.pay.paymentId === paymentId)[0] || null : null);

/** The payments that COUNT AS MONEY THE COMPANY RECEIVED. Two cases separate
 *  here and the difference is real:
 *    · an installment that is `paid` — the money arrived and stayed;
 *    · an installment on a `refunded` subscription — the money arrived and was
 *      later sent back, and the refund subtracts it in the month it left.
 *  A `cancelled` installment that still carries a payment is a RECALLED credit:
 *  the bank took it back, there is a matching debit on the statement, and the
 *  pair nets to zero. Counting it and then not counting the recall would
 *  overstate every month it appears in. */
export const countedPayments = (): PaymentHit[] =>
  readPayments().filter((r) => r.inst.status === "paid" || r.sub.status === "refunded");

/* ============================================================== actors === */

export function actor(): { name: string; role: string } {
  const s = getSession();
  if (!s) return { name: "K. Iyer", role: "Finance" };
  return { name: s.user?.name || "Finance", role: s.isFullAccess ? "Super Admin" : (s.role || "Finance") };
}
export const isSuperAdmin = () => { const s = getSession(); return !s || !!s.isFullAccess; };
export function superAdminOnly(what: string): string {
  return isSuperAdmin() ? "" : what + " is Super Admin only. (super_admin_required)";
}

const nextId = (prefix: string) => prefix + "-" + String(9000 + (seq++)).padStart(4, "0");

function pushEvent(list: FinEvent[], type: string, note: string, who?: { name: string; role: string }): FinEvent {
  const a = who || actor();
  const ev: FinEvent = {
    eventId: "EV-" + String(9000 + (seq++)),
    type, actor: a.name, actorRole: a.role, at: stamp(), note,
  };
  list.unshift(ev);
  return ev;
}
function log(ev: FinEvent, ref: string, kind: string) {
  snap.activity.unshift({ at: ev.at, type: ev.type, actor: ev.actor, ref, kind, note: ev.note });
}
const note = (type: string, ref: string, kind: string, text: string) => {
  const a = actor();
  log({ eventId: "EV-" + String(9000 + (seq++)), type, actor: a.name, actorRole: a.role, at: stamp(), note: text }, ref, kind);
};

/* =================================================== subscription rows === */

export interface SubRow {
  s: Subscription;
  paidPaise: number; duePaise: number; failedPaise: number;
  paidN: number; dueN: number; failedN: number;
  /** The installment a person should look at: the earliest failed one, else
   *  the earliest due one. Null when there is nothing to act on. */
  next: Installment | null;
  /** Days until it is due. Negative means the date has passed. */
  nextDueInDays: number | null;
  /** The one installment genuinely in front of this customer — nextDue, with
   *  both its rules. Null on anything defaulting, cancelled, completed or
   *  refunded, and null while an earlier installment is unpaid. The Due tile
   *  and the Due FILTER both read this, so a subscription can never be counted
   *  by one and hidden by the other. */
  dueNext: Installment | null;
  needsAttention: boolean;
}

const sumInst = (l: Installment[]) => l.reduce((n, i) => n + i.amountPaise, 0);

/** THE NEXT INSTALLMENT ANYONE CAN ACTUALLY EXPECT.
 *
 *  Two rules, and both of them stop a figure claiming money that is not
 *  coming:
 *
 *    · A DEFAULTING SUBSCRIPTION HAS NO NEXT. Something on it already failed.
 *      Counting the installment behind the failure as "due in 30 days" says
 *      the money is on its way when the last attempt at it did not clear —
 *      the customer has to be chased before anything else is expected of
 *      them.
 *
 *    · ONLY THE ONE IN FRONT. Installments are paid in order, so the second is
 *      not due while the first is unpaid. Walking the schedule and stopping at
 *      the first row that is not paid gives that for free: if it is `due` it
 *      is the next one, and if it is anything else nothing behind it is
 *      expected either.
 *
 *  Cancelled rows are stepped over — they were never going to be collected
 *  and they do not block the row after them. */
export function nextDue(s: Subscription): Installment | null {
  if (s.status !== "active") return null;
  const live = s.installments.filter((i) => i.status !== "cancelled")
    .slice().sort((a, b) => a.seq - b.seq);
  for (const i of live) {
    if (i.status === "paid") continue;
    return i.status === "due" ? i : null;
  }
  return null;
}

export function toSubRow(s: Subscription): SubRow {
  const paid = s.installments.filter((i) => i.status === "paid");
  const due = s.installments.filter((i) => i.status === "due");
  const failed = s.installments.filter((i) => i.status === "fail_to_pay");
  const byDate = (l: Installment[]) => l.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;
  /* A failure is what a person acts on, so it wins. Otherwise it is the one
     installment actually in front of the customer — nextDue, not merely the
     earliest unpaid row, so the list and the tile cannot say different things
     about the same subscription. */
  const next = byDate(failed) || nextDue(s);
  return {
    s,
    paidPaise: sumInst(paid), duePaise: sumInst(due), failedPaise: sumInst(failed),
    paidN: paid.length, dueN: due.length, failedN: failed.length,
    next,
    nextDueInDays: next ? -daysPast(next.dueDate) : null,
    dueNext: nextDue(s),
    needsAttention: failed.length > 0,
  };
}
export const subRows = (): SubRow[] =>
  snap.subscriptions.map(toSubRow).sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    return b.s.startDate.localeCompare(a.s.startDate);
  });

export function applySubFilters(rows: SubRow[], p: Params): SubRow[] {
  let out = rows;
  if (p.source) out = out.filter((r) => r.s.source === p.source);
  if (p.status) out = out.filter((r) => r.s.status === p.status);
  if (p.plan) out = out.filter((r) => r.s.planId === p.plan);
  if (p.flag === "settled") out = out.filter((r) => r.paidN > 0);
  if (p.flag === "failed") out = out.filter((r) => r.failedN > 0);
  if (p.flag === "due") out = out.filter((r) => !!r.dueNext);
  if (p.q) {
    const q = p.q.toLowerCase().trim();
    out = out.filter((r) =>
      r.s.subscriptionId.toLowerCase().includes(q)
      || r.s.customer.name.toLowerCase().includes(q)
      || r.s.planName.toLowerCase().includes(q)
      /* A customer on the phone has a UTR, not a subscription id. */
      || r.s.installments.some((i) => (i.payment?.reference || "").toLowerCase().includes(q)
        || (i.invoiceNumber || "").toLowerCase().includes(q)));
  }
  return out;
}

/** Every installment across every subscription as one flat queue — the view
 *  that answers "what is failing, and what is coming". */
export interface InstRow { s: Subscription; i: Installment; overdueDays: number }
export function installmentRows(): InstRow[] {
  const out: InstRow[] = [];
  snap.subscriptions.forEach((s) => s.installments.forEach((i) => out.push({ s, i, overdueDays: daysPast(i.dueDate) })));
  return out.sort((a, b) => a.i.dueDate.localeCompare(b.i.dueDate));
}

/* ======================================================== salary rows === */

/** Σ a component array. One helper rather than the same `reduce` written out
 *  at every call site, because every one of them is the same arithmetic and
 *  the ones that drifted apart would be the hard bug to find. */
export const money = (list: SalaryComponent[] | undefined | null): number =>
  (list || []).reduce((n, c) => n + c.amountPaise, 0);

/** WHAT VARIED THIS MONTH. Reads `incentivePaise` when the slip carries it and
 *  falls back to summing the array, so a slip written by hand into the seed
 *  with only one of the two is still read correctly — and a slip from before
 *  incentives existed answers 0 without anything having to test for it.
 *
 *  Every payroll figure that separates fixed pay from variable goes through
 *  here. Nothing re-derives an incentive by matching a label, which is what
 *  it would have to do if the split were not in the record. */
export const incentiveOf = (slip: Payslip): number =>
  (typeof slip.incentivePaise === "number" ? slip.incentivePaise : money(slip.incentives));

/** The FIXED half of a slip's gross — what the company committed to, after
 *  loss of pay and before anything performance added. `grossPaise` minus the
 *  incentive rather than Σ `earnings`, so the two can never disagree even on a
 *  hand-written seed row. */
export const fixedOf = (slip: Payslip): number => slip.grossPaise - incentiveOf(slip);

export interface SalaryRow {
  a: SalaryAccount;
  lastSlip: Payslip | null;
  lastPaidAt: string | null;
  inOpenRun: boolean;
  monthlyDeductionsPaise: number;
  monthlyNetPaise: number;
  slipsN: number;
}
export function toSalaryRow(a: SalaryAccount): SalaryRow {
  const slips = snap.salaryRuns
    .flatMap((r) => r.slips.filter((s) => s.salaryAccountId === a.salaryAccountId).map((s) => ({ s, r })))
    .sort((x, y) => y.r.month.localeCompare(x.r.month));
  const paid = slips.filter((x) => x.r.state === "paid")[0] || null;
  const ded = a.deductions.reduce((n, d) => n + d.amountPaise, 0);
  return {
    a,
    lastSlip: slips[0]?.s || null,
    lastPaidAt: paid?.s.paidAt || null,
    inOpenRun: snap.salaryRuns.some((r) => r.state === "open" && r.slips.some((s) => s.salaryAccountId === a.salaryAccountId)),
    monthlyDeductionsPaise: ded,
    monthlyNetPaise: a.monthlyGrossPaise - ded,
    slipsN: slips.length,
  };
}
export const salaryRows = (): SalaryRow[] =>
  snap.salaryAccounts.map(toSalaryRow).sort((a, b) => {
    if (a.a.active !== b.a.active) return a.a.active ? -1 : 1;
    return b.a.monthlyGrossPaise - a.a.monthlyGrossPaise;
  });

/** How people are engaged. A vocabulary rather than a union type, so a third
 *  value is a data change. See the note on `SalaryAccount.engagement` for why
 *  these two are not a clean partition. */
export const ENGAGEMENTS = [
  { key: "permanent", label: "Permanent" },
  { key: "payroll", label: "Payroll" },
];

/* ================================================= who a salary is for ===
   THE PERSON BELONGS TO TEAM. A salary account points at a member and never
   invents one, so the account form picks from the team rather than asking
   somebody to type a name, a designation and an id that has to match.

   THIS READS TEAM'S OWN SEED, which is a cross-module read of exactly the kind
   `invoices.json` and `quotations.json` already are — the difference is that
   this one is not copied here, it is imported, so there is one fixture and not
   two that drift. It becomes `AdminOpsService.users()` in the same commit that
   retires those two.

   ⚠ THE TWO FIXTURES DO NOT JOIN TODAY. Finance's seeded salary accounts carry
   memberIds 1-9 and Team's members are 41-86: different casts, written
   independently, so `memberId` on every existing account resolves to nobody.
   The picker below is correct and new accounts join properly; the seven
   historical ones do not, and that is a seed defect rather than a code one.
   Fixing it means deciding whose cast is real, which is a product question. */

export interface SalaryMemberOption {
  memberId: number;
  name: string;
  designation: string;
  /** WHICH PART OF THE COMPANY, off the member record. It is not typed on the
   *  salary form any more and it never should have been: a department is a
   *  fact about a person, and asking Finance to restate it meant one company
   *  could hold two spellings of Sales and no way to tell which was right.
   *  Blank is legal and groups as Unassigned — a visible gap somebody can go
   *  and fix on the member, which is the one place fixing it works. */
  department: string;
  /** Already has a salary account — offered greyed rather than hidden, so
   *  somebody looking for a person finds them and learns why they cannot be
   *  picked, instead of concluding the list is broken. */
  taken: boolean;
  employeeCode: string;
}

/** `IB-EMP-041`. Derived from the member id rather than typed: it prints on
 *  the payslip, and two people typing their own conventions produce two
 *  formats in one payroll. Deterministic, so the same person always gets the
 *  same code. */
export const employeeCodeOf = (memberId: number | string) =>
  "IB-EMP-" + String(memberId).padStart(3, "0");

export function salaryMemberOptions(): SalaryMemberOption[] {
  const taken = new Set(snap.salaryAccounts.map((a) => String(a.memberId)));
  return (teamMembersDoc.members as {
    memberId: string; name: string; designation: string; department?: string; status: string;
  }[])
    .filter((m) => m.status === "active")
    .map((m) => ({
      memberId: Number(m.memberId),
      name: m.name,
      designation: m.designation,
      department: (m.department || "").trim(),
      taken: taken.has(m.memberId),
      employeeCode: employeeCodeOf(m.memberId),
    }));
}

/** HOW A SALARY WAS PAID, in the words somebody says out loud. `mode` is the
 *  ledger's own vocabulary and is what gets stored beside it. */
export const PAY_VIA = [
  { key: "bank", label: "Bank transfer", mode: "NEFT" },
  { key: "upi", label: "UPI", mode: "UPI" },
  { key: "cash", label: "Cash", mode: "Cash" },
];
export const payViaMeta = (k: string) => PAY_VIA.filter((v) => v.key === k)[0] || null;

/** THE PROOF IS THE EVIDENCE, for every method. A salary payment carries no
 *  bank reference any more: the field was removed on 2026-08-31 because it was
 *  a UTR typed from memory on a screen where nothing checked it against a
 *  statement, and a reference nobody verifies is a reference nobody should
 *  trust. The attachment replaced it, and it is mandatory — a payment with no
 *  evidence at all is a claim, which is the one thing this module refuses to
 *  store.
 *
 *  CONSEQUENCE, stated because it is easy to read as a defect later: salary
 *  payments cannot be auto-matched to an imported statement. They never could
 *  be for cash, and now they cannot be for transfers either. The proof is what
 *  a person checks against the bank by eye. */
export const PROOF_TYPES = ["image/", "application/pdf"];
export const proofAccepted = (mime: string) =>
  PROOF_TYPES.some((t) => (mime || "").toLowerCase().startsWith(t));
export const engagementMeta = (k: string) => ENGAGEMENTS.filter((e) => e.key === k)[0] || null;

export function applySalaryFilters(rows: SalaryRow[], p: Params): SalaryRow[] {
  let out = rows;
  if (p.active === "yes") out = out.filter((r) => r.a.active);
  if (p.active === "no") out = out.filter((r) => !r.a.active);
  if (p.engagement) out = out.filter((r) => r.a.engagement === p.engagement);
  if (p.due === "unpaid") out = out.filter((r) => dueOf(r).pendingPaise > 0);
  if (p.due === "paid") out = out.filter((r) => dueOf(r).pendingPaise === 0 && !!r.lastPaidAt);
  /* Owed for more than the current month — the strip's red cell. */
  if (p.due === "arrears") out = out.filter((r) => dueOf(r).arrears.length > 0);
  if (p.q) {
    const q = p.q.toLowerCase().trim();
    out = out.filter((r) => r.a.memberName.toLowerCase().includes(q)
      || r.a.employeeCode.toLowerCase().includes(q)
      || r.a.designation.toLowerCase().includes(q));
  }
  return out;
}

/* ------------------------------------------------- what somebody is owed ---
   THE ONE DERIVATION THE SALARY TABLE READS. A person is paid month by month,
   and the question the table answers is "what do I owe them right now" — which
   is not one number on one slip. It is every unpaid slip they have.

   ARREARS ARE NOT AN EXTRA FIELD. A slip with no `paidAt` is an unpaid month,
   whatever month it belongs to; the newest is "this month" and the rest are
   what somebody forgot. Nothing is stored to say so — the same reason `delayed`
   is derived in Team and `absent` is derived in Attendance: a stored arrears
   figure needs a job to keep it true, and there is no queue here to run one. */

export interface SalaryDue {
  /** Every unpaid slip, newest first. Empty means nothing is owed. */
  unpaid: Payslip[];
  /** The newest unpaid month — what the Pay button pays first. */
  current: Payslip | null;
  /** Unpaid months BEFORE the newest one. The reason a row can read
   *  "₹1,08,000 · 2 months" when one month's salary is ₹54,000. */
  arrears: Payslip[];
  arrearsPaise: number;
  currentPaise: number;
  /** Everything outstanding: arrears plus the current month. */
  pendingPaise: number;
  /** `paid` when nothing is outstanding and they have been paid at least once;
   *  `unpaid` when something is; `none` when no slip has ever been issued.
   *
   *  NOT "pending". The module bans that word as the text of a status pill —
   *  it used to mean "recorded but not yet believed" — and the render suite
   *  asserts it never returns (`HELD_AS_A_STATE` in fn-smoke.tsx). Money owed
   *  and not yet sent is a fact, not a doubt, and "unpaid" says the fact. */
  state: "paid" | "unpaid" | "none";
}

/** PAID AND UNPAID, across the whole payroll. Both derived from the same
 *  `dueOf` and the same slips the table reads, so the topbar and the rows can
 *  never disagree about who is owed what — the rule this module applies to
 *  every other figure it prints twice.
 *
 *  `paid` is the money that has actually left in the current period, not what
 *  was scheduled: a month nobody has been paid for contributes nothing. */
export function salaryTotals(): {
  paidPaise: number; paidAllPaise: number; unpaidPaise: number;
  unpaidPeople: number; membersAll: number;
} {
  let paidPaise = 0;
  /* ALL TIME, alongside the period figure: every rupee that ever left as
     salary, summed off the paid slips themselves. */
  let paidAllPaise = 0;
  snap.salaryRuns.forEach((run) => run.slips.forEach((s) => {
    if (!s.paidAt) return;
    paidAllPaise += s.netPaise;
    if (s.paidAt >= PERIOD.from && s.paidAt <= PERIOD.to + "T23:59:59") paidPaise += s.netPaise;
  }));
  const rows = salaryRows();
  const owing = rows.map(dueOf).filter((d) => d.pendingPaise > 0);
  return {
    paidPaise,
    paidAllPaise,
    unpaidPaise: owing.reduce((n, d) => n + d.pendingPaise, 0),
    unpaidPeople: owing.length,
    /* Every account of every kind, closed ones included — a total, not a
       head-count of who gets the next run. */
    membersAll: rows.length,
  };
}

export function dueOf(r: SalaryRow): SalaryDue {
  /* A HELD SLIP IS NOT DUE. It is out of the pending figure, out of the pay
     write, and out of the arrears count until somebody releases it — the
     Transactions tab is where it stays visible. */
  const unpaid = snap.salaryRuns
    .flatMap((run) => run.slips.filter((s) =>
      s.salaryAccountId === r.a.salaryAccountId && !s.paidAt && !s.held))
    .sort((a, b) => b.month.localeCompare(a.month));
  const current = unpaid[0] || null;
  const arrears = unpaid.slice(1);
  const arrearsPaise = arrears.reduce((n, s) => n + s.netPaise, 0);
  const currentPaise = current ? current.netPaise : 0;
  return {
    unpaid, current, arrears, arrearsPaise, currentPaise,
    pendingPaise: arrearsPaise + currentPaise,
    state: unpaid.length ? "unpaid" : r.lastPaidAt ? "paid" : "none",
  };
}

export const runsNewestFirst = () => snap.salaryRuns.slice().sort((a, b) => b.month.localeCompare(a.month));
export const openRun = () => snap.salaryRuns.filter((r) => r.state === "open")[0] || null;
export const slipsOf = (accountId: string) =>
  snap.salaryRuns.flatMap((r) => r.slips.filter((s) => s.salaryAccountId === accountId))
    .sort((a, b) => b.month.localeCompare(a.month));

/* =================================================== transaction rows === */

export interface TxnRow { t: CompanyTxn; tag: Tag | null; missingBill: boolean; ageDays: number }
export function toTxnRow(t: CompanyTxn): TxnRow {
  const tag = tagOf(t.tagKey);
  return {
    t, tag,
    missingBill: t.direction === "out" && t.amountPaise > 0 && !t.bill
      && (!!tag?.proofRequired || t.amountPaise >= BILL_THRESHOLD_PAISE),
    ageDays: daysPast(t.valueDate),
  };
}
export const txnRows = (): TxnRow[] =>
  snap.transactions.map(toTxnRow).sort((a, b) =>
    b.t.valueDate.localeCompare(a.t.valueDate) || ts(b.t.recordedAt) - ts(a.t.recordedAt));

export function applyTxnFilters(rows: TxnRow[], p: Params): TxnRow[] {
  let out = rows;
  if (p.dir) out = out.filter((r) => r.t.direction === p.dir);
  if (p.tag) out = out.filter((r) => r.t.tagKey === p.tag);
  if (p.kind) out = out.filter((r) => r.tag?.kind === p.kind);
  if (p.state) out = out.filter((r) => r.t.state === p.state);
  if (p.flag === "nobill") out = out.filter((r) => r.missingBill);
  if (p.range === "month") out = out.filter((r) => inPeriod(r.t.valueDate));
  if (p.q) {
    const q = p.q.toLowerCase().trim();
    out = out.filter((r) => r.t.txnId.toLowerCase().includes(q)
      || r.t.description.toLowerCase().includes(q)
      || r.t.party.toLowerCase().includes(q)
      || r.t.reference.toLowerCase().includes(q));
  }
  return out;
}

export interface TagTotal { tag: Tag; spentPaise: number; n: number; overBudget: boolean; pctOfBudget: number | null }
export function tagTotals(from = PERIOD.from, to = PERIOD.to): { rows: TagTotal[]; totalPaise: number } {
  const rows: TagTotal[] = snap.tags.map((tag) => {
    const list = snap.transactions.filter((t) => t.tagKey === tag.tagKey && t.direction === "out" && inPeriod(t.valueDate, from, to));
    const spentPaise = list.reduce((n, t) => n + t.amountPaise, 0);
    return {
      tag, spentPaise, n: list.length,
      overBudget: !!tag.budgetPaise && spentPaise > tag.budgetPaise,
      pctOfBudget: tag.budgetPaise ? Math.round((spentPaise / tag.budgetPaise) * 100) : null,
    };
  }).sort((a, b) => b.spentPaise - a.spentPaise);
  return { rows, totalPaise: rows.reduce((n, r) => n + r.spentPaise, 0) };
}

/* ======================================================== refund rows === */

export interface RefundRow { r: Refund; payment: InstallmentPayment | null; sub: Subscription | null; ageDays: number }
export function toRefundRow(r: Refund): RefundRow {
  const hit = r.paymentId ? readPayment(r.paymentId) : null;
  return {
    r, payment: hit?.pay || null,
    sub: hit?.sub || readSubscription(r.subscriptionId),
    ageDays: daysPast(r.requestedAt.slice(0, 10)),
  };
}
export const refundRows = (): RefundRow[] =>
  snap.refunds.map(toRefundRow).sort((a, b) => ts(b.r.requestedAt) - ts(a.r.requestedAt));

export function refundQueue() {
  const rows = refundRows();
  return {
    open: rows.filter((x) => x.r.state === "requested" || x.r.state === "sent_back"),
    approved: rows.filter((x) => x.r.state === "approved"),
    settled: rows.filter((x) => x.r.state === "paid" || x.r.state === "declined"),
    all: rows,
  };
}

export function refundPolicyCheck(paymentId: string, ground: string): RefundPolicy & { ageDays: number } {
  const hit = readPayment(paymentId);
  const g = groundMeta(ground);
  const ageDays = hit ? daysPast(hit.pay.valueDate) : 0;
  return {
    groundPermitted: !!g?.permitted,
    withinWindow: ageDays <= REFUND_POLICY.windowDays,
    originalRecorded: !!hit,
    subscriptionActive: !!hit && hit.sub.status === "active",
    ageDays,
  };
}

/* ============================================================== money === */

const paidInPeriod = (from: string, to: string) =>
  countedPayments().filter((r) => inPeriod(r.pay.valueDate, from, to));
const salaryInPeriod = (from: string, to: string) =>
  snap.salaryRuns.filter((r) => r.state === "paid" && r.month >= monthOf(from) && r.month <= monthOf(to));
const refundsPaidInPeriod = (from: string, to: string) =>
  snap.refunds.filter((r) => r.state === "paid" && r.settlement && inPeriod(r.settlement.paidAt, from, to));

export interface Overview {
  collectedPaise: number; collectedN: number;
  salaryPaise: number; salaryN: number;
  otherOutPaise: number; otherOutN: number;
  otherInPaise: number; otherInN: number;
  refundsPaidPaise: number; refundsPaidN: number;
  refundsOwedPaise: number; refundsOwedN: number;
  dueNextPaise: number; dueNextN: number;
  failedPaise: number; failedN: number;
  excludedPaise: number;
  netPaise: number;
}

export function overview(from = PERIOD.from, to = PERIOD.to): Overview {
  const pays = paidInPeriod(from, to);
  const collectedPaise = pays.reduce((n, r) => n + r.pay.amountPaise, 0);

  const runs = salaryInPeriod(from, to);
  const salaryPaise = runs.reduce((n, r) => n + r.totalNetPaise, 0);

  /* Counter-entries carry a negative amount and are `recorded`, so summing
     `out` naturally nets a reversed pair to zero. */
  const out = snap.transactions.filter((t) => t.direction === "out" && inPeriod(t.valueDate, from, to));
  const operating = out.filter((t) => tagOf(t.tagKey)?.kind !== "excluded");
  const excluded = out.filter((t) => tagOf(t.tagKey)?.kind === "excluded");
  const inn = snap.transactions.filter((t) => t.direction === "in" && inPeriod(t.valueDate, from, to));

  const rfPaid = refundsPaidInPeriod(from, to);
  const rfOwed = snap.refunds.filter((r) => r.state === "approved" && !r.settlement);

  const horizon = new Date(NOW + 30 * DAY).toISOString().slice(0, 10);
  const rows = installmentRows();
  /* AT MOST ONE PER SUBSCRIPTION, and none at all from a defaulting one —
     see nextDue. What is expected in the next 30 days is the row in front of
     each paying customer, not every unpaid row on the books. */
  const due = snap.subscriptions
    .map((sub) => ({ sub, i: nextDue(sub) }))
    .filter((x) => x.i && x.i.dueDate <= horizon) as { sub: Subscription; i: Installment }[];
  const failed = rows.filter((x) => x.i.status === "fail_to_pay");

  const otherOutPaise = operating.reduce((n, t) => n + t.amountPaise, 0);
  const otherInPaise = inn.reduce((n, t) => n + t.amountPaise, 0);
  const refundsPaidPaise = rfPaid.reduce((n, r) => n + r.amountPaise, 0);

  return {
    collectedPaise, collectedN: pays.length,
    salaryPaise, salaryN: runs.reduce((n, r) => n + r.slips.length, 0),
    otherOutPaise, otherOutN: operating.length,
    otherInPaise, otherInN: inn.length,
    refundsPaidPaise, refundsPaidN: rfPaid.length,
    refundsOwedPaise: rfOwed.reduce((n, r) => n + r.amountPaise, 0), refundsOwedN: rfOwed.length,
    dueNextPaise: due.reduce((n, x) => n + x.i.amountPaise, 0), dueNextN: due.length,
    failedPaise: failed.reduce((n, x) => n + x.i.amountPaise, 0), failedN: failed.length,
    excludedPaise: excluded.reduce((n, t) => n + t.amountPaise, 0),
    netPaise: collectedPaise + otherInPaise - salaryPaise - otherOutPaise - refundsPaidPaise,
  };
}

/** The Overview tiles in render order. Built here, not in the view, so the
 *  check suite asserts the numbers a person actually sees. */
export function overviewTiles(from = PERIOD.from, to = PERIOD.to): Tile[] {
  const o = overview(from, to);
  const t = (key: string, paise: number | null, n: number | null, sub: string, tone: Tile["tone"]): Tile =>
    ({ key, label: metric(key)?.label || key, paise, n, sub, tone, unavailable: null });
  return [
    t("collected", o.collectedPaise, o.collectedN, o.collectedN + " installment" + (o.collectedN === 1 ? "" : "s") + " · " + PERIOD.label, "ok"),
    t("salary_cost", o.salaryPaise, o.salaryN, o.salaryN ? o.salaryN + " slips paid" : "no run paid in this period", o.salaryN ? "info" : "mute"),
    t("other_out", o.otherOutPaise, o.otherOutN, o.excludedPaise ? inr(o.excludedPaise) + " excluded, counted apart" : "operating spend only", "info"),
    t("refunds_out", o.refundsPaidPaise, o.refundsPaidN, o.refundsOwedN ? inr(o.refundsOwedPaise) + " approved and not sent" : "nothing awaiting transfer", o.refundsOwedN ? "warn" : "mute"),
    t("net", o.netPaise, null, "collected + other in − salary − spend − refunds", o.netPaise >= 0 ? "ok" : "bad"),
    t("failed", o.failedPaise, o.failedN, o.failedN + " installment" + (o.failedN === 1 ? "" : "s") + " did not clear", o.failedN ? "bad" : "mute"),
    t("due_next", o.dueNextPaise, o.dueNextN, "next 30 days · expected, not earned", "mute"),
  ];
}

/* ============================================================== months === */

/** Every month the records touch, oldest first — derived from the records
 *  themselves. There is no separate history file that could disagree with the
 *  lists, which is the whole reason Analytics cannot contradict a tab. */
/* SALARY PAID BY DEPARTMENT WAS HERE, ALL TIME, AND HAS MOVED — it is
   `departmentYear(fy)` in payroll.ts now, scoped to one financial year.

   All time was the wrong window for the only thing the figure is used for,
   which is comparing departments against each other: it silently rewarded
   whoever had been on the payroll longest, so a team hired in January read as
   cheap beside one hired two years earlier and the bars gave no hint why. The
   argument for all-time was that a period figure is a column of zeros early in
   a month — true of a MONTH, and not true of a year, which is what replaced
   it. There is one department figure in the module, on the page that owns the
   payroll year. */

export function monthPoints(): MonthPoint[] {
  const keys = new Set<string>();
  countedPayments().forEach((r) => keys.add(monthOf(r.pay.valueDate)));
  snap.transactions.forEach((t) => keys.add(monthOf(t.valueDate)));
  snap.salaryRuns.filter((r) => r.state === "paid").forEach((r) => keys.add(r.month));
  snap.refunds.forEach((r) => { if (r.settlement) keys.add(monthOf(r.settlement.paidAt)); });

  /* First payment, not first subscription and not signup: a renewal by an
     existing customer is not a new customer. */
  const firstPayOf = new Map<string, string>();
  countedPayments().slice().sort((a, b) => a.pay.valueDate.localeCompare(b.pay.valueDate))
    .forEach((r) => {
      const k = r.sub.customer.userId || r.sub.customer.name;
      if (!firstPayOf.has(k)) firstPayOf.set(k, r.pay.valueDate);
    });

  return Array.from(keys).sort().map((m) => {
    const o = overview(m + "-01", m + "-31");
    let newCustomers = 0;
    firstPayOf.forEach((d) => { if (monthOf(d) === m) newCustomers++; });
    return {
      month: m,
      subscriptionsPaise: o.collectedPaise,
      salaryPaise: o.salaryPaise,
      otherOutPaise: o.otherOutPaise,
      otherInPaise: o.otherInPaise,
      refundsPaise: o.refundsPaidPaise,
      netPaise: o.netPaise,
      newCustomers,
    };
  });
}

/* ================================================================ KPIs === */

const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export function kpis(from = PERIOD.from, to = PERIOD.to): Kpi[] {
  const o = overview(from, to);
  const months = monthPoints();
  const thisM = monthOf(from);
  const idx = months.findIndex((m) => m.month === thisM);
  const prior = idx > 0 ? months[idx - 1] : null;
  const priorO = prior ? overview(prior.month + "-01", prior.month + "-31") : null;

  /* MRR is a LEVEL read at a moment, never a rate summed over a period. A
     defaulting subscription leaves it the instant an installment fails —
     counting it is how MRR quietly becomes fiction. */
  const active = snap.subscriptions.filter((s) => s.status === "active");
  const mrr = active.reduce((n, s) => n + Math.round(s.totalPaise / Math.max(1, s.cycleMonths)), 0);

  const settled = installmentRows().filter((x) =>
    (x.i.status === "paid" || x.i.status === "fail_to_pay") && inPeriod(x.i.dueDate, from, to));
  const paidN = settled.filter((x) => x.i.status === "paid").length;
  const failN = settled.filter((x) => x.i.status === "fail_to_pay").length;

  const reinvest = snap.transactions.filter((t) => t.direction === "out"
    && tagOf(t.tagKey)?.kind === "reinvestment" && inPeriod(t.valueDate, from, to))
    .reduce((n, t) => n + t.amountPaise, 0);
  const newCustomers = months.filter((m) => m.month === thisM)[0]?.newCustomers ?? 0;
  const activeAccounts = snap.salaryAccounts.filter((a) => a.active).length;
  const websitePaise = paidInPeriod(from, to).filter((r) => r.sub.source === "website")
    .reduce((n, r) => n + r.pay.amountPaise, 0);

  const burn = o.salaryPaise + o.otherOutPaise + o.refundsPaidPaise;
  const priorBurn = priorO ? priorO.salaryPaise + priorO.otherOutPaise + priorO.refundsPaidPaise : null;
  const inTotal = o.collectedPaise + o.otherInPaise;

  const mk = (key: string, value: number | null, priorV: number | null, why: string | null): Kpi => {
    const d = kpiMeta(key);
    return {
      key, label: d?.label || key, value, prior: priorV,
      unit: (d?.unit || "inr") as Kpi["unit"],
      goodDirection: (d?.goodDirection || "up") as Kpi["goodDirection"],
      why, group: d?.group || "Other",
    };
  };

  return [
    mk("mrr", active.length ? mrr : null, null, active.length ? null : "No active subscription to read a level from."),
    mk("arpu", active.length ? Math.round(mrr / active.length) : null, null,
      active.length ? null : "A denominator of nothing has no average."),
    mk("collection_rate", pctOf(paidN, paidN + failN), null,
      paidN + failN ? null : "No installment fell due in this period."),
    mk("fail_rate", pctOf(failN, paidN + failN), null,
      paidN + failN ? null : "No installment fell due in this period."),
    mk("salary_ratio", o.salaryPaise ? pctOf(o.salaryPaise, o.collectedPaise) : null,
      priorO && priorO.salaryPaise ? pctOf(priorO.salaryPaise, priorO.collectedPaise) : null,
      !o.salaryPaise ? "No salary run was paid in this period — the August run is still open." : !o.collectedPaise ? "Nothing was collected in this period." : null),
    mk("cost_per_head", activeAccounts && o.salaryPaise ? Math.round(o.salaryPaise / activeAccounts) : null, null,
      !activeAccounts ? "No active salary account." : !o.salaryPaise ? "No run was paid in this period." : null),
    mk("burn", burn, priorBurn, null),
    mk("net_margin", pctOf(o.netPaise, inTotal), null,
      inTotal ? null : "No money came in, so there is no margin to take."),
    mk("refund_rate", pctOf(o.refundsPaidPaise, o.collectedPaise), null,
      o.collectedPaise ? null : "Nothing was collected in this period."),
    /* Deliberately null. Runway needs a reconciled cash balance and several
       closed months of burn; a placeholder here is a decision made on a wrong
       number — FN-OD-07. */
    mk("runway", null, null, "Needs a reconciled cash balance and a burn history this seed does not carry — FN-OD-07."),
    mk("new_customers", newCustomers, prior ? prior.newCustomers : null, null),
    mk("cac", newCustomers ? Math.round(reinvest / newCustomers) : null, null,
      newCustomers ? null : "No new customer in this period. Dividing by nothing is not free acquisition."),
    mk("website_share", pctOf(websitePaise, o.collectedPaise), null,
      o.collectedPaise ? null : "Nothing was collected in this period."),
  ];
}

/* ====================================================== reconciliation === */

export interface BankLine {
  lineId: string; date: string; dir: "credit" | "debit";
  amountPaise: number; reference: string; narration: string; counterparty: string;
}
export type LineMatch =
  | { kind: "payment"; id: string; label: string }
  | { kind: "transaction"; id: string; label: string }
  | { kind: "none" };

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function lineMatch(lineId: string): LineMatch {
  const hit = readPayments().filter((r) => r.pay.bankLineId === lineId)[0];
  if (hit) return { kind: "payment", id: hit.pay.paymentId, label: hit.sub.customer.name + " · " + hit.sub.subscriptionId };
  const t = snap.transactions.filter((x) => x.bankLineId === lineId)[0];
  if (t) return { kind: "transaction", id: t.txnId, label: t.description };
  return { kind: "none" };
}

export interface Recon {
  stmt: (typeof bankDoc.statements)[number] | null;
  lines: { line: BankLine; match: LineMatch }[];
  bankOnly: { line: BankLine; match: LineMatch }[];
  matchedN: number;
  variancePaise: number;
  canClose: boolean;
  resolutions: Resolution[];
}

export function reconciliation(stmtId?: string): Recon {
  const stmt = (stmtId ? snap.statements.filter((s) => s.stmtId === stmtId)[0] : snap.statements.filter((s) => !s.closed)[0])
    || snap.statements[snap.statements.length - 1] || null;
  if (!stmt) return { stmt: null, lines: [], bankOnly: [], matchedN: 0, variancePaise: 0, canClose: false, resolutions: [] };
  const lines = (stmt.lines as BankLine[]).map((line) => ({ line, match: lineMatch(line.lineId) }));
  const resolved = new Set(snap.resolutions.map((r) => r.targetId));
  const bankOnly = lines.filter((l) => l.match.kind === "none" && !resolved.has(l.line.lineId));
  return {
    stmt, lines, bankOnly,
    matchedN: lines.filter((l) => l.match.kind !== "none").length,
    variancePaise: bankOnly.reduce((n, l) => n + (l.line.dir === "credit" ? l.line.amountPaise : -l.line.amountPaise), 0),
    canClose: bankOnly.length === 0,
    resolutions: snap.resolutions,
  };
}

/** How much of what the bank shows, the records explain. Completeness, never
 *  correctness — a high figure says the two agree on what exists and says
 *  nothing about whether a row was tagged right. */
export function matchedPct(): number | null {
  const all = snap.statements.flatMap((s) => s.lines as BankLine[]);
  if (!all.length) return null;
  const n = all.filter((l) => lineMatch(l.lineId).kind !== "none").length;
  return Math.round((n / all.length) * 1000) / 10;
}

/* ================================================================ tax === */

export function taxSummary(from = PERIOD.from, to = PERIOD.to) {
  const invs = paidInPeriod(from, to)
    .map((r) => readInvoice(r.inst.invoiceNumber))
    .filter(Boolean) as unknown as Record<string, number>[];
  const g = (k: string) => invs.reduce((n, i) => n + (Number(i[k]) || 0), 0);
  return {
    n: invs.length,
    taxablePaise: g("taxablePaise"),
    cgstPaise: g("cgstPaise"), sgstPaise: g("sgstPaise"), igstPaise: g("igstPaise"),
    totalTaxPaise: g("cgstPaise") + g("sgstPaise") + g("igstPaise"),
  };
}

/* ============================================================== writes === */
/* Each is the client half of an endpoint. The order of the steps and the exact
   refusal text are the contract — BACKEND-INTEGRATION.md § Module 6.         */

/** One reference, one row, across every record type — a repeated webhook or a
 *  second entry carrying the same UTR is refused, never written twice. */
function dupReference(ref: string): boolean {
  const r = norm(ref);
  if (!r) return false;
  if (readPayments().some((x) => norm(x.pay.reference) === r)) return true;
  if (snap.transactions.some((t) => norm(t.reference) === r)) return true;
  if (snap.salaryRuns.some((run) => run.slips.some((s) => s.reference && norm(s.reference).startsWith(r)))) return true;
  return snap.refunds.some((rf) => rf.settlement && norm(rf.settlement.reference) === r);
}

function invoiceSet(number: string, patch: Record<string, unknown>) {
  const i = snap.invoices.filter((x) => x.invoiceNumber === number)[0] as unknown as Record<string, unknown>;
  if (i) Object.keys(patch).forEach((k) => { i[k] = patch[k]; });
}

const hex64 = (salt: number) =>
  Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[Math.abs(salt * (i + 7) + i) % 16]).join("");

function issueReceipt(pay: InstallmentPayment, sub: Subscription, inst: Installment) {
  const n = readPayments().filter((r) => r.pay.receipt).length + 307;
  pay.receipt = { number: "IB-RCP-2026-" + String(n).padStart(5, "0"), issuedAt: stamp(), sha256: hex64(n) };
  log(pushEvent(sub.events, "RECEIPT_ISSUED",
    pay.receipt.number + " for installment " + inst.seq + " of " + inst.of + "."), sub.subscriptionId, "subscription");
}

/** A subscription's status is DERIVED from its installments and its term,
 *  never typed.
 *
 *  COMPLETED NEEDS BOTH. Paying every installment does not finish a
 *  subscription — a twelve-month plan settled up front on day one is paid in
 *  full and has eleven months left to serve. Calling that "completed" would
 *  drop a live customer out of MRR the moment they paid, which is precisely
 *  backwards. The term has to be behind us as well. */
function syncSubStatus(s: Subscription) {
  if (s.status === "cancelled" || s.status === "refunded") return;
  const before = s.status;
  const live = s.installments.filter((i) => i.status !== "cancelled");
  const allPaid = live.length > 0 && live.every((i) => i.status === "paid");
  const termServed = s.endDate < todayIso();
  if (live.some((i) => i.status === "fail_to_pay")) s.status = "defaulting";
  else if (allPaid && termServed) s.status = "completed";
  else s.status = "active";
  if (before !== s.status && s.status === "completed")
    log(pushEvent(s.events, "SUBSCRIPTION_COMPLETED",
      "Every installment paid and the term served to " + s.endDate + ". " + inr(s.totalPaise) + " collected in full."),
    s.subscriptionId, "subscription");
}

/** The installment schedule a set of inputs WILL produce. Exported because the
 *  dialog draws it before anything is committed, and a preview computed by a
 *  second copy of this rule would drift from the one that runs — a schedule
 *  you cannot see before you commit it is not a schedule, and one that lies is
 *  worse than none. `recordSubscription` below builds from this same call. */
export function previewSchedule(startDate: string, n: number, totalPaise: number): Installment[] {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return [];
  if (!Number.isInteger(n) || n < 1 || n > 5) return [];
  if (!Number.isInteger(totalPaise) || totalPaise <= 0 || totalPaise % n !== 0) return [];
  const start = new Date(startDate + "T00:00:00Z");
  if (isNaN(start.getTime())) return [];
  const each = totalPaise / n;
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(start); d.setUTCMonth(d.getUTCMonth() + k);
    return {
      seq: k + 1, of: n, dueDate: d.toISOString().slice(0, 10), amountPaise: each,
      status: "due" as const, invoiceNumber: null, payment: null, failure: null,
    };
  });
}

/** Every plan the records know about, for a filter that cannot offer a plan
 *  nothing was ever sold on. */
export function plansSeen(): { planId: string; planName: string }[] {
  const seen = new Map<string, string>();
  snap.subscriptions.forEach((s) => { if (!seen.has(s.planId)) seen.set(s.planId, s.planName); });
  return Array.from(seen, ([planId, planName]) => ({ planId, planName }))
    .sort((a, b) => a.planName.localeCompare(b.planName));
}
export function usePlansSeen() { useVersion(); return plansSeen(); }

/** Which invoices may be attached when a subscription is recorded: issued, of this
 *  customer, and not already carried by another subscription. Exported because
 *  the dialog offers exactly this list — an offer the write would refuse is a
 *  dialog lying to the person using it. */
/* ========================================================== the chain ===
   deal → quotation → invoice → subscription.

   The QUOTATION is where the shape of a sale is agreed: the plan, the term,
   the total, and how many installments it is paid in. The INVOICE is one
   installment of it. Recording a subscription reads both instead of asking an
   operator to retype four numbers that already exist on two documents — and
   numbers that are read cannot disagree with the paperwork they came from.

   A quotation whose installment count is 1 IS a complete payment. There is no
   separate flag, because there is nothing a flag would say that the count does
   not already say.

   COUNT AND DOCUMENTS ARE DIFFERENT QUESTIONS. The chain raises one invoice per
   installment as each falls due, so a two-installment quotation usually has one
   invoice. The count comes from the quotation; counting invoices would report
   the schedule as shorter than it is for as long as it is still running. */

export type FinQuotation = (typeof quotationsDoc.quotations)[number];

export const readQuotations = (): FinQuotation[] => snap.quotations as FinQuotation[];
export const readQuotation = (n: string | null | undefined): FinQuotation | null =>
  (n ? (snap.quotations as FinQuotation[]).filter((q) => q.quotationNumber === n)[0] || null : null);

/** Every invoice number any subscription is holding, at either level. */
function takenInvoiceNumbers(): Set<string> {
  const taken = new Set<string>();
  snap.subscriptions.forEach((s) => {
    if (s.invoiceNumber) taken.add(s.invoiceNumber);
    s.installments.forEach((i) => { if (i.invoiceNumber) taken.add(i.invoiceNumber); });
  });
  return taken;
}

/** The invoices raised against one quotation, oldest first — the installments
 *  of that sale in the order they were billed. Cancelled ones are included:
 *  they are part of the story, and the caller decides what to do with them. */
export const invoicesOfQuotation = (n: string) =>
  snap.invoices.filter((i) => i.quotationNumber === n)
    .slice().sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));

export interface ChainOption {
  quotation: FinQuotation;
  invoices: ReturnType<typeof invoicesOfQuotation>;
  /** The first issued invoice on this quotation that nothing is carrying. Null
   *  when every one is taken or none has been raised yet — two different
   *  reasons it cannot be recorded, and the dialog says which. */
  attachable: ReturnType<typeof invoicesOfQuotation>[number] | null;
  /** Already carried by a subscription. Named so the dialog can say so rather
   *  than showing nothing and leaving somebody to wonder. */
  recordedAs: string | null;
}

/** THE CHAIN, FOR ONE BUSINESS. Accepted quotations only: a subscription
 *  cannot be recorded on a sale that did not happen, so a rejected or expired
 *  quotation is never offered rather than offered and then refused. */
export function chainsFor(userId: string): ChainOption[] {
  const taken = takenInvoiceNumbers();
  return (snap.quotations as FinQuotation[])
    .filter((q) => q.party.userId === userId && q.status === "accepted")
    .map((q) => {
      const invs = invoicesOfQuotation(q.quotationNumber);
      const sub = snap.subscriptions.filter((x) =>
        invs.some((i) => x.invoiceNumber === i.invoiceNumber
          || x.installments.some((n) => n.invoiceNumber === i.invoiceNumber)))[0];
      return {
        quotation: q,
        invoices: invs,
        attachable: invs.filter((i) => i.status === "issued" && !taken.has(i.invoiceNumber))[0] || null,
        recordedAs: sub ? sub.subscriptionId : null,
      };
    })
    .sort((a, b) => b.quotation.quotationDate.localeCompare(a.quotation.quotationDate));
}

export function attachableInvoices(userId: string) {
  const taken = takenInvoiceNumbers();
  return snap.invoices.filter((i) => i.status === "issued"
    && i.customer.userId === userId
    && !taken.has(i.invoiceNumber));
}

/** FN-T01 · RECORD a subscription against the invoice raised for it, and
 *  create its whole installment schedule.
 *
 *  RECORDED, AND STILL LIVE. Renamed from activateSubscription on 2026-08-31.
 *  This screen was never the thing that entitled anybody — the invoice is —
 *  and what happens here is writing down a sale that already happened, which
 *  is what every other face of this module claims to do (FN-AD-01, "Recorded
 *  is what happened"). Entitlement still follows immediately: recording it
 *  makes the subscription live from its start date. What changed is the word,
 *  and the word was overclaiming.
 *
 *  THE INVOICE CARRIES THE MONEY. Nobody types a total. The chain raises one
 *  invoice per installment (FN-OD-14), each for the same amount, so the
 *  subscription total is the attached invoice multiplied by the number of
 *  installments — and the schedule divides back into it exactly, by
 *  construction rather than by luck.
 *
 *  The schedule is created entire: every installment exists from day one with
 *  a due date, because a schedule invented one row at a time is not one. */
export interface RecordSubInput {
  /** The registered user this was sold to. The name is resolved from it, so a
   *  subscription can never name somebody the platform has never heard of. */
  userId: string;
  source: "sales" | "website";
  planId: string; planName: string; cycleMonths: number;
  /** The invoice raised for this subscription. Its grand total is one
   *  installment; the subscription total is that times the count. */
  invoiceNumber: string;
  /** 1 = paid in full, and the dialog says so in those words. Above 1 it is a
   *  schedule. There is no separate "complete payment" count, because one
   *  installment IS complete payment — offering both would put two options in
   *  the dropdown that write the identical row. */
  installmentCount: number; startDate: string;
  /** Free words about THIS recording, kept on the SUBSCRIPTION_RECORDED
   *  event — never load-bearing, but the only place the reason for an
   *  unusual sale is written down in words. */
  remark?: string;
}
export function recordSubscription(input: RecordSubInput): { error: string; subscriptionId: string | null } {
  const user = readUser(input.userId);
  if (!user) return { error: "Pick the customer from the user base — a subscription belongs to a registered account, not to a typed name.", subscriptionId: null };
  const invoice = readInvoice(input.invoiceNumber);
  if (!invoice) return { error: "Attach the invoice this subscription was raised on. The invoice is what the customer owes against, and it is the only thing here that says how much.", subscriptionId: null };
  if (invoice.status !== "issued") return { error: invoice.invoiceNumber + " is " + invoice.status + ". A subscription cannot be recorded against an invoice that was never issued or has been cancelled. (invoice_not_open)", subscriptionId: null };
  if (invoice.customer.userId !== user.userId)
    return { error: invoice.invoiceNumber + " was raised for " + invoice.customer.name + ", not for " + user.name + ". Recording one customer's plan against another's invoice is how the wrong account gets entitled. (customer_mismatch)", subscriptionId: null };
  if (snap.subscriptions.some((x) => x.invoiceNumber === invoice.invoiceNumber
    || x.installments.some((i) => i.invoiceNumber === invoice.invoiceNumber)))
    return { error: invoice.invoiceNumber + " is already carried by another subscription. One invoice, one thing bought. (duplicate_invoice)", subscriptionId: null };
  if (!input.planName.trim()) return { error: "Pick a plan.", subscriptionId: null };
  const n = input.installmentCount;
  if (!Number.isInteger(n) || n < 1 || n > 5)
    return { error: "Between 1 and 5 installments. Beyond five it is a payment plan the sales chain does not raise invoices for.", subscriptionId: null };

  /* THE QUOTATION IS THE AUTHORITY ON THE PAYMENT PLAN — with one standing
     exception: a complete payment is ALWAYS available. A customer who agreed
     three installments and then pays the whole thing at once has not
     disagreed with the document, they have finished it early; the write
     records ONE installment carrying every installment's amount. Any other
     count is a disagreement with what was signed. The dialog offers exactly
     these two; this guard is for every other caller, and for the day
     somebody adds one. */
  const quote = readQuotation(invoice.quotationNumber);
  const completesQuote = !!(quote && quote.status === "accepted" && quote.installments > 1 && n === 1);
  if (quote && quote.status === "accepted" && quote.installments !== n && !completesQuote)
    return {
      error: invoice.invoiceNumber + " was raised on " + quote.quotationNumber + ", which agreed "
        + (quote.installments === 1 ? "a complete payment" : quote.installments + " installments")
        + " — not " + n + " installments"
        + ". Change the quotation if the plan changed; a complete payment is always available. (plan_mismatch)",
      subscriptionId: null,
    };
  if (!input.startDate || input.startDate > todayIso())
    return { error: "A subscription starts when it is sold. The start date cannot be in the future.", subscriptionId: null };

  const a = actor();
  const id = nextId("SUB");
  /* One invoice per installment, each for the same amount — so the total is
     the invoice times the count, and the schedule divides back into it exactly
     by construction. A complete payment on an installment quotation still
     carries ALL the installments' amount: one row, the whole agreement. */
  const each = invoice.grandTotalPaise;
  const totalPaise = each * (completesQuote && quote ? quote.installments : n);
  const installments = previewSchedule(input.startDate, n, totalPaise);
  if (!installments.length) return { error: "That start date is not a date.", subscriptionId: null };
  const start = new Date(input.startDate + "T00:00:00Z");
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + input.cycleMonths);
  const s: Subscription = {
    subscriptionId: id, source: input.source,
    customer: { name: user.name, userId: user.userId },
    planId: input.planId, planName: input.planName, cycleMonths: input.cycleMonths,
    totalPaise, startDate: input.startDate,
    endDate: end.toISOString().slice(0, 10),
    status: "active", installments,
    invoiceNumber: invoice.invoiceNumber,
    paidInFull: n === 1,
    soldBy: a.name, recordedBy: a.name, recordedAt: stamp(), events: [],
  };
  /* The invoice this was recorded against is the first installment's. The
     rest are raised as they fall due. */
  s.installments[0].invoiceNumber = invoice.invoiceNumber;
  log(pushEvent(s.events, "SUBSCRIPTION_RECORDED",
    input.planName + " recorded on " + invoice.invoiceNumber + " · " + inr(totalPaise)
    + (n === 1 ? " paid in full" : " in " + n + " installments of " + inr(each))
    + " · " + (sourceMeta(input.source)?.label || input.source)
    + ". The customer is entitled from " + input.startDate + "."
    + (input.remark && input.remark.trim() ? " Remark: " + input.remark.trim() : "")),
  id, "subscription");
  snap.subscriptions = [s].concat(snap.subscriptions);
  emit();
  return { error: "", subscriptionId: id };
}

/** The invoices that may be attached to one installment: issued, this
 *  customer's, carried by nothing else, and **for exactly this installment's
 *  amount**. The chain raises one invoice per installment, so an invoice for a
 *  different figure is an invoice for a different thing — attaching it would
 *  put a receipt in front of a customer citing a document that does not say
 *  what they paid. */
export function attachableForInstallment(subscriptionId: string, seq: number) {
  const sub = readSubscription(subscriptionId);
  const inst = sub ? sub.installments.filter((i) => i.seq === seq)[0] : null;
  if (!sub || !inst || !sub.customer.userId) return [];
  return attachableInvoices(sub.customer.userId)
    .filter((i) => i.grandTotalPaise === inst.amountPaise);
}

/** FN-T02 · Record the payment that settles one installment. ONE WRITE: the
 *  installment is paid, the receipt is issued and it counts as collected.
 *  There is no window in which two screens disagree. */
export interface RecordPaymentInput {
  subscriptionId: string; seq: number;
  mode: string; reference: string; valueDate: string; accountId: string;
  /** The invoice raised for THIS installment, attached as it is paid. The
   *  chain raises one per installment as it falls due, so an installment
   *  after the first usually arrives here without one. */
  invoiceNumber?: string | null;
}
export function recordInstallmentPayment(input: RecordPaymentInput): { error: string; paymentId: string | null } {
  const s = readSubscription(input.subscriptionId);
  if (!s) return { error: "That subscription no longer exists.", paymentId: null };
  const inst = s.installments.filter((i) => i.seq === input.seq)[0];
  if (!inst) return { error: "There is no installment " + input.seq + " on " + s.subscriptionId + ".", paymentId: null };
  if (inst.status === "paid") return { error: "Installment " + input.seq + " is already paid. (invalid_state_transition)", paymentId: null };
  if (inst.status === "cancelled") return { error: "A cancelled installment cannot be paid. (invalid_state_transition)", paymentId: null };
  if (!input.reference.trim())
    return { error: "The bank reference / UTR is mandatory — without it nothing ties this row to a statement.", paymentId: null };
  if (dupReference(input.reference))
    return { error: "A record already carries reference " + input.reference.trim() + ". (duplicate_reference)", paymentId: null };
  if (!input.valueDate || input.valueDate > todayIso())
    return { error: "The value date is when the bank credited it — it cannot be in the future.", paymentId: null };
  if (!accountOf(input.accountId)) return { error: "Pick the account it was credited to.", paymentId: null };

  /* ATTACHING THE INVOICE FOR THIS INSTALLMENT. The chain raises one per
     installment as it falls due, so the later ones arrive here without one and
     this is where they are joined up. Without it the receipt is issued citing
     no tax invoice at all — it prints a dash where the document should be. */
  const attach = (input.invoiceNumber || "").trim();
  if (attach) {
    if (inst.invoiceNumber && inst.invoiceNumber !== attach)
      return { error: "Installment " + input.seq + " is already billed on " + inst.invoiceNumber + ". An installment is billed once. (duplicate_invoice)", paymentId: null };
    const iv = readInvoice(attach);
    if (!iv) return { error: "That invoice does not exist. Raise it in Invoices first, then attach it here.", paymentId: null };
    if (iv.status !== "issued")
      return { error: attach + " is " + iv.status + ". A receipt cannot cite an invoice that was never issued or has been cancelled. (invoice_not_open)", paymentId: null };
    if (iv.customer.userId !== s.customer.userId)
      return { error: attach + " was raised for " + iv.customer.name + ", not for " + s.customer.name + ". (customer_mismatch)", paymentId: null };
    if (iv.grandTotalPaise !== inst.amountPaise)
      return { error: attach + " is for " + inr(iv.grandTotalPaise) + ", and this installment is " + inr(inst.amountPaise) + ". One invoice bills one installment, for what that installment is. (amount_mismatch)", paymentId: null };
    if (snap.subscriptions.some((x) => x.invoiceNumber === attach
      || x.installments.some((i) => i.invoiceNumber === attach && !(x.subscriptionId === s.subscriptionId && i.seq === inst.seq))))
      return { error: attach + " is already carried by another installment. One invoice, one thing billed. (duplicate_invoice)", paymentId: null };
    inst.invoiceNumber = attach;
  }

  const a = actor();
  const id = nextId("PAY");
  /* If an imported statement already shows this exact reference and amount,
     tie them together now. The statement proves the ledger complete; it is
     never a second opinion on the row. */
  const line = snap.statements.flatMap((st) => st.lines as BankLine[])
    .filter((l) => l.dir === "credit" && norm(l.reference) === norm(input.reference) && l.amountPaise === inst.amountPaise)[0] || null;

  const pay: InstallmentPayment = {
    paymentId: id, amountPaise: inst.amountPaise, mode: input.mode,
    reference: input.reference.trim(), valueDate: input.valueDate, accountId: input.accountId,
    recordedBy: a.name, recordedAt: stamp(), receipt: null,
    bankLineId: line ? line.lineId : null, proof: null,
  };
  inst.payment = pay;
  inst.status = "paid";
  inst.failure = null;

  log(pushEvent(s.events, "INSTALLMENT_PAID",
    "Installment " + inst.seq + " of " + inst.of + " · " + inr(pay.amountPaise) + " · " + pay.mode + " · " + pay.reference
    + (inst.invoiceNumber ? " · billed on " + inst.invoiceNumber : " · no tax invoice cited")
    + (attach ? ", attached with this payment" : "") + "."),
  s.subscriptionId, "subscription");
  issueReceipt(pay, s, inst);
  if (line) pushEvent(s.events, "MATCHED", "Already on the imported statement as " + line.reference + " · " + line.date + ".");
  if (inst.invoiceNumber) invoiceSet(inst.invoiceNumber, { paymentStatus: "paid" });
  syncSubStatus(s);
  emit();
  return { error: "", paymentId: id };
}

/** FN-T03 · Record that an installment did not get paid. This writes down
 *  something that HAPPENED — a decline, a cancelled mandate, or a due date
 *  that has demonstrably passed. Never a guess, which is why the reason is a
 *  closed list and the evidence is mandatory. */
export function markFailToPay(subscriptionId: string, seq: number, reason: string, evidence: string): string {
  const s = readSubscription(subscriptionId);
  if (!s) return "That subscription no longer exists.";
  const inst = s.installments.filter((i) => i.seq === seq)[0];
  if (!inst) return "There is no installment " + seq + " on " + s.subscriptionId + ".";
  if (inst.status === "paid") return "Installment " + seq + " is paid. Reverse the payment first. (invalid_state_transition)";
  if (inst.status === "cancelled") return "A cancelled installment cannot fail. (invalid_state_transition)";
  if (!failureMeta(reason)) return "Pick what actually happened.";
  if (reason === "overdue" && inst.dueDate > todayIso())
    return "Installment " + seq + " is not due until " + inst.dueDate + ". A date that has not passed is not evidence of anything. (validation_failed)";
  if (!evidence.trim())
    return "Record what the gateway or the bank said — a failure with no evidence is indistinguishable from a guess. (reason_required)";

  inst.status = "fail_to_pay";
  inst.failure = { at: stamp(), reason, note: evidence.trim(), attempt: (inst.failure?.attempt || 0) + 1 };
  log(pushEvent(s.events, "INSTALLMENT_FAILED",
    "Installment " + inst.seq + " of " + inst.of + " · " + (failureMeta(reason)?.label || reason) + " · " + evidence.trim()),
  s.subscriptionId, "subscription");
  syncSubStatus(s);
  emit();
  return "";
}

/** FN-T04 · Reverse an installment payment. Super Admin. The history keeps
 *  the payment and its receipt; the installment returns to unpaid. */
export function reversePayment(paymentId: string, reason: string): string {
  const hit = readPayment(paymentId);
  if (!hit) return "That payment no longer exists.";
  if (hit.inst.status !== "paid") return "Only a paid installment can be reversed. (invalid_state_transition)";
  if (!reason.trim()) return "A reversal with no reason is indistinguishable from a mistake at audit. (reason_required)";
  const sa = superAdminOnly("Reversing a payment"); if (sa) return sa;
  const a = actor();
  const { sub, inst, pay } = hit;
  log(pushEvent(sub.events, "PAYMENT_REVERSED",
    pay.paymentId + " · " + inr(pay.amountPaise) + " reversed by " + a.name + " — " + reason.trim()
    + ". Receipt " + (pay.receipt?.number || "—") + " is retained: a receipt for money later recalled is more interesting to an auditor, not less."),
  sub.subscriptionId, "subscription");
  inst.payment = null;
  inst.status = "due";
  if (inst.invoiceNumber)
    invoiceSet(inst.invoiceNumber, { paymentStatus: "unpaid", status: "cancelled", cancellationReason: "payment reversed" });
  syncSubStatus(sub);
  emit();
  return "";
}

/** FN-T05 · Cancel a subscription. Unpaid installments are cancelled, not
 *  written off; money already collected is untouched. */
export function cancelSubscription(id: string, reason: string): string {
  const s = readSubscription(id);
  if (!s) return "That subscription no longer exists.";
  if (s.status === "cancelled") return "It is already cancelled. (invalid_state_transition)";
  if (!reason.trim()) return "Say why it is ending. (reason_required)";
  const n = s.installments.filter((i) => i.status !== "paid").length;
  s.installments.forEach((i) => { if (i.status !== "paid") { i.status = "cancelled"; i.failure = null; } });
  s.status = "cancelled";
  log(pushEvent(s.events, "SUBSCRIPTION_CANCELLED",
    reason.trim() + " · " + n + " unpaid installment" + (n === 1 ? "" : "s") + " cancelled. Money already collected is untouched."),
  id, "subscription");
  emit();
  return "";
}

/* ---------------------------------------------------------- salaries --- */

/** FN-T06 · Open or revise a salary account. The components are typed, never
 *  derived from a role: a salary is a contract with a person, not a function
 *  of their permissions. */
export interface SalaryAccountInput {
  memberId: number; memberName: string; employeeCode: string; designation: string;
  /** Defaults to permanent where the form does not ask. A value somebody can
   *  see and change beats a blank they cannot filter on. */
  engagement?: string;
  joinedAt: string;
  earnings: SalaryComponent[]; deductions: SalaryComponent[];
  bank: { masked: string; ifsc: string; name: string; upi?: string }; pan: string; uan: string | null;
  department: string;
}
export function upsertSalaryAccount(input: SalaryAccountInput, id?: string): { error: string; salaryAccountId: string | null } {
  if (!input.memberId) return { error: "This account must point at a real Team member — that link is what stops a salary existing for nobody.", salaryAccountId: null };
  if (!input.memberName.trim()) return { error: "Pick the team member this account belongs to.", salaryAccountId: null };
  const gross = input.earnings.reduce((n, e) => n + e.amountPaise, 0);
  if (gross <= 0) return { error: "The earnings must add up to more than zero.", salaryAccountId: null };
  if (input.earnings.some((e) => !Number.isInteger(e.amountPaise) || e.amountPaise < 0)
    || input.deductions.some((d) => !Number.isInteger(d.amountPaise) || d.amountPaise < 0))
    return { error: "Every component is a whole amount, and none of them is negative.", salaryAccountId: null };
  const ded = input.deductions.reduce((n, d) => n + d.amountPaise, 0);
  if (ded > gross) return { error: "Deductions of " + inr(ded) + " exceed earnings of " + inr(gross) + ". Net pay cannot be negative.", salaryAccountId: null };
  const dup = snap.salaryAccounts.filter((a) => a.memberId === input.memberId && a.active && a.salaryAccountId !== id)[0];
  if (dup) return { error: input.memberName + " already has an open salary account (" + dup.salaryAccountId + "). Close it before opening another. (duplicate_account)", salaryAccountId: null };

  const a = actor();
  if (id) {
    const acc = readSalaryAccount(id);
    if (!acc) return { error: "That salary account no longer exists.", salaryAccountId: null };
    const was = acc.monthlyGrossPaise;
    Object.assign(acc, input, { monthlyGrossPaise: gross });
    log(pushEvent(acc.events, "SALARY_REVISED",
      "Monthly gross " + inr(was) + " → " + inr(gross) + ". Slips already issued keep the old figures."), id, "salary");
    emit();
    return { error: "", salaryAccountId: id };
  }
  const newId = nextId("SAL");
  const acc: SalaryAccount = {
    salaryAccountId: newId, ...input, engagement: input.engagement || "permanent",
    monthlyGrossPaise: gross, active: true,
    recordedBy: a.name, recordedAt: stamp(), events: [],
  };
  log(pushEvent(acc.events, "SALARY_ACCOUNT_OPENED",
    input.designation + " · monthly gross " + inr(gross) + " · net " + inr(gross - ded) + "."), newId, "salary");
  snap.salaryAccounts = snap.salaryAccounts.concat([acc]);
  emit();
  return { error: "", salaryAccountId: newId };
}

export function closeSalaryAccount(id: string, reason: string): string {
  const acc = readSalaryAccount(id);
  if (!acc) return "That salary account no longer exists.";
  if (!acc.active) return "It is already closed. (invalid_state_transition)";
  if (!reason.trim()) return "Say why it is closing. (reason_required)";
  const run = openRun();
  if (run && run.slips.some((s) => s.salaryAccountId === id))
    return acc.memberName + " has a slip on the open run " + run.runId + ". Pay that run first — closing the account now would leave a slip nobody can explain. (invalid_state_transition)";
  acc.active = false;
  log(pushEvent(acc.events, "SALARY_ACCOUNT_CLOSED",
    reason.trim() + " · slips already issued stay on the record."), id, "salary");
  emit();
  return "";
}

/** Who a run WOULD pay and what it would come to. Exported so the dialog can
 *  show it before the button is pressed without re-deriving the rule — the
 *  same reason previewSchedule exists. */
export function previewRun(): { account: SalaryAccount; grossPaise: number; deductionsPaise: number; netPaise: number }[] {
  return snap.salaryAccounts.filter((a) => a.active).map((account) => {
    const grossPaise = account.earnings.reduce((n, e) => n + e.amountPaise, 0);
    const deductionsPaise = account.deductions.reduce((n, d) => n + d.amountPaise, 0);
    return { account, grossPaise, deductionsPaise, netPaise: grossPaise - deductionsPaise };
  });
}
export function usePreviewRun() { useVersion(); return previewRun(); }

/** The reference each slip in a run will carry, so the dialog can show what
 *  will actually land rather than only the stem it was given. */
export const slipReference = (stem: string, index: number) => stem.trim() + "-" + String(index + 1).padStart(2, "0");

/** FN-T07 · Open a run for a month and issue a slip for every active account.
 *  Each slip FREEZES its components — a raise next month cannot rewrite it. */
export function openSalaryRun(month: string): { error: string; runId: string | null } {
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Pick a month.", runId: null };
  if (snap.salaryRuns.some((r) => r.month === month)) return { error: "A run already exists for " + month + ". (duplicate_run)", runId: null };
  if (month > monthOf(todayIso())) return { error: "A month that has not started cannot be run.", runId: null };
  const open = openRun();
  if (open) return { error: open.runId + " is still open. Pay it before opening another — two open runs cannot be reconciled against one balance. (period_open)", runId: null };
  const active = snap.salaryAccounts.filter((a) => a.active);
  if (!active.length) return { error: "There is no active salary account to pay.", runId: null };

  const a = actor();
  const runId = "RUN-" + month;
  const slips: Payslip[] = active.map((acc) => {
    const gross = acc.earnings.reduce((n, e) => n + e.amountPaise, 0);
    const ded = acc.deductions.reduce((n, d) => n + d.amountPaise, 0);
    return {
      slipId: "SLIP-" + month + "-" + (acc.salaryAccountId.split("-").pop() || "0000"),
      salaryAccountId: acc.salaryAccountId, memberId: acc.memberId, memberName: acc.memberName,
      employeeCode: acc.employeeCode, designation: acc.designation, month,
      paidDays: daysInMonth(month), lopDays: 0,
      baseEarnings: clone(acc.earnings), earnings: clone(acc.earnings), deductions: clone(acc.deductions),
      /* A NEW SLIP HAS NO INCENTIVE, and says so with an empty array rather
         than an absent one. Nothing is earned yet — the month has only just
         opened — and an incentive is granted when the person is paid, not
         when the run is cut. Present-and-empty means "none this month";
         absent would mean "this slip predates incentives", which is a
         different statement and true only of the historical seed. */
      incentives: [], incentivePaise: 0,
      grossPaise: gross, deductionsPaise: ded, netPaise: gross - ded,
      paidAt: null, mode: "NEFT", reference: "", accountId: "ACC-HDFC-4021",
      bank: clone(acc.bank), pan: acc.pan, uan: acc.uan, issuedAt: null, sha256: null,
    };
  });
  const run: SalaryRun = {
    runId, month, state: "open", slips,
    totalNetPaise: slips.reduce((n, s) => n + s.netPaise, 0),
    recordedBy: a.name, recordedAt: stamp(), paidAt: null, events: [],
  };
  log(pushEvent(run.events, "RUN_OPENED",
    slips.length + " slip" + (slips.length === 1 ? "" : "s") + " · net " + inr(run.totalNetPaise) + ". Nobody has been paid yet."), runId, "run");
  snap.salaryRuns = snap.salaryRuns.concat([run]);
  emit();
  return { error: "", runId };
}

/** Loss of pay on an open run's slip: every earning is pro-rated, deductions
 *  are not. Recomputes the slip and the run total in one place so the two can
 *  never drift. */
export function setLop(slipId: string, lopDays: number): string {
  const run = runOfSlip(slipId);
  const slip = readSlip(slipId);
  if (!run || !slip) return "That slip no longer exists.";
  if (run.state !== "open") return "A paid run is frozen. (invalid_state_transition)";
  const basis = daysInMonth(slip.month);
  if (!Number.isInteger(lopDays) || lopDays < 0 || lopDays >= basis)
    return "Loss of pay is between 0 and " + (basis - 1) + " days — " + fmtMonth(slip.month) + " has " + basis + ". A whole month lost is not loss of pay, it is an unpaid month.";
  /* FROM THE SLIP'S OWN FROZEN BASE, never from the salary account. A raise
     granted after this run opened must not be able to reach back into this
     month, and setting loss of pay twice must land on the same figures. */
  slip.lopDays = lopDays;
  slip.paidDays = basis - lopDays;
  slip.earnings = slip.baseEarnings.map((e) => ({ ...e, amountPaise: Math.round((e.amountPaise * (basis - lopDays)) / basis) }));
  /* THE INCENTIVE IS NOT PRO-RATED, and that is the whole reason it lives in
     its own array. Salary is paid for time served, so losing three days costs
     three days of it; an incentive is paid for something that was achieved,
     and being absent afterwards does not un-achieve it. It is added to gross
     AFTER the pro-rating above, untouched. */
  slip.grossPaise = money(slip.earnings) + incentiveOf(slip);
  slip.deductionsPaise = slip.deductions.reduce((n, d) => n + d.amountPaise, 0);
  slip.netPaise = slip.grossPaise - slip.deductionsPaise;
  run.totalNetPaise = run.slips.reduce((n, s) => n + s.netPaise, 0);
  log(pushEvent(run.events, "SLIP_ISSUED",
    slip.memberName + " · " + lopDays + " day" + (lopDays === 1 ? "" : "s") + " loss of pay · net " + inr(slip.netPaise) + "."), run.runId, "run");
  emit();
  return "";
}

/** FN-T08b · Pay ONE person. Super Admin.
 *
 *  THIS REVERSES THE INVARIANT BELOW, DELIBERATELY. `recordRunPaid` says a run
 *  half paid is not a state, and while the run was the unit somebody acted on
 *  that was true. It is not the unit any more: salaries are paid person by
 *  person, so a run part-paid is the ordinary mid-month state and pretending
 *  otherwise would mean the screen could not show what is actually happening.
 *
 *  WHAT DID NOT CHANGE is the part that matters: a slip still freezes — its
 *  number, its hash and its amounts are stamped in the write that pays it, and
 *  nothing can rewrite it afterwards. The freeze moved from the run to the
 *  slip, which is where it always belonged; a document is frozen when it is
 *  issued, not when its neighbours are.
 *
 *  ARREARS ARE PAID OLDEST FIRST. Somebody owed two months and paid once has
 *  been paid for the older month — anything else invents a preference nobody
 *  expressed, and leaves the older debt ageing while the newer one clears. */
export interface PaySalaryInput {
  /** `bank` · `upi` · `cash`. See PAY_VIA. */
  via: string;
  accountId: string;
  /** MANDATORY, whatever the method. An image or a PDF: the transfer receipt,
   *  the UPI screenshot, the signed cash acknowledgement. It is the only
   *  evidence a salary payment has now that the reference field is gone. */
  proof: { filename: string; mime: string; bytes?: number };
  remark?: string;
  /** One-off amounts settled WITH this transfer. They land as NAMED LINES on
   *  the newest month's slip — an incentive as an earning, a deduction as a
   *  deduction — and the slip's own totals move with them, because the slip
   *  is the whole story of what was paid. Money that left the account but is
   *  on no document is money nobody can explain at audit. */
  incentive?: { label: string; amountPaise: number } | null;
  deduction?: { label: string; amountPaise: number } | null;
}

export function paySalary(salaryAccountId: string, input: PaySalaryInput): string {
  const acc = readSalaryAccount(salaryAccountId);
  if (!acc) return "That salary account no longer exists.";
  const row = toSalaryRow(acc);
  const due = dueOf(row);
  if (!due.unpaid.length) return acc.memberName + " has nothing outstanding. (nothing_due)";

  const via = payViaMeta(input.via);
  if (!via) return "Pick how it was paid.";

  /* THE PROOF IS THE EVIDENCE, and there is no longer anything else. A payment
     with none is a claim, and this module does not store claims. */
  const filename = (input.proof?.filename || "").trim();
  if (!filename) return "Attach the receipt. It is the only evidence this payment has. (proof_required)";
  if (!proofAccepted(input.proof.mime))
    return filename + " is neither an image nor a PDF. A receipt has to be something somebody can open and read. (proof_type)";
  if (!accountOf(input.accountId)) return "Pick the account it was paid from.";
  const sa = superAdminOnly("Paying a salary"); if (sa) return sa;
  const accountId = input.accountId;

  /* The adjustments, checked to the same standard as an account component:
     a clean integer amount and a name. A figure nobody can name is a figure
     nobody can explain at audit. */
  const norm = (x: { label: string; amountPaise: number } | null | undefined, what: string):
      { line: SalaryComponent | null; err: string } => {
    if (!x || !x.amountPaise) return { line: null, err: "" };
    if (!Number.isInteger(x.amountPaise) || x.amountPaise < 0)
      return { line: null, err: "The " + what + " is not a clean amount. Rupees, up to two decimals. (adjustment_amount)" };
    const label = (x.label || "").trim();
    if (!label)
      return { line: null, err: "Name the " + what + ". It prints on the slip, and a figure nobody can name is a figure nobody can explain. (adjustment_label)" };
    return { line: { key: what, label, amountPaise: x.amountPaise }, err: "" };
  };
  const inc = norm(input.incentive, "incentive"); if (inc.err) return inc.err;
  const ded = norm(input.deduction, "deduction"); if (ded.err) return ded.err;

  const at = stamp();
  /* Oldest first, so the debt that has been waiting longest clears first. */
  const order = due.unpaid.slice().sort((x, y) => x.month.localeCompare(y.month));

  /* ADJUSTMENTS LAND ON THE NEWEST SLIP, before anything freezes. The newest
     because that is the month being settled today — arrears are old documents
     clearing, not places for new lines. A deduction may not push that slip
     below zero: a negative payslip is not a document, it is a debt wearing a
     document's clothes, and this module does not issue those. */
  const newest = order[order.length - 1];
  const incPaise = inc.line ? inc.line.amountPaise : 0;
  if (ded.line && ded.line.amountPaise > newest.netPaise + incPaise) {
    return "The deduction is bigger than " + fmtMonth(newest.month) + "'s net"
      + (inc.line ? " plus the incentive" : "") + " — " + inr(newest.netPaise + incPaise)
      + ". A slip cannot go below zero; recover the rest from a later month. (deduction_exceeds)";
  }
  if (inc.line || ded.line) {
    /* THE INCENTIVE GOES TO `incentives`, NOT TO `earnings`. It used to be
       concatenated onto `earnings`, which paid the right amount and destroyed
       the only thing that made it an incentive: once it sat beside basic and
       HRA, nothing downstream could tell committed pay from earned pay, and
       payroll analytics had to guess by matching labels. It is the same money
       on the same slip and it still prints as its own line — it is now filed
       as what it is. Loss of pay pro-rates `earnings` and never this. */
    if (inc.line) {
      newest.incentives = (newest.incentives || []).concat([inc.line]);
      newest.incentivePaise = money(newest.incentives);
    }
    if (ded.line) newest.deductions = newest.deductions.concat([ded.line]);
    newest.grossPaise = money(newest.earnings) + incentiveOf(newest);
    newest.deductionsPaise = money(newest.deductions);
    newest.netPaise = newest.grossPaise - newest.deductionsPaise;
    /* The run's stored total is the sum of its slips and must stay it. */
    const holder = snap.salaryRuns.filter((r) => r.slips.indexOf(newest) >= 0)[0];
    if (holder) holder.totalNetPaise = holder.slips.reduce((n, x) => n + x.netPaise, 0);
  }
  /* What actually leaves the account: the slips as they now stand. */
  const leaving = order.reduce((n, x) => n + x.netPaise, 0);

  order.forEach((slip, k) => {
    slip.paidAt = at;
    slip.accountId = accountId;
    /* NO REFERENCE, on purpose. The field is gone from the dialog and nothing
       fabricates one here — a slip whose reference column is blank says
       plainly that this payment is evidenced by its attachment and not by a
       string somebody typed. `dupReference` already skips empty ones, so the
       ledger's uniqueness rule is untouched. */
    slip.reference = "";
    slip.mode = via.mode;
    slip.via = via.key;
    slip.proof = { type: "receipt", filename, uploadedAt: at };
    slip.remark = (input.remark || "").trim() || undefined;
    slip.issuedAt = at;
    slip.sha256 = hex64(slip.netPaise + k);
  });

  /* A run is paid when its last unpaid slip is. It is not a thing anybody
     presses any more — it is a consequence of everybody on it being paid. */
  snap.salaryRuns.forEach((run) => {
    if (run.state === "paid") return;
    if (run.slips.length && run.slips.every((s) => s.paidAt)) {
      run.state = "paid";
      run.paidAt = at;
      log(pushEvent(run.events, "RUN_PAID",
        "Every slip on " + run.runId + " is now paid. The run closed itself; nobody marked it."), run.runId, "run");
    }
  });

  const months = order.map((s) => fmtMonth(s.month)).join(", ");
  log(pushEvent(acc.events, "SALARY_PAID",
    inr(leaving) + " to " + acc.memberName + " by " + via.label.toLowerCase()
    + " from " + (accountOf(accountId)?.masked || accountId)
    + " · " + months
    + (order.length > 1 ? " (" + order.length + " months, oldest first)" : "")
    + (inc.line ? " · incentive " + inr(inc.line.amountPaise) + " (" + inc.line.label + ")" : "")
    + (ded.line ? " · deduction " + inr(ded.line.amountPaise) + " (" + ded.line.label + ")" : "")
    + " · evidenced by " + filename + "."),
  salaryAccountId, "salary");
  emit();
  return "";
}

/** FN-T08d · Hold ONE slip, or release it. A dispute is about a month, not a
 *  person: holding March must not stop April going out, which is why this is
 *  a slip write and not an account one. Only an unpaid slip can hold — a paid
 *  document is frozen — and the reason is mandatory on the way IN because the
 *  hold prints nowhere else. Releasing needs none: it restores the ordinary
 *  state, and the release event says who and when. */
export function setSlipHold(slipId: string, hold: boolean, reason: string): string {
  const slip = readSlip(slipId);
  if (!slip) return "That slip no longer exists.";
  if (slip.paidAt)
    return slip.slipId + " is paid and frozen. A paid document cannot be held. (already_paid)";
  if (!!slip.held === hold)
    return hold ? slip.slipId + " is already on hold." : slip.slipId + " is not on hold.";
  if (hold && !reason.trim())
    return "Say why it is held. The hold prints on no document, so the reason is the only record it has. (reason_required)";
  const acc = readSalaryAccount(slip.salaryAccountId);
  slip.held = hold;
  slip.heldReason = hold ? reason.trim() : null;
  if (acc) {
    log(pushEvent(acc.events, hold ? "SALARY_HELD" : "SALARY_RELEASED",
      fmtMonth(slip.month) + "'s slip (" + inr(slip.netPaise) + ") "
      + (hold ? "held: " + reason.trim() : "released — it counts as owed again.")),
    slip.salaryAccountId, "salary");
  }
  emit();
  return "";
}

/** FN-T08 · Mark the run paid. Super Admin. Every slip is stamped, numbered
 *  and frozen in the same write — a run half paid is not a state.
 *
 *  SUPERSEDED by `paySalary` above and kept only because the check suite still
 *  asserts its refusals, which are the same refusals the per-person write
 *  makes. Nothing in the panel calls it: the button that did is gone. Delete
 *  it and its assertions together, or wire it to a "pay everybody" control if
 *  one is ever wanted. */
export function recordRunPaid(runId: string, reference: string, accountId: string): string {
  const run = readRun(runId);
  if (!run) return "That run no longer exists.";
  if (run.state === "paid") return "It is already paid. (invalid_state_transition)";
  if (!run.slips.length) return "There is nothing to pay on this run.";
  if (!reference.trim()) return "The transfer reference is mandatory — it is what ties this run to the bank. (validation_failed)";
  if (dupReference(reference)) return "A record already carries reference " + reference.trim() + ". (duplicate_reference)";
  if (!accountOf(accountId)) return "Pick the account it was paid from.";
  const sa = superAdminOnly("Paying a salary run"); if (sa) return sa;

  const a = actor();
  const at = stamp();
  run.slips.forEach((s, k) => {
    s.paidAt = at;
    s.accountId = accountId;
    s.reference = reference.trim() + "-" + String(k + 1).padStart(2, "0");
    s.issuedAt = at;
    s.sha256 = hex64(s.netPaise + k);
  });
  run.state = "paid";
  run.paidAt = at;
  run.recordedBy = a.name;
  log(pushEvent(run.events, "RUN_PAID",
    inr(run.totalNetPaise) + " to " + run.slips.length + " people from " + (accountOf(accountId)?.masked || accountId)
    + " · " + reference.trim() + ". Every slip is frozen."), runId, "run");
  emit();
  return "";
}

/* ------------------------------------------------- other transactions --- */

/** FN-T09 · Create a tag. Custom by definition — the panel makes these. The
 *  KIND is the part that is not free: it decides where the money lands. */
export function addTag(label: string, kind: TagKind, budgetPaise: number | null, proofRequired: boolean): { error: string; tagKey: string | null } {
  const l = label.trim();
  if (!l) return { error: "Name the tag.", tagKey: null };
  if (!tagKindMeta(kind)) return { error: "Pick what this rolls up to — it decides where the money lands in Analytics.", tagKey: null };
  const key = l.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20);
  if (!key) return { error: "That name has no letters or digits in it.", tagKey: null };
  if (snap.tags.some((t) => t.tagKey === key)) return { error: "A tag called " + l + " already exists. (duplicate_tag)", tagKey: null };
  if (budgetPaise !== null && (!Number.isInteger(budgetPaise) || budgetPaise < 0))
    return { error: "A budget is a whole amount, or none at all.", tagKey: null };
  const a = actor();
  snap.tags = snap.tags.concat([{
    tagKey: key, label: l, kind, custom: true, budgetPaise, proofRequired,
    active: true, createdBy: a.name, createdAt: stamp(),
  }]);
  note("TAG_CREATED", key, "tag", l + " · " + (tagKindMeta(kind)?.label || kind) + " · lands in " + (tagKindMeta(kind)?.landsIn || "—") + ".");
  emit();
  return { error: "", tagKey: key };
}

/** A tag is DEACTIVATED, never deleted — deleting one would silently
 *  re-bucket every transaction that already used it. */
export function deactivateTag(key: string): string {
  const t = tagOf(key);
  if (!t) return "That tag no longer exists.";
  if (!t.active) return "It is already inactive. (invalid_state_transition)";
  const sa = superAdminOnly("Deactivating a tag"); if (sa) return sa;
  const n = snap.transactions.filter((x) => x.tagKey === key).length;
  t.active = false;
  note("TAG_DEACTIVATED", key, "tag", t.label + " · " + n + " existing row" + (n === 1 ? "" : "s") + " keep it. Nothing was re-bucketed.");
  emit();
  return "";
}

export function setBudget(key: string, budgetPaise: number | null): string {
  const t = tagOf(key);
  if (!t) return "That tag no longer exists.";
  if (budgetPaise !== null && (!Number.isInteger(budgetPaise) || budgetPaise < 0)) return "A budget is a whole amount, or none at all.";
  const was = t.budgetPaise;
  t.budgetPaise = budgetPaise;
  note("BUDGET_SET", key, "tag",
    t.label + " · " + (was ? inr(was) : "none") + " → " + (budgetPaise ? inr(budgetPaise) : "none") + ". A budget warns; it never blocks.");
  emit();
  return "";
}

/** FN-T10 · Record a company expense or income. One mandatory tag, one
 *  mandatory reference. Money IN is restricted to three non-revenue kinds. */
export interface TxnInput {
  direction: "out" | "in"; tagKey: string; amountPaise: number;
  description: string; party: string; mode: string; reference: string;
  valueDate: string; accountId: string; creditKind?: string | null;
}
export function recordTransaction(input: TxnInput): { error: string; txnId: string | null } {
  const tag = tagOf(input.tagKey);
  if (!tag) return { error: "Every row needs a tag — it is what decides where this lands in Analytics.", txnId: null };
  if (!tag.active) return { error: tag.label + " is inactive. Pick a live tag.", txnId: null };
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) return { error: "The amount must be a whole figure above zero.", txnId: null };
  if (!input.description.trim()) return { error: "Say what it was for.", txnId: null };
  if (!input.reference.trim()) return { error: "The reference is mandatory — without it this row can never be tied to a statement.", txnId: null };
  if (dupReference(input.reference)) return { error: "A record already carries reference " + input.reference.trim() + ". (duplicate_reference)", txnId: null };
  if (!input.valueDate || input.valueDate > todayIso()) return { error: "The value date is when the money moved — it cannot be in the future.", txnId: null };
  if (!accountOf(input.accountId)) return { error: "Pick the account.", txnId: null };
  if (input.direction === "in" && (!input.creditKind || !CREDIT_KINDS.some((c) => c.key === input.creditKind)))
    return { error: "Money in is restricted here to bank interest, an own transfer or a vendor refund. Customer money has exactly one way in: a subscription.", txnId: null };

  const a = actor();
  const id = nextId("TXN");
  const line = snap.statements.flatMap((st) => st.lines as BankLine[])
    .filter((l) => l.dir === (input.direction === "out" ? "debit" : "credit")
      && norm(l.reference) === norm(input.reference) && l.amountPaise === input.amountPaise)[0] || null;
  const t: CompanyTxn = {
    txnId: id, direction: input.direction, tagKey: input.tagKey, amountPaise: input.amountPaise,
    description: input.description.trim(), party: input.party.trim(), mode: input.mode,
    reference: input.reference.trim(), valueDate: input.valueDate, accountId: input.accountId,
    state: "recorded", bill: null, bankLineId: line ? line.lineId : null,
    nonRevenue: input.direction === "in", creditKind: input.direction === "in" ? input.creditKind || null : null,
    reversesTxnId: null, reversal: null, recordedBy: a.name, recordedAt: stamp(), events: [],
  };
  log(pushEvent(t.events, "TXN_RECORDED",
    (input.direction === "out" ? "Paid " : "Received ") + inr(t.amountPaise) + " · " + tag.label + " · " + (t.party || "—") + "."), id, "transaction");
  if (line) pushEvent(t.events, "MATCHED", "Already on the imported statement as " + line.reference + " · " + line.date + ".");
  snap.transactions = [t].concat(snap.transactions);
  emit();
  return { error: "", txnId: id };
}

export function attachBill(id: string, filename: string): string {
  const t = readTransaction(id);
  if (!t) return "That transaction no longer exists.";
  if (!filename.trim()) return "Pick a file.";
  const bill: Proof = { type: "invoice", filename: filename.trim(), uploadedAt: stamp() };
  t.bill = bill;
  log(pushEvent(t.events, "BILL_ATTACHED", filename.trim() + " attached."), id, "transaction");
  emit();
  return "";
}

/** FN-T11 · Reverse a transaction. Super Admin. A counter-entry carrying a
 *  negative amount is appended; the original row is untouched. */
export function reverseTransaction(id: string, reason: string): string {
  const t = readTransaction(id);
  if (!t) return "That transaction no longer exists.";
  if (t.state === "reversed") return "It is already reversed. (invalid_state_transition)";
  if (t.reversesTxnId) return "A counter-entry cannot itself be reversed. (invalid_state_transition)";
  if (!reason.trim()) return "A reversal with no reason is indistinguishable from a mistake at audit. (reason_required)";
  const sa = superAdminOnly("Reversing a transaction"); if (sa) return sa;
  const a = actor();
  const cid = "TXN-RV-" + (t.txnId.split("-").pop() || "0000");
  const c: CompanyTxn = {
    ...clone(t), txnId: cid, amountPaise: -t.amountPaise, valueDate: todayIso(),
    state: "recorded", reversesTxnId: t.txnId, reversal: null, bill: null, bankLineId: null,
    recordedBy: a.name, recordedAt: stamp(), events: [],
  };
  t.state = "reversed";
  t.reversal = { counterId: cid, reason: reason.trim(), by: a.name, at: stamp() };
  log(pushEvent(c.events, "TXN_REVERSED", "Counter-entry for " + t.txnId + " · −" + inr(t.amountPaise) + " · " + reason.trim()), cid, "transaction");
  pushEvent(t.events, "TXN_REVERSED", "Reversed by " + a.name + " — " + reason.trim() + ". " + cid + " carries the offset.");
  snap.transactions = [c].concat(snap.transactions);
  emit();
  return "";
}

/* ----------------------------------------------------------- refunds --- */

/** FN-T12 · Request a refund against a recorded installment payment. Full
 *  amount only — a partial refund implies a partly-paid installment, which
 *  the 1:1 rule says cannot exist. */
export function requestRefund(paymentId: string, ground: string, detail: string): { error: string; refundId: string | null } {
  const hit = readPayment(paymentId);
  if (!hit) return { error: "That payment is not in the ledger.", refundId: null };
  if (!groundMeta(ground)) return { error: "Pick a ground.", refundId: null };
  if (!detail.trim()) return { error: "Say what happened — the approver reads this, and so does the audit.", refundId: null };
  if (snap.refunds.some((r) => r.paymentId === paymentId && (r.state === "requested" || r.state === "sent_back" || r.state === "approved")))
    return { error: "There is already an open refund on " + paymentId + ". (duplicate_request)", refundId: null };

  const a = actor();
  const id = nextId("RF");
  const pc = refundPolicyCheck(paymentId, ground);
  const r: Refund = {
    refundId: id, origin: "subscription", subscriptionId: hit.sub.subscriptionId, paymentId,
    payee: { name: hit.sub.customer.name, userId: hit.sub.customer.userId },
    amountPaise: hit.pay.amountPaise, ground, detail: detail.trim(), state: "requested",
    policy: {
      groundPermitted: pc.groundPermitted, withinWindow: pc.withinWindow,
      originalRecorded: pc.originalRecorded, subscriptionActive: pc.subscriptionActive,
    },
    requestedBy: a.name, requestedAt: stamp(),
    decidedBy: null, decidedAt: null, decisionNote: null, settlement: null, events: [],
  };
  log(pushEvent(r.events, "REFUND_REQUESTED",
    (groundMeta(ground)?.label || ground) + " · " + inr(r.amountPaise)
    + (pc.groundPermitted ? "" : " · NOT a permitted ground — an exception for the approver")), id, "refund");
  snap.refunds = [r].concat(snap.refunds);
  emit();
  return { error: "", refundId: id };
}

/** FN-T13 · Raise a refund by hand, with no ledger row behind it — money that
 *  arrived outside a subscription. It carries NO policy check, because an
 *  empty check would read as a passed one. */
export function createManualRefund(payeeName: string, amountPaise: number, ground: string, detail: string): { error: string; refundId: string | null } {
  if (!payeeName.trim()) return { error: "Name who is being paid.", refundId: null };
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) return { error: "The amount must be a whole figure above zero.", refundId: null };
  if (!groundMeta(ground)) return { error: "Pick a ground.", refundId: null };
  if (!detail.trim())
    return { error: "There is no ledger row behind this one, so the detail IS the evidence. Say what arrived, when, and how you know.", refundId: null };

  const a = actor();
  const id = nextId("RF");
  const r: Refund = {
    refundId: id, origin: "manual", subscriptionId: null, paymentId: null,
    payee: { name: payeeName.trim(), userId: null },
    amountPaise, ground, detail: detail.trim(), state: "requested",
    policy: null,
    requestedBy: a.name, requestedAt: stamp(),
    decidedBy: null, decidedAt: null, decisionNote: null, settlement: null, events: [],
  };
  log(pushEvent(r.events, "REFUND_REQUESTED",
    "Raised by hand · " + (groundMeta(ground)?.label || ground) + " · " + inr(amountPaise) + " to " + payeeName.trim()
    + ". No original payment to check against."), id, "refund");
  snap.refunds = [r].concat(snap.refunds);
  emit();
  return { error: "", refundId: id };
}

/** FN-T14 · Decide. Super Admin, and never the requester — that separation is
 *  the whole control. Approval AUTHORISES a transfer; it does not make one. */
export function decideRefund(id: string, verdict: "approve" | "send_back" | "decline", decisionNote: string): string {
  const r = readRefund(id);
  if (!r) return "That request no longer exists.";
  if (r.state !== "requested" && r.state !== "sent_back") return "This request is already decided. (invalid_state_transition)";
  if (verdict !== "approve" && !decisionNote.trim())
    return "Say what is missing or why it is refused — the requester only sees this note. (reason_required)";
  const sa = superAdminOnly("Deciding a refund"); if (sa) return sa;
  const a = actor();
  if (a.name === r.requestedBy)
    return "A refund cannot be approved by the person who requested it. That separation is the whole control. (super_admin_required)";

  r.decidedBy = a.name;
  r.decidedAt = stamp();
  r.decisionNote = decisionNote.trim() || null;
  if (verdict === "approve") {
    r.state = "approved";
    log(pushEvent(r.events, "REFUND_APPROVED",
      inr(r.amountPaise) + " authorised. NO MONEY HAS MOVED — make the transfer in the bank, then record it here."), id, "refund");
  } else if (verdict === "send_back") {
    r.state = "sent_back";
    log(pushEvent(r.events, "REFUND_SENT_BACK", decisionNote.trim()), id, "refund");
  } else {
    r.state = "declined";
    log(pushEvent(r.events, "REFUND_DECLINED", decisionNote.trim()), id, "refund");
  }
  emit();
  return "";
}

/** FN-T15 · Record the transfer that actually sends the money. Only now is a
 *  refund `paid`, and only now does it leave "approved, not sent". */
export function recordRefundTransfer(id: string, mode: string, reference: string, accountId: string): string {
  const r = readRefund(id);
  if (!r) return "That request no longer exists.";
  if (r.state !== "approved") return "Only an approved refund can be paid. (invalid_state_transition)";
  if (!reference.trim()) return "The transfer reference is mandatory — it is the proof the money left. (validation_failed)";
  if (dupReference(reference)) return "A record already carries reference " + reference.trim() + ". (duplicate_reference)";
  if (!accountOf(accountId)) return "Pick the account it was paid from.";
  const a = actor();
  r.settlement = { paidAt: stamp(), mode, reference: reference.trim(), accountId, by: a.name };
  r.state = "paid";
  if (r.subscriptionId) {
    const s = readSubscription(r.subscriptionId);
    if (s) {
      s.status = "refunded";
      pushEvent(s.events, "REFUND_PAID", r.refundId + " · " + inr(r.amountPaise) + " returned to the customer.");
    }
  }
  log(pushEvent(r.events, "REFUND_PAID",
    inr(r.amountPaise) + " sent from " + (accountOf(accountId)?.masked || accountId) + " · " + reference.trim() + "."), id, "refund");
  emit();
  return "";
}

/* -------------------------------------------------------------- bank --- */

/** FN-T16 · Statement import. A credit matching a recorded payment just ties
 *  the two together — nothing about the row changes, because nothing about it
 *  was ever in doubt. Anything else is an exception a person explains. */
export function importStatement(): { error: string; summary: string } {
  const pi = snap.pendingImport;
  if (!pi) return { error: "No further statement is available to import in this seed. The next one arrives from the bank.", summary: "" };
  if (snap.statements.some((s) => !s.closed))
    return { error: "Close " + snap.statements.filter((s) => !s.closed)[0].stmtId + " first. Two open windows cannot be reconciled against one balance. (period_open)", summary: "" };
  const stmt = { ...clone(pi), importedAt: stamp(), closed: false, closedBy: null, closedAt: null };
  snap.statements = snap.statements.concat([stmt]);
  snap.pendingImport = null;
  const sys = { name: "System", role: "System" };
  let matched = 0, exceptions = 0;
  (stmt.lines as BankLine[]).forEach((l) => {
    if (l.dir === "credit") {
      const hit = readPayments().filter((r) => !r.pay.bankLineId
        && norm(r.pay.reference) === norm(l.reference) && r.pay.amountPaise === l.amountPaise)[0];
      if (hit) {
        hit.pay.bankLineId = l.lineId;
        log(pushEvent(hit.sub.events, "MATCHED",
          "Installment " + hit.inst.seq + " found on " + stmt.stmtId + " as " + l.reference + " · " + l.date + ". Amount and reference equal.", sys),
        hit.sub.subscriptionId, "subscription");
        matched++; return;
      }
      exceptions++; return;
    }
    const t = snap.transactions.filter((x) => !x.bankLineId && x.direction === "out" && x.amountPaise > 0
      && norm(x.reference) === norm(l.reference) && x.amountPaise === l.amountPaise)[0];
    if (t) {
      t.bankLineId = l.lineId;
      log(pushEvent(t.events, "MATCHED", "Auto-matched on import: debit " + l.reference + " · " + l.date + ".", sys), t.txnId, "transaction");
      matched++; return;
    }
    exceptions++;
  });
  note("IMPORTED", stmt.stmtId, "statement",
    stmt.stmtId + " · " + matched + " matched, " + exceptions + " to explain.");
  emit();
  return { error: "", summary: matched + " matched · " + exceptions + " to explain" };
}

export function resolveException(lineId: string, kind: "write_off" | "carried_forward", reason: string): string {
  if (!reason.trim()) return "Both a write-off and a carry-forward need a reason. (reason_required)";
  if (kind === "write_off") { const sa = superAdminOnly("Writing off"); if (sa) return sa; }
  if (snap.resolutions.some((r) => r.targetId === lineId)) return "That line is already resolved. (already_reconciled)";
  const a = actor();
  snap.resolutions = snap.resolutions.concat([{ targetId: lineId, kind, reason: reason.trim(), by: a.name, at: stamp() }]);
  note("IMPORTED", lineId, "statement", lineId + " · " + kind.replace("_", " ") + " · " + reason.trim());
  emit();
  return "";
}

/** FN-T17 · Close the window. Refused while anything is unexplained — not a
 *  warning and not a confirm, because "close anyway" is how a hole becomes
 *  permanent. */
export function closePeriod(stmtId: string): string {
  const r = reconciliation(stmtId);
  if (!r.stmt) return "That statement no longer exists.";
  if (r.stmt.closed) return "It is already closed. (invalid_state_transition)";
  if (!r.canClose)
    return "Cannot close " + stmtId + ": " + r.bankOnly.length + " line" + (r.bankOnly.length === 1 ? "" : "s") + " on the statement no record explains. (unresolved_exceptions)";
  const sa = superAdminOnly("Closing a period"); if (sa) return sa;
  const a = actor();
  const st = r.stmt as unknown as Record<string, unknown>;
  st.closed = true; st.closedBy = a.name; st.closedAt = stamp();
  note("PERIOD_CLOSED", stmtId, "statement", stmtId + " · " + r.matchedN + " rows matched · variance " + inr(0) + ".");
  emit();
  return "";
}

export function logExport(what: string, rows: number) {
  note("EXPORTED", what, "export", what + " · " + rows + " rows. Exports are disclosure events and are logged.");
  emit();
}

/* =============================================================== hooks === */

/** How many businesses are subscribed right now. A LEVEL, read at this
 *  moment — not a total for any period, which is why the topbar can carry it
 *  on every section without it meaning something different on each. */
export const activeCount = () => snap.subscriptions.filter((s) => s.status === "active").length;
export function useActiveCount(): number { useVersion(); return activeCount(); }
export function useSubRows(): SubRow[] { useVersion(); return subRows(); }
export function useSubscription(id: string | null): SubRow | null { useVersion(); const s = readSubscription(id); return s ? toSubRow(s) : null; }
export function useInstallmentRows(): InstRow[] { useVersion(); return installmentRows(); }
export function useSalaryRows(): SalaryRow[] { useVersion(); return salaryRows(); }
export function useSalaryTotals() { useVersion(); return salaryTotals(); }
export function useSalaryAccount(id: string | null): SalaryRow | null { useVersion(); const a = readSalaryAccount(id); return a ? toSalaryRow(a) : null; }
export function useRuns(): SalaryRun[] { useVersion(); return runsNewestFirst(); }
export function useRun(id: string | null): SalaryRun | null { useVersion(); return readRun(id); }
export function useSlip(id: string | null): { slip: Payslip; run: SalaryRun } | null {
  useVersion();
  const slip = readSlip(id); const run = id ? runOfSlip(id) : null;
  return slip && run ? { slip, run } : null;
}
export function useTxnRows(): TxnRow[] { useVersion(); return txnRows(); }
export function useTxn(id: string | null): TxnRow | null { useVersion(); const t = readTransaction(id); return t ? toTxnRow(t) : null; }
export function useTags(): Tag[] { useVersion(); return snap.tags; }
export function useTagTotals() { useVersion(); return tagTotals(); }
export function useRefundQueue() { useVersion(); return refundQueue(); }
export function useRefund(id: string | null): RefundRow | null { useVersion(); const r = readRefund(id); return r ? toRefundRow(r) : null; }
export function useOverview(): Overview { useVersion(); return overview(); }
export function useOverviewTiles(): Tile[] { useVersion(); return overviewTiles(); }
export function useKpis(): Kpi[] { useVersion(); return kpis(); }
export function useMonthPoints(): MonthPoint[] { useVersion(); return monthPoints(); }
export function useReconciliation(stmtId?: string): Recon { useVersion(); return reconciliation(stmtId); }
export function useStatements() { useVersion(); return snap.statements; }
export function usePendingImport() { useVersion(); return snap.pendingImport; }
export function useMatchedPct() { useVersion(); return matchedPct(); }
export function useTaxSummary() { useVersion(); return taxSummary(); }
export function useActivity(limit = 30) { useVersion(); return snap.activity.slice(0, limit); }
export function useInvoices() { useVersion(); return snap.invoices; }

/* ========================================================= formatting === */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
export function fmtMonth(m: string): string {
  const d = new Date(m + "-01T00:00:00");
  return isNaN(d.getTime()) ? m : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const n = daysBetween(ts(iso.length <= 10 ? iso + "T00:00:00" : iso), NOW);
  if (isNaN(n)) return "—";
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 0) return "in " + Math.abs(n) + " day" + (n === -1 ? "" : "s");
  if (n < 31) return n + " days ago";
  const m = Math.round(n / 30);
  return m + " month" + (m === 1 ? "" : "s") + " ago";
}
export function pct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || isNaN(v) ? "—" : v.toFixed(digits) + "%";
}
export function inrWordsOf(paise: number): string {
  const n = Math.round(Math.abs(paise) / 100);
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const two = (x: number): string => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? "-" + ones[x % 10] : ""));
  const three = (x: number): string => (x >= 100 ? ones[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
  if (n === 0) return "Rupees zero only";
  const parts: string[] = [];
  const cr = Math.floor(n / 10000000); const lk = Math.floor((n % 10000000) / 100000);
  const th = Math.floor((n % 100000) / 1000); const rest = n % 1000;
  if (cr) parts.push(three(cr) + " crore");
  if (lk) parts.push(three(lk) + " lakh");
  if (th) parts.push(three(th) + " thousand");
  if (rest) parts.push(three(rest));
  const s = parts.join(" ");
  return "Rupees " + s.charAt(0).toUpperCase() + s.slice(1) + " only";
}
export function delta(now: number, before: number | null | undefined): { text: string; tone: string } {
  if (before === null || before === undefined || before === 0) return { text: "—", tone: "mute" };
  const d = Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
  if (d === 0) return { text: "no change", tone: "mute" };
  return { text: (d > 0 ? "+" : "") + d + "%", tone: d > 0 ? "up" : "down" };
}

export const FILTER_LABELS: Record<string, string> = {
  q: "Search", source: "Source", status: "Status", plan: "Plan", flag: "Queue",
  dir: "Direction", tag: "Tag", kind: "Rolls up to", state: "State", range: "Period",
  active: "Account", month: "Month",
};
export function filterValueLabel(key: string, value: string): string {
  if (key === "source") return sourceMeta(value)?.label || value;
  if (key === "status") {
    /* Two vocabularies share the key: subscription statuses, and the slip
       states on the salaries Transactions tab. */
    if (value === "held") return "On hold";
    if (value === "unpaid") return "Unpaid";
    return subStatusMeta(value)?.label || (value === "paid" ? "Paid" : value);
  }
  if (key === "month") return fmtMonth(value);
  if (key === "tag") return tagOf(value)?.label || value;
  if (key === "kind") return tagKindMeta(value)?.label || value;
  if (key === "state") return txnStateMeta(value)?.label || refundStateMeta(value)?.label || value;
  if (key === "dir") return value === "out" ? "Money out" : "Money in";
  if (key === "range") return value === "month" ? PERIOD.label : value;
  if (key === "active") return value === "yes" ? "Active" : "Closed";
  if (key === "due") {
    if (value === "arrears") return "In arrears";
    return value === "unpaid" ? "Unpaid" : value === "paid" ? "Paid" : value;
  }
  if (key === "flag") {
    if (value === "settled") return "Settled";
    if (value === "failed") return "Fail to pay";
    if (value === "due") return "Due";
    if (value === "nobill") return "Missing a bill";
    return value;
  }
  return value;
}
