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
import { useRef, useState } from "react";
import { Icon, Notice } from "../../ui";
import { go } from "../../ui/nav";
import { Cancel, Dlg, Field, Fs, Pick, RupeeInput, toPaise } from "./dialog";
import type { Done } from "./dialog";
import { Check, Money, TagChip } from "./bits";
import {
  ACCOUNTS, CREDIT_KINDS, MODES, TAG_KINDS,
  PROOF_MAX_BYTES, addTag, attachBill, clearTxnWrong, deactivateTag, fileSize, inr, isSuperAdmin,
  markTxnWrong, proofAccepted, proofTooBig, recordTransaction, reverseTransaction,
  setBudget as setTagBudget, todayIso, useTagTotals, useTags, useTxnRows,
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
  const [bill, setBill] = useState<{ filename: string; mime: string; bytes: number } | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  /* Set once the write has gone through. The dialog then STOPS being a form —
     the row is a fact, Cancel would be a lie, and what is left to offer is the
     record. The pay-salary dialog does exactly this and it is the reason that
     one never leaves somebody wondering whether it took. */
  const [done, setDone] = useState<{ txnId: string; paise: number; tag: string } | null>(null);

  const isIn = direction === "in";
  const tag = tags.filter((t) => t.tagKey === tagKey)[0] || null;
  const account = ACCOUNTS.filter((x) => x.accountId === accountId)[0] || null;
  const paise = toPaise(amount);

  /* ============================================== done: the receipt === */
  if (done) {
    const close = () => onDone(done.txnId + " recorded.", "ok");
    return (
      <Dlg title="Recorded" onClose={close}
        footer={<>
          <button className="btn" onClick={close}>Done</button>
          <button className="btn pri" onClick={() => {
            close();
            go("#/finance-transactions/" + encodeURIComponent(done.txnId));
          }}>Open the record</button>
        </>}>
        <div className="fin-paid">
          <span className="mark"><Icon name="check" /></span>
          <div className="amt tnum">{inr(done.paise)}</div>
          <div className="to">{isIn ? "received into" : "paid from"} {account ? account.masked : "the account"}</div>
          <div className="facts">
            <div className="row"><span className="l">Filed as</span>
              <span>{isIn ? "Credit" : "Debit"} · {done.tag}</span></div>
            <div className="row"><span className="l">Reference</span><span className="mono">{reference}</span></div>
            <div className="row"><span className="l">Row</span><span className="mono">{done.txnId}</span></div>
          </div>
        </div>
      </Dlg>
    );
  }

  const submit = () => {
    /* toPaise returns null on anything that is not a clean rupee amount — a
       half-typed "1,2" or an empty box never becomes a number, let alone NaN
       in the field the person is still looking at. */
    if (paise === null) { setErr("Enter the amount in whole rupees (paise to two decimals), above zero."); return; }
    const res = recordTransaction({
      direction, tagKey, amountPaise: paise, description, party, mode, reference, valueDate, accountId,
      creditKind: isIn ? creditKind || null : null,
      bill: bill || { filename: "", mime: "" },
    });
    if (res.error) { setErr(res.error); return; }
    setDone({ txnId: res.txnId as string, paise, tag: tag ? tag.label : "the tag" });
  };

  return (
    <Dlg title="Record a transaction" onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} />
        {/* Disabled without the receipt, because the store refuses without it —
            a button that is going to say no is better off saying so first. */}
        <button className="btn pri" disabled={!bill} onClick={submit}>Record</button></>}>

      {/* EVERY CHOICE IS A DROPDOWN AND EVERY FIELD IS ON ITS OWN LINE — the
          pay-salary dialog's rhythm. The three segmented pickers this had
          (direction, credit kind, and a scrolling list of tag cards) spent a
          screen and a half on three answers, and the tag list put a two-line
          description under every option so the one thing being chosen was the
          hardest thing to scan.

          THE PROSE IS GONE WITH THEM. The standing sub-line, three field hints
          and the notice about non-revenue credits said things that are either
          true of every write in this module or enforced by the store, which
          refuses and says why at the moment it refuses — which is the moment
          somebody is actually asking. */}
      <div className="fin-stack">
        {/* DEBIT AND CREDIT, said outright. Direction was two words that only
            mean something to somebody already holding the convention; the
            entry line below says what the row will actually do. */}
        <Field label="Direction">
          <div className="selectbox">
            {/* CREDIT FIRST, DEBIT SECOND, in the same order the filter offers
                them — one ordering across the section, so a person is not
                re-reading the list every time they meet it. The SELECTED value
                is still Debit, because most company rows are money out and a
                default is about the common case rather than the list order. */}
            <select value={direction} onChange={(e) => {
              setDirection(e.target.value as "out" | "in");
              setCreditKind(""); setTagKey(""); setErr("");
            }}>
              <option value="in">Credit</option>
              <option value="out">Debit</option>
            </select>
          </div>
        </Field>

        {isIn ? (
          <Field label="Credit kind">
            <div className="selectbox">
              <select value={creditKind} onChange={(e) => { setCreditKind(e.target.value); setErr(""); }}>
                <option value="">Pick what this credit is…</option>
                {CREDIT_KINDS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </Field>
        ) : null}

        {/* GROUPED BY WHERE THE MONEY LANDS, which is the only part of a tag
            that is not free and the only thing worth knowing while picking
            one. It was a description line under every option; as an optgroup
            it is structure instead of prose — the same fact, read in a glance,
            and the option itself is just the tag's name.

            `bill` rides the option because a tag that requires one will refuse
            the write later, and finding that out at the button is worse than
            reading it here. */}
        <Field label="Tag">
          <div className="selectbox">
            <select value={tagKey} onChange={(e) => { setTagKey(e.target.value); setErr(""); }}>
              <option value="">Pick a tag…</option>
              {TAG_KINDS.map((k) => {
                const inKind = tags.filter((t) => t.kind === k.key);
                if (!inKind.length) return null;
                return (
                  <optgroup key={k.key} label={k.label + " · " + k.landsIn}>
                    {inKind.map((t) => (
                      <option key={t.tagKey} value={t.tagKey}>
                        {t.label}{t.proofRequired ? " · bill required" : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
        </Field>

        <Field label="Amount"><RupeeInput value={amount} onChange={setAmount} /></Field>

        {/* A LIVE Dr/Cr READ-OUT STOOD HERE FOR ONE BUILD AND IS GONE. It drew
            the row as double entry — Dr the expense, Cr the bank — which is
            correct bookkeeping and directly contradicted the words above it the
            moment Direction started saying Credit and Debit. Those two labels
            are the BANK STATEMENT's convention, where a credit is money
            arriving; double entry uses the same two words the other way round.
            Both are right and they cannot share a dialog: one screen, two
            meanings of Credit, is how somebody files a refund as a cost. */}

        <Field label="Value date">
          <input type="date" className="inp" value={valueDate} max={todayIso()}
            onChange={(e) => setValueDate(e.target.value)} />
        </Field>
        {/* PARTY, and the placeholder says which side it means rather than a
            help line under the box: the word is the same both ways and the
            direction above already decided which. */}
        <Field label="Party">
          <input className="inp" value={party}
            placeholder={isIn ? "Who it came from" : "Who it was paid to"}
            onChange={(e) => setParty(e.target.value)} />
        </Field>
        <Field label="Mode">
          <div className="selectbox">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Reference">
          <input className="inp" value={reference} placeholder="UTR or bank reference"
            onChange={(e) => setReference(e.target.value)} />
        </Field>
        {/* THE RECEIPT, MANDATORY — the same control and the same rule as a
            salary payment's, which is the point: evidence should not be worth
            more on one screen than another. Images and PDFs up to 5 MB; the
            store refuses all three ways and says which, so this is a courtesy
            rather than the guard. */}
        <Field label="Receipt">
          <button type="button" className={"fin-filebox" + (bill ? " on" : "")}
            title={bill ? bill.filename : undefined}
            onClick={() => fileRef.current?.click()}>
            {bill
              ? <><Icon name="check" size="sm" /><span className="name">{bill.filename}</span>
                <span className="swap">Replace</span></>
              : <><Icon name="plus" size="sm" /><span className="ph">Attach receipt · image or PDF, up to {fileSize(PROOF_MAX_BYTES)}</span></>}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = "";
              if (!f) return;
              if (!proofAccepted(f.type)) {
                setBill(null);
                setErr(f.name + " is neither an image nor a PDF.");
                return;
              }
              if (proofTooBig(f.size)) {
                setBill(null);
                setErr(f.name + " is " + fileSize(f.size) + ". The limit is " + fileSize(PROOF_MAX_BYTES) + ".");
                return;
              }
              setBill({ filename: f.name, mime: f.type, bytes: f.size });
              setErr("");
            }} />
        </Field>
        <Field label="Account">
          <div className="selectbox">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {ACCOUNTS.filter((a) => a.active).map((a) => (
                <option key={a.accountId} value={a.accountId}>{a.masked} · {a.name}</option>
              ))}
            </select>
          </div>
        </Field>

        {/* LAST, AND A BOX RATHER THAN A LINE. It sat in the middle of the form
            as a one-line input, which made the field that has to make sense to
            a stranger at audit look like the same size of answer as Mode or
            Reference — and a single line quietly asks for three words.

            It is the only OPEN question on this dialog; everything above it is
            a choice from a list, an amount, a date or a file. An open question
            belongs after the closed ones, with room to answer. */}
        {/* REMARK, and the stored field is still `description`. The label is
            what a person calls it; the wire name is what the ledger and the API
            already agree on, and renaming that would be a migration to make a
            word nicer. */}
        <Field label="Remark">
          <textarea className="inp" rows={3} value={description}
            placeholder="What it was for — the sentence that has to make sense to somebody else at audit"
            onChange={(e) => setDescription(e.target.value)} />
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
/** THE ONE THING ON A RECORDED ROW THAT CAN CHANGE — and the dialog says so,
 *  because it is reached from a menu item called Edit and the word promises
 *  more than the ledger allows. The figures are what the row asserts; the
 *  receipt is evidence ABOUT it, and only the second is amendable. */
export function BillModal({ txn, onClose, onDone }: { txn: CompanyTxn; onClose: () => void; onDone: Done }) {
  const [file, setFile] = useState<{ filename: string; mime: string; bytes: number } | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const had = txn.bill?.filename || null;

  const submit = () => {
    if (!file) { setErr("Pick a file."); return; }
    const res = attachBill(txn.txnId, file);
    if (res) { setErr(res); return; }
    onDone(file.filename + (had ? " replaced the receipt on " : " attached to ") + txn.txnId + ".", "ok");
  };

  return (
    <Dlg title={had ? "Replace the receipt" : "Attach a receipt"}
      sub={<span className="mono">{txn.txnId}</span>} onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} />
        <button className="btn pri" disabled={!file} onClick={submit}>{had ? "Replace" : "Attach"}</button></>}>

      {/* The one standing note on this dialog, and it is here because the menu
          item that opens it says Edit — a word that promises the figures. */}
      <Notice tone="info" ico="lock" text={<>
        <b>Only the receipt.</b> The amount, direction, tag, reference, date and account are what
        this row asserts and none of them can be changed — a correction to any of those is a
        counter-entry, appended, never a rewrite.
      </>} />

      <Field label="Receipt">
        <button type="button" className={"fin-filebox" + (file ? " on" : "")}
          title={file ? file.filename : undefined}
          onClick={() => fileRef.current?.click()}>
          {file
            ? <><Icon name="check" size="sm" /><span className="name">{file.filename}</span>
              <span className="swap">Replace</span></>
            : <><Icon name="plus" size="sm" />
              <span className="ph">{had ? "Pick the file that replaces " + had : "Attach receipt"}
                {" · image or PDF, up to " + fileSize(PROOF_MAX_BYTES)}</span></>}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            e.target.value = "";
            if (!f) return;
            if (!proofAccepted(f.type)) { setFile(null); setErr(f.name + " is neither an image nor a PDF."); return; }
            if (proofTooBig(f.size)) {
              setFile(null);
              setErr(f.name + " is " + fileSize(f.size) + ". The limit is " + fileSize(PROOF_MAX_BYTES) + ".");
              return;
            }
            setFile({ filename: f.name, mime: f.type, bytes: f.size });
            setErr("");
          }} />
      </Field>
    </Dlg>
  );
}

/* -------------------------------------------------------- MarkWrongModal --- */
/** FN-T11b · Raise a hand about a row, or put it down again.
 *
 *  NEITHER OF THESE MOVES MONEY, and the dialog says so, because the button
 *  sits next to one that does. Marking is anybody-with-edit; reversing is Super
 *  Admin. That split is the point of the feature: the person who notices and
 *  the person who settles it are usually not the same person, and without this
 *  the noticing has nowhere to go but a message somebody sends. */
export function MarkWrongModal({ txn, onClose, onDone }: {
  txn: CompanyTxn; onClose: () => void; onDone: Done;
}) {
  const marked = !!txn.wrong;
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    const res = marked ? clearTxnWrong(txn.txnId, text) : markTxnWrong(txn.txnId, text);
    if (res) { setErr(res); return; }
    onDone(marked
      ? "The mark on " + txn.txnId + " is cleared."
      : txn.txnId + " is marked wrong. It still counts — a counter-entry is what corrects it.",
    marked ? "ok" : "warn");
  };

  return (
    <Dlg title={marked ? "Clear the mark" : "Mark this row wrong"}
      sub={<span className="mono">{txn.txnId}</span>} onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} />
        <button className={"btn " + (marked ? "pri" : "pri")} disabled={!text.trim()} onClick={submit}>
          {marked ? "Clear the mark" : "Mark wrong"}
        </button></>}>

      <Notice tone="info" ico="alert" text={marked ? <>
        <b>Nothing about the row changes.</b> It never did — the mark was a note that somebody
        had a doubt, and clearing it is a note about what they found.
      </> : <>
        <b>This moves no money.</b> The row keeps its amount and every total still counts it,
        because the money did move. A mark says somebody looked and thinks it should not have;
        the correction is a counter-entry, which is Super Admin.
      </>} />

      {marked ? (
        <Field label="What was raised">
          <div className="fin-derived">{txn.wrong?.reason}</div>
        </Field>
      ) : null}

      <Field label={marked ? "What you found" : "What is wrong with it"}>
        <textarea className="inp" rows={3} autoFocus value={text}
          placeholder={marked
            ? "Why it turns out to be right, or how it was settled"
            : "What looks wrong, so the next person can act on it without asking"}
          onChange={(e) => { setText(e.target.value); setErr(""); }} />
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
