/* =============================================================================
   Quotation — Module 2 · interface
   -----------------------------------------------------------------------------
   Every screen in QUOTATION_IA.md. Four principles, carried from Module 1:

     1. Locked actions are ABSENT, not greyed.
     2. Every modal states the rule BEFORE you commit, and prints the server
        code if it still rejects.
     3. The UI is a convenience, never the enforcement.
     4. Every figure on the builder is DISPLAY ONLY. The engine recomputes on
        save and again inside the issue transaction.

   Routes
     #/quotations                       list
     #/quotations?new=1                 step 1 · pick a deal
     #/quotations/<id>                  detail — Items / Document / Versions / History
     #/quotations/<id>?mode=edit        step 2 · the builder
     #/quotations/<id>?mode=preview     the customer-facing render, then Issue
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../ui";
import { useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { E, Q, actor, useRender } from "./core";
import List from "./List";
import PickDeal from "./PickDeal";
import Builder from "./Builder";
import Detail, { Preview } from "./Detail";

export default function Quotations() {
  /* The prototype's S.render(): the engines mutate in place, so every screen in
     this module subscribes to the one counter every write bumps. */
  useRender();
  const params = useParams();
  const [sp] = useSearchParams();
  const id = params.id ? decodeURIComponent(params.id) : null;
  const p: Record<string, string> = {};
  sp.forEach((v, k) => { p[k] = v; });

  /* --------------------------------------------------------- topbar ---
     The same nav bar Deals has: the module's name on the left, where the crumb
     "Sales › Quotations" used to sit above a heading that already said
     Quotations. The heading and its scope line are gone from the page body, so
     the list opens straight onto its controls.

     Claimed for the LIST only. On a record, a create flow or a sub-mode this
     claims nothing and the shell renders its own flat label plus the Back
     button — that is the wayfinding on those screens, and a module title
     competing with it would put two answers to "where am I" in one bar.

     ---------------------------------------------------- where "up" is ---
     Answers the shell's Back when there is no in-session history to walk —
     someone pasted the URL, or refreshed on this screen. A quotation's parent
     is not the quotation LIST, it is the deal: `deal_id` is NOT NULL here
     precisely because a quotation cannot exist without one, so the strongest
     link in the schema is also the right way out. Preview and edit are
     sub-modes of the record, so they go up to the record first, one step at a
     time, rather than skipping the screen the user was working in. */
  const isList = !id && !p["new"] && !p.mode;
  /* The memo is no longer load-bearing — usePageChrome republishes per location,
     not per render — but it costs nothing and keeps the element stable. */
  const crumbs = useMemo(
    () => (isList ? <span className="tb-title">Quotations</span> : undefined),
    [isList]
  );
  usePageChrome({ crumbs, right: isList ? "" : undefined, parent: parentOf(id, p) });

  if (p["new"] === "1") return <PickDeal p={p} />;

  if (id) {
    const q = Q.quoteOf(id);
    if (!q) return <NotFound id={id} />;
    const me = actor(), dl = E.dealOf(q.deal_id);
    // A missing deal record is scope-denied, not scope-exempt — falling
    // through to render because there was nothing to check scope against
    // would be the one case this guard exists to catch (QA9).
    if (!dl || !E.inScope(me, dl)) return <Denied />;
    if (p.mode === "edit")
      return q.status === Q.ST.DRAFT ? <Builder q={q} p={p} /> : <NotDraft q={q} p={p} />;
    if (p.mode === "preview") return <Preview q={q} />;
    return <Detail q={q} p={p} />;
  }

  return <List p={p} />;
}

function parentOf(id: string | null, p: Record<string, string>) {
  if (id) {
    if (p.mode) return "#/quotations/" + encodeURIComponent(id);   // sub-mode → the record
    const q = Q.quoteOf(id);
    if (q && q.deal_id) return "#/deals/" + encodeURIComponent(q.deal_id);
    return "#/quotations";
  }
  // Two-step create: step 2 goes back to the deal it is being written
  // against, step 1 has no deal yet and so has only the list.
  if (p["new"] === "1") return p.deal ? "#/deals/" + encodeURIComponent(p.deal) : "#/quotations";
  return null;
}

/* An issued document has no edit path — the absence of the endpoint is the
   enforcement, not a flag. Asking for one lands on the record instead. */
function NotDraft({ q, p }: { q: any; p: Record<string, string> }) {
  const shell = useShell();
  useEffect(() => {
    shell.toast("409 quotation_not_draft — issued content cannot be edited.", "bad");
  }, [shell]);
  return <Detail q={q} p={p} />;
}

function NotFound({ id }: { id: string }) {
  const { go } = useNav();
  return (
    <div className="page">
      <EmptyState icon="quote" title="404 quotation_not_found"
        body={<>No quotation with the reference <b>{id}</b>.</>}
        action={<button className="btn" data-go="#/quotations" onClick={() => go("#/quotations")}>Back to Quotation</button>} />
    </div>
  );
}

function Denied() {
  const { go } = useNav();
  return (
    <div className="page">
      <EmptyState icon="lock" title="403 out_of_scope"
        body="That quotation belongs to a deal that is not yours. Scope resolves through the parent deal on every call — knowing a quotation reference grants nothing on its own."
        action={<button className="btn" data-go="#/quotations" onClick={() => go("#/quotations")}>Back to Quotation</button>} />
    </div>
  );
}
