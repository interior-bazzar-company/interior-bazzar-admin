/* =============================================================================
   Screen 9 · Renewal Queue — the list somebody works from, in order.
   -----------------------------------------------------------------------------
   Four bands, in the order of the day: waiting on a decision, about to end,
   ended, held. Each row carries its action, so nothing here is a report you
   read and then act on somewhere else.

   "Ending soon" and the churn denominator are the same query read twice, cut
   with one constant, so the queue and the KPI cannot drift apart.
   ============================================================================= */
import type { ReactNode } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, Icon, SearchField, SectionHead, Select } from "../../ui";
import { go } from "../../ui/nav";
import { Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { Assumed, PlanChip, StatusPill, WhoCell } from "./bits";
import LifecycleModal from "./LifecycleModal";
import {
  CITIES, PLANS, RENEWAL_WINDOW_DAYS, ago, allowedActions, applyFilters, fmtDate, recentlyEnded,
} from "./store";
import type { LifecycleAction, UserRow } from "./store";

const BANDS = [
  { k: "", l: "Everything" },
  { k: "pending", l: "Pending" },
  { k: "expiring", l: "Ending" },
  { k: "ended", l: "Ended" },
  { k: "held", l: "Held" },
];

export default function RenewalQueue({ rows, p, onView, onFilter, onSearch }: FaceProps) {
  const { toast, modal, closeLayer } = useShell();

  /* The shared filters still apply — a queue you cannot narrow to one city is
     a queue two people cannot split between them. */
  const base = applyFilters(rows, { q: p.q, city: p.city, plan: p.plan });

  const pending = base.filter((r) => r.current?.status === "pending");
  const expiring = base.filter((r) => r.expiringSoon)
    .sort((a, b) => (a.daysToEnd ?? 0) - (b.daysToEnd ?? 0));
  const ended = base.filter(recentlyEnded);
  const held = base.filter((r) =>
    r.current?.status === "paused" || r.current?.status === "suspended");

  const act = (r: UserRow, action: LifecycleAction) => {
    if (!r.current) return;
    modal(<LifecycleModal m={r.current} row={r} action={action} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />);
  };

  const only = p.flag;
  const show = (k: string) => !only || only === k;

  return (
    <Frame view="renewals" onView={onView} toast={toast}
      counts={{ renewals: pending.length + expiring.length }}
      cmd={<>
        <SearchField ph="Name, email, phone or business…" val={p.q} onFilter={onSearch} />
        <Select name="plan" label="Plan" value={p.plan} onFilter={onFilter}
          options={PLANS.map((x) => ({ v: x.planCode, l: x.name }))} />
        <Select name="city" label="City" value={p.city} onFilter={onFilter}
          options={CITIES.map((x) => ({ v: x, l: x }))} />
        <span className="spacer" />
        <span className="chiprow">
          {BANDS.map((f) => (
            <button key={f.k} className={"chip" + ((only || "") === f.k ? " on" : "")}
              onClick={() => onFilter("flag", f.k)}>{f.l}</button>
          ))}
        </span>
      </>}>

      {show("pending") ? (
        <Band title="Waiting on activation" n={pending.length}
          desc="a term exists and grants nothing until somebody activates it"
          rows={pending} empty="Nothing waiting on an activation decision."
          render={(r) => (
            <>
              <span className="um-q-when warn">raised {ago(r.current?.createdAt)}</span>
              {can("users", "edit")
                ? <button className="btn sm pri" onClick={() => act(r, "activate")}>Activate</button>
                : null}
            </>
          )} />
      ) : null}

      {show("expiring") ? (
        <Band title={"Ending within " + RENEWAL_WINDOW_DAYS + " days"} n={expiring.length}
          desc="the renewal conversations · the same set the churn denominator uses"
          rows={expiring} empty="Nothing ending inside the window."
          render={(r) => (
            <>
              <span className={"um-q-when" + ((r.daysToEnd ?? 99) <= 14 ? " bad" : " warn")}>
                {fmtDate(r.current?.endAt)} · {r.daysToEnd === 0 ? "today" : "in " + r.daysToEnd + " days"}
              </span>
              {can("users", "edit") && allowedActions(r.current).some((a) => a.key === "renew")
                ? <button className="btn sm pri" onClick={() => act(r, "renew")}>Renew</button>
                : null}
            </>
          )} />
      ) : null}

      {show("ended") ? (
        <Band title="Ended, not renewed" n={ended.length}
          desc="still registered, still sellable — expiry ends a membership, not an account"
          rows={ended} empty="Nothing has ended inside the window."
          render={(r) => (
            <>
              <span className="um-q-when">
                {r.current?.status === "cancelled" ? "cancelled " : "expired "}
                {ago(r.current?.cancelledAt || r.current?.expiredAt || r.current?.endAt)}
              </span>
              {can("users", "edit")
                ? <button className="btn sm" onClick={() => act(r, "renew")}>New term</button>
                : null}
            </>
          )} />
      ) : null}

      {show("held") ? (
        <Band title="Paused and suspended" n={held.length}
          desc="a pause is theirs and resumes on request; a suspension is ours and needs lifting"
          rows={held} empty="Nothing on hold."
          render={(r) => (
            <>
              <span className="um-q-when">
                {r.current?.status === "paused" ? "paused " : "suspended "}
                {ago(r.current?.pausedAt || r.current?.suspendedAt)}
              </span>
              {can("users", "edit")
                ? <button className="btn sm pri"
                    onClick={() => act(r, r.current?.status === "paused" ? "resume" : "reactivate")}>
                    {r.current?.status === "paused" ? "Resume" : "Reactivate"}
                  </button>
                : null}
            </>
          )} />
      ) : null}

      <Assumed id="UM-OD-11">
        Every band is cut with a {RENEWAL_WINDOW_DAYS}-day window and no grace period. Both are
        placeholders, and the churn denominator moves with them.
      </Assumed>
    </Frame>
  );
}

function Band({ title, desc, n, rows, empty, render }: {
  title: string; desc: string; n: number; rows: UserRow[]; empty: string;
  render: (r: UserRow) => ReactNode;
}) {
  return (
    <>
      <SectionHead title={title} desc={desc} right={<span className="tnum um-count">{n}</span>} />
      {rows.length ? (
        <div className="um-queue">
          {rows.map((r) => (
            <div className="um-q" key={r.user.userId}
              onClick={() => go("#/users/" + encodeURIComponent(r.user.userId))}>
              <WhoCell r={r} />
              <span className="um-q-plan">
                {r.current ? <PlanChip code={r.current.planCode} name={r.current.planName} /> : null}
                {r.current ? <StatusPill k={r.current.status} /> : null}
              </span>
              <span className="um-q-act" onClick={(e) => e.stopPropagation()}>{render(r)}</span>
              <Icon name="chevr" size="sm" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="check" title={empty} body="" />
      )}
    </>
  );
}
