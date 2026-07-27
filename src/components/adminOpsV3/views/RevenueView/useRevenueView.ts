// ── useRevenueView ── Revenue & Unit Economics logic (task 28 + master task 17).
// Real aggregates (MRR/ARPU/family/monthly) + P&L split + tunable assumption
// inputs so LTV/CAC/payback are transparent, not invented. Data: /admin/revenue/.
import { useEffect, useState } from "react";
import AdminOpsService, { type RevenueOverview, type RevenueAssumptions } from "../../../../api/modules/adminOps";

const useRevenueView = () => {
  const [data, setData] = useState<RevenueOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // date range — gross/family/expenses only (MRR/ARPU + 6-month trend stay all-time)
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

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
    const res = await AdminOpsService.revenue({ start: start || undefined, end: end || undefined }).catch(() => null);
    if (res?.response && res.data) {
      const d = res.data;
      // Zero-fill every field so a partial/empty payload can never crash the render.
      setData({
        grossRevenue: d.grossRevenue ?? 0, refunded: d.refunded ?? 0, netRevenue: d.netRevenue ?? 0,
        mrr: d.mrr ?? 0, arpu: d.arpu ?? 0, activeSubscribers: d.activeSubscribers ?? 0,
        cac: d.cac ?? 0, payingCustomers: d.payingCustomers ?? 0,
        salesThisMonth: d.salesThisMonth ?? 0, momDeltaPct: d.momDeltaPct ?? 0,
        revenueByFamily: d.revenueByFamily ?? [], monthlyRevenue: d.monthlyRevenue ?? [],
        expensesTotal: d.expensesTotal ?? 0, expensesFixed: d.expensesFixed ?? 0,
        expensesReinvest: d.expensesReinvest ?? 0, net: d.net ?? 0,
        ltv: d.ltv ?? 0, ltvCac: d.ltvCac ?? 0, paybackMonths: d.paybackMonths ?? 0,
        assumptions: d.assumptions ?? { avgLifetimeMonths: 18, grossMargin: 0.7, revenueTarget: 0, newCustomersThisMonth: 0 },
        expenses: d.expenses ?? [],
      });
      setError(false);
      if (d.assumptions) setAssume(d.assumptions);
    } else {
      setError(true);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

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
    data, loading, error, notice,
    start, setStart, end, setEnd,
    label, setLabel, amount, setAmount, category, setCategory, kind, setKind, saving, addExpense,
    assume, setAssumeField, savingAssume, saveAssumptions,
  };
};

export default useRevenueView;
