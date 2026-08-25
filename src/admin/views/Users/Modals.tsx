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
     DeactivateModal  an ACCOUNT status, not a membership action. Soft, and it
                      says exactly what survives.
   ============================================================================= */
import { useState } from "react";
import { Icon, Notice } from "../../ui";

import { TAGS, VOCAB, addNote, setTags, setUserStatus } from "./store";
import type { UserRow } from "./store";

/* ---------------------------------------------------------------- note --- */

export function NoteModal({ row, onClose, onDone }: {
  row: UserRow; onClose: () => void; onDone: (msg: string, tone?: string) => void;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <div className="md-h">
        <h3>Add an internal note</h3>
        <p>{row.user.identity.name} · <span className="mono">{row.user.userId}</span></p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b um-form">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        <textarea className="inp" rows={5} autoFocus value={text}
          placeholder="What the next person servicing this account needs to know."
          onChange={(e) => setText(e.target.value)} />
        <Notice tone="info" ico="lock" text={<>
          <b>Append-only, and never customer-visible.</b> No edit and no delete, here or at the API.
          The audit records that a note was added and by whom, never the text.
        </>} />
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={!text.trim()} onClick={() => {
          const e = addNote(row.user.userId, text);
          if (e) return setErr(e);
          onDone("Note added. It is on the record and it is not going anywhere near a customer.", "ok");
        }}>Add note</button>
      </div>
    </>
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
    <>
      <div className="md-h">
        <h3>Operational tags</h3>
        <p>{row.user.identity.name} · internal segmentation, not profile content</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b um-form">
        <div className="um-tagpicker">
          {TAGS.map((t) => (
            <button key={t.slug} type="button"
              className={"um-tag pick " + t.tone + (slugs.indexOf(t.slug) >= 0 ? " on" : "")}
              onClick={() => toggle(t.slug)}>
              {slugs.indexOf(t.slug) >= 0 ? <Icon name="check" size="sm" /> : null}
              {t.label}
              <em>{t.help}</em>
            </button>
          ))}
        </div>
        <Notice tone="info" ico="lock" text={<>
          <b>Tags are ours, not theirs.</b> Excluded from every customer-facing response at the
          contract level — a public profile reading "payment risk" is what that prevents.
        </>} />
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" onClick={() => {
          setTags(row.user.userId, slugs);
          onDone("Tags updated.", "ok");
        }}>Save tags</button>
      </div>
    </>
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
    <>
      <div className="md-h">
        <h3>{off ? "Reactivate this account" : "Deactivate this account"}</h3>
        <p>{row.user.identity.name} · <span className="mono">{row.user.userId}</span></p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b um-form">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        {off ? (
          <Notice text={<>
            <b>Re-enables the account and touches no membership.</b> Account status and membership
            state are separate facts.
          </>} />
        ) : (
          <>
            <fieldset className="um-fs">
              <legend>Reason <span className="req">*</span></legend>
              <div className="um-chips">
                {VOCAB.deactivateReasons.map((r) => (
                  <button key={r} type="button" className={"chip" + (reason === r ? " on" : "")}
                    onClick={() => setReason(r)}>{r}</button>
                ))}
              </div>
              <textarea className="inp" rows={2} value={reason}
                placeholder="Pick one above, or write what happened."
                onChange={(e) => setReason(e.target.value)} />
            </fieldset>

            <ul className="um-consequences">
              <li><Icon name="chevr" size="sm" /><b>Soft.</b> The profile, every membership term, the commercial references and the whole audit trail stay exactly where they are.</li>
              <li><Icon name="chevr" size="sm" />The user leaves the active base and stays in every historical count. Deleting them would change a number already reported.</li>
              <li><Icon name="chevr" size="sm" />This is an <b>account</b> status. It is not a membership classification, and it is displayed separately from one everywhere in this module.</li>
              <li><Icon name="chevr" size="sm" />Sign-in is blocked by Authentication independently. This flag does not manage sessions and does not pretend to.</li>
            </ul>

            <Notice tone="bad" ico="shield" text={<>
              <b>Hard deletion is not a button.</b> Erasing a user would take their membership,
              commercial and audit history with it. That request goes to the governed privacy
              process.
            </>} />
          </>
        )}
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className={"btn " + (off ? "pri" : "dgr")}
          disabled={!off && !reason.trim()}
          onClick={() => {
            const e = setUserStatus(row.user.userId, off ? "active" : "deactivated", reason);
            if (e) return setErr(e);
            onDone(off
              ? "Account re-enabled. No membership was changed."
              : "Account deactivated. Profile, terms and history are all retained.",
              off ? "ok" : "warn");
          }}>
          {off ? "Reactivate account" : "Deactivate account"}
        </button>
      </div>
    </>
  );
}
