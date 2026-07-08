// ── useWeightsView ── Qualification Weights logic (promptsadmin task 26).
// Signal→weight config editor. Super-admin, level-3 (backend audits).
// Data: /api/v1/admin/weights/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface WeightRow { key: string; value: string; }

const useWeightsView = () => {
  const [rows, setRows] = useState<WeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.weights().catch(() => null);
    if (res?.response && res.data?.weights) {
      setRows(Object.entries(res.data.weights).map(([key, value]) => ({ key, value: String(value) })));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setValue = (key: string, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));

  const addRow = () => {
    const k = newKey.trim();
    if (!k) return;
    if (rows.some((r) => r.key === k)) { setNotice({ kind: "err", msg: "That signal already exists." }); return; }
    setRows((rs) => [...rs, { key: k, value: newVal || "0" }]);
    setNewKey(""); setNewVal("");
  };

  const save = async () => {
    setSaving(true);
    const weights: Record<string, number> = {};
    for (const r of rows) weights[r.key] = Number(r.value) || 0;
    const res = await AdminOpsService.setWeights(weights, false).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Weights saved." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not save weights." });
  };

  return { rows, loading, saving, notice, newKey, setNewKey, newVal, setNewVal, setValue, addRow, save };
};

export default useWeightsView;
