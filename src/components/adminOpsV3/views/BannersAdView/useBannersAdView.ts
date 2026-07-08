// ── useBannersAdView ── Banner Ads moderation (promptsadmin task 16 + master 6).
// 3 tabs pending/live/rejected (counts in labels) over AdCampaign, approve/reject
// -with-reason, and a "+ Create fallback ad" modal (house ad, auto-live).
// Data: /api/v1/admin/banners-ad/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";
import { useImageUploader } from "../../../../hooks/upload/useImageUploader";

export interface AdCreative {
  eyebrow: string; heading1: string; heading2: string; description: string;
  features: string[]; buttonLabel: string; buttonLink: string; imageUrl: string; theme: string;
}
export interface AdRow {
  id: number; title: string; advertiser: string | number; isHouseAd: boolean;
  page: string; status: string | null; priceTotal: number; days: number;
  months: number; spots: string[]; creative: AdCreative; rejectReason: string; createdAt: string;
}
export interface AdCounts { pending: number; live: number; rejected: number; }

// Tab key → label; counts filled from the response.
export const AD_TABS = ["pending", "live", "rejected"] as const;
export type AdTab = (typeof AD_TABS)[number];

export interface FallbackForm {
  placement: string; page: string; image: string; eyebrow: string;
  heading: string; sub: string; features: string; ctaLabel: string; ctaLink: string; theme: string;
}
const emptyFallback = (): FallbackForm => ({
  placement: "inline", page: "", image: "", eyebrow: "", heading: "", sub: "",
  features: "", ctaLabel: "Enquire now", ctaLink: "", theme: "green",
});

const useBannersAdView = () => {
  const [tab, setTab] = useState<AdTab>("pending");
  const [ads, setAds] = useState<AdRow[]>([]);
  const [counts, setCounts] = useState<AdCounts>({ pending: 0, live: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Create-fallback modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FallbackForm>(emptyFallback());
  const { uploadImage, isImageUploading } = useImageUploader({ forPurpose: "Banner" });

  const load = async (status: AdTab) => {
    setLoading(true);
    const res = await AdminOpsService.bannersAd({ status }).catch(() => null);
    if (res?.response && res.data?.ads) {
      setAds(res.data.ads);
      if (res.data.counts) setCounts(res.data.counts);
    } else setAds([]);
    setLoading(false);
  };
  useEffect(() => { load(tab); }, [tab]);

  const approve = async (id: number) => {
    setBusy(true);
    const res = await AdminOpsService.approveAd(id).catch(() => null);
    setBusy(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Ad approved — now live." }); await load(tab); }
    else setNotice({ kind: "err", msg: "Could not approve ad." });
  };

  const openReject = (id: number) => { setRejectingId(id); setReason(""); };
  const cancelReject = () => setRejectingId(null);
  const submitReject = async () => {
    if (rejectingId == null) return;
    if (!reason.trim()) { setNotice({ kind: "err", msg: "A reject reason is required." }); return; }
    setBusy(true);
    const res = await AdminOpsService.rejectAd(rejectingId, reason).catch(() => null);
    setBusy(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Ad rejected." }); setRejectingId(null); await load(tab); }
    else setNotice({ kind: "err", msg: res?.message || "Could not reject ad." });
  };

  // ── Create fallback (house) ad ──
  const openModal = () => { setForm(emptyFallback()); setModalOpen(true); setNotice(null); };
  const closeModal = () => setModalOpen(false);
  const setField = (k: keyof FallbackForm, val: string) => setForm((f) => ({ ...f, [k]: val }));
  const pickImage = async (file: File) => {
    const url = await uploadImage(file);
    if (url) setForm((f) => ({ ...f, image: url }));
  };
  const submitFallback = async () => {
    if (!form.placement.trim()) { setNotice({ kind: "err", msg: "Placement is required." }); return; }
    if (!form.heading.trim()) { setNotice({ kind: "err", msg: "Heading is required." }); return; }
    setBusy(true);
    const res = await AdminOpsService.createFallbackAd({
      placement: form.placement.trim(), page: form.page.trim(), image: form.image,
      eyebrow: form.eyebrow, heading: form.heading, sub: form.sub,
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      ctaLabel: form.ctaLabel, ctaLink: form.ctaLink, theme: form.theme,
    }).catch(() => null);
    setBusy(false);
    if (res?.response) {
      setNotice({ kind: "ok", msg: "Fallback ad created — live." });
      setModalOpen(false);
      setTab("live");
      await load("live");
    } else setNotice({ kind: "err", msg: res?.message || "Could not create fallback ad." });
  };

  return {
    tab, setTab, ads, counts, loading, notice, rejectingId, reason, setReason, busy,
    approve, openReject, cancelReject, submitReject,
    modalOpen, form, setField, openModal, closeModal, pickImage, submitFallback, isImageUploading,
  };
};

export default useBannersAdView;
