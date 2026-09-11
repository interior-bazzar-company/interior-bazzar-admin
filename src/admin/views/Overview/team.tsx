/* =============================================================================
   Overview — team intelligence and operational health. Who is performing,
   who is carrying too much, and where execution is blocked on a person.
   ============================================================================= */
import { Avatar, Card, Eyebrow, ListTable, Meter, Rail } from "../../ui";
import { labelOf, ATT_STATE } from "../Team/store";
import type { TeamMetrics } from "./derive";
import { Empty, Gone, Go, Money, Section, StatLine, Stamp, Tip, rowLink } from "./bits";
import type { OverviewData } from "./store";

/** The one figure on this page that is a JUDGEMENT rather than a count, so it
 *  is the one that carries a colour. No bar, no ramp — three bands and the
 *  number itself, because 84% and 86% are not different news. */
function OnTime({ v }: { v: number | null }) {
  if (v === null) return <span className="text-quaternary">—</span>;
  return <span className={v >= 85 ? "text-success-primary" : v >= 65 ? "text-warning-primary" : "text-error-primary"}>{v}%</span>;
}

export function TeamIntel({ d }: { d: OverviewData }) {
  const t = d.team;
  return (
    <Section id="ov-team" title="Team" tip="teamtable"
      desc={t ? t.members.length + " active · " + t.done + " task" + (t.done === 1 ? "" : "s") + " completed " + d.periods.team.label : undefined}
      right={t ? <><Stamp clock={d.clocks.team} /><Go to="#/team">Members</Go></> : null}>
      {!t ? (
        <Card tight><Gone what="Team" needs="tasks and attendance access" /></Card>
      ) : !t.rows.length ? (
        <Card tight><Empty title="No active members in this department." why="Clear the department filter to see everyone." /></Card>
      ) : (
        <Card
          flush
          tight
          className="overflow-hidden"
          foot="Tasks = completed in period / open / overdue · Collected is all-time on their deals"
        >
          <ListTable
            className="rounded-none ring-0"
            min="48rem"
            head={
              <tr>
                <th className="rail" />
                <th scope="col">Member</th>
                <th scope="col" className="n">Deals</th>
                <th scope="col" className="n">Collected</th>
                <th scope="col" className="n">Tasks</th>
                <th scope="col" className="n">On time</th>
                <th scope="col">
                  <span className="inline-flex items-center gap-1.5">Load<Tip k="load" /></span>
                </th>
              </tr>
            }
          >
            {t.rows.map((r) => (
              <tr key={r.m.memberId} {...rowLink("#/team/" + r.m.memberId)}>
                <Rail tone={r.late >= 3 ? "bad" : r.late ? "warn" : undefined} />
                <td className="cell-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={r.m.name} sm />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="max-w-48 truncate">{r.m.name}</span>
                      <span className="cell-2 max-w-48 truncate">
                        {r.m.designation}{r.state ? " · " + labelOf(ATT_STATE, r.state).toLowerCase() : ""}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="n">
                  {r.deals ? <>{r.deals.open}{r.deals.won ? <span className="text-quaternary"> · {r.deals.won} won</span> : null}</> : <span className="text-quaternary">—</span>}
                </td>
                <td className="n">{r.deals && r.deals.collected ? <Money paise={r.deals.collected} /> : <span className="text-quaternary">—</span>}</td>
                <td className="n">
                  <span className={r.done ? "text-success-primary" : "text-quaternary"}>{r.done}</span>
                  <span className="text-quaternary"> / </span>{r.open}
                  <span className="text-quaternary"> / </span>
                  <span className={r.late ? "text-error-primary" : "text-quaternary"}>{r.late}</span>
                </td>
                <td className="n"><OnTime v={r.onTime} /></td>
                <td>
                  <span className="flex items-center gap-2">
                    <Meter className="w-20" value={r.open} max={Math.max(1, t.maxOpen)} tone={r.late >= 3 ? "bad" : r.late ? "warn" : undefined}
                      label={r.m.name + ": " + r.open + " open items"} />
                    <span className="font-mono text-xs text-secondary tnum">{r.open}</span>
                  </span>
                </td>
              </tr>
            ))}
          </ListTable>
        </Card>
      )}
    </Section>
  );
}

/* THREE QUEUES, THREE QUESTIONS: what is late, who is in, and what somebody
   owes a manager. A count with nothing behind it is drawn quiet rather than
   dropped — "nothing overdue" is the news the reader came for. */
export function Operations({ d }: { d: OverviewData }) {
  const t: TeamMetrics | null = d.team;
  return (
    <Section id="ov-ops" title="Operations" tip="ops" desc={t ? "today on the Team clock" : undefined}
      right={t ? <><Stamp clock={d.clocks.team} /><Go to="#/reports?face=actions">Actions</Go></> : null}>
      <Card tight>
        {!t ? <Gone what="Operations" needs="tasks and attendance access" /> : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Eyebrow className="mb-1">
                <span className="inline-flex items-center gap-1.5">Tasks<Tip k="overdue" /></span>
              </Eyebrow>
              <StatLine label="Overdue" n={t.work.delayed} to="#/work?status=delayed" tone="bad" />
              <StatLine label="Waiting on another" n={t.work.waiting} to="#/work?wait=1" tone="warn" />
              <StatLine label="Due in 7 days" n={t.dueWeek} to="#/work?due=week" />
              <StatLine label="In progress" n={t.work.inProgress} to="#/work?status=in_progress" />
              <StatLine label={"Completed " + d.periods.team.label} n={t.done} to="#/work?status=completed" tone="ok" />
            </div>
            <div className="flex flex-col gap-1">
              <Eyebrow className="mb-1">
                <span className="inline-flex items-center gap-1.5">Today<Tip k="team" /></span>
              </Eyebrow>
              <StatLine label="Present" n={t.today.present} to="#/attendance" tone="ok" />
              <StatLine label="Late" n={t.today.late} to="#/attendance" tone="warn" />
              <StatLine label="Absent" n={t.today.absent} to="#/attendance" tone="bad" />
              <StatLine label="On leave" n={t.today.onLeave} to="#/attendance" />
              <StatLine label="Day never closed" n={t.today.unclosed} to="#/attendance" tone="warn" />
            </div>
            <div className="flex flex-col gap-1">
              <Eyebrow className="mb-1">Owed to a manager</Eyebrow>
              <StatLine label="No plan today" n={t.attention.noPlan.length} to="#/reports" />
              <StatLine label="End-of-day report owed" n={t.attention.noEod.length} to="#/reports?face=actions" tone="warn" />
              <StatLine label="Reports not read" n={t.attention.unacknowledged.length} to="#/reports?face=actions" />
              <StatLine label="Leave to decide" n={t.leave.total} to="#/reports?face=actions" tone="warn" />
              <StatLine label="Agreements unopened" n={t.unopened.length} to="#/agreements" />
              <StatLine label="Members missing documents" n={t.docsMissing.length} to="#/team" tone="warn" />
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
}
