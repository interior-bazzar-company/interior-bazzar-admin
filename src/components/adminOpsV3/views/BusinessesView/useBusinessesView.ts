// ── useBusinessesView ── Businesses table logic (promptsadmin task 19).
// List + search + toggle IB-verified badge. Data: /admin/businesses/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface BusinessRow { id: number; businessName: string; isVerified: boolean; owner: string | null; }

const useBusinessesView = () => {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async (q = "") => {
    setLoading(true);
    const res = await AdminOpsService.businesses({ search: q || undefined }).catch(() => null);
    if (res?.response && res.data?.businesses) setRows(res.data.businesses);
    else setRows([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); load(search); };

  const toggle = async (b: BusinessRow) => {
    const res = await AdminOpsService.toggleBusinessVerified(b.id).catch(() => null);
    if (res?.response) setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, isVerified: res.data.isVerified } : r)));
    else setNotice({ kind: "err", msg: "Could not update business." });
  };

  return { rows, search, setSearch, onSearch, loading, notice, toggle };
};

export default useBusinessesView;
