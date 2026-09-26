/* =============================================================================
   Suspend / Reinstate / See as this member — a new file rather than an
   addition to ../../memberModals.tsx on purpose: that file also holds
   MemberDeleteModal, which another session is reworking onto the same
   ownership-refusal shape suspend uses. Same frame everywhere else in Team
   (ModalShell, FormField, ErrSlot, Notice) so nothing here reads as a
   second dialog language.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../../api/modules/adminOps";
import type { OwnedCounts } from "../../../../api/modules/adminOps";
import { Alert, Button, FormField, ModalShell, Notice, SelectInput, Skeleton, Textarea } from "../../../ui";
import { ErrSlot, errOf } from "../../teamShared";
import type { EngineErr, Member, Ops, Role } from "../../teamShared";
import { setViewAs } from "../../../viewAs";

const ownsAnything = (o: OwnedCounts) => o.deals > 0 || o.quotations > 0 || o.invoices > 0 || o.enquiries > 0 || o.tasks > 0;

/** "3 deals, 2 quotations" — only the counts that are non-zero. */
function ownedLine(o: OwnedCounts): string {
  const one = (n: number, singular: string, plural: string) => n ? n + " " + (n === 1 ? singular : plural) : "";
  return [
    one(o.deals, "deal", "deals"),
    one(o.quotations, "quotation", "quotations"),
    one(o.invoices, "invoice", "invoices"),
    one(o.enquiries, "enquiry", "enquiries"),
    one(o.tasks, "open task", "open tasks"),
  ].filter(Boolean).join(", ");
}

/** Full access resolves to a wildcard, so a role added tomorrow is covered
 *  without this list changing — same check `EffectiveAccess` (MemberPage.tsx)
 *  makes for the same reason: what a member IS made of is not one flag. */
export function isFullAccessMember(u: Member, roles: Role[]): boolean {
  return !!u.isSuperAdmin || roles.some((r) => r.isFullAccess && (u.roles || []).some((x) => x.id === r.id));
}

/* --------------------------------------------------------------- suspend -- */
export function MemberSuspendModal({ u, members, ops }: { u: Member; members: Member[]; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  const [owns, setOwns] = useState<OwnedCounts | null>(null);
  const [ownsLoaded, setOwnsLoaded] = useState(false);
  const [reason, setReason] = useState("");
  const [heir, setHeir] = useState("");

  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.ownedBy(u.id))
      .then((r) => { if (!cancelled) { setOwns(r.owns); setOwnsLoaded(true); } })
      .catch(() => { if (!cancelled) setOwnsLoaded(true); }); // unreadable is not "owns nothing" — the save still asks the server
    return () => { cancelled = true; };
  }, [u.id]);

  const needsHeir = !!owns && ownsAnything(owns);
  const successors = members.filter((m) => m.id !== u.id && m.isActive !== false);

  async function save() {
    if (busy) return;
    if (!reason.trim()) { setErr({ http: 0, message: "Say why — the reason is kept on the record." }); return; }
    setBusy(true);
    setErr(null);
    try {
      await call(AdminOpsService.suspendUser(u.id, {
        reason: reason.trim(),
        reassignTo: heir ? Number(heir) : undefined,
      }));
      ops.done("Account suspended.", "#/team/" + u.id);
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Suspend member"
      sub={u.name}
      ico="lock"
      tone="warning"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary-destructive" data-act="tm-suspend-go" data-ref={u.id} isLoading={busy} onClick={save}>
            Suspend
          </Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <div className="flex flex-col gap-4">
        <Notice tone="warn" ico="lock" text={
          <><b>Their login turns off and every signed-in device is signed out.</b> Nothing is
            deleted — Reinstate turns it back on.</>
        } />

        {!ownsLoaded ? (
          <Skeleton className="h-10 rounded-lg" />
        ) : needsHeir ? (
          <>
            <Alert tone="warn" ico="alert" title="They still own records">
              {ownedLine(owns as OwnedCounts)}. Somebody active has to take these over before this
              account can be suspended.
            </Alert>
            <FormField id="tmSuspendHeir" label="Hand their records to" req>
              <SelectInput id="tmSuspendHeir" value={heir} onChange={setHeir} ph="Choose a member"
                options={successors.map((m) => ({ v: String(m.id), l: m.name }))} />
            </FormField>
          </>
        ) : null}

        <FormField id="tmSuspendWhy" label="Reason" req hint="Kept on the record.">
          <Textarea id="tmSuspendWhy" rows={3} value={reason} onChange={setReason}
            ph="Why this account is being suspended" />
        </FormField>
      </div>
    </ModalShell>
  );
}

/* -------------------------------------------------------------- reinstate -- */
export function MemberReinstateModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  async function save() {
    if (busy) return;
    if (!reason.trim()) { setErr({ http: 0, message: "Say why — the reason is kept on the record." }); return; }
    setBusy(true);
    setErr(null);
    try {
      await call(AdminOpsService.reinstateUser(u.id, { reason: reason.trim() }));
      ops.done("Account reinstated.", "#/team/" + u.id);
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Reinstate member"
      sub={u.name}
      ico="lock"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary" data-act="tm-reinstate-go" data-ref={u.id} isLoading={busy} onClick={save}>
            Reinstate
          </Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <div className="flex flex-col gap-4">
        <Notice ico="check" text="Their login turns back on. Nothing that was reassigned while they were suspended moves back automatically." />
        <FormField id="tmReinstateWhy" label="Reason" req hint="Kept on the record.">
          <Textarea id="tmReinstateWhy" rows={3} value={reason} onChange={setReason}
            ph="Why this account is being reinstated" />
        </FormField>
      </div>
    </ModalShell>
  );
}

/* -------------------------------------------------------------- view as -- */
/** Starts a read-only look: POSTs the audit row, then turns on `X-View-As`
 *  for every GET this session makes until Exit is pressed on the banner
 *  (ViewAsBanner.tsx / admin/viewAs.ts). Offered only to full-access viewers,
 *  on a target that is neither a superuser nor full-access themselves — the
 *  server refuses it anyway (view_as_forbidden / view_as_invalid), this is
 *  just not inviting the click. */
export function MemberViewAsModal({ u, ops }: { u: Member; ops: Ops }) {
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  async function start() {
    if (busy) return;
    if (!reason.trim()) { setErr({ http: 0, message: "Say why you are looking — it is kept on the record." }); return; }
    setBusy(true);
    setErr(null);
    try {
      await call(AdminOpsService.viewAsUser(u.id, { reason: reason.trim() }));
      setViewAs({ id: u.id, name: u.name });
      ops.closeLayer();
      ops.toast("Viewing as " + u.name + " — read-only.");
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="See as this member"
      sub={u.name}
      ico="eye"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary" data-act="tm-viewas-go" data-ref={u.id} isLoading={busy} onClick={start}>
            Start
          </Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <div className="flex flex-col gap-4">
        <Notice ico="eye" text={
          <><b>Read-only.</b> Every screen renders exactly what they would see; every write this
            session tries is refused while it is on. A banner stays up with an Exit button until
            you end it.</>
        } />
        <FormField id="tmViewAsWhy" label="Reason" req hint="Kept on the record.">
          <Textarea id="tmViewAsWhy" rows={3} value={reason} onChange={setReason}
            ph="Why you are looking at the panel as them" />
        </FormField>
      </div>
    </ModalShell>
  );
}
