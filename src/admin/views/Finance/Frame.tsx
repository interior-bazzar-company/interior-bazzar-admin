/* =============================================================================
   Finance — the shell every face renders inside, and the header every record
   wears.
   -----------------------------------------------------------------------------
   A LIST IS THE PANEL'S PAGE SKELETON: `PageHeader` (what this section is, how
   many rows, the clock it was read at, ONE primary action) → `FilterBar` →
   `StatStrip` → the table. The five sections are sidebar rows, so a page opens
   straight onto its own controls and carries no navigation of its own.

   A RECORD IS THAT SAME HEADER with the id as the title: the id leads, the
   status pills sit under it, and everything that can be done to the record is
   behind one `MoreMenu`. Back is the topbar title — the panel has one way up —
   and the header's own back link carries the list state the record arrived
   with, so returning is a return and not a reset.
   ============================================================================= */
import type { ReactNode } from "react";
import { Card, PageHeader, Segmented, Tabs } from "../../ui";
import { MoreMenu } from "../../ui/menu";
import type { MenuItem } from "../../ui/menu";
import { ProtoBar } from "./bits";
import { RECORD_TYPES, resetStore } from "./store";
import type { Params } from "./store";

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

/** A switch WITHIN a sub-section — Overview / KPI.
 *
 *  Deliberately not `Tabs`: two identical underlined strips stacked on one
 *  page say the two levels are peers, and they are not. A segmented control
 *  reads as subordinate to the tabs above it at a glance. */
export function SubTabs({ items, cur, onPick, right }: {
  items: { k: string; label: string; n?: number }[];
  cur: string; onPick: (k: string) => void; right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented
        label="View"
        value={cur}
        onPick={onPick}
        options={items.map((t) => ({
          v: t.k,
          l: (
            <span className="inline-flex items-center gap-1.5">
              {t.label}
              {typeof t.n === "number" && t.n > 0 ? <span className="text-xs text-quaternary tnum">{t.n}</span> : null}
            </span>
          ),
        }))}
      />
      {right ? <span className="flex items-center gap-2">{right}</span> : null}
    </div>
  );
}

/** The workspace a section renders inside — the panel's page skeleton, in
 *  order: the proto notice, the header, the filters, the strip, the body. */
export function Frame({ title, meta, actions, tabs, cmd, bands, children, toast }: {
  /** What this section is. Absent on a face that is only a body (a record's
   *  sub-page supplies its own header). */
  title?: ReactNode;
  /** The line under the title: the count and the clock the rows were read at. */
  meta?: ReactNode;
  /** ONE primary action, in the header where every page in the panel puts it. */
  actions?: ReactNode;
  /** The face switch, hung off the header's bottom edge — the tab decides
   *  WHAT the filters narrow, so it cannot sit under them. */
  tabs?: ReactNode;
  /** The `FilterBar` for this face. */
  cmd?: ReactNode;
  /** The `StatStrip`, and anything else that stands between filters and rows. */
  bands?: ReactNode;
  children: ReactNode;
  toast?: (msg: ReactNode, tone?: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ProtoBar onReset={() => { resetStore(); if (toast) toast("Back to the seed."); }} />
      {title !== undefined ? (
        <PageHeader className="mb-0" title={title} meta={meta} actions={actions} tabs={tabs} />
      ) : tabs}
      {cmd}
      {bands}
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}

/** The tab band itself — the shared `Tabs`, so a face switch in Finance is the
 *  same object as a face switch anywhere else in the panel. */
export function ViewBand({ items, cur, onPick }: {
  items: { k: string; label: string; icon: string; n?: number }[];
  cur: string; onPick: (k: string) => void;
}) {
  return (
    <Tabs
      cur={cur}
      onPick={onPick}
      items={items.map((t) => ({ k: t.k, label: t.label, icon: t.icon, n: t.n, quiet: true }))}
    />
  );
}

/** A titled block on a page — the panel's `Card`. `wide` spans both columns of
 *  the two-column read below. */
export function Block({ title, desc, right, wide, foot, children }: {
  title: ReactNode; desc?: ReactNode; right?: ReactNode; wide?: boolean; foot?: ReactNode; children: ReactNode;
}) {
  return (
    <Card title={title} sub={desc} right={right} foot={foot} className={wide ? "lg:col-span-2" : undefined}>
      {children}
    </Card>
  );
}
/** Two columns on `lg`, one below it. A `Block wide` takes the whole row. */
export function Blocks({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">{children}</div>;
}

/** THE RECORD SCREEN'S HEADER — the same chrome on all four detail pages.
 *  The id leads as the page title, the status pills and the record's own
 *  sub-line are its meta, and everything that can be done to it is one
 *  primary action plus a `MoreMenu`. `back` is the list state this record
 *  arrived with, so the way up returns rather than resets. */
export function Rec({ id, pills, sub, back, actions, menu, children }: {
  id: ReactNode; pills?: ReactNode; sub?: ReactNode; back: string; actions?: ReactNode;
  menu?: MenuItem[]; children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ProtoBar />
      <PageHeader
        className="mb-0"
        back={{ label: "Back", to: back }}
        title={<span className="font-mono tnum">{id}</span>}
        meta={pills || sub ? (
          <>
            {pills ? <span className="flex flex-wrap items-center gap-2">{pills}</span> : null}
            {sub ? <span className="w-full text-sm text-tertiary">{sub}</span> : null}
          </>
        ) : undefined}
        actions={actions || (menu && menu.length) ? (
          <>
            {actions}
            {menu && menu.length ? <MoreMenu items={menu} /> : null}
          </>
        ) : undefined}
      />
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
