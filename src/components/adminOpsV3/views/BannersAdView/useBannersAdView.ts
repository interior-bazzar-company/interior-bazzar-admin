// ── useBannersAdView ── Banner Ads moderation (promptsadmin task 16).
// Status tab strip (pending/approved/rejected) + approve + reject-with-reason.
// Data: /api/v1/admin/banners-ad/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface AdRow {
  id: number; title: string; advertiser: string | number; status: string | null;
  priceTotal: number; days: number; rejectReason: string; createdAt: string;
}

export const AD_TABS = ["pending", "approved", "rejected"] as const;

const useBannersAdView = () => {
  const [tab, setTab] = useState<string>("pending");
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (status: string) => {
    setLoading(true);
    const res = await AdminOpsService.bannersAd({ status }).catch(() => null);
    if (res?.response && res.data?.ads) setAds(res.data.ads);
    else setAds([]);
    setLoading(false);
  };
  useEffect(() => { load(tab); }, [tab]);

  const approve = async (id: number) => {
    setBusy(true);
    const res = await AdminOpsService.approveAd(id).catch(() => null);
    setBusy(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Ad approved." }); await load(tab); }
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

  return { tab, setTab, ads, loading, notice, rejectingId, reason, setReason, busy, approve, openReject, cancelReject, submitReject };
};

export default useBannersAdView;
