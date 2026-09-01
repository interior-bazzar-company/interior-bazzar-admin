/* =============================================================================
   Finance — the shell every face renders inside. Same `.dls` workspace as the
   rest of the panel: title and scope live in the topbar; the page opens on its
   controls. The view band changes WHICH RECORD you are looking at; the filters
   narrow it, so the band produces no filter chip.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon } from "../../ui";
import { go } from "../../ui/nav";
import { ProtoBar } from "./bits";
import { RECORD_TYPES, resetStore } from "./store";
import type { Params } from "./store";

/* FOUR RECORD TYPES AND WHAT THEY ADD UP TO. The order is the order money
   moves through the company: what was sold, what the team costs, everything
   else, what went back out — then all four read together. */
/* THE SECTIONS AND THEIR ROUTES. Each is its own sidebar row and its own
   module key, so a grant can be held on one without the others — payroll
   especially. `finance` keeps the bare route because it is the module's home
   and every subscription record already lives under it. */
export const ROUTE_OF: Record<string, string> = {
  subscriptions: "finance",
  salaries: "finance-salaries",
  transactions: "finance-transactions",
  refunds: "finance-refunds",
  analytics: "finance-analytics",
};
export const VIEW_OF: Record<string, string> = Object.keys(ROUTE_OF)
  .reduce((o, v) => { o[ROUTE_OF[v]] = v; return o; }, {} as Record<string, string>);

/** The module key a section is granted under. Every write affordance on a
 *  face asks about its OWN section, never about Finance as a whole. */
export const MODULE_OF = (view: string) => ROUTE_OF[view] || "finance";

export const VIEWS = Object.keys(ROUTE_OF)
  .map((key) => ({ key, label: RECORD_TYPES.filter((r) => r.key === key)[0]?.label || key }));

/** A switch WITHIN a sub-section — Transactions / Tags, Overview / KPI.
 *
 *  Deliberately not `Tabs`: two identical underlined strips stacked on one
 *  page say the two levels are peers, and they are not. A segmented control
 *  reads as subordinate to the tabs above it at a glance. */
export function SubTabs({ items, cur, onPick, right }: {
  items: { k: string; label: string; n?: number }[];
  cur: string; onPick: (k: string) => void; right?: ReactNode;
}) {
  return (
    <div className="fin-subtabs">
      <div className="fin-seg" role="tablist">
        {items.map((t) => (
          <button key={t.k} type="button" role="tab" aria-selected={t.k === cur}
            className={t.k === cur ? "on" : ""} onClick={() => onPick(t.k)}>
            {t.label}{typeof t.n === "number" && t.n > 0 ? <span className="n tnum">{t.n}</span> : null}
          </button>
        ))}
      </div>
      {right ? <span className="r">{right}</span> : null}
    </div>
  );
}

/** The workspace a section renders inside. It carries no navigation of its
 *  own any more — the five sections are sidebar rows, so the page opens
 *  straight onto its own controls. */
export function Frame({ tabs, cmd, bands, children, toast }: {
  /** A view band ABOVE the command row — the Users directory's anatomy:
   *  banner, tabs, filters, strip, table. SubTabs below the filters said the
   *  levels backwards: the tab changes WHAT the filters narrow. */
  tabs?: ReactNode;
  cmd?: ReactNode; bands?: ReactNode; children: ReactNode;
  toast?: (msg: ReactNode, tone?: string) => void;
}) {
  return (
    <div className="dls fin">
      <ProtoBar onReset={() => { resetStore(); if (toast) toast("Back to the seed."); }} />
      {tabs}
      {cmd ? <div className="dls-cmd">{cmd}</div> : null}
      {bands}
      <div className="dls-body">{children}</div>
    </div>
  );
}

/** The tab band itself — the same bones as the Users directory's view band,
 *  restated here because that stylesheet belongs to another module. */
export function ViewBand({ items, cur, onPick }: {
  items: { k: string; label: string; icon: string; n?: number }[];
  cur: string; onPick: (k: string) => void;
}) {
  return (
    <nav className="fin-views" aria-label="Views">
      {items.map((t) => (
        <button key={t.k} type="button" className={t.k === cur ? "on" : ""}
          aria-current={t.k === cur ? "page" : undefined}
          onClick={() => onPick(t.k)}>
          <Icon name={t.icon} size="sm" />
          <span>{t.label}</span>
          {typeof t.n === "number" && t.n > 0 ? <i className="tnum">{t.n}</i> : null}
        </button>
      ))}
    </nav>
  );
}

export function Block({ title, desc, right, wide, foot, children }: {
  title: ReactNode; desc?: ReactNode; right?: ReactNode; wide?: boolean; foot?: ReactNode; children: ReactNode;
}) {
  return (
    <section className={"card fin-block" + (wide ? " wide" : "")}>
      <div className="card-h"><h3>{title}</h3>{desc ? <span className="d">{desc}</span> : null}{right ? <span className="r">{right}</span> : null}</div>
      <div className="card-b">{children}</div>
      {foot ? <div className="card-f">{foot}</div> : null}
    </section>
  );
}
export function Blocks({ children }: { children: ReactNode }) { return <div className="fin-blocks">{children}</div>; }

/** The record screen wrapper — the same chrome on all four detail pages. */
export function Rec({ id, pills, back, actions, children }: {
  id: ReactNode; pills?: ReactNode; back: string; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="fin-rec">
      <ProtoBar />
      <div className="fin-idbar">
        <h2 className="mono">{id}</h2>
        {pills}
        <span className="spacer" />
        {actions}
        <button className="btn sm" onClick={() => go(back)}><Icon name="chevl" size="sm" />Back</button>
      </div>
      {children}
    </div>
  );
}

export interface FaceProps {
  p: Params;
  onFilter: (name: string, value: string) => void;
  onSearch: (name: string, value: string) => void;
  onUnfilter: (key: string) => void;
  onParams: (patch: Params) => void;
}
