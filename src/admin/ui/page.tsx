/* =============================================================================
   ui/page — the page furniture: header, section head, card, eyebrow, tiles,
   breadcrumbs, the topbar title. One drawing of each.
   ========================================================================== */
import { Fragment, type ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Button } from "./buttons";
import { Icon } from "./icon";
import { MoreMenu, type MenuItem } from "./menu";
import { go } from "./nav";

/* THE PAGE HEADER — title · context · one primary action. Page actions live
   here, never in the topbar. `meta` is the line under the title: a count, a
   clock stamp, a status. `tabs` hangs a tab row off the header's bottom edge. */
export function PageHeader({
    title,
    meta,
    actions,
    tabs,
    eyebrow,
    back,
    fold,
    className,
}: {
    title: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    tabs?: ReactNode;
    eyebrow?: ReactNode;
    back?: { label: ReactNode; to: string };
    /* THE SAME ACTIONS, AS A LIST. A header with four controls is a header
       with four controls at 1440 and a wrapped stack of them at 390. Give the
       secondary actions here as well and the narrow screen gets one menu
       instead: `actions` shows from `lg`, this below it. The PRIMARY action
       stays in `actions` and is never folded away — it is the one thing the
       page is for. */
    fold?: MenuItem[];
    className?: string;
}) {
    return (
        <header className={cx("mb-5 flex flex-col gap-4", className)}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    {back ? (
                        <button
                            type="button"
                            className="mb-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
                            onClick={() => go(back.to)}
                        >
                            <Icon name="chevl" size="xs" />
                            {back.label}
                        </button>
                    ) : null}
                    {eyebrow ? <div className="label-mono mb-1">{eyebrow}</div> : null}
                    <h1 className="truncate text-xl font-semibold tracking-tight text-primary md:text-display-xs">{title}</h1>
                    {meta ? <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tertiary">{meta}</div> : null}
                </div>
                {actions || fold?.length ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                        {fold?.length ? (
                            <>
                                <div className="hidden items-center gap-2 lg:flex">
                                    {fold.map((f) => (
                                        <Button key={f.label} color="secondary" ico={f.icon} isDisabled={f.disabled} onClick={f.act}>
                                            {f.label}
                                        </Button>
                                    ))}
                                </div>
                                <MoreMenu items={fold} className="lg:hidden" />
                            </>
                        ) : null}
                        {actions}
                    </div>
                ) : null}
            </div>
            {tabs}
        </header>
    );
}

/* THE SECTION HEAD — a title inside a page, with an optional line of context
   and a right-hand control. */
export function SectionHead({ title, desc, right, className }: { title?: ReactNode; desc?: ReactNode; right?: ReactNode; className?: string }) {
    return (
        <div className={cx("mb-3 flex flex-wrap items-end justify-between gap-2", className)}>
            <div className="min-w-0">
                <h2 className="text-md font-semibold text-primary">{title}</h2>
                {desc ? <p className="mt-0.5 text-sm text-tertiary">{desc}</p> : null}
            </div>
            {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
        </div>
    );
}

/* CARD — the plane a group of related things stands on. `ticks` opts into the
   corner marks that mean INSTRUMENT: a KPI, a chart frame, a measured figure.
   Never on a card that is only a container. */
const CARD_RAIL: Record<string, string> = {
    ok: "bg-utility-green-500",
    warning: "bg-utility-yellow-500",
    error: "bg-utility-red-500",
    info: "bg-utility-blue-500",
    brand: "bg-brand-solid",
    sys: "bg-utility-indigo-500",
};

export function Card({
    title,
    sub,
    right,
    children,
    foot,
    ticks,
    tone,
    cls,
    className,
    tight,
    flush,
}: {
    title?: ReactNode;
    sub?: ReactNode;
    right?: ReactNode;
    children?: ReactNode;
    foot?: ReactNode;
    ticks?: boolean;
    /** THE EXCEPTION RAIL down the card's left edge — `ok`, `warning`,
     *  `error`, `info`, `brand`, `sys`. A card that needs a human today is
     *  findable in a column of cards without reading any of them. */
    tone?: "ok" | "warning" | "error" | "info" | "brand" | "sys";
    cls?: string;
    className?: string;
    /** less padding — a card that is mostly a table or a list */
    tight?: boolean;
    /** no body padding at all — the content draws its own edge */
    flush?: boolean;
}) {
    return (
        <section className={cx("relative flex flex-col rounded-xl bg-primary shadow-xs ring-1 ring-secondary sheen", ticks && "ticks", cls, className)}>
            {/* the rail is an element, not the `rail-*` utility: `ticks` already
                owns this box's ::before, and a card may be both measured and
                in trouble */}
            {tone ? <span aria-hidden="true" className={cx("absolute inset-y-1.5 left-0 w-[3px] rounded-r-sm", CARD_RAIL[tone])} /> : null}
            {title || right ? (
                <header className={cx("flex items-start justify-between gap-3 border-b border-secondary", tight ? "px-4 py-3" : "px-5 py-4")}>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-primary">{title}</h3>
                        {sub ? <p className="mt-0.5 text-xs text-tertiary">{sub}</p> : null}
                    </div>
                    {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
                </header>
            ) : null}
            <div className={cx("min-w-0 flex-1", flush ? "" : tight ? "p-4" : "p-5")}>{children}</div>
            {foot ? <footer className={cx("border-t border-secondary text-sm text-tertiary", tight ? "px-4 py-2.5" : "px-5 py-3")}>{foot}</footer> : null}
        </section>
    );
}

/* THE TRACKED MICRO-LABEL as a block — a section key. */
export function Eyebrow({ children, bare, className }: { children: ReactNode; bare?: boolean; className?: string }) {
    return (
        <div className={cx("label-mono flex items-center gap-3", className)}>
            <span>{children}</span>
            {!bare && <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-border-secondary" />}
        </div>
    );
}

/* THE STAT TILE — one number, its name, its comparison. The FIGURE is never
   coloured by trend; the delta is. Carries the corner ticks: it was measured. */
export interface TileProps {
    k?: ReactNode;
    v?: ReactNode;
    s?: ReactNode;
    icon?: string;
    tone?: string;
    on?: boolean;
    serif?: boolean;
    to?: string;
    delta?: { dir: "up" | "down" | "flat"; text: ReactNode; of?: ReactNode; good?: boolean };
    foot?: ReactNode;
    /* A CAVEAT MUST NOT BE CLIPPED. `s` is one line by default — a unit, a
       period, a denominator. When it carries the reason a figure is null or
       partial, it wraps instead: a sentence cut mid-word reads as a sentence
       somebody said, and a caveat nobody can finish is worse than none. */
    wrapSub?: boolean;
    className?: string;
}

const TILE_TONE: Record<string, string> = {
    ok: "text-success-primary",
    warn: "text-warning-primary",
    bad: "text-error-primary",
    info: "text-info-primary",
    brand: "text-brand-secondary",
};

export function Tile(o: TileProps) {
    const deltaTone = o.delta ? (o.delta.dir === "flat" ? "text-quaternary" : (o.delta.good ?? o.delta.dir === "up") ? "text-success-primary" : "text-error-primary") : "";
    const inner = (
        <>
            <div className="label-mono flex items-center gap-1.5">
                {o.icon ? <Icon name={o.icon} size="xs" /> : null}
                <span className="truncate">{o.k}</span>
            </div>
            <div className={cx("mt-2 text-display-xs font-semibold tracking-tight tnum", o.tone ? TILE_TONE[o.tone] || "text-primary" : "text-primary")}>{o.v ?? "—"}</div>
            {o.s ? <div className={cx("mt-0.5 text-xs text-tertiary", o.wrapSub ? "text-pretty" : "truncate")}>{o.s}</div> : null}
            {o.delta || o.foot ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {o.delta ? (
                        <span className={cx("inline-flex items-center gap-0.5 font-medium tnum", deltaTone)}>
                            <Icon name={o.delta.dir === "up" ? "up" : o.delta.dir === "down" ? "down" : "minus"} size="xs" />
                            {o.delta.text}
                        </span>
                    ) : null}
                    {o.delta && o.delta.of ? <span className="text-quaternary">{o.delta.of}</span> : null}
                    {o.foot}
                </div>
            ) : null}
        </>
    );
    const cls = cx(
        "ticks relative flex min-w-0 flex-col rounded-xl bg-primary p-4 text-left shadow-xs ring-1 ring-secondary sheen transition duration-100",
        o.to && "cursor-pointer outline-focus-ring hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2",
        o.on && "ring-2 ring-brand",
        o.className,
    );
    return o.to ? (
        <button type="button" className={cls} data-go={o.to} onClick={() => go(o.to as string)}>
            {inner}
        </button>
    ) : (
        <div className={cls}>{inner}</div>
    );
}

export function Tiles({ list, cols, className }: { list: TileProps[]; cols?: number; className?: string }) {
    const grid =
        cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : cols === 5 ? "sm:grid-cols-2 lg:grid-cols-5" : cols === 6 ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-2 lg:grid-cols-4";
    return (
        <div className={cx("grid grid-cols-1 gap-3", grid, className)}>
            {list.map((t, i) => (
                <Tile key={i} {...t} />
            ))}
        </div>
    );
}

/* BREADCRUMBS — where this record sits, and the way back up. The last crumb is
   not a link. */
export function Breadcrumbs({ items, className }: { items: { label: ReactNode; to?: string }[]; className?: string }) {
    return (
        <nav className={cx("flex min-w-0 items-center gap-1.5 text-sm", className)} aria-label="Breadcrumb">
            {items.map((c, i) => {
                const last = i === items.length - 1;
                return (
                    <Fragment key={i}>
                        {i ? <Icon name="chevr" size="xs" className="text-fg-quaternary" /> : null}
                        {last || !c.to ? (
                            <span className={cx("truncate", last ? "font-semibold text-primary" : "text-tertiary")} aria-current={last ? "page" : undefined}>
                                {c.label}
                            </span>
                        ) : (
                            <a
                                href={c.to}
                                data-go={c.to}
                                className="truncate rounded text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
                                onClick={(e) => {
                                    e.preventDefault();
                                    go(c.to as string);
                                }}
                            >
                                {c.label}
                            </a>
                        )}
                    </Fragment>
                );
            })}
        </nav>
    );
}

/* The topbar title, panel-wide: it names the module (or its section) and is
   the way up — pressing it returns to the default view at `to`. */
export function TbTitle({ label, to }: { label: ReactNode; to: string }) {
    return (
        <button
            type="button"
            className="cursor-pointer truncate rounded-md text-sm font-semibold text-primary outline-focus-ring hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
            title="Back to the default view"
            onClick={() => go(to)}
        >
            {label}
        </button>
    );
}

/* KEY / VALUE — a record's facts as a definition list. */
export function KvList({ pairs, cls, className, cols }: { pairs: [ReactNode, ReactNode][]; cls?: string; className?: string; cols?: 1 | 2 }) {
    return (
        <dl className={cx("grid gap-x-4 gap-y-2.5", cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-[minmax(7rem,max-content)_1fr]", cls, className)}>
            {pairs.map((p, i) => (
                <Fragment key={i}>
                    <dt className="text-xs font-medium text-tertiary sm:self-baseline">{p[0]}</dt>
                    <dd className="min-w-0 text-sm text-primary [overflow-wrap:anywhere] sm:self-baseline">{p[1] === null || p[1] === undefined || p[1] === "" ? <span className="text-quaternary">—</span> : p[1]}</dd>
                </Fragment>
            ))}
        </dl>
    );
}
