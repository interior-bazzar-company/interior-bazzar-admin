/* =============================================================================
   /team/:id/attendance — the fortnight, day by day.
   -----------------------------------------------------------------------------
   AN ABSENCE IS THE LACK OF A ROW. `absent`, `unclosed` and `on_leave` are all
   derived at read against the clock and never stored, so this page cannot show
   a state that disagrees with the strip in the topbar — there is only one
   computation and both call it.

   `isLate` IS stored, and it is the exception that proves the rule: it is
   written once, when the day opens, against that member's own start time.
   Changing the policy tomorrow must not make last month late.

   THE CLOCK IS READ-ONLY HERE. Start, break, resume and end live in the topbar
   and on /attendance. Three "End the day" buttons over one open day is two
   chances for the panel to disagree with itself mid-request; this page states
   the day, the other two change it.
   ============================================================================= */
import { Notice, Pill, Table, Tiles } from "../../../ui";
import { go } from "../../../ui/nav";
import {
  TODAY, addDays, attendanceTotals, dayRows, fmtDate, fmtDayName, fmtHM, isWeekend, leaveFor,
  now as clockNow, onLeave, workedOf,
} from "../store";
import type { DayRow, Member } from "../store";
import { BarScale, DayBar, StatePill } from "../bits";
import type { Viewer } from "./ops";
import { OpHead, memberHref } from "./frame";

const WINDOW = 14;

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

  return (
    <>
      <OpHead
        title="Attendance"
        desc={"The last " + WINDOW + " days, as the derivation sees them. The clock itself lives in the topbar."}
        right={<button className="btn" onClick={() => go(memberHref(m.memberId, "leave"))}>
          Leave{pending ? <span className="n">{pending}</span> : null}
        </button>} />

      <Tiles list={[
        { k: "Present", v: String(tot.present), s: "of " + rows.length + " days listed" },
        { k: "Late", v: String(tot.late), s: "against their own " + m.dayStartsAt + " start", tone: tot.late ? "warn" : "" },
        { k: "Absent", v: String(tot.absent), s: covered ? covered + " other days covered by leave" : "derived, never stored", tone: tot.absent ? "bad" : "" },
        { k: "Unclosed", v: String(tot.unclosed), s: "nothing auto-closes", tone: tot.unclosed ? "warn" : "" },
      ]} />

      {tot.unclosed ? (
        <Notice tone="warn" ico="clock" text={
          <><b>{tot.unclosed} day{tot.unclosed > 1 ? "s were" : " was"} never closed.</b> An unclosed
            day counts as nothing — not as a full day and not as an absence — until the person who
            opened it resolves it. Nothing in the panel closes a day on somebody's behalf.</>
        } />
      ) : null}

      <div className="sh">
        <h2>Day by day</h2>
        <span className="d">The bar is the working window; the fill is time actually worked.</span>
        <span className="r"><BarScale /></span>
      </div>

      <Table
        cols={[{ label: "Day", w: "170px" }, { label: "State", w: "150px" },
          { label: "The day", w: "300px" }, { label: "Worked", w: "120px" },
          { label: "Break", w: "110px" }, { label: "Note" }]}
        empty={{
          icon: "clock", title: "No attendance",
          body: "No day has been opened in this window. Every one of them derives as absent or as a non-working day.",
        }}
        rows={rows.slice().reverse().map(({ d, row }) => {
          const lv = onLeave(m.memberId, d);
          return (
            <tr key={d} className={isWeekend(d) ? "dim" : ""}>
              <td>
                <span className="cell-1">{fmtDayName(d)}</span>
                <span className="cell-2">{fmtDate(d)}</span>
              </td>
              <td><StatePill state={row.state} /></td>
              <td><DayBar row={row} nowH={nowH} /></td>
              <td className="tnum">{row.day ? fmtHM(workedOf(row.day, m)) : "—"}</td>
              <td className="tnum">{row.day ? fmtHM(row.day.breakMinutes) : "—"}</td>
              <td>
                {lv ? <Pill text="on leave" tone="info" />
                  : isWeekend(d) ? <span className="dim">not a working day</span>
                    : row.day && row.day.isLate ? <span className="u-warn">late at the open</span>
                      : <span className="dim">—</span>}
              </td>
            </tr>
          );
        })} />

      {viewer === "admin" ? (
        <p className="tm-foot">
          Correcting an entry is an admin's act and it belongs on the attendance module, where the
          correction is written with a reason beside it.
        </p>
      ) : null}
    </>
  );
}
