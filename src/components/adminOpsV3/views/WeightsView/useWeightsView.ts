// ── useWeightsView ── Qualification Weights logic (task 15). Fixed slider set +
// tier thresholds with a live score/tier preview. Super-admin, level-3 (backend
// audits). Data: /api/v1/admin/weights/ (Get seeds DEFAULT_WEIGHTS when empty).
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface SliderDef { key: string; label: string; min: number; max: number; def: number; }

// Signal sliders (budget is deliberately NEVER a signal).
export const SIGNALS: SliderDef[] = [
  { key: "contact", label: "Contact — valid phone", min: 0, max: 60, def: 40 },
  { key: "genuineness", label: "Genuineness — real name", min: 0, max: 40, def: 20 },
  { key: "urgency_30d", label: "Urgency — within 30 days", min: 0, max: 40, def: 30 },
  { key: "urgency_90d", label: "Urgency — 30–90 days", min: 0, max: 40, def: 20 },
  { key: "urgency_90plus", label: "Urgency — 90+ days", min: 0, max: 20, def: 10 },
  { key: "urgency_browsing", label: "Urgency — just browsing", min: 0, max: 10, def: 0 },
  { key: "detail", label: "Detail — enquiry length", min: 0, max: 20, def: 10 },
];
// Tier score thresholds (0-100).
export const THRESHOLDS: SliderDef[] = [
  { key: "tier_A", label: "Tier A ≥", min: 0, max: 100, def: 90 },
  { key: "tier_B", label: "Tier B ≥", min: 0, max: 100, def: 75 },
  { key: "tier_C", label: "Tier C ≥", min: 0, max: 100, def: 55 },
  { key: "tier_D", label: "Tier D ≥", min: 0, max: 100, def: 35 },
];
const ALL = [...SIGNALS, ...THRESHOLDS];
const DEFAULTS = (): Record<string, number> => Object.fromEntries(ALL.map((s) => [s.key, s.def]));

// Preview a fully-present lead. Mirrors the backend: urgency_* are NOT applied in
// scoring yet (no timeline field on LeadQuery), so score = contact+genuineness+detail.
export const previewTier = (v: Record<string, number>) => {
  const score = (v.contact || 0) + (v.genuineness || 0) + (v.detail || 0);
  let tier = "E";
  if (score >= (v.tier_A ?? 90)) tier = "A";
  else if (score >= (v.tier_B ?? 75)) tier = "B";
  else if (score >= (v.tier_C ?? 55)) tier = "C";
  else if (score >= (v.tier_D ?? 35)) tier = "D";
  return { score, tier };
};

const useWeightsView = () => {
  const [values, setValues] = useState<Record<string, number>>(DEFAULTS());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.weights().catch(() => null);
    if (res?.response && res.data?.weights) {
      const w = res.data.weights as Record<string, unknown>;
      setValues(Object.fromEntries(ALL.map((s) => [s.key, Number(w[s.key] ?? s.def)])));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setValue = (key: string, n: number) => setValues((v) => ({ ...v, [key]: n }));
  const resetDefaults = () => { setValues(DEFAULTS()); setNotice({ kind: "ok", msg: "Reset to defaults — Save to apply." }); };

  const save = async () => {
    setSaving(true);
    const res = await AdminOpsService.setWeights(values, false).catch(() => null);
    setSaving(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Weights saved." }); await load(); }
    else setNotice({ kind: "err", msg: "Could not save weights." });
  };

  return { values, loading, saving, notice, setValue, resetDefaults, save, preview: previewTier(values) };
};

export default useWeightsView;
