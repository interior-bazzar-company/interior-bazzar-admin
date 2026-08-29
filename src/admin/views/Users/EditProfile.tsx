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
import { useState } from "react";
import { Icon, Notice } from "../../ui";
import { Completeness } from "./bits";
import FacetPicker from "./FacetPicker";
import {
  PROFILE_FIELDS, PROFILE_SCHEMA_VERSION, completenessOf, updateProfile, validateFacets,
} from "./store";
import type { ProfileField, UserProfile, UserRow } from "./store";

const GROUPS = [
  { key: "basic", label: "Basic profile", note: "What a customer sees first." },
  { key: "business", label: "Business profile", note: "What the marketplace matches and ranks on." },
  { key: "contact", label: "Address and contact", note: "Mostly internal. Visibility is per field." },
];

/** A field holds a list when the schema says so — never because the value
 *  happens to be an array today. */
const isList = (f: ProfileField) => f.type === "multi" || f.type === "tags";

type Draft = Record<string, string | string[]>;

const toDraft = (p: UserProfile): Draft => {
  const d: Draft = {};
  PROFILE_FIELDS.forEach((f) => {
    const v = (p as unknown as Record<string, unknown>)[f.key];
    d[f.key] = isList(f)
      ? (Array.isArray(v) ? (v as string[]).slice() : [])
      : v === null || v === undefined ? "" : String(v);
  });
  return d;
};

/** Draft → the shape the store stores. One function, used by the live
 *  completeness readout and by the save, so the number on the form cannot
 *  disagree with what saving would actually produce. */
const toPatch = (draft: Draft): Partial<UserProfile> => {
  const patch: Record<string, unknown> = {};
  PROFILE_FIELDS.forEach((f) => {
    const raw = draft[f.key];
    if (isList(f)) patch[f.key] = Array.isArray(raw) ? raw : [];
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
  const [draft, setDraft] = useState<Draft>(() => toDraft(row.user.profile));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string | string[]) => setDraft((d) => ({ ...d, [k]: v }));

  /* Completeness recomputes as you type, against the same required-field set
     the directory grades on — so the number on the form and the number on the
     row are one calculation, not two that agree today. */
  const live = completenessOf({ ...row.user.profile, ...toPatch(draft) } as UserProfile);

  /* The facet rules run as you type as well as on save. Shown as a warning
     rather than blocking every keystroke: you are told the moment it is wrong,
     and the save is what refuses. */
  const facetErr = validateFacets(toPatch(draft));

  const submit = () => {
    setErr(null);
    const missingRequired = PROFILE_FIELDS
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
    const e = updateProfile(row.user.userId, toPatch(draft));
    if (e) { setErr(e); setBusy(false); return; }
    onDone("Profile saved. The changed field set is in the audit trail; the values are not.", "ok");
  };

  const control = (f: ProfileField) => {
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

        <div className="um-livecomp">
          <span className="l">Completeness as you type</span>
          <Completeness pct={live.pct} missing={live.missing} />
        </div>

        {GROUPS.map((g) => {
          const fields = PROFILE_FIELDS.filter((f) => f.group === g.key);
          if (!fields.length) return null;
          return (
            <fieldset className="um-fs" key={g.key}>
              <legend>{g.label}<i>{g.note}</i></legend>
              <div className="um-f2">
                {fields.map((f) => (
                  /* A picker is not a <label>'s control — it is a composite
                     with its own labelled input — so those render as a div
                     with the caption beside it instead. Wrapping one in a
                     <label> makes clicking a chip focus the search box. */
                  <div className={"fg" + (isList(f) || f.type === "single" ? " um-fg-wide" : "")}
                    key={f.key}>
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
        <button className="btn pri" disabled={busy || !!facetErr} onClick={submit}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}
