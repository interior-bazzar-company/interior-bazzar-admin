/* =============================================================================
   check:finance — the ledger keeps its guarantees, and the seed proves it.
   -----------------------------------------------------------------------------
   Finance records four things and nothing else: a subscription sale paid in
   installments, a salary, a company expense or income under a tag, a refund.
   A ROW IS A FACT. Nothing here is awaiting a decision, and `fail_to_pay` is
   not the exception it looks like — it records a decline that occurred or a due
   date that demonstrably passed, and it carries the evidence.

   Every label below is a sentence about the business. When one fails, what
   broke should be readable without opening this file.

   Run: npm run check:finance
   (which bundles src/admin/views/Finance/store.ts to
    node_modules/.tmp/finance-store.cjs first, then runs this)
   ============================================================================= */
const S = require("../node_modules/.tmp/finance-store.cjs");

let failed = 0;
let total = 0;
function ok(label, actual, expected) {
  total++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log("  ok   " + label);
  else { failed++; console.log("  FAIL " + label + "\n         expected " + e + "\n         got      " + a); }
}

const sumBy = (l, f) => l.reduce((n, x) => n + f(x), 0);
const money = (l) => sumBy(l, (x) => x.amountPaise);
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const has = (s, bit) => (s || "").indexOf(bit) >= 0;
const inAug = (d) => d.slice(0, 10) >= "2026-08-01" && d.slice(0, 10) <= "2026-08-31";
const allInstallments = () =>
  S.readSubscriptions().flatMap((s) => s.installments.map((i) => ({ s, i })));
const allSlips = () => S.readRuns().flatMap((r) => r.slips.map((p) => ({ r, p })));

/* ========================================================================== */
console.log("\nthe chain — deal → quotation → invoice, empty until the server answers");
S.resetStore();
{
  /* NO SEED DOCUMENTS. A chain is an accepted quotation on a deal the server
     says is this customer's (subscriptions/chains/); until it answers, the
     dialogs' lists are empty and say so. */
  ok("no chain is offered for any customer", S.chainsFor("1041"), []);
  ok("...no invoice is attachable to a customer or to an installment",
    [S.attachableInvoices("1041"), S.attachableForInstallment("SUB-business-12", 1)], [[], []]);
  ok("an invoice number resolves only against invoices the server listed",
    [S.readInvoice(null), S.readInvoice("IB-INV-2026-00088")], [null, null]);
  ok("the user base is empty until the server answers", S.readUsers(), []);
  ok("the seed's quotation and invoice readers and its accounts are gone",
    [typeof S.readQuotations, typeof S.readQuotation, typeof S.readInvoices, typeof S.ACCOUNTS],
    ["undefined", "undefined", "undefined", "undefined"]);
}

/* ==========================================================================
   THE SERVER, FAKED. Every read the store makes is answered here with rows in
   the shape the API returns, so what these sections assert is the adapter and
   the derivations a person actually sees — not a second copy of them written
   for the test. The writes record what was SENT, which is the other half of
   the contract: a write that quietly posts the wrong body is a write nobody
   notices until the ledger is wrong.
   ========================================================================== */
const api = S.AdminOpsService;
const okd = (data) => Promise.resolve({ response: true, code: 200, message: "ok", data });
const refusal = (message) => Promise.resolve({ response: false, code: 400, message, data: { message } });
let sent = [];

const who = (id, name) => ({ id, name, username: "u" + id });
const REF = { key: "NEFT", label: "NEFT", tone: "" };

/* Three people, three accounts — one of them closed, which keeps its slips.
   ONE OF THEM HAS A BREAKDOWN and one does not, because both are real: the
   account carries what the salary is made of since migration 0059, and every
   account opened before it carries the single figure and nothing else. */
const COMPONENTS = [
  { key: "basic", label: "Basic", kind: "earning", amountPaise: 3000000 },
  { key: "hra", label: "House rent allowance", kind: "earning", amountPaise: 1000000 },
  { key: "pf", label: "Provident fund", kind: "deduction", amountPaise: 200000 },
];
/* As the server sends it: masked, every field but the bank's name. */
const PAY_TO = {
  bankName: "HDFC Bank", accountMasked: "**********4021", ifsc: "*******0123",
  upi: "*******hdfc", pan: "******821K", uan: "********4321",
};
const ACCOUNTS = [
  { id: 11, member: who(41, "A. Founder"), employeeCode: "IB-EMP-041", monthlyGrossPaise: 5000000, isActive: true, createdAt: "2024-01-15T11:00:00+05:30" },
  { id: 22, member: who(52, "B. Seller"), employeeCode: "IB-EMP-052", monthlyGrossPaise: 4000000, isActive: true, createdAt: "2025-04-01T11:00:00+05:30",
    components: COMPONENTS, deductionsPaise: 200000, monthlyNetPaise: 3800000, payTo: PAY_TO,
    openedBy: who(41, "A. Founder") },
  { id: 33, member: who(63, "C. Designer"), employeeCode: "IB-EMP-063", monthlyGrossPaise: 3000000, isActive: false, createdAt: "2025-06-01T11:00:00+05:30" },
];
const run = (id, month, state, paidAt) => ({
  id, month, state: { key: state, label: state === "paid" ? "Paid" : "Open", tone: state === "paid" ? "ok" : "info" },
  totalNetPaise: 0, slips: 0, unpaidPeople: 0, owedPaise: 0, paidAt,
  recordedAt: month + "-01T10:00:00+05:30",
});
const RUNS = [
  run(6, "2026-06", "paid", "2026-06-30T18:00:00+05:30"),
  run(7, "2026-07", "paid", "2026-07-31T18:00:00+05:30"),
  run(8, "2026-08", "open", null),
];
const slip = (id, runId, month, acc, paidAt, held) => ({
  id, runId, month, accountId: acc.id, member: acc.member, employeeCode: acc.employeeCode,
  grossPaise: acc.monthlyGrossPaise, deductionsPaise: 200000,
  netPaise: acc.monthlyGrossPaise - 200000,
  paidDays: Number(month.slice(5)) === 6 ? 30 : 31, lopDays: 0,
  paidAt: paidAt || null, held: !!held,
  mode: paidAt ? REF : null, reference: paidAt ? "SAL-" + id : "",
});
const [A, B, C] = ACCOUNTS;
/* The slip's own frozen copy: the lines it was built from and the base loss of
   pay pro-rates against. `basePaise` never moves, which is why applying loss
   of pay twice lands on the same figure. */
const BREAKDOWN = {
  earnings: COMPONENTS.filter((c) => c.kind === "earning"),
  deductions: COMPONENTS.filter((c) => c.kind === "deduction"),
  basePaise: 4000000, incentivePaise: 0, adjustmentPaise: 0, adjustmentReason: "",
  remark: "", issuedAt: null,
};
const JUN = "2026-06-30T18:00:00+05:30";
const JUL = "2026-07-31T18:00:00+05:30";
const SLIPS = [
  /* June: B was not paid — that unpaid month is what "arrears" means. */
  slip(1, 6, "2026-06", A, JUN), slip(2, 6, "2026-06", B, null), slip(3, 6, "2026-06", C, JUN),
  slip(4, 7, "2026-07", A, JUL), slip(5, 7, "2026-07", B, JUL), slip(6, 7, "2026-07", C, JUL),
  /* August is open: one paid, one owed, one held. C is closed and not on it. */
  slip(7, 8, "2026-08", A, "2026-08-25T12:00:00+05:30"), slip(8, 8, "2026-08", B, null),
];
SLIPS.push({ ...slip(9, 8, "2026-08", C, null, true), accountId: 33 });
/* B's August slip carries the breakdown it was built with; A's paid July slip
   carries what was settled WITH the transfer — an incentive, a recovery, the
   remark, the account it left and the receipt. Both are read back, never
   invented. */
Object.assign(SLIPS.filter((s) => s.id === 8)[0], { breakdown: { ...BREAKDOWN } });
Object.assign(SLIPS.filter((s) => s.id === 8)[0], { held: false, heldReason: "" });
Object.assign(SLIPS.filter((s) => s.id === 9)[0], { heldReason: "Disputed LOP, HR checking" });
Object.assign(SLIPS.filter((s) => s.id === 7)[0], {
  netPaise: 5000000 - 200000 + 100000 - 50000,
  breakdown: {
    earnings: [{ key: "monthly_gross", label: "Monthly gross", kind: "earning", amountPaise: 5000000 }],
    deductions: [{ key: "pt", label: "Professional tax", kind: "deduction", amountPaise: 200000 }],
    basePaise: 5000000, incentivePaise: 100000, adjustmentPaise: -50000,
    adjustmentReason: "Advance recovery", remark: "Paid with the July run",
    issuedAt: "2026-08-25T12:00:00+05:30",
  },
  paidFrom: { key: "hdfc_4021", label: "HDFC current", tone: "" },
  receipt: { id: 5, fileName: "receipt.pdf", mimeType: "application/pdf", sizeKb: 90, url: "https://s3.example/receipt.pdf?sig=1" },
});
/* The fixture is mutated by the write sections below (a slip gets paid, one
   gets held), so each of them starts again from the state the reads asserted. */
const PRISTINE = SLIPS.map((s) => ({ ...s }));
const restoreFixture = () => SLIPS.forEach((s, i) => Object.assign(s, PRISTINE[i]));

RUNS.forEach((r) => {
  const mine = SLIPS.filter((s) => s.month === r.month);
  r.slips = mine.length;
  r.totalNetPaise = mine.reduce((n, s) => n + s.netPaise, 0);
  const unpaid = mine.filter((s) => !s.paidAt);
  r.unpaidPeople = unpaid.length;
  r.owedPaise = unpaid.reduce((n, s) => n + s.netPaise, 0);
});

const USERS = [
  { id: 41, username: "u41", role: "", isSuperAdmin: true, isVerified: true, name: "A. Founder", email: "", phone: "", roles: [{ id: 1, name: "Leadership" }], isActive: true },
  { id: 52, username: "u52", role: "", isSuperAdmin: false, isVerified: true, name: "B. Seller", email: "", phone: "", roles: [{ id: 2, name: "Sales" }], isActive: true },
  { id: 63, username: "u63", role: "", isSuperAdmin: false, isVerified: true, name: "C. Designer", email: "", phone: "", roles: [{ id: 3, name: "Design" }], isActive: false },
  { id: 74, username: "u74", role: "", isSuperAdmin: false, isVerified: true, name: "D. Newcomer", email: "", phone: "", roles: [{ id: 2, name: "Sales" }], isActive: true },
];
const SETTINGS = [
  { member: who(41, "A. Founder"), designation: { key: "founder", label: "Founder", tone: "" }, employmentType: { key: "full_time", label: "Full time", tone: "" }, joiningDate: "2024-01-15", dayStartsAt: "10:00", graceMinutes: 0, expectedHoursPerDay: 9, autoCloseAt: "20:00", timezone: "Asia/Kolkata", reportsTo: null, updatedAt: "" },
  { member: who(52, "B. Seller"), designation: { key: "sales_exec", label: "Sales Executive", tone: "" }, employmentType: { key: "contract", label: "Contract", tone: "" }, joiningDate: "2025-04-01", dayStartsAt: "10:00", graceMinutes: 0, expectedHoursPerDay: 9, autoCloseAt: "20:00", timezone: "Asia/Kolkata", reportsTo: null, updatedAt: "" },
  { member: who(63, "C. Designer"), designation: { key: "designer", label: "Designer", tone: "" }, employmentType: { key: "full_time", label: "Full time", tone: "" }, joiningDate: "2025-06-01", dayStartsAt: "10:00", graceMinutes: 0, expectedHoursPerDay: 9, autoCloseAt: "20:00", timezone: "Asia/Kolkata", reportsTo: null, updatedAt: "" },
  { member: who(74, "D. Newcomer"), designation: { key: "sales_exec", label: "Sales Executive", tone: "" }, employmentType: { key: "full_time", label: "Full time", tone: "" }, joiningDate: "2026-08-03", dayStartsAt: "10:00", graceMinutes: 0, expectedHoursPerDay: 9, autoCloseAt: "20:00", timezone: "Asia/Kolkata", reportsTo: null, updatedAt: "" },
];
const EMPLOYMENT = [
  { key: "full_time", label: "Full time", tone: "" },
  { key: "contract", label: "Contract", tone: "" },
];

/* Five plan purchases: bought and paid, bought and not paid for, expired,
   refunded, and a free plan with no transaction behind it at all. */
const SUBS = [
  { id: 12, family: "business", amount: "17700.00", status: "active", isActive: true, user: "u1041", userId: 1041, customer: "Priya Nair", entityName: "Nair Interiors", planId: 3, planTitle: "Starter", durationMonths: 12, buyIntent: "sales", source: "sales", transactionId: "CFORD-A", startedAt: "2026-08-11T10:42:00+05:30", recordedAt: "2026-08-11T10:42:00+05:30", expireDate: "2027-08-10T10:42:00+05:30",
    payment: { orderId: "ORD-A", transactionId: "CFORD-A", amount: "17700.00", orderStatus: "PAID", paymentMethod: "gateway", refundStatus: "", refundAmount: "", createdAt: "2026-08-19T12:00:00+05:30", verifiedAt: "2026-08-19T12:05:00+05:30", refundedAt: null } },
  { id: 5, family: "shop", amount: "9900.00", status: "pending", isActive: false, user: "u1012", userId: 1012, customer: "Desai Interiors", entityName: "Desai Shop", planId: 4, planTitle: "Shop Growth", durationMonths: 3, buyIntent: "website", source: "website", transactionId: "CFORD-B", startedAt: "2026-08-20T09:00:00+05:30", recordedAt: "2026-08-20T09:00:00+05:30", expireDate: null,
    payment: { orderId: "ORD-B", transactionId: "CFORD-B", amount: "9900.00", orderStatus: "SUBMITTED", paymentMethod: "manual", refundStatus: "", refundAmount: "", createdAt: "2026-08-20T09:00:00+05:30", verifiedAt: null, refundedAt: null } },
  { id: 2, family: "architect", amount: "4999.00", status: "expired", isActive: false, user: "u1201", userId: 1201, customer: "Iyer Woodworks", entityName: null, planId: 5, planTitle: "Architect Basic", durationMonths: 1, buyIntent: "website", source: "website", transactionId: "CFORD-C", startedAt: "2025-11-02T09:00:00+05:30", recordedAt: "2025-11-02T09:00:00+05:30", expireDate: "2025-12-02T09:00:00+05:30",
    payment: { orderId: "ORD-C", transactionId: "CFORD-C", amount: "4999.00", orderStatus: "PAID", paymentMethod: "gateway", refundStatus: "", refundAmount: "", createdAt: "2025-11-02T09:00:00+05:30", verifiedAt: "2025-11-02T09:05:00+05:30", refundedAt: null } },
  { id: 9, family: "business", amount: "5000.00", status: "refunded", isActive: false, user: "u0944", userId: 944, customer: "Kulkarni Living", entityName: "Kulkarni Living", planId: 3, planTitle: "Starter", durationMonths: 6, buyIntent: "Sales", source: "sales", transactionId: "CFORD-D", startedAt: "2026-08-02T09:00:00+05:30", recordedAt: "2026-08-02T09:00:00+05:30", expireDate: "2027-02-02T09:00:00+05:30",
    payment: { orderId: "ORD-D", transactionId: "CFORD-D", amount: "5000.00", orderStatus: "REFUNDED", paymentMethod: "gateway", refundStatus: "REFUNDED", refundAmount: "5000.00", createdAt: "2026-08-05T09:00:00+05:30", verifiedAt: "2026-08-05T09:10:00+05:30", refundedAt: "2026-08-28T09:00:00+05:30" } },
  { id: 1, family: "automation", amount: "0.00", status: "active", isActive: true, user: "u1041", userId: 1041, customer: "Priya Nair", entityName: null, planId: 6, planTitle: "Free Forever", durationMonths: 1, buyIntent: "website", source: "website", transactionId: "", startedAt: "2026-07-01T09:00:00+05:30", recordedAt: "2026-07-01T09:00:00+05:30", expireDate: "2026-08-01T09:00:00+05:30", payment: null },
];
/* A SALE (migration 0063): a subscription over an accepted QUOTATION, its
   schedule the quotation's own rows — one paid through the deal ledger, one
   failed, one due — and the chains it is recorded from. Served only inside the
   block that reads them, so every other figure here stays the purchases'. */
const QUOTE_90 = { id: 90, quotationNumber: "IB-QT-2026-00090", dealRef: "DL-2601", planName: "Growth Annual",
  termMonths: 12, installments: 3, installmentGapMonths: 1, grandTotalPaise: 3000000, quotationDate: "2026-06-01" };
const saleRow = (seq, status, extra) => Object.assign({ id: seq, seq, count: 3, amountPaise: 1000000,
  dueDate: "2026-0" + (5 + seq) + "-01", status, invoiceNumber: null, paidAt: null, failedAt: null,
  failureReason: null, failureNote: "", payment: null }, extra || {});
const chainInv = (id, number, carriesSeq, grandTotalPaise, dealRef, quotationNumber) => ({
  id, invoiceNumber: number, status: "issued", quotationNumber, dealRef, billingName: "Priya Nair",
  description: "Growth Annual", placeOfSupply: "Delhi", invoiceDate: "2026-06-02", dueDate: "2026-06-02",
  paymentDate: "2026-06-02", taxablePaise: grandTotalPaise, grandTotalPaise, carriesSeq });
/* The COMMITMENT over one of them: where it stands, whether it renews, who
   sold it. A purchase nobody has recorded one against carries null, which is
   what every purchase carried before migration 0059. */
const COMMITMENT = {
  id: 501, family: "business", purchaseId: 12, userId: 1041,
  state: { key: "active", label: "Active", tone: "ok" }, cycleMonths: 12,
  startedOn: "2026-08-11", renewsOn: "2027-08-10", cancelledAt: null, cancelReason: "",
  soldBy: { id: 52, username: "u52" }, recordedBy: { id: 41, username: "u41" },
  recordedAt: "2026-08-11T10:42:00+05:30", updatedAt: "2026-08-11T10:42:00+05:30",
};
const SALE = {
  id: 610, family: null, purchaseId: null, userId: 1041, customer: "Priya Nair",
  state: { key: "active", label: "Active", tone: "ok" }, cycleMonths: 12,
  startedOn: "2026-06-01", renewsOn: "2027-06-01", cancelledAt: null, cancelReason: "",
  soldBy: { id: 52, username: "u52" }, recordedBy: { id: 41, username: "u41" },
  recordedAt: "2026-06-02T10:00:00+05:30", updatedAt: "2026-06-02T10:00:00+05:30", failure: null,
  quotation: QUOTE_90,
  installments: [
    saleRow(1, "paid", { invoiceNumber: "IB-INV-2026-00091", paidAt: "2026-06-02T10:00:00+05:30",
      payment: { id: 55, amountPaise: 1000000, mode: "NEFT", reference: "UTR-55", paymentDate: "2026-06-02",
        recordedBy: "u52", recordedAt: "2026-06-02T10:00:00+05:30" } }),
    saleRow(2, "failed", { failedAt: "2026-07-02T00:00:00+05:30", failureReason: "overdue" }),
    saleRow(3, "due"),
  ],
};
const CHAINS = [
  { userId: 1041, subscriptionId: 610, quotation: QUOTE_90, invoices: [
    chainInv(91, "IB-INV-2026-00091", 1, 1000000, "DL-2601", "IB-QT-2026-00090"),
    chainInv(92, "IB-INV-2026-00092", null, 1000000, "DL-2601", "IB-QT-2026-00090"),
    chainInv(93, "IB-INV-2026-00093", null, 1200000, "DL-2601", "IB-QT-2026-00090")] },
  { userId: 1012, subscriptionId: null,
    quotation: { id: 95, quotationNumber: "IB-QT-2026-00095", dealRef: "DL-2602", planName: "Shop Growth",
      termMonths: 3, installments: 1, installmentGapMonths: 1, grandTotalPaise: 990000, quotationDate: "2026-08-10" },
    invoices: [chainInv(96, "IB-INV-2026-00096", 1, 990000, "DL-2602", "IB-QT-2026-00095")] },
];
SUBS.forEach((x) => { x.subscription = null; });
SUBS.filter((x) => x.family === "business" && x.id === 12)[0].subscription = COMMITMENT;

const auditRow = (id, module, action, label, subjectType, subjectId, detail) => ({
  id, actor: "u41", actorName: "A. Founder", role: "Leadership", action, label,
  verb: "changed", destructive: false, module, detail, ts: "2026-08-25T12:00:00+05:30",
  subjectUser: null, subjectUsername: null, subjectName: "", synthetic: false,
  subjectType, subjectId,
});
const AUDIT = {
  "finance-salaries": [
    auditRow(91, "finance-salaries", "salary_account_revised", "Salary account revised",
      "salary_account", "22", "account=22 paise=4000000"),
    auditRow(92, "finance-salaries", "salary_run_built", "Salary run built",
      "salary_run", "8", "run=8 month=2026-08 slips=3"),
    /* A row about no record at all — it belongs to no tab and is dropped. */
    auditRow(93, "finance-salaries", "salary_account_opened", "Salary account opened", "", "", "x"),
  ],
  subs: [auditRow(94, "subs", "subscription_recorded", "Subscription recorded",
    "subscription", "501", "subscription=501 business=12 state=active")],
};

/* The letterhead as the server sends it — five fields, gstin "" while unregistered. */
const COMPANY_ROW = { brand: "Interior bazzar", name: "FEELSAFE TECHNOLOGY INDIA PRIVATE LIMITED",
  address: "New Delhi", cin: "U62090DL2024PTC434514", gstin: "" };

/* The value lists every section reads, as vocab/<name>/ serves them: ROWS for
   the payment modes, the failure reasons and the subscription states; CODE
   LISTS — served from the code that enforces them — for the tag kinds, the
   subscription sources and the refund origins. One retired mode, because a
   picker must not offer a mode the server refuses. */
const vrow = (key, label, tone, hint, extra) =>
  Object.assign({ key, label, tone: tone || "", hint: hint || "", isActive: true }, extra || {});
const SERVED_LISTS = {
  "payment-modes": ["NEFT", "RTGS", "IMPS", "UPI", "Card", "Netbanking", "Cash"].map((m) => vrow(m, m))
    .concat([vrow("Cheque", "Cheque", "", "", { isActive: false })]),
  "installment-failure-reasons": [
    vrow("declined", "Declined by the bank", "", "The gateway returned a decline."),
    vrow("overdue", "Due date passed", "", "No payment and the due date has gone."),
  ],
  "subscription-states": [
    vrow("active", "Active", "ok", "Running, with installments still to come."),
    vrow("completed", "Completed", "info", "Every installment paid and the term served."),
    vrow("defaulting", "Defaulting", "bad", "At least one installment failed and has not been recovered. The money is not coming on its own."),
    vrow("cancelled", "Cancelled", "mute", "Ended early. Remaining installments are cancelled, not written off."),
    vrow("refunded", "Refunded", "warn", "Money paid on it has gone back out. The counter-entries are on the record."),
    vrow("pending", "Pending", "warn", "Bought and not paid for yet. The plan is held; nothing has been collected against it."),
    vrow("expired", "Expired", "mute", "The term ran out. The customer has to buy again to keep the plan."),
  ],
  "expense-tag-kinds": [
    vrow("fixed", "Fixed", "", "Runs whether or not anything is sold: rent, tools, utilities.", { landsIn: "Net line on Analytics" }),
    vrow("reinvestment", "Reinvestment", "", "Spend that buys customers.", { landsIn: "Net line AND CAC" }),
    vrow("variable", "Variable", "", "Scales with delivery.", { landsIn: "Net line only" }),
    vrow("excluded", "Excluded", "", "Taxes and statutory payments.", { landsIn: "Cash out, not an operating cost" }),
  ],
  "subscription-sources": [
    vrow("sales", "Sales", "", "A salesperson closed it on a deal.", { short: "SALES" }),
    vrow("website", "Website", "", "The customer bought it themselves.", { short: "WEB" }),
  ],
  "refund-origins": [
    vrow("subscription", "Against a subscription", "", "Tied to a recorded installment payment."),
    vrow("deal_payment", "Against a deal payment", "", "Tied to a payment recorded on a deal."),
    vrow("manual", "Raised by hand", "", "No ledger row to reverse."),
  ],
  "installment-statuses": [vrow("due", "Due", "mute", "Nothing has happened to it yet"), vrow("paid", "Paid", "ok"),
    vrow("failed", "Failed", "bad"), vrow("cancelled", "Cancelled", "mute")],
  "salary-run-states": [vrow("open", "Open", "warn"), vrow("paid", "Paid", "ok")],
};
/* The module's words, as finance/vocabularies/ serves them: a formula and a
   caution for every figure the store computes, the slip rule, the decisions. */
const KPI_KEYS = ["mrr", "arpu", "collection_rate", "fail_rate", "salary_ratio", "cost_per_head", "burn",
  "net_margin", "refund_rate", "runway", "new_customers", "cac", "website_share"];
const def = (key, extra) => Object.assign({ key, label: key, unit: "inr", formula: "f", caution: "c" }, extra || {});
const FINANCE_WORDS = {
  slipRule: "A slip freezes its own earnings and deductions.",
  eventTypes: [{ key: "TXN_RECORDED", label: "Transaction recorded", tone: "ok" }],
  metricDefinitions: ["collected", "salary_cost", "other_out", "other_in", "refunds_out", "refunds_owed", "net",
    "due_next", "failed", "matched"].map((k) => def(k)),
  kpiDefinitions: KPI_KEYS.map((k) => def(k, { group: "Revenue", goodDirection: "up" })),
  payrollMetricDefinitions: [def("payroll_cost")],
  openDecisions: [{ id: "FN-OD-07", title: "Runway is not shown", position: "It returns null.", status: "open" }],
};

function serveReads() {
  api.serverTime = () => okd({ serverNow: "2026-08-25T12:00:00+05:30", epochMs: Date.parse("2026-08-25T12:00:00+05:30"), loginTime: null });
  api.salaries = () => okd({ runs: RUNS, total: RUNS.length, paidInPeriod: { runs: 0, slips: 0, paise: 0 }, openRun: RUNS[2], owed: { paise: 0, people: 0 } });
  api.salaryAccounts = () => okd({ accounts: ACCOUNTS });
  api.payslips = () => okd({ slips: SLIPS, total: SLIPS.length });
  api.users = () => okd(USERS);
  api.attendanceSettings = () => okd({ settings: SETTINGS });
  api.vocab = (name) => okd({ items: name === "employment-types" ? EMPLOYMENT
    : name === "company-accounts" ? [{ key: "hdfc_4021", label: "HDFC current", tone: "", hint: "xxxx 4021", isActive: true }]
    : SERVED_LISTS[name] || [] });
  api.company = () => okd(COMPANY_ROW);
  api.financeVocabularies = () => okd(FINANCE_WORDS);
  /* THE AUDIT TRAIL IS THE HISTORY. There is no events table: every write
     files its line under the record it was about, and a History tab is that
     trail read back by subject. */
  api.audit = (p) => okd({ entries: (AUDIT[p.module] || []), total: (AUDIT[p.module] || []).length,
    pageNo: 1, pageSize: p.pageSize || 50, facets: {} });
  api.subs = (p) => okd({
    subs: (p.pageNo || 1) === 1 ? SUBS : [], total: SUBS.length,
    pageNo: p.pageNo || 1, pageSize: p.pageSize || 100, family: "all",
    analytics: { activeCount: 2, expiredCount: 1, pendingCount: 1, totalCount: 5, revenue: 22700 },
  });
  serveSales([], []);
}
/** The commitments list and the chains, as subscriptions/ and subscriptions/chains/ answer. */
function serveSales(sales, chains) {
  api.subscriptions = (p) => okd({ subscriptions: (p.pageNo || 1) === 1 ? sales : [], total: sales.length,
    pageNo: p.pageNo || 1, pageSize: p.pageSize || 200 });
  api.subscriptionChains = () => okd({ chains });
}

async function payrollAndSubs() {
  serveReads();
  await S.bootPayroll(true);
  await S.bootSubs(true);

  /* ======================================================================== */
  console.log("\npayroll — the account, the run and the slip, as the server answers them");
  {
    ok("the letterhead is the server's five fields, filled in place",
      Object.assign({}, S.COMPANY), COMPANY_ROW);
    ok("...and the company's accounts are the server's, read with the payroll",
      S.payFromAccounts().map((a) => [a.accountId, S.accountOf(a.accountId).masked]), [["hdfc_4021", "xxxx 4021"]]);
    ok("the value lists are the server's, filled in place with the same read",
      [S.MODES, S.SUB_STATUSES.map((s) => s.key), S.TAG_KINDS.map((k) => k.key),
        S.SUB_SOURCES.map((s) => s.key), S.REFUND_ORIGINS.map((o) => o.key), S.FAILURE_REASONS.map((r) => r.key)],
      [["NEFT", "RTGS", "IMPS", "UPI", "Card", "Netbanking", "Cash"],
        ["active", "completed", "defaulting", "cancelled", "refunded", "pending", "expired"],
        ["fixed", "reinvestment", "variable", "excluded"], ["sales", "website"],
        ["subscription", "deal_payment", "manual"], ["declined", "overdue"]]);
    ok("...a retired payment mode is not offered, because the server refuses it", S.MODES.indexOf("Cheque"), -1);
    ok("...and so are the module's words: statuses, run states, the slip rule, decisions, log labels",
      [S.INSTALLMENT_STATUSES.map((s) => s.key), S.RUN_STATES.map((s) => s.key), S.instStatusMeta("due").meaning,
        S.SLIP_RULE, S.decision("FN-OD-07").position, S.eventMeta("TXN_RECORDED").label],
      [["due", "paid", "failed", "cancelled"], ["open", "paid"], "Nothing has happened to it yet",
        FINANCE_WORDS.slipRule, "It returns null.", "Transaction recorded"]);
    ok("every KPI is one the served vocabulary defines, and the whole set is returned",
      S.kpis().map((x) => [x.key, !!S.kpiMeta(x.key)]), KPI_KEYS.map((k) => [k, true]));
    ok("...a row's hint is what the panel calls its meaning, help or kind note",
      [S.subStatusMeta("pending").meaning, S.failureMeta("overdue").help,
        S.tagKindMeta("reinvestment").landsIn, S.sourceMeta("website").short],
      ["Bought and not paid for yet. The plan is held; nothing has been collected against it.",
        "No payment and the due date has gone.", "Net line AND CAC", "WEB"]);
    ok("the refund policy is unread until the refunds read answers — no window is assumed",
      Number.isNaN(S.REFUND_POLICY.windowDays), true);
    ok("the module rule and the role sentences are gone with the keys they read",
      [typeof S.MODULE_RULE, typeof S.ROLES], ["undefined", "undefined"]);
    ok("a session write is stamped on the server's clock once it has answered",
      S.stamp().slice(0, 10), "2026-08-25");
    ok("every account the server sent is on the list, closed ones included",
      S.readSalaryAccounts().map((a) => a.salaryAccountId).sort(),
      ["SAL-AC-11", "SAL-AC-22", "SAL-AC-33"]);
    const a = S.readSalaryAccount("SAL-AC-11");
    ok("an account is joined to the PERSON, off the live roster",
      [a.memberId, a.memberName, a.designation, a.department],
      [41, "A. Founder", "Founder", "Leadership"]);
    ok("...and to the day they joined, which is the member's record and not Finance's",
      a.joinedAt, "2024-01-15");
    ok("...its engagement is the server's employment type, not a word this panel invented",
      [a.engagement, S.engagementMeta(a.engagement).label], ["full_time", "Full time"]);
    ok("the engagement list IS the server's — an unread list is empty, never two invented keys",
      S.ENGAGEMENTS.map((e) => e.key), ["full_time", "contract"]);

    /* WHAT THE RECORD DOES NOT HOLD READS AS ABSENT. The account carries one
       figure — the monthly gross — so that is the one earning line, and there
       are no standing deductions, no bank account, no PAN and no UAN. */
    ok("the monthly gross is the account's one earning line",
      a.earnings.map((e) => [e.key, e.amountPaise]), [["monthly_gross", 5000000]]);
    ok("...and it is exactly what the account says it is", S.money(a.earnings), a.monthlyGrossPaise);
    ok("an account with no breakdown invents none: no deductions, no bank, no PAN, no UAN",
      [a.deductions.length, a.bank.masked, a.bank.ifsc, a.pan, a.uan], [0, "", "", "", null]);
    ok("...so the monthly net is the gross itself",
      S.toSalaryRow(a).monthlyNetPaise, a.monthlyGrossPaise);

    /* THE OTHER ACCOUNT HAS A BREAKDOWN, and net is gross minus what comes off
       it every month — the same arithmetic the run does when it builds a slip. */
    const withParts = S.readSalaryAccount("SAL-AC-22");
    ok("a salary that IS split reads back as its lines",
      withParts.earnings.map((e) => [e.key, e.amountPaise]),
      [["basic", 3000000], ["hra", 1000000]]);
    ok("...its standing deductions are their own side of the list",
      withParts.deductions.map((d) => [d.key, d.amountPaise]), [["pf", 200000]]);
    ok("...and net is gross MINUS them, never the gross itself",
      [S.money(withParts.earnings), S.toSalaryRow(withParts).monthlyNetPaise], [4000000, 3800000]);
    /* WHERE THE SALARY IS SENT ARRIVES MASKED and is never unmasked here. */
    ok("the bank, the PAN and the UAN are the server's masked values, printed as they came",
      [withParts.bank.name, withParts.bank.masked, withParts.pan, withParts.uan],
      ["HDFC Bank", "**********4021", "******821K", "********4321"]);
    ok("...and nothing in the panel holds a whole account number",
      JSON.stringify(withParts).indexOf("50100123454021") >= 0, false);

    ok("every run the server sent is here, newest month first",
      S.runsNewestFirst().map((r) => r.month), ["2026-08", "2026-07", "2026-06"]);
    ok("...and exactly one of them is open", S.openRun().runId, "RUN-2026-08");
    ok("a run's total is the sum of its slips' net",
      S.readRuns().filter((r) => r.totalNetPaise !== sumBy(r.slips, (s) => s.netPaise)).map((r) => r.runId), []);
    ok("every slip belongs to a salary account that exists",
      allSlips().filter((x) => !S.readSalaryAccount(x.p.salaryAccountId)).map((x) => x.p.slipId), []);
    ok("every slip names the month its run is for",
      allSlips().filter((x) => x.p.month !== x.r.month).map((x) => x.p.slipId), []);
    ok("net is gross minus deductions, never CTC divided by twelve",
      allSlips().filter((x) => x.p.netPaise !== x.p.grossPaise - x.p.deductionsPaise).map((x) => x.p.slipId), []);
    /* THE DOCUMENT'S OWN ARITHMETIC HAS TO LAND ON THE TRANSFER. Slip.tsx sums
       the slip's LINES rather than trusting the totals beside them, which is
       right -- and left a slip whose breakdown was never written (everything
       not built by BuildRun: six of the eight below) summing an EMPTY
       deductions array to zero and printing the gross as NET PAY. A ₹52,000
       slip against a ₹45,760 transfer, with the 12% appearing under no name.
       Every slip's lines now reconcile to the net the server computed. */
    ok("a slip with no frozen deduction lines still shows what came off it",
      allSlips().map((x) => S.readSlip(x.p.slipId))
        .filter((s) => money(s.earnings) + money(s.incentives || []) - money(s.deductions) !== s.netPaise)
        .map((s) => s.slipId), []);
    ok("paid days and loss of pay account for every day of the month the slip is for",
      allSlips().filter((x) => x.p.paidDays + x.p.lopDays !== S.daysInMonth(x.p.month)).map((x) => x.p.slipId), []);
    ok("a slip issued to a closed account stays on the record",
      S.slipsOf("SAL-AC-33").map((s) => s.month), ["2026-08", "2026-07", "2026-06"]);
    ok("the open run is PART paid, which is the ordinary mid-month state",
      [S.readRun("RUN-2026-08").slips.some((s) => s.paidAt),
        S.readRun("RUN-2026-08").slips.some((s) => !s.paidAt)], [true, true]);
    ok("a paid slip carries how it was paid, in both vocabularies",
      (() => { const s = S.readSlip("SLIP-7"); return [s.mode, s.via]; })(), ["NEFT", "bank"]);
    /* WHAT WAS SETTLED WITH THE TRANSFER sits beside the salary, never inside
       it: an incentive is paid for something achieved, and a one-off recovery
       corrects one month. Both are read off the slip's own frozen breakdown. */
    const paidSlip = S.readSlip("SLIP-7");
    ok("an incentive settled with the payment is its own line, not part of basic",
      paidSlip.incentives.map((i) => [i.key, i.amountPaise]), [["incentive", 100000]]);
    ok("...a negative adjustment is a deduction carrying the reason as its label",
      paidSlip.deductions.map((d) => [d.label, d.amountPaise]),
      [["Professional tax", 200000], ["Advance recovery", 50000]]);
    ok("...and gross minus deductions is still exactly what was paid",
      [paidSlip.grossPaise - paidSlip.deductionsPaise, paidSlip.netPaise], [4850000, 4850000]);
    ok("the account it was paid FROM is on the slip", paidSlip.accountId, "hdfc_4021");
    ok("...with the remark and the day it was issued",
      [paidSlip.remark, paidSlip.issuedAt], ["Paid with the July run", "2026-08-25T12:00:00+05:30"]);
    ok("...and the receipt is a real file, read back as a link somebody can open",
      [paidSlip.proof.filename, paidSlip.proof.type, !!paidSlip.proof.url],
      ["receipt.pdf", "application/pdf", true]);
    ok("a HELD slip prints why it is held, off the audit trail",
      S.readSlip("SLIP-9").heldReason, "Disputed LOP, HR checking");
    ok("...and a slip nobody held has no reason to print", S.readSlip("SLIP-8").heldReason, null);
    ok("a slip with a breakdown is its own lines, and its base is the full month",
      [S.readSlip("SLIP-8").baseEarnings.map((e) => e.key),
        S.money(S.readSlip("SLIP-8").baseEarnings)], [["basic", "hra"], 4000000]);
    ok("...and an unpaid one is not a document yet — no issue date and no hash",
      (() => { const s = S.readSlip("SLIP-8"); return [s.issuedAt, s.sha256, s.paidAt]; })(), [null, null, null]);

    /* WHAT SOMEBODY IS OWED is every unpaid slip they have, held ones out. */
    const bRow = S.toSalaryRow(S.readSalaryAccount("SAL-AC-22"));
    const due = S.dueOf(bRow);
    ok("B is owed two months, not one", due.unpaid.map((s) => s.month), ["2026-08", "2026-06"]);
    ok("...the newest is the current one, the older one is arrears",
      [due.current.month, due.arrears.map((s) => s.month)], ["2026-08", ["2026-06"]]);
    ok("...and what is due is arrears PLUS the current month",
      due.pendingPaise, due.arrearsPaise + due.currentPaise);
    const cDue = S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-33")));
    ok("a HELD month is not owed — it leaves the figure until somebody releases it",
      [cDue.pendingPaise, S.readSlip("SLIP-9").held], [0, true]);
    ok("...and the person reads as paid, because nothing of theirs is outstanding",
      cDue.state, "paid");
    ok("somebody with every month paid is owed nothing",
      S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-11"))).pendingPaise, 0);

    const totals = S.salaryTotals();
    ok("the topbar's unpaid figure is the same derivation the rows read",
      [totals.unpaidPeople, totals.unpaidPaise], [1, due.pendingPaise]);
    ok("...and what was paid all time is Σ the paid slips themselves",
      totals.paidAllPaise, sumBy(allSlips().filter((x) => x.p.paidAt), (x) => x.p.netPaise));
    ok("the filters read the same `dueOf` the table does",
      [S.applySalaryFilters(S.salaryRows(), { due: "unpaid" }).map((r) => r.a.salaryAccountId),
        S.applySalaryFilters(S.salaryRows(), { due: "arrears" }).map((r) => r.a.salaryAccountId),
        S.applySalaryFilters(S.salaryRows(), { active: "no" }).map((r) => r.a.salaryAccountId)],
      [["SAL-AC-22"], ["SAL-AC-22"], ["SAL-AC-33"]]);

    /* THE PICKER IS THE LIVE ROSTER, and it knows who already has an account. */
    const opts = S.salaryMemberOptions();
    ok("the picker offers the active roster, not a bundled cast",
      opts.map((o) => o.memberId).sort(), [41, 52, 74]);
    ok("...each carrying the four fields the form no longer asks for",
      opts.every((o) => o.memberId && o.name && o.designation && o.employeeCode), true);
    ok("...with the department off the member's own roles",
      opts.filter((o) => o.memberId === 52).map((o) => o.department), ["Sales"]);
    ok("...and it knows who already has an account",
      opts.filter((o) => !o.taken).map((o) => o.memberId), [74]);
    ok("the employee code is DERIVED from the member id, not typed",
      [S.employeeCodeOf("41"), S.employeeCodeOf(41)], ["IB-EMP-041", "IB-EMP-041"]);

    /* THE HISTORY TAB IS THE AUDIT TRAIL, filtered by subject — there is no
       events table and a second copy of the trail is what one would be. */
    ok("an account's history is the trail's rows about that account",
      S.readSalaryAccount("SAL-AC-22").events.map((e) => [e.type, e.note]),
      [["Salary account revised", "account=22 paise=4000000"]]);
    ok("...and an account nothing has happened to has an empty one, not somebody else's",
      S.readSalaryAccount("SAL-AC-11").events.length, 0);
    ok("a run's history is its own rows", S.readRun("RUN-2026-08").events.map((e) => e.type),
      ["Salary run built"]);
    ok("...and a trail row about no record at all belongs to no tab",
      S.readRuns().concat().reduce((n, r) => n + r.events.length, 0)
      + S.readSalaryAccounts().reduce((n, a) => n + a.events.length, 0), 2);
  }

  /* ======================================================================== */
  console.log("\npayroll analytics — a year of runs, read off the slips");
  {
    const y = S.payrollYear("2026");
    ok("the year is always twelve months, run or not", y.months.length, 12);
    ok("...and only three of them have a run", y.totals.monthsRun, 3);
    ok("paid, unpaid and held partition the year's net exactly",
      y.totals.paidPaise + y.totals.unpaidPaise + y.totals.heldPaise, y.totals.netPaise);
    ok("...the held month is its own figure, never folded into arrears",
      y.totals.heldPaise, S.readSlip("SLIP-9").netPaise);
    ok("the year's paid figure is Σ the slips actually paid",
      y.totals.paidPaise, sumBy(allSlips().filter((x) => x.p.paidAt && x.p.month.startsWith("2026")), (x) => x.p.netPaise));
    ok("a month that has not started is told apart from one nobody ran",
      [y.months.filter((m) => m.month === "2026-09")[0].started,
        y.months.filter((m) => m.month === "2026-05")[0].started], [false, true]);
    ok("what was earned on top is counted as its own figure, never folded into salary",
      y.totals.incentivePaise, S.incentiveOf(S.readSlip("SLIP-7")));

    const dept = S.departmentYear("2026");
    ok("every department paid in the year appears, and no other",
      dept.map((d) => d.department).sort(), ["Design", "Leadership", "Sales"]);
    ok("...and their sum is exactly that year's paid figure",
      dept.reduce((n, d) => n + d.paidPaise, 0), y.totals.paidPaise);
    ok("sorted largest first",
      dept.every((d, i) => i === 0 || d.paidPaise <= dept[i - 1].paidPaise), true);

    const people = S.employeeTotals("2026");
    ok("one row per person paid in the year", people.map((p) => p.salaryAccountId).sort(),
      ["SAL-AC-11", "SAL-AC-22", "SAL-AC-33"]);
    ok("...and the whole year's gross is theirs added up",
      people.reduce((n, p) => n + p.grossPaise, 0),
      sumBy(allSlips().filter((x) => x.p.paidAt && x.p.month.startsWith("2026")), (x) => x.p.grossPaise));

    const head = S.headcount("2026");
    ok("the headcount counts OPEN accounts, which is not who was paid this year",
      [head.active, head.active < S.readSalaryAccounts().length], [2, true]);
    ok("the monthly commitment is Σ what the open accounts are paid",
      head.monthlyPaise,
      S.readSalaryAccounts().filter((a) => a.active).reduce((n, a) => n + a.monthlyGrossPaise, 0));
    ok("the year on screen follows the module's clock, never the browser's",
      S.resolveYear(undefined), "2026");
    ok("an account names who opened it off the trail, and one with no opening on it names nobody",
      [S.readSalaryAccount("SAL-AC-22").recordedBy, S.readSalaryAccount("SAL-AC-11").recordedBy],
      ["A. Founder", ""]);
  }

  /* ======================================================================== */
  console.log("\nsubscriptions — a row is a plan somebody bought");
  {
    const rows = S.readSubscriptions();
    ok("every purchase the server sent is here",
      rows.map((s) => s.subscriptionId).sort(),
      ["SUB-architect-2", "SUB-automation-1", "SUB-business-12", "SUB-business-9", "SUB-shop-5"]);
    const s = S.readSubscription("SUB-business-12");
    ok("a purchase carries the plan, the term and what it cost",
      [s.planName, s.cycleMonths, s.totalPaise], ["Starter", 12, 1770000]);
    ok("...the day it started and the day it expires",
      [s.startDate, s.endDate], ["2026-08-11", "2027-08-10"]);
    ok("...and the account that bought it, as an id and a name",
      [s.customer.userId, s.customer.name], ["1041", "Priya Nair"]);
    ok("how the sale happened is the server's `source`, not a rule re-run here",
      [s.source, S.readSubscription("SUB-shop-5").source, S.readSubscription("SUB-business-9").source],
      ["sales", "website", "sales"]);
    ok("every status is one the vocabulary defines",
      rows.filter((x) => !S.subStatusMeta(x.status)).map((x) => x.subscriptionId), []);
    ok("...including the server's own two words",
      [S.readSubscription("SUB-shop-5").status, S.readSubscription("SUB-architect-2").status],
      ["pending", "expired"]);

    /* THE PAYMENT IS THE RECORD. A purchase is paid once, so it carries one
       installment — and none at all where no transaction was ever written. */
    ok("a paid purchase carries the payment that bought it",
      [s.installments.length, s.installments[0].status, s.installments[0].payment.reference],
      [1, "paid", "CFORD-A"]);
    ok("...for exactly what the purchase cost", s.installments[0].amountPaise, s.totalPaise);
    ok("...and it reads as paid in full", s.paidInFull, true);
    ok("a purchase whose money has not arrived is DUE — the absence of an event",
      (() => { const p = S.readSubscription("SUB-shop-5");
        return [p.installments[0].status, p.installments[0].payment, p.paidInFull]; })(),
      ["due", null, false]);
    ok("an expired purchase that WAS paid keeps its payment",
      S.readSubscription("SUB-architect-2").installments[0].status, "paid");
    ok("a free plan with no transaction behind it records no installment at all",
      S.readSubscription("SUB-automation-1").installments.length, 0);
    ok("no purchase claims a tax invoice, because none is raised against one",
      rows.filter((x) => x.invoiceNumber).map((x) => x.subscriptionId), []);
    /* A PURCHASE HAS NO TIMELINE OF ITS OWN. What history there is belongs to
       the COMMITMENT over it, and it is the audit trail read by subject — so a
       purchase nobody has recorded one against shows nothing. */
    ok("a purchase with no commitment claims no timeline",
      rows.filter((x) => x.events.length).map((x) => x.subscriptionId), ["SUB-business-12"]);

    const t = S.subTotals();
    ok("the strip counts every purchase and the ones actually running",
      [t.subs, t.activeN], [5, 2]);
    ok("...collected is Σ the installments that were paid",
      t.collectedPaise, 1770000 + 499900 + 500000);
    ok("...and what is outstanding is what has not arrived", t.duePaise, 990000);
    ok("the Active count is the purchases actually running", S.activeCount(), 2);
    ok("the filters narrow the same rows the strip counted",
      [S.applySubFilters(S.subRows(), { status: "pending" }).map((r) => r.s.subscriptionId),
        S.applySubFilters(S.subRows(), { source: "sales" }).map((r) => r.s.subscriptionId).sort(),
        S.applySubFilters(S.subRows(), { flag: "settled" }).length],
      [["SUB-shop-5"], ["SUB-business-12", "SUB-business-9"], 3]);
    ok("the years offered are the ones something was actually sold in",
      S.subYears(S.subRows()), ["2026", "2025"]);
    ok("every installment in the module appears once in the flat queue",
      S.installmentRows().length,
      rows.reduce((n, x) => n + x.installments.length, 0));

    /* THE RULES THAT ARE SHAPE, NOT FIXTURE: they hold whatever the server
       sends, and they are what stops a figure claiming money that is not
       coming. */
    ok("the walk stops at a failure, so nothing behind one is ever next",
      S.nextDue({ status: "active", installments: [
        { seq: 1, status: "fail_to_pay", dueDate: "2026-08-01", amountPaise: 100 },
        { seq: 2, status: "due", dueDate: "2026-09-01", amountPaise: 100 },
      ] }), null);
    ok("...and a subscription that is not running has no next at all",
      ["completed", "cancelled", "refunded", "expired"].filter((st) => S.nextDue({ status: st, installments: [
        { seq: 1, status: "due", dueDate: "2026-09-01", amountPaise: 100 },
      ] }) !== null), []);
    ok("...while the same schedule on an ACTIVE one does have a next",
      (S.nextDue({ status: "active", installments: [
        { seq: 1, status: "due", dueDate: "2026-09-01", amountPaise: 100 },
      ] }) || {}).seq, 1);
  }

  /* ======================================================================== */
  console.log("\nmoney — collected is what arrived, salary is what was paid");
  {
    const o = S.overview();
    const inAugPaid = S.countedPayments().filter((r) => inAug(r.pay.valueDate));
    ok("collected is Σ the payments that actually arrived in August",
      [o.collectedPaise, o.collectedN], [money(inAugPaid.map((r) => r.pay)), inAugPaid.length]);
    ok("...and a refunded purchase's money IS collected — it did arrive",
      S.countedPayments().some((r) => r.sub.subscriptionId === "SUB-business-9"), true);
    ok("salary cost counts only runs that were actually paid — August's is open",
      [o.salaryPaise, o.salaryN], [0, 0]);
    ok("...July's paid run is the whole salary cost of July",
      S.overview("2026-07-01", "2026-07-31").salaryPaise, S.readRun("RUN-2026-07").totalNetPaise);
    ok("net = collected + other in − salary − other spend − refunds paid",
      o.netPaise, o.collectedPaise + o.otherInPaise - o.salaryPaise - o.otherOutPaise - o.refundsPaidPaise);
    const tiles = S.overviewTiles();
    ok("every Overview tile is a metric the vocabulary defines",
      tiles.filter((t) => !S.metric(t.key)).map((t) => t.key), []);
    ok("no tile renders a number where the metric is unavailable",
      tiles.filter((t) => t.unavailable !== null && t.paise !== null).map((t) => t.key), []);
    ok("the salary tile says plainly that no run was paid",
      tiles.filter((t) => t.key === "salary_cost")[0].sub, "no run paid in this period");
  }

  /* ======================================================================== */
  console.log("\nwrites · the salary account — what has no column is refused, not swallowed");
  {
    const member = S.salaryMemberOptions().filter((m) => !m.taken)[0];
    const base = {
      memberId: member.memberId, memberName: member.name, employeeCode: member.employeeCode,
      designation: member.designation, department: member.department, joinedAt: "2026-08-03",
      earnings: [{ key: "basic", label: "Basic", amountPaise: 3000000 }],
      deductions: [], bank: { masked: "", ifsc: "", name: "" }, pan: "", uan: null,
    };
    const refused = (s) => has(s, "not available on the server yet");

    ok("an account with no member is refused",
      has((await S.upsertSalaryAccount({ ...base, memberId: 0 })).error, "real Team member"), true);
    ok("earnings that add up to nothing are refused",
      has((await S.upsertSalaryAccount({ ...base, earnings: [] })).error, "more than zero"), true);
    ok("a component that is not a clean amount is refused",
      has((await S.upsertSalaryAccount({ ...base,
        earnings: [{ key: "basic", label: "Basic", amountPaise: 1.5 }] })).error, "whole amount"), true);
    ok("...and neither of those three wrote anything", S.readSalaryAccounts().length, 3);

    /* The write itself: what goes on the wire, and what comes back. */
    sent = [];
    api.createSalaryAccount = (data) => { sent.push(["create", data]); return okd({
      id: 44, member: who(74, "D. Newcomer"), employeeCode: data.employeeCode,
      monthlyGrossPaise: data.monthlyGrossPaise, isActive: true, components: data.components,
      payTo: data.payTo, createdAt: "2026-08-25T10:00:00+05:30" }); };
    const made = await S.upsertSalaryAccount(base);
    ok("opening an account is accepted", made.error, "");
    ok("...and the body says who, what code, and how much",
      sent[0][1], { member: 74, employeeCode: "IB-EMP-074", monthlyGrossPaise: 3000000,
        components: [{ key: "basic", label: "Basic", kind: "earning", amountPaise: 3000000 }] });

    /* WHAT THE RECORD CAN KEEP NOW (migration 0059): the breakdown, the
       standing deductions, and where the salary is sent. Each of the three was
       refused in words until the columns landed. */
    sent = [];
    const split = await S.upsertSalaryAccount({
      ...base,
      earnings: [{ key: "basic", label: "Basic", amountPaise: 2000000 },
        { key: "hra", label: "House rent allowance", amountPaise: 1000000 }],
      deductions: [{ key: "pf", label: "Provident fund", amountPaise: 180000 }],
      /* The dialog upper-cases the IFSC; the store sends what it is handed. */
      bank: { masked: "50100123454021", ifsc: "hdfc0000123", name: "HDFC Bank", upi: "d@okhdfc" },
      pan: "AFZPM8821K", uan: "100987654321",
    });
    ok("a salary split into components is accepted, both sides on one list", split.error, "");
    ok("...earnings and deductions go with the kind that tells them apart",
      sent[0][1].components.map((c) => [c.key, c.kind, c.amountPaise]),
      [["basic", "earning", 2000000], ["hra", "earning", 1000000], ["pf", "deduction", 180000]]);
    ok("...the gross sent is Σ the EARNINGS, so the two can never disagree",
      sent[0][1].monthlyGrossPaise, 3000000);
    ok("...and the bank, the PAN and the UAN ride with it",
      sent[0][1].payTo, { bankName: "HDFC Bank", accountMasked: "50100123454021",
        ifsc: "hdfc0000123", upi: "d@okhdfc", pan: "AFZPM8821K", uan: "100987654321" });

    /* THE FORM IS PREFILLED FROM A MASKED READ, so what it shows back is
       asterisks. Sending those would overwrite the real number with its own
       mask, which is why only what somebody actually typed is sent. */
    sent = [];
    await S.upsertSalaryAccount({
      ...base,
      bank: { masked: "**********4021", ifsc: "HDFC0000999", name: "HDFC Bank" },
      pan: "******821K", uan: "",
    });
    ok("a masked value is never sent back — only what was typed over it",
      sent[0][1].payTo, { bankName: "HDFC Bank", ifsc: "HDFC0000999" });
    ok("...the row the server answered with is folded in at once",
      [made.salaryAccountId, S.readSalaryAccount("SAL-AC-44").monthlyGrossPaise], ["SAL-AC-44", 3000000]);
    ok("...and the headcount indicator moved in the same read as the write",
      S.headcount("2026").active, 3);

    api.createSalaryAccount = () => refusal("That member already has a salary account. Revise it rather than opening a second one. (duplicate_account)");
    ok("the server's refusal is what the dialog shows, word for word",
      has((await S.upsertSalaryAccount(base)).error, "duplicate_account"), true);

    sent = [];
    api.updateSalaryAccount = (id, data) => { sent.push(["update", id, data]); return okd({
      id, member: who(41, "A. Founder"), employeeCode: data.employeeCode || "IB-EMP-041",
      monthlyGrossPaise: data.monthlyGrossPaise || 6000000, isActive: data.isActive !== false,
      createdAt: "2024-01-15T11:00:00+05:30" }); };
    const raise = await S.upsertSalaryAccount({
      ...base, memberId: 41, memberName: "A. Founder", employeeCode: "IB-EMP-041",
      earnings: [{ key: "basic", label: "Basic", amountPaise: 6000000 }],
    }, "SAL-AC-11");
    ok("a revision is accepted and sends the id the panel holds",
      [raise.error, sent[0][1]], ["", 11]);
    ok("...with the new monthly gross and the lines it is made of",
      sent[0][2], { employeeCode: "IB-EMP-041", monthlyGrossPaise: 6000000,
        components: [{ key: "basic", label: "Basic", kind: "earning", amountPaise: 6000000 }] });
    ok("...and a raise does NOT rewrite a slip already issued",
      S.readSlip("SLIP-1").grossPaise, 5000000);

    /* CLOSING. The reason has no column on the account; it goes with the
       write so the audit trail keeps it, and that is asserted on the body. */
    ok("closing with no reason is refused",
      has(await S.closeSalaryAccount("SAL-AC-11", "  "), "reason_required"), true);
    ok("closing an account that is already closed is refused",
      has(await S.closeSalaryAccount("SAL-AC-33", "left"), "invalid_state_transition"), true);
    sent = [];
    ok("closing is accepted", await S.closeSalaryAccount("SAL-AC-11", "Resigned; last day 30 Jun."), "");
    ok("...and the reason rides the write",
      sent[0][2], { isActive: false, reason: "Resigned; last day 30 Jun." });
  }

  /* ======================================================================== */
  console.log("\nwrites · the run is built by the server, and it decides");
  {
    sent = [];
    api.buildSalaryRun = (month) => {
      sent.push(["run", month]);
      const built = { ...run(9, month, "open", null), slips: 2, totalNetPaise: 9000000 };
      return okd({ run: built, slips: [
        { ...slip(11, 9, month, A, null), month }, { ...slip(12, 9, month, B, null), month }] });
    };
    ok("a month that is not a month never reaches the server",
      [(await S.openSalaryRun("August")).error, sent.length], ["Pick a month.", 0]);
    const built = await S.openSalaryRun("2026-05");
    ok("building one month is accepted, and the month is what goes on the wire",
      [built.error, built.runId, sent[0][1]], ["", "RUN-2026-05", "2026-05"]);
    ok("...and the run and its slips are on the list at once",
      [S.readRun("RUN-2026-05").slips.length, S.readSlip("SLIP-11").month], [2, "2026-05"]);

    api.buildSalaryRun = () => refusal("The 2026-08 run is still open. Pay it before opening another — two open runs cannot be reconciled against one balance. (period_open)");
    ok("a second open run is refused by the server, in its own words",
      has((await S.openSalaryRun("2026-04")).error, "period_open"), true);
    /* LOSS OF PAY IS THE SERVER'S ARITHMETIC. The panel refuses what it can
       see first — a paid slip is frozen, a whole month is not a slip — and the
       server pro-rates against the slip's own frozen base. */
    sent = [];
    api.setPayslipLop = (id, days) => {
      sent.push(["lop", id, days]);
      const sl = SLIPS.filter((x) => x.id === id)[0];
      const basis = S.daysInMonth(sl.month);
      const worked = basis - days;
      const gross = Math.round((4000000 * worked) / basis);
      Object.assign(sl, { paidDays: worked, lopDays: days, grossPaise: gross,
        netPaise: gross - sl.deductionsPaise });
      return okd({ slip: sl, run: RUNS.filter((r) => r.id === sl.runId)[0] });
    };
    ok("a paid slip cannot lose pay — it is frozen",
      [has(await S.setLop("SLIP-7", 2), "already_paid"), sent.length], [true, 0]);
    ok("a whole month of loss of pay is not a slip, and never reaches the server",
      [has(await S.setLop("SLIP-8", 31), "whole number of days"), sent.length], [true, 0]);
    ok("setting it is accepted, and the days are what go on the wire",
      [await S.setLop("SLIP-8", 3), sent[0]], ["", ["lop", 8, 3]]);
    ok("...the earnings are pro-rated and the deductions are not",
      [S.readSlip("SLIP-8").grossPaise, S.readSlip("SLIP-8").deductionsPaise],
      [Math.round((4000000 * 28) / 31), 200000]);
    ok("...and the slip's base is the full month still, so doing it again is safe",
      S.money(S.readSlip("SLIP-8").baseEarnings), 4000000);
    restoreFixture();
    await S.bootPayroll(true);
  }

  /* ======================================================================== */
  console.log("\nwrites · salaries are paid PERSON by person, oldest month first");
  {
    await S.bootPayroll(true);
    /* The receipt is a real file now: it goes to storage with a presigned PUT
       and the slip keeps it as a private attachment. */
    const uploads = [];
    S.CommonService.getUploadUrl = (q) => { uploads.push(q); return Promise.resolve({
      response: true, message: "", data: { uploadUrl: "https://s3.example/put", fileUrl: "https://s3.example/payment_screenshot/u_receipt.pdf" } }); };
    S.CommonService.uploadToS3 = () => Promise.resolve();
    const bytes = new File([new Uint8Array(10)], "receipt.pdf", { type: "application/pdf" });
    const PDF = { filename: "receipt.pdf", mime: "application/pdf", bytes: 10, file: bytes };
    const acct = { accountId: "hdfc_4021" };
    const paid = [];
    api.payPayslip = (id, data) => {
      paid.push([id, data]);
      const s = SLIPS.filter((x) => x.id === id)[0];
      if (s) { s.paidAt = "2026-08-25T12:00:00+05:30"; s.mode = REF; }
      return okd({ slip: s, run: RUNS.filter((r) => r.id === (s ? s.runId : 0))[0] });
    };

    ok("paying with no receipt is refused — it is the only evidence there is",
      has(await S.paySalary("SAL-AC-22", { via: "bank", ...acct, proof: { filename: "", mime: "" } }), "proof_required"), true);
    ok("...a file that is neither an image nor a PDF is refused, by name",
      has(await S.paySalary("SAL-AC-22", { via: "bank", ...acct, proof: { filename: "notes.txt", mime: "text/plain" } }), "notes.txt"), true);
    ok("...an unknown method is refused",
      has(await S.paySalary("SAL-AC-22", { via: "carrier-pigeon", ...acct, proof: PDF }), "Pick how it was paid"), true);
    ok("...and an account that does not exist is refused",
      has(await S.paySalary("SAL-AC-22", { via: "bank", accountId: "ACC-NOPE", proof: PDF }), "Pick the account"), true);
    ok("...but cash names no account and gets past that check (refused later, for the missing bytes)",
      has(await S.paySalary("SAL-AC-22", { via: "cash", accountId: "", proof: { ...PDF, file: undefined } }),
        "proof_required"), true);
    ok("...a deduction with no reason is refused — nothing else explains it on the slip",
      has(await S.paySalary("SAL-AC-22", { via: "bank", ...acct, proof: PDF,
        deduction: { label: "  ", amountPaise: 40000 } }), "reason_required"), true);
    ok("...and a receipt whose bytes were never picked is refused",
      has(await S.paySalary("SAL-AC-22", { via: "bank", ...acct,
        proof: { filename: "receipt.pdf", mime: "application/pdf" } }), "Pick receipt.pdf again"), true);
    ok("...and none of those six sent anything", paid.length, 0);

    ok("paying is accepted", await S.paySalary("SAL-AC-22", { via: "upi", ...acct, proof: PDF,
      remark: "Two months, oldest first",
      incentive: { label: "Incentive", amountPaise: 100000 },
      deduction: { label: "Advance recovery", amountPaise: 40000 } }), "");
    ok("...both owed months went out, OLDEST FIRST, one write each",
      paid.map((p) => p[0]), [2, 8]);
    ok("...each carrying the mode somebody actually chose",
      paid.map((p) => p[1].mode), ["UPI", "UPI"]);
    /* ONE TRANSFER IS ONE RECEIPT, whether it clears one month or three — and
       it is uploaded ONCE rather than per slip. */
    ok("...the receipt is uploaded once and rides every slip the transfer clears",
      [uploads.length, paid.map((p) => p[1].receiptName)], [1, ["receipt.pdf", "receipt.pdf"]]);
    /* THE ONE-OFFS RIDE THE CURRENT MONTH ONLY. Paying two months of arrears
       must not pay one bonus twice. */
    ok("...the incentive and the recovery land on the CURRENT month and nowhere else",
      paid.map((p) => [p[1].incentivePaise, p[1].adjustmentPaise]),
      [[undefined, undefined], [100000, -40000]]);
    ok("...with the recovery's reason, which is the only thing that explains it",
      paid[1][1].adjustmentReason, "Advance recovery");
    ok("...and the account it was paid from is the server's own key, on every slip",
      paid.map((p) => p[1].paidFrom), ["hdfc_4021", "hdfc_4021"]);
    ok("...and nothing is outstanding afterwards",
      S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-22"))).pendingPaise, 0);
    ok("paying again is refused, because there is nothing to pay",
      has(await S.paySalary("SAL-AC-22", { via: "bank", ...acct, proof: PDF }), "nothing_due"), true);

    /* A HELD SLIP IS NEVER REACHED — it is not owed, so the write skips it. */
    ok("the held month is still held and still unpaid",
      [S.readSlip("SLIP-9").held, S.readSlip("SLIP-9").paidAt], [true, null]);
  }

  /* ======================================================================== */
  console.log("\nwrites · a hold is about a month, not a person");
  {
    restoreFixture();
    await S.bootPayroll(true);
    const held = [];
    api.holdPayslip = (id, reason) => { held.push(["hold", id, reason]); const s = SLIPS.filter((x) => x.id === id)[0]; if (s) s.held = true; return okd({}); };
    api.releasePayslip = (id) => { held.push(["release", id]); const s = SLIPS.filter((x) => x.id === id)[0]; if (s) s.held = false; return okd({}); };

    ok("holding without a reason is refused — the hold prints nowhere else",
      has(await S.setSlipHold("SLIP-8", true, "  "), "reason_required"), true);
    ok("a PAID slip cannot be held — it is frozen",
      has(await S.setSlipHold("SLIP-1", true, "too late"), "already_paid"), true);
    ok("holding it with a reason works", await S.setSlipHold("SLIP-8", true, "Disputed LOP, HR checking"), "");
    ok("...and the reason goes with the write, because the slip has no column for it",
      held[0], ["hold", 8, "Disputed LOP, HR checking"]);
    ok("...the held month leaves what is owed, and the OTHER month still pays",
      S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-22"))).pendingPaise,
      S.readSlip("SLIP-2").netPaise);
    ok("...and holding it twice says so",
      has(await S.setSlipHold("SLIP-8", true, "again"), "already on hold"), true);
    ok("releasing needs no reason — it restores the ordinary state",
      await S.setSlipHold("SLIP-8", false, ""), "");
    ok("...the month is owed again",
      S.dueOf(S.toSalaryRow(S.readSalaryAccount("SAL-AC-22"))).pendingPaise,
      S.readSlip("SLIP-2").netPaise + S.readSlip("SLIP-8").netPaise);
    ok("...and releasing one that is not held says so",
      has(await S.setSlipHold("SLIP-8", false, ""), "not on hold"), true);
  }

  /* ======================================================================== */
  console.log("\nsubscriptions — the purchase, and the commitment standing over it");
  {
    /* WHERE IT STANDS is the commitment's when one has been recorded, and the
       purchase's own status otherwise. */
    ok("a purchase with a commitment reads the commitment's state",
      S.readSubscription("SUB-business-12").status, "active");
    ok("...and its history is the trail's rows about that commitment",
      S.readSubscription("SUB-business-12").events.map((e) => e.type), ["Subscription recorded"]);
    ok("...while a purchase carrying none has no history to show",
      S.readSubscription("SUB-shop-5").events.length, 0);
    ok("...and says who sold it and who wrote it down",
      [S.readSubscription("SUB-business-12").soldBy, S.readSubscription("SUB-business-12").recordedBy],
      ["u52", "u41"]);
    ok("a purchase with none falls back to its own status, never to a guess",
      [S.readSubscription("SUB-shop-5").status, S.readSubscription("SUB-shop-5").soldBy],
      ["pending", ""]);
    /* ONE INSTALLMENT, DERIVED FROM THE PAYMENT — there are no schedule rows
       and the commitment does not add any. */
    ok("the single installment line is still derived from the payment that bought it",
      S.readSubscription("SUB-business-12").installments.map((i) => [i.seq, i.of, i.status]),
      [[1, 1, "paid"]]);

    /* A FAIL TO PAY IS THE DEFAULTING COMMITMENT'S, and the server reads its
       reason and evidence back off the trail. A manual payment names the admin
       who verified it; a gateway one names nobody. */
    const shop = SUBS.filter((x) => x.id === 5)[0];
    const arch = SUBS.filter((x) => x.id === 2)[0];
    const keep = JSON.stringify([shop, arch]);
    shop.subscription = { ...COMMITMENT, id: 502, family: "shop", purchaseId: 5,
      state: { key: "defaulting", label: "Defaulting", tone: "bad" },
      failure: { reason: "declined", note: "UPI collect R01", at: "2026-08-24T10:00:00+05:30", by: { id: 41, username: "u41" } } };
    Object.assign(arch.payment, { paymentMethod: "manual", verifiedBy: { id: 41, username: "u41" } });
    await S.bootSubs(true);
    const d = S.readSubscription("SUB-shop-5");
    ok("a defaulting commitment over money that never arrived is its installment's fail to pay",
      [d.status, d.installments[0].status, d.installments[0].failure],
      ["defaulting", "fail_to_pay", { at: "2026-08-24T10:00:00+05:30", reason: "declined", attempt: 0, note: "UPI collect R01" }]);
    ok("...counted as failed, and no longer as due",
      (() => { const r = S.toSubRow(d); return [r.failedN, r.dueN, r.dueNext, r.needsAttention]; })(),
      [1, 0, null, true]);
    ok("a manual payment names who verified it, a gateway one nobody",
      [S.readSubscription("SUB-architect-2").installments[0].payment.recordedBy,
        S.readSubscription("SUB-business-12").installments[0].payment.recordedBy], ["u41", ""]);
    const [s0, a0] = JSON.parse(keep);
    Object.assign(shop, s0); Object.assign(arch, a0);
    delete arch.payment.verifiedBy;
    await S.bootSubs(true);

    /* The writes. Each one addresses the COMMITMENT; a purchase that has none
       gets one recorded on the way, because a state is not something anybody
       sets up in advance. */
    sent = [];
    api.recordSubscription = (data) => {
      sent.push(["record", data]);
      return okd({ ...COMMITMENT, id: 777, family: data.family, purchaseId: data.purchase });
    };
    api.setSubscriptionState = (id, data) => { sent.push(["state", id, data]); return okd(COMMITMENT); };
    api.cancelSubscription = (id, reason) => { sent.push(["cancel", id, reason]); return okd(COMMITMENT); };

    ok("recording a sale on an invoice no chain the server listed carries is refused",
      has((await S.recordSubscription({ userId: "1041", source: "sales", planId: "PL",
        planName: "Starter", cycleMonths: 12, invoiceNumber: "IB-INV-2026-00092",
        installmentCount: 1, startDate: "2026-08-01" })).error, "Attach the invoice"), true);
    ok("...and nothing was sent", sent.length, 0);
    ok("recording one against a purchase that exists is accepted",
      (await S.recordSubscription({ userId: "IB-U-1012", source: "sales", planId: "PL",
        planName: "Shop Growth", cycleMonths: 3, invoiceNumber: "", installmentCount: 1,
        startDate: "2026-08-20", purchase: { family: "shop", id: 5 } })).subscriptionId, "SUB-shop-5");
    ok("...and the body names the purchase, never a customer typed by hand",
      [sent[0][1].family, sent[0][1].purchase, "userId" in sent[0][1]], ["shop", 5, false]);

    sent = [];
    ok("cancelling with no reason is refused",
      [has(await S.cancelSubscription("SUB-business-12", "  "), "reason_required"), sent.length],
      [true, 0]);
    ok("cancelling is accepted, and addresses the commitment the purchase carries",
      [await S.cancelSubscription("SUB-business-12", "Customer closed the business."),
        sent[0]], ["", ["cancel", 501, "Customer closed the business."]]);

    sent = [];
    ok("a fail to pay with no evidence is refused",
      [has(await S.markFailToPay("SUB-business-12", 1, "declined", "  "), "reason_required"),
        sent.length], [true, 0]);
    ok("...and one against an installment a purchase does not have is refused too",
      has(await S.markFailToPay("SUB-business-12", 2, "declined", "R01"), "paid once"), true);
    ok("a fail to pay moves the commitment to defaulting, evidence and all",
      [await S.markFailToPay("SUB-business-12", 1, "declined", "NACH bounced, R01"), sent[0]],
      ["", ["state", 501, { state: "defaulting", reason: "declined", note: "NACH bounced, R01" }]]);

    /* A PURCHASE WITH NO COMMITMENT gets one recorded on the way, in one
       visible write rather than a row the server invents inside a cancel. */
    sent = [];
    ok("cancelling a purchase nobody has recorded one against records it first",
      [await S.cancelSubscription("SUB-architect-2", "Lapsed and not renewed."),
        sent.map((x) => x[0])], ["", ["record", "cancel"]]);
    ok("...and the cancel then addresses the commitment that write returned",
      sent[1][1], 777);

    /* A PLAN PURCHASE IS ONE PAYMENT: the gateway settles it, or Payments
       verifies it. There is no installment to record on it here. */
    ok("a plan purchase has no installment to record, and says where it is settled",
      has((await S.recordInstallmentPayment({ subscriptionId: "SUB-business-12", seq: 1, valueDate: "2026-08-24" })).error,
        "Payments"), true);
    sent = [];
    api.reverseSubscriptionPayment = (id, data) => { sent.push(["reverse", id, data]); return okd(COMMITMENT); };
    ok("reversing needs its reason, and sends nothing without one",
      [has(await S.reversePayment("ORD-A", " "), "reason_required"), sent.length], [true, 0]);
    ok("reversing a plan payment addresses the commitment over the purchase",
      [await S.reversePayment("ORD-A", "The bank recalled the credit."), sent],
      ["", [["reverse", 501, { seq: 1, reason: "The bank recalled the credit." }]]]);
    ok("...and a payment on no subscription is refused",
      has(await S.reversePayment("ORD-NOWHERE", "x"), "not on any subscription"), true);
  }

  /* ======================================================================== */
  console.log("\nsubscriptions — a sale, recorded over its quotation");
  {
    serveSales([SALE], CHAINS);
    await S.bootSubs(true);
    const sale = S.readSubscription("SUB-QT-610");
    ok("a sale is read off the commitments list, beside the purchases",
      [sale.source, sale.planName, sale.totalPaise, sale.customer.userId, S.readSubscriptions().length],
      ["sales", "Growth Annual", 3000000, "1041", SUBS.length + 1]);
    ok("...its installments are the quotation's rows, a failed one as fail to pay",
      sale.installments.map((i) => [i.seq, i.of, i.status]), [[1, 3, "paid"], [2, 3, "fail_to_pay"], [3, 3, "due"]]);
    ok("...a paid one carries the deal-ledger payment and the invoice behind it",
      [sale.installments[0].payment.paymentId, sale.installments[0].payment.reference, sale.installments[0].invoiceNumber],
      ["DP-55", "UTR-55", "IB-INV-2026-00091"]);
    ok("...and where it stands is derived from them: a failed row makes it defaulting",
      [sale.status, S.toSubRow(sale).failedN, S.toSubRow(sale).dueNext], ["defaulting", 1, null]);
    ok("the chains are the server's, one customer at a time",
      [S.chainsFor("1041").length, S.chainsFor("1041")[0].recordedAs, S.chainsFor("1012")[0].recordedAs, S.chainsFor("9999")],
      [1, "SUB-QT-610", null, []]);
    ok("...a chain is recorded on its first issued invoice",
      S.chainsFor("1012")[0].attachable.invoiceNumber, "IB-INV-2026-00096");
    ok("an issued invoice that settles nothing yet is attachable to its customer",
      S.attachableInvoices("1041").map((i) => i.invoiceNumber), ["IB-INV-2026-00092", "IB-INV-2026-00093"]);
    ok("...and to an installment only when it is for exactly that installment's amount",
      S.attachableForInstallment("SUB-QT-610", 2).map((i) => i.invoiceNumber), ["IB-INV-2026-00092"]);
    ok("...while a purchase has none to attach",
      S.attachableForInstallment("SUB-business-12", 1), []);
    ok("an invoice on a sale resolves by its number", S.readInvoice("IB-INV-2026-00092").dealRef, "DL-2601");

    sent = [];
    api.recordSubscription = (data) => { sent.push(["record", data]); return okd(Object.assign({}, SALE, { id: 611 })); };
    api.paySubscriptionInstallment = (id, seq, invoice) => {
      sent.push(["pay", id, seq, invoice]);
      return okd(Object.assign({}, SALE, { installments: SALE.installments.map((r) => (r.seq === seq
        ? Object.assign({}, r, { status: "paid", invoiceNumber: invoice,
          payment: Object.assign({}, SALE.installments[0].payment, { id: 56 }) }) : r)) }));
    };
    api.failSubscriptionInstallment = (id, seq, data) => { sent.push(["fail", id, seq, data]); return okd(SALE); };
    api.reverseSubscriptionPayment = (id, data) => { sent.push(["reverse", id, data]); return okd(SALE); };

    const recordOn = (userId, invoiceNumber) => S.recordSubscription({ userId, source: "sales", planId: "PL",
      planName: "Shop Growth", cycleMonths: 3, invoiceNumber, installmentCount: 1, startDate: "2026-08-10",
      paid: { count: 1, mode: "NEFT", reference: "typed", valueDate: "2026-08-10", accountId: "" } });
    ok("an invoice on somebody else's deal is refused, with nothing sent",
      [has((await recordOn("1041", "IB-INV-2026-00096")).error, "another customer"), sent.length], [true, 0]);
    ok("a sale is recorded over the quotation its invoice names",
      (await recordOn("1012", "IB-INV-2026-00096")).subscriptionId, "SUB-QT-611");
    ok("...sending the quotation and what is believed paid — never the customer, never the money",
      sent[0], ["record", { quotation: 95, paidCount: 1, startedOn: "2026-08-10" }]);

    sent = [];
    ok("an installment of a sale is settled by the issued invoice that billed it",
      [await S.recordInstallmentPayment({ subscriptionId: "SUB-QT-610", seq: 2, valueDate: "2026-08-24",
        invoiceNumber: "IB-INV-2026-00092" }), sent[0]],
      [{ error: "", paymentId: "DP-56" }, ["pay", 610, 2, "IB-INV-2026-00092"]]);
    sent = [];
    ok("one fails on the deal's own rule, the evidence kept apart from the reason",
      [await S.markFailToPay("SUB-QT-610", 3, "declined", "NACH R01"), sent],
      ["", [["fail", 610, 3, { reason: "declined", note: "NACH R01" }]]]);
    sent = [];
    ok("reversing a sale's payment names the installment it settled",
      [await S.reversePayment("DP-55", "Duplicate entry against the same UTR."), sent],
      ["", [["reverse", 610, { seq: 1, reason: "Duplicate entry against the same UTR." }]]]);

    serveSales([], []);
    await S.bootSubs(true);
  }
}

/* ========================================================================== */
console.log("\nwrites · the premise is enforced, not documented");
S.resetStore();
{
  ok("there is no verifyPayment — a recorded payment is not a claim awaiting belief", typeof S.verifyPayment, "undefined");
  ok("there is no holdUnallocated — money is not parked in a state", typeof S.holdUnallocated, "undefined");
  ok("there is no logPayment — a payment is recorded, not logged", typeof S.logPayment, "undefined");
  ok("there is no postTransaction — there is no draft to post", typeof S.postTransaction, "undefined");
  ok("there is no addCategory — tags replaced categories outright", typeof S.addCategory, "undefined");
}

/* ========================================================================== */
console.log("\nthe live half — offline, nothing is invented");
S.resetStore();
/* ASYNC FROM HERE. Every live write goes to the server and returns a promise;
   the refusals below are the ones the store answers with BEFORE it calls out,
   which is what an offline suite can assert without inventing a server. */
void (async () => {
  /* OTHER TRANSACTION, REFUNDS, THE BANK AND ANALYTICS READ THE SERVER. This
     suite runs with no server and no browser, which is exactly the state that
     must never fill a live list with seed rows or a live figure with a guess. */
  /* THERE IS NO SEED CLOCK. Before anything has asked the server, the clock
     is the browser's — today in India, and a stamp of right now. */
  const istToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  ok("before the server answers, the clock is the browser's", [S.PERIOD.key, S.todayIso()], [istToday.slice(0, 7), istToday]);
  ok("...and a session write is stamped now, not on a seed date",
    Math.abs(Date.parse(S.stamp()) - Date.now()) < 5000, true);
  ok("before the server answers, every live list is empty — not the seed",
    [S.readTransactions().length, S.readTags().length, S.readRefunds().length, S.readStatements().length],
    [0, 0, 0, 0]);
  ok("...the bank has no completeness figure and no statement to reconcile",
    [S.matchedPct(), S.reconciliation().stmt], [null, null]);
  ok("...and the live value lists are empty rather than the old seed vocabulary",
    [S.TXN_STATES.length, S.CREDIT_KINDS.length, S.REFUND_GROUNDS.length, S.REFUND_STATES.length, S.COMPANY_ACCOUNTS.length],
    [0, 0, 0, 0, 0]);

  const k = S.kpis();
  ok("every KPI the store computes is returned, in order", k.map((x) => x.key), KPI_KEYS);
  ok("...and before the server answers none has a definition — the words are the server's too",
    [S.KPIS.length, S.METRICS.length, S.PAYROLL_METRICS.length, S.SLIP_RULE, S.decision("FN-OD-07"), k[0].label],
    [0, 0, 0, "", null, "mrr"]);
  ok("every KPI with no value says why — undefined is not zero",
    k.filter((x) => x.value === null && !(x.why || "").trim()).map((x) => x.key), []);
  ok("runway, new customers and CAC have no honest source and stay null",
    k.filter((x) => ["runway", "new_customers", "cac"].indexOf(x.key) >= 0).map((x) => x.value), [null, null, null]);
  ok("burn is null while spend, runs and refunds are unread — never a zero nobody measured",
    k.filter((x) => x.key === "burn").map((x) => x.value), [null]);

  const w = S.waterfall();
  ok("the waterfall runs in the order the money moves",
    w.map((s) => s.key), ["collected", "other_in", "salary", "other_out", "refunds", "net"]);
  ok("...and its steps reconcile to its closing figure",
    w[0].paise + w[1].paise - w[2].paise - w[3].paise - w[4].paise, w[5].paise);
  ok("NO AT-RISK ROW LABELS ITS LINK WITH A SECTION NAME — the sidebar owns that job",
    S.atRisk().filter((r) => ["Subscriptions", "Refunds", "Other Transaction", "Salaries A/C"]
      .indexOf(r.toLabel) >= 0).map((r) => r.key), []);
  ok("a month series needs two readings, so none is drawn from nothing", S.kpiSeries("burn"), null);

  /* THE TAG TABLE IS THE SERVER'S, and a write to it is refused on what the
     panel can see before it asks: an unnamed tag, a tag this session has never
     read. Nothing is faked into the list either way. */
  ok("a tag with no label is refused before anything is sent",
    (await S.addTag("   ", "variable", 500000, true)).error, "Give the tag a label.");
  ok("deactivating and budgeting a tag nothing has read are refused",
    [await S.deactivateTag("rent"), await S.setBudget("rent", 100)],
    ["That tag no longer exists.", "That tag no longer exists."]);
  /* A WRITE WITH NO ENDPOINT IS REFUSED, in the same shape, never faked. */
  const refused = (s) => has(s, "not available on the server yet");
  /* A REFUND BY HAND is a real write now; what this offline suite can assert
     is what the panel refuses BEFORE it calls out — and a ground it has never
     read is one of them. */
  ok("a refund by hand with nobody named is refused",
    has((await S.createManualRefund("  ", 450000, "duplicate", "d")).error, "who the money is going to"), true);
  ok("...one for nothing is refused",
    has((await S.createManualRefund("Ritu Sharma", 0, "duplicate", "d")).error, "above zero"), true);
  ok("...and a ground this session never read is refused rather than sent",
    (await S.createManualRefund("Ritu Sharma", 450000, "duplicate", "d")).error,
    "Pick why the money is going back.");
  ok("a refund against a payment the server never listed is refused",
    (await S.requestRefund("PAY-4404", "duplicate", "d")).error, "That payment is not in the ledger.");
  ok("a statement import names an account this session can see, or it is refused",
    (await S.importStatement({ accountId: "hdfc", from: "2026-08-01", to: "2026-08-31", csv: "" })).error,
    "Pick the account this statement is for.");
  /* THE STATEMENT FILE, READ. The panel parses; the server matches. */
  const csv = S.parseStatementCsv(
    "Date,Narration,Reference,Debit,Credit\n"
    + "02/08/2026,RENT AUG,NEFT 77120,\"22,000.00\",\n"
    + "2026-08-10,PLAN PAYMENT,TXN-AB/99,,1500.00\n");
  ok("a debit and a credit are read off the bank's own columns",
    csv.lines.map((l) => [l.date, l.direction, l.amountPaise, l.reference]),
    [["2026-08-02", "debit", 2200000, "NEFT 77120"], ["2026-08-10", "credit", 150000, "TXN-AB/99"]]);
  ok("...and a file with nothing under its header is refused rather than imported as an empty window",
    S.parseStatementCsv("Date,Narration,Amount").error, "That file has no lines under its header.");
  /* A REFUND IS COUNTED ONCE. It is money out when its request settles, so the
     payment it reverses keeps its full amount — netting it there too took it
     off net twice. Only a REFUNDED payment with no settled request (the old
     one-step refund) still nets its refund off, because nothing else counts it. */
  const pay = (id, amount, status, refundAmount) => ({ id, amount, orderStatus: status, refundAmount });
  const settled = S.settledRefundPayments([
    { settledAt: "2026-09-12T10:00:00Z", payment: { id: 23 } },
    { settledAt: null, payment: { id: 24 } },
  ]);
  ok("only settled requests mark a payment", [settled.has(23), settled.has(24)], [true, false]);
  ok("a refunded payment with a settled request keeps its full amount",
    S.planCashPaise(pay(23, "19500.0", "REFUNDED", "500.0"), settled), 1950000);
  ok("a one-step refund with no request still nets off", S.planCashPaise(pay(25, "300.0", "REFUNDED", "100.0"), settled), 20000);
  ok("a paid payment is its amount", S.planCashPaise(pay(26, "99.0", "PAID", ""), settled), 9900);

  /* THE PAYROLL AND THE PLAN PURCHASES, against a faked server — last,
     because they install their own stubs over AdminOpsService, and everything
     above asserts what an UNANSWERED module does. */
  await payrollAndSubs();

  S.resetStore();
  console.log(failed
    ? "\n" + failed + " of " + total + " FAILED\n"
    : "\nall " + total + " checks passed\n");
  process.exit(failed ? 1 : 0);
})();
