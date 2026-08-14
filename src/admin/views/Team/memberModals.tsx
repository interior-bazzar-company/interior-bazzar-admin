/* =====================================================================
   TEAM — the write paths, now real requests against interior_admin's
   `v1/admin/users/` (AdminUserViews) instead of the local IBTeam engine.

   Two things differ from the local-engine version, both forced by what the
   real endpoint actually does:
     · CREATE takes a password FROM THE ADMIN (CreateAdminUser.password is
       required) — the server has no "generate one and hand it back" path,
       so there is no shown-once credentials dialog on creation any more.
     · "Reset password" is now `POST /users/:id/send-credentials/`, which
       generates a new password and EMAILS it — it is never returned to the
       caller, so it cannot be shown on screen at all, unlike the old
       local-engine flow.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { Field, Icon, Notice, SectionHead } from "../../ui";
import { ErrSlot, RolePicks, errOf, readRolePicks, val } from "../teamShared";
import type { EngineErr, Member, Ops, Role } from "../teamShared";

/* ------------------------------------------------------- create member -- */
export function MemberNewModal({ roles, ops }: { roles: Role[]; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await AdminOpsService.createUser({
        username: val("tmUser"), password: val("tmPass"),
        name: val("tmName"), email: val("tmEmail"), phone: val("tmPhone"),
        roles: readRolePicks(),
      });
      ops.done("Member created.");
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="md-h">
        <h3>Add team member</h3>
        <p>You set the username and password; pass them on yourself</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <SectionHead title="Team member" />
        <Field id="tmName" label="Name" req ph="Rhea Menon" />
        <Field id="tmEmail" label="Email" req type="email" ph="rhea@interiorbazzar.com" />
        <Field id="tmPhone" label="Phone" req ph="+91 98100 00000" />
        <SectionHead title="Account" />
        <Field id="tmUser" label="Username" req ph="rhea.menon" />
        <Field id="tmPass" label="Password" req type="password" ph="At least 8 characters"
               help="Set it here and pass it on yourself — there is no generated, shown-once password on this endpoint." />
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
        <button className="btn pri" data-act="tm-new-go" onClick={create} disabled={busy}>Create member</button>
      </div>
    </>
  );
}

/* --------------------------------------------------------- edit member -- */
export function MemberEditModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await AdminOpsService.updateUser(u.id, {
        name: val("tmName"), email: val("tmEmail"), phone: val("tmPhone"), username: val("tmUser"),
      });
      ops.done("Member updated.", "#/team/" + u.id);
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
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
        <Field id="tmEmail" label="Email" req type="email" value={u.email} />
        <Field id="tmPhone" label="Phone" value={u.phone || ""} />
        <Field id="tmUser" label="Username" value={u.username || ""} />
        <Notice ico="shield" text={
          <><b>Roles are not on this form.</b> Changing what somebody may access is a different
            decision from fixing their phone number, so it has its own button.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="tm-edit-go" data-ref={u.id} onClick={save} disabled={busy}>Save</button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- roles -- */
export function MemberRolesModal({ u, roles, ops }: { u: Member; roles: Role[]; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  const held: number[] = u.roles.map((r) => r.id);
  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await AdminOpsService.updateUser(u.id, { roles: readRolePicks() });
      ops.done("Roles updated.", "#/team/" + u.id);
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
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
          <><b>More than one role adds up.</b> Effective access is the union of every role held —
            somebody who is both a Sales Agent and Finance does both jobs.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="tm-roles-go" data-ref={u.id} onClick={save} disabled={busy}>Save roles</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------ credentials -- */
/* The prototype's "Reset password" showed a generated password once. This
   endpoint EMAILS a generated password instead and never returns it, so
   there is nothing to show on screen — the dialog says so rather than
   rendering an empty field where a password used to be. */
export function MemberSendCredentialsModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await AdminOpsService.sendUserCredentials(u.id);
      ops.done("A new password was emailed to " + u.email + ".", "#/team/" + u.id);
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="md-h">
        <h3>Send new credentials</h3>
        <p>{u.name}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Notice ico="lock" text={
          <>A new password is generated and <b>emailed to {u.email}</b> — it is not shown on screen here.
            The old password stops working the moment this succeeds.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn pri" data-act="tm-pw-go" data-ref={u.id} onClick={send} disabled={busy}>Send new password</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- delete -- */
/* Real, and hard: unlike the local engine's philosophy ("deactivated, never
   deleted" — because there was no server to enforce anything else), the real
   endpoint IS a delete. There is no deactivate endpoint to prefer instead. */
export function MemberDeleteModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await AdminOpsService.deleteUser(u.id);
      ops.done("Member deleted.", "#/team");
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="md-h">
        <h3>Delete member</h3>
        <p>{u.name}</p>
        <button className="md-x" data-close="1" onClick={ops.closeLayer}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Notice tone="bad" ico="alert" text={
          <><b>This removes the account outright.</b> There is no "deactivate instead" option on this
            endpoint — deals, quotations and invoices they own keep naming them by id regardless.</>
        } />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={ops.closeLayer}>Cancel</button>
        <button className="btn dgr" data-act="tm-del-go" data-ref={u.id} onClick={remove} disabled={busy}>Delete member</button>
      </div>
    </>
  );
}
