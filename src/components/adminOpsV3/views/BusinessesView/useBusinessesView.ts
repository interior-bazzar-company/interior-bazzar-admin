// ── useBusinessesView ── Businesses table logic (promptsadmin task 19).
// Paginated list + search + toggle IB-verified badge. Data: /admin/businesses/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface BusinessRow {
  id: number; businessName: string; owner: string | null; location: string;
  isVerified: boolean; status: string; planName: string; planExpireAt: string | null;
  badge: string; enquiries: number; responseSeconds: number | null;
}

const PAGE_SIZE = 20;

// Remaining-plan time from an expiry ISO string, computed client-side.
export const remainingLabel = (expireAt: string | null): string => {
  if (!expireAt) return "—";
  const ms = new Date(expireAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.ceil(ms / 86400000);
  if (days >= 330) return "~1 yr left";
  if (days >= 150) return "~6 mo left";
  if (days >= 75) return "~3 mo left";
  return `${days}d left`;
};

// Response time from seconds → "Xm" / "Xh" / "—".
export const responseLabel = (secs: number | null): string => {
  if (secs == null) return "—";
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m`;
  return `${Math.round(secs / 3600)}h`;
};

const useBusinessesView = () => {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (q = "", page = 1) => {
    setLoading(true);
    const res = await AdminOpsService.businesses({ search: q || undefined, pageNo: page, pageSize: PAGE_SIZE }).catch(() => null);
    if (res?.response && res.data?.businesses) {
      setRows(res.data.businesses);
      setTotal(res.data.total ?? res.data.businesses.length);
      setPageNo(res.data.pageNo ?? page);
    } else { setRows([]); setTotal(0); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); load(search, 1); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prev = () => { if (pageNo > 1) load(search, pageNo - 1); };
  const next = () => { if (pageNo < totalPages) load(search, pageNo + 1); };

  const toggle = async (b: BusinessRow) => {
    const res = await AdminOpsService.toggleBusinessVerified(b.id).catch(() => null);
    if (res?.response) setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, isVerified: res.data.isVerified } : r)));
    else setNotice({ kind: "err", msg: "Could not update business." });
  };

  return { rows, search, setSearch, onSearch, loading, notice, toggle, pageNo, total, totalPages, prev, next };
};

export default useBusinessesView;
