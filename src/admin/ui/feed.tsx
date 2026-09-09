/* =============================================================================
   ui/feed — what happened to a record (timeline) and what people are doing
   (activity feed). Two different questions, two drawings.
   ========================================================================== */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Icon } from "./icon";
import { Avatar } from "./people";

const DOT: Record<string, string> = {
    sys: "bg-utility-indigo-500",
    bad: "bg-utility-red-500",
    ok: "bg-utility-green-500",
    warn: "bg-utility-yellow-500",
    info: "bg-utility-blue-500",
    brand: "bg-brand-solid",
};

/* TIMELINE — newest first, with the system's own entries marked as the
   system's: a derived event and a person's decision look identical in a flat
   list, and telling those apart is most of what an audit trail is for. */
export function Timeline({
    items,
    className,
}: {
    items: { title: ReactNode; meta?: ReactNode; body?: ReactNode; tone?: "sys" | "bad" | "ok" | "warn" | "info" | "brand" }[];
    className?: string;
}) {
    if (!items.length) return null;
    return (
        <ol className={cx("relative flex flex-col", className)}>
            {items.map((it, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* the rail */}
                    {i < items.length - 1 && <span aria-hidden="true" className="absolute top-3 bottom-0 left-[5px] w-px bg-border-secondary" />}
                    <span aria-hidden="true" className={cx("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-2 ring-bg-primary", it.tone ? DOT[it.tone] : "bg-quaternary")} />
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-primary">{it.title}</div>
                        {it.body ? <div className="mt-0.5 text-sm text-tertiary">{it.body}</div> : null}
                        {it.meta ? <div className="mt-1 text-xs text-quaternary tnum">{it.meta}</div> : null}
                    </div>
                </li>
            ))}
        </ol>
    );
}

/* ACTIVITY FEED — a stream of things PEOPLE did, with a face on each entry. */
export function ActivityFeed({ items, className }: { items: { who?: string | null; what: ReactNode; when?: ReactNode; ico?: string }[]; className?: string }) {
    if (!items.length) return null;
    return (
        <ul className={cx("flex flex-col divide-y divide-border-secondary", className)}>
            {items.map((it, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    {it.ico ? (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-fg-quaternary ring-1 ring-secondary ring-inset">
                            <Icon name={it.ico} size="xs" />
                        </span>
                    ) : (
                        <Avatar name={it.who} xs />
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="text-sm text-secondary">{it.what}</div>
                        {it.when ? <div className="mt-0.5 text-xs text-quaternary tnum">{it.when}</div> : null}
                    </div>
                </li>
            ))}
        </ul>
    );
}
