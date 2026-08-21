/* =============================================================================
   THE FILTER SELECT
   -----------------------------------------------------------------------------
   A native <select> cannot be styled where it matters. The closed control takes
   CSS happily; the OPEN list is drawn by the operating system, which is why the
   filter row ended in a rectangle of system blue that belonged to no design
   system at all. There is no CSS fix for that — the only way to make the open
   list look like the panel is to stop using a native one.

   So this is a listbox: a button and a panel of options, both ours. What it buys
   beyond the paint is the thing a native control could never do — an option can
   carry a MARK, and the mark can be the same one the rows carry:

     Status   an identity dot, one per state (see `.be-dot` in enquiries.css)
     Urgency  a heat ramp, soonest to latest
     Tier     its letter, in the square the rows use
     Tag      the tag chip itself, tone and all — a tag is a chip everywhere
              else in the module, and a list of plain words would have been the
              one place it is not

   Everything else stays plain: a city has no tone, and inventing one is noise.

   What is deliberately NOT here: search-inside-the-list and multi-select. Ten
   filters over a queue this size do not need either, and each is another thing
   to learn. The brief was "relevant and simple".

   KEYBOARD, because replacing a native control means replacing what it did:
   Enter / Space / ArrowDown open; arrows and Home/End move; Enter picks; Escape
   closes and returns focus to the button; Tab closes and moves on. Focus opens
   on the CURRENT value rather than the top, which is what a native select does
   and what makes "change it by one" a single keypress.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../ui";

export type FilterOption = {
  v: string;
  l: string;
  /** A dot CLASS, not a tone: `s-qualified`, `u-browsing`. Statuses and urgency
   *  bands each get their own identity colour rather than sharing four semantic
   *  tones between them — three amber dots and two grey ones is not a legend
   *  anybody can read. The same class paints the dot on the row's status pill,
   *  so the filter and the thing it produces carry the same mark. */
  dot?: string;
  /** One or two characters in a small square. Tiers use it. */
  badge?: string;
  /** Render the label as the tag chip the ROWS use, tone and all. A tag is a
   *  chip everywhere else in the module; a list of plain words would have been
   *  the one place it is not. */
  chip?: { tone?: string; auto?: boolean };
};

export function FilterSelect({ name, label, value, options, onFilter }: {
  name: string;
  label: string;
  value?: string;
  options: FilterOption[];
  onFilter: (name: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const chosen = options.filter((o) => o.v === value)[0] || null;
  /* Index 0 is the "any" row, so a real option sits at its own index + 1. */
  const chosenIndex = chosen ? options.indexOf(chosen) + 1 : 0;

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
       own click would be lost to a re-render. */
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
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
    onFilter(name, v);
    setOpen(false);
    btn.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key === "ArrowDown") { e.preventDefault(); move(t, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(t, -1); }
    else if (e.key === "Home") { e.preventDefault(); move(t, "first"); }
    else if (e.key === "End") { e.preventDefault(); move(t, "last"); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  const mark = (o: FilterOption) =>
    o.badge ? <span className="be-fsel-badge">{o.badge}</span>
      : o.dot ? <span className={"be-dot " + o.dot} />
        : null;

  /* A chip option IS its own label, so it replaces the text rather than sitting
     beside it — otherwise the row reads the tag twice. */
  const text = (o: FilterOption) =>
    o.chip
      ? <span className={"be-tag" + (o.chip.tone ? " " + o.chip.tone : "")}>
          {o.chip.auto ? <i className="auto" /> : null}{o.l}
        </span>
      : <span className="l">{o.l}</span>;

  return (
    <div className={"be-fsel" + (chosen ? " on" : "") + (open ? " open" : "")} ref={wrap}>
      <button type="button" ref={btn} className="be-fsel-t" data-filter={name}
        aria-haspopup="listbox" aria-expanded={open}
        /* The label is the field; the value is what a screen reader should hear
           as the current setting, so it is the accessible VALUE not the name. */
        aria-label={label + (chosen ? ": " + chosen.l : ": any")}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}>
        {chosen ? mark(chosen) : null}
        {chosen ? text(chosen) : <span className="l">{label}</span>}
        <Icon name="chev" size="sm" className="be-fsel-caret" />
      </button>

      {open ? (
        <div className="be-fsel-list" role="listbox" aria-label={label}
          ref={list} onKeyDown={onListKey}>
          {/* Clearing is the first row rather than a separate control: it is the
              option you want when the filter is wrong, and it should be where
              the eye already is. */}
          <button type="button" role="option" aria-selected={!chosen}
            className={"be-fsel-o any" + (!chosen ? " sel" : "")}
            onClick={() => pick("")}>
            <span className="l">{label} — any</span>
            {!chosen ? <Icon name="check" size="sm" /> : null}
          </button>
          {options.map((o) => (
            <button type="button" key={o.v} role="option" aria-selected={o.v === value}
              className={"be-fsel-o" + (o.v === value ? " sel" : "")}
              onClick={() => pick(o.v)}>
              {mark(o)}
              {text(o)}
              {o.v === value ? <Icon name="check" size="sm" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
