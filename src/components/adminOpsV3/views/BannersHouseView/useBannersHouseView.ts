// ── useBannersHouseView ── House Banners logic, rewired to the REAL hero model
// (HomeHeroBanner). Two screens: list ⇄ editor. List: reorder / toggle / delete.
// Editor: full slide (tag/title/description, theme+image bg, up-to-2 businesses,
// buttons & metrics repeaters, audience, schedule) with a live hero preview.
import { useEffect, useMemo, useState } from "react";
import AdminOpsService, {
  type BannerRow, type BannerInput, type BannerButton, type BannerMetric,
  type BannerBusinessRef, type BannerAudience,
} from "../../../../api/modules/adminOps";
import { useImageUploader } from "../../../../hooks/upload/useImageUploader";

// Theme colour keys the frontend hero understands (backgroundGradient can be a
// key OR a raw CSS gradient string; the swatches pick a key).
export const THEME_SWATCHES: { key: string; label: string; css: string }[] = [
  { key: "green", label: "Green", css: "linear-gradient(135deg,#085041,#0b6b57)" },
  { key: "amber", label: "Amber", css: "linear-gradient(135deg,#7a4d12,#ba7517)" },
  { key: "navy", label: "Navy", css: "linear-gradient(135deg,#14233f,#28406e)" },
  { key: "plum", label: "Plum", css: "linear-gradient(135deg,#3a1233,#6e2860)" },
];
export const themeCss = (gradient: string) =>
  THEME_SWATCHES.find((t) => t.key === gradient)?.css || gradient ||
  "linear-gradient(135deg,#085041,#0b6b57)";

export const PAGE_OPTIONS = [
  "home", "architects", "shops", "products", "businesses",
  "catalogues", "about", "blog", "explore", "contact",
];
export const AUDIENCE_OPTIONS: { value: BannerAudience; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "buyers", label: "Signed-in buyers" },
  { value: "sellers", label: "Business owners" },
];

export interface BannerForm {
  page: string; tag: string; title: string; description: string;
  audience: BannerAudience; isActive: boolean;
  backgroundGradient: string; backgroundImageUrl: string;
  startsAt: string; endsAt: string;               // datetime-local strings ("" = none)
  buttons: BannerButton[]; metrics: BannerMetric[];
  businesses: BannerBusinessRef[];                // picker + preview; mapped to businessIds on save
}

const EMPTY: BannerForm = {
  page: "home", tag: "", title: "", description: "", audience: "all", isActive: true,
  backgroundGradient: "green", backgroundImageUrl: "", startsAt: "", endsAt: "",
  buttons: [], metrics: [{ metric: "", description: "", index: 0 }], businesses: [],
};

// Derive a status pill from isActive + the schedule window.
export const bannerStatus = (b: BannerRow): "Live" | "Scheduled" | "Expired" | "Paused" => {
  if (!b.isActive) return "Paused";
  const now = Date.now();
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return "Scheduled";
  if (b.endsAt && new Date(b.endsAt).getTime() < now) return "Expired";
  return "Live";
};

// "2026-07-08T22:58:00Z" → "2026-07-08T22:58" (datetime-local); "" ↔ null.
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const useBannersHouseView = () => {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [screen, setScreen] = useState<"list" | "editor">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const { uploadImage, isImageUploading } = useImageUploader({ forPurpose: "banner" });

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.bannersHouse().catch(() => null);
    if (res?.response && res.data?.banners) setBanners(res.data.banners);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const liveCount = useMemo(() => banners.filter((b) => bannerStatus(b) === "Live").length, [banners]);

  // ── screen nav ──
  const openNew = () => { setEditId(null); setForm({ ...EMPTY, businesses: [], buttons: [], metrics: [{ metric: "", description: "", index: 0 }] }); setScreen("editor"); };
  const openEdit = (b: BannerRow) => {
    setEditId(b.id);
    setForm({
      page: b.page, tag: b.tag, title: b.title, description: b.description,
      audience: b.audience, isActive: b.isActive,
      backgroundGradient: b.backgroundGradient, backgroundImageUrl: b.backgroundImageUrl,
      startsAt: toLocalInput(b.startsAt), endsAt: toLocalInput(b.endsAt),
      buttons: b.buttons.map((x) => ({ ...x })),
      metrics: b.metrics.map((m) => ({ ...m })),
      businesses: b.businesses.map((x) => ({ ...x })),
    });
    setScreen("editor");
  };
  const backToList = () => { setScreen("list"); setNotice(null); };

  // ── form field helpers ──
  const setField = <K extends keyof BannerForm>(k: K, val: BannerForm[K]) =>
    setForm((f) => ({ ...f, [k]: val }));

  // buttons repeater
  const addButton = () => setForm((f) => ({ ...f, buttons: [...f.buttons, { label: "", link: "", isPrimary: f.buttons.length === 0 }] }));
  const setButton = (i: number, patch: Partial<BannerButton>) =>
    setForm((f) => ({ ...f, buttons: f.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const removeButton = (i: number) => setForm((f) => ({ ...f, buttons: f.buttons.filter((_, j) => j !== i) }));

  // metrics repeater
  const addMetric = () => setForm((f) => ({ ...f, metrics: [...f.metrics, { metric: "", description: "", index: f.metrics.length }] }));
  const setMetric = (i: number, patch: Partial<BannerMetric>) =>
    setForm((f) => ({ ...f, metrics: f.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const removeMetric = (i: number) => setForm((f) => ({ ...f, metrics: f.metrics.filter((_, j) => j !== i) }));

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setField("backgroundImageUrl", url);
  };

  // ── persistence ──
  const save = async () => {
    if (!form.title.trim()) { setNotice({ kind: "err", msg: "Title is required." }); return; }
    setSaving(true);
    const payload: BannerInput = {
      page: form.page, tag: form.tag, title: form.title, description: form.description,
      audience: form.audience, isActive: form.isActive,
      backgroundGradient: form.backgroundGradient, backgroundImageUrl: form.backgroundImageUrl,
      startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt),
      // drop blank repeater rows
      buttons: form.buttons.filter((b) => b.label.trim()),
      metrics: form.metrics.filter((m) => m.metric.trim()),
      businessIds: form.businesses.map((b) => b.id).slice(0, 2),
    };
    const res = editId == null
      ? await AdminOpsService.createBanner(payload).catch(() => null)
      : await AdminOpsService.updateBanner(editId, payload).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Slide saved." }); await load(); setScreen("list"); }
    else setNotice({ kind: "err", msg: res?.message || "Could not save slide." });
  };

  const toggle = async (b: BannerRow) => {
    const res = await AdminOpsService.toggleBanner(b.id).catch(() => null);
    if (res?.response) await load();
    else setNotice({ kind: "err", msg: "Could not toggle slide." });
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
    if (res?.response) { setNotice({ kind: "ok", msg: "Slide deleted." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not delete slide." });
  };

  return {
    banners, loading, saving, notice, screen, editId, form, confirmId, liveCount, isImageUploading,
    openNew, openEdit, backToList, setField,
    addButton, setButton, removeButton, addMetric, setMetric, removeMetric, onPickImage,
    save, toggle, move, confirmDelete, cancelDelete, doDelete,
  };
};

export default useBannersHouseView;
