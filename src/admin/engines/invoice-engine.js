/* =============================================================================
   Invoice — Module 3 · domain engine
   =============================================================================

   An invoice is born inside a deal, raised against an accepted quotation,
   numbered and frozen the moment it is issued.

   It proves a document exists. It never proves that money moved.

   SIX STORES                          FOUR TRANSACTIONS
     D1 invoice          mutable         INV-T01 issue      lock → revalidate → recompute
                         while Draft                        → lock the sequence → allocate
     D2 invoice_item     plan + one-offs                    the number → freeze → document
     D3 invoice_event    APPEND-ONLY                        → ISSUED → enqueue → COMMIT
     D4 invoice_document VERSIONED       INV-T02 regenerate  a NEW document version from the
     D5 outbox_event     the seam                           same frozen snapshot. Never the
     D6 payment_proof    INTERNAL                           invoice row, number or totals
                                         INV-T03 payment sync  M1 moves first, always
                                         INV-T04 cancel     Head + reason · number RETAINED

   THE FOUR RULES THIS FILE EXISTS TO ENFORCE
     1. ONE AXIS. `invoice_status` is the whole story — Draft, Paid, Cancelled.
        There is no separate payment axis to derive or display: Issue is only
        reachable once proof and a payment reference are attached, and issuing
        logs that payment to the ledger in the same action, so "Issued" and
        "Paid" are the same fact by the time either is ever shown. `payment_id`
        still exists on the row — set/cleared only by Module 1's Sync — as the
        one thing that genuinely can lag: the rare case where the ledger write
        right after Issue fails and needs a manual "Log payment" to catch up.
     2. THERE IS NO WRITE PATH TO THE LEDGER. Not one line in this file inserts,
        edits or reverses a payment row. The arrow from Module 1 points inward
        and has no counterpart.
     3. ISSUED MEANS FROZEN, and a cancelled invoice KEEPS ITS NUMBER forever —
        a statutory series has no gaps and no reuse.
     4. PAYMENT PROOFS NEVER REACH THE DOCUMENT GENERATOR. Not by a check, but
        structurally: `renderDoc()` is never handed a reference to them, so
        there is no template field they could leak through.

   BILLING IS IN MONTHS, NOT QUANTITY. MONEY IS INTEGER PAISE.
   `Partially Paid` DOES NOT EXIST — under 1:1 it is unreachable.
   BUDGET EXISTS NOWHERE, carried from DM-BR-02.
   ============================================================================= */
(function (root) {
  "use strict";

  var D = root.IBData;
  var KEY = "ib_invoice_store", SCHEMA = 3;   /* v3 drops payment_status — an invoice is never
                                   raised until the client has already paid
                                   (Issuance.blockers requires proof + a
                                   reference before Issue is even reachable),
                                   so "Issued but Unpaid" was never a real
                                   state. What survived it — "is there
                                   actually a payment logged against THIS
                                   invoice" — is exactly what payment_id
                                   already answers; a v2 store is discarded
                                   and re-seeded rather than migrated. */

  var SEED = { invoices:D.invoices.slice() };

  /* ------------------------------------------------------------ lifecycle --- */
  /* One axis, not two. There used to be a second — `payment_status`, DERIVED
     from the Module 1 ledger — because issuing and paying were two different
     calls. But Issue is only reachable once payment proof and a reference are
     attached (Issuance.blockers requires both), and issuing logs that payment
     to the ledger in the same user action straight after — so "Issued but
     Unpaid" was never a state this product actually has. `Ready to Issue` is
     a validation result, not a persisted state; `Sent` needs delivery
     tracking that does not exist; `Void` and `Cancelled` are one state
     wearing two words. What's left is Draft, Paid, Cancelled — three, not six. */
  var DOC = { DRAFT:"draft", ISSUED:"issued", CANCELLED:"cancelled" };
  var DOC_NEXT = { draft:["issued", "cancelled"], issued:["cancelled"], cancelled:[] };

  var DOC_LABEL = { draft:"Draft", issued:"Paid", cancelled:"Cancelled" };
  var DOC_TONE  = { draft:"", issued:"ok", cancelled:"dead" };

  var DUE_DAYS = 7;                       // ID-04 — required, defaults to +7
  var PROOF_MAX_BYTES = 5 * 1024 * 1024;  // 5 MB
  var PROOF_TYPES = ["image/png", "image/jpeg", "application/pdf"];

  var TERMS_TEMPLATE =
    "1. Payment is due by the date stated above.\n" +
    "2. This is a tax invoice issued against the accepted quotation referenced above.\n" +
    "3. GST is charged at the prevailing rate and is shown separately.\n" +
    "4. The subscription term billed here is stated in months against the agreed term.\n" +
    "5. Please quote the invoice number on the transfer.";

  /* One GST convention across the suite. Reading Module 2's constants rather
     than restating them is what keeps them from drifting apart. */
  function Q() { return root.IBQuote; }
  /* The same rule the quotation follows — a draft tracks its deal, anything
     issued keeps what it was sent with. See partyOf in quotation-engine.js. */
  function billedTo(inv) {
    if (!inv) return {};
    return inv.invoice_status === DOC.DRAFT
      ? billingOf(inv.deal_id) : (inv.billing_snapshot || {});
  }

  function seller() { return Q() ? Q().SELLER : { state:"Delhi", name:"Feelsafe Technology India" }; }
  function states() { return Q() ? Q().STATES : ["Delhi"]; }

  /* ------------------------------------------------------------- responses --- */
  function ok(data) { return { ok:true, data:data }; }
  function err(http, code, detail) { return { ok:false, http:http, code:code, detail:detail || "" }; }

  /* ================================================================ STORE === */
  var DB = null;

  function blank() {
    return { _v:SCHEMA, invoices:[], items:[], events:[], documents:[], proofs:[], outbox:[],
             seq:{ inv:85, item:0, ev:0, doc:0, ob:0, pf:0 } };
  }
  function load() {
    if (DB) return DB;
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw._v === SCHEMA) { DB = raw; return DB; }
    } catch (e) {}
    DB = seed(); persist(); return DB;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
  function reset() { DB = seed(); persist(); publish(); return DB; }

  // A second tab's write is invisible to a cache set once and kept forever —
  // drop it on any OTHER tab's change to this key, so the next load() re-reads.
  if (typeof root !== "undefined" && root.addEventListener) {
    root.addEventListener("storage", function (e) { if (e.key === KEY) DB = null; });
  }

  /* All-or-nothing. §17: "Validation failures must not allocate an invoice
     number" and "a failed issue must not leave a mutable record falsely marked
     Issued." Both follow from restoring the snapshot on any refusal.          */
  function tx(fn) {
    load();
    var snap = JSON.stringify(DB), r;
    try { r = fn(); }
    catch (e) { DB = JSON.parse(snap); return err(500, "internal_error", e.message); }
    if (!r || r.ok === false) { DB = JSON.parse(snap); return r || err(500, "internal_error", ""); }
    persist(); publish();
    return r;
  }

  /* ================================================================ DATES === */
  function todayISO() { return Q() ? Q().todayISO() : "2026-06-28"; }
  function addDays(iso, n) {
    var dt = D.d(iso); dt.setDate(dt.getDate() + n);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" +
           String(dt.getDate()).padStart(2, "0");
  }
  function daysUntil(iso) { return D.days(D.d(iso)); }     // negative = past

  /* ============================================================== PRICING === */
  /* TAX is explicit and stored (mirrors Module 2 — added for clients who pay
     with no tax at all). `tax_mode` is the source; a zero tax_amount on a Not
     Applicable invoice is a CONSEQUENCE, never inferred from the number.
     Absent (legacy/seeded rows with no field) defaults to Applicable.        */
  var TAX_MODE = { APPLICABLE:"applicable", NOT_APPLICABLE:"not_applicable" };
  var TAX_LABEL = { applicable:"Tax Applicable", not_applicable:"Tax Not Applicable" };
  function taxApplicable(inv) { return inv.tax_mode !== TAX_MODE.NOT_APPLICABLE; }

  /* plan_amount is a flat amount, exactly like an add-on — the same shape the
     quotation's own plan line carries. What differs is only which schedule it
     came from: the quotation's next unbilled installment, or (with no
     installment split) the plan's full negotiated total.                     */
  function price(inv, items) {
    var plan = 0, addons = 0;
    items.forEach(function (it) {
      if (it.kind === "plan") plan += Math.round(it.amount_paise || 0);
      else addons += Math.round(it.amount_paise || 0);
    });
    var taxable = plan + addons;
    var applicable = taxApplicable(inv);
    var rate = applicable ? (Number(inv.gst_rate) || 0) : 0;
    var intra = inv.place_of_supply === seller().state;
    var gst = applicable ? Math.round(taxable * rate / 100) : 0;
    var cgst = 0, sgst = 0, igst = 0;
    // Halve the TOTAL and derive the twin, so CGST + SGST is never a paisa off
    // the GST total through double rounding.
    if (applicable) { if (intra) { cgst = Math.round(gst / 2); sgst = gst - cgst; } else { igst = gst; } }
    return { plan:plan, addons:addons, taxable:taxable, gst_rate:rate, intra:intra,
             tax_applicable:applicable,
             cgst:cgst, sgst:sgst, igst:igst, gst:cgst + sgst + igst,
             grand_total:taxable + cgst + sgst + igst };
  }

  function recalc(inv) {
    var its = itemsOf(inv.invoice_id);
    var t = price(inv, its);
    inv.subtotal_paise = t.taxable;
    inv.discount_total_paise = 0;          // discount is applied once, in the quotation
    inv.taxable_total_paise = t.taxable;
    inv.cgst_paise = t.cgst; inv.sgst_paise = t.sgst; inv.igst_paise = t.igst;
    inv.tax_total_paise = t.gst;
    inv.grand_total_paise = t.grand_total;
    its.forEach(function (it) {
      it.taxable_amount_paise = Math.round(it.amount_paise || 0);
      it.tax_rate = t.tax_applicable ? inv.gst_rate : 0;
      it.tax_amount_paise = t.tax_applicable ? Math.round(it.taxable_amount_paise * inv.gst_rate / 100) : 0;
      it.line_total_paise = it.taxable_amount_paise + it.tax_amount_paise;
    });
    return t;
  }

  /* ---------------------------------------------------- derived money --------
     amount_received and balance_due are NOT stored. Under 1:1, received is
     either nothing or the whole invoice. Storing them would put a second copy
     of a number Module 1 already owns into a second module, and the two would
     drift the first time a payment was reversed.                              */
  function received(inv) { return inv.payment_id ? inv.grand_total_paise : 0; }
  function balance(inv)  { return inv.grand_total_paise - received(inv); }

  /* =============================================================== SEEDING === */
  function seed() {
    var db = blank(); DB = db;
    SEED.invoices.forEach(function (s) {
      var dl = root.IBDeals ? root.IBDeals.dealOf(s.deal) : null;
      var q  = Q() ? Q().quoteOf("q-" + s.quote) : null;
      var plan = q && Q() ? Q().planOf(q.quotation_id) : null;
      // The document's own historical total is the fact; split it into plan +
      // setup using the quotation's own add-on amount, the same reconciliation
      // Module 2's seed already runs.
      var taxableTotal = Math.round(s.amount / 1.18);
      var qAddons = q && Q() ? Q().addonsOf(q.quotation_id) : [];
      var addonAmt = /\+/.test(s.billing || "") && qAddons.length
        ? Math.min(qAddons[0].taxable_amount_paise || 0, taxableTotal) : 0;
      var planAmt = taxableTotal - addonAmt;
      var inv = {
        invoice_id:"i-" + s.ref,
        // A Draft consumes no number — the statutory series has no gaps (§4).
        invoice_number:s.doc === "draft" ? null : s.ref, deal_id:s.deal,
        quotation_id:q ? q.quotation_id : null,          // MANDATORY — contract §6
        payment_id:s.payment || null,                    // 1:1 — the whole allocation model
        invoice_status:s.doc,
        billing_snapshot:billingOf(s.deal),
        tax_snapshot:{ place_of_supply:stateOf(dl ? dl.city : null), gst_rate:18,
                       seller_state:seller().state, seller_gstin:seller().gstin },
        plan_snapshot:plan ? { name:plan.name, features:plan.features, term_months:plan.term_months,
                               installment_seq:null, installment_count:null } : null,
        place_of_supply:stateOf(dl ? dl.city : null), gst_rate:18, tax_mode:TAX_MODE.APPLICABLE,
        invoice_date:s.date, due_date:s.due,
        payment_date:s.date, payment_mode:"NEFT", payment_reference:s.payment || null,
        subtotal_paise:0, discount_total_paise:0, taxable_total_paise:0,
        cgst_paise:0, sgst_paise:0, igst_paise:0, tax_total_paise:0, grand_total_paise:0,
        notes:"", terms:TERMS_TEMPLATE, owner:s.owner,
        created_by:s.owner, created_at:s.date,
        issued_by:s.doc === "draft" ? null : s.owner,
        issued_at:s.doc === "draft" ? null : s.date,
        cancelled_by:s.cancelledBy || null, cancelled_at:s.cancelledAt || null,
        cancellation_reason:s.cancelledReason || null,
        document_id:null, row_version:1
      };
      db.invoices.push(inv);
      db.items.push({ item_id:"ii-" + (++db.seq.item), invoice_id:inv.invoice_id, kind:"plan",
        description:plan ? plan.name : "Subscription", hsn:"998314",
        features:plan ? plan.features : null,
        amount_paise:Math.max(0, planAmt), installment_seq:null, installment_count:null,
        // What the money IS. Module 1 reads this to decide the deal's stage,
        // so a seeded invoice has to carry it exactly like a raised one does.
        remark:s.remark || null,
        tax_rate:18, taxable_amount_paise:0, tax_amount_paise:0, line_total_paise:0, sort_order:0 });
      // "4 months + setup" — the seed's own shorthand for a one-off alongside.
      if (addonAmt > 0) db.items.push({ item_id:"ii-" + (++db.seq.item), invoice_id:inv.invoice_id,
        kind:"addon", description:"Onboarding & profile setup", hsn:"998313", features:null,
        amount_paise:addonAmt, tax_rate:18, taxable_amount_paise:0, tax_amount_paise:0,
        line_total_paise:0, sort_order:1 });
      if (s.doc !== "draft") {
        var doc = { document_id:"idoc-" + (++db.seq.doc), invoice_id:inv.invoice_id, version:1,
          storage_key:"invoices/" + s.ref + "-v1.pdf", checksum_sha256:sha(s.ref),
          byte_size:52000 + (s.months || 1) * 300, generated_at:s.date,
          generator_version:"ib-inv-1.0" };
        db.documents.push(doc); inv.document_id = doc.document_id;
      }
      ev(db, inv.invoice_id, "CREATED", s.owner, "sales_agent", s.date);
      if (inv.issued_at) {
        ev(db, inv.invoice_id, "ISSUED", s.owner, "sales_agent", s.date, { number:s.ref });
        ev(db, inv.invoice_id, "DOCUMENT_GENERATED", "System", "system", s.date);
      }
      if (inv.payment_id) ev(db, inv.invoice_id, "PAYMENT_SYNCED", "System", "system", s.date,
        { payment_id:inv.payment_id });
      if (s.doc === "cancelled") ev(db, inv.invoice_id, "CANCELLED", s.cancelledBy || "System",
        "system", s.cancelledAt || s.date, { reason:s.cancelledReason });
      // Seeded payment proofs, so the internal-only container has something in it.
      for (var k = 0; k < (s.proofs || 0); k++) {
        db.proofs.push({ proof_id:"pf-" + (++db.seq.pf), invoice_id:inv.invoice_id,
          filename:"transfer-" + s.ref.slice(-5) + "-" + (k + 1) + ".png",
          mime:"image/png", bytes:180000 + k * 40000, uploaded_by:s.owner,
          uploaded_at:s.date, payment_id:inv.payment_id, removed:false });
      }
      var n = parseInt(String(s.ref).slice(-5), 10);
      if (n > db.seq.inv) db.seq.inv = n;
    });
    db.invoices.forEach(function (i) { recalc(i); });

    /* "The last invoice closes the gap exactly" — CHAIN_CONTRACT §2. Slicing a
       subscription into months and rounding each slice cannot, in general, sum
       back to the whole; the final slice absorbs the remainder. Without this the
       seed lands a paisa over the cap and the second invoice becomes unissuable. */
    var byDeal = {};
    db.invoices.forEach(function (i) {
      if (i.invoice_status === DOC.CANCELLED) return;
      (byDeal[i.deal_id] = byDeal[i.deal_id] || []).push(i);
    });
    Object.keys(byDeal).forEach(function (dealId) {
      var acc = Q() ? Q().acceptedOf(dealId) : null;
      if (!acc) return;
      var rows = byDeal[dealId];
      var sum = rows.reduce(function (a, i) { return a + i.taxable_total_paise; }, 0);
      var gap = acc.taxable_paise - sum;
      if (!gap) return;
      var last = rows[rows.length - 1];
      var addon = addonsOf(last.invoice_id)[0];
      /* No threshold on CLOSING it. A one-paisa gap left unclosed puts the deal
         a paisa over its own cap and makes the next invoice unissuable — money
         does not get a tolerance.

         There is a threshold on SHOWING it, and that is a different question. A
         sub-rupee gap is installment rounding, and a customer's invoice that
         carries a line reading "Balance of term  −₹0" invites exactly the query
         the line was meant to prevent. Under ₹1 it is folded into a line that
         already exists; at ₹1 or more it is a real balance and gets said out
         loud. Either way the arithmetic is identical. */
      var plan = planOf(last.invoice_id);
      if (addon) { addon.amount_paise += gap; }
      else if (Math.abs(gap) < 100 && plan) { plan.amount_paise += gap; }
      else {
        db.items.push({ item_id:"ii-" + (++db.seq.item), invoice_id:last.invoice_id, kind:"addon",
          description:"Balance of term", hsn:"998314", features:null,
          amount_paise:gap, tax_rate:last.gst_rate, taxable_amount_paise:0,
          tax_amount_paise:0, line_total_paise:0, sort_order:9 });
      }
      recalc(last);
    });
    return db;
  }
  function sha(s) {
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return ("00000000" + h.toString(16)).slice(-8).repeat(8);
  }
  function stateOf(city) { return Q() ? Q().stateOf(city) : seller().state; }

  /* The billing snapshot is a COLUMN, not a join to Module 4. A later profile
     edit cannot reach a historical document, because there is nothing to
     re-read — the values were copied.                                         */
  function billingOf(dealId) {
    var dl = root.IBDeals ? root.IBDeals.dealOf(dealId) : null;
    if (!dl) return { name:"—", address:"—", phone:"—", gstin:null, state:seller().state };
    return { name:dl.customer_name, address:dl.city + ", India", phone:dl.phone,
             gstin:null, state:stateOf(dl.city), city:dl.city, deal_id:dealId };
  }

  /* =============================================================== HELPERS === */
  function find(list, key, val) {
    for (var i = 0; i < list.length; i++) if (list[i][key] === val) return list[i];
    return null;
  }
  function invoiceOf(id) {
    var db = load();
    return find(db.invoices, "invoice_id", id) || find(db.invoices, "invoice_number", id);
  }
  function itemsOf(iid) {
    return load().items.filter(function (i) { return i.invoice_id === iid; })
      .sort(function (a, b) { return a.sort_order - b.sort_order; });
  }
  function planOf(iid) { return itemsOf(iid).filter(function (i) { return i.kind === "plan"; })[0] || null; }
  function addonsOf(iid) { return itemsOf(iid).filter(function (i) { return i.kind === "addon"; }); }
  function forDeal(dealId) {
    return load().invoices.filter(function (i) { return i.deal_id === dealId; })
      .sort(function (a, b) { return a.invoice_date < b.invoice_date ? 1 : -1; });
  }
  function liveOf(dealId) {
    return forDeal(dealId).filter(function (i) { return i.invoice_status !== DOC.CANCELLED; });
  }
  function eventsOf(iid) {
    return load().events.filter(function (e) { return e.invoice_id === iid; })
      .sort(function (a, b) { return a.seq < b.seq ? 1 : -1; });
  }
  function ev(db, iid, type, actor, role, at, meta) {
    db.events.push({ event_id:"iev-" + (++db.seq.ev), seq:db.seq.ev, invoice_id:iid,
      event_type:type, actor_id:actor, actor_role:role || "sales_agent",
      metadata:meta || null, created_at:at || todayISO() });
  }
  function docsOf(iid) {
    return load().documents.filter(function (d) { return d.invoice_id === iid; })
      .sort(function (a, b) { return b.version - a.version; });
  }
  function proofsOf(iid) {
    return load().proofs.filter(function (p) { return p.invoice_id === iid && !p.removed; });
  }

  /* --------------------------------------------------------- installments ---
     How many of the quotation's own installments are already live (Issued or
     Draft) against a given quotation — one invoice bills exactly one
     installment. Scoped to the quotation, not the deal: a revision starts a
     fresh quotation_id, so its schedule starts back at zero.                  */
  function installmentsBilled(quotationId, exceptId) {
    return load().invoices.filter(function (i) {
      return i.quotation_id === quotationId && i.invoice_id !== exceptId &&
        i.invoice_status !== DOC.CANCELLED;
    }).length;
  }
  /* WHAT IS LEFT TO BILL, installment by installment.

     `installmentsBilled` returns a COUNT, which answers "how many" and not the
     question the person raising the invoice is actually asking: which one am I
     on, what should it be, and has anybody already billed it. They were working
     that out by reading the quotation in one tab and the invoice list in
     another, and the only thing stopping a double-bill was that arithmetic.

     This returns the whole schedule, each row carrying the invoice that billed
     it if one did. Everything it needs is already stored — an invoice's plan
     item has always known its `installment_seq`; nothing was reading it. */
  function billingPlan(inv) {
    var q = Q(), qid = inv && inv.quotation_id;
    if (!q || !qid || !q.installmentSchedule) return null;
    var schedule = q.installmentSchedule(qid);
    if (!schedule || !schedule.length) return null;

    var others = load().invoices.filter(function (i) {
      return i.quotation_id === qid && i.invoice_id !== inv.invoice_id &&
             i.invoice_status !== DOC.CANCELLED;
    });
    /* seq → the invoice that billed it. An older invoice raised before the
       sequence existed carries no seq, so it is matched by position instead —
       otherwise its money would look uncollected. */
    var bySeq = {};
    others.forEach(function (i, ix) {
      var pl = planOf(i.invoice_id);
      var seq = pl && pl.installment_seq ? pl.installment_seq : ix + 1;
      if (!bySeq[seq]) bySeq[seq] = i;
    });

    var mine = planOf(inv.invoice_id);
    var mySeq = mine && mine.installment_seq ? mine.installment_seq : null;
    /* If this draft has no seq of its own, the one to raise is the first that
       nobody has billed — which is what the person would have picked by eye. */
    if (!mySeq) {
      for (var k = 0; k < schedule.length; k++) {
        if (!bySeq[schedule[k].seq]) { mySeq = schedule[k].seq; break; }
      }
    }

    // r.amount_paise is the schedule's pristine even split — a suggestion, not
    // what was actually raised. This module lets any installment be billed for
    // a non-standard figure, so the totals below sum the REAL billed amount,
    // keeping the schedule's figure only as the unbilled rows' suggestion.
    var rows = schedule.map(function (r) {
      var by = bySeq[r.seq] || null;
      return { seq:r.seq, due_date:r.due_date, amount_paise:r.amount_paise,
               billed_by:by ? (by.invoice_number || by.invoice_id) : null,
               billed_amount_paise:by ? (by.grand_total_paise || 0) : 0,
               billed:!!by, current:r.seq === mySeq };
    });
    var billedPaise = rows.reduce(function (a, r) {
      return a + (r.billed ? r.billed_amount_paise : 0); }, 0);
    return {
      rows:rows, count:schedule.length, current:mySeq,
      quoted_paise:q.quoteOf(qid) ? q.quoteOf(qid).grand_total_paise : 0,
      billed_paise:billedPaise,
      quotation_number:(q.quoteOf(qid) || {}).quotation_number || null,
      suggested_paise:(rows.filter(function (r) { return r.current; })[0] || {}).amount_paise || 0
    };
  }

  /* The money cap, checked on every change, not only at issue, so the
     salesperson sees the ceiling while typing rather than after committing.    */
  function invoicedPaise(dealId, exceptId) {
    return liveOf(dealId).reduce(function (a, i) {
      return i.invoice_id === exceptId ? a : a + i.grand_total_paise; }, 0);
  }
  function outstandingFor(dealId, exceptId) {
    var dl = root.IBDeals ? root.IBDeals.dealOf(dealId) : null;
    if (!dl) return 0;
    return Math.max(0, dl.deal_value - invoicedPaise(dealId, exceptId));
  }

  /* ---------------------------------------------------------------- scope ---
     Resolved through the PARENT DEAL on every call. An invoice id is not a
     permission. Out of scope returns 403, never 404 — the status code must not
     leak whether the invoice exists.                                          */
  function guard(iid, actor, opts) {
    var inv = invoiceOf(iid);
    if (!inv) return err(404, "invoice_not_found", String(iid));
    var dl = root.IBDeals ? root.IBDeals.dealOf(inv.deal_id) : null;
    if (!dl) return err(404, "invoice_not_found", String(iid));
    if (root.IBDeals && !root.IBDeals.inScope(actor, dl)) {
      // Logged, because a guessed identifier is worth knowing about.
      load(); ev(DB, inv.invoice_id, "ACCESS_DENIED", actor.name, actor.role, todayISO());
      persist();
      return err(403, "out_of_scope", String(iid));
    }
    // A deal that closed after this draft was opened has nothing left to
    // demand — checked once here rather than in each of the six mutations
    // that pass {draft:true}, `dl` is already the resolved deal from the
    // scope check above, so this costs no extra lookup.
    if (opts && opts.draft) {
      var wonStage2 = root.IBDeals ? root.IBDeals.STAGE.WON : 5;
      if (dl.stage >= wonStage2)
        return err(422, "deal_closed", "This deal is " +
          (dl.stage === wonStage2 ? "Closed - Won" : "Closed - Lost") +
          " — a settled deal has nothing left to demand.");
    }
    if (opts && opts.draft && inv.invoice_status !== DOC.DRAFT)
      return err(422, "invoice_not_editable", "This invoice is " + DOC_LABEL[inv.invoice_status] +
        ". Issued content is frozen — a correction is a cancellation and a new invoice.");
    if (opts && opts.rowVersion !== undefined && opts.rowVersion !== null &&
        Number(opts.rowVersion) !== inv.row_version)
      return err(409, "version_conflict", "Someone else saved this draft while you were editing.");
    return ok(inv);
  }
  function isHead(actor) { return root.IBDeals ? root.IBDeals.isHead(actor) : true; }

  /* ================================================================ DRAFT === */
  var Draft = {
    /* Flow 01. Three gates before a row exists: the deal must be in scope, it
       must carry an ACCEPTED quotation, and that quotation must be named
       explicitly. The third is contract §6 — "shown and confirmed, never
       assumed" — and it is the one Module 1 used to skip.                     */
    create: function (dealId, quotationId, actor) {
      return tx(function () {
        var dl = root.IBDeals ? root.IBDeals.dealOf(dealId) : null;
        if (!dl) return err(404, "invoice_not_found", String(dealId));
        if (root.IBDeals && !root.IBDeals.inScope(actor, dl)) return err(403, "out_of_scope", String(dealId));

        var wonStage = root.IBDeals ? root.IBDeals.STAGE.WON : 4;
        if (dl.stage >= wonStage)
          return err(422, "invalid_transition",
            "This deal is " + (dl.stage === wonStage ? "Closed - Won" : "Closed - Lost") +
            " and locked. A settled deal has nothing left to demand.");

        var acc = Q() ? Q().acceptedOf(dealId) : null;
        if (!acc) return err(422, "quote_not_accepted",
          "This deal has no accepted quotation. An invoice cannot invent a plan, a rate or a term.");
        if (!quotationId) return err(422, "quotation_required",
          "Select the quotation this invoice is raised against.");
        var q = Q().quoteOf(quotationId);
        if (!q || q.deal_id !== dealId) return err(422, "quotation_required",
          "That quotation does not belong to this deal.");
        if (q.status !== "accepted") return err(422, "quotation_required",
          "Only the accepted quotation can be billed — " + q.quotation_number + " is " + q.status + ".");

        var cap = outstandingFor(dealId);
        if (cap <= 0) return err(422, "invoice_exceeds_outstanding",
          "Every rupee of this deal is already invoiced.");

        var plan = Q().planOf(q.quotation_id);
        // Y2 — the plan is COPIED from the quotation, never referenced. When the
        // quotation split payment into installments, this invoice SUGGESTS the
        // next one in sequence as a starting figure; otherwise it suggests the
        // plan's full total. Either is only a default — the team can raise this
        // invoice for any amount (an installment, a registration amount, a
        // balance payment…), via Draft.setPlanAmount, with a remark saying what
        // it is. Discounting still happens once, in the proposal.
        var schedule = Q().installmentSchedule ? Q().installmentSchedule(q.quotation_id) : null;
        var already = installmentsBilled(q.quotation_id);
        var planAmount = plan ? Q().lineNet(plan).net : 0;
        var instSeq = null, instCount = null;
        var dueDate = addDays(todayISO(), DUE_DAYS);
        if (schedule && already < schedule.length) {
          var entry = schedule[already];
          // The schedule splits the quotation's own grand total, which is
          // GST-inclusive only when the quotation's tax was Applicable —
          // work back to the taxable base only in that case, else the
          // installment amount already IS the taxable base.
          planAmount = Q().taxApplicable(q)
            ? Math.round(entry.amount_paise / (1 + (Number(q.gst_rate) || 0) / 100))
            : entry.amount_paise;
          instSeq = entry.seq; instCount = schedule.length;
          if (Q().daysUntil(entry.due_date) >= 0) dueDate = entry.due_date;
        }

        var id = "i-new-" + (++DB.seq.item) + "-" + DB.invoices.length;
        var inv = {
          invoice_id:id, invoice_number:null,           // allocated at ISSUE
          deal_id:dealId, quotation_id:q.quotation_id, payment_id:null,
          invoice_status:DOC.DRAFT,
          billing_snapshot:billingOf(dealId),
          tax_snapshot:{ place_of_supply:q.place_of_supply, gst_rate:q.gst_rate,
                         seller_state:seller().state, seller_gstin:seller().gstin },
          plan_snapshot:plan ? { name:plan.name, features:plan.features, term_months:plan.term_months,
                                 installment_seq:instSeq, installment_count:instCount } : null,
          place_of_supply:q.place_of_supply, gst_rate:q.gst_rate,
          // Inherited from the quotation at creation only — contract: "Invoice
          // must retain its own stored tax configuration... changing it must
          // not modify the source Quotation." From here the two are independent.
          tax_mode:q.tax_mode || TAX_MODE.APPLICABLE,
          // The invoice is raised only after the client has already paid — these
          // describe THAT payment, and Issuance.issue() logs it on the deal
          // ledger in the same action. Required (with proof) before issue.
          payment_date:todayISO(), payment_mode:"NEFT", payment_reference:null,
          invoice_date:todayISO(), due_date:dueDate,
          subtotal_paise:0, discount_total_paise:0, taxable_total_paise:0,
          cgst_paise:0, sgst_paise:0, igst_paise:0, tax_total_paise:0, grand_total_paise:0,
          notes:"", terms:TERMS_TEMPLATE, owner:dl.owner_id,
          created_by:actor.name, created_at:todayISO(),
          issued_by:null, issued_at:null,
          cancelled_by:null, cancelled_at:null, cancellation_reason:null,
          document_id:null, row_version:1
        };
        DB.invoices.push(inv);

        DB.items.push({ item_id:"ii-" + (++DB.seq.item), invoice_id:id, kind:"plan",
          description:plan ? plan.name : "Subscription", hsn:"998314",
          features:plan ? plan.features : null,
          amount_paise:Math.max(0, planAmount), installment_seq:instSeq, installment_count:instCount,
          tax_rate:q.gst_rate,
          taxable_amount_paise:0, tax_amount_paise:0, line_total_paise:0, sort_order:0 });

        recalc(inv);
        // The default is the whole balance (or the next installment); if that
        // overshoots the deal's remaining cap, trim to fit rather than creating
        // a draft that cannot issue.
        if (inv.grand_total_paise > cap) {
          var p = planOf(id);
          var over = inv.grand_total_paise - cap;
          var overRate = taxApplicable(inv) ? (Number(inv.gst_rate) || 0) : 0;
          p.amount_paise = Math.max(0, p.amount_paise - Math.round(over / (1 + overRate / 100)));
          recalc(inv);
        }
        ev(DB, id, "CREATED", actor.name, actor.role, todayISO(), { quotation:q.quotation_number });
        return ok(inv);
      });
    },

    update: function (iid, patch, actor) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true, rowVersion:patch && patch.row_version });
        if (g.ok === false) return g;
        var inv = g.data;
        ["invoice_date", "due_date", "place_of_supply", "notes", "terms",
         "payment_date", "payment_mode", "payment_reference"].forEach(function (k) {
          if (patch[k] !== undefined && patch[k] !== null && patch[k] !== "") inv[k] = patch[k];
        });
        if (patch.gst_rate !== undefined && patch.gst_rate !== null && patch.gst_rate !== "") {
          var r = Number(patch.gst_rate);
          if (!Q() || Q().GST_RATES.indexOf(r) < 0)
            return err(400, "validation_failed", "Unsupported GST rate.");
          inv.gst_rate = r;
        }
        if (patch.tax_mode !== undefined && patch.tax_mode !== null) {
          if ([TAX_MODE.APPLICABLE, TAX_MODE.NOT_APPLICABLE].indexOf(patch.tax_mode) < 0)
            return err(400, "validation_failed", "Unsupported tax mode.");
          inv.tax_mode = patch.tax_mode;         // independent of the source quotation from here on
        }
        if (states().indexOf(inv.place_of_supply) < 0)
          return err(400, "validation_failed", "Place of supply is not a recognised state.");
        if (daysUntil(inv.due_date) < 0 && inv.due_date < inv.invoice_date)
          return err(400, "validation_failed", "The due date cannot precede the invoice date.");
        inv.row_version++;
        recalc(inv);
        var over = Draft.capBreach(inv);
        if (over) return over;
        ev(DB, inv.invoice_id, "EDITED", actor.name, actor.role, todayISO(),
           patch.tax_mode !== undefined ? { tax_mode:inv.tax_mode } : null);
        return ok(inv);
      });
    },

    /* The team can raise an invoice for any figure — an installment, a
       registration amount, whatever this particular payment actually was —
       not only what the quotation's own schedule suggested. The plan line's
       amount is set directly, carrying a mandatory remark so the document
       (and anyone reading it later) knows what the figure represents. There
       is no separate "negotiated adjustment" line and no reconciliation
       against plan arithmetic — the remark IS the explanation.            */
    setPlanAmount: function (iid, amountPaise, remark, actor, rowVersion) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true, rowVersion:rowVersion });
        if (g.ok === false) return g;
        var inv = g.data, plan = planOf(inv.invoice_id);
        if (!plan) return err(422, "issue_blocked", "This invoice has no plan block.");

        var amt = Math.round(Number(amountPaise) || 0);
        if (!amt || amt <= 0) return err(400, "validation_failed", "An amount is required.");
        if (!String(remark || "").trim())
          return err(400, "validation_failed",
            "A remark is required — what this amount is (an installment, a registration amount, " +
            "a balance payment…) so nobody has to guess later.");

        plan.amount_paise = amt;
        plan.remark = String(remark).trim();
        inv.row_version++;
        recalc(inv);
        var over = Draft.capBreach(inv);
        if (over) return over;
        ev(DB, inv.invoice_id, "EDITED", actor.name, actor.role, todayISO(),
           { block:"plan_amount", amount:amt, remark:plan.remark });
        return ok(inv);
      });
    },

    addAddon: function (iid, a, actor, rowVersion) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true, rowVersion:rowVersion }); if (g.ok === false) return g;
        var inv = g.data;
        DB.items.push({ item_id:"ii-" + (++DB.seq.item), invoice_id:inv.invoice_id, kind:"addon",
          description:(a && a.description) || "One-off charge", hsn:(a && a.hsn) || "998313",
          features:null,
          amount_paise:Math.max(0, Math.round(Number(a && a.amount_paise) || 0)),
          tax_rate:inv.gst_rate, taxable_amount_paise:0, tax_amount_paise:0,
          line_total_paise:0, sort_order:itemsOf(inv.invoice_id).length });
        inv.row_version++; recalc(inv);
        var over = Draft.capBreach(inv);
        if (over) return over;
        ev(DB, inv.invoice_id, "EDITED", actor.name, actor.role, todayISO(), { block:"addon" });
        return ok(inv);
      });
    },
    updateAddon: function (iid, itemId, a, actor, rowVersion) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true, rowVersion:rowVersion }); if (g.ok === false) return g;
        var it = find(DB.items, "item_id", itemId);
        if (!it || it.invoice_id !== g.data.invoice_id || it.kind !== "addon")
          return err(404, "invoice_not_found", itemId);
        if (a.description !== undefined) it.description = a.description;
        if (a.hsn !== undefined) it.hsn = a.hsn;
        if (a.amount_paise !== undefined)
          it.amount_paise = Math.max(0, Math.round(Number(a.amount_paise) || 0));
        g.data.row_version++; recalc(g.data);
        var over = Draft.capBreach(g.data);
        if (over) return over;
        return ok(g.data);
      });
    },
    removeAddon: function (iid, itemId, actor, rowVersion) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true, rowVersion:rowVersion }); if (g.ok === false) return g;
        var ix = -1;
        DB.items.forEach(function (i, k) { if (i.item_id === itemId && i.kind === "addon") ix = k; });
        if (ix < 0) return err(404, "invoice_not_found", itemId);
        DB.items.splice(ix, 1);
        g.data.row_version++; recalc(g.data);
        return ok(g.data);
      });
    },

    /* The consolidated "Save changes" write. update/setPlanAmount/updateAddon
       each validate and commit inside their OWN tx() — fine standalone, but the
       builder's one button used to chain all four, so a cap check re-run after
       each step could see an intermediate state nobody will ever actually save
       (an addon still at its old, higher amount because the plan's raise landed
       first) and reject an edit that is entirely valid at the end. One tx, one
       merge of everything the patch touches, one cap check against the FINAL
       state, one write — reusing the exact checks those three methods already
       run, not re-deriving them. Absent (`undefined`) patch keys are left
       untouched, exactly like Draft.update's own fields.                       */
    saveAll: function (iid, patch, actor) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true, rowVersion:patch && patch.row_version });
        if (g.ok === false) return g;
        var inv = g.data;
        patch = patch || {};

        ["invoice_date", "due_date", "place_of_supply", "notes", "terms",
         "payment_date", "payment_mode", "payment_reference"].forEach(function (k) {
          if (patch[k] !== undefined && patch[k] !== null && patch[k] !== "") inv[k] = patch[k];
        });
        if (patch.gst_rate !== undefined && patch.gst_rate !== null && patch.gst_rate !== "") {
          var rate = Number(patch.gst_rate);
          if (!Q() || Q().GST_RATES.indexOf(rate) < 0)
            return err(400, "validation_failed", "Unsupported GST rate.");
          inv.gst_rate = rate;
        }
        if (states().indexOf(inv.place_of_supply) < 0)
          return err(400, "validation_failed", "Place of supply is not a recognised state.");
        if (daysUntil(inv.due_date) < 0 && inv.due_date < inv.invoice_date)
          return err(400, "validation_failed", "The due date cannot precede the invoice date.");

        var plan = null;
        if (patch.plan_amount_paise !== undefined) {
          plan = planOf(inv.invoice_id);
          if (!plan) return err(422, "issue_blocked", "This invoice has no plan block.");
          var amt = Math.round(Number(patch.plan_amount_paise) || 0);
          if (!amt || amt <= 0) return err(400, "validation_failed", "An amount is required.");
          if (!String(patch.plan_remark || "").trim())
            return err(400, "validation_failed",
              "A remark is required — what this amount is (an installment, a registration amount, " +
              "a balance payment…) so nobody has to guess later.");
          plan.amount_paise = amt;
          plan.remark = String(patch.plan_remark).trim();
        }

        var addonErr = null;
        (patch.addons || []).forEach(function (a) {
          if (addonErr) return;
          var it = find(DB.items, "item_id", a.item_id);
          if (!it || it.invoice_id !== inv.invoice_id || it.kind !== "addon") {
            addonErr = err(404, "invoice_not_found", a.item_id); return;
          }
          if (a.description !== undefined) it.description = a.description;
          if (a.hsn !== undefined) it.hsn = a.hsn;
          if (a.amount_paise !== undefined)
            it.amount_paise = Math.max(0, Math.round(Number(a.amount_paise) || 0));
        });
        if (addonErr) return addonErr;

        inv.row_version++;
        recalc(inv);
        var over = Draft.capBreach(inv);
        if (over) return over;

        ev(DB, inv.invoice_id, "EDITED", actor.name, actor.role, todayISO(),
           plan ? { block:"plan_amount", amount:plan.amount_paise, remark:plan.remark } : null);
        return ok(inv);
      });
    },

    /* The money cap, re-checked after every mutation. A Module 1 rule,
       enforced here — SUM(grand_total) over non-cancelled invoices ≤ deal_value. */
    capBreach: function (inv) {
      var cap = outstandingFor(inv.deal_id, inv.invoice_id);
      if (inv.grand_total_paise > cap)
        return err(422, "invoice_exceeds_outstanding",
          D.inr(inv.grand_total_paise) + " exceeds the " + D.inr(cap) +
          " still uninvoiced on this deal.");
      return null;
    },

    /* Only a Draft can be cancelled this way, and it consumes no number. */
    cancel: function (iid, actor) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true }); if (g.ok === false) return g;
        var inv = g.data;
        inv.invoice_status = DOC.CANCELLED; inv.cancelled_at = todayISO();
        inv.cancelled_by = actor.name; inv.cancellation_reason = "Draft abandoned";
        inv.row_version++;
        ev(DB, inv.invoice_id, "CANCELLED", actor.name, actor.role, todayISO(), { draft:true });
        return ok(inv);
      });
    }
  };

  /* ============================================================ ISSUANCE === */
  var Issuance = {
    blockers: function (iid) {
      var inv = invoiceOf(iid); if (!inv) return [];
      var out = [], plan = planOf(iid);
      var dl3 = root.IBDeals ? root.IBDeals.dealOf(inv.deal_id) : null;
      if (dl3 && root.IBDeals && dl3.stage >= root.IBDeals.STAGE.WON)
        out.push({ code:"deal_closed", text:"This deal is " +
          (dl3.stage === root.IBDeals.STAGE.WON ? "Closed - Won" : "Closed - Lost") +
          " — a settled deal has nothing left to demand." });
      if (!itemsOf(iid).length)
        out.push({ code:"issue_blocked", text:"An invoice needs at least one line." });
      if (!plan || !plan.amount_paise)
        out.push({ code:"issue_blocked", text:"The plan line needs an amount." });
      if (!inv.quotation_id)
        out.push({ code:"quotation_required", text:"No quotation is linked to this invoice." });
      var b = billedTo(inv) || {};
      if (!b.name || b.name === "—" || !b.address)
        out.push({ code:"issue_blocked", text:"The billing block is incomplete." });
      if (!inv.due_date)
        out.push({ code:"issue_blocked", text:"A due date is required." });
      var t = price(inv, itemsOf(iid));
      if (t.grand_total <= 0)
        out.push({ code:"invalid_invoice_total", text:"The grand total must be greater than zero." });
      if (t.taxable !== t.plan + t.addons)
        out.push({ code:"invalid_invoice_total", text:"Totals do not reconcile with the lines." });
      var cap = outstandingFor(inv.deal_id, inv.invoice_id);
      if (t.grand_total > cap)
        out.push({ code:"invoice_exceeds_outstanding",
                   text:D.inr(t.grand_total) + " exceeds the deal's remaining " + D.inr(cap) + "." });
      // An invoice is raised only after the client has already paid — issuing
      // it logs that payment on the deal ledger in the same action, so both
      // the evidence and the reference to reconcile it must exist first.
      if (!proofsOf(iid).length)
        out.push({ code:"payment_proof_required",
                   text:"Payment proof is required — attach evidence of the payment before issuing." });
      if (!inv.payment_reference || !inv.payment_reference.trim())
        out.push({ code:"validation_failed",
                   text:"A payment reference / UTR is required to log the payment this invoice raises." });
      return out;
    },

    /* INV-T01. Nine steps commit as one or none. On rollback the number returns
       to the sequence, so the series has no unexplained gaps and no half-issued
       record exists with a document but no status.                            */
    issue: function (iid, actor) {
      return tx(function () {
        var g = guard(iid, actor, { draft:true }); if (g.ok === false) return g;
        var inv = g.data;

        var blockers = Issuance.blockers(inv.invoice_id);
        if (blockers.length) return err(422, blockers[0].code, blockers[0].text);

        recalc(inv);                                   // 3 · the authoritative pass
        // 4/5 · the counter is a lockable row, not a MAX() query over the table.
        inv.invoice_number = "IB-INV-" + D.TODAY.getFullYear() + "-" +
          String(++DB.seq.inv).padStart(5, "0");
        // 6 · freeze. The snapshots are re-taken here and never read live again.
        inv.invoice_status = DOC.ISSUED;
        inv.billing_snapshot = billingOf(inv.deal_id);
        inv.tax_snapshot = { place_of_supply:inv.place_of_supply, gst_rate:inv.gst_rate,
                             tax_mode:inv.tax_mode, seller_state:seller().state,
                             seller_gstin:seller().gstin };
        inv.issued_by = actor.name; inv.issued_at = todayISO();
        inv.row_version++;

        var doc = renderDoc(inv, 1);                    // 7 · document + checksum
        DB.documents.push(doc); inv.document_id = doc.document_id;

        ev(DB, inv.invoice_id, "ISSUED", actor.name, actor.role, todayISO(),
           { number:inv.invoice_number, grand_total:inv.grand_total_paise });
        ev(DB, inv.invoice_id, "DOCUMENT_GENERATED", "System", "system", todayISO(),
           { version:1 });

        // 9 · written here, NOT published here.
        enqueue(DB, "invoice.issued", inv.invoice_id,
          { deal_id:inv.deal_id, invoice_id:inv.invoice_id,
            invoice_number:inv.invoice_number, amount_paise:inv.grand_total_paise });
        return ok(inv);
      });
    }
  };

  /* The generator is handed the invoice and its items. It is NEVER handed
     proofsOf() — there is no template field a bank screenshot could render
     into, so it cannot leak through a template edit or a regeneration.        */
  function renderDoc(inv, version) {
    return { document_id:"idoc-" + (++DB.seq.doc), invoice_id:inv.invoice_id, version:version,
      storage_key:"invoices/" + inv.invoice_number + "-v" + version + ".pdf",
      checksum_sha256:sha(inv.invoice_number + "|v" + version + "|" + inv.grand_total_paise),
      byte_size:52000 + itemsOf(inv.invoice_id).length * 1400,
      generated_at:todayISO(), generator_version:"ib-inv-1.0" };
  }

  /* ============================================================= DOCUMENT === */
  var Document = {
    current: function (iid) { return docsOf(iid)[0] || null; },
    versions: docsOf,

    /* INV-T02. Reads the same frozen snapshot and adds a VERSION. It cannot
       alter the invoice row, the number or the totals — and a rendering failure
       never allocates a second number, because the number already exists.     */
    regenerate: function (iid, actor) {
      return tx(function () {
        var g = guard(iid, actor); if (g.ok === false) return g;
        var inv = g.data;
        if (inv.invoice_status === DOC.DRAFT)
          return err(422, "invalid_transition", "A draft has no document to regenerate.");
        if (!isHead(actor)) return err(403, "admin_required", "Regeneration is a Sales Head action.");
        var next = (docsOf(iid)[0] ? docsOf(iid)[0].version : 0) + 1;
        var doc = renderDoc(inv, next);
        DB.documents.push(doc); inv.document_id = doc.document_id;
        ev(DB, inv.invoice_id, "DOCUMENT_REGENERATED", actor.name, actor.role, todayISO(),
           { version:next });
        return ok(doc);
      });
    },

    download: function (iid, actor) {
      return tx(function () {
        var g = guard(iid, actor); if (g.ok === false) return g;
        var doc = Document.current(iid);
        if (!doc) return err(404, "invoice_not_found", "No document — this invoice was never issued.");
        ev(DB, g.data.invoice_id, "DOWNLOADED", actor.name, actor.role, todayISO(),
           { version:doc.version });
        return ok(doc);
      });
    },
    share: function (iid, actor) {
      return tx(function () {
        var g = guard(iid, actor); if (g.ok === false) return g;
        var doc = Document.current(iid);
        if (!doc) return err(404, "invoice_not_found", "No document to share.");
        // INV-OD-09/12 open. The token is deliberately not the invoice number —
        // a predictable public identifier for a customer's invoice is not
        // acceptable, and it is not reversible once links are out.
        var token = doc.checksum_sha256.slice(0, 24);
        ev(DB, g.data.invoice_id, "SHARED", actor.name, actor.role, todayISO(), { token:token });
        return ok({ doc:doc, link:"/i/" + token, expires:addDays(todayISO(), 7) });
      });
    }
  };

  /* ========================================================= CANCELLATION === */
  var Cancellation = {
    blockers: function (iid, actor) {
      var inv = invoiceOf(iid); if (!inv) return [];
      var out = [];
      if (inv.invoice_status === DOC.CANCELLED)
        out.push({ code:"invalid_transition", text:"This invoice is already cancelled." });
      if (inv.invoice_status === DOC.DRAFT)
        out.push({ code:"invalid_transition", text:"A draft is cancelled without a reason and consumes no number." });
      if (!isHead(actor))
        out.push({ code:"admin_required", text:"Cancelling an issued invoice is a Sales Head action." });
      if (inv.payment_id)
        out.push({ code:"cancel_blocked",
                   text:"This invoice is settled. Reverse the payment in the deal first — the ledger moves before the document." });
      return out;
    },

    /* INV-T04. Deletes nothing: the row, its number, its document versions and
       its full event history all survive. That is the entire point of the
       operation, and the number stays permanently consumed.                   */
    cancel: function (iid, reason, actor, opts) {
      return tx(function () {
        var auto = opts && opts.system;
        // A reversal-driven cancellation is not somebody's request, so it does
        // not resolve through anybody's scope. It is Module 1 telling us the
        // money went away, and it must not be refusable.
        var inv;
        if (auto) {
          inv = invoiceOf(iid);
          if (!inv) return err(404, "invoice_not_found", String(iid));
        } else {
          var g = guard(iid, actor); if (g.ok === false) return g;
          inv = g.data;
        }
        if (!auto) {
          var blockers = Cancellation.blockers(iid, actor);
          if (blockers.length) {
            var b = blockers[0];
            return err(b.code === "admin_required" ? 403 : 422, b.code, b.text);
          }
          if (!String(reason || "").trim())
            return err(400, "validation_failed",
              "A cancellation reason is mandatory. A cancellation with no recorded reason is " +
              "indistinguishable from a mistake six months later.");
        }
        inv.invoice_status = DOC.CANCELLED;
        inv.cancelled_by = auto ? "System" : actor.name;
        inv.cancelled_at = todayISO();
        inv.cancellation_reason = String(reason || "").trim();
        inv.row_version++;
        // The number is NOT released and the document is NOT deleted.
        ev(DB, inv.invoice_id, "CANCELLED", inv.cancelled_by, auto ? "system" : actor.role,
           todayISO(), { reason:inv.cancellation_reason, number:inv.invoice_number });
        enqueue(DB, "invoice.cancelled", inv.invoice_id,
          { deal_id:inv.deal_id, invoice_id:inv.invoice_id, reason:inv.cancellation_reason });
        return ok(inv);
      });
    }
  };

  /* ================================================================ SYNC ===
     INV-T03. The read-only direction. MODULE 1 MOVES FIRST, ALWAYS — a payment
     is logged in Deals and Invoice *learns* about it; a payment is reversed in
     Deals and Invoice's cancellation is a *consequence*.

     Nothing below inserts, edits or reverses a payment ledger row.            */
  var Sync = {
    paymentRecorded: function (p) {
      return tx(function () {
        var inv = invoiceOf(p.invoice_id);
        if (!inv) return ok({ skipped:true });
        if (inv.payment_id === p.payment_id) return ok({ idempotent:true });
        inv.payment_id = p.payment_id;                 // 1:1 — one column, no allocation table
        inv.row_version++;
        ev(DB, inv.invoice_id, "PAYMENT_SYNCED", "System", "system", todayISO(),
           { payment_id:p.payment_id, amount:p.amount_paise });
        return ok(inv);
      });
    },

    /* A reversal does not rewrite the issued document. No historical figure on
       it changes; the invoice is cancelled around it, and the amount returns to
       uninvoiced so the balance can be re-raised.                             */
    paymentReversed: function (p) {
      load();
      var inv = invoiceOf(p.invoice_id);
      if (!inv) return ok({ skipped:true });
      if (inv.invoice_status === DOC.CANCELLED && !inv.payment_id) return ok({ idempotent:true });
      var r = tx(function () {
        var i2 = invoiceOf(p.invoice_id);
        i2.payment_id = null;
        i2.row_version++;
        ev(DB, i2.invoice_id, "PAYMENT_SYNCED", "System", "system", todayISO(),
           { reversed:p.payment_id });
        return ok(i2);
      });
      if (r.ok === false) return r;
      return Cancellation.cancel(inv.invoice_id, "Payment reversed — " + p.payment_id,
        { name:"System", role:"system" }, { system:true });
    }
  };

  /* ============================================================== PROOFS ===
     The most sensitive objects in the module. A bank or UPI screenshot carries
     account numbers, phone numbers and a customer's balance.

     A proof files EVIDENCE. It does not record money — until a Module 1 ledger
     entry exists, `payment_id` stays null, whatever has been uploaded.        */
  var Proofs = {
    of: proofsOf,
    attach: function (iid, f, actor) {
      return tx(function () {
        var g = guard(iid, actor); if (g.ok === false) return g;
        if (!f || !f.filename) return err(400, "validation_failed", "A file is required.");
        if (PROOF_TYPES.indexOf(f.mime) < 0)
          return err(415, "proof_type_unsupported", "Only PNG, JPG and PDF are accepted.");
        if ((f.bytes || 0) > PROOF_MAX_BYTES)
          return err(413, "proof_too_large", "Payment proofs are capped at 5 MB.");
        DB.proofs.push({ proof_id:"pf-" + (++DB.seq.pf), invoice_id:g.data.invoice_id,
          filename:f.filename, mime:f.mime, bytes:f.bytes || 0,
          // A downscaled preview only. The original never enters localStorage —
          // it goes to object storage through the API. INV-OD-12 still open.
          thumb:f.thumb || null,
          uploaded_by:actor.name, uploaded_at:todayISO(),
          payment_id:g.data.payment_id, removed:false });
        ev(DB, g.data.invoice_id, "PROOF_ATTACHED", actor.name, actor.role, todayISO(),
           { filename:f.filename });
        return ok(g.data);
      });
    },
    view: function (iid, proofId, actor) {
      return tx(function () {
        var g = guard(iid, actor); if (g.ok === false) return g;
        var p = find(DB.proofs, "proof_id", proofId);
        if (!p || p.invoice_id !== g.data.invoice_id) return err(404, "invoice_not_found", proofId);
        ev(DB, g.data.invoice_id, "PROOF_VIEWED", actor.name, actor.role, todayISO(),
           { filename:p.filename });
        return ok(p);
      });
    },
    /* Head only, reason mandatory, and the ORIGINAL FILENAME is logged — so a
       removal cannot erase the fact that something was there.                 */
    remove: function (iid, proofId, reason, actor) {
      return tx(function () {
        var g = guard(iid, actor); if (g.ok === false) return g;
        if (!isHead(actor))
          return err(403, "proof_removal_denied", "Removing a payment proof is a Sales Head action.");
        if (!String(reason || "").trim())
          return err(400, "validation_failed", "A removal reason is mandatory.");
        var p = find(DB.proofs, "proof_id", proofId);
        if (!p || p.invoice_id !== g.data.invoice_id) return err(404, "invoice_not_found", proofId);
        p.removed = true; p.removed_by = actor.name; p.removed_at = todayISO();
        p.removal_reason = String(reason).trim();
        ev(DB, g.data.invoice_id, "PROOF_REMOVED", actor.name, actor.role, todayISO(),
           { filename:p.filename, reason:p.removal_reason });
        return ok(g.data);
      });
    }
  };

  /* ============================================================== OUTBOX === */
  function enqueue(db, type, aggId, payload) {
    db.outbox.push({ outbox_id:"iob-" + (++db.seq.ob), aggregate_type:"invoice",
      aggregate_id:aggId, event_type:type, payload:payload,
      status:"pending", attempts:0, created_at:todayISO(), delivered_at:null, error:null });
  }
  function drain() {
    load();
    var moved = 0, failed = 0;
    DB.outbox.forEach(function (row) {
      if (row.status === "delivered") return;
      row.attempts++;
      var S = root.IBDeals && root.IBDeals.Sync;
      if (!S) { row.status = "pending"; row.error = "Module 1 not loaded"; failed++; return; }
      var r = row.event_type === "invoice.issued" ? S.invoiceIssued(row.payload)
            : row.event_type === "invoice.cancelled" ? S.invoiceCancelled(row.payload)
            : { ok:true, data:{ skipped:true } };
      if (r && r.ok === false) { row.status = "pending"; row.error = r.code; failed++; return; }
      row.status = "delivered"; row.delivered_at = todayISO(); row.error = null; moved++;
    });
    persist();
    return { delivered:moved, failed:failed };
  }

  /* =========================================================== ANALYTICS === */
  var Analytics = {
    scopeOf: function (actor) {
      var all = load().invoices;
      if (!root.IBDeals || root.IBDeals.isHead(actor)) return all;
      return all.filter(function (i) {
        var dl = root.IBDeals.dealOf(i.deal_id);
        return dl && root.IBDeals.inScope(actor, dl);
      });
    },
    summary: function (actor) {
      var all = Analytics.scopeOf(actor);
      var issued = all.filter(function (i) { return i.invoice_status === DOC.ISSUED; });
      var byDoc = {};
      all.forEach(function (i) { byDoc[i.invoice_status] = (byDoc[i.invoice_status] || 0) + 1; });
      // Reads `payment_id` — the one field Module 1's Sync actually writes —
      // not invoice_status, so the rare stuck invoice (the ledger write right
      // after Issue failed and nobody has logged it manually yet) is never
      // counted as cash. That is exactly the mistake INV-BR-07 warns against.
      var paid = issued.filter(function (i) { return !!i.payment_id; });
      var unpaid = issued.filter(function (i) { return !i.payment_id; });
      return {
        all:all, byDoc:byDoc,
        invoiced:issued.reduce(function (a, i) { return a + i.grand_total_paise; }, 0),
        received:paid.reduce(function (a, i) { return a + received(i); }, 0),
        outstanding:unpaid.reduce(function (a, i) { return a + balance(i); }, 0),
        drafts:all.filter(function (i) { return i.invoice_status === DOC.DRAFT; }).length
      };
    }
  };

  /* ============================================================== EXPORT === */
  function projectInvoices() {
    return load().invoices.map(function (inv) {
      var plan = planOf(inv.invoice_id);
      return { ref:inv.invoice_number || "(draft)", deal:inv.deal_id,
        quote:Q() && inv.quotation_id ? ((Q().quoteOf(inv.quotation_id) || {}).quotation_number || "") : "",
        doc:inv.invoice_status,
        // No more "overdue" — an invoice is never issued unpaid, so the only
        // thing left to project is whether Module 1's ledger actually landed
        // (payment_id) for the rare stuck-after-Issue case. Other modules
        // that read this projection (Sales) see "paid"/"unpaid", not a
        // three-way axis that can no longer produce its third value.
        pay:inv.payment_id ? "paid" : "unpaid",
        amount:inv.grand_total_paise, received:received(inv),
        billing:(plan && plan.installment_count
                  ? "Installment " + plan.installment_seq + " of " + plan.installment_count
                  : plan ? D.inr(plan.amount_paise) : "—") +
                (addonsOf(inv.invoice_id).length ? " + setup" : ""),
        installmentSeq:plan ? plan.installment_seq : null,
        installmentCount:plan ? plan.installment_count : null,
        date:inv.invoice_date, due:inv.due_date, owner:inv.owner,
        payment:inv.payment_id, proofs:proofsOf(inv.invoice_id).length,
        cancelledReason:inv.cancellation_reason, cancelledBy:inv.cancelled_by,
        cancelledAt:inv.cancelled_at, _src:inv };
    });
  }
  function publish() {
    var arr = D.invoices;
    arr.length = 0; Array.prototype.push.apply(arr, projectInvoices());
  }

  root.IBInvoice = {
    DOC:DOC, DOC_LABEL:DOC_LABEL, DOC_TONE:DOC_TONE, DOC_NEXT:DOC_NEXT,
    TAX_MODE:TAX_MODE, TAX_LABEL:TAX_LABEL, taxApplicable:taxApplicable,
    DUE_DAYS:DUE_DAYS, TERMS_TEMPLATE:TERMS_TEMPLATE,
    PROOF_MAX_BYTES:PROOF_MAX_BYTES, PROOF_TYPES:PROOF_TYPES,
    load:load, reset:reset, db:function () { return load(); },
    Draft:Draft, Issuance:Issuance, Document:Document, Cancellation:Cancellation,
    Sync:Sync, Proofs:Proofs, Analytics:Analytics,
    invoiceOf:invoiceOf, billedTo:billedTo, billingPlan:billingPlan, itemsOf:itemsOf, planOf:planOf, addonsOf:addonsOf,
    forDeal:forDeal, liveOf:liveOf, eventsOf:eventsOf, docsOf:docsOf, proofsOf:proofsOf,
    price:price, received:received, balance:balance,
    installmentsBilled:installmentsBilled,
    invoicedPaise:invoicedPaise, outstandingFor:outstandingFor,
    daysUntil:daysUntil, addDays:addDays, todayISO:todayISO, seller:seller, states:states,
    outbox:function () { return load().outbox.slice().reverse(); },
    drain:drain,
    project:{ invoices:projectInvoices }
  };

  load();
  drain();
  publish();
  // The seeded invoices were never enqueued, so Module 1 reconstructs its two
  // invoice scalars from our rows once, at boot. Everything after is by outbox.
  if (root.IBDeals && root.IBDeals.Sync) root.IBDeals.Sync.reconcileInvoices();
})(window);

/* ---------------------------------------------------------------- ES module
   The IIFE above is verbatim from the prototype and still attaches to
   `window`, because the engines find each other through `root.IB*` at
   runtime. This only re-exports what it already published. */
export const IBInvoice = window.IBInvoice;
export default window.IBInvoice;
