/* =============================================================================
   The range picker.
   -----------------------------------------------------------------------------
   A MONTH GRID, not a day calendar, and that is a decision rather than a
   shortcut. The analytics series is monthly, so a day-precision picker would
   promise a resolution the data does not have: the figure would not move when
   you dragged the end a week and would jump when you moved it a day. Picking
   "Mar 2026 to Aug 2026" off a grid of months is the calendar for this data.

   Two clicks. The first sets the start and arms the second; the second sets the
   end. Clicking a month before the armed start reverses the pair rather than
   refusing, because that is what somebody who clicked in the wrong order meant.
   Hovering previews the span so the selection is visible before it is
   committed.

   The presets are not a separate mode. They set the same two months the grid
   does, and which preset is lit is DERIVED from the range — so a span picked by
   hand that happens to equal six months lights the six-month chip, and there is
   never a preset highlighted that disagrees with the dates beside it.
   ============================================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../ui";
import { MONTHS, RANGE_PRESETS, presetOf, presetRange } from "./store";

export default function DateRange({ from, to, onPick }: {
  from: string;
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  /* Close on outside click and on Escape. A popover that only closes by
     re-pressing its own trigger is one people leave open by accident. */
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setAnchor(null); }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setAnchor(null); }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  /* Grouped by year so the grid reads like a calendar rather than a list of
     twelve buttons. */
  const years = useMemo(() => {
    const out: { year: string; months: typeof MONTHS }[] = [];
    MONTHS.forEach((m) => {
      const y = m.month.slice(0, 4);
      const row = out.filter((r) => r.year === y)[0];
      if (row) row.months.push(m); else out.push({ year: y, months: [m] });
    });
    return out;
  }, []);

  const preset = presetOf(from, to);
  const label = useMemo(() => {
    const a = MONTHS.filter((m) => m.month === from)[0];
    const b = MONTHS.filter((m) => m.month === to)[0];
    if (!a || !b) return "Pick a range";
    return a.month === b.month ? a.label : a.label + " – " + b.label;
  }, [from, to]);

  /* The span being previewed: the committed one, or the one the cursor is
     drawing while a start is armed. */
  const span = anchor && hover
    ? [anchor, hover].sort()
    : anchor ? [anchor, anchor] : [from, to];

  const pick = (month: string) => {
    if (!anchor) { setAnchor(month); setHover(month); return; }
    const [a, b] = [anchor, month].sort();
    setAnchor(null); setHover(null); setOpen(false);
    onPick(a, b);
  };

  return (
    <div className="um-daterange" ref={box}>
      <button className={"btn" + (open ? " on" : "")} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { setOpen((v) => !v); setAnchor(null); }}>
        <Icon name="clock" size="sm" />
        <span>{label}</span>
        <Icon name="chev" size="sm" />
      </button>

      {open ? (
        <div className="um-cal" role="dialog" aria-label="Choose a month range">
          <div className="um-cal-h">
            <b>{anchor ? "Now pick the end month" : "Pick the start month"}</b>
            <span>the series is monthly, so ranges are whole months</span>
          </div>

          {years.map((y) => (
            <div className="um-cal-year" key={y.year}>
              <span className="um-cal-yl">{y.year}</span>
              <div className="um-cal-grid">
                {y.months.map((m) => {
                  const inSpan = m.month >= span[0] && m.month <= span[1];
                  const isEdge = m.month === span[0] || m.month === span[1];
                  return (
                    <button key={m.month}
                      className={"um-cal-m" + (inSpan ? " in" : "") + (isEdge ? " edge" : "")}
                      aria-pressed={isEdge}
                      onMouseEnter={() => anchor && setHover(m.month)}
                      onFocus={() => anchor && setHover(m.month)}
                      onClick={() => pick(m.month)}>
                      {m.short}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="um-cal-f">
            {RANGE_PRESETS.map((p) => (
              <button key={p.key} className={"chip" + (preset === p.key ? " on" : "")}
                onClick={() => {
                  const r = presetRange(p.months);
                  setAnchor(null); setOpen(false);
                  onPick(r.from, r.to);
                }}>
                Last {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
