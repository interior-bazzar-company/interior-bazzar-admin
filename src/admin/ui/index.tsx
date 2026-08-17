/* =============================================================================
   Interior bazzar — Admin Access · shared UI
   -----------------------------------------------------------------------------
   A 1:1 port of the render helpers in the prototype's admin-shell.js (lines
   1–520). Every component emits the SAME class names, in the same order, with
   the same inline styles as the string builder it replaces — admin-theme.css is
   the only stylesheet and it is not touched by this layer. Nothing here invents
   a colour, a spacing, a radius or a word.

   Three conventions apply to the whole file:

   1. NAVIGATION. The prototype's `data-go="#/deals/IB-1"` was a delegated click.
      Here any component that rendered such an element takes a `to?: string`
      prop holding the identical hash string, still renders `data-go={to}` (so
      any attribute selector keeps matching), and calls `go(to)` from ./nav on
      click. ui/ therefore depends on no router.

   2. ALREADY-BUILT HTML. Where the prototype documented a parameter as markup
      the caller assembles — tile()'s `v`, field()'s `custom`, emptyState()'s
      `action`, notice()'s text, kvList()'s values, table()'s rows — the prop is
      a React.ReactNode and is rendered as children. That is the point of the
      port: no dangerouslySetInnerHTML, no string concatenation, no esc().
      esc() itself is gone; JSX escapes text for us.

   3. UNCONTROLLED INPUTS. The prototype re-rendered whole views as innerHTML,
      so every `value="…"` was an attribute, not state. The ports use
      defaultValue for the same reason: they read like the DOM the prototype
      produced. Pass a `key` if a view needs a field to reset.
   ============================================================================= */
import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { go } from "./nav";
import { fmtDate } from "./format";

export { BRAND_MARK, BrandLogo } from "./brand";

/* ================================================================ ICONS === */
/* The icon set IS these path strings — there is no icon library. They are kept
   as raw markup (rather than JSX elements) because the shell reads a path out
   of the map directly, and because one copy of the data is the only way to
   guarantee it stays character-for-character identical to the prototype.
   `Icon` is the sole consumer that injects it: a module-private constant with
   no interpolation and no caller input anywhere near it. */
export const ICONS: Record<string, string> = {
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  deal:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 12.5h18"/>',
  quote:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  invoice:'<path d="M5 3h14v18l-2.8-1.8L14 21l-2-1.8L10 21l-2.2-1.8L5 21z"/><path d="M9 8h6M9 12h6"/>',
  chart:'<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
  route:'<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.6 6H15a3 3 0 0 1 3 3v6.4"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16.5 5.2a3 3 0 0 1 0 5.6M18 19.6a5.4 5.4 0 0 0-2-4.2"/>',
  store:'<path d="M4 9.5h16V20H4z"/><path d="M3 9.5 4.6 4h14.8L21 9.5M9.5 20v-5.5h5V20"/>',
  tag:'<path d="M3 12.5V4h8.5L21 13.5 12.5 22z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  out:'<path d="M12 4v13M6.5 11.5 12 17l5.5-5.5M5 20h14"/>',
  recon:'<path d="M4 8.5h12l-3.2-3.2M20 15.5H8l3.2 3.2"/>',
  refund:'<path d="M4.2 12a7.8 7.8 0 1 1 2.6 5.8"/><path d="M3.6 7.6v4.6h4.6"/>',
  coin:'<ellipse cx="12" cy="6.4" rx="7.6" ry="3.1"/><path d="M4.4 6.4v11.2c0 1.7 3.4 3.1 7.6 3.1s7.6-1.4 7.6-3.1V6.4M4.4 12c0 1.7 3.4 3.1 7.6 3.1s7.6-1.4 7.6-3.1"/>',
  mega:'<path d="M4 9.5v5h3.6L15 19V5L7.6 9.5zM18.5 10a3 3 0 0 1 0 4"/>',
  doc:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9.5 13H16M9.5 17H14"/>',
  flag:'<path d="M5 21V4h13l-2.4 4L18 12H5"/>',
  life:'<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="3.4"/><path d="M5.9 5.9 9.6 9.6M14.4 14.4l3.7 3.7M18.1 5.9l-3.7 3.7M9.6 14.4l-3.7 3.7"/>',
  team:'<circle cx="11" cy="7.5" r="3.2"/><path d="M4.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17.5 5.2a2.8 2.8 0 0 1 0 5.2M19 19.4a5 5 0 0 0-1.6-3.6"/>',
  shield:'<path d="M12 3.2 19.6 6v6c0 4.7-3.2 7.6-7.6 8.6C7.6 19.6 4.4 16.7 4.4 12V6z"/><path d="m9.2 12 2.1 2.1L15 10.4"/>',
  history:'<path d="M3.6 12a8.4 8.4 0 1 0 2.5-6"/><path d="M3.2 4.2v4.2h4.2M12 8v4.4l3.2 1.9"/>',
  search:'<circle cx="11" cy="11" r="6.4"/><path d="m15.9 15.9 4.4 4.4"/>',
  bell:'<path d="M6.2 9.2a5.8 5.8 0 0 1 11.6 0c0 4.6 1.9 5.8 1.9 5.8H4.3s1.9-1.2 1.9-5.8z"/><path d="M10 18.6a2 2 0 0 0 4 0"/>',
  chev:'<path d="m6 9.5 6 6 6-6"/>',
  chevr:'<path d="m9.5 6 6 6-6 6"/>',
  chevl:'<path d="m14.5 6-6 6 6 6"/>',
  alert:'<path d="M12 3.4 21.2 20H2.8z"/><path d="M12 9.4v4.8M12 17.2h.01"/>',
  clock:'<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2v5.1l3.3 1.9"/>',
  lock:'<rect x="4.6" y="10" width="14.8" height="10" rx="2"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10"/>',
  unlock:'<rect x="4.6" y="10" width="14.8" height="10" rx="2"/><path d="M8 10V7.2A4 4 0 0 1 15.4 5"/>',
  arrow:'<path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5"/>',
  ext:'<path d="M14 4h6v6M20 4l-8.5 8.5M18 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  filter:'<path d="M4 5h16l-6.2 7.3V19l-3.6-2v-4.7z"/>',
  download:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  check:'<path d="m5 12.5 4.6 4.6L19 7.5"/>',
  dots:'<circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/>',
  inbox:'<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M4.6 5.5h14.8L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z"/>',
  sparkle:'<path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13 4.5 11l5.6-2z"/>',
  logout:'<path d="M9.5 20H5.5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5.5 4h4M15.5 15.5 20 12l-4.5-3.5M20 12H9.5"/>',
  user:'<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
  building:'<path d="M4 20V5.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 5.5V20M14 10h4.5A1.5 1.5 0 0 1 20 11.5V20M2.5 20h19M7 8h4M7 12h4M7 16h4M17 14h.01M17 17h.01"/>',
  link:'<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.5-1.5"/>',
  star:'<path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9z"/>',
  eye:'<path d="M2.4 12S6.2 5.6 12 5.6 21.6 12 21.6 12 17.8 18.4 12 18.4 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3.1"/>'
};

export function Icon({ name, size, className }: { name: string; size?: "sm" | "lg"; className?: string }) {
  const p = ICONS[name] || ICONS.doc;
  return (
    <svg
      className={"ic" + (size ? " " + size : "") + (className ? " " + className : "")}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: p }}
    />
  );
}

/* =============================================================== HELPERS === */
/* esc() is deliberately absent: JSX escapes text. */
export function initials(name?: string | null) {
  const p = String(name || "").trim().split(/\s+/);
  return ((p[0] || "")[0] || "").toUpperCase() + ((p[1] || "")[0] || "").toUpperCase();
}
export function avatarTone(name?: string | null) {
  let n = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i);
  return ["", "n1", "n2", "n3", "n4"][n % 5];
}
export function qs(obj: Record<string, string | number | null | undefined>) {
  const p: string[] = [];
  for (const k in obj) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") p.push(k + "=" + encodeURIComponent(String(obj[k])));
  return p.length ? "?" + p.join("&") : "";
}
export function cap(s?: string | null) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); }

/* Hand a link to the user in whatever way the browser actually supports: the
   OS share sheet where there is one (the user picks WhatsApp / mail / whatever
   themselves), the clipboard otherwise. Returns the line to toast, or null when
   there is nothing to say — the share sheet already spoke, and a cancelled
   sheet is a decision, not a failure.

   Both document blocks (quotations, invoices) go through this, so neither can
   drift back to printing a link into a toast that fades before it can be
   selected. The caller still renders the link on screen: a clipboard write can
   be refused by permissions policy and then the visible text is the only copy
   route left. */
export async function shareOrCopy(url: string, title: string): Promise<string | null> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return null;
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return null;
      // anything else (no handler registered, not allowed here) falls through
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "Link copied to the clipboard.";
  } catch {
    return "Could not copy automatically — select the link below.";
  }
}

/* The link itself, selectable for as long as it is wanted, with its own copy
   button. The share sheet is the fast path; this is the row that still works
   when there is no sheet and the clipboard was refused, and it is the reason a
   share link no longer has to be read off a fading toast.

   Feedback is local state rather than a toast so this stays usable from
   anywhere in the app — the shell's toast context imports THIS module. */
export function ShareLine({ link, expires, title }: { link: string; expires?: string; title: string }) {
  const [said, setSaid] = useState("");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
      {/* .inp so it is a themed control, not an OS-white box on a dark panel;
          it already carries a readonly state. */}
      <input className="inp mono" readOnly value={link} style={{ flex: "1 1 260px", minWidth: 0 }}
        onFocus={(e) => e.currentTarget.select()} />
      <button className="btn sm" onClick={async () => setSaid(await shareOrCopy(link, title) || "Shared.")}>
        <Icon name="doc" size="sm" />Copy
      </button>
      <span className="faint" style={{ fontSize: "var(--text-sm)" }}>
        {said ? said + " " : ""}{expires ? "Expires " + fmtDate(expires) : ""}
      </span>
    </div>
  );
}

/* The seeded audit log stores references inside its `text` as `<b>PAY-4503</b>`.
   The prototype wrote that string straight into the cell; innerHTML is banned
   here, so the one tag becomes a real element. Both readers of that log — the
   Audit page and the shell's Activity popover — go through this, so neither can
   drift into showing the raw tags. */
export function richText(s: string): ReactNode[] {
  return String(s)
    .split(/(<b>[\s\S]*?<\/b>)/g)
    .map((part, i) => (part.slice(0, 3) === "<b>" ? <b key={i}>{part.slice(3, -4)}</b> : part));
}

/* --- small render helpers every view shares ------------------------------ */
/* `text` is the prototype's first argument; `children` is the same slot spelt
   the way JSX callers reach for. Both render in the one place the text went. */
export function Pill({ text, tone, lg, title, dot, children }: {
  text?: ReactNode; tone?: string; lg?: boolean; title?: string; dot?: boolean; children?: ReactNode;
}) {
  return (
    <span className={"pill" + (tone ? " " + tone : "") + (lg ? " lg" : "")} title={title}>
      {dot ? <span className="dot"></span> : null}
      {text}{children}
    </span>
  );
}

export interface TileProps {
  k?: ReactNode;
  /* already-built markup in the prototype — a ReactNode here */
  v?: ReactNode;
  s?: ReactNode;
  icon?: string;
  tone?: string;
  on?: boolean;
  serif?: boolean;
  /* `data-go` hash; a tile without one is a <div>, not a <button> */
  to?: string;
}
export function Tile(o: TileProps) {
  const inner = (
    <>
      <div className="k">{o.icon ? <Icon name={o.icon} size="sm" /> : null}{o.k}</div>
      <div className={"v" + (o.serif ? " serif" : "")}>{o.v}</div>
      {o.s ? <div className="s">{o.s}</div> : null}
    </>
  );
  const cls = "tile" + (o.tone ? " " + o.tone : "") + (o.on ? " on" : "");
  return o.to
    ? <button className={cls} data-go={o.to} onClick={() => go(o.to as string)}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

export function Tiles({ list, cols }: { list: TileProps[]; cols?: number }) {
  return (
    <div className={"tiles" + (cols ? " c" + cols : "")}>
      {list.map((t, i) => <Tile key={i} {...t} />)}
    </div>
  );
}

/* One field renderer for the whole app. Deals, Quotation and Invoice each
   grew their own copy of this and had already drifted — Invoice's lacked
   placeholder text on both control types and a help tone, Quotation's had
   no readonly support, neither had `custom`. This is the union of all
   three, so nothing any module already relies on is lost by sharing it. */
export interface FieldProps {
  label?: ReactNode;
  id?: string;
  /* already-built markup in the prototype — a ReactNode here */
  custom?: ReactNode;
  help?: ReactNode;
  tone?: string;
  req?: boolean;
  type?: string;
  options?: { v: string; l: string; sel?: boolean }[];
  rows?: number;
  ph?: string;
  value?: string | number;
  ro?: boolean;
  readonly?: boolean;
}
export function Field(o: FieldProps) {
  const help = o.help ? <div className={"help" + (o.tone ? " " + o.tone : "")}>{o.help}</div> : null;
  if (o.custom)
    return <div className="fg"><span className="fg-lb">{o.label}</span>{o.custom}{help}</div>;
  const opts = o.options || [];
  return (
    <div className="fg">
      <label htmlFor={o.id}>{o.label}{o.req ? <> <span className="req">*</span></> : null}</label>
      {o.type === "select"
        ? <select className="inp" id={o.id} defaultValue={(opts.filter((x) => x.sel)[0] || { v: undefined }).v}>
            {opts.map((x, i) => <option key={i} value={x.v}>{x.l}</option>)}
          </select>
        : o.type === "textarea"
          ? <textarea className="inp" id={o.id} rows={o.rows} placeholder={o.ph || ""} defaultValue={o.value || ""} />
          : <input className="inp" id={o.id} type={o.type || "text"}
              defaultValue={o.value === 0 ? "0" : (o.value || "")}
              placeholder={o.ph || ""} readOnly={!!(o.ro || o.readonly)} />}
      {help}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: string;
  title?: ReactNode;
  body?: ReactNode;
  /* already-built markup in the prototype — a ReactNode here */
  action?: ReactNode;
}
export function EmptyState(o: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="g"><Icon name={o.icon || "inbox"} size="lg" /></div>
      <h3>{o.title}</h3><p>{o.body}</p>
      {o.action}
    </div>
  );
}

/* One pane waiting on its own record, while the page around it stays put.
   NOT the full-page AdminLoader: that one is for a screen with nothing on it
   yet, and using it for a record swap throws the whole layout away and brings
   it back — which reads as a reload of something the user did not reload. */
export function PaneLoading({ label }: { label?: ReactNode }) {
  return (
    <div className="pane-load" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label || "Loading…"}</span>
    </div>
  );
}

/* A LIST waiting on its first fetch. Every list screen in this panel is the
   same three bands — command row, attention strip, rows — so one skeleton
   covers all of them, and the layout the rows land in is already on screen
   before they arrive. Purely decorative: one `role="status"` for the screen
   reader, `aria-hidden` on the bars themselves. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  const bars = (n: number, w?: number) =>
    Array.from({ length: n }, (_, i) => (
      <span className="sk" key={i} aria-hidden="true" style={w ? { width: w } : undefined} />
    ));
  return (
    <div className="dls" role="status" aria-label="Loading">
      <div className="dls-cmd">
        {bars(2, 148)}
        <span className="spacer" />
        {bars(1, 132)}
      </div>
      <div className="dls-attn sk-attn">{bars(5)}</div>
      <div className="dls-body sk-rows">{bars(rows)}</div>
    </div>
  );
}

/* `text` was documented as already-built HTML in the prototype; here it is a
   ReactNode, and `children` is the same slot for callers who prefer JSX. */
export function Notice({ text, tone, ico, children }: { text?: ReactNode; tone?: string; ico?: string; children?: ReactNode }) {
  return (
    <div className={"notice" + (tone ? " " + tone : "")}>
      <Icon name={ico || "alert"} />
      <div>{text}{children}</div>
    </div>
  );
}

/* The prototype's `.tabs` row — the theme already carries the styling, only the
   component was missing. `n` is a count badge; a zero prints nothing rather than
   a "0" nobody needs to read. */
export function Tabs({ items, cur, onPick }: {
  items: { k: string; label: string; n?: number }[];
  cur: string;
  onPick: (k: string) => void;
}) {
  return (
    <div className="tabs">
      {items.map((t) => (
        <button key={t.k} className={t.k === cur ? "on" : ""} onClick={() => onPick(t.k)}>
          {t.label}{t.n ? <span className="n">{t.n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SectionHead({ title, desc, right }: { title?: ReactNode; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="sh">
      <h2>{title}</h2>
      {desc ? <span className="d">{desc}</span> : null}
      {right ? <span className="r">{right}</span> : null}
    </div>
  );
}

export function KvList({ pairs, cls }: { pairs: [ReactNode, ReactNode][]; cls?: string }) {
  return (
    <dl className={"kv " + (cls || "")}>
      {pairs.map((p, i) => (
        <Fragment key={i}>
          <dt>{p[0]}</dt>
          <dd>{p[1] === null || p[1] === undefined || p[1] === "" ? <span className="faint">—</span> : p[1]}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export interface TableProps {
  cols: { label?: ReactNode; cls?: string; w?: string }[];
  /* each row is a <tr> the caller builds — already-built markup in the prototype */
  rows: ReactNode[];
  empty?: EmptyStateProps;
  scroll?: boolean;
  min?: string;
}
export function Table(o: TableProps) {
  return (
    <div className={"tw" + (o.scroll ? " scroll" : "")}>
      <table className="tbl" style={o.min ? { minWidth: o.min } : undefined}>
        <thead>
          <tr>{o.cols.map((c, i) => <th key={i} className={c.cls || ""} style={c.w ? { width: c.w } : undefined}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {o.rows.length
            ? o.rows.map((r, i) => <Fragment key={i}>{r}</Fragment>)
            : <tr><td colSpan={o.cols.length} style={{ padding: 0 }}>
                <EmptyState {...(o.empty || { title: "Nothing here yet", body: "" })} />
              </td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* THE STAT STRIP — the list workspace's one band of numbers.
   Deals invented it, Quotations now renders from the same function, and the
   rule it encodes is worth stating once: every count is also the filter for
   itself. Clicking a cell IS the filter; clicking the one you are on clears
   it, so the strip is never a trap you have to leave via the chip row.

   A cell with no `to` is a READ-OUT — rendered quieter and not pressable,
   because a cell that highlights on hover and does nothing on click is worse
   than one that never invited the press. Money is always a read-out.

   Pass the string "sep" for a hairline. The trailing spacer packs the row
   left, so a strip of four cells and a strip of eight both start at the same
   x as the command row above them.                                          */
export interface StatCell {
  k?: ReactNode;
  v?: ReactNode;
  dot?: string;
  tone?: string;
  on?: boolean;
  title?: string;
  to?: string;
}
export function StatStrip({ cells }: { cells: (StatCell | "sep")[] }) {
  return (
    <div className="dls-attn">
      {cells.map((c, i) => {
        if (c === "sep") return <span key={i} className="dls-sep"></span>;
        const body = (
          <>
            {c.dot !== undefined ? <span className={"dls-cdot " + (c.dot || "")}></span> : null}
            <span className="v tnum">{c.v}</span><span className="k">{c.k}</span>
          </>
        );
        const cls = "dls-stat" + (c.tone ? " " + c.tone : "") + (c.on ? " on" : "");
        return c.to
          ? <button key={i} className={cls} data-go={c.to} title={c.title} onClick={() => go(c.to as string)}>{body}</button>
          : <div key={i} className={cls + " ro"} title={c.title}>{body}</div>;
      })}
      <span className="spacer"></span>
    </div>
  );
}

export function LinkChip({ refText, to, ico }: { refText?: ReactNode; to: string; ico?: string }) {
  return (
    <a className="pill line" data-go={to} onClick={() => go(to)}>
      <Icon name={ico || "link"} size="sm" />
      <span className="mono">{refText}</span>
    </a>
  );
}

export function Toolbar({ children }: { children?: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

export function SearchField({ ph, val, name, onFilter }: {
  ph?: string; val?: string; name?: string; onFilter?: (name: string, value: string) => void;
}) {
  return (
    <div className="field grow">
      <Icon name="search" />
      <input type="search" placeholder={ph} defaultValue={val || ""} data-filter={name || "q"} autoComplete="off"
        onChange={(e) => onFilter && onFilter(name || "q", e.target.value)} />
    </div>
  );
}

export function Select({ name, label, options, value, onFilter }: {
  name: string;
  label?: string;
  options: (string | { v: string; l: string })[];
  value?: string | number;
  onFilter?: (name: string, value: string) => void;
}) {
  const on = value !== undefined && value !== null && value !== "";
  return (
    <div className={"selectbox" + (on ? " on" : "")}>
      <select data-filter={name} defaultValue={String(value === undefined || value === null ? "" : value)}
        onChange={(e) => onFilter && onFilter(name, e.target.value)}>
        <option value="">{label}</option>
        {options.map((o, i) => {
          const v = typeof o === "string" ? o : o.v;
          const l = typeof o === "string" ? o : o.l;
          return <option key={i} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}

export function FilterChips({ params, labels, onUnfilter }: {
  params: Record<string, string | undefined>;
  labels?: Record<string, string>;
  onUnfilter?: (key: string) => void;
}) {
  const keys = Object.keys(params).filter((k) => params[k] && k !== "tab");
  if (!keys.length) return null;
  return (
    <div className="chiprow" style={{ margin: "-4px 0 14px" }}>
      {keys.map((k) => (
        <span key={k} className="chip on">
          {(labels && labels[k]) || k}: {params[k]}
          <button className="x" data-unfilter={k} aria-label="Remove filter"
            onClick={() => onUnfilter && onUnfilter(k)}><Icon name="x" size="sm" /></button>
        </span>
      ))}
      <button className="chip" data-unfilter="*" onClick={() => onUnfilter && onUnfilter("*")}>Clear all</button>
    </div>
  );
}

