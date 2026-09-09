/* =============================================================================
   Interior bazzar — Admin · shell services
   -----------------------------------------------------------------------------
   The four things the shell owns that are not layout: layers (drawer / modal
   / popover), the toast stack, the docked banner, and appearance. They take a
   ReactNode — a modal's contents are a component, not a string.

   THE OVERLAYS ARE REACT ARIA'S. A modal traps focus, restores it on close,
   locks the page behind it and answers Escape because the library does those
   things, once, for every dialog in the product — not because forty dialogs
   each remembered to. What this file decides is only the panel's rules on top:
   a drawer dismisses on click-away (it INSPECTS), a modal does not (it DECIDES
   — losing a half-typed form to a stray click is the whole complaint).
   ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog as AriaDialog, Modal as AriaModal, ModalOverlay as AriaModalOverlay, Popover as AriaPopover } from "react-aria-components";
import { cx } from "@/utils/cx";
import { Button, Icon, KvList, ModalShell, Notice } from "../ui";

/* ------------------------------------------------------------------ storage */
export const LS = {
  get<T>(k: string, f: T): T {
    try {
      const v = localStorage.getItem(k);
      return v === null ? f : (JSON.parse(v) as T);
    } catch {
      return f;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* quota or private mode — appearance is not worth throwing over */
    }
  },
};

/* =========================================================== APPEARANCE === */
/* ONE PREFERENCE, TWO PAINTS. `ib_admin_theme` is light, dark or system. The
   resolved answer is written twice on <html>: `data-theme` (the panel's
   attribute) and the `dark-mode` class (Untitled UI's contract — its token
   sheet keys on the class). Both are set together so no rule can disagree.

   "System" is a PREFERENCE, not a third theme. It is resolved here from
   prefers-color-scheme and RE-resolved when the OS flips. */
let systemWatch: (() => void) | null = null;
function applyTheme(v: string) {
  const r = document.documentElement;
  if (systemWatch) {
    systemWatch();
    systemWatch = null;
  }
  const paint = (dark: boolean) => {
    r.setAttribute("data-theme", dark ? "dark" : "light");
    r.classList.toggle("dark-mode", dark);
  };
  if (v === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    paint(mq.matches);
    r.setAttribute("data-theme-pref", "system");
    const on = (e: MediaQueryListEvent) => paint(e.matches);
    mq.addEventListener("change", on);
    systemWatch = () => mq.removeEventListener("change", on);
    return;
  }
  r.removeAttribute("data-theme-pref");
  paint(v === "dark");
}

/** The three things a person can choose. `system` resolves to one of the other
    two; it is not a third appearance and nothing in CSS knows about it. */
export const THEMES: { id: string; label: string; hint: string; ico: string }[] = [
  { id: "light", label: "Light", hint: "Ink on paper", ico: "sun" },
  { id: "dark", label: "Dark", hint: "Ink inverted", ico: "moon" },
  { id: "system", label: "System", hint: "Follow the operating system", ico: "monitor" },
];

export function setTheme(v: string) {
  applyTheme(v);
  LS.set("ib_admin_theme", v);
}

/* What the person CHOSE, not what is painted. */
export const currentTheme = () =>
  document.documentElement.getAttribute("data-theme-pref") === "system" ? "system" : document.documentElement.getAttribute("data-theme") || "dark";

/** What is actually on screen right now — "light" or "dark", never "system". */
export const resolvedTheme = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

/** Runs before first paint from main.tsx. */
export function bootAppearance() {
  const t = LS.get<string | null>("ib_admin_theme", null) || "dark";
  applyTheme(t);
  try {
    localStorage.removeItem("ib_admin_scheme");
    localStorage.removeItem("ib_admin_density");
  } catch {
    /* nothing to remove */
  }
}

/* ================================================================ TYPES === */
type LayerKind = "drawer" | "modal" | "cmdk";
type Layer = { kind: LayerKind; node: ReactNode; size?: string; onDismiss?: () => void } | null;
type Toast = { id: number; msg: ReactNode; tone?: string; leaving?: boolean };
type Banner = { msg: ReactNode; tone?: string } | null;
type PopOpts = { width?: number; align?: "left" | "right"; above?: boolean; cls?: string };
type Pop = { anchor: HTMLElement; node: ReactNode; opts: PopOpts } | null;

export type ShellServices = {
  /** `size` is one of sm · md · lg · xl. Omitted is `md`. */
  drawer: (node: ReactNode, onDismiss?: () => void, size?: string) => void;
  modal: (node: ReactNode, size?: string) => void;
  closeLayer: () => void;
  layerKind: LayerKind | null;
  openPop: (anchor: HTMLElement, node: ReactNode, opts?: PopOpts) => void;
  closePop: () => void;
  popAnchor: HTMLElement | null;
  toast: (msg: ReactNode, tone?: string) => void;
  banner: (msg: ReactNode, tone?: string) => void;
  bannerState: Banner;
  closeBanner: () => void;
  stub: (what: string, where?: string) => void;
  shortcuts: () => void;
};

const Ctx = createContext<ShellServices | null>(null);

export function useShell(): ShellServices {
  const v = useContext(Ctx);
  if (!v) throw new Error("useShell outside ShellProvider");
  return v;
}

const MODAL_W: Record<string, string> = { sm: "max-w-[26rem]", md: "max-w-[34rem]", lg: "max-w-3xl", xl: "max-w-5xl", full: "max-w-[96vw]" };
const DRAWER_W: Record<string, string> = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

/* =============================================================== PROVIDER === */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [layer, setLayer] = useState<Layer>(null);
  const [pop, setPop] = useState<Pop>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bannerState, setBannerState] = useState<Banner>(null);
  const toastN = useRef(0);
  const bannerTimer = useRef<number | null>(null);

  const closeLayer = useCallback(() => setLayer(null), []);
  const closePop = useCallback(() => setPop(null), []);

  /* Closing a DRAWER by hand has to drop the record id from the URL as well:
     the scrim and Escape used to null the layer while the URL went on naming a
     record that was no longer on screen. A drawer may hand in its own
     `onDismiss`; otherwise "up" is the first path segment and the query
     survives because it is the list's filters. Modals are left alone. */
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const dismiss = useCallback(() => {
    closeLayer();
    if (layer && layer.onDismiss) {
      layer.onDismiss();
      return;
    }
    const seg = pathname.split("/").filter(Boolean);
    if (seg.length > 1) navigate("/" + seg[0] + search, { replace: true });
  }, [closeLayer, layer, navigate, pathname, search]);

  const drawer = useCallback((node: ReactNode, onDismiss?: () => void, size?: string) => {
    setLayer({ kind: "drawer", node, onDismiss, size });
  }, []);
  const modal = useCallback((node: ReactNode, size?: string) => {
    setLayer({ kind: "modal", node, size });
  }, []);
  const openPop = useCallback((anchor: HTMLElement, node: ReactNode, opts?: PopOpts) => {
    setPop({ anchor, node, opts: opts || {} });
  }, []);

  const toast = useCallback((msg: ReactNode, tone?: string) => {
    const id = ++toastN.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  /* ok/info clear themselves; warn/bad do NOT — the entire reason this surface
     exists is so a real warning is still on screen when the user looks up. */
  const banner = useCallback((msg: ReactNode, tone?: string) => {
    if (bannerTimer.current) {
      clearTimeout(bannerTimer.current);
      bannerTimer.current = null;
    }
    if (!msg) {
      setBannerState(null);
      return;
    }
    setBannerState({ msg, tone });
    if (tone !== "warn" && tone !== "bad") bannerTimer.current = window.setTimeout(() => setBannerState(null), 6000);
  }, []);

  const stub = useCallback(
    (what: string, where?: string) => {
      modal(
        <ModalShell
          title={what}
          sub="Not built in this prototype."
          onClose={() => setLayer(null)}
          actions={
            <Button color="secondary" data-close="1" onClick={() => setLayer(null)}>
              Close
            </Button>
          }
        >
          <Notice tone="info">
            This action belongs to <b>{where || "its module"}</b> and is designed but not implemented here. The Admin Access build covers the shell, navigation, the user
            journey and every read surface — write paths land with each module’s own functional phase.
          </Notice>
        </ModalShell>,
        "sm",
      );
    },
    [modal],
  );

  const shortcuts = useCallback(() => {
    const rows: [string, string][] = [
      ["⌘ K  /  Ctrl K", "Open search"],
      ["G then O", "Overview"],
      ["G then D", "Deals"],
      ["G then S", "Subscriptions & Plans"],
      ["G then T", "Members"],
      ["[", "Collapse or expand the sidebar"],
      ["Esc", "Close the topmost layer"],
      ["?", "This list"],
    ];
    modal(
      <ModalShell
        title="Keyboard"
        sub="Everything here also works with the mouse."
        onClose={() => setLayer(null)}
        actions={
          <Button color="secondary" data-close="1" onClick={() => setLayer(null)}>
            Close
          </Button>
        }
      >
        <KvList
          pairs={rows.map((r) => [
            <kbd key={r[0]} className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-xs font-medium text-secondary ring-1 ring-secondary ring-inset">
              {r[0]}
            </kbd>,
            r[1],
          ])}
        />
      </ModalShell>,
      "sm",
    );
  }, [modal]);

  /* A popover is positioned against a rect that a resize no longer holds. */
  useEffect(() => {
    const onResize = () => setPop(null);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const value = useMemo<ShellServices>(
    () => ({
      drawer,
      modal,
      closeLayer,
      layerKind: layer ? layer.kind : null,
      openPop,
      closePop,
      popAnchor: pop ? pop.anchor : null,
      toast,
      banner,
      bannerState,
      closeBanner: () => setBannerState(null),
      stub,
      shortcuts,
    }),
    [drawer, modal, closeLayer, layer, openPop, closePop, pop, toast, banner, bannerState, stub, shortcuts],
  );

  return (
    <Ctx.Provider value={value}>
      {children}

      {/* ---------------------------------------------------------- the modal */}
      <AriaModalOverlay
        isOpen={!!layer && layer.kind === "modal"}
        onOpenChange={(open) => {
          if (!open) closeLayer();
        }}
        isDismissable={false}
        className={({ isEntering, isExiting }) =>
          cx(
            "fixed inset-0 z-50 flex min-h-dvh w-full items-end justify-center overflow-y-auto bg-overlay/60 px-3 pt-4 pb-[clamp(16px,8vh,64px)] outline-hidden backdrop-blur-[4px] sm:items-center sm:p-8",
            isEntering && "duration-200 ease-out animate-in fade-in",
            isExiting && "duration-150 ease-in animate-out fade-out",
          )
        }
      >
        <AriaModal
          className={({ isEntering, isExiting }) =>
            cx(
              "flex max-h-full w-full flex-col outline-hidden",
              MODAL_W[(layer && layer.size) || "md"] || MODAL_W.md,
              isEntering && "duration-200 ease-out animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-2",
              isExiting && "duration-150 ease-in animate-out fade-out zoom-out-[0.98]",
            )
          }
        >
          <AriaDialog aria-label="Dialog" className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col rounded-2xl bg-primary shadow-xl ring-1 ring-secondary_alt outline-hidden sheen">
            {layer && layer.kind === "modal" ? layer.node : null}
          </AriaDialog>
        </AriaModal>
      </AriaModalOverlay>

      {/* --------------------------------------------------------- the drawer */}
      <AriaModalOverlay
        isOpen={!!layer && layer.kind === "drawer"}
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
        isDismissable
        className={({ isEntering, isExiting }) =>
          cx(
            "fixed inset-0 z-50 flex min-h-dvh w-full items-stretch justify-end bg-overlay/50 outline-hidden sm:pl-10",
            isEntering && "duration-200 ease-out animate-in fade-in",
            isExiting && "duration-200 ease-in animate-out fade-out",
          )
        }
      >
        <AriaModal
          className={({ isEntering, isExiting }) =>
            cx(
              "h-full w-full outline-hidden",
              DRAWER_W[(layer && layer.size) || "md"] || DRAWER_W.md,
              isEntering && "duration-250 ease-out animate-in slide-in-from-right",
              isExiting && "duration-200 ease-in animate-out slide-out-to-right",
            )
          }
        >
          <AriaDialog aria-label="Details" className="flex h-full min-h-0 flex-col bg-primary shadow-xl ring-1 ring-secondary_alt outline-hidden">
            {layer && layer.kind === "drawer" ? layer.node : null}
          </AriaDialog>
        </AriaModal>
      </AriaModalOverlay>

      {/* -------------------------------------------------------- the popover */}
      {pop ? <PopBox pop={pop} onClose={closePop} /> : null}

      {/* ---------------------------------------------------------- toasts */}
      {createPortal(
        <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" id="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                "pointer-events-auto flex items-start gap-3 rounded-lg bg-toast px-3.5 py-3 text-sm text-toast shadow-lg ring-1 ring-white/10",
                "duration-200 ease-out animate-in fade-in slide-in-from-bottom-2",
              )}
            >
              <Icon
                name={t.tone === "bad" || t.tone === "warn" ? "alert" : "check"}
                size="sm"
                className={cx("mt-0.5 shrink-0", t.tone === "bad" ? "text-utility-red-500" : t.tone === "warn" ? "text-utility-yellow-500" : "text-utility-green-500")}
              />
              <span className="min-w-0 flex-1">{t.msg}</span>
              <button
                type="button"
                className="-m-1 flex cursor-pointer items-center justify-center rounded p-1 opacity-60 outline-focus-ring hover:opacity-100 focus-visible:outline-2"
                aria-label="Dismiss"
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
              >
                <Icon name="x" size="xs" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

/* A popover the shell positions against an anchor somebody handed it. React
   Aria places it, flips it when there is no room, closes it on outside press
   and Escape, and returns focus to the anchor. */
function PopBox({ pop, onClose }: { pop: NonNullable<Pop>; onClose: () => void }) {
  const triggerRef = useRef<HTMLElement>(pop.anchor);
  triggerRef.current = pop.anchor;
  const placement = pop.opts.above ? (pop.opts.align === "left" ? "top start" : "top end") : pop.opts.align === "left" ? "bottom start" : "bottom end";
  return (
    <AriaPopover
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      triggerRef={triggerRef}
      placement={placement}
      offset={6}
      className={({ isEntering, isExiting }) =>
        cx(
          "z-50 origin-(--trigger-anchor-point) rounded-xl bg-primary shadow-lg ring-1 ring-secondary_alt outline-hidden will-change-transform sheen",
          isEntering && "duration-150 ease-out animate-in fade-in placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
          isExiting && "duration-100 ease-in animate-out fade-out",
          pop.opts.cls,
        )
      }
      style={{ width: pop.opts.width ? Math.min(pop.opts.width, window.innerWidth - 16) : undefined }}
    >
      <AriaDialog aria-label="Menu" className="flex max-h-[min(70vh,36rem)] min-h-0 flex-col outline-hidden">
        {pop.node}
      </AriaDialog>
    </AriaPopover>
  );
}

/* The parts a popover's contents are built from — the head, the scrolling
   body, the foot. One drawing for the bell and the account menu. */
export function PopHead({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex items-center gap-2.5 border-b border-secondary px-4 py-3", className)}>{children}</div>;
}
export function PopBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("min-h-0 flex-1 overflow-y-auto", className)}>{children}</div>;
}
export function PopFoot({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex items-center gap-2 border-t border-secondary px-4 py-2.5 text-xs text-tertiary", className)}>{children}</div>;
}
