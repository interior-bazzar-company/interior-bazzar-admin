/* =============================================================================
   Deals — the ONE place the wire shape (DealRow, from AdminOpsService.deals()/
   .deal()) becomes the record shape List.tsx / Drawer.tsx / bits.tsx already
   render: the field names the ported prototype views use (deal_id,
   customer_name, deal_value, stage as an int 1–6, priority as an int 1–3, …),
   so this is the only file that needs to know the wire shape exists.

   The chain (quotation_status, invoice_status, paid) and the money
   (revenue_collected, outstanding) ARE produced here now — interior_deals_billing
   has the models and the deals endpoint annotates every row from them.
   duplicate_count is still deliberately absent: the server does not compute it,
   and every consumer renders nothing rather than a guess.
   ============================================================================= */
import { fmtDate, inr } from "../../ui/format";
import type {
  DealPersonRef, DealPriorityVocab, DealRemark, DealRow, DealStageVocab, DealTransition,
} from "../../../api/modules/adminOps";

/* ------------------------------------------------------ the URL's vocabulary */
/* This was IBData.STAGES / IBData.PRIORITY, and it is the one piece of the
   deleted engine layer that had to stay — because it is not data, it is the
   mapping between the server's stage KEY and the integer this panel's own URLs
   carry (`#/deals?stage=3`). Something client-side has to own that mapping;
   the server has no opinion about the panel's query string.

   What it does NOT own is what you read on screen. Every label and tone here
   is overwritten with the server's own the moment a deals response lands (see
   `legacyStageInt` below, which matches by key and grafts unknown stages in),
   so these strings are only ever visible in the instant before the first
   fetch resolves. Add a stage server-side and it appears here under its real
   name with no edit to this file. */
export const STAGES: Record<number, { key: string; label: string; tone: string; hint: string }> = {
  1: { key: "new",         label: "New",         tone: "",     hint: "Fresh lead" },
  2: { key: "followup",    label: "Followup",    tone: "warn", hint: "Interested conversation" },
  3: { key: "slot",        label: "Slot Booked", tone: "info", hint: "Paid slot registration amount" },
  4: { key: "installment", label: "Installment", tone: "info", hint: "Paying the plan down" },
  5: { key: "won",         label: "Won",         tone: "ok",   hint: "Paid in full" },
  6: { key: "lost",        label: "Lost",        tone: "dead", hint: "Denied" },
};
export const PRIORITY: Record<number, string> = { 1: "Normal", 2: "High", 3: "Urgent" };

const D = { STAGES, PRIORITY, fmtDate, inr };

/* stageKey -> legacy int, built from STAGES above — the vocabulary IS data,
   so this reads the map rather than hardcoding one. Extended at runtime for a
   stage key the port has never seen: rather than crash (`D.STAGES[d.stage]`
   would be undefined) or silently drop the deal, a synthetic int (1000+) is
   grafted onto STAGES itself using the API's own label/tone, so every
   existing `D.STAGES[d.stage]` lookup across List/Drawer/bits keeps working
   and the deal renders under its real name. It just never gets a dedicated
   cell in the funnel strip — STRIP_STAGES/ALL_STAGES are computed once, at
   module load, from the fixed six-stage local vocabulary, and a stage the
   port never knew about was never going to get a bespoke cell there either
   way. It still counts in the strip's Total, via `counts.total` from the API. */
let nextSynthetic = 1000;
const stageIntCache: Record<string, number> = {};
export function legacyStageInt(s: { key: string; label: string; tone: string }): number {
  if (stageIntCache[s.key] !== undefined) return stageIntCache[s.key];
  for (const k in D.STAGES) {
    if (D.STAGES[k].key === s.key) { stageIntCache[s.key] = Number(k); return Number(k); }
  }
  const legacyInt = nextSynthetic++;
  D.STAGES[legacyInt] = { key: s.key, label: s.label, tone: s.tone || "", hint: s.label };
  stageIntCache[s.key] = legacyInt;
  return legacyInt;
}

/* priorityKey -> legacy int 1..3, matched by LABEL (case-insensitive) against
   PRIORITY above ({1:"Normal",2:"High",3:"Urgent"}). Label over displayOrder:
   the label is the one thing both sides agree is the priority's identity — a
   reordered priority row would silently swap High and Urgent under an
   order-based match. Priority never gates an action in this read-only pass
   (it is a tone + a hint, nothing more), so an unmatched key defaulting to
   Normal is a safe corner to cut: worst case a priority reads calmer than it
   should, never a wrong permission or a wrong figure. */
export function legacyPriorityInt(p: DealPriorityVocab | { key: string; label: string }): number {
  const hit = Object.keys(D.PRIORITY).find(
    (k) => String(D.PRIORITY[Number(k)]).toLowerCase() === (p.label || "").toLowerCase()
  );
  return hit ? Number(hit) : 1;
}

/* The wire carries full ISO datetimes ("2026-06-27T00:00:00Z"); the ported
   engine's date helper is `d(iso){ var p = iso.split("-"); return new
   Date(+p[0], p[1]-1, +p[2]); }` — it splits on "-" and expects a DATE-ONLY
   string, so a datetime makes `+p[2]` parse "27T00:00:00Z" as NaN and every
   "Nd in stage" rendered "NaNd in stage".

   Trimming here rather than in the formatter: converting the wire shape into
   the legacy shape is exactly this adapter's job, and the legacy shape has
   always been date-only. One helper, applied to every date the adapter emits,
   so a new date field cannot reintroduce the bug by being passed raw. */
export function dateOnly(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.indexOf("T");
  return t === -1 ? v : v.slice(0, t);
}

export function adaptDeal(row: DealRow): any {
  return {
    deal_id: row.ref,
    customer_name: row.contactName,
    business_name: row.businessName || "",
    email: row.email || "",
    phone: row.phone,
    city: row.city,
    state: row.state || "",
    interested_in: row.interestedIn,
    stage: legacyStageInt({ key: row.stageKey, label: row.stageLabel, tone: row.stageTone }),
    priority: legacyPriorityInt({ key: row.priorityKey, label: row.priorityLabel }),
    // Paise on both sides — passed straight through, no arithmetic. null
    // ("not quoted yet") stays null; D.inr() already renders that as "—".
    deal_value: row.valuePaise,
    owner_id: row.owner ? row.owner.name : null,
    co_owner_id: row.coOwner ? row.coOwner.name : null,
    // No split ratio in this API contract — left unset rather than guessed;
    // KvList's co-owner row renders it as an empty parenthetical, not a 0/—.
    created_at: dateOnly(row.createdAt),
    stage_since: dateOnly(row.stageSince),
    expected_close_date: dateOnly(row.expectedClose),
    next_action: row.nextActionDate ? { date: row.nextActionDate, note: row.nextActionNote || "" } : null,
    enquiry_id: row.enquiryRef,
    is_stalled: !!row.stalled,
    close_reason: row.lostReason || null,
    tags: row.tags || [],
    // duplicate_count intentionally OMITTED (stays undefined). The server
    // does not compute duplicates — rendering 0 would claim a fact nobody
    // checked; every call site already treats a falsy duplicate_count as
    // "say nothing", so undefined reads exactly like the old 0 did.
    //
    // The Q / I / ₹ chain, straight off the row — interior_deals_billing
    // computes it (DealsController._with_chain), nothing is derived here.
    quotation_status: row.quotationStatus || "none",
    invoice_status: row.invoiceStatus || "none",
    paid: !!row.paid,
    // Money, straight through in paise. The server sums the ledger; nothing is
    // added up, apportioned or estimated on this side.
    revenue_collected: row.collectedPaise,
    outstanding: row.outstandingPaise,
  };
}

/* API stageKey-counts -> legacy-int-keyed counts, via the same map as the
   rows themselves, so the funnel strip and the row pills can never disagree
   about what stage 3 means. */
export function adaptByStage(
  byStage: Record<string, number>, stages: DealStageVocab[]
): Record<number, number> {
  const vocabByKey = new Map(stages.map((s) => [s.key, s]));
  const out: Record<number, number> = {};
  for (const key in byStage) {
    const v = vocabByKey.get(key) || { key, label: key, tone: "" };
    const legacyInt = legacyStageInt(v);
    out[legacyInt] = (out[legacyInt] || 0) + byStage[key];
  }
  return out;
}

/* Owner filter has no vocabulary endpoint in this contract (unlike stage/
   priority/tag) — derived from the distinct owners on the page of deals
   actually loaded. Known limitation: an owner with zero deals in the current
   filtered result set will not appear in the dropdown until one of theirs
   does. Not fabricated, just incomplete — the honest trade given there is
   nowhere else to read the full roster from. */
export function ownersFromRows(rows: DealRow[]): DealPersonRef[] {
  const seen = new Map<number, DealPersonRef>();
  rows.forEach((r) => { if (r.owner) seen.set(r.owner.id, r.owner); });
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function escHtml(s: string) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]));
}

/* transitions + remarks -> the engine's own timeline event shape
   ({kind,tone,at,by,text,channel}), so Drawer's TimelineTab renders it with
   zero changes to the JSX. Quote/invoice/payment events are absent — those
   chains are still local-only (see Drawer.tsx's PaymentsTab/DocumentsTab).
   Sorted newest first, same rule the engine's own Activity.timeline() uses.

   `channel` carries DealRemark.typeKey through for REMARK rows (manual /
   whatsapp / email) — real now, unlike the old local-engine version's
   coloured-but-fake channel tabs (see Chat.tsx). Meaningless on non-REMARK
   rows, left undefined there. */
export function adaptTimeline(transitions: DealTransition[], remarks: DealRemark[]) {
  const out: { kind: string; tone: string; at: string; by: string; text: string; channel?: string }[] = [];
  remarks.forEach((r) => {
    out.push({
      kind: r.typeKey === "system" ? "SYSTEM" : "REMARK", tone: "",
      at: r.createdAt, by: r.author ? r.author.name : (r.typeLabel || "System"),
      text: r.text, channel: r.typeKey,
    });
  });
  transitions.forEach((t) => {
    out.push({
      kind: "STAGE", tone: t.toStageKey === "won" ? "ok" : t.toStageKey === "lost" ? "bad" : "",
      at: t.enteredAt,
      by: t.actor ? t.actor.name + (t.actorRole ? " · " + t.actorRole : "") : (t.actorRole || "System"),
      text: escHtml(t.fromStageLabel || "—") + " → <b>" + escHtml(t.toStageLabel) + "</b>" +
        (t.reason ? " · " + escHtml(t.reason) : ""),
    });
  });
  /* Sort on the FULL ISO timestamp — two events on the same day must keep
     their real order — and only then trim to date-only, because the row
     renders through D.fmtDate(), which is the same date-only parser that
     turned stage_since into NaN. Truncating before the sort would silently
     scramble same-day events. */
  return out
    .sort((a, b) => ((a.at || "") < (b.at || "") ? 1 : (a.at || "") > (b.at || "") ? -1 : 0))
    .map((e) => ({ ...e, at: dateOnly(e.at) || "" }));
}
