/* The content modal behind useModal(), on Untitled UI's Modal. The previous
   version re-implemented a focus trap, `inert` on the rest of the page and an
   exit animation by hand; React Aria's ModalOverlay does all of that, and the
   enter/exit animation is the library's own. */
import type { ReactNode } from "react";
import { XClose } from "@untitledui/icons/XClose";
import { Dialog as UiDialog, Modal as UiModal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";

interface ModalProps {
    onClose: () => void;
    children: ReactNode;
    width?: string;
    maxWidth?: string;
}

const Modal = ({ onClose, children, width, maxWidth }: ModalProps) => (
    <ModalOverlay isOpen isDismissable onOpenChange={(open) => { if (!open) onClose(); }}>
        <UiModal className={maxWidth ? undefined : "max-w-3xl"} style={{ width, maxWidth }}>
            <UiDialog>
                <div className="relative w-full rounded-2xl bg-primary p-8 shadow-xl ring-1 ring-secondary">
                    <Button color="tertiary" size="sm" className="absolute top-3 right-3" aria-label="Close" iconLeading={XClose} onClick={onClose} />
                    {children}
                </div>
            </UiDialog>
        </UiModal>
    </ModalOverlay>
);

export default Modal;
