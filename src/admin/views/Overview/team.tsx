/* =============================================================================
   Overview — team intelligence and operational health. Who is performing,
   who is carrying too much, and where execution is blocked on a person.
   ============================================================================= */
import type { ReactNode } from "react";
import { Avatar, Meter } from "../../ui";
import { go } from "../../ui/nav";
import { labelOf, ATT_STATE } from "../Team/store";
import type { TeamMetrics } from "./derive";
import { Empty, Gone, Go, Money, Section, Stamp, Tip, rowLink } from "./bits";
import type { OverviewData } from "./store";

function OnTime({ v }: { v: number | null }) {
  if (v === null) return <span className="faint">—</span>;
  return <span className={"tnum " + (v >= 85 ? "ok" : v >= 65 ? "warn" : "bad")}>{v}%</span>;
}

export function TeamIntel({ d }: { d: OverviewData }) {
  const t = d.team;
  return (
    <Section id="ov-team" title="Team" tip="teamtable"
      desc={t ? t.members.length + " active · " + t.done + " task" + (t.done === 1 ? "" : "s") + " completed " + d.periods.team.label : undefined}
      right={t ? <><Stamp clock={d.clocks.team} /><Go to="#/team">Members</Go></> : null}>
      {!t ? <Gone what="Team" needs="tasks and attendance access" />
        : !t.rows.length ? <Empty title="No active members in this department." why="Clear the department filter to see everyone." />
        : (
          <div className="tw flat">
            <table className="tbl ov-tbl ov-team">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="n">Deals</th>
                  <th className="n">Collected</th>
                  <th className="n">Tasks</th>
                  <th className="n">On time</th>
                  <th><span className="ov-th">Load<Tip k="load" /></span></th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => {
                  return (
                    <tr key={r.m.memberId} {...rowLink("#/team/" + r.m.memberId)}>
                      <td>
                        <span className="who">
                          <Avatar name={r.m.name} sm />
                          <span className="who-t">
                            <span className="trunc">{r.m.name}</span>
                            <span className="who-s">{r.m.designation}{r.state ? " · " + labelOf(ATT_STATE, r.state).toLowerCase() : ""}</span>
                          </span>
                        </span>
                      </td>
                      <td className="n tnum">{r.deals ? <>{r.deals.open}{r.deals.won ? <span className="faint"> · {r.deals.won} won</span> : null}</> : <span className="faint">—</span>}</td>
                      <td className="n">{r.deals && r.deals.collected ? <Money paise={r.deals.collected} /> : <span className="faint">—</span>}</td>
                      <td className="n tnum">
                        <span className={r.done ? "ok" : "faint"}>{r.done}</span>
                        <span className="faint"> / </span>{r.open}
                        <span className="faint"> / </span><span className={r.late ? "bad" : "faint"}>{r.late}</span>
                      </td>
                      <td className="n"><OnTime v={r.onTime} /></td>
                      <td className="ov-load">
                        <Meter value={r.open} max={Math.max(1, t.maxOpen)} tone={r.late >= 3 ? "bad" : r.late ? "warn" : undefined}
                          label={r.m.name + ": " + r.open + " open items"} />
                        <span className="tnum">{r.open}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ov-legend">Tasks = completed in period / open / overdue · Collected is all-time on their deals</div>
          </div>
        )}
    </Section>
  );
}

function Line({ label, n, to, tone }: { label: ReactNode; n: number; to: string; tone?: "bad" | "warn" | "ok" }) {
  return (
    <button type="button" className={"ov-line" + (n ? "" : " zero")} data-go={to} onClick={() => go(to)}>
      <span>{label}</span>
      <b className={"tnum " + (n && tone ? tone : "")}>{n}</b>
    </button>
  );
}

export function Operations({ d }: { d: OverviewData }) {
  const t: TeamMetrics | null = d.team;
  return (
    <Section id="ov-ops" title="Operations" tip="ops" desc={t ? "today on the Team clock" : undefined}
      right={t ? <><Stamp clock={d.clocks.team} /><Go to="#/reports?face=actions">Actions</Go></> : null}>
      {!t ? <Gone what="Operations" needs="tasks and attendance access" /> : (
        <div className="ov-3col">
          <div className="ov-list">
            <div className="eyebrow">Tasks</div>
            <Line label="Overdue" n={t.work.delayed} to="#/work?status=delayed" tone="bad" />
            <Line label="Waiting on another" n={t.work.waiting} to="#/work?wait=1" tone="warn" />
            <Line label="Due in 7 days" n={t.dueWeek} to="#/work?due=week" />
            <Line label="In progress" n={t.work.inProgress} to="#/work?status=in_progress" />
            <Line label={"Completed " + d.periods.team.label} n={t.done} to="#/work?status=completed" tone="ok" />
          </div>
          <div className="ov-list">
            <div className="eyebrow">Today</div>
            <Line label="Present" n={t.today.present} to="#/attendance" tone="ok" />
            <Line label="Late" n={t.today.late} to="#/attendance" tone="warn" />
            <Line label="Absent" n={t.today.absent} to="#/attendance" tone="bad" />
            <Line label="On leave" n={t.today.onLeave} to="#/attendance" />
            <Line label="Day never closed" n={t.today.unclosed} to="#/attendance" tone="warn" />
          </div>
          <div className="ov-list">
            <div className="eyebrow">Owed to a manager</div>
            <Line label="No plan today" n={t.attention.noPlan.length} to="#/reports" />
            <Line label="End-of-day report owed" n={t.attention.noEod.length} to="#/reports?face=actions" tone="warn" />
            <Line label="Reports not read" n={t.attention.unacknowledged.length} to="#/reports?face=actions" />
            <Line label="Leave to decide" n={t.leave.total} to="#/reports?face=actions" tone="warn" />
            <Line label="Agreements unopened" n={t.unopened.length} to="#/agreements" />
            <Line label="Members missing documents" n={t.docsMissing.length} to="#/team" tone="warn" />
          </div>
        </div>
      )}
    </Section>
  );
}
