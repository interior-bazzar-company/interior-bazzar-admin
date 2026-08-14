/* =====================================================================
   AUTHORIZATION — applied at each engine's public boundary.
   ---------------------------------------------------------------------
   Every mutating call in the panel goes through one of the engine
   namespaces below. This file wraps those namespaces so each method
   checks a permission before it runs, and returns the engines' own
   `{ ok:false, http:403, code:"forbidden" }` when it does not hold.

   WHY HERE AND NOT INSIDE EACH ENGINE

   Scattering `guard()` calls through four engines means the answer to
   "what is protected, and by what" is spread across four files and has
   to be re-derived by reading all of them. The map below IS that answer,
   in one screen, and a method missing from it is visibly missing rather
   than quietly unguarded.

   It also keeps the engines honest about their own job: an engine
   validates its domain — a discount cannot exceed 100%, a payment needs
   an invoice — and authorization is a different question asked by a
   different system.

   WHAT THIS IS NOT

   Not a security boundary. `localStorage` is the database and these are
   functions in the same page; anyone with a console can call the
   underlying store directly, or edit this file. Read §2.2 of
   TEAM_OPERATION.md.

   What it IS: the shape the real check will take, at the layer that
   becomes the API. Each of these methods is a future HTTP handler, and
   the permission it needs is now written down next to it.
   ===================================================================== */
(function (root) {
  "use strict";
  var T = root.IBTeam;
  if (!T) return;                       // no team engine → nothing to enforce

  /* Wrap every named method so it asks first. The original is kept and
     called with the original `this`, so nothing about the engines changes
     except that they can now refuse. */
  function protect(obj, moduleKey, map, label) {
    if (!obj) return;
    Object.keys(map).forEach(function (method) {
      var fn = obj[method];
      if (typeof fn !== "function") {
        if (root.console && root.console.warn)
          root.console.warn("guards: " + label + "." + method + " does not exist");
        return;
      }
      var action = map[method];
      obj[method] = function () {
        var refused = T.guard(moduleKey, action);
        if (refused) return refused;
        return fn.apply(this, arguments);
      };
    });
  }

  /* ---------------------------------------------------------------- PLANS */
  /* The catalogue every quotation is priced from, so editing it is a
     commercial act rather than an administrative one. */
  var P = root.IBPlans;
  if (P) {
    protect(P.Catalogue, "plans", {
      create:"create", update:"edit", save:"edit",
      setStatus:"status", archive:"archive", remove:"archive"
    }, "IBPlans.Catalogue");
    protect(P.Pricing,  "plans", { set:"pricing" },  "IBPlans.Pricing");
    protect(P.Features, "plans", { set:"edit" },     "IBPlans.Features");
  }

  /* ---------------------------------------------------------------- DEALS */
  var E = root.IBDeals;
  if (E) {
    /* There is no separate close(): closing IS a stage change to Won or Lost,
       which is why `close` is a permission but not a method. Intake owns how a
       deal arrives, so there is no create() here either. */
    protect(E.Lifecycle, "deals", {
      change:"stage", setPriority:"edit", setValue:"edit",
      edit:"edit", clearNextAction:"edit"
    }, "IBDeals.Lifecycle");
    protect(E.Intake, "deals", { submit:"create" }, "IBDeals.Intake");
    protect(E.Activity, "deals", { remark:"edit" }, "IBDeals.Activity");
    /* Money is its own permission. Somebody who may move a deal through its
       stages is not automatically somebody who may say cash arrived. */
    protect(E.Ledger,     "deals", { pay:"payment", reverse:"payment" }, "IBDeals.Ledger");
    protect(E.Assignment, "deals", { reassign:"edit", requestCoAssign:"edit",
                                     decideCoAssign:"edit", setActive:"edit" }, "IBDeals.Assignment");
    protect(E.Tags,       "deals", { create:"edit", update:"edit", remove:"edit",
                                     apply:"edit", unapply:"edit" }, "IBDeals.Tags");
  }

  /* ----------------------------------------------------------- QUOTATIONS */
  var Q = root.IBQuote;
  if (Q) {
    protect(Q.Draft, "quotations", {
      create:"create", update:"edit", setPlan:"edit", saveAll:"edit",
      addAddon:"edit", updateAddon:"edit", removeAddon:"edit", cancel:"cancel"
    }, "IBQuote.Draft");
    protect(Q.Issuance,   "quotations", { issue:"issue", revise:"edit" }, "IBQuote.Issuance");
    /* Accepting is the act that writes the agreed value back to the deal and
       unlocks invoicing — the single most consequential click in the chain. */
    protect(Q.Acceptance, "quotations", { accept:"accept", reject:"accept" }, "IBQuote.Acceptance");
  }

  /* -------------------------------------------------------------- INVOICES */
  var N = root.IBInvoice;
  if (N) {
    protect(N.Draft, "invoices", {
      create:"create", update:"edit", setPlanAmount:"edit", saveAll:"edit",
      addAddon:"edit", updateAddon:"edit", removeAddon:"edit", cancel:"cancel"
    }, "IBInvoice.Draft");
    protect(N.Issuance,     "invoices", { issue:"issue" },  "IBInvoice.Issuance");
    /* Cancelling an issued invoice is its own namespace, and its own
       permission: it is not an edit, it voids a tax document. */
    protect(N.Cancellation, "invoices", { cancel:"cancel" }, "IBInvoice.Cancellation");
    protect(N.Proofs,   "invoices", { attach:"edit", remove:"edit" }, "IBInvoice.Proofs");
  }
})(window);

/* ---------------------------------------------------------------- ES module
   Nothing to export: guards wraps the engine namespaces in place, so this
   file is imported purely for its side effect. */
export {};
