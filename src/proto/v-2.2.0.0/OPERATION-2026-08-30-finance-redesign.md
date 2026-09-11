# Operation · Finance redesign around four record types

```
task:        Redesign the whole Finance module around the user's terminology:
             four sub-tabs that RECORD TRANSACTIONS — Subscriptions,
             Salaries A/C, Other Transaction, Refunds — plus Analytics, which
             reflects on an Overview page and carries a separate KPI tab for
             decisions.

description: Finance today is organised by ACCOUNTING CONCEPT (Payments ·
             Spend · Reconciliation · Refunds · Revenue). It is being
             reorganised by WHAT IS BEING RECORDED, because that is how the
             business actually thinks about its money: a subscription sale, a
             salary, a company expense or income, a refund. The premise set on
             2026-08-30 stands and hardens — a row exists because the money
             moved; nothing is written on the strength of an assumption. The
             module gains three things it does not have: installment schedules
             with a "Fail to pay" status, salary accounts attached to real team
             members with a printable slip, and custom tags on company
             expense/income.

operation:   Nine steps, three of them fanned out in parallel and merged.
             Contract first (types + vocabulary), then seed data, then the
             single store seam, then the five faces, then wiring, checks and
             docs. Full detail below.

summary:     5 top-level tabs replace 5 faces. 4 new content seeds replace 3.
             store.ts is rewritten around four record types instead of one
             ledger. Reconciliation stops being a tab and becomes an Overview
             health strip — no logic is deleted. Category tags become
             user-creatable, each carrying a kind so analytics still rolls up.
             ~14 files touched, ~9 added.

outcome:     A Finance module a business owner can read: what came in from
             subscriptions and whether the installments are being paid, what
             the team costs and a slip to hand each member, what else was spent
             or earned and under which tag, what went back out as refunds —
             and one Analytics face that turns those four into decisions.
```

---

## 1 · What exists today, and what it costs to move

| Today | Lines | Becomes | Verdict |
| --- | --- | --- | --- |
| `Payments.tsx` + `PaymentDetail.tsx` | 298 | **Subscriptions** — subscription-centric, installments underneath | Rewritten. The payment row survives as an installment payment. |
| `Spend.tsx` + `TransactionDetail.tsx` | 200 | **Other Transaction** (expenses + income, custom tags) and **Salaries A/C** (split out) | Split. Payroll stops being a category and becomes a record type. |
| `Reconciliation.tsx` | 91 | Overview health strip | Demoted, not deleted. `reconciliation()` stays in the store. |
| `Refunds.tsx` | 94 | **Refunds** + manual refund creation | Extended. |
| `Revenue.tsx` | 112 | **Analytics → Overview + KPI** | Absorbed and widened. |
| `store.ts` | 1098 | Rewritten around four record types | The one true seam; still the only file that knows where records live. |
| `Modals.tsx` | 474 | Re-cut per record type | Dialogs follow their tab. |
| `bits.tsx` `Frame.tsx` `InfoTip.tsx` `finance.css` | 609 | Kept, extended | These are the theme layer. No churn. |

**Nothing in the panel outside Finance changes** except one shared move
(`charts.tsx`), so the blast radius is one directory plus a registry line.

## 2 · What it plugs into (verified, not assumed)

| Seam | State | How Finance uses it |
| --- | --- | --- |
| `AdminOpsService.users()` → `AdminUserRow` | **live** | Salaries A/C attaches to real team members by `id`. The salary account itself is seeded locally and joined on that id. |
| `InvoiceItemRow.installmentSeq / installmentCount` | **live** | Installments already exist in the sales chain. Subscriptions reads the same shape rather than inventing a second one. |
| `DealPaymentRow` (`type: payment \| reversal`, `recordedBy`) | **live** | Already a record-only ledger with no verification state. The new store mirrors its shape, so the swap is a rename, not a redesign. |
| `src/content/users/memberships.json` | seed | Subscription term, plan, cycle price, `source.reference` → deal. |
| `Users/charts.tsx` (hand-rolled SVG, no library) | in-repo | Moves to `views/charts.tsx` and serves both modules. `recharts` stays unimported, deliberately. |
| `window.print()` + `@media print` | in-repo | The salary slip is a print document, exactly like the payment receipt. **No PDF dependency is added.** |

## 3 · Decisions this operation makes

| # | Decision | Why |
| --- | --- | --- |
| **D-1** | **Reconciliation stops being a tab.** Its content becomes a "matched to bank" strip on Analytics → Overview. `reconciliation()`, `bank.json` and the statement import stay in the store and stay reachable. | It is not a record type, and the four tabs are record types. Demoting is reversible; deleting is not. |
| **D-2** | **Category tags become custom** — anyone with edit rights can create one. Every tag still carries a `kind` (fixed · reinvestment · variable · excluded), chosen at creation. | The user asked for custom tags. This reverses the earlier closed-list rule but keeps analytics able to roll up, which was the reason for the closed list. |
| **D-3** | **"Fail to pay" is a recorded fact**, not a pending state: a gateway actually declined, or a due date actually passed. It never means "we are not sure yet". | Keeps the 2026-08-30 premise intact. A status that records something that happened is allowed; a status that records a doubt is not. |
| **D-4** | **The slip is a print document**, numbered and frozen like the receipt, not a generated PDF file. | No new dependency; identical to how the panel already issues receipts and quotations. A browser prints it to PDF. |
| **D-5** | **1 installment ↔ 1 payment** replaces 1 invoice ↔ 1 payment. | Same rule, correct unit. An installment is what gets paid; part-paying one is still refused. |
| **D-6** | **Salary amounts are seeded, never derived from a role.** | A salary is a contract with a person, not a function of their permissions. Deriving it would be an assumption. |
| **D-7** | Refunds may be **created manually**, against a subscription payment or standing alone. | Asked for. A standalone refund still needs a ground and a reason, and is still Super Admin to approve. |
| **D-8** | **Drafts and recurring rules are removed.** A company transaction is `recorded` or `reversed`. | They were the last objects on the page describing money that had not moved. Flagged as the open question in the 2026-08-30 entry; this redesign answers it. A salary run keeps `open`, which is a different thing — the month itself is not finished. |

## 4 · The new information architecture

```
#/finance                          Subscriptions   (default)
#/finance?view=salaries            Salaries A/C
#/finance?view=transactions        Other Transaction
#/finance?view=refunds             Refunds
#/finance?view=analytics           Analytics → ?tab=overview | kpi

#/finance/SUB-0104                 one subscription · installments · payments
#/finance/SAL-0031                 one salary account · runs · slips
#/finance/SLIP-2026-08-0031        one payslip (print document)
#/finance/TXN-0911                 one company expense / income
#/finance/RF-0117                  one refund
```

## 5 · Data contract (fixed before any code is written)

Four new seeds under `src/content/finance/`. `ledger.json`, `spend.json` and
`revenue.json` are superseded; `bank.json`, `invoices.json` and
`vocabularies.json` continue.

| File | Holds | Key shape |
| --- | --- | --- |
| `subscriptions.json` | Subscription sales | `subscriptionId`, `source` (**sales · website**), `customer{name,userId,dealRef}`, `planName`, `totalPaise`, `installments[]` each `{seq, of, dueDate, amountPaise, status, payment?}`, `status`, `events[]` |
| `salaries.json` | Salary accounts + monthly runs | `accounts[]` — `salaryAccountId`, `memberId` (joins `AdminUserRow.id`), `memberName`, `designation`, `ctcPaise`, `components{basic,hra,allowances[],deductions[]}`, `bank{masked,ifsc}`; `runs[]` — `runId`, `month`, `state`, `slips[]` each `{slipId, salaryAccountId, grossPaise, deductionsPaise, netPaise, paidAt, reference}` |
| `transactions.json` | Company expense + income | `tags[]` — `tagKey`, `label`, `kind`, `custom`, `budgetPaise`; `transactions[]` — `txnId`, `direction` (**out · in**), `tagKey`, `amountPaise`, `valueDate`, `reference`, `bill`, `state`, `events[]` |
| `refunds.json` | Refunds, incl. manual | existing shape + `origin` (**subscription · manual**) and a nullable `paymentId` |

Installment status vocabulary — the user's words, exactly:
`Paid` · `Due` · `Fail to pay` · `Cancelled`.

## 6 · Execution plan — nine steps, three parallel fans

| Step | Work | Mode | Depends on |
| --- | --- | --- | --- |
| **1** | This document. | me | — |
| **2** | `types.ts` — the four record types + vocabulary keys, written once so every later step compiles against the same contract. | me | 1 |
| **3** | **Fan A · 4 agents in parallel** — one content seed each (`subscriptions`, `salaries`, `transactions`, `refunds`), all against step 2's contract, all reconciling with the existing seeds (DL-2396 Sandeep Kulkarni, DL-3310 Priya Nair, DL-2291 Meera Iyer, IB-INV-2026-000xx). | parallel | 2 |
| **4** | `vocabularies.json` rewrite — states, tags, event types, metric definitions with formula + caution for every i button. | me | 2 |
| **5** | `store.ts` rewrite — reads four seeds, one clock, integer paise, append-only, derives Overview and KPI. The seam everything else imports. | me | 3, 4 |
| **6** | **Fan B · 5 agents in parallel** — `Subscriptions.tsx`, `Salaries.tsx` + `Slip.tsx`, `OtherTransactions.tsx`, `Refunds.tsx`, `Analytics.tsx`, each against step 5's exported API. | parallel | 5 |
| **7** | Merge: `index.tsx` routing, `Modals.tsx` re-cut, `finance.css`, `charts.tsx` shared move. | me | 6 |
| **8** | **Fan C · 2 agents in parallel** — rewrite `check-finance-ledger.cjs` for four record types; rewrite `fn-smoke.tsx` for five faces and the new dialogs. | parallel | 7 |
| **9** | `tsc -b` · eslint · both check suites · `npm run build`; then BACKEND-INTEGRATION § Module 6 and a dated CHANGELOG entry. | me | 8 |

Fan A is safe to parallelise because step 2 fixes every cross-reference in
advance. Fan B is safe because step 5 fixes the API. Fan C is two independent
files. Everything else is sequential because it is a merge point.

## 7 · What must not regress

1. **A row is a fact.** No new state may mean "recorded but not yet believed".
2. Integer paise everywhere; one clock (`asOf`), never the browser's.
3. Append-only: correction is a counter-entry, never an edit.
4. Theme tokens only — no literal colours; `.fin` / `.fin-*` namespace (`.fn`
   belongs to the theme's funnel segment and must not be reclaimed).
5. Every metric keeps an i button carrying its formula and its caution.
6. Undefined is not zero — CAC without a payer, ARPU without a subscription and
   runway without a burn history all return `null` with a stated reason.
7. The three registration points (`PROTO_ROWS`, `PROTO_MODULES`, `VIEWS`) stay
   consistent, and Users, Deals, Invoices and Team are not touched.

---

## 8 · Outcome — what the operation actually produced

Every step completed. Three fans ran in parallel and merged.

| Verification | Result |
| --- | --- |
| `npx tsc -b` | clean |
| `eslint src/admin/views/Finance src/admin/views/charts.tsx scripts/fn-smoke.tsx --max-warnings=0` | clean |
| `npm run build` | clean |
| `npm run check:finance` | **227 assertions pass** |
| `npm run check:finance-render` | **240 checks pass** — every face, record screen and dialog renders |
| The seven other suites | all pass (`check:enquiries` still needs a backend on :8000, as before this work) |

**~7,700 lines of module, ~4,800 lines of seed.** 20 files added, 6 deleted
(`Payments`, `PaymentDetail`, `Spend`, `Reconciliation`, `Revenue`, `Modals`),
3 content files deleted (`ledger.json`, `spend.json`, `revenue.json`).

### What the checks caught that review would not have

Three defects in code written for this operation, each fixed at the source
rather than asserted around:

1. **`setLop` pro-rated from the salary account, not the slip.** A raise granted
   after a run opened would have silently rewritten a frozen slip — breaking the
   single rule the payslip exists to keep, and the one this document lists as
   invariant #5. Slips now carry `baseEarnings`, frozen when the run opens.
   Setting loss of pay twice is now idempotent, and both properties are asserted.
2. **`setLop` assumed a 30-day month** while every seeded slip used the real one,
   so the store and the seed could not both be right. Loss of pay is now a
   fraction of the actual calendar month.
3. **`syncSubStatus` marked a subscription completed on full payment alone.** A
   twelve-month plan settled up front on day one is paid in full with eleven
   months still to serve; calling that completed drops a live customer out of
   MRR the moment they pay. `completed` now requires the term served — which is
   what the vocabulary said all along. The seed was right and the rule was wrong.

Plus a dangling invoice reference, three salary event types missing from the
vocabulary, an `actor()` reading session fields that do not exist on
`MePermissions`, and — from the shared-chart move — a Users smoke asserting on
renamed classes and one leftover `um-legend2` that had survived a
word-boundary rename because `2` is a word character.

### Decisions revised during execution

- **D-6 stood but narrowed.** The chart kit moved to `views/charts.tsx` and its
  classes were renamed `um-*` → `ch-*`; `.um` and `.um-rec` stayed, because they
  are the Users module roots that carry the validated palette. `.fin` joined
  them rather than restating the values — one palette, validated once, two
  modules.
- **Two preview helpers were added to the store** (`previewSchedule`,
  `previewRun`) after the face agents reported re-implementing the rules to draw
  a preview. A preview computed by a second copy of a rule drifts from the rule
  that runs; there is now one copy of each.

### Still open

- Nothing was clicked in a browser. The SSR smoke renders every surface but
  exercises no real click path — `TxnModal`'s money-in notice in particular sits
  behind local state a static render cannot reach, so the same guarantee is
  asserted on two surfaces that render it without a click.
- The Team join is against a live endpoint this checkout cannot reach.
  `SalaryAccount.memberId` is asserted for shape, never for existence.
