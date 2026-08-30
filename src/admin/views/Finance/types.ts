/* =============================================================================
   Finance — the data contract. Four things get recorded and nothing else:

     Subscriptions      a sale, from sales or from the website, paid in
                        installments. The installment is the unit that gets
                        paid — not the subscription, and not a part of one.
     Salaries A/C       what a team member is paid, attached to the real
                        member record, issued as a numbered slip.
     Other Transaction  company money out and in, under a tag the panel can
                        create. Everything that is not a subscription or a
                        salary.
     Refunds            money going back out, whether it came from a
                        subscription payment or was raised by hand.

   THE RULE, unchanged and load-bearing: A ROW IS A FACT. Every record here
   exists because something happened — money moved, a gateway declined, a due
   date passed. No state on this page means "recorded but not yet believed",
   and no type below has a field for one. `fail_to_pay` is not an exception to
   that rule: it records a decline that actually occurred, or a due date that
   actually passed, and it carries the evidence in `failure`.

   INTEGER PAISE everywhere. A rupee never appears as a float.

   This file is types only — no data, no logic, no imports from the store. It
   is written before the seeds and before store.ts so that every one of them
   is talking about the same shapes.
   ============================================================================= */

export type Params = Record<string, string | undefined>;

/* ============================================================ shared === */

export interface FinEvent {
  eventId: string;
  type: string;
  actor: string;
  actorRole: string;
  at: string;
  note: string;
}

export interface Account {
  accountId: string;
  name: string;
  masked: string;
  type: "bank" | "gateway" | "cash";
  openingPaise: number;
  /** false when the money in it is owed to someone else and cannot be spent. */
  unrestricted: boolean;
  active: boolean;
}

export interface Customer {
  name: string;
  userId: string | null;
  dealRef: string | null;
}

/** Numbered, frozen and hashed at issue. Never re-rendered: a receipt
 *  regenerated next year against today's company details would silently
 *  rewrite history. */
export interface Receipt {
  number: string;
  issuedAt: string;
  sha256: string;
}

export interface Proof {
  type: string;
  filename: string;
  uploadedAt: string;
}

/* ===================================================== subscriptions === */

/** How the sale happened. Both are activated the same way; the difference is
 *  who closed it, and it matters for CAC and for channel analytics. */
export type SubSource = "sales" | "website";

/** The four things an installment can be. `due` is the absence of an event,
 *  not a claim about one — nothing has happened to it yet. */
export type InstallmentStatus = "paid" | "due" | "fail_to_pay" | "cancelled";

export type SubscriptionStatus =
  | "active" | "completed" | "defaulting" | "cancelled" | "refunded";

/** The payment that settled one installment. One installment, one payment,
 *  in full — the 1:1 rule at the correct unit. There is no part-payment
 *  field because there is no part-paid installment to record it against. */
export interface InstallmentPayment {
  paymentId: string;
  amountPaise: number;
  mode: string;
  /** UTR / gateway reference. Mandatory and unique across the ledger —
   *  without it nothing can ever be tied back to a bank statement. */
  reference: string;
  valueDate: string;
  accountId: string;
  recordedBy: string;
  recordedAt: string;
  receipt: Receipt | null;
  bankLineId: string | null;
  proof: Proof | null;
}

/** Why an installment reads `fail_to_pay`. This is evidence, not suspicion:
 *  a gateway response, or a due date that passed with nothing against it. */
export interface InstallmentFailure {
  at: string;
  /** `declined` · `insufficient_funds` · `mandate_cancelled` · `overdue` */
  reason: string;
  attempt: number;
  note: string;
}

export interface Installment {
  seq: number;
  of: number;
  dueDate: string;
  amountPaise: number;
  status: InstallmentStatus;
  /** The tax invoice this installment is billed on — the sales chain raises
   *  one invoice per installment (ID-03-R). Null until it is raised. */
  invoiceNumber: string | null;
  payment: InstallmentPayment | null;
  failure: InstallmentFailure | null;
}

export interface Subscription {
  subscriptionId: string;
  source: SubSource;
  customer: Customer;
  planId: string;
  planName: string;
  cycleMonths: number;
  /** The agreed total. Σ installment amounts must equal it exactly. */
  totalPaise: number;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  /** Ordered by `seq`, contiguous from 1, every one carrying the same `of`. */
  installments: Installment[];
  /** The invoice this was ACTIVATED against. The sales chain raises one
   *  invoice per installment, so this is the first of them — the document that
   *  says the customer is now entitled to the plan. Null only on a historical
   *  row activated before the invoice existed. */
  invoiceNumber: string | null;
  soldBy: string;
  activatedBy: string;
  /** When the customer became entitled. Not when somebody typed it in. */
  activatedAt: string;
  events: FinEvent[];
}

/* ========================================================== salaries === */

export interface SalaryComponent {
  key: string;
  label: string;
  amountPaise: number;
}

/** One team member's salary. `memberId` joins `AdminUserRow.id` from the live
 *  Team endpoint — the account is Finance's, the person is Team's, and this
 *  module never invents a member. Amounts are seeded, never derived from a
 *  role: a salary is a contract with a person, not a function of their
 *  permissions. */
export interface SalaryAccount {
  salaryAccountId: string;
  memberId: number;
  memberName: string;
  employeeCode: string;
  designation: string;
  joinedAt: string;
  /** Annual cost to company. Presentational — the slip is built from the
   *  monthly components, never by dividing this by twelve. */
  ctcPaise: number;
  monthlyGrossPaise: number;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  bank: { masked: string; ifsc: string; name: string };
  pan: string;
  uan: string | null;
  active: boolean;
  recordedBy: string;
  recordedAt: string;
  events: FinEvent[];
}

/** A run is being prepared, or it happened. There is no approval state:
 *  paying salaries is not a claim anybody verifies afterwards. */
export type RunState = "open" | "paid";

/** Frozen at issue — the components are copied onto the slip, not read
 *  through to the account, so a raise next month cannot rewrite last
 *  month's slip. */
export interface Payslip {
  slipId: string;
  salaryAccountId: string;
  memberId: number;
  memberName: string;
  employeeCode: string;
  designation: string;
  month: string;
  /** Days actually paid, out of the real length of THIS month — not a
   *  notional 30. A 31-day month with two days lost is 29 of 31. */
  paidDays: number;
  lopDays: number;
  /** The full month's earnings, frozen when the run opened. Loss of pay is
   *  computed FROM these, never from the salary account — a raise granted
   *  after the run opened must not be able to reach back into this slip.
   *  Recomputing from here also makes setting LOP twice idempotent. */
  baseEarnings: SalaryComponent[];
  /** What was actually earned: baseEarnings pro-rated by paidDays. Equal to
   *  baseEarnings when there is no loss of pay. */
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
  paidAt: string | null;
  mode: string;
  reference: string;
  accountId: string;
  bank: { masked: string; ifsc: string; name: string };
  /** Frozen onto the slip, not read live off the account: these two are
   *  printed on the document, and a slip issued last year must still show the
   *  identifiers it was issued with. */
  pan: string;
  uan: string | null;
  issuedAt: string | null;
  sha256: string | null;
}

export interface SalaryRun {
  runId: string;
  month: string;
  state: RunState;
  slips: Payslip[];
  totalNetPaise: number;
  recordedBy: string;
  recordedAt: string;
  paidAt: string | null;
  events: FinEvent[];
}

/* ================================================ other transactions === */

/** What a tag rolls up to in analytics. Chosen when the tag is created and
 *  never guessed — the fixed / reinvestment split behind contribution and CAC
 *  is computed from it. */
export type TagKind = "fixed" | "reinvestment" | "variable" | "excluded";

/** Tags are custom: anyone with edit rights creates one. `custom` marks the
 *  ones made in the panel rather than shipped, so analytics can say where a
 *  bucket came from. A tag is never deleted once used — it is deactivated,
 *  because deleting it would silently re-bucket history. */
export interface Tag {
  tagKey: string;
  label: string;
  kind: TagKind;
  custom: boolean;
  budgetPaise: number | null;
  proofRequired: boolean;
  active: boolean;
  createdBy: string;
  createdAt: string;
}

export type TxnDirection = "out" | "in";

/** Recorded, or reversed by a counter-entry. There is no draft: a row here
 *  means the money moved. */
export type TxnState = "recorded" | "reversed";

export interface CompanyTxn {
  txnId: string;
  direction: TxnDirection;
  tagKey: string;
  amountPaise: number;
  description: string;
  /** Who it was paid to, or received from. */
  party: string;
  mode: string;
  reference: string;
  valueDate: string;
  accountId: string;
  state: TxnState;
  bill: Proof | null;
  bankLineId: string | null;
  /** Money in that is NOT customer revenue — interest, an own transfer, a
   *  vendor refund. Customer money has exactly one way in: a subscription. */
  nonRevenue: boolean;
  creditKind: string | null;
  /** Set on the counter-entry, pointing at the row it reverses. */
  reversesTxnId: string | null;
  reversal: { counterId: string; reason: string; by: string; at: string } | null;
  recordedBy: string;
  recordedAt: string;
  events: FinEvent[];
}

/* =========================================================== refunds === */

/** Where the refund came from. `subscription` is tied to a recorded
 *  installment payment; `manual` is raised by hand and names its own payee —
 *  a duplicate bank transfer, a cancelled order taken off-platform. */
export type RefundOrigin = "subscription" | "manual";

export type RefundState =
  | "requested" | "sent_back" | "approved" | "declined" | "paid";

/** Computed at request time and frozen, so the approver sees what the
 *  requester saw. It frames the approval; it does not block it. */
export interface RefundPolicy {
  groundPermitted: boolean;
  withinWindow: boolean;
  originalRecorded: boolean;
  subscriptionActive: boolean;
}

export interface Refund {
  refundId: string;
  origin: RefundOrigin;
  subscriptionId: string | null;
  /** The installment payment being refunded. Null for a manual refund. */
  paymentId: string | null;
  payee: { name: string; userId: string | null };
  amountPaise: number;
  ground: string;
  detail: string;
  state: RefundState;
  /** Null on a manual refund: there is no original payment to check against,
   *  and an empty check would read as a passed one. */
  policy: RefundPolicy | null;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Filled when the transfer is actually made and recorded. Approval alone
   *  moves no money. */
  settlement: {
    paidAt: string; mode: string; reference: string; accountId: string; by: string;
  } | null;
  events: FinEvent[];
}

/* ========================================================= analytics === */

/** One number on the Overview, with everything a reader needs to trust it. */
export interface Tile {
  key: string;
  label: string;
  paise: number | null;
  n: number | null;
  sub: string;
  tone: "ok" | "warn" | "bad" | "info" | "mute";
  /** null means genuinely not computable — never rendered as zero. */
  unavailable: string | null;
}

/** A decision metric. `value` is null when the inputs do not exist; `why`
 *  then says which input is missing. */
export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  unit: "inr" | "pct" | "count" | "months";
  prior: number | null;
  /** Whether up is good. Used for tone, never for a judgement in words. */
  goodDirection: "up" | "down";
  why: string | null;
  group: string;
}

export interface MonthPoint {
  month: string;
  subscriptionsPaise: number;
  salaryPaise: number;
  otherOutPaise: number;
  otherInPaise: number;
  refundsPaise: number;
  netPaise: number;
  newCustomers: number;
}
