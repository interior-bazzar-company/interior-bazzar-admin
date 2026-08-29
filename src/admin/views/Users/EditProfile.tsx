/* =============================================================================
   Screen 4 · Edit Profile — controlled fields, not a free-form form.
   -----------------------------------------------------------------------------
   The form is BUILT FROM the profile schema in vocabularies.json rather than
   hand-written, so a field added, made required, or made non-editable
   server-side changes this screen with no code edit. That is the whole reason
   the schema is data: the fields, their visibility and their edit permissions
   are UM-OD-09 and will move at least once before launch.

   THIS FILE KNOWS NO FIELD BY NAME. It used to — `if (f.key === "services")`
   twice, for the one comma-separated field — and that is exactly how a
   data-driven form stops being one. The schema now carries a `type` and this
   file dispatches on it, so the four business facets arrived without a line
   here that mentions any of them.

   Two things are visible on the form and are not editable on it:

     Identity  — the verified email and mobile belong to Authentication. They
                 are shown because you need to know who you are looking at, and
                 they are read-only because credentials are not this module's
                 to change. There is no back door here.

     Visibility — each field says whether it is public on the platform or
                 internal. Editing someone's public bio and editing their
                 private address are different acts, and a form that looks the
                 same for both invites the wrong one.

   A validation failure leaves the STORED profile completely unchanged. There
   is no partial write and no half-saved state — the save is one transaction
   (UM-T07) and the audit records the changed field set, never the values.
   ============================================================================= */
import { useMemo, useState } from "react";
import { Icon, Notice } from "../../ui";
import { Completeness } from "./bits";
import AreaRows from "./AreaRows";
import FacetPicker from "./FacetPicker";
import HandleField from "./HandleField";
import {
  PROFILE_SCHEMA_VERSION, completenessOf, fieldsFor, updateProfile, usernameTaken, validateFacets,
} from "./store";
import type { ProfileField, TargetArea, UserProfile, UserRow } from "./store";

const GROUPS = [
  { key: "basic", label: "Basic profile", note: "What a customer sees first." },
  { key: "business", label: "Business profile", note: "What the marketplace matches and ranks on." },
  { key: "contact", label: "Target areas",
    note: "Where they take work — a state, then its cities. This is the profile's location now." },
];

/** A field holds a list when the schema says so — never because the value
 *  happens to be an array today. */
const isList = (f: ProfileField) => f.type === "multi" || f.type === "tags";
/** Fields that take the full row. A SINGLE facet is deliberately not one of
 *  them any more: its popup is absolutely positioned, so it overlays the
 *  neighbour instead of needing the width — and giving every single a full
 *  row is what made State, City and Pincode read as three separate thoughts.
 *  Textareas and chip-bearing fields genuinely use the width. */
const isWide = (f: ProfileField) =>
  isList(f) || f.type === "handle" || f.type === "textarea" || f.type === "areas";

type Draft = Record<string, string | string[] | TargetArea[]>;

const toDraft = (p: UserProfile, fields: ProfileField[]): Draft => {
  const d: Draft = {};
  fields.forEach((f) => {
    const v = (p as unknown as Record<string, unknown>)[f.key];
    d[f.key] = f.type === "areas"
      ? (Array.isArray(v) ? (v as TargetArea[]).map((r) => ({ ...r, cities: r.cities.slice() })) : [])
      : isList(f)
        ? (Array.isArray(v) ? (v as string[]).slice() : [])
        : v === null || v === undefined ? "" : String(v);
  });
  return d;
};

/** Draft → the shape the store stores. One function, used by the live
 *  completeness readout and by the save, so the number on the form cannot
 *  disagree with what saving would actually produce. */
const toPatch = (draft: Draft, fields: ProfileField[]): Partial<UserProfile> => {
  const patch: Record<string, unknown> = {};
  fields.forEach((f) => {
    const raw = draft[f.key];
    if (f.type === "areas" || isList(f)) patch[f.key] = Array.isArray(raw) ? raw : [];
    else if (f.type === "single") patch[f.key] = String(raw || "").trim() || null;
    else patch[f.key] = String(raw || "").trim() || null;
  });
  return patch as Partial<UserProfile>;
};

export default function EditProfile({ row, onClose, onDone }: {
  row: UserRow;
  onClose: () => void;
  onDone: (msg: string, tone?: string) => void;
}) {
  /* THE SCHEMA IS CONDITIONAL NOW. Target areas only applies to somebody who
     holds a term or held one, so the field list is a function of the row —
     and every read of it, including the patch builder and the required check,
     has to go through the same list or the form would validate a field it
     never showed. */
  const fields = useMemo(() => fieldsFor(row), [row]);
  const [draft, setDraft] = useState<Draft>(() => toDraft(row.user.profile, fields));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string | string[] | TargetArea[]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  /* Completeness recomputes as you type, against the same required-field set
     the directory grades on — so the number on the form and the number on the
     row are one calculation, not two that agree today. */
  const live = completenessOf({ ...row.user.profile, ...toPatch(draft, fields) } as UserProfile);

  /* The facet rules run as you type as well as on save. Shown as a warning
     rather than blocking every keystroke: you are told the moment it is wrong,
     and the save is what refuses. */
  const facetErr = validateFacets(toPatch(draft, fields));
  /* Uniqueness cannot live in validateFacets — that answers "is this value
     well formed", which needs only the value. This needs the whole table. */
  const handle = String(draft.username || "").trim();
  const handleTaken = !!handle && usernameTaken(handle, row.user.userId);

  const submit = () => {
    setErr(null);
    const missingRequired = fields
      .filter((f) => f.required && f.editable)
      .filter((f) => {
        const v = draft[f.key];
        return Array.isArray(v) ? v.length === 0 : !String(v || "").trim();
      })
      .map((f) => f.label);
    if (missingRequired.length) {
      /* NOTHING IS WRITTEN. Not the valid fields, not partially — the stored
         profile is exactly as it was before this dialog opened. */
      setErr("Required and empty: " + missingRequired.join(", ")
        + ". Nothing has been saved — the stored profile is unchanged.");
      return;
    }
    setBusy(true);
    const e = updateProfile(row.user.userId, toPatch(draft, fields));
    if (e) { setErr(e); setBusy(false); return; }
    onDone("Profile saved. The changed field set is in the audit trail; the values are not.", "ok");
  };

  const control = (f: ProfileField) => {
    if (f.type === "areas") {
      return (
        <AreaRows f={f} disabled={!f.editable}
          value={(draft[f.key] as TargetArea[]) || []}
          onChange={(next) => set(f.key, next)} />
      );
    }
    if (f.type === "handle") {
      return (
        <HandleField value={String(draft[f.key] || "")} saved={row.user.profile.username}
          userId={row.user.userId} suggestFrom={String(draft.businessName || "")}
          disabled={!f.editable} onChange={(next) => set(f.key, next)} />
      );
    }
    if (f.type === "textarea") {
      return (
        <textarea className="inp" rows={3} value={String(draft[f.key] || "")}
          disabled={!f.editable}
          onChange={(e) => set(f.key, e.target.value)} />
      );
    }
    if (f.type === "single") {
      /* A single facet is still a picker rather than a <select>: the options
         carry a sentence saying what each one means, and a native option list
         has nowhere to put it. Choosing "Dealer" over "Retailer" is a
         distinction somebody needs told, not one they should have to know. */
      return (
        <FacetPicker f={f} disabled={!f.editable}
          values={draft[f.key] ? [String(draft[f.key])] : []}
          onChange={(next) => set(f.key, next[0] || "")} />
      );
    }
    if (isList(f)) {
      return (
        <FacetPicker f={f} disabled={!f.editable}
          values={(draft[f.key] as string[]) || []}
          onChange={(next) => set(f.key, next)} />
      );
    }
    return (
      <input className="inp" value={String(draft[f.key] || "")} disabled={!f.editable}
        onChange={(e) => set(f.key, e.target.value)} />
    );
  };

  return (
    <>
      <div className="md-h">
        <h3>Edit profile</h3>
        <p>
          {row.user.identity.name} · <span className="mono">{row.user.userId}</span> · graded
          against <span className="mono">{PROFILE_SCHEMA_VERSION}</span>
        </p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b um-form">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        {!err && facetErr ? <Notice tone="warn" text={facetErr} /> : null}
        {!err && !facetErr && handleTaken
          ? <Notice tone="warn" text="That username belongs to another profile." />
          : null}

        <div className="um-livecomp">
          <span className="l">Completeness as you type</span>
          <Completeness pct={live.pct} missing={live.missing} />
        </div>

        {GROUPS.map((g) => {
          const mine = fields.filter((f) => f.group === g.key);
          if (!mine.length) return null;
          return (
            <fieldset className="um-fs" key={g.key}>
              <legend>{g.label}<i>{g.note}</i></legend>
              <div className="um-f2">
                {mine.map((f) => (
                  /* A picker is not a <label>'s control — it is a composite
                     with its own labelled input — so those render as a div
                     with the caption beside it instead. Wrapping one in a
                     <label> makes clicking a chip focus the search box. */
                  <div className={"fg" + (isWide(f) ? " um-fg-wide" : "")} key={f.key}>
                    <span className="fg-lb">
                      {f.label}
                      {f.required ? <span className="req"> *</span> : null}
                      <em className={"um-vis " + (f.public ? "pub" : "int")}>
                        {f.public ? "public" : "internal"}
                      </em>
                    </span>
                    {control(f)}
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}

        {/* ------------------------------------------------------- identity */}
        <fieldset className="um-fs">
          <legend>
            Identity summary
            <i>from Authentication · read-only here, on purpose</i>
          </legend>
          <div className="um-f2">
            <div className="fg">
              <span className="fg-lb">Verified email</span>
              <div className="inp ro">
                {row.user.identity.email || "—"}
                {row.user.identity.emailVerified
                  ? <Icon name="check" size="sm" />
                  : <em className="warn"> unverified</em>}
              </div>
            </div>
            <div className="fg">
              <span className="fg-lb">Verified mobile</span>
              <div className="inp ro">
                {row.user.identity.phone || "—"}
                {row.user.identity.phoneVerified
                  ? <Icon name="check" size="sm" />
                  : <em className="warn"> unverified</em>}
              </div>
            </div>
          </div>
          <p className="um-fine">
            Credentials and verification live in Authentication. A sensitive identity change goes
            through that module's workflow, not a text box here.
          </p>
        </fieldset>

        <Notice tone="bad" ico="shield" text={<>
          <b>A partial write is not a reachable state.</b> The save validates, applies, recomputes
          completeness and audits the changed field set — or does none of it.
        </>} />
      </div>

      <div className="md-f">
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={busy || !!facetErr || handleTaken} onClick={submit}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}
