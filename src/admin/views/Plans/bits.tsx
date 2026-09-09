/* =====================================================================
   PLANS — the module's own drawings.
   ---------------------------------------------------------------------
   Four things the catalogue needs that the shared layer does not ship,
   built from the shared parts and the semantic utilities: the plan's own
   state pill (three states, one of which is an absence), the row of
   durations it is sold on, a PRICE RANGE rather than a price, and the
   feature bullets the public card prints.

   They live here rather than inside a screen because the list, the drawer
   and the form all show the same plan and must not disagree about what
   "on sale" looks like.
   ===================================================================== */
import { Icon, Pill } from "../../ui";
import type { Cycle, Feature, Plan } from "./api";
import { money, monthsLabel, statusOf } from "./helpers";

/* THREE STATES, AND ARCHIVED IS NOT A COLOUR. On sale is the only one the
   product judges — a plan that is off sale is a decision, not a warning —
   so archived is told apart by its glyph rather than by another hue. */
export function PlanStatus({ plan, lg }: { plan: Plan; lg?: boolean }) {
    const s = statusOf(plan);
    if (s === "archived") return <Pill lg={lg} tone="neutral" ico="archive" text="Archived" title="Out of the catalogue — still readable, and restorable" />;
    return (
        <Pill
            lg={lg}
            dot
            tone={s === "active" ? "ok" : "neutral"}
            text={s === "active" ? "On sale" : "Off sale"}
            title={s === "active" ? "Live on the public plans page" : "Hidden from buyers — existing subscribers unaffected"}
        />
    );
}

/* EVERY DURATION THIS PLAN CAN BE SOLD ON. A switched-off cycle is struck
   through rather than hidden: "we used to sell 6 months and stopped" is a
   fact worth seeing from the list. */
export function DurationChips({ cycles }: { cycles: Cycle[] }) {
    if (!cycles.length) return <span className="text-sm text-quaternary">not priced</span>;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {cycles.map((c) => (
                <Pill key={c.id} xs tone={c.active ? "neutral" : "dead"} text={c.months + "m"} title={monthsLabel(c.months) + " · " + money(c.price) + (c.active ? "" : " · not on sale")} />
            ))}
        </span>
    );
}

/* A RANGE, NOT A PRICE. A plan with three durations does not have "a price",
   and printing only one of them is how a list page starts misleading the
   person reading it. */
export function PriceRange({ range }: { range: { lo: number; hi: number } | null }) {
    if (!range) return <span className="text-quaternary">—</span>;
    if (range.lo === range.hi) return <>{money(range.lo)}</>;
    return (
        <>
            {money(range.lo)}
            <div className="cell-2">to {money(range.hi)}</div>
        </>
    );
}

/* THE BULLET LIST the public plan card prints, with the smaller detail line
   under a bullet that has one. An empty detail renders nothing, not a gap. */
export function FeatureList({ features }: { features: Feature[] }) {
    return (
        <ul className="flex flex-col gap-2">
            {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5">
                    <Icon name="check" size="sm" className="mt-0.5 text-fg-success-primary" />
                    <span className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-primary">{f.text}</span>
                        {f.detail ? <span className="mt-0.5 flex text-xs text-tertiary">{f.detail}</span> : null}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** `urgency()`'s legacy class word → the row rail's tone. The one failure a
 *  catalogue can have (on sale, unbuyable) is red; never priced is yellow. */
export function railTone(u: { cls: string } | null): string | undefined {
    if (!u) return undefined;
    return u.cls === "u-bad" ? "bad" : "warn";
}
