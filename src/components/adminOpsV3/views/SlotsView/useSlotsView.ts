// ── useSlotsView ── Slot Inventory logic (promptsadmin task 21).
// Reads the slot-inventory grid (category × region) from /api/v1/admin/slots/
// and overrides a cell's capacity/priority/holder. Overrides are LEVEL-3 — the
// backend audits every SlotsController.Override call.
// ponytail: the prototype's tier/family/expiring fields don't exist on the real
// SlotInventory model, so this view renders the backend shape (holder+capacity+
// priority), never the seed fiction. Write-gating (canWrite) is deferred to the
// shared RBAC store (task 56); relies on backend authz + nav gating until then.
import { useEffect, useMemo, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface SlotRow {
  id: number;
  category: string;
  region: string;
  capacity: number;
  priority: number;
  holderId: number | null;
  holder: string | null;
}

export interface SlotOverrideForm {
  capacity: string;
  priority: string;
  holderId: string; // "" clears holder
}

const key = (cat: string, reg: string) => `${cat}||${reg}`;

const useSlotsView = () => {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SlotOverrideForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.slots().catch(() => null);
    if (res?.response && Array.isArray(res.data?.slots)) setSlots(res.data.slots);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Grid axes + O(1) cell lookup, derived from the data (backend is source of truth).
  const { categories, regions, cellMap } = useMemo(() => {
    const cats: string[] = [];
    const regs: string[] = [];
    const map = new Map<string, SlotRow>();
    for (const s of slots) {
      if (!cats.includes(s.category)) cats.push(s.category);
      if (!regs.includes(s.region)) regs.push(s.region);
      map.set(key(s.category, s.region), s);
    }
    cats.sort();
    regs.sort();
    return { categories: cats, regions: regs, cellMap: map };
  }, [slots]);

  const cellFor = (cat: string, reg: string) => cellMap.get(key(cat, reg)) ?? null;

  const total = slots.length;
  const held = slots.filter((s) => s.holderId != null).length;
  const free = total - held;
  const utilPct = total ? Math.round((held / total) * 100) : 0;

  const startEdit = (s: SlotRow) => {
    setEditingId(s.id);
    setForm({
      capacity: String(s.capacity ?? 0),
      priority: String(s.priority ?? 0),
      holderId: s.holderId != null ? String(s.holderId) : "",
    });
    setNotice(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
  };
  const setField = (k: keyof SlotOverrideForm, val: string) =>
    setForm((f) => (f ? { ...f, [k]: val } : f));

  const saveOverride = async () => {
    if (editingId == null || !form) return;
    const capacity = form.capacity.trim() === "" ? undefined : Number(form.capacity);
    const priority = form.priority.trim() === "" ? undefined : Number(form.priority);
    const holderId = form.holderId.trim() === "" ? 0 : Number(form.holderId);
    if ([capacity, priority, holderId].some((n) => n !== undefined && Number.isNaN(n))) {
      setNotice({ kind: "err", msg: "Capacity, priority and holder ID must be numbers." });
      return;
    }
    setSaving(true);
    const res = await AdminOpsService.overrideSlot(editingId, { capacity, priority, holderId }).catch(() => null);
    setSaving(false);
    if (res?.response) {
      setNotice({ kind: "ok", msg: "Slot override saved (audited)." });
      cancelEdit();
      await load();
    } else {
      setNotice({ kind: "err", msg: res?.message || "Could not save override." });
    }
  };

  const editingSlot = editingId != null ? slots.find((s) => s.id === editingId) ?? null : null;

  return {
    loading, notice,
    categories, regions, cellFor,
    total, held, free, utilPct,
    editingId, editingSlot, form, saving,
    startEdit, cancelEdit, setField, saveOverride,
  };
};

export default useSlotsView;
