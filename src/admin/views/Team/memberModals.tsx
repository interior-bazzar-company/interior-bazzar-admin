/* =====================================================================
   TEAM — the write paths. Every one of them a modal, ported from the
   M["tm-*"] handlers in views-team.js.

   Two rules run through all of them:
     · the engine refuses, the dialog SHOWS the refusal — http, code and
       detail, in the #tmErr slot, never a swallowed failure.
     · the password is generated, shown once, and never again. There is no
       screen anywhere that can read it back.
   ===================================================================== */
import { useRef, useState } from "react";
import { IBTeam } from "../../engines";
import { Field, Icon, KvList, Notice, SectionHead } from "../../ui";
import {
  ErrSlot, RolePicks, actor, readRolePicks, val,
} from "../teamShared";
import type { EngineErr, Member, Ops, Role } from "../teamShared";

/* Shared by every "add a photo" field: a live preview circle, an Upload
   button behind a hidden file input, and a Remove button that only shows
   once there is something to remove. The upload is downsized to a small
   square client-side — nothing full-resolution ever reaches localStorage. */
function AvatarPicker() {
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* Reads the picked file, crops it to a centred square and re-encodes it
     small — an avatar never needs to carry a phone camera's original size. */
  function onFile() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file || file.type.indexOf("image/") !== 0) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160, side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        let out: string | null = null;
        try { out = c.toDataURL("image/jpeg", 0.7); } catch { out = null; }
        if (!out) return;
        setUrl(out);
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  }

  return (
    <Field
      label="Photo"
      help="JPG or PNG, square works best. Optional — initials are used if none is set."
      custom={
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="av xl" id="tmAvatarPreview">
              {url ? <img src={url} alt="" /> : <Icon name="team" />}
            </span>
            <input type="file" id="tmAvatarFile" accept="image/*" style={{ display: "none" }}
                   ref={fileRef} onChange={onFile} />
            <button type="button" className="btn sm" data-act="tm-avatar-pick"
                    onClick={() => fileRef.current && fileRef.current.click()}>Upload photo</button>
            <button type="button" className="btn sm icon dgr" data-act="tm-avatar-clear"
                    style={{ display: url ? undefined : "none" }} aria-label="Remove photo"
                    onClick={() => { setUrl(""); if (fileRef.current) fileRef.current.value = ""; }}>
              <Icon name="x" size="sm" />
            </button>
          </div>
          {/* the value tm-new-go reads, exactly as the prototype's hidden input */}
          <input type="hidden" id="tmAvatar" value={url} readOnly />
        </>
      }
    />
  );
}

/* ------------------------------------------------------- create member -- */
export function MemberNewModal({ ops }: { ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const roles: Role[] = IBTeam.allRoles().filter((r: Role) => r.status === "active");

  function create() {
    const r = IBTeam.Members.create({
      name: val("tmName"), designation: val("tmDesig"), email: val("tmEmail"),
      phone: val("tmPhone"), username: val("tmUser"), avatar_url: val("tmAvatar") || null,
      role_ids: readRolePicks(),
    }, actor());
    if (r.ok === false) return setErr(r);
    ops.modal(<CredentialsModal u={r.data.user} password={r.data.password} isNew ops={ops} />);
  }

  return (
    <>
      <div className="md-h">
        <h3>Add team member</h3>
        <p>You create the account; you pass on the credentials yourself</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <SectionHead title="Team member" />
        <AvatarPicker />
        <Field id="tmName" label="Name" req ph="Rhea Menon" />
        <Field id="tmDesig" label="Designation" req ph="Sales Executive"
               help="What they do, in the words your team uses. Separate from their role, which is what they may access." />
        <Field id="tmEmail" label="Email" req type="email" ph="rhea@interiorbazzar.com" />
        <Field id="tmPhone" label="Phone" req ph="+91 98100 00000" />
        <SectionHead title="Account" />
        <Field id="tmUser" label="Username" ph="generated from the name if left blank"
               help="Letters, numbers, dot, dash or underscore. They can sign in with this or their email." />
        <Notice ico="lock" text={
          <><b>The password is generated, shown once, and never again.</b> It is stored as a salted
            hash — there is no screen, anywhere, that can read it back. Copy it from the next dialog
            and pass it on by email or WhatsApp.</>
        } />
        <SectionHead title="Role" />
        <RolePicks roles={roles} />
        <Notice ico="shield" text={
          <><b>A member with no role can sign in and do nothing.</b> That is deliberate — a successful
            login never implies access to anything — but it is rarely what you want.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="tm-new-go" onClick={create}>Create member</button>
      </div>
    </>
  );
}

/* THE ONE TIME A PASSWORD IS EVER ON SCREEN. It is not stored in the clear
   and no other path returns it, so this dialog is the only chance to copy
   it — which is why it says so, rather than closing quietly. */
export function CredentialsModal({ u, password, isNew, ops }: {
  u: Member; password: string; isNew?: boolean; ops: Ops;
}) {
  function copy() {
    /* Built from the values this dialog was handed rather than scraped back
       out of the DOM as the prototype did — same text, same two lines. */
    const txt = "Interior bazzar Admin\nUsername: " + u.username + "\nPassword: " + password;
    if (window.navigator && window.navigator.clipboard) {
      window.navigator.clipboard.writeText(txt).then(
        () => ops.toast("Credentials copied."),
        () => ops.toast("Could not copy — select the text instead.", "bad")
      );
    } else ops.toast("Select the text to copy it.", "");
  }

  return (
    <>
      <div className="md-h">
        <h3>{isNew ? "Member created" : "Password reset"}</h3>
        <p>{u.name} · pass these on yourself</p>
      </div>
      <div className="md-b">
        <KvList cls="wide" pairs={[
          ["Username", <span className="mono">{u.username}</span>],
          ["Email", <span className="mono">{u.email}</span>],
          ["Password", <span className="mono" id="tmPw"
            style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)" }}>{password}</span>],
        ]} />
        <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
          <button className="btn" data-act="tm-copy" onClick={copy}><Icon name="doc" />Copy credentials</button>
        </div>
        <Notice tone="warn" ico="alert" text={
          <><b>This is the only time this password is shown.</b> It is stored as a salted hash, so it
            cannot be read back from any screen — if it is lost, reset it and a new one is generated.
            Send it by email or WhatsApp; nothing is sent automatically.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn pri" data-act="tm-creds-done" data-ref={u.id}
                onClick={() => ops.done(isNew ? "Member ready. Pass the credentials on." : "Password reset.",
                                        "#/team/" + u.id)}>Done</button>
      </div>
    </>
  );
}

/* --------------------------------------------------------- edit member -- */
export function MemberEditModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  function save() {
    const r = IBTeam.Members.update(u.id, {
      name: val("tmName"), designation: val("tmDesig"), email: val("tmEmail"),
      phone: val("tmPhone"), username: val("tmUser"),
    }, actor());
    if (r.ok === false) return setErr(r);
    ops.done("Member updated.", "#/team/" + u.id);
  }
  return (
    <>
      <div className="md-h">
        <h3>Edit member</h3>
        <p className="mono">{u.username || u.id}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="tmName" label="Name" req value={u.name} />
        <Field id="tmDesig" label="Designation" req value={u.designation || ""} />
        <Field id="tmEmail" label="Email" req type="email" value={u.email} />
        <Field id="tmPhone" label="Phone" value={u.phone || ""} />
        <Field id="tmUser" label="Username" value={u.username || ""} />
        <Notice ico="shield" text={
          <><b>Roles are not on this form.</b> Changing what somebody may access is a different
            decision from fixing their phone number, and it carries its own permission — so it has
            its own button.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="tm-edit-go" data-ref={u.id} onClick={save}>Save</button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- roles -- */
export function MemberRolesModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const held: string[] = IBTeam.roleIdsOf(u);
  const roles: Role[] = IBTeam.allRoles();
  function save() {
    const r = IBTeam.Members.setRoles(u.id, readRolePicks(), actor());
    if (r.ok === false) return setErr(r);
    ops.done("Roles updated.", "#/team/" + u.id);
  }
  return (
    <>
      <div className="md-h">
        <h3>Roles</h3>
        <p>{u.name} · what they may access</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <RolePicks roles={roles} held={held} />
        <Notice ico="check" text={
          <><b>More than one role adds up.</b> Effective access is the union of every active role
            held — somebody who is both a Sales Agent and Finance does both jobs. An inactive role
            grants nothing while it stays on the record.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="tm-roles-go" data-ref={u.id} onClick={save}>Save roles</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------ status + reset -- */
export function MemberDeactivateModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  function off() {
    const r = IBTeam.Members.setStatus(u.id, "inactive", actor());
    if (r.ok === false) return setErr(r);
    ops.done("Account deactivated.", "#/team/" + u.id);
  }
  return (
    <>
      <div className="md-h">
        <h3>Deactivate member</h3>
        <p>{u.name}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Notice ico="lock" text={
          <><b>They can no longer sign in, and every call they make would be refused.</b> Nothing they
            created is touched: the deals, quotations and invoices they own keep naming them, which is
            why members are deactivated and never deleted.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn dgr" data-act="tm-off-go" data-ref={u.id} onClick={off}>Deactivate</button>
      </div>
    </>
  );
}

export function MemberResetPwModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  function reset() {
    const r = IBTeam.Members.resetPassword(u.id, actor());
    if (r.ok === false) return setErr(r);
    ops.modal(<CredentialsModal u={r.data.user} password={r.data.password} ops={ops} />);
  }
  return (
    <>
      <div className="md-h">
        <h3>Reset password</h3>
        <p>{u.name}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Notice ico="lock" text={
          <>A new password is generated and shown <b>once</b>. The old one stops working immediately,
            and any lockout is cleared.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="tm-pw-go" data-ref={u.id} onClick={reset}>Reset password</button>
      </div>
    </>
  );
}

/* An account lockout is at five failed attempts, and this is the documented
   way out: an admin issues a temporary password. Same call as the reset
   button — the engine clears failedAttempts and lifts `locked` back to
   `active` — so there is exactly one code path that can end a lockout. */
export function issueTempPassword(u: Member, ops: Ops): boolean {
  const r = IBTeam.Members.resetPassword(u.id, actor());
  if (r.ok === false) {
    ops.toast(r.http + " " + r.code + " — " + r.detail, "bad");
    return false;
  }
  ops.modal(<CredentialsModal u={r.data.user} password={r.data.password} ops={ops} />);
  return true;
}
