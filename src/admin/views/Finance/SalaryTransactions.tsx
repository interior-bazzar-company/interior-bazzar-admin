/* =============================================================================
   Finance · Salaries — the Transactions tab: every slip, one row each.
   -----------------------------------------------------------------------------
   The Accounts tab answers "who is on the payroll and what are they owed";
   this one answers "where is every slip" — paid, unpaid, or held — which is
   the question an auditor or a founder chasing one month actually asks. Same
   derivation underneath: a row's state is read off the slip itself, and the
   actions call the same store writes the Accounts tab uses.

   HOLD IS A SLIP STATE, NOT AN ACCOUNT ONE. A dispute is about a month, not a
   person: holding March must not stop April going out. A held slip leaves
   `dueOf` — it is not owed right now, the pay write skips it, and the row says
   why it is held because the hold prints nowhere else.
   ============================================================================= */
import { useState } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { Button, EmptyState, ListTable, Pagination, Person, Pill, Rail, Textarea } from "../../ui";
import { go } from "../../ui/nav";
import { ActionMenu, Money } from "./bits";
import { Cancel, Dlg, Field } from "./dialog";
import { CloseAccountModal, PaySalaryModal } from "./SalaryModals";
import {
  ago, fmtDate, fmtMonth, inr, readSalaryAccount, setSlipHold,
  superAdminOnly, toSalaryRow, useRuns,
} from "./store";
import type { Params, Payslip, SalaryRun } from "./store";

interface SlipRow { s: Payslip; run: SalaryRun }

/** One screen of rows. `?page=` is a position in the list, never a filter. */
const PAGE_SIZE = 50;

const stateOf = (s: Payslip) => (s.paidAt ? "paid" : s.held ? "held" : "unpaid");

function matches(x: SlipRow, p: Params): boolean {
  if (p.status && stateOf(x.s) !== p.status) return false;
  if (p.month && x.s.month !== p.month) return false;
  if (p.q) {
    const q = p.q.toLowerCase();
    const hay = [x.s.memberName, x.s.slipId, x.s.employeeCode, x.s.designation, fmtMonth(x.s.month)]
      .join(" ").toLowerCase();
    if (hay.indexOf(q) < 0) return false;
  }
  return true;
}

/* ------------------------------------------------------------- the menu --- */

/** The row's actions, on the module's one `ActionMenu` — a portalled React
 *  Aria Dropdown, so no scrolling table body can clip it. Every item names its
 *  consequence, because three of these move money or state. */
function RowMenu({ x, writable, onPay, onHold, onRelease, onCloseAccount }: {
  x: SlipRow;
  writable: boolean;
  onPay: () => void;
  onHold: () => void;
  onRelease: () => void;
  onCloseAccount: () => void;
}) {
  const s = x.s;
  const acc = readSalaryAccount(s.salaryAccountId);
  const state = stateOf(s);
  const saGate = superAdminOnly("Paying a salary");

  return (
    <ActionMenu forWhat={s.slipId} items={[
      state === "unpaid" && {
        icon: "cash", label: "Pay", act: onPay, tone: "pri",
        disabled: !writable || !!saGate,
        title: saGate || (writable ? undefined : "Paying needs Finance edit rights."),
      },
      state === "unpaid" && {
        icon: "clock", label: "Hold slip", act: onHold,
        disabled: !writable,
        title: writable ? "Take this month out of what is owed, with a reason."
          : "Holding a slip needs Finance edit rights.",
      },
      state === "held" && {
        icon: "unlock", label: "Release hold", act: onRelease, disabled: !writable,
        title: writable ? "Put this month back into what is owed."
          : "Releasing a hold needs Finance edit rights.",
      },
      { icon: "doc", label: "View slip",
        act: () => go("#/finance-salaries/" + encodeURIComponent(s.slipId)) },
      { icon: "user", label: "View account",
        act: () => go("#/finance-salaries/" + encodeURIComponent(s.salaryAccountId)) },
      acc && acc.active && {
        icon: "lock", label: "Close account", act: onCloseAccount, tone: "dgr",
        disabled: !writable,
        title: writable ? undefined : "Closing an account needs Finance edit rights.",
      },
    ]} />
  );
}

/* ------------------------------------------------------------- the hold --- */

function HoldSlipModal({ slip, onClose, onDone }: {
  slip: Payslip; onClose: () => void; onDone: (msg: string, tone?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dlg title={"Hold " + fmtMonth(slip.month) + "'s slip"}
      sub={<>{slip.memberName} · <span className="font-mono tnum">{slip.slipId}</span> · {inr(slip.netPaise)} net</>}
      onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <Button color="primary" isDisabled={!reason.trim()} onClick={() => {
          const e = setSlipHold(slip.slipId, true, reason);
          if (e) return setErr(e);
          onDone(fmtMonth(slip.month) + "'s slip is on hold. It is out of what "
            + slip.memberName + " is owed until somebody releases it.", "ok");
        }}>Hold the slip</Button>
      </>}>
      <Field label="Why it is held"
        help="A hold is about ONE month — the rest of what they are owed still pays. The reason is the only record the hold has.">
        <Textarea rows={3} autoFocus value={reason} ariaLabel="Why it is held"
          ph="Disputed loss of pay for March — HR confirming the leave records."
          onChange={setReason} />
      </Field>
    </Dlg>
  );
}

/* -------------------------------------------------------------- the tab --- */

export default function SalaryTransactions({ p, onUnfilter, onParams }: {
  p: Params; onUnfilter: (key: string) => void; onParams?: (patch: Params) => void;
}) {
  const { toast, modal, closeLayer } = useShell();
  const runs = useRuns();
  const writable = can("finance-salaries", "edit");
  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };

  /* Every slip there is, newest month first — one row per document, which is
     the grain an audit works at. */
  const all: SlipRow[] = runs
    .flatMap((run) => run.slips.map((s) => ({ s, run })))
    .sort((a, b) => b.s.month.localeCompare(a.s.month) || a.s.memberName.localeCompare(b.s.memberName));
  const rows = all.filter((x) => matches(x, p));
  const narrowed = !!(p.q || p.status || p.month);

  const page = Math.max(1, Number(p.page) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pay = (x: SlipRow) => {
    const acc = readSalaryAccount(x.s.salaryAccountId);
    if (!acc) return;
    modal(<PaySalaryModal row={toSalaryRow(acc)} onClose={closeLayer} onDone={done} />, "lg");
  };
  const hold = (x: SlipRow) =>
    modal(<HoldSlipModal slip={x.s} onClose={closeLayer} onDone={done} />);
  const release = (x: SlipRow) => {
    const e = setSlipHold(x.s.slipId, false, "");
    toast(e || fmtMonth(x.s.month) + "'s slip is released — " + inr(x.s.netPaise)
      + " counts as owed again.", e ? "bad" : "ok");
  };
  const closeAccount = (x: SlipRow) => {
    const acc = readSalaryAccount(x.s.salaryAccountId);
    if (!acc) return;
    modal(<CloseAccountModal account={acc} onClose={closeLayer} onDone={done} />);
  };

  /* No section head above the table: the strip in the band already states
     the whole and its parts, the way every list in the panel does. */
  if (!rows.length) {
    return (
      <EmptyState icon={narrowed ? "search" : "doc"}
        title={narrowed ? "No slip matches those filters" : "No slip has been issued"}
        body={narrowed
          ? "Every slip ever issued is behind these filters, paid and unpaid alike."
          : "Slips are issued by opening a salary run on the Accounts tab."}
        action={narrowed
          ? <Button color="secondary" onClick={() => onUnfilter("*")}>Clear the filters</Button>
          : null} />
    );
  }

  return (
    <>
      <ListTable min="60rem" head={<tr>
        <th className="rail" />
        <th scope="col">Slip</th>
        <th scope="col">Person</th>
        <th scope="col" className="n">Net</th>
        <th scope="col">Status</th>
        <th scope="col">Paid on</th>
        <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
      </tr>}>
        {paged.map((x) => {
          const s = x.s;
          const state = stateOf(s);
          const to = "#/finance-salaries/" + encodeURIComponent(s.slipId);
          return (
            <tr key={s.slipId} className="clickable" tabIndex={0} role="link"
              aria-label={"Open " + s.slipId}
              onClick={() => go(to)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
              <Rail tone={state === "unpaid" ? "warn" : state === "held" ? "bad" : undefined} />
              {/* AN IDENTIFIER MUST NOT WRAP. `SLIP-2026-08-0014` broken
                  across two lines reads as two ids, and it was breaking
                  because nothing bounded the status cell beside it — the
                  hold reason was taking the table and starving this column
                  down to nothing. */}
              <td className="cell-1 whitespace-nowrap">
                <span className="font-mono tnum">{s.slipId}</span>
                <div className="cell-2">{fmtMonth(s.month)} · {x.run.runId}</div>
              </td>
              <td><Person name={s.memberName} sm sub={s.designation} /></td>
              <td className="n">
                <Money paise={s.netPaise} strong />
                {s.lopDays ? <div className="cell-2">{s.lopDays} day LOP</div> : null}
              </td>
              <td className="max-w-56">
                {state === "paid" ? <Pill dot tone="ok" text="Paid" />
                  : state === "held" ? <Pill dot tone="bad" text="On hold" />
                    : <Pill dot tone="warn" text="Unpaid" />}
                {/* CLAMPED, NOT DROPPED. A hold reason is mandatory on the
                    way in and is the only place the hold is explained, so
                    it belongs on the row — but printed in full it was an
                    unbounded paragraph inside a table cell, and it pushed
                    every other column out of shape. Two lines here, the
                    whole of it on the title and on the slip itself. */}
                {state === "held" && s.heldReason
                  ? <div className="cell-2 line-clamp-2" title={s.heldReason}>{s.heldReason}</div>
                  : null}
              </td>
              {/* NEVER A BARE DASH. An empty cell in a dated column reads
                  as data that failed to load; an unpaid slip has a state
                  worth saying, and a held one has a different state. */}
              <td className="whitespace-nowrap">
                {s.paidAt ? (
                  <>
                    <div className="cell-1">{fmtDate(s.paidAt)}</div>
                    <div className="cell-2">{ago(s.paidAt)}</div>
                  </>
                ) : state === "held" ? (
                  <>
                    <div className="text-quaternary">not while held</div>
                    <div className="cell-2">release it to pay</div>
                  </>
                ) : (
                  <div className="text-quaternary">not yet</div>
                )}
              </td>
              <td className="acts">
                <RowMenu x={x} writable={writable}
                  onPay={() => pay(x)} onHold={() => hold(x)} onRelease={() => release(x)}
                  onCloseAccount={() => closeAccount(x)} />
              </td>
            </tr>
          );
        })}
      </ListTable>
      <Pagination alwaysCount page={page} pages={pages} total={rows.length} unit="slips"
        pageSize={PAGE_SIZE} shown={paged.length}
        onPage={(n) => onParams && onParams({ page: n > 1 ? String(n) : undefined })} />
    </>
  );
}
