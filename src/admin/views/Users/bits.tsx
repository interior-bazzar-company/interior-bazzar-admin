/* =============================================================================
   Users Management — the module's own drawings.
   -----------------------------------------------------------------------------
   Everything the panel already draws — pills, tags, tiles, cards, tables, the
   stat strip, the empty state — comes from `ui/`. What is left in this file is
   the vocabulary only this module has: an account classification, a
   completeness read-out, the identity cell a directory row leads with, the
   choice chip three of its dialogs share, the month grid the range picker is
   made of, and the popup surface the facet combobox opens.

   Every one of them is a component on the semantic tokens. There is no
   stylesheet in this module and no colour, size or radius literal in this file.
   ============================================================================= */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Alert, Button, Icon, Meter, Person, Pill, Tags } from "../../ui";
import { classificationMeta, decision, primaryCityOf, tagMeta } from "./store";
import type { Classification, MonthRow, UserRow } from "./store";

/* ------------------------------------------------------------- banner --- */

/** Deliberately loud, and never dismissible. A demo that reads as live is
 *  worse than no demo. */
export function ProtoBar({ onReset }: { onReset?: () => void }) {
  return (
    <Alert
      tone="warn"
      title="Nothing here is live."
      action={onReset && import.meta.env.DEV
        ? <Button size="xs" color="secondary" ico="refresh" onClick={onReset}>Reset</Button>
        : undefined}
    >
      Records come from <span className="font-mono">src/content/users/</span> and every action
      writes to this tab only.
    </Alert>
  );
}

/* -------------------------------------------------------------- state --- */

/** The account classification — a STATE the system derived, so a rounded pill
 *  with a dot, never a tag. Deactivated is a fact with no judgement in it: the
 *  record is whole, the account is off. */
export function ClassPill({ k, lg }: { k: Classification; lg?: boolean }) {
  const m = classificationMeta(k);
  return <Pill tone={k === "deactivated" ? "dead" : "ok"} dot lg={lg} text={m.label} title={m.meaning} />;
}

/** Operational tags — square, because a person put them there and the hue
 *  means nothing by contract. */
export function TagChips({ slugs, max }: { slugs: string[]; max?: number }) {
  if (!slugs.length) return null;
  return (
    <Tags
      max={max}
      items={slugs.map((s) => {
        const t = tagMeta(s);
        return { label: t ? t.label : s, tone: t ? t.tone : undefined };
      })}
    />
  );
}

/* ------------------------------------------------------------- notices --- */

/** A decision nobody has taken, named where it bites. One line by default —
 *  the register in vocabularies.json carries the rest, and the id is what ties
 *  the code and the spec together. */
export function Assumed({ id, children }: { id: string; children?: ReactNode }) {
  const d = decision(id);
  return (
    <p className="flex items-start gap-2 text-xs text-tertiary">
      <Icon name="alert" size="sm" className="mt-px shrink-0 text-fg-warning-primary" />
      <span>
        <b className="font-mono font-medium text-secondary">{id}</b>{" "}
        {children || (d ? d.position : null)}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------- figures --- */

const COMP_BAR = { ok: undefined, warn: "warn", bad: "bad" } as const;
const COMP_TEXT: Record<string, string> = {
  ok: "text-success-primary",
  warn: "text-warning-primary",
  bad: "text-error-primary",
};

/** Completeness, with what is missing rather than only the percentage — 60%
 *  tells nobody what to ask the customer for. */
export function Completeness({ pct, missing, bare }: { pct: number; missing: string[]; bare?: boolean }) {
  const tone: "ok" | "warn" | "bad" = pct >= 100 ? "ok" : pct >= 60 ? "warn" : "bad";
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="w-14 shrink-0">
        <Meter value={pct} tone={COMP_BAR[tone]} label="Profile completeness" />
      </span>
      <span className={cx("shrink-0 text-xs font-medium tnum", COMP_TEXT[tone])}>{pct}%</span>
      {bare || !missing.length ? null : (
        <span className="truncate text-xs text-tertiary">no {missing.join(", ").toLowerCase()}</span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------- cells --- */

/** The identity a directory row leads with: the face, the name, the address
 *  they were registered under, and whatever we have tagged them with. */
export function WhoCell({ r, to }: { r: UserRow; to?: string }) {
  const u = r.user;
  const city = primaryCityOf(u.profile);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Person name={u.identity.name} sub={u.identity.email || u.identity.phone || city || undefined} to={to} />
      <TagChips slugs={u.tags.map((t) => t.slug)} max={3} />
    </div>
  );
}

/* -------------------------------------------------------------- chips --- */

/** A choice the operator makes by pressing it: a range preset, a deactivation
 *  reason, an operational tag. Selected wears the brand on its edge — the same
 *  language `FilterChips` uses, because it is the same idea. */
export function ChoiceChip({
  label,
  desc,
  on,
  disabled,
  onPick,
}: {
  label: ReactNode;
  desc?: ReactNode;
  on?: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      onClick={onPick}
      className={cx(
        "group inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-left text-xs font-medium outline-focus-ring transition duration-100 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        on
          ? "bg-brand-primary text-brand-secondary ring-1 ring-brand"
          : "bg-primary text-secondary ring-1 ring-primary hover:bg-primary_hover",
      )}
    >
      {on ? <Icon name="check" size="xs" className="shrink-0" /> : null}
      <span className="truncate">{label}</span>
      {desc ? <span className="truncate font-normal text-quaternary">{desc}</span> : null}
    </button>
  );
}

/* ------------------------------------------------------------- popups --- */

/** The surface a module-local popup opens on: the same plane, hairline and
 *  shadow the shared popovers use, positioned against the control above it. */
export function Pop({ children, className, ...rest }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <div
      {...rest}
      className={cx(
        "absolute top-full left-0 z-30 mt-1 flex max-h-64 min-w-full flex-col overflow-y-auto rounded-lg bg-primary py-1 shadow-lg ring-1 ring-secondary_alt",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One row of a facet list — the MultiSelect row, drawn for a listbox this
 *  module owns because the library's cannot offer a value somebody just typed. */
export function OptionRow({
  id,
  active,
  picked,
  box,
  label,
  hint,
  onHover,
  onPick,
}: {
  id?: string;
  active?: boolean;
  picked?: boolean;
  /** show the checkbox indicator — a multi-value facet */
  box?: boolean;
  label: ReactNode;
  hint?: ReactNode;
  onHover?: () => void;
  onPick: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={!!active}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={cx(
        "mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition duration-100",
        active ? "bg-primary_hover" : "",
      )}
    >
      {box ? (
        <span
          aria-hidden="true"
          className={cx(
            "flex size-4 shrink-0 items-center justify-center rounded ring-1 ring-inset",
            picked ? "bg-brand-solid text-white ring-brand-solid" : "bg-primary ring-primary",
          )}
        >
          {picked ? <Icon name="check" size="xs" /> : null}
        </span>
      ) : null}
      <span className={cx("min-w-0 flex-1 truncate", picked ? "font-medium text-primary" : "text-secondary")}>{label}</span>
      {hint ? <span className="shrink-0 truncate text-xs text-quaternary">{hint}</span> : null}
      {picked && !box ? <Icon name="check" size="sm" className="shrink-0 text-fg-brand-primary" /> : null}
    </li>
  );
}

/** The listbox's own empty line — the one row that is not an option. */
export function OptionNote({ children }: { children: ReactNode }) {
  return <li className="px-3 py-2 text-sm text-quaternary" role="presentation">{children}</li>;
}

/** A heading inside the listbox. Categories mixes a delivery model with a
 *  sector — two questions — and flattening them makes somebody choose as
 *  though they were one. */
export function OptionGroup({ label, note }: { label: ReactNode; note?: ReactNode }) {
  return (
    <li className="label-mono mt-1 flex items-baseline gap-2 px-3 pt-2 pb-1 first:mt-0 first:pt-1" role="presentation">
      <span>{label}</span>
      {note ? <span className="truncate font-normal text-quaternary normal-case">{note}</span> : null}
    </li>
  );
}

/* ------------------------------------------------------------ calendar --- */

/** The month grid the analytics range is picked off. A MONTH grid rather than
 *  a day calendar: the series is monthly, so a day-precision control would
 *  promise a resolution the data does not have. */
export function MonthGrid({
  years,
  span,
  onHover,
  onPick,
}: {
  years: { year: string; months: MonthRow[] }[];
  /** the committed span, or the one the cursor is drawing */
  span: string[];
  onHover: (m: string) => void;
  onPick: (m: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {years.map((y) => (
        <div key={y.year} className="flex flex-col gap-1.5">
          <div className="label-mono">{y.year}</div>
          <div className="grid grid-cols-6 gap-1">
            {y.months.map((m) => {
              const inSpan = m.month >= span[0] && m.month <= span[1];
              const edge = m.month === span[0] || m.month === span[1];
              return (
                <button
                  key={m.month}
                  type="button"
                  aria-pressed={edge}
                  aria-label={m.label}
                  onMouseEnter={() => onHover(m.month)}
                  onFocus={() => onHover(m.month)}
                  onClick={() => onPick(m.month)}
                  className={cx(
                    "cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium outline-focus-ring transition duration-100 tnum focus-visible:outline-2 focus-visible:outline-offset-2",
                    edge
                      ? "bg-brand-solid text-white"
                      : inSpan
                        ? "bg-brand-primary text-brand-secondary"
                        : "text-secondary hover:bg-primary_hover",
                  )}
                >
                  {m.short}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
