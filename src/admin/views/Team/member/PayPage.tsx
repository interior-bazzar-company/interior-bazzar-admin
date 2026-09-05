/* =============================================================================
   /team/:id/pay — a READ of Finance, and never anything else.
   -----------------------------------------------------------------------------
   TEAM SUPPLIES THE BASIS. FINANCE OWNS THE MONEY. Every figure on this page
   belongs to Module 6; there is no edit control anywhere on it, and every
   button leads INTO Finance rather than writing from here. Two modules writing
   salary is two ledgers, and only one of them reconciles.

   `Incentive` is deliberately Finance's entity even though a work item is what
   earned it: Team knows WHY somebody is owed something, Finance decides whether
   it is paid. That split is why the state runs pending → approved → paid and
   why nothing on this page can advance it.

   This page is hidden from a senior. A reporting line is not a grant to read
   somebody's salary — see ops.ts.
   ============================================================================= */
import { EmptyState, Icon, KvList, Notice, Pill, Table, Tiles } from "../../../ui";
import { go } from "../../../ui/nav";
import { fmtDate, fmtMonth, incentiveTotal, lastPayslip, payFor, readItem } from "../store";
import type { Member } from "../store";
import { OpHead, rupees } from "./frame";

export default function PayPage({ m }: { m: Member }) {
  const p = payFor(m.memberId);

  if (!p || !p.annualCtc) {
    return (
      <>
        <OpHead title="Pay" desc="Read from Finance. Nothing on this page is written by Team." />
        <EmptyState
          icon="cash"
          title="No salary account"
          body={"Finance holds no salary record for " + m.name + ". Team cannot create one — the "
            + "account, the amount and the date it takes effect are all Finance's to write."}
          action={<button className="btn" onClick={() => go("#/finance-salaries")}>Open Finance</button>} />
      </>
    );
  }

  const monthly = Math.round(p.annualCtc / 12);
  const slip = lastPayslip(p);
  const pending = incentiveTotal(p, "pending");
  const approved = incentiveTotal(p, "approved");

  return (
    <>
      <OpHead
        title="Pay"
        desc="Every number here is a read. Team supplies the basis for an incentive; Finance approves and pays it."
        right={<button className="btn" onClick={() => go("#/finance-salaries")}>
          <Icon name="ext" size="sm" />Open in Finance
        </button>} />

      <Tiles list={[
        { k: "Monthly", v: rupees(monthly), s: rupees(p.annualCtc) + " a year" },
        { k: "Last paid", v: slip ? rupees(slip.net) : "—", s: slip ? fmtMonth(slip.month + "-01") : "no payslip yet" },
        { k: "Approved, unpaid", v: rupees(approved), s: approved ? "on the next run" : "nothing waiting" },
        { k: "Awaiting Finance", v: rupees(pending), s: "Team's basis, Finance's call", tone: pending ? "warn" : "" },
      ]} />

      <KvList cls="wide" pairs={[
        ["Salary", <b key="s">{rupees(monthly)}</b>],
        ["Effective from", fmtDate(p.effectiveFrom)],
        ["Paid from", p.account
          ? <>{p.account.bank} <span className="mono cell-2">{p.account.ref}</span></>
          : <span className="faint">no account named</span>],
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
        rows={p.payslips.slice().sort((a, b) => b.month.localeCompare(a.month)).map((s) => (
          <tr key={s.month}>
            <td>{fmtMonth(s.month + "-01", true)}</td>
            <td className="tnum">{rupees(s.base)}</td>
            <td className="tnum">{s.incentive
              ? <span className="u-ok">+ {rupees(s.incentive)}</span>
              : <span className="dim">—</span>}</td>
            <td className="tnum"><b>{rupees(s.net)}</b></td>
            <td>{fmtDate(s.paidAt)}</td>
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
        rows={p.incentives.slice().sort((a, b) => b.month.localeCompare(a.month)).map((i) => {
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
