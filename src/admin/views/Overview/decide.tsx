/* =============================================================================
   Overview — the decision half. Needs Attention is the page's reason to
   exist: every rule in derive.ts that found a problem lands here, ranked, with
   one action each. Planning Signals is the last thing read, and looks ahead.
   ============================================================================= */
import { useState } from "react";
import { Button, Tile } from "../../ui";
import { Spark } from "../charts";
import { AttnRow, Empty, Go, Section } from "./bits";
import type { OverviewData } from "./store";

const SHOW = 8;

/* ONE RANKED LIST, SEVERITY FIRST AND MONEY INSIDE IT. Not a table: every row
   is a different kind of thing, so there is no column they share. What each
   row does share is the shape — stripe, what it is, what it is worth, one
   action — and that shape is the only thing the eye has to learn. */
export function Attention({ d }: { d: OverviewData }) {
  const [all, setAll] = useState(false);
  const items = d.attention;
  const bad = items.filter((i) => i.severity === "bad").length;
  const warn = items.filter((i) => i.severity === "warn").length;
  const shown = all ? items : items.slice(0, SHOW);
  return (
    <Section id="ov-attention" title="Needs attention" tip="attention"
      desc={items.length ? bad + " urgent · " + warn + " to watch · " + (items.length - bad - warn) + " to note" : undefined}>
      {!items.length ? (
        <Empty title="Nothing needs you right now." tone="ok"
          why="No stalled deal, failed payment, overdue urgent task or unread report across what you can see." />
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {shown.map((i) => (
              <li key={i.id}>
                <AttnRow item={i} />
              </li>
            ))}
          </ol>
          {items.length > SHOW ? (
            <div>
              <Button size="sm" color="link-color" ico={all ? "chevu" : "chev"} onClick={() => setAll((v) => !v)}>
                {all ? "Show fewer" : "Show all " + items.length}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Section>
  );
}

/* WHAT THE DATED RECORDS SAY ABOUT THE NEXT FEW WEEKS. Every one of these is
   a forward reading, so none of them is a count of something that already
   happened — that is what the sections above are for. */
export function Signals({ d }: { d: OverviewData }) {
  const s = d.signals;
  return (
    <Section id="ov-signals" title="Planning signals" tip="signals" desc="what the dated records say about the next few weeks">
      {!s.length ? (
        <Empty title="Nothing to plan from." why="Signals appear once deals, finance or team records are in your access." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {s.map((x) => (
            <Tile
              key={x.id}
              className="h-full"
              k={x.title}
              v={x.value}
              tone={x.tone}
              /* THE SUB READS FIRST AND IN FULL — these lines carry the names
                 the reader is looking for ("Kavya 3 · Ravi 2"), so they are
                 never truncated. The plot and the way out share the line
                 under it, at the two ends. */
              foot={
                <span className="flex w-full flex-col gap-1.5">
                  <span className="text-xs text-tertiary">{x.sub}</span>
                  {x.spark || x.to ? (
                    <span className="flex items-center justify-between gap-3">
                      {x.spark && x.spark.length > 1 ? <Spark values={x.spark} tone="s1" label={x.title} /> : <span />}
                      {x.to ? <Go to={x.to}>{x.toLabel}</Go> : null}
                    </span>
                  ) : null}
                </span>
              }
            />
          ))}
        </div>
      )}
    </Section>
  );
}
