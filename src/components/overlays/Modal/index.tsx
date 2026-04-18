import styles from "./Modal.module.css";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";


interface ModalProps {
    onClose: () => void;
    children: ReactNode;
    width?: string;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ onClose, children, width, maxWidth }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const previouslyFocusedElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        blockOutsideAccess();

        // Save the currently focused element to restore later
        previouslyFocusedElement.current = document.activeElement as HTMLElement;

        // Move focus to the modal
        const focusable = getFocusableElements();
        focusable[0]?.focus();

        return () => {
            unBlockOutsideAccess();
            document.removeEventListener("keydown", handleKeyDown);
            previouslyFocusedElement.current?.focus(); // Restore focus
        };
    }, []);

    const getFocusableElements = () => {
        if (!contentRef.current) return [];
        return Array.from(
            contentRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
        ).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            handleClose();
        }

        if (e.key === "Tab") {
            const focusableEls = getFocusableElements();
            if (focusableEls.length === 0) return;

            const first = focusableEls[0];
            const last = focusableEls[focusableEls.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    };

    const blockOutsideAccess = () => {
        const body = document.body;
        [...body.children].forEach((el) => {
            if (!el.getAttribute("data-dialog")) {
                el.setAttribute("aria-hidden", "true");
                el.setAttribute("inert", "");
            }
        });
    };

    const unBlockOutsideAccess = () => {
        const body = document.body;
        [...body.children].forEach((el) => {
            if (!el.getAttribute("data-dialog")) {
                el.removeAttribute("aria-hidden");
                el.removeAttribute("inert");
            }
        });
    };

    const handleClose = () => {
        if (contentRef.current) {
            contentRef.current.classList.add(styles.hideModal);
        }

        if (backdropRef.current) {
            backdropRef.current.classList.add(styles.hideModal);
        }

        contentRef.current?.addEventListener(
            "animationend",
            () => {
                onClose();
            },
            { once: true }
        );
    };


    return createPortal(
        <div data-dialog="true" className={styles.modal}>
            <div
                ref={backdropRef}
                className={styles.modalBackdrop}
            />
            <div ref={contentRef} className={styles.modalContent} tabIndex={-1} style={{ width: width || undefined, maxWidth: maxWidth || undefined }}>
                <button onClick={handleClose} className={styles.modalClose}>
                    <FiX size={24} />
                </button>
                {children}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
