/* =============================================================================
   Users Management — the three small dialogs.
   -----------------------------------------------------------------------------
   Internal note, operational tags, and account deactivation. They share a file
   because each is one field and one guarantee, and three files of forty lines
   would have hidden that the guarantee is the point.

     NoteModal        append-only. No edit, no delete, and the audit records
                      that a note exists rather than what it says.
     TagsModal        internal segmentation. Never customer-visible, at the
                      response contract and not by screen convention.
     DeactivateModal  an ACCOUNT status. Soft, and it says exactly what
                      survives.

   All three are a `ModalShell`: the head, the body and the footer are the
   panel's, so the primary sits last in every dialog in the product and the
   Escape/focus behaviour is the shell's rather than three copies of it.
   ============================================================================= */
import { useState } from "react";
import { Button, Checkbox, FormField, Icon, ModalShell, Notice, Tag, Textarea } from "../../ui";
import { ChoiceChip } from "./bits";

import { TAGS, VOCAB, addNote, setTags, setUserStatus } from "./store";
import type { UserRow } from "./store";

/** The record this dialog is about, in the head's second line. Every one of
 *  the three says who, the same way. */
const who = (row: UserRow) => (
  <>{row.user.identity.name} · <span className="font-mono">{row.user.userId}</span></>
);

/* ---------------------------------------------------------------- note --- */

export function NoteModal({ row, onClose, onDone }: {
  row: UserRow; onClose: () => void; onDone: (msg: string, tone?: string) => void;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <ModalShell
      title="Add an internal note"
      sub={who(row)}
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={onClose}>Cancel</Button>
          <Button color="primary" isDisabled={!text.trim()} onClick={() => {
            const e = addNote(row.user.userId, text);
            if (e) return setErr(e);
            onDone("Note added. It is on the record and it is not going anywhere near a customer.", "ok");
          }}>Add note</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        <FormField label="Note">
          <Textarea rows={5} autoFocus value={text} ariaLabel="Internal note"
            ph="What the next person servicing this account needs to know."
            onChange={setText} />
        </FormField>
        <Notice tone="info" ico="lock" text={<>
          <b>Append-only, and never customer-visible.</b> No edit and no delete, here or at the API.
          The audit records that a note was added and by whom, never the text.
        </>} />
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------- tags --- */

export function TagsModal({ row, onClose, onDone }: {
  row: UserRow; onClose: () => void; onDone: (msg: string, tone?: string) => void;
}) {
  const [slugs, setSlugs] = useState<string[]>(row.user.tags.map((t) => t.slug));
  const toggle = (s: string) =>
    setSlugs((v) => (v.indexOf(s) >= 0 ? v.filter((x) => x !== s) : v.concat([s])));
  return (
    <ModalShell
      title="Operational tags"
      sub={<>{row.user.identity.name} · internal segmentation, not profile content</>}
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={onClose}>Cancel</Button>
          <Button color="primary" count={slugs.length || undefined} onClick={() => {
            setTags(row.user.userId, slugs);
            onDone("Tags updated.", "ok");
          }}>Save tags</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* A TICK AND THE TAG ITSELF. The chip is what this decision looks like
            on the record, so the row shows the real chip rather than a word in
            the dialog's own colours; the sentence beside it is why anybody
            would reach for it. */}
        <div className="flex flex-col gap-3" role="group" aria-label="Operational tags">
          {TAGS.map((t) => (
            <Checkbox
              key={t.slug}
              checked={slugs.indexOf(t.slug) >= 0}
              onChange={() => toggle(t.slug)}
              label={<Tag label={t.label} tone={t.tone} />}
              hint={t.help}
            />
          ))}
        </div>
        <Notice tone="info" ico="lock" text={<>
          <b>Tags are ours, not theirs.</b> Excluded from every customer-facing response at the
          contract level — a public profile reading "payment risk" is what that prevents.
        </>} />
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------- deactivate --- */

export function DeactivateModal({ row, onClose, onDone }: {
  row: UserRow; onClose: () => void; onDone: (msg: string, tone?: string) => void;
}) {
  const off = row.user.userStatus === "deactivated";
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <ModalShell
      title={off ? "Reactivate this account" : "Deactivate this account"}
      sub={who(row)}
      ico={off ? "unlock" : "lock"}
      tone={off ? "brand" : "warning"}
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={onClose}>Cancel</Button>
          <Button color={off ? "primary" : "primary-destructive"}
            isDisabled={!off && !reason.trim()}
            onClick={() => {
              const e = setUserStatus(row.user.userId, off ? "active" : "deactivated", reason);
              if (e) return setErr(e);
              onDone(off
                ? "Account re-enabled."
                : "Account deactivated. Profile, links and history are all retained.",
                off ? "ok" : "warn");
            }}>
            {off ? "Reactivate account" : "Deactivate account"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        {off ? (
          <Notice text={<>
            <b>Re-enables the account and nothing else.</b> Whatever this customer has bought is
            recorded in Finance and is not touched from here.
          </>} />
        ) : (
          <>
            <FormField label="Reason" req
              hint="Pick one, or write what happened. It goes on the audit trail.">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {VOCAB.deactivateReasons.map((r: string) => (
                    <ChoiceChip key={r} label={r} on={reason === r} onPick={() => setReason(r)} />
                  ))}
                </div>
                <Textarea rows={2} value={reason} ariaLabel="Reason"
                  ph="Pick one above, or write what happened."
                  onChange={setReason} />
              </div>
            </FormField>

            {/* WHAT SURVIVES, ITEMISED. The consequence of a soft status is the
                only thing anybody is actually deciding here. */}
            <ul className="flex flex-col gap-2 text-sm text-secondary">
              {[
                <><b className="font-semibold text-primary">Soft.</b> The profile, the commercial references and the whole audit trail stay exactly where they are.</>,
                <>The user leaves the active base and stays in every historical count. Deleting them would change a number already reported.</>,
                <>This is an <b className="font-semibold text-primary">account</b> status and it stops at this module. Anything the customer has bought is a Finance record and is cancelled there, deliberately and separately.</>,
                <>Sign-in is blocked by Authentication independently. This flag does not manage sessions and does not pretend to.</>,
              ].map((line, i) => (
                <li key={i} className="flex min-w-0 gap-2">
                  <Icon name="chevr" size="sm" className="mt-0.5 shrink-0 text-fg-quaternary" />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>

            <Notice tone="bad" ico="shield" text={<>
              <b>Hard deletion is not a button.</b> Erasing a user would take their commercial
              links and audit history with it. That request goes to the governed privacy
              process.
            </>} />
          </>
        )}
      </div>
    </ModalShell>
  );
}
