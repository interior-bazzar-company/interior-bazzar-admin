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
import { useEffect, useRef, useState } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, Icon, avatarTone, initials } from "../../ui";
import { go } from "../../ui/nav";
import { Money } from "./bits";
import { Cancel, Dlg, Field } from "./dialog";
import { CloseAccountModal, PaySalaryModal } from "./SalaryModals";
import {
  ago, fmtDate, fmtMonth, inr, readSalaryAccount, setSlipHold,
  superAdminOnly, toSalaryRow, useRuns,
} from "./store";
import type { Params, Payslip, SalaryRun } from "./store";

interface SlipRow { s: Payslip; run: SalaryRun }

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

/** The row's kebab. The same outside-click-and-Escape shape as the panel's
 *  info buttons; what is different is that every item names its consequence,
 *  because three of these move money or state. */
function RowMenu({ x, writable, onPay, onHold, onCloseAccount }: {
  x: SlipRow;
  writable: boolean;
  onPay: () => void;
  onHold: () => void;
  onCloseAccount: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  const { toast } = useShell();

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

  const s = x.s;
  const acc = readSalaryAccount(s.salaryAccountId);
  const state = stateOf(s);
  const saGate = superAdminOnly("Paying a salary");

  /* THE PANEL'S OWN `.mi` ROW — the same item the shell's menus use: compact,
     an icon slot, muted text. The first cut restyled all of this from scratch
     and looked like it. */
  const item = (icon: string, label: string, act: () => void,
    opts?: { disabled?: boolean; title?: string; tone?: string }) => (
    <button type="button" role="menuitem" className={"mi" + (opts?.tone ? " " + opts.tone : "")}
      disabled={opts?.disabled} title={opts?.title}
      onClick={() => { setOpen(false); act(); }}>
      <Icon name={icon} size="sm" />{label}
    </button>
  );

  return (
    <span className="fin-menu" ref={box}>
      <button type="button" className="btn sm" aria-haspopup="menu" aria-expanded={open}
        aria-label={"Actions for " + s.slipId}
        onClick={() => setOpen(!open)}>
        <Icon name="dots" size="sm" />
      </button>
      {open ? (
        <span className="fin-menu-pop" role="menu" aria-label={"Actions for " + s.slipId}>
          {state === "unpaid"
            ? item("cash", "Pay", onPay, {
                disabled: !writable || !!saGate,
                title: saGate || (!writable ? "Paying needs Finance edit rights." : undefined),
              })
            : null}
          {state === "unpaid" ? item("clock", "Hold slip", onHold, {
            disabled: !writable,
            title: writable ? undefined : "Holding a slip needs Finance edit rights.",
          }) : null}
          {state === "held" ? item("unlock", "Release hold", () => {
            const e = setSlipHold(s.slipId, false, "");
            toast(e || fmtMonth(s.month) + "'s slip is released — " + inr(s.netPaise)
              + " counts as owed again.", e ? "bad" : "ok");
          }, { disabled: !writable }) : null}
          {item("doc", "View slip", () => go("#/finance-salaries/" + encodeURIComponent(s.slipId)))}
          {item("user", "View account", () => go("#/finance-salaries/" + encodeURIComponent(s.salaryAccountId)))}
          {acc && acc.active
            ? item("lock", "Close account", onCloseAccount, {
                tone: "bad",
                disabled: !writable,
                title: writable ? undefined : "Closing an account needs Finance edit rights.",
              })
            : null}
        </span>
      ) : null}
    </span>
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
      sub={<>{slip.memberName} · <span className="mono">{slip.slipId}</span> · {inr(slip.netPaise)} net</>}
      onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" disabled={!reason.trim()} onClick={() => {
          const e = setSlipHold(slip.slipId, true, reason);
          if (e) return setErr(e);
          onDone(fmtMonth(slip.month) + "'s slip is on hold. It is out of what "
            + slip.memberName + " is owed until somebody releases it.", "ok");
        }}>Hold the slip</button>
      </>}>
      <Field label="Why it is held"
        help="A hold is about ONE month — the rest of what they are owed still pays. The reason is the only record the hold has.">
        <textarea className="inp" rows={3} autoFocus value={reason}
          placeholder="Disputed loss of pay for March — HR confirming the leave records."
          onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dlg>
  );
}

/* -------------------------------------------------------------- the tab --- */

export default function SalaryTransactions({ p, onUnfilter }: {
  p: Params; onUnfilter: (key: string) => void;
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

  const pay = (x: SlipRow) => {
    const acc = readSalaryAccount(x.s.salaryAccountId);
    if (!acc) return;
    modal(<PaySalaryModal row={toSalaryRow(acc)} onClose={closeLayer} onDone={done} />, "wide");
  };
  const hold = (x: SlipRow) =>
    modal(<HoldSlipModal slip={x.s} onClose={closeLayer} onDone={done} />);
  const closeAccount = (x: SlipRow) => {
    const acc = readSalaryAccount(x.s.salaryAccountId);
    if (!acc) return;
    modal(<CloseAccountModal account={acc} onClose={closeLayer} onDone={done} />);
  };

  /* No section head above the table: the strip in the band already states
     the whole and its parts, the way every list in the panel does. */
  return (
    <>
      {rows.length ? (
        <table className="tbl dls-tbl fin-tbl">
          <thead>
            <tr>
              <th className="rail" />
              <th>Slip</th>
              <th>Person</th>
              <th className="num">Net</th>
              <th>Status</th>
              <th>Paid on</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const s = x.s;
              const state = stateOf(s);
              const to = "#/finance-salaries/" + encodeURIComponent(s.slipId);
              return (
                <tr key={s.slipId} className="clickable" tabIndex={0} role="link"
                  aria-label={"Open " + s.slipId}
                  onClick={() => go(to)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); } }}>
                  <td className="rail">
                    <i className={state === "unpaid" ? "warn" : state === "held" ? "bad" : ""} />
                  </td>
                  {/* AN IDENTIFIER MUST NOT WRAP. `SLIP-2026-08-0014` broken
                      across two lines reads as two ids, and it was breaking
                      because nothing bounded the status cell beside it — the
                      hold reason was taking the table and starving this column
                      down to nothing. */}
                  <td className="fin-c-slip">
                    <div className="cell-1 mono">{s.slipId}</div>
                    <div className="cell-2">{fmtMonth(s.month)} · {x.run.runId}</div>
                  </td>
                  <td>
                    <div className="fin-who">
                      <span className={"av sm " + avatarTone(s.memberName)}>{initials(s.memberName)}</span>
                      <span>
                        <span className="cell-1">{s.memberName}</span>
                        <span className="cell-2">{s.designation}</span>
                      </span>
                    </div>
                  </td>
                  <td className="num">
                    <Money paise={s.netPaise} strong />
                    {s.lopDays ? <div className="cell-2">{s.lopDays} day LOP</div> : null}
                  </td>
                  <td>
                    {state === "paid" ? <span className="pill ok">Paid</span>
                      : state === "held" ? <span className="pill bad">On hold</span>
                        : <span className="pill warn">Unpaid</span>}
                    {/* CLAMPED, NOT DROPPED. A hold reason is mandatory on the
                        way in and is the only place the hold is explained, so
                        it belongs on the row — but printed in full it was an
                        unbounded paragraph inside a table cell, and it pushed
                        every other column out of shape. Two lines here, the
                        whole of it on the title and on the slip itself. */}
                    {state === "held" && s.heldReason
                      ? <div className="cell-2 fin-heldnote" title={s.heldReason}>{s.heldReason}</div>
                      : null}
                  </td>
                  {/* NEVER A BARE DASH. An empty cell in a dated column reads
                      as data that failed to load; an unpaid slip has a state
                      worth saying, and a held one has a different state. */}
                  <td className="fin-c-when">
                    {s.paidAt ? (
                      <>
                        <div className="cell-1">{fmtDate(s.paidAt)}</div>
                        <div className="cell-2">{ago(s.paidAt)}</div>
                      </>
                    ) : state === "held" ? (
                      <>
                        <div className="cell-1 faint">not while held</div>
                        <div className="cell-2">release it to pay</div>
                      </>
                    ) : (
                      <div className="cell-1 faint">not yet</div>
                    )}
                  </td>
                  <td className="tight" onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}>
                    <RowMenu x={x} writable={writable}
                      onPay={() => pay(x)} onHold={() => hold(x)}
                      onCloseAccount={() => closeAccount(x)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={narrowed ? "search" : "doc"}
          title={narrowed ? "No slip matches those filters" : "No slip has been issued"}
          body={narrowed
            ? "Every slip ever issued is behind these filters, paid and unpaid alike."
            : "Slips are issued by opening a salary run on the Accounts tab."}
          action={narrowed
            ? <button className="btn" onClick={() => onUnfilter("*")}>Clear the filters</button>
            : null} />
      )}
    </>
  );
}
