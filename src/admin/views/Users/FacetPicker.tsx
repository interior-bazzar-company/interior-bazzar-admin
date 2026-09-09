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

   THE LIST NOW HOLDS WHAT IS PICKED, WITH A TICK. It used to drop a value out
   of the list the moment it was chosen, on the argument that "the list is what
   you can still do". Two things were wrong with it: the panel's own
   `MultiSelect` keeps a chosen row and ticks it, so this was a second drawing
   of one idea; and a list whose rows move under the cursor as you pick makes
   the third pick land on the row you were not aiming at. Picking a ticked row
   takes the value off again, which is the reason a tick can be pressed at all.
   AT THE CAP the list narrows to what you have picked, so the only thing you
   can do there — take one off — is the only thing offered.

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

   A CLOSED SINGLE READS AS A SELECT. State used to answer as a chip plus a
   "Change" button — a two-part control for a one-value answer, and the only
   place on the form where the answer was not in the box. Now the box shows the
   answer with a chevron; focusing it opens the same searchable list, with the
   current value marked. One control, one place to look, and it matches the
   plain select Business type uses.

   Accessibility follows the WAI-ARIA combobox pattern: the input owns
   `role="combobox"`, the popup is a `listbox`, the active option is tracked
   with `aria-activedescendant` rather than by moving focus, Escape closes and
   returns focus, and Backspace on an empty box removes the last chip.
   ============================================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import { InputBase } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import { Icon, IconButton, Tag, iconOf } from "../../ui";
import { OptionGroup, OptionNote, OptionRow, Pop } from "./bits";
import { cleanKeyword, groupsFor, optionsFor } from "./store";
import type { FacetOption, ProfileField } from "./store";

/** The chips. Above the control on purpose — see the file header. Exported
 *  for the render harness, which asserts the stale branch displaces the tone. */
export function Chips({ f, values, onRemove, disabled, options: given, below }: {
  f: ProfileField;
  values: string[];
  onRemove: (k: string) => void;
  disabled?: boolean;
  options?: FacetOption[];
  /** Chips under the control instead of above it. */
  below?: boolean;
}) {
  if (!values.length) return null;
  const opts = given || optionsFor(f);
  const items = values.map((v) => {
    const hit = opts.filter((o) => o.key === v)[0];
    /* A value the vocabulary no longer has is still a fact about this
       profile. It renders, flagged, rather than vanishing — a silently
       dropped chip is a data migration nobody finds out about. */
    return { v, label: hit ? hit.label : v, stale: !f.open && f.type !== "tags" && !hit };
  });
  const stale = items.filter((i) => i.stale).length;
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", below ? "mt-2" : "mb-2")}>
      <div className="flex flex-wrap items-center gap-1.5" role="list">
        {items.map((it) => (
          <span role="listitem" key={it.v} className="inline-flex max-w-full">
            {/* The tone comes off when a chip is stale: a value the vocabulary
                dropped must not wear the colours of one it still has. */}
            <Tag
              tone={it.stale ? "warn" : f.chip}
              onRemove={disabled ? undefined : () => onRemove(it.v)}
              label={
                it.stale ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Icon name="alert" size="xs" />
                    <span className="truncate">{it.label}</span>
                  </span>
                ) : (
                  <span className="block max-w-56 truncate">{it.label}</span>
                )
              }
            />
          </span>
        ))}
      </div>
      {/* SAID ONCE, NOT PER CHIP. The flag on the chip is the marker; this is
          what the marker means, and a `title=` nobody hovers is not it. */}
      {stale ? (
        <p className="text-xs text-tertiary">
          {stale === 1 ? "One value is" : stale + " values are"} not in the current vocabulary —
          saved before it changed.
        </p>
      ) : null}
    </div>
  );
}

export default function FacetPicker({ f, values, onChange, disabled, options: given, chipsBelow }: {
  f: ProfileField;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Chips UNDER the input rather than above it. The default (above) keeps
   *  the box you type into from moving; the exception is a picker that sits
   *  beside another control — a Target row's cities next to its state — where
   *  the two boxes lining up on one row matters more than the chips' side. */
  chipsBelow?: boolean;
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
  /* Closed single: the box IS the answer. Open singles (City) keep the chip,
     because a typed value needs a remove control the list cannot offer. */
  const selectLike = single && !free;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const options = given || optionsFor(f);
  const groups = groupsFor(f);
  const full = values.length >= max;
  const capped = full && !single;
  const pickedLabel = selectLike && values.length
    ? ((options.filter((o) => o.key === values[0])[0] || { label: values[0] }).label)
    : "";

  /* At the cap the pool narrows to what is already on, so the list offers the
     one move left rather than a screen of rows that refuse to be pressed. */
  const matches = useMemo(() => {
    const needle = cleanKeyword(q).toLowerCase();
    const pool = capped ? options.filter((o) => values.indexOf(o.key) >= 0) : options;
    return pool.filter((o) => !needle || o.label.toLowerCase().indexOf(needle) >= 0);
  }, [options, values, q, capped]);

  /* The typed value, offered as itself. Only on an open field, only below the
     cap, and only when it is not already a suggestion and not already picked. */
  const typed = cleanKeyword(q);
  const canAddTyped = free && !!typed && !full
    && !matches.some((o) => o.label.toLowerCase() === typed.toLowerCase())
    && !values.some((v) => v.toLowerCase() === typed.toLowerCase())
    && (!f.maxLength || typed.length <= f.maxLength);

  const rows: (FacetOption | "new")[] = canAddTyped
    ? (["new"] as (FacetOption | "new")[]).concat(matches)
    : matches;

  useEffect(() => { setActive(0); }, [q, open]);

  /* THE ACTIVE ROW IS KEPT IN VIEW. `aria-activedescendant` moves the reader's
     cursor without moving focus, so nothing scrolls the popup on its own —
     arrowing past the sixth option walked off the bottom of it. */
  const activeId = open && rows.length ? "facet-" + f.key + "-" + active : "";
  useEffect(() => {
    if (!activeId) return;
    const el = document.getElementById(activeId);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  /* Outside click and Escape both close. Without the first, a picker left open
     sits over the field below it and swallows the next click on the form. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(""); }
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
    /* A TICKED ROW IS A CONTROL. Pressing it takes the value off, which is the
       only thing the cap leaves anybody to do. */
    if (values.indexOf(key) >= 0) { onChange(values.filter((v) => v !== key)); return; }
    if (full) return;
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
      /* CLOSES THE LIST, NOT THE DIALOG. The modal shell listens for Escape
         on the document; letting this one through discarded a ten-field
         form because somebody closed a dropdown. */
      e.preventDefault();
      e.stopPropagation();
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
    const out: React.ReactNode[] = [];
    if (capped) {
      out.push(
        <OptionNote key="cap">
          That is the maximum of {max}. Take one off to add another.
        </OptionNote>,
      );
    }
    if (!rows.length) {
      out.push(
        <OptionNote key="none">
          {free
            ? "Type to add a keyword."
            : q ? "Nothing matches “" + q + "”." : "Nothing to pick from."}
        </OptionNote>,
      );
      return out;
    }
    const row = (r: FacetOption | "new", i: number) => {
      if (r === "new") {
        return (
          <OptionRow key="new" id={optId(i)} active={active === i}
            onHover={() => setActive(i)} onPick={() => commit(typed)}
            label={<span className="inline-flex items-center gap-1.5 font-medium text-brand-secondary">
              <Icon name="plus" size="sm" />Add “{typed}”
            </span>} />
        );
      }
      const picked = values.indexOf(r.key) >= 0;
      return (
        <OptionRow key={r.key} id={optId(i)} active={active === i} picked={picked}
          /* The tick is a checkbox on a list that holds several and a mark on a
             list that holds one — the same distinction the panel's own
             MultiSelect and Select draw. */
          box={!single}
          label={r.label}
          /* A field with an i button keeps its dropdown simple — the
             sentences live in the info panel, not on every row. */
          hint={r.hint && !f.info ? r.hint : undefined}
          onHover={() => setActive(i)}
          onPick={() => commit(r.key)} />
      );
    };
    if (!groups.length) {
      rows.forEach((r, i) => out.push(row(r, i)));
      return out;
    }
    const grouped: React.ReactNode[] = [];
    groups.forEach((g) => {
      const mine = rows.filter((r) => r !== "new" && (r as FacetOption).group === g.key);
      if (!mine.length) return;
      grouped.push(<OptionGroup key={"g-" + g.key} label={g.label} note={g.note} />);
      mine.forEach((r) => grouped.push(row(r, rows.indexOf(r))));
    });
    /* Anything the groups did not claim still has to render, or a vocabulary
       entry with a typo'd group silently disappears from the picker. */
    rows.forEach((r, i) => {
      if (r === "new" || !groups.some((g) => g.key === (r as FacetOption).group)) {
        grouped.unshift(row(r, i));
      }
    });
    return out.concat(grouped);
  };

  const placeholder = capped
    ? max + " of " + max + " picked"
    : selectLike && open && pickedLabel
      ? pickedLabel
      : f.placeholder || (free ? "Search or type your own"
        : single ? "Choose one" : "Search and pick");

  return (
    <div className="relative flex min-w-0 flex-col" ref={box}>
      {selectLike || chipsBelow ? null : (
        <Chips f={f} values={values} onRemove={remove} disabled={disabled} options={given} />
      )}

      <div className="relative flex min-w-0 items-center">
        <InputBase
          ref={input}
          size="sm"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeId || undefined}
          aria-label={f.label}
          isDisabled={disabled}
          disabled={disabled}
          icon={selectLike && !open ? undefined : iconOf("search")}
          placeholder={placeholder}
          /* Closed select-like: the box shows the answer, read-only, and a
             press opens the list. Open: it is the search box again. */
          readOnly={selectLike && !open}
          value={selectLike && !open ? pickedLabel : q}
          wrapperClassName="w-full"
          inputClassName="pr-9"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { if (!disabled) setOpen(true); }}
          onClick={() => { if (!disabled && !open) setOpen(true); }}
          onKeyDown={onKey}
        />
        {/* The list's own switch. Labelled, but out of the tab order: the
            combobox itself already opens on ArrowDown and closes on Escape,
            and a second stop on every facet would double a twelve-field
            form's tab count. */}
        <span className="absolute right-1 flex items-center">
          <IconButton
            size="xs"
            color="tertiary"
            ico="chev"
            isDisabled={disabled}
            label={open ? "Close the list" : "Open the list"}
            className={cx("transition duration-100", open && "rotate-180")}
            onClick={() => {
              if (open) { setOpen(false); setQ(""); return; }
              setOpen(true);
              if (input.current) input.current.focus();
            }}
          />
        </span>
      </div>

      {open ? (
        <Pop>
          <ul role="listbox" id={listId} aria-label={f.label}
            aria-multiselectable={single ? undefined : true}
            className="flex flex-col">
            {rendered()}
          </ul>
        </Pop>
      ) : null}

      {chipsBelow && !selectLike ? (
        <Chips f={f} values={values} onRemove={remove} disabled={disabled} options={given} below />
      ) : null}

      {/* Only when there is something to say. An empty line under every
          state picker was a margin with nothing in it. */}
      {f.hint || (f.max && !single) ? (
        <p className="mt-1.5 flex min-w-0 items-baseline gap-2 text-xs text-tertiary">
          {f.hint ? <span className="min-w-0 flex-1">{f.hint}</span> : <span className="flex-1" />}
          {f.max && !single ? (
            <b className={cx("shrink-0 font-mono font-medium tnum",
              full ? "text-warning-primary" : "text-quaternary")}>
              {values.length}/{f.max}
            </b>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
