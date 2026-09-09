/* =============================================================================
   ui/buttons — one Button, one IconButton, one Segmented control.
   -----------------------------------------------------------------------------
   `Button` is Untitled UI's, re-exported with the panel's defaults. The whole
   vocabulary a view needs:

     color   primary (forest — ONE per view) · secondary · tertiary ·
             link-color · link-gray · primary-destructive ·
             secondary-destructive · tertiary-destructive
     size    xs 32px (toolbars, table rows) · sm 36px (the default; page
             headers, forms) · md 40px · lg 44px (a form's submit, the door)

   `IconButton` is an icon-only control WITH A TOOLTIP, because an icon alone
   is a label nobody can read. `Segmented` is a radiogroup of two to four fixed
   options switched in one press — use it when the options will not grow, a
   Select the moment they might.
   ========================================================================== */
import type { FC, ReactNode } from "react";
import { Button as UIButton } from "@/components/base/buttons/button";
import type { Props as UIButtonProps } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { cx } from "@/utils/cx";
import { iconOf } from "./icon";

export type ButtonProps = UIButtonProps & {
    /** the panel's icon name, as an alternative to `iconLeading` */
    ico?: string;
    /** `block` stretches to the container — a form's submit, the door */
    block?: boolean;
    /** HOW MANY THIS BUTTON WILL ACT ON — "Export 24", "Assign 3". A figure on
     *  the control itself, not a Pill dropped into the label: a Badge is a
     *  block and breaks the label onto two lines. */
    count?: number | string;
};

export function Button({ ico, block, count, className, iconLeading, children, size = "sm", ...rest }: ButtonProps) {
    /* pass `children` THROUGH untouched when there is no count: the library
       reads `!children` to decide a button is icon-only, and an always-present
       wrapper would give every icon button a text slot it does not want. */
    const label =
        count === undefined || count === "" ? (
            children
        ) : (
            <>
                {children}
                <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded px-1 text-2xs font-semibold tnum ring-1 ring-current/25 ring-inset">{count}</span>
            </>
        );
    return (
        <UIButton size={size} iconLeading={iconLeading || (ico ? iconOf(ico) : undefined)} className={cx(block && "w-full", className)} {...rest}>
            {label}
        </UIButton>
    );
}

/* AN ICON-ONLY BUTTON, and the tooltip is required — it is the label. */
export function IconButton({
    ico,
    icon,
    label,
    size = "sm",
    color = "tertiary",
    className,
    ...rest
}: {
    ico?: string;
    icon?: FC<{ className?: string }> | ReactNode;
    label: string;
    size?: "xs" | "sm";
    color?: "secondary" | "tertiary";
    className?: string;
    onClick?: () => void;
    isDisabled?: boolean;
    href?: string;
    "data-act"?: string;
}) {
    return <ButtonUtility size={size} color={color} icon={icon || (ico ? iconOf(ico) : undefined)} tooltip={label} className={className} {...rest} />;
}

/* SEGMENTED — a radiogroup, not a row of buttons. The chosen option is
   announced as selected and the arrow keys move between them. */
export function Segmented({
    options,
    value,
    onPick,
    label,
    sm,
    className,
}: {
    options: { v: string; l: ReactNode; ico?: string }[];
    value: string;
    onPick: (v: string) => void;
    label?: string;
    sm?: boolean;
    className?: string;
}) {
    return (
        <ButtonGroup
            aria-label={label}
            size={sm ? "sm" : "md"}
            selectedKeys={[value]}
            disallowEmptySelection
            onSelectionChange={(keys) => {
                const k = [...keys][0];
                if (k !== undefined && String(k) !== value) onPick(String(k));
            }}
            className={cx(sm && "[&>button]:py-1.5", className)}
        >
            {options.map((o) => (
                <ButtonGroupItem key={o.v} id={o.v} iconLeading={o.ico ? iconOf(o.ico) : undefined} data-act="seg" data-v={o.v}>
                    {o.l}
                </ButtonGroupItem>
            ))}
        </ButtonGroup>
    );
}
