/* =============================================================================
   ui/menu — the panel's one More menu.
   -----------------------------------------------------------------------------
   A record header's actions behind one plain text button. Finance grew this
   first (Frame.tsx) and every module's record pages take the same pattern
   now: id and status on the left, More and a primary Back on the right, and
   anything past two controls collapses in here rather than sitting as a row
   of buttons.

   Self-contained state rather than the shell popover, so a header can render
   it anywhere without wiring `openPop`; the rows are the theme's own `.mi`,
   the same item the shell's menus use, so the panel's menus cannot drift
   apart in look.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import { Icon } from "./index";

/** One entry behind the More button. */
export interface MenuItem {
  icon: string; label: string; act: () => void;
  disabled?: boolean; title?: string; tone?: string;
}

export function MoreMenu({ items, small }: { items: MenuItem[]; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  return (
    <span className="ib-menu" ref={box}>
      <button type="button" className={"btn" + (small ? " sm" : "")} aria-haspopup="menu"
        aria-expanded={open} onClick={() => setOpen(!open)}>More</button>
      {open ? (
        <span className="ib-menu-pop" role="menu" aria-label="Actions">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem"
              className={"mi" + (it.tone ? " " + it.tone : "")}
              disabled={it.disabled} title={it.title}
              onClick={() => { setOpen(false); it.act(); }}>
              <Icon name={it.icon} size="sm" />{it.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
