# Operation · Subscriptions own the lifecycle; Users stops owning memberships

```
task:        Four changes. (1) Record a subscription against a REAL USER, picked
             from the user base, never a typed name. (2) Pick the plan from the
             live Plans catalogue, and let the plan carry the term and the
             price. (3) Rename the agreed total to "Total paid". (4) Remove the
             membership feature from Users Management entirely.

description: These are one change wearing four hats. Finance/Subscriptions now
             records what a customer bought and what they pay for it. Users
             Management has been recording the same thing as a "membership" —
             a term, a plan, a lifecycle, a renewal queue. Two modules holding
             one fact is how they end up disagreeing, and the moment
             Subscriptions became a first-class record type, the membership
             half of Users stopped being the second opinion and started being
             the duplicate. So the subscription grows the two things it was
             missing (a real customer, a real plan) and Users gives up the
             thing it should no longer own.

operation:   Six steps. The three additive changes to the subscription modal
             first, because they are what makes Users' membership redundant and
             they stand on their own if the fourth is ever reversed. Then the
             removal, then the checks, then the docs.

summary:     Finance reads the user base and the Plans catalogue. Users loses
             `memberships.json`, the Membership tab, Assign membership, the
             renewal queue, the lifecycle modal, the Active Member
             classification, and the three analytics blocks keyed on membership.

outcome:     One module owns what a customer bought. Users Management goes back
             to being the register of who exists — identity, profile, status,
             history — and stops carrying a commercial lifecycle that Finance
             now records properly.
```

---

## 1 · What each change actually is

| # | Change | Where |
| --- | --- | --- |
| **1** | The customer is **picked from the user base**, not typed. `userId` becomes the real link; the name is a denormalised copy. | `SubModals.tsx`, `store.ts` |
| **2** | The plan comes from the **live Plans catalogue** (`AdminOpsService.plans()`), and its billing cycle carries **both the term and the price** — so two typed fields become one choice. | `SubModals.tsx` |
| **3** | "The agreed total" → **"Total paid"**. | `SubModals.tsx` |
| **4** | **Membership leaves Users Management.** | 13 files in `views/Users`, 4 seeds, 4 check suites |

## 2 · Decisions

| # | Decision | Why |
| --- | --- | --- |
| **D-1** | Finance reads `src/content/users/users.json` **directly**, the same way it already reads `invoices.json`. It does NOT import `views/Users/store.ts`. | A view importing another module's store couples two modules' lifecycles. Reading the seed is what Finance already does for invoices, and it is the same swap when the endpoint lands. |
| **D-2** | The plan **prefills** the total; the total stays editable. | A negotiated price is a real thing. The catalogue is the default, not a cage — but the figure is then the record, and the installments still have to divide into it exactly. |
| **D-3** | Term stops being its own field. It is the **billing cycle's** `durationMonths`. | It was two fields that had to agree and nothing made them. One choice cannot disagree with itself. |
| **D-4** | The plans fetch has an explicit **loading, error and empty** state, and the dialog stays usable in all three. | Plans is live and this checkout has no backend. A dialog that renders nothing when a fetch fails is a dialog that fails silently in front of a customer. |
| **D-5** | Users keeps identity, profile, status, history, notes, tags and audit. It loses **only** the commercial lifecycle. | Users is the register of who exists. That is a real job and it survives intact. |
| **D-6** | `memberships.json` is **deleted**, not orphaned. | A seed nothing reads is a seed that rots and then misleads whoever finds it. |

## 3 · What change 4 costs, stated plainly

Removing membership is not free, and these are losses, not tidying:

| Lost | Was | Now |
| --- | --- | --- |
| **Active Member** classification | `classify()` split the base into User vs Active Member from live membership state | A user is `active` or `deactivated`. Whether they are paying is a Finance question. |
| **Renewal queue** | terms expiring, sorted by urgency | Gone. Finance's **Due in the next 30 days** is the same question asked of the record that actually holds the money. |
| **Assign membership / lifecycle** | pause, resume, suspend, cancel a term | Gone. A subscription is recorded in Finance and cancelled there. |
| **Conversion, retention, cohort retention** | three Analytics blocks keyed on first membership | Gone from Users. Finance carries MRR, ARPU and the fail-to-pay rate; **retention and cohorts are not rebuilt anywhere and this operation does not pretend otherwise.** |

**This is the one to argue with if any of it is wrong.** Cohort retention in
particular was the only place the panel asked "do they stay", and nothing
replaces it.

## 4 · Risk

The working tree is **uncommitted** — 40-odd files across the Finance redesign
and this. Change 4 deletes a large amount of working, audited code, and with no
commit behind it there is nothing to restore from but this document. The
recommendation is a commit before step 4 runs; it is the user's call, and the
operation proceeds either way because the request was explicit.

## 5 · Execution

| Step | Work | Mode |
| --- | --- | --- |
| **1** | This document. | me |
| **2** | `store.ts` — read the user base; `RecordSubInput` takes a `userId`. | me |
| **3** | `SubModals.tsx` — user picker, plans dropdown with cycles, "Total paid". | me |
| **4** | Remove membership from `views/Users` and its seeds. | parallel agent |
| **5** | Rewrite `check-users-derivation.cjs` and `um-smoke.tsx` for a Users with no memberships. | parallel agent, after 4 |
| **6** | `tsc` · eslint · build · all suites; BACKEND-INTEGRATION and CHANGELOG. | me |

## 6 · What must not regress

1. A subscription's installments still sum to its total, exactly.
2. Integer paise; the plan's price is a decimal string and is converted once.
3. No literal colours; `.fin-*` namespace; every metric keeps its i button.
4. Users Management still renders every remaining surface, and its check suites
   still assert something real rather than being trimmed to fit.
5. Finance does not import `views/Users/store.ts`.
