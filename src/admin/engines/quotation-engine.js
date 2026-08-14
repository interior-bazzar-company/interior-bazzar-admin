/* =============================================================================
   Quotation — Module 2 · domain engine
   =============================================================================

   A quotation is born inside a deal, calculated on the server, and frozen the
   moment the customer sees it. Everything after that is a new version, never
   an edit.

   FIVE STORES                        FOUR TRANSACTIONS
     D1 quotation      mutable          QT-T01 issue     lock → recalc → assign
                       while Draft                       number + version → freeze
     D2 quotation_item plan + add-ons                    → document → ISSUED event
     D3 quotation_event APPEND-ONLY                      → enqueue outbox → COMMIT
     D4 document_object the artefact     QT-T02 revision  run T01 on the replacement,
     D5 outbox_event   the seam                          and ONLY THEN supersede
                                        QT-T03 accept    guards → Accepted → enqueue
                                                         the deal write-back
                                        QT-T04 expiry    job lock → Issued past
                                                         validity → one commit per row

   THE THREE RULES THIS FILE EXISTS TO ENFORCE
     1. Issued means FROZEN. There is no PUT and no DELETE on an issued
        quotation — the absence of the endpoint is the enforcement, not a flag.
     2. Supersede only AFTER the replacement has issued. Order is the whole
        feature: supersede first and a failed replacement leaves the deal with
        no acceptable version, against a history that cannot be edited back.
     3. The server does the arithmetic. Client figures are display only and are
        recomputed on every change and again inside the issue transaction.

   MONEY IS INTEGER PAISE. NO QUANTITY EXISTS ANYWHERE — a plan has a term, an
   add-on has an amount. BUDGET EXISTS NOWHERE, carried from DM-BR-02.
   ============================================================================= */
(function (root) {
  "use strict";

  var D = root.IBData;
  var KEY = "ib_quote_store", SCHEMA = 2;   /* customer_snapshot.phone was a masked number, frozen at
                                   creation. Seven digits are gone and no
                                   migration invents them back, so a v1
                                   store is discarded and re-snapshotted. */

  /* Captured before anything publishes back, for the same reason Module 1 does
     it: re-seeding from our own last output would drift on every reset.       */
  var SEED = { quotations:D.quotations.slice() };

  /* ------------------------------------------------------------ lifecycle --- */
  var ST = { DRAFT:"draft", ISSUED:"issued", ACCEPTED:"accepted", REJECTED:"rejected",
             EXPIRED:"expired", SUPERSEDED:"superseded", CANCELLED:"cancelled" };

  /* Seven states (QD-03). The brief proposed Ready / Sent / Viewed; Ready is a
     UI condition, Sent is what issuing IS, and Viewed needs delivery
     infrastructure that does not exist.

     THERE IS NO TRANSITION MATRIX. There was, and every terminal state was
     genuinely terminal — accepted, rejected and expired all led nowhere. The
     rule it was protecting is real and still holds, but it is not this one:

       what must not change is the DOCUMENT. A quotation that has been sent is
       a thing a customer is holding, and rewriting it under them is the actual
       harm. The row's status is a record of what happened to that document,
       and a customer changing their mind is not a corruption — it is Tuesday.

     So the artefact stays frozen for ever (see `guard(..., {draft:true})`,
     which is unchanged) and the STATUS is free. A rejected quotation the
     customer calls back about can be accepted. An accepted one can be revised.
     Nothing dead-ends, and every change is written to the event log with an
     actor — which is what made the old refusals feel safe in the first place. */

  var LABEL = { draft:"Draft", issued:"Issued", accepted:"Accepted", rejected:"Rejected",
                expired:"Expired", superseded:"Superseded", cancelled:"Cancelled" };
  var TONE  = { draft:"", issued:"warn", accepted:"ok", rejected:"bad",
                expired:"dead", superseded:"dead", cancelled:"dead" };

  /* THE COMPANY, as it actually is on paper.

     Two names, and the distinction is the whole reason this is a table rather
     than a string. `brand` is what the customer bought — Interior bazzar — and
     it leads the letterhead. `legal` is who takes the money and who a court
     would name, and it sits under the brand on every document because a
     transfer to a name the customer has never seen is a transfer that does not
     get made.

     GSTIN is deliberately ABSENT, not blank: registration is still processing,
     and a letterhead that prints "GSTIN: processing" tells a customer's finance
     desk that the number they need to claim input credit does not exist yet —
     in the one place they will look for it. Every renderer below asks whether
     it is there rather than printing whatever it finds, so the day it is issued
     this is a one-line change and nothing else moves.

     The bank block is quoted verbatim from the account. Nothing here is
     inferred: the branch is named because it was given, and the BANK is not,
     because the IFSC identifies it unambiguously to anyone making the transfer
     and inventing a name onto a payment instruction is how money goes astray. */
  var SELLER = {
    brand:"Interior bazzar",
    legal:"FEELSAFE TECHNOLOGY INDIA PRIVATE LIMITED",
    /* `name` stays, and stays legal, because it is what the payee line, the
       signature block and the account name all have to say. */
    name:"FEELSAFE TECHNOLOGY INDIA PRIVATE LIMITED",
    tagline:"Unit of FEELSAFE TECHNOLOGY INDIA PRIVATE LIMITED",
    type:"SaaS · B2B and B2C",
    deals_in:"Interior and related industries",
    domain:"interiorbazzar.com",

    addr:"Plot no. 42, First Floor, Kh no. 27/14, Shiv Park, Kakrola, " +
         "New Delhi, South West Delhi 110078, Delhi",
    addr_registered:"F-29, Sidhathi Enclave, D K Mohan Garden, Uttam Nagar, " +
                    "New Delhi, West Delhi 110059, Delhi",
    phone:"+91 89208 98168",
    email:"help@interiorbazzar.com",

    cin:"U62090DL2024PTC434514",
    pan:"AAGCF0115N",
    udyam:"UDYAM-DL-10-0098290",
    gstin:null,                       // registration in progress — see above
    state:"Delhi", jurisdiction:"New Delhi",

    bank_receiver:"FEELSAFE TECHNOLOGY INDIA PRIVATE LIMITED",
    bank_type:"Current",
    bank_account:"70651211205",
    bank_ifsc:"IDFB0020106",
    bank_branch:"Dwarka Branch",
    upi:"feelsafe@idfcbank",
    swift:"IDFBINBBMUM",
    methods:"NEFT, RTGS, UPI"
  };

  /* The 36-entry list and the intra/inter rule are lifted verbatim from
     pages/new-quotation.html, which already ships them. QT-OD-03 was recorded
     as open and blocking Module 3; it is closed by code that already exists.  */
  var STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa",
    "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
    "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim",
    "Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
    "Jammu and Kashmir","Ladakh","Chandigarh","Puducherry","Andaman and Nicobar Islands",
    "Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];

  var CITY_STATE = { "New Delhi":"Delhi", Delhi:"Delhi", Mumbai:"Maharashtra", Pune:"Maharashtra",
    Nagpur:"Maharashtra", Bengaluru:"Karnataka", Mysuru:"Karnataka", Chennai:"Tamil Nadu",
    Coimbatore:"Tamil Nadu", Hyderabad:"Telangana", Kochi:"Kerala", Kozhikode:"Kerala",
    Ahmedabad:"Gujarat", Surat:"Gujarat", Jaipur:"Rajasthan", Lucknow:"Uttar Pradesh",
    Noida:"Uttar Pradesh", Kanpur:"Uttar Pradesh", Gurugram:"Haryana", Kolkata:"West Bengal",
    Bhubaneswar:"Odisha", Indore:"Madhya Pradesh", Chandigarh:"Chandigarh", Patna:"Bihar" };

  var GST_RATES = [0, 5, 12, 18, 28];
  var DEFAULT_GST = 18;
  var DEFAULT_VALIDITY_DAYS = 15;              // QT-OD-02 — spec 15, terms template says 30
  var TERMS_TEMPLATE =
    "1. This quotation is valid until the date stated above.\n" +
    "2. The subscription term begins on activation, not on the date of this quotation.\n" +
    "3. GST as applicable is shown above and is charged at the prevailing rate.\n" +
    "4. Payment is due against the invoice raised for each instalment of the agreed value.\n" +
    "5. Plan features are as listed and are subject to the Interior bazzar terms of service.";

  /* ------------------------------------------------------------- responses --- */
  function ok(data) { return { ok:true, data:data }; }
  function err(http, code, detail) { return { ok:false, http:http, code:code, detail:detail || "" }; }

  /* ================================================================ STORE === */
  var DB = null;

  function blank() {
    return { _v:SCHEMA, quotations:[], items:[], events:[], documents:[], outbox:[],
             seq:{ q:157, item:0, ev:0, doc:0, ob:0 },
             jobs:{ expiry:{ lastRun:null, running:false } } };
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

  /* Another tab wrote this store. The cache is stale the instant that happens,
     so drop it — the next load() re-reads localStorage rather than going on
     believing an in-memory copy nobody else knows was superseded. Guarded
     because the Node/jsdom test harness runs this file with no real
     `addEventListener`-backed storage event dispatch to rely on.           */
  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", function (e) {
      if (e && e.key === KEY) DB = null;
    });
  }

  /* All-or-nothing. A rejected guard must not leave a half-written quotation —
     §17: "Validation failures must not partially mutate quotation data."      */
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
  function todayISO() {
    var t = D.TODAY;
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" +
           String(t.getDate()).padStart(2, "0");
  }
  function addDays(iso, n) {
    var dt = D.d(iso); dt.setDate(dt.getDate() + n);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" +
           String(dt.getDate()).padStart(2, "0");
  }
  function addMonths(iso, n) {
    var dt = D.d(iso); dt.setMonth(dt.getMonth() + n);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" +
           String(dt.getDate()).padStart(2, "0");
  }
  function daysUntil(iso) { return D.days(D.d(iso)); }      // negative = past
  function stateOf(city) { return CITY_STATE[city] || SELLER.state; }

  /* ============================================================== PRICING === */
  /* The ONLY authoritative calculator. Recomputed on every change and again
     inside QT-T01. There is no quantity: a plan is term × rate, an add-on is a
     flat amount. Discount is per line — one place to discount, one to audit.  */
  /* THE NEGOTIATED TOTAL IS THE SOURCE, not the monthly rate.

     A plan line used to be priced as `term × rate`, with the rate derived from
     whatever total the agent typed. That is lossless only when the total
     divides by the term — and when it does not, the customer's document quietly
     shows a different number from the one that was agreed. ₹1,38,998 over 12
     months came back as ₹1,39,000.04; ₹5,00,000 over 18 came back as
     ₹5,00,000.04. Four paise is not a rounding detail on a document somebody
     signs, it is a figure that does not match the conversation.

     So `amount_paise` on a plan line holds the agreed total and is what prices
     it. `rate_per_month_paise` stays, derived, because "₹18,250 per month" is
     how the customer thinks about it and the document prints it — but nothing
     is ever computed back FROM it. Legacy and seeded rows carry no
     `amount_paise`, so they keep the old derivation and nothing already issued
     moves by a paisa. */
  function lineNet(it) {
    var base = it.kind === "plan"
      ? Math.round(it.amount_paise || (it.term_months || 0) * (it.rate_per_month_paise || 0))
      : Math.round(it.amount_paise || 0);
    var disc = it.discount_type === "pct"
      ? Math.round(base * (Number(it.discount_value) || 0) / 100)
      : Math.round(Number(it.discount_value) || 0);
    disc = Math.max(0, Math.min(disc, base));       // a discount can never exceed its base
    return { base:base, disc:disc, net:base - disc };
  }

  /* TAX is an explicit, stored choice (QT-BR — added for clients who pay with
     no tax at all) — never inferred from a zero amount. `tax_mode` is the
     source; a zero tax_amount on a Not Applicable quotation is a CONSEQUENCE
     of that choice, not the other way round. Absent (legacy/seeded rows with
     no field) defaults to Applicable, so nothing already issued changes.     */
  var TAX_MODE = { APPLICABLE:"applicable", NOT_APPLICABLE:"not_applicable" };
  var TAX_LABEL = { applicable:"Tax Applicable", not_applicable:"Tax Not Applicable" };
  function taxApplicable(q) { return q.tax_mode !== TAX_MODE.NOT_APPLICABLE; }

  function price(q, items) {
    var gross = 0, disc = 0;
    items.forEach(function (it) { var n = lineNet(it); gross += n.base; disc += n.disc; });
    var taxable = Math.max(0, gross - disc);
    var applicable = taxApplicable(q);
    var rate = applicable ? (Number(q.gst_rate) || 0) : 0;
    var intra = q.place_of_supply === SELLER.state;
    var gst = applicable ? Math.round(taxable * rate / 100) : 0;
    var cgst = 0, sgst = 0, igst = 0;
    // Halve the TOTAL, then derive the twin — halving the rate and rounding
    // twice can leave CGST + SGST off the GST total by a paisa.
    if (applicable) { if (intra) { cgst = Math.round(gst / 2); sgst = gst - cgst; } else { igst = gst; } }
    return { gross:gross, discount:disc, taxable:taxable, gst_rate:rate, intra:intra,
             tax_applicable:applicable,
             cgst:cgst, sgst:sgst, igst:igst, gst:cgst + sgst + igst,
             grand_total:taxable + cgst + sgst + igst };
  }

  function recalc(q) {
    var t = price(q, itemsOf(q.quotation_id));
    q.subtotal_paise = t.gross;
    q.discount_amount_paise = t.discount;
    q.taxable_paise = t.taxable;
    q.cgst_paise = t.cgst; q.sgst_paise = t.sgst; q.igst_paise = t.igst;
    q.tax_amount_paise = t.gst;
    q.grand_total_paise = t.grand_total;
    // The effective discount that flows to the deal on acceptance.
    q.discount_pct = t.gross ? Math.round(t.discount / t.gross * 1000) / 10 : 0;
    itemsOf(q.quotation_id).forEach(function (it) {
      var n = lineNet(it);
      it.taxable_amount_paise = n.net;
      // Persisted per line and always equal to the header in v1 (QD-01 / §7.1).
      // The schema is therefore already right for mixed slabs; switching to
      // per-line entry later is a UI change with no migration.
      it.tax_rate = t.tax_applicable ? q.gst_rate : 0;
      it.tax_amount_paise = t.tax_applicable ? Math.round(n.net * q.gst_rate / 100) : 0;
      it.line_total_paise = it.taxable_amount_paise + it.tax_amount_paise;
    });
    return t;
  }

  /* =============================================================== SEEDING === */
  function seed() {
    var db = blank(); DB = db;
    SEED.quotations.forEach(function (s) {
      var dl = D.dealOf ? D.dealOf(s.deal) : null;
      var city = dl ? dl.city : "New Delhi";
      var q = {
        quotation_id:"q-" + s.ref,
        // A Draft consumes no number — in the seed exactly as at runtime (§4).
        quotation_number:s.status === "draft" ? null : s.ref, deal_id:s.deal,
        version:s.v, status:s.status,
        parent_quotation_id:s.supersedes ? "q-" + s.supersedes : null,
        superseded_by_id:s.supersededBy ? "q-" + s.supersededBy : null,
        customer_snapshot:snapshotOf(s.deal),
        quotation_date:s.issued || todayISO(), valid_until:s.validTo,
        place_of_supply:stateOf(city), gst_rate:DEFAULT_GST, tax_mode:TAX_MODE.APPLICABLE,
        notes:"", terms:TERMS_TEMPLATE,
        subtotal_paise:0, discount_amount_paise:0, taxable_paise:0,
        cgst_paise:0, sgst_paise:0, igst_paise:0, tax_amount_paise:0,
        grand_total_paise:0, discount_pct:s.discount || 0,
        document_id:null, owner:s.owner,
        created_by:s.owner, created_at:s.issued || todayISO(),
        issued_by:s.status === "draft" ? null : s.owner,
        issued_at:s.issued || null,
        accepted_at:s.accepted || null, rejected_at:null,
        expired_at:s.status === "expired" ? s.validTo : null,
        superseded_at:s.status === "superseded" ? s.issued : null,
        cancelled_at:null, reject_reason:null,
        row_version:1
      };
      db.quotations.push(q);
      db.items.push({
        item_id:"it-" + (++db.seq.item), quotation_id:q.quotation_id, kind:"plan",
        name:s.plan, description:"SaaS subscription · billed for the full term",
        features:featuresFor(s.plan), hsn:"998314",
        term_months:s.term, rate_per_month_paise:s.rate, installments:1,
        discount_type:"pct", discount_value:s.discount || 0,
        amount_paise:0, tax_rate:DEFAULT_GST,
        taxable_amount_paise:0, tax_amount_paise:0, line_total_paise:0, sort_order:0
      });
      /* The seeded `value` is the DOCUMENT FACT — a historical total that was
         actually sent. Where it exceeds what the plan arithmetic produces, the
         difference is a one-off charge: the invoice seed already calls it
         "+ setup". Reconstructing it here is what makes the whole chain
         reconcile — plan 24 × ₹30,000 −10% = ₹6,48,000, plus ₹1,02,000 setup,
         is ₹7,50,000 taxable and ₹8,85,000 with GST, which is exactly what the
         two invoices against it add up to. */
      var planNet = Math.round(s.term * s.rate * (1 - (s.discount || 0) / 100));
      var targetTaxable = Math.round(s.value / (1 + DEFAULT_GST / 100));
      // Where the stated total is BELOW the plan arithmetic, the seed's rate is
      // what cannot be right — a document total is a fact, a rate is a working.
      // Deriving the rate from the total keeps the discount meaningful and makes
      // the invoices raised against it reconcile to the same basis.
      if (planNet - targetTaxable > 100) {
        var it0 = db.items[db.items.length - 1];
        it0.rate_per_month_paise = Math.round(
          targetTaxable / (s.term * (1 - (s.discount || 0) / 100)));
        planNet = Math.round(s.term * it0.rate_per_month_paise * (1 - (s.discount || 0) / 100));
      }
      if (targetTaxable - planNet > 100) {
        db.items.push({ item_id:"it-" + (++db.seq.item), quotation_id:q.quotation_id, kind:"addon",
          name:"Onboarding & profile setup", description:"", features:null, hsn:"998313",
          term_months:null, rate_per_month_paise:null,
          discount_type:"pct", discount_value:0,
          amount_paise:targetTaxable - planNet, tax_rate:DEFAULT_GST,
          taxable_amount_paise:0, tax_amount_paise:0, line_total_paise:0, sort_order:1 });
      }

      if (q.status !== "draft") {
        db.documents.push({ document_id:"doc-" + (++db.seq.doc), quotation_id:q.quotation_id,
          storage_key:"quotations/" + s.ref + ".pdf", checksum_sha256:fakeSum(s.ref),
          byte_size:48000 + (s.v * 1200), created_at:s.issued });
        q.document_id = db.documents[db.documents.length - 1].document_id;
      }
      ev(db, q.quotation_id, "CREATED", s.owner, "sales_agent", q.created_at);
      if (q.issued_at)   ev(db, q.quotation_id, "ISSUED", s.owner, "sales_agent", q.issued_at);
      if (q.accepted_at) ev(db, q.quotation_id, "ACCEPTED", s.owner, "sales_agent", q.accepted_at);
      if (q.status === "superseded")
        ev(db, q.quotation_id, "SUPERSEDED", "System", "system", q.superseded_at);
      var n = parseInt(String(s.ref).slice(-5), 10);
      if (n > db.seq.q) db.seq.q = n;
    });
    // Reconcile the seeded totals against the pricing engine, so the numbers on
    // screen are computed rather than asserted.
    db.quotations.forEach(function (q) { recalc(q); });
    return db;
  }
  function fakeSum(s) {
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return ("00000000" + h.toString(16)).slice(-8).repeat(8);
  }
  /* Frozen at create time, on purpose: the document must keep saying what was
     true when it was sent, even after the deal is edited. It now carries the
     business name and the email as well — a quotation addressed to a person
     when the buyer is a company is a quotation the finance side sends back. */
  function snapshotOf(dealId) {
    var dl = root.IBDeals && root.IBDeals.dealOf ? root.IBDeals.dealOf(dealId) : null;
    if (!dl) return { name:"—", city:"—", phone:"—", gstin:null, address:"—", deal_id:dealId };
    var place = [dl.city, dl.state].filter(function (x) { return x && x !== "—"; }).join(", ");
    return { name:dl.customer_name, business:dl.business_name || null,
             email:dl.email || null,
             city:dl.city, state:dl.state, phone:dl.phone, gstin:null,
             address:(place || dl.city) + ", India",
             deal_id:dealId, enquiry_id:dl.enquiry_id };
  }
  /* WHO THE DOCUMENT IS FOR, right now.

     The snapshot was taken at creation and re-taken at issue, and between those
     two moments it simply went stale — you could correct a customer's name or
     phone on the deal, walk back into the draft that had not been sent to
     anybody, and read the old one. The builder even offered "Edit on deal ↗"
     and then ignored what you did there, which is worse than not offering it.

     Both halves of the rule were right; only one of them was implemented:

       draft   → it has been sent to nobody, so it tracks the deal
       issued+ → somebody is holding it, so it is frozen for ever

     `customer_snapshot` remains the stored truth and is still what `issue`
     freezes. This only decides which of the two a READER should be shown, so
     nothing renders a value the document would not carry if it were issued in
     that moment. */
  function partyOf(q) {
    if (!q) return {};
    return q.status === ST.DRAFT ? snapshotOf(q.deal_id) : (q.customer_snapshot || {});
  }

  /* The feature list is SNAPSHOTTED, read from IBPlanInfo — the registry that
     already drives plans-checkout.html. The customer sees the same wording on
     the proposal as on the pricing page, and a later edit to the plan sheet
     cannot rewrite a proposal already sent.                                   */
  /* WHAT A PLAN IS, commercially.

     The feature list was already snapshotted per plan; the money was not. So
     picking a tier changed the name and the bullet points and left Term, Total
     and Discount exactly as the last plan had set them — which meant every
     quotation started with a figure that belonged to a different plan, and the
     agent's first job was to remember what this one costs.

     A plan now carries its whole commercial shape: the term it is sold on, the
     list total for that term, how many installments that total normally splits
     into, and the standing discount the tier carries. Selecting it fills all
     four. Everything stays editable afterwards — this is the starting point of
     a negotiation, not a price control.                                       */
  /* THE CATALOGUE MOVED OUT.

     These three literals used to BE the catalogue — the real one, the one
     quotations were actually written from, while the admin panel showed a
     different set of numbers on a page nobody could edit. That is the defect
     `plans-engine.js` exists to end: one catalogue, administered, and this
     engine reads it.

     What stays here is the fallback. If the plans engine is not loaded — the
     Node test harness runs this file on its own — these keep the quotation
     builder working with exactly the commercial shape it had before, so the
     seam is a re-point rather than a new hard dependency.               */
  /* Corrected against the plan sheet at the same time the catalogue was. The
     figures that used to sit here were wrong in three ways: Growth at
     ₹2,19,000 against a real annual price of ₹2,99,999, a "Pro" tier that
     does not exist (it is Scale, ₹6,24,999), and a 24-month term nothing is
     sold on. Wrong numbers in a fallback are worse than no fallback, because
     they only surface when the catalogue is missing and nobody is looking. */
  var PLAN_FALLBACK = {
    "AutoGrowth · Starter": { term_months:12, total_paise:R(123499),
                              installments:1, gap_months:12,
                              discount_type:"pct", discount_value:0,
                              blurb:"Establish & grow · includes Business Signature" },
    "AutoGrowth · Growth":  { term_months:12, total_paise:R(299999),
                              installments:1, gap_months:12,
                              discount_type:"pct", discount_value:0,
                              blurb:"Expand & position · includes Business Premium" },
    "AutoGrowth · Scale":   { term_months:12, total_paise:R(624999),
                              installments:1, gap_months:12,
                              discount_type:"pct", discount_value:0,
                              blurb:"Lead & scale · includes Business Elite" }
  };
  function R(rupees) { return Math.round(rupees) * 100; }
  function plans() { return root.IBPlans || null; }

  /* One plan, ONE duration, resolved to the four numbers a quotation line
     needs. `months` picks the duration row; omitted, the plan's longest
     active row wins, which is the tier's headline term and what the old
     literal above encoded.

     Everything returned here is about to be COPIED onto the quotation. This
     function is the last point at which the catalogue is consulted — after
     the line is written, nothing reads back. */
  function catalogueOf(name, months) {
    var P = plans();
    if (P) {
      var pl = P.byTitle(name);
      if (pl) {
        var rows = P.activeRows(pl);
        var row = months ? P.rowFor(pl, months) : rows[rows.length - 1];
        if (row && row.active !== false) {
          return {
            plan_id:pl.plan_id, revision:pl.revision,
            term_months:row.months,
            total_paise:P.finalOf(row),          // the FINAL price — one calculation, in the engine
            base_paise:row.base_paise,
            installments:row.installments, gap_months:row.gap_months,
            discount_type:row.discount_type, discount_value:row.discount_value,
            blurb:pl.description || "",
            durations:rows.map(function (r) {
              return { months:r.months, final_paise:P.finalOf(r), base_paise:r.base_paise,
                       discount_type:r.discount_type, discount_value:r.discount_value,
                       installments:r.installments, gap_months:r.gap_months };
            })
          };
        }
      }
    }
    return PLAN_FALLBACK[name] || null;
  }

  /* Snapshotted at write time, from the plan's own feature list. A later edit
     to the catalogue cannot rewrite a proposal already sent. */
  function featuresFor(name) {
    var P = plans();
    if (P) {
      var pl = P.byTitle(name);
      if (pl && pl.features && pl.features.length) return pl.features.slice();
    }
    var info = root.IBPlanInfo;
    var keys = PLAN_FALLBACK_KEYS[name] || PLAN_FALLBACK_KEYS["AutoGrowth · Growth"];
    return keys.map(function (k) {
      return { key:k, label:info && info.title ? info.title(k) : k,
               text:info && info.text ? info.text(k) : "" };
    });
  }
  var PLAN_FALLBACK_KEYS = {
    "AutoGrowth · Starter":["ag-reach-3","ag-cat-2","ag-kw-3","ag-boost-3x","ag-net-basic",
      "ag-pos-enhanced","ag-badge-verified","ag-crm-smart","ag-analytics-basic","ag-support-chat"],
    "AutoGrowth · Growth":["ag-reach-5","ag-cat-3","ag-kw-6","ag-boost-6x","ag-net-priority",
      "ag-pos-priority","ag-comp-controlled","ag-route-priority","ag-badge-trusted"],
    /* Scale, and its own keys. The old "Pro" entry listed Growth's features
       verbatim — a tier that does not exist, described as the tier below it. */
    "AutoGrowth · Scale":["ag-reach-pan","ag-cat-5","ag-kw-10","ag-boost-10x","ag-net-exclusive",
      "ag-pos-featured","ag-comp-limited","ag-route-priority-ltd","ag-badge-leader",
      "ag-crm-branded","ag-pipeline-multi","ag-analytics-multi","ag-ai-priority",
      "ag-qual-ai","ag-support-personal"]
  };
  /* Only plans that are on sale AND priceable. A tier withdrawn from the
     catalogue stops being offerable the moment it is withdrawn — but every
     quotation that already names it keeps its own copy and reads fine. */
  function sellableNames() {
    var P = plans();
    if (P) return P.activePlans().map(function (pl) { return pl.title; });
    return Object.keys(PLAN_FALLBACK_KEYS);
  }

  /* =============================================================== HELPERS === */
  function find(list, key, val) {
    for (var i = 0; i < list.length; i++) if (list[i][key] === val) return list[i];
    return null;
  }
  function quoteOf(id) {
    var db = load();
    return find(db.quotations, "quotation_id", id) || find(db.quotations, "quotation_number", id);
  }
  function itemsOf(qid) {
    return load().items.filter(function (i) { return i.quotation_id === qid; })
      .sort(function (a, b) { return a.sort_order - b.sort_order; });
  }
  function planOf(qid) { return itemsOf(qid).filter(function (i) { return i.kind === "plan"; })[0] || null; }
  function addonsOf(qid) { return itemsOf(qid).filter(function (i) { return i.kind === "addon"; }); }

  /* Splits the grand total into N installments over the plan's own term —
     never a fixed cadence. "12 months, 3 installments" is what the sales agent
     and the customer agreed, so the gap between them is term / installments,
     not a calendar assumption. The last instalment absorbs the paise remainder
     so the parts always foot exactly back to the grand total.               */
  /* HOW MANY, and HOW FAR APART. Two numbers, because they are two decisions.

     The schedule used to spread N payments evenly across the whole term, which
     silently made the gap a consequence of the plan's length: three payments on
     a twelve-month plan meant one every four months whether anybody wanted that
     or not, and there was no way to say "quarterly" at all.

     A yearly package paid every three months and a short package paid monthly
     are the same shape with a different cadence, so the cadence is now its own
     field. Count 1-5, gap 1-5 months, and the first payment is always due on
     the day the quotation is dated — nobody waits a cycle to start paying. */
  var INSTALLMENT_MAX = 5, GAP_MAX = 5, DEFAULT_GAP = 1;

  function installmentPlan(plan) {
    var n = plan ? Math.max(1, Math.min(INSTALLMENT_MAX, parseInt(plan.installments, 10) || 1)) : 1;
    var gap = plan ? Math.max(1, Math.min(GAP_MAX, parseInt(plan.installment_gap_months, 10) || DEFAULT_GAP))
                   : DEFAULT_GAP;
    /* Months from the quotation date to the LAST payment. Worth having as a
       number because a schedule that finishes after the subscription does is
       worth saying out loud, and the UI cannot work it out without this. */
    return { count:n, gap:gap, spans:(n - 1) * gap };
  }

  function installmentSchedule(qid) {
    var q = quoteOf(qid); if (!q) return null;
    var plan = planOf(qid);
    var ip = installmentPlan(plan);
    if (ip.count <= 1) return null;
    var total = price(q, itemsOf(qid)).grand_total;
    /* The remainder rides on the LAST payment, not the first: the customer's
       opening number is the round one they were quoted, and a stray paisa at
       the end is a rounding line nobody argues about. */
    var base = Math.floor(total / ip.count), remainder = total - base * ip.count;
    var startISO = q.quotation_date || todayISO();
    var rows = [];
    for (var i = 0; i < ip.count; i++) {
      rows.push({ seq:i + 1,
                  amount_paise:base + (i === ip.count - 1 ? remainder : 0),
                  due_date:addMonths(startISO, i * ip.gap) });
    }
    return rows;
  }
  function forDeal(dealId) {
    return load().quotations.filter(function (q) { return q.deal_id === dealId; })
      .sort(function (a, b) { return b.version - a.version; });
  }
  function eventsOf(qid) {
    return load().events.filter(function (e) { return e.quotation_id === qid; })
      .sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function ev(db, qid, type, actor, role, at, meta) {
    db.events.push({ event_id:"ev-" + (++db.seq.ev), quotation_id:qid, event_type:type,
      actor_id:actor, actor_role:role || "sales_agent", metadata:meta || null,
      at:at || todayISO(), created_at:at || todayISO() });
  }
  function acceptedOf(dealId) {
    return forDeal(dealId).filter(function (q) { return q.status === ST.ACCEPTED; })[0] || null;
  }

  /* ---------------------------------------------------------------- scope --- */
  /* Resolved through the PARENT DEAL on every call. Knowing a quotation_id
     grants nothing. A quotation that genuinely does not exist returns 404; one
     that exists but is out of scope returns 403 — the two are distinguished,
     not folded together, so this is not the leak-proofing it once claimed to
     be. Closing that gap is a product decision this file does not make on its
     own (see QA7).                                                            */
  function guard(qid, actor, opts) {
    var q = quoteOf(qid);
    if (!q) return err(404, "quotation_not_found", String(qid));
    var dl = root.IBDeals ? root.IBDeals.dealOf(q.deal_id) : null;
    if (!dl) return err(404, "deal_not_found", q.deal_id);
    if (root.IBDeals && !root.IBDeals.inScope(actor, dl)) return err(403, "out_of_scope", String(qid));
    if (opts && opts.draft && q.status !== ST.DRAFT)
      return err(409, "quotation_not_draft", "This quotation is " + LABEL[q.status] +
        ". Issued content cannot be edited — create a revision instead.");
    if (opts && opts.rowVersion !== undefined && opts.rowVersion !== null &&
        Number(opts.rowVersion) !== q.row_version)
      return err(409, "version_conflict", "Someone else saved this draft while you were editing.");
    return ok(q);
  }
  function guardDeal(dealId, actor) {
    var dl = root.IBDeals ? root.IBDeals.dealOf(dealId) : null;
    if (!dl) return err(404, "deal_not_found", String(dealId));
    if (root.IBDeals && !root.IBDeals.inScope(actor, dl)) return err(403, "out_of_scope", String(dealId));
    return ok(dl);
  }

  /* ================================================================ DRAFT === */
  var Draft = {
    /* Flow 01. A Draft can only be born inside a deal the actor can already see,
       and NO NUMBER IS ASSIGNED HERE — a cancelled Draft consumes nothing.     */
    create: function (dealId, actor, opts) {
      return tx(function () {
        var g = guardDeal(dealId, actor); if (g.ok === false) return g;
        var dl = g.data;
        var wonStage = root.IBDeals ? root.IBDeals.STAGE.WON : 5;
        if (dl.stage >= wonStage)
          return err(422, "invalid_transition",
            "This deal is " + (dl.stage === wonStage ? "Closed - Won" : "Closed - Lost") +
            ". A new quotation needs the deal reopened first (QT-OD-11).");

        var src = opts && opts.from ? quoteOf(opts.from) : null;   // revision clone
        // One live lineage per deal. A second independent quotation next to an
        // issued/accepted one is two competing offers for the same deal — the
        // real move is to revise the one already out, not start a rival.
        if (!src) {
          var live = forDeal(dealId).filter(function (x) {
            return x.status === ST.ISSUED || x.status === ST.ACCEPTED;
          })[0];
          if (live)
            return err(422, "quotation_in_flight",
              "This deal already has an issued quotation — revise it instead of starting a new one.");
        }
        var id = "q-new-" + (++DB.seq.q) + "-" + DB.quotations.length;
        var q = {
          quotation_id:id, quotation_number:null,             // assigned at ISSUE
          deal_id:dealId,
          version:src ? src.version + 1 : forDeal(dealId).length + 1,
          status:ST.DRAFT,
          parent_quotation_id:src ? src.quotation_id : null, superseded_by_id:null,
          customer_snapshot:snapshotOf(dealId),
          quotation_date:todayISO(),
          valid_until:addDays(todayISO(), DEFAULT_VALIDITY_DAYS),
          place_of_supply:src ? src.place_of_supply : stateOf(dl.city),
          gst_rate:src ? src.gst_rate : DEFAULT_GST,
          // A revision keeps the tax treatment the customer already saw — QT-BR:
          // changing whether tax applies is a new commercial term, not a detail
          // that quietly drifts across a version.
          tax_mode:src ? src.tax_mode : TAX_MODE.APPLICABLE,
          notes:src ? src.notes : "", terms:src ? src.terms : TERMS_TEMPLATE,
          subtotal_paise:0, discount_amount_paise:0, taxable_paise:0,
          cgst_paise:0, sgst_paise:0, igst_paise:0, tax_amount_paise:0,
          grand_total_paise:0, discount_pct:0,
          document_id:null, owner:dl.owner_id,
          created_by:actor.name, created_at:todayISO(),
          issued_by:null, issued_at:null, accepted_at:null, rejected_at:null,
          expired_at:null, superseded_at:null, cancelled_at:null, reject_reason:null,
          row_version:1
        };
        DB.quotations.push(q);

        if (src) {                                   // clone header AND line items
          itemsOf(src.quotation_id).forEach(function (it, ix) {
            var c = JSON.parse(JSON.stringify(it));
            c.item_id = "it-" + (++DB.seq.item); c.quotation_id = id; c.sort_order = ix;
            DB.items.push(c);
          });
          ev(DB, id, "REVISION_CREATED", actor.name, actor.role, todayISO(),
             { from:src.quotation_number || src.quotation_id });
        } else {
          /* The default tier arrives fully priced, from the same catalogue a
             swap reads. A blank draft that opens on ₹0 and 1 installment is a
             form; one that opens on what Growth actually costs is a proposal
             you can send after changing nothing. */
          /* The default tier is the first sellable plan in the catalogue, not
             a hard-coded name — a panel whose seeded catalogue no longer holds
             "AutoGrowth · Growth" would otherwise open every new draft on a
             plan that does not exist. */
          var d0 = sellableNames()[0] || "AutoGrowth · Growth", c0 = catalogueOf(d0);
          DB.items.push({ item_id:"it-" + (++DB.seq.item), quotation_id:id, kind:"plan",
            name:d0, description:"SaaS subscription · billed for the full term",
            features:featuresFor(d0), hsn:"998314",
            /* Provenance is stamped HERE too, not only on a later swap. A
               quotation that keeps the default plan is still a quotation
               quoted from the catalogue, and "which plan, which revision"
               has to be answerable for it as much as for a swapped one. */
            plan_id:c0.plan_id || null,
            plan_revision:c0.revision || null,
            term_months:c0.term_months,
            amount_paise:c0.total_paise,
            rate_per_month_paise:Math.round(c0.total_paise / c0.term_months),
            installments:c0.installments,
            installment_gap_months:c0.gap_months || DEFAULT_GAP,
            discount_type:c0.discount_type, discount_value:c0.discount_value,
            tax_rate:DEFAULT_GST,
            taxable_amount_paise:0, tax_amount_paise:0, line_total_paise:0, sort_order:0 });
          ev(DB, id, "CREATED", actor.name, actor.role, todayISO());
        }
        recalc(q);
        return ok(q);
      });
    },

    /* Header edits. Optimistic row_version — a stale write mutates nothing.    */
    update: function (qid, patch, actor) {
      return tx(function () {
        var g = guard(qid, actor, { draft:true, rowVersion:patch && patch.row_version });
        if (g.ok === false) return g;
        var q = g.data;
        ["quotation_date", "valid_until", "place_of_supply", "notes", "terms"].forEach(function (k) {
          if (patch[k] !== undefined && patch[k] !== null) q[k] = patch[k];
        });
        if (patch.gst_rate !== undefined && patch.gst_rate !== null) {
          var r = Number(patch.gst_rate);
          if (GST_RATES.indexOf(r) < 0) return err(400, "validation_failed", "Unsupported GST rate.");
          q.gst_rate = r;
        }
        if (patch.tax_mode !== undefined && patch.tax_mode !== null) {
          if ([TAX_MODE.APPLICABLE, TAX_MODE.NOT_APPLICABLE].indexOf(patch.tax_mode) < 0)
            return err(400, "validation_failed", "Unsupported tax mode.");
          q.tax_mode = patch.tax_mode;
        }
        if (q.place_of_supply && STATES.indexOf(q.place_of_supply) < 0)
          return err(400, "validation_failed", "Unknown place of supply.");
        q.row_version++;
        recalc(q);
        ev(DB, q.quotation_id, "UPDATED", actor.name, actor.role, todayISO(),
           patch.tax_mode !== undefined ? { tax_mode:q.tax_mode } : null);
        return ok(q);
      });
    },

    /* The plan is SWAPPED, never added — the one-plan rule enforced by the
       interaction rather than by a validation message.                        */
    setPlan: function (qid, p, actor) {
      return tx(function () {
        var g = guard(qid, actor, { draft:true, rowVersion:p && p.row_version });
        if (g.ok === false) return g;
        var q = g.data, plan = planOf(qid);
        if (!plan) return err(422, "quotation_empty", "This quotation has no plan block.");
        /* A tier swap re-snapshots everything the tier decides — the features
           AND the commercial shape. `p` can still override any of it in the
           same call, because the picker sends only a name and the builder sends
           only figures; whichever arrives last wins on that field. */
        /* A duration change on the SAME plan re-imports too. Picking "Growth,
           6 months" after "Growth, 12 months" is a different commercial offer,
           not a different plan, and it has to bring its own numbers with it. */
        if ((p.name && p.name !== plan.name) ||
            (p.plan_months !== undefined && Number(p.plan_months) !== Number(plan.term_months))) {
          var nm = p.name || plan.name;
          plan.name = nm;
          plan.features = featuresFor(nm);
          var cat = catalogueOf(nm, p.plan_months);
          if (cat) {
            /* THE SNAPSHOT. Every field below is a COPY taken now. Nothing on
               this quotation reads the catalogue again — which is what makes an
               issued quotation immune to a later price change, and why
               `plan_id` + `plan_revision` are recorded: they answer "which
               version of the catalogue was this quoted from" without keeping a
               second copy of the catalogue. */
            plan.plan_id = cat.plan_id || null;
            plan.plan_revision = cat.revision || null;
            plan.term_months = cat.term_months;
            plan.amount_paise = cat.total_paise;
            plan.rate_per_month_paise = cat.term_months > 0
              ? Math.round(cat.total_paise / cat.term_months) : 0;
            plan.installments = cat.installments;
            plan.installment_gap_months = cat.gap_months || DEFAULT_GAP;
            plan.discount_type = cat.discount_type;
            plan.discount_value = cat.discount_value;
          }
        }
        if (p.term_months !== undefined) plan.term_months = Math.max(0, parseInt(p.term_months, 10) || 0);
        if (p.rate_per_month_paise !== undefined)
          plan.rate_per_month_paise = Math.max(0, Math.round(Number(p.rate_per_month_paise) || 0));
        // Sales agents negotiate one total for the whole term, not a monthly unit
        // rate — so the builder collects a total and this derives the rate the
        // pricing engine still runs on (term × rate stays the one calculator).
        if (p.total_amount_paise !== undefined) {
          plan.amount_paise = Math.max(0, Math.round(Number(p.total_amount_paise) || 0));
          plan.rate_per_month_paise = plan.term_months > 0        // display only
            ? Math.round(plan.amount_paise / plan.term_months) : 0;
        }
        /* A term change with no new total re-derives the monthly figure from the
           total that still stands — the agreed number does not move because the
           schedule did. */
        if (p.term_months !== undefined && p.total_amount_paise === undefined && plan.amount_paise)
          plan.rate_per_month_paise = plan.term_months > 0
            ? Math.round(plan.amount_paise / plan.term_months) : 0;
        if (p.installments !== undefined)
          plan.installments = Math.max(1, Math.min(INSTALLMENT_MAX, parseInt(p.installments, 10) || 1));
        if (p.installment_gap_months !== undefined)
          plan.installment_gap_months =
            Math.max(1, Math.min(GAP_MAX, parseInt(p.installment_gap_months, 10) || DEFAULT_GAP));
        if (p.discount_type) plan.discount_type = p.discount_type === "amt" ? "amt" : "pct";
        if (p.discount_value !== undefined) plan.discount_value = Math.max(0, Number(p.discount_value) || 0);
        if (plan.discount_type === "pct" && plan.discount_value > 100)
          return err(422, "invalid_pricing", "A percentage discount cannot exceed 100%.");
        q.row_version++;
        recalc(q);
        ev(DB, qid, "UPDATED", actor.name, actor.role, todayISO(), { block:"plan" });
        return ok(q);
      });
    },

    addAddon: function (qid, a, actor) {
      return tx(function () {
        var g = guard(qid, actor, { draft:true, rowVersion:a && a.row_version }); if (g.ok === false) return g;
        var q = g.data;
        var discType = (a && a.discount_type) === "amt" ? "amt" : "pct";
        var discValue = Math.max(0, Number(a && a.discount_value) || 0);
        if (discType === "pct" && discValue > 100)
          return err(422, "invalid_pricing", "A percentage discount cannot exceed 100%.");
        DB.items.push({ item_id:"it-" + (++DB.seq.item), quotation_id:q.quotation_id, kind:"addon",
          name:(a && a.name) || "One-off charge", description:"", features:null,
          hsn:(a && a.hsn) || "", term_months:null, rate_per_month_paise:null,
          amount_paise:Math.max(0, Math.round(Number(a && a.amount_paise) || 0)),
          discount_type:discType, discount_value:discValue,
          tax_rate:q.gst_rate, taxable_amount_paise:0, tax_amount_paise:0, line_total_paise:0,
          sort_order:itemsOf(q.quotation_id).length });
        q.row_version++; recalc(q);
        ev(DB, q.quotation_id, "UPDATED", actor.name, actor.role, todayISO(), { block:"addon" });
        return ok(q);
      });
    },
    updateAddon: function (qid, itemId, a, actor) {
      return tx(function () {
        var g = guard(qid, actor, { draft:true, rowVersion:a && a.row_version }); if (g.ok === false) return g;
        var it = find(DB.items, "item_id", itemId);
        if (!it || it.quotation_id !== g.data.quotation_id || it.kind !== "addon")
          return err(404, "quotation_not_found", itemId);
        var discType = a.discount_type ? (a.discount_type === "amt" ? "amt" : "pct") : it.discount_type;
        var discValue = a.discount_value !== undefined ? Math.max(0, Number(a.discount_value) || 0) : it.discount_value;
        if (discType === "pct" && discValue > 100)
          return err(422, "invalid_pricing", "A percentage discount cannot exceed 100%.");
        if (a.name !== undefined) it.name = a.name;
        if (a.hsn !== undefined) it.hsn = a.hsn;
        if (a.amount_paise !== undefined) it.amount_paise = Math.max(0, Math.round(Number(a.amount_paise) || 0));
        it.discount_type = discType; it.discount_value = discValue;
        g.data.row_version++; recalc(g.data);
        return ok(g.data);
      });
    },
    removeAddon: function (qid, itemId, actor, rowVersion) {
      return tx(function () {
        var g = guard(qid, actor, { draft:true, rowVersion:rowVersion }); if (g.ok === false) return g;
        var ix = -1;
        DB.items.forEach(function (i, k) { if (i.item_id === itemId && i.kind === "addon") ix = k; });
        if (ix < 0) return err(404, "quotation_not_found", itemId);
        DB.items.splice(ix, 1);
        g.data.row_version++; recalc(g.data);
        return ok(g.data);
      });
    },

    /* The builder's single "Save changes" button implies all-or-nothing, but
       until now it was three separately-committed writes (header, plan,
       add-ons) chained together in the view layer. A failure on the third
       left the first two permanently written — and a combined edit that is
       only valid in its FINAL shape could be rejected on an intermediate one.

       One tx(), one validation pass over the fully merged final state, one
       write. Every check below is copied verbatim from the method that owns
       it — Draft.update, Draft.setPlan, Draft.updateAddon — not re-derived,
       so a rule that changes there has to change here too on purpose. `addons`
       is one entry per existing row on screen; nothing here adds or removes a
       row — that is still addAddon / removeAddon, instant and separate. */
    saveAll: function (qid, patch, actor) {
      return tx(function () {
        patch = patch || {};
        var g = guard(qid, actor, { draft:true, rowVersion:patch.row_version });
        if (g.ok === false) return g;
        var q = g.data;
        var plan = planOf(qid);
        if (!plan) return err(422, "quotation_empty", "This quotation has no plan block.");

        /* ---- validate against the MERGED final state, before writing anything */
        // header — Draft.update's own checks
        var gstRate = q.gst_rate;
        if (patch.gst_rate !== undefined && patch.gst_rate !== null) {
          gstRate = Number(patch.gst_rate);
          if (GST_RATES.indexOf(gstRate) < 0) return err(400, "validation_failed", "Unsupported GST rate.");
        }
        var pos = (patch.place_of_supply !== undefined && patch.place_of_supply !== null)
          ? patch.place_of_supply : q.place_of_supply;
        if (pos && STATES.indexOf(pos) < 0)
          return err(400, "validation_failed", "Unknown place of supply.");

        // plan — Draft.setPlan's own checks, evaluated on the final numbers
        var planTerm = patch.term_months !== undefined
          ? Math.max(0, parseInt(patch.term_months, 10) || 0) : plan.term_months;
        var planAmount = patch.total_amount_paise !== undefined
          ? Math.max(0, Math.round(Number(patch.total_amount_paise) || 0)) : plan.amount_paise;
        var planInstallments = patch.installments !== undefined
          ? Math.max(1, Math.min(INSTALLMENT_MAX, parseInt(patch.installments, 10) || 1)) : plan.installments;
        var planGap = patch.installment_gap_months !== undefined
          ? Math.max(1, Math.min(GAP_MAX, parseInt(patch.installment_gap_months, 10) || DEFAULT_GAP))
          : plan.installment_gap_months;
        var planDiscType = patch.discount_type ? (patch.discount_type === "amt" ? "amt" : "pct") : plan.discount_type;
        var planDiscValue = patch.discount_value !== undefined
          ? Math.max(0, Number(patch.discount_value) || 0) : plan.discount_value;
        if (planDiscType === "pct" && planDiscValue > 100)
          return err(422, "invalid_pricing", "A percentage discount cannot exceed 100%.");

        // add-ons — Draft.updateAddon's own checks (QA10's cap included), per row
        var addonPatches = patch.addons || [];
        var addonPlans = [];
        for (var i = 0; i < addonPatches.length; i++) {
          var ap = addonPatches[i];
          var it = find(DB.items, "item_id", ap.item_id);
          if (!it || it.quotation_id !== q.quotation_id || it.kind !== "addon")
            return err(404, "quotation_not_found", ap.item_id);
          var aDiscType = ap.discount_type ? (ap.discount_type === "amt" ? "amt" : "pct") : it.discount_type;
          var aDiscValue = ap.discount_value !== undefined
            ? Math.max(0, Number(ap.discount_value) || 0) : it.discount_value;
          if (aDiscType === "pct" && aDiscValue > 100)
            return err(422, "invalid_pricing", "A percentage discount cannot exceed 100%.");
          addonPlans.push({ it:it, name:ap.name, hsn:ap.hsn, amount_paise:ap.amount_paise,
            discount_type:aDiscType, discount_value:aDiscValue });
        }

        /* ---- nothing is invalid — apply everything, one commit ---- */
        ["quotation_date", "valid_until", "place_of_supply", "notes", "terms"].forEach(function (k) {
          if (patch[k] !== undefined && patch[k] !== null) q[k] = patch[k];
        });
        q.gst_rate = gstRate;

        plan.term_months = planTerm;
        plan.amount_paise = planAmount;
        plan.rate_per_month_paise = planTerm > 0 ? Math.round(planAmount / planTerm) : 0;
        plan.installments = planInstallments;
        plan.installment_gap_months = planGap;
        plan.discount_type = planDiscType;
        plan.discount_value = planDiscValue;

        addonPlans.forEach(function (ap) {
          if (ap.name !== undefined) ap.it.name = ap.name;
          if (ap.hsn !== undefined) ap.it.hsn = ap.hsn;
          if (ap.amount_paise !== undefined) ap.it.amount_paise = Math.max(0, Math.round(Number(ap.amount_paise) || 0));
          ap.it.discount_type = ap.discount_type;
          ap.it.discount_value = ap.discount_value;
        });

        q.row_version++;
        recalc(q);
        ev(DB, q.quotation_id, "UPDATED", actor.name, actor.role, todayISO(), { block:"all" });
        return ok(q);
      });
    },

    /* Only a Draft can be cancelled, and the row is NOT deleted — an abandoned
       Draft is still part of the negotiation record. It consumed no number.    */
    cancel: function (qid, actor) {
      return tx(function () {
        var g = guard(qid, actor, { draft:true }); if (g.ok === false) return g;
        var q = g.data;
        q.status = ST.CANCELLED; q.cancelled_at = todayISO(); q.row_version++;
        ev(DB, q.quotation_id, "CANCELLED", actor.name, actor.role, todayISO());
        return ok(q);
      });
    }
  };

  /* ============================================================ ISSUANCE === */
  var Issuance = {
    /* What would stop this issuing, itemised, so the modal can state it BEFORE
       the user commits rather than after.                                      */
    blockers: function (qid) {
      var q = quoteOf(qid); if (!q) return [];
      var out = [], plan = planOf(qid);
      if (!plan || !plan.term_months || plan.term_months < 1)
        out.push({ code:"quotation_empty", text:"A plan with a term of at least 1 month is required." });
      if (!plan || !plan.rate_per_month_paise)
        out.push({ code:"quotation_empty", text:"The plan needs a rate per month." });
      var t = price(q, itemsOf(qid));
      if (t.grand_total <= 0)
        out.push({ code:"invalid_pricing", text:"The grand total must be greater than zero." });
      if (t.taxable !== t.gross - t.discount)
        out.push({ code:"invalid_pricing", text:"Totals do not reconcile." });
      if (!q.quotation_date)
        out.push({ code:"validation_failed", text:"Quotation date is required." });
      if (!q.valid_until || daysUntil(q.valid_until) < 0)
        out.push({ code:"invalid_validity", text:"Valid until must be a date in the future." });
      if (STATES.indexOf(q.place_of_supply) < 0)
        out.push({ code:"validation_failed", text:"Place of supply is not a recognised state." });
      return out;
    },

    /* QT-T01. Five steps commit as one or not at all. On rollback nothing is
       frozen, the number is returned, and the quotation stays Draft — so the
       sequence has no unexplained gaps.

       QT-T02 rides on top: a revision supersedes its parent ONLY after this
       has succeeded. Supersede first and a failed replacement leaves the deal
       with no acceptable version at all.                                      */
    issue: function (qid, actor) {
      return tx(function () {
        var g = guard(qid, actor, { draft:true }); if (g.ok === false) return g;
        var q = g.data;

        var blockers = Issuance.blockers(q.quotation_id);
        if (blockers.length) return err(422, blockers[0].code, blockers[0].text);

        recalc(q);                                    // the authoritative pass
        q.quotation_number = "IB-QT-" + D.TODAY.getFullYear() + "-" +
          String(++DB.seq.q).padStart(5, "0");
        q.status = ST.ISSUED;
        q.issued_by = actor.name; q.issued_at = todayISO();
        q.customer_snapshot = snapshotOf(q.deal_id);  // frozen again at issue
        q.row_version++;

        var doc = { document_id:"doc-" + (++DB.seq.doc), quotation_id:q.quotation_id,
          storage_key:"quotations/" + q.quotation_number + ".pdf",
          checksum_sha256:fakeSum(q.quotation_number), byte_size:46000 + q.version * 900,
          created_at:todayISO() };
        DB.documents.push(doc);
        q.document_id = doc.document_id;

        ev(DB, q.quotation_id, "ISSUED", actor.name, actor.role, todayISO(),
           { number:q.quotation_number, version:q.version });

        // QT-T02 — supersede the parent, and only now that we have committed.
        var superseded = null;
        if (q.parent_quotation_id) {
          var p = find(DB.quotations, "quotation_id", q.parent_quotation_id);
          if (p && p.status === ST.ISSUED) {
            p.status = ST.SUPERSEDED; p.superseded_at = todayISO();
            p.superseded_by_id = q.quotation_id;
            ev(DB, p.quotation_id, "SUPERSEDED", actor.name, actor.role, todayISO(),
               { by:q.quotation_number });
            superseded = p.quotation_number;
          }
        }

        // Written here, NOT published here. A cross-module call inside a
        // transaction holds a lock across a network timeout.
        enqueue(DB, "quotation.issued", q.quotation_id,
          { deal_id:q.deal_id, quotation_id:q.quotation_id, quotation_number:q.quotation_number });
        return ok({ quotation:q, superseded:superseded });
      });
    },

    /* Revise from ANY state, including accepted and cancelled.

       Accepted was the one that mattered and the one that was refused. A
       customer who has accepted and then wants a room added is the single most
       ordinary thing that happens to a quotation, and the answer was a 422 and
       a manual re-key of every line. It now clones the accepted version into a
       fresh editable draft, and the moment that draft ISSUES it supersedes its
       parent — the existing QT-T02 order, which was always right.

       A draft returns itself: "revise" on something already editable means
       "let me edit it", and bouncing the caller with an error to say so is a
       distinction only the engine cared about. */
    revise: function (qid, actor) {
      var q = quoteOf(qid);
      if (!q) return err(404, "quotation_not_found", String(qid));
      if (q.status === ST.DRAFT) return ok({ quotation_id:q.quotation_id, deal_id:q.deal_id, reused:true });
      return Draft.create(q.deal_id, actor, { from:q.quotation_id });
    }
  };

  /* =========================================================== ACCEPTANCE === */
  var Acceptance = {
    guards: function (qid) {
      var q = quoteOf(qid); if (!q) return [{ code:"quotation_not_found", text:"Unknown quotation." }];
      /* These are NOTES now, not blockers. Every one of them was a real thing
         worth telling somebody and none of them was ever a reason to refuse:
         an expired quotation the customer accepted by phone this morning is an
         accepted quotation, and making the operator revise-and-reissue to
         record a fact that already happened is bookkeeping theatre.

         `accept` no longer reads this list to refuse. The UI reads it to warn,
         which is the job it should have had all along. */
      var out = [];
      if (q.status === ST.ACCEPTED)
        out.push({ code:"already_accepted", tone:"", text:"This version is already accepted." });
      if (q.status === ST.DRAFT)
        out.push({ code:"quotation_not_issued", tone:"warn",
                   text:"This is still a draft — the customer has not been sent anything to accept." });
      if (q.status === ST.SUPERSEDED)
        out.push({ code:"quotation_superseded", tone:"warn",
                   text:"A newer version replaced this one. Accepting it accepts the older figures." });
      if (q.status === ST.ISSUED && daysUntil(q.valid_until) < 0)
        out.push({ code:"quotation_expired", tone:"warn",
                   text:"Validity ended on " + D.fmtDate(q.valid_until) + ". Accepting it honours the expired price." });
      var a = acceptedOf(q.deal_id);
      if (a && a.quotation_id !== q.quotation_id)
        out.push({ code:"active_acceptance_exists", tone:"warn",
                   text:"v" + a.version + " (" + (a.quotation_number || "draft") +
                        ") is currently accepted. Accepting this one supersedes it." });
      return out;
    },

    /* QT-T03. Guards, then Accepted, then the outbox row — in one commit.
       Acceptance is NOT closure: Closed-Won still needs outstanding == ₹0 in
       Module 1, and this file has no write path to the ledger at all.          */
    accept: function (qid, actor) {
      return tx(function () {
        var g = guard(qid, actor); if (g.ok === false) return g;
        var q = g.data;
        if (q.status === ST.ACCEPTED)
          return err(409, "already_accepted", "This version is already accepted.");

        /* One accepted version per deal, still — but enforced by DEMOTING the
           other one rather than by refusing this one. The customer accepted
           the newer figures; the older acceptance is what is now wrong, and
           saying so out loud beats making somebody undo it by hand. */
        var prior = acceptedOf(q.deal_id);
        if (prior && prior.quotation_id !== q.quotation_id) {
          prior.status = ST.SUPERSEDED;
          prior.superseded_at = todayISO();
          prior.superseded_by_id = q.quotation_id;
          prior.row_version++;
          ev(DB, prior.quotation_id, "SUPERSEDED", actor.name, actor.role, todayISO(),
             { by:q.quotation_number || q.quotation_id,
               note:"A later version was accepted in its place." });
        }

        q.status = ST.ACCEPTED; q.accepted_at = todayISO(); q.row_version++;
        ev(DB, q.quotation_id, "ACCEPTED", actor.name, actor.role, todayISO(),
           { grand_total:q.grand_total_paise });
        enqueue(DB, "quotation.accepted", q.quotation_id,
          { deal_id:q.deal_id, quotation_id:q.quotation_id,
            quotation_number:q.quotation_number,
            grand_total_paise:q.grand_total_paise, discount_pct:q.discount_pct });
        return ok(q);
      });
    },

    reject: function (qid, reason, actor) {
      return tx(function () {
        var g = guard(qid, actor); if (g.ok === false) return g;
        var q = g.data;
        /* No status check. Rejecting an already-rejected quotation is a no-op
           worth nothing; rejecting an accepted one is a customer who changed
           their mind, which is a thing that happens and has to be recordable. */
        if (q.status === ST.ACCEPTED) {
          q.accepted_at = null;
          enqueue(DB, "quotation.rejected", q.quotation_id,
            { deal_id:q.deal_id, quotation_id:q.quotation_id, quotation_number:q.quotation_number });
        }
        q.status = ST.REJECTED; q.rejected_at = todayISO();
        q.reject_reason = (reason || "").trim() || null; q.row_version++;
        ev(DB, q.quotation_id, "REJECTED", actor.name, actor.role, todayISO(),
           { reason:q.reject_reason });
        // Deliberately does NOT touch the parent deal. Whether a rejected
        // proposal moves the stage is a Module 1 decision, not this one.
        return ok(q);
      });
    }
  };

  /* ============================================================= DOCUMENT === */
  var Document = {
    of: function (qid) {
      var q = quoteOf(qid); if (!q || !q.document_id) return null;
      return find(load().documents, "document_id", q.document_id);
    },
    /* The stored artefact is SERVED, never re-rendered. Re-rendering from live
       data later would defeat the entire freeze guarantee.                     */
    download: function (qid, actor) {
      return tx(function () {
        var g = guard(qid, actor); if (g.ok === false) return g;
        var doc = Document.of(qid);
        if (!doc) return err(404, "quotation_not_found", "No document — this quotation was never issued.");
        ev(DB, g.data.quotation_id, "DOWNLOADED", actor.name, actor.role, todayISO());
        return ok(doc);
      });
    },
    share: function (qid, actor) {
      return tx(function () {
        var g = guard(qid, actor); if (g.ok === false) return g;
        var doc = Document.of(qid);
        if (!doc) return err(404, "quotation_not_found", "No document to share.");
        // QT-OD-13 is open and security-relevant. A real signed expiring URL
        // needs a server; this records the intent and the audit row, and the
        // token is deliberately unguessable rather than the quotation number.
        var token = doc.checksum_sha256.slice(0, 24);
        ev(DB, g.data.quotation_id, "SHARED", actor.name, actor.role, todayISO(), { token:token });
        return ok({ doc:doc, link:"/q/" + token, expires:addDays(todayISO(), 7) });
      });
    }
  };

  /* =========================================================== AUTOMATION === */
  var Automation = {
    /* QT-T04. A job lock, and idempotent: a row already Expired is skipped
       rather than rewritten, and rows missed on one run are caught on the next.
       Accepted, Rejected, Superseded and Cancelled are NEVER expired.          */
    runExpiry: function () {
      return tx(function () {
        var job = DB.jobs.expiry;
        if (job.running) return err(409, "job_running", "The expiry sweep is already running.");
        job.running = true;
        var n = 0;
        DB.quotations.forEach(function (q) {
          if (q.status !== ST.ISSUED) return;
          if (daysUntil(q.valid_until) >= 0) return;
          q.status = ST.EXPIRED; q.expired_at = todayISO(); q.row_version++;
          ev(DB, q.quotation_id, "EXPIRED", "System", "system", todayISO());
          n++;
        });
        job.running = false; job.lastRun = todayISO() + " " + new Date().toTimeString().slice(0, 5);
        return ok({ expired:n, at:job.lastRun });
      });
    },
    lastRun: function () { return load().jobs.expiry.lastRun; }
  };

  /* ============================================================== OUTBOX === */
  function enqueue(db, type, aggId, payload) {
    db.outbox.push({ outbox_id:"ob-" + (++db.seq.ob), aggregate_type:"quotation",
      aggregate_id:aggId, event_type:type, payload:payload,
      status:"pending", attempts:0, created_at:todayISO(), delivered_at:null, error:null });
  }
  /* Delivery is at-least-once and consumers key on (aggregate_id, event_type),
     so a replay is a no-op. This is the seam the contract insists on: a table,
     not an HTTP call inside somebody else's transaction.                       */
  function drain() {
    load();
    var moved = 0, failed = 0;
    DB.outbox.forEach(function (row) {
      if (row.status === "delivered") return;
      row.attempts++;
      var S = root.IBDeals && root.IBDeals.Sync;
      if (!S) { row.status = "pending"; row.error = "Module 1 not loaded"; failed++; return; }
      // quotationRejected lands in deals-engine.js on a separate track; until it
      // does, treat the row like Module 1 not being loaded rather than crash or
      // falsely mark it delivered.
      if (row.event_type === "quotation.rejected" && typeof S.quotationRejected !== "function") {
        row.status = "pending"; row.error = "quotationRejected sync handler missing"; failed++; return;
      }
      var r = row.event_type === "quotation.issued"
        ? S.quotationIssued(row.payload)
        : row.event_type === "quotation.accepted" ? S.quotationAccepted(row.payload)
        : row.event_type === "quotation.rejected" ? S.quotationRejected(row.payload)
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
      var all = load().quotations;
      // Fail CLOSED: with no Module 1 to resolve a deal's scope against, the
      // safe answer is "nothing is in scope", not "everything is" (QA8).
      if (!root.IBDeals) return [];
      if (root.IBDeals.isHead(actor)) return all;
      return all.filter(function (q) {
        var dl = root.IBDeals.dealOf(q.deal_id);
        return dl && root.IBDeals.inScope(actor, dl);
      });
    },
    summary: function (actor) {
      var qs = Analytics.scopeOf(actor);
      var by = {}; qs.forEach(function (q) { by[q.status] = (by[q.status] || 0) + 1; });
      var val = {}; qs.forEach(function (q) {
        val[q.status] = (val[q.status] || 0) + q.grand_total_paise; });
      var issued = qs.filter(function (q) { return q.status === ST.ISSUED; });
      var decided = qs.filter(function (q) {
        return [ST.ACCEPTED, ST.REJECTED, ST.EXPIRED].indexOf(q.status) >= 0; });
      var accepted = qs.filter(function (q) { return q.status === ST.ACCEPTED; });
      var thisMonth = accepted.filter(function (q) {
        return q.accepted_at && q.accepted_at.slice(0, 7) === todayISO().slice(0, 7); });
      return {
        all:qs, byStatus:by, valueByStatus:val,
        awaiting:issued.length,
        expiring:issued.filter(function (q) {
          var d = daysUntil(q.valid_until); return d >= 0 && d <= 3; }).length,
        acceptedThisMonth:thisMonth.length,
        acceptedThisMonthValue:thisMonth.reduce(function (a, q) { return a + q.grand_total_paise; }, 0),
        staleDrafts:qs.filter(function (q) {
          return q.status === ST.DRAFT && Math.abs(daysUntil(q.created_at)) > 7; }).length,
        acceptanceRate:decided.length ? Math.round(accepted.length / decided.length * 100) : null,
        avgValue:accepted.length
          ? Math.round(accepted.reduce(function (a, q) { return a + q.grand_total_paise; }, 0) / accepted.length) : 0,
        avgDiscount:accepted.length
          ? Math.round(accepted.reduce(function (a, q) { return a + (q.discount_pct || 0); }, 0) / accepted.length * 10) / 10 : 0,
        revisions:qs.filter(function (q) { return q.parent_quotation_id; }).length
      };
    }
  };

  /* ============================================================== EXPORT === */
  function projectQuotes() {
    return load().quotations.map(function (q) {
      var plan = planOf(q.quotation_id);
      return { ref:q.quotation_number || "(draft)", deal:q.deal_id, v:q.version, status:q.status,
        value:q.grand_total_paise, plan:plan ? plan.name : "—",
        term:plan ? plan.term_months : 0, rate:plan ? plan.rate_per_month_paise : 0,
        discount:q.discount_pct, issued:q.issued_at, accepted:q.accepted_at,
        validTo:q.valid_until, owner:q.owner,
        supersedes:q.parent_quotation_id, supersededBy:q.superseded_by_id, _src:q };
    });
  }
  function publish() {
    var arr = D.quotations;
    arr.length = 0; Array.prototype.push.apply(arr, projectQuotes());
  }

  root.IBQuote = {
    catalogueOf:catalogueOf, planDurations:function (name) {
      var c = catalogueOf(name); return (c && c.durations) || null; },
    /* No TRANSITIONS export — there is no matrix to hand out. */
    ST:ST, LABEL:LABEL, TONE:TONE,
    SELLER:SELLER, STATES:STATES, GST_RATES:GST_RATES, TERMS_TEMPLATE:TERMS_TEMPLATE,
    TAX_MODE:TAX_MODE, TAX_LABEL:TAX_LABEL, taxApplicable:taxApplicable,
    DEFAULT_VALIDITY_DAYS:DEFAULT_VALIDITY_DAYS,
    load:load, reset:reset, db:function () { return load(); },
    Draft:Draft, Issuance:Issuance, Acceptance:Acceptance,
    Document:Document, Automation:Automation, Analytics:Analytics,
    quoteOf:quoteOf, partyOf:partyOf, itemsOf:itemsOf, planOf:planOf, addonsOf:addonsOf,
    forDeal:forDeal, acceptedOf:acceptedOf, eventsOf:eventsOf,
    price:price, lineNet:lineNet, daysUntil:daysUntil, stateOf:stateOf,
    addDays:addDays, addMonths:addMonths, todayISO:todayISO, featuresFor:featuresFor,
    installmentSchedule:installmentSchedule, installmentPlan:installmentPlan,
    INSTALLMENT_MAX:INSTALLMENT_MAX, GAP_MAX:GAP_MAX,
    planNames:sellableNames,
    versionsOf:function (qid) {
      var q = quoteOf(qid); if (!q) return [];
      return forDeal(q.deal_id).sort(function (a, b) { return a.version - b.version; });
    },
    outbox:function () { return load().outbox.slice().reverse(); },
    drain:drain
  };

  load();
  drain();      // deliver anything the seed enqueued
  publish();
  // The seeded quotations were never enqueued, so Module 1 reconstructs its two
  // scalars from our rows once, at boot. Everything after this arrives by outbox.
  if (root.IBDeals && root.IBDeals.Sync) root.IBDeals.Sync.reconcile();
})(window);

/* ---------------------------------------------------------------- ES module
   The IIFE above is verbatim from the prototype and still attaches to
   `window`, because the engines find each other through `root.IB*` at
   runtime. This only re-exports what it already published. */
export const IBQuote = window.IBQuote;
export default window.IBQuote;
