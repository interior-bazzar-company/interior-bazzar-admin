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

   EVERY DIALOG IS `ModalShell`: the title where every other modal in the
   panel puts its title, the refusal at the top of the body where the form
   can act on it, and the actions in the footer with the primary last and
   the destructive one carried in `danger` on the far left. The FORMS ARE
   UNCONTROLLED — `val(id)` reads them out of the DOM at save, and
   `readRolePicks()` reads `#tmRoles` — so every field keeps its id.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { Button, FieldRow, FormField, FormSection, Input, ModalShell, Notice } from "../../ui";
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
    <ModalShell
      title="Add team member"
      sub="You set the username and password; pass them on yourself"
      ico="user"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary" data-act="tm-new-go" isLoading={busy} onClick={create}>Create member</Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <div className="flex flex-col gap-6">
        <FormSection title="Team member">
          <FormField id="tmName" label="Name" req>
            <Input id="tmName" ph="Rhea Menon" autoFocus />
          </FormField>
          <FieldRow>
            <FormField id="tmEmail" label="Email" req>
              <Input id="tmEmail" type="email" ph="rhea@interiorbazzar.com" />
            </FormField>
            <FormField id="tmPhone" label="Phone" req>
              <Input id="tmPhone" ph="+91 98100 00000" />
            </FormField>
          </FieldRow>
        </FormSection>

        <FormSection title="Account">
          <FieldRow>
            <FormField id="tmUser" label="Username" req>
              <Input id="tmUser" ph="rhea.menon" />
            </FormField>
            <FormField id="tmPass" label="Password" req
              hint="Set it here and pass it on yourself — there is no generated, shown-once password on this endpoint.">
              <Input id="tmPass" type="password" ph="At least 8 characters" />
            </FormField>
          </FieldRow>
        </FormSection>

        <FormSection title="Role" desc="Effective access is the union of every role held.">
          <RolePicks roles={roles} />
          <Notice ico="shield" text={
            <><b>A member with no role can sign in and do nothing.</b> That is deliberate — a successful
              login never implies access to anything — but it is rarely what you want.</>
          } />
        </FormSection>
      </div>
    </ModalShell>
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
    <ModalShell
      title="Edit member"
      sub={u.username || String(u.id)}
      mono
      ico="edit"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary" data-act="tm-edit-go" data-ref={u.id} isLoading={busy} onClick={save}>Save</Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <FormSection>
        <FieldRow>
          <FormField id="tmName" label="Name" req>
            <Input id="tmName" defaultValue={u.name} autoFocus />
          </FormField>
          <FormField id="tmEmail" label="Email" req>
            <Input id="tmEmail" type="email" defaultValue={u.email} />
          </FormField>
        </FieldRow>
        <FieldRow>
          <FormField id="tmPhone" label="Phone">
            <Input id="tmPhone" defaultValue={u.phone || ""} />
          </FormField>
          <FormField id="tmUser" label="Username">
            <Input id="tmUser" mono defaultValue={u.username || ""} />
          </FormField>
        </FieldRow>
        <Notice ico="shield" text={
          <><b>Roles are not on this form.</b> Changing what somebody may access is a different
            decision from fixing their phone number, so it has its own button.</>
        } />
      </FormSection>
    </ModalShell>
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
    <ModalShell
      title="Roles"
      sub={u.name + " · what they may access"}
      ico="shield"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary" data-act="tm-roles-go" data-ref={u.id} isLoading={busy} onClick={save}>Save roles</Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <div className="flex flex-col gap-4">
        <RolePicks roles={roles} held={held} />
        <Notice ico="check" text={
          <><b>More than one role adds up.</b> Effective access is the union of every role held —
            somebody who is both a Sales Agent and Finance does both jobs.</>
        } />
      </div>
    </ModalShell>
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
    <ModalShell
      title="Send new credentials"
      sub={u.name}
      ico="lock"
      tone="warning"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary" data-act="tm-pw-go" data-ref={u.id} isLoading={busy} onClick={send}>Send new password</Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <Notice ico="lock" text={
        <>A new password is generated and <b>emailed to {u.email}</b> — it is not shown on screen here.
          The old password stops working the moment this succeeds.</>
      } />
    </ModalShell>
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
    <ModalShell
      title="Delete member"
      sub={u.name}
      ico="alert"
      tone="error"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary-destructive" data-act="tm-del-go" data-ref={u.id} isLoading={busy} onClick={remove}>
            Delete member
          </Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <Notice tone="bad" ico="alert" text={
        <><b>This removes the account outright.</b> There is no “deactivate instead” option on this
          endpoint — deals, quotations and invoices they own keep naming them by id regardless.</>
      } />
    </ModalShell>
  );
}
