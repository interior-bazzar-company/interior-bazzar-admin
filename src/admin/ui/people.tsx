/* =============================================================================
   ui/people — a person, as one object, everywhere they appear.
   ========================================================================== */
import type { ReactNode } from "react";
import { Avatar as UIAvatar } from "@/components/base/avatar/avatar";
import { cx } from "@/utils/cx";
import { avatarTone, initials } from "./helpers";
import { go } from "./nav";

const TINT: Record<ReturnType<typeof avatarTone>, string> = {
    gray: "bg-utility-neutral-100 text-utility-neutral-700",
    blue: "bg-utility-blue-100 text-utility-blue-700",
    indigo: "bg-utility-indigo-100 text-utility-indigo-700",
    purple: "bg-utility-purple-100 text-utility-purple-700",
    pink: "bg-utility-pink-100 text-utility-pink-700",
    orange: "bg-utility-orange-100 text-utility-orange-700",
    sky: "bg-utility-sky-100 text-utility-sky-700",
    slate: "bg-utility-slate-100 text-utility-slate-700",
};

/* AVATAR — initials on a tint derived FROM THE NAME, so the same person is the
   same colour on every screen. The tints mean nothing, by contract. */
export function Avatar({
    name,
    src,
    lg,
    sm,
    xs,
    xl,
    size,
    className,
}: {
    name?: string | null;
    src?: string | null;
    lg?: boolean;
    sm?: boolean;
    xs?: boolean;
    xl?: boolean;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    className?: string;
}) {
    const s = size || (xl ? "xl" : lg ? "lg" : xs ? "xs" : sm ? "sm" : "md");
    const tone = avatarTone(name);
    return (
        <UIAvatar
            size={s}
            src={src || undefined}
            alt={name || ""}
            initials={initials(name) || undefined}
            className={className}
            contentClassName={cx(!src && TINT[tone], !src && "[&>span]:text-current")}
        />
    );
}

/* A PERSON: the face, the name, and what they are. */
export function Person({ name, sub, src, lg, sm, to, className }: { name?: string | null; sub?: ReactNode; src?: string | null; lg?: boolean; sm?: boolean; to?: string; className?: string }) {
    const inner = (
        <>
            <Avatar name={name} src={src} lg={lg} sm={sm} xs={sm} />
            <span className="flex min-w-0 flex-col leading-tight">
                <span className={cx("truncate font-medium text-primary", lg ? "text-md" : "text-sm")}>{name || "—"}</span>
                {sub ? <span className="truncate text-xs text-tertiary">{sub}</span> : null}
            </span>
        </>
    );
    const cls = cx("inline-flex min-w-0 items-center gap-2", className);
    return to ? (
        <a
            className={cx(cls, "group rounded-md outline-focus-ring hover:[&_span:first-child]:underline focus-visible:outline-2 focus-visible:outline-offset-2")}
            href={to}
            data-go={to}
            onClick={(e) => {
                e.preventDefault();
                go(to);
            }}
        >
            {inner}
        </a>
    ) : (
        <span className={cls}>{inner}</span>
    );
}
