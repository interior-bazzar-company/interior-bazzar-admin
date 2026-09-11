/* =============================================================================
   Users Management — the shell every list-side face renders inside.
   -----------------------------------------------------------------------------
   THE PAGE SKELETON, once, so the directory and the dashboard over it open the
   same way: `PageHeader` (title · scope · the face tabs) → `FilterBar` (search,
   the filters, the chips) → the bands (`StatStrip`) → the body.

   The FACE is the one control here that is NOT a filter: it changes which
   question the page asks, and the filters narrow the answer. So it hangs off
   the page header as a `Tabs` row and produces no chip — clearing the filters
   must never clear the screen you are on.

   The scope figures live in the header's `meta`, counted off the WHOLE row set
   rather than the filtered one: how big the base is and how much of it is live
   must not change meaning because somebody typed in the search box.
   ============================================================================= */
import type { ReactNode } from "react";
import { Card, FilterBar, PageHeader, Tabs } from "../../ui";
import { ProtoBar } from "./bits";
import { resetStore } from "./store";
import type { Params, UserRow } from "./store";

/* TWO FACES. The directory and the dashboard over it — one population, asked
   two ways. Members and Renewals are gone with the membership feature: who is
   paying and whose term is about to end are questions for the subscription
   that holds the money, and Finance asks them of that record.

   `users` is the default face and carries no `view` param, so `#/users` is the
   directory — the working surface, which is what the route already reads like. */
export const VIEWS = [
  { key: "users", label: "Directory", icon: "users" },
  { key: "analytics", label: "Analytics", icon: "chart" },
];

export function ViewBand({ view, onView, counts }: {
  view: string;
  onView: (v: string) => void;
  counts?: Record<string, number | null>;
}) {
  return (
    <Tabs
      cur={view}
      onPick={onView}
      items={VIEWS.map((v) => {
        const n = counts ? counts[v.key] : null;
        /* `quiet`, because the number is a SIZE and not a debt. A loud badge
           on a tab means somebody owes something. */
        return { k: v.key, label: v.label, icon: v.icon, n: typeof n === "number" ? n : undefined, quiet: true };
      })}
    />
  );
}

export function Frame({
  view, onView, counts, cmd, bands, children, toast,
  title, meta, actions, search, right, chips,
}: {
  view: string;
  onView: (v: string) => void;
  counts?: Record<string, number | null>;
  /** The filter controls — the selects, the range, the sort. */
  cmd?: ReactNode;
  /** Full-bleed bands between the filter bar and the body: the stat strip. */
  bands?: ReactNode;
  children: ReactNode;
  toast?: (msg: ReactNode, tone?: string) => void;
  /** The page title. Defaults to the face's own name. */
  title?: ReactNode;
  /** The line under the title: the scope, unfiltered. */
  meta?: ReactNode;
  /** The page's one primary action, in the header. */
  actions?: ReactNode;
  /** The search field, at the head of the filter bar. */
  search?: ReactNode;
  /** The right end of the filter row — a view switch, a sort. */
  right?: ReactNode;
  /** The applied-filter chips, under the filter row. */
  chips?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ProtoBar onReset={() => { resetStore(); if (toast) toast("Back to the seed."); }} />

      <PageHeader
        title={title || (view === "analytics" ? "Users analytics" : "Users Management")}
        meta={meta}
        actions={actions}
        tabs={<ViewBand view={view} onView={onView} counts={counts} />}
        className="mb-0"
      />

      {search || cmd || right || chips
        ? <FilterBar search={search} filters={cmd} right={right} chips={chips} />
        : null}

      {bands}

      {children}
    </div>
  );
}

/* ------------------------------------------------------------- blocks --- */

/**
 * One card. Analytics used to be a single column of loose `SectionHead` +
 * chart pairs, which at thirteen sections reads as one undifferentiated
 * scroll — you cannot tell where an idea starts and the previous one stopped,
 * and nothing anchors the eye on the way down.
 *
 * A card gives each figure a boundary, a title and a subtitle that says what it
 * counts. `wide` opts out of the two-up grid for the charts that need the
 * width; everything else pairs up automatically and falls to one column under
 * `lg`.
 */
export function Block({ title, desc, right, wide, foot, children }: {
  title: ReactNode;
  desc?: ReactNode;
  right?: ReactNode;
  wide?: boolean;
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card title={title} sub={desc} right={right} foot={foot} className={wide ? "lg:col-span-2" : undefined}>
      {children}
    </Card>
  );
}

/** The two-up grid: one column under `lg`, two above it, and a `wide` block
 *  spans both. */
export function Blocks({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">{children}</div>;
}

/** The props every list-side face receives. Declared once so a new face cannot
 *  quietly grow a different contract. */
export interface FaceProps {
  p: Params;
  rows: UserRow[];
  onView: (v: string) => void;
  onFilter: (name: string, value: string) => void;
  onSearch: (name: string, value: string) => void;
  onUnfilter: (key: string) => void;
  onPage: (n: number) => void;
  /** Several params in one navigation — see the date range. */
  onParams: (patch: Params) => void;
}
