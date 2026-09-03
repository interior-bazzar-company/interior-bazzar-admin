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

/** WHO BOUGHT IT, and nothing else. `dealRef` was here and is gone (2026-08-31):
 *  a subscription is recorded against an INVOICE, and the invoice already
 *  carries its own `dealRef` back to the deal it came from. Holding a second
 *  copy on the subscription meant the chain could be read two ways and
 *  eventually answer differently — and the field was hand-typed here, so the
 *  copy that disagreed would always be this one. Follow the invoice. */
export interface Customer {
  name: string;
  userId: string | null;
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

/** How the sale happened. Both are recorded the same way; the difference is
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
  /** The invoice this was RECORDED against. The sales chain raises one invoice
   *  per installment, so this is the first of them — the document that says the
   *  customer is now entitled to the plan, and the only thing that says what it
   *  cost. Null only on a historical row recorded before the invoice existed. */
  invoiceNumber: string | null;
  /** True when the whole term was paid in one go rather than split. It is not
   *  derivable from `installments.length === 1` after the fact: a schedule can
   *  be cancelled down to a single surviving row, and that is a different
   *  story about the same subscription. */
  paidInFull: boolean;
  soldBy: string;
  recordedBy: string;
  /** When this was written down. Renamed from `activatedAt` on 2026-08-31,
   *  with the rest of the module's vocabulary: Finance records what happened,
   *  and "activated" implied this screen was the thing that entitled the
   *  customer. The invoice did that. See FN-AD-01. */
  recordedAt: string;
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
  /** WHICH PART OF THE COMPANY the cost belongs to. Typed when the account is
   *  opened, because a designation does not partition into departments by
   *  itself and a mapping invented in analytics code is a taxonomy nobody
   *  agreed to. Analytics groups blank as "Unassigned" rather than guessing. */
  department: string;
  /** How the person is engaged. `permanent` is on the books; `payroll` is paid
   *  through payroll without being permanent. The two are NOT a clean
   *  partition of the world — permanent staff are on payroll too — and the
   *  split is here because the business asked to filter by it, not because it
   *  is a taxonomy this module would have invented. It is a vocabulary in
   *  `vocabularies.json` so a third value is data rather than a code change. */
  engagement: string;
  joinedAt: string;
  monthlyGrossPaise: number;
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  /** Where the money goes. `upi` is optional because not everybody has one
   *  and a blank field is not a missing record. The account number is held
   *  MASKED — the full number is not this module's to keep. */
  bank: { masked: string; ifsc: string; name: string; upi?: string };
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
  /** VARIABLE PAY EARNED IN THIS MONTH — a sales incentive, a delivery bonus,
   *  a festival payout. It sits in its own array rather than merged into
   *  `earnings`, for two reasons that are both load-bearing:
   *
   *  LOSS OF PAY MUST NOT REACH IT. `earnings` is `baseEarnings` pro-rated by
   *  `paidDays`, because salary is paid for time served. An incentive is paid
   *  for something that was achieved, and three days of absence does not
   *  un-close a deal. It is added AFTER the pro-rating and never inside it.
   *
   *  FIXED AND VARIABLE PAY ARE DIFFERENT QUESTIONS. Merged into `earnings` —
   *  which is where the pay dialog used to put it — an incentive becomes
   *  indistinguishable from basic the moment it lands, so nothing downstream
   *  can answer what the company COMMITTED to against what performance ADDED.
   *  Payroll analytics is exactly that question, and it needs the split to be
   *  in the record rather than guessed at afterwards by matching labels.
   *
   *  Optional because a slip issued before incentives were modelled has none,
   *  and an absent array reads as "no incentive was recorded" — which is what
   *  is true — rather than as a zero somebody decided on. */
  incentives?: SalaryComponent[];
  /** Σ `incentives`, stored beside `grossPaise` the way `deductionsPaise` is
   *  stored beside `deductions`, so no reader has to sum an array to learn
   *  what varied this month. */
  incentivePaise?: number;
  deductions: SalaryComponent[];
  /** Σ `earnings` PLUS Σ `incentives` — everything the slip pays out before
   *  deductions. The incentive is INSIDE this figure, not beside it: it is
   *  money the person was actually paid, and a gross that excluded it would
   *  not match the transfer. */
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
  /** How it was paid, in the words a person uses: bank transfer, UPI or cash.
   *  `mode` above is the ledger's own vocabulary (NEFT/UPI/Cash) and stays
   *  what it was; this is the choice somebody actually made. */
  via?: string;
  /** The transfer's evidence. Optional on a slip paid before proofs were asked
   *  for, and MANDATORY when there is no reference — which is what cash is. */
  proof?: Proof | null;
  /** Free text from whoever paid it. Never load-bearing: nothing derives from
   *  a remark, and no total reads one. */
  remark?: string;
  /** A HOLD IS ABOUT A MONTH, NOT A PERSON. A held slip leaves `dueOf` — it is
   *  not owed right now and the pay write skips it — while every other month
   *  the person is owed still pays. Only an UNPAID slip can hold, and the
   *  reason is mandatory because the hold prints nowhere else. */
  held?: boolean;
  heldReason?: string | null;
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

/** Recorded, or cancelled. There is no draft: a row here means the money moved,
 *  and a cancelled one means it moved and was later written off. Nothing is
 *  ever deleted, so there is no third thing a row can be. */
export type TxnState = "recorded" | "cancelled";


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
  /** WHY THIS ROW WAS WRITTEN OFF, who did it and when. Null while `state` is
   *  `recorded`.
   *
   *  Every figure above is untouched by it — the row still says a payment of
   *  that size was made on that date, because it was. What cancelling changes
   *  is whether the row counts, and this block is the record of somebody
   *  deciding that it should not. */
  cancellation: { reason: string; by: string; at: string } | null;
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
  /** Whether up is good. Used for tone, never for a judgement in words.
   *
   *  A third value, `none`, was added here for two payroll metrics that move
   *  for reasons a founder can want either way — and removed with them when the
   *  payroll face was cut back to charts. It is worth restating rather than
   *  rediscovering: a metric with no honest direction should carry `none` and
   *  a neutral tone, never a colour picked to make a chart look decisive. */
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
