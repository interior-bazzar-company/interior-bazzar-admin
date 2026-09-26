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
import { Alert, Card, EmptyState, ListSkeleton, ListTable, Pill, SectionHead, StatStrip } from "../../ui";
import type { StatCell } from "../../ui";
import { inr } from "../../ui/format";

const WHY_TONE: Record<OrphanOwnerRow["why"], "bad" | "warn" | "neutral" | "info"> = {
  deleted: "bad", suspended: "warn", "not a team member": "neutral", unknown: "info",
};

export default function Orphans() {
  const [data, setData] = useState<OrphansResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.orphans())
      .then((r) => { if (!cancelled) { setData(r); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e?.message || "Could not build the report."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <Alert tone="bad" ico="alert" title="Could not build the report">{error}</Alert>;
  if (!data) return <ListSkeleton />;

  const totalValuePaise = data.owners.reduce((s, o) => s + (o.valuePaise || 0), 0);
  const totalDeals = data.owners.reduce((s, o) => s + o.deals.length, 0) + data.unassigned.deals.length;

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
          {data.owners.map((o) => <OwnerCard key={o.id} o={o} />)}
        </div>
      ) : (
        <EmptyState icon="check" title="Nothing orphaned"
          body="Every deal, quotation, invoice, enquiry and task is owned by someone on the roster." />
      )}

      <SectionHead title="Unassigned" className="mt-2"
        desc="No owner at all — never assigned, or the owner reference itself was cleared." />
      <UnassignedCard u={data.unassigned} />
    </div>
  );
}

function OwnerCard({ o }: { o: OrphanOwnerRow }) {
  return (
    <Card tight
      title={<span className="truncate">{o.name || o.username}</span>}
      right={<Pill xs dot tone={WHY_TONE[o.why]} text={o.why} />}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tertiary">
        <span><b className="font-medium text-secondary tnum">{inr(o.valuePaise)}</b> in deals</span>
        <span><b className="font-medium text-secondary tnum">{o.quotations}</b> quotations</span>
        <span><b className="font-medium text-secondary tnum">{o.invoices}</b> invoices</span>
        <span><b className="font-medium text-secondary tnum">{o.enquiries}</b> enquiries</span>
        <span><b className="font-medium text-secondary tnum">{o.tasks}</b> open tasks</span>
      </div>
      <DealsTable rows={o.deals} empty="No deals owned." />
    </Card>
  );
}

function UnassignedCard({ u }: { u: OrphansResponse["unassigned"] }) {
  return (
    <Card tight title="No owner">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-tertiary">
        <span><b className="font-medium text-secondary tnum">{u.quotations}</b> quotations</span>
        <span><b className="font-medium text-secondary tnum">{u.invoices}</b> invoices</span>
        <span><b className="font-medium text-secondary tnum">{u.enquiries}</b> enquiries</span>
      </div>
      <DealsTable rows={u.deals} empty="No unassigned deals." />
    </Card>
  );
}

function DealsTable({ rows, empty }: { rows: OrphanDealRow[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-quaternary">{empty}</p>;
  return (
    <ListTable min="480px" head={
      <tr>
        <th>Deal</th>
        <th>Contact</th>
        <th>Stage</th>
        <th className="n">Value</th>
      </tr>
    }>
      {rows.map((d) => (
        <tr key={d.ref}>
          <td className="cell-1 font-mono text-xs">{d.ref}</td>
          <td>{d.contact}</td>
          <td>{d.stage}</td>
          <td className="n tnum">{inr(d.valuePaise)}</td>
        </tr>
      ))}
    </ListTable>
  );
}
