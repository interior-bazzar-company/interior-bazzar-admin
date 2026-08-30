/* =============================================================================
   Users Management — the shell every list-side face renders inside.
   -----------------------------------------------------------------------------
   THE PAGE HAS NO TITLE, and that is the panel's rule rather than an omission:
   `.dls-head is gone — title and scope live in the topbar, and the page opens
   on its controls`. An earlier pass put an <h1> and a three-line paragraph
   above the fold on every face, repeating what the topbar already said and
   pushing the actual work down. Both are gone; the scope moved into the
   topbar's stat slots, where Deals and Business Enquiries keep theirs.

   `.dls` is the house list workspace: a full-height flex column with one
   scrolling body, so the table header sticks and the command bands never move.
   Analytics scrolls prose and charts rather than rows and uses the same shell —
   same bands, same left edge, same behaviour under the topbar.

   The view band is the one control here that is NOT a filter. It changes which
   question the page asks; the filters narrow the answer. So it sits above the
   command row and produces no chip — clearing the filters must not clear the
   screen you are on.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon } from "../../ui";
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
  { key: "users", label: "Users", icon: "users" },
  { key: "analytics", label: "Analytics", icon: "chart" },
];

export function ViewBand({ view, onView, counts }: {
  view: string;
  onView: (v: string) => void;
  counts?: Record<string, number | null>;
}) {
  return (
    <nav className="um-views" aria-label="Users Management views">
      {VIEWS.map((v) => {
        const n = counts ? counts[v.key] : null;
        return (
          <button key={v.key} className={v.key === view ? "on" : ""}
            aria-current={v.key === view ? "page" : undefined}
            onClick={() => onView(v.key)}>
            <Icon name={v.icon} size="sm" />
            <span>{v.label}</span>
            {typeof n === "number" && n > 0 ? <i className="tnum">{n}</i> : null}
          </button>
        );
      })}
    </nav>
  );
}

export function Frame({ view, onView, counts, cmd, bands, children, toast }: {
  view: string;
  onView: (v: string) => void;
  counts?: Record<string, number | null>;
  /** The command row — search, filters, actions. Rendered in `.dls-cmd`. */
  cmd?: ReactNode;
  /** Full-bleed bands between the command row and the body: the stat strip,
   *  the filter chips. They live outside `.dls-body` so they do not scroll. */
  bands?: ReactNode;
  children: ReactNode;
  toast?: (msg: ReactNode, tone?: string) => void;
}) {
  return (
    <div className="dls um">
      <ProtoBar onReset={() => { resetStore(); if (toast) toast("Back to the seed."); }} />
      <ViewBand view={view} onView={onView} counts={counts} />
      {cmd ? <div className="dls-cmd">{cmd}</div> : null}
      {bands}
      <div className="dls-body">{children}</div>
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
 * width; everything else pairs up automatically and falls to one column when
 * the container is narrow.
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
    <section className={"card um-block" + (wide ? " wide" : "")}>
      <div className="card-h">
        <h3>{title}</h3>
        {desc ? <span className="d">{desc}</span> : null}
        {right ? <span className="r">{right}</span> : null}
      </div>
      <div className="card-b">{children}</div>
      {foot ? <div className="card-f">{foot}</div> : null}
    </section>
  );
}

/** The two-up grid. `auto-fit` rather than a fixed two columns, so the same
 *  markup is one column on a laptop half-screen and two on a monitor without a
 *  breakpoint anybody has to maintain. */
export function Blocks({ children }: { children: ReactNode }) {
  return <div className="um-blocks">{children}</div>;
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
