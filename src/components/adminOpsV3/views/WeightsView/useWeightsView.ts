// ── useWeightsView ── Qualification Weights logic (task 33). Four importance
// sliders + tier thresholds; the scorer takes a NORMALIZED weighted average so
// each slider's live "effective %" (weight/Σweights) is what actually matters —
// the raw number is just relative importance. Super-admin, level-3 (backend
// audits). Data: /api/v1/admin/weights/ (Get seeds DEFAULT_WEIGHTS when empty).
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface SliderDef { key: string; label: string; hint: string; min: number; max: number; def: number; }

// The 4 real signals (budget is deliberately NEVER a signal; the dead per-bucket
// urgency sliders were removed — urgency is now one signal from the lead timeline).
export const SIGNALS: SliderDef[] = [
  { key: "contact", label: "Contact", hint: "Valid 10-digit phone", min: 0, max: 100, def: 40 },
  { key: "genuineness", label: "Genuineness", hint: "Real-looking name", min: 0, max: 100, def: 25 },
  { key: "detail", label: "Detail", hint: "Enquiry length / substance", min: 0, max: 100, def: 15 },
  { key: "urgency", label: "Urgency", hint: "Buyer's stated timeline", min: 0, max: 100, def: 20 },
];
// Tier score thresholds (0-100), strictly descending.
export const THRESHOLDS: SliderDef[] = [
  { key: "tier_A", label: "Tier A ≥", hint: "Hottest leads", min: 0, max: 100, def: 90 },
  { key: "tier_B", label: "Tier B ≥", hint: "", min: 0, max: 100, def: 75 },
  { key: "tier_C", label: "Tier C ≥", hint: "", min: 0, max: 100, def: 55 },
  { key: "tier_D", label: "Tier D ≥", hint: "Below D = Tier E", min: 0, max: 100, def: 35 },
];
const ALL = [...SIGNALS, ...THRESHOLDS];
const DEFAULTS = (): Record<string, number> => Object.fromEntries(ALL.map((s) => [s.key, s.def]));

const signalSum = (v: Record<string, number>) => SIGNALS.reduce((a, s) => a + Math.max(0, v[s.key] || 0), 0);

// Each signal's real share of the score (weight / Σsignal-weights).
export const effectivePct = (v: Record<string, number>, key: string) => {
  const sum = signalSum(v);
  return sum <= 0 ? 0 : Math.round((Math.max(0, v[key] || 0) / sum) * 100);
};

// Normalized score for a lead whose signal strengths (0..1) are given — mirrors
// the backend compute_score_and_tier exactly: 100 * Σ(w·s) / Σw.
export const scoreFor = (v: Record<string, number>, signals: Record<string, number>) => {
  const sum = signalSum(v);
  if (sum <= 0) return 0;
  const num = SIGNALS.reduce((a, s) => a + Math.max(0, v[s.key] || 0) * (signals[s.key] ?? 0), 0);
  return Math.round((100 * num) / sum);
};

export const tierFor = (v: Record<string, number>, score: number) => {
  if (score >= (v.tier_A ?? 90)) return "A";
  if (score >= (v.tier_B ?? 75)) return "B";
  if (score >= (v.tier_C ?? 55)) return "C";
  if (score >= (v.tier_D ?? 35)) return "D";
  return "E";
};

// A representative "typical good" lead used for the live preview: valid phone +
// real name (1.0), a moderately detailed enquiry (0.6), a 90-day timeline (0.66).
const SAMPLE = { contact: 1, genuineness: 1, detail: 0.6, urgency: 0.66 };

export const previewTier = (v: Record<string, number>) => {
  const perfect = scoreFor(v, { contact: 1, genuineness: 1, detail: 1, urgency: 1 }); // = 100 when any weight set
  const sample = scoreFor(v, SAMPLE);
  return { score: perfect, tier: tierFor(v, perfect), sample, sampleTier: tierFor(v, sample) };
};

const useWeightsView = () => {
  const [values, setValues] = useState<Record<string, number>>(DEFAULTS());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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
    if (res?.response) { setNotice({ kind: "ok", msg: res.message || "Weights saved." }); await load(); }
    // Surface the backend's specific validation message (thresholds out of order,
    // all-zero weights, …) inline instead of a generic error.
    else setNotice({ kind: "err", msg: res?.message || "Could not save weights." });
  };

  return {
    values, loading, saving, notice, helpOpen, setHelpOpen,
    setValue, resetDefaults, save, effectivePct: (k: string) => effectivePct(values, k),
    preview: previewTier(values),
  };
};

export default useWeightsView;
