/* =============================================================================
   FacetPicker — the control behind Business type, Segments, Categories,
   Search keywords, Target areas, State and City.
   -----------------------------------------------------------------------------
   ONE component, chosen by the field's `type` and `open` in the profile
   schema. Not one component per field, because they would drift: the keyword
   field would grow a clear-all the segment field never got, and two of them
   would handle Escape differently.

     single   pick one value. Picking again replaces.
     multi    pick many values, capped.
     tags     shorthand for multi + open.

   `open` crosses both: it says the vocabulary is a SUGGESTION rather than a
   constraint, so `single + open` is City (one value, type your own) and
   `multi + open` is Target areas (a list, type your own). Segments and
   Categories are closed, and that is the whole reason the flag exists
   separately from the type.

   THE SELECTION SITS ABOVE THE CONTROL, not inside it. Chips-inside-the-input
   is the more common pattern and it is worse here: the input grows as you pick,
   the form reflows under the cursor, and past four or five values the search
   box you are typing into has moved somewhere else on the page. Above the
   control, the answer stays in one place and the box you type into never moves.

   WHY THE CLOSED LISTS ARE CLOSED. Business type, Segments, Categories and
   State refuse anything not in the vocabulary. They are what the marketplace
   filters and ranks on, and free text fragments a facet inside a month —
   "3D Designer", "3d designer" and "3D visualiser" become three buckets
   holding one thing, and every one ranks worse than the single bucket would
   have. City, Search keywords and Target areas are open, because each is a
   set nobody can enumerate: there are thousands of cities, "complete home
   decor" is not a taxonomy entry, and "Uttam Nagar, Delhi" is a real service
   area. That split is one flag per field in the JSON, so it is a decision,
   not a wall.

   Accessibility follows the WAI-ARIA combobox pattern: the input owns
   `role="combobox"`, the popup is a `listbox`, the active option is tracked
   with `aria-activedescendant` rather than by moving focus, Escape closes and
   returns focus, and Backspace on an empty box removes the last chip.
   ============================================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../ui";
import { cleanKeyword, groupsFor, optionsFor } from "./store";
import type { FacetOption, ProfileField } from "./store";

/** The chips. Above the control on purpose — see the file header. Exported
 *  for the render harness, which asserts the stale branch displaces the tone. */
export function Chips({ f, values, onRemove, disabled, options: given }: {
  f: ProfileField;
  values: string[];
  onRemove: (k: string) => void;
  disabled?: boolean;
  options?: FacetOption[];
}) {
  if (!values.length) return null;
  const opts = given || optionsFor(f);
  return (
    <div className="um-chips" role="list">
      {values.map((v) => {
        const hit = opts.filter((o) => o.key === v)[0];
        /* A value the vocabulary no longer has is still a fact about this
           profile. It renders, flagged, rather than vanishing — a silently
           dropped chip is a data migration nobody finds out about. */
        const stale = !f.open && f.type !== "tags" && !hit;
        return (
          /* The tone comes off when a chip is stale: a value the vocabulary
             dropped must not wear the colours of one it still has. */
          <span className={"pill um-chip " + (stale ? "warn" : (f.chip || ""))} role="listitem" key={v}
            title={stale ? "Not in the current vocabulary — saved before it changed." : undefined}>
            {hit ? hit.label : v}
            {disabled ? null : (
              <button type="button" className="um-chip-x" onClick={() => onRemove(v)}
                aria-label={"Remove " + (hit ? hit.label : v)}>
                <Icon name="x" size="sm" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function FacetPicker({ f, values, onChange, disabled, options: given }: {
  f: ProfileField;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Override the schema-resolved options. For DEPENDENT vocabularies — a
   *  target-area row's city list depends on which state that row picked, and
   *  the schema registry cannot know that. */
  options?: FacetOption[];
}) {
  const single = f.type === "single";
  /* OPENNESS IS A FLAG, NOT A TYPE. It started as `type === "tags"`, which
     made "accepts free text" and "holds a list" the same decision — and they
     are not: City is one value that accepts anything, Target areas is a list
     that does, Segments is a list that does not. */
  const free = f.type === "tags" || f.open === true;
  const max = single ? 1 : f.max || 99;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const options = given || optionsFor(f);
  const groups = groupsFor(f);
  const full = values.length >= max;

  /* Already-picked options leave the list rather than sitting in it greyed
     out: the list is what you can still do, and a menu mostly made of things
     you have already done is a menu you stop reading. */
  const matches = useMemo(() => {
    const needle = cleanKeyword(q).toLowerCase();
    return options.filter((o) =>
      values.indexOf(o.key) < 0
      && (!needle || o.label.toLowerCase().indexOf(needle) >= 0));
  }, [options, values, q]);

  /* The typed value, offered as itself. Only on an open field, and only when
     it is not already a suggestion and not already picked. */
  const typed = cleanKeyword(q);
  const canAddTyped = free && !!typed
    && !matches.some((o) => o.label.toLowerCase() === typed.toLowerCase())
    && !values.some((v) => v.toLowerCase() === typed.toLowerCase())
    && (!f.maxLength || typed.length <= f.maxLength);

  const rows: (FacetOption | "new")[] = canAddTyped
    ? (["new"] as (FacetOption | "new")[]).concat(matches)
    : matches;

  useEffect(() => { setActive(0); }, [q, open]);

  /* Outside click and Escape both close. Without the first, a picker left open
     sits over the field below it and swallows the next click on the form. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const commit = (key: string) => {
    if (single) {
      onChange([key]);
      setQ("");
      setOpen(false);
      return;
    }
    if (values.indexOf(key) >= 0 || full) return;
    onChange(values.concat([key]));
    setQ("");
    /* Stays open. Picking three segments should be three keystrokes, not
       three round trips through the trigger. */
  };
  const remove = (key: string) => onChange(values.filter((v) => v !== key));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (rows.length ? (i + d + rows.length) % rows.length : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const r = rows[active];
      if (r === "new") commit(typed);
      else if (r) commit(r.key);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQ("");
      return;
    }
    /* Backspace on an empty box takes the last chip back. The standard
       shortcut, and the reason the chips do not each need reaching for. */
    if (e.key === "Backspace" && !q && values.length) {
      e.preventDefault();
      remove(values[values.length - 1]);
    }
  };

  const listId = "facet-list-" + f.key;
  const optId = (i: number) => "facet-" + f.key + "-" + i;

  /* Grouped rendering only where the schema says the vocabulary has groups.
     Categories mixes a delivery model with a sector — two different questions
     — and flattening them makes somebody choose as though they were one. */
  const rendered = () => {
    if (!rows.length) {
      return (
        <li className="um-opt none" role="presentation">
          {full
            ? "That is the maximum of " + max + ". Remove one to add another."
            : free
              ? "Type to add a keyword."
              : q ? "Nothing matches “" + q + "”." : "Everything here is already picked."}
        </li>
      );
    }
    const row = (r: FacetOption | "new", i: number) => {
      if (r === "new") {
        return (
          <li key="new" id={optId(i)} role="option" aria-selected={active === i}
            className={"um-opt add" + (active === i ? " on" : "")}
            onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()}
            onClick={() => commit(typed)}>
            <Icon name="plus" size="sm" />
            <b>Add “{typed}”</b>
          </li>
        );
      }
      return (
        <li key={r.key} id={optId(i)} role="option" aria-selected={active === i}
          className={"um-opt" + (active === i ? " on" : "")}
          onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()}
          onClick={() => commit(r.key)}>
          <span className="l">{r.label}</span>
          {/* A field with an i button keeps its dropdown simple — the
              sentences live in the info panel, not on every row. */}
          {r.hint && !f.info ? <em>{r.hint}</em> : null}
        </li>
      );
    };
    if (!groups.length) return rows.map(row);
    const out: React.ReactNode[] = [];
    groups.forEach((g) => {
      const mine = rows.filter((r) => r !== "new" && (r as FacetOption).group === g.key);
      if (!mine.length) return;
      out.push(
        <li className="um-optg" role="presentation" key={"g-" + g.key}>
          {g.label}{g.note ? <em>{g.note}</em> : null}
        </li>,
      );
      mine.forEach((r) => out.push(row(r, rows.indexOf(r))));
    });
    /* Anything the groups did not claim still has to render, or a vocabulary
       entry with a typo'd group silently disappears from the picker. */
    rows.forEach((r, i) => {
      if (r === "new" || !groups.some((g) => g.key === (r as FacetOption).group)) {
        out.unshift(row(r, i));
      }
    });
    return out;
  };

  return (
    <div className={"um-facet" + (open ? " open" : "")} ref={box}>
      <Chips f={f} values={values} onRemove={remove} disabled={disabled} options={given} />

      {single && values.length && !open && !free ? null : (
        <div className="um-facet-in">
          <Icon name="search" size="sm" />
          <input
            ref={input}
            className="inp"
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={open && rows.length ? optId(active) : undefined}
            aria-label={f.label}
            disabled={disabled || (full && !free && !single)}
            placeholder={
              full && !single
                ? max + " of " + max + " picked"
                : free ? "Type a phrase, or pick a suggestion"
                  : single ? "Choose one" : "Search and pick"
            }
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
          />
          {!open ? null : (
            <button type="button" className="um-facet-x" aria-label="Close the list"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setOpen(false); if (input.current) input.current.focus(); }}>
              <Icon name="x" size="sm" />
            </button>
          )}
        </div>
      )}

      {single && values.length && !open && !free ? (
        <button type="button" className="btn sm um-facet-re" disabled={disabled}
          onClick={() => setOpen(true)}>Change</button>
      ) : null}

      {open ? (
        <ul className="um-opts" role="listbox" id={listId}
          aria-multiselectable={single ? undefined : true} aria-label={f.label}>
          {rendered()}
        </ul>
      ) : null}

      <p className="um-facet-fine">
        {f.hint ? <span>{f.hint}</span> : null}
        {f.max && !single
          ? <b className={full ? "warn" : ""}>{values.length}/{f.max}</b>
          : null}
      </p>
    </div>
  );
}
