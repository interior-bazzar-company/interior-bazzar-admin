/* =============================================================================
   Every dialog the member surfaces open.
   -----------------------------------------------------------------------------
   THE RULE THEY ALL FOLLOW: one field to a line, a visible label above each
   one, and the refusal beside the field it is about. A placeholder disappears
   the moment somebody types, which leaves a filled form with nothing saying
   what its values are; an error at the top of a dialog is an error nobody can
   act on.

   THE OTHER RULE: a dialog warns EARLY and the store refuses ANYWAY. The form
   showing a clash is a courtesy — the dates can be edited after it renders, and
   a second tab never saw it — so every refusal drawn here is also a rule in
   store.ts, and the store's is the one that decides.

   ONE FRAME. `ModalShell` puts the title, the body and the footer in the same
   place in every dialog in the panel, primary last; `FormField` owns the label
   and the one line of hint or error under a control. Nothing here draws its own
   header or its own button row.
   ============================================================================= */
import { useEffect, useState } from "react";
import {
  Alert, Button, Checkbox, DateInput, FieldRow, FileUpload, FormField, FormSection, Input,
  ModalShell, Notice, SelectInput, Skeleton, Tag, Textarea,
} from "../../../ui";
import { useShell } from "../../../shell/ShellContext";
import {
  AGREEMENT_KIND, LEAVE_KIND, DOCUMENT_KIND, TODAY, VOCAB, addDays, addDocument, createTag,
  datesIn, decideLeave, deleteDocument, escalateLeave, fmtDate, labelOf, leaveClash, leaveOverlap, markViewed, meId, renameTag,
  recordLeave, requestLeave, signAgreement,
} from "../store";
import { bodyOf, retryTemplates, sendTemplate, useTemplates, useTemplatesLoad } from "../../Agreements/store";
import { LoadNotice } from "../loadState";
import { Sheet } from "../../Agreements/bits";
import type { Agreement, LeaveRequest, LeaveState, MemberDocument, Tag as TagRecord } from "../store";

/* ------------------------------------------------------------- chrome --- */

/** The two-button footer every one of these shares: cancel, then the verb. */
function Foot({ label, tone, disabled, onSave, onClose }: {
  label: string; tone?: "bad" | "pri"; disabled?: boolean; onSave: () => void; onClose: () => void;
}) {
  return (
    <>
      <Button color="secondary" onClick={onClose}>Cancel</Button>
      <Button color={tone === "bad" ? "primary-destructive" : "primary"} isDisabled={disabled} onClick={onSave}>
        {label}
      </Button>
    </>
  );
}

/* -------------------------------------------------------------- leave --- */

/** The two dates, the kind, and the sentence that says why — and above the
 *  buttons, the one thing that will make this impossible, named before it is
 *  sent rather than after. */
export function LeaveRequestModal({ memberId }: { memberId: string }) {
  const shell = useShell();
  const [from, setFrom] = useState(addDays(TODAY, 3));
  const [to, setTo] = useState(addDays(TODAY, 3));
  const [kind, setKind] = useState("casual");
  const [why, setWhy] = useState("");

  const backwards = to < from;
  const days = backwards ? 0 : datesIn(from, to).length;
  const clash = backwards ? { worked: [], taken: [] } : leaveClash(memberId, from, to);
  const blocked = backwards || !!clash.worked.length || !!clash.taken.length;

  const save = async () => {
    const r = await requestLeave(memberId, { fromDate: from, toDate: to, kind, reason: why });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Requested. It is with your senior now.");
  };

  return (
    <ModalShell
      title="Request leave"
      ico="calendar"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Send request" disabled={blocked || !why.trim()} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormSection>
        <FieldRow>
          <FormField id="lvFrom" label="First day" req>
            <DateInput id="lvFrom" value={from} onChange={setFrom} className="w-full" />
          </FormField>
          <FormField id="lvTo" label="Last day" req
            err={backwards ? "The last day is before the first." : undefined}
            hint={backwards ? undefined : days + " day" + (days === 1 ? "" : "s") + ", both included."}>
            <DateInput id="lvTo" value={to} onChange={setTo} className="w-full" />
          </FormField>
        </FieldRow>

        <FormField id="lvKind" label="Kind">
          <SelectInput id="lvKind" value={kind} onChange={setKind}
            options={(VOCAB.leaveKinds as { key: string }[]).map((k) =>
              ({ v: k.key, l: labelOf(LEAVE_KIND, k.key) }))} />
        </FormField>

        <FormField id="lvWhy" label="Reason" req hint="Your senior reads this and nothing else.">
          <Input id="lvWhy" value={why} ph="Family function, out of Delhi" onChange={setWhy} />
        </FormField>

        {clash.worked.length ? (
          <Alert tone="bad" ico="alert" title={"There is already an attendance row on " + fmtDate(clash.worked[0])}>
            A leave record over a day that was clocked would make that date both worked and away,
            and nothing downstream could choose between them.
          </Alert>
        ) : clash.taken.length ? (
          <Alert tone="warn" ico="alert" title={fmtDate(clash.taken[0]) + " is already covered"}>
            A request of yours already covers it. Edit that one rather than sending a second over the
            same day.
          </Alert>
        ) : (
          <p className="text-xs text-quaternary">
            Until it is approved these days still count as absent. An approval suppresses that;
            it never writes an attendance row.
          </p>
        )}
      </FormSection>
    </ModalShell>
  );
}

/** The approver's side. Approve carries the clash warning — a warning, never a
 *  block, because nothing here knows how many people a day needs. */
export function LeaveDecideModal({ l, state }: { l: LeaveRequest; state: LeaveState }) {
  const shell = useShell();
  const [note, setNote] = useState("");
  const reject = state === "rejected";
  const clashes = reject ? [] : leaveOverlap(l);

  const save = async () => {
    const r = await decideLeave(l.leaveId, state, meId(), note);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast(reject ? "Refused. They can see why." : "Approved.");
  };

  return (
    <ModalShell
      title={reject ? "Refuse this request" : "Approve this leave"}
      sub={fmtDate(l.fromDate) + (l.toDate !== l.fromDate ? " to " + fmtDate(l.toDate) : "")}
      ico={reject ? "xcircle" : "checkcircle"}
      tone={reject ? "error" : "success"}
      onClose={() => shell.closeLayer()}
      actions={
        <Foot label={reject ? "Refuse" : "Approve"} tone={reject ? "bad" : "pri"}
          disabled={reject && !note.trim()} onSave={save} onClose={() => shell.closeLayer()} />
      }
    >
      <FormSection>
        <blockquote className="rounded-lg border-l-2 border-brand bg-secondary px-3.5 py-3 text-sm text-secondary">
          {l.reason}
        </blockquote>

        {clashes.length ? (
          <Alert tone="warn" ico="alert" title={
            clashes[0].members.map((m) => m.name).join(", ")
            + (clashes[0].members.length > 1 ? " are" : " is")
            + " also away on " + fmtDate(clashes[0].date)
          }>
            Nothing in the panel knows how many people that day needs — you do. It is shown, not
            enforced.
          </Alert>
        ) : null}

        {reject ? (
          <FormField id="lvNo" label="Why" req
            hint="It appears on their row. A refusal nobody explained is one they have to come and ask about.">
            <Input id="lvNo" autoFocus value={note} onChange={setNote} />
          </FormField>
        ) : (
          <FormField id="lvYes" label="A note, if you want one"
            hint="Optional. Approving needs no reason; refusing does.">
            <Input id="lvYes" value={note} onChange={setNote} />
          </FormField>
        )}
      </FormSection>
    </ModalShell>
  );
}

/** Take a request, or a decision on it, to the Admin. The note is required. */
export function LeaveEscalateModal({ l }: { l: LeaveRequest }) {
  const shell = useShell();
  const [note, setNote] = useState("");
  const save = async () => {
    const r = await escalateLeave(l.leaveId, note);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Escalated. Only the Admin decides it now.");
  };
  return (
    <ModalShell
      title="Escalate to the Admin"
      sub={fmtDate(l.fromDate) + (l.toDate !== l.fromDate ? " to " + fmtDate(l.toDate) : "")}
      ico="alert"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Escalate" disabled={!note.trim()} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormSection>
        <blockquote className="rounded-lg border-l-2 border-brand bg-secondary px-3.5 py-3 text-sm text-secondary">
          {l.reason}
        </blockquote>
        <FormField id="lvEsc" label="What should the Admin weigh?" req
          hint="Recorded with the request. Afterwards only full access can approve or refuse it.">
          <Input id="lvEsc" autoFocus value={note} onChange={setNote} />
        </FormField>
      </FormSection>
    </ModalShell>
  );
}

/** An admin records leave for somebody; it lands approved. */
export function LeaveRecordModal({ memberId }: { memberId: string }) {
  const shell = useShell();
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(TODAY);
  const [kind, setKind] = useState("casual");
  const [why, setWhy] = useState("");
  const backwards = to < from;
  const save = async () => {
    const r = await recordLeave(memberId, { fromDate: from, toDate: to, kind, reason: why });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Recorded and approved.");
  };
  return (
    <ModalShell
      title="Record leave"
      ico="calendar"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Record" disabled={backwards} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormSection>
        <FieldRow>
          <FormField id="lrFrom" label="First day" req>
            <DateInput id="lrFrom" value={from} onChange={setFrom} className="w-full" />
          </FormField>
          <FormField id="lrTo" label="Last day" req err={backwards ? "The last day is before the first." : undefined}>
            <DateInput id="lrTo" value={to} onChange={setTo} className="w-full" />
          </FormField>
        </FieldRow>
        <FormField id="lrKind" label="Kind">
          <SelectInput id="lrKind" value={kind} onChange={setKind}
            options={(VOCAB.leaveKinds as { key: string }[]).map((k) => ({ v: k.key, l: labelOf(LEAVE_KIND, k.key) }))} />
        </FormField>
        <FormField id="lrWhy" label="Reason" hint="It lands approved and names you as the one who granted it.">
          <Input id="lrWhy" value={why} onChange={setWhy} />
        </FormField>
      </FormSection>
    </ModalShell>
  );
}

/* --------------------------------------------------------- agreements --- */

export function SendAgreementModal({ memberId }: { memberId: string }) {
  const shell = useShell();
  /* THROUGH A TEMPLATE, OR NOT AT ALL. This took a kind and a free-text title
     and called the raw `sendAgreement` — no template, an empty body, and none
     of the one-live-copy guard `sendTemplate` carries — so the member page
     could send a second "NDA" beside the first with nothing in it to sign. It
     is the Agreements module's own send now, pointed at one person. */
  const templates = useTemplates().filter((t) => t.state === "active");
  const load = useTemplatesLoad();
  const [picked, setTemplateId] = useState(templates.length ? templates[0].templateId : "");
  /* The list can land after the dialog opened: nothing picked yet means the first one. */
  const templateId = picked || (templates.length ? templates[0].templateId : "");
  const t = templates.filter((x) => x.templateId === templateId)[0] || null;
  const save = async () => {
    const r = await sendTemplate(templateId, memberId);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Sent. The link expires in seven days.");
  };
  return (
    <ModalShell
      title="Send an agreement"
      ico="shield"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Send" disabled={!t} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormSection>
        {load.state === "loading" ? (
          <Skeleton className="h-10 rounded-lg" />
        ) : load.state !== "ok" ? (
          <LoadNotice what="Agreement templates" part={load} onRetry={retryTemplates} />
        ) : templates.length ? (
          <FormField id="agTpl" label="Template" hint={t ? t.purpose : undefined}>
            <SelectInput id="agTpl" value={templateId} onChange={setTemplateId}
              options={templates.map((x) => ({ v: x.templateId, l: x.title + " · v" + x.version }))} />
          </FormField>
        ) : (
          <Alert tone="warn" title="No active template to send">
            Write one under Agreements first — a document with nothing in it cannot be signed.
          </Alert>
        )}
        <p className="text-xs text-quaternary">
          The wording is frozen at send. The link is single-use and expires on {fmtDate(addDays(TODAY, 7))}.
        </p>
      </FormSection>
    </ModalShell>
  );
}

/** Standing in for the public link page. THE FOUR STATES ARE THE WHOLE POINT of
 *  this dialog: expired, revoked and already-signed are not errors, they are
 *  answers, and a link page that returns "not found" to somebody who was told a
 *  letter was coming has failed at the only job it had. */
export function SignAgreementModal({ a }: { a: Agreement }) {
  const shell = useShell();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);

  const expired = a.state !== "signed" && !!a.expiresAt && (a.expiresAt as string) < TODAY;
  const closed = a.state === "signed" || a.state === "revoked" || expired;
  const body = bodyOf(a);
  const sub = labelOf(AGREEMENT_KIND, a.kind) + " · v" + a.version;

  /* Opening the document is the reading. Recorded once, and only while it can
     still be signed — a revoked or expired link records nothing. */
  useEffect(() => { if (!closed) void markViewed(a.agreementId); }, [a.agreementId, closed]);

  const save = async () => {
    const r = await signAgreement(a.agreementId, name);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Signed. A copy is on the record.");
  };

  if (closed) {
    return (
      <ModalShell
        title={a.title}
        sub={sub}
        ico={a.state === "signed" ? "checkcircle" : a.state === "revoked" ? "lock" : "clock"}
        tone={a.state === "signed" ? "success" : a.state === "revoked" ? "error" : "warning"}
        onClose={() => shell.closeLayer()}
        actions={<Button color="primary" onClick={() => shell.closeLayer()}>Close</Button>}
      >
        {a.state === "signed" ? (
          <Alert tone="ok" ico="check"
            title={"Already signed"
              + (a.signedName ? " by " + a.signedName : "")
              + (a.signedAt ? " on " + fmtDate((a.signedAt || "").slice(0, 10)) : "")}>
            The signed copy is the record — there is no second signature box, because a document that
            can be signed twice has two versions of the truth.
          </Alert>
        ) : a.state === "revoked" ? (
          <Alert tone="bad" ico="lock" title="This link was revoked">
            Not “not found” — somebody was told this document was coming, and a dead end would leave
            them guessing. Ask whoever sent it for a new one.
          </Alert>
        ) : (
          <Alert tone="warn" ico="clock" title={"This link expired on " + fmtDate(a.expiresAt as string)}>
            The document is not shown on an expired link. Ask for a new one and it arrives as a fresh
            version.
          </Alert>
        )}
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={a.title}
      sub={sub}
      ico="shield"
      onClose={() => shell.closeLayer()}
      actions={
        <Foot label="Sign and accept" disabled={!agree || name.trim().length < 2}
          onSave={save} onClose={() => shell.closeLayer()} />
      }
    >
      <div className="flex flex-col gap-4">
        {/* THE DOCUMENT ITSELF. This box held two lines of boilerplate and never
            the clauses, so a member "read and agreed" to text that was not the
            NDA. It is the same frozen body the deed page shows, from one read. */}
        {body.clauses.length ? (
          <Sheet title={a.title} clauses={body.clauses} />
        ) : (
          <Alert tone="warn" ico="alert" title="This copy has no frozen wording">
            It was sent without a template. Revoke it and send a fresh copy from one.
          </Alert>
        )}

        {/* THE DISCLOSURE SITS ABOVE THE BOX, not under the button. Recording an
            address against a legal signature is something the signer is
            entitled to be told before they sign. */}
        <Notice ico="alert" text="Your name, the time, and the address you sign from are recorded with the signature." />

        <FormField id="sgName" label="Your full name" req hint="Typing it is the signature.">
          <Input id="sgName" autoFocus value={name} onChange={setName} />
        </FormField>

        <Checkbox checked={agree} onChange={setAgree}
          label="I have read the document above and I agree to it." />
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------- documents --- */

export function AddDocumentModal({ memberId, kind: seed }: { memberId: string; kind?: string }) {
  const shell = useShell();
  const [kind, setKind] = useState(seed || "pan");
  const [label, setLabel] = useState(labelOf(DOCUMENT_KIND, seed || "pan"));
  const [file, setFile] = useState<File | null>(null);
  const save = async () => {
    const r = await addDocument(memberId, kind, label, file || undefined);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("On file. It goes back to the unchecked queue.");
  };
  const kinds = (VOCAB.documentKinds as { key: string }[]).map((k) => k.key);
  return (
    <ModalShell
      title="Add a document"
      ico="lock"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Add" disabled={!label.trim()} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormSection>
        <FormField id="rsKind" label="What is it">
          <SelectInput id="rsKind" value={kind}
            options={kinds.map((k) => ({ v: k, l: labelOf(DOCUMENT_KIND, k) }))}
            onChange={(v) => { setKind(v); setLabel(labelOf(DOCUMENT_KIND, v)); }} />
        </FormField>
        <FormField id="rsLabel" label="Name it" req>
          <Input id="rsLabel" value={label} onChange={setLabel} />
        </FormField>
        <FormField label="File" hint={file ? file.name : "Optional — the row is recorded either way."}>
          {/* THE BYTES GO STRAIGHT TO OUR BUCKET and the server keeps the key as
              a private object; nothing here ever puts an identity document on a
              public URL. Reading one back is a signed, short-lived link. */}
          <FileUpload
            accept="image/*,.pdf"
            hint="PDF or an image, up to 5 MB."
            onFiles={(picked) => setFile(picked[0] || null)}
          />
        </FormField>
        <Notice tone="warn" ico="lock" text={
          <><b>Nothing in this panel may put an identity document on a public URL.</b> The file is
            stored as a private object and read back through a signed, short-lived link.</>
        } />
      </FormSection>
    </ModalShell>
  );
}

/** Delete is real, not a soft withdraw, so it takes a written reason like every
 *  other destructive action in the panel — matching Deals' Reassign dialog. */
export function RemoveDocumentModal({ r }: { r: MemberDocument }) {
  const shell = useShell();
  const [reason, setReason] = useState("");
  const save = async () => {
    const x = await deleteDocument(r.documentId, reason);
    if (!x.ok) { shell.toast(x.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Deleted.");
  };
  return (
    <ModalShell
      title="Delete document"
      sub={r.label}
      ico="alert"
      tone="error"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Delete" tone="bad" disabled={!reason.trim()} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormSection>
        <FormField id="rmDocReason" label="Reason" req
          hint="Mandatory, and enforced by the server. It is kept on the record.">
          <Textarea id="rmDocReason" rows={3} autoFocus value={reason} onChange={setReason}
            ph="Wrong file uploaded; replaced with the correct scan." />
        </FormField>
      </FormSection>
    </ModalShell>
  );
}

/* --------------------------------------------------------------- tags --- */

export function NewTagModal({ ownerId }: { ownerId: string }) {
  const shell = useShell();
  const [name, setName] = useState("");
  const [tone, setTone] = useState("slate");
  const save = async () => {
    const r = await createTag(ownerId, name, tone);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast(r.data.label + " created.");
  };
  return (
    <ModalShell
      title="New tag"
      ico="tag"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Create" disabled={!name.trim()} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormSection>
        <FormField id="tgName" label="Name" req
          hint="It is yours. Somebody else may hold a tag of the same name and it stays a different record.">
          <Input id="tgName" autoFocus value={name} onChange={setName}
            onEnter={() => { if (name.trim()) save(); }} />
        </FormField>
        <ToneField value={tone} onPick={setTone} preview={name.trim()} />
      </FormSection>
    </ModalShell>
  );
}

export function RenameTagModal({ t }: { t: TagRecord }) {
  const shell = useShell();
  const [name, setName] = useState(t.label);
  const save = async () => {
    const r = await renameTag(t.tagId, name);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Renamed.");
  };
  return (
    <ModalShell
      title="Rename this tag"
      sub={t.label}
      ico="edit"
      onClose={() => shell.closeLayer()}
      actions={<Foot label="Rename" disabled={!name.trim()} onSave={save} onClose={() => shell.closeLayer()} />}
    >
      <FormField id="tgRename" label="Name" req
        hint="Every item of yours wearing it follows the rename. Nobody else's does.">
        <Input id="tgRename" autoFocus value={name} onChange={setName} onEnter={() => { if (name.trim()) save(); }} />
      </FormField>
    </ModalShell>
  );
}

/** SIX TONES, NOT A COLOUR PICKER. A free picker on a per-member tag makes a
 *  board where two people's palettes collide, and it would be the first
 *  non-token colour in a panel whose dark mode is a token swap. The chips are
 *  the thing itself rather than a word for it, and the one you have chosen is
 *  the one wearing the brand ring. */
export function ToneField({ value, onPick, preview }: {
  value: string; onPick: (t: string) => void; preview?: string;
}) {
  return (
    <FormField label="Tone">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tone">
        {(VOCAB.tagTones as { key: string; label: string }[]).map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => onPick(o.key)}
            className={
              "cursor-pointer rounded-md p-0.5 outline-focus-ring transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2"
              + (value === o.key ? " ring-2 ring-brand" : "")
            }
          >
            <Tag label={preview && value === o.key ? preview : o.label} tone={o.key} />
          </button>
        ))}
      </div>
    </FormField>
  );
}
