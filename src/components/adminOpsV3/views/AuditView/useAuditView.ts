// ── useAuditView ── Audit Log logic (promptsadmin task 40).
// Read-only, paginated, filter by module. Data: /api/v1/admin/audit/.
import { useEffect, useState } from "react";
import AdminOpsService, { type AuditEntry } from "../../../../api/modules/adminOps";

const useAuditView = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [module, setModule] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  const load = async (page: number, mod: string) => {
    setLoading(true);
    const res = await AdminOpsService.audit({ pageNo: page, pageSize, module: mod || undefined }).catch(() => null);
    if (res?.response && res.data) { setEntries(res.data.entries); setTotal(res.data.total); }
    else { setEntries([]); setTotal(0); }
    setLoading(false);
  };
  useEffect(() => { load(pageNo, module); }, [pageNo, module]);

  const filterModule = (m: string) => { setModule(m); setPageNo(1); };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { entries, total, pageNo, setPageNo, module, filterModule, loading, totalPages };
};

export default useAuditView;
