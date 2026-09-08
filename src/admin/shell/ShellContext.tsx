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
import { useLocation, useNavigate } from "react-router-dom";
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
/* ONE ATTRIBUTE ON <html> DRIVES THE WHOLE DESIGN SYSTEM: `data-theme`, and it
   is "light" or "dark" and never anything else. No class sweep, no reload, no
   context provider — the browser re-reads the custom properties in tokens.css
   and repaints, and every component in the panel is correct in both states at
   once.

   THERE IS NO SCHEME AND NO DENSITY. The panel used to carry three colour
   schemes and a compact spacing variant. Both are gone: a design system that
   ships six appearances is six design systems that have to be checked, and in
   practice five of them were never looked at again after the week they landed.
   Two themes are two things to keep honest, and `check:contrast` can hold
   both.

   "System" is a PREFERENCE, not a third theme. It is resolved here from
   prefers-color-scheme and RE-resolved when the OS flips, so the stylesheet
   needs exactly one dark block rather than a block plus a media query that can
   drift out of agreement with the attribute. */
let systemWatch: (() => void) | null = null;
function applyTheme(v: string) {
  const r = document.documentElement;
  if (systemWatch) { systemWatch(); systemWatch = null; }
  const paint = (dark: boolean) => r.setAttribute("data-theme", dark ? "dark" : "light");
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
export const THEMES: { id: string; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "Ink on paper" },
  { id: "dark", label: "Dark", hint: "Ink inverted" },
  { id: "system", label: "System", hint: "Follow the operating system" },
];

export function setTheme(v: string) {
  applyTheme(v);
  LS.set("ib_admin_theme", v);
}

/* What the person CHOSE, not what is painted: with "system" chosen the
   attribute says light or dark, and the switch has to show System. */
export const currentTheme = () =>
  document.documentElement.getAttribute("data-theme-pref") === "system"
    ? "system"
    : document.documentElement.getAttribute("data-theme") || "dark";

/** What is actually on screen right now — "light" or "dark", never "system".
    Charts and canvas drawings need the resolved answer, not the preference. */
export const resolvedTheme = () =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

/** Runs before first paint from main.tsx, the way the prototype's inline
    <head> script did — so the panel never flashes the wrong theme. */
export function bootAppearance() {
  const t = LS.get<string | null>("ib_admin_theme", null) || "dark";
  applyTheme(t);
  /* The retired appearance keys, cleared rather than ignored: a browser that
     stored `portal` or `compact` in an earlier build should not carry a dead
     preference around forever. index.html does the same thing before this
     runs; doing it in both places costs nothing and means neither entry point
     depends on the other having been reached. */
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
type Toast = { id: number; msg: ReactNode; tone?: string };
type Banner = { msg: ReactNode; tone?: string } | null;
type PopOpts = { width?: number; align?: "left" | "right"; above?: boolean; cls?: string };
type Pop = { anchor: HTMLElement; node: ReactNode; opts: PopOpts } | null;

export type ShellServices = {
  /** `size` is one of sm · md · lg · xl — see the drawer block in
   *  components.css. Omitted keeps the wide default every existing caller
   *  already renders into. */
  drawer: (node: ReactNode, onDismiss?: () => void, size?: string) => void;
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

  /* Closing a DRAWER by hand has to drop the record id from the URL as well.
     Every drawer's own X already does it (`closeLayer(); go("#/plans")`); the
     scrim and Escape only nulled the layer, so the URL went on naming a record
     that was no longer on screen — and clicking that same row then navigated
     nowhere, which is why the drawer would not re-open until you opened some
     other record first. Routes are only `/:route` and `/:route/:id`, so "up" is
     the first segment; the query survives because it is the list's filters.
     Modals are left alone: they open over Detail PAGES too, and Escape there
     must close the modal, not leave the record. */
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const dismiss = useCallback(() => {
    closeLayer();
    /* A DRAWER THAT NAMES ITS RECORD IN THE QUERY HAS TO SAY SO. The rule
       below reads the id out of the PATH, which is right for `/deals/D-1` and
       does nothing at all for `/work?item=W-K04` — there the layer went away
       and the URL went on naming a record that was no longer on screen, which
       is the same complaint this block was written to fix, one URL shape
       later. A drawer may now hand in the line that closes it, and its own X,
       the scrim and Escape then all do the same thing rather than three
       nearly-alike things. */
    if (layer && layer.onDismiss) { layer.onDismiss(); return; }
    const seg = pathname.split("/").filter(Boolean);
    if (seg.length > 1) navigate("/" + seg[0] + search, { replace: true });
  }, [closeLayer, layer, navigate, pathname, search]);

  /* `onDismiss` is optional and the callback stays dependency-free, so it is
     still the same stable identity an effect can depend on without re-running
     because of the layer it just opened. */
  const drawer = useCallback((node: ReactNode, onDismiss?: () => void, size?: string) => {
    lastFocus.current = document.activeElement;
    setLayer({ kind: "drawer", node, onDismiss, size });
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
      ["G then S", "Subscriptions & Plans"],
      ["G then T", "Members"],
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
              {...(layer.kind === "drawer" ? { "data-close": "1", onClick: dismiss } : {})}
            />
            <LayerBox layer={layer} onClose={layer.kind === "drawer" ? dismiss : closeLayer} />
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

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function LayerBox({ layer, onClose }: { layer: NonNullable<Layer>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* The first REAL control. `button` alone matched the close X in every
       header, so every dialog opened with focus on "close"; and a textarea
       with `autofocus` lost to the 30 ms timer. */
    const f = (el.querySelector("[autofocus]")
      || el.querySelector("input,select,textarea,button:not(.md-x),[tabindex]:not(.md-x)")) as HTMLElement | null;
    if (f) window.setTimeout(() => f.focus(), 30);
  }, []);
  /* THE PAGE BEHIND A LAYER DOES NOT SCROLL. Without this the wheel over a
     modal's scrim moves the table underneath it, so closing the dialog lands
     the reader somewhere they never navigated to. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* A component that handled Escape itself (a listbox, a popover) marks
         the event; the layer must not close on top of it. */
      if (e.key === "Escape" && !e.defaultPrevented) { onClose(); return; }
      /* FOCUS IS TRAPPED, and it is trapped here rather than in each of the
         forty dialogs that open one. Tab off the last control and the ring
         reappears on the first, instead of walking into the page behind the
         scrim where nothing can be seen and Escape no longer reads as "leave
         this dialog". */
      if (e.key !== "Tab" || e.defaultPrevented) return;
      const el = ref.current;
      if (!el) return;
      const items = Array.prototype.slice
        .call(el.querySelectorAll(FOCUSABLE))
        .filter((n) => (n as HTMLElement).offsetParent !== null) as HTMLElement[];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (!el.contains(at)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
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
