// ── useReportsView ── Reported Listings logic (promptsadmin task 33).
// Status tab strip + resolve/dismiss. Data: /api/v1/admin/reports/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface ReportRow {
  id: number; targetType: string; targetId: string; reason: string; status: string;
  reporter: string | null; reporterEmail: string; resolver: string | null; createdAt: string;
}
export const REPORT_TABS = ["open", "resolved", "dismissed"] as const;

const useReportsView = () => {
  const [tab, setTab] = useState<string>("open");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async (status: string) => {
    setLoading(true);
    const res = await AdminOpsService.reports({ status }).catch(() => null);
    if (res?.response && res.data?.reports) setRows(res.data.reports);
    else setRows([]);
    setLoading(false);
  };
  useEffect(() => { load(tab); }, [tab]);

  const resolve = async (id: number, status: string) => {
    const res = await AdminOpsService.resolveReport(id, status).catch(() => null);
    if (res?.response) { setNotice({ kind: "ok", msg: `Report ${status}.` }); await load(tab); }
    else setNotice({ kind: "err", msg: "Could not update report." });
  };

  return { tab, setTab, rows, loading, notice, resolve };
};

export default useReportsView;
