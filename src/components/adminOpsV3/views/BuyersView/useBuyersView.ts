// ── useBuyersView ── Buyers table logic (promptsadmin task 18).
// Paginated list + search + block/activate toggle. Data: /admin/buyers/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface BuyerRow {
  id: number; username: string; type: string; isActive: boolean; isVerified: boolean; joinedAt: string;
}

const useBuyersView = () => {
  const [rows, setRows] = useState<BuyerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async (q = "") => {
    setLoading(true);
    const res = await AdminOpsService.buyers({ search: q || undefined }).catch(() => null);
    if (res?.response && res.data?.buyers) setRows(res.data.buyers);
    else setRows([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); load(search); };

  const toggle = async (b: BuyerRow) => {
    const res = await AdminOpsService.toggleBuyer(b.id).catch(() => null);
    if (res?.response) {
      setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, isActive: res.data.isActive } : r)));
    } else setNotice({ kind: "err", msg: "Could not update buyer." });
  };

  return { rows, search, setSearch, onSearch, loading, notice, toggle };
};

export default useBuyersView;
