/* The content modal behind useModal(), on the panel's own overlay classes.
   -----------------------------------------------------------------------------
   It used to be built on Untitled UI's Modal + Button. That is gone, and this
   is drawn from the same `.scrim` / `.modal` / `.md-*` rules every other
   overlay in the product uses — so a modal opened through this context and one
   opened through `shell.modal()` are the same object with the same header,
   the same close affordance and the same escape behaviour.

   NATIVE <dialog> WAS NOT USED, on purpose: the panel already portals its
   layers through ShellContext and needs the two to look identical. Two
   different focus-trapping mechanisms for the same visual object is exactly
   the kind of split this consolidation exists to remove. */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  /** optional: the provider mounts this only while there is content, so the
      default is "open". A caller that keeps it mounted passes the flag. */
  isOpen?: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** a fixed width, when the content genuinely has one — a preview, a sheet */
  width?: number | string;
  maxWidth?: number | string;
}

export default function Modal({ isOpen = true, onClose, title, children, width, maxWidth }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  /* ESCAPE CLOSES, and the listener is bound only while the modal is open —
     a keydown handler left on the document by a closed overlay is how one
     press ends up closing two things. */
  useEffect(() => {
    if (!isOpen) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    /* FOCUS MOVES IN. Without this the focus stays on whatever opened the
       modal, so the first Tab walks the page behind it. */
    const t = window.setTimeout(() => panel.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", on); window.clearTimeout(t); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    /* The scrim closes on a press, the panel stops it from bubbling. A modal
       DECIDES something, so this is the one overlay where a click-away is a
       cancel rather than a dismissal — the caller's onClose is what says which. */
    <div className="scrim" data-open="true" onMouseDown={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className="modal"
        style={{ width, maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="md-in">
          <div className="md-h">
            <div className="min-0">{title ? <h3>{title}</h3> : null}</div>
            <button type="button" className="md-x" aria-label="Close" onClick={onClose}>
              <svg className="ic sm" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="md-b">{children}</div>
        </div>
      </div>
    </div>
  );
}
