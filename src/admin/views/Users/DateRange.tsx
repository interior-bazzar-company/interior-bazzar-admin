/* =============================================================================
   The range picker.
   -----------------------------------------------------------------------------
   A MONTH GRID, not a day calendar, and that is a decision rather than a
   shortcut. The analytics series is monthly, so a day-precision picker would
   promise a resolution the data does not have: the figure would not move when
   you dragged the end a week and would jump when you moved it a day. Picking
   "Mar 2026 to Aug 2026" off a grid of months is the calendar for this data.
   It is also why this is not the shared `DateRange` — that control is two ISO
   dates, and two dates is exactly the precision this series cannot honour.

   Two clicks. The first sets the start and arms the second; the second sets the
   end. Clicking a month before the armed start reverses the pair rather than
   refusing, because that is what somebody who clicked in the wrong order meant.
   Hovering previews the span so the selection is visible before it is
   committed.

   The presets are not a separate mode. They set the same two months the grid
   does, and which preset is lit is DERIVED from the range — so a span picked by
   hand that happens to equal six months lights the six-month chip, and there is
   never a preset highlighted that disagrees with the dates beside it.

   THE POPOVER IS THE SHARED ONE. Outside press, Escape, focus containment and
   the anchoring were four hand-rolled listeners here; React Aria owns all four
   through `Popover`, and this file is left with the two things only it knows —
   which months exist, and what the second click means.
   ============================================================================= */
import { useMemo, useState } from "react";
import { Button, Icon, Popover } from "../../ui";
import { ChoiceChip, MonthGrid } from "./bits";
import { MONTHS, RANGE_PRESETS, presetOf, presetRange } from "./store";
import type { MonthRow } from "./store";

export default function DateRange({ from, to, onPick }: {
  from: string;
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  /* Grouped by year so the grid reads like a calendar rather than a list of
     twelve buttons. */
  const years = useMemo(() => {
    const out: { year: string; months: MonthRow[] }[] = [];
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

  const disarm = () => { setAnchor(null); setHover(null); };

  return (
    <Popover
      title="Choose a month range"
      w="md"
      placement="bottom start"
      /* Leaving the popover half-armed would mean the NEXT press committed a
         range whose start was chosen minutes ago on a different question. */
      onOpenChange={(v) => { if (!v) disarm(); }}
      trigger={
        <Button color="secondary" ico="calendar" aria-haspopup="dialog">
          <span className="inline-flex items-center gap-1.5">
            <span className="tnum">{label}</span>
            <Icon name="chev" size="sm" className="text-fg-quaternary" />
          </span>
        </Button>
      }
    >
      {(close) => (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-0.5">
            <b className="text-sm font-semibold text-primary">
              {anchor ? "Now pick the end month" : "Pick the start month"}
            </b>
            <span className="text-xs text-tertiary">
              The series is monthly, so ranges are whole months.
            </span>
          </div>

          <MonthGrid
            years={years}
            span={span}
            onHover={(m) => { if (anchor) setHover(m); }}
            onPick={(m) => {
              if (!anchor) { setAnchor(m); setHover(m); return; }
              const [a, b] = [anchor, m].sort();
              disarm();
              onPick(a, b);
              close();
            }}
          />

          <div className="flex flex-wrap items-center gap-1.5 border-t border-secondary pt-3">
            {RANGE_PRESETS.map((p) => (
              <ChoiceChip key={p.key} label={"Last " + p.label} on={preset === p.key}
                onPick={() => {
                  const r = presetRange(p.months);
                  disarm();
                  onPick(r.from, r.to);
                  close();
                }} />
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
