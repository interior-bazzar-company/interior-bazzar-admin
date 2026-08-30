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
     PayRunModal         Super Admin. The money left the bank, so every slip in
                         the run is stamped and frozen in the same write.

   Every one of them calls a store function and renders the refusal it returns
   INSIDE the dialog. A dialog never closes on a failed write: the sentence the
   refusal contradicts is still on screen, which is the only way a person can
   see what they got wrong.
   ============================================================================= */
import { useMemo, useState } from "react";
import { Icon, Notice } from "../../ui";
import { Check, Role } from "./bits";
import { Cancel, Dlg, Field, Fs, Pick, RupeeInput, toPaise } from "./dialog";
import type { Done } from "./dialog";
import {
  daysInMonth,
  ACCOUNTS, closeSalaryAccount, fmtMonth, inr, isSuperAdmin, monthOf, openRun, openSalaryRun,
  recordRunPaid, setLop, superAdminOnly, todayIso, upsertSalaryAccount,
  useRuns, useSalaryRows,
} from "./store";
import type { Payslip, SalaryAccount, SalaryComponent, SalaryRun } from "./store";

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
  const [ctc, setCtc] = useState(a ? rupeesOf(a.ctcPaise) : "");
  const [masked, setMasked] = useState(a ? a.bank.masked : "");
  const [ifsc, setIfsc] = useState(a ? a.bank.ifsc : "");
  const [bankName, setBankName] = useState(a ? a.bank.name : "");
  const [pan, setPan] = useState(a ? a.pan : "");
  const [uan, setUan] = useState(a ? a.uan || "" : "");
  const [earn, setEarn] = useState<CompRow[]>(
    a ? toRows(a.earnings) : [{ ...blankRow(), key: "basic", label: "Basic" }]);
  const [ded, setDed] = useState<CompRow[]>(a ? toRows(a.deductions) : []);
  const [err, setErr] = useState<string | null>(null);

  const gross = liveSum(earn);
  const dedTotal = liveSum(ded);

  const submit = () => {
    const e = compile(earn, "earnings");
    if (e.bad) return setErr(e.bad);
    const d = compile(ded, "deduction");
    if (d.bad) return setErr(d.bad);
    const ctcPaise = toPaise(ctc);
    if (ctcPaise === null)
      return setErr("Cost to company is a whole amount. It is presentational and it still has to be a figure somebody agreed to.");
    const id = Number(memberId);
    if (!Number.isInteger(id) || id <= 0)
      return setErr("The Team member id is a whole number above zero. It is the join to the Team record and nothing else stands in for it.");
    const r = upsertSalaryAccount({
      memberId: id, memberName, employeeCode: code.trim(), designation: designation.trim(),
      joinedAt, ctcPaise, earnings: e.list, deductions: d.list,
      bank: { masked: masked.trim(), ifsc: ifsc.trim().toUpperCase(), name: bankName.trim() },
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

      <Fs legend="Who this belongs to" req
        hint="The account is Finance's. The person is Team's, and this module never invents one.">
        <div className="fin-f2">
          <Field label="Team member id"
            help={<>The join to the Team record — <span className="mono">AdminUserRow.id</span>. The Team
              endpoint is live and may not be reachable from here, so the id is typed rather than
              picked; type it wrong and this salary points at the wrong person.</>}>
            <input className="inp tnum" inputMode="numeric" value={memberId} placeholder="7"
              onChange={(e) => setMemberId(e.target.value.replace(/[^0-9]/g, ""))} />
          </Field>
          <Field label="Name" help="As it should read on the payslip they are handed.">
            <input className="inp" value={memberName} placeholder="Anjali Deshpande"
              onChange={(e) => setMemberName(e.target.value)} />
          </Field>
          <Field label="Employee code">
            <input className="inp mono" value={code} placeholder="IB-EMP-007"
              onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Designation">
            <input className="inp" value={designation} placeholder="Head of Sales"
              onChange={(e) => setDesignation(e.target.value)} />
          </Field>
          <Field label="Joined">
            <input type="date" className="inp" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
          </Field>
          <Field label="Cost to company, a year"
            help="Presentational. The slip is built from the monthly components below, never from this figure divided by twelve.">
            <RupeeInput value={ctc} onChange={setCtc} placeholder="1461600" />
          </Field>
        </div>
      </Fs>

      <Fs legend="Earnings" req
        hint="Every line prints on the slip under its own name. Gross is their sum.">
        <CompEditor rows={earn} onRows={setEarn} addLabel="Add an earning" />
      </Fs>

      <Fs legend="Deductions"
        hint="What comes off the gross. An account below the TDS threshold has no TDS line — an absent component, not a zero one.">
        <CompEditor rows={ded} onRows={setDed} addLabel="Add a deduction" />
      </Fs>

      <Totals gross={gross} ded={dedTotal} />

      <Fs legend="Where it is paid, and the statutory identifiers"
        hint="These print on the slip. The account number is held masked; the full number is not this module's to keep.">
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

export function PayRunModal({ run, onClose, onDone }: {
  run: SalaryRun; onClose: () => void; onDone: Done;
}) {
  const [reference, setReference] = useState("");
  const [accountId, setAccountId] = useState(
    (ACCOUNTS.filter((a) => a.active && a.type === "bank")[0] || ACCOUNTS[0]).accountId);
  const [err, setErr] = useState<string | null>(null);
  /* "" when this session may do it. Never used to hide the button — a person
     who cannot see the action cannot ask for it either. */
  const gate = superAdminOnly("Paying a salary run");

  return (
    <Dlg title={"Mark " + run.runId + " paid"}
      sub={<>{fmtMonth(run.month)} · {run.slips.length} slip{run.slips.length === 1 ? "" : "s"} · {inr(run.totalNetPaise)} net</>}
      onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn pri" disabled={!!gate || !reference.trim()} title={gate || undefined}
          onClick={() => {
            const e = recordRunPaid(run.runId, reference, accountId);
            if (e) return setErr(e);
            onDone(inr(run.totalNetPaise) + " paid to " + run.slips.length + " people. Every slip is numbered, hashed and frozen — they can be handed over now.", "ok");
          }}>
          Record the run paid<Role sa />
        </button>
      </>}>

      {isSuperAdmin() ? null : (
        <Notice tone="warn" ico="lock" text={<>
          <b>This one is Super Admin.</b> It sends {inr(run.totalNetPaise)} out of the company and
          stamps {run.slips.length} documents in the same write. The button stays where it is so it
          is clear what exists and who to ask.
        </>} />
      )}

      <div className="fin-chks">
        <Check ok>
          <b>Every slip is stamped and frozen in this one write.</b> All {run.slips.length} take the
          paid date, the reference and a hash together. A slip issued a minute after its neighbour is
          a slip somebody has to explain.
        </Check>
        <Check ok>
          <b>A run half paid is not a state.</b> There is no partial here. Either the transfers went
          out and the run is paid, or nothing on this screen has happened.
        </Check>
        <Check warn>
          <b>The reference is what ties this to the bank.</b> Each slip carries it with its own
          two-digit suffix, so one line on the statement resolves to a named person.
        </Check>
      </div>

      <Fs legend="The transfer" req hint="Recorded because the money moved, not to say that it should.">
        <Field label="Bank reference"
          help="The UTR or batch reference on the transfer. It must not already exist anywhere in the ledger.">
          <input className="inp mono" value={reference} autoFocus placeholder="SAL0831AUG"
            onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Paid from">
          <Pick value={accountId} onChange={setAccountId}
            options={ACCOUNTS.filter((a) => a.active)
              .map((a) => ({ key: a.accountId, label: a.masked, help: a.name }))} />
        </Field>
      </Fs>

      <div className="fin-summary">
        {run.slips.map((s) => (
          <div className="row" key={s.slipId}>
            <span className="l">
              {s.memberName}
              {s.lopDays ? <span className="faint"> · {s.lopDays} day loss of pay</span> : null}
            </span>
            <span className="tnum">{inr(s.netPaise)}</span>
          </div>
        ))}
        <div className="row grand">
          <span className="l">Leaving the account</span><span className="tnum">{inr(run.totalNetPaise)}</span>
        </div>
      </div>
    </Dlg>
  );
}
