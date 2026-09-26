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
import { useEffect, useState } from "react";
/* `call` unwraps the envelope: a refusal (HTTP 200, response:false) throws,
   so it lands in ErrSlot instead of a success toast (team/d2). */
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { OwnedCounts } from "../../../api/modules/adminOps";
import { can } from "../../auth/session";
import { Alert, Button, FieldRow, FormField, FormSection, Input, ModalShell, Notice, PaneLoading, SelectInput, Textarea } from "../../ui";
import { ErrSlot, RolePicks, errOf, readRolePicks, val } from "../teamShared";
import type { EngineErr, Member, Ops, Role } from "../teamShared";

/* ------------------------------------------------------- create member -- */
export function MemberNewModal({ roles, ops }: { roles: Role[]; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  /* ASSIGNING A ROLE IS ITS OWN GRANT, and the server checks it on the PAYLOAD
     rather than on the method: `POST users/` passes on `team.create`, then
     refuses with 403 if the body carries a role and the caller lacks
     `team.roles` (AdminUserViews). So a role holder with create-but-not-roles
     met an enabled form, a role picker, and a refusal on every attempt — the
     grid says `create` is ticked and has no column that could have said
     otherwise, because a checkbox per verb cannot express a gate that depends
     on what you typed.

     The picker is ABSENT rather than disabled, like every other locked control
     in this panel, and the member is created with no role — which the server
     does allow — with a line saying who can finish the job. */
  const mayAssign = can("team", "roles");

  async function create() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await call(AdminOpsService.createUser({
        username: val("tmUser"), password: val("tmPass"),
        name: val("tmName"), email: val("tmEmail"), phone: val("tmPhone"),
        roles: mayAssign ? readRolePicks() : [],
      }));
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
          {mayAssign ? <RolePicks roles={roles} /> : null}
          <Notice ico="shield" text={mayAssign
            ? <><b>A member with no role can sign in and do nothing.</b> That is deliberate — a successful
                login never implies access to anything — but it is rarely what you want.</>
            : <><b>Your role can add a member but not give them a role.</b> Assigning one needs
                Team · Manage roles, which yours does not include — so this creates the account and
                an admin assigns the role afterwards. The account can sign in and do nothing until
                they do.</>
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
      await call(AdminOpsService.updateUser(u.id, {
        name: val("tmName"), email: val("tmEmail"), phone: val("tmPhone"), username: val("tmUser"),
      }));
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
      await call(AdminOpsService.updateUser(u.id, { roles: readRolePicks() }));
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
      await call(AdminOpsService.sendUserCredentials(u.id));
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
/** Counts as {deals, quotations, invoices, enquiries, tasks} — the labels
 *  the "still owns records" refusal names. */
const OWNS_LABELS: [keyof OwnedCounts, string][] = [
  ["deals", "deal"], ["quotations", "quotation"], ["invoices", "invoice"],
  ["enquiries", "enquiry"], ["tasks", "open task"],
];

export function MemberDeleteModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  /* CHECKED AHEAD OF THE ATTEMPT, not read off a refused delete's response —
     the real endpoint's refusal carries `data.owns`, but this panel's fetch
     layer (AdminOpsService.call) only ever keeps a refusal's message, never
     its data. `ownedBy` is the same counts read early, which the server's own
     docstring says is the intended order: know before you ask who inherits. */
  const [owns, setOwns] = useState<OwnedCounts | null>(null);
  const [ownsErr, setOwnsErr] = useState<EngineErr | null>(null);
  const [people, setPeople] = useState<Member[] | null>(null);
  const [heir, setHeir] = useState("");

  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.ownedBy(u.id)).then((d) => { if (!cancelled) setOwns(d.owns); })
      .catch((e: unknown) => { if (!cancelled) { setOwns({ deals: 0, quotations: 0, invoices: 0, enquiries: 0, tasks: 0 }); setOwnsErr(errOf(e)); } });
    call(AdminOpsService.users())
      .then((rows) => { if (!cancelled) setPeople(rows.filter((m) => m.id !== u.id && m.isActive !== false)); })
      .catch(() => { if (!cancelled) setPeople([]); });
    return () => { cancelled = true; };
  }, [u.id]);

  const held = owns ? OWNS_LABELS.filter(([k]) => owns[k] > 0) : [];
  const mustReassign = held.length > 0;

  async function remove() {
    if (busy) return;
    const reason = val("tmDelReason");
    if (!reason.trim()) { setErr({ http: 0, message: "Say why — the reason is kept on the record." }); return; }
    if (mustReassign && !heir) { setErr({ http: 0, message: "Pick who takes over their records first." }); return; }
    setBusy(true);
    setErr(null);
    try {
      await call(AdminOpsService.deleteUser(u.id, { reason, reassignTo: heir ? Number(heir) : undefined }));
      ops.done("Member removed — signed out and blocked from signing in.", "#/team");
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
      <div className="flex flex-col gap-4">
        {/* This used to read "removes the account outright", which was true of
            the old hard delete and is no longer: the endpoint now marks the
            account deleted and switches it off, so the records it owns keep
            naming somebody instead of coming back Unassigned. Saying otherwise
            made an ordinary removal look unrecoverable. */}
        <Notice tone="bad" ico="alert" text={
          <><b>They lose access immediately.</b> Every signed-in device is signed out and the account
            can no longer sign in. The row is kept, marked deleted, so their past work still names
            them — this is not a way to erase somebody.</>
        } />
        {owns === null ? <PaneLoading label="Checking what they still own…" /> : null}
        {ownsErr ? (
          <Alert tone="bad" title="Could not check what this account owns.">
            <span className="font-mono">{ownsErr.message}</span> — the delete may still be refused if
            they turn out to own something.
          </Alert>
        ) : null}
        {mustReassign ? (
          <>
            <Alert tone="warn" title="Still holding records the server will not let this drop.">
              {held.map(([k, l]) => owns![k] + " " + l + (owns![k] === 1 ? "" : "s")).join(", ")}. Pick
              who takes them over below, or the server refuses the delete.
            </Alert>
            <FormField label="Reassign their records to" req>
              <SelectInput ariaLabel="Reassign to" value={heir} onChange={setHeir}
                options={[{ v: "", l: people === null ? "Loading…" : "— choose a successor —" }]
                  .concat((people || []).map((m) => ({ v: String(m.id), l: m.name })))} />
            </FormField>
          </>
        ) : null}
        <FormField id="tmDelReason" label="Reason" req
          hint="Mandatory, and enforced by the server. It is kept on the record.">
          <Textarea id="tmDelReason" rows={3} ph="Left the company; access revoked on 2026-09-20." />
        </FormField>
      </div>
    </ModalShell>
  );
}
