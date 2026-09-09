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

     Visibility — the record's profile tab marks each field public or
                 internal. The form used to as well, and the marker came off:
                 every field on it is public now that the pincode is gone,
                 and a chip that says the same word twelve times is noise.

   A validation failure leaves the STORED profile completely unchanged. There
   is no partial write and no half-saved state — the save is one transaction
   (UM-T07) and the audit records the changed field set, never the values.

   THE MODAL STOPPED SAYING ALL OF THIS. It used to: a note under every group
   title, a sentence under half the fields, a shield notice about transactional
   writes, "graded against profile v1" in the header. All of it true, none of
   it operable, and together it made the form read as documentation with
   fields in it. The guarantees live here and in the check suite; the screen
   carries what somebody filling it in can act on.

   WHAT IS MISSING IS SAID WHERE IT IS MISSING. A required field left empty
   wears its own error line as you type, not one sentence at the top of a form
   you have already scrolled past; the footer repeats the list only because it
   is the reason Save is refusing.
   ============================================================================= */
import { useMemo, useState } from "react";
import {
  Button, Checkbox, FieldRow, FormField, FormSection, Icon, Input, ModalShell,
  Notice, SelectInput, Textarea,
} from "../../ui";
import { Completeness } from "./bits";
import AreaRows from "./AreaRows";
import FacetPicker from "./FacetPicker";
import InfoTip from "./InfoTip";
import HandleField from "./HandleField";
import {
  PROFILE_FIELDS, completenessOf, optionsFor, updateProfile, usernameTaken, validateFacets,
} from "./store";
import type { ProfileField, TargetArea, UserProfile, UserRow } from "./store";

/* Just the names. Each carried a sentence of positioning ("what the
   marketplace matches and ranks on") and the modal read as documentation with
   fields in it — the notes said things the fields already say. */
/* About closes the form. It is the one free paragraph, and a paragraph at
   the top is what people write before they have answered the questions
   underneath it — last, it is written knowing what the profile already says. */
const GROUPS: { key: string; label: string; note?: string }[] = [
  { key: "business", label: "Business profile" },
  { key: "contact", label: "Target" },
  /* No note here any more: the cap-and-why sentence sits behind the i button
     beside the legend, where the schema's `info` puts it. */
  { key: "positioning", label: "Positioning segment" },
  { key: "about", label: "About" },
];

/** A field holds a list when the schema says so — never because the value
 *  happens to be an array today. */
const isList = (f: ProfileField) =>
  f.type === "multi" || f.type === "tags" || f.type === "checks";
/** Fields that take the full row. A SINGLE facet is deliberately not one of
 *  them any more: its popup is absolutely positioned, so it overlays the
 *  neighbour instead of needing the width — and giving every single a full
 *  row is what made State, City and Pincode read as three separate thoughts.
 *  Textareas and chip-bearing fields genuinely use the width. */
const isWide = (f: ProfileField) =>
  f.wide === true
  || (isList(f) && f.type !== "checks")
  || f.type === "handle" || f.type === "textarea" || f.type === "areas";

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

/** The verified/unverified read-out under an identity field. A fact with a
 *  tone, never a colour on its own. */
function Verified({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-success-primary">
      <Icon name="check" size="xs" />Verified by Authentication
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-warning-primary">
      <Icon name="alert" size="xs" />Not verified
    </span>
  );
}

export default function EditProfile({ row, onClose, onDone }: {
  row: UserRow;
  onClose: () => void;
  onDone: (msg: string, tone?: string) => void;
}) {
  /* ONE LIST, read by the form, the patch builder and the required check
     alike. Two reads of the schema is how a form ends up validating a field it
     never showed. */
  const fields = PROFILE_FIELDS;
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
  /* REQUIRED FIELDS ARE CHECKED LIVE, like the facet rules — not discovered
     on submit as one sentence at the top of a form just scrolled to the
     bottom of. The empty ones are marked, and Save says what it is waiting
     for. */
  const missingRequired = fields
    .filter((f) => f.required && f.editable)
    .filter((f) => {
      const v = draft[f.key];
      return Array.isArray(v) ? v.length === 0 : !String(v || "").trim();
    });
  const isMissing = (f: ProfileField) => missingRequired.some((m) => m.key === f.key);
  const initial = useMemo(() => JSON.stringify(toDraft(row.user.profile, fields)), [row, fields]);
  const dirty = JSON.stringify(draft) !== initial;
  const close = () => {
    if (dirty && !window.confirm("Discard your changes? The stored profile is unchanged.")) return;
    onClose();
  };

  const submit = () => {
    setErr(null);
    if (missingRequired.length) {
      /* NOTHING IS WRITTEN. Not the valid fields, not partially — the stored
         profile is exactly as it was before this dialog opened. */
      setErr("Required and empty: " + missingRequired.map((f) => f.label).join(", ")
        + ". Nothing has been saved — the stored profile is unchanged.");
      return;
    }
    setBusy(true);
    const e = updateProfile(row.user.userId, toPatch(draft, fields));
    if (e) { setErr(e); setBusy(false); return; }
    onDone("Profile saved.", "ok");
  };

  const control = (f: ProfileField, id: string) => {
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
        <Textarea id={id} rows={3} value={String(draft[f.key] || "")}
          disabled={!f.editable} ariaLabel={f.label} maxLength={f.maxLength}
          onChange={(v) => set(f.key, v)} />
      );
    }
    if (f.type === "checks") {
      /* One or both, never a dropdown: two options that can combine are two
         checkboxes, and hiding them behind a picker adds a press to see what
         was never worth hiding. */
      const vals = (draft[f.key] as string[]) || [];
      /* At the cap, the boxes not yet ticked go quiet rather than refusing on
         click: "up to 2" is enforced by what can still be pressed. */
      const atMax = !!f.max && vals.length >= f.max;
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 py-1.5"
          role="group" aria-label={f.label}>
          {optionsFor(f).map((o) => {
            const on = vals.indexOf(o.key) >= 0;
            return (
              <Checkbox key={o.key} checked={on} label={o.label}
                disabled={!f.editable || (!on && atMax)}
                onChange={() => set(f.key,
                  on ? vals.filter((v) => v !== o.key) : vals.concat([o.key]))} />
            );
          })}
        </div>
      );
    }
    if (f.type === "single" && f.simple) {
      /* A plain dropdown. The option meanings moved behind the i button next
         to the label, so the rows do not need a search box or hint lines —
         six words pick faster than six sentences. */
      return (
        <SelectInput id={id} ph="Choose…" ariaLabel={f.label}
          value={String(draft[f.key] || "")} disabled={!f.editable}
          options={optionsFor(f).map((o) => ({ v: o.key, l: o.label }))}
          onChange={(v) => set(f.key, v)} />
      );
    }
    if (f.type === "single") {
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
      <Input id={id} value={String(draft[f.key] || "")} disabled={!f.editable}
        ariaLabel={f.label} maxLength={f.maxLength} err={isMissing(f)}
        onChange={(v) => set(f.key, v)} />
    );
  };

  return (
    <ModalShell
      title="Edit profile"
      sub={<>{row.user.identity.name} · <span className="font-mono">{row.user.userId}</span></>}
      onClose={close}
      /* The reason Save is refusing, beside Save. It is not a decoration on the
         left of the footer — it is the sentence that makes a disabled primary
         button honest. */
      danger={missingRequired.length ? (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-warning-primary">
          <Icon name="alert" size="xs" className="shrink-0" />
          <span className="truncate">
            Required: {missingRequired.map((f) => f.label).join(", ")}
          </span>
        </span>
      ) : undefined}
      actions={
        <>
          <Button color="secondary" data-close="1" onClick={close}>Cancel</Button>
          <Button color="primary" isLoading={busy}
            isDisabled={busy || !!facetErr || handleTaken || missingRequired.length > 0}
            onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-5">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        {!err && facetErr ? <Notice tone="warn" text={facetErr} /> : null}
        {!err && !facetErr && handleTaken
          ? <Notice tone="warn" text="That username belongs to another profile." />
          : null}

        {/* THE NUMBER THE DIRECTORY GRADES ON, live. It is the one figure on
            this form, so it is on the instrument ground rather than in the
            flow of the fields. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-secondary px-3.5 py-2.5 ring-1 ring-secondary ring-inset">
          <span className="label-mono">Completeness</span>
          <Completeness pct={live.pct} missing={live.missing} />
        </div>

        {GROUPS.map((g) => {
          const mine = fields.filter((f) => f.group === g.key);
          if (!mine.length) return null;
          /* A GROUP OF ONE IS ITS FIELD. "Positioning segment" over
             "Positioning", "About" over "About", "Target" over "Location":
             the legend already names the thing, so the field's own label
             row goes and the legend carries the asterisk and the i instead.
             The control keeps its accessible name through aria-label. */
          const solo = mine.length === 1 ? mine[0] : null;
          return (
            <FormSection key={g.key} desc={g.note}
              title={
                <span className="inline-flex items-center gap-1.5">
                  {g.label}
                  {solo && solo.required
                    ? <span className="text-brand-tertiary" title="Required">*</span>
                    : null}
                  {solo && solo.info ? <InfoTip f={solo} /> : null}
                </span>
              }>
              <FieldRow>
                {mine.map((f) => {
                  const id = "up-" + f.key;
                  /* A picker is a composite with its own labelled input, so it
                     gets the caption and not a `<label for>`: pointing a label
                     at a combobox makes clicking the caption focus a search
                     box somebody did not ask to type in. */
                  const composite = f.type === "areas" || f.type === "handle"
                    || (f.type === "single" && !f.simple) || (isList(f) && f.type !== "checks");
                  return (
                    <FormField
                      key={f.key}
                      id={composite ? undefined : id}
                      label={solo ? undefined : f.label}
                      req={solo ? undefined : f.required}
                      tip={!solo && f.info ? <InfoTip f={f} /> : undefined}
                      err={isMissing(f) ? "Required — Save is waiting for this." : undefined}
                      className={isWide(f) ? "sm:col-span-2" : undefined}
                    >
                      {control(f, id)}
                    </FormField>
                  );
                })}
              </FieldRow>
            </FormSection>
          );
        })}

        {/* ------------------------------------------------------- identity */}
        <FormSection title="Identity" desc="Owned by Authentication — read-only here, and there is no back door.">
          <FieldRow>
            <FormField label="Verified email"
              hint={<Verified on={!!row.user.identity.emailVerified} />}>
              <Input readOnly ariaLabel="Verified email"
                value={row.user.identity.email || "—"} />
            </FormField>
            <FormField label="Verified mobile"
              hint={<Verified on={!!row.user.identity.phoneVerified} />}>
              <Input readOnly mono ariaLabel="Verified mobile"
                value={row.user.identity.phone || "—"} />
            </FormField>
          </FieldRow>
        </FormSection>
      </div>
    </ModalShell>
  );
}
