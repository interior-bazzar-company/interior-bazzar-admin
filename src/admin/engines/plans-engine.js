/* =====================================================================
   Interior bazzar — PLANS ENGINE (IBPlans)
   ---------------------------------------------------------------------
   THE catalogue. One place that says what we sell, for how long, and at
   what price — and the only place any of those three answers is stored.

   Why this file exists
   ---------------------------------------------------------------------
   There were two plan catalogues and they disagreed. The admin page said
   Growth costs ₹30,000 a month; the quotation engine sold Growth at
   ₹2,19,000 for twelve months, which is ₹18,250 a month. Neither was
   editable. The one an agent actually quoted from was a literal buried
   two hundred lines into `quotation-engine.js`, and the one the panel
   showed was a table of numbers typed into a view.

   So the numbers below are not new. They are the quotation engine's
   catalogue — the one that was really being sold from — lifted out,
   given the shape a catalogue needs (categories, several durations, a
   status, an edit history) and put somewhere a human can change them.

   WHAT THIS ENGINE OWNS, and what it deliberately does not
   ---------------------------------------------------------------------
   Owns  · the standard price of a thing we sell, per duration
         · what a plan includes
         · whether it is on sale

   Does NOT own
         · what a customer was actually charged  → the quotation's
           snapshot owns that, frozen at creation, and nothing here can
           reach back and change it
         · who is subscribed to what             → M6 Users owns
           membership and its entitlement snapshot (UM-BR-15). This
           engine can COUNT members; it can never write one. A second
           subscription store would be the same source-of-truth
           collision the integration map records as R-02 for payments.

   Money is integer paise, everywhere, like every other engine here.
   `final` is NEVER stored — `finalOf()` derives it from base and
   discount, so the catalogue cannot start disagreeing with itself the
   way the two old copies did.

   API (window.IBPlans):
     all() plansOf(cat) planOf(id) byTitle(t) activePlans()
     Catalogue.create/update/remove/archive/setStatus
     Pricing.set/removeRow/finalOf/rowFor/rangeOf
     Features.set
     CATEGORIES DURATIONS STATUS LABEL TONE
   ===================================================================== */
(function (root) {
  "use strict";
  if (root.IBPlans) return;

  var D = root.IBData;
  /* SCHEMA 2 — the seed was replaced with the real plan sheets, and the change
     is one of MEANING, not shape: the old store held an "AutoGrowth · Pro"
     tier that does not exist, Growth at ₹2,19,000 against a real annual price
     of ₹2,99,999, and two categories (Shop, Architect) that are not sold. A
     v1 store carried wrong prices, so it is discarded rather than healed —
     healing backfills missing fields, it cannot correct wrong ones.

     Quotations are unaffected: each one holds its own snapshot and reads
     nothing from here. */
  var KEY = "ib_plans_store", SCHEMA = 2;
  var DB = null;

  /* ============================================================ VOCAB === */
  /* Data-driven, per the brief: the UI offers these four, the engine
     accepts any key it is given. Adding a fifth is one line here and
     nothing anywhere else — the filter, the strip and the create form all
     read this list. */
  /* TWO categories, because two is what is sold. An earlier draft of this file
     carried Shop and Architect as well; they are not products, so they are not
     here. Adding a third is one entry in this list and nothing anywhere else —
     the filter, the strip, the create form and the sort order all read it. */
  var CATEGORIES = [
    { key:"business",   label:"Business",
      blurb:"Prepaid presence and portfolio subscriptions — Monthly, Quarterly, Annual" },
    { key:"autogrowth", label:"AutoGrowth",
      blurb:"Networking and portfolio growth. Each tier includes its Business Plan foundation" }
  ];
  function categoryOf(k) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].key === k) return CATEGORIES[i];
    return null;
  }
  function categoryLabel(k) { var c = categoryOf(k); return c ? c.label : String(k || "—"); }

  /* The durations the create form offers. NOT a constraint — `Pricing.set`
     takes any positive month count, and the seeded Pro tier keeps its
     24-month row to prove it. A list, not an enum. */
  var DURATIONS = [1, 3, 6, 12];

  var STATUS = { DRAFT:"draft", ACTIVE:"active", INACTIVE:"inactive", ARCHIVED:"archived" };
  var LABEL = { draft:"Draft", active:"Active", inactive:"Inactive", archived:"Archived" };
  var TONE  = { draft:"", active:"ok", inactive:"warn", archived:"dead" };
  /* Only an ACTIVE plan can be quoted from. Draft is being written,
     inactive is withdrawn but may come back, archived is history that
     existing quotations still point at. */
  var SELLABLE = [STATUS.ACTIVE];

  /* ============================================================= STORE === */
  function blank() {
    return { _v:SCHEMA, plans:[], events:[], seq:{ plan:0, ev:0 } };
  }
  function load() {
    if (DB) return DB;
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw._v === SCHEMA) { DB = heal(raw); return DB; }
    } catch (e) {}
    DB = seed(); persist(); return DB;
  }
  /* Backfills any collection or counter a later build added at the same
     schema number. Additive changes need no version bump — the same rule
     the deals engine learned the hard way when `E.Tags.all()` hit a store
     written before `tags` existed. */
  function heal(raw) {
    var b = blank(), k;
    for (k in b) if (raw[k] === undefined) raw[k] = b[k];
    for (k in b.seq) if (raw.seq[k] === undefined) raw.seq[k] = b.seq[k];
    (raw.plans || []).forEach(function (p) {
      if (!p.pricing) p.pricing = [];
      if (!p.features) p.features = [];
      if (p.revision === undefined) p.revision = 1;
    });
    return raw;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
  function reset() { DB = seed(); persist(); publish(); return DB; }

  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", function (e) { if (e && e.key === KEY) DB = null; });
  }

  /* All-or-nothing, like every other engine here: a refused guard must not
     leave half an edit behind. */
  function tx(fn) {
    load();
    var snap = JSON.stringify(DB), r;
    try { r = fn(); }
    catch (e) { DB = JSON.parse(snap); return err(500, "internal_error", e.message); }
    if (!r || r.ok === false) { DB = JSON.parse(snap); return r || err(500, "internal_error", ""); }
    persist(); publish();
    return r;
  }
  function ok(data) { return { ok:true, data:data }; }
  function err(http, code, detail) { return { ok:false, http:http, code:code, detail:detail }; }
  function publish() {
    if (typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
      try { root.dispatchEvent(new root.CustomEvent("ib:plans")); } catch (e) {}
    }
  }
  function todayISO() {
    var t = (D && D.TODAY) || new Date();
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" +
           String(t.getDate()).padStart(2, "0");
  }
  function emit(planId, kind, detail, actor) {
    DB.events.push({ event_id:"pe-" + (++DB.seq.ev), plan_id:planId, kind:kind,
      detail:detail || "", actor:(actor && actor.name) || "System", at:todayISO() });
  }

  /* ========================================================== PRICING === */
  /* ONE calculation, called by the catalogue page, the quotation picker and
     the quotation write alike. A price that is computed in three places is
     a price that will eventually be three different numbers — which is the
     defect this whole engine exists to end. */
  function finalOf(row) {
    if (!row) return 0;
    var base = Math.max(0, Math.round(row.base_paise || 0));
    var v = Number(row.discount_value) || 0;
    if (v <= 0) return base;
    var cut = row.discount_type === "amt" ? Math.round(v * 100) : Math.round(base * v / 100);
    return Math.max(0, base - cut);
  }
  function activeRows(plan) {
    return (plan && plan.pricing || []).filter(function (r) { return r.active !== false; })
      .sort(function (a, b) { return a.months - b.months; });
  }
  function rowFor(plan, months) {
    var rows = (plan && plan.pricing) || [];
    for (var i = 0; i < rows.length; i++) if (Number(rows[i].months) === Number(months)) return rows[i];
    return null;
  }
  /* The cheapest and dearest FINAL price a plan can be sold at. Two numbers
     rather than one, because a plan with four durations has a price range,
     not a price, and showing only one of them is how a list page starts
     lying about what something costs. */
  function rangeOf(plan) {
    var rows = activeRows(plan);
    if (!rows.length) return null;
    var lo = null, hi = null;
    rows.forEach(function (r) {
      var f = finalOf(r);
      if (lo === null || f < lo) lo = f;
      if (hi === null || f > hi) hi = f;
    });
    return { lo:lo, hi:hi, rows:rows.length };
  }
  /* Per-month, for comparing durations against each other. Display only —
     nothing is ever charged per month. */
  function perMonth(row) {
    var m = Number(row && row.months) || 0;
    return m > 0 ? Math.round(finalOf(row) / m) : 0;
  }

  /* ============================================================ QUERY === */
  function all() { return load().plans.slice(); }
  function planOf(id) {
    var ps = load().plans;
    for (var i = 0; i < ps.length; i++) if (ps[i].plan_id === id) return ps[i];
    return null;
  }
  function byTitle(t) {
    var ps = load().plans;
    for (var i = 0; i < ps.length; i++) if (ps[i].title === t) return ps[i];
    return null;
  }
  function plansOf(cat) {
    return load().plans.filter(function (p) { return p.category === cat; });
  }
  /* What a quotation is allowed to offer: on sale, and priceable. An active
     plan with no active duration row cannot be sold — there is no number to
     put on the proposal — so it is withheld here rather than offered and
     then failing at the point of writing a line. */
  function activePlans() {
    return load().plans.filter(function (p) {
      return SELLABLE.indexOf(p.status) >= 0 && activeRows(p).length > 0;
    });
  }
  function eventsFor(id) {
    return load().events.filter(function (e) { return e.plan_id === id; })
      .sort(function (a, b) { return b.event_id.localeCompare(a.event_id, undefined, { numeric:true }); });
  }

  /* How many members are on this plan. A QUERY, never a column — M6 Users
     owns membership, and a count that is stored is a count that goes stale
     the next time somebody subscribes. */
  /* Memberships still carry the LEGACY plan key — `starter`, `growth`, `pro` —
     from before a catalogue existed to point at. Matching on title alone made
     every plan report zero members, which is a wrong number rather than a
     missing one, so the old keys are mapped explicitly here.

     This is a MIGRATION M6 Users owes: a membership should hold a `plan_id`.
     Until it does, the mapping lives in one named constant where it can be
     seen and deleted, rather than as a silent zero on the catalogue page. */
  var LEGACY_PLAN_KEY = {
    starter:"AutoGrowth · Starter",
    growth: "AutoGrowth · Growth",
    /* `pro` is what memberships were keyed with. The tier it means is SCALE —
       there has never been a Pro on the plan sheet. The stale name lives on in
       the membership records, which is the second reason this mapping is
       written down rather than inferred. */
    pro:    "AutoGrowth · Scale"
  };
  function membersOf(plan) {
    var us = (D && D.users) || [];
    return us.filter(function (u) {
      return u.plan === plan.title || LEGACY_PLAN_KEY[u.plan] === plan.title;
    });
  }
  /* Whether history points at this plan. Drives archive-instead-of-delete:
     a plan somebody has quoted is a plan that has to stay explainable. */
  function referencesTo(planId) {
    var Q = root.IBQuote, out = { quotations:0, members:0 };
    var plan = planOf(planId);
    if (!plan) return out;
    if (Q && Q.db) {
      try {
        (Q.db().items || []).forEach(function (it) {
          if (it.kind !== "plan") return;
          if (it.plan_id === planId || it.name === plan.title) out.quotations++;
        });
      } catch (e) {}
    }
    out.members = membersOf(plan).length;
    return out;
  }
  function isReferenced(planId) {
    var r = referencesTo(planId);
    return r.quotations > 0 || r.members > 0;
  }

  /* ======================================================== VALIDATION === */
  function cleanTitle(s) { return String(s == null ? "" : s).trim().replace(/\s+/g, " "); }
  function validTitle(t, exceptId) {
    if (!t) return err(400, "validation_failed", "A plan needs a title.");
    if (t.length > 80) return err(400, "validation_failed", "Keep the title under 80 characters.");
    var clash = byTitle(t);
    if (clash && clash.plan_id !== exceptId)
      return err(409, "duplicate_title", "A plan is already called “" + t + "”.");
    return null;
  }
  function normaliseRow(r) {
    var months = Math.max(1, parseInt(r.months, 10) || 0);
    var type = r.discount_type === "amt" ? "amt" : "pct";
    var val = Math.max(0, Number(r.discount_value) || 0);
    if (type === "pct" && val > 100) val = 100;
    var inst = Math.max(1, Math.min(12, parseInt(r.installments, 10) || 1));
    return {
      months:months,
      base_paise:Math.max(0, Math.round(Number(r.base_paise) || 0)),
      discount_type:type,
      discount_value:val,
      installments:inst,
      gap_months:Math.max(1, parseInt(r.gap_months, 10) || Math.max(1, Math.round(months / inst))),
      active:r.active !== false
    };
  }

  /* ======================================================== CATALOGUE === */
  var Catalogue = {
    create: function (p, actor) {
      return tx(function () {
        var title = cleanTitle(p && p.title);
        var bad = validTitle(title, null); if (bad) return bad;
        if (!categoryOf(p.category))
          return err(400, "validation_failed", "Pick one of the four categories.");
        var id = "PLN-" + String(++DB.seq.plan).padStart(4, "0");
        var plan = {
          plan_id:id, title:title, category:p.category,
          description:String(p.description || "").trim(),
          features:[], pricing:[],
          /* New plans start as DRAFT, never active. A plan with no price yet
             must not be selectable in a quotation the moment it is named. */
          status:STATUS.DRAFT, revision:1,
          created_at:todayISO(), created_by:(actor && actor.name) || "System",
          updated_at:todayISO(), updated_by:(actor && actor.name) || "System"
        };
        DB.plans.push(plan);
        emit(id, "created", title, actor);
        return ok(plan);
      });
    },

    /* Title / category / description. Pricing and features have their own
       calls, because a commercial change and a wording change are different
       events and the timeline should be able to tell them apart. */
    update: function (id, patch, actor) {
      return tx(function () {
        var plan = planOf(id);
        if (!plan) return err(404, "plan_not_found", "No plan " + id + ".");
        if (plan.status === STATUS.ARCHIVED)
          return err(422, "plan_archived", "An archived plan is history — restore it before editing.");
        var moved = [];
        if (patch.title !== undefined) {
          var t = cleanTitle(patch.title);
          var bad = validTitle(t, id); if (bad) return bad;
          if (t !== plan.title) { moved.push("title"); plan.title = t; }
        }
        if (patch.category !== undefined && patch.category !== plan.category) {
          if (!categoryOf(patch.category))
            return err(400, "validation_failed", "Pick one of the four categories.");
          moved.push("category"); plan.category = patch.category;
        }
        if (patch.description !== undefined) {
          var d = String(patch.description).trim();
          if (d !== plan.description) { moved.push("description"); plan.description = d; }
        }
        if (!moved.length) return ok(plan);
        touch(plan, actor);
        emit(id, "updated", moved.join(", ") + " changed", actor);
        return ok(plan);
      });
    },

    setStatus: function (id, status, actor) {
      return tx(function () {
        var plan = planOf(id);
        if (!plan) return err(404, "plan_not_found", "No plan " + id + ".");
        if (!LABEL[status]) return err(400, "validation_failed", "Unknown status " + status + ".");
        if (status === plan.status) return ok(plan);
        /* The one guard that matters commercially: you cannot put a plan on
           sale with nothing to sell it at. An active plan with no active
           duration row would appear in the quotation picker and then have no
           number to write. */
        if (status === STATUS.ACTIVE && !activeRows(plan).length)
          return err(422, "no_active_pricing",
            "Add at least one active duration before putting this plan on sale.");
        var from = plan.status;
        plan.status = status;
        touch(plan, actor);
        emit(id, "status", LABEL[from] + " → " + LABEL[status], actor);
        return ok(plan);
      });
    },

    /* SAVE THE WHOLE PLAN, in one transaction.

       `create` and `update` above each move one part of a plan, and the
       focused editors move one more each — which is right when somebody is
       changing just a price. It is wrong as the way a plan is authored: a
       team that has to name a plan, close the dialog, reopen it to price it
       and reopen it again to list its features is a team filling in one form
       through three doors.

       The reason this is an engine call rather than four calls in a row from
       the view is the guarantee: title, category, description, pricing,
       features and status are validated together and written together. A
       rejected discount cannot leave a renamed plan behind, and a plan is
       never briefly on sale with no price while the next call is in flight.
       `tx()` rolls the whole thing back on any refusal.

       `id` null creates; an id updates.                                     */
    save: function (id, p, actor) {
      return tx(function () {
        p = p || {};
        var plan = id ? planOf(id) : null;
        if (id && !plan) return err(404, "plan_not_found", "No plan " + id + ".");
        if (plan && plan.status === STATUS.ARCHIVED)
          return err(422, "plan_archived", "An archived plan is history — restore it before editing.");

        /* ---- validate everything BEFORE writing anything ---------------- */
        var title = cleanTitle(p.title);
        var bad = validTitle(title, id || null); if (bad) return bad;
        if (!categoryOf(p.category))
          return err(400, "validation_failed", "Pick a category.");

        var status = p.status || (plan ? plan.status : STATUS.DRAFT);
        if (!LABEL[status]) return err(400, "validation_failed", "Unknown status " + status + ".");
        if (status === STATUS.ARCHIVED)
          return err(422, "validation_failed",
            "Archiving is its own action — it is not a status you set while editing.");

        var pr = checkPricing(p.pricing); if (pr.err) return pr.err;
        var ft = checkFeatures(p.features); if (ft.err) return ft.err;

        /* The one commercial rule that spans two sections of the form, which
           is exactly why they are validated together: on sale means there is
           something to sell it at. */
        if (status === STATUS.ACTIVE && !hasLivePrice(pr.rows))
          return err(422, "no_active_pricing",
            "This plan is set to Active but no duration is on sale. Switch a duration on, " +
            "or save it as a Draft.");

        /* ---- nothing below here can fail -------------------------------- */
        var isNew = !plan;
        if (isNew) {
          var newId = "PLN-" + String(++DB.seq.plan).padStart(4, "0");
          plan = {
            plan_id:newId, title:title, category:p.category, description:"",
            features:[], pricing:[], status:STATUS.DRAFT, revision:0,
            created_at:todayISO(), created_by:(actor && actor.name) || "System",
            updated_at:todayISO(), updated_by:(actor && actor.name) || "System"
          };
          DB.plans.push(plan);
          emit(newId, "created", title, actor);
        }

        /* What actually moved, so the timeline says something more useful than
           "saved" on every edit. */
        var moved = [];
        if (plan.title !== title) moved.push("title");
        if (plan.category !== p.category) moved.push("category");
        var desc = String(p.description || "").trim();
        if (plan.description !== desc) moved.push("description");
        if (JSON.stringify(plan.pricing) !== JSON.stringify(pr.rows)) moved.push("pricing");
        if (JSON.stringify(plan.features) !== JSON.stringify(ft.rows)) moved.push("features");
        var fromStatus = plan.status;
        if (fromStatus !== status) moved.push("status");

        plan.title = title;
        plan.category = p.category;
        plan.description = desc;
        plan.pricing = pr.rows;
        plan.features = ft.rows;
        plan.status = status;

        if (isNew || moved.length) touch(plan, actor);
        if (!isNew && moved.length)
          emit(plan.plan_id, "updated", moved.join(", ") + " changed", actor);
        if (fromStatus !== status && !isNew)
          emit(plan.plan_id, "status", LABEL[fromStatus] + " → " + LABEL[status], actor);
        return ok(plan);
      });
    },

    /* ARCHIVE, not delete, the moment anything points at it. A quotation
       naming a plan that no longer exists is a document nobody can explain
       a year later. */
    archive: function (id, actor) { return Catalogue.setStatus(id, STATUS.ARCHIVED, actor); },

    remove: function (id, actor) {
      return tx(function () {
        var plan = planOf(id);
        if (!plan) return err(404, "plan_not_found", "No plan " + id + ".");
        var refs = referencesTo(id);
        if (refs.quotations || refs.members)
          return err(422, "plan_referenced",
            "This plan is on " + refs.quotations + " quotation line(s) and " + refs.members +
            " membership(s). Archive it instead — deleting it would leave those records naming " +
            "a plan that does not exist.");
        DB.plans = DB.plans.filter(function (x) { return x.plan_id !== id; });
        emit(id, "deleted", plan.title, actor);
        return ok({ plan_id:id });
      });
    }
  };

  /* Every commercial edit bumps the revision. That number is what a
     quotation snapshot records, so "which catalogue was this quoted from"
     stays answerable without keeping a second copy of the catalogue. */
  function touch(plan, actor) {
    plan.revision = (plan.revision || 1) + 1;
    plan.updated_at = todayISO();
    plan.updated_by = (actor && actor.name) || "System";
  }

  /* ====================================== SHARED FIELD VALIDATION ====== */
  /* Extracted so the focused editors (Pricing.set, Features.set) and the
     whole-plan save validate identically. Two copies of a rule is two rules
     the day one of them is changed. Each returns `{ rows }` or `{ err }`. */
  function checkPricing(rows) {
    var seen = {}, out = [], bad = null;
    (rows || []).forEach(function (r) {
      if (bad) return;
      var row = normaliseRow(r);
      if (seen[row.months]) {
        bad = err(409, "duplicate_duration",
          "There are two " + row.months + "-month rows. One row per duration.");
        return;
      }
      /* ZERO IS A PRICE. Business · Free Forever is a real tier that costs
         nothing, so a row at ₹0 is refused only when it is NEGATIVE — which
         `normaliseRow` already clamps away. Switching a row on is the
         deliberate act; every surface renders ₹0 as "Free" so it can never be
         mistaken for a figure somebody forgot to type. */
      if (row.installments > row.months) {
        bad = err(400, "validation_failed",
          "The " + row.months + "-month row splits into " + row.installments +
          " payments — more payments than months.");
        return;
      }
      seen[row.months] = 1;
      out.push(row);
    });
    if (bad) return { err:bad };
    out.sort(function (a, b) { return a.months - b.months; });
    return { rows:out };
  }
  function hasLivePrice(rows) {
    return (rows || []).filter(function (r) { return r.active; }).length > 0;
  }
  function checkFeatures(rows) {
    var out = [], seen = {}, bad = null;
    (rows || []).forEach(function (r) {
      if (bad) return;
      var key = String(r.key || "").trim();
      var label = String(r.label || "").trim();
      if (key && !label) label = Features.labelFor(key);
      if (!label) return;                       // an empty row is a removed row
      var dedupe = (key || label).toLowerCase();
      if (seen[dedupe]) {
        bad = err(409, "duplicate_feature", "“" + label + "” is listed twice.");
        return;
      }
      seen[dedupe] = 1;
      out.push({ key:key || null, label:label,
                 text:key ? Features.textFor(key) : String(r.text || "").trim() });
    });
    return bad ? { err:bad } : { rows:out };
  }

  /* ========================================================== PRICING === */
  var Pricing = {
    /* Whole-grid write: the editor hands back every row it is showing, so a
       removed duration is simply absent. One call, one revision bump, one
       timeline entry — rather than a line per row and a history nobody can
       read. */
    set: function (id, rows, actor) {
      return tx(function () {
        var plan = planOf(id);
        if (!plan) return err(404, "plan_not_found", "No plan " + id + ".");
        if (plan.status === STATUS.ARCHIVED)
          return err(422, "plan_archived", "An archived plan is history — restore it before pricing it.");
        var pr = checkPricing(rows);
        if (pr.err) return pr.err;
        var out = pr.rows;
        /* Taking the last active row off a live plan would leave it on sale
           and unpriceable — the exact state setStatus refuses to create. */
        if (plan.status === STATUS.ACTIVE && !hasLivePrice(out))
          return err(422, "no_active_pricing",
            "This plan is on sale. Deactivate it first, or keep one duration active.");
        plan.pricing = out;
        touch(plan, actor);
        emit(id, "pricing", out.length + " duration(s) · rev " + plan.revision, actor);
        return ok(plan);
      });
    },
    finalOf:finalOf, rowFor:rowFor, rangeOf:rangeOf, activeRows:activeRows, perMonth:perMonth
  };

  /* ========================================================= FEATURES === */
  /* Hybrid, deliberately. A feature with a `key` resolves through
     IBPlanInfo — the registry the customer-facing pricing pages already
     read — so a proposal and the public page cannot word the same feature
     two different ways. A feature without one is free text, so selling
     something new never waits on a registry entry. */
  var Features = {
    set: function (id, rows, actor) {
      return tx(function () {
        var plan = planOf(id);
        if (!plan) return err(404, "plan_not_found", "No plan " + id + ".");
        if (plan.status === STATUS.ARCHIVED)
          return err(422, "plan_archived", "An archived plan is history — restore it before editing.");
        var ft = checkFeatures(rows);
        if (ft.err) return ft.err;
        var out = ft.rows;
        plan.features = out;
        touch(plan, actor);
        emit(id, "features", out.length + " feature(s)", actor);
        return ok(plan);
      });
    },
    /* Resolved at WRITE time, not read time, so the wording a quotation
       snapshots is the wording that was on the registry that day. */
    labelFor: function (key) {
      var info = root.IBPlanInfo;
      return info && info.title ? info.title(key) : key;
    },
    textFor: function (key) {
      var info = root.IBPlanInfo;
      return info && info.text ? info.text(key) : "";
    },
    /* Every key the registry knows, for the picker in the feature editor. */
    registry: function () {
      var info = root.IBPlanInfo;
      if (!info || !info.keys) return [];
      return info.keys().map(function (k) {
        return { key:k, label:info.title(k), text:info.text(k) };
      });
    }
  };

  /* ============================================================= SEED === */
  /* ============================================================= SEED ===
     TAKEN FROM THE PLAN SHEETS, not invented and not carried over.

     Every figure below is a SELLING PRICE, exclusive of GST, exactly as the
     Business Plans and AutoGrowth sheets state it. GST is not stored on a
     plan: the quotation applies the rate that is correct for the deal at the
     time it is written, and a tax rate frozen into a catalogue would be a
     second place for it to be wrong.

     What this replaced, and why it matters: the previous seed carried an
     "AutoGrowth · Pro" tier at ₹4,80,000 for 24 months, inherited from the
     literal inside quotation-engine.js. There is no Pro tier and there is no
     24-month term. The tier is SCALE, sold annually at ₹6,24,999 — a figure
     the panel had never shown. Growth was quoting at ₹2,19,000 against a real
     annual price of ₹2,99,999, an ₹80,999 understatement on every proposal.

     Discounts are all zero, deliberately. The sheets publish one selling
     price per duration; the annual rate IS the saving, already priced in.
     Recording a fictional "base" so a discount could be displayed would be
     inventing a list price nobody quotes from.

     Installments default to 1 — prepaid, in full, which is what "prepaid
     subscriptions" in the sheet means. A payment split is a negotiation on a
     particular deal, and the quotation builder is where it belongs; it is not
     a property of the product. */
  function R(rupees) { return Math.round(rupees) * 100; }

  function seed() {
    var db = blank();
    var now = todayISO();

    function plan(title, category, description, status, pricing, featureKeys, extraFeatures) {
      var id = "PLN-" + String(++db.seq.plan).padStart(4, "0");
      var feats = (featureKeys || []).map(function (k) {
        return { key:k, label:Features.labelFor(k), text:Features.textFor(k) };
      }).concat((extraFeatures || []).map(function (l) {
        return { key:null, label:l, text:"" };
      }));
      db.plans.push({
        plan_id:id, title:title, category:category, description:description,
        features:feats,
        pricing:pricing.map(normaliseRow).sort(function (a, b) { return a.months - b.months; }),
        status:status, revision:1,
        created_at:now, created_by:"Plan sheet", updated_at:now, updated_by:"Plan sheet"
      });
      db.events.push({ event_id:"pe-" + (++db.seq.ev), plan_id:id, kind:"created",
        detail:title + " · from the plan sheet", actor:"Plan sheet", at:now });
      return id;
    }
    /* Monthly · Quarterly · Annual, the three the Business sheet publishes. */
    function mqa(monthly, quarterly, annual) {
      return [
        { months:1,  base_paise:R(monthly),   installments:1 },
        { months:3,  base_paise:R(quarterly), installments:1 },
        { months:12, base_paise:R(annual),    installments:1 }
      ];
    }

    /* ── BUSINESS ───────────────────────────────────────────────────────
       "Prepaid networking and portfolio-building subscriptions."
       Presence → Portfolio → Network → Connect → Find a match            */

    plan("Business · Free Forever", "business",
      "Start your presence. One state, one category, one keyword — free, and it stays free.",
      STATUS.ACTIVE,
      /* Priced at zero for twelve months rather than modelled as a perpetual
         term. "Forever" is not a duration the commercial model has, and
         inventing one for a single free tier would put a special case through
         every price calculation in the panel. It renders as "Free". */
      [{ months:12, base_paise:0, installments:1 }],
      ["biz-free-reach","biz-free-cat","biz-free-kw","biz-free-crm",
       "biz-free-analytics","biz-support-chat"]);

    plan("Business · Signature", "business",
      "Establish your presence. Three states, two categories, Verified badge.",
      STATUS.ACTIVE, mqa(1499, 3999, 14999),
      ["biz-sig-reach","biz-sig-catkw","biz-route-standard","biz-net-basic",
       "biz-crm-smart","biz-analytics-basic","biz-badge-verified","biz-support-chat"]);

    plan("Business · Premium", "business",
      "Build across regions. Five states with priority placement, Trusted badge.",
      STATUS.ACTIVE, mqa(3999, 10999, 39999),
      ["biz-prem-reach","biz-prem-catkw","biz-route-controlled","biz-net-priority",
       "biz-crm-advanced","biz-proposal-pro","biz-analytics-advanced",
       "biz-badge-trusted","biz-support-priority"]);

    plan("Business · Elite", "business",
      "Build a national position. Pan-India with featured placement, Leader badge.",
      STATUS.ACTIVE, mqa(6499, 17999, 64999),
      ["biz-elite-reach","biz-elite-catkw","biz-route-priority","biz-net-exclusive",
       "biz-crm-branded","biz-pipeline-multi","biz-badge-leader","biz-support-personal"]);

    /* ── AUTOGROWTH ─────────────────────────────────────────────────────
       "Each AutoGrowth tier includes the corresponding Business Plan
       foundation, then adds stronger positioning, expanded network
       participation and AI-driven requirement matching."

       Note the shape of this family: only Starter is sold at three lengths.
       Growth and Scale are annual only — which is exactly why pricing is a
       child collection and not three columns on the plan. A plan here has
       the durations it has.                                              */

    plan("AutoGrowth · Starter", "autogrowth",
      "Establish & grow. Includes all Business Signature features, then adds AI matching.",
      STATUS.ACTIVE, [
        { months:3,  base_paise:R(38499),  installments:1 },
        { months:6,  base_paise:R(69499),  installments:1 },
        { months:12, base_paise:R(123499), installments:1 }
      ],
      ["ag-reach-3","ag-cat-2","ag-kw-3","ag-boost-3x","ag-net-basic","ag-pos-enhanced",
       "ag-route-standard","ag-badge-verified","ag-crm-smart","ag-analytics-basic",
       "ag-ai-standard","ag-qual-3step","ag-support-chat"]);

    plan("AutoGrowth · Growth", "autogrowth",
      "Expand & position. Includes all Business Premium features. Sold annually.",
      STATUS.ACTIVE, [
        { months:12, base_paise:R(299999), installments:1 }
      ],
      ["ag-reach-5","ag-cat-3","ag-kw-6","ag-boost-6x","ag-net-priority","ag-pos-priority",
       "ag-comp-controlled","ag-route-priority","ag-badge-trusted","ag-crm-advanced",
       "ag-proposal-pro","ag-analytics-advanced","ag-ai-advanced","ag-qual-advanced",
       "ag-support-priority"]);

    plan("AutoGrowth · Scale", "autogrowth",
      "Lead & scale. Includes all Business Elite features. Pan-India, sold annually.",
      STATUS.ACTIVE, [
        { months:12, base_paise:R(624999), installments:1 }
      ],
      ["ag-reach-pan","ag-cat-5","ag-kw-10","ag-boost-10x","ag-net-exclusive",
       "ag-pos-featured","ag-comp-limited","ag-route-priority-ltd","ag-badge-leader",
       "ag-crm-branded","ag-pipeline-multi","ag-analytics-multi","ag-ai-priority",
       "ag-qual-ai","ag-support-personal"]);

    return db;
  }

  /* ============================================================== API === */
  root.IBPlans = {
    CATEGORIES:CATEGORIES, DURATIONS:DURATIONS, STATUS:STATUS, LABEL:LABEL, TONE:TONE,
    categoryOf:categoryOf, categoryLabel:categoryLabel,
    load:load, reset:reset, db:function () { return load(); },
    all:all, planOf:planOf, byTitle:byTitle, plansOf:plansOf, activePlans:activePlans,
    eventsFor:eventsFor, membersOf:membersOf, referencesTo:referencesTo, isReferenced:isReferenced,
    Catalogue:Catalogue, Pricing:Pricing, Features:Features,
    finalOf:finalOf, rowFor:rowFor, rangeOf:rangeOf, activeRows:activeRows, perMonth:perMonth,
    todayISO:todayISO
  };
})(window);

/* ---------------------------------------------------------------- ES module
   The IIFE above is verbatim from the prototype and still attaches to
   `window`, because the engines find each other through `root.IB*` at
   runtime. This only re-exports what it already published. */
export const IBPlans = window.IBPlans;
export default window.IBPlans;
