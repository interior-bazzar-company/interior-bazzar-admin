/* =============================================================================
   ui/select — THE panel's dropdown
   -----------------------------------------------------------------------------
   A native <select> cannot be styled where it matters. The closed control takes
   CSS happily; the OPEN list is drawn by the operating system, which is why
   sixteen filter rows in this panel ended in a rectangle of system blue that
   belonged to no design system at all — while the seventeenth, Business
   Enquiries, drew its own list and looked like the product. That was the
   inconsistency: one screen's dropdown was ours and the rest were the OS's.

   So this is a listbox — a button and a panel of options, both ours — promoted
   whole from Business Enquiries' `FilterSelect` into the shared layer, with one
   change: it POSITIONS ITSELF FIXED through `useMenuPlacement`, the same way
   the More menu does. An absolutely positioned list is clipped by any ancestor
   with `overflow` set, and a filter row sits above a scrolling table body; a
   list that opens inside `.dls-body` and is cut off at its third row is not a
   dropdown.

   WHAT IT BUYS BEYOND THE PAINT is the thing a native control never could: an
   option can carry a MARK, and the mark can be the same one the rows carry.

     dot     an identity dot class — `s-qualified`, `u-browsing` — painted by
             the module's own ramp, so the filter and the row it produces carry
             the same mark
     badge   one or two characters in a small square. Tiers use it.
     chip    render the label as the tag chip the rows use, tone and all — a
             tag is a chip everywhere else, and a list of plain words would be
             the one place it is not

   Everything else stays plain: a city has no tone, and inventing one is noise.

   IT IS THE FILTER SELECT, NOT THE FORM SELECT. A filter narrows a list and
   must look ACTIVE when it is narrowing anything — a filter you cannot see is
   a filter you cannot clear. A form select is an answer to a question and is
   correctly native (`SelectInput` in ./index): the platform's own list is
   right on a phone and with a screen reader, and a form does not need marks.

   KEYBOARD, because replacing a native control means replacing what it did:
   Enter / Space / ArrowDown open; arrows and Home / End move; Enter picks;
   Escape closes and returns focus to the button; Tab closes and moves on.
   Focus opens on the CURRENT value rather than the top, which is what a native
   select does and what makes "change it by one" a single keypress.

   What is deliberately NOT here: search-inside-the-list and multi-select. For
   several values from a known list there is `MultiSelect`; for free text there
   is `ChipInput`. Each is another thing to learn, and a filter row is not the
   place to learn it.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Icon } from "./index";
import { useMenuPlacement } from "./menu";

export type SelectOption = {
  v: string;
  l: string;
  /** A dot CLASS, not a tone — see the header. */
  dot?: string;
  /** One or two characters in a small square. */
  badge?: string;
  /** Render the label as the row's own tag chip. */
  chip?: { tone?: string; auto?: boolean };
};

/** A string is its own value and label — the shape the sixteen existing
 *  callers already hand in — so nothing had to change at a call site to get
 *  the new drawing. */
export type SelectOptionLike = string | SelectOption;

const norm = (o: SelectOptionLike): SelectOption =>
  typeof o === "string" ? { v: o, l: o } : o;

export function Select({ name, label, value, options, onFilter, sm, allLabel }: {
  name: string;
  label?: string;
  value?: string | number;
  options: SelectOptionLike[];
  onFilter?: (name: string, value: string) => void;
  /** the toolbar height rather than the control height */
  sm?: boolean;
  /** what the clearing row says. "Any" reads right for a filter; a sort
   *  control wants its default order named instead. */
  allLabel?: string;
}) {
  const opts = options.map(norm);
  const cur = value === undefined || value === null ? "" : String(value);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { style: popStyle, width } = useMenuPlacement(open, btn, list, "left");

  const chosen = opts.find((o) => o.v === cur) || null;
  /* Index 0 is the "any" row, so a real option sits at its own index + 1. */
  const chosenIndex = chosen ? opts.indexOf(chosen) + 1 : 0;
  const title = label || name;

  useEffect(() => {
    if (!open) return;
    const el = list.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLButtonElement>("[role=option]");
    (items[chosenIndex] || items[0])?.focus();
  }, [open, chosenIndex]);

  useEffect(() => {
    if (!open) return;
    /* mousedown, not click: a click that starts inside and ends outside should
       not count as an outside press, and mousedown fires before the option's
       own click would be lost to a re-render. The list is position:fixed and
       portalled nowhere — it is still a DOM child of `wrap` — so containment
       is a plain `contains`. */
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    /* Fixed coordinates cannot follow the button, so anything that moves it
       closes the list rather than leaving it stranded beside nothing. `true`
       catches scrolls on inner containers, which is where this happens. */
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  const move = (from: HTMLElement, by: number | "first" | "last") => {
    const el = list.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLButtonElement>("[role=option]"));
    const i = items.indexOf(from as HTMLButtonElement);
    const next = by === "first" ? 0
      : by === "last" ? items.length - 1
        : Math.max(0, Math.min(items.length - 1, i + by));
    items[next]?.focus();
  };

  const pick = (v: string) => {
    if (onFilter) onFilter(name, v);
    setOpen(false);
    btn.current?.focus();
  };

  const onListKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key === "ArrowDown") { e.preventDefault(); move(t, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(t, -1); }
    else if (e.key === "Home") { e.preventDefault(); move(t, "first"); }
    else if (e.key === "End") { e.preventDefault(); move(t, "last"); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  const mark = (o: SelectOption): ReactNode =>
    o.badge ? <span className="sel-badge">{o.badge}</span>
      : o.dot ? <span className={"id-dot " + o.dot} />
        : null;

  /* A chip option IS its own label, so it replaces the text rather than sitting
     beside it — otherwise the row reads the tag twice. The chip is the panel's
     one `.pill`, not a second drawing. */
  const text = (o: SelectOption): ReactNode =>
    o.chip
      ? <span className={"pill xs" + (o.chip.tone ? " " + o.chip.tone : "") + (o.chip.auto ? " is-auto" : "")}>
          {o.chip.auto ? <Icon name="sparkle" size="xs" /> : null}{o.l}
        </span>
      : <span className="l">{o.l}</span>;

  return (
    <div className={"sel" + (chosen ? " on" : "") + (open ? " open" : "") + (sm ? " sm" : "")} ref={wrap}>
      {/* `data-options` is the option set, in order, on the CLOSED control. The
          list itself exists only while open, so a render-to-string check or an
          automation hook would otherwise have nothing to read; the render
          checks assert "offers exactly these, in this order" against it. */}
      <button type="button" ref={btn} className="sel-t" data-filter={name}
        data-options={opts.map((o) => o.l).join("|")}
        aria-haspopup="listbox" aria-expanded={open}
        /* The label is the field; the value is what a screen reader should hear
           as the current setting, so it is the accessible VALUE not the name. */
        aria-label={title + (chosen ? ": " + chosen.l : ": " + (allLabel || "any"))}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}>
        {chosen ? mark(chosen) : null}
        {chosen ? text(chosen) : <span className="l">{title}</span>}
        <Icon name="chev" size="sm" className="sel-caret" />
      </button>

      {open ? (
        <div className="sel-list" role="listbox" aria-label={title}
          ref={list} onKeyDown={onListKey}
          style={{ ...popStyle, minWidth: width || undefined }}>
          {/* Clearing is the first row rather than a separate control: it is the
              option you want when the filter is wrong, and it should be where
              the eye already is. */}
          <button type="button" role="option" aria-selected={!chosen}
            className={"sel-o any" + (!chosen ? " sel" : "")}
            onClick={() => pick("")}>
            <span className="l">{allLabel || title + " — any"}</span>
            {!chosen ? <Icon name="check" size="sm" /> : null}
          </button>
          {opts.map((o) => (
            <button type="button" key={o.v} role="option" aria-selected={o.v === cur}
              className={"sel-o" + (o.v === cur ? " sel" : "")}
              onClick={() => pick(o.v)}>
              {mark(o)}
              {text(o)}
              {o.v === cur ? <Icon name="check" size="sm" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
