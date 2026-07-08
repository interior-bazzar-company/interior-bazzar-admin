// ── useBrandLogoView ── Brand Logo (task 27): default logo/favicon/tagline +
// seasonal SCHEDULED logos with date windows. The public site resolves today's
// active one server-side. Data: /api/v1/admin/brand-logo/ (+ /logos/).
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";
import { useImageUploader } from "../../../../hooks/upload/useImageUploader";

export interface LogoRow {
  id: number; label: string; imageUrl: string; tagline: string;
  activeFrom: string; activeTo: string; createdAt: string;
}
export interface LForm { label: string; imageUrl: string; tagline: string; activeFrom: string; activeTo: string; }
const EMPTY: LForm = { label: "", imageUrl: "", tagline: "", activeFrom: "", activeTo: "" };

export type LogoStatus = "live" | "scheduled" | "ended";
// Per-row window status vs today (local ISO date). "live" = today is within the
// window; open-ended sides count as unbounded. Note: the actually-served logo is
// picked by the backend resolver (shown separately in the banner).
export const statusOf = (r: { activeFrom: string; activeTo: string }): LogoStatus => {
  const today = new Date().toISOString().slice(0, 10);
  if (r.activeTo && r.activeTo < today) return "ended";
  if (r.activeFrom && r.activeFrom > today) return "scheduled";
  return "live";
};

const useBrandLogoView = () => {
  // defaults card
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);
  // scheduled logos
  const [rows, setRows] = useState<LogoRow[]>([]);
  const [active, setActive] = useState<{ logoUrl: string; tagline: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [drawer, setDrawer] = useState<{ id: number | null; form: LForm } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const { uploadImage, isImageUploading } = useImageUploader({ forPurpose: "brand" });

  const load = async () => {
    setLoading(true);
    const [d, l] = await Promise.all([
      AdminOpsService.brandLogo().catch(() => null),
      AdminOpsService.listLogos().catch(() => null),
    ]);
    if (d?.response && d.data) { setLogoUrl(d.data.logoUrl || ""); setFaviconUrl(d.data.faviconUrl || ""); setTagline(d.data.tagline || ""); }
    if (l?.response && l.data) { setRows(l.data.logos || []); setActive(l.data.active || null); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveDefaults = async () => {
    setSavingDefaults(true);
    const res = await AdminOpsService.setBrandLogo({ logoUrl, faviconUrl, tagline }).catch(() => null);
    setSavingDefaults(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Default brand assets saved." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not save brand assets." });
  };

  const openAdd = () => setDrawer({ id: null, form: { ...EMPTY } });
  const openEdit = (r: LogoRow) => setDrawer({ id: r.id, form: {
    label: r.label, imageUrl: r.imageUrl, tagline: r.tagline, activeFrom: r.activeFrom, activeTo: r.activeTo,
  } });
  const closeDrawer = () => setDrawer(null);
  const setField = (k: keyof LForm, val: string) => setDrawer((m) => (m ? { ...m, form: { ...m.form, [k]: val } } : m));

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setField("imageUrl", url);
  };

  const save = async () => {
    if (!drawer) return;
    if (!drawer.form.imageUrl.trim()) { setNotice({ kind: "err", msg: "A logo image is required." }); return; }
    if (drawer.form.activeFrom && drawer.form.activeTo && drawer.form.activeTo < drawer.form.activeFrom) {
      setNotice({ kind: "err", msg: '"Active to" must be on or after "Active from".' }); return;
    }
    setSaving(true);
    const res = drawer.id == null
      ? await AdminOpsService.createLogo(drawer.form).catch(() => null)
      : await AdminOpsService.updateLogo(drawer.id, drawer.form).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Scheduled logo saved." }); closeDrawer(); await load(); }
    else setNotice({ kind: "err", msg: "Could not save logo." });
  };

  const confirmDelete = (id: number) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async () => {
    if (confirmId == null) return;
    const res = await AdminOpsService.deleteLogo(confirmId).catch(() => null);
    setConfirmId(null);
    if (res?.response) { setNotice({ kind: "ok", msg: "Deleted." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not delete." });
  };

  return {
    logoUrl, setLogoUrl, faviconUrl, setFaviconUrl, tagline, setTagline, savingDefaults, saveDefaults,
    rows, active, loading, saving, notice, drawer, confirmId, isImageUploading,
    openAdd, openEdit, closeDrawer, setField, onPickImage, save, confirmDelete, cancelDelete, doDelete,
  };
};

export default useBrandLogoView;
