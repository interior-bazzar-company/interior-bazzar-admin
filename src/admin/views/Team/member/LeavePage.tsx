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
import { Alert, Button, Card, ListTable, Pill } from "../../../ui";
import { cx } from "@/utils/cx";
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
    <div className="flex flex-col gap-5">
      <OpHead
        title="Leave"
        desc="Requested, decided, and the days an approval covers."
        right={viewer === "self"
          ? (
            <Button color="primary" ico="plus"
              onClick={() => shell.modal(<LeaveRequestModal memberId={m.memberId} />)}>
              Request leave
            </Button>
          )
          : null} />

      {waiting.length && canDecide ? (
        <Alert tone="warn" ico="clock"
          title={waiting.length + " request" + (waiting.length > 1 ? "s" : "") + " waiting on you"}>
          Until you decide, those days still read as absent on {m.name.split(" ")[0]}'s attendance.
        </Alert>
      ) : null}

      <LeaveStrip m={m} />

      <ListTable min="56rem" head={<tr>
        <th className="rail" />
        <th scope="col">Dates</th>
        <th scope="col">Kind</th>
        <th scope="col">State</th>
        <th scope="col">Reason</th>
        <th scope="col" className="acts"><span className="sr-only">Decision</span></th>
      </tr>}>
        {rows.map((l) => {
          const days = datesIn(l.fromDate, l.toDate).length;
          const decider = l.decidedById ? readMember(l.decidedById) : null;
          const tone = toneOf(LEAVE_STATE, l.state);
          return (
            <tr key={l.leaveId}>
              <td className="rail">
                <i aria-hidden="true" className={cx(
                  "absolute inset-y-1.5 left-0 w-[3px] rounded-r-full",
                  l.state === "requested" ? "bg-utility-yellow-500" : "bg-transparent",
                )} />
              </td>
              <td className="cell-1">
                {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fmtDate(l.toDate) : ""}
                <span className="block cell-2 tnum">
                  {days} day{days === 1 ? "" : "s"} · asked {fmtDate(l.requestedAt.slice(0, 10))}
                </span>
              </td>
              <td>{labelOf(LEAVE_KIND, l.kind)}</td>
              <td>
                <Pill xs dot text={labelOf(LEAVE_STATE, l.state)} tone={tone} />
                {decider ? <span className="block cell-2">by {decider.name}</span> : null}
              </td>
              <td className="cell-1">
                {l.reason}
                {l.decisionNote ? <span className="block cell-2">{l.decisionNote}</span> : null}
              </td>
              <td className="acts">
                {l.state === "requested" && canDecide ? (
                  <span className="inline-flex items-center gap-2">
                    <Button color="secondary" size="xs" onClick={() =>
                      shell.modal(<LeaveDecideModal l={l} state="rejected" />)}>Refuse…</Button>
                    <Button color="primary" size="xs" onClick={() =>
                      shell.modal(<LeaveDecideModal l={l} state="approved" />)}>Approve…</Button>
                  </span>
                ) : null}
                {l.state === "requested" && viewer === "self"
                  ? <Button color="secondary" size="xs" onClick={() => withdraw(l)}>Withdraw</Button>
                  : null}
                {l.state !== "requested" ? <span className="text-quaternary">decided</span> : null}
              </td>
            </tr>
          );
        })}
        {rows.length ? null : (
          <tr>
            <td colSpan={6} className="p-0!">
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-primary">No leave on record</p>
                <p className="mt-1 text-sm text-tertiary">
                  Nothing requested and nothing taken. An absence here would be a derived one — a day
                  nobody opened.
                </p>
              </div>
            </td>
          </tr>
        )}
      </ListTable>

      <p className="text-xs text-quaternary">
        There is no quota. A quota needs an accrual policy, a carry-forward rule and a year-end
        job — the days are recorded here and counted in a report instead.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- the strip --- */

/** THE NEXT THREE WEEKS, so an approval has a shape and not just a date range.
 *  Only APPROVED leave paints a cell: a pending request changes nothing about
 *  whether somebody is absent, and drawing it as though it did would be the
 *  screen deciding on the approver's behalf. */
function LeaveStrip({ m }: { m: Member }) {
  const days = datesIn(TODAY, addDays(TODAY, 20));
  const any = days.some((d) => !!onLeave(m.memberId, d));
  return (
    <Card
      title="The next three weeks"
      sub={(any ? "Filled days are covered by an approval." : "Nothing approved in the next three weeks.")
        + " A pending request paints nothing — it changes no derivation until somebody decides it."}
      tight
    >
      <div className="flex flex-wrap gap-1" role="group" aria-label="The next three weeks">
        {days.map((d) => {
          const l = onLeave(m.memberId, d);
          return (
            <span
              key={d}
              title={fmtDate(d) + (l ? " · " + labelOf(LEAVE_KIND, l.kind) + " leave"
                : isWeekend(d) ? " · not a working day" : "")}
              className={cx(
                "flex size-9 flex-col items-center justify-center rounded-lg ring-1 ring-inset",
                l ? "bg-brand-primary text-brand-secondary ring-brand"
                  : isWeekend(d) ? "bg-secondary text-quaternary ring-transparent"
                    : "bg-primary text-tertiary ring-secondary",
                d === TODAY && "ring-2 ring-brand",
              )}
            >
              <b className="text-xs font-semibold tnum">{Number(d.slice(8))}</b>
              <i className="text-2xs not-italic opacity-70">
                {["S", "M", "T", "W", "T", "F", "S"][new Date(d + "T00:00:00").getDay()]}
              </i>
            </span>
          );
        })}
      </div>
    </Card>
  );
}
