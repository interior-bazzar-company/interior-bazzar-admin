// ── usePlansView ── Plans & Pricing logic (promptsadmin task 14 + master task 4).
// Lists the pricing catalogue (Subscription) grouped by family as cards, with an
// inline edit form (Save / Cancel / Archive|Activate), a "+ Add plan" creator, and
// a features editor. Price edits are level-3 (the backend audits them). Archive
// hides a plan from the public site but keeps it in this admin list.
// ponytail: write-gating (canWrite) is left to the shared RBAC store from task
// 56; this view relies on backend authorization + nav gating until then.
import { useEffect, useState } from "react";
import AdminOpsService, { type PlanRow, type PlanFeature } from "../../../../api/modules/adminOps";

export interface PlanEditForm {
  planFamily: string; title: string; subtitle: string; amount: string;
  payableAmount: string; discountPercentage: string; duration: string;
  tag: string; features: string; // textarea — one feature per line
}

const featuresToText = (features: PlanFeature[] = []) =>
  features.map((f) => f.text).join("\n");

const textToFeatures = (text: string): PlanFeature[] =>
  text.split("\n").map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t }));

const toForm = (p: PlanRow): PlanEditForm => ({
  planFamily: p.planFamily ?? "", title: p.title ?? "", subtitle: p.subtitle ?? "",
  amount: p.amount ?? "", payableAmount: p.payableAmount ?? "",
  discountPercentage: p.discountPercentage ?? "", duration: p.duration ?? "",
  tag: p.tag ?? "", features: featuresToText(p.features),
});

const emptyForm = (family: string): PlanEditForm => ({
  planFamily: family, title: "", subtitle: "", amount: "", payableAmount: "",
  discountPercentage: "", duration: "", tag: "", features: "",
});

const usePlansView = () => {
  const [families, setFamilies] = useState<Record<string, PlanRow[]>>({});
  const [activeFamily, setActiveFamily] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PlanEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
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
    setCreating(false);
    setEditingId(p.id);
    setForm(toForm(p));
    setNotice(null);
  };
  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setForm(emptyForm(activeFamily));
    setNotice(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
    setForm(null);
  };
  const setField = (k: keyof PlanEditForm, val: string) =>
    setForm((f) => (f ? { ...f, [k]: val } : f));

  const savePlan = async () => {
    if (!form) return;
    if (!form.title.trim() || !form.amount.trim()) {
      setNotice({ kind: "err", msg: "Title and amount are required." });
      return;
    }
    if (creating && !form.planFamily.trim()) {
      setNotice({ kind: "err", msg: "Family is required for a new plan." });
      return;
    }
    const payload = {
      planFamily: form.planFamily.trim(), title: form.title, subtitle: form.subtitle,
      amount: form.amount, payableAmount: form.payableAmount,
      discountPercentage: form.discountPercentage, duration: form.duration,
      tag: form.tag, features: textToFeatures(form.features),
    };
    setSaving(true);
    const res = await (creating
      ? AdminOpsService.addPlan(payload)
      : AdminOpsService.updatePlan(editingId as number, payload)
    ).catch(() => null);
    setSaving(false);
    if (res?.response) {
      setActiveFamily(payload.planFamily || activeFamily);
      setNotice({ kind: "ok", msg: creating ? "Plan created." : "Plan saved." });
      cancelEdit();
      await load();
    } else {
      setNotice({ kind: "err", msg: res?.message || "Could not save plan." });
    }
  };

  // Archive (isActive→false) hides from the public site; toggling back activates.
  const toggleActive = async (p: PlanRow) => {
    setTogglingId(p.id);
    const res = await AdminOpsService.setPlanActive(p.id, !p.isActive).catch(() => null);
    setTogglingId(null);
    if (res?.response) {
      setNotice({ kind: "ok", msg: p.isActive ? "Plan archived — hidden from the site." : "Plan activated." });
      await load();
    } else {
      setNotice({ kind: "err", msg: res?.message || "Could not update plan." });
    }
  };

  const familyKeys = Object.keys(families);
  const rows = families[activeFamily] ?? [];

  return {
    loading, familyKeys, activeFamily, setActiveFamily, rows,
    editingId, creating, form, saving, togglingId, notice,
    startEdit, startCreate, cancelEdit, setField, savePlan, toggleActive,
  };
};

export default usePlansView;
