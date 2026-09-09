/* =============================================================================
   Reports — #/reports
   -----------------------------------------------------------------------------
     #/reports                       the record: one day, member by member
     #/reports?face=actions          only the things blocked on a person
     #/reports?face=analytics        plans and EODs over a window

   THREE TABS, AND THE SPLIT IS BY WHAT YOU CAME TO DO. Reports is the record.
   Actions is the short list of things that have stopped because a specific
   person has not moved, and it carries a count so it can be read from the tab.
   Analytics is the shape of a fortnight.

   THE DAY IS A READ, NOT A TABLE. A row of eight columns answers "did they
   submit" and nothing else; what a senior actually opens this for is the DIFF —
   what somebody said they would do against what came back — and that is a
   paragraph beside a paragraph, not two cells a screen apart. So the record is
   a card per member in a two-column read, with the clock, the plan and the EOD
   stacked in the order they happened.

   THIS PAGE IS A SENIOR'S REVIEW SURFACE AND IT ONLY READS. Writing your own
   plan and your own EOD lives at `/team/:id/reports`, where a member's records
   already are — two write controls on a screen that is otherwise entirely a
   read made the page answer to two different people at once.

   THE HOURS ARE READ, NEVER TYPED. The EOD shows the attendance row and offers
   no field for it. A report that lets a person type their own hours is not a
   record of anything.

   MISSING AT 14:20 IS NOT MISSING, IT IS EARLY. An EOD only counts as
   outstanding once the member's own day is over, which is why `eodDue` takes
   the member and the clock rather than testing for a row.

   NO API YET — src/content/team/{plans,reports}.json through store.ts.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, Card, ChartFrame, DateInput, EmptyState, Icon, IconButton, ListTable, PageHeader,
  Pill, Rail, SectionHead, Segmented, StatStrip, Tabs, TbTitle, Tiles, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { ColumnChart } from "../charts";
import { go } from "../../ui/nav";
import {
  TODAY, acknowledgeReport, addDays, attentionOf, clampDay, fmtDate, fmtDayName, fmtHM, fmtTime,
  meId, pendingLeave, readMember, reportSpanDays, reportSpanRows, reportSpanTotals, scopeLabel,
  scopeOf, unopenedAgreements, useAgreements, useLeave, useReports, useReview,
} from "./store";
import type { ReportSpanRow, ReviewRow, Scope, WorkItem } from "./store";
import { Meter, StatePill, Who } from "./bits";
import { MarksBlock, SortHead, TasksBlock } from "./workBits";
import { ensureAdopted } from "./adopt";

const ROUTE = "#/reports";

/* ORDER IS URGENCY. The record is what the page is for, Actions is the only tab
   that can be waiting on the reader, and the shape of a fortnight comes last. */
const FACES = [
  { k: "reports", label: "Day", icon: "doc" },
  { k: "actions", label: "Actions", icon: "inbox" },
  { k: "analytics", label: "Analytics", icon: "chart" },
];

export default function Reports() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  /* `?face=` is the parameter this page has always written. `?tab=` is read as
     an alias and never written back, so a link typed with the panel's other
     spelling still lands on the right face instead of silently opening the
     record. */
  const asked = p.face || p.tab || "";
  const face = FACES.some((f) => f.k === asked) ? asked : "reports";
  const date = clampDay(p.date);
  const scope = scopeOf("reports");
  const rows = useReview(date, scope);

  usePageChrome({ crumbs: <TbTitle label="Reports" to="#/reports" /> }, face + date);

  useEffect(() => { ensureAdopted(); }, []);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    delete next.tab;
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    go(ROUTE + qs(next));
  }, [p]);

  /* The count on the tab is the whole reason Actions is a tab: a queue you have
     to open to discover is empty is a queue you stop opening. */
  const a = attentionOf(rows);
  const pending = a.noPlan.length + a.noEod.length + a.unacknowledged.length
    + pendingLeave(scope).length + unopenedAgreements(scope).length;

  const bar = <DateBar date={date} onPick={(d) => goto({ date: d === TODAY ? undefined : d })} />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reports"
        meta={
          <>
            <span className="font-medium text-secondary">{fmtDayName(date)} · {fmtDate(date)}</span>
            <span>{scopeLabel(scope, rows.length)}</span>
            {date === TODAY ? <Pill xs dot tone="live" text="today" /> : null}
          </>
        }
        /* THE DAY SCOPES THE WHOLE PAGE — the record, the queue and the
           window all read it — so it sits in the header beside the title
           rather than inside one face's own toolbar. Analytics reads a
           window instead and carries its own control. */
        actions={face === "analytics" ? undefined : bar}
        tabs={
          <Tabs cur={face}
            items={FACES.map((f) => ({ k: f.k, label: f.label, icon: f.icon,
              n: f.k === "actions" ? pending : undefined }))}
            onPick={(k) => goto({ face: k === "reports" ? undefined : k })} />
        }
      />

      {face === "reports" ? <TheDay rows={rows} /> : null}
      {face === "actions" ? <Actions rows={rows} /> : null}
      {face === "analytics" ? (
        <Analytics scope={scope} span={p.span || "7"}
          onSpan={(v) => goto({ span: v === "7" ? undefined : v })} />
      ) : null}
    </div>
  );
}

/** Step a day, or pick one. Same control as the attendance date bar, and `max`
 *  is what refuses a future date rather than a disabled button somebody routes
 *  around by typing the URL. */
function DateBar({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <IconButton ico="chevl" color="secondary" label="Previous day" onClick={() => onPick(addDays(date, -1))} />
        <DateInput value={date} max={TODAY} ariaLabel="Show this day"
          onChange={(v) => { if (v && v <= TODAY) onPick(v); }} />
        <IconButton ico="chevr" color="secondary" label="Next day" isDisabled={date >= TODAY}
          onClick={() => onPick(addDays(date, 1))} />
      </div>
      <Button color="secondary" isDisabled={date === TODAY} onClick={() => onPick(TODAY)}>Today</Button>
    </div>
  );
}

/* -------------------------------------------------------------- the day --- */

/** THE RECORD, for one day. Who was in, what they said they would do, and what
 *  came back — one card per person, read down rather than across. The attention
 *  cards and "waiting on you" are the Actions tab: they are things to DO, and
 *  burying them above a table is how a queue gets missed. */
function TheDay({ rows }: { rows: ReviewRow[] }) {
  const a = attentionOf(rows);
  const cells: (StatCell | "sep")[] = [
    { k: "in scope", v: rows.length },
    "sep",
    { k: "no plan", v: a.noPlan.length, dot: a.noPlan.length ? "warn" : "neutral" },
    { k: "EOD due", v: a.noEod.length, dot: a.noEod.length ? "warn" : "neutral" },
    "sep",
    { k: "overdue", v: a.delayed.length, dot: a.delayed.length ? "warn" : "neutral" },
    { k: "waiting", v: a.waiting.length, dot: a.waiting.length ? "bad" : "neutral" },
    "sep",
    { k: "late or absent", v: a.lateOrAbsent.length, dot: a.lateOrAbsent.length ? "warn" : "neutral" },
    { k: "on leave", v: rows.filter((r) => r.state === "on_leave").length, dot: "info" },
    { k: "unread reports", v: a.unacknowledged.length, dot: a.unacknowledged.length ? "info" : "neutral" },
  ];

  return (
    <>
      <StatStrip cells={cells} />

      {rows.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((r) => <ReviewCard key={r.member.memberId} r={r} />)}
        </div>
      ) : (
        <EmptyState icon="users" title="Nobody in scope"
          body="You see yourself and the members whose reporting line points at you." />
      )}
    </>
  );
}

/** ONE PERSON'S DAY. The clock, then the plan, then what came back — in the
 *  order it happened, so the card is read top to bottom rather than compared
 *  cell by cell against the row above it. */
function ReviewCard({ r }: { r: ReviewRow }) {
  const shell = useShell();
  const plan = r.plan;
  const rep = r.report;
  const late = !!(r.day && r.day.isLate);

  return (
    <Card tight
      title={<Who m={r.member} />}
      right={
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {r.delayed ? <Pill xs tone="warn" text={r.delayed + " overdue"} /> : null}
          {r.waiting ? <Pill xs tone="bad" text={r.waiting + " waiting"} /> : null}
          <StatePill state={r.state} />
        </span>
      }
      foot={
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="label-mono">In</span>
            <b className="font-mono font-medium text-secondary tnum">
              {r.day ? fmtTime(r.day.startedAt) : "—"}
            </b>
            {late ? <Pill xs tone="warn" text="late" /> : null}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="label-mono">Worked</span>
            <b className="font-mono font-medium text-secondary tnum">
              {r.worked != null ? fmtHM(r.worked) : "—"}
            </b>
          </span>
          {r.doing ? (
            <button type="button"
              className="ml-auto inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              data-go={"#/work?item=" + r.doing.itemId}
              onClick={() => openWork((r.doing as WorkItem).itemId)}>
              <span className="label-mono">Doing now</span>
              <span className="min-w-0 truncate font-medium">{r.doing.title}</span>
            </button>
          ) : null}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2">
          <header className="flex items-center gap-2">
            <h4 className="label-mono">Plan</h4>
            {plan && plan.submittedAt
              ? <Pill xs dot tone="ok" text={"in " + fmtTime(plan.submittedAt)} />
              : plan
                ? <Pill xs dot tone="neutral" text="draft" title="Started and not submitted" />
                : <Pill xs dot tone="warn" text="not submitted" />}
            {r.planned ? (
              <span className="ml-auto text-xs font-medium text-secondary tnum">{r.done}/{r.planned} done</span>
            ) : null}
          </header>
          {plan && plan.lines.length ? (
            <>
              <ol className="flex flex-col gap-1">
                {plan.lines.slice(0, 5).map((l) => {
                  const it = r.items.filter((i) => i.itemId === l.workItemId)[0];
                  const done = !!it && it.status === "completed";
                  return (
                    <li key={l.lineId} className="flex items-start gap-2 text-sm">
                      <span aria-hidden="true"
                        className={done
                          ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-brand-solid ring-1 ring-brand-solid ring-inset"
                          : "mt-0.5 size-4 shrink-0 rounded bg-primary ring-1 ring-primary ring-inset"}>
                        {done ? <Icon name="check" size="xs" className="text-white" /> : null}
                      </span>
                      <span className={done ? "min-w-0 text-quaternary line-through" : "min-w-0 text-secondary"}>{l.title}</span>
                    </li>
                  );
                })}
              </ol>
              {plan.lines.length > 5 ? (
                <p className="text-xs text-quaternary">+{plan.lines.length - 5} more lines</p>
              ) : null}
              {r.planned ? <Meter value={r.done} of={r.planned} tone={r.done === r.planned ? "ok" : undefined} /> : null}
            </>
          ) : (
            <p className="text-sm text-quaternary">
              {plan ? "Started, nothing written yet." : "Nothing planned for this day."}
            </p>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <header className="flex items-center gap-2">
            <h4 className="label-mono">End of day</h4>
            {rep && rep.submittedAt
              ? rep.acknowledgedById
                ? <Pill xs dot tone="ok" text="read" />
                : <Pill xs dot tone="info" text="unread" />
              : r.eodDue
                ? <Pill xs dot tone="warn" text="outstanding" />
                : <Pill xs dot tone="neutral" text="not due yet" />}
          </header>
          {rep && rep.submittedAt ? (
            <>
              {rep.achievement ? <p className="text-sm text-secondary">{rep.achievement}</p> : null}
              {rep.blockers ? (
                <p className="text-sm text-warning-primary">
                  <span className="label-mono mr-1.5">Blocked</span>{rep.blockers}
                </p>
              ) : null}
              {rep.tomorrowPriority ? (
                <p className="text-sm text-tertiary">
                  <span className="label-mono mr-1.5">Tomorrow</span>{rep.tomorrowPriority}
                </p>
              ) : null}
              {rep.acknowledgedById ? null : (
                <div className="mt-auto pt-1">
                  <Button color="secondary" size="xs" ico="eye" onClick={() => {
                    const res = acknowledgeReport(rep.reportId);
                    shell.toast(res.ok ? "Marked read" : res.message, res.ok ? undefined : "bad");
                  }}>Mark read</Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-quaternary">
              {r.eodDue
                ? "Their day is over and nothing has come back."
                : "Counted only once that member's own day is over."}
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}

const openWork = (id: string) => go("#/work" + qs({ item: id }));

/* ------------------------------------------------------------- actions --- */

interface ActionRow {
  key: string;
  kind: string;
  tone: "warn" | "bad" | "info";
  what: ReactNode;
  why: ReactNode;
  act?: ReactNode;
}

/** ONE QUEUE, NOT SIX CARDS. Every entry is a filter over the same rows the Day
 *  tab reads — a count and the list it opens cannot disagree — and every entry
 *  carries the one control that clears it, so the tab is a place work leaves
 *  from rather than a place it is announced.
 *
 *  It renders its own empty state rather than nothing: a tab that draws a blank
 *  page reads as broken, and "nothing needs you" is a genuinely useful sentence
 *  at five in the afternoon. */
function Actions({ rows }: { rows: ReviewRow[] }) {
  const shell = useShell();
  useLeave(); useAgreements();
  const scope = scopeOf("reports");
  const a = attentionOf(rows);
  const leave = pendingLeave(scope);
  const unopened = unopenedAgreements(scope);

  const list: ActionRow[] = [];

  leave.forEach((l) => list.push({
    key: "lv" + l.leaveId, kind: "Leave", tone: "warn",
    what: readMember(l.memberId)?.name || l.memberId,
    why: <>Undecided from {fmtDate(l.fromDate)} — those days read as absent until you answer.</>,
    act: <Button color="secondary" size="xs" onClick={() => go("#/attendance?face=requests")}>Decide</Button>,
  }));

  a.unacknowledged.forEach((r) => list.push({
    key: "un" + r.member.memberId, kind: "Unread EOD", tone: "info",
    what: r.member.name,
    why: "A report nobody read is worse than one nobody wrote — the person who wrote it believes it was read.",
    act: (
      <Button color="secondary" size="xs" ico="eye" onClick={() => {
        const res = acknowledgeReport((r.report as { reportId: string }).reportId);
        shell.toast(res.ok ? "Marked read" : res.message, res.ok ? undefined : "bad");
      }}>Mark read</Button>
    ),
  }));

  a.noEod.forEach((r) => list.push({
    key: "eo" + r.member.memberId, kind: "EOD due", tone: "warn",
    what: r.member.name, why: "Their day is over and nothing has come back.",
    act: <Button color="tertiary" size="xs" onClick={() => go("#/team/" + r.member.memberId + "/reports")}>Open</Button>,
  }));

  a.noPlan.forEach((r) => list.push({
    key: "np" + r.member.memberId, kind: "No plan", tone: "warn",
    what: r.member.name,
    why: "Anybody with no reporting line is excluded — a number that always shows the founder delinquent is one people learn to ignore.",
    act: <Button color="tertiary" size="xs" onClick={() => go("#/team/" + r.member.memberId + "/reports")}>Open</Button>,
  }));

  a.waiting.forEach((i) => list.push({
    key: "wt" + i.itemId, kind: "Waiting", tone: "bad",
    what: i.title, why: <>Blocked on another item · {readMember(i.assigneeId)?.name || i.assigneeId}</>,
    act: <Button color="tertiary" size="xs" onClick={() => openWork(i.itemId)}>Open</Button>,
  }));

  a.delayed.forEach((i) => list.push({
    key: "dl" + i.itemId, kind: "Overdue", tone: "warn",
    what: i.title,
    why: <>Due {fmtDate(i.dueDate)} · {readMember(i.assigneeId)?.name || i.assigneeId}</>,
    act: <Button color="tertiary" size="xs" onClick={() => openWork(i.itemId)}>Open</Button>,
  }));

  a.lateOrAbsent.forEach((r) => list.push({
    key: "la" + r.member.memberId, kind: "Attendance", tone: "warn",
    what: r.member.name,
    why: r.state === "absent" ? "No record for this day at all." : "In late against their own start time.",
    act: <Button color="tertiary" size="xs" onClick={() => go("#/attendance")}>Open</Button>,
  }));

  unopened.forEach((ag) => list.push({
    key: "ag" + ag.agreementId, kind: "Agreement", tone: "warn",
    what: ag.title, why: <>Sent to {readMember(ag.memberId)?.name || ag.memberId} and never opened.</>,
    act: (
      <Button color="tertiary" size="xs"
        onClick={() => go("#/team/" + ag.memberId + "?tab=documents")}>Open</Button>
    ),
  }));

  return (
    <>
      <SectionHead className="mb-0" title="Needs a person"
        desc="Not the work — the things that have stopped because somebody has not moved." />

      {list.length ? (
        <ListTable min="880px"
          head={
            <tr>
              <th className="rail" />
              <th>What</th>
              <th>Kind</th>
              <th>Why it is here</th>
              <th className="acts" />
            </tr>
          }>
          {list.map((r) => (
            <tr key={r.key}>
              <Rail tone={r.tone} />
              <td className="cell-1">{r.what}</td>
              <td><Pill xs dot tone={r.tone} text={r.kind} /></td>
              <td><span className="block max-w-lg text-tertiary">{r.why}</span></td>
              <td className="acts">{r.act}</td>
            </tr>
          ))}
        </ListTable>
      ) : (
        <Alert tone="ok" ico="check" title="Nothing needs you">
          Every plan is in, no work is overdue or blocked, every report has been read, and no
          request is waiting on a decision.
        </Alert>
      )}
    </>
  );
}

/* ----------------------------------------------------------- analytics --- */

const SPANS = [{ v: "7", l: "7 days" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }];

/** PLANS AND EODS OVER A WINDOW, and the one comparison this module exists to
 *  make: what people said they would do against what came back.
 *
 *  `planned` and `done` are both shown. The ratio between them is drawn too,
 *  because it is the same kind of derived figure a milestone bar is — completed
 *  over total, with both numbers on screen beside it. What is NOT here is a
 *  score: no column adds up with another, nothing is weighted, and the table
 *  sorts by whichever raw count you asked for. "Meera: 78" would be a number
 *  the panel invented.
 *
 *  Progress lives here too. It is the three blocks the calendar rail draws, one
 *  level wider, and it was on the day view — where it sat between a table of
 *  who submitted what and a queue of things to approve, belonging to neither. */
function Analytics({ scope, span, onSpan }: {
  scope: Scope; span: string; onSpan: (v: string) => void;
}) {
  useReports();
  const [sort, setSort] = useState("eods");

  const days = Math.max(1, Number(span) || 7);
  const from = addDays(TODAY, -(days - 1));
  const rows = reportSpanRows(from, TODAY, scope);
  const t = reportSpanTotals(rows);
  const daily = reportSpanDays(from, TODAY, scope);

  const rank = (r: ReportSpanRow): number => {
    if (sort === "plans") return r.plans;
    if (sort === "eods") return r.eods;
    if (sort === "unread") return r.unread;
    if (sort === "planned") return r.planned;
    if (sort === "done") return r.done;
    if (sort === "kept") return r.planned ? r.done / r.planned : -1;
    return 0;
  };
  const sorted = rows.slice().sort((a, b) =>
    (sort === "name" ? 0 : rank(b) - rank(a)) || a.member.name.localeCompare(b.member.name));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented sm label="Window" value={span} onPick={onSpan}
          options={SPANS.map((o) => ({ v: o.v, l: o.l }))} />
        <span className="text-sm text-tertiary">
          {fmtDate(from)} to {fmtDate(TODAY)} · weekends excluded
        </span>
      </div>

      <Tiles list={[
        {
          k: "Plans in", v: t.planPct === null ? "—" : t.planPct + "%",
          s: t.plans + " of " + t.days + " owed",
          tone: t.planPct !== null && t.planPct < 70 ? "warn" : "",
        },
        {
          k: "Reports in", v: t.eodPct === null ? "—" : t.eodPct + "%",
          s: t.eods + " of " + t.eodsDue + " due",
          tone: t.eodPct !== null && t.eodPct < 70 ? "warn" : "",
        },
        {
          k: "Nobody read", v: String(t.unread),
          s: t.eods ? "of " + t.eods + " submitted" : "nothing submitted",
          tone: t.unread ? "warn" : "",
        },
        {
          k: "Planned, then done", v: t.keptPct === null ? "—" : t.keptPct + "%",
          s: t.done + " of " + t.planned + " lines",
        },
      ]} />

      {t.unread ? (
        <Alert tone="warn" ico="inbox"
          title={t.unread + " report" + (t.unread > 1 ? "s" : "") + " nobody has opened."}>
          The person who wrote each one believes it was read. That is the failure this number
          exists to surface — it is the only one on the page that is nobody's fault but the
          reader's.
        </Alert>
      ) : null}

      <ChartFrame title="Day by day"
        note="Plans and reports against what was owed. A day with nothing owed — a weekend, or before anybody joined — is not drawn.">
        {daily.length ? (
          <ColumnChart unit="submissions" height={220}
            series={[{ key: "plans", label: "Plan submitted", slot: 1 }, { key: "eods", label: "Report submitted", slot: 2 }]}
            points={daily.map((d) => ({
              key: d.date,
              label: d.date.slice(8) + " " + fmtDayName(d.date).slice(0, 1),
              values: { plans: d.plans, eods: d.eods },
            }))} />
        ) : (
          <EmptyState flat icon="calendar" title="Nothing was owed in this window" body="" />
        )}
      </ChartFrame>

      <SectionHead title="Per member"
        desc="Counts, and one ratio made of two of them. Every column sorts and nothing adds up to a rating." />
      {sorted.length ? (
        <ListTable min="980px"
          head={
            <tr>
              <th><SortHead k="name" label="Member" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="plans" label="Plans" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="eods" label="Reports" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="unread" label="Unread" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="planned" label="Lines planned" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="done" label="Done" cur={sort} onPick={setSort} /></th>
              <th><SortHead k="kept" label="Of those planned" cur={sort} onPick={setSort} /></th>
            </tr>
          }>
          {sorted.map((r) => (
            <tr key={r.member.memberId}>
              <td className="cell-1"><Who m={r.member} /></td>
              <td className="n">
                {r.days ? r.plans + " / " + r.days : <span className="text-quaternary">not owed</span>}
              </td>
              <td className="n">
                {r.eodsDue ? r.eods + " / " + r.eodsDue : <span className="text-quaternary">not owed</span>}
              </td>
              <td className="n">
                <span className={r.unread ? "font-medium text-warning-primary" : undefined}>{r.unread || "—"}</span>
              </td>
              <td className="n">{r.planned || "—"}</td>
              <td className="n">{r.done || "—"}</td>
              <td>
                {r.planned
                  ? <Meter value={r.done} of={r.planned}
                      tone={r.done >= r.planned * 0.8 ? "ok" : r.done >= r.planned * 0.5 ? "info" : "warn"}
                      label={<>{r.done} of {r.planned}</>} />
                  : <span className="text-quaternary">nothing planned</span>}
              </td>
            </tr>
          ))}
        </ListTable>
      ) : (
        <EmptyState icon="users" title="Nobody in scope"
          body="You see yourself and the members whose reporting line points at you." />
      )}

      <Alert tone="info">
        Anybody with no reporting line is owed nothing and reads as “not owed” rather than as a
        failure — a figure that always shows the founder delinquent is a figure people stop
        reading. An EOD counts as due only once that member&rsquo;s own day is over.
      </Alert>

      <SectionHead title="Progress" className="mt-2"
        desc="The three blocks the calendar rail draws, one level wider — you and your reports. Derived from the children, never typed."
        right={
          <Button color="secondary" ico="timeline" onClick={() => go("#/work?face=timeline")}>
            Open the milestone timeline
          </Button>
        } />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TasksBlock who={meId()} withTeam onOpen={openWork} />
        <MarksBlock kind="milestone" who={meId()} onOpen={openWork} />
        <MarksBlock kind="target" who={meId()} onOpen={openWork} />
      </div>
    </>
  );
}

/* The plan and the EOD forms are not here. They write a member's OWN day, and
   this page is a senior's review surface — one screen answering to two
   different people. They live in member/reportForms.tsx and open as dialogs
   from `/team/:id/reports`, beside the records they write into. */
