/* =============================================================================
   Agreements — the small drawings this module owns.
   -----------------------------------------------------------------------------
   Three of them, and each is here for the same reason: a deed is the one thing
   in this panel a person OUTSIDE the company reads end to end, so it is drawn
   as a document rather than as a screen.

   THE SHEET IS PAPER. Everything else in the product inverts with the theme; a
   document does not, because what the member signed is white with black type
   whatever the admin's monitor is set to. It is drawn on explicit `bg-white
   text-neutral-900` with `border-neutral-200` rules — the same exception the
   quotation and the salary slip make, for the same reason — and it carries the
   `print:` variants so Ctrl-P produces the deed and not the chrome.

   Nothing here holds state or writes the store.
   ============================================================================= */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Icon, Person, Pill } from "../../ui";
import {
  AGREEMENT_STATE_LABEL, STATE_TONE, fmtWhen, signLink, stateOf,
} from "./store";
import type { Agreement, Clause, Member, TemplateState } from "./store";

/* ---------------------------------------------------------------- who --- */

/** The same object every other screen draws a person with. It stays a named
 *  component so the module has one place to decide what the second line says. */
export function Who({ m }: { m: Member }) {
  return <Person name={m.name} sub={m.designation} sm />;
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
 *  something you would read rather than something you would scan.
 *
 *  `compact` is the editor's preview column and the drawer: the same document
 *  at reading density rather than at printing density. */
export function Sheet({ title, clauses, compact, children }: {
  title: string; clauses: Clause[]; compact?: boolean; children?: ReactNode;
}) {
  return (
    <article
      className={cx(
        "mx-auto flex w-full flex-col bg-white text-neutral-900 ring-1 ring-neutral-200",
        compact ? "rounded-lg p-5 text-sm shadow-xs" : "max-w-3xl rounded-xl p-6 text-sm shadow-xs sm:p-10",
        "print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0",
      )}
    >
      <h2 className={cx("font-semibold tracking-tight text-balance", compact ? "text-md" : "text-xl")}>{title}</h2>
      <div aria-hidden="true" className="mt-4 mb-1 h-px w-full bg-neutral-200" />
      {clauses.length ? clauses.map((c, i) => (
        <section key={c.clauseId} className="mt-5 first:mt-4">
          {c.heading ? (
            <h3 className={cx("flex gap-2 font-semibold", compact ? "text-sm" : "text-md")}>
              <span aria-hidden="true" className="font-mono text-neutral-400 tnum">{i + 1}.</span>
              <span className="min-w-0">{c.heading}</span>
            </h3>
          ) : null}
          <p className={cx("leading-relaxed whitespace-pre-line text-neutral-700", c.heading && "mt-1.5", !c.heading && "mt-0")}>
            {c.text || <span className="text-neutral-400 italic">This clause has no wording yet.</span>}
          </p>
        </section>
      )) : (
        <p className="mt-5 text-neutral-500 italic">No clauses yet.</p>
      )}
      {children}
    </article>
  );
}

/* --------------------------------------------------------- signature ---- */

/** THE FOOT OF THE DEED, where a signature goes on paper. It is a rule and a
 *  name, and when nothing has been signed it is a rule and nothing — which is
 *  what an unsigned document looks like, and reads more honestly than a badge
 *  saying "pending" where the name should be.
 *
 *  It lives INSIDE the sheet, so it is on paper's palette rather than the
 *  panel's: a signature line that went dark with the theme would be the one
 *  part of the document that was not the document. */
export function SignatureLine({ a, hint }: { a: Agreement; hint?: ReactNode }) {
  const signed = a.state === "signed";
  return (
    <div className="mt-8 flex flex-col gap-1.5 border-t border-neutral-200 pt-5">
      <span aria-hidden="true" className="h-px w-full max-w-64 bg-neutral-400" />
      {signed ? (
        <>
          <span className="text-md font-semibold">{a.signedName}</span>
          <span className="font-mono text-xs text-neutral-500 tnum">
            Typed as a signature · {fmtWhen(a.signedAt)}
          </span>
        </>
      ) : (
        <span className="text-xs text-neutral-500">
          {hint ?? (a.state === "revoked"
            ? "This copy was revoked before it was signed."
            : "Unsigned. The member types their full name here.")}
        </span>
      )}
    </div>
  );
}

/** The same rule, with nothing behind it — the editor's preview has no
 *  agreement to read a state off, and inventing one would put a name on a
 *  document nobody has signed. */
export function BlankSignature({ text }: { text?: ReactNode }) {
  return (
    <div className="mt-8 flex flex-col gap-1.5 border-t border-neutral-200 pt-5">
      <span aria-hidden="true" className="h-px w-full max-w-64 bg-neutral-400" />
      <span className="text-xs text-neutral-500">{text || "The member types their full name here."}</span>
    </div>
  );
}

/* ------------------------------------------------------------ evidence --- */

/** WHAT A SIGNATURE IS WORTH IS ITS PROVENANCE, and this is the only block in
 *  the panel that says so out loud: who typed what, when, from where, over
 *  which version, under which token.
 *
 *  It is monospaced and ruled between every row on purpose — this is a receipt,
 *  not a summary. A signature you cannot evidence is a picture of a signature,
 *  and the block is deliberately the plainest thing on the page so it reads as
 *  a record rather than as a design.
 *
 *  UNSIGNED SHOWS THE SAME ROWS, EMPTY. What is missing is the point: it says
 *  what would be captured, so an operator chasing a signature can see exactly
 *  what they are still waiting for. */
export function Evidence({ a }: { a: Agreement }) {
  const signed = a.state === "signed";
  const none = (t: string) => <span className="text-quaternary italic">{t}</span>;
  const rows: [string, ReactNode][] = [
    ["Signed by", signed ? <span className="font-semibold text-primary">{a.signedName}</span> : none("not yet signed")],
    ["Signed at", signed ? fmtWhen(a.signedAt) : none("—")],
    ["From", signed && a.signerIp ? a.signerIp : none("—")],
    ["Opened", a.viewedAt ? fmtWhen(a.viewedAt) : none("not opened")],
    ["Sent", fmtWhen(a.sentAt)],
    ["Version", "v" + a.version],
    ["Token", a.token],
  ];
  return (
    <section className={cx(
      "flex flex-col rounded-xl bg-primary shadow-xs ring-1 sheen",
      signed ? "ring-brand" : "ring-secondary",
    )}>
      <header className="flex items-center gap-2 border-b border-secondary px-4 py-3">
        <Icon name={signed ? "check" : "clock"} size="sm"
          className={signed ? "text-fg-success-primary" : "text-fg-quaternary"} />
        <h3 className="text-sm font-semibold text-primary">
          {signed ? "Signature" : "Awaiting signature"}
        </h3>
      </header>
      <dl className="flex flex-col divide-y divide-border-secondary">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-3 px-4 py-2">
            <dt className="label-mono w-24 shrink-0">{k}</dt>
            <dd className="min-w-0 flex-1 font-mono text-xs text-secondary [overflow-wrap:anywhere] tnum">{v}</dd>
          </div>
        ))}
      </dl>
      {!signed && a.state !== "revoked" ? (
        <footer className="border-t border-secondary px-4 py-2.5">
          <span className="label-mono">The link</span>
          <p className="mt-1 font-mono text-xs text-tertiary [overflow-wrap:anywhere]">{signLink(a)}</p>
        </footer>
      ) : null}
    </section>
  );
}
