/* =============================================================================
   Agreements — the data module.
   -----------------------------------------------------------------------------
   A TEMPLATE IS NOT AN AGREEMENT. The template is the wording, written once and
   reused; an Agreement is one copy of it sent to one member, with the body
   COPIED IN at the moment it goes out. That copy is the whole module: **a
   signature over a body that can still change is not a signature.** Editing a
   template bumps its version and never touches anything already sent.

   THE AGREEMENTS THEMSELVES ARE TEAM'S, NOT OURS. `Agreement`, its state
   machine, its token and `sendAgreement` / `signAgreement` / `revokeAgreement`
   have lived in views/Team/store.ts since the Team module shipped, reachable
   from a member's own record at `#/team/:id/agreements`. That still works and
   still reads the same rows. This module adds the half that was missing — the
   templates, and a place to see every agreement at once rather than one person
   at a time — and it writes through Team's store rather than keeping a second
   list. Two lists of the same signed documents is the one thing this module
   must never become; it is the same call the Resources module made about the
   roster.

   THE PLACEHOLDERS ARE TWO AND THEY ARE FILLED AT SEND. `{{name}}` and
   `{{date}}` resolve from the member and the day the document goes out, into
   the frozen body. Anything else is left exactly as typed rather than silently
   blanked — a document with a hole in it is worse than one with a stray brace,
   because only the second is obvious.

   BOTH HALVES ARE LIVE (2026-09-16). Agreements come from the backend through
   Team's store, and sending, opening, signing and revoking are its writes
   (`agreements/`, `/view/`, `/sign/`, `/revoke/`). The templates are rows too
   now — `agreements/templates/`, a NotificationTemplate on channel
   `agreement` — so a wording edited on one machine is the wording every other
   one sends. A copy records the `templateKey` it came from, which is what
   provenance and the one-live-copy guard key off: matching back on kind + title
   lost every copy the moment somebody renamed the template.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { AgreementTemplateRow } from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import config from "../../../config";
import {
  AGREEMENT_KIND, TODAY, fmtDate, labelOf, loadFailure, readAgreements, readMember, readMembers,
  revokeAgreement, sendAgreement, signAgreement, toneOf, useAgreements,
} from "../Team/store";
import type { Agreement, LoadPart, Member, Result } from "../Team/store";

export type { Agreement, Member };
export {
  AGREEMENT_KIND, fmtDate, labelOf, readAgreements, readMember, readMembers,
  revokeAgreement, signAgreement, toneOf, useAgreements,
};

/* ------------------------------------------------------------------ types -- */

export type TemplateState = "draft" | "active" | "retired";

export interface Clause {
  clauseId: string;
  heading: string;
  text: string;
}

export interface Template {
  /** The NotificationTemplate `key`. An agreement's `templateId` is this. */
  templateId: string;
  title: string;
  kind: string;
  purpose: string;
  state: TemplateState;
  /** Bumped by any edit to the clauses once the template has ever been sent. */
  version: number;
  clauses: Clause[];
  createdAt: string;
}

/* ------------------------------------------------------------------ store -- */

let templates: Template[] = [];

let version = 0;
const listeners = new Set<() => void>();
const touch = () => { version++; listeners.forEach((f) => f()); };

let seq = 0;
const nextId = (prefix: string) =>
  prefix + "-" + (Date.now().toString(36) + (seq++).toString(36)).toUpperCase();

/* Team's own Result shape, imported rather than redeclared — this module
   writes through its store, so a second Result type with a differently named
   payload would be two vocabularies for one answer. Its success field is
   `data`. */
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const err = (code: string, message: string): Result<never> =>
  ({ ok: false, code, message } as unknown as Result<never>);

const toTemplate = (t: AgreementTemplateRow): Template => ({
  templateId: t.key, title: t.title, kind: t.kind, purpose: t.purpose,
  state: t.state as TemplateState, version: t.version,
  clauses: (t.clauses || []).map((c) => ({ clauseId: c.clauseId, heading: c.heading, text: c.text })),
  createdAt: t.createdAt,
});

/** Load (once) or reload (`force`) the wording. Never throws: a refused read
 *  leaves the list empty and every face shows its own empty state rather than
 *  wording nobody wrote. */
let booting: Promise<void> | null = null;
/** How the wording stands: a refused or failed read is said, never drawn as "no template". */
let templatesPart: LoadPart = { state: "loading" };
export function bootTemplates(force = false): Promise<void> {
  if (booting && !force) return booting;
  booting = call(AdminOpsService.agreementTemplates())
    .then((r) => { templates = (r.templates || []).map(toTemplate); templatesPart = { state: "ok", own: false }; touch(); })
    .catch((e) => { templatesPart = loadFailure(e); touch(); });
  return booting;
}

/** Try again: loading until the re-read lands. */
export function retryTemplates(): Promise<void> {
  templatesPart = { state: "loading" };
  touch();
  return bootTemplates(true);
}

/** One server write, folded in at once, with a full re-read behind it — the
 *  same shape Team's `live` has, because these screens branch on one Result. */
async function live<R, T>(req: () => Promise<ApiResponseType<R>>, apply: (r: R) => T): Promise<Result<T>> {
  try {
    const out = apply(await call(req()));
    touch();
    void bootTemplates(true);
    return ok(out);
  } catch (e) {
    return err("refused", errMessage(e));
  }
}

const putTemplate = (row: AgreementTemplateRow): Template => {
  const t = toTemplate(row);
  templates = templates.filter((x) => x.templateId !== t.templateId).concat([t]);
  return t;
};

/* ------------------------------------------------------------------ reads -- */

/** Active first, then drafts, then the retired — state is what a reader is
 *  looking for, and a retired template between two live ones is noise. */
const RANK: Record<string, number> = { active: 0, draft: 1, retired: 2 };
export const readTemplates = (): Template[] =>
  templates.slice().sort((a, b) =>
    (RANK[a.state] - RANK[b.state]) || (a.title < b.title ? -1 : 1));

export const templateOf = (id: string): Template | null =>
  templates.filter((t) => t.templateId === id)[0] || null;

export const agreementOf = (id: string): Agreement | null =>
  readAgreements().filter((a) => a.agreementId === id)[0] || null;

/** Every agreement ever made from this template, newest first. */
export const sentFrom = (templateId: string): Agreement[] =>
  readAgreements()
    .filter((a) => a.templateId === templateId)
    .slice()
    .sort((a, b) => (String(a.sentAt) < String(b.sentAt) ? 1 : -1));

/** Every agreement, newest first. The cross-member view the member page cannot
 *  give, because it is a page about one person. */
export const allAgreements = (): Agreement[] =>
  readAgreements().slice().sort((a, b) => (String(a.sentAt) < String(b.sentAt) ? 1 : -1));

export interface Totals { sent: number; signed: number; waiting: number; revoked: number }

/** WAITING IS THREE DERIVED STATES, not the raw `sent` one: a copy that has
 *  been opened is still waiting, and so is one the member signed without
 *  naming themselves (`pending_signature`). The stat cell counts this and the
 *  list now FILTERS on it — they used to disagree, so pressing "waiting · 5"
 *  opened a list of 3. */
export const isWaiting = (a: Agreement): boolean => {
  const s = stateOf(a);
  return s === "sent" || s === "viewed" || s === "pending_signature";
};

export function totalsOf(list: Agreement[]): Totals {
  /* Every copy lands in exactly one bucket, so the parts always sum to the
     whole: `stateOf` already folds an out-of-date link into "expired" and a
     `signed` row with nobody named into "pending signature" — counting the
     raw `a.state` here instead double-booked an expired copy into both
     "waiting" and "expired", which is why the totals line could read more
     states than there were documents. */
  return {
    sent: list.length,
    signed: list.filter((a) => stateOf(a) === "signed").length,
    waiting: list.filter(isWaiting).length,
    revoked: list.filter((a) => a.state === "revoked").length,
  };
}

/** Out for signature and past its date. It is not a state — an expiry is a fact
 *  about today, and storing it would need a sweep and would be wrong between
 *  sweeps. The same reading attendance uses for an unclosed day. */
export const isExpired = (a: Agreement, today = TODAY): boolean =>
  (a.state === "sent" || a.state === "viewed")
  && !!a.expiresAt && a.expiresAt < today;

/* ------------------------------------------------------------- the body -- */

/** THE DOCUMENT, AS TEXT. One place, because the sheet on screen, the copy
 *  frozen at send and anything printed later must be the same string. */
export function renderBody(clauses: Clause[], name: string, date: string): Clause[] {
  const fill = (t: string) => t
    .split("{{name}}").join(name)
    .split("{{date}}").join(fmtDate(date));
  return clauses.map((c) => ({ ...c, heading: fill(c.heading), text: fill(c.text) }));
}

/** What a member will actually read. Falls back to the template's current text
 *  for the seeded agreements, which carry no frozen body — and the screen says
 *  so rather than passing today's wording off as what was signed. */
export function bodyOf(a: Agreement): { clauses: Clause[]; frozen: boolean } {
  if (a.body) {
    try {
      return { clauses: JSON.parse(a.body) as Clause[], frozen: true };
    } catch { /* fall through to the template */ }
  }
  const t = a.templateId ? templateOf(a.templateId) : null;
  const m = readMember(a.memberId);
  return {
    clauses: t ? renderBody(t.clauses, m ? m.name : "the member", a.sentAt || TODAY) : [],
    frozen: false,
  };
}

/* ------------------------------------------------------------- the link -- */

/** One link, one agreement. It carries the agreement's own token — which the
 *  Team store already minted — so what comes back attributes itself and cannot
 *  be replayed against a different document. */
export function signLink(a: Agreement): string {
  const base = String(config.FRONTEND_URL || "").replace(/\/+$/, "");
  return (base || "https://interiorbazzar.com") + "/sign/" + a.token;
}

/** A link is worth sending while the document is out and not expired. A signed
 *  one has nothing left to do and a revoked one will refuse. */
export const isSendable = (a: Agreement): boolean =>
  (a.state === "sent" || a.state === "viewed") && !isExpired(a);

/* ----------------------------------------------------------------- writes -- */
/* Server writes. Every refusal below is the one the server has no reason to
   know about; the rest — an empty title, a clause with no text, a retired
   template, a template something has been sent from — are its own. */

export interface TemplateDraft {
  title: string;
  kind: string;
  purpose: string;
  clauses: Clause[];
}

const bad = (d: TemplateDraft): string | null => {
  if (!d.title.trim()) return "Give it a title. It is what the member sees at the top.";
  if (!d.clauses.length) return "Add at least one clause. There is nothing to sign otherwise.";
  const blank = d.clauses.filter((c) => !c.text.trim()).length;
  if (blank) return blank === 1
    ? "One clause has no text."
    : blank + " clauses have no text.";
  return null;
};

/** A NEW TEMPLATE IS A DRAFT, and this one really is a draft: unlike a resource,
 *  sending an agreement is a deliberate second act, so there is nothing for a
 *  new template to be prematurely open to. */
export function createTemplate(d: TemplateDraft): Promise<Result<Template>> {
  const why = bad(d);
  if (why) return Promise.resolve(err("invalid", why));
  return live(() => AdminOpsService.createAgreementTemplate({
    title: d.title.trim(), kind: d.kind, purpose: d.purpose.trim(),
    clauses: d.clauses.map((c) => ({ clauseId: c.clauseId, heading: c.heading, text: c.text })),
  }), putTemplate);
}

/** THE VERSION BUMP. Editing the clauses of a template that has ever been sent
 *  makes a new version; the copies already out there keep the wording they went
 *  out with. Editing only the title or the purpose does not bump — neither is
 *  something anybody signed. */
export function updateTemplate(id: string, d: TemplateDraft): Promise<Result<Template>> {
  const why = bad(d);
  if (why) return Promise.resolve(err("invalid", why));
  const t = templateOf(id);
  if (!t) return Promise.resolve(err("not_found", "No such template."));
  if (t.state === "retired") return Promise.resolve(err("retired", "This template is retired. Reinstate it to edit."));
  /* THE VERSION BUMP is the server's: it knows what has been sent from this
     template, and a count this tab happens to hold is not that fact. */
  return live(() => AdminOpsService.updateAgreementTemplate(id, {
    title: d.title.trim(), kind: d.kind, purpose: d.purpose.trim(),
    clauses: d.clauses.map((c) => ({ clauseId: c.clauseId, heading: c.heading, text: c.text })),
  }), putTemplate);
}

const setState = (id: string, state: TemplateState, already: string): Promise<Result<Template>> => {
  const t = templateOf(id);
  if (!t) return Promise.resolve(err("not_found", "No such template."));
  if (t.state === state) return Promise.resolve(err("already_" + state, already));
  return live(() => AdminOpsService.updateAgreementTemplate(id, { state }), putTemplate);
};

export const activateTemplate = (id: string): Promise<Result<Template>> =>
  setState(id, "active", "It is already in use.");

/** Retiring stops it being sent and keeps every copy already signed. It is not
 *  a delete, and there is no delete for anything that has been sent. */
export const retireTemplate = (id: string): Promise<Result<Template>> =>
  setState(id, "retired", "It is already retired.");

export function deleteTemplate(id: string): Promise<Result<string>> {
  const t = templateOf(id);
  if (!t) return Promise.resolve(err("not_found", "No such template."));
  return live(() => AdminOpsService.deleteAgreementTemplate(id), (r) => {
    templates = templates.filter((x) => x.templateId !== r.key);
    return r.key;
  });
}

/** SEND ONE COPY TO ONE MEMBER. The body is rendered and frozen here, which is
 *  the moment the template stops mattering to this document. */
export function sendTemplate(templateId: string, memberId: string): Promise<Result<Agreement>> {
  const refuse = (code: string, message: string) => Promise.resolve(err(code, message));
  const t = templateOf(templateId);
  if (!t) return refuse("not_found", "No such template.");
  if (t.state !== "active")
    return refuse("not_active", t.state === "draft"
      ? "This template is still a draft. Put it in use before sending it."
      : "This template is retired and cannot be sent.");
  const m = readMember(memberId);
  if (!m) return refuse("member_not_found", "No such member.");
  /* One live copy per person per template. A second would give them two links
     to the same obligation and no rule for which signature counts. */
  const live = sentFrom(templateId).filter((a) =>
    a.memberId === memberId && a.state !== "revoked");
  if (live.length)
    return refuse("already_out", live[0].state === "signed"
      ? m.name + " has already signed this one."
      : m.name + " already has this out for signature. Revoke it first to send a new copy.");
  const body = renderBody(t.clauses, m.name, TODAY);
  return sendAgreement(memberId, t.kind, t.title, {
    templateId: t.templateId,
    body: JSON.stringify(body),
    version: t.version,
  });
}

/* ------------------------------------------------------------------ hooks -- */

function useVersion() {
  const [, set] = useState(version);
  useEffect(() => {
    const f = () => set(version);
    listeners.add(f);
    /* The first subscriber starts the load, the way Team's store does — any
       face that reads the wording gets live rows without asking for them. */
    void bootTemplates();
    return () => { listeners.delete(f); };
  }, []);
}

export function useTemplates(): Template[] { useVersion(); return templates; }
export function useTemplatesLoad(): LoadPart { useVersion(); return templatesPart; }

/* --------------------------------------------------------------- helpers -- */

/** The date the preview fills in. Today, because a template is written to be
 *  sent — showing a placeholder date in a preview whose whole job is to show
 *  the sentence that ships would defeat it. */
export const TODAY_PLACEHOLDER = TODAY;

export const emptyClause = (): Clause =>
  ({ clauseId: nextId("C"), heading: "", text: "" });

export const AGREEMENT_STATE_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Opened", signed: "Signed",
  pending_signature: "Pending signature",
  revoked: "Revoked", expired: "Expired",
  /* Not a stored state — the strip's bucket, named so the filter it sets
     reads as words rather than as a slug. */
  waiting: "Waiting",
};

/** What a reader needs to know in one word, expiry included — which is derived
 *  and therefore never in the stored state.
 *
 *  "Signed" is a claim about a person, not a flag: a record whose state says
 *  `signed` but carries no `signedName` has no signer to point to, so it reads
 *  as still pending rather than contradicting itself on screen. */
export const stateOf = (a: Agreement): string =>
  isExpired(a) ? "expired" : a.state === "signed" && !a.signedName ? "pending_signature" : a.state;

export const STATE_TONE: Record<string, string> = {
  draft: "", sent: "info", viewed: "info", signed: "ok", pending_signature: "info",
  revoked: "", expired: "warn",
};

export const fmtWhen = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return fmtDate(iso) + " · " + hh + ":" + mm;
};
