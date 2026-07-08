// ── useBusinessModerationView ── Catalog & Trust > Businesses Moderation (task 18).
// Own shape (profile score + catalog/review counts), NOT the Users>Businesses list.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface BizMod {
  id: number; businessName: string; category: string; city: string;
  catalogCount: number; reviewCount: number; profileScore: number;
}

const PAGE_SIZE = 20;

const useBusinessModerationView = () => {
  const [rows, setRows] = useState<BizMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.businessModeration({ search: search || undefined, pageNo, pageSize: PAGE_SIZE }).catch(() => null);
    if (res?.response && res.data) { setRows(res.data.businesses || []); setTotal(res.data.total || 0); }
    else { setRows([]); setTotal(0); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [pageNo]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = () => { if (pageNo !== 1) setPageNo(1); else load(); };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { rows, loading, search, setSearch, doSearch, pageNo, setPageNo, pageCount, total };
};

export default useBusinessModerationView;
