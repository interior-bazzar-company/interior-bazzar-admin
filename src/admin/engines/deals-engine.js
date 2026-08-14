/* =============================================================================
   Deals — Module 1 · domain engine
   =============================================================================

   The rules, with no DOM in them. Everything the UI does goes through here, so
   a guard cannot be bypassed by rendering a different button.

   SEVEN STORES                    FOUR TRANSACTIONS
     S1 deal            mutable      T01 assignment  lock cursor → next active →
     S2 remark          append-only                  write owner + advance → commit
     S3 stage_transition append-only  T02 payment     idempotency → guards → snapshot
     S4 payment ledger  append-only                  → append → recalc → commit
     S5 co_assignment   request       T03 reversal    Head → locate original → append
     S6 roster + cursor mutable                      NEGATIVE → recalc → commit
     S7 enquiry         write-once    T04 stage       scope guard → append transition →
                                                     lock only if Lost → commit

   THREE THINGS THIS FILE REFUSES TO DO
     1. Throw for a business rejection. Every refusal is a VALUE carrying the
        exact code from the error contract, so the UI can print it. A rule you
        cannot see fire is a rule nobody trusts.
     2. Clamp. A payment above its invoice is rejected, never quietly reduced —
        clamping is how a ledger stops being true.
     3. Half-write. Every transaction snapshots the store and restores it on any
        rejection, so a failed guard cannot leave a partially mutated deal.

   MONEY IS INTEGER PAISE. ₹2,47,800 is 24780000. No float reaches a total.
   BUDGET EXISTS NOWHERE — not a field, filter, score, sort or parameter.
   ============================================================================= */
(function (root) {
  "use strict";

  var D = root.IBData;
  /* SCHEMA 2 renumbered the stages (six became five when Quotation Sent and
     Process merged into Slot Booked). A stored v1 deal carries stage numbers
     that mean something different now — stage 4 was Process and is now Won —
     so the guard below DISCARDS a v1 store and reseeds rather than migrating
     it. Silently reinterpreting the numbers would close deals nobody closed.
     SCHEMA 4 replaced `category` with `interested_in` and added business_name,
     email and state — a stored v3 deal has no value for any of them, so it is
     discarded and reseeded for the same reason.
     SCHEMA 5 removed rule tags. Every tag is now made by a person, so a stored
     v4 store carries three tags nothing can explain and a `kind` field nothing
     reads. Same treatment: discard and reseed.

     SCHEMA 6 put the funnel's own submission on the enquiry. `heal` backfills
     absent COLLECTIONS, and it is right not to go further: it could add an empty
     `response` to every stored enquiry, but an empty one and a missing one both
     render as "nothing was submitted", so the repair would buy nothing. What it
     must not do is invent one — a funnel response is a record of what a person
     typed, and a generated stand-in is a lie in the one place the UI promises
     verbatim truth. So a v5 store is discarded and reseeded, which is also what
     puts the demo submissions in front of anyone who had the panel open
     before.

     SCHEMA 8 stopped masking phone numbers. A stored "+91 98•••••••42" has
     lost seven digits and no migration can invent them back, so a v7 store is
     discarded and reseeded with numbers that are whole.

     SCHEMA 7 inserted Installment between Slot Booked and Won, so 4 no longer
     means what it meant: a stored deal at stage 4 was Won and would silently
     become mid-payment, and one at 5 was Lost and would become Won. That is the
     exact failure the very first bump existed to prevent, and it gets the same
     answer — discard and reseed, because reinterpreting the numbers would
     un-win deals somebody won. */
  var KEY = "ib_deals_store", SCHEMA = 8;

  /* Captured NOW, before anything publishes back into IBData. seed() must read
     the original literals — reading the arrays after publish() has rewritten
     them would re-seed from the engine's own last output, and every figure
     would drift a little further on each reset.                                */
  var SEED = { deals:D.deals.slice(), payments:D.payments.slice() };

  /* ---------------------------------------------------------------- stages --- */
  // Process sits between an accepted quotation and Won — "money is coming in,
  // fulfillment is underway." Entered automatically when the quotation is
  // accepted, left automatically the moment outstanding reaches ₹0 (Won).
  /* Six stages, each defined by an event rather than a document:
       Deal        a fresh lead, nothing said yet
       Followup    an interested conversation is happening
       Slot Booked the slot registration amount has been paid
       Installment the plan is being paid down, transfer by transfer
       Won         paid in full
       Lost        denied
     Quotation Sent and Process are gone: a quotation is a document the deal
     may or may not have, not a stage the deal sits in. What moves a deal is
     money arriving.

     Installment is the stage the old five were missing. Won used to fire on the
     FIRST installment, which meant a deal with four fifths of its value still
     outstanding wore the same green label as one paid in full — and, because
     Won was terminal on the matrix, there was no honest place left to put it
     while the rest came in. Won now means ₹0 outstanding and nothing less. */
  var STAGE = { DEAL:1, FOLLOWUP:2, SLOT:3, INSTALLMENT:4, WON:5, LOST:6 };

  /* THERE IS NO MATRIX ANY MORE.

     There was, and it was defensible on paper: New → Followup → Slot Booked →
     Won, with Lost off any of them and both ends terminal. In practice a
     pipeline is a description of where a deal HAS GOT TO, and the engine was
     treating it as a description of where a deal is ALLOWED to get to. Every
     real correction — a stage clicked by mistake, a deal that came in already
     paid, a Won that has to go back because the transfer bounced — arrived as
     `422 invalid_transition` against an operator who could see perfectly well
     what the truth was.

     So any stage can now be set from any other, including out of a closed one.
     Every move is still WRITTEN DOWN: an append-only transition row carrying
     who moved it, when, and whether it went backwards. The audit trail was
     always the thing that made this safe; the refusal was never doing the work
     people thought it was. */

  var STALL_DAYS = { 2:4, "default":7 };   // OD-04, configurable
  var TARGET2_DISCOUNT_CEILING = 30;       // DM-BR-07
  /* One formula, called from every place that sets is_target2_eligible — seed,
     edit, setValue and the two Module 2 sync handlers — so DM-BR-07 cannot
     drift into five slightly different readings of "above 30%". */
  function isTarget2Eligible(discountPct) { return (discountPct || 0) <= TARGET2_DISCOUNT_CEILING; }

  /* ------------------------------------------------------------- responses --- */
  function ok(data)  { return { ok:true, data:data }; }
  function err(http, code, detail) { return { ok:false, http:http, code:code, detail:detail || "" }; }

  /* ================================================================ STORE === */
  var DB = null;

  function blank() {
    return { _v:SCHEMA, deals:[], remarks:[], transitions:[], payments:[],
             coAssignments:[], enquiries:[], tags:[], dealTags:[],
             roster:{ members:[], cursor:0 }, events:[],
             seq:{ deal:2426, quote:157, invoice:93, pay:4409, enq:7815,
                   rem:0, tr:0, ca:0, tag:0 },
             jobs:{ stall:{ lastRun:null, running:false } } };
  }

  function load() {
    if (DB) { if (syncRosterFromTeam(DB)) persist(); return DB; }
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw._v === SCHEMA) {
        DB = heal(raw);
        if (syncRosterFromTeam(DB)) persist();
        return DB;
      }
    } catch (e) {}
    DB = seed();
    syncRosterFromTeam(DB);
    persist();
    return DB;
  }

  /* A store can carry the current schema number and still be missing a
     collection added to blank() afterwards — every build between the two is
     one that wrote `_v` before the field existed. The version check waves it
     through, and the first `undefined.map` takes the whole module down with
     "This view failed to render".

     So: backfill anything absent instead of trusting the version alone. An
     additive change to blank() is now survivable without discarding a store,
     which matters because discarding one throws away deals a user created.
     Only a change that alters the MEANING of existing fields needs a bump. */
  function heal(raw) {
    var base = blank(), changed = false;
    Object.keys(base).forEach(function (k) {
      if (raw[k] === undefined) { raw[k] = base[k]; changed = true; }
    });
    if (!raw.seq || typeof raw.seq !== "object") { raw.seq = base.seq; changed = true; }
    else Object.keys(base.seq).forEach(function (k) {
      if (raw.seq[k] === undefined) { raw.seq[k] = base.seq[k]; changed = true; }
    });
    /* Nothing is re-injected here any more. Tags are made by people, so a store
       that has none is a team that has made none — not a store to repair. What
       IS repaired is a tone that predates the tag palette — see LEGACY_TONES. */
    (raw.tags || []).forEach(function (t) {
      if (LEGACY_TONES[t.tone]) { t.tone = LEGACY_TONES[t.tone]; changed = true; }
      else if (TAG_TONES.indexOf(t.tone || "") < 0) { t.tone = ""; changed = true; }
    });
    if (changed) { DB = raw; persist(); }
    return raw;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
  function reset() { DB = seed(); persist(); return DB; }

  /* `storage` fires only in tabs OTHER than the one that wrote — exactly the
     tab whose cached DB just went stale. Dropping the cache is enough: the
     next load() (already on every read) picks the fresh copy off disk, and
     nothing here has to reach into a screen it does not own to redraw it. */
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("storage", function (e) {
      if (e.key === KEY) DB = null;
    });
  }

  /* A transaction is all-or-nothing. §17 Error Handling, made real rather than
     described: "Validation failures must not partially mutate the deal."       */
  /* Cross-module calls queue here and fire only after the commit. A call made
     inside a transaction holds a row lock across a network timeout, which is
     how a slow neighbour becomes an outage here. */
  var PENDING = [];
  function publishAfterCommit(fn) { PENDING.push(fn); }

  function tx(fn) {
    load();
    var snapshot = JSON.stringify(DB);
    var r;
    try { r = fn(); }
    catch (e) { DB = JSON.parse(snapshot); return err(500, "internal_error", e.message); }
    if (!r || r.ok === false) {
      DB = JSON.parse(snapshot); PENDING.length = 0;   // nothing committed, nothing published
      return r || err(500, "internal_error", "");
    }
    persist();
    // Cross-module calls fire HERE — after the commit, never inside it.
    PENDING.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
    return r;
  }

  /* ---------------------------------------------------------------- seeding --- */
  /* Seeds from the canonical dataset in admin-data.js so every figure already on
     the dashboard survives, then enriches it with what v1.3 added: an enquiry
     record, a roster with a cursor, attribution snapshots and idempotency keys. */
  function seed() {
    var db = blank();
    var R = D.R;

    db.roster.members = [
      { id:"R. Menon", active:true,  position:0 },
      { id:"K. Iyer",  active:true,  position:1 },
      { id:"A. Rao",   active:true,  position:2 },
      { id:"S. Fernandes", active:false, position:3 }   // inactive — the cursor must skip it
    ];
    db.roster.cursor = 1;

    SEED.deals.forEach(function (s, i) {
      db.enquiries.push({
        enquiry_id:s.enquiry, submission_id:"sub-" + s.enquiry.toLowerCase(),
        source:"funnel", city:s.city, state:s.state || "—", interested_in:s.interestedIn,
        /* Built and then normalised through the SAME function a live webhook
           goes through, rather than hand-writing the stored shape. A seed that
           takes a shortcut around the parser is a seed that stops proving the
           parser works. */
        response:normaliseResponse(seedFunnelForm(s, i), s.created),
        contact_verdict:"pass", genuineness_verdict:"pass", urgency_verdict:"pass",
        verified_at:s.created, verified_by:"qualification",
        released_to_business_id:null, released_at:null
      });
      db.deals.push({
        deal_id:s.ref, enquiry_id:s.enquiry,
        customer_name:s.who, business_name:s.business || "", email:s.email || "",
        city:s.city, state:s.state || "—", phone:s.phone, interested_in:s.interestedIn,
        owner_id:s.owner, co_owner_id:s.coOwner || null, split_ratio:s.split || null,
        stage:s.stage,
        deal_value:s.value || null, discount_pct:s.discount === undefined ? null : s.discount,
        is_target2_eligible:isTarget2Eligible(s.discount),
        revenue_collected:0, outstanding:s.value || 0,      // recomputed below
        quotation_id:null, quotation_status:"none",
        invoice_id:null, invoice_status:"none",
        duplicate_count:s.duplicates || 0,
        priority:s.priority, expected_close_date:s.expectedClose || null,
        next_action:s.nextAction ? { date:s.nextAction.date, note:s.nextAction.note } : null,
        last_remark_at:s.stageSince, is_stalled:!!s.stalled,
        created_at:s.created, closed_at:s.stage >= STAGE.WON ? s.stageSince : null,
        close_reason:s.lostReason || null,
        stage_since:s.stageSince
      });
      db.remarks.push({
        remark_id:"rm-" + (++db.seq.rem), deal_id:s.ref, type:"system",
        author:"System", text:"Deal created from funnel intake and assigned to " + s.owner + " by round-robin.",
        next_action_date:null, created_at:s.created
      });
      if (s.stage >= 2) {
        db.remarks.push({
          remark_id:"rm-" + (++db.seq.rem), deal_id:s.ref, type:"manual",
          author:s.owner, text:"First contact made — customer is engaged.",
          next_action_date:s.nextAction ? s.nextAction.date : null, created_at:s.stageSince
        });
        db.transitions.push({ transition_id:"tr-" + (++db.seq.tr), deal_id:s.ref,
          from_stage:1, to_stage:2, actor:s.owner, actor_role:"sales_agent",
          reason:null, entered_at:s.stageSince });
      }
      if (s.stage >= 3 && s.stage !== STAGE.LOST) {
        db.transitions.push({ transition_id:"tr-" + (++db.seq.tr), deal_id:s.ref,
          from_stage:2, to_stage:3, actor:"System", actor_role:"system",
          reason:"Slot registration amount received — moved to Slot Booked automatically.",
          entered_at:s.stageSince });
      }
      if (s.stage >= STAGE.INSTALLMENT && s.stage !== STAGE.LOST) {
        db.transitions.push({ transition_id:"tr-" + (++db.seq.tr), deal_id:s.ref,
          from_stage:3, to_stage:STAGE.INSTALLMENT, actor:"System", actor_role:"system",
          reason:"First installment confirmed — moved to Won automatically.",
          entered_at:s.stageSince });
      }
      if (s.stage === STAGE.WON) {
        db.transitions.push({ transition_id:"tr-" + (++db.seq.tr), deal_id:s.ref,
          from_stage:STAGE.INSTALLMENT, to_stage:STAGE.WON, actor:"System", actor_role:"system",
          reason:"Paid in full — moved to Won automatically.", entered_at:s.stageSince });
      }
      if (s.stage === STAGE.LOST) {
        db.transitions.push({ transition_id:"tr-" + (++db.seq.tr), deal_id:s.ref,
          from_stage:2, to_stage:STAGE.LOST, actor:s.owner, actor_role:"sales_agent",
          reason:s.lostReason || null, entered_at:s.stageSince });
      }
    });

    /* Tags. Every one of them is made by a person — there is no engine
       vocabulary here any more. These five are seeded so the Tags screen opens
       with a worked example of what a team actually sorts by rather than an
       empty list, and they are ordinary in every respect: renameable,
       recolourable, deletable, applied and removed by hand.                    */
    [["site-visit-due",  "Site visit due",  "amber",  "R. Menon"],
     ["price-sensitive", "Price sensitive", "",       "R. Menon"],
     ["hot-lead",        "Hot lead",        "red",    "R. Menon"],
     ["yearly-plan",     "Yearly plan",     "green",  "A. Sharma"],
     ["walk-in",         "Walk-in",         "cyan",   "A. Sharma"],
     ["referral",        "Referral",        "violet", "A. Sharma"],
     ["reopened",        "Reopened",        "slate",  "R. Menon"]
    ].forEach(function (c) {
      db.tags.push({ slug:c[0], label:c[1], tone:c[2],
                     created_by:c[3], created_at:"2026-06-10" });
    });
    /* A deal carries as many as it needs, and most carry none — a dataset where
       everything is tagged makes the filter look useful when it is not. */
    [["DL-2511", "yearly-plan"], ["DL-2511", "hot-lead"],
     ["DL-2512", "yearly-plan"], ["DL-2509", "yearly-plan"],
     ["DL-2510", "yearly-plan"], ["DL-2508", "yearly-plan"],
     ["DL-2508", "site-visit-due"],
     ["DL-2506", "site-visit-due"], ["DL-2504", "site-visit-due"],
     ["DL-2504", "hot-lead"],
     ["DL-2507", "price-sensitive"], ["DL-2514", "price-sensitive"],
     ["DL-2513", "walk-in"], ["DL-2505", "referral"], ["DL-2512", "referral"],
     ["DL-2507", "reopened"]
    ].forEach(function (pair) { attachTag(db, pair[0], pair[1], "R. Menon"); });

    /* Chain mirrors. Deals stores four scalars; these carry ONLY what its gates
       need — id, deal, amount, status. Line items, tax and the PDF never enter
       this module. That is the whole decoupling contract.                       */
    /* Quotation rows are Module 2's. This module keeps four scalars and no more
       (QUOTATION_DEAL_CONTRACT §2); IBQuote seeds and owns the documents. */

    /* Invoice rows are Module 3's — lines, tax and the PDF never enter Module 1
       (INVOICE_CHAIN_CONTRACT §3). What stays here is the payment ledger, which
       is genuinely ours, plus two scalars. */

    SEED.payments.forEach(function (p) {
      // Only money that has actually been accepted enters the deal ledger.
      // Submitted, unmatched and refund-requested rows stay with Finance.
      if (!p.deal || (p.state !== "verified" && p.state !== "reversed")) return;
      var dl = db.deals.filter(function (x) { return x.deal_id === p.deal; })[0];
      var reversed = p.state === "reversed";
      // A reversed payment is TWO rows, not one negative row. The original is
      // retained and marked voided; a negative entry referencing it is appended.
      // Collapsing them would net to −₹59,000 instead of ₹0 and quietly
      // understate every figure downstream.
      db.payments.push({
        payment_id:p.ref, deal_id:p.deal, invoice_id:p.invoice, type:"payment",
        amount_paise:p.amount, payment_date:p.received, mode:p.mode, reference:p.utr,
        reverses_payment_id:null, idempotency_key:"seed-" + p.ref,
        owner_id:dl ? dl.owner_id : null, co_owner_id:dl ? dl.co_owner_id : null,
        split_ratio:dl ? dl.split_ratio : null,          // attribution snapshot, AD-03
        recorded_by:p.by || (dl ? dl.owner_id : "System"), created_at:p.received,
        voided:reversed
      });
      if (reversed) {
        db.payments.push({
          payment_id:p.ref + "-R", deal_id:p.deal, invoice_id:p.invoice, type:"reversal",
          amount_paise:-p.amount, payment_date:p.received, mode:p.mode,
          reference:"REV of " + p.ref, reverses_payment_id:p.ref,
          idempotency_key:"seed-rev-" + p.ref,
          owner_id:dl ? dl.owner_id : null, co_owner_id:dl ? dl.co_owner_id : null,
          split_ratio:dl ? dl.split_ratio : null,
          recorded_by:"V. Shakya", created_at:p.received, voided:false,
          reason:p.reversedReason || "Reversed" });
      }
    });

    // Wire the chain scalars, then let the ledger decide the money.
    db.deals.forEach(function (dl) { syncChain(db, dl); recalc(db, dl); });
    return db;
  }

  /* --------------------------------------------------------- roster/team sync */
  /* The roster's cursor and active flag are round-robin STATE — genuinely this
     module's own — but WHO can hold a deal is identity, and Team is the one
     place identity lives (team-engine.js: "there is no second user model").
     A member granted Sales Agent or Sales Head belongs in the rotation the
     moment that grant lands. Nothing previously did this, which is why a
     freshly added agent's Deals module stayed empty forever with no way
     out — never assigned a deal, and with no UI anywhere to add them to the
     roster by hand either.

     Additive only: an existing row — including the four seeded before Team
     existed — is never removed or deactivated here, so historical ownership
     and the demo data it explains stay exactly as they are. */
  function syncRosterFromTeam(db) {
    var T = root.IBTeam;
    if (!T || typeof T.members !== "function") return false;
    var have = {}, changed = false;
    db.roster.members.forEach(function (m) { have[m.id] = true; });
    T.members().forEach(function (u) {
      if (have[u.name] || u.status !== "active") return;
      var roles = T.roleIdsOf(u);
      if (roles.indexOf("sales_agent") < 0 && roles.indexOf("sales_head") < 0) return;
      db.roster.members.push({ id:u.name, active:true, position:db.roster.members.length });
      have[u.name] = true; changed = true;
    });
    return changed;
  }

  /* ============================================================== HELPERS === */
  function find(list, key, val) {
    for (var i = 0; i < list.length; i++) if (list[i][key] === val) return list[i];
    return null;
  }
  function dealOf(id) { return find(load().deals, "deal_id", id); }
  function quotesFor(id) {   // read-only, through Module 2 — never a local store
    return root.IBQuote ? root.IBQuote.forDeal(id) : [];
  }
  /* A read view over Module 3, translated into the two facts the ledger needs:
     how much this invoice demands, and how much of it has landed.            */
  function invoicesFor(id) {
    var M3 = root.IBInvoice; if (!M3) return [];
    return M3.forDeal(id).map(function (i) {
      return { invoice_id:i.invoice_id, number:i.invoice_number, deal_id:i.deal_id,
        amount_paise:i.grand_total_paise, received_paise:M3.received(i),
        raised_at:i.issued_at || i.invoice_date,
        status:i.invoice_status === "cancelled" ? "cancelled"
             : i.invoice_status === "draft" ? "draft"
             : i.payment_id ? "paid" : "raised",
        // the plan remark is what names the payment ("Slot booking",
        // "Installment 1"), which is what the stage machine reads.
        remark:(M3.planOf(i.invoice_id) || {}).remark || null,
        due:i.due_date, owner:i.owner, cancelled_reason:i.cancellation_reason };
    });
  }
  function paymentsFor(id) { return load().payments.filter(function (p) { return p.deal_id === id; }); }
  function remarksFor(id)  { return load().remarks.filter(function (r) { return r.deal_id === id; }); }
  function acceptedQuote(id) {
    return root.IBQuote ? root.IBQuote.acceptedOf(id) : null;
  }

  /* revenue_collected = SUM(valid ledger entries). outstanding = value − that.
     Both DERIVED, never hand-edited — the invariant the whole module rests on. */
  function recalc(db, dl) {
    var rows = db.payments.filter(function (p) { return p.deal_id === dl.deal_id; });
    dl.revenue_collected = rows.reduce(function (a, p) { return a + p.amount_paise; }, 0);
    dl.outstanding = Math.max(0, (dl.deal_value || 0) - dl.revenue_collected);
  }

  /* The four scalars, recomputed from the chain mirrors. Deals owns WHICH STATE
     the chain is in — never the documents themselves.                          */
  /* Neither half is ours any more. Both pairs of scalars are written by Sync
     when a module's outbox delivers, and reconstructed once at boot. */
  function syncChain(db, dl) {
    var invs = invoicesFor(dl.deal_id).filter(function (i) {
      return i.status !== "cancelled" && i.status !== "draft"; });
    var open = invs.filter(function (i) { return i.status === "raised"; })[0];
    var last = open || invs[0];
    dl.invoice_id = last ? last.invoice_id : null;
    dl.invoice_status = !invs.length ? "none"
      : invs.every(function (i) { return i.status === "paid"; }) ? "paid" : "raised";
  }

  /* Uninvoiced balance — the cap a new invoice is measured against.
     SUM(grand_total) over non-cancelled invoices ≤ deal_value, always. The sum
     lives in Module 3; the rule is stated in both places and enforced in one. */
  function uninvoiced(dl) {
    return root.IBInvoice ? root.IBInvoice.outstandingFor(dl.deal_id) : dl.deal_value;
  }


  /* `channel` is orthogonal to `type` — a manual entry can be a plain remark,
     or a log of a WhatsApp/email message actually sent to the customer. The
     Chat workspace uses it to decide which side of the thread an entry sits
     on; nothing else in the engine reads it. Absent = "remark" (every existing
     call site is unaffected). */
  function appendRemark(db, dealId, type, author, text, nextDate, at, channel) {
    var r = { remark_id:"rm-" + (++db.seq.rem), deal_id:dealId, type:type, author:author,
              channel:channel || "remark",
              text:text, next_action_date:nextDate || null, at:at, created_at:at || todayISO() };
    db.remarks.push(r);
    var dl = find(db.deals, "deal_id", dealId);
    if (dl) {
      dl.last_remark_at = r.created_at;
      dl.is_stalled = false;                    // clears on the next remark, always
      if (nextDate) dl.next_action = { date:nextDate, note:text };
    }
    return r;
  }
  function emit(db, type, payload, note) {
    db.events.push({ type:type, payload:payload, at:nowISO(), consumed_by:null, note:note || null });
  }
  function todayISO() {
    var t = D.TODAY;
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  }
  function nowISO() { return todayISO() + " " + new Date().toTimeString().slice(0, 5); }
  function daysBetween(iso) { return D.days(D.d(iso)); }

  /* ---------------------------------------------------------------- scope --- */
  /* Enforced here, not by hiding UI. An out-of-scope id returns 403 — never an
     empty result and never the record.                                          */
  function isHead(actor) { return !actor || actor.role === "super_admin" || actor.role === "sales_head" || actor.role === "ops_manager"; }
  function inScope(actor, dl) {
    if (isHead(actor)) return true;
    var me = actor.name;
    return dl.owner_id === me || dl.co_owner_id === me;
  }
  function guardDeal(id, actor, opts) {
    var dl = dealOf(id);
    if (!dl) return err(404, "deal_not_found", id);
    if (!inScope(actor, dl)) return err(403, "out_of_scope", id);
    return ok(dl);
  }

  /* ============================================================== INTAKE === */
  var Intake = {
    /* Flow 01. Signature → validate → normalise → duplicate lookup →
       create @ Generated + T01, or attach to the EARLIEST matching deal.        */
    submit: function (p) {
      return tx(function () {
        var db = DB;

        // AD-07 open: the signing key does not exist yet. The step is present so
        // that adding it later is a one-line change, not a redesign.
        if (p.signature === false) return err(401, "signature_invalid", "Webhook signature did not verify.");

        if (!p.customer_name || !p.phone) return err(400, "validation_failed", "name and phone are required");
        var phone = normalisePhone(p.phone);
        if (!phone) return err(400, "validation_failed", "phone is not a valid Indian mobile number");

        if (p.submission_id && find(db.enquiries, "submission_id", p.submission_id))
          return err(409, "duplicate_submission", p.submission_id);

        // DM-BR-04 — a repeat attaches to the EARLIEST matching deal, increments
        // the count, appends a system remark, notifies the owner, and the cursor
        // DOES NOT MOVE. Treating a returning customer as new would quietly
        // corrupt rotation fairness.
        var matches = db.deals.filter(function (x) { return x.phone === phone; })
                              .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
        if (matches.length) {
          var orig = matches[0];
          orig.duplicate_count = (orig.duplicate_count || 0) + 1;
          appendRemark(db, orig.deal_id, "system", "System",
            "Repeat funnel submission from the same number. Attached to this deal; no new deal created and the assignment cursor did not move.",
            null, todayISO());
          emit(db, "deal.repeat", { deal_id:orig.deal_id, owner:orig.owner_id });
          return ok({ attached:true, deal:orig,
            note:"Attached to " + orig.deal_id + ". Cursor unchanged (DM-BR-04)." });
        }

        // AD-08 — undefined in the spec. Implemented as: reject intake and alert
        // the Head, because creating an unowned deal silently loses it.
        var active = db.roster.members.filter(function (m) { return m.active; });
        if (!active.length) {
          emit(db, "roster.empty", {}, "Intake rejected — no active Sales-emp on the roster.");
          return err(422, "roster_empty", "No active Sales-emp on the roster. Intake rejected and the Sales Head has been alerted (AD-08).");
        }

        var enqId = "ENQ-" + (++db.seq.enq);
        db.enquiries.push({ enquiry_id:enqId, submission_id:p.submission_id || ("sub-" + enqId.toLowerCase()),
          source:p.source || "manual", city:p.city || "—", state:p.state || "—",
          interested_in:p.interested_in || "—",
          /* Exactly what the funnel posted, normalised once. A deal keyed in by
             hand has none, and that absence is honest — nobody filled a form. */
          response:normaliseResponse(p.response),
          contact_verdict:"pass", genuineness_verdict:"pass", urgency_verdict:"pass",
          verified_at:todayISO(), verified_by:p.verified_by || "qualification",
          released_to_business_id:null, released_at:null });

        var id = "DL-" + (++db.seq.deal);
        var dl = {
          deal_id:id, enquiry_id:enqId,
          customer_name:p.customer_name, business_name:p.business_name || "", email:p.email || "",
          city:p.city || "—", state:p.state || "—", phone:phone, interested_in:p.interested_in || "—",
          owner_id:null, co_owner_id:null, split_ratio:null,
          stage:STAGE.DEAL,
          deal_value:null, discount_pct:null, is_target2_eligible:true,
          revenue_collected:0, outstanding:0,
          quotation_id:null, quotation_status:"none", invoice_id:null, invoice_status:"none",
          duplicate_count:0,
          priority:p.priority || 1, expected_close_date:p.expected_close_date || null,
          next_action:{ date:todayISO(), note:"First contact" },
          last_remark_at:todayISO(), is_stalled:false,
          created_at:todayISO(), closed_at:null, close_reason:null,
          stage_since:todayISO()
        };
        db.deals.push(dl);

        // T01 — owner and cursor commit together or roll back together.
        // Exception: a non-head actor creating their OWN off-funnel deal keeps
        // it. Round-robin (DM-BR-03) exists to stop a Head handing out
        // favourites when entering business on someone else's behalf — it was
        // never meant to take a lead away from the agent who personally
        // fielded the call and typed it in. The funnel, repeats, and a Head's
        // own manual create still go through the cursor exactly as before.
        var selfOwner = p.actor && !isHead(p.actor) &&
          find(db.roster.members, "id", p.actor.name);
        var selfAssigned = !!(selfOwner && selfOwner.active);
        var a;
        if (selfAssigned) { dl.owner_id = selfOwner.id; a = ok(dl); }
        else a = Assignment._assign(db, dl);
        if (a.ok === false) return a;

        appendRemark(db, id, "system", "System",
          selfAssigned
            ? "Deal created from " + (p.source || "manual intake") + " by " + dl.owner_id + "."
            : "Deal created from " + (p.source || "manual intake") + " and assigned to " + dl.owner_id + " by round-robin.",
          null, todayISO());
        /* Nothing is tagged here. Where a deal came from is `source`, recorded
           on the deal and stated in the remark above — a pill saying the same
           thing was a second copy of one fact, and the only one of the two a
           person could delete. */
        emit(db, "deal.assigned", { deal_id:id, owner:dl.owner_id });
        return ok({ attached:false, deal:dl, selfAssigned:selfAssigned });
      });
    }
  };

  /* ------------------------------------------------- the funnel response ---
     The funnel posts JSON. That is somebody else's system, so what arrives here
     is untrusted in shape as well as in content: it may be a string that has to
     be parsed, it may carry fields nobody has seen before, and it may carry two
     hundred of them. None of that may reach a view.

     So it is normalised ONCE, on the way in, into an ordered list of
     {key, label, value} with everything already a string — and the raw text is
     kept beside it, because when a field looks wrong the first question is
     always "what did they actually send?" and a rendered table cannot answer it.

     Order is preserved deliberately: the funnel's field order IS the order the
     customer answered in, and re-sorting it alphabetically would throw away the
     only thing telling you how the form was laid out. */
  var RESP_MAX_FIELDS = 40, RESP_MAX_LEN = 400, RESP_MAX_RAW = 8000;

  /* Words a sentence-case label must not flatten. `gst_number` becoming
     "Gst number" reads as a typo to the person whose form it is, and the fix is
     a short list rather than a rule — there is no algorithm that knows GST is an
     acronym and Goa is not. Anything not on the list is left alone, which is the
     safe direction: an unknown field arrives from someone else's form and
     inventing capitals for it would be worse than leaving it plain. */
  var TITLE_FIX = { gst:"GST", id:"ID", url:"URL", utm:"UTM", pan:"PAN", otp:"OTP",
                    sms:"SMS", crm:"CRM", faq:"FAQ", api:"API", pin:"PIN",
                    whatsapp:"WhatsApp", ip:"IP", dob:"DOB", emi:"EMI", inr:"INR" };
  function titleise(k) {
    return String(k)
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ").trim()
      .split(" ")
      .map(function (w, i) {
        var fix = TITLE_FIX[w.toLowerCase()];
        if (fix) return fix;
        return i === 0 ? w.replace(/^./, function (c) { return c.toUpperCase(); }) : w;
      })
      .join(" ");
  }
  /* One scalar out of whatever JSON put there. An object or array is stringified
     rather than walked: a nested payload is still worth SHOWING, and a renderer
     that recurses is a renderer that can be handed a cycle. */
  function flatten(v) {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.map(flatten).filter(function (x) { return x !== ""; }).join(", ");
    if (typeof v === "object") { try { return JSON.stringify(v); } catch (e) { return "[unreadable]"; } }
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  }
  /* `at` is when the submission arrived. A live webhook does not pass one and
     gets today; the seed passes the deal's own creation date, because a demo
     where every form was filled in this morning teaches the wrong shape. */
  function normaliseResponse(input, at) {
    if (input === null || input === undefined || input === "") return null;
    at = at || todayISO();
    var raw = typeof input === "string" ? input : null, obj = input;
    if (raw !== null) {
      try { obj = JSON.parse(raw); }
      catch (e) {
        /* Unparseable is not the same as absent. Keep the text so an operator can
           see what the funnel sent and why nothing came out of it. */
        return { fields:[], raw:raw.slice(0, RESP_MAX_RAW), received_at:at,
                 error:"The funnel sent something that is not valid JSON." };
      }
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj))
      return { fields:[], raw:String(raw === null ? safeJson(input) : raw).slice(0, RESP_MAX_RAW),
               received_at:at,
               error:"The funnel sent JSON that is not an object of fields." };

    var fields = [], keys = Object.keys(obj), dropped = 0;
    if (keys.length > RESP_MAX_FIELDS) { dropped = keys.length - RESP_MAX_FIELDS; keys = keys.slice(0, RESP_MAX_FIELDS); }
    keys.forEach(function (k) {
      var v = flatten(obj[k]);
      fields.push({ key:String(k), label:titleise(k),
                    value:v.length > RESP_MAX_LEN ? v.slice(0, RESP_MAX_LEN) + "\u2026" : v });
    });
    return { fields:fields, raw:(raw === null ? safeJson(obj) : raw).slice(0, RESP_MAX_RAW),
             received_at:at,
             error:dropped ? dropped + " further field(s) arrived and were not stored." : null };
  }
  function safeJson(o) { try { return JSON.stringify(o, null, 2); } catch (e) { return "{}"; } }

  /* What the public funnel posts for one business. Field NAMES are the funnel's,
     not this module's — `full_name` and `whatsapp_number` are what the form
     calls them, and renaming them on the way in would hide the mismatch that
     matters when the form changes under us. The last few vary by row so the
     panel is exercised against short answers, long ones, a missing optional and
     a multi-select that arrives as an array. */
  var FUNNEL_HEARD = ["Instagram ad", "Google search", "Referral from a friend",
                      "WhatsApp forward", "YouTube", "Already a customer"];
  var FUNNEL_SIZE = ["Just me", "2\u20135 people", "6\u201315 people", "16\u201340 people"];
  var FUNNEL_BUDGET = ["Under \u20b925,000", "\u20b925,000 \u2013 \u20b950,000",
                       "\u20b950,000 \u2013 \u20b91,00,000", "Above \u20b91,00,000"];
  var FUNNEL_WHEN = ["Immediately", "Within a month", "In 2\u20133 months", "Just exploring"];
  var FUNNEL_GOAL = [["More enquiries"], ["More enquiries", "Better brand presence"],
                     ["Showcase my catalogue"], ["More enquiries", "Showcase my catalogue", "Hire designers"],
                     ["Better brand presence"]];
  var FUNNEL_TRADE = ["Modular kitchen", "Full home interiors", "False ceiling & lighting",
                      "Wardrobes & storage", "Painting & finishes", "Flooring",
                      "3D visualisation", "Turnkey commercial"];
  var FUNNEL_SERVICES = [
    ["Design consultation", "Execution"],
    ["Design consultation"],
    ["Design consultation", "Execution", "Material supply"],
    ["Execution", "Material supply"],
    ["3D walkthroughs", "Design consultation", "Execution"]
  ];
  var FUNNEL_LANGS = [["Hindi", "English"], ["English"], ["Marathi", "Hindi", "English"],
                      ["Telugu", "English"], ["Malayalam", "English"], ["Gujarati", "Hindi"]];
  var FUNNEL_LEADS = ["Fewer than 5", "5\u201315", "15\u201340", "More than 40"];
  var FUNNEL_PIN = ["400076", "226010", "452010", "122018", "395007", "682024",
                    "248001", "560095", "500081", "411045", "400703", "560066",
                    "302017", "600041"];
  var FUNNEL_MSG = [
    "Please call before noon, I am on site after that.",
    "",
    "We already run ads ourselves but the leads are poor quality. Want to understand what you do " +
      "differently before committing to a year \u2014 and whether the enquiries are exclusive to me or " +
      "shared with three other studios in the same pincode.",
    "Interested in the trial first.",
    "",
    "Need this sorted before the festive season. How soon does the profile go live after payment?"
  ];

  /* One business's submission, as the public funnel posts it.
     Field NAMES are the funnel's own — `full_name`, `whatsapp_number` — not this
     module's, because renaming them on the way in would hide the mismatch that
     matters on the day the form changes under us.

     The variety is deliberate. Across the fourteen seeded deals this produces
     blank optionals, one-word answers and a paragraph, arrays of two and of
     three, booleans, a conditional field that is only present for some rows,
     and analytics keys nobody will ever read but that a real form does send.
     A demo where every row looks the same proves nothing about the renderer. */
  function seedFunnelForm(s, i) {
    var slug = (s.business || s.who).toLowerCase().replace(/[^a-z0-9]+/g, "");
    var gst = i % 3 !== 2;
    var f = {
      full_name:s.who,
      business_name:s.business || "",
      whatsapp_number:s.phone,
      email:s.email || "",
      city:s.city,
      state:s.state || "",
      pincode:FUNNEL_PIN[i % FUNNEL_PIN.length],
      business_category:FUNNEL_TRADE[i % FUNNEL_TRADE.length],
      services_offered:FUNNEL_SERVICES[i % FUNNEL_SERVICES.length],
      years_in_business:String(2 + (i * 3) % 17),
      team_size:FUNNEL_SIZE[i % FUNNEL_SIZE.length],
      has_showroom:i % 4 !== 1,
      current_monthly_leads:FUNNEL_LEADS[i % FUNNEL_LEADS.length],
      plan_interest:s.interestedIn,
      primary_goal:FUNNEL_GOAL[i % FUNNEL_GOAL.length],
      monthly_budget:FUNNEL_BUDGET[i % FUNNEL_BUDGET.length],
      ready_to_start:FUNNEL_WHEN[i % FUNNEL_WHEN.length],
      has_gst:gst
    };
    /* Only asked when the previous answer was yes, so it is simply absent on the
       rows that said no \u2014 which is what a conditional field looks like in real
       submitted data, and what the panel has to render without a hole. */
    if (gst) f.gst_number = ["27", "09", "23", "06", "24", "32", "05", "29", "36", "27", "27", "29", "08", "33"][i % 14] +
      "ABCDE" + (1234 + i * 7) + "K1Z" + (i % 10);
    f.website = i % 4 === 0 ? "" : "www." + slug + ".in";
    f.instagram_handle = i % 3 === 1 ? "" : "@" + slug.slice(0, 16);
    f.languages = FUNNEL_LANGS[i % FUNNEL_LANGS.length];
    f.how_did_you_hear = FUNNEL_HEARD[i % FUNNEL_HEARD.length];
    f.preferred_call_time = ["Morning (9\u201312)", "Afternoon (12\u20134)", "Evening (4\u20138)"][i % 3];
    f.message = FUNNEL_MSG[i % FUNNEL_MSG.length];
    f.consent_marketing = i % 2 === 0;
    f.agreed_to_terms = true;
    /* What the form ships alongside the answers. Nobody reads these until the
       day somebody asks which campaign a customer came from. */
    f.submitted_from = "/plans?utm_source=" + ["instagram", "google", "referral", "direct"][i % 4] +
      "&utm_campaign=" + ["festive26", "always-on", "retarget", "launch"][i % 4];
    f.form_version = "funnel-v3." + (i % 3);
    f.time_on_page_seconds = 90 + (i * 37) % 400;

    /* The funnel posts JSON, so that is what the seed hands over \u2014 a string, not
       an object, exercising the parse path every real submission takes. */
    return JSON.stringify(f);
  }

  function normalisePhone(raw) {
    var digits = String(raw).replace(/[^\d]/g, "");
    if (digits.length === 12 && digits.indexOf("91") === 0) digits = digits.slice(2);
    if (digits.length === 11 && digits.charAt(0) === "0") digits = digits.slice(1);
    if (!/^[6-9]\d{9}$/.test(digits)) return null;
    /* THE WHOLE NUMBER, stored whole.

       This used to return "+91 98•••••••42" — it masked the middle seven digits
       and then STORED that, which is not privacy, it is data loss. The number
       could not be dialled from the record, could not be exported, could not be
       matched against a later submission except by the two digits that survived,
       and could never be un-masked because the digits were simply gone.

       If a masked view is ever wanted it is a rendering choice, made where the
       rendering happens and against a record that still knows the answer. */
    return "+91 " + digits.slice(0, 5) + " " + digits.slice(5);
  }

  /* ========================================================== ASSIGNMENT === */
  var Assignment = {
    /* T01. The cursor row is the lock. It skips inactive members and advances
       past the one it picked — so two submissions in the same instant cannot
       take the same slot.                                                       */
    _assign: function (db, dl) {
      var members = db.roster.members;
      var n = members.length;
      if (!n) return err(422, "roster_empty", "Roster is empty.");
      var pick = -1;
      for (var i = 0; i < n; i++) {
        var idx = (db.roster.cursor + i) % n;
        if (members[idx].active) { pick = idx; break; }
      }
      if (pick < 0) return err(422, "roster_empty", "No active Sales-emp on the roster.");
      dl.owner_id = members[pick].id;
      db.roster.cursor = (pick + 1) % n;         // advance — same transaction
      return ok(dl);
    },

    /* Reassignment: Head only, reason MANDATORY, system remark appended.
       Ledger attribution is NOT rewritten — every payment row snapshotted its
       owner and split at write time. Money already collected is never
       re-attributed. This is the subtlest rule in the module.                   */
    reassign: function (dealId, newOwner, reason, actor) {
      return tx(function () {
        if (!isHead(actor)) return err(403, "admin_required", "Sales Head role required.");
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        if (!reason || !reason.trim()) return err(400, "validation_failed", "A reason is mandatory on reassignment.");
        var m = find(DB.roster.members, "id", newOwner);
        if (!m || !m.active) return err(400, "validation_failed", "New owner must be an active roster member.");
        if (m.id === dl.owner_id) return err(400, "validation_failed", "That is already the owner.");
        var old = dl.owner_id;
        dl.owner_id = m.id;
        appendRemark(DB, dealId, "system", actor.name,
          "Owner reassigned from " + old + " to " + m.id + ". Reason: " + reason.trim() +
          " · Payments already collected keep their original attribution.", null, todayISO());
        emit(DB, "deal.reassigned", { deal_id:dealId, from:old, to:m.id });
        return ok(dl);
      });
    },

    requestCoAssign: function (dealId, coOwner, split, reason, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        if (!coOwner) return err(400, "validation_failed", "A co-owner is required.");
        if (coOwner === dl.owner_id) return err(400, "validation_failed", "The owner cannot co-own their own deal.");
        if (!reason || !reason.trim()) return err(400, "validation_failed", "A reason is required.");
        var s = parseInt(split, 10);
        if (isNaN(s) || s < 1 || s > 99) return err(400, "validation_failed", "Split must be between 1 and 99.");
        var dupe = DB.coAssignments.filter(function (c) { return c.deal_id === dealId && c.status === "pending"; })[0];
        if (dupe) return err(422, "already_pending", "A co-assignment request is already pending for this deal.");
        DB.coAssignments.push({ co_assignment_id:"ca-" + (++DB.seq.ca), deal_id:dealId,
          co_owner:coOwner, proposed_split:s, approved_split:null, reason:reason.trim(),
          status:"pending", requested_by:actor.name, decision_actor:null, created_at:todayISO() });
        appendRemark(DB, dealId, "system", actor.name,
          "Co-assignment requested: " + coOwner + " at " + (100 - s) + " / " + s + ". Awaiting Sales Head approval.",
          null, todayISO());
        return ok({ pending:true });
      });
    },

    decideCoAssign: function (caId, approve, split, actor) {
      return tx(function () {
        if (!isHead(actor)) return err(403, "admin_required", "Sales Head role required.");
        var ca = find(DB.coAssignments, "co_assignment_id", caId);
        if (!ca) return err(404, "not_found", caId);
        if (ca.status !== "pending") return err(422, "immutable_record", "Already decided.");
        var dl = find(DB.deals, "deal_id", ca.deal_id);
        if (!dl) return err(404, "deal_not_found", ca.deal_id);
        var finalSplit = split === undefined || split === null ? ca.proposed_split : parseInt(split, 10);
        if (approve && (isNaN(finalSplit) || finalSplit < 1 || finalSplit > 99))
          return err(400, "validation_failed", "Split must be between 1 and 99.");
        ca.status = approve ? "approved" : "rejected";
        ca.decision_actor = actor.name;
        if (approve) {
          ca.approved_split = finalSplit;
          dl.co_owner_id = ca.co_owner;
          dl.split_ratio = (100 - ca.approved_split) + " / " + ca.approved_split;
          appendRemark(DB, dl.deal_id, "system", actor.name,
            "Co-assignment approved: " + ca.co_owner + " at " + dl.split_ratio +
            ". Applies to future payments only — collected money keeps its original attribution.",
            null, todayISO());
        } else {
          appendRemark(DB, dl.deal_id, "system", actor.name, "Co-assignment request rejected.", null, todayISO());
        }
        return ok(ca);
      });
    },

    roster: function () { return load().roster; },
    setActive: function (id, active) {
      return tx(function () {
        var m = find(DB.roster.members, "id", id);
        if (!m) return err(404, "not_found", id);
        m.active = !!active;                    // the cursor is NOT reset — DM-FR-004
        return ok(m);
      });
    }
  };

  /* =========================================================== LIFECYCLE === */
  var Lifecycle = {
    legalTargets: function (dealId) {
      var dl = dealOf(dealId);
      if (!dl) return [];
      /* Everything except where it already is. The caller wants a list of moves
         to offer, and "stay put" is not a move. */
      return [1, 2, 3, 4, 5, 6].filter(function (t) { return t !== dl.stage; });
    },

    /* Priority was write-once at intake, so a deal that turned urgent on a
       Tuesday stayed Normal forever. It is annotation — it never feeds
       assignment, targets, money or a transition (DEALS_OPERATION §Priority) —
       which is exactly why it needs no guard beyond scope and no stage matrix.
       It IS logged: triage that changes without a trace is triage nobody
       trusts, and the timeline is the only place that record can live. */
    setPriority: function (dealId, priority, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        var to = parseInt(priority, 10);
        if ([1, 2, 3].indexOf(to) < 0)
          return err(400, "validation_failed", "Priority is 1 (Normal), 2 (High) or 3 (Urgent).");
        if (to === dl.priority) return ok(dl);
        var from = dl.priority;
        dl.priority = to;
        appendRemark(DB, dealId, "system", "System",
          "Priority changed from " + D.PRIORITY[from] + " to " + D.PRIORITY[to] +
          " by " + (actor ? actor.name : "System") + ".", null, todayISO());
        emit(DB, "deal.priority", { deal_id:dealId, from:from, to:to });
        return ok(dl);
      });
    },

    /* The only way next_action ever moved was a fresh remark overwriting it with
       a new date — there was no way to say "dealt with, nothing pending" without
       inventing a date to log against. Scope is the only guard: acknowledging a
       reminder is not a fact about money or the pipeline. */
    clearNextAction: function (dealId, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        if (!dl.next_action) return ok(dl);      // already clear; nothing to write
        dl.next_action = null;
        appendRemark(DB, dealId, "system", actor.name, "Next action cleared.", null, todayISO());
        return ok(dl);
      });
    },

    /* Returns why a legal target would still be refused, so the UI can state the
       rule BEFORE the user commits rather than after.                           */
    /* Nothing blocks a stage change any more — kept, and kept returning null,
       because the UI asks this before it offers a move and a caller that has to
       feature-detect the absence of a guard is worse than a guard that honestly
       says "none". If a rule ever comes back it comes back here, and every call
       site already routes through it. */
    blockedReason: function () { return null; },

    change: function (dealId, to, reason, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        to = parseInt(to, 10);

        if (!D.STAGES[to]) return err(400, "validation_failed", "There is no stage " + to + ".");
        if (to === dl.stage) return ok(dl);          // already there; nothing to write

        /* The only thing left that can refuse a move is the scope guard above.
           No matrix, no money gate, no reason requirement, no Head-only rule on
           Lost after a payment — a stage says where a deal HAS got to, and an
           operator looking at it knows that better than a table does.

           A reason is still recorded when one is given, and Lost still asks for
           one in the UI, because "why" is worth capturing even when it is not
           worth blocking on. */
        var from = dl.stage, backward = to < from && to !== STAGE.LOST;
        dl.stage = to;
        dl.stage_since = todayISO();
        DB.transitions.push({ transition_id:"tr-" + (++DB.seq.tr), deal_id:dealId,
          from_stage:from, to_stage:to, actor:actor.name, actor_role:actor.role || "sales_agent",
          reason:reason || (backward ? "Backward move" : null), entered_at:todayISO() });

        /* Only Lost locks. Won used to require ₹0 outstanding, so locking it was
           safe; now Won fires at the FIRST installment, with installments 2-5
           still to collect. Locking here would make the rest of the money
           impossible to log — the close would break the collection it exists
           to celebrate. Won is terminal on the matrix, not on the ledger. */
        if (to === STAGE.LOST) {
          dl.closed_at = todayISO();
          dl.close_reason = reason || null;
        } else if (to === STAGE.WON) {
          dl.closed_at = todayISO();
          dl.close_reason = reason || null;
          // AD-01. Emitted, and recorded as consumed by nobody. A customer can
          // pay and still have no route to receive enquiries.
          emit(DB, "deal.won",
            { deal_id:dealId, value_paise:dl.deal_value, city:dl.city, interested_in:dl.interested_in },
            "AD-01 — no module consumes this event. Subscription and profile activation do not happen.");
        }
        return ok(dl);
      });
    },

    /* deal_value can never drop below revenue_collected — the endpoint rejects
       it. And discount > 30 sets Target 2 ineligible AUTOMATICALLY, not as a
       choice someone can forget to make.                                        */

    /* Edit the deal's own fields — everything that is a FACT about it rather
       than a position in a process. What is deliberately not here:

         stage    · has a transition matrix and four guards; `change` owns it
         owner    · round-robin owns it, and letting a form pick would break the
                    rotation fairness DM-BR-03 exists to protect. Reassign is a
                    named action with its own reason and its own audit line.
         tags     · their own store, their own editor

       Everything it DOES touch is validated here and written in one transaction,
       so a bad phone number cannot leave a saved name behind. The whole change
       lands on the timeline as one line naming every field that moved — an edit
       you cannot see is an edit nobody can dispute.

       `patch` carries only the keys being changed. A key that is absent is
       untouched; a key set to "" clears an optional field. That distinction is
       the reason this takes a patch rather than a whole deal.                  */
    edit: function (dealId, patch, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        var p = patch || {}, has = function (k) { return Object.prototype.hasOwnProperty.call(p, k); };
        var changes = [], bad = null;
        function note(label, from, to) { changes.push(label + ": " + (from || "—") + " → " + (to || "—")); }
        var str = function (k) { return String(p[k] === undefined || p[k] === null ? "" : p[k]).trim(); };

        /* ---- who ---- */
        if (has("customer_name")) {
          var name = str("customer_name");
          if (!name) return err(400, "validation_failed", "A deal needs a customer name.");
          if (name.length > 80) return err(400, "validation_failed", "Keep the customer name under 80 characters.");
          if (name !== dl.customer_name) { note("Name", dl.customer_name, name); dl.customer_name = name; }
        }
        if (has("business_name")) {
          var biz = str("business_name");
          if (biz.length > 80) return err(400, "validation_failed", "Keep the business name under 80 characters.");
          if (biz !== (dl.business_name || "")) { note("Business", dl.business_name, biz); dl.business_name = biz; }
        }
        if (has("email")) {
          var em = str("email");
          if (em && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(em))
            return err(400, "validation_failed", "That email address is not valid.");
          if (em !== (dl.email || "")) { note("Email", dl.email, em); dl.email = em; }
        }
        /* The phone is the deal's identity as far as intake is concerned — the
           repeat-submission rule matches on it — so an edit that collides with
           another deal would make two deals answer to one number and send the
           next submission to whichever sorted first.

           The equality check comes BEFORE the format check, and that order is
           load-bearing: a form prefills this field with whatever is stored, and
           what is stored is not always something `normalisePhone` would accept —
           the seeded demo numbers are privacy-masked, and a real import will
           have its own history. Validating first would refuse an edit to the
           CITY because a number nobody touched is not in today's format. */
        if (has("phone") && str("phone") !== dl.phone) {
          var ph = normalisePhone(str("phone"));
          if (!ph) return err(400, "validation_failed", "That is not a valid Indian mobile number.");
          if (ph !== dl.phone) {
            var clash = DB.deals.filter(function (x) {
              return x.phone === ph && x.deal_id !== dealId; })[0];
            if (clash) return err(409, "phone_in_use",
              "That number already belongs to " + clash.deal_id + " (" + clash.customer_name +
              "). Intake matches repeat submissions on the number, so two deals cannot share one.");
            note("Phone", dl.phone, ph); dl.phone = ph;
          }
        }
        ["city", "state", "interested_in"].forEach(function (k) {
          if (bad || !has(k)) return;
          var v = str(k) || "—";
          if (v.length > 80) { bad = err(400, "validation_failed", "Keep " + k.replace(/_/g, " ") + " under 80 characters."); return; }
          if (v !== dl[k]) { note(titleise(k), dl[k], v); dl[k] = v; }
        });
        if (bad) return bad;

        /* ---- how urgent, and when ---- */
        if (has("priority")) {
          var pr = parseInt(p.priority, 10);
          if ([1, 2, 3].indexOf(pr) < 0)
            return err(400, "validation_failed", "Priority is 1 (Normal), 2 (High) or 3 (Urgent).");
          if (pr !== dl.priority) { note("Priority", D.PRIORITY[dl.priority], D.PRIORITY[pr]); dl.priority = pr; }
        }
        if (has("expected_close_date")) {
          var ec = str("expected_close_date");
          if (ec && !/^\d{4}-\d{2}-\d{2}$/.test(ec))
            return err(400, "validation_failed", "Expected close must be a date.");
          if ((ec || null) !== (dl.expected_close_date || null)) {
            note("Expected close", dl.expected_close_date, ec); dl.expected_close_date = ec || null;
          }
        }

        /* ---- money ----
           A closed deal's value is load-bearing history: Won is defined by ₹0
           outstanding, so moving the value afterwards would either un-win it or
           leave a Won deal that no longer adds up. Reopen it first. */
        var wantsMoney = (has("deal_value") && str("deal_value") !== "") || has("discount_pct");
        if (wantsMoney && (dl.stage === STAGE.WON || dl.stage === STAGE.LOST))
          return err(422, "deal_closed",
            "This deal is " + stageLabel(dl.stage) + ". Its value and discount are settled — " +
            "reopen it before changing what it is worth.");

        if (has("deal_value") && str("deal_value") !== "") {
          var v = Math.round(Number(p.deal_value));
          var refusal = valueRefusal(dl, v); if (refusal) return refusal;
          if (v !== dl.deal_value) { note("Deal value", D.inr(dl.deal_value), D.inr(v)); dl.deal_value = v; }
        }
        if (has("discount_pct")) {
          var dv = str("discount_pct");
          var d = dv === "" ? null : Number(dv);
          if (d !== null && (isNaN(d) || d < 0 || d > 100))
            return err(400, "validation_failed", "Discount is a percentage between 0 and 100.");
          if (d !== dl.discount_pct) { note("Discount", dl.discount_pct === null ? null : dl.discount_pct + "%",
                                            d === null ? null : d + "%"); dl.discount_pct = d; }
        }
        if (wantsMoney) {
          /* Recomputed from the discount every time, never edited directly. It
             is a consequence, and a consequence you can type into is a figure
             that will eventually disagree with its own cause. */
          var elig = isTarget2Eligible(dl.discount_pct);
          if (elig !== dl.is_target2_eligible) {
            note("Target 2 eligible", dl.is_target2_eligible ? "yes" : "no", elig ? "yes" : "no");
            dl.is_target2_eligible = elig;
          }
          recalc(DB, dl);
        }

        if (!changes.length) return ok(dl);       // nothing moved; nothing to log
        appendRemark(DB, dealId, "system", "System",
          "Deal edited by " + (actor ? actor.name : "System") + " — " + changes.join(" · ") + ".",
          null, todayISO());
        emit(DB, "deal.edited", { deal_id:dealId, fields:changes.length });
        return ok(dl);
      });
    },

    setValue: function (dealId, valuePaise, discountPct, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        var v = Math.round(Number(valuePaise));
        var bad = valueRefusal(dl, v); if (bad) return bad;

        dl.deal_value = v;
        var d = discountPct === undefined || discountPct === null || discountPct === "" ? dl.discount_pct : Number(discountPct);
        dl.discount_pct = d;
        dl.is_target2_eligible = isTarget2Eligible(d);
        recalc(DB, dl);
        appendRemark(DB, dealId, "system", actor.name,
          "Deal value set to " + D.inr(v) + (d ? " at " + d + "% discount" : "") +
          (dl.is_target2_eligible ? "" : " · Target 2 eligibility set to false automatically (discount above 30%)."),
          null, todayISO());
        return ok(dl);
      });
    }
  };

  /* The three ways a deal value can be refused, in one place, because two call
     sites now write it — Set value and Edit deal — and a guard that lives in one
     of them is a guard the other silently does not have. Returns an error VALUE
     or null, same contract as everything else in this file. */
  function valueRefusal(dl, v) {
    if (!v || v <= 0 || isNaN(v))
      return err(400, "validation_failed", "A positive deal value is required.");
    if (v < dl.revenue_collected)
      return err(422, "deal_value_below_collected",
        "Cannot set " + D.inr(v) + " — " + D.inr(dl.revenue_collected) + " has already been collected.");
    var live = invoicesFor(dl.deal_id).filter(function (i) {
                   return i.status !== "cancelled" && i.status !== "draft"; })
                 .reduce(function (a, i) { return a + i.amount_paise; }, 0);
    if (v < live)
      return err(422, "invoice_exceeds_outstanding",
        "Cannot set " + D.inr(v) + " — " + D.inr(live) + " has already been invoiced.");
    return null;
  }

  /* The enquiry behind a deal — where the funnel's own submission lives. Takes
     either id, because a caller holding a deal should not have to know which
     one the store is keyed on. */
  function enquiryOf(id) {
    var db = load();
    var dl = find(db.deals, "deal_id", id);
    return find(db.enquiries, "enquiry_id", dl ? dl.enquiry_id : id) || null;
  }

  function stageLabel(s) { return (D.STAGES[s] || {}).label || String(s); }

  /* ============================================================ ACTIVITY === */
  var Activity = {
    remark: function (dealId, text, nextDate, actor, channel) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        if (!text || !text.trim()) return err(400, "validation_failed", "A remark cannot be empty.");
        if (channel && ["remark", "whatsapp", "email"].indexOf(channel) < 0)
          return err(400, "validation_failed", "Unsupported channel.");
        var dl = g.data;
        var r = appendRemark(DB, dealId, "manual", actor.name, text.trim(), nextDate || null,
          todayISO(), channel);
        // The first manual remark is what unlocks Generated → Followup.
        if (dl.stage === STAGE.DEAL) {
          dl.stage = STAGE.FOLLOWUP; dl.stage_since = todayISO();
          DB.transitions.push({ transition_id:"tr-" + (++DB.seq.tr), deal_id:dealId,
            from_stage:1, to_stage:2, actor:actor.name, actor_role:actor.role || "sales_agent",
            reason:"First remark logged", entered_at:todayISO() });
        }
        return ok(r);
      });
    },

    /* One merged timeline from four append-only sources. Nothing in it is
       editable or deletable — there is no PUT and no DELETE, anywhere.          */
    timeline: function (dealId) {
      var out = [];
      remarksFor(dealId).forEach(function (r) {
        var seq = parseInt(String(r.remark_id).replace(/\D/g, ""), 10) || 0;
        out.push({ kind:r.type === "system" ? "SYSTEM" : "REMARK", tone:"", channel:r.channel || "remark",
          at:r.created_at, by:r.author, text:r.text, seq:seq });
      });
      load().transitions.filter(function (t) { return t.deal_id === dealId; }).forEach(function (t) {
        out.push({ kind:"STAGE", tone:t.to_stage === STAGE.WON ? "ok" : t.to_stage === STAGE.LOST ? "bad" : "",
          at:t.entered_at, by:t.actor + " · " + t.actor_role,
          text:stageLabel(t.from_stage) + " → <b>" + stageLabel(t.to_stage) + "</b>" +
               (t.reason ? " · " + esc(t.reason) : "") });
      });
      paymentsFor(dealId).forEach(function (p) {
        out.push({ kind:p.type === "reversal" ? "REVERSAL" : "PAYMENT",
          tone:p.type === "reversal" ? "bad" : "ok", at:p.payment_date, by:p.recorded_by,
          text:(p.type === "reversal" ? "Reversed " : "Received ") + "<b>" + p.payment_id + "</b> — " +
               D.inr(Math.abs(p.amount_paise)) + " · " + p.mode +
               (p.invoice_id ? " · against " + p.invoice_id : "") });
      });
      quotesFor(dealId).forEach(function (q) {
        var qref = q.quotation_number || "(draft)";
        if (q.issued_at) out.push({ kind:"QUOTE", tone:"", at:q.issued_at, by:q.owner, seq:0,
          text:"Quotation <b>" + qref + "</b> v" + q.version + " issued — " + D.inr(q.grand_total_paise) });
        if (q.status === "accepted" && q.accepted_at) out.push({ kind:"QUOTE", tone:"ok", seq:0,
          at:q.accepted_at, by:q.owner,
          text:"<b>" + qref + "</b> accepted — wrote " + D.inr(q.grand_total_paise) +
               " to the deal as the agreed value" });
        if (q.status === "superseded" && q.superseded_at) out.push({ kind:"QUOTE", tone:"",
          at:q.superseded_at, by:"System", text:"<b>" + qref + "</b> superseded by a newer version" });
      });
      invoicesFor(dealId).forEach(function (i) {
        if (!i.raised_at) return;                       // a draft is not an event yet
        var iref = i.number || i.invoice_id;
        out.push({ kind:"INVOICE", tone:i.status === "cancelled" ? "bad" : "", at:i.raised_at,
          by:i.owner, seq:0,
          text:(i.status === "cancelled"
            ? "Invoice <b>" + iref + "</b> cancelled — " + esc(i.cancelled_reason || "")
            : "Invoice <b>" + iref + "</b> raised for " + D.inr(i.amount_paise)) });
      });
      return out.sort(function (a, b) {
        var x = a.at || "", y = b.at || "";     // a missing date sinks, never floats
        if (x !== y) return x < y ? 1 : -1;
        return (b.seq || 0) - (a.seq || 0);     // same day → newest entry first
      });
    }
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]; }); }

  /* =============================================================== CHAIN === */
  /* Quote → Invoice → Payment. Each document only becomes possible once the
     previous one is settled. Deals stores four scalars; M2 and M3 own the rest. */
  var Chain = {
    state: function (dealId) {
      var dl = dealOf(dealId); if (!dl) return null;
      var invs = invoicesFor(dealId).filter(function (i) { return i.status !== "cancelled"; });
      var openInv = invs.filter(function (i) { return i.status === "raised"; })[0] || null;
      return {
        quote:acceptedQuote(dealId) || quotesFor(dealId)[0] || null,
        quoteStatus:dl.quotation_status,
        invoices:invs, openInvoice:openInv,
        payments:paymentsFor(dealId).filter(function (p) { return p.type === "payment" && !p.voided; }),
        uninvoiced:uninvoiced(dl),
        canCreateQuote:true,                       // Module 2 owns the builder
        canRaiseInvoice:dl.quotation_status === "accepted" && uninvoiced(dl) > 0,
        canLogPayment:!!openInv
      };
    },

    /* Raise invoice, the builder, the number and the document all moved to
       Module 3 — see assets/invoice-engine.js. Deal detail links into it and
       does not re-implement it (INVOICE_CHAIN_CONTRACT §3). */
  };
  function addDays(iso, n) {
    var dt = D.d(iso); dt.setDate(dt.getDate() + n);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }

  /* Won closes itself the moment outstanding reaches ₹0 — no click required.
     Same terminal-lock shape as the manual Lifecycle.change WON branch, so a
     deal closed automatically is indistinguishable from one closed by hand
     except for the actor on the transition row. A deal already terminal
     (Won or Lost) is left alone — this never reopens or re-closes one.       */
  /* Stage follows money. Two payments move a deal on their own, identified by
     the remark the invoice was raised under:
       "Slot booking"   → Slot Booked
       "Installment 1"  → Won
     Anything else (installments 2-5, a balance chase) moves nothing — it is
     collection against a deal that has already reached its stage.
     A payment never walks a deal BACKWARDS: a late slot-booking receipt on an
     already-won deal must not un-win it, which is what the `to <= dl.stage`
     bail-out below is for. Manual moves still exist alongside this — there is
     no matrix or guard left to share, just the same shape of transition row. */
  function autoStage(dl, invoiceId) {
    if (dl.stage === STAGE.LOST) return;
    var inv = invoicesFor(dl.deal_id).filter(function (i) { return i.invoice_id === invoiceId; })[0];
    var remark = String((inv && inv.remark) || "").toLowerCase();
    var to = null, why = null;

    /* Paid off in full outranks everything below it: whichever payment closes
       the gap is the one that wins the deal, whatever its remark called it. */
    if (dl.deal_value && dl.outstanding <= 0) {
      to = STAGE.WON;
      why = "Paid in full — moved to Won automatically.";
    } else if (/installment/.test(remark)) {
      /* Any installment, not only the first. The old rule fired on "installment
         1" and jumped straight to Won, which is what left a deal wearing a
         finished label with four fifths of its money still to come. */
      to = STAGE.INSTALLMENT;
      why = "Installment received — moved to Installment automatically.";
    } else if (remark.indexOf("slot") >= 0) {
      to = STAGE.SLOT;
      why = "Slot registration amount received — moved to Slot Booked automatically.";
    }
    if (to === null || to <= dl.stage) return;

    var from = dl.stage;
    dl.stage = to; dl.stage_since = todayISO();
    DB.transitions.push({ transition_id:"tr-" + (++DB.seq.tr), deal_id:dl.deal_id,
      from_stage:from, to_stage:to, actor:"System", actor_role:"system",
      reason:why, entered_at:todayISO() });
    if (to === STAGE.WON) {
      /* Won now means ₹0 outstanding, so there is nothing left to collect — but
         the deal still is not locked, because a bounced transfer has to be able
         to walk it back. Terminal on the money, never on the record. */
      dl.closed_at = todayISO();
      dl.close_reason = why;
      emit(DB, "deal.won",
        { deal_id:dl.deal_id, value_paise:dl.deal_value, city:dl.city, interested_in:dl.interested_in },
        "AD-01 — no module consumes this event. Subscription and profile activation do not happen.");
    }
  }

  /* ================================================================ TAGS === */
  /* One kind of tag, and a person put it there.

     There used to be two. `system` tags were applied by rules — Generated,
     Premium, Generic — and the engine refused to let anyone touch them. The
     idea was sound and the result was not: an operator looking at a label they
     knew was wrong had nothing to do about it, and every screen that rendered a
     tag had to carry a second branch explaining why this one was different.

     A tag is annotation. It never gates a transition, feeds assignment, changes
     a target or touches money — which is exactly why it can be left entirely in
     the team's hands. What a rule used to assert (this deal came in manually,
     this plan is yearly) is still true and still recorded, on the deal itself
     where it belongs: `source` says where it came from and the accepted
     quotation names the plan. Neither needed a coloured pill to be true.       */
  /* Twelve colours, and the empty string is one of them — a tag with no colour
     is the commonest tag there is. They are named for what they LOOK like, not
     for what they mean, because a tag colour means whatever the team decided:
     "red" here is a hue, where `bad` elsewhere in this product is a verdict.
     That naming split is the whole reason the palette is separate.

     Order matters — the UI draws them in this order and the eye reads a hue
     wheel faster than an alphabet. */
  var TAG_TONES = ["", "slate", "red", "orange", "amber", "lime",
                   "green", "teal", "cyan", "blue", "violet", "pink"];

  /* Tags used to borrow the four status tones. A stored tag still carries those
     names, and they map cleanly onto the new palette — nothing is lost, and the
     colour a person picked is the colour they keep. This is a rename, not a
     reinterpretation, so it migrates in `heal` rather than forcing a reseed:
     a schema bump exists for changes that alter what a value MEANS, and the
     green a user chose meant green both before and after. */
  var LEGACY_TONES = { info:"blue", ok:"green", warn:"amber", bad:"red", dead:"slate" };
  var TAG_MAX = 24;

  function slugify(s) {
    return String(s || "").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  }
  function tagOf(slug) {
    return load().tags.filter(function (t) { return t.slug === slug; })[0] || null;
  }
  function tagsFor(dealId) {
    var db = load();
    return db.dealTags.filter(function (x) { return x.deal_id === dealId; })
      .map(function (x) { return tagOf(x.slug); }).filter(Boolean);
  }
  function dealsWithTag(slug) {
    return load().dealTags.filter(function (x) { return x.slug === slug; })
      .map(function (x) { return x.deal_id; });
  }
  /* Idempotent by (deal, slug) — applying a tag a deal already carries is not an
     error and must not produce a second row. */
  function attachTag(db, dealId, slug, by) {
    var dup = db.dealTags.filter(function (x) {
      return x.deal_id === dealId && x.slug === slug; }).length;
    if (dup) return false;
    db.dealTags.push({ deal_id:dealId, slug:slug, by:by || "System", at:todayISO() });
    return true;
  }
  /* Name → slug is many-to-one ("Site visit due" and "site visit  DUE" are the
     same tag), so the name a person types has to resolve through the slug or
     the store fills up with duplicates that look identical on screen. */
  function validName(label) {
    var name = String(label || "").trim();
    if (!name) return err(400, "validation_failed", "A tag needs a name.");
    if (name.length > TAG_MAX)
      return err(400, "validation_failed", "Keep a tag name under " + TAG_MAX + " characters.");
    if (!slugify(name))
      return err(400, "validation_failed", "That name has no letters or digits in it.");
    return ok(name);
  }

  var Tags = {
    all: function () {
      return load().tags.map(function (t) {
        var copy = {}; for (var k in t) copy[k] = t[k];
        copy.count = dealsWithTag(t.slug).length;
        return copy;
      });
    },
    forDeal: tagsFor,
    dealsWith: dealsWithTag,

    create: function (label, tone, actor) {
      return tx(function () {
        var v = validName(label); if (v.ok === false) return v;
        var name = v.data, slug = slugify(name);
        if (tagOf(slug)) return err(409, "tag_exists", "A tag called “" + name + "” already exists.");
        if (TAG_TONES.indexOf(tone || "") < 0) tone = "";
        var t = { slug:slug, label:name, tone:tone || "",
                  created_by:actor ? actor.name : "System", created_at:todayISO() };
        DB.tags.push(t);
        return ok(t);
      });
    },

    /* The slug never moves. Rename "Site visit due" to "Site visit overdue" and
       every deal already carrying it keeps it — a rename is a correction to the
       wording, never a different tag. It is also global by definition: one tag,
       one name, wherever it is shown. */
    update: function (slug, label, tone, actor) {
      return tx(function () {
        var t = tagOf(slug);
        if (!t) return err(404, "tag_not_found", "No tag " + slug + ".");
        var v = validName(label); if (v.ok === false) return v;
        t.label = v.data;
        if (TAG_TONES.indexOf(tone || "") < 0) tone = "";
        t.tone = tone || "";
        return ok(t);
      });
    },

    remove: function (slug, actor) {
      return tx(function () {
        var t = tagOf(slug);
        if (!t) return err(404, "tag_not_found", "No tag " + slug + ".");
        DB.tags = DB.tags.filter(function (x) { return x.slug !== slug; });
        DB.dealTags = DB.dealTags.filter(function (x) { return x.slug !== slug; });
        return ok({ slug:slug });
      });
    },

    apply: function (dealId, slug, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        if (!tagOf(slug)) return err(404, "tag_not_found", "No tag " + slug + ".");
        attachTag(DB, dealId, slug, actor ? actor.name : "System");
        return ok(tagsFor(dealId));
      });
    },

    /* Takes the tag off THIS deal. The tag itself and every other deal carrying
       it are untouched — deleting one everywhere is `remove`, and the two are
       deliberately different verbs because they are different blast radii. */
    unapply: function (dealId, slug, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        DB.dealTags = DB.dealTags.filter(function (x) {
          return !(x.deal_id === dealId && x.slug === slug); });
        return ok(tagsFor(dealId));
      });
    },

    /* What a row in the deal's tag editor commits to. A person typing a name
       into a box is not saying "create" or "apply" — they are saying "this deal
       has this tag", and which of the two it takes is bookkeeping they should
       never have to think about. So: find it by slug or make it, honour the
       colour they picked, put it on the deal. Idempotent end to end, which is
       what lets the editor re-save every row without checking what changed.    */
    ensure: function (dealId, label, tone, actor) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var v = validName(label); if (v.ok === false) return v;
        var name = v.data, slug = slugify(name);
        if (TAG_TONES.indexOf(tone || "") < 0) tone = "";
        var t = tagOf(slug);
        if (!t) {
          t = { slug:slug, label:name, tone:tone || "",
                created_by:actor ? actor.name : "System", created_at:todayISO() };
          DB.tags.push(t);
        } else {
          /* An existing tag keeps its own name — the slug matched, so the two
             spellings ARE the same tag and the stored one is the one every
             other deal is already showing. The colour is taken, because the
             person picking it is looking at that tag right now. */
          if (tone && tone !== t.tone) t.tone = tone;
        }
        attachTag(DB, dealId, t.slug, actor ? actor.name : "System");
        return ok(t);
      });
    }
  };

  /* ============================================================== LEDGER === */
  var Ledger = {
    /* T02. Every guard in the contract, in order, before a single row is written. */
    pay: function (o, actor) {
      return tx(function () {
        var g = guardDeal(o.dealId, actor); if (g.ok === false) return g;
        var dl = g.data;

        if (!o.idempotency_key) return err(400, "validation_failed", "idempotency_key is required.");
        if (find(DB.payments, "idempotency_key", o.idempotency_key))
          return err(409, "duplicate_payment", o.idempotency_key);

        if (!dl.deal_value) return err(422, "deal_value_required", "This deal has no agreed value yet.");

        // No invoice, no payment. A customer promising to pay is a remark.
        if (!o.invoiceId) return err(422, "invoice_required", "Money can only be received against an invoice.");
        var inv = invoicesFor(o.dealId).filter(function (i) {
          return i.invoice_id === o.invoiceId || i.number === o.invoiceId; })[0];
        if (!inv) return err(422, "invoice_required", "That invoice does not belong to this deal.");
        if (inv.status === "draft") return err(422, "invoice_required", "That invoice has not been issued.");
        if (inv.status === "cancelled") return err(422, "invoice_required", "That invoice is cancelled.");
        if (inv.status === "paid") return err(422, "invoice_required", "That invoice is already settled. The balance needs its own invoice.");

        var amt = Math.round(Number(o.amountPaise));
        if (!amt || amt <= 0) return err(400, "validation_failed", "A positive amount is required.");

        // Capped at THIS INVOICE, not at the deal outstanding. Rejected, never clamped.
        var due = inv.amount_paise - inv.received_paise;
        if (amt > due)
          return err(422, "payment_exceeds_outstanding",
            D.inr(amt) + " exceeds the " + D.inr(due) + " due on " + (inv.number || inv.invoice_id) + ".");
        // And it must settle the invoice EXACTLY. `invoice → payment` is 1:1, so
        // Module 3 has no Partially Paid state to move to — the operation doc
        // calls partial payment "impossible by construction" (ID-02), and this
        // is the construction. A customer paying less gets a smaller invoice.
        if (amt < due)
          return err(422, "partial_payment_unsupported",
            D.inr(amt) + " is short of the " + D.inr(due) + " due on " + (inv.number || inv.invoice_id) +
            ". One payment settles one invoice in full — raise a smaller invoice for what is actually coming.");
        if (amt > dl.outstanding)
          return err(422, "payment_exceeds_outstanding",
            D.inr(amt) + " exceeds the deal outstanding of " + D.inr(dl.outstanding) + ".");
        if (!o.reference || !o.reference.trim())
          return err(400, "validation_failed", "A reference or UTR is required — without it the row cannot be reconciled.");

        var id = "PAY-" + (++DB.seq.pay);
        DB.payments.push({
          payment_id:id, deal_id:o.dealId, invoice_id:inv.invoice_id, type:"payment",
          amount_paise:amt, payment_date:o.date || todayISO(),
          mode:o.mode || "NEFT", reference:o.reference.trim(),
          reverses_payment_id:null, idempotency_key:o.idempotency_key,
          // AD-03 attribution snapshot — a later reassignment never re-attributes this.
          owner_id:dl.owner_id, co_owner_id:dl.co_owner_id, split_ratio:dl.split_ratio,
          recorded_by:actor.name, created_at:todayISO(), voided:false
        });
        // Module 1 moves first, always. Module 3 LEARNS about this payment —
        // after the commit, never inside it.
        publishAfterCommit(function () {
          if (root.IBInvoice) root.IBInvoice.Sync.paymentRecorded(
            { invoice_id:inv.invoice_id, payment_id:id, amount_paise:amt });
          load(); syncChain(DB, dl); persist(); publish();
        });
        recalc(DB, dl);
        var beforeStage = dl.stage;
        autoStage(dl, o.invoiceId);   // the remark on the invoice decides the stage
        emit(DB, "payment.recorded", { deal_id:dl.deal_id, payment_id:id, amount_paise:amt });
        return ok({ payment_id:id, outstanding:dl.outstanding,
                    stage:dl.stage, stageMoved:dl.stage !== beforeStage,
                    closedWon:dl.stage === STAGE.WON });
      });
    },

    /* T03. The original row is NEVER amended or deleted — a negative entry is
       appended referencing it. Reversing also cancels the invoice it settled;
       both rows are retained and the amount returns to the uninvoiced balance.  */
    reverse: function (paymentId, reason, actor) {
      return tx(function () {
        if (!isHead(actor)) return err(403, "admin_required", "Payment reversal is a Sales Head action.");
        var p = find(DB.payments, "payment_id", paymentId);
        if (!p) return err(404, "not_found", paymentId);
        if (p.type === "reversal") return err(422, "immutable_record", "A reversal cannot itself be reversed.");
        if (p.voided) return err(422, "immutable_record", "That payment has already been reversed.");
        if (!reason || !reason.trim()) return err(400, "validation_failed", "A reason is required.");
        var dl = find(DB.deals, "deal_id", p.deal_id);
        if (!dl) return err(404, "deal_not_found", p.deal_id);

        p.voided = true;
        var id = "PAY-" + (++DB.seq.pay);
        DB.payments.push({
          payment_id:id, deal_id:p.deal_id, invoice_id:p.invoice_id, type:"reversal",
          amount_paise:-p.amount_paise, payment_date:todayISO(),
          mode:p.mode, reference:"REV of " + p.payment_id,
          reverses_payment_id:p.payment_id, idempotency_key:"rev-" + p.payment_id,
          owner_id:p.owner_id, co_owner_id:p.co_owner_id, split_ratio:p.split_ratio,
          recorded_by:actor.name, created_at:todayISO(), voided:false, reason:reason.trim()
        });

        // Y6 — Module 3 auto-cancels the invoice as a consequence of this
        // reversal. The ledger moves first; the document follows.
        var invRef = p.invoice_id;
        if (invRef) publishAfterCommit(function () {
          if (root.IBInvoice) root.IBInvoice.Sync.paymentReversed(
            { invoice_id:invRef, payment_id:p.payment_id });
          load(); syncChain(DB, dl); persist(); publish();
        });
        /* Won was reached by confirming the first installment. Reversing the
           money behind it has to walk the deal back — to Slot Booked if a
           registration payment still stands, otherwise to Followup, since with
           no money left the deal no longer satisfies Slot Booked's own guard. */
        if (dl.stage === STAGE.WON) {
          var stillPaid = DB.payments.filter(function (x) {
            return x.deal_id === dl.deal_id && !x.voided && x.type !== "reversal" &&
                   x.payment_id !== p.payment_id;
          }).length > 0;
          var back = stillPaid ? STAGE.SLOT : STAGE.FOLLOWUP;
          dl.stage = back; dl.closed_at = null; dl.close_reason = null;
          DB.transitions.push({ transition_id:"tr-" + (++DB.seq.tr), deal_id:dl.deal_id,
            from_stage:STAGE.WON, to_stage:back, actor:actor.name,
            actor_role:actor.role || "super_admin",
            reason:"Reopened — a payment behind the close was reversed", entered_at:todayISO() });
        }
        syncChain(DB, dl); recalc(DB, dl);
        appendRemark(DB, dl.deal_id, "system", actor.name,
          "Payment " + p.payment_id + " reversed (" + D.inr(p.amount_paise) + "). Reason: " + reason.trim() +
          " · The original entry was not deleted; a negative entry was appended and " +
          (invRef ? invRef + " was cancelled." : "no invoice was affected."), null, todayISO());
        emit(DB, "payment.reversed", { deal_id:dl.deal_id, payment_id:p.payment_id });
        return ok({ reversal_id:id });
      });
    }
  };

  /* ================================================================ SYNC === */
  /* The ONLY inbound write path from Module 2, and it writes exactly the four
     scalars the contract permits. Delivery is at-least-once, so every handler
     is idempotent — applying the same event twice must change nothing.

     `is_target2_eligible` is set HERE and not by Module 2: the >30% rule is a
     Module 1 rule (DM-BR-07), applied by Module 1, on data Module 2 supplies. */
  /* Factored out of reconcile() so quotationRejected can re-run the same
     per-deal recomputation without re-walking every deal in the store. */
  function reconcileOne(dl) {
    var qs = root.IBQuote.forDeal(dl.deal_id);
    var acc = qs.filter(function (q) { return q.status === "accepted"; })[0];
    var iss = qs.filter(function (q) { return q.status === "issued"; })[0];
    var cur = acc || iss || null;
    dl.quotation_id = cur ? cur.quotation_id : null;
    dl.quotation_status = acc ? "accepted" : iss ? "issued" : "none";
    // Crossing X3, applied to seeded rows. The seed states a deal_value that
    // predates Module 2 computing its quotations; the contract says the
    // accepted quotation's grand total IS the agreed value, so it wins —
    // and with it the whole chain reconciles: quote = SUM(invoices).
    // Never re-base a closed deal: its agreed value is settled history, and
    // moving it would leave a Closed-Won deal showing money outstanding.
    if (acc && dl.stage < STAGE.WON &&
        acc.grand_total_paise >= dl.revenue_collected) {
      dl.deal_value = acc.grand_total_paise;
      dl.discount_pct = acc.discount_pct;
      dl.is_target2_eligible = isTarget2Eligible(acc.discount_pct);
      recalc(DB, dl);
    }
  }
  var Sync = {
    quotationIssued: function (p) {
      return tx(function () {
        var dl = find(DB.deals, "deal_id", p.deal_id);
        if (!dl) return err(404, "deal_not_found", p.deal_id);
        if (dl.quotation_id === p.quotation_id && dl.quotation_status === "issued")
          return ok({ idempotent:true });                       // replay is a no-op
        dl.quotation_id = p.quotation_id;
        if (dl.quotation_status !== "accepted") dl.quotation_status = "issued";
        appendRemark(DB, dl.deal_id, "system", "Quotation",
          "Quotation " + p.quotation_number + " issued. The deal can now advance to Quotation Sent.",
          null, todayISO());
        return ok(dl);
      });
    },

    quotationAccepted: function (p) {
      return tx(function () {
        var dl = find(DB.deals, "deal_id", p.deal_id);
        if (!dl) return err(404, "deal_not_found", p.deal_id);
        if (dl.quotation_id === p.quotation_id && dl.quotation_status === "accepted")
          return ok({ idempotent:true });
        if (p.grand_total_paise < dl.revenue_collected)
          return err(422, "deal_value_below_collected",
            "The accepted total is below the " + D.inr(dl.revenue_collected) + " already collected.");

        dl.quotation_id = p.quotation_id;
        dl.quotation_status = "accepted";
        dl.deal_value = p.grand_total_paise;
        dl.discount_pct = p.discount_pct;
        dl.is_target2_eligible = isTarget2Eligible(p.discount_pct);
        recalc(DB, dl);
        /* Accepting a quotation no longer moves the stage. Under the five-stage
           model a quotation is a document, not a position: what advances a deal
           is the registration payment and then the first installment. Accepting
           still writes the agreed value, which is what the money gates need. */
        appendRemark(DB, dl.deal_id, "system", "Quotation",
          "Quotation " + p.quotation_number + " accepted — wrote " + D.inr(p.grand_total_paise) +
          " to the deal as the agreed value" +
          (dl.is_target2_eligible ? "" : " · Target 2 eligibility set to false automatically (discount above 30%)") +
          ". This does not move the stage; Slot Booked needs the registration amount received.",
          null, todayISO());
        /* No tag is written here either. The plan on the accepted quotation is
           what "Premium" and "Generic" used to restate, and it is readable from
           the quotation itself at any time. A team that wants to sort by it can
           make its own tag and say what it means. */
        return ok(dl);
      });
    },

    invoiceIssued: function (p) {
      return tx(function () {
        var dl = find(DB.deals, "deal_id", p.deal_id);
        if (!dl) return err(404, "deal_not_found", p.deal_id);
        if (dl.invoice_id === p.invoice_id && dl.invoice_status === "raised")
          return ok({ idempotent:true });
        syncChain(DB, dl);
        appendRemark(DB, dl.deal_id, "system", "Invoice",
          "Invoice " + p.invoice_number + " raised for " + D.inr(p.amount_paise) +
          ". Log payment is now available for that invoice only.", null, todayISO());
        return ok(dl);
      });
    },

    invoiceCancelled: function (p) {
      return tx(function () {
        var dl = find(DB.deals, "deal_id", p.deal_id);
        if (!dl) return err(404, "deal_not_found", p.deal_id);
        syncChain(DB, dl);
        appendRemark(DB, dl.deal_id, "system", "Invoice",
          "Invoice cancelled — " + (p.reason || "no reason recorded") +
          ". The amount has returned to uninvoiced and can be raised again.", null, todayISO());
        return ok(dl);
      });
    },

    reconcileInvoices: function () {
      if (!root.IBInvoice) return ok({ skipped:true });
      load();
      DB.deals.forEach(function (dl) { syncChain(DB, dl); });
      persist(); publish();
      return ok({ deals:DB.deals.length });
    },

    /* Boot-time only: the seeded quotations were never enqueued, so the scalars
       are reconstructed once from Module 2's rows. Live changes come by outbox. */
    reconcile: function () {
      if (!root.IBQuote) return ok({ skipped:true });
      load();
      DB.deals.forEach(reconcileOne);
      persist(); publish();
      return ok({ deals:DB.deals.length });
    },

    quotationRejected: function (p) {
      return tx(function () {
        var dl = find(DB.deals, "deal_id", p.deal_id);
        if (!dl) return err(404, "deal_not_found", p.deal_id);
        if (!(dl.quotation_id === p.quotation_id && dl.quotation_status === "accepted"))
          return ok({ idempotent:true });
        reconcileOne(dl);
        appendRemark(DB, dl.deal_id, "system", "Quotation",
          "Quotation " + (p.quotation_number || p.quotation_id) + " rejected after being accepted — " +
          (dl.quotation_status === "none"
            ? "the deal no longer has an accepted quotation."
            : "the deal now follows the " + dl.quotation_status + " quotation."),
          null, todayISO());
        return ok(dl);
      });
    }
  };

  /* ========================================================== AUTOMATION === */
  var Automation = {
    /* AD-10 was open — undefined behaviour on an overlapping run. Implemented
       with a run lock and an idempotent body, because it was cheap.             */
    runStallDetection: function () {
      return tx(function () {
        var job = DB.jobs.stall;
        if (job.running) return err(409, "job_running", "The stall job is already running.");
        job.running = true;
        var flagged = 0, cleared = 0;
        DB.deals.forEach(function (dl) {
          if (dl.stage >= STAGE.WON) { dl.is_stalled = false; return; }
          var threshold = STALL_DAYS[dl.stage] || STALL_DAYS["default"];
          var idle = Math.abs(daysBetween(dl.last_remark_at));
          var should = idle > threshold;
          if (should && !dl.is_stalled) { dl.is_stalled = true; flagged++;
            emit(DB, "deal.stalled", { deal_id:dl.deal_id, idle_days:idle, owner:dl.owner_id }); }
          else if (!should && dl.is_stalled) { dl.is_stalled = false; cleared++; }
        });
        job.running = false; job.lastRun = nowISO();
        return ok({ flagged:flagged, cleared:cleared, at:job.lastRun });
      });
    },
    lastRun: function () { return load().jobs.stall.lastRun; }
  };

  /* =========================================================== ANALYTICS === */
  /* Own and Team read the SAME ledger with split ratios applied. There is no
     second source (DM-BR-10), and no figure here comes from an invoice total —
     issuing is not collecting.                                                  */
  var Analytics = {
    scopeOf: function (actor) {
      var all = load().deals;
      if (isHead(actor)) return all;
      return all.filter(function (dl) { return inScope(actor, dl); });
    },
    forActor: function (actor, teamWide) {
      var deals = teamWide ? load().deals : Analytics.scopeOf(actor);
      var ids = {}; deals.forEach(function (d2) { ids[d2.deal_id] = true; });
      var rows = load().payments.filter(function (p) { return ids[p.deal_id]; });

      var byPerson = {};
      rows.forEach(function (p) {
        var split = 100, co = 0;
        if (p.split_ratio) {
          var parts = String(p.split_ratio).split("/");
          split = parseInt(parts[0], 10) || 100; co = parseInt(parts[1], 10) || 0;
        }
        credit(byPerson, p.owner_id, Math.round(p.amount_paise * split / 100));
        if (p.co_owner_id && co) credit(byPerson, p.co_owner_id, Math.round(p.amount_paise * co / 100));
      });

      var closed = deals.filter(function (d2) { return d2.stage >= STAGE.WON; });
      var won = deals.filter(function (d2) { return d2.stage === STAGE.WON; });
      var byStage = {}; deals.forEach(function (d2) { byStage[d2.stage] = (byStage[d2.stage] || 0) + 1; });

      return {
        deals:deals, byStage:byStage,
        collected:rows.reduce(function (a, p) { return a + p.amount_paise; }, 0),
        outstanding:deals.filter(function (d2) { return d2.stage < STAGE.WON; })
                         .reduce(function (a, d2) { return a + d2.outstanding; }, 0),
        closingRate:closed.length ? Math.round(won.length / closed.length * 100) : null,
        won:won.length, lost:closed.length - won.length,
        stalled:deals.filter(function (d2) { return d2.is_stalled; }).length,
        target2Excluded:deals.filter(function (d2) { return d2.is_target2_eligible === false; }).length,
        byPerson:byPerson,
        // The conversion gap the Head actually watches: Followup →
        // deals that produced money, not deals that produced a conversation.
        gap:{
          comm:deals.filter(function (d2) { return d2.stage >= STAGE.FOLLOWUP; }).length,
          quoted:deals.filter(function (d2) { return d2.quotation_status !== "none"; }).length,
          accepted:deals.filter(function (d2) { return d2.quotation_status === "accepted"; }).length,
          invoiced:deals.filter(function (d2) { return d2.invoice_status !== "none"; }).length,
          paid:deals.filter(function (d2) { return d2.revenue_collected > 0; }).length
        }
      };
    }
  };
  function credit(map, who, amt) { if (!who) return; map[who] = (map[who] || 0) + amt; }

  /* ============================================================== EXPORT === */
  /* Projections in the shape the existing views already read, so the dashboard,
     search index and Finance module keep working — now over live state.         */
  function projectDeals() {
    return load().deals.map(function (dl) {
      return { ref:dl.deal_id, who:dl.customer_name, business:dl.business_name || "",
        email:dl.email || "", phone:dl.phone, city:dl.city, state:dl.state,
        interestedIn:dl.interested_in, stage:dl.stage, priority:dl.priority, value:dl.deal_value,
        owner:dl.owner_id, coOwner:dl.co_owner_id, split:dl.split_ratio,
        created:dl.created_at, stageSince:dl.stage_since, expectedClose:dl.expected_close_date,
        nextAction:dl.next_action, enquiry:dl.enquiry_id, discount:dl.discount_pct,
        stalled:dl.is_stalled, duplicates:dl.duplicate_count, lostReason:dl.close_reason,
        _src:dl };
    });
  }
  function projectPayments() {
    // Finance models a payment as ONE row carrying a state; the engine keeps a
    // double-entry ledger. Project the original only — emitting the negative
    // twin as well would double-count "Reversed" over there.
    return load().payments.filter(function (p) { return p.type !== "reversal"; }).map(function (p) {
      return { ref:p.payment_id, amount:Math.abs(p.amount_paise),
        state:p.voided ? "reversed" : "verified",
        mode:p.mode, utr:p.reference, invoice:p.invoice_id, deal:p.deal_id,
        who:(dealOf(p.deal_id) || {}).customer_name || "—", path:"A",
        received:p.payment_date, by:p.recorded_by, _src:p };
    });
  }

  root.IBDeals = {
    /* No TRANSITIONS export — there is no matrix to hand out. legalTargets()
       is the question callers were really asking. */
    STAGE:STAGE, STALL_DAYS:STALL_DAYS,
    load:load, reset:reset, db:function () { return load(); },
    Intake:Intake, Assignment:Assignment, Lifecycle:Lifecycle, Sync:Sync,
    Activity:Activity, Chain:Chain, Ledger:Ledger, Tags:Tags,
    TAG_TONES:TAG_TONES, tagsFor:tagsFor,
    Automation:Automation, Analytics:Analytics,
    dealOf:dealOf, enquiryOf:enquiryOf, quotesFor:quotesFor, invoicesFor:invoicesFor,
    paymentsFor:paymentsFor, remarksFor:remarksFor, acceptedQuote:acceptedQuote,
    uninvoiced:uninvoiced, isHead:isHead, inScope:inScope, stageLabel:stageLabel,
    coAssignmentsFor:function (id) {
      return load().coAssignments.filter(function (c) { return c.deal_id === id; }); },
    events:function () { return load().events.slice().reverse(); },
    normalisePhone:normalisePhone,
    project:{ deals:projectDeals, payments:projectPayments }
  };

  /* ------------------------------------------------------------------------- */
  /* Publish into the shared dataset.
     admin-data.js's selectors and derive() close over their own array VARIABLES,
     not over IBData's properties — so replacing a property would leave every one
     of them reading stale literals. Mutate the SAME array objects in place and
     the dashboard, Finance, search and Users all read live state through the
     selectors they already used. One source of truth for the sales chain.      */
  var nonDealPayments = null;
  function publish() {
    if (nonDealPayments === null) {
      // Money the deal ledger does not own — bank imports, refunds, and anything
      // still awaiting verification — stays exactly as Finance had it.
      nonDealPayments = SEED.payments.filter(function (p) {
        return !p.deal || (p.state !== "verified" && p.state !== "reversed"); });
    }
    swap(D.deals, projectDeals());
    swap(D.payments, projectPayments().concat(nonDealPayments));
  }
  function swap(arr, next) { arr.length = 0; Array.prototype.push.apply(arr, next); }

  var _persist = persist;
  persist = function () { _persist(); publish(); };

  load();
  publish();
})(window);

/* ---------------------------------------------------------------- ES module
   The IIFE above is verbatim from the prototype and still attaches to
   `window`, because the engines find each other through `root.IB*` at
   runtime. This only re-exports what it already published. */
export const IBDeals = window.IBDeals;
export default window.IBDeals;
