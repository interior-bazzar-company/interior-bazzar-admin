/* =============================================================================
   ui/infoDot — the small circled "i" and the popover it opens.
   -----------------------------------------------------------------------------
   ITS OWN FILE BECAUSE BOTH SIDES NEED IT. `overlays` already imports
   `FormField` from `fields`; the moment `fields` wanted the i back for its
   folded hints, the two files would have imported each other. This is the leaf
   they can both stand on.

   Deliberately NOT a tooltip: a tooltip LABELS, this EXPLAINS — a press rather
   than a hover, and it stays open while it is being read.
   ========================================================================== */
import type { ReactNode } from "react";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { cx } from "@/utils/cx";

export function InfoDot({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
    return (
        <AriaDialogTrigger>
            <AriaButton
                aria-label={label || "What is this?"}
                className={cx(
                    "inline-flex size-4 cursor-pointer items-center justify-center rounded-full font-mono text-2xs font-semibold text-fg-quaternary ring-1 ring-primary outline-focus-ring transition duration-100 ring-inset hover:text-fg-quaternary_hover hover:ring-secondary_alt focus-visible:outline-2 focus-visible:outline-offset-2 pressed:bg-primary_hover",
                    className,
                )}
            >
                i
            </AriaButton>
            <AriaPopover
                placement="bottom start"
                offset={6}
                className={({ isEntering, isExiting }) =>
                    cx(
                        "z-50 w-72 origin-(--trigger-anchor-point) rounded-lg bg-primary p-3 text-sm text-secondary shadow-lg ring-1 ring-secondary_alt will-change-transform",
                        isEntering && "duration-150 ease-out animate-in fade-in slide-in-from-top-0.5",
                        isExiting && "duration-100 ease-in animate-out fade-out slide-out-to-top-0.5",
                    )
                }
            >
                <AriaDialog className="outline-hidden [&_b]:font-semibold [&_b]:text-primary [&_p]:mt-1 [&_p:first-child]:mt-0">{children}</AriaDialog>
            </AriaPopover>
        </AriaDialogTrigger>
    );
}
