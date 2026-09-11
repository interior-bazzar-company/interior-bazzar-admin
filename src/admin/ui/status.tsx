/* =============================================================================
   ui/status — a state has a shape, a label has another, and there is one
   drawing of each in the whole product.
   -----------------------------------------------------------------------------
   A STATE the system assigned is a ROUNDED badge with a dot — Qualified,
   Overdue, Paid. Closed vocabulary, tone decided by the product.
   A LABEL a person typed is a SQUARE badge — "kitchen", "Premium". Open
   vocabulary, colour picked by whoever made it, meaningless to the system.

   THE TONES, and what each one is allowed to mean:
     ok / success   finished well          → Untitled UI green
     warn / warning needs a human today    → yellow
     bad / error    finished badly, blocked→ red
     info           somebody is on it      → blue
     brand          ours / current         → forest — the ONLY chip that may
                                             wear the brand, and no status
                                             map reaches for it
     neutral        a fact with no judgement
     live           happening right now    → sky
     system / sys   the system did it      → indigo
   The legacy tone names (`ok`, `warn`, `bad`, `mute`, `q`, `s1`…) every view
   already writes resolve through TONE below, so no call site moved.
   ========================================================================== */
import type { ReactNode } from "react";
import { Badge, BadgeWithDot, BadgeWithIcon } from "@/components/base/badges/badges";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { cx } from "@/utils/cx";
import { Icon, iconOf } from "./icon";
import { titleise } from "./helpers";
import { Person } from "./people";

/** legacy tone word → badge colour. Unknown words are neutral, never loud. */
export const TONE: Record<string, BadgeColors> = {
    ok: "success",
    success: "success",
    good: "success",
    warn: "warning",
    warning: "warning",
    bad: "error",
    error: "error",
    danger: "error",
    info: "blue",
    brand: "brand",
    neutral: "gray",
    mute: "gray",
    muted: "gray",
    q: "gray",
    live: "sky",
    accent: "sky",
    system: "indigo",
    sys: "indigo",
    s1: "gray",
    stop: "error",
    dead: "gray",
    line: "gray",
    solid: "gray",
};

/** the eleven tag hues a person can pick → badge colour */
export const TAG_TONE: Record<string, BadgeColors> = {
    slate: "slate",
    red: "error",
    orange: "orange",
    amber: "warning",
    lime: "success",
    green: "success",
    teal: "sky",
    cyan: "sky",
    blue: "blue",
    violet: "purple",
    purple: "purple",
    pink: "pink",
    gray: "gray",
    grey: "gray",
    indigo: "indigo",
};

const toneOf = (t?: string): BadgeColors => (t ? TONE[t] || TAG_TONE[t.replace(/^tag-/, "")] || "gray" : "gray");

/* ONE PILL. A status, a stage, a priority, a tier and a tag are all THIS. */
export function Pill({
    text,
    tone,
    lg,
    xs,
    title,
    dot,
    ico,
    children,
    className,
}: {
    text?: ReactNode;
    tone?: string;
    lg?: boolean;
    xs?: boolean;
    title?: string;
    dot?: boolean;
    ico?: string;
    children?: ReactNode;
    className?: string;
}) {
    const size = lg ? "lg" : xs ? "sm" : "md";
    const isTag = !!tone && (tone === "is-tag" || tone.startsWith("tag-") || TAG_TONE[tone] !== undefined) && TONE[tone] === undefined;
    const color = toneOf(tone);
    const struck = tone === "dead";
    /* the library's Badge is `flex`; inline-flex so a pill sits inside a
       button's label or a table cell's text without taking its own line */
    className = cx("inline-flex align-middle", className);
    const label = (
        <span className={cx("truncate", struck && "line-through opacity-70")} title={title}>
            {text}
            {children}
        </span>
    );
    if (ico) {
        return (
            <BadgeWithIcon type={isTag ? "color" : "pill-color"} size={size} color={color} iconLeading={iconOf(ico)} className={className}>
                {label}
            </BadgeWithIcon>
        );
    }
    if (dot) {
        return (
            <BadgeWithDot type={isTag ? "color" : "pill-color"} size={size} color={color} className={className}>
                {label}
            </BadgeWithDot>
        );
    }
    return (
        <Badge type={isTag ? "color" : "pill-color"} size={size} color={color} className={className}>
            {label}
        </Badge>
    );
}

/* A TAG IS NOT A STATUS: square, and its hue means nothing by contract. `auto`
   marks a tag the system applied rather than a person. */
export function Tag({ label, tone, auto, onRemove, className }: { label: ReactNode; tone?: string; auto?: boolean; onRemove?: () => void; className?: string }) {
    return (
        <span
            className={cx(
                "inline-flex size-max items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                tagClasses(tone),
                className,
            )}
        >
            {auto ? <Icon name="sparkle" size="xs" className="opacity-70" /> : null}
            {label}
            {onRemove ? (
                <button
                    type="button"
                    className="-mr-0.5 flex cursor-pointer items-center justify-center rounded-[3px] p-0.5 opacity-60 outline-focus-ring transition duration-100 hover:opacity-100 focus-visible:outline-2"
                    aria-label="Remove tag"
                    onClick={onRemove}
                >
                    <Icon name="x" size="xs" />
                </button>
            ) : null}
        </span>
    );
}

/** the eleven hues as utility classes — the same family Badge uses, muted */
export function tagClasses(tone?: string): string {
    const c = toneOf(tone);
    const map: Record<BadgeColors, string> = {
        gray: "bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200",
        brand: "bg-utility-brand-50 text-utility-brand-700 ring-utility-brand-200",
        error: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200",
        warning: "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200",
        success: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200",
        slate: "bg-utility-slate-50 text-utility-slate-700 ring-utility-slate-200",
        sky: "bg-utility-sky-50 text-utility-sky-700 ring-utility-sky-200",
        blue: "bg-utility-blue-50 text-utility-blue-700 ring-utility-blue-200",
        indigo: "bg-utility-indigo-50 text-utility-indigo-700 ring-utility-indigo-200",
        purple: "bg-utility-purple-50 text-utility-purple-700 ring-utility-purple-200",
        pink: "bg-utility-pink-50 text-utility-pink-700 ring-utility-pink-200",
        orange: "bg-utility-orange-50 text-utility-orange-700 ring-utility-orange-200",
    };
    return map[c];
}

/* A ROW OF TAGS WITH A CEILING. The count is a real number rather than an
   ellipsis, because "+7" tells somebody whether it is worth opening the record. */
export function Tags({ items, max }: { items: { label: string; tone?: string; auto?: boolean }[]; max?: number }) {
    if (!items.length) return null;
    const shown = max ? items.slice(0, max) : items;
    const rest = items.length - shown.length;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {shown.map((t, i) => (
                <Tag key={i} label={t.label} tone={t.tone} auto={t.auto} />
            ))}
            {rest > 0 ? (
                <span
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset"
                    title={items
                        .slice(shown.length)
                        .map((t) => t.label)
                        .join(", ")}
                >
                    +{rest}
                </span>
            ) : null}
        </span>
    );
}

/* THE STATUS MAPS. One line per state, and the tone is a decision about
   MEANING. No status is ever `brand`. */
const LEAD_TONE: Record<string, string> = {
    new: "warn",
    processing: "info",
    qualified: "ok",
    assigned: "info",
    converted: "ok",
    rejected: "bad",
    "no-match": "warn",
    nomatch: "warn",
    no_match: "warn",
    duplicate: "neutral",
    contacted: "info",
    pending: "warn",
    closed: "neutral",
    invalid: "bad",
};
const DEAL_TONE: Record<string, string> = {
    open: "info",
    won: "ok",
    lost: "bad",
    stalled: "warn",
    negotiation: "info",
    proposal: "info",
    draft: "neutral",
    active: "ok",
    paused: "warn",
    cancelled: "bad",
    expired: "neutral",
    paid: "ok",
    unpaid: "warn",
    overdue: "bad",
    refunded: "neutral",
    approved: "ok",
    declined: "bad",
    "in-review": "info",
    sent: "info",
    completed: "ok",
    "in-progress": "info",
    "not-started": "neutral",
    settled: "ok",
    partial: "warn",
    failed: "bad",
    scheduled: "info",
    deal: "neutral",
    followup: "info",
    "slot-booked": "info",
    slot_booked: "info",
};
const PRIORITY_TONE: Record<string, string> = {
    critical: "bad",
    urgent: "bad",
    high: "warn",
    medium: "info",
    normal: "neutral",
    low: "neutral",
    someday: "neutral",
    p1: "bad",
    p2: "warn",
    p3: "info",
    p4: "neutral",
};

export function LeadStatus({ status, label, lg }: { status: string; label?: ReactNode; lg?: boolean }) {
    const k = String(status || "").toLowerCase();
    return <Pill tone={LEAD_TONE[k] || "neutral"} dot lg={lg} text={label || titleise(k)} />;
}
export function DealStatus({ status, label, lg }: { status: string; label?: ReactNode; lg?: boolean }) {
    const k = String(status || "").toLowerCase();
    return <Pill tone={DEAL_TONE[k] || "neutral"} dot lg={lg} text={label || titleise(k)} />;
}
export function Priority({ level, label }: { level: string; label?: ReactNode }) {
    const k = String(level || "").toLowerCase();
    return <Pill tone={PRIORITY_TONE[k] || "neutral"} dot text={label || titleise(k)} />;
}

/* ASSIGNMENT — who owns this, or the fact that nobody does. UNASSIGNED IS A
   STATE, NOT A BLANK. */
export function Assignee({ name, role, to }: { name?: string | null; role?: ReactNode; to?: string }) {
    if (!name)
        return (
            <span className="inline-flex items-center gap-1.5 text-sm text-quaternary">
                <Icon name="user" size="xs" />
                Unassigned
            </span>
        );
    return <Person name={name} sub={role} sm to={to} />;
}

/* PIPELINE — every stage on screen, including the ones passed and the ones
   ahead. The current stage wears the brand: it is the one place "where you
   are" is the message. */
export function Pipeline({ stages, current, compact }: { stages: { k: string; label: string }[]; current: string; compact?: boolean }) {
    const at = Math.max(
        0,
        stages.findIndex((s) => s.k === current),
    );
    return (
        <ol className={cx("flex w-full items-center", compact ? "gap-1" : "gap-2")} aria-label={"Stage " + (at + 1) + " of " + stages.length}>
            {stages.map((s, i) => {
                const done = i < at;
                const now = i === at;
                return (
                    <li key={s.k} className={cx("flex min-w-0 flex-1 items-center gap-2", compact && "gap-1.5")} aria-current={now ? "step" : undefined}>
                        <span
                            className={cx(
                                "flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ring-1 ring-inset",
                                done && "bg-brand-solid text-white ring-brand-solid",
                                now && "bg-brand-primary text-brand-secondary ring-brand",
                                !done && !now && "bg-primary text-quaternary ring-primary",
                            )}
                        >
                            {done ? <Icon name="check" size="xs" /> : i + 1}
                        </span>
                        {!compact && (
                            <span className={cx("truncate text-xs font-medium", now ? "text-brand-secondary" : done ? "text-secondary" : "text-quaternary")}>{s.label}</span>
                        )}
                        {i < stages.length - 1 && <span className={cx("h-px min-w-2 flex-1", done ? "bg-brand-solid" : "bg-border-secondary")} />}
                    </li>
                );
            })}
        </ol>
    );
}

/* THE PROGRESS BAR — brand by default (progress toward a target is what the
   brand is for) and a status tone only when the bar ITSELF is the judgement. */
export function Meter({ value, max, tone, label, className }: { value: number; max?: number; tone?: "ok" | "warn" | "bad"; label?: string; className?: string }) {
    const pct = Math.max(0, Math.min(100, ((value || 0) / (max || 100)) * 100));
    const fill = tone === "bad" ? "bg-fg-error-primary" : tone === "warn" ? "bg-fg-warning-primary" : tone === "ok" ? "bg-fg-success-primary" : "bg-fg-brand-primary";
    return <ProgressBarBase value={pct} className={cx("h-1.5", className)} progressClassName={fill} aria-label={label} />;
}

/* THE DELTA IS COLOURED, THE VALUE IS NOT. Up is not always good, so the
   judgement is made per metric by the caller and spent on the small number. */
export function Delta({ value, suffix, dir, of, good }: { value: ReactNode; suffix?: string; dir: "up" | "down" | "flat"; of?: ReactNode; good?: boolean }) {
    const tone = dir === "flat" ? "text-quaternary" : (good ?? dir === "up") ? "text-success-primary" : "text-error-primary";
    return (
        <span className="inline-flex items-baseline gap-1 text-xs">
            <span className={cx("inline-flex items-center gap-0.5 font-medium tnum", tone)}>
                {dir === "up" ? <Icon name="up" size="xs" /> : dir === "down" ? <Icon name="down" size="xs" /> : <Icon name="minus" size="xs" />}
                {value}
                {suffix}
            </span>
            {of ? <span className="text-quaternary">{of}</span> : null}
        </span>
    );
}
