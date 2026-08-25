/* =============================================================================
   Screen 8 · Pause / Suspend / Cancel — one dialog, seven distinct meanings.
   -----------------------------------------------------------------------------
   ONE component, because the shape is identical: name the action, state what it
   does to entitlement, take a reason where the matrix demands one, and refuse
   the move if it is not on the matrix. Seven copies of this markup would have
   drifted, and the first thing to drift would have been the wording that keeps
   pause and suspension apart.

   THE COPY IS THE FEATURE. Pause, suspend, expire and cancel are four different
   facts with four different consequences, and the single most common way this
   module goes wrong is somebody treating two of them as the same button with a
   different label. So each action gets its own consequence list, in the words
   the vocabulary uses, and none of them says "deactivate membership".

   The refusal is rendered HERE, in the dialog that tried it, and the dialog
   stays open — so the sentence it just contradicted is still on screen.
   ============================================================================= */
import { useState } from "react";
import type { ReactNode } from "react";
import { Icon, Notice } from "../../ui";
import { Assumed, PlanChip, StatusPill } from "./bits";
import {
  LIFECYCLE_ACTIONS, PAUSE_POLICY, VOCAB, fmtDate, lifecycle, membershipMeta,
} from "./store";
import type { LifecycleAction, Membership, UserRow } from "./store";

/** What each action actually does, in consequences rather than adjectives.
 *  Kept beside the reason list it belongs with. */
const COPY: Record<LifecycleAction, {
  heading: string; verb: string; danger?: boolean;
  reasons?: string[]; consequences: ReactNode[]; after: string;
}> = {
  activate: {
    heading: "Activate this membership",
    verb: "Activate",
    consequences: [
      <>The entitlement snapshot is frozen from the plan version this term names — not from whatever the catalogue says today.</>,
      <>The member starts receiving access immediately, and the derived classification becomes Active Member.</>,
      <>If the snapshot cannot be taken, activation aborts and the term stays Pending. An Active membership whose access nobody can enumerate is worse than one that never went live.</>,
      <><b>No revenue is created.</b> If money changed hands, Finance already recorded it — this only references it.</>,
    ],
    after: "Active. The member is entitled from now.",
  },
  pause: {
    heading: "Pause this membership",
    verb: "Pause",
    reasons: VOCAB.pauseReasons,
    consequences: [
      <>Temporary and <b>resumable</b>. The term survives, the history survives, and nothing is terminal.</>,
      <>Entitlements follow the pause policy. On this build that policy is <b className="mono">{PAUSE_POLICY}</b>: the end date runs on while paused.</>,
      <>The member stays a customer. They are counted as Paused, separately from Active Members, and never as churn.</>,
      <>This is <b>not</b> a suspension. A pause is the member's; a suspension is ours.</>,
    ],
    after: "Paused. It resumes when somebody resumes it.",
  },
  resume: {
    heading: "Resume this membership",
    verb: "Resume",
    consequences: [
      <>Entitlements come back exactly as they were snapshotted — resuming does not re-read the plan catalogue.</>,
      <>Dates move only if the pause policy says they move. Under <b className="mono">{PAUSE_POLICY}</b> they do not.</>,
      <>The classification returns to Active Member, derived from the term rather than restored from anywhere.</>,
    ],
    after: "Active again.",
  },
  suspend: {
    heading: "Suspend this membership",
    verb: "Suspend",
    danger: true,
    reasons: VOCAB.suspendReasons,
    consequences: [
      <>An <b>administrative restriction</b>, not a pause. Entitlements are withheld until somebody with the authority lifts it.</>,
      <>The <b>account is untouched</b>. They can still sign in; what remains reachable while suspended is undecided and this dialog does not promise anything specific.</>,
      <>The term, its dates and its snapshot all survive. Nothing is deleted and nothing is rewritten.</>,
      <>Needs restricted authority. Ordinary profile-edit permission is not enough, here or at the API.</>,
    ],
    after: "Suspended. Entitlements withheld, history intact.",
  },
  reactivate: {
    heading: "Reactivate this membership",
    verb: "Reactivate",
    reasons: VOCAB.pauseReasons,
    consequences: [
      <>Lifts the restriction and restores the frozen entitlements.</>,
      <>The reason is recorded because "who decided this was safe again" is asked after the fact, never before it.</>,
      <>The suspension stays in the history as a terminal event of its own. It is not erased by being reversed.</>,
    ],
    after: "Active again.",
  },
  cancel: {
    heading: "Cancel this membership",
    verb: "Cancel",
    danger: true,
    reasons: VOCAB.cancelReasons,
    consequences: [
      <>Terminates the term before its end date. <b>Terminal</b> — this record can never be reopened.</>,
      <>A later membership is a <b>new record</b> referencing this one. The cancelled term stays visible in the history and in the churn cohort for the month it ended.</>,
      <><b>No refund is issued by this action.</b> Refund handling belongs to Finance; cancelling here writes no money anywhere.</>,
      <>Cancelled is not Expired. Expiry is a term reaching its end; cancellation is somebody stopping it. They are counted separately.</>,
    ],
    after: "Cancelled. Terminal, and still in the history.",
  },
  renew: {
    heading: "Renew into a new term",
    verb: "Create the new term",
    consequences: [
      <>Creates a <b>new membership record</b> carrying <span className="mono">previousMembershipId</span> back to this one.</>,
      <>This term is <b>not modified</b> — not its status, not its dates, not its snapshot. That is what makes renewal rate and lifetime value reconstructable at all.</>,
      <>The new term snapshots the plan's <b>current</b> version, so a renewing member moves onto today's terms rather than carrying old ones forward silently.</>,
      <>A renewal is <b>never counted as a new member</b>. It appears beside first-time members on every chart, never inside them.</>,
    ],
    after: "A new term, with the old one untouched beside it.",
  },
};

export default function LifecycleModal({ m, row, action, onClose, onDone }: {
  m: Membership;
  row: UserRow;
  action: LifecycleAction;
  onClose: () => void;
  onDone: (msg: string, tone?: string) => void;
}) {
  const spec = LIFECYCLE_ACTIONS.filter((a) => a.key === action)[0];
  const copy = COPY[action];
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsReason = !!spec?.requiresReason;

  const submit = () => {
    setErr(null); setBusy(true);
    const e = lifecycle(m.membershipId, action, reason);
    if (e) { setErr(e); setBusy(false); return; }
    onDone(copy.after, action === "suspend" || action === "cancel" ? "warn" : "ok");
  };

  return (
    <>
      <div className="md-h">
        <h3>{copy.heading}</h3>
        <p>
          {row.user.identity.name} · <PlanChip code={m.planCode} name={m.planName} version={m.planVersion} />{" "}
          <StatusPill k={m.status} /> · <span className="mono">{m.membershipId}</span>
        </p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b um-form">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        <div className="um-transition">
          <StatusPill k={m.status} lg />
          <Icon name="arrow" />
          <StatusPill k={spec ? spec.to : m.status} lg />
        </div>

        <ul className="um-consequences">
          {copy.consequences.map((c, i) => (
            <li key={i}><Icon name="chevr" size="sm" />{c}</li>
          ))}
        </ul>

        {needsReason ? (
          <fieldset className="um-fs">
            <legend>Reason <span className="req">*</span></legend>
            {copy.reasons?.length ? (
              <div className="um-chips">
                {copy.reasons.map((r) => (
                  <button key={r} type="button" className={"chip" + (reason === r ? " on" : "")}
                    onClick={() => setReason(r)}>{r}</button>
                ))}
              </div>
            ) : null}
            <textarea className="inp" rows={3} value={reason}
              placeholder="Pick one above, or write what happened."
              onChange={(e) => setReason(e.target.value)} />
            <p className="um-fine">
              Recorded on the lifecycle event with your name against it.
            </p>
          </fieldset>
        ) : null}

        {action === "renew" ? (
          <div className="um-renewpreview">
            <b>This term stays exactly as it is</b>
            <span>
              {m.planName} v{m.planVersion} · {fmtDate(m.startAt)} to {fmtDate(m.endAt)} ·{" "}
              {membershipMeta(m.status)?.label}
            </span>
            <em>The new term starts where this one ends and references it.</em>
          </div>
        ) : null}

        {action === "pause" || action === "resume" ? <Assumed id="UM-OD-04" /> : null}
        {action === "suspend" ? <Assumed id="UM-OD-05" /> : null}
        {action === "cancel" ? <Assumed id="UM-OD-06" /> : null}
      </div>

      <div className="md-f">
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className={"btn " + (copy.danger ? "dgr" : "pri")}
          disabled={busy || (needsReason && !reason.trim())} onClick={submit}>
          {busy ? "Working…" : copy.verb}
        </button>
      </div>
    </>
  );
}
