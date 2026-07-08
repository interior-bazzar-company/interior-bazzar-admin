// ── RoutingView ── admin Routing Queue (promptsadmin task 24 + master task 13).
// Held enquiries (quarantined/spam excluded backend-side); tier badges + tier
// filter + add/edit lead. Data: /api/v1/admin/routing/.
import LeadQueue, { type LeadForm } from "../LeadQueue";
import AdminOpsService from "../../../../api/modules/adminOps";

const RoutingView = () => (
  <LeadQueue
    title="Routing Queue"
    blurb="Held enquiries awaiting a routing decision. Flag writes to the audit log."
    fetcher={(tier) => AdminOpsService.routing(tier ? { tier } : {}) as any}
    action={(id, status) => AdminOpsService.routingAction(id, status) as any}
    actions={[{ label: "Flag", status: "flagged", kind: "grant" }, { label: "Discard", status: "discarded", kind: "del" }]}
    tierFilter
    onAdd={(data: LeadForm) => AdminOpsService.createLead(data) as any}
    onEdit={(id: number, data: LeadForm) => AdminOpsService.updateLead(id, data) as any}
  />
);

export default RoutingView;
