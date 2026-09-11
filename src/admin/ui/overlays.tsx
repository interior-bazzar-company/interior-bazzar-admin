/* =============================================================================
   ui/overlays — what goes INSIDE a modal, a drawer, a tooltip, an alert.
   -----------------------------------------------------------------------------
   A TOAST CONFIRMS · A MODAL DECIDES · A DRAWER INSPECTS · A POPOVER OFFERS.

   The SHELL owns where they appear (ShellContext's drawer / modal / openPop /
   toast, on React Aria's overlays). These own what is inside one, so every
   modal across twenty routes puts its title in the same place and its actions
   in the same order: the primary last, the destructive pulled to the far left.
   ========================================================================== */
import { useId, useRef, useState, type ReactNode } from "react";
import { Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Focusable, Popover as AriaPopover } from "react-aria-components";
import { Tooltip as UITooltip } from "@/components/base/tooltip/tooltip";
import { CloseButton } from "@/components/base/buttons/close-button";
import { InputBase } from "@/components/base/input/input";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { cx } from "@/utils/cx";
import { Button } from "./buttons";
import { FormField, Textarea } from "./fields";
import { errMessage } from "../../api/apiService";
import { copyToClipboard } from "./helpers";
import { Icon, iconOf } from "./icon";
import { fmtDate } from "./format";

/* --------------------------------------------------------------- modal */
export function ModalHead({ title, sub, mono, ico, onClose, tone }: { title: ReactNode; sub?: ReactNode; mono?: boolean; ico?: string; onClose?: () => void; tone?: "brand" | "gray" | "error" | "warning" | "success" }) {
    return (
        <div className="flex items-start gap-4 px-5 pt-5 pb-4">
            {ico ? <FeaturedIcon icon={iconOf(ico)} color={tone || "gray"} theme="modern" size="md" /> : null}
            <div className="min-w-0 flex-1">
                <h3 className="text-md font-semibold text-primary">{title}</h3>
                {sub ? <p className={cx("mt-0.5 text-sm text-tertiary", mono && "font-mono tnum")}>{sub}</p> : null}
            </div>
            {onClose ? <CloseButton size="sm" className="-mt-1 -mr-1 shrink-0" data-close="1" onPress={onClose} /> : null}
        </div>
    );
}

export function ModalShell({
    title,
    sub,
    mono,
    ico,
    tone,
    children,
    actions,
    danger,
    onClose,
    flush,
}: {
    title?: ReactNode;
    sub?: ReactNode;
    mono?: boolean;
    ico?: string;
    tone?: "brand" | "gray" | "error" | "warning" | "success";
    children?: ReactNode;
    actions?: ReactNode;
    danger?: ReactNode;
    onClose?: () => void;
    /** no body padding — a table or a list that draws its own edge */
    flush?: boolean;
}) {
    return (
        <div className="flex max-h-full min-h-0 flex-col">
            {title ? <ModalHead title={title} sub={sub} mono={mono} ico={ico} tone={tone} onClose={onClose} /> : null}
            <div className={cx("min-h-0 flex-1 overflow-y-auto", flush ? "" : "px-5 pb-5", !title && !flush && "pt-5")}>{children}</div>
            {actions || danger ? (
                <div className="flex items-center gap-2 border-t border-secondary px-5 py-3">
                    {danger ? <span className="flex items-center gap-2">{danger}</span> : null}
                    <span className="flex-1" />
                    <span className="flex items-center gap-2">{actions}</span>
                </div>
            ) : null}
        </div>
    );
}

/* CONFIRM — the one modal the panel draws for itself, so every irreversible
   action asks the same way. It names the thing, states the consequence, and
   repeats the verb on the button. */
export function ConfirmModal({
    title,
    body,
    verb,
    tone,
    onConfirm,
    onClose,
    busy,
}: {
    title: ReactNode;
    body?: ReactNode;
    verb?: string;
    tone?: "bad" | "pri";
    onConfirm: () => void;
    onClose: () => void;
    busy?: boolean;
}) {
    return (
        <ModalShell
            title={title}
            ico={tone === "bad" ? "alert" : "help"}
            tone={tone === "bad" ? "error" : "brand"}
            onClose={onClose}
            actions={
                <>
                    <Button color="secondary" onClick={onClose} isDisabled={busy}>
                        Cancel
                    </Button>
                    <Button color={tone === "bad" ? "primary-destructive" : "primary"} isLoading={busy} onClick={onConfirm}>
                        {verb || "Confirm"}
                    </Button>
                </>
            }
        >
            {typeof body === "string" ? <p className="text-sm text-tertiary">{body}</p> : body}
        </ModalShell>
    );
}

/* CONFIRM, AND SAY WHY — the same dialog with one field, for an action whose
   reason has to be recorded: reject, cancel, refund, revoke. Quotations and
   Invoices each carried a byte-identical copy of this; one drawing now.

   The reason reaches `run` TRIMMED, and a blank one never reaches it at all
   when `required` — the field exists because somebody will read the answer
   later, and " " is not an answer. */
export function ReasonModal({
    heading,
    sub,
    label,
    required,
    confirmLabel,
    tone,
    hint,
    onClose,
    run,
}: {
    heading: string;
    sub?: ReactNode;
    label: string;
    required?: boolean;
    confirmLabel: string;
    /** `bad` for an action that destroys or refuses something */
    tone?: "bad" | "pri";
    hint?: ReactNode;
    onClose: () => void;
    run: (reason: string) => Promise<unknown>;
}) {
    const id = useId();
    const [text, setText] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = () => {
        const reason = text.trim();
        if (required && !reason) {
            setErr("A reason is required.");
            return;
        }
        setErr(null);
        setBusy(true);
        run(reason).catch((e: unknown) => {
            setErr(errMessage(e));
            setBusy(false);
        });
    };

    return (
        <ModalShell
            title={heading}
            sub={sub}
            ico={tone === "bad" ? "alert" : "help"}
            tone={tone === "bad" ? "error" : "brand"}
            onClose={onClose}
            actions={
                <>
                    <Button color="secondary" onClick={onClose} isDisabled={busy}>
                        Cancel
                    </Button>
                    <Button color={tone === "bad" ? "primary-destructive" : "primary"} isLoading={busy} onClick={submit}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                {err ? <Alert tone="bad" title={err} /> : null}
                <FormField id={id} label={label} req={required} hint={hint}>
                    <Textarea id={id} rows={3} value={text} onChange={setText} autoFocus err={!!err && required && !text.trim()} />
                </FormField>
            </div>
        </ModalShell>
    );
}

/* --------------------------------------------------------------- drawer */
export function DrawerHead({ title, sub, mark, onClose, right }: { title: ReactNode; sub?: ReactNode; mark?: ReactNode; onClose?: () => void; right?: ReactNode }) {
    return (
        <div className="flex items-center gap-3 border-b border-secondary px-5 py-4">
            {mark}
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-md font-semibold text-primary">{title}</h3>
                {sub ? <div className="mt-0.5 truncate text-sm text-tertiary">{sub}</div> : null}
            </div>
            {right}
            {onClose ? <CloseButton size="sm" className="-mr-2 shrink-0" onPress={onClose} /> : null}
        </div>
    );
}
export function DrawerShell({ title, sub, mark, children, actions, onClose, flush }: { title?: ReactNode; sub?: ReactNode; mark?: ReactNode; children?: ReactNode; actions?: ReactNode; onClose?: () => void; flush?: boolean }) {
    return (
        <div className="flex h-full min-h-0 flex-col">
            {title ? <DrawerHead title={title} sub={sub} mark={mark} onClose={onClose} /> : null}
            <div className={cx("min-h-0 flex-1 overflow-y-auto", !flush && "p-5")}>{children}</div>
            {actions ? <div className="flex items-center justify-end gap-2 border-t border-secondary px-5 py-3">{actions}</div> : null}
        </div>
    );
}

/* -------------------------------------------------------------- tooltip */
/* A LABEL for something that has none. Opens on hover AND on focus. It must
   never hold the only copy of something. */
/* ------------------------------------------------------------- popover */
/* A POPOVER OFFERS — it is not a menu of actions (that is MoreMenu) and not a
   decision (that is a modal). It is a small panel of CONTROLS anchored to the
   thing it belongs to: a plan for today, a quick filter, a row of settings.

   The trigger is the caller's own button, rendered as `trigger`; React Aria
   wires the press, the anchoring, focus containment, Escape, outside-press
   and the dialog role. Anything the caller needs to do on dismissal it does
   in `onOpenChange` — nothing here reimplements what the library owns.  */
export function Popover({
    trigger,
    children,
    title,
    w = "md",
    placement = "bottom end",
    onOpenChange,
}: {
    trigger: ReactNode;
    children: ReactNode | ((close: () => void) => ReactNode);
    /** the accessible name of the panel — required, it announces as a dialog */
    title: string;
    w?: "sm" | "md" | "lg";
    placement?: "bottom end" | "bottom start" | "top end" | "top start" | "bottom";
    onOpenChange?: (open: boolean) => void;
}) {
    const width = w === "sm" ? "w-64" : w === "lg" ? "w-96" : "w-80";
    return (
        <AriaDialogTrigger onOpenChange={onOpenChange}>
            {trigger}
            <AriaPopover
                placement={placement}
                offset={6}
                className={({ isEntering, isExiting }) =>
                    cx(
                        "z-50 max-w-[calc(100vw-2rem)] origin-(--trigger-anchor-point) rounded-xl bg-primary shadow-lg ring-1 ring-secondary_alt will-change-transform sheen",
                        width,
                        isEntering && "duration-150 ease-out animate-in fade-in slide-in-from-top-0.5",
                        isExiting && "duration-100 ease-in animate-out fade-out slide-out-to-top-0.5",
                    )
                }
            >
                <AriaDialog aria-label={title} className="outline-hidden">
                    {({ close }) => <>{typeof children === "function" ? children(close) : children}</>}
                </AriaDialog>
            </AriaPopover>
        </AriaDialogTrigger>
    );
}

export function Tooltip({ tip, children, side }: { tip: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
    return (
        <UITooltip title={tip} placement={side || "top"}>
            <Focusable>
                <span className="inline-flex" tabIndex={0}>
                    {children}
                </span>
            </Focusable>
        </UITooltip>
    );
}

/* INFO — the i lives in ./infoDot now, so `fields` can fold a long hint behind
   one without importing this file back. Re-exported here because twenty call
   sites and ui/index already ask overlays for it. */
export { InfoDot } from "./infoDot";

/* ---------------------------------------------------------------- alert */
const ALERT: Record<string, { root: string; icon: string; glyph: string }> = {
    ok: { root: "bg-success-primary ring-utility-green-200 [&_b]:text-utility-green-700", icon: "text-fg-success-primary", glyph: "check" },
    warn: { root: "bg-warning-primary ring-utility-yellow-200 [&_b]:text-utility-yellow-700", icon: "text-fg-warning-primary", glyph: "alert" },
    bad: { root: "bg-error-primary ring-utility-red-200 [&_b]:text-utility-red-700", icon: "text-fg-error-primary", glyph: "alert" },
    info: { root: "bg-info-primary ring-utility-blue-200 [&_b]:text-utility-blue-700", icon: "text-fg-info-primary", glyph: "info" },
};
/* ALERT — a condition about THIS PAGE that somebody should read before acting.
   NOT a toast: a toast is a receipt for something that happened and goes
   away; an alert is a condition that is still true. */
export function Alert({ tone, title, children, action, onClose, className, ico }: { tone?: "ok" | "warn" | "bad" | "info"; title?: ReactNode; children?: ReactNode; action?: ReactNode; onClose?: () => void; className?: string; ico?: string }) {
    const t = ALERT[tone || "info"] || ALERT.info;
    return (
        <div className={cx("flex items-start gap-3 rounded-lg px-3.5 py-3 ring-1 ring-inset", t.root, className)} role={tone === "bad" ? "alert" : "status"}>
            <Icon name={ico || t.glyph} size="sm" className={cx("mt-0.5 shrink-0", t.icon)} />
            <div className="min-w-0 flex-1 text-sm text-secondary">
                {title ? <b className="block font-semibold">{title}</b> : null}
                {children ? <div className={cx(title && "mt-0.5")}>{children}</div> : null}
            </div>
            {action || onClose ? (
                <span className="flex shrink-0 items-center gap-2">
                    {action}
                    {onClose ? <CloseButton size="xs" onPress={onClose} label="Dismiss" /> : null}
                </span>
            ) : null}
        </div>
    );
}
/* Notice — the same object, the legacy spelling. */
export function Notice({ text, tone, ico, children, className }: { text?: ReactNode; tone?: string; ico?: string; children?: ReactNode; className?: string }) {
    const t = (tone === "ok" || tone === "warn" || tone === "bad" || tone === "info" ? tone : tone === "dgr" ? "bad" : "info") as "ok" | "warn" | "bad" | "info";
    return (
        <Alert tone={t} ico={ico} className={className}>
            {text}
            {children}
        </Alert>
    );
}

/* ------------------------------------------------------------ share line */
/* The link itself, selectable for as long as it is wanted, with its own copy
   button — the last resort when the clipboard is refused. */
export function ShareLine({ link, expires }: { link: string; expires?: string }) {
    const [said, setSaid] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="mt-2 flex flex-wrap items-center gap-2">
            <InputBase ref={inputRef} size="sm" readOnly value={link} inputClassName="font-mono text-xs" wrapperClassName="min-w-0 flex-1 basis-64" onFocus={(e) => e.currentTarget.select()} />
            <Button color="secondary" size="xs" ico="copy" onClick={async () => setSaid(await copyToClipboard(link, inputRef.current))}>
                Copy
            </Button>
            <span className="text-xs text-tertiary">
                {said ? said + " " : ""}
                {expires ? "Expires " + fmtDate(expires) : ""}
            </span>
        </div>
    );
}
