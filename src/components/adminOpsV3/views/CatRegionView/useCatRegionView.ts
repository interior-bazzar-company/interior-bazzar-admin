// ── useCatRegionView ── Categories & Regions taxonomy CRUD (task 32 + master 22).
// Categories (edit/hide/delete), sub-categories/segments (nested under categories),
// and states — all feeding the public browse dropdowns. Data: /admin/taxonomy/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface Cat { id: number; value: string; label: string; trending: boolean; index: number; isActive: boolean; }
export interface Seg { id: number; value: string; label: string; trending: boolean; isActive: boolean; categoryIds: number[]; }
export interface St { id: number; name: string; value: string | null; countryId: number | null; }

const useCatRegionView = () => {
  const [cats, setCats] = useState<Cat[]>([]);
  const [segs, setSegs] = useState<Seg[]>([]);
  const [states, setStates] = useState<St[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // add forms
  const [cForm, setCForm] = useState({ value: "", label: "" });
  const [sForm, setSForm] = useState<{ value: string; label: string; categoryIds: number[] }>({ value: "", label: "", categoryIds: [] });
  const [stForm, setStForm] = useState({ name: "", value: "" });

  const load = async () => {
    setLoading(true);
    const r = await AdminOpsService.taxonomy().catch(() => null);
    if (r?.response) { setCats(r.data.categories || []); setSegs(r.data.segments || []); setStates(r.data.states || []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ok = (msg: string) => setNotice({ kind: "ok", msg });
  const err = (msg: string) => setNotice({ kind: "err", msg });
  type ActionResult = { response?: boolean; message?: string } | null;
  const after = async (rp: ActionResult | Promise<ActionResult>, okMsg: string) => {
    const r = await rp;
    if (r?.response) { ok(okMsg); await load(); return true; }
    err(r?.message || "Action failed."); return false;
  };

  // categories
  const addCategory = async () => {
    if (!cForm.value.trim() || !cForm.label.trim()) return err("Value and label are required.");
    if (await after(await AdminOpsService.addCategory(cForm.value.trim(), cForm.label.trim()).catch(() => null), "Category added.")) setCForm({ value: "", label: "" });
  };
  const editCategory = (c: Cat, data: Partial<Cat>) => after(AdminOpsService.updateCategory(c.id, data).then((r) => r as any).catch(() => null), "Category updated.");
  const toggleCategory = (c: Cat) => after(AdminOpsService.updateCategory(c.id, { isActive: !c.isActive }).then((r) => r as any).catch(() => null), c.isActive ? "Category hidden." : "Category shown.");
  const deleteCategory = (c: Cat) => after(AdminOpsService.deleteCategory(c.id).then((r) => r as any).catch(() => null), "Category hidden.");

  // segments
  const addSegment = async () => {
    if (!sForm.value.trim() || !sForm.label.trim()) return err("Value and label are required.");
    if (await after(await AdminOpsService.addSegment({ value: sForm.value.trim(), label: sForm.label.trim(), categoryIds: sForm.categoryIds }).catch(() => null), "Sub-category added.")) setSForm({ value: "", label: "", categoryIds: [] });
  };
  const editSegment = (s: Seg, data: Partial<Seg>) => after(AdminOpsService.updateSegment(s.id, data).then((r) => r as any).catch(() => null), "Sub-category updated.");
  const toggleSegment = (s: Seg) => after(AdminOpsService.updateSegment(s.id, { isActive: !s.isActive }).then((r) => r as any).catch(() => null), s.isActive ? "Sub-category hidden." : "Sub-category shown.");
  const deleteSegment = (s: Seg) => after(AdminOpsService.deleteSegment(s.id).then((r) => r as any).catch(() => null), "Sub-category hidden.");

  // states
  const addState = async () => {
    if (!stForm.name.trim()) return err("Name is required.");
    if (await after(await AdminOpsService.addState({ name: stForm.name.trim(), value: stForm.value.trim() || undefined }).catch(() => null), "State added.")) setStForm({ name: "", value: "" });
  };
  const editState = (s: St, data: { name?: string; value?: string }) => after(AdminOpsService.updateState(s.id, data).then((r) => r as any).catch(() => null), "State updated.");
  const deleteState = (s: St) => after(AdminOpsService.deleteState(s.id).then((r) => r as any).catch(() => null), "State deleted.");

  const catName = (id: number) => cats.find((c) => c.id === id)?.label || `#${id}`;

  return {
    cats, segs, states, loading, notice, catName,
    cForm, setCForm, sForm, setSForm, stForm, setStForm,
    addCategory, editCategory, toggleCategory, deleteCategory,
    addSegment, editSegment, toggleSegment, deleteSegment,
    addState, editState, deleteState,
  };
};

export default useCatRegionView;
