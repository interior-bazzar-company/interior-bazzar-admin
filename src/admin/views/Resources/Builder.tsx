/* =============================================================================
   The builder — #/resources/new and #/resources/:id/edit
   -----------------------------------------------------------------------------
   TWO PANES, AND THEY ARE NOT EQUAL. On the left the form's fields, in the
   order the member meets them; on the right the one field you are editing. A
   form is a sequence and a field is a record inside it, so the page is the
   pattern the panel uses for every sequence of records: the list beside the
   thing selected in it.

   IT REPLACED A SPINE OF ELEVEN OPEN EDITORS. Every field carried its label,
   its kind, its help text, its options and its upload rules on screen at once,
   which meant a form with eleven fields was a page nobody could see the shape
   of. The list now says what each field IS — its position, its kind, whether it
   is required, whether it is broken — and the editor says everything else about
   the ONE you are changing.

   ORDER IS REAL INFORMATION HERE, so the list is numbered and moving a field is
   two presses on the row rather than a drag nobody discovers.

   UNDER `lg` THE PANES STACK: the list is the page and the editor is a drawer
   over it, because two columns of controls at 390px is one column of controls
   with half the room each.

   NOTHING SAVES UNTIL SAVE. Every edit here is local state; the store is
   touched once, by one call, and the screen leaves on success. A builder that
   wrote through on each keystroke would version a form eleven times.
   ============================================================================= */
import { useMemo, useState } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, Card, Checkbox, ChipInput, DrawerShell, EmptyState, FieldRow, FormField,
  FormSection, Icon, IconButton, Input, InputGroup, PageHeader, SelectInput, Table, TbTitle,
  Textarea,
} from "../../ui";
import type { MenuItem } from "../../ui";
import { go } from "../../ui/nav";
import { FormPreview } from "./index";
import { FieldCard, Suggestions, TypeMark } from "./bits";
import {
  ACCEPT_KINDS, ACCEPT_LABEL, DEFAULT_MAX_MB, FIELD_TYPES, TAG_SUGGESTIONS, audienceOf,
  cleanTags, createResource, departmentsInUse, departmentsNamed, emptyField, resourceOf,
  responsesFor, tagsInUse, typeLabel, updateResource,
} from "./store";
import type { AcceptKind, FieldType, ResourceField } from "./store";

const ROUTE = "#/resources";

export default function Builder({ mode, resourceId }: {
  mode: "create" | "edit";
  resourceId?: string;
}) {
  const shell = useShell();
  const wide = useBreakpoint("lg");
  const existing = mode === "edit" && resourceId ? resourceOf(resourceId) : null;

  const [title, setTitle] = useState(existing ? existing.title : "");
  const [description, setDescription] = useState(existing ? existing.description : "");
  const [tags, setTags] = useState<string[]>(existing ? existing.tags.slice() : []);
  const [departments, setDepartments] = useState<string[]>(
    existing ? existing.departments.slice() : []);
  const [fields, setFields] = useState<ResourceField[]>(
    existing ? JSON.parse(JSON.stringify(existing.fields)) as ResourceField[] : [emptyField()]);
  /* WHICH FIELD THE RIGHT PANE IS ABOUT. An index rather than an id: a field
     removed from under the selection should leave the selection on whatever is
     now in that position, which is where the eye already is. */
  const [sel, setSel] = useState(0);

  usePageChrome({
    crumbs: (
      <>
        <TbTitle label="Data Forms" to={ROUTE} />
        <Icon name="chevr" size="xs" className="shrink-0 text-fg-quaternary" />
        <span className="truncate text-sm font-semibold text-primary">
          {existing ? "Edit" : "New form"}
        </span>
      </>
    ),
    parent: existing ? ROUTE + "?form=" + existing.resourceId : ROUTE,
  }, (resourceId || "new"));

  /* THE LIVE ANSWER TO THE DEPARTMENT. Same `audienceOf` the table runs, so the
     builder can never promise a number the module then disagrees with. */
  const goesTo = useMemo(() => audienceOf({ departments }), [departments]);

  if (mode === "edit" && !existing) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState icon="search" title="No such form"
          body="It may have been deleted, or the link is stale."
          action={<Button color="primary" onClick={() => go(ROUTE)}>Back to Data Forms</Button>} />
      </div>
    );
  }

  const back = existing ? ROUTE + "?form=" + existing.resourceId : ROUTE;
  const answered = existing ? responsesFor(existing.resourceId).length : 0;
  const fieldsChanged = !!existing
    && JSON.stringify(existing.fields) !== JSON.stringify(fields);
  /* What would refuse to save, counted where it can be seen rather than saved
     for a toast. `createResource` owns the real rule; this is the same reading
     of the same two conditions. */
  const broken = fields.filter((f) => !f.label.trim()
    || (f.type === "select" && !f.options.length)).length;

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
    setSel(j);
  };

  const addField = () => {
    setFields(fields.concat([emptyField()]));
    setSel(fields.length);
  };

  const removeField = (i: number) => {
    setFields(fields.filter((_, n) => n !== i));
    setSel(Math.max(0, Math.min(i, fields.length - 2)));
  };

  /* Under `lg` the editor is a drawer. It keeps its OWN copy of the field and
     hands every change up: the shell holds the node it was given, so a drawer
     reading the parent's state would show the field as it was when it opened. */
  const openField = (i: number) => {
    if (wide) { setSel(i); return; }
    setSel(i);
    shell.drawer(
      <FieldSheet field={fields[i]} i={i} onApply={(patch) => setField(i, patch)} />,
      undefined, "md");
  };

  const preview: MenuItem = {
    icon: "eye", label: "Preview",
    title: "The form as the member meets it",
    act: () => shell.drawer(
      <DrawerShell title="What they see"
        sub={goesTo.length === 0 ? "Goes to nobody yet"
          : "Goes to " + goesTo.length + (goesTo.length === 1 ? " person" : " people")}
        onClose={() => shell.closeLayer()}>
        <FormPreview r={{ title, description, fields }} />
      </DrawerShell>, undefined, "md"),
  };

  const save = () => {
    const draft = { title, description, tags, departments, fields };
    const res = existing
      ? updateResource(existing.resourceId, draft)
      : createResource(draft);
    if (!res.ok) { shell.toast(res.message, "bad"); return; }
    shell.toast(existing ? "Changes saved." : "Form created.", "ok");
    go(ROUTE + "?form=" + res.value.resourceId);
  };

  const current = fields[sel];

  return (
    <div className="flex flex-col gap-4">
      {/* THE PRIMARY IS SAVE, and it is the only primary on the page. Preview
          is a secondary that folds into one menu under `lg` rather than
          stacking three controls over the title. */}
      <PageHeader
        eyebrow={existing ? "Editing" : "New form"}
        back={{ label: "Data Forms", to: back }}
        title={existing ? existing.title : title || "Untitled form"}
        meta={existing
          ? <>
              <span className="font-mono tnum">v{existing.version}</span>
              <span>{answered} {answered === 1 ? "response" : "responses"}</span>
              <span>{fields.length} {fields.length === 1 ? "field" : "fields"}</span>
            </>
          : <span>It opens as soon as you create it. You send the links yourself — nothing is emailed.</span>}
        fold={[preview]}
        actions={
          <>
            <Button color="secondary" onClick={() => go(back)}>Cancel</Button>
            <Button color="primary" ico="check" onClick={save}>
              {existing ? "Save changes" : "Create form"}
            </Button>
          </>
        } />

      {answered > 0 && fieldsChanged ? (
        <Alert tone="warn" title={"This becomes version " + (existing ? existing.version + 1 : 2) + "."}>
          {answered} {answered === 1 ? "person has" : "people have"} already answered, and
          changing a field cannot change what they said. Their answers keep the labels they
          were given and stay readable exactly as they are.
        </Alert>
      ) : null}

      {/* ------------------------------------------------------- details -- */}
      <Card title="Form details" sub="What it is called, and who it goes to.">
        <FormSection>
          <FormField id="rs-title" label="Title" req
            hint="What this form is called everywhere else in the panel.">
            <Input id="rs-title" value={title} ph="Sales onboarding pack"
              onChange={setTitle} />
          </FormField>

          <FormField id="rs-desc" label="Description"
            hint="One or two lines. What it is for, not what is in it.">
            <Textarea id="rs-desc" rows={2} value={description}
              ph="Everything a new joiner has to hand back in week one."
              onChange={setDescription} />
          </FormField>

          <FieldRow>
            <FormField id="rs-tag" label="Tags"
              hint="What an operator calls this in their own head.">
              <div className="flex flex-col gap-2">
                <ChipInput id="rs-tag" value={tags} onChange={setTags}
                  clean={(v) => cleanTags(v)}
                  placeholder={tags.length ? "Add another" : "Type a tag and press Enter"} />
                <Suggestions label="Try"
                  items={offer(Array.from(new Set(TAG_SUGGESTIONS.concat(tagsInUse()))), tags)}
                  onPick={(t) => setTags(cleanTags(tags.concat([t])))} />
              </div>
            </FormField>

            {/* THE AUDIENCE. Several departments, and a name that is on no
                roster yet is still accepted — a department can exist before
                anybody is filed under it, so this is a chip field with
                suggestions rather than a closed list. EMPTY IS EVERYONE, and
                the hint says so: the difference between a company-wide form and
                one that reaches nobody is an empty list. */}
            <FormField id="rs-dept" label="Department"
              hint={departments.length
                ? goesTo.length
                  ? "Only " + departments.join(" and ") + " — " + goesTo.length
                    + (goesTo.length === 1 ? " person" : " people") + " right now, and anyone who joins later."
                  : "Nobody is in " + departments.join(" or ") + " yet. It will pick people up as they join."
                : "Everyone — " + goesTo.length + " active "
                  + (goesTo.length === 1 ? "member" : "members") + ". Name a department to narrow it."}>
              <div className="flex flex-col gap-2">
                <ChipInput id="rs-dept" value={departments} onChange={setDepartments}
                  clean={(v) => cleanTags(v)}
                  placeholder={departments.length ? "Add another"
                    : "Everyone — type a department to narrow it"} />
                <Suggestions label="On the roster"
                  items={offer(Array.from(new Set(departmentsInUse().concat(departmentsNamed()))), departments)}
                  onPick={(d) => setDepartments(cleanTags(departments.concat([d])))} />
              </div>
            </FormField>
          </FieldRow>
        </FormSection>
      </Card>

      {/* --------------------------------------------------------- form -- */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card tight
          tone={broken ? "warning" : undefined}
          title="Fields"
          sub={fields.length
            ? fields.length + (fields.length === 1 ? " field" : " fields")
              + (broken ? " · " + broken + " unfinished" : "")
            : "None yet"}
          right={<Button color="secondary" size="xs" ico="plus" onClick={addField}>Add</Button>}>
          {fields.length ? (
            <ol className="flex flex-col gap-2">
              {fields.map((f, i) => (
                <FieldCard key={f.fieldId} f={f} i={i} n={fields.length}
                  on={wide && i === sel}
                  onOpen={() => openField(i)}
                  onMove={(by) => move(i, by)}
                  onRemove={() => removeField(i)} />
              ))}
            </ol>
          ) : (
            <EmptyState flat icon="doc" title="No fields yet"
              body="A form with none has nothing to send back."
              action={<Button color="primary" ico="plus" onClick={addField}>Add the first field</Button>} />
          )}
        </Card>

        {wide ? (
          current ? (
            <Card
              title={<span className="flex items-center gap-2">
                <TypeMark type={current.type} />
                {current.label || "Field " + (sel + 1)}
              </span>}
              sub={typeLabel(current.type) + " · field " + (sel + 1) + " of " + fields.length}
              right={<Button color="secondary" size="xs" ico="trash"
                onClick={() => removeField(sel)}>Remove</Button>}>
              <FieldEditor f={current} i={sel} onChange={(patch) => setField(sel, patch)} />
            </Card>
          ) : (
            <Card>
              <EmptyState flat icon="doc" title="Nothing to edit"
                body="Add a field and it opens here." />
            </Card>
          )
        ) : null}
      </div>
    </div>
  );
}

/** A suggestion already taken is clutter, so it goes; six is as many as a row
 *  can carry without becoming a list of its own. */
function offer(all: string[], taken: string[]): string[] {
  const used: Record<string, boolean> = {};
  taken.forEach((t) => { used[t.toLowerCase()] = true; });
  return all.filter((t) => !used[t.toLowerCase()]).slice(0, 6);
}

/* ---------------------------------------------------------- one field --- */

/** ONE FIELD, EVERY DECISION ABOUT IT. The rows split by frequency rather than
 *  by importance: a label and a kind are set on every field, so they lead;
 *  required and help text follow; the options and the upload rules appear only
 *  for the kind that has them.
 *
 *  It is a controlled component with no state of its own, so the same editor
 *  draws the right-hand pane and the drawer under `lg`. */
function FieldEditor({ f, i, onChange }: {
  f: ResourceField; i: number;
  onChange: (patch: Partial<ResourceField>) => void;
}) {
  const id = "rs-f" + f.fieldId;
  return (
    <FormSection>
      <FieldRow>
        <FormField id={id + "-l"} label="Label" req
          hint="The question, as the member reads it.">
          <Input id={id + "-l"} value={f.label} ph="Question or label"
            onChange={(v) => onChange({ label: v })} />
        </FormField>

        <FormField id={id + "-t"} label="Kind"
          hint="What sort of answer it takes.">
          <SelectInput id={id + "-t"} value={f.type}
            options={FIELD_TYPES.map((t) => ({ v: t.key, l: t.label }))}
            onChange={(v) => {
              const type = v as FieldType;
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
            }} />
        </FormField>
      </FieldRow>

      <FormField id={id + "-h"} label="Help text"
        hint="Only if the label cannot carry it.">
        <Input id={id + "-h"} value={f.help || ""}
          ph="A line under the field, in smaller type"
          onChange={(v) => onChange({ help: v || null })} />
      </FormField>

      <Checkbox id={id + "-r"} checked={f.required} label="Required"
        hint="They cannot submit the form without it."
        onChange={(v) => onChange({ required: v })} />

      {f.type === "select" ? <ChoiceOptions f={f} i={i} onChange={onChange} /> : null}
      {f.type === "file" ? <UploadRules f={f} i={i} onChange={onChange} /> : null}
    </FormSection>
  );
}

/** THE EDITOR AS A DRAWER, under `lg`. It holds its own copy of the field and
 *  reports every change upward: the shell keeps the node it was handed, so an
 *  editor that read the page's state would show the field as it was when the
 *  drawer opened and never move again. */
function FieldSheet({ field, i, onApply }: {
  field: ResourceField; i: number; onApply: (patch: Partial<ResourceField>) => void;
}) {
  const shell = useShell();
  const [f, setF] = useState(field);
  const change = (patch: Partial<ResourceField>) => {
    setF((prev) => ({ ...prev, ...patch }));
    onApply(patch);
  };
  return (
    <DrawerShell
      title={"Field " + (i + 1)}
      sub={f.label || "Unnamed field"}
      onClose={() => shell.closeLayer()}
      actions={<Button color="primary" onClick={() => shell.closeLayer()}>Done</Button>}>
      <FieldEditor f={f} i={i} onChange={change} />
    </DrawerShell>
  );
}

/* ------------------------------------------------------------- options -- */

/** THE OPTIONS, AS THE THINGS THEY ARE. They were one comma-separated text box,
 *  which is a serialisation format, not a control: you could not see how many
 *  there were without counting commas, could not remove the third without
 *  editing around it, and a trailing comma silently made an option called
 *  nothing.
 *
 *  A short table instead — the position, the word, and the three things you do
 *  to it. A comma in the add box still splits, because pasting a list is the
 *  fastest way to enter one and refusing it would be a rule with nothing behind
 *  it.
 *
 *  A CHOICE FIELD WITH NO OPTIONS IS REFUSED ON SAVE, so the empty state says
 *  what will happen rather than waiting to be a toast. */
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="label-mono">Options</span>
        <span className="text-xs text-tertiary">
          {f.options.length
            ? f.options.length + (f.options.length === 1 ? " option" : " options")
            : "A choice field with none cannot be saved."}
        </span>
      </div>

      <Table
        list
        cols={[
          { label: "#", cls: "n", w: "3.5rem" },
          { label: "Option" },
          { label: "", cls: "acts", w: "8rem" },
        ]}
        empty={{ icon: "list", title: "No options yet", body: "Add the first one below." }}
        rows={f.options.map((o, n) => (
          <tr key={o}>
            <td className="n text-quaternary">{n + 1}</td>
            <td className="cell-1">{o}</td>
            <td className="acts">
              <span className="inline-flex items-center justify-end gap-0.5">
                <IconButton size="xs" ico="chevu" label={"Move option " + o + " up"}
                  isDisabled={n === 0} onClick={() => move(n, -1)} />
                <IconButton size="xs" ico="chev" label={"Move option " + o + " down"}
                  isDisabled={n === f.options.length - 1} onClick={() => move(n, 1)} />
                <IconButton size="xs" ico="trash" label={"Remove option " + o}
                  onClick={() => onChange({ options: f.options.filter((y) => y !== o) })} />
              </span>
            </td>
          </tr>
        ))} />

      <div className="flex items-center gap-2">
        <Input value={draft}
          ph={f.options.length ? "Add another option" : "First option, then Enter"}
          ariaLabel={"Add an option to field " + (i + 1)}
          onChange={(v) => { if (v.indexOf(",") >= 0) commit(v); else setDraft(v); }}
          onEnter={() => { if (draft.trim()) commit(draft); }}
          onBlur={() => { if (draft.trim()) commit(draft); }} />
        <Button color="secondary" ico="plus" isDisabled={!draft.trim()}
          onClick={() => commit(draft)}>Add</Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- upload rules -- */

/** WHAT AN UPLOAD WILL TAKE, AND HOW BIG. Both are printed to the member before
 *  they open a file picker — a 40 MB photograph that fails at the end of itself
 *  is the failure this block exists to prevent, and an error afterwards is not
 *  the same thing as a rule beforehand.
 *
 *  No type ticked is any file, which is the right default: narrowing is a
 *  decision, and a member turned away by a rule nobody meant to set is worse
 *  than a stray .docx. */
function UploadRules({ f, i, onChange }: {
  f: ResourceField; i: number; onChange: (patch: Partial<ResourceField>) => void;
}) {
  const capped = f.maxMb !== null;
  return (
    <div className="flex flex-col gap-3">
      <span className="label-mono">Upload rules</span>

      <FormField label="Takes"
        hint={f.accept.length ? undefined : "Nothing ticked means any file."}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACCEPT_KINDS.map((k) => (
            <Checkbox key={k} label={ACCEPT_LABEL[k]}
              checked={f.accept.indexOf(k) >= 0}
              onChange={(on) => onChange({
                accept: (on ? f.accept.concat([k]) : f.accept.filter((x) => x !== k)) as AcceptKind[],
              })} />
          ))}
        </div>
      </FormField>

      <Checkbox checked={capped} label="Cap the size"
        ariaLabel={"Cap the size of field " + (i + 1)}
        hint={capped ? undefined : "No limit. A phone photograph can be 12 MB."}
        onChange={(on) => onChange({ maxMb: on ? DEFAULT_MAX_MB : null })} />

      {capped ? (
        <FormField label="Maximum size" cls="max-w-40">
          <InputGroup post="MB">
            <Input type="number" min={1} max={200} mono
              value={String(f.maxMb ?? DEFAULT_MAX_MB)}
              ariaLabel={"Maximum megabytes for field " + (i + 1)}
              onChange={(v) => onChange({ maxMb: Math.max(1, Number(v) || 1) })} />
          </InputGroup>
        </FormField>
      ) : null}
    </div>
  );
}
