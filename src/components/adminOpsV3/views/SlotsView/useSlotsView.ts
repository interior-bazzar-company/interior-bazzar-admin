// ── useSlotsView ── Slot Inventory logic (promptsadmin task 21).
// Category × region grid with per-cell override (capacity/priority). Overrides
// are level-3 (backend audits). Data: /api/v1/admin/slots/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface SlotRow {
  id: number; category: string; region: string; capacity: number;
  priority: number; holderId: number | null; holder: string | null;
}

const useSlotsView = () => {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [capacity, setCapacity] = useState("");
  const [priority, setPriority] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.slots().catch(() => null);
    if (res?.response && res.data?.slots) setSlots(res.data.slots);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startEdit = (s: SlotRow) => {
    setEditingId(s.id);
    setCapacity(String(s.capacity));
    setPriority(String(s.priority));
    setNotice(null);
  };
  const cancel = () => setEditingId(null);

  const save = async (s: SlotRow) => {
    setSaving(true);
    const res = await AdminOpsService.overrideSlot(s.id, {
      capacity: Number(capacity) || 0,
      priority: Number(priority) || 0,
    }).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Slot updated." }); setEditingId(null); await load(); }
    else setNotice({ kind: "err", msg: "Could not update slot." });
  };

  return { slots, loading, notice, editingId, capacity, setCapacity, priority, setPriority, saving, startEdit, cancel, save };
};

export default useSlotsView;
