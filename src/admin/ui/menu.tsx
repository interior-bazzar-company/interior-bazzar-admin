/* =============================================================================
   ui/menu — the panel's one More menu, and the one menu row.
   -----------------------------------------------------------------------------
   A record header's actions behind one plain button. Untitled UI's Dropdown
   (React Aria Menu) underneath: portalled, so no scroll container can clip
   it; keyboard-complete; dismissed by the library on outside press, Escape
   and scroll. A DESTRUCTIVE ITEM IS LAST AND SEPARATED.
   ========================================================================== */
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useLayoutEffect, useState } from "react";
import { ChevronDown } from "@untitledui/icons";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { Icon, iconOf } from "./icon";
import { go } from "./nav";

/** One entry behind the More button. */
export interface MenuItem {
    icon: string;
    label: string;
    act: () => void;
    disabled?: boolean;
    title?: string;
    tone?: string;
}

export function MoreMenu({
    items,
    small,
    label,
    ico,
    align,
    className,
    ...rest
}: {
    items: MenuItem[];
    small?: boolean;
    label?: ReactNode;
    /* ICON-ONLY. A row menu labelled "More ⌄" costs ~90px in EVERY row of
       every list in the panel. In a table row the dots are the convention and
       the accessible name carries the meaning; a page header still spells it. */
    ico?: boolean | string;
    align?: "left" | "right";
    className?: string;
    "aria-label"?: string;
    "data-act"?: string;
}) {
    const danger = items.filter((i) => i.tone === "bad" || i.tone === "dgr" || i.tone === "danger");
    const plain = items.filter((i) => !danger.includes(i));
    const name = (rest["aria-label"] as string) || (typeof label === "string" ? label : "Actions");
    const row = (it: MenuItem) => (
        <Dropdown.Item
            key={it.label}
            id={it.label}
            icon={iconOf(it.icon)}
            label={it.title ? undefined : it.label}
            textValue={it.label}
            isDisabled={it.disabled}
            onAction={it.act}
            className={cx(danger.includes(it) && "[&_span]:text-error-primary [&_svg]:text-fg-error-secondary")}
        >
            {/* AN ACTION MAY EXPLAIN ITSELF. `title` is the consequence in one
                line — what happens, or why this one is not available today. */}
            {it.title ? (
                <span className="flex min-w-0 flex-col">
                    <span className="truncate">{it.label}</span>
                    <span className="mt-0.5 text-xs font-normal text-tertiary">{it.title}</span>
                </span>
            ) : undefined}
        </Dropdown.Item>
    );
    return (
        <Dropdown.Root>
            {ico ? (
                <Button
                    color="tertiary"
                    size={small ? "xs" : "sm"}
                    iconLeading={iconOf(typeof ico === "string" ? ico : "dots")}
                    className={className}
                    aria-haspopup="menu"
                    aria-label={name}
                    data-act={rest["data-act"]}
                />
            ) : (
                <Button
                    color="secondary"
                    size={small ? "xs" : "sm"}
                    iconTrailing={ChevronDown}
                    className={className}
                    aria-haspopup="menu"
                    aria-label={rest["aria-label"]}
                    data-act={rest["data-act"]}
                >
                    {label || "More"}
                </Button>
            )}
            <Dropdown.Popover placement={align === "left" ? "bottom left" : "bottom right"} className="w-max min-w-44">
                <Dropdown.Menu aria-label={name}>
                    {plain.length ? <Dropdown.Section>{plain.map(row)}</Dropdown.Section> : null}
                    {plain.length && danger.length ? <Dropdown.Separator /> : null}
                    {danger.length ? <Dropdown.Section>{danger.map(row)}</Dropdown.Section> : null}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
}

/* THE MENU ROW — the contents of a popover the shell positions. One drawing
   for every menu-like list that is not a Dropdown (the account popover, a
   context list). */
export function MenuRow({
    ico,
    label,
    desc,
    right,
    danger,
    disabled,
    current,
    to,
    onClick,
    className,
}: {
    ico?: string;
    label: ReactNode;
    desc?: ReactNode;
    right?: ReactNode;
    danger?: boolean;
    disabled?: boolean;
    current?: boolean;
    to?: string;
    onClick?: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            aria-current={current || undefined}
            data-go={to}
            className={cx(
                "group/row flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-semibold outline-focus-ring transition duration-100 hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                danger ? "text-error-primary" : "text-secondary hover:text-secondary_hover",
                current && "bg-primary_hover",
                className,
            )}
            onClick={() => {
                if (onClick) onClick();
                else if (to) go(to);
            }}
        >
            {ico ? <Icon name={ico} size="sm" className={danger ? "text-fg-error-secondary" : "text-fg-quaternary"} /> : null}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{label}</span>
                {desc ? <span className="truncate text-xs font-normal text-tertiary">{desc}</span> : null}
            </span>
            {right ? <span className="shrink-0 text-xs font-medium text-quaternary">{right}</span> : null}
        </button>
    );
}
export const MenuSection = ({ children, title }: { children: ReactNode; title?: ReactNode }) => (
    <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
        {title ? <div className="label-mono px-2.5 pt-1 pb-1.5">{title}</div> : null}
        {children}
    </div>
);
export const MenuDivider = () => <div role="separator" className="my-0.5 h-px w-full bg-border-secondary" />;

/* ------------------------------------------------------------ placement --- */
/** Where a self-positioned popup goes, measured from its own button. Kept for
 *  the two module-local menus still rendering their own popup; every new menu
 *  is a Dropdown and needs none of this. */
export function useMenuPlacement(
    open: boolean,
    box: RefObject<HTMLElement | null>,
    pop: RefObject<HTMLElement | null>,
    align: "left" | "right" = "right",
): { style: CSSProperties; width: number } {
    const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
    const place = useCallback(() => {
        const b = box.current;
        const p = pop.current;
        if (!b || !p) return;
        const r = b.getBoundingClientRect();
        const h = p.offsetHeight || 0;
        const w = p.offsetWidth || 168;
        const gap = 4;
        const below = r.bottom + gap;
        const flip = below + h > window.innerHeight && r.top - gap - h > 0;
        const want = align === "left" ? r.left : r.right - w;
        setAt({
            top: flip ? r.top - gap - h : below,
            left: Math.max(8, Math.min(want, window.innerWidth - w - 8)),
            width: r.width,
        });
    }, [align, box, pop]);
    useLayoutEffect(() => {
        if (!open) {
            setAt(null);
            return;
        }
        place();
    }, [open, place]);
    return {
        style: at ? { position: "fixed", top: at.top, left: at.left, right: "auto", zIndex: 100 } : { position: "fixed", top: -9999, left: -9999, right: "auto", zIndex: 100 },
        width: at ? at.width : 0,
    };
}

/** The panel's popup surface for those self-positioned menus. */
export const POP_CLASS = "flex min-w-44 flex-col rounded-lg bg-primary py-1 shadow-lg ring-1 ring-secondary_alt";
