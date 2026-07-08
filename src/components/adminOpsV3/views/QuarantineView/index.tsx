// ── QuarantineView ── admin Quarantine (promptsadmin task 25). Genuineness
// checks; release / confirm-spam. Data: /api/v1/admin/quarantine/.
import LeadQueue from "../LeadQueue";
import AdminOpsService from "../../../../api/modules/adminOps";

const QuarantineView = () => (
  <LeadQueue
    title="Quarantine"
    blurb="Enquiries held for genuineness review. Release the good ones, confirm spam on the rest."
    fetcher={() => AdminOpsService.quarantine() as any}
    action={(id, status) => AdminOpsService.quarantineAction(id, status) as any}
    actions={[{ label: "Release", status: "released", kind: "grant" }, { label: "Confirm spam", status: "spam", kind: "del" }]}
  />
);

export default QuarantineView;
