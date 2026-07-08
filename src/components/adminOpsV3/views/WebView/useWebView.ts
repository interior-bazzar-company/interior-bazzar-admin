// ── useWebView ── Website analytics logic (task 27 + master task 16).
// ENQUIRY-derived analytics from LeadQuery over a date range. NOTE: raw web
// sessions / unique visitors / bounce rate / external traffic-by-source are
// DEFERRED (no event store) — a WebEvent model + public-SPA beacon is a separate
// task; those KPIs are intentionally absent, not faked.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface Bar { label: string; count: number; }
export interface DailyPoint { date: string | null; count: number; }
export interface WebData {
  totalUsers: number; buyers: number; businesses: number; verifiedBusinesses: number; leads: number; blogs: number;
  rangeTotal: number; leadsBySource: Bar[]; leadsByOrigin: Bar[]; funnel: Bar[]; enquiriesDaily: DailyPoint[];
}

const useWebView = () => {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [d, setD] = useState<WebData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.webAnalytics({ start: start || undefined, end: end || undefined }).catch(() => null);
    if (res?.response) setD(res.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  return { start, setStart, end, setEnd, d, loading };
};

export default useWebView;
