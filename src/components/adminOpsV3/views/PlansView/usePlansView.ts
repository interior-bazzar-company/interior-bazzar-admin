// ── usePlansView ── Plans & Pricing logic (promptsadmin task 14 + master task 4).
// Lists the pricing catalogue (Subscription) grouped by family as cards, with an
// inline edit form (Save / Cancel / Archive|Activate), a "+ Add plan" creator, and
// a features editor. Price edits are level-3 (the backend audits them). Archive
// hides a plan from the public site but keeps it in this admin list.
// ponytail: write-gating (canWrite) is left to the shared RBAC store from task
// 56; this view relies on backend authorization + nav gating until then.
import { useEffect, useState } from "react";
import AdminOpsService, { type PlanRow, type PlanFeature, type PlanCycleInput } from "../../../../api/modules/adminOps";
import { useDialog } from "../../../../context/DialogContext";

export const cycleLabel = (n: number) =>
  n === 1 ? "1 mo" : n === 12 ? "1 yr" : `${n} mo`;

export interface PlanEditForm {
  planFamily: string; title: string; subtitle: string; amount: string;
  payableAmount: string; discountPercentage: string; duration: string;
  tag: string; badge: string; tier: string;
  features: string; // textarea — one feature per line
}

const featuresToText = (features: PlanFeature[] = []) =>
  features.map((f) => f.text).join("\n");

const textToFeatures = (text: string): PlanFeature[] =>
  text.split("\n").map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t }));

const toForm = (p: PlanRow): PlanEditForm => ({
  planFamily: p.planFamily ?? "", title: p.title ?? "", subtitle: p.subtitle ?? "",
  amount: p.amount ?? "", payableAmount: p.payableAmount ?? "",
  discountPercentage: p.discountPercentage ?? "", duration: p.duration ?? "",
  tag: p.tag ?? "", badge: p.badge ?? "", tier: p.tier != null ? String(p.tier) : "",
  features: featuresToText(p.features),
});

const emptyForm = (family: string): PlanEditForm => ({
  planFamily: family, title: "", subtitle: "", amount: "", payableAmount: "",
  discountPercentage: "", duration: "", tag: "", badge: "", tier: "",
  features: "",
});

const usePlansView = () => {
  const { showDialog } = useDialog();
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
      tag: form.tag, badge: form.badge,
      ...(form.tier.trim() !== "" && !Number.isNaN(Number(form.tier)) ? { tier: Number(form.tier) } : {}),
      features: textToFeatures(form.features),
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

  // Soft delete: hides the plan from admin + public permanently; businesses already
  // on the plan keep their subscription (FK intact) until it expires.
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deletePlan = async (p: PlanRow) => {
    const ok = await showDialog({
      title: "Delete plan",
      message: `Delete "${p.title}"? It will disappear from the site and this list. Existing subscribers keep their plan until expiry.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;
    setDeletingId(p.id);
    const res = await AdminOpsService.deletePlan(p.id).catch(() => null);
    setDeletingId(null);
    if (res?.response) {
      setNotice({ kind: "ok", msg: "Plan deleted. Existing subscribers are unaffected." });
      await load();
    } else {
      setNotice({ kind: "err", msg: res?.message || "Could not delete plan." });
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

  // ── Billing cycles ── (each handler hits the API then reloads the list)
  const [cycleBusy, setCycleBusy] = useState<number | null>(null); // cycleId in flight
  const runCycle = async (busyId: number | null, fn: () => Promise<any>, okMsg: string) => {
    setCycleBusy(busyId);
    const res = await fn().catch(() => null);
    setCycleBusy(null);
    if (res?.response) {
      setNotice({ kind: "ok", msg: okMsg });
      await load();
    } else {
      setNotice({ kind: "err", msg: res?.message || "Could not update cycle." });
    }
    return !!res?.response;
  };

  const addCycle = (planId: number, data: PlanCycleInput) =>
    runCycle(-1, () => AdminOpsService.addCycle(planId, data), "Cycle added.");
  const saveCycle = (planId: number, cycleId: number, data: Partial<PlanCycleInput>) =>
    runCycle(cycleId, () => AdminOpsService.updateCycle(planId, cycleId, data), "Cycle saved.");
  const toggleCycleActive = (planId: number, cycleId: number, isActive: boolean) =>
    runCycle(cycleId, () => AdminOpsService.updateCycle(planId, cycleId, { isActive }), "Cycle updated.");
  const removeCycle = async (planId: number, cycleId: number, label: string) => {
    const ok = await showDialog({
      title: "Remove cycle",
      message: `Remove the ${label} cycle? If it was never purchased it is deleted; otherwise it is disabled.`,
      confirmText: "Remove",
      cancelText: "Cancel",
    });
    if (!ok) return;
    await runCycle(cycleId, () => AdminOpsService.deleteCycle(planId, cycleId), "Cycle removed.");
  };

  const familyKeys = Object.keys(families);
  const rows = families[activeFamily] ?? [];

  return {
    loading, familyKeys, activeFamily, setActiveFamily, rows,
    editingId, creating, form, saving, togglingId, deletingId, notice,
    startEdit, startCreate, cancelEdit, setField, savePlan, toggleActive, deletePlan,
    cycleBusy, addCycle, saveCycle, toggleCycleActive, removeCycle,
  };
};

export default usePlansView;
