/* =============================================================================
   Interior bazzar — Admin · Overview. The command centre.
   -----------------------------------------------------------------------------
   THE PAGE ANSWERS ONE SENTENCE: what happened, what is happening, what needs
   me, what should I do next — in that order, top to bottom. Eight sections,
   and the order is the design: Snapshot → Performance → Deals → Team →
   Finance → Operations → Needs attention → Planning signals. A block that
   cannot be placed in that sentence is not on the page.

   IT OWNS NOTHING. Every figure is read from the modules' own stores and API
   hooks through views/Overview/store.ts, and every drill-down is a hash the
   module already answers to. There is no overview endpoint, no cache, and no
   number that the module it links to would print differently — see
   derive.ts for the arithmetic and content/overview/metrics.json for what
   each ⓘ says.

   FILTERS LIVE IN THE URL, like every other module here: `?period=30d`,
   `?period=custom&from=&to=`, `?owner=<id>`, `?dept=<name>`. A link to a
   filtered overview is a link somebody can send.

   The route is `overview`, proto-gated in auth/session.ts (every signed-in
   member can open it) with each SECTION gated on its own source module, so a
   session without finance access sees the finance block say so rather than
   a hole in the reading order.
   ============================================================================= */
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DateRange, Icon, Segmented, Select, qs } from "../../ui";
import { go } from "../../ui/nav";
import { can, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { useActs } from "../Deals/Modals";
import { NewItemModal } from "../Team/Work";
import { useMembers } from "../Team/store";
import { PRESETS } from "./derive";
import { useOverview } from "./store";
import type { Params } from "./store";
import { Tip } from "./bits";
import { Snapshot, Performance } from "./top";
import { DealsIntel } from "./deals";
import { TeamIntel, Operations } from "./team";
import { Finance } from "./money";
import { Attention, Signals } from "./decide";
import "../charts.css";
import "./overview.css";

const HASH = "#/overview";

export default function Overview() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Params = {};
    sp.forEach((v, k) => { o[k] = v; });
    return o;
  }, [sp]);
  const d = useOverview(p);
  const shell = useShell();
  const acts = useActs({});
  const members = useMembers();

  usePageChrome({ crumbs: <span className="tb-title is-here">Overview</span>, parent: false });

  const set = (patch: Params) => {
    const next: Params = { ...p, ...patch };
    Object.keys(next).forEach((k) => { if (!next[k]) delete next[k]; });
    go(HASH + qs(next));
  };
  const period = p.period && (p.period === "custom" || PRESETS.some((x) => x.key === p.period)) ? p.period : "30d";
  const bad = d.attention.filter((i) => i.severity === "bad").length;
  const jump = () => {
    const el = document.getElementById("ov-attention");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="page wide ov">
      <div className="ph">
        <div className="ph-t">
          <h1>Overview</h1>
          <div className="scope">
            Where the business stands, {d.clocks.deals.label.replace("live · ", "")}.
            {d.attention.length ? (
              <button type="button" className={"ov-jump" + (bad ? " bad" : "")} onClick={jump}>
                <Icon name="alert" size="xs" />
                {d.attention.length} item{d.attention.length === 1 ? "" : "s"} need attention
                {bad ? " · " + bad + " urgent" : ""}
              </button>
            ) : null}
          </div>
        </div>
        <div className="acts">
          {can("deals", "create")
            ? <button type="button" className="btn pri" onClick={() => acts.create()}><Icon name="plus" />Add deal</button> : null}
          {can("work", "create")
            ? <button type="button" className="btn" onClick={() => shell.modal(<NewItemModal kind="task" members={members} />)}><Icon name="check" />Create task</button> : null}
          {can("team", "create")
            ? <button type="button" className="btn" data-go="#/team" onClick={() => go("#/team")}><Icon name="user" />Add member</button> : null}
          {can("finance")
            ? <button type="button" className="btn" data-go="#/finance?flag=due" onClick={() => go("#/finance?flag=due")}><Icon name="cash" />Review payments</button> : null}
          {can("deals")
            ? <button type="button" className="btn" data-go="#/deals?view=board" onClick={() => go("#/deals?view=board")}><Icon name="chart" />Pipeline</button> : null}
        </div>
      </div>

      {/* THE FILTER ROW applies to everything under it. Period is the one that
          matters; owner narrows the deal reads and department the team reads,
          and each says so in its label so a filter never silently reaches a
          section it does not touch. */}
      <div className="ov-filters" role="group" aria-label="Filters">
        <Segmented label="Period" value={period} onPick={(v) => set({ period: v, from: v === "custom" ? p.from : undefined, to: v === "custom" ? p.to : undefined })}
          options={[...PRESETS.map((x) => ({ v: x.key, l: x.label })), { v: "custom", l: "Custom" }]} />
        {period === "custom"
          ? <DateRange sm from={p.from} to={p.to} onChange={(from, to) => set({ period: "custom", from, to })} />
          : null}
        <span className="spacer" />
        {d.deals && d.isFullAccess && d.ownerOptions.length
          ? <Select name="owner" label="Deal owner" sm value={p.owner || ""} options={d.ownerOptions} allLabel="Everyone"
              onFilter={(_n, v) => set({ owner: v || undefined })} />
          : null}
        {d.departments.length > 1
          ? <Select name="dept" label="Department" sm value={p.dept || ""} options={d.departments.map((x) => ({ v: x, l: x }))} allLabel="All departments"
              onFilter={(_n, v) => set({ dept: v || undefined })} />
          : null}
        <span className="ov-clock"><Icon name="clock" size="xs" />seed sections run on their own clock<Tip k="clock" /></span>
      </div>

      <Snapshot d={d} />
      <Performance d={d} />
      <DealsIntel d={d} />
      <TeamIntel d={d} />
      <Finance d={d} />
      <Operations d={d} />
      <Attention d={d} />
      <Signals d={d} />
    </div>
  );
}

