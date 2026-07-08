// ── useTestimonialsView ── Testimonials logic (task 31 + master task 20).
// Ordered list (index) + add/edit modal (video/rating/business) + reorder + delete.
// Data: /api/v1/admin/testimonials/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface TestimonialRow {
  id: number; author: string; role: string; quote: string; type: string;
  featured: boolean; status: string; avatarUrl: string;
  index: number; videoUrl: string; rating: number | null; businessName: string;
}
export interface TForm {
  author: string; role: string; quote: string; type: string; featured: boolean;
  status: string; avatarUrl: string; videoUrl: string; rating: string; businessName: string;
}
const EMPTY: TForm = { author: "", role: "", quote: "", type: "text", featured: false, status: "active", avatarUrl: "", videoUrl: "", rating: "", businessName: "" };

// Parse a YouTube id from watch/embed/short links → hqdefault thumbnail.
export const ytId = (url: string) => {
  const m = (url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : "";
};
export const ytThumb = (url: string) => { const id = ytId(url); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ""; };

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
  const openEdit = (t: TestimonialRow) => setModal({ id: t.id, form: {
    author: t.author, role: t.role, quote: t.quote, type: t.type, featured: t.featured,
    status: t.status, avatarUrl: t.avatarUrl, videoUrl: t.videoUrl,
    rating: t.rating == null ? "" : String(t.rating), businessName: t.businessName,
  } });
  const closeModal = () => setModal(null);
  const setField = (k: keyof TForm, val: string | boolean) => setModal((m) => (m ? { ...m, form: { ...m.form, [k]: val } } : m));

  const save = async () => {
    if (!modal) return;
    if (!modal.form.author.trim() || !modal.form.quote.trim()) { setNotice({ kind: "err", msg: "Author and quote are required." }); return; }
    const payload = {
      ...modal.form,
      rating: modal.form.rating.trim() === "" ? null : Number(modal.form.rating),
    };
    setSaving(true);
    const res = modal.id == null
      ? await AdminOpsService.createTestimonial(payload).catch(() => null)
      : await AdminOpsService.updateTestimonial(modal.id, payload).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Testimonial saved." }); closeModal(); await load(); }
    else setNotice({ kind: "err", msg: "Could not save testimonial." });
  };

  const reorder = async (id: number, index: number) => {
    if (!index || index < 1) return;
    const res = await AdminOpsService.reorderTestimonial(id, index).catch(() => null);
    if (res?.response) await load();
    else setNotice({ kind: "err", msg: "Could not reorder." });
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

  return { rows, loading, saving, notice, modal, confirmId, openAdd, openEdit, closeModal, setField, save, reorder, confirmDelete, cancelDelete, doDelete };
};

export default useTestimonialsView;
