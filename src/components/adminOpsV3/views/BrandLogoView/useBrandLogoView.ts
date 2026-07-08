// ── useBrandLogoView ── Brand Logo logic (promptsadmin task 38).
// Get/set brand logo + favicon URLs (S3 URLs). Level-3 (backend audits).
// Data: /api/v1/admin/brand-logo/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

const useBrandLogoView = () => {
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.brandLogo().catch(() => null);
    if (res?.response && res.data) { setLogoUrl(res.data.logoUrl || ""); setFaviconUrl(res.data.faviconUrl || ""); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const res = await AdminOpsService.setBrandLogo({ logoUrl, faviconUrl }).catch(() => null);
    setSaving(false);
    if (res?.response) setNotice({ kind: "ok", msg: "Brand assets saved." });
    else setNotice({ kind: "err", msg: "Could not save brand assets." });
  };

  return { logoUrl, setLogoUrl, faviconUrl, setFaviconUrl, loading, saving, notice, save };
};

export default useBrandLogoView;
