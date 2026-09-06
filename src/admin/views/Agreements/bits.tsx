/* =============================================================================
   Agreements — the small shared pieces.
   ============================================================================= */
import { Icon, Pill, avatarTone, initials } from "../../ui";
import {
  AGREEMENT_STATE_LABEL, STATE_TONE, fmtWhen, signLink, stateOf,
} from "./store";
import type { Agreement, Clause, Member, TemplateState } from "./store";

/* ---------------------------------------------------------------- who --- */

export function Who({ m }: { m: Member }) {
  return (
    <div className="ag-who">
      <span className={"av " + avatarTone(m.name)}>{initials(m.name)}</span>
      <span className="ag-who-t">
        <b>{m.name}</b>
        <span className="cell-2">{m.designation}</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- status --- */

/** Expired is derived, not stored, so it is computed here rather than read off
 *  the record — an agreement that ran out yesterday should say so today without
 *  anything having run overnight. */
export function StatePill({ a }: { a: Agreement }) {
  const s = stateOf(a);
  return <Pill text={AGREEMENT_STATE_LABEL[s] || s} tone={STATE_TONE[s] || ""} dot />;
}

const TPL_TONE: Record<TemplateState, string> = {
  active: "ok", draft: "", retired: "",
};
const TPL_LABEL: Record<TemplateState, string> = {
  active: "In use", draft: "Draft", retired: "Retired",
};

export function TemplatePill({ state }: { state: TemplateState }) {
  return <Pill text={TPL_LABEL[state]} tone={TPL_TONE[state]} dot />;
}

/* ---------------------------------------------------------------- deed --- */

/** THE DOCUMENT, AS A DOCUMENT. Headings and paragraphs on a sheet, at reading
 *  width — not a table of fields. It is the one thing in this panel a person
 *  outside the company is expected to read end to end, and it should look like
 *  something you would read rather than something you would scan. */
export function Sheet({ title, clauses, children }: {
  title: string; clauses: Clause[]; children?: React.ReactNode;
}) {
  return (
    <article className="ag-sheet">
      <h2 className="ag-sheet-t">{title}</h2>
      {clauses.length ? clauses.map((c, i) => (
        <section key={c.clauseId} className="ag-clause">
          {c.heading ? (
            <h3>
              <span className="ag-clause-n" aria-hidden="true">{i + 1}</span>
              {c.heading}
            </h3>
          ) : null}
          <p>{c.text}</p>
        </section>
      )) : <p className="cell-2">No clauses yet.</p>}
      {children}
    </article>
  );
}

/* ------------------------------------------------------------ evidence --- */

/** WHAT A SIGNATURE IS WORTH IS ITS PROVENANCE, and this is the only block in
 *  the panel that says so out loud: who typed what, when, from where, over
 *  which version, under which token.
 *
 *  It is monospaced and rules between every row on purpose — this is a receipt,
 *  not a summary. A signature you cannot evidence is a picture of a signature,
 *  and the block is deliberately the plainest thing on the page so it reads as
 *  a record rather than as a design.
 *
 *  UNSIGNED SHOWS THE SAME ROWS, EMPTY. What is missing is the point: it says
 *  what would be captured, so an operator chasing a signature can see exactly
 *  what they are still waiting for. */
export function Evidence({ a }: { a: Agreement }) {
  const signed = a.state === "signed";
  const rows: [string, React.ReactNode][] = [
    ["Signed by", signed ? <b>{a.signedName}</b> : <i className="ag-ev-none">not yet signed</i>],
    ["Signed at", signed ? fmtWhen(a.signedAt) : <i className="ag-ev-none">—</i>],
    ["From", signed && a.signerIp ? a.signerIp : <i className="ag-ev-none">—</i>],
    ["Opened", a.viewedAt ? fmtWhen(a.viewedAt) : <i className="ag-ev-none">not opened</i>],
    ["Sent", fmtWhen(a.sentAt)],
    ["Version", "v" + a.version],
    ["Token", a.token],
  ];
  return (
    <div className={"ag-ev" + (signed ? " is-signed" : "")}>
      <div className="ag-ev-h">
        <Icon name={signed ? "check" : "clock"} size="sm" />
        <span>{signed ? "Signature" : "Awaiting signature"}</span>
      </div>
      <dl className="ag-ev-l">
        {rows.map(([k, v]) => (
          <div key={k} className="ag-ev-r">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {!signed && a.state !== "revoked" ? (
        <div className="ag-ev-f">
          <span className="cell-2 mono">{signLink(a)}</span>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- signature ---- */

/** THE FOOT OF THE DEED, where a signature goes on paper. It is a rule and a
 *  name, and when nothing has been signed it is a rule and nothing — which is
 *  what an unsigned document looks like, and reads more honestly than a badge
 *  saying "pending" where the name should be. */
export function SignatureLine({ a }: { a: Agreement }) {
  const signed = a.state === "signed";
  return (
    <div className="ag-sig">
      <div className="ag-sig-l" aria-hidden="true" />
      {signed ? (
        <>
          <span className="ag-sig-n">{a.signedName}</span>
          <span className="cell-2">Typed as a signature · {fmtWhen(a.signedAt)}</span>
        </>
      ) : (
        <span className="cell-2">
          {a.state === "revoked"
            ? "This copy was revoked before it was signed."
            : "Unsigned. The member types their full name here."}
        </span>
      )}
    </div>
  );
}
