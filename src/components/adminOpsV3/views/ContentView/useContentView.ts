// ── useContentView ── admin Blog / SEO logic (task 25). List + full editor
// (WYSIWYG body, cover upload, SEO panel, draft/publish). Data: /api/v1/admin/content/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";
import { useImageUploader } from "../../../../hooks/upload/useImageUploader";

export interface BlogRow {
  id: number; title: string; slug: string; author: string;
  coverImageUrl: string; authorImageUrl: string; isFeatured: boolean;
  featuredOrder: number; status: string; body: string;
  metaTitle: string; metaDescription: string; focusKeyword: string;
  createdAt: string; updatedAt: string;
}
export interface BlogForm {
  title: string; slug: string; author: string; authorImageUrl: string;
  coverImageUrl: string; body: string; metaTitle: string;
  metaDescription: string; focusKeyword: string; status: string;
  isFeatured: boolean;
}
const EMPTY: BlogForm = {
  title: "", slug: "", author: "", authorImageUrl: "", coverImageUrl: "",
  body: "", metaTitle: "", metaDescription: "", focusKeyword: "",
  status: "draft", isFeatured: false,
};

const useContentView = () => {
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [editor, setEditor] = useState<{ id: number | null; form: BlogForm } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const { uploadImage, isImageUploading } = useImageUploader({ forPurpose: "blog" });

  const load = () => {
    setLoading(true);
    AdminOpsService.content()
      .then((r) => { if (r?.response) setRows(r.data.blogs || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => setEditor({ id: null, form: { ...EMPTY } });
  const openEdit = (b: BlogRow) => setEditor({ id: b.id, form: {
    title: b.title, slug: b.slug || "", author: b.author || "",
    authorImageUrl: b.authorImageUrl || "", coverImageUrl: b.coverImageUrl || "",
    body: b.body || "", metaTitle: b.metaTitle || "",
    metaDescription: b.metaDescription || "", focusKeyword: b.focusKeyword || "",
    status: b.status || "draft", isFeatured: b.isFeatured,
  } });
  const closeEditor = () => setEditor(null);
  const setField = (k: keyof BlogForm, val: string | boolean) =>
    setEditor((e) => (e ? { ...e, form: { ...e.form, [k]: val } } : e));

  const onPickCover = async (file: File | null) => {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setField("coverImageUrl", url);
  };
  const onPickAuthorImage = async (file: File | null) => {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setField("authorImageUrl", url);
  };

  const feature = async (id: number) => {
    const r = await AdminOpsService.toggleBlogFeatured(id).catch(() => null);
    if (r?.response) load();
  };

  const save = async () => {
    if (!editor) return;
    if (!editor.form.title.trim()) { setNotice({ kind: "err", msg: "Title is required." }); return; }
    setSaving(true);
    const res = editor.id == null
      ? await AdminOpsService.createBlog(editor.form).catch(() => null)
      : await AdminOpsService.updateBlog(editor.id, editor.form).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Post saved." }); closeEditor(); load(); }
    else setNotice({ kind: "err", msg: "Could not save post." });
  };

  const confirmDelete = (id: number) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async () => {
    if (confirmId == null) return;
    const res = await AdminOpsService.deleteBlog(confirmId).catch(() => null);
    setConfirmId(null);
    if (res?.response) { setNotice({ kind: "ok", msg: "Deleted." }); load(); }
    else setNotice({ kind: "err", msg: "Could not delete." });
  };

  return {
    rows, loading, saving, notice, editor, confirmId, isImageUploading,
    openNew, openEdit, closeEditor, setField, onPickCover, onPickAuthorImage,
    feature, save, confirmDelete, cancelDelete, doDelete,
  };
};

export default useContentView;
