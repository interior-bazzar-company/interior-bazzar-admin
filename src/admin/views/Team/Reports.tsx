/* =============================================================================
   Reports — #/reports
   -----------------------------------------------------------------------------
     #/reports                       the record: one day, by member
     #/reports?face=actions          only the things blocked on a person
     #/reports?face=analytics        plans and EODs over a window

   THREE TABS, AND THE SPLIT IS BY WHAT YOU CAME TO DO. Reports is the record.
   Actions is the short list of things that have stopped because a specific
   person has not moved, and it carries a count so it can be read from the tab.
   Analytics is the shape of a fortnight.

   THIS PAGE IS A SENIOR'S REVIEW SURFACE AND IT ONLY READS. Writing your own
   plan and your own EOD moved to `/team/:id/reports`, where a member's records
   already live — two write controls on a screen that is otherwise entirely a
   read made the page answer to two different people at once.

   TWO FORMS AND ONE REVIEW, over the same records. A plan line CREATES OR LINKS
   a work item, and ticking that line in the EOD COMPLETES it — so "what they
   said they would do" and "what they did" is a diff rather than two paragraphs
   somebody has to compare by eye.

   THE HOURS ARE READ, NEVER TYPED. The EOD shows the attendance row and offers
   no field for it. A report that lets a person type their own hours is not a
   record of anything.

   MISSING AT 14:20 IS NOT MISSING, IT IS EARLY. An EOD only counts as
   outstanding once the member's own day is over, which is why `eodDue` takes
   the member and the clock rather than testing for a row.

   NO API YET — src/content/team/{plans,reports}.json through store.ts.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { Icon, Notice, SectionHead, StatStrip, Table, TbTitle, Tiles, qs } from "../../ui";
import { go } from "../../ui/nav";
import type { StatCell } from "../../ui";
import {
  TODAY, acknowledgeReport, addDays, attentionOf, fmtDate, fmtDayName, fmtHM, fmtTime,
  meId, pendingLeave, readMember, reportSpanDays, reportSpanRows, reportSpanTotals, scopeOf,
  unopenedAgreements, useAgreements, useLeave, useReports, useReview,
} from "./store";
import type { ReportSpanRow, ReviewRow, WorkItem } from "./store";
import { Meter, StatePill, Who } from "./bits";
import { MarksBlock, TasksBlock } from "./workBits";
import { ensureAdopted } from "./adopt";
import "./team.css";

const ROUTE = "#/reports";

export default function Reports() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  const face = FACES.some((f) => f.k === p.face) ? (p.face as string) : "reports";
  const date = p.date && p.date <= TODAY ? p.date : TODAY;
  const scope = scopeOf("reports");
  const rows = useReview(date, scope);

  usePageChrome({ crumbs: <TbTitle label="Reports" to="#/reports" /> }, face + date);

  useEffect(() => { ensureAdopted(); }, []);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
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

  return (
    <div className="dls">
      {/* THE DAY SITS WITH THE TABS. It scopes the whole page — the record,
          the queue and the window all read the same day — so it belongs beside
          what it scopes rather than in a toolbar under one of them. */}
      <div className="dls-chips tm-tabrow">
        <div className="tabs">
          {FACES.map((f) => (
            <button key={f.k} className={face === f.k ? "on" : ""}
              onClick={() => goto({ face: f.k === "reports" ? undefined : f.k })}>
              <Icon name={f.icon} size="sm" />{f.label}
              {f.k === "actions" && pending ? <span className="n">{pending}</span> : null}
            </button>
          ))}
        </div>
        <span className="spacer" />
        {face === "analytics" ? null : (
          <DateNav date={date} onPick={(d) => goto({ date: d === TODAY ? undefined : d })} />
        )}
      </div>

      {face === "reports" ? <TheDay rows={rows} /> : null}

      {face === "actions" ? <Actions rows={rows} /> : null}
      {face === "analytics" ? (
        <Analytics scope={scope} span={p.span || "7"}
          onSpan={(v) => goto({ span: v === "7" ? undefined : v })} />
      ) : null}
    </div>
  );
}

/* ORDER IS URGENCY. The record is what the page is for, Actions is the only tab
   that can be waiting on the reader, and the shape of a fortnight comes last. */
const FACES = [
  { k: "reports", label: "Reports", icon: "doc" },
  { k: "actions", label: "Actions", icon: "inbox" },
  { k: "analytics", label: "Analytics", icon: "chart" },
];

/** Step a day, or pick one. Same control as the attendance toolbar, and `max`
 *  is what refuses a future date rather than a disabled button somebody routes
 *  around by typing the URL. */
function DateNav({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  return (
    <div className="tm-datenav">
      <button className="btn icon sm" aria-label="Previous day" onClick={() => onPick(addDays(date, -1))}>
        <Icon name="chevl" size="sm" />
      </button>
      <input type="date" className="inp sm tm-datef" value={date} max={TODAY}
        aria-label="Show this day"
        onChange={(e) => { if (e.target.value && e.target.value <= TODAY) onPick(e.target.value); }} />
      <button className="btn icon sm" aria-label="Next day" disabled={date >= TODAY}
        onClick={() => onPick(addDays(date, 1))}>
        <Icon name="chevr" size="sm" />
      </button>
      <button className="btn sm" disabled={date === TODAY} onClick={() => onPick(TODAY)}>Today</button>
    </div>
  );
}

/* -------------------------------------------------------------- the day --- */

/** THE RECORD, for one day. Who was in, what they said they would do, and what
 *  came back. The two blocks that used to sit on top of it — the attention
 *  cards and "waiting on you" — are the Actions tab now: they are things to DO,
 *  and burying them above a table is how a queue gets missed. */
function TheDay({ rows }: { rows: ReviewRow[] }) {
  const shell = useShell();
  const a = attentionOf(rows);
  const cells: (StatCell | "sep")[] = [
    { k: "in scope", v: rows.length },
    "sep",
    { k: "no plan", v: a.noPlan.length, dot: a.noPlan.length ? "warn" : "" },
    { k: "EOD due", v: a.noEod.length, dot: a.noEod.length ? "warn" : "" },
    "sep",
    { k: "overdue", v: a.delayed.length, dot: a.delayed.length ? "warn" : "" },
    { k: "waiting", v: a.waiting.length, dot: a.waiting.length ? "bad" : "" },
    "sep",
    { k: "late or absent", v: a.lateOrAbsent.length, dot: a.lateOrAbsent.length ? "warn" : "" },
    { k: "on leave", v: rows.filter((r) => r.state === "on_leave").length, dot: "info" },
    { k: "unread reports", v: a.unacknowledged.length, dot: a.unacknowledged.length ? "info" : "" },
  ];

  return (
    <>
      <StatStrip cells={cells} />
      {/* `tm-pane` because the strip below the tabs ends in a rule and `.dls-body`
          carries no top padding by design — without it the table's header sits
          directly on that line and the two read as one welded band. */}
      <div className="dls-body tm-pane">
        {/* No heading and no banner. The tab says Reports, the date sits beside
            it, and the strip above counts the rows — a title repeating all
            three, over a table whose columns are already labelled, is a line
            nobody reads twice. The count of what needs moving lives on the
            Actions tab, which carries it as a badge. */}
        <Table
          scroll min="1040px"
          cols={[
            { label: "", w: "3px" },
            { label: "Member" },
            { label: "In", w: "92px" },
            { label: "Worked", cls: "n", w: "92px" },
            { label: "Plan", cls: "c", w: "80px" },
            { label: "Doing now", w: "220px" },
            { label: "Done", cls: "c", w: "80px" },
            { label: "EOD", w: "150px" },
          ]}
          empty={{ icon: "users", title: "Nobody in scope", body: "You see yourself and the members whose reporting line points at you." }}
          rows={rows.map((r) => {
            const rail = r.state === "absent" ? "u-bad"
              : (r.day && r.day.isLate) || r.delayed || r.waiting ? "u-warn" : "";
            return (
              <tr key={r.member.memberId} className={rail}>
                <td className="rail"><i className={rail} /></td>
                <td>
                  <Who m={r.member} />
                  {r.delayed || r.waiting ? (
                    <span className="cell-2">
                      {r.delayed ? r.delayed + " overdue" : null}
                      {r.delayed && r.waiting ? " · " : null}
                      {r.waiting ? r.waiting + " waiting" : null}
                    </span>
                  ) : null}
                </td>
                <td className="tnum">
                  {r.day ? fmtTime(r.day.startedAt) : <StatePill state={r.state} />}
                  {r.day && r.day.isLate ? <b className="tm-late">late</b> : null}
                </td>
                <td className="n tnum">{r.worked != null ? fmtHM(r.worked) : "—"}</td>
                <td className="c">
                  {r.plan && r.plan.submittedAt
                    ? <span className="pill ok xs" title={"Submitted " + fmtTime(r.plan.submittedAt)}>{r.plan.lines.length}</span>
                    : r.plan
                      ? <span className="pill xs" title="Started and not submitted">draft</span>
                      : <span className="pill warn xs">—</span>}
                </td>
                <td>{r.doing
                  ? <a data-go={"#/work?item=" + r.doing.itemId} className="tm-doing"
                      onClick={() => openWork((r.doing as WorkItem).itemId)}>{r.doing.title}</a>
                  : <span className="dim">—</span>}</td>
                <td className="c tnum">{r.planned ? r.done + "/" + r.planned : "—"}</td>
                <td>
                  {r.report && r.report.submittedAt ? (
                    r.report.acknowledgedById
                      ? <span className="pill ok xs">read</span>
                      : <button className="btn sm" onClick={() => {
                        const res = acknowledgeReport((r.report as { reportId: string }).reportId);
                        shell.toast(res.ok ? "Marked read" : res.message, res.ok ? undefined : "bad");
                      }}>Mark read</button>
                  ) : r.eodDue
                    ? <span className="pill warn xs">outstanding</span>
                    : <span className="dim">not due yet</span>}
                </td>
              </tr>
            );
          })}
        />
      </div>
    </>
  );
}

const openWork = (id: string) => go("#/work" + qs({ item: id }));

/* ------------------------------------------------------------- actions --- */

/** ONLY THE THINGS BLOCKED ON A PERSON. Every card is one query rather than a
 *  feed, and the tab carries the count so an empty queue does not have to be
 *  opened to be discovered empty.
 *
 *  It renders its own empty state rather than nothing: a tab that draws a blank
 *  page reads as broken, and "nothing needs you" is a genuinely useful sentence
 *  at five in the afternoon. */
function Actions({ rows }: { rows: ReviewRow[] }) {
  const a = attentionOf(rows);
  const anything = a.noPlan.length || a.noEod.length || a.delayed.length
    || a.waiting.length || a.lateOrAbsent.length || a.unacknowledged.length;

  return (
    <div className="dls-body tm-pane">
      <SectionHead title="Needs attention"
        desc="Each card is a filter over the same rows the Reports tab lists — a count and the list it opens cannot disagree." />
      {anything ? (
        <div className="tm-attn">
          <AttnCard title="No plan submitted" tone="warn"
            names={a.noPlan.map((r) => r.member.name)}
            note="Anybody with no reporting line is excluded — a number that always shows the founder delinquent is one people learn to ignore." />
          <AttnCard title="EOD outstanding" tone="warn"
            names={a.noEod.map((r) => r.member.name)}
            note="Counted only once that member's own day is over." />
          <AttnCard title="Overdue work" tone="warn"
            names={a.delayed.map((i) => i.title)} to="#/work?status=delayed" />
          <AttnCard title="Waiting on another item" tone="bad"
            names={a.waiting.map((i: WorkItem) => i.title)} to="#/work?wait=1" />
          <AttnCard title="Late or absent" tone="warn"
            names={a.lateOrAbsent.map((r) => r.member.name)} to="#/attendance" />
          <AttnCard title="Reports nobody has read" tone="info"
            names={a.unacknowledged.map((r) => r.member.name)}
            note="A report nobody read is worse than one nobody wrote — the person who wrote it believes it was read." />
        </div>
      ) : (
        <Notice tone="ok" ico="check" text="Nothing needs you. Every plan is in, no work is overdue or blocked, and every report has been read." />
      )}

      <WaitingOnYou rows={rows} />
    </div>
  );
}

/** §3.12 — not the work, the things only THIS reader can move: a leave request
 *  waits for a decision, a submitted EOD waits to be read, a sent agreement
 *  waits to be opened. Renders only when something is in it. */
function WaitingOnYou({ rows }: { rows: ReviewRow[] }) {
  useLeave(); useAgreements();
  const scope = scopeOf("reports");
  const leave = pendingLeave(scope);
  const unread = rows.filter((r) => r.report && r.report.submittedAt && !r.report.acknowledgedById);
  const unopened = unopenedAgreements(scope);
  if (!leave.length && !unread.length && !unopened.length) return null;
  return (
    <>
      <SectionHead title="Waiting on you" desc="Not the work — the things only you can move." />
      <div className="tm-attn">
        {leave.length ? (
          <div className="tm-attn-c warn">
            <b>{leave.length} leave request{leave.length > 1 ? "s" : ""}</b>
            <ul>{leave.slice(0, 4).map((l) => (
              <li key={l.leaveId}>{readMember(l.memberId)?.name || l.memberId} · {fmtDate(l.fromDate)}</li>
            ))}</ul>
            <a data-go="#/attendance" onClick={() => go("#/attendance")}>Decide →</a>
          </div>
        ) : null}
        {unread.length ? (
          <div className="tm-attn-c info">
            <b>{unread.length} EOD{unread.length > 1 ? "s" : ""} to read</b>
            <ul>{unread.slice(0, 4).map((r) => <li key={r.member.memberId}>{r.member.name}</li>)}</ul>
            <span className="tm-attn-n">Mark read on the table below — the writer believes it was read.</span>
          </div>
        ) : null}
        {unopened.length ? (
          <div className="tm-attn-c warn">
            <b>{unopened.length} agreement{unopened.length > 1 ? "s" : ""} never opened</b>
            <ul>{unopened.slice(0, 4).map((a) => (
              <li key={a.agreementId}>
                <a data-go={"#/team/" + a.memberId + "?tab=documents"}
                  onClick={() => go("#/team/" + a.memberId + "?tab=documents")}>
                  {readMember(a.memberId)?.name || a.memberId}</a> · {a.title}
              </li>
            ))}</ul>
          </div>
        ) : null}
      </div>
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
  scope: ReturnType<typeof scopeOf>; span: string; onSpan: (v: string) => void;
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

  const col = (k: string, label: string, w?: string) => ({
    label: (
      <button className={"tm-sort" + (sort === k ? " on" : "")} onClick={() => setSort(k)}
        aria-pressed={sort === k}>
        {label}{sort === k ? <Icon name="chev" size="sm" /> : null}
      </button>
    ),
    cls: k === "name" ? "" : "n",
    w,
  });

  return (
    <>
      <div className="dls-cmd">
        <span className="btn-group">
          {SPANS.map((o) => (
            <button key={o.v} className={span === o.v ? "on" : ""} onClick={() => onSpan(o.v)}>{o.l}</button>
          ))}
        </span>
        <span className="dim">{fmtDate(from)} to {fmtDate(TODAY)} · weekends excluded</span>
        <span className="spacer" />
      </div>

      <div className="dls-body">
        <Tiles list={[
          {
            k: "Plans in", v: t.planPct === null ? "\u2014" : t.planPct + "%",
            s: t.plans + " of " + t.days + " owed",
            tone: t.planPct !== null && t.planPct < 70 ? "warn" : "",
          },
          {
            k: "Reports in", v: t.eodPct === null ? "\u2014" : t.eodPct + "%",
            s: t.eods + " of " + t.eodsDue + " due",
            tone: t.eodPct !== null && t.eodPct < 70 ? "warn" : "",
          },
          {
            k: "Nobody read", v: String(t.unread),
            s: t.eods ? "of " + t.eods + " submitted" : "nothing submitted",
            tone: t.unread ? "warn" : "",
          },
          {
            k: "Planned, then done", v: t.keptPct === null ? "\u2014" : t.keptPct + "%",
            s: t.done + " of " + t.planned + " lines",
          },
        ]} />

        {t.unread ? (
          <Notice tone="warn" ico="inbox" text={
            <><b>{t.unread} report{t.unread > 1 ? "s" : ""} nobody has opened.</b> The person who
              wrote each one believes it was read. That is the failure this number exists to
              surface — it is the only one on the page that is nobody's fault but the reader's.</>
          } />
        ) : null}

        <SectionHead title="Day by day"
          desc="Plans and reports against what was owed. A day with nothing owed — a weekend, or before anybody joined — is not drawn." />
        <div className="tm-an-days">
          <div className="tm-an-plot">
            {daily.map((d) => {
              const top = Math.max(1, d.owed, d.eodsDue);
              return (
                <span key={d.date} className={"tm-an-day" + (d.date === TODAY ? " today" : "")}>
                  <span className="tm-an-pair" role="img"
                    aria-label={fmtDate(d.date) + ": " + d.plans + " of " + d.owed + " plans, "
                      + d.eods + " of " + d.eodsDue + " reports, " + d.unread + " unread"}>
                    <i className="pl" style={{ height: (d.plans / top) * 100 + "%" }}
                      title={d.plans + " of " + d.owed + " plans"} />
                    <i className="eo" style={{ height: (d.eods / top) * 100 + "%" }}
                      title={d.eods + " of " + d.eodsDue + " reports"} />
                  </span>
                  <b>{d.date.slice(8)}</b>
                  <i>{fmtDayName(d.date).slice(0, 1)}</i>
                </span>
              );
            })}
          </div>
          <span className="tm-an-key">
            <span><i className="pl" />plan submitted</span>
            <span><i className="eo" />report submitted</span>
            <span className="dim">against what was owed that day</span>
          </span>
        </div>

        <SectionHead title="Per member"
          desc="Counts, and one ratio made of two of them. Every column sorts and nothing adds up to a rating." />
        <Table
          scroll min="940px"
          cols={[col("name", "Member"), col("plans", "Plans", "110px"), col("eods", "Reports", "120px"),
            col("unread", "Unread", "110px"), col("planned", "Lines planned", "140px"),
            col("done", "Done", "100px"), col("kept", "Of those planned", "200px")]}
          empty={{ icon: "users", title: "Nobody in scope", body: "You see yourself and the members whose reporting line points at you." }}
          rows={sorted.map((r) => (
            <tr key={r.member.memberId}>
              <td><Who m={r.member} /></td>
              <td className="n tnum">
                {r.days ? r.plans + " / " + r.days : <span className="dim">not owed</span>}
              </td>
              <td className="n tnum">
                {r.eodsDue ? r.eods + " / " + r.eodsDue : <span className="dim">not owed</span>}
              </td>
              <td className={"n tnum" + (r.unread ? " u-warn" : "")}>{r.unread || "\u2014"}</td>
              <td className="n tnum">{r.planned || "\u2014"}</td>
              <td className="n tnum">{r.done || "\u2014"}</td>
              <td>
                {r.planned
                  ? <Meter value={r.done} of={r.planned}
                      tone={r.done >= r.planned * 0.8 ? "ok" : r.done >= r.planned * 0.5 ? "info" : "warn"}
                      label={<>{r.done} of {r.planned}</>} />
                  : <span className="dim">nothing planned</span>}
              </td>
            </tr>
          ))} />

        <Notice text={
          "Anybody with no reporting line is owed nothing and reads as \u201cnot owed\u201d rather than as a "
          + "failure \u2014 a figure that always shows the founder delinquent is a figure people stop reading. "
          + "An EOD counts as due only once that member's own day is over."} />

        <SectionHead title="Progress"
          desc="The three blocks the calendar rail draws, one level wider — you and your reports. Derived from the children, never typed."
          right={<button className="btn sm" onClick={() => go("#/work?face=timeline")}>
            Open the milestone timeline
          </button>} />
        <div className="tm-cols3 tm-gap-b">
          <TasksBlock who={meId()} withTeam onOpen={openWork} />
          <MarksBlock kind="milestone" who={meId()} onOpen={openWork} />
          <MarksBlock kind="target" who={meId()} onOpen={openWork} />
        </div>
      </div>
    </>
  );
}

function AttnCard({ title, tone, names, note, to }: {
  title: string; tone: string; names: string[]; note?: string; to?: string;
}) {
  if (!names.length) return null;
  return (
    <div className={"tm-attn-c " + tone}>
      <b>{names.length} {title.toLowerCase()}</b>
      <ul>{names.slice(0, 4).map((n, i) => <li key={i}>{n}</li>)}</ul>
      {names.length > 4 ? <span className="dim">+{names.length - 4} more</span> : null}
      {to ? <a data-go={to} onClick={() => go(to)}>Open →</a> : null}
      {note ? <span className="tm-attn-n">{note}</span> : null}
    </div>
  );
}

/* The plan and the EOD forms are not here any more. They write a member's OWN
   day, and this page is a senior's review surface — one screen answering to two
   different people. They live in member/reportForms.tsx and open as dialogs
   from `/team/:id/reports`, beside the records they write into. */
