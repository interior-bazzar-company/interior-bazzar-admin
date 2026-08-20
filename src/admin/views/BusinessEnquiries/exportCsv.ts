/* =============================================================================
   Business Enquiries — export.
   -----------------------------------------------------------------------------
   WHAT COMES OUT IS WHAT IS ON SCREEN. The export takes the rows the list has
   already filtered and sorted, in that order — not a fresh unfiltered query.
   That is the whole contract, and it is worth stating because the alternative
   is the bug: an operator narrows to one business, presses Export, and gets
   every enquiry in the system. A file that does not match the screen it came
   from is worse than no file, because nobody checks.

   COLUMNS ARE GROUPS, AND CONTACT IS OFF BY DEFAULT. The module spec is explicit
   that customer contact must not ride along in a broad export unless somebody
   asked for it. So name, phone and email are one group, unticked, with the
   warning next to the tick rather than in a footnote nobody reads.

   THE CONTACT LOG AND THE REMARKS ARE NOT EXPORTABLE AT ALL — not as a group,
   not behind a tick. It is the same rule share.ts and imageSheet.ts enforce for
   copy, print and the shared image: those are our notes about a customer,
   written by an operator for an operator, and the only line written deliberately
   for anyone else to read is the requirement summary. Keeping every export path
   on one rule is why the rule survives; a fourth path with its own idea of what
   is shareable is how it stops being true.

   A remark is the most candid thing written about a customer anywhere in this
   module — "her architect is the one who decides", "they have gone quiet on the
   last two as well" — and therefore the least shareable. It has no column here
   and must never get one.
   ============================================================================= */
import {
  activeAssignment, checklistMissing, everReached, sourceOf, statusOf, urgencyOf, viaLabel,
} from "./store";
import type { Enquiry } from "./store";

export type ColGroup = {
  key: string;
  label: string;
  note: string;
  /** Off by default, and the reason it is off is on the screen beside it. */
  sensitive?: boolean;
  /** Never leaves the building. Off by default and refused to a business
   *  outright — see the `matching` group. */
  internal?: boolean;
  cols: { head: string; get: (e: Enquiry) => string | number }[];
};

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export const GROUPS: ColGroup[] = [
  {
    key: "core",
    label: "Identity and status",
    note: "Always included — a row nobody can identify is not a record.",
    cols: [
      { head: "reference", get: (e) => e.enquiryId },
      { head: "status", get: (e) => statusOf(e.status).label },
      { head: "source", get: (e) => sourceOf(e.source.kind).label },
      { head: "source_via", get: (e) => viaLabel(e.source.via) },
      { head: "created_by", get: (e) => txt(e.source.createdBy) },
      { head: "received_at", get: (e) => e.createdAt },
      { head: "tier", get: (e) => e.tier },
      { head: "urgency", get: (e) => txt(urgencyOf(e.qualification.urgency)?.label) },
    ],
  },
  {
    key: "requirement",
    label: "Requirement",
    note: "What they want, and the one line a person confirmed with them.",
    cols: [
      { head: "category", get: (e) => txt(e.requirement.category) },
      { head: "service", get: (e) => txt(e.requirement.service) },
      { head: "city", get: (e) => txt(e.requirement.city) },
      { head: "state", get: (e) => txt(e.requirement.state) },
      { head: "locality", get: (e) => txt(e.requirement.locality) },
      { head: "pincode", get: (e) => txt(e.requirement.pincode) },
      { head: "project_type", get: (e) => txt(e.requirement.projectType) },
      { head: "intent", get: (e) => txt(e.requirement.intent) },
      /* The confirmed summary only. The raw submission is a claim nobody has
         checked, and a spreadsheet strips the caveat that says so. */
      { head: "requirement_summary", get: (e) => txt(e.qualification.requirementSummary) },
    ],
  },
  {
    key: "handling",
    label: "How it is being worked",
    note: "Owner, tags, qualification progress. Counts only — no contact-log text and no remark text, ever.",
    cols: [
      { head: "owner", get: (e) => (e.owner ? e.owner.name : "unclaimed") },
      { head: "tags", get: (e) => e.tags.join(" ") },
      { head: "checks_confirmed", get: (e) => 4 - checklistMissing(e).length },
      { head: "contact_attempts", get: (e) => e.contactLog.length },
      /* The COUNT of remarks, never their text. How much somebody has written
         about an enquiry is an operational fact; what they wrote is not. */
      { head: "remark_count", get: (e) => e.remarks.length },
      { head: "ever_reached", get: (e) => (everReached(e) ? "yes" : "no") },
      { head: "last_contact_at", get: (e) => txt(e.contactLog[0]?.at) },
      { head: "callback_due_at", get: (e) => txt(e.followUpAt) },
      { head: "qualified_by", get: (e) => txt(e.qualification.qualifiedBy) },
      { head: "qualified_at", get: (e) => txt(e.qualification.frozenAt) },
    ],
  },
  {
    key: "assignment",
    label: "Assignment and outcome",
    note: "Who it went to, when, and what they reported back.",
    cols: [
      { head: "assigned_business", get: (e) => txt(activeAssignment(e)?.businessName) },
      { head: "assigned_at", get: (e) => txt(activeAssignment(e)?.assignedAt) },
      { head: "assigned_by", get: (e) => txt(activeAssignment(e)?.assignedBy) },
      { head: "sla_breached", get: (e) => (e.sla.breached ? "yes" : "no") },
      { head: "acknowledged_at", get: (e) => txt(e.outcome?.acknowledgedAt) },
      { head: "outcome", get: (e) => txt(e.outcome?.outcome) },
      { head: "outcome_reason", get: (e) => txt(e.outcome?.reason) },
    ],
  },
  {
    /* THE SCORE AND THE RANK DO NOT BELONG IN A FILE SENT TO A BUSINESS, and
       for a while they did: they sat in "Assignment and outcome", which is on
       by default, and the dialog offers a business-scoped export as "the file
       to send a business about its own enquiries". That combination handed a
       business the exact number it was ranked on.

       Exposing rank turns routing into a negotiation and the weight table into
       something to game — a business that learns it lost on the fairness factor
       will argue about the fairness factor. The numbers are genuinely useful to
       US (match-score distribution is a named admin metric), so they are kept
       and gated rather than removed: their own group, off by default, and
       refused outright while a business filter is on. */
    key: "matching",
    label: "Matching internals",
    note: "Rank, score, rule version and any override reason. Useful to us — and the one thing a business must never see, because a rank it can read is a rank it can argue with.",
    internal: true,
    cols: [
      { head: "match_rank", get: (e) => txt(activeAssignment(e)?.candidateRank) },
      { head: "match_score", get: (e) => txt(activeAssignment(e)?.candidateScore) },
      { head: "rule_version", get: (e) => txt(activeAssignment(e)?.ruleVersion) },
      { head: "override_reason", get: (e) => txt(activeAssignment(e)?.overrideReason) },
    ],
  },
  {
    key: "contact",
    label: "Customer contact",
    note: "Name, phone and email. Personal data leaving the audited surface — tick it only if the person receiving this file needs to ring the customer.",
    sensitive: true,
    cols: [
      { head: "customer_name", get: (e) => e.customer.name },
      { head: "customer_phone", get: (e) => e.customer.phone },
      { head: "customer_email", get: (e) => txt(e.customer.email) },
    ],
  },
];

/* Excel opens a bare UTF-8 CSV in the local codepage and turns every ₹, every
   accented name and every en dash into mojibake. The BOM is the one thing that
   stops it, and the file is opened in Excel more often than anywhere else. */
const BOM = "﻿";

const cell = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';

export function buildCsv(rows: Enquiry[], groups: string[]): string {
  const cols = GROUPS.filter((g) => groups.indexOf(g.key) >= 0).flatMap((g) => g.cols);
  const out = [cols.map((c) => cell(c.head)).join(",")];
  rows.forEach((e) => out.push(cols.map((c) => cell(c.get(e))).join(",")));
  return BOM + out.join("\r\n");
}

export function columnCount(groups: string[]): number {
  return GROUPS.filter((g) => groups.indexOf(g.key) >= 0)
    .reduce((n, g) => n + g.cols.length, 0);
}

/* The filename carries the scope, so a file sitting in a downloads folder a
   week later still says what it is a list OF. A business-scoped export that is
   named `enquiries.csv` is the one somebody forwards believing it is
   everything. */
export function fileNameFor(p: Record<string, string | undefined>, count: number): string {
  const bits = ["enquiries"];
  if (p.business) bits.push(p.business.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  if (p.status) bits.push(p.status);
  if (p.category) bits.push(p.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  if (p.city) bits.push(p.city.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  if (p.source) bits.push(p.source);
  if (p.owner) bits.push("owner-" + p.owner.replace(/^__/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  if (p.flag) bits.push(p.flag);
  bits.push(String(count));
  bits.push(new Date().toISOString().slice(0, 10));
  return bits.join("_") + ".csv";
}

/* A Blob rather than the `data:` URI the Deals export uses. Same result for a
   handful of rows; a data URI has a length ceiling that varies by browser, and
   an export is the one thing here that grows without limit. */
export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoked on the next tick, not immediately: Safari has not always finished
     reading the blob by the time click() returns. */
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A sentence describing exactly what is about to be written, for the dialog to
 *  print above the button. Built from the same params the rows were filtered
 *  by, so it cannot describe a different set than the one being exported. */
export function scopeSentence(p: Record<string, string | undefined>, count: number, total: number): string {
  if (count === total) return "All " + total + " enquiries. No filters are active.";
  const parts: string[] = [];
  if (p.business) parts.push("assigned to " + p.business);
  if (p.status) parts.push("at " + statusOf(p.status).label);
  if (p.category) parts.push("in " + p.category);
  if (p.city) parts.push("in " + p.city);
  if (p.source) parts.push("from " + sourceOf(p.source).label);
  if (p.owner === "__none") parts.push("unclaimed");
  else if (p.owner === "__mine") parts.push("owned by you");
  else if (p.owner) parts.push("owned by " + p.owner);
  if (p.tag) parts.push("tagged " + p.tag);
  if (p.flag) parts.push(p.flag === "overdue" ? "with an overdue callback" : p.flag.replace(/_/g, " "));
  if (p.q) parts.push('matching "' + p.q + '"');
  return count + " of " + total + " enquiries" +
    (parts.length ? " — " + parts.join(", ") : "") + ".";
}
