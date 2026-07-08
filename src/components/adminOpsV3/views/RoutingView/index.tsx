// ── RoutingView ── admin Routing Queue (promptsadmin task 24). Held enquiries;
// flag / discard. Data: /api/v1/admin/routing/.
import LeadQueue from "../LeadQueue";
import AdminOpsService from "../../../../api/modules/adminOps";

const RoutingView = () => (
  <LeadQueue
    title="Routing Queue"
    blurb="Held enquiries awaiting a routing decision. Flag writes to the audit log."
    fetcher={() => AdminOpsService.routing() as any}
    action={(id, status) => AdminOpsService.routingAction(id, status) as any}
    actions={[{ label: "Flag", status: "flagged", kind: "grant" }, { label: "Discard", status: "discarded", kind: "del" }]}
  />
);

export default RoutingView;
