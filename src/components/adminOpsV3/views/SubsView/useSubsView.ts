// ── useSubsView ── Subscriptions logic (promptsadmin task 20 + master task 10).
// Per-family analytics + a family-scoped, paginated subscriber list from the
// SAME /admin/subs/ call. Families are the real literals (business/shop/
// architect/automation), NOT the prototype's "Architecture".
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface Sub {
  id: number; family: string; amount: string; status: string; isActive: boolean;
  user: string | null; entityName: string | null; planTitle: string | null; expireDate: string | null;
}
export interface SubAnalytics {
  activeCount: number; expiredCount: number; pendingCount: number; totalCount: number; revenue: number;
}

export const FAMILY_TABS = [
  { key: "all", label: "All" },
  { key: "business", label: "Business" },
  { key: "shop", label: "Shop" },
  { key: "architect", label: "Architect" },
  { key: "automation", label: "Automation" },
] as const;

const PAGE_SIZE = 20;
const EMPTY: SubAnalytics = { activeCount: 0, expiredCount: 0, pendingCount: 0, totalCount: 0, revenue: 0 };

const useSubsView = () => {
  const [family, setFamily] = useState<string>("all");
  const [rows, setRows] = useState<Sub[]>([]);
  const [analytics, setAnalytics] = useState<SubAnalytics>(EMPTY);
  const [pageNo, setPageNo] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const params = { pageNo, pageSize: PAGE_SIZE, ...(family !== "all" ? { family } : {}) };
    const res = await AdminOpsService.subs(params).catch(() => null);
    if (res?.response && res.data) {
      setRows(res.data.subs || []);
      setAnalytics(res.data.analytics || EMPTY);
      setTotal(res.data.total || 0);
    } else {
      setRows([]); setAnalytics(EMPTY); setTotal(0);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [family, pageNo]);

  const selectFamily = (f: string) => { setFamily(f); setPageNo(1); };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { family, selectFamily, rows, analytics, loading, pageNo, setPageNo, pageCount, total };
};

export default useSubsView;
