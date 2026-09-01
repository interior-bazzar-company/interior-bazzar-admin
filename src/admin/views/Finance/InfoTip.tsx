/* =============================================================================
   InfoTip — the i button. Reference text behind one press, exactly when
   somebody is unsure; never a hover tooltip (vanishes mid-read, skips touch
   and keyboard). Escape closes the panel and STOPS there, so it does not also
   close the dialog it sits in.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { kpiMeta, metric, payrollMetric } from "./store";

export default function InfoTip({ label, intro, rows, children }: {
  label: string;
  intro?: ReactNode;
  rows?: { label: string; hint?: ReactNode }[];
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  return (
    <span className="fin-info" ref={box}>
      <button type="button" className="fin-info-b" aria-expanded={open} aria-label={"About " + label}
        onClick={() => setOpen(!open)}>i</button>
      {open ? (
        <div className="fin-info-pop" role="note">
          {intro ? <p className="fin-info-intro">{intro}</p> : null}
          {rows?.map((r) => (
            <div className="fin-info-row" key={r.label}><b>{r.label}</b>{r.hint ? <span>{r.hint}</span> : null}</div>
          ))}
          {children}
        </div>
      ) : null}
    </span>
  );
}

/** The i for an Overview tile: formula and caution straight from the
 *  vocabulary, so a figure never means two things six months apart. */
export function MetricTip({ k }: { k: string }) {
  const m = metric(k);
  if (!m) return null;
  return (
    <InfoTip label={m.label} intro={<><b className="mono">{m.formula}</b></>}
      rows={[{ label: "Unit", hint: m.unit }, { label: "Caution", hint: m.caution }]} />
  );
}

/** The i for a KPI. Carries the same two things plus which way is good —
 *  a decision metric with no stated direction invites the wrong read. */
export function KpiTip({ k }: { k: string }) {
  const m = kpiMeta(k);
  if (!m) return null;
  return (
    <InfoTip label={m.label} intro={<><b className="mono">{m.formula}</b></>}
      rows={[
        { label: "Group", hint: m.group },
        { label: "Better when", hint: m.goodDirection === "up" ? "it rises" : "it falls" },
        { label: "Caution", hint: m.caution },
      ]} />
  );
}

/** The i for a Payroll tile. Same two things as `MetricTip`, off the payroll
 *  face's own vocabulary list — which is separate from `metricDefinitions` so
 *  that a payroll figure cannot turn up unasked on the KPI tab. */
export function PayrollMetricTip({ k }: { k: string }) {
  const m = payrollMetric(k);
  if (!m) return null;
  return (
    <InfoTip label={m.label} intro={<><b className="mono">{m.formula}</b></>}
      rows={[{ label: "Unit", hint: m.unit }, { label: "Caution", hint: m.caution }]} />
  );
}

/* A PayrollKpiTip stood here, for six decision metrics on this face. Both went
   when the face was cut to three charts: the metrics were the confusing half of
   a page whose job is to show a shape, and a tip with nothing to annotate is
   dead weight in the one file every tile on the panel imports. */
