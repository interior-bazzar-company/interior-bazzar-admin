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

   POSTED IS PERMANENT, AND A WRONG ROW IS CANCELLED RATHER THAN REWRITTEN.
   Nothing edits what a row says and nothing deletes one. `cancelTransaction`
   is the only write that changes a posted row's standing: it is Super Admin,
   it takes a mandatory reason, and it turns `state` to `cancelled` — the row
   keeps every figure it was posted with, stays on the record forever, and
   stops counting towards anything. Getting the figures right is then a new
   row, recorded the ordinary way.

   EVERY RECORD IS THE SERVER'S (2026-09-16). Other Transaction, Refunds, the
   bank statements and every Analytics figure read spend/, income/, refunds/,
   bank/, the deal ledger, plan payments, installments/, invoices/ and
   revenue/; SALARIES A/C reads salaries/, salaries/accounts/ and
   salaries/slips/; SUBSCRIPTIONS reads subs/ — the plan purchases, with the
   payment that bought each one. All of it on the SERVER's clock. Writes go to
   the server and the rows are re-read from it; a write with no endpoint is
   refused in words and never faked.

   WHAT THE SERVER HAS NO COLUMN FOR COMES THROUGH EMPTY, never invented: a
   slip's hash; a receipt number; the company account a plan payment was
   credited to. Those fields
   are in the types because the documents have them, and an empty one says the
   record does not.
   Which clock a formatter uses: the server's once read, else the browser's — see `clockNow`.

   INTEGER PAISE. A rupee never appears as a float anywhere in this file; the
   endpoints that speak rupees are converted at the boundary.
   ============================================================================= */
import { useEffect, useSyncExternalStore } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type {
  AdminUserRow, AuditEntry, BankLineRow, BankStatementDetail, DealPaymentRow, IncomeRow, InstallmentRow, InvoiceRow,
  PayslipRow, PlanPaymentRow, PlanPaymentsListResponse, RefundRow as ApiRefundRow, RevenueOverview,
  SalaryAccountRow, SalaryComponentRow, SalaryRunRow, SpendRow, SubChainInvoice, SubChainRow, SubRow as SubPurchaseRow,
  SubscriptionRow as ApiSubscriptionRow, VocabItem, WorkSettingsRow,
} from "../../../api/modules/adminOps";
import { CommonService } from "../../../api/modules/common";
import { AppExceptions, errMessage } from "../../../api/apiService";
import { every, paiseOf, planCashPaise, settledRefundPayments } from "../Overview/live";
import { dateOnly } from "../Deals/adapter";
import { getSession } from "../../auth/session";
import { moduleLabel } from "../../shell/modules";
import { inr } from "../../ui/format";
import type { LoadPart } from "../Team/store";
import type {
  Account, CompanyTxn, FinEvent, Installment, InstallmentPayment, InstallmentStatus, Kpi, MonthPoint,
  Params, Payslip, Refund, RefundPolicy, RefundState, SalaryAccount, SalaryComponent, SalaryRun,
  Subscription, SubscriptionStatus, Tag, TagKind, Tile,
} from "./types";

export { inr };
export type {
  Account, CompanyTxn, Customer, FinEvent, Installment, InstallmentFailure, InstallmentPayment,
  InstallmentStatus, Kpi, MonthPoint, Params, Payslip, Proof, Receipt, Refund, RefundOrigin,
  RefundPolicy, RefundState, RunState, SalaryAccount, SalaryComponent, SalaryRun, SubSource,
  Subscription, SubscriptionStatus, Tag, TagKind, Tile, TxnDirection, TxnState,
} from "./types";

/* ====================================================== the vocabulary === */

/** The five sections, named as the sidebar names them — the server's Module
 *  row where there is one. A getter: the session is read at render, not at import. */
export const RECORD_TYPES = ([
  ["subscriptions", "finance"], ["salaries", "finance-salaries"], ["transactions", "finance-transactions"],
  ["refunds", "finance-refunds"], ["analytics", "finance-analytics"],
] as const).map(([key, route]) => ({ key, get label() { return moduleLabel(route); } }));
type State = { key: string; label: string; tone: string; meaning: string };
/** `installment-statuses`; `meaning` is the row's hint. */
export const INSTALLMENT_STATUSES: State[] = [];
/** `salary-run-states`. */
export const RUN_STATES: State[] = [];
/** The session log's labels (`note`), from `finance/vocabularies/`. */
export const EVENT_TYPES: { key: string; label: string; tone: string }[] = [];
/* THE SERVED VALUE LISTS every section reads (`readCompany`, 2026-09-16).
   Filled in place, empty until the server answers. The ones the server
   enforces — tag kinds, subscription sources, refund origins — are served from
   the code that enforces them, so a picker cannot offer what a write refuses. */
/** `payment-modes` labels, active only: the server refuses a mode not in use. */
export const MODES: string[] = [];
/** `installment-failure-reasons`; `help` is the row's hint. */
export const FAILURE_REASONS: { key: string; label: string; help: string }[] = [];
/** `subscription-states`; `meaning` is the row's hint. */
export const SUB_STATUSES: { key: string; label: string; tone: string; meaning: string }[] = [];
/** `expense-tag-kinds`, from ExpenseTag.KINDS. */
export const TAG_KINDS: { key: string; label: string; landsIn: string; help: string }[] = [];
/** `subscription-sources`: the rule that sets a row's `source` lives beside it. */
export const SUB_SOURCES: { key: string; label: string; short: string; help: string }[] = [];
/** `refund-origins`: every refund row carries one of these as `origin`. */
export const REFUND_ORIGINS: { key: string; label: string; help: string }[] = [];
/** The refunds read's `policy`. NaN until it answers, so no payment reads as
 *  inside a window nobody has read. */
export const REFUND_POLICY = { windowDays: NaN, partial: false };
/* THE LIVE VALUE LISTS. Filled in place when the live half loads (they are
   read by name all over the live faces, so the array itself never changes
   identity) and empty until then. */
export const TXN_STATES: { key: string; label: string; tone: string; meaning: string }[] = [];
export const CREDIT_KINDS: { key: string; label: string }[] = [];
export const REFUND_STATES: { key: string; label: string; tone: string }[] = [];
/** `permitted` has no backend: it is never true here, and the policy card
 *  that would print it only renders on a refund carrying a policy — which a
 *  live refund never does. */
export const REFUND_GROUNDS: { key: string; label: string; permitted: boolean; help: string }[] = [];
/** The company's own accounts (`company-accounts`): the only accounts there
 *  are. Filled in place by whichever section boots first; empty until then. */
export const COMPANY_ACCOUNTS: Account[] = [];
/* THE MODULE'S WORDS (`finance/vocabularies/`): every figure's formula and
   caution, the slip rule and the decision register. Filled in place like the
   lists above, empty until the server answers — a tip with no definition
   renders nothing rather than a stale copy. */
type Definition = { key: string; label: string; unit: string; formula: string; caution: string };
export const METRICS: Definition[] = [];
export const KPIS: (Definition & { group: string; goodDirection: string })[] = [];
export let SLIP_RULE = "";
const DECISIONS: { id: string; title: string; position: string; status: string }[] = [];

/** The letterhead a payslip and a receipt print (`GET company/`). Filled in
 *  place like COMPANY_ACCOUNTS; every field "" until the server answers, and
 *  an unregistered GSTIN stays "". */
export const COMPANY = { brand: "", name: "", address: "", cin: "", gstin: "" };
/** ₹25,000: a debit at or above it needs a bill. A PANEL rule, not a server one —
 *  the server only enforces a tag's own `proofRequired`. */
export const BILL_THRESHOLD_PAISE = 2500000;

type Keyed = { key: string };
const first = <T extends Keyed>(list: readonly T[], k: string) => list.filter((x) => x.key === k)[0] || null;

export const sourceMeta = (k: string) => first(SUB_SOURCES, k);
export const instStatusMeta = (k: string) => first(INSTALLMENT_STATUSES, k);
export const failureMeta = (k: string) => first(FAILURE_REASONS, k);
export const subStatusMeta = (k: string) => first(SUB_STATUSES, k);
export const runStateMeta = (k: string) => first(RUN_STATES, k);
export const tagKindMeta = (k: string) => first(TAG_KINDS, k);
export const txnStateMeta = (k: string) => first(TXN_STATES, k);
export const originMeta = (k: string) => first(REFUND_ORIGINS, k);
export const groundMeta = (k: string) => first(REFUND_GROUNDS, k);
export const refundStateMeta = (k: string) => first(REFUND_STATES, k);
export const eventMeta = (k: string) => first(EVENT_TYPES, k);
export const metric = (k: string) => first(METRICS, k);
export const kpiMeta = (k: string) => first(KPIS, k);
/* THE PAYROLL FACE HAS ITS OWN METRIC LIST, deliberately kept apart from the
   two above: the KPI tab renders every entry in `kpiDefinitions` grouped by
   `group`, so a payroll figure added there would silently appear on a page
   about subscriptions and refunds. A second list of payroll KPIs was here and
   is gone with the metrics block it annotated. */
export const PAYROLL_METRICS: Definition[] = [];
export const payrollMetric = (k: string) => first(PAYROLL_METRICS, k);
export const decision = (id: string) => DECISIONS.filter((d) => d.id === id)[0] || null;
export const accountOf = (id: string) =>
  COMPANY_ACCOUNTS.filter((a) => a.accountId === id)[0] || null;
/** WHICH ACCOUNTS A TRANSFER MAY LEAVE FROM: the company's own, as the server
 *  lists them — an empty list until it has, never a stand-in. */
export const payFromAccounts = (): Account[] => COMPANY_ACCOUNTS;
/** True when `id` is one the server would accept. */
const liveAccount = (id: string) => COMPANY_ACCOUNTS.some((a) => a.active && a.accountId === id);

/* =========================================================== the clock === */

export const DAY = 86400000;
/** When something happened in this tab — the activity feed's time. */
export const stamp = () => new Date(clockNow()).toISOString();
export const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
export const daysBetween = (a: number, b: number) => Math.round((b - a) / DAY);
export const monthOf = (d: string) => d.slice(0, 7);

/* WHICH CLOCK. The server's, once any read has asked it (`serverTime`), and
   the browser's until then — off a Finance section and before the first
   answer alike. There is no seed clock. The faces import one PERIOD, one
   todayIso() and one ago() and pass nothing.
   `onLive` still decides which half a figure reads (see `overview`).
   ponytail: read off the URL because the faces are frozen; becomes a face prop
   the day the markup is reopened. */
const LIVE_ROUTE = /^\/finance(-(transactions|refunds|analytics|salaries))?(\/|$)/i;
const onLive = () => typeof window !== "undefined" && LIVE_ROUTE.test(window.location?.pathname || "");

type Period = { key: string; label: string; from: string; to: string };
/** Set with the live rows, in the same emit: the server's instant when it was
 *  read, and the local instant it was read at, so the clock keeps running. */
let server: { epoch: number; at: number } | null = null;
const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const serverNow = () => (server ? server.epoch + (Date.now() - server.at) : NaN);
/** India-time date on the server clock — the live half's today. */
const liveToday = () => (server ? IST_DAY.format(new Date(serverNow())) : "");
const monthEnd = (m: string) => m + "-" + String(daysInMonth(m)).padStart(2, "0");
/** The calendar month a date falls in; empty for no date. */
function periodOf(t: string): Period {
  if (!t) return { key: "", label: "", from: "", to: "" };
  const m = monthOf(t);
  return { key: m, label: fmtMonthLong(m), from: m + "-01", to: monthEnd(m) };
}
/** The live figures' month: empty until the server has answered. */
const livePeriodOf = () => periodOf(liveToday());
const period = () => periodOf(todayIso());
/** The reporting period of the section on screen. Read field by field at
 *  call time — see `clockNow`. */
export const PERIOD: Period = {
  get key() { return period().key; },
  get label() { return period().label; },
  get from() { return period().from; },
  get to() { return period().to; },
};
/** The server's instant where the store has read it, else the browser's. */
const clockNow = () => (server ? serverNow() : Date.now());

export const inPeriod = (d: string, from = PERIOD.from, to = PERIOD.to) =>
  d.slice(0, 10) >= from && d.slice(0, 10) <= to;
/** India-time date on `clockNow`. */
export const todayIso = () => IST_DAY.format(new Date(clockNow()));
/** Positive when the date has passed. The only definition of "late". */
export const daysPast = (d: string) => daysBetween(ts(d), clockNow());
/** The real length of a month. Loss of pay is a fraction of the month a
 *  person was actually employed for, not of a notional thirty. */
export const daysInMonth = (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();

/* ======================================================== the snapshot === */

/** A bank line explained by hand. `kind` is a `resolution-kinds` key. */
type Resolution = { targetId: string; kind: string; reason: string; by: string; at: string };
type Activity = { at: string; type: string; actor: string; ref: string; kind: string; note: string };

/** The records this module holds in one place: the payroll and the plan
 *  purchases as the server last answered them (see `loadPayroll` / `loadSubs`). */
interface Snap {
  subscriptions: Subscription[];
  salaryAccounts: SalaryAccount[];
  salaryRuns: SalaryRun[];
  /** This tab's own writes, live and seed alike — a session log, never a record. */
  activity: Activity[];
}

function seed(): Snap {
  return {
    /* EMPTY UNTIL THE SERVER ANSWERS. Payroll and the plan purchases are read
       rows; before the read they are nothing, never a fixture standing in. */
    subscriptions: [],
    salaryAccounts: [],
    salaryRuns: [],
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

/** Empty the local snapshot; everything that was read is read again. */
export function resetStore() {
  snap = seed(); seq = 0; emit();
  if (loading) void bootFinanceLive(true);
  if (payrollLoading) void bootPayroll(true);
  if (subsLoading) void bootSubs(true);
}

/* ======================================================= the live half ===
   Every row here came from the server in the last read, and nothing else is
   ever put in these lists. A read the session may not make (403) or that
   failed leaves its list empty and its figure `null` — never a seed value. */

/** A statement as the reconciliation reads it. */
export interface Statement {
  stmtId: string; accountId: string; from: string; to: string; importedAt: string;
  closed: boolean; closedBy: string | null; closedAt: string | null; lines: BankLine[];
}

interface Live {
  tags: Tag[]; txns: CompanyTxn[]; refunds: Refund[];
  /** The plan payment each refund points at, by refundId. */
  refundPayment: Record<string, InstallmentPayment>;
  statements: Statement[]; lineMatches: Record<string, LineMatch>; resolutions: Resolution[];
  bankMatchedPct: number | null;
  ledger: DealPaymentRow[]; plans: PlanPaymentRow[]; runs: SalaryRunRow[];
  /** Plan payments with a settled refund request (Overview/live.ts planCashPaise). */
  settledRefunds: Set<number>;
  installments: InstallmentRow[]; invoices: InvoiceRow[];
  /** null = not readable by this session, which is not the same as zero. */
  revenue: RevenueOverview | null; activeSalaryAccounts: number | null;
  /** Spend, salary runs and refunds were all readable — burn is their sum. */
  outReadable: boolean;
  /** The first month the windowed reads (ledger, plans, runs) cover. */
  sinceMonth: string;
}
const NO_LIVE: Live = {
  tags: [], txns: [], refunds: [], refundPayment: {}, statements: [], lineMatches: {}, resolutions: [],
  bankMatchedPct: null, ledger: [], plans: [], runs: [], settledRefunds: new Set(), installments: [], invoices: [],
  revenue: null, activeSalaryAccounts: null, outReadable: false, sinceMonth: "",
};
let live: Live = NO_LIVE;
let loading: Promise<void> | null = null;
let loadSeq = 0;

const who = (u: { username: string } | null | undefined) => (u ? u.username : "");
const TXN_OUT = "TXN-OUT-";
const TXN_IN = "TXN-IN-";
const RF = "RF-";
/** The server id inside a panel id, or null when the id is not of that kind. */
const idIn = (id: string, prefix: string) =>
  (id.indexOf(prefix) === 0 && /^\d+$/.test(id.slice(prefix.length)) ? Number(id.slice(prefix.length)) : null);

function spendTxn(x: SpendRow): CompanyTxn {
  return {
    txnId: TXN_OUT + x.id, direction: "out", tagKey: x.tag ? x.tag.key : "",
    amountPaise: x.amountPaise, description: x.label,
    party: x.party || "",
    mode: x.mode ? x.mode.label : "", reference: x.reference, valueDate: x.valueDate || "",
    accountId: x.account ? x.account.key : "", state: x.state,
    /* THE FILE, not only its name: `url` is the server's presigned link to the
       bill in storage, and the row was attached when it was recorded.
       ponytail: the link is signed for an hour from THIS read; a tab left open
       longer opens a stale one. Re-read the row on the press if that bites. */
    bill: x.bill && x.bill.name
      ? { type: x.bill.mime || "", filename: x.bill.name, uploadedAt: x.recordedAt || "", url: x.bill.url } : null,
    bankLineId: null, nonRevenue: false, creditKind: null,
    cancellation: x.state === "cancelled"
      ? { reason: x.cancelReason, by: who(x.cancelledBy), at: x.cancelledAt || "" } : null,
    recordedBy: who(x.recordedBy), recordedAt: x.recordedAt || "", events: [],
  };
}

function incomeTxn(x: IncomeRow): CompanyTxn {
  const state = (x.state && x.state.key) === "cancelled" ? "cancelled" : "recorded";
  return {
    txnId: TXN_IN + x.id, direction: "in",
    /* INCOME IS FILED BY KIND, NOT BY TAG, and the chip prints the kind's own
       label: an expense tag's key would file this credit under a spend bucket,
       and an empty one printed an empty chip. Nothing looks it up in the tag
       table — `tagOf` answers null for it, which is what it is. */
    tagKey: x.kind ? x.kind.label : "",
    amountPaise: x.amountPaise, description: x.description, party: x.party,
    mode: x.mode ? x.mode.label : "", reference: x.reference, valueDate: x.valueDate,
    accountId: x.account ? x.account.key : "", state,
    bill: x.receipt && x.receipt.name
      ? { type: x.receipt.mime || "", filename: x.receipt.name, uploadedAt: x.recordedAt || "", url: x.receipt.url } : null,
    bankLineId: null, nonRevenue: true, creditKind: x.kind ? x.kind.key : null,
    cancellation: state === "cancelled"
      ? { reason: x.cancelReason || "", by: who(x.cancelledBy), at: x.cancelledAt || "" } : null,
    recordedBy: who(x.recordedBy), recordedAt: x.recordedAt, events: [],
  };
}

type TagItem = VocabItem & { kind?: string; budgetPaise?: number; proofRequired?: boolean; custom?: boolean };
/** Every tag the server lists, plus any a spend row still carries that the
 *  list no longer does — so a row never files under nothing. */
function liveTags(items: TagItem[], spend: SpendRow[]): Tag[] {
  const out: Tag[] = items.map((t) => ({
    /* `custom` is the server's: a tag made in the panel rather than one the
       seed shipped. It was hard-false here, so every tag read "Shipped". */
    tagKey: t.key, label: t.label, kind: t.kind as TagKind, custom: !!t.custom,
    budgetPaise: t.budgetPaise || null, // 0 on the server means no budget
    proofRequired: !!t.proofRequired, active: t.isActive !== false, createdBy: "", createdAt: "",
  }));
  spend.forEach((x) => {
    if (x.tag && !out.some((t) => t.tagKey === x.tag!.key)) {
      out.push({
        tagKey: x.tag.key, label: x.tag.label, kind: x.tag.kind as TagKind, custom: !!x.tag.custom,
        budgetPaise: x.tag.budgetPaise || null, proofRequired: false, active: false, createdBy: "", createdAt: "",
      });
    }
  });
  return out;
}

function liveRefund(x: ApiRefundRow): Refund {
  const deal = x.dealPayment || null;
  return {
    refundId: RF + x.id,
    /* EXACTLY ONE OF THREE SAYS WHO IS OWED, and the server names which. */
    origin: x.origin,
    subscriptionId: null,
    paymentId: x.payment ? x.payment.orderId : deal ? deal.reference : null,
    /* THE PAYER OF THE PAYMENT IT REVERSES, joined off the plan row that
       carries the payment's transactionId. Where no payment names them, the
       payee is the name somebody typed — never a guessed one. */
    payee: x.payer
      ? { name: x.payer.name || x.payer.business || "", userId: x.payer.userId === null ? null : String(x.payer.userId) }
      : { name: x.payeeName || (deal ? deal.party || deal.deal : ""), userId: null },
    amountPaise: x.amountPaise, ground: x.ground ? x.ground.key : "", detail: x.detail,
    state: (x.state ? x.state.key : "requested") as RefundState,
    policy: null, // cannot be evaluated server-side; an empty check would read as passed
    requestedBy: who(x.requestedBy), requestedAt: x.requestedAt,
    decidedBy: x.decidedAt ? who(x.decidedBy) || "—" : null, decidedAt: x.decidedAt,
    decisionNote: x.decisionNote || null,
    settlement: x.settledAt
      ? { paidAt: x.settledAt, mode: x.mode ? x.mode.label : "", reference: x.reference,
        accountId: x.account ? x.account.key : "", by: who(x.settledBy) }
      : null,
    events: [],
  };
}

function refundPaymentOf(x: ApiRefundRow): InstallmentPayment | null {
  const deal = x.dealPayment;
  if (deal) {
    return {
      paymentId: deal.reference || String(deal.id), amountPaise: deal.amountPaise, mode: deal.mode || "",
      reference: deal.reference, valueDate: deal.paymentDate || "", accountId: "", recordedBy: "",
      recordedAt: "", receipt: null, bankLineId: null, proof: null,
    };
  }
  if (!x.payment) return null;
  return {
    paymentId: x.payment.orderId, amountPaise: x.payment.amountPaise, mode: "",
    reference: x.payment.transactionId, valueDate: "", accountId: "", recordedBy: "", recordedAt: "",
    receipt: null, bankLineId: null, proof: null,
  };
}

function liveMatch(m: BankLineRow["match"]): LineMatch {
  if (m.kind === "spend") return { kind: "transaction", id: TXN_OUT + m.id, label: m.label };
  if (m.kind === "income") return { kind: "transaction", id: TXN_IN + m.id, label: m.label };
  if (m.kind === "payment" || m.kind === "deal-payment") return { kind: "payment", id: String(m.id), label: m.label };
  return { kind: "none" };
}

/** `n` months before YYYY-MM, as YYYY-MM. */
function monthBack(m: string, n: number): string {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 - n, 1));
  return d.toISOString().slice(0, 7);
}

/** How far back the windowed reads go: the twelve months Net by month draws.
 *  ponytail: a fixed year; widen when somebody asks for older history. */
const LIVE_MONTHS = 12;

async function loadLive(): Promise<void> {
  const mine = ++loadSeq;
  const soft = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
  const t = await soft(call(AdminOpsService.serverTime()));
  if (mine !== loadSeq) return;
  if (!t) { live = NO_LIVE; server = null; emit(); return; }

  const today = IST_DAY.format(new Date(t.epochMs));
  const since = monthBack(monthOf(today), LIVE_MONTHS - 1);
  const win = { start: since + "-01", end: today };
  const vocab = (name: string) => soft(call(AdminOpsService.vocab(name)).then((r) => r.items));

  const [tagItems, kinds, grounds, rStates, iStates,
    spend, income, refunds, bank, ledger, plans, salaries, salaryAccounts, installments, invoices, revenue,
    history, txnHistory] = await Promise.all([
    vocab("expense-tags"), vocab("income-kinds"),
    vocab("refund-grounds"), vocab("refund-states"), vocab("income-states"),
    soft(every((n) => call(AdminOpsService.spend({ state: "all", pageNo: n, pageSize: 500 })), (r) => r.spend)),
    soft(every((n) => call(AdminOpsService.income({ pageNo: n, pageSize: 500 })), (r) => r.income)),
    soft(every((n) => call(AdminOpsService.refunds({ pageNo: n, pageSize: 500 })),
      (r) => { Object.assign(REFUND_POLICY, r.policy); return r.refunds; })),
    soft(call(AdminOpsService.bankStatements())),
    soft(every((n) => call(AdminOpsService.dealPayments({ ...win, pageNo: n, pageSize: 200 })), (r) => r.payments)),
    soft(every((n) => call<PlanPaymentsListResponse>(AdminOpsService.payments({ ...win, status: "PAID,REFUNDED", pageNo: n, pageSize: 100 })), (r) => r.payments)),
    soft(call(AdminOpsService.salaries({ start: since, end: monthOf(today) }))),
    soft(call(AdminOpsService.salaryAccounts())),
    soft(every((n) => call(AdminOpsService.installments({ pageNo: n, pageSize: 500 })), (r) => r.installments)),
    soft(every((n) => call(AdminOpsService.invoices({ status: "issued", pageNo: n, pageSize: 200 })), (r) => r.invoices)),
    soft(call(AdminOpsService.revenue())),
    historyOf("finance-refunds"),
    historyOf("finance-transactions"),
    loadCompany(),
  ]);
  /* ponytail: one read per statement; fine at a statement a month. */
  const details = bank
    ? await Promise.all(bank.statements.map((s) => soft(call(AdminOpsService.bankStatement(s.id)))))
    : [];
  if (mine !== loadSeq) return;

  fill(TXN_STATES, (iStates || []).map((s) => ({ key: s.key, label: s.label, tone: s.tone, meaning: s.hint || "" })));
  fill(CREDIT_KINDS, (kinds || []).map((k) => ({ key: k.key, label: k.label })));
  fill(REFUND_STATES, (rStates || []).map((s) => ({ key: s.key, label: s.label, tone: s.tone })));
  /* `permitted` IS THE SERVER'S LIST ITSELF: a request naming a ground that is
     not in use is refused outright, so every ground offered here is one the
     server permits. It is not a policy judgement and never was. */
  fill(REFUND_GROUNDS, (grounds || []).map((g) => ({
    key: g.key, label: g.label, permitted: g.isActive !== false, help: g.hint || "",
  })));

  const stmts = (details.filter(Boolean) as BankStatementDetail[]);
  const lineMatches: Record<string, LineMatch> = {};
  /** The statement line a transaction is matched to, read back off the match. */
  const lineOfTxn: Record<string, string> = {};
  const resolutions: Resolution[] = [];
  stmts.forEach((s) => s.rows.forEach((l) => {
    const m = liveMatch(l.match);
    lineMatches["L-" + l.id] = m;
    if (m.kind === "transaction") lineOfTxn[m.id] = "L-" + l.id;
    if (l.resolution) {
      resolutions.push({ targetId: "L-" + l.id, kind: l.resolution.kind.key, reason: l.resolution.reason, by: "", at: l.resolution.at });
    }
  }));
  const refundRows = refunds || [];
  const refundPayment: Record<string, InstallmentPayment> = {};
  refundRows.forEach((r) => { const p = refundPaymentOf(r); if (p) refundPayment[RF + r.id] = p; });

  const txns = (spend || []).map(spendTxn).concat((income || []).map(incomeTxn));
  txns.forEach((t) => {
    t.bankLineId = lineOfTxn[t.txnId] || null;
    /* Its History tab: the trail under the subject the server wrote it with. */
    const spendId = idIn(t.txnId, TXN_OUT);
    t.events = txnHistory[spendId !== null ? "expense:" + spendId : "income:" + idIn(t.txnId, TXN_IN)] || [];
  });

  live = {
    tags: liveTags((tagItems || []) as TagItem[], spend || []),
    txns,
    refunds: refundRows.map((r) => ({ ...liveRefund(r), events: history["refund:" + r.id] || [] })),
    refundPayment,
    statements: stmts.map((s) => ({
      stmtId: "STMT-" + s.id, accountId: s.account ? s.account.key : "", from: s.fromDate, to: s.toDate,
      importedAt: s.importedAt, closed: s.closed, closedBy: null, closedAt: s.closedAt,
      lines: s.rows.map((l) => ({
        lineId: "L-" + l.id, date: l.date, dir: l.direction, amountPaise: l.amountPaise,
        reference: l.reference, narration: l.narration, counterparty: l.counterparty,
      })),
    })),
    lineMatches, resolutions,
    bankMatchedPct: bank ? bank.totals.matchedPct : null,
    ledger: ledger || [], plans: plans || [], runs: salaries ? salaries.runs : [],
    settledRefunds: settledRefundPayments(refundRows),
    installments: installments || [], invoices: invoices || [],
    revenue, activeSalaryAccounts: salaryAccounts ? salaryAccounts.accounts.filter((a) => a.isActive).length : null,
    outReadable: !!(spend && salaries && refunds),
    sinceMonth: since,
  };
  server = { epoch: t.epochMs, at: Date.now() };
  emit();
}

/** The letterhead, the company's own accounts and the served value lists,
 *  filled in place. Every section's load reads them — a payslip prints the
 *  first two, the pickers on every face read the lists, and the salaries face
 *  never boots the live half. */
let companyLoad: Promise<void> | null = null;
function loadCompany(): Promise<void> {
  /* Up to three section loads ask on one page; one request answers them all.
     A failed read is not kept, so the next load asks again. */
  return (companyLoad ||= readCompany().then((ok) => { if (!ok) companyLoad = null; }));
}

const fill = <T,>(list: T[], rows: T[]) => { list.splice(0, list.length, ...rows); };

async function readCompany(): Promise<boolean> {
  const list = (name: string) => soft(call(AdminOpsService.vocab(name)).then((r) => r.items));
  const [co, accounts, modes, failures, states, kinds, sources, origins, instStates, runStates, words] = await Promise.all([
    soft(call(AdminOpsService.company())),
    list("company-accounts"), list("payment-modes"), list("installment-failure-reasons"),
    list("subscription-states"), list("expense-tag-kinds"), list("subscription-sources"), list("refund-origins"),
    list("installment-statuses"), list("salary-run-states"), soft(call(AdminOpsService.financeVocabularies())),
  ]);
  const state = (s: VocabItem): State => ({ key: s.key, label: s.label, tone: s.tone, meaning: s.hint || "" });
  fill(INSTALLMENT_STATUSES, (instStates || []).map(state));
  fill(RUN_STATES, (runStates || []).map(state));
  fill(EVENT_TYPES, words ? words.eventTypes : []);
  fill(METRICS, words ? words.metricDefinitions : []);
  fill(KPIS, words ? words.kpiDefinitions : []);
  fill(PAYROLL_METRICS, words ? words.payrollMetricDefinitions : []);
  fill(DECISIONS, words ? words.openDecisions : []);
  SLIP_RULE = words ? words.slipRule : "";
  Object.assign(COMPANY, {
    brand: co ? co.brand : "", name: co ? co.name : "", address: co ? co.address : "",
    cin: co ? co.cin : "", gstin: co ? co.gstin : "",
  });
  COMPANY_ACCOUNTS.splice(0, COMPANY_ACCOUNTS.length, ...(accounts || []).map((a) => ({
    accountId: a.key, name: a.label, masked: a.hint || a.label, active: a.isActive !== false,
  })));
  fill(MODES, (modes || []).filter((m) => m.isActive !== false).map((m) => m.label));
  fill(FAILURE_REASONS, (failures || []).map((r) => ({ key: r.key, label: r.label, help: r.hint || "" })));
  fill(SUB_STATUSES, (states || []).map((s) => ({ key: s.key, label: s.label, tone: s.tone, meaning: s.hint || "" })));
  fill(TAG_KINDS, (kinds || []).map((k) => ({ key: k.key, label: k.label, landsIn: k.landsIn || "", help: k.hint || "" })));
  fill(SUB_SOURCES, (sources || []).map((s) => ({ key: s.key, label: s.label, short: s.short || "", help: s.hint || "" })));
  fill(REFUND_ORIGINS, (origins || []).map((o) => ({ key: o.key, label: o.label, help: o.hint || "" })));
  return [co, accounts, modes, failures, states, kinds, sources, origins, instStates, runStates, words].every(Boolean);
}

/** Loads the live half once; `force` re-reads it (after a write). */
export function bootFinanceLive(force = false): Promise<void> {
  if (!loading || force) loading = loadLive();
  return loading;
}
/** Every live hook starts the load on first mount, on a live section only. */
function useLiveBoot() {
  useEffect(() => { if (onLive()) void bootFinanceLive(); }, []);
}

/* ============================================================= history ===
   THERE IS NO EVENTS TABLE, and there must not be one: every write already
   appends a line to the admin audit trail naming the record it was about
   (`subjectType` + `subjectId`, migration 0059), so a record's History tab is
   that trail filtered — not a second copy of it kept in step by hand.

   ONE READ PER MODULE, grouped here, rather than one read per row: a payroll
   screen showing fifty accounts would otherwise make fifty requests to fill
   tabs nobody has opened. A session that may not read the trail gets empty
   lists, which is what "this session cannot see the history" looks like. */

const AUDIT_PAGE = 500;

/** One audit line as this module's event. `type` carries the trail's own
 *  sentence for the action, because the panel's event vocabulary names seed
 *  events and these are the server's. */
const auditEvent = (e: AuditEntry): FinEvent => ({
  eventId: "AU-" + e.id,
  type: e.label || e.action,
  actor: e.actorName || e.actor || "",
  actorRole: e.role || "",
  at: e.ts || "",
  note: e.detail || "",
});

/** `<subjectType>:<subjectId>` → its events, newest first. */
async function historyOf(module: string): Promise<Record<string, FinEvent[]>> {
  const r = await soft(call(AdminOpsService.audit({ module, pageSize: AUDIT_PAGE })));
  const out: Record<string, FinEvent[]> = {};
  (r ? r.entries : []).forEach((e) => {
    if (!e.subjectType || !e.subjectId) return;
    const k = e.subjectType + ":" + e.subjectId;
    if (!out[k]) out[k] = [];
    out[k].push(auditEvent(e));
  });
  return out;
}

/* ============================================================= payroll ===
   THE PAYROLL IS THREE READS AND ONE ROSTER: the runs (salaries/), what each
   member is paid (salaries/accounts/) and every slip (salaries/slips/), joined
   to the team roster (users/ + attendance/settings/) for the things that are
   facts about a PERSON rather than about their salary — their name, their
   designation, the department their roles make them, and the day they joined.

   WHAT THE SERVER DOES NOT HOLD comes through empty and is never invented: an
   account has no component breakdown, no bank account, no PAN and no UAN, so
   its earnings are the ONE line it does hold — the monthly gross — and its
   deductions are an empty list rather than a zero somebody decided on. A slip
   is the same: the figures it was built with, and no hash, proof or receipt. */

const soft = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

/** The clock, loaded on its own so a payroll read does not need the whole
 *  live half behind it. Idempotent: the live load sets the same field. */
async function ensureClock(): Promise<void> {
  if (server) return;
  const t = await soft(call(AdminOpsService.serverTime()));
  if (t) server = { epoch: t.epochMs, at: Date.now() };
}

/** One team member, as payroll needs them. */
interface RosterEntry {
  memberId: number; name: string; designation: string; department: string;
  employmentType: string; joiningDate: string; active: boolean;
}
let roster: RosterEntry[] = [];
const rosterOf = (id: number) => roster.filter((m) => m.memberId === id)[0] || null;

function toRoster(u: AdminUserRow, s: WorkSettingsRow | undefined): RosterEntry {
  const designation = (s && s.designation) || u.designation;
  const employment = (s && s.employmentType) || u.employmentType;
  return {
    memberId: u.id,
    name: u.name || u.username,
    designation: designation ? designation.label : "",
    /* The panel's "department" IS the member's rbac roles (team/d1) — one
       spelling, on the member, rather than a second one typed into Finance. */
    department: (u.roles || []).map((r) => r.name).join(", "),
    employmentType: employment ? employment.key : "",
    joiningDate: (s && s.joiningDate) || "",
    active: u.isActive !== false,
  };
}

const SAL = "SAL-AC-";
const SLIP = "SLIP-";
const accountIdOf = (id: number) => SAL + id;

/** One earning line, for an account or a slip that carries no breakdown of its
 *  own: the single figure it does hold, named for what it is. */
const oneLine = (key: string, label: string, paise: number): SalaryComponent[] =>
  (paise ? [{ key, label, amountPaise: paise }] : []);

/** The server's component lines, one side of them, as the panel's shape. */
const sideOf = (list: SalaryComponentRow[] | undefined, kind: "earning" | "deduction"): SalaryComponent[] =>
  (list || []).filter((c) => c.kind === kind)
    .map((c) => ({ key: c.key, label: c.label, amountPaise: c.amountPaise }));

function liveSalaryAccount(a: SalaryAccountRow): SalaryAccount {
  const m = rosterOf(a.member.id);
  /* WHAT THE GROSS IS MADE OF and what comes off it every month. An account
     with no breakdown is the one figure it does hold, which is what every
     account said before the columns existed. */
  const earnings = sideOf(a.components, "earning");
  /* MASKED, AND THAT IS ALL THERE IS. The server sends the last four
     characters of the account number, the IFSC, the UPI handle, the PAN and
     the UAN; the whole values never leave it. */
  const pay = a.payTo || null;
  return {
    salaryAccountId: accountIdOf(a.id),
    memberId: a.member.id,
    memberName: (m && m.name) || a.member.name || a.member.username,
    employeeCode: a.employeeCode,
    designation: (m && m.designation) || "",
    department: (m && m.department) || "",
    /* Full time / contract, off the member record — the panel's engagement
       vocabulary is the server's employment types (see ENGAGEMENTS). */
    engagement: (m && m.employmentType) || "",
    joinedAt: (m && m.joiningDate) || "",
    monthlyGrossPaise: a.monthlyGrossPaise,
    earnings: earnings.length ? earnings : oneLine("monthly_gross", "Monthly gross", a.monthlyGrossPaise),
    deductions: sideOf(a.components, "deduction"),
    bank: {
      masked: pay ? pay.accountMasked : "", ifsc: pay ? pay.ifsc : "", name: pay ? pay.bankName : "",
      upi: pay && pay.upi ? pay.upi : undefined,
    },
    pan: pay ? pay.pan : "", uan: pay && pay.uan ? pay.uan : null,
    active: a.isActive,
    /* WHO OPENED IT is the audit trail's opening row, read back by the server;
       an account opened before the trail kept subjects names nobody. */
    recordedBy: a.openedBy ? a.openedBy.name || a.openedBy.username : "", recordedAt: a.createdAt || "",
    events: [],
  };
}

function liveSlip(s: PayslipRow, acc: SalaryAccount | null): Payslip {
  const b = s.breakdown || {};
  const via = PAY_VIA.filter((v) => s.mode && v.mode === s.mode.key)[0];
  /* THE SLIP'S OWN FROZEN LINES. `basePaise` is the full month and never
     moves, so the worked earnings are derived from it the same way the server
     derived the gross — half-up on each line, over the month's REAL length. */
  const base = sideOf(b.earnings, "earning").length
    ? sideOf(b.earnings, "earning")
    : oneLine("gross", "Gross salary", b.basePaise || s.grossPaise);
  const basis = daysInMonth(s.month);
  const earnings = s.lopDays > 0
    ? base.map((e) => ({ ...e, amountPaise: Math.round((e.amountPaise * s.paidDays) / basis) }))
    : base;
  /* SETTLED WITH THE TRANSFER, not folded into the salary: an incentive is
     paid for something achieved and an adjustment corrects one month only.
     A negative adjustment is a deduction and a positive one is an earning —
     which is what the sign means — and both carry the reason as their label. */
  const incentive = b.incentivePaise || 0;
  const adjustment = b.adjustmentPaise || 0;
  const adjustmentLabel = b.adjustmentReason || "Adjustment";
  const incentives = oneLine("incentive", "Incentive", incentive)
    .concat(adjustment > 0 ? [{ key: "adjustment", label: adjustmentLabel, amountPaise: adjustment }] : []);
  /* A SLIP WITH NO FROZEN LINES STILL HAD DEDUCTIONS TAKEN. `deductionsPaise`
     is the server's own figure and the one net was computed from
     (net = gross - deductions + incentive + adjustment); the breakdown is a
     copy of what it was MADE of, and a slip written outside BuildRun carries
     the figure with nothing behind it. Reading the empty array alone printed
     zero deductions and therefore the GROSS as NET PAY -- a payslip claiming a
     transfer 12% larger than the one that happened. Falls back exactly the way
     `base` does above. */
  const dedLines = sideOf(b.deductions, "deduction");
  const deductions = (dedLines.length ? dedLines : oneLine("deductions", "Deductions", s.deductionsPaise))
    .concat(adjustment < 0 ? [{ key: "adjustment", label: adjustmentLabel, amountPaise: -adjustment }] : []);
  return {
    slipId: SLIP + s.id,
    salaryAccountId: accountIdOf(s.accountId),
    memberId: s.member.id,
    memberName: (acc && acc.memberName) || s.member.name || s.member.username,
    employeeCode: s.employeeCode,
    designation: (acc && acc.designation) || "",
    month: s.month,
    paidDays: s.paidDays, lopDays: s.lopDays,
    baseEarnings: base, earnings,
    incentives: incentives.length ? incentives : undefined,
    incentivePaise: incentive || undefined,
    deductions,
    /* Gross INCLUDES what was settled with the transfer, because that is the
       money that actually left; net stays the server's own figure and the two
       still reconcile through the deductions. */
    grossPaise: s.grossPaise + incentive + Math.max(adjustment, 0),
    deductionsPaise: s.deductionsPaise + Math.max(-adjustment, 0),
    netPaise: s.netPaise,
    paidAt: s.paidAt,
    mode: s.mode ? s.mode.label : "",
    via: via ? via.key : undefined,
    reference: s.reference,
    accountId: s.paidFrom ? s.paidFrom.key : "",
    /* WHERE IT WAS SENT is the account's, not the slip's: the slip freezes the
       figures, and the bank details are read live off the account — masked. */
    bank: acc ? acc.bank : { masked: "", ifsc: "", name: "" },
    pan: acc ? acc.pan : "", uan: acc ? acc.uan : null,
    remark: b.remark || undefined,
    /* THE RECEIPT IS A REAL FILE now: a private Attachment, read back as a
       signed link. There is still no hash — nothing computes one. */
    proof: s.receipt
      ? { type: s.receipt.mimeType, filename: s.receipt.fileName, uploadedAt: s.paidAt || "", url: s.receipt.url }
      : null,
    issuedAt: b.issuedAt || s.paidAt, sha256: null,
    /* The hold's reason has no column and never needed one: it rides the audit
       trail, and the server reads that trail back by subject. */
    held: s.held, heldReason: s.heldReason || null,
  };
}

function liveRun(r: SalaryRunRow, slips: Payslip[]): SalaryRun {
  return {
    runId: "RUN-" + r.month,
    month: r.month,
    state: (r.state.key === "paid" ? "paid" : "open"),
    slips,
    totalNetPaise: r.totalNetPaise,
    recordedBy: "", recordedAt: r.recordedAt || "",
    paidAt: r.paidAt,
    events: [],
  };
}

let payrollLoading: Promise<void> | null = null;
let payrollSeq = 0;
/** How the payroll read stands — runs, accounts and slips, the three the
 *  money comes from. A refused or failed read is said, never an empty payroll. */
let payrollPart: LoadPart = { state: "loading" };
const payrollFailure = (e: unknown): LoadPart => (e instanceof AppExceptions && e.code > 0 && e.code < 500
  ? { state: "denied", message: errMessage(e) } : { state: "error", message: errMessage(e) });

async function loadPayroll(): Promise<void> {
  const mine = ++payrollSeq;
  await ensureClock();
  let failed = null as unknown;
  const tracked = <T,>(p: Promise<T>): Promise<T | null> => p.catch((e) => { if (failed === null) failed = e; return null; });
  const [runs, accounts, slips, users, settings, employment, history] = await Promise.all([
    tracked(call(AdminOpsService.salaries())),
    tracked(call(AdminOpsService.salaryAccounts())),
    tracked(call(AdminOpsService.payslips())),
    soft(call(AdminOpsService.users())),
    soft(call(AdminOpsService.attendanceSettings()).then((r) => r.settings)),
    soft(call(AdminOpsService.vocab("employment-types")).then((r) => r.items)),
    historyOf("finance-salaries"),
    loadCompany(),
  ]);
  if (mine !== payrollSeq) return;

  const settingOf = (id: number) => (settings || []).filter((s) => s.member.id === id)[0];
  roster = (users || []).map((u) => toRoster(u, settingOf(u.id)));
  /* HOW PEOPLE ARE ENGAGED IS A SERVER LIST (employment-types), filled in
     place so every reader keeps the same array. Empty when it is not readable
     — the filter then offers nothing rather than two keys nobody uses. */
  ENGAGEMENTS.splice(0, ENGAGEMENTS.length,
    ...(employment || []).map((e) => ({ key: e.key, label: e.label })));

  const accountRows = accounts ? accounts.accounts : [];
  snap.salaryAccounts = accountRows.map((a) => ({
    ...liveSalaryAccount(a), events: history["salary_account:" + a.id] || [] }));
  const byId: Record<string, SalaryAccount> = {};
  snap.salaryAccounts.forEach((a) => { byId[a.salaryAccountId] = a; });
  const slipRows = slips ? slips.slips : [];
  snap.salaryRuns = (runs ? runs.runs : []).map((r) => ({
    ...liveRun(r, slipRows.filter((s) => s.month === r.month)
      .map((s) => liveSlip(s, byId[accountIdOf(s.accountId)] || null))),
    events: history["salary_run:" + r.id] || [] }));
  payrollPart = failed === null ? { state: "ok", own: false } : payrollFailure(failed);
  emit();
}

/** Loads the payroll once; `force` re-reads it (after a write). */
export function bootPayroll(force = false): Promise<void> {
  if (!payrollLoading || force) {
    const mine = payrollSeq + 1;
    payrollLoading = loadPayroll().catch((e) => {
      if (mine !== payrollSeq) return;
      payrollPart = payrollFailure(e);
      emit();
    });
  }
  return payrollLoading;
}
function usePayrollBoot() {
  useEffect(() => { void bootPayroll(); }, []);
}
/** How the payroll stands, starting its read — for a page outside Finance
 *  (Team's pay page) that reads the payroll through the plain readers. */
export function usePayrollLoad(): LoadPart { useVersion(); usePayrollBoot(); return payrollPart; }
/** Try again: loading until the re-read lands. */
export function retryPayroll(): Promise<void> {
  payrollPart = { state: "loading" };
  emit();
  return bootPayroll(true);
}

/* ======================================================= subscriptions ===
   A SUBSCRIPTION IS A PLAN SOMEBODY BOUGHT (subs/): one purchase row per
   family — business, shop, architect, automation — with the plan, the term in
   months, the day it started, the day it expires, what it cost, and the
   gateway or manual payment that settled it.

   THE SCHEDULE IS NOT A SCHEDULE HERE. A plan purchase is paid once, so the
   record carries ONE installment: paid when its transaction says PAID or
   REFUNDED, due while the money has not arrived, cancelled with the purchase.
   A purchase with no transaction row at all — a free plan, or one activated by
   hand — carries no installment, because no payment was ever recorded.

   A SALE IS THE OTHER KIND (migration 0063): a subscription recorded over an
   accepted quotation, read off subscriptions/. Its schedule IS the quotation's
   own installment rows, each paid by the issued invoice that billed it — the
   deal ledger's money, never a second copy of it. */

const paiseOfRupees = (v: string | null | undefined): number => {
  const n = Number(String(v || "0").replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** `cancelled`/`refunded`/`active` are the panel's words too; `pending` and
 *  `expired` are the server's own and are vocabulary rows of their own. */
const subStatusOf = (s: string): SubscriptionStatus => {
  const k = (s || "").toLowerCase();
  return (["active", "pending", "expired", "cancelled", "refunded", "defaulting", "completed"].indexOf(k) >= 0
    ? k : "active") as SubscriptionStatus;
};

/* THE COMMITMENT STANDING OVER EACH PURCHASE, by the panel id of that
   purchase. It is what every subscription write addresses — the purchase says
   what was bought, this says where it stands — and it is empty for a purchase
   nobody has recorded one against yet. */
let commitments: Record<string, ApiSubscriptionRow> = {};
/** A sale's panel id: `SUB-QT-<commitment id>`. Upper case, so `purchaseRefOf`
 *  never reads it as a purchase. */
const QSUB = "SUB-QT-";
/** A deal-ledger payment's panel id, as a sale's installment carries it. */
const DP = "DP-";
/** Every accepted quotation on a deal linked to its customer (subscriptions/chains/). */
let chains: SubChainRow[] = [];
/** `SUB-business-12` → the purchase it names, or null when the id is not ours. */
const purchaseRefOf = (id: string): { family: string; purchase: number } | null => {
  const m = /^SUB-([a-z]+)-(\d+)$/.exec(id || "");
  return m ? { family: m[1], purchase: Number(m[2]) } : null;
};

function liveSubscription(x: SubPurchaseRow): Subscription {
  const startDate = dateOnly(x.startedAt) || "";
  const endDate = dateOnly(x.expireDate) || "";
  const totalPaise = paiseOfRupees(x.amount);
  /* WHERE IT STANDS is the commitment's when one has been recorded, and the
     purchase's own status otherwise — `defaulting` and a cancellation exist
     only on the commitment, because only it can carry the reason. */
  const held = x.subscription || null;
  const status = subStatusOf(held && held.state ? held.state.key : x.status);
  const p = x.payment;
  const settled = !!p && (p.orderStatus === "PAID" || p.orderStatus === "REFUNDED");
  const payment: InstallmentPayment | null = p && settled ? {
    paymentId: p.orderId || p.transactionId,
    amountPaise: paiseOfRupees(p.amount),
    mode: p.paymentMethod === "manual" ? "Manual" : p.paymentMethod === "free" ? "Free" : "Gateway",
    reference: p.transactionId,
    valueDate: dateOnly(p.verifiedAt) || dateOnly(p.createdAt) || "",
    /* A manual payment names the admin who verified it; a gateway one nobody. */
    accountId: "", recordedBy: p.verifiedBy ? p.verifiedBy.username : "", recordedAt: p.verifiedAt || p.createdAt || "",
    receipt: null, bankLineId: null, proof: null,
  } : null;
  /* A DEFAULTING COMMITMENT IS THE FAIL TO PAY on its one installment: the
     reason and the evidence went to the audit trail with the move, and the
     server reads them back as `failure` while it still stands. */
  const failed = !settled && !!held && !!held.state && held.state.key === "defaulting";
  const instStatus = settled ? "paid" : failed ? "fail_to_pay"
    : status === "cancelled" || status === "expired" ? "cancelled" : "due";
  const f = failed && held ? held.failure : null;
  const installments: Installment[] = p ? [{
    seq: 1, of: 1, dueDate: startDate, amountPaise: totalPaise,
    status: instStatus, invoiceNumber: null, payment,
    failure: f ? { at: f.at || "", reason: f.reason, attempt: 0, note: f.note } : null,
  }] : [];
  return {
    subscriptionId: "SUB-" + x.family + "-" + x.id,
    /* How the sale happened — the server's rule, off the purchase's buyIntent. */
    source: x.source,
    customer: { name: x.customer || x.user || "", userId: x.userId === null ? null : String(x.userId) },
    planId: x.planId === null ? "" : String(x.planId),
    planName: x.planTitle || "",
    cycleMonths: x.durationMonths || 0,
    totalPaise,
    startDate, endDate,
    status,
    installments,
    invoiceNumber: null,              // no tax invoice is raised against a plan purchase
    paidInFull: settled,
    soldBy: held && held.soldBy ? held.soldBy.username : "",
    recordedBy: held && held.recordedBy ? held.recordedBy.username : "",
    recordedAt: x.recordedAt || "",
    events: [],
  };
}

/** `SUB-QT-12` → 12, or null for a purchase's id. */
const saleIdOf = (id: string): number | null => idIn(id || "", QSUB);

/** The plan filter's key for a sale: the plan named on its quotation — the
 *  same slug the record dialog builds. */
const planKeyOf = (name: string) =>
  "PL-" + name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");

/** ONE SALE, as this tab reads it: the quotation says what was sold and for
 *  how much; its rows say what is paid, due, failed or cancelled. Where it
 *  stands is DERIVED from those rows — `defaulting` is "an installment failed
 *  and has not been recovered", `completed` is "every one is paid" — unless it
 *  was cancelled, which only the commitment can say. */
function saleSubscription(c: ApiSubscriptionRow): Subscription {
  const q = c.quotation as NonNullable<ApiSubscriptionRow["quotation"]>;
  const installments: Installment[] = (c.installments || []).map((r) => ({
    seq: r.seq, of: r.count, dueDate: r.dueDate, amountPaise: r.amountPaise,
    status: (r.status === "failed" ? "fail_to_pay" : r.status) as InstallmentStatus,
    invoiceNumber: r.invoiceNumber,
    payment: r.payment ? {
      paymentId: DP + r.payment.id, amountPaise: r.payment.amountPaise, mode: r.payment.mode,
      reference: r.payment.reference, valueDate: r.payment.paymentDate, accountId: "",
      recordedBy: r.payment.recordedBy || "", recordedAt: r.payment.recordedAt || "",
      receipt: null, bankLineId: null, proof: null,
    } : null,
    failure: r.status === "failed"
      ? { at: r.failedAt || "", reason: r.failureReason || "", attempt: 0, note: r.failureNote } : null,
  }));
  const open = installments.filter((i) => i.status !== "cancelled");
  const paidAll = open.length > 0 && open.every((i) => i.status === "paid");
  const state = c.state ? c.state.key : "active";
  const status: SubscriptionStatus = state === "cancelled" ? "cancelled"
    : open.some((i) => i.status === "fail_to_pay") ? "defaulting"
      : paidAll ? "completed" : subStatusOf(state);
  return {
    subscriptionId: QSUB + c.id,
    source: "sales",
    customer: { name: c.customer || "", userId: c.userId === null ? null : String(c.userId) },
    planId: planKeyOf(q.planName), planName: q.planName,
    cycleMonths: c.cycleMonths || q.termMonths,
    totalPaise: q.grandTotalPaise,
    startDate: c.startedOn || "", endDate: c.renewsOn || "",
    status, installments,
    /* The first document it was billed on — what the chain strip names. */
    invoiceNumber: (installments.filter((i) => !!i.invoiceNumber)[0] || { invoiceNumber: null }).invoiceNumber,
    paidInFull: paidAll,
    soldBy: c.soldBy ? c.soldBy.username : "",
    recordedBy: c.recordedBy ? c.recordedBy.username : "",
    recordedAt: c.recordedAt || "",
    events: [],
  };
}

let subsLoading: Promise<void> | null = null;
let subsSeq = 0;

async function loadSubs(): Promise<void> {
  const mine = ++subsSeq;
  await ensureClock();
  const [rows, held, chainRows, history] = await Promise.all([
    soft(every((n) => call(AdminOpsService.subs({ pageNo: n, pageSize: 100 })), (r) => r.subs)),
    soft(every((n) => call(AdminOpsService.subscriptions({ pageNo: n, pageSize: 200 })), (r) => r.subscriptions)),
    soft(call(AdminOpsService.subscriptionChains()).then((r) => r.chains)),
    historyOf("subs"),
    loadCompany(),
  ]);
  if (mine !== subsSeq) return;
  /* The purchases carry their commitment; a SALE has no purchase, so it is
     only on the commitments list. */
  const sales = (held || []).filter((c) => !!c.quotation);
  snap.subscriptions = (rows || []).map((x) => ({
    ...liveSubscription(x),
    events: x.subscription ? history["subscription:" + x.subscription.id] || [] : [] }))
    .concat(sales.map((c) => ({ ...saleSubscription(c), events: history["subscription:" + c.id] || [] })));
  commitments = {};
  (rows || []).forEach((x) => {
    if (x.subscription) commitments["SUB-" + x.family + "-" + x.id] = x.subscription;
  });
  sales.forEach((c) => { commitments[QSUB + c.id] = c; });
  chains = chainRows || [];
  emit();
}

/** Loads the plan purchases once; `force` re-reads them. */
export function bootSubs(force = false): Promise<void> {
  if (!subsLoading || force) subsLoading = loadSubs();
  return subsLoading;
}
function useSubsBoot() {
  useEffect(() => { void bootSubs(); }, []);
}

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
export const readTags = () => live.tags;
export const tagOf = (key: string | null | undefined) =>
  (key ? live.tags.filter((t) => t.tagKey === key)[0] || null : null);
export const readTransactions = () => live.txns;
export const readTransaction = (id: string | null | undefined) =>
  (id ? live.txns.filter((t) => t.txnId === id)[0] || null : null);
export const readRefunds = () => live.refunds;
export const readRefund = (id: string | null | undefined) =>
  (id ? live.refunds.filter((r) => r.refundId === id)[0] || null : null);
/** THE USER BASE, read for one job: a subscription is recorded against a real
 *  registered person, never a name somebody typed. The server's platform
 *  accounts (`platform-users/`), read on the Users module's own endpoint rather
 *  than through its store — a view reaching into another module's store couples
 *  the two modules' lifecycles for no gain. `userId` is the account's pk, as
 *  every live customer id in this module is. The list row carries no business
 *  name, so `business` is null.
 *
 *  Deactivated accounts are still listed: money that arrived from one is a
 *  fact, and hiding the payer would make the row unrecordable. */
export interface FinUser {
  userId: string; name: string; business: string | null; status: string; email: string;
}
let users: FinUser[] = [];
let usersLoading: Promise<void> | null = null;
/* ponytail: every page, once a session — fine at today's few hundred accounts;
   a server-side search when the dialog's picker is reopened. */
function bootUsers(): Promise<void> {
  if (!usersLoading) {
    usersLoading = soft(every((n) => call(AdminOpsService.platformUsers("?pageNo=" + n + "&pageSize=100")), (r) => r.users))
      .then((rows) => {
        users = (rows || []).map((u) => ({
          userId: String(u.pk), name: u.identity.name, business: null,
          status: u.userStatus, email: u.identity.email || "",
        }));
        emit();
      });
  }
  return usersLoading;
}
export const readUsers = (): FinUser[] => users;
export function useUsers(): FinUser[] {
  useVersion();
  useEffect(() => { void bootUsers(); }, []);
  return readUsers();
}

/** An issued invoice as the Subscriptions dialogs print one. */
export interface FinInvoice {
  invoiceNumber: string; dealRef: string; quotationNumber: string | null; status: string;
  /** "paid" when the invoice carries its payment date, "" when it does not. */
  paymentStatus: string;
  /** No invoice names a platform account, so `business` and `userId` are null. */
  customer: { name: string; business: string | null; userId: string | null };
  description: string; placeOfSupply: string; invoiceDate: string; dueDate: string;
  taxablePaise: number; grandTotalPaise: number;
}
/** An invoice raised on a sale's quotation, as the dialogs print one. The
 *  customer is the account the deal names. */
const chainInvoice = (i: SubChainInvoice, userId: number | null): FinInvoice => ({
  invoiceNumber: i.invoiceNumber || "", dealRef: i.dealRef, quotationNumber: i.quotationNumber,
  status: i.status, paymentStatus: i.status === "issued" && i.paymentDate ? "paid" : "",
  customer: { name: i.billingName, business: null, userId: userId === null ? null : String(userId) },
  description: i.description, placeOfSupply: i.placeOfSupply, invoiceDate: i.invoiceDate, dueDate: i.dueDate,
  taxablePaise: i.taxablePaise, grandTotalPaise: i.grandTotalPaise,
});

/** A real invoice number, resolved against the server's issued invoices
 *  (`invoices/`, read with the live half) and then the invoices on the sales'
 *  quotations; null for no number or an unknown one. */
export function readInvoice(n: string | null | undefined): FinInvoice | null {
  const x = n ? live.invoices.filter((i) => i.invoiceNumber === n)[0] : null;
  if (!x) {
    for (const c of n ? chains : []) {
      const hit = c.invoices.filter((i) => i.invoiceNumber === n)[0];
      if (hit) return chainInvoice(hit, c.userId);
    }
    return null;
  }
  const item = (x.items || [])[0];
  return {
    invoiceNumber: x.invoiceNumber as string, dealRef: x.dealRef, quotationNumber: x.quotationNumber,
    status: x.status, paymentStatus: x.paymentDate ? "paid" : "",
    customer: { name: x.billing ? x.billing.name : "", business: null, userId: null },
    description: item ? item.description : "", placeOfSupply: x.placeOfSupply,
    invoiceDate: x.invoiceDate, dueDate: x.dueDate,
    taxablePaise: x.taxableTotalPaise, grandTotalPaise: x.grandTotalPaise,
  };
}
export const readStatements = () => live.statements;
export const readResolutions = () => live.resolutions;
/** The server has no statement waiting to be imported. */
export const readPendingImport = () => null;
export const readActivity = () => snap.activity;

export interface PaymentHit { sub: Subscription; inst: Installment; pay: InstallmentPayment }

/** EVERY installment payment on the subscriptions read, flattened — including
 *  ones whose installment was later cancelled. This is what a reference lookup
 *  and a reversal point at, so it must not hide anything. */
function seedPayments(): PaymentHit[] {
  const out: PaymentHit[] = [];
  snap.subscriptions.forEach((s) => s.installments.forEach((i) => { if (i.payment) out.push({ sub: s, inst: i, pay: i.payment }); }));
  return out;
}
/** ONE PLAN PURCHASE, in the shape the refund picker reads. A plan payment is
 *  bought and paid in one go, so its "schedule" is the single installment it
 *  is; the customer around it is the payer the server joins onto the payment,
 *  and the status is that plan's own. Nothing here is invented: a payment no
 *  plan row names carries no customer and reads as not active, which is what
 *  the records say about it. */
function planHit(x: PlanPaymentRow): PaymentHit {
  const paise = paiseOf(x.amount);
  const valueDate = dateOnly(x.verifiedAt) || dateOnly(x.createdAt) || "";
  const payer = x.payer || null;
  const pay: InstallmentPayment = {
    paymentId: x.orderId, amountPaise: paise, mode: "", reference: x.transactionId,
    valueDate, accountId: "", recordedBy: "", recordedAt: x.verifiedAt || x.createdAt || "",
    receipt: null, bankLineId: null, proof: null,
  };
  const inst: Installment = {
    seq: 1, of: 1, dueDate: valueDate, amountPaise: paise, status: "paid",
    invoiceNumber: null, payment: pay, failure: null,
  };
  const sub: Subscription = {
    subscriptionId: x.orderId, source: "website",
    customer: {
      name: (payer && (payer.name || payer.business)) || "",
      userId: payer && payer.userId !== null ? String(payer.userId) : null,
    },
    planId: "", planName: x.paymentFor || "", cycleMonths: 0, totalPaise: paise,
    startDate: valueDate, endDate: "",
    /* Only `active` is load-bearing (the policy check asks whether the plan is
       still running); the rest is the plan's own word for how it ended. */
    status: planStatus(payer ? payer.planStatus : ""),
    installments: [inst], invoiceNumber: null, paidInFull: true,
    soldBy: "", recordedBy: "", recordedAt: pay.recordedAt, events: [],
  };
  return { sub, inst, pay };
}
const planStatus = (s: string): SubscriptionStatus =>
  (s === "active" ? "active" : s === "expired" ? "completed" : s === "refunded" ? "refunded" : "cancelled");
/** The server id of the plan payment a panel payment id names. */
const planIdOf = (paymentId: string): number | null =>
  (live.plans.filter((x) => x.orderId === paymentId)[0] || { id: null }).id;

/** On a live section these are the SERVER's plan purchases — money actually
 *  collected, which is the only thing a refund can go back against. The seed's
 *  installment payments are what the Subscriptions face reads. */
export const readPayments = (): PaymentHit[] =>
  (onLive()
    ? live.plans.filter((x) => x.orderStatus === "PAID" && !!x.orderId && paiseOf(x.amount) > 0).map(planHit)
    : seedPayments());
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
  seedPayments().filter((r) => r.inst.status === "paid" || r.sub.status === "refunded");

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

/* THE RECORD'S OWN TIMELINE IS THE SERVER'S NOW. `pushEvent` wrote an event
   onto a local row and `nextId` invented the id it carried; both went with the
   seed writes they belonged to. What is left is the session log below — this
   tab's own account of what somebody just did, which was never a record. */
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

/** WHEN A SUBSCRIPTION STARTED, at whatever granularity was asked for.
 *
 *  ONE PARAM, THREE GRAINS, and the value says which: `2026` is a year,
 *  `2026-08` a month, `2026-08-21` a day. It is a prefix of the ISO start
 *  date, so the same comparison answers all three and there is no second
 *  field that could disagree with the first about what is being narrowed. */
export function startedOptions(rows: SubRow[]): { v: string; l: string }[] {
  const years = new Set<string>();
  const months = new Set<string>();
  rows.forEach((r) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.s.startDate)) return;
    years.add(r.s.startDate.slice(0, 4));
    months.add(r.s.startDate.slice(0, 7));
  });
  const out: { v: string; l: string }[] = [];
  /* Newest first, and each year followed by its own months, so the list reads
     as the calendar does rather than as two lists stapled together. */
  Array.from(years).sort().reverse().forEach((y) => {
    out.push({ v: y, l: y });
    Array.from(months).filter((m) => m.slice(0, 4) === y).sort().reverse()
      .forEach((m) => out.push({ v: m, l: "· " + fmtMonth(m) }));
  });
  return out;
}

/** EVERY SUBSCRIPTION EVER RECORDED, added up — the all-time counterpart to
 *  `overview()`, which is one period.
 *
 *  ONE DEFINITION, THREE READERS: the topbar, the list's strip and the
 *  Analytics tab all print these, and summing them in three files is how the
 *  same word ends up over three different numbers. */
export interface SubTotals {
  subs: number; activeN: number;
  agreedPaise: number;
  collectedPaise: number; collectedN: number;
  duePaise: number; dueN: number;
  failedPaise: number; failedN: number;
  /** Agreed but not yet in the bank: what is due plus what did not clear. */
  outstandingPaise: number;
}
export function subTotals(): SubTotals {
  const rows = subRows();
  const sum = (f: (r: SubRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const duePaise = sum((r) => r.duePaise);
  const failedPaise = sum((r) => r.failedPaise);
  return {
    subs: rows.length,
    activeN: rows.filter((r) => r.s.status === "active").length,
    agreedPaise: sum((r) => r.s.totalPaise),
    collectedPaise: sum((r) => r.paidPaise), collectedN: sum((r) => r.paidN),
    duePaise, dueN: sum((r) => r.dueN),
    failedPaise, failedN: sum((r) => r.failedN),
    outstandingPaise: duePaise + failedPaise,
  };
}

/** The calendar years subscriptions were actually started in, newest first.
 *  Read off the records, so a year nothing was sold in is never offered. */
export function subYears(rows: SubRow[]): string[] {
  const years = new Set<string>();
  rows.forEach((r) => { if (/^\d{4}/.test(r.s.startDate)) years.add(r.s.startDate.slice(0, 4)); });
  return Array.from(years).sort().reverse();
}

export function applySubFilters(rows: SubRow[], p: Params): SubRow[] {
  let out = rows;
  if (p.source) out = out.filter((r) => r.s.source === p.source);
  if (p.status) out = out.filter((r) => r.s.status === p.status);
  if (p.plan) out = out.filter((r) => r.s.planId === p.plan);
  /* The start date is the date this list is ABOUT: when the customer became
     entitled. A payment's value date belongs to the installment it settled,
     and filtering the sale by it would answer a different question. */
  if (p.started) out = out.filter((r) => r.s.startDate.startsWith(p.started as string));
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

/** How people are engaged — the server's `employment-types` list (full time /
 *  contract), filled in place when the payroll loads so every reader keeps the
 *  same array. Empty until then, and empty for a session that may not read it:
 *  a filter offering nothing is honest, two invented keys are not. */
export const ENGAGEMENTS: { key: string; label: string }[] = [];

/* ================================================= who a salary is for ===
   THE PERSON BELONGS TO TEAM. A salary account points at a member and never
   invents one, so the account form picks from the team rather than asking
   somebody to type a name, a designation and an id that has to match.

   THIS READS THE LIVE ROSTER (`users/` + `attendance/settings/`, loaded with
   the payroll), which is where a member actually exists. It used to read
   Team's bundled fixture, and the two casts had to be reconciled by hand every
   time either changed — a salary that pointed at nobody was invisible until
   somebody opened the pay dialog and found an empty picker. */

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
  const taken = new Set(snap.salaryAccounts.map((a) => a.memberId));
  return roster
    .filter((m) => m.active)
    .map((m) => ({
      memberId: m.memberId,
      name: m.name,
      designation: m.designation,
      department: m.department,
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

/** FIVE MEGABYTES, AND IT IS ONE RULE RATHER THAN ONE SCREEN'S RULE. A receipt
 *  is a photograph of a piece of paper or a PDF of one; anything larger is a
 *  scan nobody set the resolution on. It lives here beside `proofAccepted`
 *  because both salary payments and company transactions attach evidence, and
 *  a cap that applied to only one of them is a cap somebody works around by
 *  using the other screen. */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const proofTooBig = (bytes?: number) =>
  typeof bytes === "number" && bytes > PROOF_MAX_BYTES;
/** `5 MB`, `1.4 MB`, `812 KB`. For saying which file was refused and by how
 *  much — a refusal that does not name the size is one somebody just retries. */
export const fileSize = (bytes: number): string =>
  (bytes >= 1024 * 1024
    ? Math.round((bytes / (1024 * 1024)) * 10) / 10 + " MB"
    : Math.max(1, Math.round(bytes / 1024)) + " KB");
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
    /* A CANCELLED ROW IS NOT CHASED FOR PAPERWORK. It charges nothing, so a
       receipt proving what it charged would prove nothing. */
    missingBill: t.state === "recorded" && t.direction === "out" && t.amountPaise > 0 && !t.bill
      && (!!tag?.proofRequired || t.amountPaise >= BILL_THRESHOLD_PAISE),
    ageDays: daysPast(t.valueDate),
  };
}
export const txnRows = (): TxnRow[] =>
  live.txns.map(toTxnRow).sort((a, b) =>
    b.t.valueDate.localeCompare(a.t.valueDate) || ts(b.t.recordedAt) - ts(a.t.recordedAt));

export function applyTxnFilters(rows: TxnRow[], p: Params): TxnRow[] {
  let out = rows;
  if (p.dir) out = out.filter((r) => r.t.direction === p.dir);
  if (p.state) out = out.filter((r) => r.t.state === p.state);
  if (p.tag) out = out.filter((r) => r.t.tagKey === p.tag);
  if (p.kind) out = out.filter((r) => r.tag?.kind === p.kind);
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
/** EVERY tag, spent against or not — summed here off the spend rows rather than
 *  taken from the endpoint's `byTag`, which leaves out a tag nothing was spent
 *  under. Same arithmetic as the server's. */
export function tagTotals(from = livePeriodOf().from, to = livePeriodOf().to): { rows: TagTotal[]; totalPaise: number } {
  const rows: TagTotal[] = live.tags.map((tag) => {
    const list = live.txns.filter((t) => t.tagKey === tag.tagKey && t.direction === "out"
      && t.state === "recorded" && inPeriod(t.valueDate, from, to));
    const spentPaise = list.reduce((n, t) => n + t.amountPaise, 0);
    return {
      tag, spentPaise, n: list.length,
      overBudget: !!tag.budgetPaise && spentPaise > tag.budgetPaise,
      pctOfBudget: tag.budgetPaise ? Math.round((spentPaise / tag.budgetPaise) * 100) : null,
    };
  }).sort((a, b) => b.spentPaise - a.spentPaise);
  /* THE TOTAL IS OPERATING SPEND, the same split `overview()` takes below: a
     tag whose kind is `excluded` is tax and statutory money, counted APART
     from spend everywhere else in this module. Summing it in here made the
     by-tag panel head print a figure that disagreed with the Out and Other
     Transaction figures on the same screen, for the same month, off the same
     rows. The ROWS still carry every tag -- the budget editor and the tag
     pickers read them, and an excluded tag has a budget like any other. */
  return {
    rows,
    totalPaise: rows.reduce((n, r) => n + (r.tag.kind === "excluded" ? 0 : r.spentPaise), 0),
  };
}

/* ======================================================== refund rows === */

export interface RefundRow { r: Refund; payment: InstallmentPayment | null; sub: Subscription | null; ageDays: number }
/** `sub` is always null: a server refund points at a plan payment, and there
 *  is no subscription record behind that on the server. */
export function toRefundRow(r: Refund): RefundRow {
  return {
    r, payment: live.refundPayment[r.refundId] || null, sub: null,
    ageDays: daysPast(r.requestedAt.slice(0, 10)),
  };
}
export const refundRows = (): RefundRow[] =>
  live.refunds.map(toRefundRow).sort((a, b) => ts(b.r.requestedAt) - ts(a.r.requestedAt));

export function refundQueue() {
  const rows = refundRows();
  return {
    open: rows.filter((x) => x.r.state === "requested"),
    approved: rows.filter((x) => x.r.state === "approved"),
    settled: rows.filter((x) => x.r.state === "paid" || x.r.state === "declined"),
    all: rows,
  };
}

/** Nothing live reaches this: the picker it frames is empty on a live section
 *  (see `readPayments`), so every check below answers false rather than pass. */
export function refundPolicyCheck(paymentId: string, ground: string): RefundPolicy & { ageDays: number } {
  const hit = readPayment(paymentId);
  const g = groundMeta(ground);
  const ageDays = hit ? daysPast(hit.pay.valueDate) : 0;
  return {
    groundPermitted: !!g?.permitted,
    withinWindow: !!hit && ageDays <= REFUND_POLICY.windowDays,
    originalRecorded: !!hit,
    subscriptionActive: !!hit && hit.sub.status === "active",
    ageDays,
  };
}

/* ============================================================== money === */

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
  /** Everything that left in the period — salary, other spend and refunds paid.
   *  Derived here rather than added up in a view, so the hero figure and the
   *  waterfall's three out-steps can never disagree about what "out" means. */
  outPaise: number;
  netPaise: number;
}

const sumOf = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);
const inP = (d: string | null | undefined, from: string, to: string) => !!d && inPeriod(d, from, to);
const addDaysIso = (d: string, n: number) =>
  new Date(new Date(d + "T00:00:00Z").getTime() + n * DAY).toISOString().slice(0, 10);

/** THE PERIOD'S MONEY, from ONE half. On a live section every field is the
 *  server's; on the Subscriptions face — the one seed face that reads this —
 *  it is the seed's. The two are never mixed in one answer. */
export function overview(from = PERIOD.from, to = PERIOD.to): Overview {
  return onLive() ? liveOverview(from, to) : seedOverview(from, to);
}

/** What the Subscriptions strip reads: installments collected in the period,
 *  what is expected in the next 30 days and what did not clear — plus the
 *  seed's salary runs. Spend, income and refunds are not in the seed any more,
 *  so those fields are zero and `net` is collected less salary only. */
function seedOverview(from: string, to: string): Overview {
  const pays = countedPayments().filter((r) => inPeriod(r.pay.valueDate, from, to));
  const collectedPaise = sumOf(pays, (r) => r.pay.amountPaise);
  const runs = snap.salaryRuns.filter((r) => r.state === "paid" && r.month >= monthOf(from) && r.month <= monthOf(to));
  const salaryPaise = sumOf(runs, (r) => r.totalNetPaise);
  const horizon = addDaysIso(todayIso(), 30);
  /* AT MOST ONE PER SUBSCRIPTION, and none at all from a defaulting one —
     see nextDue. */
  const due = snap.subscriptions.map(nextDue).filter((i): i is Installment => !!i && i.dueDate <= horizon);
  const failed = installmentRows().filter((x) => x.i.status === "fail_to_pay");
  return {
    collectedPaise, collectedN: pays.length,
    salaryPaise, salaryN: sumOf(runs, (r) => r.slips.length),
    otherOutPaise: 0, otherOutN: 0, otherInPaise: 0, otherInN: 0,
    refundsPaidPaise: 0, refundsPaidN: 0, refundsOwedPaise: 0, refundsOwedN: 0,
    dueNextPaise: sumOf(due, (i) => i.amountPaise), dueNextN: due.length,
    failedPaise: sumOf(failed, (x) => x.i.amountPaise), failedN: failed.length,
    excludedPaise: 0,
    outPaise: salaryPaise, netPaise: collectedPaise - salaryPaise,
  };
}

/** Plan purchases that landed in the window, at their full amount — a refund
 *  is counted once, as money out (Overview/live.ts planCashPaise). Rupee
 *  strings on the wire; a ₹0 free plan is not a payment. */
const planNet = (from: string, to: string) => live.plans
  .map((x) => ({ at: dateOnly(x.verifiedAt), net: planCashPaise(x, live.settledRefunds) }))
  .filter((x) => x.net > 0 && inP(x.at, from, to));

/** THE SERVER'S MONEY FOR A WINDOW, on the same rules as the Overview
 *  section (Overview/financeLive.ts):
 *    in   deal-ledger payments not reversed, by paymentDate, + plan purchases
 *         at full amount, by verifiedAt; other income recorded, by valueDate.
 *    out  spend recorded whose tag is not `excluded` + salary runs by the day
 *         they were PAID + refunds by the day they were settled.
 *  Dates are India dates. Nothing accrued, nothing forecast: cash. */
function liveOverview(from: string, to: string): Overview {
  const deal = live.ledger.filter((x) => x.type === "payment" && !x.reversed && inP(dateOnly(x.paymentDate), from, to));
  const plans = planNet(from, to);
  const counted = live.txns.filter((t) => t.state === "recorded" && inP(t.valueDate, from, to));
  const out = counted.filter((t) => t.direction === "out");
  const operating = out.filter((t) => tagOf(t.tagKey)?.kind !== "excluded");
  const excluded = out.filter((t) => tagOf(t.tagKey)?.kind === "excluded");
  const inn = counted.filter((t) => t.direction === "in");
  const runs = live.runs.filter((r) => inP(dateOnly(r.paidAt), from, to));
  const rfPaid = live.refunds.filter((r) => !!r.settlement && inP(dateOnly(r.settlement.paidAt), from, to));
  const rfOwed = live.refunds.filter((r) => r.state === "approved" && !r.settlement);
  const today = liveToday();
  const due = today
    ? live.installments.filter((x) => x.status?.key === "due" && x.dueDate >= today && x.dueDate <= addDaysIso(today, 30))
    : [];
  const failed = live.installments.filter((x) => x.status?.key === "failed");

  const collectedPaise = sumOf(deal, (x) => x.amountPaise) + sumOf(plans, (x) => x.net);
  const salaryPaise = sumOf(runs, (r) => r.totalNetPaise);
  const otherOutPaise = sumOf(operating, (t) => t.amountPaise);
  const otherInPaise = sumOf(inn, (t) => t.amountPaise);
  const refundsPaidPaise = sumOf(rfPaid, (r) => r.amountPaise);
  return {
    collectedPaise, collectedN: deal.length + plans.length,
    salaryPaise, salaryN: sumOf(runs, (r) => r.slips),
    otherOutPaise, otherOutN: operating.length,
    otherInPaise, otherInN: inn.length,
    refundsPaidPaise, refundsPaidN: rfPaid.length,
    refundsOwedPaise: sumOf(rfOwed, (r) => r.amountPaise), refundsOwedN: rfOwed.length,
    dueNextPaise: sumOf(due, (x) => x.amountPaise), dueNextN: due.length,
    failedPaise: sumOf(failed, (x) => x.amountPaise), failedN: failed.length,
    excludedPaise: sumOf(excluded, (t) => t.amountPaise),
    outPaise: salaryPaise + otherOutPaise + refundsPaidPaise,
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

/** Every month the server's records touch inside the windowed reads, oldest
 *  first — derived from the rows themselves, so Analytics cannot contradict a
 *  tab. `newCustomers` is null: no payment on the server names its customer,
 *  so a first payment cannot be told from a repeat. */
export function monthPoints(): MonthPoint[] {
  const keys = new Set<string>();
  const add = (d: string | null | undefined) => { if (d) keys.add(monthOf(d)); };
  live.ledger.forEach((x) => { if (x.type === "payment" && !x.reversed) add(dateOnly(x.paymentDate)); });
  live.plans.forEach((x) => { if (paiseOf(x.amount) > 0) add(dateOnly(x.verifiedAt)); });
  live.txns.forEach((t) => add(t.valueDate));
  live.runs.forEach((r) => add(dateOnly(r.paidAt)));
  live.refunds.forEach((r) => add(r.settlement ? dateOnly(r.settlement.paidAt) : null));
  const until = livePeriodOf().key;
  return Array.from(keys).filter((m) => !!live.sinceMonth && m >= live.sinceMonth && m <= until).sort().map((m) => {
    const o = liveOverview(m + "-01", monthEnd(m));
    return {
      month: m,
      subscriptionsPaise: o.collectedPaise,
      salaryPaise: o.salaryPaise,
      otherOutPaise: o.otherOutPaise,
      otherInPaise: o.otherInPaise,
      refundsPaise: o.refundsPaidPaise,
      netPaise: o.netPaise,
      newCustomers: null,
    };
  });
}

/* ================================================================ KPIs === */

const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export function kpis(from = livePeriodOf().from, to = livePeriodOf().to): Kpi[] {
  const o = liveOverview(from, to);
  const priorMonth = from ? monthBack(monthOf(from), 1) : "";
  const priorO = priorMonth && live.sinceMonth && priorMonth >= live.sinceMonth
    ? liveOverview(priorMonth + "-01", monthEnd(priorMonth)) : null;

  /* MRR and ARPU are the revenue module's own level, read at a moment. */
  const rev = live.revenue;
  const noRevenue = "The revenue read is not available to this session.";

  const settled = live.installments.filter((x) =>
    (x.status?.key === "paid" || x.status?.key === "failed") && inP(x.dueDate, from, to));
  const paidN = settled.filter((x) => x.status.key === "paid").length;
  const failN = settled.filter((x) => x.status.key === "failed").length;

  const heads = live.activeSalaryAccounts;
  const openRunRow = live.runs.filter((r) => !r.paidAt)[0] || null;
  const websitePaise = sumOf(planNet(from, to), (x) => x.net);

  const burn = o.salaryPaise + o.otherOutPaise + o.refundsPaidPaise;
  const priorBurn = priorO ? priorO.salaryPaise + priorO.otherOutPaise + priorO.refundsPaidPaise : null;
  const inTotal = o.collectedPaise + o.otherInPaise;
  const noIdentity = "No payment on the server names its customer yet, so a first payment cannot be told from a repeat.";

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
    mk("mrr", rev ? Math.round(rev.mrr * 100) : null, null, rev ? null : noRevenue),
    /* ARPU IS NULL WITH NOBODY ON A PLAN, never zero: an average over an empty
       denominator is not an average. The server answers 0 there. */
    mk("arpu", rev && rev.activeSubscribers ? Math.round(rev.arpu * 100) : null, null,
      !rev ? noRevenue : rev.activeSubscribers ? null : "No plan is active, so there is no average to take."),
    mk("collection_rate", pctOf(paidN, paidN + failN), null,
      paidN + failN ? null : "No installment fell due in this period."),
    mk("fail_rate", pctOf(failN, paidN + failN), null,
      paidN + failN ? null : "No installment fell due in this period."),
    mk("salary_ratio", o.salaryPaise ? pctOf(o.salaryPaise, o.collectedPaise) : null,
      priorO && priorO.salaryPaise ? pctOf(priorO.salaryPaise, priorO.collectedPaise) : null,
      !o.salaryPaise
        ? "No salary run was paid in this period" + (openRunRow ? " — the " + fmtMonth(openRunRow.month) + " run is still open." : ".")
        : !o.collectedPaise ? "Nothing was collected in this period." : null),
    mk("cost_per_head", heads && o.salaryPaise ? Math.round(o.salaryPaise / heads) : null, null,
      heads === null ? "The salary accounts are not readable by this session."
        : !heads ? "No active salary account." : !o.salaryPaise ? "No run was paid in this period." : null),
    mk("burn", live.outReadable ? burn : null, live.outReadable ? priorBurn : null,
      live.outReadable ? null : "Spend, salary runs or refunds are not readable by this session."),
    mk("net_margin", pctOf(o.netPaise, inTotal), null,
      inTotal ? null : "No money came in, so there is no margin to take."),
    mk("refund_rate", pctOf(o.refundsPaidPaise, o.collectedPaise), null,
      o.collectedPaise ? null : "Nothing was collected in this period."),
    /* Deliberately null. Runway needs a reconciled cash balance and several
       closed months of burn; a placeholder here is a decision made on a wrong
       number — FN-OD-07. */
    mk("runway", null, null, "Needs a reconciled cash balance and a burn history the records do not carry yet — FN-OD-07."),
    mk("new_customers", null, null, noIdentity),
    mk("cac", null, null, noIdentity),
    mk("website_share", pctOf(websitePaise, o.collectedPaise), null,
      o.collectedPaise ? null : "Nothing was collected in this period."),
  ];
}

/* ========================================================== waterfall === */

export interface WaterfallStep {
  key: string; label: string; sub: string;
  paise: number; kind: "in" | "out" | "total";
}

/** THE PERIOD AS ARITHMETIC, in the order the money moves. The closing figure
 *  is `netPaise` rather than a sum computed twice, so the chart and the tile
 *  cannot disagree. A ZERO STEP IS RETURNED, NOT DROPPED. */
export function waterfall(from = livePeriodOf().from, to = livePeriodOf().to): WaterfallStep[] {
  const o = liveOverview(from, to);
  const n = (c: number, one: string, many = one + "s") => c + " " + (c === 1 ? one : many);
  return [
    { key: "collected", label: "Collected", sub: n(o.collectedN, "installment"),
      paise: o.collectedPaise, kind: "in" },
    { key: "other_in", label: "Other income", sub: n(o.otherInN, "credit"),
      paise: o.otherInPaise, kind: "in" },
    { key: "salary", label: "Salary", sub: o.salaryN ? n(o.salaryN, "slip") : "no run paid yet",
      paise: o.salaryPaise, kind: "out" },
    { key: "other_out", label: "Other spend", sub: n(o.otherOutN, "transaction"),
      paise: o.otherOutPaise, kind: "out" },
    { key: "refunds", label: "Refunds", sub: n(o.refundsPaidN, "refund"),
      paise: o.refundsPaidPaise, kind: "out" },
    { key: "net", label: "Net", sub: "cash, not profit", paise: o.netPaise, kind: "total" },
  ];
}

/* ============================================================ at risk === */

export interface RiskRow {
  key: string; label: string;
  /** Null where the row is a count or a ratio rather than an amount. */
  paise: number | null;
  /** What the figure is, when it is not rupees — "287% of budget". */
  figure: string | null;
  count: string;
  tone: "bad" | "warn" | "mute";
  to: string | null;
  /** WHAT YOU WILL SEE, never which section holds it. */
  toLabel: string;
}

/** MONEY THAT IS NOT WHERE IT SHOULD BE, gathered from the live records. A
 *  TABLE AND NOT A CHART: these amounts must never be added together. */
export function atRisk(from = livePeriodOf().from, to = livePeriodOf().to): RiskRow[] {
  const o = liveOverview(from, to);
  const over = tagTotals(from, to).rows.filter((r) => r.overBudget);
  const recon = reconciliation();
  const rows: RiskRow[] = [
    { key: "failed", label: "Fail to pay", paise: o.failedPaise, figure: null,
      count: o.failedN + (o.failedN === 1 ? " installment" : " installments"),
      tone: "bad", to: "#/finance?flag=failed",
      toLabel: "the " + o.failedN + " that failed" },
    { key: "due_next", label: "Due next 30 days", paise: o.dueNextPaise, figure: null,
      count: o.dueNextN + (o.dueNextN === 1 ? " installment" : " installments"),
      tone: "mute", to: "#/finance?flag=due", toLabel: "what is due" },
  ];
  if (o.refundsOwedN) {
    rows.push({ key: "owed", label: "Approved, not sent", paise: o.refundsOwedPaise, figure: null,
      count: o.refundsOwedN + (o.refundsOwedN === 1 ? " refund" : " refunds"),
      tone: "warn", to: "#/finance-refunds?flag=owed",
      toLabel: o.refundsOwedN === 1 ? "the refund" : "the refunds" });
  }
  over.forEach((r) => {
    rows.push({ key: "budget-" + r.tag.tagKey, label: "Over budget", paise: null,
      figure: r.pctOfBudget + "% of budget", count: r.tag.label, tone: "warn",
      to: "#/finance-transactions?tag=" + encodeURIComponent(r.tag.tagKey),
      toLabel: "what is on it" });
  });
  if (recon.bankOnly.length) {
    rows.push({ key: "unexplained", label: "Bank lines nothing explains", paise: null,
      figure: "net " + inr(recon.variancePaise), tone: "bad",
      count: recon.bankOnly.length + (recon.bankOnly.length === 1 ? " line" : " lines"),
      to: null, toLabel: "listed below" });
  }
  return rows;
}

/* ======================================================== kpi history === */

/** THE SHAPE BEHIND A KPI, or null when there is no history to draw. NULL IS
 *  THE POINT: a single reading drawn as a flat line claims a stability the
 *  records do not show. Only burn can be read month by month off the live
 *  records; new customers has no source (see `monthPoints`). */
export function kpiSeries(key: string): number[] | null {
  const ms = monthPoints();
  if (ms.length < 2) return null;
  if (key === "burn") return ms.map((m) => m.salaryPaise + m.otherOutPaise + m.refundsPaise);
  return null;
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

/** What the SERVER matched a line to — the panel matches nothing itself. */
export function lineMatch(lineId: string): LineMatch {
  return live.lineMatches[lineId] || { kind: "none" };
}

export interface Recon {
  stmt: Statement | null;
  lines: { line: BankLine; match: LineMatch }[];
  bankOnly: { line: BankLine; match: LineMatch }[];
  matchedN: number;
  variancePaise: number;
  canClose: boolean;
  resolutions: Resolution[];
}

/** One statement: the one asked for, else the open one, else the newest. */
export function reconciliation(stmtId?: string): Recon {
  const all = live.statements;
  const stmt = (stmtId ? all.filter((s) => s.stmtId === stmtId)[0] : all.filter((s) => !s.closed)[0])
    || all[0] || null;
  if (!stmt) return { stmt: null, lines: [], bankOnly: [], matchedN: 0, variancePaise: 0, canClose: false, resolutions: [] };
  const lines = stmt.lines.map((line) => ({ line, match: lineMatch(line.lineId) }));
  const resolved = new Set(live.resolutions.map((r) => r.targetId));
  const bankOnly = lines.filter((l) => l.match.kind === "none" && !resolved.has(l.line.lineId));
  return {
    stmt, lines, bankOnly,
    matchedN: lines.filter((l) => l.match.kind !== "none").length,
    variancePaise: bankOnly.reduce((n, l) => n + (l.line.dir === "credit" ? l.line.amountPaise : -l.line.amountPaise), 0),
    canClose: bankOnly.length === 0,
    resolutions: live.resolutions,
  };
}

/** How much of what the bank shows, the records explain — the server's figure
 *  over every statement. Completeness, never correctness. */
export function matchedPct(): number | null {
  return live.bankMatchedPct;
}

/* ================================================================ tax === */

/** Tax on the invoices ISSUED with an invoice date in the period. */
export function taxSummary(from = livePeriodOf().from, to = livePeriodOf().to) {
  const invs = live.invoices.filter((i) => i.status === "issued" && inP(i.invoiceDate, from, to));
  const g = (f: (i: InvoiceRow) => number) => sumOf(invs, f);
  const cgstPaise = g((i) => i.cgstPaise), sgstPaise = g((i) => i.sgstPaise), igstPaise = g((i) => i.igstPaise);
  return {
    n: invs.length,
    taxablePaise: g((i) => i.taxableTotalPaise),
    cgstPaise, sgstPaise, igstPaise,
    totalTaxPaise: cgstPaise + sgstPaise + igstPaise,
  };
}

/* ============================================================== writes === */
/* EVERY WRITE GOES TO THE SERVER, re-reads the rows it changed and answers
   with the server's own refusal when it says no. A write the server has no
   endpoint for is refused in words — never written into a local copy that
   the next read would wipe.                                                */

/** One reference, one row, across the LIVE rows, checked before a write is
 *  sent. The server enforces it on income; on spend and refunds this is the
 *  only check. */
function dupLiveReference(ref: string): boolean {
  const r = norm(ref);
  if (!r) return false;
  return live.txns.some((t) => t.state === "recorded" && norm(t.reference) === r)
    || live.refunds.some((rf) => !!rf.settlement && norm(rf.settlement.reference) === r);
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
export function usePlansSeen() { useVersion(); useSubsBoot(); return plansSeen(); }

/* ========================================================== the chain ===
   deal → quotation → invoice → subscription, as the record dialogs walk it
   (subscriptions/chains/). A deal names the platform account it sells to
   (Deal.customer, migration leads 0020), so an ACCEPTED quotation on it can be
   tied to that customer without a join by email or phone. A deal nobody has
   linked offers nothing, and the dialogs say so in their own empty messages. */

/** A quotation as the record dialog reads one. */
export interface FinQuotation {
  quotationNumber: string; dealRef: string; planName: string; termMonths: number;
  installments: number; installmentGapMonths: number; grandTotalPaise: number;
}
export interface ChainOption {
  quotation: FinQuotation;
  invoices: FinInvoice[];
  /** The first issued invoice on this quotation — the document a sale is
   *  recorded on. Null until one is issued. */
  attachable: FinInvoice | null;
  /** The subscription already recorded over this quotation. */
  recordedAs: string | null;
}
const chainOption = (c: SubChainRow): ChainOption => {
  const q = c.quotation;
  const issued = c.invoices.filter((i) => i.status === "issued")[0];
  return {
    quotation: {
      quotationNumber: q.quotationNumber || "", dealRef: q.dealRef, planName: q.planName,
      termMonths: q.termMonths, installments: q.installments,
      installmentGapMonths: q.installmentGapMonths, grandTotalPaise: q.grandTotalPaise,
    },
    invoices: c.invoices.map((i) => chainInvoice(i, c.userId)),
    attachable: issued ? chainInvoice(issued, c.userId) : null,
    recordedAs: c.subscriptionId === null ? null : QSUB + c.subscriptionId,
  };
};
export const chainsFor = (userId: string): ChainOption[] =>
  chains.filter((c) => String(c.userId) === userId).map(chainOption);
/** Every issued invoice on this customer's sales that settles no installment yet. */
export const attachableInvoices = (userId: string): FinInvoice[] =>
  chains.filter((c) => String(c.userId) === userId)
    .flatMap((c) => c.invoices.filter((i) => i.status === "issued" && i.carriesSeq === null)
      .map((i) => chainInvoice(i, c.userId)));

/* THE SUBSCRIPTION RECORD IS THE SERVER'S (2026-09-16, migration 0059).

   A row on this tab is a PLAN PURCHASE (subs/): the plan, the term, what it
   cost, and the payment that settled it. On top of it sits the COMMITMENT
   (subscriptions/) — where it stands, whether it renews, who sold it, and why
   it stopped. Recording one, moving it between states and cancelling it with a
   reason all write to the server.

   A SALE (migration 0063) is recorded over its accepted quotation instead, and
   its installments are that quotation's rows: settled by the issued invoice
   that billed each, failed on the deal's own rule, reversed through the deal
   ledger. A plan purchase is ONE payment, so its single installment line stays
   derived from that payment; a wrong one is REVERSED on the payment itself. */

export interface RecordSubInput {
  userId: string;
  source: "sales" | "website";
  planId: string; planName: string; cycleMonths: number;
  invoiceNumber: string;
  installmentCount: number; startDate: string;
  remark?: string;
  paid?: { count: number; mode: string; reference: string; valueDate: string; accountId: string };
  /** THE PURCHASE THIS COMMITMENT IS OVER. Without it the subscription is a
   *  SALE, recorded over the quotation whose invoice `invoiceNumber` names. */
  purchase?: { family: string; id: number };
  state?: string;
}

/** One commitment against one purchase. Kept apart from `recordSubscription`
 *  so the store can record one on its way to cancelling or defaulting it,
 *  which is the ordinary case: nobody records a commitment for its own sake. */
async function postCommitment(family: string, purchase: number,
  extra: { state?: string; cycleMonths?: number; startedOn?: string; renewsOn?: string; note?: string } = {}):
  Promise<ApiSubscriptionRow> {
  const row = await call(AdminOpsService.recordSubscription({ family, purchase, ...extra }));
  commitments["SUB-" + family + "-" + purchase] = row;
  return row;
}

export async function recordSubscription(input: RecordSubInput):
  Promise<{ error: string; subscriptionId: string | null }> {
  if (!input.purchase) {
    /* THE INVOICE NAMES THE QUOTATION, and the quotation's deal names the
       customer. What is paid is the ledger's: `paid.count` is checked against
       it, and the transfer facts beside it are the invoice's own already. */
    const chain = chains.filter((c) => c.invoices.some((i) => i.invoiceNumber === input.invoiceNumber))[0];
    if (!chain) return { error: "Attach the invoice this subscription was raised on.", subscriptionId: null };
    if (String(chain.userId) !== input.userId)
      return { error: input.invoiceNumber + " is on another customer's deal.", subscriptionId: null };
    try {
      const row = await call(AdminOpsService.recordSubscription({
        quotation: chain.quotation.id, paidCount: input.paid ? input.paid.count : 0,
        startedOn: input.startDate || undefined, note: input.remark,
      }));
      commitments[QSUB + row.id] = row;
      await bootSubs(true);
      return { error: "", subscriptionId: QSUB + row.id };
    } catch (e) {
      return { error: writeError(e), subscriptionId: null };
    }
  }
  const { family, id } = input.purchase;
  try {
    await postCommitment(family, id, {
      state: input.state, cycleMonths: input.cycleMonths || undefined,
      startedOn: input.startDate || undefined, note: input.remark,
    });
  } catch (e) {
    return { error: writeError(e), subscriptionId: null };
  }
  await bootSubs(true);
  return { error: "", subscriptionId: "SUB-" + family + "-" + id };
}

/** The commitment this purchase already carries, or one recorded now. Every
 *  write below needs one and most purchases do not have one yet — a state is
 *  not a thing anybody sets up in advance. */
async function heldFor(subscriptionId: string): Promise<{ id: number | null; error: string }> {
  const held = commitments[subscriptionId];
  if (held) return { id: held.id, error: "" };
  const ref = purchaseRefOf(subscriptionId);
  if (!ref) return { id: null, error: "That subscription no longer exists." };
  try {
    return { id: (await postCommitment(ref.family, ref.purchase)).id, error: "" };
  } catch (e) {
    return { id: null, error: writeError(e) };
  }
}

/** The invoices that may settle one installment of a sale: issued, on its own
 *  quotation, settling nothing yet, and for exactly that installment's amount.
 *  A purchase has none — it is one payment. */
export function attachableForInstallment(subscriptionId: string, seq: number): FinInvoice[] {
  const held = commitments[subscriptionId];
  const inst = (readSubscription(subscriptionId)?.installments || []).filter((i) => i.seq === seq)[0];
  if (!held || !held.quotation || !inst) return [];
  const chain = chains.filter((c) => c.quotation.id === held.quotation!.id)[0];
  return (chain ? chain.invoices : [])
    .filter((i) => i.status === "issued" && i.carriesSeq === null && i.grandTotalPaise === inst.amountPaise)
    .map((i) => chainInvoice(i, chain.userId));
}

export interface RecordPaymentInput {
  subscriptionId: string; seq: number;
  valueDate: string;
  mode?: string; reference?: string; accountId?: string;
  invoiceNumber?: string | null;
}
/** A SALE'S INSTALLMENT IS SETTLED BY ITS ISSUED INVOICE: issuing one is what
 *  writes the ledger row, so this joins the two and records no money itself.
 *  The value date is the invoice's payment date, not a second one typed here.
 *  A plan purchase is one payment, settled by the gateway or verified under
 *  Payments, and is refused. */
export async function recordInstallmentPayment(input: RecordPaymentInput):
  Promise<{ error: string; paymentId: string | null }> {
  const sale = saleIdOf(input.subscriptionId);
  if (sale === null)
    return {
      error: "A plan purchase is one payment: the gateway settles it, or it is verified as a manual payment"
        + " under Payments. There is no installment to record here.",
      paymentId: null,
    };
  try {
    const row = await call(AdminOpsService.paySubscriptionInstallment(sale, input.seq, input.invoiceNumber || ""));
    commitments[input.subscriptionId] = row;
    const paid = (row.installments || []).filter((r) => r.seq === input.seq)[0];
    await bootSubs(true);
    return { error: "", paymentId: paid && paid.payment ? DP + paid.payment.id : null };
  } catch (e) {
    return { error: writeError(e), paymentId: null };
  }
}

/** FN · A FAILURE IS A STATE, not a schedule row: the commitment goes
 *  `defaulting`, and the reason and the evidence ride the audit trail with the
 *  write — the same place the hold reason and the closing reason are kept —
 *  and come back as the installment's `failure`. The server refuses a paid
 *  purchase, a reason off the list, and `overdue` before the due date.
 *  Which installment failed cannot be recorded, because there is only one and
 *  it is derived from the payment. */
export async function markFailToPay(subscriptionId: string, seq: number, reason: string,
  evidence: string): Promise<string> {
  const sub = readSubscription(subscriptionId);
  if (!sub) return "That subscription no longer exists.";
  const sale = saleIdOf(subscriptionId);
  if (sale !== null) {
    if (!reason.trim()) return "Pick what happened.";
    if (!evidence.trim())
      return "Say what the gateway or the bank said, in their words. A failure with no evidence is indistinguishable from a guess. (reason_required)";
    try {
      await call(AdminOpsService.failSubscriptionInstallment(sale, seq, { reason: reason.trim(), note: evidence.trim() }));
    } catch (e) {
      return writeError(e);
    }
    await bootSubs(true);
    return "";
  }
  if (seq !== 1)
    return "A plan purchase is paid once, so there is a single installment and it is the one that failed.";
  if (!reason.trim()) return "Pick what happened.";
  if (!evidence.trim())
    return "Say what the gateway or the bank said, in their words. A failure with no evidence is indistinguishable from a guess. (reason_required)";
  const held = await heldFor(subscriptionId);
  if (held.error) return held.error;
  try {
    await call(AdminOpsService.setSubscriptionState(held.id as number, {
      state: "defaulting", reason: reason.trim(), note: evidence.trim(),
    }));
  } catch (e) {
    return writeError(e);
  }
  await bootSubs(true);
  return "";
}

/** FN · A RECORDED PAYMENT WAS WRONG — a duplicate, a credit the bank
 *  recalled. NO MONEY MOVES: money going back to a customer is a refund. On a
 *  sale it is the deal ledger's reversal (the invoice is cancelled and the
 *  installment owed again); on a plan purchase the payment turns REVERSED and
 *  stops counting. The plan itself is not touched. Super Admin, as the dialog
 *  says; the server holds it to `finance.reverse`. */
export async function reversePayment(paymentId: string, reason: string): Promise<string> {
  const hit = seedPayments().filter((h) => h.pay.paymentId === paymentId)[0];
  if (!hit) return "That payment is not on any subscription.";
  const sa = superAdminOnly("Reversing a payment"); if (sa) return sa;
  if (!reason.trim()) return "Say why it is being reversed. It goes into the history verbatim. (reason_required)";
  const held = await heldFor(hit.sub.subscriptionId);
  if (held.error) return held.error;
  try {
    await call(AdminOpsService.reverseSubscriptionPayment(held.id as number, { seq: hit.inst.seq, reason: reason.trim() }));
  } catch (e) {
    return writeError(e);
  }
  await bootSubs(true);
  return "";
}

/** FN · It stops renewing, on a day, for a reason. NOT A REFUND: money already
 *  collected stays collected, and goes back only through a refund request that
 *  somebody approves and actually sends. */
export async function cancelSubscription(id: string, reason: string): Promise<string> {
  const sub = readSubscription(id);
  if (!sub) return "That subscription no longer exists.";
  if (!reason.trim())
    return "Say why it is ending. It goes into the history verbatim. (reason_required)";
  const held = await heldFor(id);
  if (held.error) return held.error;
  try {
    await call(AdminOpsService.cancelSubscription(held.id as number, reason.trim()));
  } catch (e) {
    return writeError(e);
  }
  await bootSubs(true);
  return "";
}

/* ---------------------------------------------------------- salaries --- */
/* EVERY WRITE BELOW GOES TO THE SERVER and answers with the server's own
   refusal when it says no. WHAT THE RECORD HAS NO COLUMN FOR IS REFUSED rather
   than dropped: a component breakdown, standing deductions, bank details, PAN,
   UAN, a one-off incentive on a payment — a form that swallowed any of them
   would look like it had saved them, and a figure nobody can find afterwards
   is worse than one that was never accepted. */

/** The server id inside a panel id (`SAL-AC-12` → 12), or null when the id is
 *  not one of ours — a stale link, never a row to write to. */
function serverIdOf(id: string, prefix: string): number | null {
  const n = id.indexOf(prefix) === 0 ? Number(id.slice(prefix.length)) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Fold one server account into the snapshot at once, then re-read the payroll
 *  in the background so every derived figure agrees with the server. */
function putAccount(row: SalaryAccountRow): SalaryAccount {
  const a = liveSalaryAccount(row);
  snap.salaryAccounts = snap.salaryAccounts
    .filter((x) => x.salaryAccountId !== a.salaryAccountId).concat([a]);
  emit();
  void bootPayroll(true);
  return a;
}

/** FN-T06 · Open or revise a salary account. What is stored is the MONTHLY
 *  GROSS and the employee code: the person, their designation and their
 *  department are Team's and are read from the roster, never typed here. */
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
export async function upsertSalaryAccount(input: SalaryAccountInput, id?: string):
Promise<{ error: string; salaryAccountId: string | null }> {
  const fail = (error: string) => ({ error, salaryAccountId: null });
  if (!input.memberId) return fail("This account must point at a real Team member — that link is what stops a salary existing for nobody.");
  if (!input.memberName.trim()) return fail("Pick the team member this account belongs to.");
  if (input.earnings.some((e) => !Number.isInteger(e.amountPaise) || e.amountPaise < 0)
    || input.deductions.some((d) => !Number.isInteger(d.amountPaise) || d.amountPaise < 0))
    return fail("Every component is a whole amount, and none of them is negative.");
  const gross = money(input.earnings);
  if (gross <= 0) return fail("The earnings must add up to more than zero.");
  /* WHAT THE SALARY IS MADE OF, both sides on one list — the server tells them
     apart by `kind` and its earnings have to add up to the gross, which is the
     one thing two figures for one salary could disagree about. */
  const line = (c: SalaryComponent, kind: "earning" | "deduction"): SalaryComponentRow =>
    ({ key: c.key, label: c.label, kind, amountPaise: c.amountPaise });
  const components: SalaryComponentRow[] = input.earnings.map((e) => line(e, "earning"))
    .concat(input.deductions.map((d) => line(d, "deduction")));
  /* WHERE IT IS SENT. Only what somebody actually typed goes: the form is
     prefilled from a MASKED read, and sending those asterisks back would
     overwrite the real number with its own mask. The server merges, so the
     fields left alone keep what they hold. */
  const b = input.bank;
  const payTo: Record<string, string> = {};
  const typed = (k: string, v: string) => {
    const t = (v || "").trim();
    if (t && t.indexOf("*") < 0) payTo[k] = t;
  };
  typed("bankName", b.name);
  typed("accountMasked", b.masked);
  typed("ifsc", b.ifsc);
  typed("upi", b.upi || "");
  typed("pan", input.pan);
  typed("uan", input.uan || "");

  const code = input.employeeCode.trim() || employeeCodeOf(input.memberId);
  try {
    if (id) {
      const ref = serverIdOf(id, SAL);
      if (ref === null) return fail("That salary account no longer exists.");
      const row = await call(AdminOpsService.updateSalaryAccount(ref, {
        employeeCode: code, monthlyGrossPaise: gross, components,
        ...(Object.keys(payTo).length ? { payTo } : {}),
      }));
      putAccount(row);
      return { error: "", salaryAccountId: id };
    }
    const row = await call(AdminOpsService.createSalaryAccount({
      member: input.memberId, employeeCode: code, monthlyGrossPaise: gross, components,
      ...(Object.keys(payTo).length ? { payTo } : {}),
    }));
    const a = putAccount(row);
    return { error: "", salaryAccountId: a.salaryAccountId };
  } catch (e) {
    return fail(writeError(e));
  }
}

/** The person left. The slips stay: closing only stops the next run picking
 *  this account up. The reason has no column on the account and rides the
 *  audit trail with the action, which is where it can still be read. */
export async function closeSalaryAccount(id: string, reason: string): Promise<string> {
  const acc = readSalaryAccount(id);
  if (!acc) return "That salary account no longer exists.";
  if (!acc.active) return "It is already closed. (invalid_state_transition)";
  if (!reason.trim()) return "Say why it is closing. (reason_required)";
  const ref = serverIdOf(id, SAL);
  if (ref === null) return "That salary account no longer exists.";
  try {
    putAccount(await call(AdminOpsService.updateSalaryAccount(ref, {
      isActive: false, reason: reason.trim(),
    })));
    return "";
  } catch (e) {
    return writeError(e);
  }
}

/** Who a run WOULD pay and what it would come to. Exported so the dialog can
 *  show it before the button is pressed without re-deriving the rule — the
 *  same reason previewSchedule exists. */
export function previewRun(): { account: SalaryAccount; grossPaise: number; deductionsPaise: number; netPaise: number }[] {
  return snap.salaryAccounts.filter((a) => a.active).map((account) => {
    const grossPaise = money(account.earnings);
    const deductionsPaise = money(account.deductions);
    return { account, grossPaise, deductionsPaise, netPaise: grossPaise - deductionsPaise };
  });
}
export function usePreviewRun() { useVersion(); usePayrollBoot(); return previewRun(); }

/** FN-T07 · Build the run for a month: one slip per active account, each
 *  copying what that account says today. The server is the one that decides —
 *  a month that has not started, a month already run and a second open run are
 *  all refused there, so the panel never has to guess at the calendar. */
export async function openSalaryRun(month: string): Promise<{ error: string; runId: string | null }> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Pick a month.", runId: null };
  try {
    const built = await call(AdminOpsService.buildSalaryRun(month));
    const byId: Record<string, SalaryAccount> = {};
    snap.salaryAccounts.forEach((a) => { byId[a.salaryAccountId] = a; });
    const run = liveRun(built.run, built.slips.map((s) => liveSlip(s, byId[SAL + s.accountId] || null)));
    snap.salaryRuns = snap.salaryRuns.filter((r) => r.month !== run.month).concat([run]);
    emit();
    void bootPayroll(true);
    return { error: "", runId: run.runId };
  } catch (e) {
    return { error: writeError(e), runId: null };
  }
}

/** FN-T07b · Days not worked and not paid, on ONE unpaid slip. The slip
 *  carries its own frozen `basePaise`, so the server pro-rates from the full
 *  month every time — which is why applying it twice is safe and why a raise
 *  granted after the run opened cannot reach back into this month.
 *  EARNINGS MOVE, DEDUCTIONS DO NOT: professional tax is a flat monthly levy
 *  and does not shrink because somebody was away. */
export async function setLop(slipId: string, lopDays: number): Promise<string> {
  const slip = readSlip(slipId);
  if (!slip) return "That slip no longer exists.";
  if (slip.paidAt)
    return slip.slipId + " is paid and frozen. A paid document does not move. (already_paid)";
  if (!Number.isInteger(lopDays) || lopDays < 0 || lopDays >= daysInMonth(slip.month))
    return "Loss of pay is a whole number of days inside " + fmtMonth(slip.month) + ".";
  const ref = serverIdOf(slipId, SLIP);
  if (ref === null) return "That slip no longer exists.";
  try {
    await call(AdminOpsService.setPayslipLop(ref, lopDays));
  } catch (e) {
    return writeError(e);
  }
  await bootPayroll(true);
  return "";
}

/** FN-T08b · Pay ONE person — every month they are owed, oldest first, each
 *  slip paid in its own write. ARREARS ARE PAID OLDEST FIRST: somebody owed
 *  two months and paid once has been paid for the older month.
 *
 *  A HELD SLIP IS SKIPPED, because `dueOf` has already left it out; the server
 *  refuses it too, which is the same rule in the place that enforces it. */
export interface PaySalaryInput {
  /** `bank` · `upi` · `cash`. See PAY_VIA. */
  via: string;
  accountId: string;
  /** MANDATORY, whatever the method. An image or a PDF: the transfer receipt,
   *  the UPI screenshot, the signed cash acknowledgement. `file` is the picked
   *  file itself — it is uploaded when the payment is recorded, and a name
   *  with no bytes behind it stores nothing. */
  proof: { filename: string; mime: string; bytes?: number; file?: File };
  remark?: string;
  /** One-off amounts settled WITH this transfer, landing on the slip's own
   *  breakdown rather than inside the gross — money paid for something
   *  achieved must not become indistinguishable from salary. Both apply to the
   *  CURRENT month only: paying two months of arrears does not pay a bonus
   *  twice. */
  incentive?: { label: string; amountPaise: number } | null;
  deduction?: { label: string; amountPaise: number } | null;
}

export async function paySalary(salaryAccountId: string, input: PaySalaryInput): Promise<string> {
  const acc = readSalaryAccount(salaryAccountId);
  if (!acc) return "That salary account no longer exists.";
  const due = dueOf(toSalaryRow(acc));
  if (!due.unpaid.length) return acc.memberName + " has nothing outstanding. (nothing_due)";

  const via = payViaMeta(input.via);
  if (!via) return "Pick how it was paid.";

  /* THE PROOF IS THE EVIDENCE the dialog asks for, and it is STORED now: one
     presigned upload, kept against every slip this transfer settles, because
     one transfer is one receipt whether it covers one month or three. */
  const filename = (input.proof?.filename || "").trim();
  if (!filename) return "Attach the receipt. It is the only evidence this payment has. (proof_required)";
  if (!proofAccepted(input.proof.mime))
    return filename + " is neither an image nor a PDF. A receipt has to be something somebody can open and read. (proof_type)";
  if (proofTooBig(input.proof.bytes))
    return filename + " is " + fileSize(input.proof.bytes as number) + ". The limit is "
      + fileSize(PROOF_MAX_BYTES) + ". (proof_too_big)";
  /* Cash has no account to pick -- the server's accounts carry no type, so
     there is no "the cash account" to name -- and `paidFrom` is optional
     server-side. Every other method names the account it left. */
  if (input.via !== "cash" && !liveAccount(input.accountId)) return "Pick the account it was paid from.";
  const sa = superAdminOnly("Paying a salary"); if (sa) return sa;
  const incentivePaise = input.incentive ? input.incentive.amountPaise : 0;
  const deductionPaise = input.deduction ? input.deduction.amountPaise : 0;
  if (incentivePaise < 0 || deductionPaise < 0)
    return "An incentive and a deduction are both whole amounts above zero.";
  if (deductionPaise && !(input.deduction as { label: string }).label.trim())
    return "Say what the deduction is for — it is the only thing that explains it on the slip. (reason_required)";
  if (!input.proof.file)
    return "Pick " + filename + " again — the receipt is uploaded when the payment is recorded. (proof_required)";

  let receiptUrl: string;
  try {
    receiptUrl = await uploadReceipt(input.proof.file);
  } catch (e) {
    return writeError(e);
  }
  const receipt = {
    receiptUrl, receiptName: filename, receiptMime: input.proof.mime,
    receiptSizeKb: Math.max(1, Math.round((input.proof.bytes || 0) / 1024)),
  };

  /* Oldest first, so the debt that has been waiting longest clears first. */
  const order = due.unpaid.slice().sort((x, y) => x.month.localeCompare(y.month));
  let paid = 0;
  for (const slip of order) {
    const ref = serverIdOf(slip.slipId, SLIP);
    if (ref === null) return "That slip no longer exists.";
    /* The one-offs ride the CURRENT month, which is the last one written. */
    const current = paid === order.length - 1;
    try {
      await call(AdminOpsService.payPayslip(ref, {
        mode: via.mode, remark: input.remark, ...receipt, paidFrom: input.accountId || undefined,
        ...(current && incentivePaise ? { incentivePaise } : {}),
        ...(current && deductionPaise
          ? { adjustmentPaise: -deductionPaise, adjustmentReason: (input.deduction as { label: string }).label.trim() }
          : {}),
      }));
      paid++;
    } catch (e) {
      const msg = writeError(e);
      void bootPayroll(true);
      return paid
        ? paid + " of " + order.length + " months went out before the server refused the next one: " + msg
        : msg;
    }
  }
  await bootPayroll(true);
  return "";
}

/** FN-T08d · Hold ONE slip, or release it. A dispute is about a month, not a
 *  person: holding March must not stop April going out. Only an UNPAID slip
 *  can hold. The reason is mandatory on the way IN and rides the audit trail —
 *  the slip itself has no column for it, so the row cannot print it back. */
export async function setSlipHold(slipId: string, hold: boolean, reason: string): Promise<string> {
  const slip = readSlip(slipId);
  if (!slip) return "That slip no longer exists.";
  if (slip.paidAt)
    return slip.slipId + " is paid and frozen. A paid document cannot be held. (already_paid)";
  if (!!slip.held === hold)
    return hold ? slip.slipId + " is already on hold." : slip.slipId + " is not on hold.";
  if (hold && !reason.trim())
    return "Say why it is held. The hold prints on no document, so the reason is the only record it has. (reason_required)";
  const ref = serverIdOf(slipId, SLIP);
  if (ref === null) return "That slip no longer exists.";
  try {
    await call(hold
      ? AdminOpsService.holdPayslip(ref, reason.trim())
      : AdminOpsService.releasePayslip(ref));
    await bootPayroll(true);
    return "";
  } catch (e) {
    return writeError(e);
  }
}

/* ------------------------------------------------- other transactions --- */

/* THE TAG TABLE IS THE SERVER'S (`expense-tags`). The three writes below are
   the server's too — `spend/tags/` and `spend/tags/<key>/` — and the list is
   re-read from it afterwards, so nothing is ever added to it here.
   A TAG IS NEVER DELETED AND NEVER RE-KINDED: either would silently re-bucket
   every row already filed under it, which is why the only writes are create,
   budget and switch off. */
export async function addTag(label: string, kind: TagKind, budgetPaise: number | null, proofRequired: boolean):
  Promise<{ error: string; tagKey: string | null }> {
  const name = label.trim();
  if (!name) return { error: "Give the tag a label.", tagKey: null };
  if (live.tags.some((t) => t.label.toLowerCase() === name.toLowerCase()))
    return { error: "A tag called " + name + " already exists. (duplicate_tag)", tagKey: null };
  let key: string;
  try {
    const row = await call(AdminOpsService.createExpenseTag({
      label: name, kind, budgetPaise: budgetPaise || 0, proofRequired,
    }));
    key = row.key;
  } catch (e) {
    return { error: writeError(e), tagKey: null };
  }
  note("TAG_CREATED", key, "tag", name + " · " + (tagKindMeta(kind)?.label || kind)
    + (budgetPaise ? " · budget " + inr(budgetPaise) : "") + ".");
  await bootFinanceLive(true);
  return { error: "", tagKey: key };
}

/** Super Admin. Existing rows keep the tag; nothing new can be filed under it. */
export async function deactivateTag(key: string): Promise<string> {
  const t = tagOf(key);
  if (!t) return "That tag no longer exists.";
  if (!t.active) return "It is already inactive. (invalid_state_transition)";
  const sa = superAdminOnly("Deactivating a tag"); if (sa) return sa;
  try {
    await call(AdminOpsService.updateExpenseTag(key, { isActive: false }));
  } catch (e) {
    return writeError(e);
  }
  note("TAG_DEACTIVATED", key, "tag", t.label + " takes no new transactions. Every existing row keeps it.");
  await bootFinanceLive(true);
  return "";
}

/** A budget warns and never blocks; null removes it (0 on the server). */
export async function setBudget(key: string, budgetPaise: number | null): Promise<string> {
  const t = tagOf(key);
  if (!t) return "That tag no longer exists.";
  if (budgetPaise !== null && (!Number.isInteger(budgetPaise) || budgetPaise < 0))
    return "A budget is a whole rupee amount, or nothing at all. (validation_failed)";
  try {
    await call(AdminOpsService.updateExpenseTag(key, { budgetPaise: budgetPaise || 0 }));
  } catch (e) {
    return writeError(e);
  }
  note("BUDGET_SET", key, "tag", t.label + " · " + (budgetPaise ? inr(budgetPaise) : "no budget") + ".");
  await bootFinanceLive(true);
  return "";
}

/** FN-T10 · Record a company expense or income. One mandatory tag on a debit,
 *  one mandatory reference. Money IN is restricted to the server's income
 *  kinds. The receipt is mandatory on both. */
export interface TxnInput {
  direction: "out" | "in"; tagKey: string; amountPaise: number;
  /** Who the money went to or came from. Stored on both directions now. */
  description: string; party: string; mode: string; reference: string;
  valueDate: string; accountId: string; creditKind?: string | null;
  /** MANDATORY, on every row, and settable ONLY here. `file` is the picked
   *  file itself: it is uploaded to storage when the row is recorded, and a
   *  name without the bytes behind it records nothing. */
  bill: { filename: string; mime: string; bytes?: number; file?: File };
}

/** The key under the bucket host — what the spend write stores. */
const s3KeyOf = (fileUrl: string) => fileUrl.replace(/^https:\/\/[^/]+\//, "");
/** Straight to S3 with a presigned PUT, then the API is told where it landed —
 *  the Invoices proof upload's route. The bytes never cross the API. */
async function uploadReceipt(file: File): Promise<string> {
  const res = await CommonService.getUploadUrl({
    fileName: file.name, fileType: file.type || "application/octet-stream", for: "PaymentScreenshot",
  });
  if (!res.response) throw new Error(res.message || "Could not get an upload URL.");
  await CommonService.uploadToS3(res.data.uploadUrl, file);
  return res.data.fileUrl;
}
/** The S3 leg throws a plain Error whose text we wrote; the API leg an
 *  AppExceptions whose text is the server's. Anything else is the generic line. */
const writeError = (e: unknown) =>
  (e instanceof AppExceptions ? errMessage(e) : (e instanceof Error && e.message) || errMessage(e));

export async function recordTransaction(input: TxnInput): Promise<{ error: string; txnId: string | null }> {
  const fail = (error: string) => ({ error, txnId: null });
  const out = input.direction === "out";
  const tag = tagOf(input.tagKey);
  if (out && !tag) return fail("Every debit needs a tag — it is what decides where this lands in Analytics.");
  if (out && tag && !tag.active) return fail(tag.label + " is inactive. Pick a live tag.");
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) return fail("The amount must be a whole figure above zero.");
  if (!input.description.trim()) return fail("Say what it was for.");
  if (!input.reference.trim()) return fail("The reference is mandatory — without it this row can never be tied to a statement.");
  if (dupLiveReference(input.reference)) return fail("A record already carries reference " + input.reference.trim() + ". (duplicate_reference)");
  if (!input.valueDate || input.valueDate > liveToday()) return fail("The value date is when the money moved — it cannot be in the future.");
  if (!COMPANY_ACCOUNTS.some((a) => a.active && a.accountId === input.accountId)) return fail("Pick the account.");
  const billName = (input.bill?.filename || "").trim();
  if (!billName)
    return fail("Attach the receipt. A recorded row with no paper behind it is a claim, not a transaction. (bill_required)");
  if (!proofAccepted(input.bill.mime))
    return fail(billName + " is neither an image nor a PDF. A receipt is a photograph of one or a document, and a spreadsheet is neither. (bill_type)");
  if (proofTooBig(input.bill.bytes))
    return fail(billName + " is " + fileSize(input.bill.bytes as number) + ". The limit is " + fileSize(PROOF_MAX_BYTES) + " — a receipt that size is a scan nobody set the resolution on. (bill_too_big)");
  if (!out && !CREDIT_KINDS.some((c) => c.key === input.creditKind))
    return fail("Money in is restricted here to bank interest, an own transfer or a vendor refund. Customer money has exactly one way in: a subscription.");
  if (!input.bill.file) return fail("Pick " + billName + " again — the receipt is uploaded when the row is recorded. (bill_required)");

  let txnId: string;
  try {
    const url = await uploadReceipt(input.bill.file);
    if (out && tag) {
      const row = await call(AdminOpsService.addExpense({
        label: input.description.trim(), amount: input.amountPaise / 100, // the endpoint takes RUPEES
        category: tag.label,
        /* The legacy split the revenue module reads; the tag's own kind is
           what every figure here reads. */
        kind: tag.kind === "reinvestment" ? "reinvestment" : "fixed",
        incurredAt: input.valueDate, tag: tag.tagKey, mode: input.mode, reference: input.reference.trim(),
        party: input.party.trim(),
        account: input.accountId, billUrl: s3KeyOf(url), billName, billMime: input.bill.mime, billBytes: input.bill.bytes,
      })) as { id: number };
      txnId = TXN_OUT + row.id;
    } else {
      const row = await call(AdminOpsService.recordIncome({
        kind: input.creditKind as string, amountPaise: input.amountPaise, description: input.description.trim(),
        party: input.party.trim(), mode: input.mode, reference: input.reference.trim(), valueDate: input.valueDate,
        account: input.accountId, receiptUrl: url, receiptName: billName, receiptMime: input.bill.mime,
        receiptBytes: input.bill.bytes,
      }));
      txnId = TXN_IN + row.id;
    }
  } catch (e) {
    return fail(writeError(e));
  }
  note("TXN_RECORDED", txnId, "transaction",
    (out ? "Paid " : "Received ") + inr(input.amountPaise) + (tag && out ? " · " + tag.label : "") + ".");
  await bootFinanceLive(true);
  return { error: "", txnId };
}

/** FN-T11 · CANCEL A TRANSACTION. Super Admin. One write, one reason: the row
 *  keeps every figure it was posted with and stops counting. It is not a
 *  delete and it is not an edit. */
export async function cancelTransaction(id: string, reason: string): Promise<string> {
  const t = readTransaction(id);
  if (!t) return "That transaction no longer exists.";
  if (t.state === "cancelled") return "It is already cancelled. (invalid_state_transition)";
  if (!reason.trim())
    return "Say why it is being cancelled. A cancellation with no reason is indistinguishable from a mistake at audit. (reason_required)";
  const sa = superAdminOnly("Cancelling a transaction"); if (sa) return sa;
  const spendId = idIn(id, TXN_OUT);
  const incomeId = idIn(id, TXN_IN);
  try {
    if (spendId !== null) await call(AdminOpsService.cancelSpend(spendId, reason.trim()));
    else if (incomeId !== null) await call(AdminOpsService.cancelIncome(incomeId, reason.trim()));
    else return "That transaction no longer exists.";
  } catch (e) {
    return writeError(e);
  }
  note("TXN_CANCELLED", id, "transaction", reason.trim());
  await bootFinanceLive(true);
  return "";
}

/* ----------------------------------------------------------- refunds --- */

/** FN-T12 · Request a refund against a plan purchase. The picker lists the
 *  server's own collected payments (`readPayments`) and the request goes to
 *  `POST refunds/` — the whole payment, since a partial refund would imply a
 *  partly-paid purchase. The amount is not sent: the server refunds what is
 *  left of the payment, which on an untouched one is all of it. */
export async function requestRefund(paymentId: string, ground: string, detail: string):
  Promise<{ error: string; refundId: string | null }> {
  const fail = (error: string) => ({ error, refundId: null });
  const hit = readPayment(paymentId);
  const serverId = planIdOf(paymentId);
  if (!hit || serverId === null) return fail("That payment is not in the ledger.");
  if (refundStanding(paymentId))
    return fail("A refund already stands against this payment. (duplicate_request)");
  if (!REFUND_GROUNDS.some((g) => g.key === ground)) return fail("Pick why the money is going back.");
  let id: number;
  try {
    const row = await call(AdminOpsService.requestRefund({ payment: serverId, ground, detail: detail.trim() }));
    id = row.id;
  } catch (e) {
    return fail(writeError(e));
  }
  note("REFUND_REQUESTED", RF + id, "refund",
    inr(hit.pay.amountPaise) + " against " + paymentId + ". Nothing has moved.");
  await bootFinanceLive(true);
  return { error: "", refundId: RF + id };
}

/** FN-T13 · A refund with no ledger row behind it: a name, an amount and a
 *  ground. The server takes exactly one of a plan payment, a deal payment or a
 *  payee — this is the third — and the amount is mandatory here because there
 *  is nothing to derive it from. */
export async function createManualRefund(payeeName: string, amountPaise: number, ground: string,
  detail: string): Promise<{ error: string; refundId: string | null }> {
  const fail = (error: string) => ({ error, refundId: null });
  const name = payeeName.trim();
  if (!name) return fail("Say who the money is going to. Nothing else on this row names them.");
  if (!Number.isInteger(amountPaise) || amountPaise <= 0)
    return fail("The amount must be a whole figure above zero.");
  if (!REFUND_GROUNDS.some((g) => g.key === ground)) return fail("Pick why the money is going back.");
  let id: number;
  try {
    const row = await call(AdminOpsService.requestRefund({
      payeeName: name, amountPaise, ground, detail: detail.trim(),
    }));
    id = row.id;
  } catch (e) {
    return fail(writeError(e));
  }
  note("REFUND_REQUESTED", RF + id, "refund", inr(amountPaise) + " to " + name + ". Nothing has moved.");
  await bootFinanceLive(true);
  return { error: "", refundId: RF + id };
}

/** FN-T14 · Decide. Super Admin, and never the requester. Approval AUTHORISES
 *  a transfer; it does not make one. Two verdicts, not three. */
export async function decideRefund(id: string, verdict: "approve" | "decline", decisionNote: string): Promise<string> {
  const r = readRefund(id);
  const serverId = idIn(id, RF);
  if (!r || serverId === null) return "That request no longer exists.";
  if (r.state !== "requested") return "This request is already decided. (invalid_state_transition)";
  if (verdict !== "approve" && !decisionNote.trim())
    return "Say what is missing or why it is refused — the requester only sees this note. (reason_required)";
  const sa = superAdminOnly("Deciding a refund"); if (sa) return sa;
  const me = getSession()?.user?.username;
  if (me && me === r.requestedBy)
    return "A refund cannot be approved by the person who requested it. That separation is the whole control. (super_admin_required)";
  try {
    await call(AdminOpsService.decideRefund(serverId, {
      state: verdict === "approve" ? "approved" : "declined", note: decisionNote.trim(),
    }));
  } catch (e) {
    return writeError(e);
  }
  note(verdict === "approve" ? "REFUND_APPROVED" : "REFUND_DECLINED", id, "refund",
    inr(r.amountPaise) + (verdict === "approve" ? " authorised. No money has moved." : " declined — " + decisionNote.trim()));
  await bootFinanceLive(true);
  return "";
}

/** FN-T15 · Record the transfer that actually sends the money. Only now is a
 *  refund `paid`, and only now does the settlement say which of our own
 *  accounts it left. */
export const recordRefundTransfer: (id: string, mode: string, reference: string, accountId: string) => Promise<string> =
  async (id, mode, reference, accountId) => {
  const r = readRefund(id);
  const serverId = idIn(id, RF);
  if (!r || serverId === null) return "That request no longer exists.";
  if (r.state !== "approved") return "Only an approved refund can be paid. (invalid_state_transition)";
  if (!reference.trim()) return "The transfer reference is mandatory — it is the proof the money left. (validation_failed)";
  if (dupLiveReference(reference)) return "A record already carries reference " + reference.trim() + ". (duplicate_reference)";
  try {
    await call(AdminOpsService.settleRefund(serverId, {
      mode, reference: reference.trim(),
      /* Only an account the server listed is named; none is sent otherwise. */
      ...(liveAccount(accountId) ? { account: accountId } : {}),
    }));
  } catch (e) {
    return writeError(e);
  }
  note("REFUND_PAID", id, "refund", inr(r.amountPaise) + " sent · " + reference.trim() + ".");
  await bootFinanceLive(true);
  return "";
}

/* -------------------------------------------------------------- bank --- */

export interface StatementLineInput {
  date: string; direction: "credit" | "debit"; amountPaise: number;
  reference: string; narration: string; counterparty: string;
}
export interface StatementImport {
  accountId: string; from: string; to: string;
  /** The statement file as text, or lines already read out of one. */
  csv?: string; lines?: StatementLineInput[];
}

/** The bank's own CSV, as lines. THE PANEL READS THE FILE, THE SERVER MATCHES
 *  IT: nothing here decides what a line belongs to.
 *  ponytail: CSV with a header row; a bank that exports XLS is saved as CSV
 *  first, and a parser per bank is a library nobody has asked for. */
export function parseStatementCsv(csv: string): { error: string; lines: StatementLineInput[] } {
  const rows = (csv || "").split(/\r?\n/).filter((l) => l.trim());
  if (rows.length < 2) return { error: "That file has no lines under its header.", lines: [] };
  const cells = (line: string) =>
    (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [])
      .map((c) => c.replace(/,$/, "").trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
      .slice(0, -1);
  const head = cells(rows[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const at = (...names: string[]) => head.findIndex((h) => names.some((n) => h.indexOf(n) >= 0));
  const iDate = at("date");
  const iDebit = at("debit", "withdrawal");
  const iCredit = at("credit", "deposit");
  const iAmount = at("amount");
  const iRef = at("reference", "utr", "chq", "cheque");
  const iNarr = at("narration", "description", "particular", "remark");
  const iParty = at("counterparty", "party", "payee");
  const iType = at("type", "drcr");
  if (iDate < 0 || (iDebit < 0 && iCredit < 0 && iAmount < 0))
    return { error: "A statement needs a date column and either debit/credit columns or an amount.", lines: [] };
  const paise = (v: string) => {
    const n = Number((v || "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) : 0;
  };
  const iso = (v: string) => {
    const t = (v || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (!m) return "";
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  };
  const lines: StatementLineInput[] = [];
  for (let i = 1; i < rows.length; i++) {
    const c = cells(rows[i]);
    const date = iso(c[iDate] || "");
    if (!date) return { error: "Line " + i + " has no date this can read (YYYY-MM-DD or DD/MM/YYYY).", lines: [] };
    const debit = iDebit >= 0 ? paise(c[iDebit] || "") : 0;
    const credit = iCredit >= 0 ? paise(c[iCredit] || "") : 0;
    let dir: "credit" | "debit" = debit > 0 ? "debit" : "credit";
    let amountPaise = debit || credit;
    if (!amountPaise && iAmount >= 0) {
      const raw = c[iAmount] || "";
      amountPaise = paise(raw);
      const typed = iType >= 0 ? (c[iType] || "").toLowerCase() : "";
      dir = typed.indexOf("d") === 0 || Number(raw.replace(/[^0-9.-]/g, "")) < 0 ? "debit" : "credit";
    }
    if (!amountPaise) return { error: "Line " + i + " has no amount. A statement line is more than zero.", lines: [] };
    lines.push({
      date, direction: dir, amountPaise,
      reference: iRef >= 0 ? (c[iRef] || "").trim() : "",
      narration: iNarr >= 0 ? (c[iNarr] || "").trim() : "",
      counterparty: iParty >= 0 ? (c[iParty] || "").trim() : "",
    });
  }
  return { error: "", lines };
}

/** FN-T16 · Import one statement window. One open window per account — the
 *  server refuses a second — and every line is matched on the way in by the
 *  server's own rule: same amount, same reference. */
export async function importStatement(input: StatementImport): Promise<{ error: string; summary: string }> {
  const fail = (error: string) => ({ error, summary: "" });
  if (!input || !COMPANY_ACCOUNTS.some((a) => a.active && a.accountId === input.accountId))
    return fail("Pick the account this statement is for.");
  if (!input.from || !input.to || input.to < input.from) return fail("The window ends before it starts.");
  let lines = input.lines || [];
  if (!lines.length) {
    const read = parseStatementCsv(input.csv || "");
    if (read.error) return fail(read.error);
    lines = read.lines;
  }
  if (!lines.length) return fail("A statement with no lines explains nothing.");
  let data: { lines: number; autoMatched: number; toExplain: number };
  try {
    data = await call(AdminOpsService.importBankStatement({
      account: input.accountId, fromDate: input.from, toDate: input.to, lines,
    })) as unknown as { lines: number; autoMatched: number; toExplain: number };
  } catch (e) {
    return fail(writeError(e));
  }
  const summary = data.lines + " line" + (data.lines === 1 ? "" : "s") + " imported · "
    + data.autoMatched + " matched to a record · " + data.toExplain + " to explain.";
  note("IMPORTED", input.accountId, "statement", summary);
  await bootFinanceLive(true);
  return { error: "", summary };
}

export async function resolveException(lineId: string, kind: string, reason: string): Promise<string> {
  const serverId = idIn(lineId, "L-");
  if (serverId === null) return "That statement line does not exist.";
  if (!reason.trim()) return "Both a write-off and a carry-forward need a reason. (reason_required)";
  if (kind === "write_off") { const sa = superAdminOnly("Writing off"); if (sa) return sa; }
  try {
    await call(AdminOpsService.resolveBankLine(serverId, { kind, reason: reason.trim() }));
  } catch (e) {
    return writeError(e);
  }
  note("IMPORTED", lineId, "statement", lineId + " · " + kind.replace("_", " ") + " · " + reason.trim());
  await bootFinanceLive(true);
  return "";
}

/** FN-T17 · Close the window. The server refuses while anything is
 *  unexplained — not a warning and not a confirm. */
export async function closePeriod(stmtId: string): Promise<string> {
  const serverId = idIn(stmtId, "STMT-");
  if (serverId === null) return "That statement no longer exists.";
  const sa = superAdminOnly("Closing a period"); if (sa) return sa;
  try {
    await call(AdminOpsService.closeBankStatement(serverId));
  } catch (e) {
    return writeError(e);
  }
  note("PERIOD_CLOSED", stmtId, "statement", stmtId + " closed.");
  await bootFinanceLive(true);
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
export function useActiveCount(): number { useVersion(); useSubsBoot(); return activeCount(); }
export function useSubRows(): SubRow[] { useVersion(); useSubsBoot(); return subRows(); }
export function useSubTotals(): SubTotals { useVersion(); useSubsBoot(); return subTotals(); }
export function useSubscription(id: string | null): SubRow | null { useVersion(); useSubsBoot(); const s = readSubscription(id); return s ? toSubRow(s) : null; }
export function useInstallmentRows(): InstRow[] { useVersion(); useSubsBoot(); return installmentRows(); }
export function useSalaryRows(): SalaryRow[] { useVersion(); usePayrollBoot(); return salaryRows(); }
export function useSalaryTotals() { useVersion(); usePayrollBoot(); return salaryTotals(); }
export function useSalaryAccount(id: string | null): SalaryRow | null { useVersion(); usePayrollBoot(); const a = readSalaryAccount(id); return a ? toSalaryRow(a) : null; }
export function useRuns(): SalaryRun[] { useVersion(); usePayrollBoot(); return runsNewestFirst(); }
export function useRun(id: string | null): SalaryRun | null { useVersion(); usePayrollBoot(); return readRun(id); }
export function useSlip(id: string | null): { slip: Payslip; run: SalaryRun } | null {
  useVersion(); usePayrollBoot();
  const slip = readSlip(id); const run = id ? runOfSlip(id) : null;
  return slip && run ? { slip, run } : null;
}
/* LIVE hooks: each starts the live load on first mount (deduped). */
export function useTxnRows(): TxnRow[] { useVersion(); useLiveBoot(); return txnRows(); }
export function useTxn(id: string | null): TxnRow | null { useVersion(); useLiveBoot(); const t = readTransaction(id); return t ? toTxnRow(t) : null; }
export function useTags(): Tag[] { useVersion(); useLiveBoot(); return live.tags; }
export function useTagTotals() { useVersion(); useLiveBoot(); return tagTotals(); }
export function useRefundQueue() { useVersion(); useLiveBoot(); return refundQueue(); }
export function useRefund(id: string | null): RefundRow | null { useVersion(); useLiveBoot(); const r = readRefund(id); return r ? toRefundRow(r) : null; }
/** Live on a live section, seed on Subscriptions — see `overview`. */
export function useOverview(): Overview { useVersion(); useLiveBoot(); return overview(); }
export function useOverviewTiles(): Tile[] { useVersion(); useLiveBoot(); return overviewTiles(); }
export function useWaterfall(): WaterfallStep[] { useVersion(); useLiveBoot(); return waterfall(); }
export function useAtRisk(): RiskRow[] { useVersion(); useLiveBoot(); return atRisk(); }
export function useKpis(): Kpi[] { useVersion(); useLiveBoot(); return kpis(); }
export function useMonthPoints(): MonthPoint[] { useVersion(); useLiveBoot(); return monthPoints(); }
export function useReconciliation(stmtId?: string): Recon { useVersion(); useLiveBoot(); return reconciliation(stmtId); }
export function useStatements() { useVersion(); useLiveBoot(); return live.statements; }
export function usePendingImport() { useVersion(); return readPendingImport(); }
export function useMatchedPct() { useVersion(); useLiveBoot(); return matchedPct(); }
export function useTaxSummary() { useVersion(); useLiveBoot(); return taxSummary(); }
export function useActivity(limit = 30) { useVersion(); return snap.activity.slice(0, limit); }

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
/** `September 2026` — the reporting period's label. */
function fmtMonthLong(m: string): string {
  const d = new Date(m + "-01T00:00:00");
  return isNaN(d.getTime()) ? m : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const n = daysBetween(ts(iso.length <= 10 ? iso + "T00:00:00" : iso), clockNow());
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
  active: "Account", month: "Month", started: "Started",
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
  /* The value carries its own grain: a year, a month, or a day. */
  if (key === "started") {
    if (/^\d{4}$/.test(value)) return value;
    if (/^\d{4}-\d{2}$/.test(value)) return fmtMonth(value);
    return fmtDate(value);
  }
  if (key === "tag") return tagOf(value)?.label || value;
  if (key === "kind") return tagKindMeta(value)?.label || value;
  if (key === "state") return txnStateMeta(value)?.label || refundStateMeta(value)?.label || value;
  if (key === "dir") return value === "out" ? "Debit" : "Credit";
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

/** THE REFUND STANDING AGAINST A PAYMENT, if any — requested, approved or paid.
 *  Only `declined` releases a payment. `requestRefund` refuses on this and the
 *  picker hides on it, from one definition, so the list cannot offer a payment
 *  the store then turns down. */
export function refundStanding(paymentId: string): Refund | null {
  return live.refunds.filter((r) => r.paymentId === paymentId && r.state !== "declined")[0] || null;
}
