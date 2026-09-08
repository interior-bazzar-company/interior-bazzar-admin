/* =============================================================================
   Overview — the decision half. Needs Attention is the page's reason to
   exist: every rule in derive.ts that found a problem lands here, ranked, with
   one action each. Planning Signals is the last thing read, and looks ahead.
   ============================================================================= */
import { useState } from "react";
import { Icon } from "../../ui";
import { go } from "../../ui/nav";
import { Spark } from "../charts";
import { Dot, Empty, Go, Section } from "./bits";
import type { OverviewData } from "./store";

const SHOW = 8;
const AREA: Record<string, string> = { deals: "Deals", finance: "Finance", team: "Team" };

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
          <ol className="ov-attn">
            {shown.map((i) => (
              <li key={i.id} className={"ov-attn-i " + i.severity}>
                <Dot tone={i.severity} />
                <div className="ov-attn-t">
                  <b>{i.title}</b>
                  <span className="trunc">{AREA[i.area]} · {i.sub}</span>
                </div>
                <span className="ov-attn-m mono">{i.metric}</span>
                <button type="button" className="btn xs" data-go={i.to} onClick={() => go(i.to)}>
                  {i.toLabel}<Icon name="chevr" size="xs" />
                </button>
              </li>
            ))}
          </ol>
          {items.length > SHOW ? (
            <button type="button" className="btn ghost sm ov-more" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : "Show all " + items.length}
            </button>
          ) : null}
        </>
      )}
    </Section>
  );
}

export function Signals({ d }: { d: OverviewData }) {
  const s = d.signals;
  return (
    <Section id="ov-signals" title="Planning signals" tip="signals" desc="what the dated records say about the next few weeks">
      {!s.length ? <Empty title="Nothing to plan from." why="Signals appear once deals, finance or team records are in your access." /> : (
        <div className="ov-signals">
          {s.map((x) => (
            <div key={x.id} className={"ov-sig" + (x.tone ? " " + x.tone : "")}>
              <div className="eyebrow bare">{x.title}</div>
              <div className="ov-sig-v">
                <span>{x.value}</span>
                {x.spark && x.spark.length > 1 ? <Spark values={x.spark} tone="s1" label={x.title} /> : null}
              </div>
              <p>{x.sub}</p>
              {x.to ? <Go to={x.to}>{x.toLabel}</Go> : null}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
