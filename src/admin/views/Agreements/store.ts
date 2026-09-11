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

   NO API YET — templates come from src/content/agreements/templates.json and
   the agreements from src/content/team/agreements.json, and those two files are
   the only thing either store knows about their origin.
   ============================================================================= */
import { useEffect, useState } from "react";
import config from "../../../config";
import templatesDoc from "../../../content/agreements/templates.json";
import {
  AGREEMENT_KIND, TODAY, fmtDate, labelOf, meId, readAgreements, readMember, readMembers,
  revokeAgreement, sendAgreement, signAgreement, toneOf, useAgreements,
} from "../Team/store";
import type { Agreement, Member, Result } from "../Team/store";

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
  templateId: string;
  title: string;
  kind: string;
  purpose: string;
  state: TemplateState;
  /** Bumped by any edit to the clauses once the template has ever been sent. */
  version: number;
  clauses: Clause[];
  createdAt: string;
  createdById: string;
}

/* ------------------------------------------------------------------ store -- */

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let templates: Template[] = clone(templatesDoc.templates) as unknown as Template[];

let version = 0;
const listeners = new Set<() => void>();
const touch = () => { version++; listeners.forEach((f) => f()); };

export function resetTemplates() {
  templates = clone(templatesDoc.templates) as unknown as Template[];
  touch();
}

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

export function totalsOf(list: Agreement[]): Totals {
  return {
    sent: list.length,
    signed: list.filter((a) => a.state === "signed").length,
    waiting: list.filter((a) => a.state === "sent" || a.state === "viewed").length,
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
/* SIMULATED, like every other frontend-first module here: these write memory and
   return the shape the live calls will. */

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

export function createTemplate(d: TemplateDraft): Result<Template> {
  const why = bad(d);
  if (why) return err("invalid", why);
  const t: Template = {
    templateId: nextId("TPL"),
    title: d.title.trim(),
    kind: d.kind,
    purpose: d.purpose.trim(),
    /* A DRAFT, and this one really is a draft: unlike a resource, sending an
       agreement is a deliberate second act, so there is nothing for a new
       template to be prematurely open to. */
    state: "draft",
    version: 1,
    clauses: clone(d.clauses),
    createdAt: TODAY + "T00:00:00+05:30",
    createdById: meId(),
  };
  templates = templates.concat([t]);
  touch();
  return ok(t);
}

/** THE VERSION BUMP. Editing the clauses of a template that has ever been sent
 *  makes a new version; the copies already out there keep the wording they went
 *  out with. Editing only the title or the purpose does not bump — neither is
 *  something anybody signed. */
export function updateTemplate(id: string, d: TemplateDraft): Result<Template> {
  const why = bad(d);
  if (why) return err("invalid", why);
  const t = templateOf(id);
  if (!t) return err("not_found", "No such template.");
  if (t.state === "retired") return err("retired", "This template is retired. Reinstate it to edit.");
  const changed = JSON.stringify(t.clauses) !== JSON.stringify(d.clauses);
  const everSent = sentFrom(id).length > 0;
  const next: Template = {
    ...t,
    title: d.title.trim(),
    kind: d.kind,
    purpose: d.purpose.trim(),
    clauses: clone(d.clauses),
    version: changed && everSent ? t.version + 1 : t.version,
  };
  templates = templates.map((x) => (x.templateId === id ? next : x));
  touch();
  return ok(next);
}

export function activateTemplate(id: string): Result<Template> {
  const t = templateOf(id);
  if (!t) return err("not_found", "No such template.");
  if (t.state === "active") return err("already_active", "It is already in use.");
  const next: Template = { ...t, state: "active" };
  templates = templates.map((x) => (x.templateId === id ? next : x));
  touch();
  return ok(next);
}

/** Retiring stops it being sent and keeps every copy already signed. It is not
 *  a delete, and there is no delete for anything that has been sent. */
export function retireTemplate(id: string): Result<Template> {
  const t = templateOf(id);
  if (!t) return err("not_found", "No such template.");
  if (t.state === "retired") return err("already_retired", "It is already retired.");
  const next: Template = { ...t, state: "retired" };
  templates = templates.map((x) => (x.templateId === id ? next : x));
  touch();
  return ok(next);
}

export function deleteTemplate(id: string): Result<string> {
  const t = templateOf(id);
  if (!t) return err("not_found", "No such template.");
  const n = sentFrom(id).length;
  if (n) return err("has_sent", "It has been sent " + n + (n === 1 ? " time" : " times")
    + ". Retire it instead — deleting would leave those signatures pointing at nothing.");
  templates = templates.filter((x) => x.templateId !== id);
  touch();
  return ok(id);
}

/** SEND ONE COPY TO ONE MEMBER. The body is rendered and frozen here, which is
 *  the moment the template stops mattering to this document. */
export function sendTemplate(templateId: string, memberId: string): Result<Agreement> {
  const t = templateOf(templateId);
  if (!t) return err("not_found", "No such template.");
  if (t.state !== "active")
    return err("not_active", t.state === "draft"
      ? "This template is still a draft. Put it in use before sending it."
      : "This template is retired and cannot be sent.");
  const m = readMember(memberId);
  if (!m) return err("member_not_found", "No such member.");
  /* One live copy per person per template. A second would give them two links
     to the same obligation and no rule for which signature counts. */
  const live = sentFrom(templateId).filter((a) =>
    a.memberId === memberId && a.state !== "revoked");
  if (live.length)
    return err("already_out", live[0].state === "signed"
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
    return () => { listeners.delete(f); };
  }, []);
}

export function useTemplates(): Template[] { useVersion(); return templates; }

/* --------------------------------------------------------------- helpers -- */

/** The date the preview fills in. Today, because a template is written to be
 *  sent — showing a placeholder date in a preview whose whole job is to show
 *  the sentence that ships would defeat it. */
export const TODAY_PLACEHOLDER = TODAY;

export const emptyClause = (): Clause =>
  ({ clauseId: nextId("C"), heading: "", text: "" });

export const AGREEMENT_STATE_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", viewed: "Opened", signed: "Signed",
  revoked: "Revoked", expired: "Expired",
};

/** What a reader needs to know in one word, expiry included — which is derived
 *  and therefore never in the stored state. */
export const stateOf = (a: Agreement): string =>
  isExpired(a) ? "expired" : a.state;

export const STATE_TONE: Record<string, string> = {
  draft: "", sent: "info", viewed: "info", signed: "ok",
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
