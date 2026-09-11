/* =============================================================================
   /team/:id/agreements — what the company sent this person to sign.
   -----------------------------------------------------------------------------
   ONE ENTITY, SEVERAL KINDS. An offer letter and an NDA are sent, opened,
   signed, versioned, expired and revoked identically, so they are one record
   with a `kind` and not two tables that drift apart over a year.

   THE DIRECTION IS WHAT SEPARATES THIS PAGE FROM /documents. An agreement
   travels company → member: the company writes it, the member signs it, and
   nobody may edit it afterwards — a signature only means something against a
   document that cannot change. A MemberDocument travels the other way and the
   member may delete their own. Same tab in an earlier draft, two pages here,
   because with a page each there is no tab budget forcing them together.

   FROZEN AT SEND is enforced by having no edit control at all, not by a rule
   somebody has to remember. The only writes on this page are: send a new one,
   revoke an unsigned one, and sign one — and signing is the member's own act.
   ============================================================================= */
import { Alert, Button, ListTable, Notice, Pill, Rail } from "../../../ui";
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

const railOf = (st: string) => (st === "expired" ? "bad" : st === "sent" ? "warn" : undefined);

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
    <div className="flex flex-col gap-5">
      <OpHead
        title="Agreements"
        desc="Company to member. Sent, opened, signed — and every one of those is a moment on the record."
        right={viewer === "admin"
          ? (
            <Button color="primary" ico="plus"
              onClick={() => shell.modal(<SendAgreementModal memberId={m.memberId} />)}>
              Send an agreement
            </Button>
          )
          : null} />

      {unopened.length ? (
        <Alert tone="warn" ico="clock" title={unopened.length + " sent and never opened"}>
          This is the one thing on the page waiting on a human rather than on work, and nothing else
          in the panel would ever mention it.
        </Alert>
      ) : null}
      {expired.length ? (
        <Alert tone="bad" ico="alert"
          title={expired.length + " link" + (expired.length > 1 ? "s have" : " has") + " expired"}>
          An expired link shows the recipient why it stopped working and offers a new one — it never
          shows the document, and it never returns a dead end.
        </Alert>
      ) : null}

      <ListTable min="62rem" head={<tr>
        <th className="rail" />
        <th scope="col">Document</th>
        <th scope="col">State</th>
        <th scope="col">Sent</th>
        <th scope="col">What happened</th>
        <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
      </tr>}>
        {rows.map((a) => {
          const st = liveState(a);
          const sender = a.sentById ? readMember(a.sentById) : null;
          const closed = st === "signed" || st === "revoked" || st === "expired";
          return (
            <tr key={a.agreementId}>
              <Rail tone={railOf(st)} title={st === "expired" ? "The link expired" : st === "sent" ? "Waiting on a signature" : undefined} />
              <td className="cell-1">
                {a.title}
                <span className="block cell-2">{labelOf(AGREEMENT_KIND, a.kind)} · version {a.version}</span>
              </td>
              <td><Pill xs dot text={labelOf(AGREEMENT_STATE, st)} tone={toneOf(AGREEMENT_STATE, st)} /></td>
              <td>
                {a.sentAt ? (
                  <>
                    <span className="font-medium text-primary tnum">{fmtDate(a.sentAt.slice(0, 10))}</span>
                    {sender ? <span className="block cell-2">by {sender.name}</span> : null}
                  </>
                ) : <span className="text-quaternary">not sent</span>}
              </td>
              <td><Trail a={a} st={st} /></td>
              <td className="acts">
                <span className="inline-flex items-center gap-2">
                  {!closed && viewer === "self" ? (
                    <Button color="primary" size="xs" onClick={() => shell.modal(<SignAgreementModal a={a} />, "lg")}>
                      Open and sign
                    </Button>
                  ) : null}
                  {closed && viewer === "self" ? (
                    <Button color="secondary" size="xs" onClick={() => shell.modal(<SignAgreementModal a={a} />, "lg")}>
                      Open
                    </Button>
                  ) : null}
                  {!closed && viewer === "admin" ? (
                    <Button color="secondary-destructive" size="xs" onClick={() => revoke(a)}>Revoke</Button>
                  ) : null}
                  {st === "signed" && viewer === "admin" ? (
                    <Button color="secondary" size="xs" onClick={() => shell.modal(<SignAgreementModal a={a} />, "lg")}>
                      View signed
                    </Button>
                  ) : null}
                </span>
              </td>
            </tr>
          );
        })}
        {rows.length ? null : (
          <tr>
            <td colSpan={6} className="p-0!">
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-primary">Nothing sent</p>
                <p className="mt-1 text-sm text-tertiary">
                  {viewer === "admin"
                    ? "No agreement has gone to this member. Send one and the link expires in seven days."
                    : "The company has not sent you anything to sign."}
                </p>
              </div>
            </td>
          </tr>
        )}
      </ListTable>

      <p className="text-xs text-quaternary">
        A signed agreement cannot be revoked and cannot be edited. Opening the link is what writes
        the <b className="font-semibold text-tertiary">viewed</b> moment — the recipient's own act,
        which is what makes it worth recording.
      </p>

      {open.length && viewer === "admin" ? (
        <Notice ico="lock" text={
          <>Signing a letter is the candidate's act; activating their account is yours. Nothing here
            switches an account on.</>
        } />
      ) : null}
    </div>
  );
}

/** THE TRAIL, not the state. The state says where it stopped; this says what
 *  actually happened to it, which is the column somebody chasing a signature
 *  is really reading. */
function Trail({ a, st }: { a: Agreement; st: string }) {
  if (st === "signed") {
    return (
      <>
        <span className="font-medium text-primary">Signed by {a.signedName}</span>
        <span className="block cell-2 tnum">
          {fmtDate((a.signedAt || "").slice(0, 10))}
          {a.signerIp ? " · from " + a.signerIp : ""}
        </span>
      </>
    );
  }
  if (st === "revoked") return <span className="text-quaternary">Revoked before it was signed.</span>;
  if (st === "expired") {
    return (
      <>
        <span className="font-medium text-error-primary">The link expired</span>
        <span className="block cell-2 tnum">{fmtDate(a.expiresAt as string)} · send a new version</span>
      </>
    );
  }
  if (a.viewedAt) {
    return (
      <>
        <span className="font-medium text-primary">Opened, not signed</span>
        <span className="block cell-2 tnum">{fmtDate(a.viewedAt.slice(0, 10))} · expires {fmtDate(a.expiresAt as string)}</span>
      </>
    );
  }
  return (
    <>
      <span className="font-medium text-warning-primary">Not opened yet</span>
      <span className="block cell-2 tnum">expires {a.expiresAt ? fmtDate(a.expiresAt) : "—"}</span>
    </>
  );
}
