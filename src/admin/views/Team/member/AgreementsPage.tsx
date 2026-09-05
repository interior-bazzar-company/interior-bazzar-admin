/* =============================================================================
   /team/:id/agreements — what the company sent this person to sign.
   -----------------------------------------------------------------------------
   ONE ENTITY, SEVERAL KINDS. An offer letter and an NDA are sent, opened,
   signed, versioned, expired and revoked identically, so they are one record
   with a `kind` and not two tables that drift apart over a year.

   THE DIRECTION IS WHAT SEPARATES THIS PAGE FROM /documents. An agreement
   travels company → member: the company writes it, the member signs it, and
   nobody may edit it afterwards — a signature only means something against a
   document that cannot change. A resource travels the other way and the member
   may delete their own. Same tab in an earlier draft, two pages here, because
   with a page each there is no tab budget forcing them together.

   FROZEN AT SEND is enforced by having no edit control at all, not by a rule
   somebody has to remember. The only writes on this page are: send a new one,
   revoke an unsigned one, and sign one — and signing is the member's own act.
   ============================================================================= */
import { Icon, Notice, Pill, Table } from "../../../ui";
import { useShell } from "../../../shell/ShellContext";
import {
  AGREEMENT_KIND, AGREEMENT_STATE, TODAY, agreementsFor, fmtDate, labelOf, readMember,
  revokeAgreement, toneOf, useAgreements,
} from "../store";
import type { Agreement, Member } from "../store";
import type { Viewer } from "./ops";
import { OpHead } from "./frame";
import { SendAgreementModal, SignAgreementModal } from "./modals";

/** Expiry is DERIVED against today, never a stored state. A stored one needs a
 *  nightly sweep to stay true, and this backend has no queue — so a link would
 *  read "sent" for weeks after it stopped working. */
const isExpired = (a: Agreement) =>
  a.state !== "signed" && a.state !== "revoked" && !!a.expiresAt && (a.expiresAt as string) < TODAY;

const liveState = (a: Agreement) => (isExpired(a) ? "expired" : a.state);

export default function AgreementsPage({ m, viewer }: { m: Member; viewer: Viewer }) {
  const shell = useShell();
  useAgreements();
  const rows = agreementsFor(m.memberId);

  const open = rows.filter((a) => liveState(a) === "sent" || liveState(a) === "viewed");
  const unopened = rows.filter((a) => a.state === "sent" && !a.viewedAt && !isExpired(a));
  const expired = rows.filter(isExpired);

  const revoke = (a: Agreement) => {
    const r = revokeAgreement(a.agreementId);
    shell.toast(r.ok ? "Revoked. The link is dead." : (r as { message: string }).message, r.ok ? "" : "bad");
  };

  return (
    <>
      <OpHead
        title="Agreements"
        desc="Company to member. Sent, opened, signed — and every one of those is a moment on the record."
        right={viewer === "admin"
          ? <button className="btn pri" onClick={() => shell.modal(<SendAgreementModal memberId={m.memberId} />)}>
            <Icon name="plus" size="sm" />Send an agreement
          </button>
          : null} />

      {unopened.length ? (
        <Notice tone="warn" ico="clock" text={
          <><b>{unopened.length} sent and never opened.</b> This is the one thing on the page waiting
            on a human rather than on work, and nothing else in the panel would ever mention it.</>
        } />
      ) : null}
      {expired.length ? (
        <Notice tone="bad" ico="alert" text={
          <><b>{expired.length} link{expired.length > 1 ? "s have" : " has"} expired.</b> An expired
            link shows the recipient why it stopped working and offers a new one — it never shows
            the document, and it never returns a dead end.</>
        } />
      ) : null}

      <Table
        cols={[{ label: "Document" }, { label: "State", w: "150px" },
          { label: "Sent", w: "170px" }, { label: "What happened", w: "260px" },
          { label: "", w: "210px" }]}
        empty={{
          icon: "shield", title: "Nothing sent",
          body: viewer === "admin"
            ? "No agreement has gone to this member. Send one and the link expires in seven days."
            : "The company has not sent you anything to sign.",
        }}
        rows={rows.map((a) => {
          const st = liveState(a);
          const sender = a.sentById ? readMember(a.sentById) : null;
          const closed = st === "signed" || st === "revoked" || st === "expired";
          return (
            <tr key={a.agreementId} className={st === "revoked" ? "dim" : ""}>
              <td>
                <span className="cell-1"><b>{a.title}</b></span>
                <span className="cell-2">{labelOf(AGREEMENT_KIND, a.kind)} · version {a.version}</span>
              </td>
              <td>
                <Pill text={labelOf(AGREEMENT_STATE, st)} tone={toneOf(AGREEMENT_STATE, st)} />
              </td>
              <td>
                {a.sentAt ? (
                  <>
                    <span className="cell-1">{fmtDate(a.sentAt.slice(0, 10))}</span>
                    {sender ? <span className="cell-2">by {sender.name}</span> : null}
                  </>
                ) : <span className="dim">not sent</span>}
              </td>
              <td><Trail a={a} st={st} /></td>
              <td>
                {!closed && viewer === "self" ? (
                  <button className="btn pri sm" onClick={() => shell.modal(<SignAgreementModal a={a} />)}>
                    Open and sign
                  </button>
                ) : null}
                {closed && viewer === "self" ? (
                  <button className="btn sm" onClick={() => shell.modal(<SignAgreementModal a={a} />)}>
                    Open
                  </button>
                ) : null}
                {!closed && viewer === "admin" ? (
                  <button className="btn sm dgr" onClick={() => revoke(a)}>Revoke</button>
                ) : null}
                {st === "signed" && viewer === "admin" ? (
                  <button className="btn sm" onClick={() => shell.modal(<SignAgreementModal a={a} />)}>
                    View signed
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })} />

      <p className="tm-foot">
        A signed agreement cannot be revoked and cannot be edited. Opening the link is what writes
        the <b>viewed</b> moment — the recipient's own act, which is what makes it worth recording.
      </p>

      {open.length && viewer === "admin" ? (
        <Notice ico="lock" text={
          <>Signing a letter is the candidate's act; activating their account is yours. Nothing here
            switches an account on.</>
        } />
      ) : null}
    </>
  );
}

/** THE TRAIL, not the state. The state says where it stopped; this says what
 *  actually happened to it, which is the column somebody chasing a signature
 *  is really reading. */
function Trail({ a, st }: { a: Agreement; st: string }) {
  if (st === "signed") {
    return (
      <>
        <span className="cell-1">Signed by {a.signedName}</span>
        <span className="cell-2">
          {fmtDate((a.signedAt || "").slice(0, 10))}
          {a.signerIp ? " · from " + a.signerIp : ""}
        </span>
      </>
    );
  }
  if (st === "revoked") return <span className="dim">Revoked before it was signed.</span>;
  if (st === "expired") {
    return (
      <>
        <span className="cell-1 u-bad">The link expired</span>
        <span className="cell-2">{fmtDate(a.expiresAt as string)} · send a new version</span>
      </>
    );
  }
  if (a.viewedAt) {
    return (
      <>
        <span className="cell-1">Opened, not signed</span>
        <span className="cell-2">{fmtDate(a.viewedAt.slice(0, 10))} · expires {fmtDate(a.expiresAt as string)}</span>
      </>
    );
  }
  return (
    <>
      <span className="cell-1 u-warn">Not opened yet</span>
      <span className="cell-2">expires {a.expiresAt ? fmtDate(a.expiresAt) : "—"}</span>
    </>
  );
}
