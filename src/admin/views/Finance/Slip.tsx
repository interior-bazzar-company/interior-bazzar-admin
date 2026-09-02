/* =============================================================================
   Finance · the payslip.
   -----------------------------------------------------------------------------
   This is the deliverable. Everything else in Salaries A/C exists so that this
   page can be handed to a person: their name, their month, what they earned,
   what came off it, what reached their bank, and a number and a hash that say
   the company stands behind it.

   IT IS A DOCUMENT, NOT A SCREEN. The figures come off the slip's OWN frozen
   arrays — copied onto it when the run was opened and stamped when the run was
   paid — never read through to the salary account. A raise in August must not
   silently rewrite the June slip somebody already filed with their landlord.

   A SLIP ON AN OPEN RUN IS A DRAFT. It carries no number and no hash, because
   nothing has been paid. It is drawn plainly as a draft rather than hidden:
   the person preparing the run needs to see exactly what will go out.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import { useShell } from "../../shell/ShellContext";
import { useNav } from "../../shell/AdminShell";
import { EmptyState, Icon } from "../../ui";
import { PaySalaryModal } from "./SalaryModals";
import LOGO from "../../../assets/images/IB_Icon.png";
import {
  COMPANY, accountOf, fmtDate, fmtDateTime, fmtMonth, inr, inrWordsOf, payViaMeta,
  useSalaryAccount, useSlip,
} from "./store";
import type { Params, SalaryComponent } from "./store";

const sum = (l: SalaryComponent[]) => l.reduce((n, c) => n + c.amountPaise, 0);

export default function Slip({ id, p }: {
  id: string;
  p: Params;
  onParams: (patch: Params) => void;
}) {
  const { toast, modal, closeLayer } = useShell();
  const { go: navGo } = useNav();
  const hit = useSlip(id);
  const row = useSalaryAccount(hit ? hit.slip.salaryAccountId : null);
  /* PAN and UAN live on the account rather than the slip. They are identity,
     not money: they do not change between runs, and a slip that carried its own
     stale copy of a corrected PAN would be worse than one that reads the
     current record. Every rupee below still comes off the slip. */

  const back = "#/finance-salaries"
    + Object.keys(p)
      .filter((k) => p[k] && ["view", "tab", "run"].indexOf(k) < 0)
      .map((k) => "&" + encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
      .join("");

  if (!hit) {
    return (
      <div className="fin-rec">
        <EmptyState icon="search" title="No payslip at that address"
          body={<>There is no slip for <span className="mono">{id}</span>.</>}
          action={<button className="btn pri" onClick={() => navGo(back)}>Back to Salaries A/C</button>} />
      </div>
    );
  }

  const { slip, run } = hit;
  const draft = run.state === "open" || slip.issuedAt === null;

  /* Computed here, from the slip's own arrays, and never taken on trust from
     the totals stored beside them. Integer paise throughout: gross is the sum
     of the earnings PLUS the incentives, net is gross minus the deductions,
     and there is no third way to arrive at either.

     THE INCENTIVE WAS MISSING FROM THIS SUM and that made the document wrong
     in the worst way available to it: the slip printed a gross lower than the
     money that moved, and therefore a NET LOWER THAN THE TRANSFER — a payslip
     disagreeing with the bank in the employee's favour to look at, and against
     them on paper. It is a separate array precisely so loss of pay cannot
     pro-rate it, and reading `earnings` alone quietly turned that separation
     into an omission. */
  const incentives = slip.incentives || [];
  const gross = sum(slip.earnings) + sum(incentives);
  const ded = sum(slip.deductions);
  const net = gross - ded;

  /* Earnings then incentives down the left column, deductions down the right.
     The incentive sits WITH the earnings because that is what it is on a
     payslip — money paid — and is marked, because what it is not is part of
     the salary this person can count on next month. */
  const left = slip.earnings.concat(incentives);
  const lines = Math.max(left.length, slip.deductions.length);
  const paidFrom = accountOf(slip.accountId);
  /* How it was paid, in the words somebody actually says. `mode` is the
     ledger's vocabulary (NEFT / UPI / Cash) and stays what it was; `via` is
     the choice a person made in the dialog, and it was stored and never once
     displayed. */
  const via = payViaMeta(slip.via || "");

  return (
    <div className="fin-rec">
      {/* Above the document, and out of the print entirely — `.fin-actions` is
          already display:none when this page goes to paper. */}
      <div className="fin-actions">
        <span className="spacer" />
        <span className={"pill " + (draft ? "warn" : "ok")}>{draft ? "Draft" : "Paid"}</span>
        <span className="fin-vsep" aria-hidden="true" />
        <MoreMenu
          onDownload={() => window.print()}
          pay={draft ? () => row && modal(
            <PaySalaryModal row={row} onClose={closeLayer}
              onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide") : null}
          payDisabled={!row}
          share={draft ? null : () => toast(slip.memberName + " would get " + slip.slipId + " at their registered email. Nothing was sent — no mail transport is wired to this module yet.", "info")} />
        <button className="btn pri" onClick={() => navGo(back)}>
          <Icon name="chevl" size="sm" />Back
        </button>
      </div>

      {/* ======================================================== the doc === */}
      <div className="fin-doc fin-slip">
        {/* The watermark sits behind everything, aria-hidden and unselectable:
            it is presentation, and a screen reader or a copy-paste must never
            meet it. Light enough that every figure stays legible over it, on
            screen and on paper. */}
        <div className="fin-wm" aria-hidden="true">{COMPANY.brand}</div>
        <div className="dh">
          <div className="fin-slip-brand">
            {/* IB_Icon carries its own ground (it is a JPEG, no alpha), so
                it needs no tile - just the corner radius of a letterhead
                mark. */}
            <img className="fin-slip-logo" src={LOGO} alt="" />
            <div>
              <h3>{COMPANY.brand}</h3>
            <div className="fin-slip-co">
              {COMPANY.name}<br />
              {COMPANY.address}<br />
              CIN <span className="mono">{COMPANY.cin}</span>
            </div>
            </div>
          </div>
          <div className="r">
            <div className="fin-slip-title">Payslip for {fmtMonth(slip.month)}</div>
            {draft ? (
              <div>Draft</div>
            ) : (
              <>
                <div className="mono">{slip.slipId}</div>
                <div>Issued {fmtDateTime(slip.issuedAt)}</div>
              </>
            )}
          </div>
        </div>

        <div className="pty">
          <div>
            <div className="t">Employee</div>
            <b>{slip.memberName}</b>
            <div>{slip.designation}</div>
            <div className="mono">{slip.employeeCode}</div>
            <div>PAN <span className="mono">{slip.pan || "—"}</span></div>
            <div>UAN <span className="mono">{slip.uan || "—"}</span></div>
          </div>
          <div>
            <div className="t">Paid into</div>
            <b>{slip.bank.name}</b>
            <div className="mono">{slip.bank.masked}</div>
            <div>IFSC <span className="mono">{slip.bank.ifsc}</span></div>
            <div>
              {via ? via.label : slip.mode}
              {slip.reference ? <> · <span className="mono">{slip.reference}</span></> : null}
            </div>
            {paidFrom ? <div>From {paidFrom.masked}</div> : null}
            {/* THE RECEIPT, WHICH NOTHING IN THIS MODULE USED TO SHOW. The pay
                dialog refuses a payment without one — it is the only evidence a
                salary payment has, since the typed bank reference was removed —
                and then the filename was written to the slip and rendered on no
                screen at all. Evidence nobody can see is evidence nobody can
                check, which is the same as none at audit. It belongs here,
                beside how the money moved. */}
            {slip.proof
              ? <div className="fin-slip-proof">
                Receipt <span className="mono">{slip.proof.filename}</span>
              </div>
              : !draft && !slip.reference
                ? <div className="fin-slip-proof none">No receipt on this payment</div>
                : null}
          </div>
        </div>

        <div className="fin-slip-meta">
          <span><i>Month</i><b>{fmtMonth(slip.month)}</b></span>
          <span><i>Paid days</i><b className="tnum">{slip.paidDays} of {slip.paidDays + slip.lopDays}</b></span>
          <span><i>Loss of pay</i><b className="tnum">{slip.lopDays}</b></span>
          <span><i>Paid on</i><b>{slip.paidAt ? fmtDate(slip.paidAt) : "not yet"}</b></span>
        </div>

        <table className="tbl fin-slipt">
          <thead>
            <tr>
              <th>Earnings</th>
              <th className="num">Amount</th>
              <th>Deductions</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: lines }, (_unused, i) => {
              const e = left[i];
              const d = slip.deductions[i];
              const earned = e ? i >= slip.earnings.length : false;
              return (
                <tr key={i}>
                  <td>{e ? e.label : ""}{earned ? <span className="fin-earned">earned</span> : null}</td>
                  <td className="num tnum">{e ? inr(e.amountPaise) : ""}</td>
                  <td>{d ? d.label : ""}</td>
                  <td className="num tnum">{d ? inr(d.amountPaise) : ""}</td>
                </tr>
              );
            })}
            <tr className="tot">
              <td>Gross earnings</td>
              <td className="num tnum">{inr(gross)}</td>
              <td>Total deductions</td>
              <td className="num tnum">{ded ? inr(ded) : inr(0)}</td>
            </tr>
          </tbody>
        </table>

        <div className="fin-slip-net">
          <span className="l">Net pay</span>
          <span className="v tnum">{inr(net)}</span>
        </div>
        <p className="words">{inrWordsOf(net)}</p>

        {/* WHOEVER PAID IT WROTE THIS, and until now it was stored and shown
            nowhere. Never load-bearing — no total reads a remark — but it is
            the only place the reason for an unusual month is recorded in
            words, and a slip that drops it makes somebody go and ask. */}
        {slip.remark ? <p className="fin-slip-remark">{slip.remark}</p> : null}
        <div className="terms">
          {/* THE MONTH'S REAL LENGTH, not a notional thirty. This line said "on a
              thirty-day month" and the module has never computed one: `setLop`
              divides by `daysInMonth`, the type says so in as many words, and a
              check asserts it. A payslip is the one document somebody
              recalculates by hand when they disagree with it, and this sentence
              was telling them to do the arithmetic wrongly. */}
          {slip.lopDays
            ? "Earnings are pro-rated for " + slip.lopDays + " day"
              + (slip.lopDays === 1 ? "" : "s") + " of loss of pay, over the real length of "
              + fmtMonth(slip.month) + " — " + slip.paidDays + " paid days of "
              + (slip.paidDays + slip.lopDays) + ". "
              + "Deductions are not pro-rated: they are flat monthly amounts.\n"
            : ""}
          {/* An incentive is named as the thing it is, and only when there is
              one. Somebody reading a slip with an unusually large month on it
              should not have to work out for themselves which half of it they
              can expect again. */}
          {incentives.length
            ? "The " + (incentives.length === 1 ? "line" : "lines") + " marked earned "
              + (incentives.length === 1 ? "is an incentive" : "are incentives")
              + " and not salary: " + inr(sum(incentives))
              + " for this month, not payable again unless earned again, and not reduced by loss of pay. "
            : ""}
          {draft
            ? "This is a draft. No payment has been made, no slip number has been allotted and no hash has been computed. It is not a record of anything yet.\n"
            : "This payslip is computer-generated and needs no signature.\n"}
          {"The earnings and deductions above were frozen onto this slip when it was issued. "
            + "A later revision to the salary account does not change them, which is why this "
            + "document can be relied on after the fact."}
        </div>
      </div>
    </div>
  );
}

/* The row's actions behind one plain button, in the module's own `fin-menu`
   popover — the same shell and `.mi` rows the transactions table uses, so the
   two menus cannot drift apart in look. Exactly one of `pay` / `share` is
   passed: a draft can be paid, a paid slip can be shared. */
function MoreMenu({ onDownload, pay, payDisabled, share }: {
  onDownload: () => void;
  pay: (() => void) | null;
  payDisabled: boolean;
  share: (() => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  const item = (icon: string, label: string, act: () => void, disabled?: boolean) => (
    <button type="button" role="menuitem" className="mi" disabled={disabled}
      onClick={() => { setOpen(false); act(); }}>
      <Icon name={icon} size="sm" />{label}
    </button>
  );

  return (
    <span className="fin-menu" ref={box}>
      <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(!open)}>More</button>
      {open ? (
        <span className="fin-menu-pop" role="menu" aria-label="Payslip actions">
          {item("download", "Download", onDownload)}
          {pay ? item("cash", "Pay", pay, payDisabled) : null}
          {share ? item("ext", "Share", share) : null}
        </span>
      ) : null}
    </span>
  );
}
