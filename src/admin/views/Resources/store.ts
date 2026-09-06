/* =============================================================================
   Resources — the data module.
   -----------------------------------------------------------------------------
   A RESOURCE IS A FORM PLUS A DEPARTMENT. The form is the fields; the department
   is who has to fill them in. Keeping the two in one record is the point of the
   module: "the onboarding pack" and "everyone in Sales" are one thing an operator
   sets up once, not a template plus a distribution list somebody has to remember
   to re-send.

   THE DEPARTMENT IS A RULE, EVALUATED AT READ TIME — never a stored list of ids.
   The day somebody joins Sales they are inside the onboarding audience, with no
   write anywhere. The consequence is the one worth stating: **pending is not a
   record.** It is the audience minus the responses, computed in `rowsFor` below
   and nowhere else, exactly as attendance derives `absent` from the roster minus
   the days that exist. A stored "pending" row would need writing every time the
   roster moved, and would let a count disagree with the list it drills into.

   IT WAS FOUR AXES AND IS NOW ONE. `audience` carried departments, designations,
   a joined-after date and a list of named people. Every one of them worked, and
   between them they made the commonest job — send this to Sales — a four-control
   decision. One department, or none meaning everybody, answers it in one control
   and keeps the rule readable in a table cell. The narrower rules are recoverable
   if a real case turns up; four controls waiting for that case were not free.

   THE ROSTER IS TEAM'S, NOT OURS. `audienceOf` reads Team's store directly. A
   second roster here would be a second front door to one room — the same reason
   there is no `me` module beside `#/team/:id`.

   A SUBMITTED ANSWER IS FROZEN, and it carries its own label. Editing the fields
   of a resource that already has responses bumps `version`; the old response
   keeps its version and the labels it was answered under, so it still reads
   correctly after two edits. This is the rule Agreements already lives by, and
   it is enforced here in `updateResource` rather than left to a reviewer.

   THE LINK IS HOW A RESOURCE REACHES SOMEBODY. There is no notification path and
   there is not going to be one: a resource is opened and its link is sent, by a
   person, to a person. The link carries BOTH ids — the resource and the member —
   because a link that only named the form would come back as an answer from
   nobody, and attributing it afterwards is guesswork. One link, one member, one
   submission, and the profile link is free.

   WHAT COMES BACK IS OFTEN A FILE. A `file` field's answer is a FileAnswer — name,
   type, size and url — and not a filename string, because the panel has to be able
   to say what it is holding and open it. `accept` on the field is what the upload
   page will enforce and what this panel prints so the member knows before they try.

   THE UPLOAD PAGE ITSELF IS NOT HERE. The link points at the member dashboard, and
   that is deliberate: this panel is where a resource is built, sent and read, not
   where it is filled in. Until that page exists the link resolves to nothing, and
   the screen says so rather than implying otherwise.

   NO API YET — everything comes from src/content/resources/*.json, and this file
   is the only one that knows that. See src/proto/v-2.2.0.0/BACKEND-INTEGRATION.md.
   ============================================================================= */
import { useEffect, useState } from "react";
import formsDoc from "../../../content/resources/forms.json";
import responsesDoc from "../../../content/resources/responses.json";
import vocabDoc from "../../../content/resources/vocabularies.json";
import config from "../../../config";
import { TODAY, meId, readMembers } from "../Team/store";
import type { Member } from "../Team/store";

/* ------------------------------------------------------------------ types -- */

export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "file";
/** FOUR STATES, AND THE LAST TWO ARE NOT THE SAME THING. `closed` is "we have
 *  finished collecting" — a round that ended, and might be reopened for another.
 *  `outdated` is "this form is wrong now" — superseded, kept for the record, and
 *  never to be sent again. Both refuse submissions; they differ in what you do
 *  next, which is the only reason a state is worth having.
 *
 *  If that distinction ever stops being used in practice, collapse them — two
 *  states nobody can tell apart are worse than one. */
export type ResourceState = "draft" | "open" | "closed" | "outdated";
export type RowState = "submitted" | "pending";

/** What a `file` field will take. Empty means anything. These are groups, not
 *  extensions, because a member reads "PDF or an image" and a browser reads an
 *  accept attribute — `ACCEPT_MIME` below is the one place they are mapped. */
export type AcceptKind = "pdf" | "image" | "doc" | "sheet";

export interface ResourceField {
  fieldId: string;
  type: FieldType;
  label: string;
  help: string | null;
  required: boolean;
  /** `select` only. Empty for every other type. */
  options: string[];
  /** `file` only. Empty means any type. */
  accept: AcceptKind[];
  /** `file` only. Megabytes. A cap the member is told BEFORE they pick a file,
   *  because the alternative is a 40 MB upload that fails at the end of itself. */
  maxMb: number | null;
}

/** WHAT CAME BACK, when what came back was a file. It carries its own name, type
 *  and size so the panel can say what it is holding without fetching it — a row
 *  that has to download a PDF to find out it is a PDF is a row that stays blank
 *  on a slow connection. */
export interface FileAnswer {
  fileName: string;
  mimeType: string;
  sizeKb: number;
  /** MUST become a signed, expiring read. See BACKEND-INTEGRATION.md § Module 8. */
  url: string;
}

export interface Resource {
  resourceId: string;
  title: string;
  description: string;
  /** Free text, not an enum. What an operator calls this thing in their own head
   *  — the seeded suggestions are a starting point and never a closed list. */
  tags: string[];
  /** THE CONDITION. Any member in ANY of these departments; an EMPTY list is
   *  every active member, not none. It is free text and typed as chips, the
   *  same control tags use — the roster's own departments are offered as
   *  suggestions but a name that is not on it is accepted, because a
   *  department can exist before anybody is filed under it. */
  departments: string[];
  state: ResourceState;
  version: number;
  fields: ResourceField[];
  createdAt: string;
  createdById: string;
  openedAt: string | null;
  closedAt: string | null;
}

/** `value` is always readable text — for a file it is the file's name — so every
 *  reader can print an answer without knowing its type. `file` is the structured
 *  half, present only for a file field, and it is what a reader uses to OPEN the
 *  thing rather than merely name it. */
export interface Answer {
  fieldId: string;
  label: string;
  value: string;
  file?: FileAnswer | null;
}

export interface ResourceResponse {
  responseId: string;
  resourceId: string;
  /** The version answered. Never the resource's current version. */
  version: number;
  memberId: string;
  submittedAt: string;
  answers: Answer[];
}

/** One line of a resource's table: a person in the audience, and what they did
 *  about it. `response` is null for everybody who has not answered — that null
 *  IS the pending state, and there is no record behind it. */
export interface AudienceRow {
  member: Member;
  response: ResourceResponse | null;
  state: RowState;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const err = (code: string, message: string): Result<never> => ({ ok: false, code, message });

/* ------------------------------------------------------------- vocabulary -- */

export interface ToneRow { key: string; label: string; tone?: string }
const toneMap = (rows: ToneRow[]) => {
  const out: Record<string, { label: string; tone: string }> = {};
  rows.forEach((r) => { out[r.key] = { label: r.label, tone: r.tone || "" }; });
  return out;
};

export const VOCAB = vocabDoc as unknown as Record<string, ToneRow[]>;
/** SUGGESTIONS, NOT A VOCABULARY. Tags are free text; these are the ones worth
 *  offering on an empty field so nobody has to invent a word for "onboarding". */
export const TAG_SUGGESTIONS = (VOCAB.tagSuggestions || []).map((r) => r.label);
export const RESOURCE_STATE = toneMap(VOCAB.resourceStates);
export const ROW_STATE = toneMap(VOCAB.responseStates);
export const FIELD_TYPES = VOCAB.fieldTypes as unknown as { key: FieldType; label: string }[];

export const labelOf = (map: Record<string, { label: string }>, key: string) =>
  (map[key] || { label: key }).label;
export const toneOf = (map: Record<string, { tone: string }>, key: string) =>
  (map[key] || { tone: "" }).tone;

/** The two readings of an accept list: what the member is told, and what the
 *  file input is given. Both come from here so they cannot disagree. */
export const ACCEPT_MIME: Record<AcceptKind, string> = {
  pdf: ".pdf,application/pdf",
  image: "image/*",
  doc: ".doc,.docx,application/msword",
  sheet: ".csv,.xls,.xlsx,text/csv",
};
export const ACCEPT_LABEL: Record<AcceptKind, string> = {
  pdf: "PDF", image: "image", doc: "document", sheet: "spreadsheet",
};
export const ACCEPT_KINDS = Object.keys(ACCEPT_MIME) as AcceptKind[];

/** "PDF or an image" — the sentence, not the list. An empty accept is any file,
 *  and saying so is better than saying nothing and letting somebody guess. */
export function acceptLine(accept: AcceptKind[]): string {
  if (!accept.length) return "Any file";
  const names = accept.map((a) => ACCEPT_LABEL[a] || a);
  if (names.length === 1) return cap(names[0]);
  return cap(names.slice(0, -1).join(", ") + " or " + names[names.length - 1]);
}
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const acceptAttr = (accept: AcceptKind[]): string | undefined =>
  accept.length ? accept.map((a) => ACCEPT_MIME[a]).join(",") : undefined;

export const typeLabel = (t: FieldType) =>
  (FIELD_TYPES.filter((f) => f.key === t)[0] || { label: t }).label;

/* ------------------------------------------------------------------ store -- */

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

interface Snap { resources: Resource[]; responses: ResourceResponse[] }

const seed = (): Snap => ({
  resources: clone(formsDoc.resources) as unknown as Resource[],
  responses: clone(responsesDoc.responses) as unknown as ResourceResponse[],
});

let snap: Snap = seed();

/** Bumped on every write so the hooks below re-render. */
let version = 0;
const listeners = new Set<() => void>();
const touch = () => { version++; listeners.forEach((f) => f()); };

/** Restores the authored seed. Used by the checks, never by a screen. */
export function resetStore() { snap = seed(); touch(); }

let seq = 0;
const nextId = (prefix: string) =>
  prefix + "-" + (Date.now().toString(36) + (seq++).toString(36)).toUpperCase();

/* ------------------------------------------------------------------ reads -- */

export const readResources = (): Resource[] => snap.resources;
export const readResponses = (): ResourceResponse[] => snap.responses;

export const resourceOf = (id: string): Resource | null =>
  snap.resources.filter((r) => r.resourceId === id)[0] || null;

export const responseOf = (id: string): ResourceResponse | null =>
  snap.responses.filter((r) => r.responseId === id)[0] || null;

/** Newest first — a response list is read to see what just came in. */
export const responsesFor = (resourceId: string): ResourceResponse[] =>
  snap.responses
    .filter((r) => r.resourceId === resourceId)
    .slice()
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

/** Every form this one person has answered. THE LINK TO THE PROFILE — the member
 *  page reads this and nothing else. */
export const responsesOfMember = (memberId: string): ResourceResponse[] =>
  snap.responses
    .filter((r) => r.memberId === memberId)
    .slice()
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

/** Resources ordered the way the tab strip shows them: open first, then draft,
 *  then closed, and inside each by title. State is what a reader is looking for;
 *  a closed form is history and should not sit between two live ones. */
/* Live first, then the one you are still writing, then the two that are done —
   and outdated last of all, because it is the only one that is telling you not
   to use it. */
const STATE_RANK: Record<string, number> = { open: 0, draft: 1, closed: 2, outdated: 3 };
export const orderedResources = (): Resource[] =>
  snap.resources.slice().sort((a, b) =>
    (STATE_RANK[a.state] - STATE_RANK[b.state]) || (a.title < b.title ? -1 : 1));

/* -------------------------------------------------------------- the rule -- */

/** THE CONDITION, EVALUATED. One place, because a count and the rows under it
 *  must never be computed by two different readings of the same rule.
 *
 *  Left members are out of every audience: a rule about who owes you a form
 *  cannot name somebody who has left, and their submitted responses are still
 *  readable on their own record. */
export function audienceOf(r: Pick<Resource, "departments">): Member[] {
  const want = r.departments || [];
  return readMembers()
    .filter((m) => m.status === "active")
    .filter((m) => !want.length || want.indexOf(m.department) >= 0)
    .sort((x, y) => (x.name < y.name ? -1 : 1));
}

/** NO DEPARTMENT IS EVERY DEPARTMENT, not none — the difference between a form
 *  that goes company-wide and one that goes nowhere, decided by an empty list.
 *  Read it the other way and nothing throws: the table is simply empty. */
export const isEveryone = (departments: string[]) => !departments.length;

/** The table. One row per person in the audience; `response` null is pending. */
export function rowsFor(r: Resource): AudienceRow[] {
  const byMember: Record<string, ResourceResponse> = {};
  responsesFor(r.resourceId).forEach((x) => {
    /* Newest wins if a member somehow answered twice — submitResponse refuses a
       second one, so this only matters for a seed or a server that allowed it. */
    if (!byMember[x.memberId]) byMember[x.memberId] = x;
  });
  return audienceOf(r).map((member) => {
    const response = byMember[member.memberId] || null;
    return { member, response, state: (response ? "submitted" : "pending") as RowState };
  });
}

/** A response from somebody no longer in the audience — the condition changed,
 *  or they left. It is still a real answer and it is not thrown away; it is
 *  listed apart so the completion count stays honest. */
export function strayResponses(r: Resource): ResourceResponse[] {
  const inAudience: Record<string, boolean> = {};
  audienceOf(r).forEach((m) => { inAudience[m.memberId] = true; });
  return responsesFor(r.resourceId).filter((x) => !inAudience[x.memberId]);
}

export interface Totals {
  audience: number; submitted: number; pending: number; pct: number; stray: number;
}

export function totalsFor(r: Resource): Totals {
  const rows = rowsFor(r);
  const submitted = rows.filter((x) => x.state === "submitted").length;
  return {
    audience: rows.length,
    submitted,
    pending: rows.length - submitted,
    pct: rows.length ? Math.round((submitted / rows.length) * 100) : 0,
    stray: strayResponses(r).length,
  };
}

/* ------------------------------------------------------------- the link -- */

/** ONE LINK, ONE MEMBER, ONE RESOURCE — never a link to the form alone.
 *
 *  A link that named only the form would come back as an answer from nobody,
 *  and working out afterwards who sent it is guesswork dressed as a record.
 *  Carrying the member means the submission attributes itself, the profile link
 *  is free, and the module's second refusal — no member answers twice — has
 *  something to refuse on.
 *
 *  THE TOKEN HERE IS NOT A SECRET AND IS NOT PRETENDING TO BE. It is derived
 *  from the two ids so a link is stable across reloads of a fixture, which is
 *  what makes it testable. The real one is minted server-side, single-use and
 *  expiring, and it is on the work-list as exactly that — see
 *  BACKEND-INTEGRATION.md § Module 8. Nothing in this panel should ever treat
 *  this string as authorisation.
 */
export function shareToken(resourceId: string, memberId: string): string {
  return "r" + resourceId.replace(/[^A-Za-z0-9]/g, "").toLowerCase()
    + "m" + memberId.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/** Where the member goes to fill it in. `FRONTEND_URL` is the public site and
 *  is genuinely absent in some builds — the render harness defines
 *  `import.meta.env` as `{}` — so it degrades to a readable host rather than to
 *  the string "undefined" in front of somebody about to paste it into a
 *  message. Same guard `profileUrl` in Users/store.ts uses, for the same
 *  reason. */
export function shareLink(resourceId: string, memberId: string): string {
  const base = String(config.FRONTEND_URL || "").replace(/\/+$/, "");
  return (base || "https://interiorbazzar.com") + "/r/" + shareToken(resourceId, memberId);
}

/** A link is only worth sending while the resource is open. Anything else has
 *  nothing to submit to, and handing somebody a link that will refuse them is
 *  worse than telling them it is not ready. */
export const isShareable = (r: Resource): boolean => r.state === "open";

/* ----------------------------------------------------------------- writes -- */
/* SIMULATED. Every one of these writes the in-memory snapshot and returns the
   same Result shape the live calls will, so going live is a swap inside this
   file and not a change to any screen. */

export interface ResourceDraft {
  title: string;
  description: string;
  tags: string[];
  departments: string[];
  fields: ResourceField[];
}

/** Every refusal names the thing to fix, in the words on screen. "Invalid input"
 *  tells somebody they are wrong without telling them where. */
const badDraft = (d: ResourceDraft): string | null => {
  if (!d.title.trim()) return "Give it a title. It is what the form is called everywhere else.";
  if (!d.fields.length) return "Add at least one field. A form with none has nothing to send back.";
  const blank = d.fields.filter((f) => !f.label.trim()).length;
  if (blank) return blank === 1
    ? "One field has no label. Every question needs one."
    : blank + " fields have no label. Every question needs one.";
  const emptyChoice = d.fields.filter((f) => f.type === "select" && !f.options.length).length;
  if (emptyChoice) return "A choice field needs at least one option.";
  const badCap = d.fields.filter((f) =>
    f.type === "file" && f.maxMb !== null && !(f.maxMb > 0)).length;
  if (badCap) return "A max size has to be more than zero megabytes.";
  return null;
};

export function createResource(d: ResourceDraft): Result<Resource> {
  const bad = badDraft(d);
  if (bad) return err("invalid", bad);
  const r: Resource = {
    resourceId: nextId("RES"),
    title: d.title.trim(),
    description: d.description.trim(),
    tags: cleanTags(d.tags),
    departments: cleanTags(d.departments),
    /* OPEN, NOT DRAFT. It was created as a draft for the first day on the
       reasoning that nothing should go out by accident — but nothing goes out
       at all: there is no notification, and the only thing that reaches anybody
       is a link a person copies and sends. A draft state in front of that is a
       step with nothing behind it, and it made a brand-new resource invisible on
       the one table this module has. `draft` still exists and `closeResource`
       still works; nothing arrives in it by default any more. */
    state: "open",
    version: 1,
    fields: clone(d.fields),
    createdAt: TODAY + "T00:00:00+05:30",
    createdById: meId(),
    openedAt: TODAY + "T00:00:00+05:30",
    closedAt: null,
  };
  snap.resources = snap.resources.concat([r]);
  touch();
  return ok(r);
}

/** THE VERSION BUMP LIVES HERE. Editing the fields of a resource somebody has
 *  already answered makes a new version rather than rewriting the old one — a
 *  response is evidence, and evidence that changes shape later is not evidence.
 *  Editing only the title, purpose or audience does NOT bump: none of those is
 *  something anybody answered. */
export function updateResource(id: string, d: ResourceDraft): Result<Resource> {
  const bad = badDraft(d);
  if (bad) return err("invalid", bad);
  const list = snap.resources.slice();
  const r = list.filter((x) => x.resourceId === id)[0];
  if (!r) return err("not_found", "No such resource.");
  if (r.state === "closed") return err("closed", "This resource is closed. Reopen it to edit.");
  const fieldsChanged = JSON.stringify(r.fields) !== JSON.stringify(d.fields);
  const answered = responsesFor(id).length > 0;
  const next: Resource = {
    ...r,
    title: d.title.trim(),
    description: d.description.trim(),
    tags: cleanTags(d.tags),
    departments: cleanTags(d.departments),
    fields: clone(d.fields),
    version: fieldsChanged && answered ? r.version + 1 : r.version,
  };
  snap.resources = list.map((x) => (x.resourceId === id ? next : x));
  touch();
  return ok(next);
}

export function openResource(id: string): Result<Resource> {
  const list = snap.resources.slice();
  const r = list.filter((x) => x.resourceId === id)[0];
  if (!r) return err("not_found", "No such resource.");
  if (r.state === "open") return err("already_open", "It is already open.");
  const next: Resource = {
    ...r,
    state: "open",
    closedAt: null,
    openedAt: r.openedAt || TODAY + "T00:00:00+05:30",
  };
  snap.resources = list.map((x) => (x.resourceId === id ? next : x));
  touch();
  return ok(next);
}

/** Closing stops new submissions and keeps every one already made. It is not a
 *  delete, and there is no delete for anything answered. */
export function closeResource(id: string): Result<Resource> {
  const list = snap.resources.slice();
  const r = list.filter((x) => x.resourceId === id)[0];
  if (!r) return err("not_found", "No such resource.");
  if (r.state === "closed") return err("already_closed", "It is already closed.");
  const next: Resource = { ...r, state: "closed", closedAt: TODAY + "T00:00:00+05:30" };
  snap.resources = list.map((x) => (x.resourceId === id ? next : x));
  touch();
  return ok(next);
}

/** MARK IT WRONG, not merely finished. An outdated resource keeps every answer
 *  and stops being something anybody should send — it sorts last, it refuses
 *  submissions, and its links stop working. Reopening undoes it, because a form
 *  marked outdated by mistake should not need rebuilding. */
export function outdateResource(id: string): Result<Resource> {
  const list = snap.resources.slice();
  const r = list.filter((x) => x.resourceId === id)[0];
  if (!r) return err("not_found", "No such resource.");
  if (r.state === "outdated") return err("already_outdated", "It is already marked outdated.");
  const next: Resource = { ...r, state: "outdated", closedAt: TODAY + "T00:00:00+05:30" };
  snap.resources = list.map((x) => (x.resourceId === id ? next : x));
  touch();
  return ok(next);
}

/** START AGAIN FROM ONE THAT WORKED. The commonest reason a resource goes
 *  outdated is that a new version of it is needed, so the action that replaces
 *  it is next to the one that retires it. The copy is a DRAFT and carries no
 *  responses — it is a new form, not a fork of an old one's history. */
export function duplicateResource(id: string): Result<Resource> {
  const r = resourceOf(id);
  if (!r) return err("not_found", "No such resource.");
  const copy: Resource = {
    ...clone(r),
    resourceId: nextId("RES"),
    title: r.title + " (copy)",
    state: "draft",
    version: 1,
    createdAt: TODAY + "T00:00:00+05:30",
    createdById: meId(),
    openedAt: null,
    closedAt: null,
  };
  snap.resources = snap.resources.concat([copy]);
  touch();
  return ok(copy);
}

/** A RESOURCE NOBODY ANSWERED CAN GO, whatever state it is in — an open form
 *  with no takers is a mistake to be cleared away, not a record to be kept.
 *
 *  One that HAS answers cannot, and the refusal says how many and what to do
 *  instead: those answers are the record of what people were asked, and a
 *  cascade that quietly took nine submissions with one click is not a delete
 *  button, it is a trap. Deleting the responses first is a deliberate act with
 *  its own confirmation, and afterwards this succeeds. */
export function deleteResource(id: string): Result<string> {
  const r = resourceOf(id);
  if (!r) return err("not_found", "No such resource.");
  const n = responsesFor(id).length;
  if (n)
    return err("has_responses", "It holds " + n + (n === 1 ? " response" : " responses")
      + ". Delete " + (n === 1 ? "it" : "them") + " first, or mark this outdated to retire it and keep the record.");
  snap.resources = snap.resources.filter((x) => x.resourceId !== id);
  touch();
  return ok(id);
}

/** DELETING A SUBMISSION IS HOW SPACE IS FREED, and it is the only thing in this
 *  module that destroys evidence — so it returns what it reclaimed, in kilobytes,
 *  and the screen says the number out loud afterwards. An answer removed is a
 *  question that reads as never asked; the person goes back to pending and their
 *  link works again, which is the honest consequence and not a side effect to
 *  hide.
 *
 *  The files go with it. A response deleted while its uploads stayed on a disk
 *  would free nothing and leave a PAN card behind — the server must unlink the
 *  objects in the same transaction. */
export function deleteResponse(id: string): Result<number> {
  const x = responseOf(id);
  if (!x) return err("not_found", "No such response.");
  const freedKb = x.answers.reduce((a, an) => a + (an.file ? an.file.sizeKb : 0), 0);
  snap.responses = snap.responses.filter((y) => y.responseId !== id);
  touch();
  return ok(freedKb);
}

export function submitResponse(
  resourceId: string, memberId: string, values: Record<string, string>,
  files?: Record<string, FileAnswer>,
): Result<ResourceResponse> {
  const r = resourceOf(resourceId);
  if (!r) return err("not_found", "No such resource.");
  if (r.state !== "open") return err("not_open", r.state === "outdated"
    ? "This resource is marked outdated. Nothing more can be submitted to it."
    : "This resource is not open for submissions.");
  if (responsesFor(resourceId).filter((x) => x.memberId === memberId).length)
    return err("already_submitted", "That member has already submitted this one.");
  /* A file field is answered by its FILE, not by the text beside it — a required
     upload with a filename typed into it and nothing attached is not answered. */
  const given = (f: ResourceField) => (f.type === "file"
    ? !!(files && files[f.fieldId])
    : !!String(values[f.fieldId] || "").trim());
  const missing = r.fields.filter((f) => f.required && !given(f)).map((f) => f.label);
  /* THE CAP IS ENFORCED, not merely printed. A limit shown on the form and not
     checked on the way in is a suggestion, and the server has to check it too —
     this one only stops an honest mistake reaching the store. */
  const tooBig = r.fields.filter((f) => {
    const up = files && files[f.fieldId];
    return f.type === "file" && up && f.maxMb !== null && up.sizeKb > f.maxMb * 1024;
  })[0];
  if (tooBig) {
    const up = files![tooBig.fieldId];
    return err("too_big", "“" + tooBig.label + "” takes files up to "
      + tooBig.maxMb + " MB. That one is " + fmtSize(up.sizeKb) + ".");
  }
  if (missing.length)
    return err("incomplete", missing.length === 1
      ? "“" + missing[0] + "” is required."
      : missing.length + " required fields are empty, starting with “" + missing[0] + "”.");
  const x: ResourceResponse = {
    responseId: nextId("RSP"),
    resourceId,
    version: r.version,
    memberId,
    submittedAt: TODAY + "T00:00:00+05:30",
    /* The label is copied, not referenced. See the header. And a file answer
       keeps BOTH: `value` is the name so every reader can print it without
       knowing the type, `file` is the thing itself. */
    answers: r.fields.map((f) => {
      const file = f.type === "file" && files ? files[f.fieldId] || null : null;
      return {
        fieldId: f.fieldId,
        label: f.label,
        value: file ? file.fileName : String(values[f.fieldId] || ""),
        file,
      };
    }),
  };
  snap.responses = snap.responses.concat([x]);
  touch();
  return ok(x);
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

export function useResources(): Resource[] { useVersion(); return snap.resources; }
export function useResponses(): ResourceResponse[] { useVersion(); return snap.responses; }

/* --------------------------------------------------------------- helpers -- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return String(d.getDate()).padStart(2, "0") + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
};

/** Who it goes to, in a table cell. It says what the rule IS, never how many it
 *  matched — the count sits beside it and both come from the same call. */
export const audienceLine = (departments: string[]): string =>
  departments.length ? departments.join(" · ") : "Everyone";

/** Trimmed, de-duplicated, case-insensitively, order kept. Typing "Onboarding"
 *  under an existing "onboarding" should not make a second tag. */
export function cleanTags(tags: string[]): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  tags.forEach((t) => {
    const v = t.trim();
    const k = v.toLowerCase();
    if (!v || seen[k]) return;
    seen[k] = true;
    out.push(v);
  });
  return out;
}

/** Every tag anybody has used, so the builder can offer them back rather than
 *  letting the same idea be spelled three ways. */
export const tagsInUse = (): string[] =>
  cleanTags(snap.resources.reduce((a: string[], r) => a.concat(r.tags), [])).sort();

/** Every department any resource already points at, offered beside the roster's
 *  own — a form may be aimed at one that has nobody in it yet, and that name
 *  should not have to be retyped from memory the second time. */
export const departmentsNamed = (): string[] =>
  cleanTags(snap.resources.reduce((a: string[], r) => a.concat(r.departments), [])).sort();

/** The distinct values the roster actually has, so the builder offers a real
 *  department rather than a free-text box somebody misspells. */
/** The departments the roster actually has, so the picker offers a real one
 *  rather than a free-text box somebody misspells — while still accepting a new
 *  name, because a department can exist before anybody is filed under it. */
export const departmentsInUse = (): string[] =>
  Array.from(new Set(readMembers()
    .filter((m) => m.status === "active")
    .map((m) => m.department)
    .filter(Boolean))).sort();

/** Every file anybody has sent in, newest first. What the module holds, read as
 *  a pile of documents rather than as a set of forms — the question "has their
 *  PAN come in yet" is asked about the file, not about the form around it. */
export interface FileRow { file: FileAnswer; answer: Answer; response: ResourceResponse }
export function filesIn(responses: ResourceResponse[]): FileRow[] {
  const out: FileRow[] = [];
  responses.forEach((response) => response.answers.forEach((answer) => {
    if (answer.file) out.push({ file: answer.file, answer, response });
  }));
  return out;
}

/** 940 KB, 1.4 MB. A size in kilobytes past a thousand stops being a size and
 *  becomes a number to count the digits of. */
export const fmtSize = (kb: number): string =>
  kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : Math.round(kb) + " KB";

/** What this module is holding, in kilobytes. Uploads only — the answers
 *  themselves are rows and rounding them into a storage figure would make the
 *  number mean nothing. It is what makes "free the space" a real claim rather
 *  than a word on a button. */
export const storageOf = (responses: ResourceResponse[]): number =>
  responses.reduce((a, x) =>
    a + x.answers.reduce((b, an) => b + (an.file ? an.file.sizeKb : 0), 0), 0);

/** How much one submission is holding. Shown on its own row and in the sentence
 *  that asks whether to delete it. */
export const sizeOfResponse = (x: ResourceResponse): number =>
  x.answers.reduce((a, an) => a + (an.file ? an.file.sizeKb : 0), 0);

/** 10 MB. Big enough for a scanned PDF or a phone photograph, small enough that
 *  a member on a phone connection finds out before they wait for it. */
export const DEFAULT_MAX_MB = 10;

export const emptyField = (): ResourceField => ({
  fieldId: nextId("F"), type: "text", label: "", help: null,
  required: false, options: [], accept: [], maxMb: null,
});
