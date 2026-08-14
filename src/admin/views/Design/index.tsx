/* =============================================================================
   Admin Access · Design system
   -----------------------------------------------------------------------------
   Ported 1:1 from prototype/admin-panel/admin-access/assets/views-design.js.

   The style guide ships inside the product, reads live from the running CSS,
   and is one click from any screen. A design system in a separate repo is a
   design system nobody opens.

   Every swatch, size and component below is rendered by the same tokens and
   classes the modules use — src/styles/admin-theme.css, the one stylesheet the
   whole app already imports. Not one hex value is written here: a swatch reads
   the same custom property a component would. If this page looks right, the
   product looks right. Change the theme or density from the top of the page,
   or from the account menu, and watch it hold — no reload.
   ============================================================================= */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChainStrip, EmptyState, Icon, KvList, Notice, Pill, SearchField, SectionHead,
  Select, Table, Tiles, cap,
} from "../../ui";
import { useNav } from "../../shell/AdminShell";
import { currentDensity, currentTheme, setDensity, setTheme } from "../../shell/ShellContext";

/* Same order and the same names as IBDeals.TAG_TONES — the engine validates
   against that list, this one only draws it. */
const TAG_HUES: [string, string][] = [["", "No colour"], ["slate", "Slate"], ["red", "Red"],
  ["orange", "Orange"], ["amber", "Amber"], ["lime", "Lime"],
  ["green", "Green"], ["teal", "Teal"], ["cyan", "Cyan"],
  ["blue", "Blue"], ["violet", "Violet"], ["pink", "Pink"]];

const RAMPS: [string, string, string][] = [
  ["sand",   "Slate",  "the warm neutral everything sits on"],
  ["green",  "Teal",   "brand · #0c6b57 light · #12a594 dark"],
  ["amber",  "Amber",  "attention — something needs a human"],
  ["rust",   "Rust",   "stop — money lost, a promise broken"],
  ["indigo", "Indigo", "internal · provenance · not-customer-facing"],
];
const STEP_MEANING = ["app background", "subtle background", "component background", "component hover",
  "component active", "subtle border", "border · focus ring", "strong border", "SOLID fill",
  "solid hover", "low-contrast text", "high-contrast text"];

const TYPE: [string, string, ReactNode][] = [
  ["4xl", "36", "the greeting, and nothing else"],
  ["3xl", "28", "page titles · hero figures"],
  ["2xl", "22", "record titles · stat values"],
  ["xl",  "18", "section titles"],
  ["lg",  "16", "card titles · drawer headings"],
  ["base", "14", "body · table cells · form inputs"],
  ["md",  "13", "dense UI — nav, chips, toolbar, buttons"],
  ["sm",  "12", "captions · secondary cell lines"],
  ["xs",  "11", "badges · table headers · meta"],
  ["2xs", "10", "uppercase micro-labels only"],
];
const SPACE: [string, string][] = [["1", "4"], ["2", "8"], ["3", "12"], ["4", "16"], ["5", "20"],
  ["6", "24"], ["8", "32"], ["10", "40"], ["12", "48"], ["16", "64"]];
const CONTROLS: [string, string][] = [["xs", "22"], ["sm", "26"], ["md", "32"], ["lg", "38"], ["xl", "44"]];
const RADII: [string, string][] = [["xs", "3"], ["sm", "4"], ["md", "6"], ["lg", "8"], ["xl", "12"],
  ["2xl", "16"], ["full", "999"]];
const SHADOWS = ["xs", "sm", "md", "lg", "xl"];
const ICONS = ["home", "deal", "quote", "invoice", "chart", "route", "users", "store", "tag", "cash", "out",
  "recon", "refund", "coin", "mega", "doc", "flag", "life", "team", "shield", "history", "search", "bell",
  "alert", "clock", "lock", "arrow", "ext", "plus", "check", "download", "filter", "star", "link", "building"];

const TABS: [string, string][] = [["foundations", "Foundations"], ["components", "Components"],
  ["patterns", "Patterns"], ["rules", "Rules"]];

export default function Design() {
  const [sp] = useSearchParams();
  const { go } = useNav();
  const tab = sp.get("tab") || "foundations";

  return (
    <div className="page wide">
      <div className="ph">
        <div className="ph-t">
          <h1>Design system</h1>
          <div className="scope">
            Three layers · ten type sizes · five control heights · two themes · two densities
          </div>
        </div>
        <div className="acts"><ModeControls /></div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t[0]} className={tab === t[0] ? "on" : ""} data-go={"#/design?tab=" + t[0]}
            onClick={() => go("#/design?tab=" + t[0])}>{t[1]}</button>
        ))}
      </div>

      {tab === "components" ? <Components /> :
       tab === "patterns"   ? <Patterns /> :
       tab === "rules"      ? <Rules /> : <Foundations />}

      <RespStyle />
    </div>
  );
}

/* --------------------------------------------------------------- modes --- */
/* The two attributes on <html> are the whole mechanism; the only local state is
   which button reads "on", which is why this re-renders itself after a change
   rather than the tokens being re-read by hand. */
function ModeControls() {
  const [, force] = useState(0);
  const theme = currentTheme();
  const dens = currentDensity();
  return (
    <>
      <div className="btn-group">
        {["system", "light", "dark"].map((t) => (
          <button key={t} className={theme === t ? "on" : ""} data-act="theme" data-v={t}
            onClick={() => { setTheme(t); force((n) => n + 1); }}>{cap(t)}</button>
        ))}
      </div>
      <div className="btn-group">
        {([["comfortable", "Comfortable"], ["compact", "Compact"]] as [string, string][]).map((d) => (
          <button key={d[0]} className={dens === d[0] ? "on" : ""} data-act="density" data-v={d[0]}
            onClick={() => { setDensity(d[0]); force((n) => n + 1); }}>{d[1]}</button>
        ))}
      </div>
    </>
  );
}

/* --------------------------------------------------------- FOUNDATIONS --- */
const rampGrid: CSSProperties = { display: "grid", gridTemplateColumns: "96px repeat(12,1fr)", gap: "4px" };

function Foundations() {
  return (
    <>
      <Notice tone="info" ico="shield" text={
        <>
          <b>Three layers, in order — never skip one.</b>{" "}
          <span className="mono">1 primitives</span> are the raw ramps and scales.{" "}
          <span className="mono">2 semantic</span> is what a thing <i>means</i> —{" "}
          <span className="mono">--surface</span>, <span className="mono">--text-2</span>,{" "}
          <span className="mono">--ok</span> — and it is what you write in a component.{" "}
          <span className="mono">3 component</span> is the classes. Change a ramp at layer 1 and the
          whole product moves, in both themes, at both densities.
        </>
      } />

      {/* ---- colour ---- */}
      <SectionHead title="Colour" desc={"five ramps × twelve steps · the same step means the same thing in every ramp · plus one flat palette for tags, below"} />
      <div className="card">
        <div className="card-b" style={{ overflowX: "auto" }}>
          <div style={{ minWidth: "760px" }}>
            <div style={{ ...rampGrid, marginBottom: "var(--space-2)" }}>
              <span></span>
              {STEP_MEANING.map((m, i) => (
                <span key={i} className="faint" style={{ fontSize: "var(--text-2xs)", textAlign: "center" }} title={m}>
                  {i + 1}
                </span>
              ))}
            </div>
            {RAMPS.map((r) => (
              <div key={r[0]} style={{ ...rampGrid, marginBottom: "6px", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>{r[1]}</div>
                  <div className="faint" style={{ fontSize: "var(--text-2xs)", lineHeight: 1.3 }}>{r[2]}</div>
                </div>
                {STEP_MEANING.map((_, i) => (
                  <div key={i} title={"--" + r[0] + "-" + (i + 1) + " · " + STEP_MEANING[i]}
                    style={{ height: "34px", borderRadius: "var(--radius-sm)",
                      background: "var(--" + r[0] + "-" + (i + 1) + ")", border: "1px solid var(--line)" }} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="card-f" style={{ display: "block", lineHeight: 1.55 }}>
          <b>Steps 11 and 12 are the only ones you put text on.</b> Steps 1–5 are backgrounds, 6–8 are
          borders, 9–10 are solid fills that carry white text. Follow that and contrast takes care of
          itself — in both themes.
        </div>
      </div>

      {/* ---- semantic ---- */}
      <SectionHead title="Semantic tokens" desc="what you actually write in a component" />
      <div className="two" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "var(--space-4)" }}>
        <TokenCard title="Surfaces & text" rows={[
          ["--bg", "the content plane — the only white"],
          ["--bg-shell", "chrome around the content"],
          ["--bg-inset", "wells: inputs at rest, code, sub-headers"],
          ["--bg-hover", "hover fill — never a border change"],
          ["--bg-active", "pressed · selected nav"],
          ["--text", "primary"], ["--text-2", "secondary"], ["--text-3", "tertiary — icons, placeholders"],
          ["--line", "hairline"], ["--line-2", "control border"], ["--line-3", "hover border"],
        ]} />
        <TokenCard title="Status — four slots each" rows={[
          ["--ok / --ok-bg / --ok-line / --ok-solid", "settled · verified · converted"],
          ["--warn / --warn-bg / --warn-line / --warn-solid", "needs a human"],
          ["--bad / --bad-bg / --bad-line / --bad-solid", "overdue · blocked · reversed"],
          ["--info / --info-bg / --info-line / --info-solid", "internal · provenance"],
          ["--brand / --brand-text / --brand-tint", "the single accent"],
        ]} />
      </div>
      <div style={{ height: "var(--space-3)" }} />
      <div className="chiprow">
        {([["ok", "Settled"], ["warn", "Needs a human"], ["bad", "Overdue"], ["info", "Internal"],
           ["brand", "Selected"]] as [string, string][]).map((t) => <Pill key={t[0]} text={t[1]} tone={t[0]} />)}
      </div>

      {/* ---- the one exception to colour-means-status ---- */}
      <SectionHead title="The tag palette"
        desc={"eleven hues that mean nothing — the only colour in this product that is not a state"} />
      <div className="card">
        <div className="card-b">
          <div className="chiprow" style={{ gap: "6px" }}>
            {TAG_HUES.map((h) => (
              <span key={h[1]} className={"pill" + (h[0] ? " tag-" + h[0] : "")}>{h[1]}</span>
            ))}
          </div>
          <div style={{ height: "var(--space-3)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(132px,1fr))", gap: "var(--space-2)" }}>
            {TAG_HUES.filter((h) => h[0]).map((h) => (
              <div key={h[0]} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)",
                padding: "5px 7px", border: "1px solid var(--tag-" + h[0] + "-line)",
                borderRadius: "var(--radius-md)", background: "var(--tag-" + h[0] + "-bg)" }}>
                <span style={{ width: "12px", height: "12px", flex: "0 0 12px",
                  borderRadius: "var(--radius-full)", background: "var(--tag-" + h[0] + ")" }} />
                <code className="mono trunc" style={{ fontSize: "var(--text-2xs)", color: "var(--tag-" + h[0] + ")" }}>
                  {"--tag-" + h[0]}
                </code>
              </div>
            ))}
          </div>
        </div>
        {/* The prototype never closes this card (views-design.js line 186 is one
            `</div>` short), so in the browser every section below it renders
            INSIDE the card. JSX cannot express that, and it is plainly a typo
            rather than a decision — the Colour block two sections up closes the
            identical structure correctly. Closed here. */}
        <div className="card-f" style={{ display: "block", lineHeight: 1.55 }}>
          <b>A tag colour is a label the team chose, not a verdict.</b> That is why it has its own
          palette instead of borrowing the status one {"—"} a green tag used to render through{" "}
          <span className="mono">--ok</span>, which says <i>success</i> about something that was never
          a success, and a grey one came out struck through because <span className="mono">.pill.dead</span>{" "}
          means cancelled. Three slots each, not twelve, because a pill is all any of them will ever
          draw. Every pair clears AA on its own background: worst case <b>5.60:1</b> light,{" "}
          <b>5.61:1</b> dark. <b>Nothing outside a tag may use these.</b>
        </div>
      </div>

      {/* ---- type ---- */}
      <SectionHead title="Type" desc="ten sizes, each named by its job — never pick a size, pick a role" />
      <div className="card">
        {TYPE.map((t, i) => (
          <div key={t[0]} style={{ display: "flex", alignItems: "baseline", gap: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)", ...(i ? { borderTop: "1px solid var(--line)" } : null) }}>
            <code className="mono" style={{ flex: "0 0 96px", fontSize: "var(--text-sm)", color: "var(--brand-text)" }}>
              {"--text-" + t[0]}
            </code>
            <span className="faint tnum" style={{ flex: "0 0 34px", fontSize: "var(--text-sm)" }}>{t[1]}px</span>
            <span className="trunc" style={{ flex: 1, minWidth: 0, fontSize: "var(--text-" + t[0] + ")", lineHeight: 1.2 }}>
              Interior bazzar Admin
            </span>
            <span className="faint" style={{ fontSize: "var(--text-sm)", textAlign: "right", flex: "0 0 auto" }}>{t[2]}</span>
          </div>
        ))}
      </div>
      <div style={{ height: "var(--space-3)" }} />
      <div className="three" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "var(--space-3)" }}>
        <FaceCard name="DM Sans" token="--font" use="Interface. Everything, unless there is a reason."
          style={{ fontFamily: "var(--font)" }} />
        <FaceCard name="DM Serif Display" token="--font-display"
          use={<>Figures that <i>are</i> the screen. Used sparingly on purpose.</>}
          style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }} />
        <FaceCard name="DM Mono" token="--font-mono" use="References, UTRs, code, timestamps."
          style={{ fontFamily: "var(--font-mono)" }} />
      </div>

      {/* ---- scales ---- */}
      <SectionHead title="Space" desc="×4 — the most widely understood scale there is" />
      <div className="card"><div className="card-b">
        {SPACE.map((s) => (
          <div key={s[0]} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "5px 0" }}>
            <code className="mono" style={{ flex: "0 0 92px", fontSize: "var(--text-sm)", color: "var(--brand-text)" }}>
              {"--space-" + s[0]}
            </code>
            <span className="faint tnum" style={{ flex: "0 0 40px", fontSize: "var(--text-sm)" }}>{s[1]}px</span>
            <span style={{ height: "14px", width: s[1] + "px", background: "var(--brand-tint-2)", borderRadius: "2px" }} />
          </div>
        ))}
      </div></div>

      <SectionHead title="Control height" desc="the single biggest consistency lever — every button, input, select and chip" />
      <div className="card"><div className="card-b">
        <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap" }}>
          {CONTROLS.map((c) => (
            <div key={c[0]}>
              <button className={"btn " + (c[0] === "md" ? "" : c[0])}>{cap(c[0])}</button>
              <div className="faint mono" style={{ fontSize: "var(--text-2xs)", marginTop: "6px" }}>
                {"--control-" + c[0] + " · " + c[1] + "px"}
              </div>
            </div>
          ))}
        </div>
        <Notice ico="alert" text={
          <>
            <b>md (32px) is the default and covers ~90% of the product.</b> sm for controls inside a row
            or a card header, lg for a form input, xl for the one primary action on an auth screen. If
            you reach for a height that is not on this list, the component is wrong.
          </>
        } />
      </div></div>

      <div className="two" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))",
        gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
        <div className="card">
          <div className="card-h"><h3>Radius</h3></div>
          <div className="card-b">
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {RADII.map((r) => (
                <div key={r[0]} style={{ textAlign: "center" }}>
                  <div style={{ width: "52px", height: "52px", background: "var(--bg-inset)",
                    border: "1px solid var(--line-2)", borderRadius: "var(--radius-" + r[0] + ")" }} />
                  <div className="faint mono" style={{ fontSize: "var(--text-2xs)", marginTop: "6px" }}>{r[0]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Elevation</h3><span className="d">ambient + direct, never one hard drop</span></div>
          <div className="card-b">
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
              {SHADOWS.map((s) => (
                <div key={s} style={{ textAlign: "center" }}>
                  <div style={{ width: "56px", height: "56px", background: "var(--surface-raised)",
                    borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-" + s + ")" }} />
                  <div className="faint mono" style={{ fontSize: "var(--text-2xs)", marginTop: "8px" }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionHead title="Icons" desc="one stroke weight (1.7), five sizes, monochrome — they inherit currentColor" />
      <div className="card"><div className="card-b">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: "var(--space-2)" }}>
          {ICONS.map((n) => (
            <div key={n} title={n} style={{ display: "flex", flexDirection: "column", alignItems: "center",
              gap: "6px", padding: "var(--space-2)", borderRadius: "var(--radius-md)", color: "var(--text-2)" }}>
              <Icon name={n} size="lg" />
              <span className="faint mono" style={{ fontSize: "var(--text-2xs)" }}>{n}</span>
            </div>
          ))}
        </div>
      </div></div>
    </>
  );
}

function TokenCard({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <div className="card">
      <div className="card-h"><h3>{title}</h3></div>
      <div className="card-b">
        {rows.map((r, i) => {
          const first = r[0].split(" ")[0];
          return (
            <div key={r[0]} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "6px 0", ...(i ? { borderTop: "1px solid var(--line)" } : null) }}>
              <span style={{ width: "20px", height: "20px", flex: "0 0 20px", borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line-2)", background: "var(" + first + ")" }} />
              <code className="mono trunc" style={{ fontSize: "var(--text-sm)", color: "var(--brand-text)", flex: "0 0 auto" }}>
                {r[0]}
              </code>
              <span className="faint trunc" style={{ fontSize: "var(--text-sm)", marginLeft: "auto", textAlign: "right" }}>
                {r[1]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FaceCard({ name, token, use, style }: { name: string; token: string; use: ReactNode; style: CSSProperties }) {
  return (
    <div className="card"><div className="card-b">
      <div style={{ ...style, fontSize: "var(--text-2xl)", lineHeight: 1.2 }}>Aa ₹1,24,800</div>
      <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>{name}</div>
      <code className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--brand-text)" }}>{token}</code>
      <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "4px", lineHeight: 1.45 }}>{use}</div>
    </div></div>
  );
}

/* ---------------------------------------------------------- COMPONENTS --- */
function Components() {
  return (
    <>
      <Demo title="Button" cls=".btn" note="One class. Five sizes × five intents. Exactly one primary per surface.">
        <div className="chiprow">
          <button className="btn pri">Primary</button><button className="btn">Default</button>
          <button className="btn ghost">Ghost</button><button className="btn ok">Affirm</button>
          <button className="btn dgr">Destructive</button><button className="btn" disabled>Disabled</button>
          <button className="btn pri"><Icon name="plus" />With icon</button>
          <button className="btn icon" aria-label="More"><Icon name="dots" /></button>
          <span className="btn-group"><button className="on">Table</button><button>Board</button></span>
        </div>
      </Demo>

      <Demo title="Status pill" cls=".pill" note="State of a record. Not a filter, not a label — a state.">
        <div className="chiprow">
          <Pill text="Verified" tone="ok" /><Pill text="Submitted" tone="warn" /><Pill text="Overdue" tone="bad" />
          <Pill text="Internal" tone="info" /><Pill text="Selected" tone="brand" /><Pill text="Draft" tone="line" />
          <Pill text="Cancelled" tone="dead" /><Pill text="Live" tone="ok" dot />
          <span className="pill xs">xs 18px</span><span className="pill lg line">lg 26px</span>
        </div>
      </Demo>

      <Demo title="Chip" cls=".chip" note="A filter, a tag, a dismissible choice. Rounded, so it never reads as a button.">
        <div className="chiprow">
          <span className="chip on">Stage: Followup<button className="x"><Icon name="x" className="xs" /></button></span>
          <span className="chip">Owner</span><span className="chip">City</span>
          <button className="chip">Clear all</button>
        </div>
      </Demo>

      <Demo title="Stat tile" cls=".tile" note="Four slots: label, value, sub, intent. Clicking one filters the list below it.">
        <Tiles cols={4} list={[
          { k: "Invoiced", v: "₹14,56,500", s: "issued, non-cancelled", icon: "invoice", serif: true },
          { k: "Received", v: "₹4,24,800", s: "from the ledger", tone: "ok", icon: "check", serif: true },
          { k: "Overdue", v: "₹3,24,500", s: "needs work", tone: "bad", icon: "alert", serif: true },
          { k: "Selected", v: "12", s: "click to filter", on: true, icon: "filter" },
        ]} />
      </Demo>

      <Demo title="Form controls" cls=".field · .inp · .selectbox" note="All one height, from --control-md / --control-lg.">
        <div className="toolbar">
          <SearchField ph="Search…" val="" />
          <Select name="x" label="Status" options={["Draft", "Issued", "Accepted"]} value="" />
          <Select name="y" label="Owner" options={["R. Menon"]} value="R. Menon" />
          <button className="btn"><Icon name="filter" />More filters</button>
        </div>
        <div className="f2" style={{ marginTop: "var(--space-3)" }}>
          <div className="fg">
            <label>Amount <span className="req">*</span></label>
            <input className="inp" defaultValue="₹2,47,800" />
            <div className="help">Capped at the invoice amount.</div>
          </div>
          <div className="fg">
            <label>Reference</label>
            <input className="inp bad" defaultValue="—" />
            <div className="help bad">Mandatory. Without it this row cannot be reconciled.</div>
          </div>
        </div>
        <label className="check">
          <input type="checkbox" defaultChecked /><span>Locked actions are absent, not disabled</span>
        </label>
      </Demo>

      <Demo title="Table" cls=".tw · .tbl" note="Sticky header. Numbers right-aligned and tabular. Two-line cells are the norm.">
        <Table
          cols={[{ label: "", w: "26px" }, { label: "Invoice" }, { label: "Amount", cls: "n" },
                 { label: "Due" }, { label: "Payment" }]}
          rows={[
            <Row dot="ok"   refText="IB-INV-2026-00088" who="Sandeep Kulkarni" amt="₹2,47,800" due="29 Jun 2026" st="Paid" tone="ok" />,
            <Row dot="bad"  refText="IB-INV-2026-00090" who="Imran Qureshi"    amt="₹1,78,500" due="22 Jun 2026" st="Overdue" tone="bad" />,
            <Row dot="warn" refText="IB-INV-2026-00092" who="Ananya Ghosh"     amt="₹70,000"   due="08 Jul 2026" st="Unpaid" tone="warn" />,
          ]}
        />
      </Demo>

      <Demo title="Notice" cls=".notice" note="An inline statement of a rule or a consequence. Four intents.">
        <Notice ico="alert" text="Neutral — context the reader may not have." />
        <div style={{ height: "var(--space-2)" }} />
        <Notice tone="ok" ico="check" text={<><b>Passed.</b> The subscription was never activated.</>} />
        <div style={{ height: "var(--space-2)" }} />
        <Notice tone="warn" ico="clock" text={<><b>Needs a decision.</b> ₹2,12,400 is waiting on a human.</>} />
        <div style={{ height: "var(--space-2)" }} />
        <Notice tone="bad" ico="lock" text={<><b>There is no “Close anyway”.</b> A period with a non-zero variance cannot be closed.</>} />
      </Demo>

      <Demo title="Queue row" cls=".q" note="The dashboard's spine — icon, what, why, count, and a link into the exact filtered view.">
        <div className="card">
          <button className="q bad">
            <span className="qi"><Icon name="invoice" /></span>
            <span className="qt"><b>Invoices overdue</b><span>₹3,24,500 issued, unpaid and past due</span></span>
            <span className="qn">2</span><span className="qg"><Icon name="chevr" /></span>
          </button>
          <button className="q warn">
            <span className="qi"><Icon name="cash" /></span>
            <span className="qt"><b>Payments to verify</b><span>₹2,12,400 needs a decision</span></span>
            <span className="qn">2</span><span className="qg"><Icon name="chevr" /></span>
          </button>
        </div>
      </Demo>

      <Demo title="Empty & loading" cls=".empty · .sk" note="Two distinct empties: a state of the world, and a mistake just made.">
        <div className="two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div className="card">
            <EmptyState icon="quote" title="No quotations yet"
              body={<>Quotations are created from a deal. Open one and use <b>Create quote</b>.</>}
              action={<button className="btn pri">Create quotation</button>} />
          </div>
          <div className="card"><div className="card-b">
            {[70, 52, 84, 44].map((w) => (
              <div key={w} style={{ display: "flex", gap: "var(--space-3)", padding: "var(--space-2) 0" }}>
                <div className="sk" style={{ width: w + "%" }} />
                <div className="sk" style={{ width: "60px", marginLeft: "auto" }} />
              </div>
            ))}
          </div></div>
        </div>
      </Demo>

      <Demo title="Avatar · progress · keyboard" cls=".av · .bar · .kbd" note="">
        <div className="chiprow" style={{ gap: "var(--space-4)" }}>
          <span className="av lg n4">VS</span><span className="av n1">RM</span>
          <span className="av sm n3">KI</span><span className="av sm n2">AR</span>
          <span className="bar" style={{ width: "180px" }}>
            <i className="ok" style={{ width: "29%" }} />
            <i className="bad" style={{ width: "22%" }} />
            <i className="warn" style={{ width: "49%" }} />
          </span>
          <span className="kbd">⌘K</span><span className="kbd">esc</span><span className="kbd">G</span>
        </div>
      </Demo>
    </>
  );
}

function Row({ dot, refText, who, amt, due, st, tone }: {
  dot: string; refText: string; who: string; amt: string; due: string; st: string; tone: string;
}) {
  return (
    <tr className="clickable">
      <td className="tight"><span className={"dot " + dot} /></td>
      <td><div className="cell-1 mono">{refText}</div><div className="cell-2">{who}</div></td>
      <td className="n">{amt}</td><td>{due}</td><td><Pill text={st} tone={tone} /></td>
    </tr>
  );
}

function Demo({ title, cls, note, children }: { title: string; cls: string; note: ReactNode; children: ReactNode }) {
  return (
    <>
      <SectionHead title={title} desc={<code className="mono" style={{ color: "var(--brand-text)" }}>{cls}</code>} />
      {note ? (
        <p className="faint" style={{ fontSize: "var(--text-md)", margin: "-4px 0 var(--space-3)", maxWidth: "74ch" }}>
          {note}
        </p>
      ) : null}
      <div className="card"><div className="card-b">{children}</div></div>
    </>
  );
}

/* ------------------------------------------------------------ PATTERNS --- */
function Patterns() {
  return (
    <>
      <Notice tone="info" ico="sparkle" text={
        <>A component is a thing. A <b>pattern</b> is a decision about when to use which thing. These
        four are the ones that decide whether twenty screens read as one product.</>
      } />

      <SectionHead title="The page frame" desc="every module landing page, identically" />
      <div className="card"><div className="card-b">
        <Frame rows={[
          ["1 · Breadcrumb", "Group › Module › Record. Only below the module root — a breadcrumb to nowhere is noise."],
          ["2 · Title + actions", <>At most one primary. Role-gated actions are <b>absent</b>, never disabled.</>],
          ["3 · Scope caption", <>Always <i>scope + counts</i> (“9 open deals · 2 won”), never a description.</>],
          ["4 · Summary tiles", "Clicking a tile filters the list below it."],
          ["5 · Toolbar → chips → count", "Search, then filters by frequency, then sort. Active filters become removable chips."],
        ]} />
      </div></div>

      <SectionHead title="Detail: drawer or page?" desc="both are correct — for different jobs" />
      <div className="two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <div className="card">
          <div className="card-h"><h3>Drawer</h3><span className="d">720px, list stays behind</span></div>
          <div className="card-b">
            <p style={{ fontSize: "var(--text-md)", lineHeight: 1.6 }}>
              Use when the user is working a <b>queue</b>. Keeping the filtered list visible makes the
              next record one click away instead of a back-navigation and a scroll-position gamble.
            </p>
            <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>Deals</div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Full page</h3><span className="d">two-pane, action bar</span></div>
          <div className="card-b">
            <p style={{ fontSize: "var(--text-md)", lineHeight: 1.6 }}>
              Use when the record is a <b>document or a decision</b> with enough content that a narrow
              column would fight it.
            </p>
            <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
              Quotations · Invoices · Client Deals · Payments · Users
            </div>
          </div>
        </div>
      </div>

      <SectionHead title="The chain strip" desc=".chain — what makes seven modules feel like one" />
      <div className="card"><div className="card-b">
        {/* renders nothing when DL-2396 is not in the seed — same guard as the prototype */}
        <ChainStrip dealRef="DL-2396" here="invoice" />
        <Notice ico="link" text={
          <><b>A locked cell states why.</b> “Quote is Issued, not Accepted” prevents a support ticket
          that “disabled” never would. Done cells are tinted, the current cell is underlined, future
          cells are muted. Links go only where the contracts allow — a quotation links up to its deal,
          never down to an invoice.</>
        } />
      </div></div>

      <SectionHead title="Money" desc="the rule that is easiest to get wrong" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Storage", <><b>Integer paise, always.</b> ₹2,47,800 is <span className="mono">24780000</span>. No float ever reaches a total.</>],
          ["Formatting", <>Always <span className="mono">IBData.inr(paise)</span>. Never build the string by hand.</>],
          ["Grouping", <>Indian lakh/crore — <span className="mono">₹10,31,700</span>, never <span className="mono">₹1,031,700</span>.</>],
          ["Decimals", "None. Paise are never displayed."],
          ["Negative", <>U+2212 minus before the symbol: <span className="mono">−₹59,000</span>. Not a hyphen.</>],
          ["Alignment", <>Right, with <span className="mono">.tnum</span>. Every money cell, without exception.</>],
          ["Empty vs zero", <><span className="faint">—</span> means <i>not applicable</i>. <b>₹0</b> means <i>settled</i>. They are different facts.</>],
        ]} />
      </div></div>
    </>
  );
}

function Frame({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <>
      {rows.map((r, i) => (
        <div key={r[0]} style={{ display: "flex", gap: "var(--space-3)", padding: "var(--space-3) 0",
          ...(i ? { borderTop: "1px solid var(--line)" } : null) }}>
          <span style={{ flex: "0 0 150px", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)" }}>{r[0]}</span>
          <span style={{ fontSize: "var(--text-md)", color: "var(--text-2)", lineHeight: 1.5 }}>{r[1]}</span>
        </div>
      ))}
    </>
  );
}

/* --------------------------------------------------------------- RULES --- */
const DO: [string, ReactNode][] = [
  ["Pick a role, not a size", <><span className="mono">--text-md</span>, not <span className="mono">13px</span>. The role survives a density change; the number does not.</>],
  ["Use a control height", "Every interactive thing is xs/sm/md/lg/xl. If your control is 30px, it is wrong."],
  ["Hover is a fill", <><span className="mono">--bg-hover</span>. Never a border colour change — borders moving on hover reads as jitter.</>],
  ["Colour means status", <>If it is not communicating state, it is neutral. Decoration is what makes an admin UI tiring. The one exception is a <b>tag</b>, whose colour is a label a person chose — and it has its own palette so it can never be mistaken for a verdict.</>],
  ["One primary per surface", "Two primaries means neither is."],
  ["Absent, not disabled", "A disabled control invites a workaround and a support ticket. A missing one states the rule."],
  ["Numbers are tabular", <><span className="mono">.tnum</span> on anything that can change. Digits must not dance.</>],
  ["Empty states explain the source", "“No quotations yet” is useless. “Quotations are created from a deal” is not."],
];
const DONT: [string, ReactNode][] = [
  ["No new hex", <>If the colour you want is not a ramp step or a <span className="mono">--tag-*</span>, the component is wrong, not the ramp.</>],
  ["No tag token outside a tag", <><span className="mono">--tag-*</span> in a component is a component that should have picked a status token.</>],
  ["No half-pixels", "13.5px was in this codebase 28 times. It is nowhere now."],
  ["No inline spacing", <><span className="mono">var(--space-3)</span>, not <span className="mono">12px</span>.</>],
  ["No shadow for hierarchy", "Use surface and border. Shadow is for things that genuinely float."],
  ["No second badge system", "The previous panel had five. Consolidating them took longer than building one would have."],
  ["No decorative icon", "An icon that repeats the label costs scan time and buys nothing."],
  ["No colour-only meaning", "Always pair with a word or a shape — 1 in 12 men cannot read your red/green."],
  ["No animation over 240ms", "Above that it stops feeling like the UI responding and starts feeling like waiting."],
];

function Rules() {
  return (
    <>
      <div className="two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <RuleCard title="Do" rows={DO} tone="ok" ico="check" />
        <RuleCard title="Don’t" rows={DONT} tone="bad" ico="x" />
      </div>

      <SectionHead title="Accessibility — the floor, not the ceiling" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Contrast", "Text uses ramp steps 11–12 only. Both clear AA on steps 1–3, in both themes."],
          ["Focus", <><span className="mono">:focus-visible</span> only — a mouse click never paints a ring, a keyboard always does. 2px brand green, 9.9:1.</>],
          ["Targets", <>Minimum 26px (<span className="mono">--control-sm</span>). Row actions get the full row.</>],
          ["Motion", <><span className="mono">prefers-reduced-motion</span> reduces everything to 0.01ms.</>],
          ["Colour", "Never the only signal — status always carries a word."],
          ["Keyboard", <>Every nav item is a real <span className="mono">&lt;button&gt;</span>. The previous panel used href-less anchors, which are not focusable at all.</>],
        ]} />
      </div></div>

      <SectionHead title="Where this came from" />
      <div className="card"><div className="card-b">
        {([["Linear", "Density that still breathes · restrained motion · keyboard-first"],
           ["Stripe", "The best money UI there is — tabular numerals, status colour used only for status, detail-over-list"],
           ["Vercel", "A disciplined spacing rhythm and real negative space"],
           ["Radix", "The twelve-step ramp, and the semantic layer above it"],
           ["Notion", "Hierarchy from whitespace · hover as fill, not border"],
           ["Polaris", "Accessible defaults, documented in the file that ships"]] as [string, string][]).map((r, i) => (
          <div key={r[0]} style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-2) 0",
            ...(i ? { borderTop: "1px solid var(--line)" } : null) }}>
            <b style={{ flex: "0 0 96px", fontSize: "var(--text-md)" }}>{r[0]}</b>
            <span style={{ fontSize: "var(--text-md)", color: "var(--text-2)" }}>{r[1]}</span>
          </div>
        ))}
        <Notice ico="sparkle" text={
          <><b>Not copied: their palettes, their type, their metaphors.</b> Interior bazzar is a system
          of record — it needs tables, money and status, which none of those products need in the same way.</>
        } />
      </div></div>
    </>
  );
}

function RuleCard({ title, rows, tone, ico }: { title: string; rows: [string, ReactNode][]; tone: string; ico: string }) {
  return (
    <div className="card">
      <div className="card-h"><h3>{title}</h3></div>
      <div className="card-b">
        {rows.map((r, i) => (
          <div key={r[0]} style={{ display: "flex", gap: "var(--space-3)", padding: "var(--space-3) 0",
            ...(i ? { borderTop: "1px solid var(--line)" } : null) }}>
            <span style={{ flex: "0 0 auto", color: "var(--" + tone + ")" }}><Icon name={ico} size="sm" /></span>
            <span>
              <b style={{ fontSize: "var(--text-md)" }}>{r[0]}</b>
              <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "3px", lineHeight: 1.5 }}>{r[1]}</div>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* The prototype's own view-local stylesheet, carried across verbatim: `.two`
   and `.three` are this page's grid helpers and exist nowhere in
   admin-theme.css. The prototype emitted it once per tab; once per page is the
   same rule. Nothing here is a new design decision. */
function RespStyle() {
  return (
    <style>{
      "@media(max-width:1180px){.two,.three{grid-template-columns:1fr !important}}" +
      "@media(max-width:1400px){.three{grid-template-columns:1fr 1fr !important}}"
    }</style>
  );
}
