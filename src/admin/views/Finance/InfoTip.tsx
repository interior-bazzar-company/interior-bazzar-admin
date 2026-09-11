/* =============================================================================
   InfoTip — the i button. Reference text behind one press, exactly when
   somebody is unsure; never a hover tooltip (vanishes mid-read, skips touch
   and keyboard).

   IT IS THE PANEL'S `InfoDot` NOW. This file used to draw its own circle, its
   own popover, its own outside-click listener and its own Escape handler —
   four behaviours React Aria already gets right, including the one that was
   subtly wrong here: an Escape inside a dialog closed the panel AND was
   stopped, so the dialog behind it could not be dismissed by a second press.
   What is left is Finance's vocabulary: which sentences go behind the i for a
   metric, a KPI and a payroll figure.
   ============================================================================= */
import type { ReactNode } from "react";
import { InfoDot } from "../../ui";
import { kpiMeta, metric, payrollMetric } from "./store";

export default function InfoTip({ label, intro, rows, children }: {
  label: string;
  intro?: ReactNode;
  rows?: { label: string; hint?: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <InfoDot label={"About " + label} className="ml-1 align-middle">
      {intro ? <p className="text-sm text-secondary">{intro}</p> : null}
      {rows?.map((r) => (
        <p key={r.label} className="text-sm text-tertiary">
          <b>{r.label}</b>
          {r.hint ? <> — {r.hint}</> : null}
        </p>
      ))}
      {children}
    </InfoDot>
  );
}

/** The i for an Overview tile: formula and caution straight from the
 *  vocabulary, so a figure never means two things six months apart. */
export function MetricTip({ k }: { k: string }) {
  const m = metric(k);
  if (!m) return null;
  return (
    <InfoTip label={m.label} intro={<b className="font-mono">{m.formula}</b>}
      rows={[{ label: "Unit", hint: m.unit }, { label: "Caution", hint: m.caution }]} />
  );
}

/** The i for a KPI. Carries the same two things plus which way is good —
 *  a decision metric with no stated direction invites the wrong read. */
export function KpiTip({ k }: { k: string }) {
  const m = kpiMeta(k);
  if (!m) return null;
  return (
    <InfoTip label={m.label} intro={<b className="font-mono">{m.formula}</b>}
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
    <InfoTip label={m.label} intro={<b className="font-mono">{m.formula}</b>}
      rows={[{ label: "Unit", hint: m.unit }, { label: "Caution", hint: m.caution }]} />
  );
}

/* A PayrollKpiTip stood here, for six decision metrics on this face. Both went
   when the face was cut to three charts: the metrics were the confusing half of
   a page whose job is to show a shape, and a tip with nothing to annotate is
   dead weight in the one file every tile on the panel imports. */
