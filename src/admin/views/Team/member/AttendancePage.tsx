/* =============================================================================
   /team/:id/attendance — the month, and then the fortnight day by day.
   -----------------------------------------------------------------------------
   AN ABSENCE IS THE LACK OF A ROW. `absent`, `unclosed` and `on_leave` are all
   derived at read against the clock and never stored, so this page cannot show
   a state that disagrees with the strip in the topbar — there is only one
   computation and both call it.

   `isLate` IS stored, and it is the exception that proves the rule: it is
   written once, when the day opens, against that member's own start time.
   Changing the policy tomorrow must not make last month late.

   THE MONTH GRID LEADS. A table of fourteen rows answers "what happened on the
   eleventh"; only a calendar answers "how has this month gone", and a run of
   amber down one column is a Monday problem no list would ever show. The table
   under it is the same window with the shape of each day in it.

   THE CLOCK IS READ-ONLY HERE. Start, break, resume and end live in the topbar
   and on /attendance. Three "End the day" buttons over one open day is two
   chances for the panel to disagree with itself mid-request; this page states
   the day, the other two change it.
   ============================================================================= */
import { Alert, Button, Card, ListTable, Pill, Tiles } from "../../../ui";
import { go } from "../../../ui/nav";
import {
  TODAY, addDays, attendanceTotals, dayRows, fmtDate, fmtDayName, fmtHM, isWeekend, leaveFor,
  now as clockNow, onLeave, workedOf,
} from "../store";
import type { DayRow, Member } from "../store";
import { BarScale, DayBar, MonthGrid, MonthKey, StatePill } from "../bits";
import type { MonthCell } from "../bits";
import type { Viewer } from "./ops";
import { OpHead, memberHref } from "./frame";

const WINDOW = 14;

const KEY = [
  { tone: "ok", label: "Worked" },
  { tone: "warn", label: "Late or unclosed" },
  { tone: "bad", label: "Absent" },
  { tone: "info", label: "On leave" },
];

export default function AttendancePage({ m, viewer }: { m: Member; viewer: Viewer }) {
  const days: string[] = [];
  for (let i = WINDOW - 1; i >= 0; i--) days.push(addDays(TODAY, -i));

  const rows = days
    .map((d) => ({ d, row: dayRows(d, "all").filter((r) => r.member.memberId === m.memberId)[0] }))
    .filter((x) => !!x.row) as { d: string; row: DayRow }[];

  const tot = attendanceTotals(rows.map((x) => x.row));
  const at = new Date(clockNow());
  const nowH = at.getHours() + at.getMinutes() / 60;
  const covered = rows.filter((x) => !!onLeave(m.memberId, x.d)).length;
  const pending = leaveFor(m.memberId).filter((l) => l.state === "requested").length;

  /* The calendar the fortnight sits inside. Days the window cannot answer for
     are drawn as ground and carry no state — a blank that read as "absent"
     would be this screen inventing a fact it has not been given. */
  const known: Record<string, DayRow> = {};
  rows.forEach((x) => { known[x.d] = x.row; });
  const month = monthCells(TODAY, known, m);

  return (
    <div className="flex flex-col gap-5">
      <OpHead
        title="Attendance"
        desc={"The last " + WINDOW + " days, as the derivation sees them. The clock itself lives in the topbar."}
        right={
          <Button color="secondary" ico="calendar" onClick={() => go(memberHref(m.memberId, "leave"))}>
            Leave{pending ? " · " + pending : ""}
          </Button>
        } />

      <Tiles list={[
        { k: "Present", v: String(tot.present), s: "of " + rows.length + " days listed" },
        { k: "Late", v: String(tot.late), s: "against their own " + m.dayStartsAt + " start", tone: tot.late ? "warn" : "" },
        { k: "Absent", v: String(tot.absent), s: covered ? covered + " other days covered by leave" : "derived, never stored", tone: tot.absent ? "bad" : "" },
        { k: "Unclosed", v: String(tot.unclosed), s: "nothing auto-closes", tone: tot.unclosed ? "warn" : "" },
      ]} />

      {tot.unclosed ? (
        <Alert tone="warn" ico="clock"
          title={tot.unclosed + " day" + (tot.unclosed > 1 ? "s were" : " was") + " never closed"}>
          An unclosed day counts as nothing — not as a full day and not as an absence — until the
          person who opened it resolves it. Nothing in the panel closes a day on somebody's behalf.
        </Alert>
      ) : null}

      <Card
        title="This month"
        sub="Every day of the month; the ones outside the window this page reads carry no state."
        ticks
      >
        {/* THE GRID IS CAPPED, and the key stands beside it rather than under
            it. A seven-column calendar stretched to 1100px gives 150px cells
            holding one number and one dot — the shape stops being a calendar
            and becomes a wall of empty boxes. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,34rem)_1fr] lg:gap-8">
          <MonthGrid cells={month} />
          <div className="flex flex-col gap-3">
            <MonthKey items={KEY} />
            <p className="text-xs text-quaternary">
              A run of amber down one column is a Monday problem, and no list would ever show it.
              The figure in a cell is time actually worked; a cell with no dot is a day this page
              holds no answer for.
            </p>
          </div>
        </div>
      </Card>

      <section className="flex flex-col">
        <OpHead
          title="Day by day"
          desc="The bar is the working window; the fill is time actually worked." />
        <ListTable min="58rem" head={<tr>
          <th scope="col">Day</th>
          <th scope="col">State</th>
          {/* THE SCALE BELONGS OVER THE THING IT MEASURES. It used to sit in
              the section head, on the far right of the page and a column and a
              half away from the bars it labels, which made it read as loose
              numbers rather than as an axis. */}
          <th scope="col">
            The day
            <BarScale />
          </th>
          <th scope="col" className="n">Worked</th>
          <th scope="col" className="n">Break</th>
          <th scope="col">Note</th>
        </tr>}>
          {rows.slice().reverse().map(({ d, row }) => {
            const lv = onLeave(m.memberId, d);
            return (
              /* A weekend is listed so a gap is never read as a missed day, and
                 it is dimmed so it never competes with one. */
              <tr key={d} className={isWeekend(d) ? "opacity-60" : undefined}>
                <td className="cell-1">
                  {fmtDayName(d)}
                  <span className="block cell-2 tnum">{fmtDate(d)}</span>
                </td>
                <td><StatePill state={row.state} /></td>
                <td><DayBar row={row} nowH={nowH} /></td>
                <td className="n">{row.day ? fmtHM(workedOf(row.day, m)) : "—"}</td>
                <td className="n">{row.day ? fmtHM(row.day.breakMinutes) : "—"}</td>
                <td>
                  {lv ? <Pill xs dot tone="info" text="on leave" />
                    : isWeekend(d) ? <span className="text-quaternary">not a working day</span>
                      : row.day && row.day.isLate ? <span className="text-warning-primary">late at the open</span>
                        : <span className="text-quaternary">—</span>}
                </td>
              </tr>
            );
          })}
          {rows.length ? null : (
            <tr>
              <td colSpan={6} className="p-0!">
                <div className="px-6 py-10 text-center text-sm text-tertiary">
                  No day has been opened in this window. Every one of them derives as absent or as a
                  non-working day.
                </div>
              </td>
            </tr>
          )}
        </ListTable>
      </section>

      {viewer === "admin" ? (
        <p className="text-xs text-quaternary">
          Correcting an entry is an admin's act and it belongs on the attendance module, where the
          correction is written with a reason beside it.
        </p>
      ) : null}
    </div>
  );
}

/* THE CALENDAR, built from the month `today` falls in. Sunday-first, because
   that is what the day-name strip everywhere else in this module uses. */
function monthCells(today: string, known: Record<string, DayRow>, m: Member): MonthCell[] {
  const first = today.slice(0, 8) + "01";
  const start = new Date(first + "T00:00:00");
  const lead = start.getDay();
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  const out: MonthCell[] = [];
  for (let i = 0; i < total; i++) {
    const date = addDays(first, i - lead);
    const outside = date.slice(0, 7) !== first.slice(0, 7);
    const row = known[date] || null;
    const lv = !outside && !!onLeave(m.memberId, date);
    out.push({
      date,
      state: outside ? null : lv && !(row && row.day) ? "on_leave" : row ? row.state : null,
      worked: row && row.day ? workedOf(row.day, m) : null,
      late: !!(row && row.day && row.day.isLate),
      weekend: isWeekend(date),
      today: date === today,
      outside,
    });
  }
  return out;
}
