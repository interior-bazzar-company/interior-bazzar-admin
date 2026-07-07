// ── usePlansView ── Plans & Pricing logic (promptsadmin task 14).
// Lists the pricing catalogue (Subscription) grouped by family, with an inline
// price-edit form. Price edits are level-3 (the backend audits them).
// ponytail: write-gating (canWrite) is left to the shared RBAC store from task
// 56; this view relies on backend authorization + nav gating until then.
import { useEffect, useState } from "react";
import AdminOpsService, { type PlanRow } from "../../../../api/modules/adminOps";

export interface PlanEditForm {
  title: string; subtitle: string; amount: string; payableAmount: string;
  discountPercentage: string; duration: string; tag: string;
}

const toForm = (p: PlanRow): PlanEditForm => ({
  title: p.title ?? "", subtitle: p.subtitle ?? "", amount: p.amount ?? "",
  payableAmount: p.payableAmount ?? "", discountPercentage: p.discountPercentage ?? "",
  duration: p.duration ?? "", tag: p.tag ?? "",
});

const usePlansView = () => {
  const [families, setFamilies] = useState<Record<string, PlanRow[]>>({});
  const [activeFamily, setActiveFamily] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PlanEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.plans().catch(() => null);
    if (res?.response && res.data?.families) {
      setFamilies(res.data.families);
      setActiveFamily((prev) => prev || Object.keys(res.data.families)[0] || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (p: PlanRow) => {
    setEditingId(p.id);
    setForm(toForm(p));
    setNotice(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };
  const setField = (k: keyof PlanEditForm, val: string) =>
    setForm((f) => (f ? { ...f, [k]: val } : f));

  const savePlan = async () => {
    if (editingId == null || !form) return;
    if (!form.title.trim() || !form.amount.trim()) {
      setNotice({ kind: "err", msg: "Title and amount are required." });
      return;
    }
    setSaving(true);
    const res = await AdminOpsService.updatePlan(editingId, form).catch(() => null);
    setSaving(false);
    if (res?.response) {
      setNotice({ kind: "ok", msg: "Plan saved." });
      cancelEdit();
      await load();
    } else {
      setNotice({ kind: "err", msg: res?.message || "Could not save plan." });
    }
  };

  const familyKeys = Object.keys(families);
  const rows = families[activeFamily] ?? [];

  return {
    loading, familyKeys, activeFamily, setActiveFamily, rows,
    editingId, form, saving, notice, startEdit, cancelEdit, setField, savePlan,
  };
};

export default usePlansView;
