// ── usePlanRequestsView ── Plan Requests verify+activate (task 35 + master 24).
// Approve is a REAL verify: admin picks the Subscription + entity family, which
// grants+activates the plan for the requester. Data: /api/v1/admin/plan-requests/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface PR {
  id: number; plan: string; name: string; email: string; phone: string;
  state: string; stage: string; transactionId: string; createdAt: string;
}
export interface PlanOption { id: number; family: string; label: string; }

const FAMILIES = ["business", "shop", "architect", "automation"];
const normFamily = (f: string) => (FAMILIES.includes(f) ? f : "business");

const usePlanRequestsView = () => {
  const [rows, setRows] = useState<PR[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [pick, setPick] = useState<string>(""); // "subId|family"
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, p] = await Promise.all([
      AdminOpsService.planRequests().catch(() => null),
      AdminOpsService.plans().catch(() => null),
    ]);
    if (r?.response) setRows(r.data.requests || []);
    if (p?.response && p.data?.plans) {
      setPlans((p.data.plans as Array<{ id: number; planFamily: string; title: string }>).map((s) => ({
        id: s.id, family: normFamily(s.planFamily), label: `${s.planFamily} — ${s.title || "Untitled"}`,
      })));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openVerify = (id: number) => { setVerifyingId(id); setPick(""); setNotice(null); };
  const cancelVerify = () => setVerifyingId(null);

  const confirmVerify = async (id: number) => {
    if (!pick) { setNotice({ kind: "err", msg: "Pick a plan first." }); return; }
    const [subId, family] = pick.split("|");
    setBusy(true);
    const r = await AdminOpsService.verifyPlanRequest(id, { subscriptionId: Number(subId), entityType: family }).catch(() => null);
    setBusy(false);
    if (r?.response) { setNotice({ kind: "ok", msg: "Verified — plan granted & activated." }); setVerifyingId(null); await load(); }
    else setNotice({ kind: "err", msg: r?.message || "Could not verify request." });
  };

  const reject = async (id: number) => {
    const r = await AdminOpsService.setPlanRequestStage(id, "rejected").catch(() => null);
    if (r?.response) { setNotice({ kind: "ok", msg: "Rejected." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not reject." });
  };

  return { rows, plans, loading, notice, verifyingId, pick, setPick, busy, openVerify, cancelVerify, confirmVerify, reject };
};

export default usePlanRequestsView;
