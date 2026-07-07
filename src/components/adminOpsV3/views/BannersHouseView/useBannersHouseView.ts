// ── useBannersHouseView ── House Banners logic (promptsadmin task 15).
// List + reorder (move up/down) + toggle active + add/edit via modal + delete
// via a custom confirm (never native confirm()). Data: /admin/banners-house/.
import { useEffect, useState } from "react";
import AdminOpsService, { type BannerRow } from "../../../../api/modules/adminOps";

export interface BannerForm { title: string; supportText: string; bannerUrl: string; isActive: boolean; }

const EMPTY: BannerForm = { title: "", supportText: "", bannerUrl: "", isActive: false };

const useBannersHouseView = () => {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  // modal: null closed; {id:null} add; {id:number} edit
  const [modal, setModal] = useState<{ id: number | null; form: BannerForm } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.bannersHouse().catch(() => null);
    if (res?.response && res.data?.banners) setBanners(res.data.banners);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => setModal({ id: null, form: { ...EMPTY } });
  const openEdit = (b: BannerRow) =>
    setModal({ id: b.id, form: { title: b.title, supportText: b.supportText, bannerUrl: b.bannerUrl, isActive: b.isActive } });
  const closeModal = () => setModal(null);
  const setField = (k: keyof BannerForm, val: string | boolean) =>
    setModal((m) => (m ? { ...m, form: { ...m.form, [k]: val } } : m));

  const save = async () => {
    if (!modal) return;
    if (!modal.form.title.trim()) { setNotice({ kind: "err", msg: "Title is required." }); return; }
    setSaving(true);
    const res = modal.id == null
      ? await AdminOpsService.createBanner(modal.form).catch(() => null)
      : await AdminOpsService.updateBanner(modal.id, modal.form).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Banner saved." }); closeModal(); await load(); }
    else setNotice({ kind: "err", msg: res?.message || "Could not save banner." });
  };

  const toggle = async (b: BannerRow) => {
    const res = await AdminOpsService.updateBanner(b.id, { isActive: !b.isActive }).catch(() => null);
    if (res?.response) await load();
    else setNotice({ kind: "err", msg: "Could not toggle banner." });
  };

  const move = async (b: BannerRow, direction: "up" | "down") => {
    const res = await AdminOpsService.moveBanner(b.id, direction).catch(() => null);
    if (res?.response && res.data?.banners) setBanners(res.data.banners);
  };

  const confirmDelete = (id: number) => setConfirmId(id);
  const cancelDelete = () => setConfirmId(null);
  const doDelete = async () => {
    if (confirmId == null) return;
    const res = await AdminOpsService.deleteBanner(confirmId).catch(() => null);
    setConfirmId(null);
    if (res?.response) { setNotice({ kind: "ok", msg: "Banner deleted." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not delete banner." });
  };

  return {
    banners, loading, saving, notice, modal, confirmId,
    openAdd, openEdit, closeModal, setField, save, toggle, move,
    confirmDelete, cancelDelete, doDelete,
  };
};

export default useBannersHouseView;
