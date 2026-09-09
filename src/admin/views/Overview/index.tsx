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
import { Button, DateRange, FilterBar, MoreMenu, PageHeader, Segmented, Select, TbTitle, qs } from "../../ui";
import { go } from "../../ui/nav";
import { can, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { useActs } from "../Deals/Modals";
import { NewItemModal } from "../Team/Work";
import { useMembers } from "../Team/store";
import { PRESETS } from "./derive";
import { useOverview } from "./store";
import type { Params } from "./store";
import { Stamp, Tip } from "./bits";
import { Snapshot, Performance } from "./top";
import { DealsIntel } from "./deals";
import { TeamIntel, Operations } from "./team";
import { Finance } from "./money";
import { Attention, Signals } from "./decide";

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

  usePageChrome({ crumbs: <TbTitle label="Overview" to={HASH} />, parent: false });

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

  /* ONE LIST, TWO DRAWINGS: a button row on a wide screen and a menu on a
     narrow one, both built from the same entries so neither can drift. */
  const quick: { icon: string; label: string; act: () => void; to?: string }[] = [];
  if (can("deals", "create")) quick.push({ icon: "plus", label: "Add deal", act: () => acts.create() });
  if (can("work", "create")) quick.push({ icon: "check", label: "Create task", act: () => shell.modal(<NewItemModal kind="task" members={members} />) });
  if (can("team", "create")) quick.push({ icon: "user", label: "Add member", act: () => go("#/team"), to: "#/team" });
  if (can("finance")) quick.push({ icon: "cash", label: "Review payments", act: () => go("#/finance?flag=due"), to: "#/finance?flag=due" });
  if (can("deals")) quick.push({ icon: "chart", label: "Pipeline", act: () => go("#/deals?view=board"), to: "#/deals?view=board" });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        title="Overview"
        /* THE PROVENANCE LINE. The page reads three sources on three clocks
           and says so once, at the top, rather than letting a reader assume
           one date; each section stamps its own clock again beside its own
           figures, and the ⓘ carries the whole explanation. */
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="label-mono">Deals</span>
              <Stamp clock={d.clocks.deals} />
            </span>
            <span aria-hidden="true" className="text-quaternary">·</span>
            <span className="label-mono inline-flex items-center gap-1.5">
              Seed clocks elsewhere
              <Tip k="clock" />
            </span>
            {d.attention.length ? (
              <Button
                size="xs"
                color="link-color"
                ico="alert"
                className={bad ? "text-error-primary hover:text-error-primary" : undefined}
                onClick={jump}
              >
                {d.attention.length} item{d.attention.length === 1 ? "" : "s"} need attention
                {bad ? " · " + bad + " urgent" : ""}
              </Button>
            ) : null}
          </>
        }
        /* THE QUICK ACTIONS. Five things an admin opens this page to start,
           one press each, in the header where every page keeps its actions.
           Each is gated on the verb the module would check anyway.

           UNDER lg THEY BECOME ONE MENU. Five labelled buttons are 650px of
           header; on a narrow screen they squeezed the page's own title down
           to "Ov…". Same five actions, same order, one press deeper. */
        actions={
          <>
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              {quick.map((a) => (
                <Button key={a.label} size="xs" color="secondary" ico={a.icon} data-go={a.to} onClick={a.act}>
                  {a.label}
                </Button>
              ))}
            </div>
            {quick.length ? <MoreMenu small align="right" className="lg:hidden" label="Quick actions" items={quick} /> : null}
          </>
        }
      />

      {/* THE FILTER ROW applies to everything under it. Period is the one that
          matters; owner narrows the deal reads and department the team reads,
          and each says so in its label so a filter never silently reaches a
          section it does not touch. */}
      <FilterBar
        filters={
          <>
            <Segmented
              sm
              label="Period"
              value={period}
              onPick={(v) => set({ period: v, from: v === "custom" ? p.from : undefined, to: v === "custom" ? p.to : undefined })}
              options={[...PRESETS.map((x) => ({ v: x.key, l: x.label })), { v: "custom", l: "Custom" }]}
            />
            {period === "custom" ? (
              <DateRange sm from={p.from} to={p.to} onChange={(from, to) => set({ period: "custom", from, to })} />
            ) : null}
          </>
        }
        right={
          <>
            {d.deals && d.isFullAccess && d.ownerOptions.length ? (
              <Select name="owner" label="Deal owner" sm value={p.owner || ""} options={d.ownerOptions} allLabel="Everyone"
                onFilter={(_n, v) => set({ owner: v || undefined })} />
            ) : null}
            {d.departments.length > 1 ? (
              <Select name="dept" label="Department" sm value={p.dept || ""} options={d.departments.map((x) => ({ v: x, l: x }))} allLabel="All departments"
                onFilter={(_n, v) => set({ dept: v || undefined })} />
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <Snapshot d={d} />
        <Performance d={d} />
        <DealsIntel d={d} />
        <TeamIntel d={d} />
        <Finance d={d} />
        <Operations d={d} />
        <Attention d={d} />
        <Signals d={d} />
      </div>
    </div>
  );
}
