/* =============================================================================
   Salaries A/C — the five dialogs.
   -----------------------------------------------------------------------------
     SalaryAccountModal  open a salary account, or revise one. The components
                         are TYPED, never derived from a role, and the gross /
                         deductions / net readout moves as they are typed so
                         nobody agrees to a figure they have not seen.
     CloseAccountModal   the person left. The slips stay.
     OpenRunModal        one month, one slip per active account, stated in full
                         before the button is pressed.
     LopModal            loss of pay on an open run's slip, pro-rated live.
     PaySalaryModal      Super Admin. The money left the account for ONE
                         person — every month they were owed, oldest first,
                         each slip stamped and frozen in the same write. It
                         carries no bank reference: the attachment is the
                         evidence, and it is mandatory.

   Every one of them calls a store function and renders the refusal it returns
   INSIDE the dialog. A dialog never closes on a failed write: the sentence the
   refusal contradicts is still on screen, which is the only way a person can
   see what they got wrong.
   ============================================================================= */
import { useMemo, useRef, useState } from "react";
import { Icon, Notice } from "../../ui";
import { go } from "../../ui/nav";
import { Check, Role } from "./bits";
import InfoTip from "./InfoTip";
import { Cancel, Dlg, Field, Fs, RupeeInput, toPaise } from "./dialog";
import type { Done } from "./dialog";
import {
  daysInMonth,
  ACCOUNTS, PAY_VIA, closeSalaryAccount, dueOf, fmtMonth, inr, isSuperAdmin, monthOf,
  openRun, openSalaryRun, paySalary, proofAccepted, salaryMemberOptions, setLop,
  superAdminOnly, todayIso, upsertSalaryAccount, useRuns, useSalaryRows,
} from "./store";
import type { Payslip, SalaryAccount, SalaryComponent, SalaryRow, SalaryRun } from "./store";

/* ============================================================== helpers === */

/** Integer paise to the rupee string a person types back. Floor and remainder,
 *  never a division that produces a float — 1234567 must read 12345.67 and not
 *  12345.669999999999. */
function rupeesOf(paise: number): string {
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return p === 0 ? String(r) : r + "." + (p < 10 ? "0" + p : String(p));
}

/** One editable component line. `rid` exists only to key the row: the label is
 *  editable, so keying on it re-mounts the input on every keystroke and the
 *  caret jumps to the end. */
interface CompRow { rid: number; key: string; label: string; amt: string }

let rowSeq = 0;
const toRows = (list: SalaryComponent[]): CompRow[] =>
  list.map((c) => ({ rid: ++rowSeq, key: c.key, label: c.label, amt: rupeesOf(c.amountPaise) }));
const blankRow = (): CompRow => ({ rid: ++rowSeq, key: "", label: "", amt: "" });

/** What the rows add up to WHILE they are being typed. A half-typed amount
 *  counts as nothing here and is refused at submit — the readout is never
 *  allowed to disagree with what gets written. */
const liveSum = (rows: CompRow[]): number =>
  rows.reduce((n, r) => n + (toPaise(r.amt) || 0), 0);

/** Rows to components, or the sentence saying why not. */
function compile(rows: CompRow[], what: string): { list: SalaryComponent[]; bad: string } {
  const list: SalaryComponent[] = [];
  for (const r of rows) {
    const label = r.label.trim();
    /* An untouched blank line is not an error — somebody pressed Add and
       changed their mind. A line with an amount and no name is. */
    if (!label && !r.amt.trim()) continue;
    if (!label)
      return { list: [], bad: "A " + what + " line carries an amount and no name. A figure nobody can name is a figure nobody can explain at audit." };
    const paise = toPaise(r.amt);
    if (paise === null)
      return { list: [], bad: label + " has no clean amount against it. Type rupees, up to two decimals — a component is never rounded on its way in." };
    const key = r.key
      || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20)
      || "component";
    list.push({ key, label, amountPaise: paise });
  }
  return { list, bad: "" };
}

function CompEditor({ rows, onRows, addLabel }: {
  rows: CompRow[]; onRows: (r: CompRow[]) => void; addLabel: string;
}) {
  const patch = (rid: number, k: "label" | "amt", v: string) =>
    onRows(rows.map((r) => (r.rid === rid ? { ...r, [k]: v } : r)));
  return (
    <>
      {rows.map((r) => (
        <div className="fin-comprow" key={r.rid}>
          <input className="inp" value={r.label} placeholder="What it is called on the slip"
            aria-label="Component name" onChange={(e) => patch(r.rid, "label", e.target.value)} />
          <RupeeInput value={r.amt} onChange={(v) => patch(r.rid, "amt", v)} />
          <button type="button" className="btn sm" aria-label={"Remove " + (r.label || "this line")}
            title="Remove this line" onClick={() => onRows(rows.filter((x) => x.rid !== r.rid))}>
            <Icon name="x" size="sm" />
          </button>
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onRows(rows.concat([blankRow()]))}>
        <Icon name="plus" size="sm" />{addLabel}
      </button>
    </>
  );
}

function Totals({ gross, ded }: { gross: number; ded: number }) {
  return (
    <div className="fin-summary">
      <div className="row"><span className="l">Gross</span><span className="tnum">{inr(gross)}</span></div>
      <div className="row"><span className="l">Deductions</span><span className="tnum">−{inr(ded)}</span></div>
      <div className="row grand"><span className="l">Net every month</span><span className="tnum">{inr(gross - ded)}</span></div>
    </div>
  );
}

/* ================================================== FN-T06 · the account === */

export function SalaryAccountModal({ account, onClose, onDone }: {
  /** Absent opens a new account; a record revises that one. */
  account?: SalaryAccount | null;
  onClose: () => void;
  onDone: Done;
}) {
  const a = account || null;
  const [memberId, setMemberId] = useState(a ? String(a.memberId) : "");
  const [memberName, setMemberName] = useState(a ? a.memberName : "");
  const [code, setCode] = useState(a ? a.employeeCode : "");
  const [designation, setDesignation] = useState(a ? a.designation : "");
  const [joinedAt, setJoinedAt] = useState(a ? a.joinedAt : todayIso());
  const [masked, setMasked] = useState(a ? a.bank.masked : "");
  const [ifsc, setIfsc] = useState(a ? a.bank.ifsc : "");
  const [bankName, setBankName] = useState(a ? a.bank.name : "");
  const [pan, setPan] = useState(a ? a.pan : "");
  const [uan, setUan] = useState(a ? a.uan || "" : "");
  const [earn, setEarn] = useState<CompRow[]>(
    a ? toRows(a.earnings) : [{ ...blankRow(), key: "basic", label: "Basic" }]);
  const [ded, setDed] = useState<CompRow[]>(a ? toRows(a.deductions) : []);
  const [upi, setUpi] = useState(a ? a.bank.upi || "" : "");
  const [err, setErr] = useState<string | null>(null);

  /* Read once per render: the list changes when an account is opened, and a
     picker that still offers somebody who now has one is a picker that lies. */
  const members = salaryMemberOptions();
  /* ONE CHOICE, FOUR FIELDS. The code is derived rather than typed — it prints
     on the payslip, and two people typing their own conventions produce two
     formats in one payroll. */
  const pickMember = (id: string) => {
    const m = members.filter((x) => String(x.memberId) === id)[0];
    setMemberId(id);
    setMemberName(m ? m.name : "");
    setDesignation(m ? m.designation : "");
    setCode(m ? m.employeeCode : "");
    setErr(null);
  };

  const gross = liveSum(earn);
  const dedTotal = liveSum(ded);

  const submit = () => {
    const e = compile(earn, "earnings");
    if (e.bad) return setErr(e.bad);
    const d = compile(ded, "deduction");
    if (d.bad) return setErr(d.bad);
    const id = Number(memberId);
    if (!Number.isInteger(id) || id <= 0)
      return setErr("The Team member id is a whole number above zero. It is the join to the Team record and nothing else stands in for it.");
    const r = upsertSalaryAccount({
      memberId: id, memberName, employeeCode: code.trim(), designation: designation.trim(),
      joinedAt, earnings: e.list, deductions: d.list,
      bank: {
        masked: masked.trim(), ifsc: ifsc.trim().toUpperCase(), name: bankName.trim(),
        upi: upi.trim() || undefined,
      },
      pan: pan.trim().toUpperCase(), uan: uan.trim() || null,
    }, a ? a.salaryAccountId : undefined);
    if (r.error) return setErr(r.error);
    onDone(a
      ? memberName + " revised to " + inr(gross - dedTotal) + " net a month. Slips already issued keep the figures they were issued with."
      : memberName + " is on the payroll at " + inr(gross - dedTotal) + " net a month. The next run opened carries a slip for them.",
    "ok");
  };

  return (
    <Dlg
      title={a ? "Revise " + a.memberName + "'s salary" : "Open a salary account"}
      sub={a
        ? <>{a.salaryAccountId} · {a.designation} · {inr(a.monthlyGrossPaise)} gross a month today</>
        : <>One account per team member. The components below are what every slip is built from.</>}
      onClose={onClose}
      err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" onClick={submit}>{a ? "Save the revision" : "Open the account"}</button>
      </>}>

      {a ? (
        <Notice tone="warn" ico="lock" text={<>
          <b>Slips already issued keep their old figures.</b> A slip freezes its own earnings and
          deductions at issue. This revision reaches the next run and nothing behind it, which is
          why {a.memberName}'s older slips will not match what you are about to type.
        </>} />
      ) : null}

      {/* PICKED, NOT TYPED. The id, the name, the designation and the code
          were four fields somebody re-entered from a record that already holds
          them, and the id had to match by hand — type it wrong and the salary
          points at the wrong person. One choice sets all four. */}
      <Fs legend="Who this belongs to" req>
        <div className="fin-f2">
        <Field label="Team member">
          {a ? (
            <div className="fin-derived">
              <b>{a.memberName}</b> · {a.designation} · <span className="mono">{a.employeeCode}</span>
              <div className="fin-fine">The person does not change on a revision. Close the account and open another if it is the wrong one.</div>
            </div>
          ) : (
            <div className="selectbox">
              <select value={memberId} onChange={(e) => pickMember(e.target.value)}>
                <option value="">Pick a team member…</option>
                {members.map((m) => (
                  <option key={m.memberId} value={String(m.memberId)} disabled={m.taken}>
                    {m.name} · {m.designation}{m.taken ? " — already has an account" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Field>
          {/* Beside the picker rather than under it. Alone in a two-column row
              it left an empty half — the kind of gap that reads as a field
              somebody forgot to render. */}
          <Field label="Joined">
            <input type="date" className="inp" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
          </Field>
        </div>
      </Fs>

      <Fs legend="Earnings" req>
        <CompEditor rows={earn} onRows={setEarn} addLabel="Add an earning" />
      </Fs>

      <Fs legend={<>Deductions
        <InfoTip label="deductions"
          intro="What comes off the gross. An account below the TDS threshold has no TDS line at all — an absent component, not a zero one, because a zero implies somebody worked it out." />
      </>}>
        <CompEditor rows={ded} onRows={setDed} addLabel="Add a deduction" />
      </Fs>

      <Totals gross={gross} ded={dedTotal} />

      <Fs legend="Where it is paid">
        <div className="fin-f2">
          <Field label="Bank account, masked">
            <input className="inp mono" value={masked} placeholder="HDFC ••••2276"
              onChange={(e) => setMasked(e.target.value)} />
          </Field>
          <Field label="IFSC">
            <input className="inp mono" value={ifsc} placeholder="HDFC0000123"
              onChange={(e) => setIfsc(e.target.value)} />
          </Field>
          <Field label="Bank">
            <input className="inp" value={bankName} placeholder="HDFC Bank"
              onChange={(e) => setBankName(e.target.value)} />
          </Field>
          <Field label="UPI id">
            <input className="inp mono" value={upi} placeholder="anjali@okhdfcbank"
              onChange={(e) => setUpi(e.target.value)} />
          </Field>
          <Field label="PAN">
            <input className="inp mono" value={pan} placeholder="BKQPD4417L"
              onChange={(e) => setPan(e.target.value)} />
          </Field>
          <Field label="UAN" help="Left blank where there is genuinely no EPF membership. Blank is a fact here, not a gap.">
            <input className="inp mono" value={uan} placeholder="100812345678"
              onChange={(e) => setUan(e.target.value.replace(/[^0-9]/g, ""))} />
          </Field>
        </div>
      </Fs>
    </Dlg>
  );
}

/* ==================================================== FN-T06 · close it === */

export function CloseAccountModal({ account, onClose, onDone }: {
  account: SalaryAccount; onClose: () => void; onDone: Done;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const run = openRun();
  const onOpenRun = !!run && run.slips.some((s) => s.salaryAccountId === account.salaryAccountId);

  return (
    <Dlg title={"Close " + account.memberName + "'s salary account"}
      sub={<>{account.salaryAccountId} · {account.designation} · {inr(account.monthlyGrossPaise)} gross a month</>}
      onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" disabled={!reason.trim()} onClick={() => {
          const e = closeSalaryAccount(account.salaryAccountId, reason);
          if (e) return setErr(e);
          onDone(account.memberName + "'s account is closed. No run picks it up again, and every slip it already carries stays exactly where it is.", "ok");
        }}>Close the account</button>
      </>}>

      <div className="fin-chks">
        <Check ok>
          <b>The slips already issued stay on the record.</b> Closing stops the next run picking this
          account up. It touches nothing already paid, and it leaves the account on the list —
          deleting it would take the slips with it.
        </Check>
        <Check ok={!onOpenRun}>
          {onOpenRun
            ? <><b>{account.memberName} has a slip on {run ? run.runId : "the open run"}.</b> Pay that run
              first. Closing now would leave a slip on an open run that nobody can explain.</>
            : <><b>Nothing of theirs is on an open run.</b> {run
              ? run.runId + " is open and carries no slip for this account."
              : "There is no open run."} Closing is clean.</>}
        </Check>
        <Check warn>
          <b>Final settlement is not computed here.</b> Notice pay, leave encashment and gratuity are
          outside this module — FN-OD-05. If money is still owed it goes out as a run or as an Other
          Transaction, and that happens before this.
        </Check>
      </div>

      <Field label="Why it is closing"
        help="It goes on the record verbatim, and it is the sentence somebody reads two years from now.">
        <textarea className="inp" rows={3} autoFocus value={reason}
          placeholder="Resigned; last working day 30 Jun 2026. Full and final settled with the June run."
          onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dlg>
  );
}

/* ================================================== FN-T07 · open a run === */

/** The newest month at or before today with no run against it. A month already
 *  run is a guaranteed refusal, and pre-filling one is a dialog that opens
 *  broken. */
function suggestMonth(runs: SalaryRun[]): string {
  const now = monthOf(todayIso());
  const taken = runs.map((r) => r.month);
  const y0 = Number(now.slice(0, 4));
  const m0 = Number(now.slice(5, 7));
  for (let k = 0; k < 12; k++) {
    const t = m0 - 1 - k;
    const y = y0 + Math.floor(t / 12);
    const m = ((t % 12) + 12) % 12;
    const key = String(y) + "-" + String(m + 1).padStart(2, "0");
    if (taken.indexOf(key) < 0) return key;
  }
  return now;
}

export function OpenRunModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const runs = useRuns();
  const rows = useSalaryRows();
  const [month, setMonth] = useState(() => suggestMonth(runs));
  const [err, setErr] = useState<string | null>(null);

  /* Exactly who openSalaryRun will issue a slip for, and exactly what it will
     come to. Stated before the button rather than after it. */
  const active = rows.filter((r) => r.a.active);
  const total = active.reduce((n, r) => n + r.monthlyNetPaise, 0);
  const clash = runs.filter((r) => r.month === month)[0] || null;
  const open = openRun();
  const started = !!month && month <= monthOf(todayIso());

  return (
    <Dlg title="Open a salary run"
      sub={<>One run a month. Every active account gets a slip, and each slip freezes what its account says today.</>}
      onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" onClick={() => {
          const r = openSalaryRun(month);
          if (r.error) return setErr(r.error);
          onDone(r.runId + " is open · " + active.length + " slips · " + inr(total) + " net. Nobody has been paid yet.", "ok");
        }}>Open the run</button>
      </>}>

      <Fs legend="The month" req hint="Pre-filled with the newest month that has no run against it.">
        <input type="month" className="inp tnum" value={month}
          onChange={(e) => setMonth(e.target.value)} />
      </Fs>

      <div className="fin-chks">
        <Check ok={!clash}>
          {clash
            ? <><b>{clash.runId} already covers {fmtMonth(month)}.</b> One run a month, or the same
              salary goes out twice and the bank statement is the only place it shows.</>
            : <><b>No run exists for {month ? fmtMonth(month) : "that month"}.</b></>}
        </Check>
        <Check ok={started}>
          {started
            ? <><b>{fmtMonth(month)} has started.</b> Slips stay adjustable until the run is paid.</>
            : <><b>That month has not started.</b> A month nobody has worked cannot be run.</>}
        </Check>
        <Check ok={!open}>
          {open
            ? <><b>{open.runId} is still open.</b> Pay it first — two open runs cannot be reconciled
              against one balance.</>
            : <><b>No other run is open.</b></>}
        </Check>
        <Check ok={active.length > 0}>
          {active.length
            ? <><b>{active.length} active accounts, {inr(total)} net.</b> Each gets one slip, frozen at
              today's components. A closed account is not in this and cannot be added to it later.</>
            : <><b>There is no active salary account to pay.</b></>}
        </Check>
      </div>

      <div className="fin-summary">
        {active.map((r) => (
          <div className="row" key={r.a.salaryAccountId}>
            <span className="l">{r.a.memberName} <span className="faint">· {r.a.designation}</span></span>
            <span className="tnum">{inr(r.monthlyNetPaise)}</span>
          </div>
        ))}
        <div className="row grand">
          <span className="l">{active.length} slip{active.length === 1 ? "" : "s"}</span>
          <span className="tnum">{inr(total)}</span>
        </div>
      </div>
    </Dlg>
  );
}

/* ========================================================= FN-T07 · LOP === */

export function LopModal({ slip, onClose, onDone }: {
  slip: Payslip; onClose: () => void; onDone: Done;
}) {
  const [days, setDays] = useState(String(slip.lopDays));
  const [err, setErr] = useState<string | null>(null);
  const n = Number(days);
  const basis = daysInMonth(slip.month);
  const valid = /^\d+$/.test(days.trim()) && Number.isInteger(n) && n >= 0 && n < basis;

  /* The same arithmetic the store does, over the same numbers: every earning
     in the slip's OWN frozen base, multiplied by the worked fraction of the
     REAL month and rounded to the paise; deductions left where they are. The
     base is why this is safe to apply twice, and why a raise granted after the
     run opened cannot reach back into this month. */
  const preview = useMemo(() => {
    if (!valid) return null;
    const worked = basis - n;
    const earnings = slip.baseEarnings.map((e) => ({ ...e, amountPaise: Math.round((e.amountPaise * worked) / basis) }));
    const gross = earnings.reduce((x, e) => x + e.amountPaise, 0);
    const ded = slip.deductions.reduce((x, d) => x + d.amountPaise, 0);
    return { earnings, gross, ded, net: gross - ded, worked };
  }, [n, valid, basis, slip.baseEarnings, slip.deductions]);

  return (
    <Dlg title={"Loss of pay · " + slip.memberName}
      sub={<>{slip.slipId} · {fmtMonth(slip.month)} · {slip.paidDays} paid days at the moment</>}
      onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" disabled={!valid} onClick={() => {
          const e = setLop(slip.slipId, n);
          if (e) return setErr(e);
          onDone(slip.memberName + " · " + n + " day" + (n === 1 ? "" : "s") + " loss of pay"
            + (preview ? " · net " + inr(preview.net) : "") + ". The run total moved with it.", "ok");
        }}>Apply loss of pay</button>
      </>}>

      <Fs legend="Days not worked and not paid" req
        hint="Zero puts the slip back to a full month. It is the only figure on a slip anybody can change.">
        <input className="inp tnum" inputMode="numeric" value={days} autoFocus
          aria-label="Loss of pay days"
          onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))} />
      </Fs>

      <div className="fin-chks">
        <Check ok>
          <b>Earnings are pro-rated. Deductions are not.</b> Professional tax is a flat monthly levy
          and does not shrink because somebody was away, and neither does anything else on the
          deductions side. Only the earnings move.
        </Check>
        <Check warn>
          <b>The month is thirty days for this purpose.</b> The fraction is worked days over thirty
          whatever the calendar says, so the same absence costs the same money in February and in
          August.
        </Check>
        <Check ok={slip.paidAt === null}>
          {slip.paidAt === null
            ? <><b>The run is still open.</b> Nothing is paid and nothing is hashed, so this slip can
              still change.</>
            : <><b>This slip is paid and frozen.</b> A paid run does not move.</>}
        </Check>
      </div>

      {preview ? (
        <div className="fin-summary">
          {preview.earnings.map((e) => (
            <div className="row" key={e.key}>
              <span className="l">{e.label}</span><span className="tnum">{inr(e.amountPaise)}</span>
            </div>
          ))}
          <div className="row"><span className="l">Gross · {preview.worked} of 30 days</span><span className="tnum">{inr(preview.gross)}</span></div>
          <div className="row"><span className="l">Deductions, untouched</span><span className="tnum">−{inr(preview.ded)}</span></div>
          <div className="row grand"><span className="l">Net pay</span><span className="tnum">{inr(preview.net)}</span></div>
        </div>
      ) : null}
    </Dlg>
  );
}

/* ================================================== FN-T08 · pay the run === */

export function PaySalaryModal({ row, onClose, onDone }: {
  row: SalaryRow; onClose: () => void; onDone: Done;
}) {
  const [via, setVia] = useState(PAY_VIA[0].key);
  const [proof, setProof] = useState<{ filename: string; mime: string; bytes: number } | null>(null);
  const [remark, setRemark] = useState("");
  const [accountId, setAccountId] = useState(
    (ACCOUNTS.filter((a) => a.active && a.type === "bank")[0] || ACCOUNTS[0]).accountId);
  /* Adjustments as rows somebody ADDS, not blanks that sit there. One row
     per kind at most — the write takes one incentive and one deduction, and a
     second row of either would be two numbers pretending to be one. */
  const [adjs, setAdjs] = useState<{ rid: number; kind: "incentive" | "deduction"; amt: string }[]>([]);
  /* Set once the write has gone through. The dialog then STOPS being a form:
     the money has left, Cancel would be a lie, and what remains to offer is
     the slip. */
  const [paid, setPaid] = useState<{
    leaving: number; months: number; slipId: string; via: string; from: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  /* "" when this session may do it. Never used to hide the button — a person
     who cannot see the action cannot ask for it either. */
  const gate = superAdminOnly("Paying a salary");
  /* Cash leaves the cash account and there is nothing to choose, so the picker
     is not shown rather than shown with one option. */
  const cashAccount = (ACCOUNTS.filter((a) => a.active && a.type === "cash")[0]
    || ACCOUNTS.filter((a) => a.active)[0]).accountId;
  const payingFrom = via === "cash" ? cashAccount : accountId;
  const d = dueOf(row);
  /* Oldest first, because that is the order the write pays them in and a
     summary that lists them the other way describes a different transfer. */
  const months = d.unpaid.slice().sort((a, b) => a.month.localeCompare(b.month));
  const newest = months[months.length - 1];

  /* The same arithmetic the store will do, live, so "Leaving the account"
     never shows a number the write would not produce. A half-typed amount
     counts as nothing, exactly as it does in the component editor. */
  const amtOf = (kind: "incentive" | "deduction") =>
    adjs.filter((r) => r.kind === kind).reduce((n, r) => n + (toPaise(r.amt) || 0), 0);
  const incPaise = amtOf("incentive");
  const dedPaise = amtOf("deduction");
  const kindTaken = (k: string) => adjs.some((r) => r.kind === k);
  const addAdj = () => setAdjs(adjs.concat([{
    rid: ++rowSeq, kind: kindTaken("incentive") ? "deduction" : "incentive", amt: "",
  }]));
  const overdrawn = !!newest && dedPaise > newest.netPaise + incPaise;
  const leaving = d.pendingPaise + incPaise - dedPaise;

  /* ================================================== paid: the receipt === */
  if (paid) {
    const close = () => onDone(inr(paid.leaving) + " paid to " + row.a.memberName + " · "
      + paid.months + " month" + (paid.months === 1 ? "" : "s")
      + " numbered, hashed and frozen.", "ok");
    const viaLabel = (PAY_VIA.filter((v) => v.key === paid.via)[0] || PAY_VIA[0]).label;
    const from = ACCOUNTS.filter((x) => x.accountId === paid.from)[0];
    return (
      <Dlg title="Paid successfully" sub={<>{row.a.designation} · {row.a.memberName}</>}
        onClose={close}
        footer={<>
          <button className="btn" onClick={close}>Done</button>
          {/* Straight to the document. Download there is the browser's print
              dialog, and Save as PDF is how every document in this panel
              becomes a file — one renderer, one definition of the slip. */}
          <button className="btn pri" onClick={() => {
            close();
            go("#/finance-salaries/" + encodeURIComponent(paid.slipId));
          }}>
            <Icon name="download" size="sm" />Download slip
          </button>
        </>}>
        {/* A RECEIPT, not a checklist: the figure, then the facts of the
            transfer, each on its own line. */}
        <div className="fin-paid">
          <span className="mark"><Icon name="check" /></span>
          <div className="amt tnum">{inr(paid.leaving)}</div>
          <div className="to">paid to {row.a.memberName}</div>
          <div className="facts">
            <div className="row"><span className="l">Via</span><span>{viaLabel}{from ? " · " + from.masked : ""}</span></div>
            <div className="row"><span className="l">Covers</span>
              <span>{paid.months} month{paid.months === 1 ? "" : "s"}, oldest first</span></div>
            <div className="row"><span className="l">Slip</span><span className="mono">{paid.slipId}</span></div>
          </div>
          <p className="fine">
            Numbered, hashed and frozen — nothing on the slip can change now. Download opens the
            document; Save as PDF there produces the file.
          </p>
        </div>
      </Dlg>
    );
  }

  return (
    <Dlg title={"Pay " + row.a.memberName}
      sub={<>{row.a.designation} · {months.length} month{months.length === 1 ? "" : "s"} outstanding · {inr(d.pendingPaise)} net</>}
      onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" disabled={!!gate || !proof || overdrawn} title={gate || undefined}
          onClick={() => {
            const e = paySalary(row.a.salaryAccountId, {
              via, accountId: payingFrom, proof: proof || { filename: "", mime: "" }, remark,
              incentive: incPaise > 0 ? { label: "Incentive", amountPaise: incPaise } : null,
              deduction: dedPaise > 0 ? { label: "Deduction", amountPaise: dedPaise } : null,
            });
            if (e) return setErr(e);
            /* The dialog does not close: it turns into the receipt, with the
               slip one press away. */
            setPaid({ leaving, months: months.length, slipId: newest.slipId,
              via, from: payingFrom });
          }}>
          Record the payment<Role sa />
        </button>
      </>}>

      {isSuperAdmin() ? null : (
        <Notice tone="warn" ico="lock" text={<>
          <b>This one is Super Admin.</b> It sends {inr(d.pendingPaise)} out of the company and
          stamps {months.length} document{months.length === 1 ? "" : "s"} in the same write. The
          button stays where it is so it is clear what exists and who to ask.
        </>} />
      )}

      {d.arrears.length ? (
        <Notice tone="warn" ico="alert" text={<>
          <b>{row.a.memberName} is owed for {d.arrears.length + 1} months, not one.</b>{" "}
          {inr(d.arrearsPaise)} of that is older than the current month. Everything outstanding is
          paid in this one transfer, oldest first — paying only the newest would leave the older
          debt ageing while the newer one clears.
        </>} />
      ) : null}

      {/* THE THREE STANDING NOTES THAT USED TO SIT HERE ARE GONE. They said
          the slips freeze, that this pays one person, and that the reference
          ties the payment to the bank. The first is true of every write in
          this module and belongs in its documentation, not above every
          button; the second is said by the dialog's own title; the third
          described a field that no longer exists. What is left are the two
          notices below, and both are CONDITIONAL — they appear because
          something is true of this payment, not because the screen has room. */}

      <Fs legend="The transfer" req>
        {/* One row, one question: how and from where. Stacked they read as two
            separate decisions, and they are halves of one. */}
        <div className="fin-f2">
          <Field label="Payment via">
            <div className="selectbox">
              <select value={via} onChange={(e) => { setVia(e.target.value); setErr(null); }}>
                {PAY_VIA.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </div>
          </Field>
          {via === "cash" ? (
            <Field label="Paid from">
              <div className="fin-derived">Cash account — nothing to choose.</div>
            </Field>
          ) : (
            <Field label="Paid from">
              <div className="selectbox">
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {ACCOUNTS.filter((a) => a.active).map((a) => (
                    <option key={a.accountId} value={a.accountId}>{a.masked} · {a.name}</option>
                  ))}
                </select>
              </div>
            </Field>
          )}
        </div>

        {/* THE ONLY EVIDENCE THIS PAYMENT HAS, now the reference field is gone,
            so it is mandatory and it is a real file rather than a typed name. */}
        <Field label="Receipt" help="Image or PDF.">
          <div className="fin-file">
            <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size="sm" />{proof ? "Replace" : "Attach receipt"}
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                if (!proofAccepted(f.type)) {
                  setProof(null);
                  setErr(f.name + " is neither an image nor a PDF.");
                  return;
                }
                setErr(null);
                setProof({ filename: f.name, mime: f.type, bytes: f.size });
              }} />
            {proof
              ? <span className="pill ok xs" title={proof.filename}>
                <Icon name="check" size="sm" />{proof.filename}
              </span>
              : <span className="faint">nothing attached yet</span>}
          </div>
        </Field>

      </Fs>

      {/* One-off money settled WITH this transfer, ADDED rather than sitting
          as blanks: most payments have none, and two empty rows on every
          payment is furniture. Each lands as a named line on the newest
          month's slip and moves its totals — the slip stays the whole story
          of what was paid. */}
      <Fs legend="Adjustments"
        hint={newest ? "Optional. Either lands as a line on " + fmtMonth(newest.month) + "'s slip." : undefined}>
        {adjs.map((r) => (
          <div className="fin-adjrow" key={r.rid}>
            <div className="selectbox">
              <select value={r.kind} aria-label="Adjustment kind"
                onChange={(e) => setAdjs(adjs.map((x) =>
                  x.rid === r.rid ? { ...x, kind: e.target.value as "incentive" | "deduction" } : x))}>
                <option value="incentive" disabled={r.kind !== "incentive" && kindTaken("incentive")}>Incentive</option>
                <option value="deduction" disabled={r.kind !== "deduction" && kindTaken("deduction")}>Deduction</option>
              </select>
            </div>
            <RupeeInput value={r.amt}
              onChange={(v) => setAdjs(adjs.map((x) => (x.rid === r.rid ? { ...x, amt: v } : x)))} />
            <button type="button" className="btn sm" aria-label={"Remove the " + r.kind}
              title="Remove this line"
              onClick={() => setAdjs(adjs.filter((x) => x.rid !== r.rid))}>
              <Icon name="x" size="sm" />
            </button>
          </div>
        ))}
        <button type="button" className="btn sm" onClick={addAdj} disabled={adjs.length >= 2}>
          <Icon name="plus" size="sm" />Add incentive or deduction
        </button>
      </Fs>

      {/* Last, because it is the one thing here that is ABOUT the whole
          payment rather than part of it — written once everything above is
          settled, like a note on the bottom of a voucher. */}
      <Field label="Remark" help="Optional.">
        <input className="inp" value={remark} placeholder="Paid a day early — bank holiday on the 1st"
          onChange={(e) => setRemark(e.target.value)} />
      </Field>

      {overdrawn && newest ? (
        <Notice tone="bad" ico="alert" text={<>
          <b>The deduction is bigger than {fmtMonth(newest.month)}'s net{incPaise ? " plus the incentive" : ""}
          — {inr(newest.netPaise + incPaise)}.</b> A slip cannot go below zero. Recover the rest
          from a later month.
        </>} />
      ) : null}

      <div className="fin-summary">
        {months.map((s) => (
          <div className="row" key={s.slipId}>
            <span className="l">
              {fmtMonth(s.month)}
              {s.lopDays ? <span className="faint"> · {s.lopDays} day loss of pay</span> : null}
              {s.month !== months[months.length - 1].month ? <span className="faint"> · arrears</span> : null}
            </span>
            <span className="tnum">{inr(s.netPaise)}</span>
          </div>
        ))}
        {incPaise > 0 ? (
          <div className="row">
            <span className="l">Incentive</span>
            <span className="tnum">+{inr(incPaise)}</span>
          </div>
        ) : null}
        {dedPaise > 0 ? (
          <div className="row">
            <span className="l">Deduction</span>
            <span className="tnum">−{inr(dedPaise)}</span>
          </div>
        ) : null}
        <div className="row grand">
          <span className="l">Leaving the account</span><span className="tnum">{inr(leaving)}</span>
        </div>
      </div>
    </Dlg>
  );
}
