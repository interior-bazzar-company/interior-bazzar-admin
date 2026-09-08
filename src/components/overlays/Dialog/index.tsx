/* The confirm dialog behind useDialog() / useConfirm().
   -----------------------------------------------------------------------------
   Drawn from the panel's own overlay classes, so a confirmation raised through
   this context is the same object as one raised through `shell.modal()` with
   the library's ConfirmModal inside it. It used to be built on Untitled UI's
   Modal + Button, which meant the product had two confirm dialogs with
   different corner radii, different button heights and different action order.

   `role="alertdialog"` rather than `dialog`: this interrupts to ask a question
   whose answer has a consequence, and that role is what tells a screen reader
   to announce the message immediately instead of waiting to be read to.

   THE ACTIONS READ RIGHT TO LEFT — cancel, then confirm — and the confirm
   button carries the VERB rather than "OK", so the last words read before the
   press say what the press does. */
import { useEffect, useRef } from "react";

interface DialogProps {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    /** a destructive confirmation paints its action in the danger tone */
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const Dialog = ({
    title,
    message,
    confirmText = "OK",
    cancelText = "Cancel",
    danger,
    onConfirm,
    onCancel,
}: DialogProps) => {
    const ok = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const on = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
        document.addEventListener("keydown", on);
        /* Focus lands on the CONFIRM button, which is safe here and not in
           general: this dialog is only ever raised in answer to something the
           person just pressed, so the action is the one they already chose. A
           dialog that appears unprompted must focus Cancel instead. */
        const t = window.setTimeout(() => ok.current?.focus(), 0);
        return () => { document.removeEventListener("keydown", on); window.clearTimeout(t); };
    }, [onCancel]);

    return (
        <div className="scrim" data-open="true" onMouseDown={onCancel}>
            <div
                className="modal sm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={title ? "dialog-title" : undefined}
                aria-describedby="dialog-message"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="md-in">
                    {title ? (
                        <div className="md-h">
                            <div className="min-0"><h3 id="dialog-title">{title}</h3></div>
                        </div>
                    ) : null}
                    <div className="md-b">
                        <p className="md-p" id="dialog-message">{message}</p>
                    </div>
                    <div className="md-f">
                        <button type="button" className="btn" onClick={onCancel}>{cancelText}</button>
                        <button ref={ok} type="button" className={"btn " + (danger ? "danger" : "pri")}
                                onClick={onConfirm}>{confirmText}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dialog;
