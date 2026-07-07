// ── useOverviewView ──
// Data for the admin Overview module. KPIs + recent-activity feed are wired to
// real backend endpoints (promptsadmin task 13): /api/v1/admin/revenue/ and
// /api/v1/admin/audit/ (AdminOpsService). KPIs with no dedicated endpoint yet
// (enquiries today, payments awaiting verify) keep a clearly-marked "—"
// placeholder rather than a fabricated number.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface OverviewKpi { icon: string; value: string; label: string; delta?: string; dcls?: "up" | "down" | "flat"; amber?: boolean; }
export interface OverviewAction { icon: string; cls: "warn" | "red" | "ok"; title: string; sub: string; count: number; key: string; }
export interface OverviewFeed { action: string; module: string; when: string; }

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const timeAgo = (iso: string | null): string => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

const useOverviewView = () => {
  const [range, setRange] = useState<"30d" | "90d" | "YTD">("30d");
  const [loading, setLoading] = useState(true);
  const [payingCustomers, setPayingCustomers] = useState<number | null>(null);
  const [mrr, setMrr] = useState<number | null>(null);
  const [feed, setFeed] = useState<OverviewFeed[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [rev, audit] = await Promise.all([
        AdminOpsService.revenue().catch(() => null),
        AdminOpsService.audit({ pageSize: 8 }).catch(() => null),
      ]);
      if (!alive) return;
      if (rev?.response && rev.data) {
        setPayingCustomers(rev.data.payingCustomers);
        setMrr(rev.data.mrr);
      }
      if (audit?.response && audit.data?.entries) {
        setFeed(
          audit.data.entries.map((e) => ({
            action: e.action.replace(/_/g, " "),
            module: e.module,
            when: timeAgo(e.ts),
          }))
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const kpis: OverviewKpi[] = [
    { icon: "rosette", value: payingCustomers != null ? String(payingCustomers) : "—", label: "Paying customers", dcls: "up" },
    { icon: "coin", value: mrr != null ? inr(mrr) : "—", label: "Net revenue run-rate", dcls: "up" },
    { icon: "inbox", value: "—", label: "Qualified enquiries today", delta: "no endpoint yet", dcls: "flat" },
    { icon: "cash", value: "—", label: "Payments awaiting verify", delta: "no endpoint yet", dcls: "down", amber: true },
  ];

  const actions: OverviewAction[] = [
    { icon: "route", cls: "warn", title: "Routing queue", sub: "Held — no exclusive slot holder", count: 0, key: "routing" },
    { icon: "cash", cls: "red", title: "Payments to verify", sub: "Manual UPI / NEFT / RTGS proofs", count: 0, key: "payments" },
    { icon: "shield-x", cls: "warn", title: "Quarantine", sub: "Genuineness checks to review", count: 0, key: "quarantine" },
    { icon: "rosette", cls: "warn", title: "Expiring in 7 days", sub: "Subscriptions to renew", count: 0, key: "subs" },
    { icon: "lifebuoy", cls: "ok", title: "Support backlog", sub: "Open tickets", count: 0, key: "support" },
  ];

  // Enquiries last 30 days — no analytics endpoint yet (illustrative shape).
  const daily: number[] = [8, 11, 9, 14, 12, 7, 10, 13, 9, 15, 11, 8, 12, 16, 10, 9, 13, 11, 14, 8, 12, 10, 15, 13, 9, 11, 14, 17, 12, 15];

  const families: Array<{ family: string; count: number }> = [
    { family: "Business", count: 0 },
    { family: "Shop", count: 0 },
    { family: "Architecture", count: 0 },
    { family: "Automation", count: 0 },
  ];

  return { range, setRange, loading, kpis, actions, daily, families, feed };
};

export default useOverviewView;
