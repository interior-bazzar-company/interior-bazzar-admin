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

   IT POSITIONS ITSELF FIXED, MEASURED FROM ITS OWN BUTTON — and that is not a
   stacking preference, it is the only thing that works. An absolutely
   positioned popup is clipped by any ancestor with `overflow` set, and this
   menu's first use inside a table put it in `.dls-body`, which scrolls. No
   z-index reaches out of an overflow box: the menu was not behind anything,
   it was cut off by the scroll container. Fixed coordinates leave the
   container entirely.

   The cost of fixed is that it does not follow its button, so scroll and
   resize CLOSE it rather than letting it drift somewhere wrong. It also flips
   above the button when there is no room below, because a menu whose last two
   items are under the fold is a menu with two items.
   ============================================================================= */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./index";

/** One entry behind the More button. */
export interface MenuItem {
  icon: string; label: string; act: () => void;
  disabled?: boolean; title?: string; tone?: string;
}

export function MoreMenu({ items, small }: { items: MenuItem[]; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  const pop = useRef<HTMLSpanElement | null>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  /* Measured after layout and before paint, so the menu never renders once at
     the wrong place and then jumps. */
  const place = useCallback(() => {
    const b = box.current;
    const p = pop.current;
    if (!b || !p) return;
    const r = b.getBoundingClientRect();
    const h = p.offsetHeight || 0;
    const w = p.offsetWidth || 168;
    const gap = 4;
    /* Below by default; above when below would run off the viewport and above
       has more room. */
    const below = r.bottom + gap;
    const flip = below + h > window.innerHeight && r.top - gap - h > 0;
    setAt({
      top: flip ? r.top - gap - h : below,
      /* Right-aligned to the button, then pulled back inside the window — a
         menu half off the right edge is the other way this fails. */
      left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)),
    });
  }, []);

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
    /* Fixed coordinates cannot follow the button, so anything that moves it
       closes the menu instead of leaving it stranded beside nothing. `true`
       catches scrolls on inner containers, which is where this actually
       happens — the table body, not the window. */
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  return (
    <span className="ib-menu" ref={box}>
      <button type="button" className={"btn" + (small ? " sm" : "")} aria-haspopup="menu"
        aria-expanded={open} onClick={() => setOpen(!open)}>More</button>
      {open ? (
        <span ref={pop} className="ib-menu-pop" role="menu" aria-label="Actions"
          /* Hidden until measured rather than drawn at 0,0 for one frame. */
          style={at
            ? { top: at.top, left: at.left, right: "auto" }
            : { top: -9999, left: -9999, right: "auto" }}>
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
