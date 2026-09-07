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
import { EmptyState, Icon, KvList, Notice, Pill, Table, Tiles } from "../../../ui";
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
  const account = readSalaryAccounts().filter((a) => String(a.memberId) === m.memberId)[0] || null;

  /* THE INCENTIVES STAY TEAM'S. The work item one was earned against is a Team
     record and the pay record is where the basis is written down. Null is
     ordinary here: somebody Finance pays may have earned nothing. */
  const pay = payFor(m.memberId);
  const pending = incentiveTotal(pay, "pending");
  const approved = incentiveTotal(pay, "approved");

  if (!account) {
    return (
      <>
        <OpHead title="Pay" desc="Read from Finance. Nothing on this page is written by Team." />
        <EmptyState
          icon="cash"
          title="No salary account in Finance yet"
          body={"Finance holds no salary record for " + m.name + ". Team cannot create one — the "
            + "account, the amount and the date it takes effect are all Finance's to write."}
          action={<button className="btn" onClick={() => go("#/finance-salaries")}>Open Finance</button>} />
      </>
    );
  }

  const monthlyPaise = account.monthlyGrossPaise;
  const slips = slipsOf(account.salaryAccountId);
  /* The last slip that was actually PAID, which is not the last slip issued: a
     run still open carries slips nobody has been paid from yet. */
  const slip = slips.filter((s) => !!s.paidAt)[0] || null;

  return (
    <>
      <OpHead
        title="Pay"
        desc="Every number here is a read. Team supplies the basis for an incentive; Finance approves and pays it."
        right={<button className="btn" onClick={() => go("#/finance-salaries")}>
          <Icon name="ext" size="sm" />Open in Finance
        </button>} />

      <Tiles list={[
        { k: "Monthly", v: inr(monthlyPaise), s: inr(monthlyPaise * 12) + " a year" },
        { k: "Last paid", v: slip ? inr(slip.netPaise) : "—", s: slip ? fmtMonth(slip.month + "-01") : "no payslip paid yet" },
        { k: "Approved, unpaid", v: rupees(approved), s: approved ? "on the next run" : "nothing waiting" },
        { k: "Awaiting Finance", v: rupees(pending), s: "Team's basis, Finance's call", tone: pending ? "warn" : "" },
      ]} />

      <KvList cls="wide" pairs={[
        ["Salary", <b key="s">{inr(monthlyPaise)}</b>],
        ["Joined", fmtDate(account.joinedAt)],
        ["Paid from", <>{account.bank.name} <span className="mono cell-2">{account.bank.masked}</span></>],
        ["Department", m.department
          ? <>{m.department} <span className="cell-2">read from the member record, not retyped here</span></>
          : <span className="faint">—</span>],
      ]} />

      <SectionRule title="Payslips" desc="An incentive that was paid appears on the slip it went out with, so the two lists cannot disagree." />
      <Table
        cols={[{ label: "Month", w: "160px" }, { label: "Salary", w: "150px" },
          { label: "Incentive", w: "170px" }, { label: "Net", w: "150px" },
          { label: "Paid", w: "150px" }, { label: "", cls: "n" }]}
        empty={{
          icon: "cash", title: "No payslip yet",
          body: "Nothing has run for this member. The first slip appears after the first pay run that includes them.",
        }}
        rows={slips.map((s) => (
          <tr key={s.slipId}>
            <td>{fmtMonth(s.month + "-01", true)}</td>
            <td className="tnum">{inr(fixedOf(s))}</td>
            <td className="tnum">{incentiveOf(s)
              ? <span className="u-ok">+ {inr(incentiveOf(s))}</span>
              : <span className="dim">—</span>}</td>
            <td className="tnum"><b>{inr(s.netPaise)}</b></td>
            <td>{s.paidAt ? fmtDate(s.paidAt) : <span className="faint">not paid yet</span>}</td>
            <td className="n">
              <button className="btn sm" onClick={() => go("#/finance-salaries")}>
                <Icon name="download" size="sm" />Finance
              </button>
            </td>
          </tr>
        ))} />

      <SectionRule title="Incentives"
        desc="The join the brief asked for, read in both directions: from a target, what did it earn — from a member, what have they earned." />
      <Table
        cols={[{ label: "Month", w: "150px" }, { label: "Earned against" },
          { label: "Amount", w: "160px" }, { label: "State", w: "150px" }]}
        empty={{
          icon: "star", title: "No incentives",
          body: "Nothing has been proposed against this member's work.",
        }}
        rows={(pay ? pay.incentives : []).slice().sort((a, b) => b.month.localeCompare(a.month)).map((i) => {
          /* An incentive names the work item it was earned against, so the item
             is looked up and its own LIVE progress rides along. Restating the
             number in the pay record would give the panel two answers to "how
             far along is that target", and the stale one would be the one
             somebody quotes. */
          const item = i.workItemId ? readItem(i.workItemId) : null;
          return (
            <tr key={i.incentiveId}>
              <td>{fmtMonth(i.month + "-01")}</td>
              <td>
                {item ? (
                  <button className="lnk" onClick={() => go("#/work?item=" + item.itemId)}>{item.title}</button>
                ) : <span className="cell-1">{i.basis}</span>}
                {item && item.targetValue
                  ? <span className="cell-2">{item.currentValue || 0} of {item.targetValue} {item.targetUnit || ""}</span>
                  : null}
              </td>
              <td className="tnum"><b>{rupees(i.amount)}</b></td>
              <td>
                <Pill text={i.state}
                  tone={i.state === "paid" ? "ok" : i.state === "approved" ? "info" : "warn"} />
              </td>
            </tr>
          );
        })} />

      <Notice ico="lock" text={
        <><b>Read-only, by construction.</b> Finance approves an incentive, not the captain — the
          captain proposes it from a work item. If this page needs a shape Finance does not expose,
          the change belongs in Finance's own operation doc and not here.</>
      } />
    </>
  );
}

/** A heading with a rule under it. `SectionHead` in ui/ carries an action slot
 *  this page has no use for — every action here is one link, at the top. */
function SectionRule({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="sh">
      <h2>{title}</h2>
      <span className="d">{desc}</span>
    </div>
  );
}
