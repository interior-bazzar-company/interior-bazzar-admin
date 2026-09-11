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

   IT IS PAPER IN BOTH THEMES. The whole panel inverts and this one surface does
   not: the colours below are the only literal utilities in the module, because
   a payslip that comes out of the printer dark is not a payslip. Everything
   outside the paper — the command row above it — is on the tokens and is
   dropped entirely by `print:`.

   A SLIP ON AN OPEN RUN IS A DRAFT. It carries no number and no hash, because
   nothing has been paid. It is drawn plainly as a draft rather than hidden:
   the person preparing the run needs to see exactly what will go out.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { useNav } from "../../shell/AdminShell";
import { Button, EmptyState, Pill } from "../../ui";
import { MoreMenu } from "../../ui/menu";
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
      <div className="flex min-w-0 flex-col gap-4">
        <EmptyState icon="search" title="No payslip at that address"
          body={<>There is no slip for <span className="font-mono tnum">{id}</span>.</>}
          action={<Button color="primary" onClick={() => navGo(back)}>Back to Salaries A/C</Button>} />
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
    <div className="flex min-w-0 flex-col gap-4">
      {/* Above the document, and out of the print entirely. */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="font-mono text-sm font-semibold text-primary tnum">{slip.slipId}</span>
        <Pill dot tone={draft ? "warn" : "ok"} text={draft ? "Draft" : "Paid"} />
        <span className="flex-1" />
        <MoreMenu items={[
          { icon: "print", label: "Print or save as PDF", act: () => window.print() },
          draft
            ? {
              icon: "cash", label: "Pay", disabled: !row,
              title: row ? undefined : "The salary account behind this slip is missing.",
              act: () => row && modal(
                <PaySalaryModal row={row} onClose={closeLayer}
                  onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "lg"),
            }
            : {
              icon: "share", label: "Share with the member",
              act: () => toast(slip.memberName + " would get " + slip.slipId + " at their registered email. Nothing was sent — no mail transport is wired to this module yet.", "info"),
            },
        ]} />
        <Button color="primary" ico="chevl" onClick={() => navGo(back)}>Back</Button>
      </div>

      {/* ======================================================== the doc === */}
      <article className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl bg-white p-6 text-neutral-900 shadow-xs ring-1 ring-neutral-200 sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        {/* The watermark sits behind everything, aria-hidden and unselectable:
            it is presentation, and a screen reader or a copy-paste must never
            meet it. Light enough that every figure stays legible over it, on
            screen and on paper. */}
        <div aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-bold tracking-widest text-neutral-900/[0.035] uppercase select-none sm:text-8xl">
          {COMPANY.brand}
        </div>

        <div className="relative">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral-200 pb-5">
            <div className="flex min-w-0 items-start gap-3">
              {/* IB_Icon carries its own ground (it is a JPEG, no alpha), so
                  it needs no tile — just the corner radius of a letterhead
                  mark. */}
              <img className="size-11 shrink-0 rounded-lg" src={LOGO} alt="" />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight">{COMPANY.brand}</h3>
                <div className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                  {COMPANY.name}<br />
                  {COMPANY.address}<br />
                  CIN <span className="font-mono tnum">{COMPANY.cin}</span>
                </div>
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-sm font-semibold">Payslip for {fmtMonth(slip.month)}</div>
              {draft ? (
                <div className="mt-0.5 text-xs text-neutral-600">Draft</div>
              ) : (
                <>
                  <div className="mt-0.5 font-mono text-xs tnum text-neutral-700">{slip.slipId}</div>
                  <div className="text-xs text-neutral-600">Issued {fmtDateTime(slip.issuedAt)}</div>
                </>
              )}
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 border-b border-neutral-200 py-5 sm:grid-cols-2">
            <div className="min-w-0 text-sm text-neutral-700">
              <div className="text-2xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">Employee</div>
              <div className="mt-1 font-semibold text-neutral-900">{slip.memberName}</div>
              <div>{slip.designation}</div>
              <div className="font-mono text-xs tnum">{slip.employeeCode}</div>
              <div>PAN <span className="font-mono tnum">{slip.pan || "—"}</span></div>
              <div>UAN <span className="font-mono tnum">{slip.uan || "—"}</span></div>
            </div>
            <div className="min-w-0 text-sm text-neutral-700">
              <div className="text-2xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">Paid into</div>
              <div className="mt-1 font-semibold text-neutral-900">{slip.bank.name}</div>
              <div className="font-mono text-xs tnum">{slip.bank.masked}</div>
              <div>IFSC <span className="font-mono tnum">{slip.bank.ifsc}</span></div>
              <div>
                {via ? via.label : slip.mode}
                {slip.reference ? <> · <span className="font-mono tnum">{slip.reference}</span></> : null}
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
                ? <div className="mt-1 text-xs text-neutral-600">
                  Receipt <span className="font-mono">{slip.proof.filename}</span>
                </div>
                : !draft && !slip.reference
                  ? <div className="mt-1 text-xs text-neutral-500 italic">No receipt on this payment</div>
                  : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-neutral-200 py-4 sm:grid-cols-4">
            {([
              ["Month", fmtMonth(slip.month)],
              ["Paid days", slip.paidDays + " of " + (slip.paidDays + slip.lopDays)],
              ["Loss of pay", String(slip.lopDays)],
              ["Paid on", slip.paidAt ? fmtDate(slip.paidAt) : "not yet"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="text-2xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">{k}</div>
                <div className="mt-0.5 text-sm font-semibold tnum">{v}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto py-5">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-2xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                  <th scope="col" className="py-2 pr-3 text-left font-semibold">Earnings</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Deductions</th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: lines }, (_unused, i) => {
                  const e = left[i];
                  const d = slip.deductions[i];
                  const earned = e ? i >= slip.earnings.length : false;
                  return (
                    <tr key={i} className="border-b border-neutral-100">
                      <td className="py-2 pr-3">
                        {e ? e.label : ""}
                        {earned ? (
                          <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-2xs font-medium tracking-wide text-neutral-600 uppercase">earned</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tnum">{e ? inr(e.amountPaise) : ""}</td>
                      <td className="px-3 py-2">{d ? d.label : ""}</td>
                      <td className="py-2 pl-3 text-right font-mono tnum">{d ? inr(d.amountPaise) : ""}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-neutral-300 font-semibold">
                  <td className="py-2.5 pr-3">Gross earnings</td>
                  <td className="px-3 py-2.5 text-right font-mono tnum">{inr(gross)}</td>
                  <td className="px-3 py-2.5">Total deductions</td>
                  <td className="py-2.5 pl-3 text-right font-mono tnum">{ded ? inr(ded) : inr(0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200 ring-inset">
            <span className="text-sm font-semibold tracking-wide uppercase">Net pay</span>
            <span className="font-mono text-xl font-semibold tnum">{inr(net)}</span>
          </div>
          <p className="mt-2 text-right text-xs text-neutral-600 italic">{inrWordsOf(net)}</p>

          {/* WHOEVER PAID IT WROTE THIS, and until now it was stored and shown
              nowhere. Never load-bearing — no total reads a remark — but it is
              the only place the reason for an unusual month is recorded in
              words, and a slip that drops it makes somebody go and ask. */}
          {slip.remark
            ? <p className="mt-4 border-l-2 border-neutral-300 pl-3 text-sm text-neutral-700 italic">{slip.remark}</p>
            : null}

          <div className="mt-5 border-t border-neutral-200 pt-4 text-xs leading-relaxed whitespace-pre-line text-neutral-500">
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
      </article>
    </div>
  );
}
