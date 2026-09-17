/* =====================================================================
   TEAM — Access requests.
   ---------------------------------------------------------------------
   Read from `GET v1/admin/access-requests/` (team/d1): a member asks for
   one module action they do not hold, and a holder of `team.requests`
   approves them into an existing role that holds it, or rejects. Grants
   only ever come from roles — approving hands over the WHOLE role, and the
   dialog says so. Nobody decides their own request; the server refuses it
   and the row does not offer it.

   One read, made by Team/index.tsx and handed down, so the tab badge and
   the tab body can never disagree about how many are waiting.
   ===================================================================== */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { AccessRequestRow } from "../../../api/modules/adminOps";
import { AppExceptions, errMessage } from "../../../api/apiService";
import { getSession } from "../../auth/session";
import {
  Button, ConfirmModal, EmptyState, FormField, ListTable, ModalShell, Notice, PaneLoading, Person, Pill, Rail,
  SectionHead, SelectInput, fmtDate,
} from "../../ui";
import { ErrSlot, errOf } from "../teamShared";
import type { EngineErr, Ops, Role } from "../teamShared";

export type PendingRequests =
  | { state: "loading" }
  | { state: "ok"; n: number; rows: AccessRequestRow[] }
  | { state: "denied" }
  | { state: "error"; message: string };

/** Every access request, and how many are waiting, plus a re-read. `denied` is
 *  a 403: the viewer does not hold team.requests, which is a fact about them,
 *  not an empty queue. ponytail: the endpoint has no paging; page it when the
 *  history runs to hundreds. */
export function usePendingRequests(): [PendingRequests, () => void] {
  const [q, setQ] = useState<PendingRequests>({ state: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.accessRequests())
      .then((r) => { if (!cancelled) setQ({ state: "ok", n: r.pending, rows: r.requests }); })
      .catch((e) => {
        if (cancelled) return;
        setQ(e instanceof AppExceptions && e.code === 403 ? { state: "denied" } : { state: "error", message: errMessage(e) });
      });
    return () => { cancelled = true; };
  }, [tick]);
  return [q, () => setTick((t) => t + 1)];
}

/** The tab badge: a number only when the count is known. */
export function pendingRequests(q: PendingRequests): number | null {
  return q.state === "ok" ? q.n : null;
}

const asked = (r: AccessRequestRow) => (
  <>
    <span className="font-medium text-primary">{r.module.label}</span>
    <span className="block cell-2 font-mono">{r.module.key}.{r.action}</span>
  </>
);

export default function AccessRequests({ q, reload, roles, ops }: {
  q: PendingRequests; reload: () => void; roles: Role[]; ops: Ops;
}) {
  if (q.state === "loading") return <PaneLoading />;
  if (q.state === "denied") return <Notice ico="lock" text="Access requests are not in your access." />;
  if (q.state === "error") return <Notice tone="bad" ico="alert" text={q.message} />;
  if (!q.rows.length) {
    return (
      <EmptyState
        icon="inbox"
        title="No access requests"
        body="Nobody has asked. A member asks for one action they do not hold, and it waits here until someone approves them into a role that holds it."
      />
    );
  }

  const me = getSession()?.user.id;
  const waiting = q.rows.filter((r) => r.state.key === "requested");
  const decided = q.rows.filter((r) => r.state.key !== "requested");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col">
        <SectionHead
          title="Waiting"
          desc={waiting.length
            ? waiting.length + " to decide. Approving adds the member to a role; the role is what grants."
            : "Nothing to decide."} />
        <ListTable min="60rem" head={<tr>
          <th className="rail" />
          <th scope="col">Member</th>
          <th scope="col">Asks for</th>
          <th scope="col">Why</th>
          <th scope="col">Asked</th>
          <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
        </tr>}>
          {waiting.map((r) => (
            <tr key={r.id}>
              <Rail tone="warn" title="Waiting on a decision" />
              <td className="cell-1"><Person name={r.member.name} sub={r.member.username} to={"#/team/" + r.member.id} /></td>
              <td>{asked(r)}</td>
              <td className="max-w-80 whitespace-normal">{r.reason || <span className="text-quaternary">—</span>}</td>
              <td className="tnum">{fmtDate(r.createdAt)}</td>
              <td className="acts">
                {r.member.id === me ? (
                  <span className="text-xs text-quaternary">Yours — someone else decides</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Button color="primary" size="xs" data-act="ar-approve" data-ref={r.id}
                      onClick={() => ops.modal(<ApproveModal r={r} roles={roles} ops={ops} reload={reload} />)}>
                      Approve
                    </Button>
                    <Button color="secondary-destructive" size="xs" data-act="ar-reject" data-ref={r.id}
                      onClick={() => ops.modal(<RejectModal r={r} ops={ops} reload={reload} />)}>
                      Reject
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {waiting.length ? null : (
            <tr>
              <td colSpan={6} className="p-0!">
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-primary">Nobody is waiting</p>
                  <p className="mt-1 text-sm text-tertiary">Every request below has been decided.</p>
                </div>
              </td>
            </tr>
          )}
        </ListTable>
      </section>

      {decided.length ? (
        <section className="flex flex-col">
          <SectionHead title="Decided" desc="Newest first. Each decision is also on the audit trail." />
          <ListTable min="60rem" head={<tr>
            <th scope="col">Member</th>
            <th scope="col">Asked for</th>
            <th scope="col">Outcome</th>
            <th scope="col">Role granted</th>
            <th scope="col">Decided by</th>
          </tr>}>
            {decided.map((r) => (
              <tr key={r.id}>
                <td className="cell-1"><Person name={r.member.name} sub={r.member.username} to={"#/team/" + r.member.id} /></td>
                <td>{asked(r)}</td>
                <td><Pill xs dot tone={r.state.tone} text={r.state.label} /></td>
                <td>{r.grantedRole ? r.grantedRole.name : <span className="text-quaternary">—</span>}</td>
                <td>
                  <span className="font-medium text-primary">{r.decidedBy ? r.decidedBy.name : "—"}</span>
                  <span className="block cell-2 tnum">{fmtDate(r.decidedAt)}</span>
                </td>
              </tr>
            ))}
          </ListTable>
        </section>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- approve -- */
/* Only roles the server would accept are offered: active, and holding the
   action (a full-access role holds every one). Narrow roles first, so the
   default pick is never the one that hands over the whole panel. */
function ApproveModal({ r, roles, ops, reload }: { r: AccessRequestRow; roles: Role[]; ops: Ops; reload: () => void }) {
  const fit = roles
    .filter((x) => x.isActive && (x.isFullAccess || (x.modules[r.module.key] || []).indexOf(r.action) >= 0))
    .sort((a, b) => Number(a.isFullAccess) - Number(b.isFullAccess) || a.name.localeCompare(b.name));
  const [role, setRole] = useState(fit.length ? String(fit[0].id) : "");
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);
  const picked = fit.filter((x) => String(x.id) === role)[0];

  async function approve() {
    if (busy || !picked) return;
    setBusy(true);
    setErr(null);
    try {
      await call(AdminOpsService.decideAccessRequest(r.id, { state: "approved", role: picked.id }));
      reload();
      ops.done("Approved. " + r.member.name + " is now in " + picked.name + ".");
    } catch (e) {
      setErr(errOf(e));
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Approve access"
      sub={r.member.name + " · " + r.module.label + " · " + r.action}
      ico="shield"
      onClose={ops.closeLayer}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={ops.closeLayer}>Cancel</Button>
          <Button color="primary" data-act="ar-approve-go" data-ref={r.id} isLoading={busy} isDisabled={!picked} onClick={approve}>
            Approve
          </Button>
        </>
      }
    >
      <ErrSlot err={err} />
      {fit.length ? (
        <div className="flex flex-col gap-4">
          <FormField id="arRole" label="Add them to" hint={"Active roles that hold " + r.module.key + "." + r.action + "."}>
            <SelectInput id="arRole" value={role} onChange={setRole}
              options={fit.map((x) => ({ v: String(x.id), l: x.name + (x.isFullAccess ? " (full access)" : "") }))} />
          </FormField>
          <Notice tone="warn" ico="alert" text={
            <><b>They get the whole role.</b> Everything {picked ? picked.name : "it"} grants comes with it, not
              only the one action asked for.</>
          } />
        </div>
      ) : (
        <Notice tone="warn" ico="alert" text={
          <>No active role holds <b className="font-mono">{r.module.key}.{r.action}</b>. Grant it to a role in{" "}
            <a className="underline" href="#/roles">Roles</a> first, then approve.</>
        } />
      )}
    </ModalShell>
  );
}

/* ----------------------------------------------------------------- reject -- */
function RejectModal({ r, ops, reload }: { r: AccessRequestRow; ops: Ops; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  async function reject() {
    if (busy) return;
    setBusy(true);
    try {
      await call(AdminOpsService.decideAccessRequest(r.id, { state: "rejected" }));
      ops.done("Rejected.");
    } catch (e) {
      ops.closeLayer();
      ops.toast(errMessage(e), "bad");
    } finally {
      setBusy(false);
      reload();
    }
  }
  return (
    <ConfirmModal
      title="Reject this request?"
      body={r.member.name + " asked for " + r.module.label + " · " + r.action + ". They keep the access they have."}
      verb="Reject"
      tone="bad"
      busy={busy}
      onConfirm={reject}
      onClose={ops.closeLayer}
    />
  );
}
