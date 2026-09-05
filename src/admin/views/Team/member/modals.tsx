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
   ============================================================================= */
import { useState } from "react";
import { Icon, Notice } from "../../../ui";
import { useShell } from "../../../shell/ShellContext";
import {
  AGREEMENT_KIND, LEAVE_KIND, RESOURCE_KIND, TODAY, VOCAB, addDays, addResource, createTag,
  datesIn, decideLeave, fmtDate, labelOf, leaveClash, leaveOverlap, meId, renameTag, requestLeave,
  sendAgreement, signAgreement,
} from "../store";
import type { Agreement, LeaveRequest, LeaveState, Tag } from "../store";

/* ------------------------------------------------------------- chrome --- */

function Head({ title, sub }: { title: string; sub?: string }) {
  const shell = useShell();
  return (
    <div className="md-h">
      <h3>{title}{sub ? <span className="md-sub">{sub}</span> : null}</h3>
      <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
        <Icon name="x" size="sm" />
      </button>
    </div>
  );
}

function Foot({ label, tone, disabled, onSave }: {
  label: string; tone?: string; disabled?: boolean; onSave: () => void;
}) {
  const shell = useShell();
  return (
    <div className="md-f">
      <span className="spacer" />
      <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
      <button className={"btn " + (tone || "pri")} disabled={disabled} onClick={onSave}>{label}</button>
    </div>
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

  const save = () => {
    const r = requestLeave(memberId, { fromDate: from, toDate: to, kind, reason: why });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Requested. It is with your senior now.");
  };

  return (
    <>
      <Head title="Request leave" />
      <div className="md-b">
        <div className="tm-fg2">
          <div className="fg">
            <label htmlFor="lvFrom">First day</label>
            <input id="lvFrom" type="date" className={"inp" + (backwards ? " bad" : "")} value={from}
              onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="lvTo">Last day</label>
            <input id="lvTo" type="date" className={"inp" + (backwards ? " bad" : "")} value={to}
              aria-describedby="lvRange" onChange={(e) => setTo(e.target.value)} />
            {backwards
              ? <span id="lvRange" className="help bad">The last day is before the first.</span>
              : <span id="lvRange" className="help">{days} day{days === 1 ? "" : "s"}, both included.</span>}
          </div>
        </div>

        <div className="fg">
          <label htmlFor="lvKind">Kind</label>
          <select id="lvKind" className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>
            {(VOCAB.leaveKinds as { key: string }[]).map((k) =>
              <option key={k.key} value={k.key}>{labelOf(LEAVE_KIND, k.key)}</option>)}
          </select>
        </div>

        <div className="fg">
          <label htmlFor="lvWhy">Reason <b className="req">*</b></label>
          <input id="lvWhy" className="inp" value={why} placeholder="Family function, out of Delhi"
            onChange={(e) => setWhy(e.target.value)} />
          <span className="help">Your senior reads this and nothing else.</span>
        </div>

        {clash.worked.length ? (
          <Notice tone="bad" ico="alert" text={
            <><b>There is already an attendance row on {fmtDate(clash.worked[0])}.</b> A leave record
              over a day that was clocked would make that date both worked and away, and nothing
              downstream could choose between them.</>
          } />
        ) : clash.taken.length ? (
          <Notice tone="warn" ico="alert" text={
            <><b>{fmtDate(clash.taken[0])} is already covered</b> by a request of yours. Edit that one
              rather than sending a second over the same day.</>
          } />
        ) : (
          <p className="tm-foot">
            Until it is approved these days still count as absent. An approval suppresses that;
            it never writes an attendance row.
          </p>
        )}
      </div>
      <Foot label="Send request" disabled={blocked || !why.trim()} onSave={save} />
    </>
  );
}

/** The approver's side. Approve carries the clash warning — a warning, never a
 *  block, because nothing here knows how many people a day needs. */
export function LeaveDecideModal({ l, state }: { l: LeaveRequest; state: LeaveState }) {
  const shell = useShell();
  const [note, setNote] = useState("");
  const reject = state === "rejected";
  const clashes = reject ? [] : leaveOverlap(l);

  const save = () => {
    const r = decideLeave(l.leaveId, state, meId(), note);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast(reject ? "Refused. They can see why." : "Approved.");
  };

  return (
    <>
      <Head title={reject ? "Refuse this request" : "Approve this leave"}
        sub={fmtDate(l.fromDate) + (l.toDate !== l.fromDate ? " to " + fmtDate(l.toDate) : "")} />
      <div className="md-b">
        <p className="tm-quote">{l.reason}</p>

        {clashes.length ? (
          <Notice tone="warn" ico="alert" text={
            <>
              <b>{clashes[0].members.map((m) => m.name).join(", ")}
                {clashes[0].members.length > 1 ? " are" : " is"} also away on {fmtDate(clashes[0].date)}.</b>
              {" "}Nothing in the panel knows how many people that day needs — you do. It is shown,
              not enforced.
            </>
          } />
        ) : null}

        {reject ? (
          <div className="fg">
            <label htmlFor="lvNo">Why <b className="req">*</b></label>
            <input id="lvNo" className="inp" autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
            <span className="help">It appears on their row. A refusal nobody explained is one they
              have to come and ask about.</span>
          </div>
        ) : (
          <div className="fg">
            <label htmlFor="lvYes">A note, if you want one</label>
            <input id="lvYes" className="inp" value={note} onChange={(e) => setNote(e.target.value)} />
            <span className="help">Optional. Approving needs no reason; refusing does.</span>
          </div>
        )}
      </div>
      <Foot label={reject ? "Refuse" : "Approve"} tone={reject ? "dgr" : "pri"}
        disabled={reject && !note.trim()} onSave={save} />
    </>
  );
}

/* --------------------------------------------------------- agreements --- */

export function SendAgreementModal({ memberId }: { memberId: string }) {
  const shell = useShell();
  const [kind, setKind] = useState("nda");
  const [title, setTitle] = useState(labelOf(AGREEMENT_KIND, "nda") + " 2026");
  const save = () => {
    const r = sendAgreement(memberId, kind, title);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Sent. The link expires in seven days.");
  };
  const kinds = (VOCAB.agreementKinds as { key: string }[]).map((k) => k.key);
  return (
    <>
      <Head title="Send an agreement" />
      <div className="md-b">
        <div className="fg">
          <label htmlFor="agKind">Kind</label>
          <select id="agKind" className="inp" value={kind}
            onChange={(e) => { setKind(e.target.value); setTitle(labelOf(AGREEMENT_KIND, e.target.value) + " 2026"); }}>
            {kinds.map((k) => <option key={k} value={k}>{labelOf(AGREEMENT_KIND, k)}</option>)}
          </select>
          <span className="help">One entity, several kinds. Two documents that are sent, viewed,
            signed and revoked identically are not two tables.</span>
        </div>
        <div className="fg">
          <label htmlFor="agTitle">Title <b className="req">*</b></label>
          <input id="agTitle" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} />
          <span className="help">Frozen at send. Editing the template afterwards makes a new version;
            it never rewrites what somebody already read.</span>
        </div>
        <p className="tm-foot">The link is single-use and expires on {fmtDate(addDays(TODAY, 7))}.</p>
      </div>
      <Foot label="Send" disabled={!title.trim()} onSave={save} />
    </>
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

  const save = () => {
    const r = signAgreement(a.agreementId, name);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Signed. A copy is on the record.");
  };

  if (closed) {
    return (
      <>
        <Head title={a.title} sub={labelOf(AGREEMENT_KIND, a.kind) + " v" + a.version} />
        <div className="md-b">
          {a.state === "signed" ? (
            <Notice tone="ok" ico="check" text={
              <><b>Already signed</b> by {a.signedName} on {fmtDate((a.signedAt || "").slice(0, 10))}.
                The signed copy is the record — there is no second signature box, because a document
                that can be signed twice has two versions of the truth.</>
            } />
          ) : a.state === "revoked" ? (
            <Notice tone="bad" ico="lock" text={
              <><b>This link was revoked.</b> Not "not found" — somebody was told this document was
                coming, and a dead end would leave them guessing. Ask whoever sent it for a new one.</>
            } />
          ) : (
            <Notice tone="warn" ico="clock" text={
              <><b>This link expired on {fmtDate(a.expiresAt as string)}.</b> The document is not shown
                on an expired link. Ask for a new one and it arrives as a fresh version.</>
            } />
          )}
        </div>
        <div className="md-f">
          <span className="spacer" />
          <button className="btn pri" onClick={() => shell.closeLayer()}>Close</button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head title={a.title} sub={labelOf(AGREEMENT_KIND, a.kind) + " v" + a.version} />
      <div className="md-b">
        <div className="tm-doc">
          <b>Interior Bazzar</b>
          <p>The document body as it was frozen at send. Nothing about it changes after this point,
            which is what makes a signature against it mean anything.</p>
        </div>

        {/* THE DISCLOSURE SITS ABOVE THE BOX, not under the button. Recording an
            address against a legal signature is something the signer is
            entitled to be told before they sign. */}
        <Notice ico="alert" text="Your name, the time, and the address you sign from are recorded with the signature." />

        <div className="fg">
          <label htmlFor="sgName">Your full name <b className="req">*</b></label>
          <input id="sgName" className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <span className="help">Typing it is the signature.</span>
        </div>

        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span></span>
          I have read the document above and I agree to it.
        </label>
      </div>
      <Foot label="Sign and accept" disabled={!agree || name.trim().length < 2} onSave={save} />
    </>
  );
}

/* ---------------------------------------------------------- documents --- */

export function AddResourceModal({ memberId, kind: seed }: { memberId: string; kind?: string }) {
  const shell = useShell();
  const [kind, setKind] = useState(seed || "pan");
  const [label, setLabel] = useState(labelOf(RESOURCE_KIND, seed || "pan"));
  const save = () => {
    const r = addResource(memberId, kind, label);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Added.");
  };
  const kinds = (VOCAB.resourceKinds as { key: string }[]).map((k) => k.key);
  return (
    <>
      <Head title="Add a document" />
      <div className="md-b">
        <div className="fg">
          <label htmlFor="rsKind">What is it</label>
          <select id="rsKind" className="inp" value={kind}
            onChange={(e) => { setKind(e.target.value); setLabel(labelOf(RESOURCE_KIND, e.target.value)); }}>
            {kinds.map((k) => <option key={k} value={k}>{labelOf(RESOURCE_KIND, k)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="rsLabel">Name it <b className="req">*</b></label>
          <input id="rsLabel" className="inp" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="fg">
          <span className="fg-lb">File</span>
          <div className="tm-drop">
            <Icon name="doc" />
            <span>The upload lands here once private-object storage is decided.
              <b> Nothing in this panel may put an identity document on a public URL.</b></span>
          </div>
        </div>
      </div>
      <Foot label="Add" disabled={!label.trim()} onSave={save} />
    </>
  );
}

/* --------------------------------------------------------------- tags --- */

export function NewTagModal({ ownerId }: { ownerId: string }) {
  const shell = useShell();
  const [name, setName] = useState("");
  const [tone, setTone] = useState("slate");
  const save = () => {
    const r = createTag(ownerId, name, tone);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast(r.data.label + " created.");
  };
  return (
    <>
      <Head title="New tag" />
      <div className="md-b">
        <div className="fg">
          <label htmlFor="tgName">Name <b className="req">*</b></label>
          <input id="tgName" className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) save(); }} />
          <span className="help">It is yours. Somebody else may hold a tag of the same name and it
            stays a different record.</span>
        </div>
        <ToneField value={tone} onPick={setTone} />
      </div>
      <Foot label="Create" disabled={!name.trim()} onSave={save} />
    </>
  );
}

export function RenameTagModal({ t }: { t: Tag }) {
  const shell = useShell();
  const [name, setName] = useState(t.label);
  const save = () => {
    const r = renameTag(t.tagId, name);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Renamed.");
  };
  return (
    <>
      <Head title="Rename this tag" sub={t.label} />
      <div className="md-b">
        <div className="fg">
          <label htmlFor="tgRename">Name <b className="req">*</b></label>
          <input id="tgRename" className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <span className="help">Every item of yours wearing it follows the rename. Nobody else's does.</span>
        </div>
      </div>
      <Foot label="Rename" disabled={!name.trim()} onSave={save} />
    </>
  );
}

/** SIX TONES, NOT A COLOUR PICKER. A free picker on a per-member tag makes a
 *  board where two people's palettes collide, and it would be the first
 *  non-token colour in a panel whose dark mode is a token swap. */
export function ToneField({ value, onPick }: { value: string; onPick: (t: string) => void }) {
  return (
    <div className="fg">
      <span className="fg-lb">Tone</span>
      <div className="tm-tagrow">
        {(VOCAB.tagTones as { key: string; label: string }[]).map((o) => (
          <button key={o.key} type="button" aria-pressed={value === o.key}
            className={"pill xs tm-pick tag-" + o.key + (value === o.key ? " on" : "")}
            onClick={() => onPick(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
