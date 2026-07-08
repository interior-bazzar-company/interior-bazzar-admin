// ── useFeedbackView ── User Feedback triage (task 34 + master task 23).
// 3-state tab strip (new → reviewing → closed), mirroring the Reports pattern.
// Data: /api/v1/admin/feedback/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface FB { id: number; contact: string; feedback: string; status: string; user: string | null; createdAt: string; }
export const FEEDBACK_TABS = ["new", "reviewing", "closed"] as const;
export type FeedbackTab = (typeof FEEDBACK_TABS)[number];
// Per-tab actions: label → target status.
export const TAB_ACTIONS: Record<FeedbackTab, Array<{ label: string; status: string; kind: "grant" | "del" }>> = {
  new: [
    { label: "Start reviewing", status: "reviewing", kind: "grant" },
    { label: "Close", status: "closed", kind: "del" },
  ],
  reviewing: [{ label: "Close", status: "closed", kind: "del" }],
  closed: [],
};

// The feedback field is a best-effort JSON array of {question,rating}; render it
// as "Q: ★n" pairs, else fall back to the raw text.
export const renderFeedback = (raw: string): string => {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map((q: { question?: string; rating?: number }) => `${q.question || "Q"}: ★${q.rating ?? "?"}`).join("  ·  ");
  } catch { /* not JSON — show raw */ }
  return raw;
};

const useFeedbackView = () => {
  const [tab, setTab] = useState<FeedbackTab>("new");
  const [rows, setRows] = useState<FB[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await AdminOpsService.feedback({ status: tab }).catch(() => null);
    if (r?.response && r.data?.feedback) setRows(r.data.feedback);
    else setRows([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tab]);

  const setStatus = async (id: number, status: string) => {
    const r = await AdminOpsService.setFeedbackStatus(id, status).catch(() => null);
    if (r?.response) { setNotice({ kind: "ok", msg: `Moved to ${status}.` }); await load(); }
    else setNotice({ kind: "err", msg: "Could not update feedback." });
  };

  return { tab, setTab, rows, loading, notice, setStatus };
};

export default useFeedbackView;
