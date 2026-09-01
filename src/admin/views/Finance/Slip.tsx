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
import { useShell } from "../../shell/ShellContext";
import { useNav } from "../../shell/AdminShell";
import { EmptyState, Icon } from "../../ui";
import { ProtoBar, RunPill } from "./bits";
import LOGO from "../../../assets/images/IB_Icon.png";
import {
  COMPANY, accountOf, fmtDate, fmtDateTime, fmtMonth, inr, inrWordsOf, useSlip,
} from "./store";
import type { Params, SalaryComponent } from "./store";

const sum = (l: SalaryComponent[]) => l.reduce((n, c) => n + c.amountPaise, 0);

export default function Slip({ id, p }: {
  id: string;
  p: Params;
  onParams: (patch: Params) => void;
}) {
  const { toast } = useShell();
  const { go: navGo } = useNav();
  const hit = useSlip(id);
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
        <ProtoBar />
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
     of the earnings, net is gross minus the deductions, and there is no third
     way to arrive at either. */
  const gross = sum(slip.earnings);
  const ded = sum(slip.deductions);
  const net = gross - ded;

  const lines = Math.max(slip.earnings.length, slip.deductions.length);
  const paidFrom = accountOf(slip.accountId);
  const toAccount = "#/finance-salaries/" + encodeURIComponent(slip.salaryAccountId) + "?tab=slips";

  return (
    <div className="fin-rec">
      <ProtoBar />

      {/* Above the document, and out of the print entirely — `.fin-actions` is
          already display:none when this page goes to paper. */}
      <div className="fin-actions">
        <button className="btn sm" onClick={() => navGo(toAccount)}>
          <Icon name="chevl" size="sm" />{slip.memberName}'s account
        </button>
        <RunPill k={run.state} />
        {draft ? <span className="pill warn">Draft · not issued</span> : null}
        <span className="spacer" />
        {/* PRINTING IS HOW EVERY DOCUMENT IN THIS PANEL BECOMES A PDF. There is
            no PDF library in the bundle and there should not be one: the print
            stylesheet already governs how this page lays out on paper, and
            "Save as PDF" in the browser's print dialog produces a selectable,
            searchable file from the same markup. A second renderer would be a
            second definition of what the slip looks like. */}
        <button className="btn" onClick={() => window.print()}>
          <Icon name="download" size="sm" />Download
        </button>
        <button className="btn pri" disabled={draft}
          title={draft ? "Nothing has been paid. A draft is not sent to anybody." : undefined}
          onClick={() => toast(slip.memberName + " would get " + slip.slipId + " at their registered email. Nothing was sent — no mail transport is wired to this module yet.", "info")}>
          <Icon name="mega" size="sm" />Send to member
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
              GSTIN <span className="mono">{COMPANY.gstin}</span><br />
              CIN <span className="mono">{COMPANY.cin}</span>
            </div>
            </div>
          </div>
          <div className="r">
            <div className="fin-slip-title">Payslip for {fmtMonth(slip.month)}</div>
            {draft ? (
              <div className="fin-slip-stamp">Draft — no slip number until the run is paid</div>
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
              {slip.mode}
              {slip.reference ? <> · <span className="mono">{slip.reference}</span></> : null}
            </div>
            {paidFrom ? <div>From {paidFrom.masked}</div> : null}
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
              const e = slip.earnings[i];
              const d = slip.deductions[i];
              return (
                <tr key={i}>
                  <td>{e ? e.label : ""}</td>
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

        <div className="terms">
          {slip.lopDays
            ? "Earnings are pro-rated for " + slip.lopDays + " day"
              + (slip.lopDays === 1 ? "" : "s") + " of loss of pay, on a thirty-day month. "
              + "Deductions are not pro-rated: they are flat monthly amounts.\n"
            : ""}
          {draft
            ? "This is a draft. No payment has been made, no slip number has been allotted and no hash has been computed. It is not a record of anything yet.\n"
            : "This payslip is computer-generated and needs no signature.\n"}
          {draft || !slip.sha256 ? "" : "Document hash (SHA-256): " + slip.sha256 + "\n"}
          {"The earnings and deductions above were frozen onto this slip when it was issued. "
            + "A later revision to the salary account does not change them, which is why this "
            + "document can be relied on after the fact."}
        </div>
      </div>
    </div>
  );
}
