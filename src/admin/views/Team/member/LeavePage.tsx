/* =============================================================================
   /team/:id/leave — one person's leave, whole.
   -----------------------------------------------------------------------------
   THE RULE THIS PAGE IS BUILT ON, and it is the module's most load-bearing one:
   approved leave SUPPRESSES a derived absence and never writes an attendance
   row. `absent` is "no day opened, the business day is over, on a working day
   — AND no approved leave covers this date". One clause, one file. Leave that
   wrote a row would be a second answer to "was this person in", and two answers
   disagree inside a month.

   So the calendar strip below is drawn from the leave records against the same
   dates the derivation reads, not from anything stored on a day. What you see
   is what the derivation sees.
   ============================================================================= */
import { Notice, Pill, Table } from "../../../ui";
import { useShell } from "../../../shell/ShellContext";
import {
  LEAVE_KIND, LEAVE_STATE, TODAY, addDays, datesIn, decideLeave, fmtDate, isWeekend, labelOf,
  leaveFor, meId, onLeave, readMember, toneOf, useLeave,
} from "../store";
import type { LeaveRequest, Member } from "../store";
import type { Viewer } from "./ops";
import { OpHead } from "./frame";
import { LeaveDecideModal, LeaveRequestModal } from "./modals";

export default function LeavePage({ m, viewer }: { m: Member; viewer: Viewer }) {
  const shell = useShell();
  useLeave();
  const rows = leaveFor(m.memberId).slice().reverse();
  const me = meId();

  /* WHO MAY DECIDE is the reporting line and nothing else. An admin acting on
     somebody who does not report to them is a correction, not an approval, and
     it goes through the same two buttons — the difference is only that a
     senior's authority is derived and an admin's is granted. */
  const canDecide = viewer !== "self" && (m.reportsTo === me || viewer === "admin");
  const waiting = rows.filter((l) => l.state === "requested");

  const withdraw = (l: LeaveRequest) => {
    const r = decideLeave(l.leaveId, "withdrawn", me);
    shell.toast(r.ok ? "Withdrawn." : (r as { message: string }).message, r.ok ? "" : "bad");
  };

  return (
    <>
      <OpHead
        title="Leave"
        desc="Requested, decided, and the days an approval covers."
        right={viewer === "self"
          ? <button className="btn pri" onClick={() => shell.modal(<LeaveRequestModal memberId={m.memberId} />)}>
            Request leave
          </button>
          : null} />

      {waiting.length && canDecide ? (
        <Notice tone="warn" ico="clock" text={
          <><b>{waiting.length} request{waiting.length > 1 ? "s" : ""} waiting on you.</b> Until you
            decide, those days still read as absent on {m.name.split(" ")[0]}'s attendance.</>
        } />
      ) : null}

      <LeaveStrip m={m} />

      <Table
        cols={[{ label: "Dates", w: "210px" }, { label: "Kind", w: "120px" },
          { label: "State", w: "150px" }, { label: "Reason" }, { label: "", w: "200px" }]}
        empty={{
          icon: "calendar", title: "No leave on record",
          body: "Nothing requested and nothing taken. An absence here would be a derived one — a day nobody opened.",
        }}
        rows={rows.map((l) => {
          const days = datesIn(l.fromDate, l.toDate).length;
          const decider = l.decidedById ? readMember(l.decidedById) : null;
          return (
            <tr key={l.leaveId}>
              <td>
                <span className="cell-1">
                  {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fmtDate(l.toDate) : ""}
                </span>
                <span className="cell-2">{days} day{days === 1 ? "" : "s"} · asked {fmtDate(l.requestedAt.slice(0, 10))}</span>
              </td>
              <td>{labelOf(LEAVE_KIND, l.kind)}</td>
              <td>
                <Pill text={labelOf(LEAVE_STATE, l.state)} tone={toneOf(LEAVE_STATE, l.state)} />
                {decider ? <span className="cell-2">by {decider.name}</span> : null}
              </td>
              <td>
                <span className="cell-1">{l.reason}</span>
                {l.decisionNote ? <span className="cell-2">{l.decisionNote}</span> : null}
              </td>
              <td>
                {l.state === "requested" && canDecide ? (
                  <>
                    <button className="btn sm" onClick={() =>
                      shell.modal(<LeaveDecideModal l={l} state="rejected" />)}>Refuse…</button>
                    <button className="btn pri sm" onClick={() =>
                      shell.modal(<LeaveDecideModal l={l} state="approved" />)}>Approve…</button>
                  </>
                ) : null}
                {l.state === "requested" && viewer === "self"
                  ? <button className="btn sm" onClick={() => withdraw(l)}>Withdraw</button>
                  : null}
                {l.state !== "requested" ? <span className="dim">decided</span> : null}
              </td>
            </tr>
          );
        })} />

      <p className="tm-foot">
        There is no quota. A quota needs an accrual policy, a carry-forward rule and a year-end
        job — the days are recorded here and counted in a report instead.
      </p>
    </>
  );
}

/* ------------------------------------------------------------- the strip --- */

/** THE NEXT FORTNIGHT, so an approval has a shape and not just a date range.
 *  Only APPROVED leave paints a cell: a pending request changes nothing about
 *  whether somebody is absent, and drawing it as though it did would be the
 *  screen deciding on the approver's behalf. */
function LeaveStrip({ m }: { m: Member }) {
  const days = datesIn(TODAY, addDays(TODAY, 20));
  const any = days.some((d) => !!onLeave(m.memberId, d));
  return (
    <div className="tm-lvstrip" role="group" aria-label="The next three weeks">
      {days.map((d) => {
        const l = onLeave(m.memberId, d);
        const cls = "tm-lvd" + (l ? " on" : "") + (isWeekend(d) ? " we" : "") + (d === TODAY ? " today" : "");
        return (
          <span key={d} className={cls}
            title={fmtDate(d) + (l ? " · " + labelOf(LEAVE_KIND, l.kind) + " leave"
              : isWeekend(d) ? " · not a working day" : "")}>
            <b>{d.slice(8)}</b>
            <i>{["S", "M", "T", "W", "T", "F", "S"][new Date(d + "T00:00:00").getDay()]}</i>
          </span>
        );
      })}
      <span className="tm-lvkey">
        {any ? "Shaded days are covered by an approval." : "Nothing approved in the next three weeks."}
        {" "}A pending request paints nothing — it changes no derivation until somebody decides it.
      </span>
    </div>
  );
}
