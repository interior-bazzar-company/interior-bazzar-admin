/* =============================================================================
   Other Transaction — the modals.
   -----------------------------------------------------------------------------
   Six write surfaces, each the client half of one store function. None of
   them edit anything, and that is the module's whole shape: TxnModal and
   TagModal APPEND a new row; BudgetModal and DeactivateTagModal change a tag's
   own settings, never a transaction that already used it; CancelTxnModal
   changes one thing about a posted row — whether it counts — and not a single
   figure on it. Nothing here rewrites what a row says, and nothing deletes one.
   Every refusal from the store renders inside the dialog that produced it —
   the sentence it contradicts stays on screen.
   ============================================================================= */
import { useState } from "react";
import { Alert, Button, Checkbox, DateInput, Input, SelectInput, Textarea } from "../../ui";
import { go } from "../../ui/nav";
import { Cancel, Dlg, Field, Fs, Pick, RupeeInput, toPaise } from "./dialog";
import type { Done } from "./dialog";
import { Check, Fine, Ledger, LedgerRow, Money, PaidReceipt, ProofField, TagChip } from "./bits";
import {
  ACCOUNTS, CREDIT_KINDS, MODES, TAG_KINDS,
  PROOF_MAX_BYTES, addTag, cancelTransaction, deactivateTag, fileSize,
  isSuperAdmin, proofAccepted, proofTooBig, recordTransaction,
  setBudget as setTagBudget, todayIso, useTagTotals, useTags, useTxnRows,
} from "./store";
import type { CompanyTxn, Tag, TagKind } from "./store";

/* --------------------------------------------------- TxnModal's field set --- */
/** WHAT A TRANSACTION SAYS, AS A FORM. It was pulled out of `TxnModal` when an
 *  update dialog asked the same ten questions and two copies of 150 lines were
 *  about to drift apart. Nothing updates a row any more — a wrong one is
 *  cancelled and recorded again — so this has one caller, and it stays a named
 *  piece only because a form this long reads better with its own signature than
 *  inlined into the dialog that submits it. */
interface TxnForm {
  direction: "out" | "in"; tagKey: string; amount: string; description: string;
  party: string; mode: string; reference: string; valueDate: string;
  accountId: string; creditKind: string;
  bill: { filename: string; mime: string; bytes: number } | null;
}
function TxnFields({ f, set, tags, onErr }: {
  f: TxnForm; set: (patch: Partial<TxnForm>) => void; tags: Tag[];
  onErr: (m: string) => void;
}) {
  const isIn = f.direction === "in";
  return (
    <>
      {/* DEBIT AND CREDIT, said outright. Direction was two words that only
          mean something to somebody already holding the convention; the
          entry line below says what the row will actually do. */}
      <Field label="Direction">
        {/* CREDIT FIRST, DEBIT SECOND, in the same order the filter offers
            them — one ordering across the section, so a person is not
            re-reading the list every time they meet it. The SELECTED value
            is still Debit, because most company rows are money out and a
            default is about the common case rather than the list order.

            MOVING TO DEBIT CLEARS THE CREDIT KIND, because a debit has none
            and the store nulls it anyway. It does NOT clear the tag: the
            same tags are offered either way, so clearing it only ever cost
            somebody the answer they had already given. */}
        <SelectInput ariaLabel="Direction" value={f.direction}
          options={[{ v: "in", l: "Credit" }, { v: "out", l: "Debit" }]}
          onChange={(v) => {
            const d = v as "out" | "in";
            set({ direction: d, creditKind: d === "out" ? "" : f.creditKind });
          }} />
      </Field>

      {isIn ? (
        <Field label="Credit kind">
          <SelectInput ariaLabel="Credit kind" value={f.creditKind}
            onChange={(v) => set({ creditKind: v })}
            options={[{ v: "", l: "Pick what this credit is…" }]
              .concat(CREDIT_KINDS.map((c) => ({ v: c.key, l: c.label })))} />
        </Field>
      ) : null}

      {/* GROUPED BY WHERE THE MONEY LANDS, which is the only part of a tag
          that is not free and the only thing worth knowing while picking
          one. It was a description line under every option; as a group label
          it is structure instead of prose — the same fact, read in a glance,
          and the option itself is just the tag's name.

          `bill` rides the option because a tag that requires one will refuse
          the write later, and finding that out at the button is worse than
          reading it here. */}
      <Field label="Tag">
        <SelectInput ariaLabel="Tag" value={f.tagKey} onChange={(v) => set({ tagKey: v })}
          options={[{ v: "", l: "Pick a tag…" }].concat(
            TAG_KINDS.flatMap((k) => tags.filter((t) => t.kind === k.key).map((t) => ({
              v: t.tagKey,
              l: k.label + " → " + t.label
                + (t.active ? "" : " · inactive")
                + (t.proofRequired ? " · bill required" : ""),
            }))))} />
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
        <DateInput value={f.valueDate} max={todayIso()} ariaLabel="Value date"
          onChange={(v) => set({ valueDate: v })} />
      </Field>
      {/* PARTY, and the placeholder says which side it means rather than a
          help line under the box: the word is the same both ways and the
          direction above already decided which. */}
      <Field label="Party">
        <Input value={f.party} ariaLabel="Party"
          ph={isIn ? "Who it came from" : "Who it was paid to"}
          onChange={(v) => set({ party: v })} />
      </Field>
      <Field label="Mode">
        <SelectInput ariaLabel="Mode" value={f.mode} options={MODES.slice()}
          onChange={(v) => set({ mode: v })} />
      </Field>
      <Field label="Reference">
        <Input mono value={f.reference} ph="UTR or bank reference" ariaLabel="Reference"
          onChange={(v) => set({ reference: v })} />
      </Field>
      <Field label="Account">
        <SelectInput ariaLabel="Account" value={f.accountId} onChange={(v) => set({ accountId: v })}
          options={ACCOUNTS.filter((a) => a.active || a.accountId === f.accountId)
            .map((a) => ({ v: a.accountId, l: a.masked + " · " + a.name }))} />
      </Field>

      {/* THE RECEIPT, MANDATORY — the same control and the same rule as a
          salary payment's, which is the point: evidence should not be worth
          more on one screen than another. Images and PDFs up to 5 MB; the store
          refuses all three ways and says which, so this is a courtesy rather
          than the guard.

          IT IS ONLY EVER SET HERE. Nothing attaches paper to a row after the
          fact any more, which is why the missing-bill queue is a closed backlog
          and why a row whose receipt turns out to be wrong is cancelled and
          recorded again with the right one. */}
      <Field label="Receipt" help={"Mandatory — an image or a PDF, up to " + fileSize(PROOF_MAX_BYTES) + "."}>
        <ProofField file={f.bill} onClear={() => set({ bill: null })}
          hint={"Image or PDF, up to " + fileSize(PROOF_MAX_BYTES)}
          onFile={(file) => {
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
        <Textarea rows={3} value={f.description} ariaLabel="Remark"
          ph="What it was for — the sentence that has to make sense to somebody else at audit"
          onChange={(v) => set({ description: v })} />
      </Field>
    </>
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

  const set = (patch: Partial<TxnForm>) => { setF((prev) => ({ ...prev, ...patch })); setErr(""); };
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
          <Button color="secondary" onClick={close}>Done</Button>
          <Button color="primary" onClick={() => {
            close();
            go("#/finance-transactions/" + encodeURIComponent(done.txnId));
          }}>Open the record</Button>
        </>}>
        <PaidReceipt
          amountPaise={done.paise}
          to={(isIn ? "received into " : "paid from ") + (account ? account.masked : "the account")}
          facts={[
            ["Filed as", (isIn ? "Credit" : "Debit") + " · " + done.tag],
            ["Reference", <span className="font-mono tnum">{f.reference || "—"}</span>],
            ["Row", <span className="font-mono tnum">{done.txnId}</span>],
          ]} />
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
        <Button color="primary" isDisabled={!f.bill} onClick={submit}>Record</Button></>}>

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
      <Fs legend="What moved" req>
        <TxnFields f={f} set={set} tags={tags} onErr={setErr} />
      </Fs>

    </Dlg>
  );
}

/* ------------------------------------------------------ CancelTxnModal --- */
/** FN-T11 · Cancel a transaction. Super Admin.
 *
 *  A REASON AND NOTHING ELSE. There is nothing to choose here — the row is
 *  named in the title, the consequence is the same every time, and the only
 *  thing this dialog does not already know is why. So it asks that and stops.
 *
 *  IT CARRIED TWO LINES SAYING WHAT CANCELLING DOES and they came off: the
 *  record page says all of it, in front of the row it is true of, and somebody
 *  who picked this menu item knows what they picked. A wall of text between a
 *  person and the one box they came to fill is not caution, it is friction.
 *
 *  IT DOES NOT OFFER TO FIX ANYTHING, because cancelling is not a correction:
 *  it says this row should not stand. The correct figures are a NEW row,
 *  recorded the ordinary way, which is why this dialog has no form. */
export function CancelTxnModal({ txn, onClose, onDone }: {
  txn: CompanyTxn; onClose: () => void; onDone: Done;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const sa = isSuperAdmin();

  const submit = () => {
    const res = cancelTransaction(txn.txnId, reason);
    if (res) { setErr(res); return; }
    onDone(txn.txnId + " cancelled. It stays on the record and stops counting.", "ok");
  };

  return (
    <Dlg title={"Cancel " + txn.txnId} sub="Super Admin." onClose={onClose} err={err}
      footer={<><Cancel onClose={onClose} />
        {/* Disabled without a reason, because the store refuses without one —
            a button that is going to say no is better off saying so first. */}
        <Button color="primary-destructive" isDisabled={!sa || !reason.trim()}
          onClick={submit}>Cancel the transaction</Button></>}>

      {sa ? null : (
        <Alert tone="warn" ico="shield" title="Cancelling a transaction is Super Admin only.">
          The button stays visible so it is clear the action exists and who to ask.
        </Alert>
      )}

      <Field label="Reason"
        help="Mandatory, and read at audit — a cancellation with no reason is indistinguishable from a misclick.">
        <Textarea rows={3} autoFocus value={reason} ariaLabel="Reason"
          ph="Why this row should not stand"
          onChange={(v) => { setReason(v); setErr(""); }} />
      </Field>
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
      footer={<><Cancel onClose={onClose} /><Button color="primary" onClick={submit}>Create</Button></>}>

      <Field label="Label" help="What shows on every row filed under it.">
        <Input value={label} ariaLabel="Label" autoFocus onChange={setLabel} />
      </Field>

      <Fs legend="Rolls up to" req hint="The one choice here that is not free — it decides where the money lands in Analytics, chosen now and rarely changed after.">
        <Pick value={kind} onChange={setKind}
          options={TAG_KINDS.map((k) => ({ key: k.key as TagKind, label: k.label + " — " + k.landsIn, help: k.help }))} />
      </Fs>

      <Field label="Budget" help="Warns at 90% of itself and never blocks.">
        <RupeeInput value={budget} onChange={setBudgetStr} placeholder="No budget" />
      </Field>
      <Field label="Bill">
        <Checkbox checked={proofRequired} onChange={setProofRequired}
          label="Required on every row under this tag" />
      </Field>
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
      footer={<><Cancel onClose={onClose} /><Button color="primary" onClick={submit}>Save</Button></>}>

      <Ledger>
        <LedgerRow label="Spent this period"><Money paise={spentPaise} /></LedgerRow>
        <LedgerRow label="Current budget">
          {tag.budgetPaise ? <Money paise={tag.budgetPaise} /> : <span className="text-quaternary">none</span>}
        </LedgerRow>
        {proposedPaise !== null ? (
          <LedgerRow label="At the proposed budget" grand>{pctOfProposed}% spent already</LedgerRow>
        ) : null}
      </Ledger>

      <Field label="New budget" help="Leave blank to remove the budget entirely — the tag is then unlimited and unwatched.">
        <RupeeInput value={budget} onChange={setBudgetStr} placeholder="No budget" />
      </Field>

      <Alert tone="info">
        A budget warns at 90% of itself and never blocks. Rent still has to be paid in a month
        somebody set its budget too low — this number is a flag for a person, not a limit the
        panel enforces.
      </Alert>
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
        <Button color="primary-destructive" isDisabled={!sa} onClick={submit}>
          Deactivate
        </Button>
      </>}>
      <div className="flex flex-col">
        <Check ok>
          {n} existing row{n === 1 ? "" : "s"} keep <TagChip k={tag.tagKey} />. Nothing about them changes and
          nothing is re-bucketed — that is the entire reason this is a deactivation and not a delete.
        </Check>
        <Check warn>Nobody will be able to file a new transaction under {tag.label} once this is saved.</Check>
      </div>
      {sa ? null : (
        <Alert tone="warn" ico="shield" title="Deactivating a tag is Super Admin only.">
          The button stays visible so it is clear the action exists and who to ask.
        </Alert>
      )}
      <Fine>There is no reactivate here. A tag that is needed again is created fresh, under a new key.</Fine>
    </Dlg>
  );
}
