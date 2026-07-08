// ── useRevenueView ── Revenue & Unit Economics logic (promptsadmin task 28).
// Real aggregates (gross/net/MRR/CAC/expenses) + add-expense form.
// Data: /api/v1/admin/revenue/.
import { useEffect, useState } from "react";
import AdminOpsService, { type RevenueOverview } from "../../../../api/modules/adminOps";

const useRevenueView = () => {
  const [data, setData] = useState<RevenueOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.revenue().catch(() => null);
    if (res?.response && res.data) setData(res.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addExpense = async () => {
    if (!label.trim() || !amount.trim()) { setNotice({ kind: "err", msg: "Label and amount are required." }); return; }
    setSaving(true);
    const res = await AdminOpsService.addExpense({ label: label.trim(), amount: Number(amount) || 0, category: category.trim() }).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Expense added." }); setLabel(""); setAmount(""); setCategory(""); await load(); }
    else setNotice({ kind: "err", msg: "Could not add expense." });
  };

  return { data, loading, notice, label, setLabel, amount, setAmount, category, setCategory, saving, addExpense };
};

export default useRevenueView;
