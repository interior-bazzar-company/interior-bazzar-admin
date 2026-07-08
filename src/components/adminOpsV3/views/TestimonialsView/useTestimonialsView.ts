// ── useTestimonialsView ── Testimonials logic (promptsadmin task 31).
// List + add/edit modal + toggle status + delete. Data: /api/v1/admin/testimonials/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface TestimonialRow {
  id: number; author: string; role: string; quote: string; type: string;
  featured: boolean; status: string; avatarUrl: string;
}
export interface TForm { author: string; role: string; quote: string; type: string; featured: boolean; status: string; avatarUrl: string; }
const EMPTY: TForm = { author: "", role: "", quote: "", type: "text", featured: false, status: "active", avatarUrl: "" };

const useTestimonialsView = () => {
  const [rows, setRows] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [modal, setModal] = useState<{ id: number | null; form: TForm } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.testimonials().catch(() => null);
    if (res?.response && res.data?.testimonials) setRows(res.data.testimonials);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => setModal({ id: null, form: { ...EMPTY } });
  const openEdit = (t: TestimonialRow) => setModal({ id: t.id, form: { author: t.author, role: t.role, quote: t.quote, type: t.type, featured: t.featured, status: t.status, avatarUrl: t.avatarUrl } });
  const closeModal = () => setModal(null);
  const setField = (k: keyof TForm, val: string | boolean) => setModal((m) => (m ? { ...m, form: { ...m.form, [k]: val } } : m));

  const save = async () => {
    if (!modal) return;
    if (!modal.form.author.trim() || !modal.form.quote.trim()) { setNotice({ kind: "err", msg: "Author and quote are required." }); return; }
    setSaving(true);
    const res = modal.id == null
      ? await AdminOpsService.createTestimonial(modal.form).catch(() => null)
      : await AdminOpsService.updateTestimonial(modal.id, modal.form).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Testimonial saved." }); closeModal(); await load(); }
    else setNotice({ kind: "err", msg: "Could not save testimonial." });
  };

  const confirmDelete = (id: number) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async () => {
    if (confirmId == null) return;
    const res = await AdminOpsService.deleteTestimonial(confirmId).catch(() => null);
    setConfirmId(null);
    if (res?.response) { setNotice({ kind: "ok", msg: "Deleted." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not delete." });
  };

  return { rows, loading, saving, notice, modal, confirmId, openAdd, openEdit, closeModal, setField, save, confirmDelete, cancelDelete, doDelete };
};

export default useTestimonialsView;
