/* =============================================================================
   Other Transaction — the modals.
   -----------------------------------------------------------------------------
   Six write surfaces, each the client half of one store function. None of
   them edit anything: TxnModal and TagModal only ever APPEND a new row;
   BudgetModal and DeactivateTagModal change a tag's own settings, never a
   transaction that already used it. UpdateTxnModal is the one that WRITES OVER
   something — the same field set TxnModal collects, receipt included, opened on
   what the row currently says, Super Admin, with every change named in the
   history. There is no separate receipt dialog: the paper behind a row is one
   of the things the row says, and it is edited where the rest of them are. Every refusal from the store renders inside the
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
  PROOF_MAX_BYTES, addTag, deactivateTag, fileSize, inr, isSuperAdmin,
  proofAccepted, proofTooBig, recordTransaction, updateTransaction,
  setBudget as setTagBudget, todayIso, useTagTotals, useTags, useTxnRows,
} from "./store";
import type { CompanyTxn, Tag, TagKind } from "./store";

/* ------------------------------------------------------------ TxnModal --- */
/* -------------------------------------------------- the shared field set --- */
/** WHAT A TRANSACTION SAYS, AS A FORM. Recording one and updating one ask the
 *  same ten questions in the same order, and they used to be two copies of the
 *  same 150 lines — which is two places for a placeholder to drift, two orders
 *  for the fields to fall into, and two dialogs that stop looking like the same
 *  screen the first time somebody edits one of them. There is one now.
 *
 *  THE RECEIPT IS NOT IN HERE. It is mandatory at the moment of recording and
 *  it has its own dialog afterwards, because swapping the paper behind a row
 *  and restating what the row says are different acts. */
export interface TxnForm {
  direction: "out" | "in"; tagKey: string; amount: string; description: string;
  party: string; mode: string; reference: string; valueDate: string;
  accountId: string; creditKind: string;
  /** The file PICKED IN THIS DIALOG, not the one already on the row. Null means
   *  untouched: recording refuses that, updating takes it to mean "leave the
   *  receipt alone". */
  bill: { filename: string; mime: string; bytes: number } | null;
}
export function txnFormOf(t: CompanyTxn): TxnForm {
  return {
    direction: t.direction, tagKey: t.tagKey, amount: (t.amountPaise / 100).toFixed(2),
    description: t.description, party: t.party, mode: t.mode, reference: t.reference,
    valueDate: t.valueDate, accountId: t.accountId, creditKind: t.creditKind || "",
    bill: null,
  };
}
function TxnFields({ f, set, tags, had, onErr }: {
  f: TxnForm; set: (patch: Partial<TxnForm>) => void; tags: Tag[];
  /** The receipt already on the row, if this is an edit. */
  had?: string | null;
  onErr: (m: string) => void;
}) {
  const isIn = f.direction === "in";
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
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
              default is about the common case rather than the list order.

              MOVING TO DEBIT CLEARS THE CREDIT KIND, because a debit has none
              and the store nulls it anyway. It does NOT clear the tag: the
              same tags are offered either way, so clearing it only ever cost
              somebody the answer they had already given. */}
          <select value={f.direction} onChange={(e) => {
            const d = e.target.value as "out" | "in";
            set({ direction: d, creditKind: d === "out" ? "" : f.creditKind });
          }}>
            <option value="in">Credit</option>
            <option value="out">Debit</option>
          </select>
        </div>
      </Field>

      {isIn ? (
        <Field label="Credit kind">
          <div className="selectbox">
            <select value={f.creditKind} onChange={(e) => set({ creditKind: e.target.value })}>
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
          <select value={f.tagKey} onChange={(e) => set({ tagKey: e.target.value })}>
            <option value="">Pick a tag…</option>
            {TAG_KINDS.map((k) => {
              const inKind = tags.filter((t) => t.kind === k.key);
              if (!inKind.length) return null;
              return (
                <optgroup key={k.key} label={k.label + " · " + k.landsIn}>
                  {inKind.map((t) => (
                    <option key={t.tagKey} value={t.tagKey}>
                      {t.label}{t.active ? "" : " · inactive"}{t.proofRequired ? " · bill required" : ""}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      </Field>

      <Field label="Amount"><RupeeInput value={f.amount} onChange={(v) => set({ amount: v })} /></Field>

      {/* A LIVE Dr/Cr READ-OUT STOOD HERE FOR ONE BUILD AND IS GONE. It drew
          the row as double entry — Dr the expense, Cr the bank — which is
          correct bookkeeping and directly contradicted the words above it the
          moment Direction started saying Credit and Debit. Those two labels
          are the BANK STATEMENT's convention, where a credit is money
          arriving; double entry uses the same two words the other way round.
          Both are right and they cannot share a dialog: one screen, two
          meanings of Credit, is how somebody files a refund as a cost. */}

      <Field label="Value date">
        <input type="date" className="inp" value={f.valueDate} max={todayIso()}
          onChange={(e) => set({ valueDate: e.target.value })} />
      </Field>
      {/* PARTY, and the placeholder says which side it means rather than a
          help line under the box: the word is the same both ways and the
          direction above already decided which. */}
      <Field label="Party">
        <input className="inp" value={f.party}
          placeholder={isIn ? "Who it came from" : "Who it was paid to"}
          onChange={(e) => set({ party: e.target.value })} />
      </Field>
      <Field label="Mode">
        <div className="selectbox">
          <select value={f.mode} onChange={(e) => set({ mode: e.target.value })}>
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </Field>
      <Field label="Reference">
        <input className="inp" value={f.reference} placeholder="UTR or bank reference"
          onChange={(e) => set({ reference: e.target.value })} />
      </Field>
      <Field label="Account">
        <div className="selectbox">
          <select value={f.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            {ACCOUNTS.filter((a) => a.active || a.accountId === f.accountId).map((a) => (
              <option key={a.accountId} value={a.accountId}>{a.masked} · {a.name}</option>
            ))}
          </select>
        </div>
      </Field>

      {/* THE RECEIPT, and the same control on both dialogs. It had a screen of
          its own until the figures on a row became correctable — the two could
          not share a dialog while one was amendable and the other was not, and
          there is nothing left to separate now. Images and PDFs up to 5 MB; the
          store refuses all three ways and says which, so this is a courtesy
          rather than the guard.

          ON AN EDIT IT IS OPTIONAL: leaving it alone keeps the receipt the row
          already has, and there is no way to REMOVE one. A row that had paper
          behind it does not stop having had it. */}
      <Field label="Receipt">
        <button type="button" className={"fin-filebox" + (f.bill ? " on" : "")}
          title={f.bill ? f.bill.filename : had || undefined}
          onClick={() => fileRef.current?.click()}>
          {f.bill
            ? <><Icon name="check" size="sm" /><span className="name">{f.bill.filename}</span>
              <span className="swap">Replace</span></>
            : had
              ? <><Icon name="check" size="sm" /><span className="name">{had}</span>
                <span className="swap">Replace</span></>
              : <><Icon name="plus" size="sm" />
                <span className="ph">Attach receipt · image or PDF, up to {fileSize(PROOF_MAX_BYTES)}</span></>}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
          onChange={(e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = "";
            if (!file) return;
            if (!proofAccepted(file.type)) {
              set({ bill: null });
              onErr(file.name + " is neither an image nor a PDF.");
              return;
            }
            if (proofTooBig(file.size)) {
              set({ bill: null });
              onErr(file.name + " is " + fileSize(file.size) + ". The limit is " + fileSize(PROOF_MAX_BYTES) + ".");
              return;
            }
            set({ bill: { filename: file.name, mime: file.type, bytes: file.size } });
          }} />
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
        <textarea className="inp" rows={3} value={f.description}
          placeholder="What it was for — the sentence that has to make sense to somebody else at audit"
          onChange={(e) => set({ description: e.target.value })} />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------ TxnModal --- */
/** FN-T10 · Record a company expense or income. Money OUT needs only a tag
 *  and a reference; money IN additionally needs one of the three permitted
 *  credit kinds — the store refuses anything else, and this dialog exists so
 *  nobody has to find that out by trying. */
export function TxnModal({ onClose, onDone }: { onClose: () => void; onDone: Done }) {
  const tags = useTags().filter((t) => t.active);
  const [f, setF] = useState<TxnForm>({
    direction: "out", tagKey: "", amount: "", description: "", party: "",
    mode: MODES[0] || "NEFT", reference: "", valueDate: todayIso(),
    accountId: ACCOUNTS.filter((a) => a.active)[0]?.accountId || "", creditKind: "", bill: null,
  });
  const [err, setErr] = useState("");
  /* Set once the write has gone through. The dialog then STOPS being a form —
     the row is a fact, Cancel would be a lie, and what is left to offer is the
     record. The pay-salary dialog does exactly this and it is the reason that
     one never leaves somebody wondering whether it took. */
  const [done, setDone] = useState<{ txnId: string; paise: number; tag: string } | null>(null);

  const set = (patch: Partial<TxnForm>) => { setF((p) => ({ ...p, ...patch })); setErr(""); };
  const isIn = f.direction === "in";
  const tag = tags.filter((t) => t.tagKey === f.tagKey)[0] || null;
  const account = ACCOUNTS.filter((x) => x.accountId === f.accountId)[0] || null;
  const paise = toPaise(f.amount);

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
            <div className="row"><span className="l">Reference</span><span className="mono">{f.reference}</span></div>
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
      direction: f.direction, tagKey: f.tagKey, amountPaise: paise, description: f.description,
      party: f.party, mode: f.mode, reference: f.reference, valueDate: f.valueDate,
      accountId: f.accountId, creditKind: isIn ? f.creditKind || null : null,
      bill: f.bill || { filename: "", mime: "" },
    });
    if (res.error) { setErr(res.error); return; }
    setDone({ txnId: res.txnId as string, paise, tag: tag ? tag.label : "the tag" });
  };

  return (
    <Dlg title="Record a transaction" onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} />
        {/* Disabled without the receipt, because the store refuses without it —
            a button that is going to say no is better off saying so first. */}
        <button className="btn pri" disabled={!f.bill} onClick={submit}>Record</button></>}>

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
      <TxnFields f={f} set={set} tags={tags} onErr={setErr} />

    </Dlg>
  );
}

/* ------------------------------------------------------ UpdateTxnModal --- */
/** FN-T11 · Update a recorded row. Super Admin.
 *
 *  THE SAME FORM AS RECORDING, opened on what the row currently says. That is
 *  the whole design: somebody who has recorded a transaction already knows this
 *  screen, and a correction that asked its questions in a different order or
 *  called the same field something else would be a second thing to learn for no
 *  reason.
 *
 *  IT OFFERS THE RECEIPT TOO, and it is the only screen that does once a row is
 *  written. The paper used to have a dialog of its own, which existed because a
 *  row's figures could not be amended and its receipt could — two rules, so two
 *  screens. One rule now, so one screen. What it does NOT offer is a way to
 *  delete anything, the receipt included: replacing one is a change the history
 *  records, and removing one would be a gap nobody could account for.
 *
 *  THE BUTTON WAITS FOR A CHANGE. The store refuses a write in which nothing
 *  moved, so the dialog says so first rather than opening a refusal somebody
 *  has to read to learn they pressed a button for nothing. */
export function UpdateTxnModal({ txn, onClose, onDone }: {
  txn: CompanyTxn; onClose: () => void; onDone: Done;
}) {
  /* INACTIVE TAGS ARE OFFERED HERE, and only the one this row already wears —
     a row filed under a tag that has since been deactivated must survive an
     edit to its remark without being forced onto a different tag. The store
     refuses a MOVE to an inactive tag; keeping one is fine. */
  const all = useTags();
  const tags = all.filter((t) => t.active || t.tagKey === txn.tagKey);
  const [f, setF] = useState<TxnForm>(txnFormOf(txn));
  const [err, setErr] = useState("");
  const sa = isSuperAdmin();

  const set = (patch: Partial<TxnForm>) => { setF((p) => ({ ...p, ...patch })); setErr(""); };
  const paise = toPaise(f.amount);
  const changed = JSON.stringify(f) !== JSON.stringify(txnFormOf(txn));

  const submit = () => {
    if (paise === null) { setErr("Enter the amount in whole rupees (paise to two decimals), above zero."); return; }
    const res = updateTransaction(txn.txnId, {
      direction: f.direction, tagKey: f.tagKey, amountPaise: paise, description: f.description,
      party: f.party, mode: f.mode, reference: f.reference, valueDate: f.valueDate,
      accountId: f.accountId, creditKind: f.direction === "in" ? f.creditKind || null : null,
      bill: f.bill,
    });
    if (res) { setErr(res); return; }
    onDone(txn.txnId + " updated. What it said before is in its history.", "ok");
  };

  return (
    <Dlg title={"Update " + txn.txnId} sub="Super Admin." onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} />
        <button className="btn pri" disabled={!sa || !changed}
          title={!sa ? "Updating a transaction is Super Admin only." : !changed ? "Nothing has changed yet." : undefined}
          onClick={submit}>Save</button></>}>

      {/* THE ONE STANDING NOTE, and it is here because this is the only screen
          in the module that overwrites something already on the record. What it
          says is the deal: the row moves, the history does not. */}
      <Notice tone="info" ico="recon" text={<>
        <b>Every change is recorded.</b> The row will say what you leave here, and its history keeps
        a line naming each field that moved and what it moved from — so nothing that was ever true
        of this row is lost.
      </>} />

      <TxnFields f={f} set={set} tags={tags} had={txn.bill?.filename || null} onErr={setErr} />
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


