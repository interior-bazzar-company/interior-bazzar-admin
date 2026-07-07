// ── useTemplatesView ── Notification Templates logic (promptsadmin task 17).
// List + add/edit via modal (saveTmpl/editTmpl) + delete. Reuses the task-48
// CRUD endpoint /api/v1/admin/templates/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface TemplateRow {
  id: number; key: string; channel: string; subject: string; body: string;
  variables: string[]; active: boolean;
}
export interface TemplateForm {
  key: string; channel: string; subject: string; body: string; variables: string; active: boolean;
}
const EMPTY: TemplateForm = { key: "", channel: "email", subject: "", body: "", variables: "", active: true };

const useTemplatesView = () => {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [modal, setModal] = useState<{ id: number | null; form: TemplateForm } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.templates().catch(() => null);
    if (res?.response && res.data?.templates) setRows(res.data.templates);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => setModal({ id: null, form: { ...EMPTY } });
  const openEdit = (t: TemplateRow) => setModal({
    id: t.id,
    form: { key: t.key, channel: t.channel, subject: t.subject, body: t.body, variables: (t.variables || []).join(", "), active: t.active },
  });
  const closeModal = () => setModal(null);
  const setField = (k: keyof TemplateForm, val: string | boolean) =>
    setModal((m) => (m ? { ...m, form: { ...m.form, [k]: val } } : m));

  const save = async () => {
    if (!modal) return;
    if (!modal.form.key.trim()) { setNotice({ kind: "err", msg: "Key is required." }); return; }
    setSaving(true);
    const payload = {
      key: modal.form.key.trim(), channel: modal.form.channel, subject: modal.form.subject,
      body: modal.form.body, active: modal.form.active,
      variables: modal.form.variables.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const res = modal.id == null
      ? await AdminOpsService.createTemplate(payload).catch(() => null)
      : await AdminOpsService.updateTemplate(modal.id, payload).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Template saved." }); closeModal(); await load(); }
    else setNotice({ kind: "err", msg: res?.message || "Could not save template." });
  };

  const confirmDelete = (id: number) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async () => {
    if (confirmId == null) return;
    const res = await AdminOpsService.deleteTemplate(confirmId).catch(() => null);
    setConfirmId(null);
    if (res?.response) { setNotice({ kind: "ok", msg: "Template deleted." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not delete template." });
  };

  return { rows, loading, saving, notice, modal, confirmId, openAdd, openEdit, closeModal, setField, save, confirmDelete, cancelDelete, doDelete };
};

export default useTemplatesView;
