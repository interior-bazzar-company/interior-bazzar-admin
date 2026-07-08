// ── useBuyersView ── Buyers table logic (promptsadmin task 18).
// Paginated list + search + block/activate toggle. Blocking a buyer also kills
// their sessions server-side (revoke + login gate). Data: /admin/buyers/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface BuyerRow {
  id: number; username: string; type: string; isActive: boolean; isVerified: boolean;
  joinedAt: string; location: string; phone: string; queryCount: number; savedCount: number;
}

const PAGE_SIZE = 20;

const useBuyersView = () => {
  const [rows, setRows] = useState<BuyerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async (q = "", page = 1) => {
    setLoading(true);
    const res = await AdminOpsService.buyers({ search: q || undefined, pageNo: page, pageSize: PAGE_SIZE }).catch(() => null);
    if (res?.response && res.data?.buyers) {
      setRows(res.data.buyers);
      setTotal(res.data.total ?? res.data.buyers.length);
      setPageNo(res.data.pageNo ?? page);
    } else { setRows([]); setTotal(0); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); load(search, 1); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prev = () => { if (pageNo > 1) load(search, pageNo - 1); };
  const next = () => { if (pageNo < totalPages) load(search, pageNo + 1); };

  const toggle = async (b: BuyerRow) => {
    const res = await AdminOpsService.toggleBuyer(b.id).catch(() => null);
    if (res?.response) {
      setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, isActive: res.data.isActive } : r)));
    } else setNotice({ kind: "err", msg: "Could not update buyer." });
  };

  return { rows, search, setSearch, onSearch, loading, notice, toggle, pageNo, total, totalPages, prev, next };
};

export default useBuyersView;
