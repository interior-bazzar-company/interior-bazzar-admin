/* =============================================================================
   /team/:id/pay — a READ of Finance, and never anything else.
   -----------------------------------------------------------------------------
   TEAM SUPPLIES THE BASIS. FINANCE OWNS THE MONEY. Every figure on this page
   belongs to Module 6; there is no edit control anywhere on it, and every
   button leads INTO Finance rather than writing from here. Two modules writing
   salary is two ledgers, and only one of them reconciles.

   AND IT NOW READS THE ONE THAT RECONCILES. The salary and the payslips came
   off Team's own pay fixture — a second copy of Finance's figures, written by
   hand, that could disagree with Salaries A/C and had no way of ever learning
   that it did. The header above claimed Module 6 while the numbers underneath
   it said otherwise. They come from Finance's store now: the salary account
   found by `memberId`, the slips off the runs that issued them, in integer
   paise through Finance's own `inr` — so a figure reads here exactly as it
   reads on the payslip itself.

   `Incentive` is deliberately Finance's entity even though a work item is what
   earned it: Team knows WHY somebody is owed something, Finance decides whether
   it is paid. That split is why the state runs pending → approved → paid and
   why nothing on this page can advance it. The incentive LEDGER below is still
   read from Team, because the basis — which target, and how far along it is —
   is Team's to answer and Finance holds none of it.

   This page is hidden from a senior. A reporting line is not a grant to read
   somebody's salary — see ops.ts.
   ============================================================================= */
import { Button, Card, EmptyState, KvList, ListTable, Notice, Pill, Tiles } from "../../../ui";
import { go } from "../../../ui/nav";
import { fmtDate, fmtMonth, incentiveTotal, payFor, readItem } from "../store";
import type { Member } from "../store";
import { fixedOf, incentiveOf, inr, readSalaryAccounts, slipsOf, useVersion } from "../../Finance/store";
import { OpHead, rupees } from "./frame";

export default function PayPage({ m }: { m: Member }) {
  /* Subscribed to FINANCE's version and not Team's: a salary paid in the other
     module has to reach this page without anybody reloading it. */
  useVersion();
  /* Finance keys a salary account by the member it belongs to, as a number.
     No match is the honest answer for somebody Finance has never opened an
     account for, and it is what this draws rather than an invented zero. */
  /* The OPEN account first: Finance appends a re-opened account after the
     closed one, and a member's pay is whichever is still being paid. */
  const account = readSalaryAccounts().filter((a) => String(a.memberId) === m.memberId)
    .sort((a, b) => Number(b.active) - Number(a.active))[0] || null;

  /* THE INCENTIVES STAY TEAM'S. The work item one was earned against is a Team
     record and the pay record is where the basis is written down. Null is
     ordinary here: somebody Finance pays may have earned nothing. */
  const pay = payFor(m.memberId);
  const pending = incentiveTotal(pay, "pending");
  const approved = incentiveTotal(pay, "approved");

  if (!account) {
    return (
      <div className="flex flex-col gap-5">
        <OpHead title="Pay" desc="Read from Finance. Nothing on this page is written by Team." />
        <EmptyState
          icon="cash"
          title="No salary account in Finance yet"
          body={"Finance holds no salary record for " + m.name + ". Team cannot create one — the "
            + "account, the amount and the date it takes effect are all Finance's to write."}
          action={<Button color="secondary" ico="ext" onClick={() => go("#/finance-salaries")}>Open Finance</Button>} />
      </div>
    );
  }

  const monthlyPaise = account.monthlyGrossPaise;
  const slips = slipsOf(account.salaryAccountId);
  /* The last slip that was actually PAID, which is not the last slip issued: a
     run still open carries slips nobody has been paid from yet. */
  const slip = slips.filter((s) => !!s.paidAt)[0] || null;
  const incentives = (pay ? pay.incentives : []).slice().sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="flex flex-col gap-5">
      <OpHead
        title="Pay"
        desc="Every number here is a read. Team supplies the basis for an incentive; Finance approves and pays it."
        right={
          <Button color="secondary" ico="ext" onClick={() => go("#/finance-salaries")}>Open in Finance</Button>
        } />

      <Tiles list={[
        { k: "Monthly", v: inr(monthlyPaise), s: inr(monthlyPaise * 12) + " a year" },
        { k: "Last paid", v: slip ? inr(slip.netPaise) : "—", s: slip ? fmtMonth(slip.month + "-01") : "no payslip paid yet" },
        { k: "Approved, unpaid", v: rupees(approved), s: approved ? "on the next run" : "nothing waiting" },
        { k: "Awaiting Finance", v: rupees(pending), s: "Team's basis, Finance's call", tone: pending ? "warn" : "" },
      ]} />

      <Card title="The account" sub="Finance's record, read here and written there.">
        <div className="grid gap-x-8 gap-y-2.5 lg:grid-cols-2">
          <KvList
            pairs={[
              ["Salary", <b key="s" className="font-mono font-semibold tnum">{inr(monthlyPaise)}</b>],
              ["Joined", <span key="j" className="tnum">{fmtDate(account.joinedAt)}</span>],
            ]}
          />
          <KvList
            pairs={[
              ["Paid from", <span key="b" className="flex flex-col">
                {account.bank.name}
                <span className="font-mono text-xs text-tertiary tnum">{account.bank.masked}</span>
              </span>],
              ["Department", m.department
                ? <span key="d" className="flex flex-col">
                  {m.department}
                  <span className="text-xs text-quaternary">read from the member record, not retyped here</span>
                </span>
                : ""],
            ]}
          />
        </div>
      </Card>

      <section className="flex flex-col">
        <OpHead
          title="Payslips"
          desc="An incentive that was paid appears on the slip it went out with, so the two lists cannot disagree." />
        <ListTable min="52rem" head={<tr>
          <th scope="col">Month</th>
          <th scope="col" className="n">Salary</th>
          <th scope="col" className="n">Incentive</th>
          <th scope="col" className="n">Net</th>
          <th scope="col">Paid</th>
          <th scope="col" className="acts"><span className="sr-only">Slip</span></th>
        </tr>}>
          {slips.map((s) => (
            <tr key={s.slipId}>
              <td className="cell-1">{fmtMonth(s.month + "-01", true)}</td>
              <td className="n">{inr(fixedOf(s))}</td>
              <td className="n">{incentiveOf(s)
                ? <span className="text-success-primary">+ {inr(incentiveOf(s))}</span>
                : <span className="text-quaternary">—</span>}</td>
              <td className="n font-semibold text-primary">{inr(s.netPaise)}</td>
              <td className="tnum">{s.paidAt ? fmtDate(s.paidAt) : <span className="text-quaternary">not paid yet</span>}</td>
              <td className="acts">
                <Button color="secondary" size="xs" ico="download" onClick={() => go("#/finance-salaries")}>
                  Slip
                </Button>
              </td>
            </tr>
          ))}
          {slips.length ? null : (
            <tr>
              <td colSpan={6} className="p-0!">
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-primary">No payslip yet</p>
                  <p className="mt-1 text-sm text-tertiary">
                    Nothing has run for this member. The first slip appears after the first pay run
                    that includes them.
                  </p>
                </div>
              </td>
            </tr>
          )}
        </ListTable>
      </section>

      <section className="flex flex-col">
        <OpHead
          title="Incentives"
          desc="The join read in both directions: from a target, what did it earn — from a member, what have they earned." />
        <ListTable min="46rem" head={<tr>
          <th scope="col">Month</th>
          <th scope="col">Earned against</th>
          <th scope="col" className="n">Amount</th>
          <th scope="col">State</th>
        </tr>}>
          {incentives.map((i) => {
            /* An incentive names the work item it was earned against, so the item
               is looked up and its own LIVE progress rides along. Restating the
               number in the pay record would give the panel two answers to "how
               far along is that target", and the stale one would be the one
               somebody quotes. */
            const item = i.workItemId ? readItem(i.workItemId) : null;
            return (
              <tr key={i.incentiveId}>
                <td className="tnum">{fmtMonth(i.month + "-01")}</td>
                <td className="cell-1">
                  {item ? (
                    <button type="button"
                      className="cursor-pointer rounded text-left text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      onClick={() => go("#/work?item=" + item.itemId)}>
                      {item.title}
                    </button>
                  ) : i.basis}
                  {item && item.targetValue
                    ? <span className="block cell-2 tnum">{item.currentValue || 0} of {item.targetValue} {item.targetUnit || ""}</span>
                    : null}
                </td>
                <td className="n font-semibold text-primary">{rupees(i.amount)}</td>
                <td>
                  <Pill xs dot text={i.state}
                    tone={i.state === "paid" ? "ok" : i.state === "approved" ? "info" : "warn"} />
                </td>
              </tr>
            );
          })}
          {incentives.length ? null : (
            <tr>
              <td colSpan={4} className="p-0!">
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-primary">No incentives</p>
                  <p className="mt-1 text-sm text-tertiary">Nothing has been proposed against this member's work.</p>
                </div>
              </td>
            </tr>
          )}
        </ListTable>
      </section>

      <Notice ico="lock" text={
        <><b>Read-only, by construction.</b> Finance approves an incentive, not the captain — the
          captain proposes it from a work item. If this page needs a shape Finance does not expose,
          the change belongs in Finance's own operation doc and not here.</>
      } />
    </div>
  );
}
