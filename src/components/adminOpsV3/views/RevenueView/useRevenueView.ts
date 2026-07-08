// ── useRevenueView ── Revenue & Unit Economics logic (task 28 + master task 17).
// Real aggregates (MRR/ARPU/family/monthly) + P&L split + tunable assumption
// inputs so LTV/CAC/payback are transparent, not invented. Data: /admin/revenue/.
import { useEffect, useState } from "react";
import AdminOpsService, { type RevenueOverview, type RevenueAssumptions } from "../../../../api/modules/adminOps";

const useRevenueView = () => {
  const [data, setData] = useState<RevenueOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // add-expense form
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("fixed");
  const [saving, setSaving] = useState(false);

  // assumptions editor
  const [assume, setAssume] = useState<RevenueAssumptions>({ avgLifetimeMonths: 18, grossMargin: 0.7, revenueTarget: 0, newCustomersThisMonth: 0 });
  const [savingAssume, setSavingAssume] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.revenue().catch(() => null);
    if (res?.response && res.data) {
      setData(res.data);
      if (res.data.assumptions) setAssume(res.data.assumptions);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addExpense = async () => {
    if (!label.trim() || !amount.trim()) { setNotice({ kind: "err", msg: "Label and amount are required." }); return; }
    setSaving(true);
    const res = await AdminOpsService.addExpense({ label: label.trim(), amount: Number(amount) || 0, category: category.trim(), kind }).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Expense added." }); setLabel(""); setAmount(""); setCategory(""); setKind("fixed"); await load(); }
    else setNotice({ kind: "err", msg: "Could not add expense." });
  };

  const setAssumeField = (k: keyof RevenueAssumptions, val: string) => setAssume((a) => ({ ...a, [k]: Number(val) || 0 }));
  const saveAssumptions = async () => {
    setSavingAssume(true);
    const res = await AdminOpsService.setAssumptions(assume).catch(() => null);
    setSavingAssume(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Assumptions saved." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not save assumptions." });
  };

  return {
    data, loading, notice,
    label, setLabel, amount, setAmount, category, setCategory, kind, setKind, saving, addExpense,
    assume, setAssumeField, savingAssume, saveAssumptions,
  };
};

export default useRevenueView;
