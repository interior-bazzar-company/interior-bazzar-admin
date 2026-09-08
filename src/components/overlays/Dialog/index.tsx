/* The confirm dialog behind useDialog() / useConfirm(), on Untitled UI's Modal.
   React Aria owns what the hand-rolled version used to do by hand — focus
   trap, focus return, Escape, click-away, aria-modal — and the surface is the
   library's own: rounded-2xl card on the raised plane, shadow-xl, a hairline.
   The primary action is INK, per the panel's rule; the escape is secondary. */
import { Dialog as UiDialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";

interface DialogProps {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const Dialog = ({ title, message, confirmText = "OK", cancelText = "Cancel", onConfirm, onCancel }: DialogProps) => (
    <ModalOverlay isOpen isDismissable onOpenChange={(open) => { if (!open) onCancel(); }}>
        <Modal className="max-w-md">
            <UiDialog role="alertdialog" aria-labelledby="dialog-title" aria-describedby="dialog-message">
                <div className="w-full rounded-2xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                    {title && (
                        <h2 id="dialog-title" className="text-lg font-semibold text-primary">
                            {title}
                        </h2>
                    )}
                    <p id="dialog-message" className="mt-2 text-sm text-tertiary">
                        {message}
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <Button color="secondary" size="md" onClick={onCancel}>
                            {cancelText}
                        </Button>
                        <Button color="ink" size="md" onClick={onConfirm} autoFocus>
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </UiDialog>
        </Modal>
    </ModalOverlay>
);

export default Dialog;
