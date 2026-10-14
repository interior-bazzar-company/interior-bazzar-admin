/* =============================================================================
   Orphaned records — #/team?tab=orphans
   -----------------------------------------------------------------------------
   Who still owns a deal, quotation, invoice, enquiry or task after leaving the
   roster (deleted, suspended, or a status the server itself cannot place), and
   what has no owner at all. Read-only: this report finds the mess, it does not
   let anyone reassign it from here.

   Same gate as suspend/delete — GET users/orphans/ sits behind `team.status`
   server-side, so the tab itself is hidden without it (Team/index.tsx) and the
   fetch would 403 anyway if reached by URL.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { OrphanDealRow, OrphanOwnerRow, OrphansResponse } from "../../../api/modules/adminOps";
import { Alert, Button, Card, EmptyState, FormField, FormSection, Input, ListSkeleton, ListTable, ModalShell, Pill, SectionHead, SelectInput, StatStrip } from "../../ui";
import type { StatCell } from "../../ui";
import { inr } from "../../ui/format";
import { useShell } from "../../shell/ShellContext";
import { ErrSlot, errOf } from "../teamShared";
import type { EngineErr, Member } from "../teamShared";

const WHY_TONE: Record<OrphanOwnerRow["why"], "bad" | "warn" | "neutral" | "info"> = {
  deleted: "bad", suspended: "warn", "not a team member": "neutral", unknown: "info",
};

type ReassignTarget =
  | { kind: "deal"; ref: string; label: string }
  | { kind: "owner"; fromId: number; label: string }
  | { kind: "unassigned"; label: string };

export default function Orphans({ members = [], onChanged }: { members?: Member[]; onChanged?: () => void }) {
  const [data, setData] = useState<OrphansResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [target, setTarget] = useState<ReassignTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.orphans())
      .then((r) => { if (!cancelled) { setData(r); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e?.message || "Could not build the report."); });
    return () => { cancelled = true; };
  }, [tick]);

  if (error) return <Alert tone="bad" ico="alert" title="Could not build the report">{error}</Alert>;
  if (!data) return <ListSkeleton />;

  const totalValuePaise = data.owners.reduce((s, o) => s + (o.valuePaise || 0), 0);
  const totalDeals = data.owners.reduce((s, o) => s + o.deals.length, 0) + data.unassigned.deals.length;
  const hasUnassigned =
    data.unassigned.deals.length > 0 ||
    data.unassigned.quotations > 0 ||
    data.unassigned.invoices > 0 ||
    data.unassigned.enquiries > 0;

  const cells: (StatCell | "sep")[] = [
    { k: "orphan owners", v: data.owners.length, dot: data.owners.length ? "warn" : "neutral" },
    "sep",
    { k: "their deals' value", v: inr(totalValuePaise, { compact: true }) },
    "sep",
    { k: "unassigned deals", v: data.unassigned.deals.length, dot: data.unassigned.deals.length ? "bad" : "neutral" },
    "sep",
    { k: "records in total", v: totalDeals },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StatStrip cells={cells} />

      <SectionHead title="Off the roster, still owning records"
        desc="Somebody who left, was suspended, or the server otherwise cannot place — and what still points at their account." />
      {data.owners.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.owners.map((o) => (
            <OwnerCard key={o.id} o={o} onReassign={setTarget} />
          ))}
        </div>
      ) : (
        <EmptyState icon="check" title="Nothing orphaned"
          body="Every deal, quotation, invoice, enquiry and task is owned by someone on the roster." />
      )}

      <SectionHead
        title="Unassigned"
        className="mt-2"
        desc="No owner at all — never assigned, or the owner reference itself was cleared."
        right={hasUnassigned ? (
          <Button
            size="sm"
            color="secondary"
            ico="user"
            onClick={() => setTarget({ kind: "unassigned", label: "All unassigned records" })}
          >
            Bulk Reassign
          </Button>
        ) : null}
      />
      <UnassignedCard u={data.unassigned} onReassign={setTarget} />

      {target ? (
        <ReassignOrphanModal
          target={target}
          members={members}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            setTick((t) => t + 1);
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

function OwnerCard({ o, onReassign }: { o: OrphanOwnerRow; onReassign: (t: ReassignTarget) => void }) {
  return (
    <Card tight
      title={<span className="truncate">{o.name || o.username}</span>}
      right={
        <div className="flex items-center gap-2">
          <Pill xs dot tone={WHY_TONE[o.why]} text={o.why} />
          <Button
            size="xs"
            color="secondary"
            onClick={() => onReassign({ kind: "owner", fromId: o.id, label: "All records owned by " + (o.name || o.username) })}
          >
            Bulk Reassign
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tertiary">
        <span><b className="font-medium text-secondary tnum">{inr(o.valuePaise)}</b> in deals</span>
        <span><b className="font-medium text-secondary tnum">{o.quotations}</b> quotations</span>
        <span><b className="font-medium text-secondary tnum">{o.invoices}</b> invoices</span>
        <span><b className="font-medium text-secondary tnum">{o.enquiries}</b> enquiries</span>
        <span><b className="font-medium text-secondary tnum">{o.tasks}</b> open tasks</span>
      </div>
      <DealsTable rows={o.deals} empty="No deals owned." onReassign={onReassign} />
    </Card>
  );
}

function UnassignedCard({ u, onReassign }: { u: OrphansResponse["unassigned"]; onReassign: (t: ReassignTarget) => void }) {
  return (
    <Card tight title="No owner">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tertiary">
        <span><b className="font-medium text-secondary tnum">{u.quotations}</b> quotations</span>
        <span><b className="font-medium text-secondary tnum">{u.invoices}</b> invoices</span>
        <span><b className="font-medium text-secondary tnum">{u.enquiries}</b> enquiries</span>
      </div>
      <DealsTable rows={u.deals} empty="No unassigned deals." onReassign={onReassign} />
    </Card>
  );
}

function DealsTable({ rows, empty, onReassign }: { rows: OrphanDealRow[]; empty: string; onReassign: (t: ReassignTarget) => void }) {
  if (!rows.length) return <p className="text-sm text-quaternary">{empty}</p>;
  return (
    <ListTable min="480px" head={
      <tr>
        <th>Deal</th>
        <th>Contact</th>
        <th>Stage</th>
        <th className="n">Value</th>
        <th className="acts"><span className="sr-only">Action</span></th>
      </tr>
    }>
      {rows.map((d) => (
        <tr key={d.ref}>
          <td className="cell-1 font-mono text-xs">{d.ref}</td>
          <td>{d.contact}</td>
          <td>{d.stage}</td>
          <td className="n tnum">{inr(d.valuePaise)}</td>
          <td className="acts">
            <Button
              size="xs"
              color="secondary"
              onClick={() => onReassign({ kind: "deal", ref: d.ref, label: d.ref + " (" + d.contact + ")" })}
            >
              Reassign
            </Button>
          </td>
        </tr>
      ))}
    </ListTable>
  );
}

function ReassignOrphanModal({ target, members, onClose, onDone }: {
  target: ReassignTarget;
  members: Member[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useShell();
  const activeMembers = members.filter((m) => m.isActive !== false);
  const [toUserId, setToUserId] = useState<string>(activeMembers[0] ? String(activeMembers[0].id) : "");
  const [reason, setReason] = useState<string>("Reassigning orphaned records");
  const [err, setErr] = useState<EngineErr | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !toUserId) return;
    setBusy(true);
    setErr(null);
    try {
      await call(AdminOpsService.reassignOrphans({
        toUserId: Number(toUserId),
        reason: reason.trim() || "Reassigning orphaned records",
        refs: target.kind === "deal" ? [target.ref] : undefined,
        fromId: target.kind === "owner" ? target.fromId : undefined,
        unassignedOnly: target.kind === "unassigned" ? true : undefined,
      }));
      toast("Records reassigned.");
      onDone();
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Reassign orphaned records"
      sub={target.label}
      ico="user"
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" onClick={onClose}>Cancel</Button>
          <Button color="primary" isLoading={busy} disabled={!toUserId} onClick={submit}>Reassign</Button>
        </>
      }
    >
      <ErrSlot err={err} />
      <FormSection>
        <FormField id="orpTarget" label="Assign to active team member" req>
          <SelectInput
            id="orpTarget"
            value={toUserId}
            onChange={setToUserId}
            options={activeMembers.map((m) => ({
              v: String(m.id),
              l: (m.name || m.username || m.email || ("#" + m.id)) + (m.roles?.length ? " — " + m.roles.map((r) => r.name).join(", ") : ""),
            }))}
          />
        </FormField>
        <FormField id="orpReason" label="Reason" req>
          <Input id="orpReason" value={reason} onChange={(e) => setReason(e.target.value)} ph="Reason for reassignment" />
        </FormField>
      </FormSection>
    </ModalShell>
  );
}
