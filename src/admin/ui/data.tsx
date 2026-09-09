/* =============================================================================
   ui/data — tables, the stat strip, filters, pagination, empty and loading.
   -----------------------------------------------------------------------------
   THE LIST TABLE. A queue sits flat on the page with its head on the plane and
   its rows one line tall; a CARD table frames a record's sub-list. Both take
   the caller's own <tr>s — a queue's row is the whole module — so the frame,
   the head, the cell rhythm, the figure columns and the exception rail are one
   drawing applied by the wrapper. A <td className="n"> is a figure: right-
   aligned, tabular, mono.

   THE STAT STRIP — every count is also the filter for itself. A cell with no
   `to` is a read-out and is not pressable.
   ========================================================================== */
import { Fragment, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { EmptyState as UIEmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Pagination as UIPagination } from "@/components/application/pagination/pagination-base";
import { Tabs as UITabs, TabList, Tab } from "@/components/application/tabs/tabs";
import { Tooltip as UITooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";
import { Icon, iconOf } from "./icon";
import { go } from "./nav";

/* ------------------------------------------------------------------ tables */
/* The cell rhythm every table shares, applied from the wrapper so a caller's
   plain <tr><td> lands on the system without a class per cell. */
const CELLS = [
    "[&_th]:label-mono [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:align-middle",
    "[&_thead_tr]:border-b [&_thead_tr]:border-secondary [&_thead]:bg-secondary",
    "[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle [&_td]:text-sm [&_td]:text-secondary",
    "[&_tbody_tr]:border-b [&_tbody_tr]:border-secondary [&_tbody_tr:last-child]:border-0 [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-100 [&_tbody_tr:hover]:bg-primary_hover",
    "[&_tbody_tr.on]:bg-selected [&_tbody_tr.sel]:bg-selected [&_tbody_tr.clickable]:cursor-pointer [&_tbody_tr.is-link]:cursor-pointer",
    /* figures */
    "[&_td.n]:text-right [&_td.n]:tnum [&_td.n]:font-mono [&_th.n]:text-right [&_td.num]:text-right [&_td.num]:tnum [&_td.num]:font-mono [&_th.num]:text-right [&_td.r]:text-right [&_th.r]:text-right [&_td.amt]:text-right [&_td.amt]:tnum [&_td.amt]:font-mono [&_th.amt]:text-right",
    "[&_td.c]:text-center [&_th.c]:text-center [&_td.mono]:font-mono [&_td.mono]:tnum",
    /* the primary cell */
    /* `.cell-2` is a SECOND LINE, so it is a block whatever element the caller
       reached for — as a bare <span> it ran on into the title ("IT asset
       handoverEveryone · 5 fields") in every module that used one. */
    "[&_td.cell-1]:font-medium [&_td.cell-1]:text-primary [&_td_.cell-2]:block [&_td_.cell-2]:text-xs [&_td_.cell-2]:text-tertiary [&_td_.cell-2]:mt-0.5",
    "[&_td.t]:font-medium [&_td.t]:text-primary [&_td.faint]:text-quaternary [&_td_.faint]:text-quaternary",
    /* the exception rail */
    "[&_td.rail]:relative [&_td.rail]:w-1 [&_td.rail]:p-0 [&_th.rail]:w-1 [&_th.rail]:p-0",
    /* a row-end actions cell */
    "[&_td.acts]:text-right [&_td.acts]:whitespace-nowrap [&_td.acts]:py-1.5",
].join(" ");

export interface TableProps {
    cols: { label?: ReactNode; cls?: string; w?: string }[];
    rows: ReactNode[];
    empty?: EmptyStateProps;
    scroll?: boolean;
    min?: string;
    /** a LIST PAGE's table: flat on the page, no card frame */
    list?: boolean;
    className?: string;
}
export function Table(o: TableProps) {
    return (
        <div className={cx("relative w-full overflow-x-auto rounded-xl bg-primary ring-1 ring-secondary", !o.list && "shadow-xs", o.className)}>
            <table className={cx("w-full border-collapse", CELLS)} style={o.min ? { minWidth: o.min } : undefined}>
                <thead>
                    <tr>
                        {o.cols.map((c, i) => (
                            <th key={i} className={c.cls || ""} style={c.w ? { width: c.w } : undefined}>
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {o.rows.length ? (
                        o.rows.map((r, i) => <Fragment key={i}>{r}</Fragment>)
                    ) : (
                        <tr>
                            <td colSpan={o.cols.length} className="p-0!">
                                <EmptyState {...(o.empty || { title: "Nothing here yet", body: "" })} flat />
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

/* A COLUMN HEAD THAT SORTS. It is a `<th>`'s whole content, so it inherits the
   head's tracked micro-label and adds only the affordance: a pointer, the
   direction on the column that is ordering, and `aria-sort` on the cell so a
   screen reader is told what the order is rather than which button is pressed.
   The resting glyph stays visible at low opacity — hidden until hover it is an
   affordance nobody finds, and a touch screen has no hover to find it with. */
export function SortHead({ k, label, cur, dir, onPick, className }: { k: string; label: ReactNode; cur: string; dir?: "asc" | "desc"; onPick: (k: string) => void; className?: string }) {
    const on = cur === k;
    return (
        <button
            type="button"
            aria-pressed={on}
            data-sort={k}
            className={cx(
                "inline-flex cursor-pointer items-center gap-1 rounded outline-focus-ring transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2",
                on ? "text-brand-secondary" : "hover:text-secondary",
                className,
            )}
            onClick={() => onPick(k)}
        >
            {label}
            <Icon name={on ? (dir === "asc" ? "up" : "down") : "sort"} size="xs" className={cx(!on && "opacity-40")} />
        </button>
    );
}

/* Both table wrappers are `relative` ON PURPOSE. A wide table scrolls inside
   this box, but an absolutely-positioned descendant (React Aria puts a
   visually-hidden span beside interactive cells) resolves against the nearest
   POSITIONED ancestor — without one that is the document, so the span lands at
   the table's full width and the whole page could be dragged sideways on a
   phone. Positioning the wrapper contains them, and the overflow clips them.

   THE LIST TABLE — `head` is the <tr> of <th>s, the rows are the caller's. */
export function ListTable({ head, children, cls, min, className }: { head: ReactNode; children: ReactNode; cls?: string; min?: string; className?: string }) {
    return (
        <div className={cx("relative w-full overflow-x-auto rounded-xl bg-primary ring-1 ring-secondary", className)}>
            <table className={cx("w-full border-collapse", CELLS, cls)} style={min ? { minWidth: min } : undefined}>
                <thead>{head}</thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

const RAIL: Record<string, string> = {
    ok: "bg-utility-green-500",
    success: "bg-utility-green-500",
    warn: "bg-utility-yellow-500",
    warning: "bg-utility-yellow-500",
    bad: "bg-utility-red-500",
    error: "bg-utility-red-500",
    info: "bg-utility-blue-500",
    brand: "bg-brand-solid",
    sys: "bg-utility-indigo-500",
    live: "bg-utility-sky-500",
};
/* The exception stripe in a list row's first column: 3px in a status colour,
   findable without reading. */
export function Rail({ tone, title }: { tone?: string; title?: string }) {
    return (
        <td className="rail">
            <i className={cx("absolute inset-y-1.5 left-0 w-[3px] rounded-r-full", tone ? RAIL[tone] || "bg-transparent" : "bg-transparent")} title={title} />
        </td>
    );
}

/* --------------------------------------------------------------- the strip */
export interface StatCell {
    k?: ReactNode;
    v?: ReactNode;
    dot?: string;
    tone?: string;
    on?: boolean;
    title?: string;
    tip?: ReactNode;
    to?: string;
}
const DOT: Record<string, string> = {
    ok: "bg-utility-green-500",
    warn: "bg-utility-yellow-500",
    bad: "bg-utility-red-500",
    info: "bg-utility-blue-500",
    brand: "bg-brand-solid",
    sys: "bg-utility-indigo-500",
    live: "bg-utility-sky-500",
    neutral: "bg-utility-neutral-400",
};
const CELL_TONE: Record<string, string> = {
    ok: "text-success-primary",
    warn: "text-warning-primary",
    bad: "text-error-primary",
    info: "text-info-primary",
    brand: "text-brand-secondary",
};
export function StatStrip({ cells, className }: { cells: (StatCell | "sep")[]; className?: string }) {
    return (
        <div className={cx("flex items-stretch gap-1 overflow-x-auto scrollbar-hide", className)} role="group" aria-label="Summary">
            {cells.map((c, i) => {
                if (c === "sep") return <span key={i} aria-hidden="true" className="mx-1 my-2 w-px shrink-0 bg-border-secondary" />;
                const body = (
                    <>
                        {c.dot !== undefined ? <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", DOT[c.dot] || DOT.neutral)} /> : null}
                        <span className={cx("text-lg font-semibold tracking-tight tnum", c.tone ? CELL_TONE[c.tone] || "text-primary" : "text-primary")}>{c.v}</span>
                        <span className="truncate text-xs text-tertiary">{c.k}</span>
                    </>
                );
                const cls = cx(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-left transition duration-100",
                    c.to && "cursor-pointer outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2",
                    c.on && "bg-brand-primary ring-1 ring-brand ring-inset",
                );
                const cell = c.to ? (
                    <button key={i} type="button" className={cls} data-go={c.to} title={c.tip ? undefined : c.title} aria-pressed={c.on || undefined} onClick={() => go(c.to as string)}>
                        {body}
                    </button>
                ) : (
                    <div key={i} className={cls} title={c.tip ? undefined : c.title}>
                        {body}
                    </div>
                );
                return c.tip ? (
                    <UITooltip key={i} title={c.tip} placement="bottom">
                        <TooltipTrigger className="shrink-0 rounded-lg">{cell}</TooltipTrigger>
                    </UITooltip>
                ) : (
                    cell
                );
            })}
        </div>
    );
}

/* ------------------------------------------------------------- the filters */
/* THE FILTER BAR — search, the selects, a view switch on the right, and the
   chips row under it when anything narrows the list. */
export function FilterBar({ search, filters, right, chips, className }: { search?: ReactNode; filters?: ReactNode; right?: ReactNode; chips?: ReactNode; className?: string }) {
    return (
        <div className={cx("flex flex-col gap-2", className)}>
            <div className="flex flex-wrap items-center gap-2">
                {search}
                {filters}
                {right ? <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div> : null}
            </div>
            {chips}
        </div>
    );
}
export function Toolbar({ children, className }: { children?: ReactNode; className?: string }) {
    return <div className={cx("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/* A selected filter chip carries the brand on its EDGE — the only chip that
   may wear the brand at all, because it marks a choice the OPERATOR made. */
export function FilterChips({ params, labels, onUnfilter, className }: { params: Record<string, string | undefined>; labels?: Record<string, string>; onUnfilter?: (key: string) => void; className?: string }) {
    const keys = Object.keys(params).filter((k) => params[k] && k !== "tab");
    if (!keys.length) return null;
    return (
        <div className={cx("flex flex-wrap items-center gap-1.5", className)}>
            {keys.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary py-0.5 pr-1 pl-2.5 text-xs ring-1 ring-brand ring-inset">
                    <span className="text-tertiary">{(labels && labels[k]) || k}</span>
                    <span className="font-medium text-primary">{params[k]}</span>
                    <button
                        type="button"
                        className="flex cursor-pointer items-center justify-center rounded-full p-0.5 text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2"
                        data-unfilter={k}
                        aria-label={"Remove the " + ((labels && labels[k]) || k) + " filter"}
                        onClick={() => onUnfilter && onUnfilter(k)}
                    >
                        <Icon name="x" size="xs" />
                    </button>
                </span>
            ))}
            <button type="button" className="ml-1 cursor-pointer rounded text-xs font-semibold text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2" data-unfilter="*" onClick={() => onUnfilter && onUnfilter("*")}>
                Clear all
            </button>
        </div>
    );
}

/* ------------------------------------------------------------- pagination */
export function Pagination({
    page,
    pages,
    total,
    unit,
    pageSize,
    shown,
    alwaysCount,
    onPage,
    className,
}: {
    page: number;
    pages: number;
    total?: number;
    unit?: string;
    pageSize?: number;
    shown?: number;
    alwaysCount?: boolean;
    onPage: (p: number) => void;
    className?: string;
}) {
    if (pages <= 1 && !alwaysCount) return null;
    const first = pageSize ? (page - 1) * pageSize + 1 : 0;
    const last = pageSize ? first + (shown === undefined ? pageSize : shown) - 1 : 0;
    return (
        <div className={cx("flex flex-wrap items-center gap-3 pt-3", className)}>
            {total !== undefined ? (
                <span className="text-sm text-tertiary">
                    {pageSize ? (
                        <>
                            <b className="font-medium text-secondary tnum">
                                {first.toLocaleString()}–{last.toLocaleString()}
                            </b>{" "}
                            of <b className="font-medium text-secondary tnum">{total.toLocaleString()}</b>{" "}
                        </>
                    ) : (
                        <>
                            <b className="font-medium text-secondary tnum">{total.toLocaleString()}</b>{" "}
                        </>
                    )}
                    {unit || (total === 1 ? "result" : "results")}
                </span>
            ) : null}
            {pages > 1 ? (
                <UIPagination.Root page={page} total={pages} onPageChange={onPage} className="ml-auto flex items-center gap-1">
                    <UIPagination.PrevTrigger asChild>
                        <Button iconLeading={ArrowLeft} color="secondary" size="xs" aria-label="Previous page" />
                    </UIPagination.PrevTrigger>
                    <UIPagination.Context>
                        {({ pages: list }) => (
                            <div className="hidden items-center gap-0.5 sm:flex">
                                {list.map((p, i) =>
                                    p.type === "page" ? (
                                        <UIPagination.Item
                                            key={i}
                                            value={p.value}
                                            isCurrent={p.isCurrent}
                                            className={({ isSelected }) =>
                                                cx(
                                                    "flex size-8 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-quaternary outline-focus-ring transition duration-100 hover:bg-primary_hover hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 tnum",
                                                    isSelected && "bg-primary_hover text-secondary",
                                                )
                                            }
                                        >
                                            {p.value}
                                        </UIPagination.Item>
                                    ) : (
                                        <UIPagination.Ellipsis key={i} className="flex size-8 items-center justify-center text-tertiary">
                                            …
                                        </UIPagination.Ellipsis>
                                    ),
                                )}
                            </div>
                        )}
                    </UIPagination.Context>
                    <span className="text-sm text-tertiary tnum sm:hidden">
                        {page} / {pages}
                    </span>
                    <UIPagination.NextTrigger asChild>
                        <Button iconLeading={ArrowRight} color="secondary" size="xs" aria-label="Next page" />
                    </UIPagination.NextTrigger>
                </UIPagination.Root>
            ) : null}
        </div>
    );
}

/* ------------------------------------------------------------------- tabs */
/* THE TAB ROW. `n` shows only when it means somebody owes something; a count
   that is merely a size is `quiet`. A tab with `to` is a link. */
export function Tabs({
    items,
    cur,
    onPick,
    cls,
    className,
    size = "sm",
}: {
    items: { k: string; label: ReactNode; icon?: string; n?: number | null; quiet?: boolean; to?: string }[];
    cur: string;
    onPick?: (k: string) => void;
    cls?: string;
    className?: string;
    size?: "sm" | "md";
}) {
    return (
        <UITabs
            selectedKey={cur}
            onSelectionChange={(k) => {
                const key = String(k);
                const it = items.find((x) => x.k === key);
                if (onPick) onPick(key);
                if (it?.to) go(it.to);
            }}
            className={cx("w-full", cls, className)}
        >
            <TabList type="underline" size={size} className="overflow-x-auto scrollbar-hide" aria-label="Sections">
                {items.map((t) => (
                    <Tab
                        key={t.k}
                        id={t.k}
                        icon={t.icon ? iconOf(t.icon) : undefined}
                        badge={typeof t.n === "number" && t.n > 0 ? t.n : undefined}
                        data-go={t.to}
                        className={cx(t.quiet && "[&_span>span]:bg-transparent [&_span>span]:text-quaternary [&_span>span]:ring-secondary")}
                    >
                        {t.label}
                    </Tab>
                ))}
            </TabList>
        </UITabs>
    );
}

/* ------------------------------------------------------------- link chip */
export function LinkChip({ refText, to, ico, className }: { refText?: ReactNode; to: string; ico?: string; className?: string }) {
    return (
        <a
            href={to}
            data-go={to}
            className={cx(
                "inline-flex items-center gap-1 rounded-md bg-primary px-1.5 py-0.5 font-mono text-xs font-medium text-secondary ring-1 ring-primary outline-focus-ring transition duration-100 ring-inset hover:bg-primary_hover hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 tnum",
                className,
            )}
            onClick={(e) => {
                e.preventDefault();
                go(to);
            }}
        >
            <Icon name={ico || "link"} size="xs" className="text-fg-quaternary" />
            {refText}
        </a>
    );
}

/* ------------------------------------------------------- empty & loading */
export interface EmptyStateProps {
    icon?: string;
    title?: ReactNode;
    body?: ReactNode;
    action?: ReactNode;
    /** no dashed frame — inside a table cell or a card that already has an edge */
    flat?: boolean;
    className?: string;
}
/* AN EMPTY STATE IS DASHED, NOT SOLID: "a thing goes here and there is not one
   yet". Never an illustration with a joke. */
export function EmptyState(o: EmptyStateProps) {
    return (
        <div className={cx("flex w-full items-center justify-center px-6 py-10", !o.flat && "rounded-xl border border-dashed border-primary", o.className)}>
            <UIEmptyState size="sm">
                <UIEmptyState.Header pattern="none">
                    <UIEmptyState.FeaturedIcon icon={iconOf(o.icon || "inbox")} color="gray" theme="modern" size="md" />
                </UIEmptyState.Header>
                <UIEmptyState.Content>
                    {o.title ? <UIEmptyState.Title>{o.title}</UIEmptyState.Title> : null}
                    {o.body ? <UIEmptyState.Description>{o.body}</UIEmptyState.Description> : null}
                </UIEmptyState.Content>
                {o.action ? <UIEmptyState.Footer>{o.action}</UIEmptyState.Footer> : null}
            </UIEmptyState>
        </div>
    );
}

/* One pane waiting on its own record, while the page around it stays put. */
export function PaneLoading({ label, className }: { label?: ReactNode; className?: string }) {
    return (
        <div className={cx("flex w-full items-center justify-center py-12", className)} role="status" aria-live="polite">
            <LoadingIndicator size="sm" type="line-simple" label={typeof label === "string" ? label : "Loading…"} />
        </div>
    );
}

/* A skeleton bar. Matches the real row height so the layout does not jump. */
export function Skeleton({ className, w }: { className?: string; w?: number | string }) {
    return <span aria-hidden="true" className={cx("block h-3.5 animate-pulse rounded bg-skeleton", className)} style={w ? { width: w } : undefined} />;
}

/* A LIST waiting on its first fetch: command row, strip, rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 rounded-lg" w={240} />
                <Skeleton className="h-9 rounded-lg" w={140} />
                <Skeleton className="h-9 rounded-lg" w={140} />
                <span className="flex-1" />
                <Skeleton className="h-9 rounded-lg" w={120} />
            </div>
            <div className="flex gap-4 px-2 py-1">
                {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-6" w={96} />
                ))}
            </div>
            <div className="flex flex-col divide-y divide-border-secondary rounded-xl bg-primary ring-1 ring-secondary">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-3">
                        <Skeleton w={28} className="h-7 rounded-full" />
                        <Skeleton w="28%" />
                        <Skeleton w="16%" />
                        <Skeleton w="12%" />
                        <span className="flex-1" />
                        <Skeleton w={72} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ----------------------------------------------------------- chart frame */
export function Legend({ items, className }: { items: { label: ReactNode; color: string }[]; className?: string }) {
    return (
        <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tertiary", className)}>
            {items.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                    <i className="block size-2 rounded-[2px]" style={{ background: s.color }} />
                    {s.label}
                </span>
            ))}
        </div>
    );
}

/* THE FRAME A CHART SITS IN — a title, an optional control, the plot, the key.
   It carries the corner ticks: what is inside was measured. */
export function ChartFrame({
    title,
    right,
    children,
    legend,
    note,
    ticks = true,
    className,
}: {
    title?: ReactNode;
    right?: ReactNode;
    children: ReactNode;
    legend?: { label: ReactNode; color: string }[];
    note?: ReactNode;
    ticks?: boolean;
    className?: string;
}) {
    return (
        <figure className={cx("flex min-w-0 flex-col rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary sheen", ticks && "ticks", className)}>
            {title || right ? (
                <figcaption className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="label-mono truncate">{title}</h4>
                    {right ? <span className="flex shrink-0 items-center gap-2">{right}</span> : null}
                </figcaption>
            ) : null}
            <div className="min-w-0 flex-1">{children}</div>
            {legend ? <Legend items={legend} className="mt-3" /> : null}
            {note ? <div className="mt-2 text-xs text-quaternary">{note}</div> : null}
        </figure>
    );
}
