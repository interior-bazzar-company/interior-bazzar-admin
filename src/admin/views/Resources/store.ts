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

   ON THE BACKEND (2026-09-15). `bootResources()` reads every form from
   `GET resources/?member=all` and the answers one member at a time
   (`?member=<id>`, the only read that returns them); the writes are the
   resources/ endpoints. Ids keep the `RES-` / `RSP-` prefixes the routes switch
   on, over the server's integer ids. A department is an rbac ROLE — the server
   stores role ids, so a name that is not a role is refused.

   A FILE ANSWER is uploaded on submit by a presigned PUT (the Finance receipt
   route); the server checks it against its field, stores the key and reads it
   back as a signed URL.

   STILL LOCAL — no backend: the share link's token (derived below, never
   authorisation; Resource has no token column), and the static labels in
   vocabularies.json (submitted/pending). Field types and tag suggestions are
   served (vocab/resource-field-types, vocab/resource-tag-suggestions).
   ============================================================================= */
import { useEffect, useState } from "react";
import vocabDoc from "../../../content/resources/vocabularies.json";
import config from "../../../config";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import { CommonService } from "../../../api/modules/common";
import type { ApiResponseType } from "../../../types/reqResType";
import type { ResourceResponseRow, ResourceRow } from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import { bootTeam, loadFailure, meId, readMembers, scopedTo } from "../Team/store";
import type { LoadPart, Member } from "../Team/store";

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
  /** From the server, a signed, expiring read of the stored key. In the fill
   *  dialog, before submit, a local object URL. */
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
 *  offering on an empty field so nobody has to invent a word for "onboarding".
 *  From `GET vocab/resource-tag-suggestions/`, filled in place by bootResources. */
export const TAG_SUGGESTIONS: string[] = [];
/** From `GET vocab/resource-states/`, filled in place by bootResources. */
export const RESOURCE_STATE: Record<string, { label: string; tone: string }> = {};
export const ROW_STATE = toneMap(VOCAB.responseStates);
/** From `GET vocab/resource-field-types/` — the server's own FIELD_TYPES, so the
 *  builder offers exactly the types a save accepts. Filled in place by bootResources. */
export const FIELD_TYPES: { key: FieldType; label: string }[] = [];

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

interface Snap { resources: Resource[]; responses: ResourceResponse[] }

let snap: Snap = { resources: [], responses: [] };

/** Bumped on every write so the hooks below re-render. */
let version = 0;
const listeners = new Set<() => void>();
const touch = () => { version++; listeners.forEach((f) => f()); };

let seq = 0;
const nextId = (prefix: string) =>
  prefix + "-" + (Date.now().toString(36) + (seq++).toString(36)).toUpperCase();

/* ------------------------------------------------------------- the load -- */

const RES = "RES-", RSP = "RSP-";
const serverId = (id: string) => Number(id.replace(/^(RES|RSP)-/, ""));

const toResource = (r: ResourceRow): Resource => ({
  resourceId: RES + r.id,
  title: r.title,
  description: r.description || "",
  tags: r.tags || [],
  departments: (r.roles || []).map((x) => x.name),
  state: r.state.key as ResourceState,
  version: r.version,
  fields: (r.fields || []) as ResourceField[],
  createdAt: r.createdAt || "",
  createdById: r.createdBy ? String(r.createdBy.id) : "",
  openedAt: r.openedAt,
  closedAt: r.closedAt,
});

const toResponse = (x: ResourceResponseRow): ResourceResponse => ({
  responseId: RSP + x.id,
  resourceId: RES + x.resource,
  version: x.version,
  memberId: String(x.member.id),
  submittedAt: x.submittedAt || "",
  answers: (x.answers || []) as Answer[],
});

/** Role name -> id, for the writes. From the roles list, and from every roster
 *  row and form that names a role, so a viewer without the roles grant has them. */
const ROLE_IDS: Record<string, number> = {};

let booting: Promise<void> | null = null;
let loadSeq = 0;
/** How the forms and answers stand (Team's `LoadPart`): `own` when the server
 *  refused everybody's and answered with the viewer's own. */
let part: LoadPart = { state: "loading" };

async function load(current: () => boolean): Promise<void> {
  await bootTeam();
  /* Asserted, not annotated: a closure assigns these, and TS would otherwise
     narrow them to `null` for the rest of the function. */
  let wideErr = null as unknown, ownErr = null as unknown, answersErr = null as unknown;
  const [all, roles, users, states, tagSuggestions, fieldTypes] = await Promise.all([
    call(AdminOpsService.resources({ member: "all" })).catch((e) => { wideErr = e; return null; }),
    call(AdminOpsService.listRoles()).catch(() => null),
    call(AdminOpsService.users()).catch(() => null),
    call(AdminOpsService.vocab("resource-states")).catch(() => null),
    call(AdminOpsService.vocab("resource-tag-suggestions")).catch(() => null),
    call(AdminOpsService.vocab("resource-field-types")).catch(() => null),
  ]);
  let resources: ResourceRow[];
  let responses: ResourceResponseRow[];
  if (all) {
    resources = all.resources;
    /* ponytail: one read per roster member, the only way the server returns
       answers; a single "every response" read replaces this if the roster grows. */
    const each = await Promise.all(readMembers().map((m) =>
      call(AdminOpsService.resources({ member: m.memberId })).then((r) => r.responses || [])
        .catch((e) => { if (answersErr === null) answersErr = e; return []; })));
    const seen: Record<number, boolean> = {};
    responses = ([] as ResourceResponseRow[]).concat(...each).filter((x) => (seen[x.id] ? false : (seen[x.id] = true)));
  } else {
    const own = await call(AdminOpsService.resources({})).catch((e) => { ownErr = e; return null; });
    resources = own ? own.resources : [];
    responses = own ? own.responses || [] : [];
  }
  if (!current()) return;
  (roles ? roles.roles : []).forEach((r) => { ROLE_IDS[r.name] = r.id; });
  (users || []).forEach((u) => (u.roles || []).forEach((r) => { ROLE_IDS[r.name] = r.id; }));
  resources.forEach((r) => (r.roles || []).forEach((x) => { ROLE_IDS[x.name] = x.id; }));
  if (states) {
    Object.keys(RESOURCE_STATE).forEach((k) => { delete RESOURCE_STATE[k]; });
    states.items.forEach((x) => { RESOURCE_STATE[x.key] = { label: x.label, tone: x.tone || "" }; });
  }
  if (tagSuggestions) {
    TAG_SUGGESTIONS.splice(0, TAG_SUGGESTIONS.length,
      ...tagSuggestions.items.filter((x) => x.isActive !== false).map((x) => x.label));
  }
  if (fieldTypes) {
    FIELD_TYPES.splice(0, FIELD_TYPES.length,
      ...fieldTypes.items.map((x) => ({ key: x.key as FieldType, label: x.label })));
  }
  snap = { resources: resources.map(toResource), responses: responses.map(toResponse) };
  /* Everybody's forms, or — refused — the viewer's own; a failure is never an empty list. */
  const wideRefused = !all && loadFailure(wideErr).state === "denied";
  part = all ? (answersErr === null ? { state: "ok", own: false } : loadFailure(answersErr))
    : ownErr !== null ? loadFailure(wideRefused ? ownErr : wideErr)
      : wideRefused ? { state: "ok", own: true } : loadFailure(wideErr);
  touch();
}

/** Load (once) or reload (`force`). Never throws; only the newest load lands. */
export function bootResources(force = false): Promise<void> {
  if (booting && !force) return booting;
  const mine = ++loadSeq;
  booting = load(() => mine === loadSeq).catch((e) => {
    if (mine !== loadSeq) return;
    part = loadFailure(e);
    touch();
  });
  return booting;
}

/** Try again: loading until the re-read lands. */
export function retryResources(): Promise<void> {
  part = { state: "loading" };
  touch();
  return bootResources(true);
}

/** A server write: fold the response in now, re-read in the background. */
async function live<R, T>(req: () => Promise<ApiResponseType<R>>, apply: (r: R) => T): Promise<Result<T>> {
  try {
    const out = apply(await call(req()));
    touch();
    void bootResources(true);
    return ok(out);
  } catch (e) {
    return err("refused", errMessage(e));
  }
}

function roleIdsOf(names: string[]): number[] | string {
  const missing = names.filter((n) => ROLE_IDS[n] === undefined);
  if (missing.length) return "There is no role called “" + missing[0] + "”. A department is a role.";
  return names.map((n) => ROLE_IDS[n]);
}

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
    .filter((m) => !want.length || m.roles.some((role) => want.indexOf(role) >= 0))
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
/* Every one of these is a server write (`live`) returning a Result, so a
   refusal reaches the screen in the server's own words. */

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

const draftBody = (d: ResourceDraft, roles: number[]) => ({
  title: d.title.trim(), description: d.description.trim(), tags: cleanTags(d.tags), roles, fields: d.fields,
});
const putResource = (row: ResourceRow): Resource => {
  const r = toResource(row);
  snap.resources = snap.resources.filter((x) => x.resourceId !== r.resourceId).concat([r]);
  return r;
};

/** A new form is OPEN on the server — nothing goes out by accident, because the
 *  only thing that reaches anybody is a link a person copies and sends. */
export function createResource(d: ResourceDraft): Promise<Result<Resource>> {
  const bad = badDraft(d);
  if (bad) return Promise.resolve(err("invalid", bad));
  const roles = roleIdsOf(cleanTags(d.departments));
  if (typeof roles === "string") return Promise.resolve(err("unknown_role", roles));
  return live(() => AdminOpsService.createResource(draftBody(d, roles)), putResource);
}

/** THE VERSION BUMP is the server's: editing the fields of a form somebody
 *  already answered makes a new version, and a closed form is not edited. */
export function updateResource(id: string, d: ResourceDraft): Promise<Result<Resource>> {
  const bad = badDraft(d);
  if (bad) return Promise.resolve(err("invalid", bad));
  if (!resourceOf(id)) return Promise.resolve(err("not_found", "No such resource."));
  const roles = roleIdsOf(cleanTags(d.departments));
  if (typeof roles === "string") return Promise.resolve(err("unknown_role", roles));
  return live(() => AdminOpsService.updateResource(serverId(id), draftBody(d, roles)), putResource);
}

const setState = (id: string, to: "open" | "closed" | "outdated"): Promise<Result<Resource>> =>
  resourceOf(id)
    ? live(() => AdminOpsService.setResourceState(serverId(id), to), putResource)
    : Promise.resolve(err("not_found", "No such resource."));

export const openResource = (id: string) => setState(id, "open");
/** Closing stops new submissions and keeps every one already made. */
export const closeResource = (id: string) => setState(id, "closed");
/** MARK IT WRONG, not merely finished: it keeps every answer, sorts last and
 *  refuses submissions. Reopening undoes it. */
export const outdateResource = (id: string) => setState(id, "outdated");

/** START AGAIN FROM ONE THAT WORKED. The copy is a DRAFT with no responses. */
export const duplicateResource = (id: string): Promise<Result<Resource>> =>
  resourceOf(id)
    ? live(() => AdminOpsService.duplicateResource(serverId(id)), putResource)
    : Promise.resolve(err("not_found", "No such resource."));

/** A form nobody answered can go; one that HAS answers is refused (by the server
 *  too) — delete the responses first, or mark it outdated. */
export function deleteResource(id: string): Promise<Result<string>> {
  if (!resourceOf(id)) return Promise.resolve(err("not_found", "No such resource."));
  return live(() => AdminOpsService.deleteResource(serverId(id)), () => {
    snap.resources = snap.resources.filter((x) => x.resourceId !== id);
    return id;
  });
}

/** DELETING A SUBMISSION IS HOW SPACE IS FREED, and it returns what it
 *  reclaimed, in kilobytes, so the screen can say the number out loud. */
export function deleteResponse(id: string): Promise<Result<number>> {
  if (!responseOf(id)) return Promise.resolve(err("not_found", "No such response."));
  return live(() => AdminOpsService.deleteResourceResponse(serverId(id)), (r) => {
    snap.responses = snap.responses.filter((y) => y.responseId !== id);
    return r.freedKb || 0;
  });
}

/** WHAT COUNTS AS ANSWERED, written once. A file field is answered by its
 *  file, not by the text beside it; anything else by non-blank text. The
 *  submit refusal and the fill dialog's button both read this, so they cannot
 *  disagree about which fields are still empty. */
export function answered(f: ResourceField, values: Record<string, string>, files?: Record<string, FileAnswer>): boolean {
  return f.type === "file" ? !!(files && files[f.fieldId]) : !!String(values[f.fieldId] || "").trim();
}

/** Straight to S3 with a presigned PUT, then the API is told where it landed —
 *  the same route (and intent) as Finance receipts and invoice proofs. A file the
 *  browser gives no type is sent as octet-stream: the PUT must carry the type
 *  the URL was signed for. */
async function uploadAnswer(picked: File): Promise<string> {
  const file = picked.type ? picked : new File([picked], picked.name, { type: "application/octet-stream" });
  const res = await CommonService.getUploadUrl({ fileName: file.name, fileType: file.type, for: "PaymentScreenshot" });
  if (!res.response) throw new Error(res.message || "Could not get an upload URL.");
  await CommonService.uploadToS3(res.data.uploadUrl, file);
  return res.data.fileUrl;
}

/** Your own answers only — the server files a response for the caller. Each
 *  picked file (`blobs`, by fieldId) is uploaded first; the server checks it
 *  against its field, keeps the key and hands back a signed read. */
export async function submitResponse(
  resourceId: string, memberId: string, values: Record<string, string>,
  files: Record<string, FileAnswer> = {}, blobs: Record<string, File> = {},
): Promise<Result<ResourceResponse>> {
  const r = resourceOf(resourceId);
  if (!r) return err("not_found", "No such resource.");
  if (memberId !== meId()) return err("not_own", "Only your own answers can be submitted.");
  const ids = Object.keys(files);
  for (const id of ids) {
    const f = r.fields.filter((x) => x.fieldId === id)[0];
    if (!blobs[id]) return err("no_file", "Pick " + files[id].fileName + " again — it is uploaded when you submit.");
    /* Before the upload, not after it: a 40 MB file should not travel to be refused. */
    if (f && f.maxMb !== null && files[id].sizeKb > f.maxMb * 1024)
      return err("too_big", "“" + f.label + "” takes files up to " + f.maxMb + " MB.");
  }
  const sent: Record<string, FileAnswer> = {};
  let at = "";
  try {
    for (const id of ids) { at = files[id].fileName; sent[id] = { ...files[id], url: await uploadAnswer(blobs[id]) }; }
  } catch {
    return err("upload_failed", at + " could not be uploaded, so nothing was submitted. Try again.");
  }
  return live(() => AdminOpsService.submitResourceResponse(serverId(resourceId), { values, files: sent }), (row) => {
    const x = toResponse(row);
    snap.responses = snap.responses.concat([x]);
    return x;
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

export function useResources(): Resource[] { useVersion(); void bootResources(); return snap.resources; }
export function useResponses(): ResourceResponse[] { useVersion(); void bootResources(); return snap.responses; }
/** How the forms stand for one member's page — own-only is "not in your access" on anybody else's. */
export function useResourcesLoad(memberId?: string): LoadPart { useVersion(); void bootResources(); return scopedTo(part, memberId); }

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
    .reduce((a: string[], m) => a.concat(m.roles), [])
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
