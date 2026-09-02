/* =============================================================================
   Other Transaction — the modals.
   -----------------------------------------------------------------------------
   Six write surfaces, each the client half of one store function. None of
   them edit anything: TxnModal, TagModal and BillModal only ever APPEND a new
   row; BudgetModal and DeactivateTagModal change a tag's own settings, never
   a transaction that already used it; ReverseTxnModal appends a counter-entry
   and touches nothing else. Every refusal from the store renders inside the
   dialog that produced it — the sentence it contradicts stays on screen.
   ============================================================================= */
import { useState } from "react";
import { Notice } from "../../ui";
import { Cancel, Dlg, Field, Fs, Pick, RupeeInput, toPaise } from "./dialog";
import type { Done } from "./dialog";
import { Check, Money, TagChip } from "./bits";
import {
  ACCOUNTS, CREDIT_KINDS, MODES, TAG_KINDS,
  addTag, attachBill, deactivateTag, isSuperAdmin, recordTransaction, reverseTransaction,
  setBudget as setTagBudget, tagKindMeta, todayIso, useTagTotals, useTags, useTxnRows,
} from "./store";
import type { CompanyTxn, Tag, TagKind } from "./store";

/* ------------------------------------------------------------ TxnModal --- */
/** FN-T10 · Record a company expense or income. Money OUT needs only a tag
 *  and a reference; money IN additionally needs one of the three permitted
 *  credit kinds — the store refuses anything else, and this dialog exists so
 *  nobody has to find that out by trying. */
export function TxnModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const tags = useTags().filter((t) => t.active);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [tagKey, setTagKey] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [party, setParty] = useState("");
  const [mode, setMode] = useState<string>(MODES[0] || "NEFT");
  const [reference, setReference] = useState("");
  const [valueDate, setValueDate] = useState(todayIso());
  const [accountId, setAccountId] = useState(ACCOUNTS.filter((a) => a.active)[0]?.accountId || "");
  const [creditKind, setCreditKind] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    /* toPaise returns null on anything that is not a clean rupee amount — a
       half-typed "1,2" or an empty box never becomes a number, let alone NaN
       in the field the person is still looking at. */
    const amountPaise = toPaise(amount);
    if (amountPaise === null) { setErr("Enter the amount in whole rupees (paise to two decimals), above zero."); return; }
    const res = recordTransaction({
      direction, tagKey, amountPaise, description, party, mode, reference, valueDate, accountId,
      creditKind: direction === "in" ? creditKind || null : null,
    });
    if (res.error) { setErr(res.error); return; }
    onDone(res.txnId + " recorded.", "ok");
  };

  return (
    <Dlg title="Record a transaction"
      sub="Company money in or out, under a tag. Once saved this row is a fact — nobody edits it; a correction is a counter-entry, never a rewrite."
      onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} /><button className="btn pri" onClick={submit}>Record</button></>}>

      <Fs legend="Direction" req>
        <Pick value={direction} onChange={(v) => { setDirection(v); setCreditKind(""); }}
          options={[{ key: "out", label: "Money out" }, { key: "in", label: "Money in" }]} />
      </Fs>

      {direction === "in" ? (
        <Fs legend="Credit kind" req hint="What a person may hand-key in, and nothing else.">
          <Pick value={creditKind} onChange={setCreditKind}
            options={CREDIT_KINDS.map((c) => ({ key: c.key, label: c.label }))} />
          <Notice tone="info" text={<>
            Money in here is restricted to these three non-revenue kinds. Customer money has
            exactly one way into the books — a subscription installment payment — and it is never
            recorded, faked or matched to a bank line on this screen.
          </>} />
        </Fs>
      ) : null}

      <Fs legend="Tag" req hint="Decides where this lands in Analytics. Only active tags are offered.">
        <div className="fin-pick" role="listbox" aria-label="Tag">
          {tags.map((t) => {
            const k = tagKindMeta(t.kind);
            return (
              <button type="button" key={t.tagKey} role="option" aria-selected={tagKey === t.tagKey}
                className={tagKey === t.tagKey ? "on" : ""} onClick={() => setTagKey(t.tagKey)}>
                <span>{t.label}</span>
                <span className="s">{k?.label || t.kind} · lands in {k?.landsIn || "—"}</span>
                <span className="a">{t.proofRequired ? "bill required" : ""}</span>
              </button>
            );
          })}
        </div>
      </Fs>

      {/* One field per line — the pay dialog's rhythm, panel-wide now. */}
      <div className="fin-stack">
        <Field label="Amount"><RupeeInput value={amount} onChange={setAmount} /></Field>
        <Field label="Value date">
          <input type="date" className="inp" value={valueDate} max={todayIso()}
            onChange={(e) => setValueDate(e.target.value)} />
        </Field>
        <Field label="Description" help="What it was for — the sentence that has to make sense to someone else at audit.">
          <input className="inp" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Party">
          <input className="inp" value={party} onChange={(e) => setParty(e.target.value)} />
        </Field>
        <Field label="Mode">
          <select className="inp" value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Reference" help="Mandatory. Without a bank reference or UTR, this row can never be tied to a statement.">
          <input className="inp" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Account">
          <select className="inp" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {ACCOUNTS.filter((a) => a.active).map((a) => <option key={a.accountId} value={a.accountId}>{a.masked}</option>)}
          </select>
        </Field>
      </div>
    </Dlg>
  );
}

/* ------------------------------------------------------------ TagModal --- */
/** FN-T09 · Create a tag. Custom by definition — anyone with edit rights
 *  makes one. The kind is the one part of it that is not free. */
export function TagModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<TagKind>("variable");
  const [budget, setBudgetStr] = useState("");
  const [proofRequired, setProofRequired] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    const budgetPaise = budget.trim() ? toPaise(budget) : null;
    if (budget.trim() && budgetPaise === null) { setErr("A budget is a whole rupee amount, or leave it blank for none."); return; }
    const res = addTag(label, kind, budgetPaise, proofRequired);
    if (res.error) { setErr(res.error); return; }
    onDone(label.trim() + " created.", "ok");
  };

  return (
    <Dlg title="Create a tag"
      sub="Anyone with edit rights can create one. A tag is deactivated later, never deleted or re-kinded — deleting one would silently re-bucket every transaction that already used it."
      onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} /><button className="btn pri" onClick={submit}>Create</button></>}>

      <Field label="Label" help="What shows on every row filed under it.">
        <input className="inp" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>

      <Fs legend="Rolls up to" req hint="The one choice here that is not free — it decides where the money lands in Analytics, chosen now and rarely changed after.">
        <Pick value={kind} onChange={setKind}
          options={TAG_KINDS.map((k) => ({ key: k.key as TagKind, label: k.label + " — " + k.landsIn, help: k.help }))} />
      </Fs>

      <div className="fin-stack">
        <Field label="Budget" help="Warns at 90% of itself and never blocks.">
          <RupeeInput value={budget} onChange={setBudgetStr} placeholder="No budget" />
        </Field>
        <Field label="Bill">
          <label>
            <input type="checkbox" checked={proofRequired} onChange={(e) => setProofRequired(e.target.checked)} />
            {" "}Required on every row under this tag
          </label>
        </Field>
      </div>
    </Dlg>
  );
}

/* ---------------------------------------------------------- BudgetModal --- */
/** Sets a warning line, not a wall. Shown against what the tag has already
 *  spent this period, because a budget typed with no sense of where spend
 *  already stands is a number picked in the dark. */
export function BudgetModal({ tag, onClose, onDone }: { tag: Tag; onClose: () => void; onDone: Done }) {
  const { rows } = useTagTotals();
  const spentPaise = rows.filter((r) => r.tag.tagKey === tag.tagKey)[0]?.spentPaise || 0;
  const [budget, setBudgetStr] = useState(tag.budgetPaise ? String(tag.budgetPaise / 100) : "");
  const [err, setErr] = useState("");

  const proposedPaise = budget.trim() ? toPaise(budget) : null;
  const pctOfProposed = proposedPaise ? Math.round((spentPaise / proposedPaise) * 100) : null;

  const submit = () => {
    if (budget.trim() && proposedPaise === null) { setErr("A budget is a whole rupee amount, or leave it blank to remove it."); return; }
    const res = setTagBudget(tag.tagKey, proposedPaise);
    if (res) { setErr(res); return; }
    onDone("Budget for " + tag.label + " updated.", "ok");
  };

  return (
    <Dlg title={"Budget · " + tag.label} sub="Warns at 90% of itself. It never blocks — the money still has to move."
      onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} /><button className="btn pri" onClick={submit}>Save</button></>}>

      <div className="fin-summary">
        <div className="row"><span className="l">Spent this period</span><Money paise={spentPaise} /></div>
        <div className="row"><span className="l">Current budget</span>
          <span>{tag.budgetPaise ? <Money paise={tag.budgetPaise} /> : <span className="faint">none</span>}</span>
        </div>
        {proposedPaise !== null ? (
          <div className="row grand">
            <span className="l">At the proposed budget</span>
            <span className="tnum">{pctOfProposed}% spent already</span>
          </div>
        ) : null}
      </div>

      <Field label="New budget" help="Leave blank to remove the budget entirely — the tag is then unlimited and unwatched.">
        <RupeeInput value={budget} onChange={setBudgetStr} placeholder="No budget" />
      </Field>

      <Notice tone="info" text={<>
        A budget warns at 90% of itself and never blocks. Rent still has to be paid in a month
        somebody set its budget too low — this number is a flag for a person, not a limit the
        panel enforces.
      </>} />
    </Dlg>
  );
}

/* ---------------------------------------------------- DeactivateTagModal --- */
/** Super Admin. Deactivating is the ONLY way a tag stops accepting new rows —
 *  deleting one is not offered anywhere, because it would silently re-bucket
 *  every transaction that already used it. */
export function DeactivateTagModal({ tag, onClose, onDone }: { tag: Tag; onClose: () => void; onDone: Done }) {
  const rows = useTxnRows();
  const n = rows.filter((r) => r.t.tagKey === tag.tagKey).length;
  const sa = isSuperAdmin();
  const [err, setErr] = useState("");

  const submit = () => {
    const res = deactivateTag(tag.tagKey);
    if (res) { setErr(res); return; }
    onDone(tag.label + " deactivated.", "ok");
  };

  return (
    <Dlg title={"Deactivate " + tag.label} sub="Super Admin." onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn dgr" disabled={!sa} title={sa ? undefined : "Deactivating a tag is Super Admin only."} onClick={submit}>
          Deactivate
        </button>
      </>}>
      <Check ok>
        {n} existing row{n === 1 ? "" : "s"} keep <TagChip k={tag.tagKey} />. Nothing about them changes and
        nothing is re-bucketed — that is the entire reason this is a deactivation and not a delete.
      </Check>
      <Check warn>Nobody will be able to file a new transaction under {tag.label} once this is saved.</Check>
      <p className="fin-fine">There is no reactivate here. A tag that is needed again is created fresh, under a new key.</p>
    </Dlg>
  );
}

/* ----------------------------------------------------------- BillModal --- */
/** A prototype field, not an upload — the record is that a bill exists and
 *  what it is called, which is enough to clear the missing-bill state. */
export function BillModal({ txn, onClose, onDone }: { txn: CompanyTxn; onClose: () => void; onDone: Done }) {
  const [filename, setFilename] = useState(txn.bill?.filename || "");
  const [err, setErr] = useState("");

  const submit = () => {
    const res = attachBill(txn.txnId, filename);
    if (res) { setErr(res); return; }
    onDone("Bill attached to " + txn.txnId + ".", "ok");
  };

  return (
    <Dlg title="Attach a bill" sub={txn.txnId + " — " + txn.description} onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} /><button className="btn pri" onClick={submit}>Attach</button></>}>
      <Field label="Filename" help="No upload in this prototype — the filename is the whole record that a bill exists.">
        <input className="inp" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="invoice.pdf" />
      </Field>
    </Dlg>
  );
}

/* ----------------------------------------------------- ReverseTxnModal --- */
/** FN-T11 · Super Admin. A correction is an append, never an edit: this
 *  writes a new row with a negative amount and leaves the original exactly
 *  as it was posted. */
export function ReverseTxnModal({ txn, onClose, onDone }: { txn: CompanyTxn; onClose: () => void; onDone: Done }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const sa = isSuperAdmin();

  const submit = () => {
    const res = reverseTransaction(txn.txnId, reason);
    if (res) { setErr(res); return; }
    onDone(txn.txnId + " reversed.", "ok");
  };

  return (
    <Dlg title={"Reverse " + txn.txnId} sub="Super Admin." onClose={onClose} err={err}
      footer={<>
        <Cancel onClose={onClose} />
        <button className="btn dgr" disabled={!sa} title={sa ? undefined : "Reversing a transaction is Super Admin only."} onClick={submit}>
          Reverse
        </button>
      </>}>
      <Check ok>A counter-entry is appended, carrying <Money paise={-Math.abs(txn.amountPaise)} />.</Check>
      <Check ok>{txn.txnId} itself is untouched — its state turns to reversed, and nothing on the row is edited.</Check>
      <Check warn>This moves no money by itself. Whatever the mistake needs undone in the bank happens separately, outside this screen.</Check>
      <Field label="Reason" help="Mandatory, and read at audit — a reversal with no reason is indistinguishable from a mistake nobody noticed.">
        <textarea className="inp" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dlg>
  );
}
