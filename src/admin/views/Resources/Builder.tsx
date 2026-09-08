/* =============================================================================
   The builder — #/resources/new and #/resources/:id/edit
   -----------------------------------------------------------------------------
   THE PAGE HAS TWO HALVES AND THEY ARE NOT EQUAL. On the left you describe a
   form; on the right the form appears. The left is controls, the right is the
   artifact — and the whole reason the artifact is on screen is that a field
   list reads as configuration while the thing being designed is a page somebody
   has to fill in on a phone. It renders from the same field array the editor
   writes, so it cannot drift, and it is the only place a missing label is
   obvious rather than merely absent.

   THE SPINE IS THE ONE DEVICE THIS PAGE SPENDS ITS BOLDNESS ON. The fields are
   numbered down a continuous rule, because **order is real information here** —
   it is the order the member meets the questions in, and moving a field is a
   thing people do. A numbered marker on content that is not a sequence is
   decoration; on this list it is the content.

   TWO SECTIONS, IN THE ORDER THEY ARE DECIDED. What it is called, what it is
   about, who it goes to — then what it asks. The department sits with the
   naming rather than beside the fields because it changes what the form IS, and
   a rule chosen after eleven fields have been written is a rule chosen to fit
   them.

   NOTHING SAVES UNTIL SAVE. Every edit here is local state; the store is
   touched once, by one call, and the screen leaves on success. A builder that
   wrote through on each keystroke would version a form eleven times.
   ============================================================================= */
import { useMemo, useState } from "react";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { ChipInput, EmptyState, Icon, Notice, TbTitle } from "../../ui";
import { go } from "../../ui/nav";
import { FormPreview } from "./index";
import { TypeMark } from "./bits";
import {
  ACCEPT_KINDS, ACCEPT_LABEL, DEFAULT_MAX_MB, FIELD_TYPES, TAG_SUGGESTIONS, audienceOf,
  cleanTags, createResource, departmentsInUse, departmentsNamed, emptyField, resourceOf,
  responsesFor, tagsInUse, updateResource,
} from "./store";
import type { AcceptKind, FieldType, ResourceField } from "./store";
import "./resources.css";

const ROUTE = "#/resources";

export default function Builder({ mode, resourceId }: {
  mode: "create" | "edit";
  resourceId?: string;
}) {
  const shell = useShell();
  const existing = mode === "edit" && resourceId ? resourceOf(resourceId) : null;

  const [title, setTitle] = useState(existing ? existing.title : "");
  const [description, setDescription] = useState(existing ? existing.description : "");
  const [tags, setTags] = useState<string[]>(existing ? existing.tags.slice() : []);
  const [departments, setDepartments] = useState<string[]>(
    existing ? existing.departments.slice() : []);
  const [fields, setFields] = useState<ResourceField[]>(
    existing ? JSON.parse(JSON.stringify(existing.fields)) as ResourceField[] : [emptyField()]);

  usePageChrome({
    crumbs: (
      <>
        <TbTitle label="Data Forms" to={ROUTE} />
        <span className="tb-sep">/</span>
        <span className="tb-title is-here">{existing ? "Edit" : "New resource"}</span>
      </>
    ),
    parent: existing ? ROUTE + "?form=" + existing.resourceId : ROUTE,
  }, (resourceId || "new"));

  /* THE LIVE ANSWER TO THE DEPARTMENT. Same `audienceOf` the table runs, so the
     builder can never promise a number the module then disagrees with. */
  const goesTo = useMemo(() => audienceOf({ departments }), [departments]);

  if (mode === "edit" && !existing) {
    return (
      <div className="page">
        <EmptyState icon="search" title="No such resource"
          body="It may have been deleted, or the link is stale."
          action={<button className="btn pri" onClick={() => go(ROUTE)}>Back to Resources</button>} />
      </div>
    );
  }

  const answered = existing ? responsesFor(existing.resourceId).length : 0;
  const fieldsChanged = !!existing
    && JSON.stringify(existing.fields) !== JSON.stringify(fields);

  const setField = (i: number, patch: Partial<ResourceField>) =>
    setFields(fields.map((f, n) => (n === i ? { ...f, ...patch } : f)));

  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= fields.length) return;
    const next = fields.slice();
    const t = next[i];
    next[i] = next[j];
    next[j] = t;
    setFields(next);
  };

  const addField = () => setFields(fields.concat([emptyField()]));

  const save = () => {
    const draft = { title, description, tags, departments, fields };
    const res = existing
      ? updateResource(existing.resourceId, draft)
      : createResource(draft);
    if (!res.ok) { shell.toast(res.message, "bad"); return; }
    shell.toast(existing ? "Changes saved." : "Resource created.", "ok");
    go(ROUTE + "?form=" + res.value.resourceId);
  };

  return (
    <div className="page wide rs-builder">
      <header className="rs-bh">
        <div className="rs-bh-t">
          <span className="rs-eyebrow">{existing ? "Editing" : "New resource"}</span>
          <h1>{existing ? existing.title : title || "Untitled resource"}</h1>
          <p>
            {existing
              ? "Version " + existing.version + " · " + answered
                + (answered === 1 ? " response" : " responses")
              : "It opens as soon as you create it. You send the links yourself — nothing is emailed."}
          </p>
        </div>
        <div className="rs-bh-a">
          <button className="btn" onClick={() => go(existing
            ? ROUTE + "?form=" + existing.resourceId : ROUTE)}>Cancel</button>
          <button className="btn pri lg" onClick={save}>
            {existing ? "Save changes" : "Create resource"}
          </button>
        </div>
      </header>

      {answered > 0 && fieldsChanged ? (
        <Notice tone="warn">
          <b>This becomes version {existing ? existing.version + 1 : 2}.</b>{" "}
          {answered} {answered === 1 ? "person has" : "people have"} already answered, and
          changing a field cannot change what they said. Their answers keep the labels they
          were given and stay readable exactly as they are.
        </Notice>
      ) : null}

      <div className="rs-cols">
        <div className="rs-col">
          {/* ------------------------------------------------- details -- */}
          <section className="rs-sec">
            <h2 className="rs-sec-h">Details</h2>

            <div className="rs-card">
              <div className="fg">
                <label htmlFor="rs-title">Title <span className="req">*</span></label>
                <input className="inp rs-title-in" id="rs-title" value={title}
                  placeholder="Sales onboarding pack"
                  onChange={(e) => setTitle(e.target.value)} />
                <div className="help">What this form is called everywhere else in the panel.</div>
              </div>

              <div className="fg">
                <label htmlFor="rs-desc">Description</label>
                <textarea className="inp" id="rs-desc" rows={2} value={description}
                  placeholder="Everything a new joiner has to hand back in week one."
                  onChange={(e) => setDescription(e.target.value)} />
                <div className="help">One or two lines. What it is for, not what is in it.</div>
              </div>

              <ChipField
                id="rs-tag"
                label="Tags"
                value={tags}
                onChange={setTags}
                placeholder={tags.length ? "Add another" : "Type a tag and press Enter"}
                suggest={Array.from(new Set(TAG_SUGGESTIONS.concat(tagsInUse())))}
                suggestLabel="Try" />

              <DepartmentField value={departments} onChange={setDepartments}
                goesTo={goesTo.length} />
            </div>
          </section>

          {/* ---------------------------------------------------- form -- */}
          <section className="rs-sec">
            <div className="rs-sec-r">
              <h2 className="rs-sec-h">Form</h2>
              <span className="rs-sec-n">
                {fields.length} {fields.length === 1 ? "field" : "fields"}
              </span>
              <span className="spacer" />
              <button className="btn sm" onClick={addField}>
                <Icon name="plus" size="sm" />Add field
              </button>
            </div>

            {fields.length ? (
              <ol className="rs-spine">
                {fields.map((f, i) => (
                  <FieldEditor key={f.fieldId} f={f} i={i} n={fields.length}
                    onChange={(patch) => setField(i, patch)}
                    onMove={(by) => move(i, by)}
                    onRemove={() => setFields(fields.filter((_, n) => n !== i))} />
                ))}
              </ol>
            ) : (
              <div className="rs-card">
                <EmptyState icon="doc" title="No fields yet"
                  body="A form with none has nothing to send back."
                  action={<button className="btn pri" onClick={addField}>Add the first field</button>} />
              </div>
            )}

            {fields.length ? (
              <button className="btn rs-addrow" onClick={addField}>
                <Icon name="plus" size="sm" />Add field
              </button>
            ) : null}
          </section>
        </div>

        {/* -------------------------------------------------- preview -- */}
        <aside className="rs-col rs-side">
          <div className="rs-sticky">
            <div className="rs-sheet-h">
              <span className="rs-eyebrow">What they see</span>
              <span className="cell-2">
                {goesTo.length === 0 ? "Goes to nobody yet"
                  : "Goes to " + goesTo.length + (goesTo.length === 1 ? " person" : " people")}
              </span>
            </div>
            <div className="rs-card rs-paper">
              <FormPreview r={{ title, description, fields }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ chips -- */

/** ONE CONTROL, TWO USES. Tags and departments are the same kind of answer — a
 *  short list of words somebody types — so they are the same control rather
 *  than two that drift apart. It was written for tags and generalised the day
 *  the department stopped being a single value.
 *
 *  THE BOX IS THE INPUT: chips sit inside it and the caret follows them, so
 *  there is one target rather than a field beside a list of what it produced.
 *  Enter commits, and so does a comma — somebody pasting "onboarding, sales"
 *  means two, and pressing Enter twice is a rule they would have to be taught.
 *  Backspace on an empty box takes the last chip, because its absence is the
 *  thing that makes a chip field feel broken. */
function ChipField({ id, label, value, onChange, placeholder, suggest, suggestLabel, help, helpTone }: {
  id: string;
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  suggest: string[];
  suggestLabel: string;
  help?: string;
  helpTone?: string;
}) {
  const used: Record<string, boolean> = {};
  value.forEach((t) => { used[t.toLowerCase()] = true; });
  /* A suggestion already taken is clutter, so it goes. */
  const offer = suggest.filter((t) => !used[t.toLowerCase()]).slice(0, 6);

  return (
    <div className="fg">
      <label htmlFor={id}>{label}</label>
      {/* THE BOX ITSELF IS NOW ui/ChipInput. This wrapper keeps what is
          genuinely local to Resources — the label, the suggestion row and the
          help line — and stops owning a chip field that four other screens
          would each have had to re-invent. `cleanTags` stays the caller's:
          it is Resources' own rule about case, length and duplicates, and the
          shared control has no business guessing at it. */}
      <ChipInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        clean={(v) => cleanTags(v)}
      />
      {offer.length ? (
        <div className="rs-tag-sug">
          <span className="cell-2">{suggestLabel}</span>
          {offer.map((t) => (
            <button key={t} type="button" className="chip"
              onClick={() => onChange(cleanTags(value.concat([t])))}>{t}</button>
          ))}
        </div>
      ) : null}
      {help ? <div className={"help" + (helpTone ? " " + helpTone : "")}>{help}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------ department -- */

/** THE SAME CONTROL TAGS USE, because it is the same kind of answer: a short
 *  list of names somebody types. It was a single-value combobox, which quietly
 *  said a form could only ever go to one department — it can go to several, and
 *  a member in any of them is in the audience.
 *
 *  IT IS NOT BOUND TO THE ROSTER. The suggestions come from the roster and from
 *  departments other resources already name, but a department that exists on
 *  neither is accepted: one can be created before anybody is filed under it, and
 *  a control that refused the name would make that impossible to set up in
 *  advance.
 *
 *  EMPTY IS EVERYONE, and the line underneath says so. The difference between a
 *  company-wide form and one that reaches nobody is an empty list, which is
 *  exactly the sort of thing an interface has to say out loud. */
function DepartmentField({ value, onChange, goesTo }: {
  value: string[]; onChange: (v: string[]) => void; goesTo: number;
}) {
  const offer = Array.from(new Set(departmentsInUse().concat(departmentsNamed())));
  return (
    <ChipField
      id="rs-dept"
      label="Department"
      value={value}
      onChange={onChange}
      placeholder={value.length ? "Add another" : "Everyone — type a department to narrow it"}
      suggest={offer}
      suggestLabel="On the roster"
      help={value.length
        ? goesTo
          ? "Only " + value.join(" and ") + " — " + goesTo
            + (goesTo === 1 ? " person" : " people") + " right now, and anyone who joins later."
          : "Nobody is in " + value.join(" or ") + " yet. It will pick people up as they join."
        : "Everyone — " + goesTo + " active " + (goesTo === 1 ? "member" : "members")
          + ". Name a department to narrow it."}
      helpTone={value.length && !goesTo ? "warn" : ""} />
  );
}

/* ------------------------------------------------------------- one field -- */

/** A FIELD IS A CARD ON A SPINE. The number is its position, the rule down the
 *  left is the sequence, and both are real: this is the order the member meets
 *  the questions in.
 *
 *  The rows split by frequency rather than by importance — a label and a type
 *  are set on every field, so they get the first row to themselves; required,
 *  help text and whatever the type needs sit under it. */
function FieldEditor({ f, i, n, onChange, onMove, onRemove }: {
  f: ResourceField; i: number; n: number;
  onChange: (patch: Partial<ResourceField>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rs-field" data-type={f.type}>
      <span className="rs-field-n" aria-hidden="true">{i + 1}</span>

      <div className="rs-field-b">
        <div className="rs-field-r">
          <input className="inp rs-field-l" value={f.label} placeholder="Question or label"
            aria-label={"Field " + (i + 1) + " label"}
            onChange={(e) => onChange({ label: e.target.value })} />
          <span className="rs-field-t">
            <TypeMark type={f.type} />
            <select className="inp" value={f.type} aria-label={"Field " + (i + 1) + " type"}
              onChange={(e) => {
                const type = e.target.value as FieldType;
                /* Options belong to `select`, and accept/maxMb to `file`.
                   Carrying either across a type change leaves invisible state
                   that reappears if somebody switches back — and looks like a
                   bug when it does. */
                onChange({
                  type,
                  options: type === "select" ? f.options : [],
                  accept: type === "file" ? f.accept : [],
                  maxMb: type === "file" ? (f.maxMb ?? DEFAULT_MAX_MB) : null,
                });
              }}>
              {FIELD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </span>
          <span className="rs-field-x">
            <button className="btn icon sm" title="Move up"
              aria-label={"Move field " + (i + 1) + " up"}
              disabled={i === 0} onClick={() => onMove(-1)}><Icon name="chev" size="sm" /></button>
            <button className="btn icon sm" title="Move down"
              aria-label={"Move field " + (i + 1) + " down"}
              disabled={i === n - 1} onClick={() => onMove(1)}><Icon name="chevr" size="sm" /></button>
            <button className="btn icon sm dgr" title="Remove"
              aria-label={"Remove field " + (i + 1)}
              onClick={onRemove}><Icon name="x" size="sm" /></button>
          </span>
        </div>

        <div className="rs-field-r rs-field-o">
          <label className="rs-req">
            <input type="checkbox" checked={f.required}
              onChange={(e) => onChange({ required: e.target.checked })} />
            Required
          </label>
          <input className="inp rs-help" value={f.help || ""}
            placeholder="Help text, only if the label cannot carry it"
            aria-label={"Field " + (i + 1) + " help text"}
            onChange={(e) => onChange({ help: e.target.value || null })} />
        </div>

        {f.type === "select" ? <ChoiceOptions f={f} i={i} onChange={onChange} /> : null}

        {f.type === "file" ? <UploadRules f={f} i={i} onChange={onChange} /> : null}
      </div>
    </li>
  );
}

/** THE OPTIONS, AS THE THINGS THEY ARE. They were one comma-separated text box,
 *  which is a serialisation format, not a control: you could not see how many
 *  there were without counting commas, could not remove the third without
 *  editing around it, and a trailing comma silently made an option called
 *  nothing.
 *
 *  Each option is a chip with its own remove, and an add box that commits on
 *  Enter — the same gesture the tag and department fields use, so there is one
 *  way to build a list on this page rather than three. A comma still works,
 *  because pasting a list is the fastest way to enter one and refusing it would
 *  be a rule with nothing behind it.
 *
 *  A CHOICE FIELD WITH NO OPTIONS IS REFUSED ON SAVE, so the empty state here
 *  says what will happen rather than waiting to be a toast. */
function ChoiceOptions({ f, i, onChange }: {
  f: ResourceField; i: number; onChange: (patch: Partial<ResourceField>) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const next = cleanTags(f.options.concat(raw.split(",")));
    if (next.length !== f.options.length) onChange({ options: next });
    setDraft("");
  };

  const move = (n: number, by: number) => {
    const j = n + by;
    if (j < 0 || j >= f.options.length) return;
    const next = f.options.slice();
    const t = next[n];
    next[n] = next[j];
    next[j] = t;
    onChange({ options: next });
  };

  return (
    <div className="rs-choice">
      <div className="rs-field-r">
        <span className="rs-opt-k">Options</span>
        <span className="cell-2">
          {f.options.length
            ? f.options.length + (f.options.length === 1 ? " option" : " options")
            : "Add at least one — a choice field with none cannot be saved."}
        </span>
      </div>

      {f.options.length ? (
        <ol className="rs-opts-list">
          {f.options.map((o, n) => (
            <li key={o} className="rs-opt">
              <span className="rs-opt-n tnum" aria-hidden="true">{n + 1}</span>
              <span className="rs-opt-v">{o}</span>
              <button type="button" className="btn icon sm" title="Move up"
                aria-label={"Move option " + o + " up"}
                disabled={n === 0} onClick={() => move(n, -1)}>
                <Icon name="chev" size="sm" /></button>
              <button type="button" className="btn icon sm" title="Move down"
                aria-label={"Move option " + o + " down"}
                disabled={n === f.options.length - 1} onClick={() => move(n, 1)}>
                <Icon name="chevr" size="sm" /></button>
              <button type="button" className="btn icon sm dgr" title="Remove"
                aria-label={"Remove option " + o}
                onClick={() => onChange({ options: f.options.filter((y) => y !== o) })}>
                <Icon name="x" size="sm" /></button>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="rs-opt-add">
        <input className="inp" value={draft}
          placeholder={f.options.length ? "Add another option" : "First option, then Enter"}
          aria-label={"Add an option to field " + (i + 1)}
          onChange={(e) => {
            if (e.target.value.indexOf(",") >= 0) commit(e.target.value);
            else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) { e.preventDefault(); commit(draft); }
          }}
          onBlur={() => { if (draft.trim()) commit(draft); }} />
        <button type="button" className="btn sm" disabled={!draft.trim()}
          onClick={() => commit(draft)}>
          <Icon name="plus" size="sm" />Add
        </button>
      </div>
    </div>
  );
}

/** WHAT AN UPLOAD WILL TAKE, AND HOW BIG. Both are printed to the member before
 *  they open a file picker — a 40 MB photograph that fails at the end of itself
 *  is the failure this row exists to prevent, and an error afterwards is not the
 *  same thing as a rule beforehand.
 *
 *  No type selected is any file, which is the right default: narrowing is a
 *  decision, and a member turned away by a rule nobody meant to set is worse
 *  than a stray .docx. */
function UploadRules({ f, i, onChange }: {
  f: ResourceField; i: number; onChange: (patch: Partial<ResourceField>) => void;
}) {
  const capped = f.maxMb !== null;
  return (
    <div className="rs-upload">
      <div className="rs-field-r">
        <span className="rs-opt-k">Takes</span>
        <span className="rs-picks">
          {ACCEPT_KINDS.map((k) => (
            <button key={k} type="button"
              className={"chip" + (f.accept.indexOf(k) >= 0 ? " on" : "")}
              onClick={() => onChange({
                accept: (f.accept.indexOf(k) >= 0
                  ? f.accept.filter((x) => x !== k)
                  : f.accept.concat([k])) as AcceptKind[],
              })}>{ACCEPT_LABEL[k]}</button>
          ))}
          {!f.accept.length ? <span className="cell-2">any file</span> : null}
        </span>
      </div>

      <div className="rs-field-r">
        <span className="rs-opt-k">Max size</span>
        <label className="rs-req">
          <input type="checkbox" checked={capped}
            aria-label={"Cap the size of field " + (i + 1)}
            onChange={(e) => onChange({ maxMb: e.target.checked ? DEFAULT_MAX_MB : null })} />
          Limit it
        </label>
        {capped ? (
          <span className="rs-mb">
            <input className="inp" type="number" min={1} max={200}
              value={f.maxMb ?? DEFAULT_MAX_MB}
              aria-label={"Maximum megabytes for field " + (i + 1)}
              onChange={(e) => onChange({ maxMb: Math.max(1, Number(e.target.value) || 1) })} />
            <span className="rs-mb-u">MB</span>
          </span>
        ) : <span className="cell-2">No limit. A phone photograph can be 12 MB.</span>}
      </div>
    </div>
  );
}
