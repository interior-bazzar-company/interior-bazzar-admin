/* =============================================================================
   Interior bazzar — Admin · shell services
   -----------------------------------------------------------------------------
   The four things the prototype's shell owned that are not layout: layers
   (drawer / modal / popover), the toast stack, the docked banner, and
   appearance. Ported from admin-shell.js — same DOM, same class names, same
   lifecycles, same reasons.

   In the prototype every one of these took an HTML string. Here they take a
   ReactNode, which is the whole point of the port: a modal's contents are a
   component, not a string a module concatenated.
   ============================================================================= */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, Notice, KvList } from "../ui";

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
/* Two attributes on <html> drive the whole system. No class sweep, no reload:
   the ramps and the scales are re-read by every component at once.          */
export function setTheme(v: string) {
  const r = document.documentElement;
  if (v === "system") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", v);
  LS.set("ib_admin_theme", v === "system" ? null : v);
  if (v === "system") {
    try {
      localStorage.removeItem("ib_admin_theme");
    } catch {
      /* nothing to remove */
    }
  }
}
export function setDensity(v: string) {
  const r = document.documentElement;
  if (v === "comfortable") r.removeAttribute("data-density");
  else r.setAttribute("data-density", v);
  if (v === "comfortable") {
    try {
      localStorage.removeItem("ib_admin_density");
    } catch {
      /* nothing to remove */
    }
  } else LS.set("ib_admin_density", v);
}
export const currentTheme = () => document.documentElement.getAttribute("data-theme") || "system";
export const currentDensity = () =>
  document.documentElement.getAttribute("data-density") || "comfortable";

/** Runs before first paint from main.tsx, the way the prototype's inline
    <head> script did — so the panel never flashes the wrong theme. */
export function bootAppearance() {
  const r = document.documentElement;
  const t = LS.get<string | null>("ib_admin_theme", null);
  const d = LS.get<string | null>("ib_admin_density", null);
  r.setAttribute("data-theme", t ? t : "dark");
  if (d) r.setAttribute("data-density", d);
}

/* ================================================================ TYPES === */
type LayerKind = "drawer" | "modal" | "cmdk";
type Layer = { kind: LayerKind; node: ReactNode; size?: string } | null;
type Toast = { id: number; msg: ReactNode; tone?: string };
type Banner = { msg: ReactNode; tone?: string } | null;
type PopOpts = { width?: number; align?: "left" | "right"; above?: boolean; cls?: string };
type Pop = { anchor: HTMLElement; node: ReactNode; opts: PopOpts } | null;

export type ShellServices = {
  drawer: (node: ReactNode) => void;
  modal: (node: ReactNode, size?: string) => void;
  closeLayer: () => void;
  layerKind: LayerKind | null;
  openPop: (anchor: HTMLElement, node: ReactNode, opts?: PopOpts) => void;
  closePop: () => void;
  popAnchor: HTMLElement | null;
  toast: (msg: ReactNode, tone?: string) => void;
  banner: (msg: ReactNode, tone?: string) => void;
  /* The banner is DOCKED, not floating: the prototype makes it a sibling of the
     scroller inside the flex-column .content so it pins below the topbar with
     no positioning JS. So the state lives here and AdminShell renders it into
     that exact slot, rather than this provider portalling it somewhere else. */
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

/* =============================================================== PROVIDER === */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [layer, setLayer] = useState<Layer>(null);
  const [pop, setPop] = useState<Pop>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bannerState, setBannerState] = useState<Banner>(null);
  const toastN = useRef(0);
  const bannerTimer = useRef<number | null>(null);
  const lastFocus = useRef<Element | null>(null);

  const closeLayer = useCallback(() => {
    setLayer(null);
    const f = lastFocus.current as HTMLElement | null;
    if (f && f.focus) f.focus();
  }, []);

  const closePop = useCallback(() => setPop(null), []);

  const drawer = useCallback((node: ReactNode) => {
    lastFocus.current = document.activeElement;
    setLayer({ kind: "drawer", node });
  }, []);

  const modal = useCallback((node: ReactNode, size?: string) => {
    lastFocus.current = document.activeElement;
    setLayer({ kind: "modal", node, size });
  }, []);

  const openPop = useCallback((anchor: HTMLElement, node: ReactNode, opts?: PopOpts) => {
    setPop({ anchor, node, opts: opts || {} });
  }, []);

  const toast = useCallback((msg: ReactNode, tone?: string) => {
    const id = ++toastN.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  /* ok/info clear themselves, same idea as a toast just slower to read.
     warn/bad do NOT auto-clear — the entire reason this surface exists is so a
     real warning is still on screen when the user looks up from what they were
     doing, not gone in 3.2 seconds like the confirmation toasts. */
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
    if (tone !== "warn" && tone !== "bad")
      bannerTimer.current = window.setTimeout(() => setBannerState(null), 6000);
  }, []);

  const stub = useCallback(
    (what: string, where?: string) => {
      modal(
        <>
          <div className="md-h">
            <h3>{what}</h3>
            <p>Not built in this prototype.</p>
            <button className="md-x" data-close="1" aria-label="Close" onClick={() => setLayer(null)}>
              <Icon name="x" />
            </button>
          </div>
          <div className="md-b">
            <Notice tone="info">
              This action belongs to <b>{where || "its module"}</b> and is designed but not
              implemented here. The Admin Access build covers the shell, navigation, the user
              journey and every read surface — write paths land with each module’s own functional
              phase.
            </Notice>
          </div>
          <div className="md-f">
            <span className="spacer" />
            <button className="btn" data-close="1" onClick={() => setLayer(null)}>
              Close
            </button>
          </div>
        </>,
        "sm"
      );
    },
    [modal]
  );

  const shortcuts = useCallback(() => {
    const rows: [string, string][] = [
      ["⌘ K  /  Ctrl K", "Open search"],
      ["G then D", "Deals"],
      ["G then Q", "Quotations"],
      ["G then I", "Invoices"],
      ["G then S", "Subscriptions & Plans"],
      ["G then T", "Team"],
      ["G then Y", "Design system"],
      ["[", "Collapse or expand the sidebar"],
      ["Esc", "Close the topmost layer"],
      ["?", "This list"],
    ];
    modal(
      <>
        <div className="md-h">
          <h3>Keyboard</h3>
          <p>Everything here also works with the mouse.</p>
          <button className="md-x" data-close="1" aria-label="Close" onClick={() => setLayer(null)}>
            <Icon name="x" />
          </button>
        </div>
        <div className="md-b">
          {/* The prototype had to re-inject this markup after render because its
              kvList escaped the keys. JSX carries the element through directly. */}
          <KvList pairs={rows.map((r) => [<span className="kbd">{r[0]}</span>, r[1]])} />
        </div>
        <div className="md-f">
          <span className="spacer" />
          <button className="btn" data-close="1" onClick={() => setLayer(null)}>
            Close
          </button>
        </div>
      </>,
      "sm"
    );
  }, [modal]);

  /* Escape closes the topmost layer; resize drops the popover, which is
     positioned against a rect that no longer holds. */
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
    [
      drawer,
      modal,
      closeLayer,
      layer,
      openPop,
      closePop,
      pop,
      toast,
      banner,
      bannerState,
      stub,
      shortcuts,
    ]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {layer &&
        createPortal(
          <>
            {/* Only the drawer dismisses by clicking away. A modal is a
                commitment — losing a half-typed form to a stray click is the
                whole complaint. */}
            <div
              className="scrim"
              {...(layer.kind === "drawer" ? { "data-close": "1", onClick: closeLayer } : {})}
            />
            <LayerBox layer={layer} onClose={closeLayer} />
          </>,
          document.body
        )}
      {pop && <PopBox pop={pop} onClose={closePop} />}
      {createPortal(
        <div className="toasts" id="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div className={"toast" + (t.tone ? " " + t.tone : "")} key={t.id}>
              <Icon name={t.tone === "bad" ? "alert" : "check"} />
              <span>{t.msg}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </Ctx.Provider>
  );
}

function LayerBox({ layer, onClose }: { layer: NonNullable<Layer>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = el.querySelector("input,button,[tabindex]") as HTMLElement | null;
    if (f) window.setTimeout(() => f.focus(), 30);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const cls = layer.kind === "drawer" ? "drawer" : layer.kind === "cmdk" ? "cmdk" : "modal";
  return (
    <div ref={ref} className={cls + (layer.size ? " " + layer.size : "")} role="dialog" aria-modal="true">
      {layer.node}
    </div>
  );
}

function PopBox({ pop, onClose }: { pop: NonNullable<Pop>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = pop.anchor.getBoundingClientRect();
    const w = pop.opts.width || el.offsetWidth;
    const left = pop.opts.align === "left" ? r.left : r.right - w;
    /* Flip above the anchor when opening downward would run off the bottom.
       The account menu anchors to the very bottom of the sidebar, so it always
       opened past the fold — its own items were unreachable. */
    let top = pop.opts.above ? r.top - el.offsetHeight - 6 : r.bottom + 6;
    if (top + el.offsetHeight > window.innerHeight - 10)
      top = Math.max(10, r.top - el.offsetHeight - 6);
    setStyle({ left: Math.max(10, Math.min(left, window.innerWidth - w - 10)), top });
  }, [pop]);

  useEffect(() => {
    pop.anchor.classList.add("on");
    return () => pop.anchor.classList.remove("on");
  }, [pop.anchor]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".pop") && !t.closest("[data-act]")) onClose();
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={"pop" + (pop.opts.cls ? " " + pop.opts.cls : "")}
      style={{
        left: style ? style.left : -9999,
        top: style ? style.top : -9999,
        width: pop.opts.width ? pop.opts.width : undefined,
      }}
    >
      {pop.node}
    </div>,
    document.body
  );
}
