/* =============================================================================
   check:users — the derivation is right, and the seed proves it.
   -----------------------------------------------------------------------------
   Users Management stores no classification. `classify()` in views/Users/store.ts
   computes it at read time and every screen in the module calls that one
   function, so a bug in it is not a bug in one place — it is a wrong pill on the
   record, a wrong number on the strip, a wrong filter in the directory and a
   wrong tile on Analytics, all at once and all agreeing with each other.

   THE MODULE GAVE UP THE MEMBERSHIP FEATURE. What a customer bought — its plan,
   its term, its installments and its lifecycle — is a Finance record now, and
   the classification collapsed from six answers to two: active, or deactivated.
   Deactivated is a fact about the ACCOUNT. "Are they paying" is deliberately not
   answerable from here, and a good part of what this file asserts is that it
   stays that way: no membership reader, no plan rule, no lifecycle transaction,
   no expiry window, no term in the seed.

   What is left is what this module actually is, and it is not small: identity,
   the profile schema and its business facets, the username as a public address,
   target areas, tags, notes, account status, the audit trail, the filters, the
   sort, the counts and the analytics arithmetic. Every one of them is asserted
   below against the seed rather than against a description of it.

   NOTHING HERE IS HARD-CODED FROM A BRIEF. Every population figure is
   recomputed from src/content/users/*.json by this file, independently of
   store.ts, and then the two are compared. A seed that grows by seven users
   must not turn this suite red for a reason that is not a bug.

   Run: node scripts/check-users-derivation.cjs
   (after: npx esbuild src/admin/views/Users/store.ts --bundle --platform=node
           --format=cjs --define:import.meta.env={} --external:react
           --outfile=node_modules/.tmp/users-store.cjs)
   ============================================================================= */
const fs = require("fs");
const S = require("../node_modules/.tmp/users-store.cjs");

let failed = 0;
/* THE WRITES ARE ENDPOINTS NOW (2026-09-16), so every assertion about one is a
   promise. They are queued here and run at the end, in order, before the
   summary — a section that awaited in place would print its result after the
   summary had already gone out.

   WHAT IS ASSERTED ABOUT THEM HERE IS THE REFUSALS: the rules the store applies
   BEFORE it reaches the network, which are the ones an import or a bulk edit
   would otherwise get past. The stored outcome of an accepted write is asserted
   against the real server in the backend suite (interior_admin/tests/
   test_users_writes.py), which is the only place it can honestly be checked. */
const PENDING = [];
const later = (fn) => { PENDING.push(fn); };

function ok(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log("  ok   " + label);
  } else {
    failed++;
    console.log("  FAIL " + label + "\n         expected " + e + "\n         got      " + a);
  }
}

/* The hooks are not callable outside React, so the rows are built through the
   same toRow() the hooks build them with. That is the point: this asserts the
   derivation, not a reimplementation of it. */
const usersDoc = require("./fixtures/users.cjs");
const users = usersDoc.users;
const vocab = require("../src/content/users/vocabularies.json");

/* THE VALUE LISTS COME FROM THE SERVER (GET /admin/users/vocabularies/,
   GET v1/engine/seller-options/ and GET /admin/taxonomy/), so the module starts
   with them empty and a check that ran offline would assert against nothing.
   These are those responses, captured from the local backend in the shape each
   endpoint serves (taxonomy trimmed to a few rows, plus one hidden category),
   planted through the real setters. `tags` and `cities` are the seed's own,
   because the seed rows below carry them, and so is `stateCities`: the server
   derives it from the saved (state, city) pairs, so it is the seed's coverage
   ("All cities" dropped) plus the address cities under their state. */
const USERS_VOCAB = {
  classifications: [
    {"key": "active", "label": "Active", "tone": "", "hint": "The account works: the identity exists and is not administratively disabled."},
    {"key": "deactivated", "label": "Deactivated", "tone": "dead", "hint": "The ACCOUNT is administratively disabled. Soft: the profile, the commercial links and the audit trail are all retained."},
  ],
  registrationSources: [
    {"key": "web", "label": "Website signup"},
    {"key": "portal", "label": "Business portal"},
    {"key": "funnel", "label": "Campaign funnel"},
    {"key": "referral", "label": "Referral"},
    {"key": "admin", "label": "Added by us"},
  ],
  tags: [
    {"slug": "high-intent", "label": "High intent", "tone": "tag-violet", "help": "Told us on a call they want to buy. Internal only."},
    {"slug": "onboarding", "label": "Onboarding", "tone": "tag-cyan", "help": "Being walked through profile setup."},
    {"slug": "win-back", "label": "Win-back", "tone": "tag-amber", "help": "Former member worth calling again."},
    {"slug": "payment-risk", "label": "Payment risk", "tone": "tag-red", "help": "Finance flagged a dispute or a reversal."},
    {"slug": "vip", "label": "VIP", "tone": "tag-green", "help": "Handled by the founder personally."},
    {"slug": "profile-chase", "label": "Profile chase", "tone": "tag-slate", "help": "Registered, never finished the profile."},
  ],
  /* The handle rules, as users/vocabularies/ serves them: the numbers the
     profile PATCH enforces, and the reserved_username rows. */
  usernameRules: { min: 3, max: 30 },
  reservedUsernames: ["admin", "administrator", "api", "app", "auth", "about", "account", "blog", "business", "contact", "dashboard", "help", "home", "interiorbazzar", "login", "logout", "me", "new", "pricing", "plans", "privacy", "profile", "register", "root", "search", "settings", "signup", "support", "system", "terms", "test", "u", "user", "users", "www"],
  cities: ["Bengaluru", "Mumbai", "Pune", "Delhi", "Hyderabad", "Chennai", "Jaipur", "Kochi"],
  stateCities: {
    "Delhi": ["Dwarka", "New Delhi", "Rohini", "Saket", "Uttam Nagar"],
    "Haryana": ["Gurugram"],
    "Karnataka": ["Bengaluru", "Indiranagar", "Koramangala", "Mangaluru", "Whitefield"],
    "Kerala": ["Kochi"],
    "Maharashtra": ["Andheri", "Bandra", "Baner", "Hinjewadi", "Mumbai", "Navi Mumbai", "Pune", "Thane"],
    "Rajasthan": ["Jaipur"],
    "Tamil Nadu": ["Chennai"],
    "Telangana": ["Gachibowli", "Hyderabad"],
    "Uttar Pradesh": ["Noida"],
  },
  registeredRanges: [
    {"key": "today", "label": "Today"},
    {"key": "7d", "label": "Last 7 days"},
    {"key": "30d", "label": "Last 30 days"},
    {"key": "90d", "label": "Last 90 days"},
    {"key": "year", "label": "This year"},
    {"key": "custom", "label": "Custom range"},
  ],
  sortOptions: [
    {"key": "", "label": "Needs action first"},
    {"key": "recent", "label": "Recently registered"},
    {"key": "activity", "label": "Last activity"},
    {"key": "name", "label": "Name A to Z"},
  ],
  profileFields: [
    {"key": "businessName", "label": "Business name", "group": "business", "required": true, "editable": true, "public": true, "type": "text", "wide": true},
    {"key": "username", "label": "Username", "group": "business", "required": true, "editable": true, "public": true, "type": "handle"},
    {"key": "businessType", "label": "Business type", "group": "business", "required": true, "editable": true, "public": true, "type": "single", "vocab": "businessTypes", "chip": "tag-violet", "simple": true, "info": "What kind of business this is. It decides how the marketplace treats them, so it is one answer, not several.", "wide": true},
    {"key": "dealsIn", "label": "Deals in", "group": "business", "required": true, "editable": true, "public": true, "type": "checks", "vocab": "dealsIn", "chip": "tag-pink", "wide": true},
    {"key": "segments", "label": "Segments", "group": "business", "required": true, "editable": true, "public": true, "type": "multi", "vocab": "segments", "max": 6, "chip": "tag-green", "open": true, "maxLength": 40, "placeholder": "Search or type a segment"},
    {"key": "categories", "label": "Categories", "group": "business", "required": false, "editable": true, "public": true, "type": "multi", "vocab": "categories", "groups": "categoryGroups", "max": 10, "chip": "tag-blue", "open": true, "maxLength": 40, "placeholder": "Search or type a category"},
    {"key": "searchKeywords", "label": "Search keywords", "group": "business", "required": false, "editable": true, "public": true, "type": "tags", "vocab": "keywordSuggestions", "max": 12, "maxLength": 40, "chip": "tag-amber", "placeholder": "Type a keyword, press Enter"},
    {"key": "targetAreas", "label": "Location", "group": "contact", "required": true, "editable": true, "public": true, "type": "areas", "maxRows": 5, "maxCities": 8, "maxLength": 40, "chip": "tag-teal"},
    {"key": "positioning", "label": "Positioning", "group": "positioning", "required": false, "editable": true, "public": true, "type": "checks", "vocab": "positioning", "max": 2, "chip": "tag-orange", "wide": true, "info": "Select up to 2. This is how the business positions its own work — it keeps expectations aligned before a connection is made."},
    {"key": "about", "label": "About", "group": "about", "required": false, "editable": true, "public": true, "type": "textarea"},
  ],
  openDecisions: [
    {"id": "UM-OD-09", "title": "Profile schema", "position": "profile v1 is the field set on these screens. Which fields are public and which are admin-editable is unconfirmed.", "blocks": "Profile build"},
    {"id": "UM-OD-10", "title": "Engagement taxonomy", "position": "No qualifying-event taxonomy exists, so DAU/WAU/MAU render as unavailable rather than as zero.", "blocks": "Engagement analytics"},
  ],
};
const SELLER_OPTIONS = {
  businessTypes: [
    {"value": "Manufacturer", "label": "Manufacturer"},
    {"value": "Dealer / Distributor", "label": "Dealer / Distributor"},
    {"value": "Wholesaler", "label": "Wholesaler"},
    {"value": "Retailer", "label": "Retailer"},
    {"value": "Showroom", "label": "Showroom"},
    {"value": "Producer", "label": "Producer"},
    {"value": "Service provider", "label": "Service provider"},
  ],
  businessModels: [
    {"value": "products", "label": "Products", "meta": {"desc": "Tiles, sanitary ware, lighting, hardware, fittings, etc.", "icon": "ti-box"}},
    {"value": "services", "label": "Services", "meta": {"desc": "Design, installation, turnkey, consultation, 3D viz", "icon": "ti-tools"}},
    {"value": "both", "label": "Products + Services", "meta": {"desc": "Showrooms with installation, modular kitchen incl. fitting", "icon": "ti-package"}},
  ],
  serviceSegments: [
    {"value": "Luxury", "label": "Luxury"},
    {"value": "Premium", "label": "Premium"},
    {"value": "On Budget", "label": "On Budget"},
    {"value": "Eco friendly", "label": "Eco friendly"},
    {"value": "Custom", "label": "Custom"},
  ],
  serviceCategories: [
    {"value": "Residential", "label": "Residential"},
    {"value": "Commercial", "label": "Commercial"},
    {"value": "Industrial", "label": "Industrial"},
    {"value": "Hospitality", "label": "Hospitality"},
    {"value": "Turnkey", "label": "Turnkey"},
  ],
  productCategories: [
    {"value": "Sanitary Ware & Bathroom Fittings", "label": "Sanitary Ware & Bathroom Fittings", "meta": {"isSanitaryTrigger": true}},
    {"value": "Tiles, Marble & Surface Materials", "label": "Tiles, Marble & Surface Materials"},
    {"value": "Modular Kitchen & Furniture", "label": "Modular Kitchen & Furniture"},
    {"value": "Lighting & Electrical", "label": "Lighting & Electrical"},
    {"value": "Home Automation & Smart Solutions", "label": "Home Automation & Smart Solutions"},
    {"value": "Doors, Windows & Hardware", "label": "Doors, Windows & Hardware"},
    {"value": "Paints & Finishes", "label": "Paints & Finishes"},
    {"value": "Home Decor & Furnishings", "label": "Home Decor & Furnishings"},
  ],
  serviceKeywords: [
    {"value": "Interior Design Firms & Studios", "label": "Interior Design Firms & Studios"},
    {"value": "Architects & Architectural Firms", "label": "Architects & Architectural Firms"},
    {"value": "Turnkey Interior & Project Management", "label": "Turnkey Interior & Project Management"},
    {"value": "Space Planning & Design Consultants", "label": "Space Planning & Design Consultants"},
    {"value": "3D Visualization & Rendering", "label": "3D Visualization & Rendering"},
    {"value": "Interior Contractors & Execution", "label": "Interior Contractors & Execution"},
  ],
  states: ["Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"].map((s) => ({ value: s, label: s })),
};
const TAXONOMY = {
  categories: [
    {"value": "modular_kitchens", "label": "Modular Kitchens", "isActive": true},
    {"value": "interior_designers", "label": "Interior Designers", "isActive": true},
    {"value": "wardrobes_storage", "label": "Wardrobes & Storage", "isActive": true},
    {"value": "hidden_category", "label": "Hidden category", "isActive": false},
  ],
  segments: [
    {"value": "lShapedModularKitchen", "label": "L-shaped modular kitchen", "isActive": true},
    {"value": "uShapedModularKitchen", "label": "U-shaped modular kitchen", "isActive": true},
    {"value": "modular_kitchen", "label": "Modular kitchen", "isActive": true},
    {"value": "wardrobe_design", "label": "Wardrobe design", "isActive": true},
    {"value": "turnkey_interiors", "label": "Turnkey interiors", "isActive": true},
    {"value": "space_planning", "label": "Space planning", "isActive": true},
    {"value": "office_interiors", "label": "Office interiors", "isActive": true},
  ],
};
/* The deactivate reasons are rows now (GET /admin/vocab/user-deactivate-reasons/,
   PanelVocab scope `user_deactivate_reason`, seeded by backend migration 0060),
   so they are planted like every other server list rather than read out of the
   bundled file. What is STORED is still the sentence somebody picked. */
const DEACTIVATE_REASONS = [
  {"key": "asked_to_close", "label": "Member asked to close the account"},
  {"key": "duplicate", "label": "Duplicate account"},
  {"key": "internal", "label": "Internal / demo account"},
  {"key": "abuse", "label": "Abuse — permanent"},
];
/* BEFORE users/vocabularies/ ANSWERS the handle rules refuse nothing the server
   has not said: no length, no reserved word. The server refuses on its own. */
ok("an unread handle rule refuses nothing",
  [S.USERNAME_RULES.min, S.USERNAME_RULES.max, S.RESERVED_USERNAMES.length, S.usernameError("ab"), S.usernameError("admin")],
  [0, null, 0, "", ""]);
S.applyUsersVocab(USERS_VOCAB);
S.applyFacetOptions(SELLER_OPTIONS, TAXONOMY);
S.applyDeactivateReasons(DEACTIVATE_REASONS);

/* THE ROWS COME FROM THE SERVER NOW TOO (GET /admin/platform-users/), so the
   module starts with no users at all and a clock that is the browser's. This
   plants the seed as "the page that arrived" and the seed's own instant as the
   server's date, through the same two setters the live read uses -- so every
   derivation below is asserted on exactly the path the screens take. Rows planted
   without a `completeness` key are graded here against the profile schema,
   which is what this file has always checked. */
S.applyServerDate(usersDoc.asOf);
/* The server sends invoices as {id, number}; the seed still holds bare numbers. */
users.forEach((u) => {
  const { invoiceRefs, ...rest } = u.commercial;
  u.commercial = { ...rest, invoices: (invoiceRefs || []).map((n, i) => ({ id: i + 1, number: n })) };
});
S.applyUsersPage(users);
const all = users.map((u) => S.toRow(u));
const byId = {};
all.forEach((r) => { byId[r.user.userId] = r; });
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------- seed truth ---
   Recomputed HERE, from the JSON, without calling store.ts — so the
   comparisons below are two independent answers meeting, not one answer
   quoted twice. Hard-coding these numbers is how a suite starts failing every
   time somebody adds a user, which trains people to edit the test. */
const REQUIRED = USERS_VOCAB.profileFields.filter((f) => f.required);
const isEmpty = (v) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const gapsOf = (u) => REQUIRED.filter((f) => isEmpty(u.profile[f.key])).map((f) => f.label);
const SEED = {
  total: users.length,
  active: users.filter((u) => u.userStatus !== "deactivated").length,
  deactivated: users.filter((u) => u.userStatus === "deactivated").length,
  incomplete: users.filter((u) => gapsOf(u).length > 0).length,
};
const INCOMPLETE_IDS = users.filter((u) => gapsOf(u).length > 0).map((u) => u.userId).sort();

console.log("\nthe seed is big enough for the assertions below to mean anything");
/* A suite that would pass on an empty fixture is a suite asserting nothing.
   These are the floors every count assertion below leans on. */
ok("there are users to count", SEED.total >= 20, true);
ok("...at least one deactivated account, or every status check is vacuous",
  SEED.deactivated >= 1, true);
ok("...at least one incomplete profile, likewise", SEED.incomplete >= 1, true);
ok("...and not everybody is incomplete", SEED.incomplete < SEED.total, true);
ok("the profile schema actually requires something", REQUIRED.length > 0, true);
ok("every userStatus in the seed is one of the two the type allows",
  Array.from(new Set(users.map((u) => u.userStatus))).sort(), ["active", "deactivated"]);

/* ===================================================== the one derivation ===
   Two answers, read from one stored fact. The six-way membership
   classification is gone and nothing may quietly reintroduce it. */
console.log("\nclassification: two answers, and it reads exactly one stored field");
ok("classify takes a user and nothing else", S.classify.length, 1);
ok("toRow takes a user and nothing else", S.toRow.length, 1);
ok("the vocabulary offers exactly two classifications",
  S.CLASSIFICATIONS.map((c) => c.key), ["active", "deactivated"]);
ok("every row classifies as one of them",
  Array.from(new Set(all.map((r) => r.classification))).sort(), ["active", "deactivated"]);
ok("...and it agrees with the stored account status on every single user",
  all.filter((r) => r.classification !== (r.user.userStatus === "deactivated" ? "deactivated" : "active"))
    .map((r) => r.user.userId), []);
ok("no user record carries a stored classification column",
  users.filter((u) => "classification" in u || "classification" in u.profile).map((u) => u.userId), []);

{
  /* THE FIELD, AND ONLY THE FIELD. Everything else about this user is
     emptied — no tags, no notes, no activity, no commercial links — and a
     `deactivatedAt` is left behind from a previous life. None of it may move
     the answer; the one word does. */
  const probe = clone(users[0]);
  probe.userStatus = "active";
  probe.deactivatedAt = "2020-01-01T00:00:00+05:30";
  probe.deactivatedReason = "a stale field from an earlier life";
  probe.lastActivityAt = null;
  probe.tags = [];
  probe.notes = [];
  probe.commercial = { salesOwner: null, dealRefs: [], invoices: [] };
  ok("a stale deactivatedAt does not deactivate anybody", S.classify(probe), "active");
  probe.userStatus = "deactivated";
  ok("...and the status word alone does", S.classify(probe), "deactivated");
  /* There is no third answer, so anything that is not the word falls to
     active rather than rendering a pill with no label. */
  ok("an unrecognised status is not a third classification",
    S.classify({ ...probe, userStatus: "active_member" }), "active");
  ok("a deactivated account keeps its profile and its notes",
    [!!byId["IB-U-0601"].user.profile, byId["IB-U-0601"].user.notes.length > 0],
    [true, true]);
}

/* THE COMMERCIAL RELATIONSHIP IS SOMEBODY ELSE'S. Not "not shown" — not
   present. These are the assertions that stop it growing back one convenience
   reader at a time. */
console.log("\nthis module holds no membership, and has no way to answer one");
ok("the module ships no memberships fixture",
  fs.existsSync("src/content/users/memberships.json"), false);
ok("...and no plan catalogue of its own",
  fs.existsSync("src/content/users/membership-plans.json"), false);
{
  const exp = Object.keys(S);
  /* Present-tense check: these prove the export list is real, so the absences
     below are absences and not a typo in the test. */
  ok("the store still exports the readers it does have",
    ["readUsers", "readUser", "toRow", "classify"].filter((k) => exp.indexOf(k) < 0), []);
  /* Both halves: the pattern catches anything new that reads like a
     membership, and the roll-call catches the specific twelve that were here,
     several of which the pattern alone would miss (`historyOf`, `clashFor`,
     `effectiveStatus`, `allowedActions`) — which is exactly why both are
     needed rather than either. */
  ok("...and exports nothing that reads like a membership",
    exp.filter((k) => /member|plan|lifecycle|entitle|renew|assign|cycle|term/i.test(k)), []);
  ok("...nor any of the twelve that used to do it by name",
    ["readMemberships", "readMembership", "historyOf", "liveTermsOf", "effectiveStatus",
      "allowedActions", "assignMembership", "lifecycle", "plansInUse", "isSellable",
      "defaultCycleOf", "clashFor", "planCodeOf", "MEMBER_CLASSES", "fieldApplies"]
      .filter((k) => k in S), []);
  const seedText = fs.readFileSync(require.resolve("./fixtures/users.cjs"), "utf8");
  ok("no user record carries a plan, a term or an entitlement",
    users.filter((u) => ["membership", "memberships", "activeMembershipId", "planId",
      "planCode", "planName", "entitlements", "termNo"]
      .some((k) => k in u || k in u.profile)).map((u) => u.userId), []);
  ok("...and the word does not survive as a field name anywhere in the file",
    /"(activeMembershipId|planCode|planName|entitlements|termNo)"\s*:/.test(seedText), false);
}

/* ============================================================== counts === */
console.log("\ncounts, and the strip that reads them");
const c = S.countsOf(all);
ok("Counts has exactly four figures and no fifth",
  Object.keys(c).sort(), ["active", "deactivated", "incompleteProfiles", "total"]);
ok("total is the whole seed", c.total, SEED.total);
ok("active is every account that is not disabled", c.active, SEED.active);
ok("deactivated is the rest", c.deactivated, SEED.deactivated);
ok("...and the two account for everybody, with nothing double-counted",
  c.active + c.deactivated, c.total);
/* INCOMPLETE IS GRADED, NOT STORED. It is the required half of the profile
   schema measured against each profile — never `profileStatus`, which is a
   publication state and disagrees with the grade in the seed (see the re-grade
   block). Recomputed here from vocabularies.json to prove which of the two
   the store is actually reading. */
ok("incomplete profiles are graded against the required schema fields",
  c.incompleteProfiles, SEED.incomplete);
ok("...naming exactly the profiles with a required field empty",
  all.filter((r) => r.completeness < 100).map((r) => r.user.userId).sort(), INCOMPLETE_IDS);
ok("...and it is not simply counting the stored profileStatus",
  c.incompleteProfiles === users.filter((u) => u.profile.profileStatus !== "published").length, false);
ok("an empty population counts to zero rather than throwing",
  S.countsOf([]), { total: 0, active: 0, deactivated: 0, incompleteProfiles: 0 });
/* Counted off the rows it is HANDED, so the same function serves the strip
   (whole set) and any caller that wants a subset. */
{
  const dead = all.filter((r) => r.classification === "deactivated");
  ok("countsOf counts the rows it is given, not the store",
    [S.countsOf(dead).total, S.countsOf(dead).active, S.countsOf(dead).deactivated],
    [SEED.deactivated, 0, SEED.deactivated]);
}

console.log("\nthe view band has one figure: the server's total, not a readout of the search");
const band = S.bandCounts({ totalUsers: 167, activeUsers: 166, asOf: "2026-09-11" });
ok("bandCounts answers for the Users face and nothing else", Object.keys(band), ["users"]);
ok("...with the server's platform-user total behind it", band.users, 167);
ok("...and no number at all before the count arrives", S.bandCounts(null).users, null);
ok("a search genuinely narrows the list", S.applyFilters(all, { q: "sharma" }).length < all.length, true);

/* ============================================================= filters === */
console.log("\nfilters agree with the counts they are drawn from");
ok("status=active returns exactly the Active cell",
  S.applyFilters(all, { status: "active" }).length, c.active);
ok("status=deactivated returns exactly the Deactivated cell",
  S.applyFilters(all, { status: "deactivated" }).length, c.deactivated);
ok("flag=incomplete returns exactly the Incomplete cell",
  S.applyFilters(all, { flag: "incomplete" }).length, c.incompleteProfiles);
ok("...and names the same rows the strip would open",
  S.applyFilters(all, { flag: "incomplete" }).map((r) => r.user.userId).sort(), INCOMPLETE_IDS);
ok("no filter at all is everybody", S.applyFilters(all, {}).length, all.length);

/* THE WITHDRAWN FILTERS. `cls`, `flag=expiring`, `flag=pending` and the
   `view=members` face all read a membership. They are not "hidden" — they are
   inert, which is what a stale bookmark must find. The positive assertions
   above are what make these meaningful: a filter key this function understands
   DOES narrow, so a key it ignores returning everybody is a real result and
   not the function failing open. */
console.log("\na stale membership link narrows nothing rather than lying");
[["cls=active_member", { cls: "active_member" }],
 ["cls=former_member", { cls: "former_member" }],
 ["cls=normal", { cls: "normal" }],
 ["flag=expiring", { flag: "expiring" }],
 ["flag=pending", { flag: "pending" }],
 ["flag=ended", { flag: "ended" }],
 ["view=members", { view: "members" }],
 ["term=IB-MB-0912-3", { term: "IB-MB-0912-3" }]].forEach((pair) => {
  ok(pair[0] + " is inert", S.applyFilters(all, pair[1]).length, all.length);
});
ok("...while the flag that survives still narrows",
  S.applyFilters(all, { flag: "incomplete" }).length < all.length, true);

console.log("\nsearch finds somebody by whatever the caller is holding");
const meera = byId["IB-U-0912"];
["+91 98450 11902", "9845011902", "98450 11902", "11902"].forEach((q) => {
  ok('q="' + q + '" finds Meera however the number is written',
    S.applyFilters(all, { q: q }).some((r) => r === meera), true);
});
ok('q="IB-U-0912" finds her by user id',
  S.applyFilters(all, { q: "IB-U-0912" }).map((r) => r.user.userId), ["IB-U-0912"]);
ok('q="meera-studio-interiors" finds her by the address on her profile',
  S.applyFilters(all, { q: "meera-studio-interiors" }).map((r) => r.user.userId), ["IB-U-0912"]);
ok('q="koramangala" finds her by a city inside a coverage row',
  S.applyFilters(all, { q: "koramangala" }).map((r) => r.user.userId), ["IB-U-0912"]);
ok('q="DL-3310" finds whoever holds that deal reference',
  S.applyFilters(all, { q: "DL-3310" }).map((r) => r.user.userId), ["IB-U-1041"]);
ok('q="INV-2025-0447" finds whoever holds that invoice reference',
  S.applyFilters(all, { q: "INV-2025-0447" }).map((r) => r.user.userId), ["IB-U-0912"]);
ok("an email matches",
  S.applyFilters(all, { q: meera.user.identity.email }).map((r) => r.user.userId), ["IB-U-0912"]);
ok("a business name matches",
  S.applyFilters(all, { q: "Meera Studio Interiors LLP" }).map((r) => r.user.userId), ["IB-U-0912"]);
ok("search is case-insensitive",
  S.applyFilters(all, { q: "MEERA STUDIO INTERIORS LLP" }).length,
  S.applyFilters(all, { q: "meera studio interiors llp" }).length);
ok("an empty search is not a filter", S.applyFilters(all, { q: "   " }).length, all.length);
/* The sentinel is a claim, not a place. Every whole-state profile would be a
   hit for the word "all" if it were in the haystack. */
ok('searching "all cities" surfaces nobody', S.applyFilters(all, { q: "all cities" }).length, 0);
/* WHAT SEARCH NO LONGER REACHES. A membership id and a plan name were both in
   the haystack; neither exists to be found now, and a search for one must come
   back empty rather than fuzzy-matching something else. */
["IB-MB-0912-3", "IB-MB", "Growth", "Starter"].forEach((q) => {
  ok('q="' + q + '" finds nothing — there is no membership to find',
    S.applyFilters(all, { q: q }).length, 0);
});

console.log("\nthe city filter reads coverage, not an address");
ok("a named city finds everyone who covers it",
  S.applyFilters(all, { city: "Mumbai" }).map((r) => r.user.userId).sort(),
  all.filter((r) => r.user.profile.targetAreas.some((t) =>
    t.state === "Mumbai" || t.cities.indexOf("Mumbai") >= 0
    || (t.cities.indexOf(S.ALL_CITIES) >= 0
        && (S.STATE_CITIES[t.state] || []).indexOf("Mumbai") >= 0)))
    .map((r) => r.user.userId).sort());
ok("a whole-state row answers for a city it never listed",
  S.applyFilters(all, { city: "Jaipur" }).map((r) => r.user.userId), ["IB-U-0944"]);
ok("...and for the state itself",
  S.applyFilters(all, { city: "Rajasthan" }).map((r) => r.user.userId), ["IB-U-0944"]);
ok("a city nobody covers returns nothing",
  S.applyFilters(all, { city: "Atlantis" }).length, 0);

console.log("\nthe other filters, each against its own recount of the seed");
S.REGISTRATION_SOURCES.forEach((s) => {
  ok("src=" + s.key + " matches the seed",
    S.applyFilters(all, { src: s.key }).length,
    users.filter((u) => u.registrationSource === s.key).length);
});
S.TAGS.forEach((t) => {
  ok("tag=" + t.slug + " matches the seed",
    S.applyFilters(all, { tag: t.slug }).length,
    users.filter((u) => u.tags.some((x) => x.slug === t.slug)).length);
});
ok("two filters intersect rather than either one winning",
  S.applyFilters(all, { status: "active", flag: "incomplete" }).length,
  all.filter((r) => r.classification === "active" && r.completeness < 100).length);

console.log("\nregistration windows are measured against the seed's own clock");
{
  const days = (iso) => Math.round((S.NOW - new Date(iso).getTime()) / S.DAY);
  [["today", 1], ["7d", 7], ["30d", 30], ["90d", 90]].forEach((pair) => {
    ok("registered=" + pair[0] + " counts the window, not the calendar",
      S.applyFilters(all, { registered: pair[0] }).length,
      users.filter((u) => days(u.registeredAt) <= pair[1]).length);
  });
  /* "This year" is the CALENDAR year, not the last 366 days — the label says
     so, and a January reader expects January onwards. */
  const yr = new Date(S.NOW).getFullYear();
  ok("registered=year is the calendar year",
    S.applyFilters(all, { registered: "year" }).length,
    users.filter((u) => new Date(u.registeredAt).getFullYear() === yr).length);
  ok("...which is not the same set as the last 366 days",
    S.applyFilters(all, { registered: "year" }).length
      !== users.filter((u) => days(u.registeredAt) <= 366).length, true);
  const custom = { registered: "custom", from: "2026-01-01", to: "2026-08-01" };
  ok("a custom range is inclusive of both ends",
    S.applyFilters(all, custom).length,
    users.filter((u) => {
      const t = new Date(u.registeredAt).getTime();
      return t >= new Date("2026-01-01T00:00:00").getTime()
        && t <= new Date("2026-08-01T23:59:59").getTime();
    }).length);
  ok("...and an open-ended one is open at that end",
    S.applyFilters(all, { registered: "custom", from: "2026-01-01" }).length
      > S.applyFilters(all, custom).length, true);
  ok("a custom range with neither bound is everybody",
    S.applyFilters(all, { registered: "custom" }).length, all.length);
  ok("every range in the vocabulary is one applyFilters understands",
    S.REGISTERED_RANGES.filter((r) => r.key !== "custom")
      .filter((r) => S.applyFilters(all, { registered: r.key }).length > all.length)
      .map((r) => r.key), []);
}

/* ============================================================= sorting === */
console.log("\nthe default order answers \"what needs doing\"");
{
  const def = S.applySort(all, undefined);
  ok("nothing is lost or duplicated by sorting", def.length, all.length);
  const score = (r) => (r.classification === "deactivated" ? 2 : r.completeness < 100 ? 0 : 1);
  ok("incomplete live accounts lead, then everyone else, then the disabled",
    def.map(score), def.map(score).slice().sort());
  ok("...so the first row is an incomplete live account",
    [def[0].classification, def[0].completeness < 100], ["active", true]);
  /* A deactivated account with an unfinished profile is NOT the thing to go
     and fix. It sorts last with the rest of the disabled, and the order of
     those two tests inside attentionScore is the whole reason. */
  ok("...and a deactivated account does not jump the queue by being incomplete",
    def[def.length - 1].classification, "deactivated");
  const band1 = def.filter((r) => score(r) === 1).map((r) => new Date(r.user.registeredAt).getTime());
  ok("inside a band the newest registration leads",
    band1.slice().sort((a, b) => b - a), band1);
}
console.log("\nand the three named orders do what they are named");
ok("sort=recent is newest registration first",
  S.applySort(all, "recent").map((r) => new Date(r.user.registeredAt).getTime()),
  users.map((u) => new Date(u.registeredAt).getTime()).sort((a, b) => b - a));
ok("sort=activity is most recently seen first",
  S.applySort(all, "activity")[0].user.userId,
  all.slice().sort((a, b) =>
    new Date(b.user.lastActivityAt || 0).getTime()
      - new Date(a.user.lastActivityAt || 0).getTime())[0].user.userId);
ok("sort=name is A to Z on the person, not the id",
  S.applySort(all, "name").map((r) => r.user.identity.name),
  users.map((u) => u.identity.name).sort((a, b) => a.localeCompare(b)));
/* `ending` sorted by the term's end date. There is no term, so the option is
   gone from the vocabulary and the key falls back to the default order —
   which is what an old bookmark has to get. */
ok("sort=ending is gone from the options",
  S.SORT_OPTIONS.map((o) => o.key), ["", "recent", "activity", "name"]);
ok("...and an unknown sort key falls back to the default order",
  S.applySort(all, "ending").map((r) => r.user.userId),
  S.applySort(all, undefined).map((r) => r.user.userId));
ok("...which is not the same as any of the named ones",
  S.applySort(all, "ending").map((r) => r.user.userId).join()
    !== S.applySort(all, "recent").map((r) => r.user.userId).join(), true);
ok("every sort the dropdown offers is one applySort implements",
  S.SORT_OPTIONS.filter((o) => o.key)
    .filter((o) => S.applySort(all, o.key).map((r) => r.user.userId).join()
      === S.applySort(all, undefined).map((r) => r.user.userId).join())
    .map((o) => o.key), []);

console.log("\npagination cannot walk off either end");
{
  const pages = Math.ceil(all.length / S.PAGE_SIZE);
  ok("a full page is PAGE_SIZE rows", S.paginate(all, 1).rows.length, Math.min(S.PAGE_SIZE, all.length));
  ok("the page count is derived from the row count", S.paginate(all, 1).pages, pages);
  ok("page 0 clamps to the first page", S.paginate(all, 0).pageNo, 1);
  ok("a page past the end clamps to the last", S.paginate(all, 999).pageNo, pages);
  ok("the total is the unpaginated count, so the pager can say `of`",
    S.paginate(all, 2).total, all.length);
  ok("every row appears on exactly one page",
    Array.from({ length: pages }, (_, i) => S.paginate(all, i + 1).rows.length)
      .reduce((a, b) => a + b, 0), all.length);
  ok("an empty result is still one page, not zero", S.paginate([], 1).pages, 1);
}

/* ======================================================== completeness === */
console.log("\nprofile completeness is graded against the schema, not guessed");
ok("a complete business profile is 100", byId["IB-U-0912"].completeness, 100);
ok("a bare registration is not", byId["IB-U-1029"].completeness < 100, true);
ok("...and names what is missing rather than only a percentage",
  byId["IB-U-1029"].missingFields.slice().sort(), REQUIRED.map((f) => f.label).sort());
ok("the missing list is the schema's LABELS, which is what a caller can read out",
  byId["IB-U-1029"].missingFields.indexOf("Business name") >= 0, true);
ok("every row's percentage matches its own missing list",
  all.filter((r) => r.completeness
    !== Math.round(((REQUIRED.length - r.missingFields.length) / REQUIRED.length) * 100))
    .map((r) => r.user.userId), []);
ok("a complete profile has nothing missing",
  all.filter((r) => r.completeness === 100 && r.missingFields.length).map((r) => r.user.userId), []);
ok("a required field holding only whitespace is not an answer",
  S.completenessOf({ ...byId["IB-U-0912"].user.profile, businessName: "" }).pct < 100, true);

/* =============================================================================
   THE WRITES. Every one of them is an endpoint now (PATCH platform-users/<pk>/,
   PUT .../tags/, POST .../status/), so what is asserted here is what the store
   refuses BEFORE it reaches the network — the rules an import or a bulk edit
   would otherwise get past, and the ones that make "nothing has been saved" a
   true sentence. What a save actually stores is asserted against the real
   server in interior_admin/tests/test_users_writes.py.
   ============================================================================= */
later(async () => {
  console.log("\nthe profile write refuses before it reaches the network");
  S.resetStore();
  ok("a non-editable key is refused whole",
    (await S.updateProfile("IB-U-0912", { profileId: "HACK" })).indexOf("Not editable") >= 0, true);
  ok("...and the refusal names the key so it can be fixed",
    (await S.updateProfile("IB-U-0912", { profileId: "HACK" })).indexOf("profileId") >= 0, true);
  ok("...and nothing changed", S.readUser("IB-U-0912").profile.profileId !== "HACK", true);
  ok("an unknown user is refused",
    (await S.updateProfile("IB-U-NOPE", { about: "x" })).indexOf("no longer exists") >= 0, true);
  ok("a malformed area row is refused, not thrown on",
    S.validateFacets({ targetAreas: [{ state: "Karnataka" }] }).indexOf("at least one city") >= 0, true);
  /* A PATCH THAT MOVES NOTHING IS NOT A REQUEST. It returns clean without
     touching the network, which is also what keeps an audit line off somebody's
     timeline saying an admin edited their profile when nobody did. */
  ok("a patch that changes nothing is accepted without a call",
    await S.updateProfile("IB-U-0912", { about: S.readUser("IB-U-0912").profile.about }), "");
  ok("an unknown business type is refused at the store, not only in the dialog",
    (await S.updateProfile("IB-U-0912", { businessType: "not_a_type" }))
      .indexOf("not one of the allowed") >= 0, true);
  /* PARTIAL WRITES DO NOT EXIST. One good field beside one bad one saves
     neither — the endpoint refuses the whole patch (UM-T07) and so does this,
     before it is even sent. */
  ok("one bad field takes the whole patch down",
    (await S.updateProfile("IB-U-0912", { about: "A perfectly good sentence.", businessType: "wizard" }))
      !== "", true);
  ok("...including the field that was fine",
    S.readUser("IB-U-0912").profile.about !== "A perfectly good sentence.", true);
  ok("the store refuses a username another profile holds",
    (await S.updateProfile("IB-U-1041", { username: "meera-studio-interiors" }))
      .indexOf("belongs to another profile") >= 0, true);
  ok("...and nothing was saved on the way past it",
    S.readUser("IB-U-1041").profile.username !== "meera-studio-interiors", true);

  console.log("\na note is an endpoint now, and it refuses before it reaches one");
  /* THERE IS A NOTES MODEL (interior_admin Note, subjectType `platform_user`).
     What is asserted here is the refusals this side owns; the stored outcome —
     the author, the audit line, and who may change one — is asserted against the
     real server in interior_admin/tests/test_users_writes.py NoteTests. */
  ok("an empty note is refused",
    (await S.addNote("IB-U-0912", "   ")).indexOf("needs some text") >= 0, true);
  ok("...and nothing is kept in the tab either",
    S.readUser("IB-U-0912").notes.filter((n) => n.text.indexOf("profile chase") >= 0).length, 0);
  ok("an unknown user is refused first",
    (await S.addNote("IB-U-NOPE", "hello")).indexOf("no longer exists") >= 0, true);

  console.log("\ntags are a closed list, and a no-op change is not a request");
  S.resetStore();
  ok("setting the tags already held changes nothing",
    await S.setTags("IB-U-0912", S.readUser("IB-U-0912").tags.map((t) => t.slug)), "");
  ok("an unknown slug takes the whole call down",
    (await S.setTags("IB-U-0912", S.readUser("IB-U-0912").tags.map((t) => t.slug).concat(["not-a-tag"])))
      .indexOf("closed list") >= 0, true);
  ok("...leaving the tags exactly as they were",
    S.readUser("IB-U-0912").tags.some((t) => t.slug === "not-a-tag"), false);
  ok("an unknown user is refused", (await S.setTags("IB-U-NOPE", [])).indexOf("no longer exists") >= 0, true);
  /* The CATALOGUE is a different thing from the tags on one account. */
  ok("a tag with no label is refused", (await S.createTag({ label: "  " })).indexOf("needs a label") >= 0, true);

  console.log("\nan account status needs a reason, and it stops at this module");
  S.resetStore();
  ok("deactivating without a reason is refused",
    (await S.setUserStatus("IB-U-0912", "deactivated", "  ")).indexOf("needs a reason") >= 0, true);
  ok("...and the account is untouched", S.readUser("IB-U-0912").userStatus, "active");
  ok("setting the status it already has is not a request",
    await S.setUserStatus("IB-U-0912", "active", ""), "");
  ok("an unknown user is refused",
    (await S.setUserStatus("IB-U-NOPE", "deactivated", "x")).indexOf("no longer exists") >= 0, true);
  /* THE REASON LIST IS ROWS NOW (PanelVocab, scope `user_deactivate_reason`).
     The reason itself is still stored as free text on CustomUser.deactivatedReason
     and repeated on the audit line — only the suggestions moved. */
  ok("the deactivate reasons are the server's list",
    S.VOCAB.deactivateReasons, DEACTIVATE_REASONS.map((r) => r.label));
  ok("...and the bundled file has stopped carrying them",
    "deactivateReasons" in vocab, false);
});

/* ======================================================= the audit, drawn ===
   AN AUDIT ROW CARRIES NO COLOUR and there is no column to put one in. The
   panel derives the tone from what the row DOES carry — the server's verb and
   the same `destructive` rule the trail's own severity filter counts with — so
   an action added to any module renders correctly the day it is written. */
console.log("\nthe audit tone is derived from the row, not stored on it");
{
  const tone = (e) => S.auditTone(Object.assign({ verb: "changed", destructive: false, synthetic: false }, e));
  ok("a destructive action draws as a hard stop", tone({ destructive: true }), "stop");
  ok("...and so does anything the server calls a removal", tone({ verb: "removed" }), "stop");
  ok("an approval is the good outcome", tone({ verb: "approved" }), "ok");
  ok("a refusal warns", tone({ verb: "refused" }), "warn");
  ok("an ordinary change claims no colour at all", tone({ verb: "updated" }), "");
  /* Registration is not an admin action — nobody in the console did it — so it
     is drawn as a system fact, which is how the bundled list drew it too. */
  ok("the registration line is a system fact", tone({ synthetic: true, verb: "created" }), "sys");
  ok("the event types are learned from the rows, so they start empty",
    S.VOCAB.eventTypes, []);
  ok("the module ships no audit fixture to draw them from",
    fs.existsSync("src/content/users/audit.json"), false);
  ok("...and no analytics fixture either",
    fs.existsSync("src/content/users/analytics.json"), false);
  ok("...and the bundled vocabulary has stopped carrying event types",
    "eventTypes" in vocab, false);
}

console.log("\nthe page is restorable, because a demo gets walked twice");
{
  S.resetStore();
  ok("reset returns the page exactly as the server sent it",
    JSON.stringify(S.readUsers()), JSON.stringify(users.map((u) => S.readUser(u.userId))));
}

/* ===================================================== the business facets ===
   Business type, Deals in and the rest are what the marketplace filters and
   ranks on. One unrecognised key is a profile that quietly stops appearing
   under anything — a failure with no error message and no visible symptom
   until somebody asks why a listed business gets no enquiries. So: the
   vocabularies have to be internally sound, the seed has to be inside them,
   and the write path has to refuse everything else. */
console.log("\nthe facet vocabularies are sound");
S.resetStore();
{
  const dupes = (list, k) => {
    const seen = {};
    return list.filter((x) => (seen[x[k]] ? true : ((seen[x[k]] = 1), false)));
  };
  const field = (k) => S.PROFILE_FIELDS.filter((f) => f.key === k)[0];
  const keysOf = (k) => S.optionsFor(field(k)).map((o) => o.key);
  const BUSINESS_TYPES = S.optionsFor(field("businessType"));
  const SEGMENTS = S.optionsFor(field("segments"));
  const CATEGORIES = S.optionsFor(field("categories"));
  ok("business types have unique keys", dupes(BUSINESS_TYPES, "key").length, 0);
  ok("segments have unique keys", dupes(SEGMENTS, "key").length, 0);
  ok("categories have unique keys, across the three lists they merge",
    dupes(CATEGORIES, "key").length, 0);
  /* A category whose group is misspelled renders under no heading, which in a
     grouped listbox means it does not render at all. */
  const groupKeys = S.groupsFor(field("categories")).map((g) => g.key);
  ok("every category sits in a declared group",
    CATEGORIES.filter((x) => groupKeys.indexOf(x.group) < 0).map((x) => x.key), []);
  ok("both groups are actually used",
    groupKeys.filter((g) => !CATEGORIES.some((x) => x.group === g)), []);
  ok("keyword suggestions are unique",
    keysOf("searchKeywords").length, S.dedupeKeywords(keysOf("searchKeywords")).length);
  /* The label is the fallback when a key is missing, so an empty one would
     render a blank chip that cannot be told from a bug. */
  ok("nothing is missing a label",
    BUSINESS_TYPES.concat(SEGMENTS).concat(CATEGORIES).filter((o) => !o.label).length, 0);

  /* THE OPTION KEY IS THE STORED VALUE. The record sends each facet as
     {value, label}; the picker, the stale-chip flag and the validator all
     compare against `key`, so the mapping has to be value -> key, untouched. */
  ok("business types are seller-options businessTypes, value for key",
    BUSINESS_TYPES.map((o) => o.key), SELLER_OPTIONS.businessTypes.map((o) => o.value));
  ok("dealsIn is businessModels without `both`, which the record expands",
    keysOf("dealsIn"), ["products", "services"]);
  ok("...carrying the server's description as the hint",
    S.optionsFor(field("dealsIn"))[0].hint, SELLER_OPTIONS.businessModels[0].meta.desc);
  ok("positioning is serviceSegments",
    keysOf("positioning"), SELLER_OPTIONS.serviceSegments.map((o) => o.value));
  ok("keyword suggestions are serviceKeywords",
    keysOf("searchKeywords"), SELLER_OPTIONS.serviceKeywords.map((o) => o.value));
  ok("states are seller-options states, keyed by name",
    S.STATES.map((o) => o.key), SELLER_OPTIONS.states.map((o) => o.value));
  ok("segments are the taxonomy's", keysOf("segments"), TAXONOMY.segments.map((o) => o.value));
  ok("categories are the taxonomy's, then productCategories, then serviceCategories",
    CATEGORIES.map((o) => o.key),
    TAXONOMY.categories.filter((o) => o.isActive).map((o) => o.value)
      .concat(SELLER_OPTIONS.productCategories.map((o) => o.value))
      .concat(SELLER_OPTIONS.serviceCategories.map((o) => o.value)));
  ok("...a hidden taxonomy row is not suggested", keysOf("categories").indexOf("hidden_category"), -1);
  ok("...and the service categories are the sector group",
    CATEGORIES.filter((o) => o.group === "sector").map((o) => o.key),
    SELLER_OPTIONS.serviceCategories.map((o) => o.value));
  /* A refused taxonomy read (its own permission) empties only what it feeds. */
  S.applyFacetOptions(SELLER_OPTIONS, null);
  ok("without taxonomy, segments are empty and categories keep the seller-options lists",
    [keysOf("segments").length, keysOf("categories").length],
    [0, SELLER_OPTIONS.productCategories.length + SELLER_OPTIONS.serviceCategories.length]);
  S.applyFacetOptions(SELLER_OPTIONS, TAXONOMY);

  /* COLOUR-BY-FACET. The chip tone is declared per FIELD and the CSS restates
     each used tone by name, so the contract is: every declared tone is one the
     stylesheet knows, and every facet that renders chips declares one. A tone
     the CSS does not restate silently falls back to brand tint — wrong colour,
     no error. */
  const KNOWN_TONES = ["tag-violet", "tag-green", "tag-blue", "tag-amber",
    "tag-teal", "tag-slate", "tag-pink", "tag-orange"];
  const chipped = S.PROFILE_FIELDS.filter((f) => f.chip);
  ok("every declared chip tone is one the stylesheet restates",
    chipped.filter((f) => KNOWN_TONES.indexOf(f.chip) < 0).map((f) => f.key), []);
  ok("every chip-rendering facet declares a tone",
    S.PROFILE_FIELDS
      .filter((f) => ["single", "multi", "tags"].indexOf(f.type) >= 0 && !f.chip)
      .map((f) => f.key), []);
  /* One colour answers one question. No marketplace facet may share a tone
     with another, or the colour stops meaning anything. */
  const market = chipped.filter((f) => f.chip !== "tag-slate").map((f) => f.chip);
  ok("no two marketplace facets share a colour", market.length, new Set(market).size);
  /* And the shared Pill has to actually map each one: the module stylesheets
     went with the design-system rebuild, and a `tag-*` tone TAG_TONE does not
     name falls back to gray with no error anywhere. */
  const status = fs.readFileSync("src/admin/ui/status.tsx", "utf8");
  ok("...and each one is mapped by the shared Pill's TAG_TONE",
    chipped.map((f) => f.chip).filter((t) => status.indexOf("    " + t.replace(/^tag-/, "") + ":") < 0), []);
}

console.log("\nthe seed is inside its own vocabularies");
{
  /* The seed's facet VALUES are the old bundled keys (firm_studio,
     interior_designer), which the server's option lists never held -- live rows
     are checked against those lists instead, above. What the seed still answers
     for is everything that is not a facet option. */
  const seeded = S.readUsers();
  ok("no unknown registration source",
    seeded.filter((u) => !S.REGISTRATION_SOURCES.some((s) => s.key === u.registrationSource))
      .map((u) => u.userId), []);
  ok("no unknown tag slug",
    seeded.filter((u) => u.tags.some((t) => !S.TAGS.some((x) => x.slug === t.slug)))
      .map((u) => u.userId), []);
  ok("no unknown profile status",
    seeded.filter((u) => ["incomplete", "published", "hidden"].indexOf(u.profile.profileStatus) < 0)
      .map((u) => u.userId), []);
  /* THE MIGRATION'S ONE INVARIANT. businessType and segments replaced category
     and services one for one, both required. If a profile gained or lost one
     of them, its completeness moved — and a vocabulary change would have
     silently re-graded people. */
  ok("business type and segments travel together",
    seeded.filter((u) => !!u.profile.businessType !== (u.profile.segments.length > 0))
      .map((u) => u.userId), []);
  ok("no profile exceeds the segment cap",
    seeded.filter((u) => u.profile.segments.length > 6).map((u) => u.userId), []);
  ok("no profile exceeds the keyword cap",
    seeded.filter((u) => u.profile.searchKeywords.length > 12).map((u) => u.userId), []);
  /* IDENTITY IS THE POINT OF THIS MODULE, so the things that identify somebody
     have to be unique across it. A duplicate here is two records for one
     person, which is the failure a directory exists to prevent. */
  const dup = (get) => {
    const seen = {}, bad = [];
    seeded.forEach((u) => {
      const k = get(u);
      if (!k) return;
      if (seen[k]) bad.push(u.userId); else seen[k] = 1;
    });
    return bad;
  };
  ok("user ids are unique", dup((u) => u.userId), []);
  ok("auth identities are unique", dup((u) => u.authUserId), []);
  ok("profile ids are unique", dup((u) => u.profile.profileId), []);
  ok("emails are unique", dup((u) => (u.identity.email || "").toLowerCase()), []);
  ok("phone numbers are unique on the last ten digits",
    dup((u) => (u.identity.phone || "").replace(/\D/g, "").slice(-10)), []);
  ok("usernames are unique", dup((u) => (u.profile.username || "").toLowerCase()), []);
}

console.log("\nthe closed lists actually close");
S.resetStore();
{
  const bad = (patch) => S.validateFacets(patch) !== "";
  const segKeys = S.optionsFor(S.PROFILE_FIELDS.filter((f) => f.key === "segments")[0]).map((o) => o.key);
  ok("a real business type is fine", bad({ businessType: "Manufacturer" }), false);
  ok("an invented one is not", bad({ businessType: "wizard" }), true);
  ok("...and neither is the old bundled key", bad({ businessType: "manufacturer" }), true);
  ok("clearing it is allowed", bad({ businessType: null }), false);
  ok("real segments are fine", bad({ segments: ["lShapedModularKitchen", "space_planning"] }), false);
  /* Open now, like categories: a trade nobody listed is typed, not refused. */
  ok("a segment nobody listed is accepted", bad({ segments: ["space_planning", "Pergola work"] }), false);
  ok("...but not at forty-one characters", bad({ segments: ["x".repeat(41)] }), true);
  ok("the same segment twice is refused", bad({ segments: ["space_planning", "space_planning"] }), true);
  ok("seven segments is over the cap of six", bad({ segments: segKeys.slice(0, 7) }), true);
  ok("six is not", bad({ segments: segKeys.slice(0, 6) }), false);
  ok("real categories are fine", bad({ categories: ["modular_kitchens", "Residential"] }), false);
  /* OPEN, by request: type it, press Enter, it is a category. The list is a
     suggestion. What is still refused is the same value twice and a value
     longer than a label. */
  ok("a category nobody listed is accepted", bad({ categories: ["Pergola kits"] }), false);
  ok("...but not twice", bad({ categories: ["Pergola kits", "pergola kits"] }), true);
  ok("...and not at forty-one characters", bad({ categories: ["x".repeat(41)] }), true);
  ok("...and not eleven of them",
    bad({ categories: Array.from({ length: 11 }, (_, i) => "Cat " + i) }), true);

  /* Keywords are the ONE fully open facet, and openness is the point: matching
     is the job where the tail nobody enumerated is what people actually type. */
  ok("a keyword nobody suggested is accepted",
    bad({ searchKeywords: ["Jacuzzi installation"] }), false);
  ok("...but not a forty-one character one",
    bad({ searchKeywords: ["x".repeat(41)] }), true);
  ok("...and not thirteen of them",
    bad({ searchKeywords: Array.from({ length: 13 }, (_, i) => "kw " + i) }), true);
  ok("a key the patch does not name is simply not being patched",
    S.validateFacets({}), "");
  /* Every complaint is one sentence in one string — the dialog prints it as
     given, so a patch that is wrong twice has to say so twice. */
  ok("two bad facets produce two complaints",
    S.validateFacets({ businessType: "wizard", dealsIn: ["dreams"] }).split(". ").length, 2);

  ok("cleanKeyword collapses the whitespace", S.cleanKeyword("  floor   planning "), "floor planning");
  /* Case-insensitive, and the FIRST spelling survives — the one already on the
     profile, not the one somebody just typed underneath it. */
  ok("dedupe is case-insensitive and keeps the first spelling",
    S.dedupeKeywords(["Modular kitchen", "modular  kitchen", "Wardrobe design"]),
    ["Modular kitchen", "Wardrobe design"]);
  ok("...and drops the blanks rather than keeping one", S.dedupeKeywords(["a", "  ", ""]), ["a"]);
}

/* ============================================================ the username ===
   A username is an ADDRESS, not a text field with a rule on it: it is what the
   profile is reachable at, and two profiles at one URL means one of them is
   unreachable. So the rules are asserted here rather than trusted to the
   dialog — an import or a bulk edit reaches the store without passing the
   form at all. */
console.log("\nthe username is an address, and addresses are unique");
S.resetStore();
{
  const bad = (u) => S.usernameError(u) !== "";
  ok("a normal handle is fine", bad("meera-studio"), false);
  ok("digits are fine", bad("studio-360"), false);
  ok("upper case is not", bad("Meera-Studio"), true);
  ok("two characters is too short", bad("ab"), true);
  ok("three is not", bad("abc"), false);
  ok("thirty-one is too long", bad("a".repeat(31)), true);
  ok("thirty is not", bad("a".repeat(30)), false);
  ok("a leading hyphen is refused", bad("-meera"), true);
  ok("a trailing hyphen is refused", bad("meera-"), true);
  ok("a double hyphen is refused", bad("meera--studio"), true);
  ok("spaces and dots are refused", bad("meera studio"), true);
  ok("underscores are refused", bad("meera_studio"), true);
  /* A handle colliding with a storefront route would either 404 or let a
     profile sit at an address the platform speaks from. */
  ok("a reserved word is refused", bad("admin"), true);
  ok("...and so is `login`", bad("login"), true);
  /* Every reserved word has to be UNREACHABLE, which is the point of the list —
     but not necessarily by the reserved rule: `me` and `u` are under the
     minimum length and are refused before the list is ever consulted. What
     must not exist is a reserved word the validator lets through. */
  ok("no reserved word is claimable",
    S.RESERVED_USERNAMES.filter((r) => !S.usernameError(r)), []);
  ok("...and the ones long enough to reach the list are refused BY the list",
    S.RESERVED_USERNAMES.filter((r) => r.length >= S.USERNAME_RULES.min)
      .filter((r) => S.usernameError(r).indexOf("reserved") < 0), []);
  ok("an empty handle is not an ERROR, it is just absent", S.usernameError(""), "");
  ok("...and neither is whitespace", S.usernameError("   "), "");

  ok("slugify does what somebody typing a business name means",
    S.slugify("Meera Studio Interiors LLP"), "meera-studio-interiors-llp");
  ok("...including the ampersand", S.slugify("Bhatia Ply & Hardware"), "bhatia-ply-and-hardware");
  ok("...and never emits a handle its own rules refuse",
    S.usernameError(S.slugify("  ***Meera   Studio!!!  ")), "");
  ok("...nor one over the length cap",
    S.slugify("A very long business name indeed that just keeps going and going").length
      <= S.USERNAME_RULES.max, true);
  ok("every seeded business name slugs to a legal handle",
    S.readUsers().filter((u) => u.profile.businessName)
      .filter((u) => S.usernameError(S.slugify(u.profile.businessName)))
      .map((u) => u.userId), []);

  ok("a seeded handle is taken", S.usernameTaken("meera-studio-interiors"), true);
  /* The check that stops a dialog telling you your own handle is unavailable
     the moment you open it. */
  ok("...but not by its own owner", S.usernameTaken("meera-studio-interiors", "IB-U-0912"), false);
  ok("...and the check is case-insensitive", S.usernameTaken("MEERA-STUDIO-INTERIORS"), true);
  ok("an unused handle is free", S.usernameTaken("nobody-has-this"), false);
  ok("usernameFree wants all three", S.usernameFree("nobody-has-this"), true);
  ok("...and refuses a reserved one even though nobody holds it",
    S.usernameFree("admin"), false);
  ok("...and an empty one", S.usernameFree(""), false);

  const names = S.readUsers().map((u) => u.profile.username).filter(Boolean);
  ok("every seeded handle is well formed", names.filter((n) => S.usernameError(n)), []);
  ok("...and no two profiles share one", names.length, new Set(names).size);
  ok("the profile URL is built on the storefront, not the API",
    S.profileUrl("meera-studio").indexOf("/b/meera-studio") > 0, true);
  ok("...and degrades to a readable host rather than the string `undefined`",
    S.profileUrl("meera-studio").indexOf("undefined") < 0, true);

  /* UNIQUENESS IS NOT A FIELD RULE, so it is not in validateFacets: that
     answers "is this value well formed", which needs nothing but the value,
     and this one needs the whole table. This is where that seam is pinned. */
  ok("a malformed username is refused by validateFacets",
    S.validateFacets({ username: "Bad_Name" }) !== "", true);
  ok("...but uniqueness is not its job",
    S.validateFacets({ username: "meera-studio-interiors" }), "");
  /* THE LENGTH AND THE RESERVED LIST ARE THE SERVER'S (2026-09-16): the admin
     profile PATCH refuses both, and users/vocabularies/ serves them. Lower case
     is still the panel's own rule. The store refuses a taken handle before it
     calls (asserted with the other refusals above) and the SERVER refuses one
     held by an account outside the loaded page, which this browser cannot see. */
  ok("the username rules are the server's, and the help sentence is the panel's",
    [S.USERNAME_RULES.min, S.USERNAME_RULES.max, S.RESERVED_USERNAMES.length, S.USERNAME_RULES.help],
    [3, 30, 35, "Lower-case letters, numbers and hyphens."]);
}

console.log("\nnothing is conditional any more, and the schema is whole for everybody");
{
  /* Target areas WAS member-only while it was a marketing extra beside a
     registered address. It is the profile's only location now, so it applies
     to everyone — a plain user with no coverage row is invisible to every
     location filter, which is exactly what Incomplete should surface. */
  ok("no field carries a showWhen",
    S.PROFILE_FIELDS.filter((f) => f.showWhen).map((f) => f.key), []);
  /* The gate that read one is gone with it, and so is the class set it
     compared against — a schema conditional on membership cannot exist in a
     module that holds none. */
  ok("the conditional-field machinery is gone with its last user",
    ["fieldApplies", "fieldsFor", "MEMBER_CLASSES"].filter((k) => k in S), []);
  ok("so every user gets the whole schema, and the form reads it directly",
    S.PROFILE_FIELDS.length > 0, true);
  ok("every schema field declares the four things the form dispatches on",
    S.PROFILE_FIELDS.filter((f) => !f.key || !f.label || !f.group || !f.type).map((f) => f.key), []);
  ok("every field that points at a vocabulary points at one that exists",
    S.PROFILE_FIELDS.filter((f) => f.vocab && !S.optionsFor(f).length).map((f) => f.key), []);
  ok("...and every field that names option groups gets them",
    S.PROFILE_FIELDS.filter((f) => f.groups && !S.groupsFor(f).length).map((f) => f.key), []);
  /* A PICKER-BACKED FACET NEEDS A DECLARED CEILING: its list is open or long,
     so a facet with no cap is a facet everybody maxes. A `checks` field is
     bounded by its own option list instead — every option is on screen — so it
     only declares a cap when the cap is smaller than that, as Positioning
     does at two of four. */
  ok("every picker-backed facet declares a ceiling",
    S.PROFILE_FIELDS.filter((f) => ["multi", "tags"].indexOf(f.type) >= 0 && !f.max)
      .map((f) => f.key), []);
  ok("...and a checkbox facet with no declared cap is bounded by its options",
    S.PROFILE_FIELDS.filter((f) => f.type === "checks" && !f.max)
      .filter((f) => !S.validateFacets({
        [f.key]: S.optionsFor(f).map((o) => o.key).concat(["one-too-many"]),
      })).map((f) => f.key), []);
  ok("every group named by the schema is one the form lays out",
    Array.from(new Set(S.PROFILE_FIELDS.map((f) => f.group))).sort(),
    ["about", "business", "contact", "positioning"]);
  ok("the required fields are the six a usable listing needs",
    REQUIRED.map((f) => f.key),
    ["businessName", "username", "businessType", "dealsIn", "segments", "targetAreas"]);
}

console.log("\nthe re-grade is exactly the one that was asked for");
{
  const seeded = S.readUsers();
  ok("the incomplete profiles are the ones with no business profile at all",
    all.filter((r) => r.completeness < 100).map((r) => r.user.userId).sort(), INCOMPLETE_IDS);
  ok("...and every one of them is missing the business name",
    all.filter((r) => r.completeness < 100)
      .filter((r) => r.missingFields.indexOf("Business name") < 0).map((r) => r.user.userId), []);
  ok("a username exists wherever a business name does",
    seeded.filter((u) => !!u.profile.businessName !== !!u.profile.username).map((u) => u.userId), []);
  /* The removed fields must be gone from the DATA too, not just the form —
     a stored value nothing renders is a field that comes back. */
  ["portfolioUrl", "locality", "addressLine", "state", "city", "pincode", "displayName"].forEach((k) => {
    ok("`" + k + "` is gone from the seed",
      seeded.filter((u) => k in u.profile).length, 0);
  });
  ok("...and from the schema the form is built from",
    S.PROFILE_FIELDS.filter((f) => ["portfolioUrl", "locality", "addressLine", "pincode",
      "displayName", "city", "state"].indexOf(f.key) >= 0).map((f) => f.key), []);
  /* KNOWN SEED DEFECT — reported, not papered over. `profileStatus` is the
     publication state and updateProfile keeps it in step with the grade, so a
     100%-complete profile stored as "incomplete" is a row this store would
     never have written. IB-U-1038 was promoted to 100 when Pincode came out of
     the schema and its stored status was never re-stamped. Named so a second
     one cannot hide behind it. */
  ok("KNOWN GAP: exactly one stored profileStatus disagrees with its own grade",
    seeded.filter((u) => u.profile.profileStatus !== "hidden"
      && (u.profile.profileStatus === "published") !== (gapsOf(u).length === 0))
      .map((u) => u.userId), ["IB-U-1038"]);
  ok("...and it is a stale label rather than a grading bug — the profile is complete",
    byId["IB-U-1038"].completeness, 100);
  /* The structured rows are sound in the seed: every business profile states
     coverage, every state is a real key, no state repeats, no half rows. */
  ok("every business profile has at least one coverage row",
    seeded.filter((u) => u.profile.businessName && !u.profile.targetAreas.length)
      .map((u) => u.userId), []);
  const stateKeys = S.STATES.map((x) => x.key);
  ok("every row's state is a vocabulary key",
    seeded.filter((u) => u.profile.targetAreas.some((t) => stateKeys.indexOf(t.state) < 0))
      .map((u) => u.userId), []);
  ok("no profile claims one state twice",
    seeded.filter((u) => new Set(u.profile.targetAreas.map((t) => t.state)).size
      !== u.profile.targetAreas.length).map((u) => u.userId), []);
  ok("no row is a state with no cities",
    seeded.filter((u) => u.profile.targetAreas.some((t) => !t.cities.length))
      .map((u) => u.userId), []);
  ok("no profile is over the row cap or the city cap",
    seeded.filter((u) => u.profile.targetAreas.length > 5
      || u.profile.targetAreas.some((t) => t.cities.length > 8)).map((u) => u.userId), []);
  /* THE SEED HAS TO SURVIVE ITS OWN VALIDATOR. A fixture the write path would
     refuse is a fixture that demonstrates a screen nobody can save. */
  ok("every seeded coverage list would pass the rules a save applies",
    seeded.filter((u) => u.profile.targetAreas.length
      && S.validateFacets({ targetAreas: u.profile.targetAreas })).map((u) => u.userId), []);
  ok("every state in the vocabulary has city suggestions to offer",
    stateKeys.filter((k) => !S.citySuggestionsOf(k).length), []);
  ok("primaryCityOf reads the first row's first city",
    S.primaryCityOf(byId["IB-U-0912"].user.profile), "Bengaluru");
  ok("...and null where there is no coverage",
    S.primaryCityOf(byId["IB-U-1029"].user.profile), null);
  ok("...and the state where the row is a whole-state claim",
    S.primaryCityOf(byId["IB-U-0944"].user.profile), "Rajasthan");
}

console.log("\nan open facet takes what a closed one would refuse");
S.resetStore();
{
  const bad = (patch) => S.validateFacets(patch) !== "";
  const row = (state, cities) => ({ state: state, cities: cities });
  /* HALF CLOSED, HALF OPEN, per row. The state must be a vocabulary key so
     rows aggregate; the cities take anything, because "Uttam Nagar" is a real
     service area and no list holds every locality. */
  ok("a sound row is accepted", bad({ targetAreas: [row("Karnataka", ["Bengaluru"])] }), false);
  ok("a city nobody suggested is accepted",
    bad({ targetAreas: [row("Karnataka", ["Chikkaballapur"])] }), false);
  ok("an invented state is not", bad({ targetAreas: [row("Atlantis", ["Somewhere"])] }), true);
  ok("a state with no cities is a half answer, refused",
    bad({ targetAreas: [row("Karnataka", [])] }), true);
  /* NORMALISED FIRST: the caller that is not the form is exactly the one that
     hands over a row with no cities array at all. Refuse it; never throw. */
  ok("a row with no cities array is refused rather than thrown on",
    bad({ targetAreas: [{ state: "Karnataka" }] }), true);
  /* KNOWN STORE DEFECT — reported, not papered over. The ROW is normalised
     before it is judged, so a row with no cities is refused rather than thrown
     on. The VALUE is not: a `targetAreas` that is not an array at all is read
     as "no areas", passes, and is then stored raw by updateProfile — after
     which applyFilters throws `targetAreas.some is not a function` and the
     whole directory goes down. Unreachable from the form (EditProfile coerces
     to an array) and reachable from exactly the caller validateFacets says it
     exists for: an import or a bulk edit. */
  ok("a targetAreas that is not a list is REFUSED, not read as `no areas`",
    bad({ targetAreas: "Karnataka" }), true);
  ok("...which is what keeps the next read from throwing, because it is never stored",
    (() => {
      try { S.primaryCityOf({ targetAreas: "Karnataka" }); return "returned"; }
      catch (e) { return "threw"; }
    })(), "threw");
  ok("...and a real list still passes, so the guard refuses the shape and not the field",
    bad({ targetAreas: [{ state: "Karnataka", cities: ["Bengaluru"] }] }), false);
  ok("...whereas the ROW-level normalisation, which is the promise that holds, does not throw",
    (() => {
      try { return S.validateFacets({ targetAreas: [{ state: "Karnataka" }] }) !== "" ? "refused" : "allowed"; }
      catch (e) { return "threw"; }
    })(), "refused");
  ok("the same state twice is refused",
    bad({ targetAreas: [row("Delhi", ["Dwarka"]), row("Delhi", ["Saket"])] }), true);
  ok("the same city twice in one row is refused",
    bad({ targetAreas: [row("Delhi", ["Dwarka", "dwarka"])] }), true);
  ok("six states is over the cap of five",
    bad({ targetAreas: ["Karnataka", "Maharashtra", "Delhi", "Kerala", "Telangana", "Haryana"]
      .map((st) => row(st, ["X"])) }), true);
  ok("five is not",
    bad({ targetAreas: ["Karnataka", "Maharashtra", "Delhi", "Kerala", "Telangana"]
      .map((st) => row(st, ["X"])) }), false);
  ok("nine cities in one row is over the cap of eight",
    bad({ targetAreas: [row("Delhi", Array.from({ length: 9 }, (_, i) => "Area " + i))] }), true);
  ok("an empty list is not an ERROR here — required-ness is the form's check",
    bad({ targetAreas: [] }), false);

  /* "All cities" — whole-state coverage as a sentinel value. It stands alone,
     the suggestions lead with it, and the city filter expands it. */
  ok("All cities alone is a valid row", bad({ targetAreas: [row("Rajasthan", ["All cities"])] }), false);
  ok("...but not beside a specific city",
    bad({ targetAreas: [row("Rajasthan", ["All cities", "Jaipur"])] }), true);
  ok("every state's suggestions lead with it",
    S.STATES.filter((x) => S.citySuggestionsOf(x.key)[0].key !== S.ALL_CITIES), []);
  ok("...and it is spelled one way everywhere", S.ALL_CITIES, "All cities");
  ok("a state with no saved city offers only the sentinel (typing stays open)",
    S.citySuggestionsOf("Sikkim").map((x) => x.key), [S.ALL_CITIES]);
  /* THE CITY FILTER'S OPTIONS HAVE TO BE ANSWERABLE. An option is answerable
     when it is either a city some state lists or a city-state in its own right
     — Delhi is the second kind, which is exactly why the filter matches on the
     row's state as well as on its cities. An option that is neither is a
     dropdown entry that returns nothing, every time, for everybody. */
  const stateKeys = S.STATES.map((x) => x.key);
  ok("every city the filter offers is a listed city or a state in its own right",
    S.CITIES.map((x) => x.key).filter((k) => stateKeys.indexOf(k) < 0
      && !Object.keys(S.STATE_CITIES).some((st) => S.STATE_CITIES[st].indexOf(k) >= 0)), []);
  ok("...and not one of them comes back empty against the seed",
    S.CITIES.map((x) => x.key).filter((k) => !S.applyFilters(all, { city: k }).length), []);
}

console.log("\nbusiness type, and dealsIn beside it");
S.resetStore();
{
  ok("the Business type panel opens with the field's own sentence",
    S.PROFILE_FIELDS.filter((f) => f.key === "businessType")[0].info,
    "What kind of business this is. It decides how the marketplace treats them, so it is one answer, not several.");
  ok("every profile with a business name states its type",
    S.readUsers().filter((u) => !!u.profile.businessName !== !!u.profile.businessType)
      .map((u) => u.userId), []);

  const bad = (patch) => S.validateFacets(patch) !== "";
  ok("`both` is not a dealsIn option: the record never stores it", bad({ dealsIn: ["both"] }), true);
  ok("products alone is fine", bad({ dealsIn: ["products"] }), false);
  ok("services alone is fine", bad({ dealsIn: ["services"] }), false);
  ok("both together is fine", bad({ dealsIn: ["products", "services"] }), false);
  ok("an invented deal kind is not", bad({ dealsIn: ["dreams"] }), true);
  ok("the same one twice is not", bad({ dealsIn: ["products", "products"] }), true);
  ok("and neither is a third one", bad({ dealsIn: ["products", "services", "ideas"] }), true);

  const seeded = S.readUsers();
  ok("dealsIn travels with the business profile, like the other required facets",
    seeded.filter((u) => !!u.profile.businessName !== (u.profile.dealsIn.length > 0))
      .map((u) => u.userId), []);
  ok("...and every value in the seed is one of the two",
    seeded.filter((u) => u.profile.dealsIn.some((k) => ["products", "services"].indexOf(k) < 0))
      .map((u) => u.userId), []);
  ok("the maker who also installs deals in both",
    seeded.filter((u) => u.userId === "IB-U-0975")[0].profile.dealsIn,
    ["products", "services"]);
}

console.log("\npositioning: up to two of the server's list");
{
  const bad = (patch) => S.validateFacets(patch) !== "";
  ok("one is fine", bad({ positioning: ["Luxury"] }), false);
  ok("two is fine", bad({ positioning: ["Luxury", "Custom"] }), false);
  ok("three is over the cap", bad({ positioning: ["Luxury", "On Budget", "Custom"] }), true);
  ok("an invented one is refused", bad({ positioning: ["bespoke"] }), true);
  ok("...and so is the old bundled key", bad({ positioning: ["luxury"] }), true);
  ok("optional: an empty list passes", bad({ positioning: [] }), false);
  ok("no seeded profile exceeds two",
    S.readUsers().filter((u) => u.profile.positioning.length > 2).map((u) => u.userId), []);
  ok("a stray key on a closed facet renders as itself",
    S.facetLabel("positioning", "value"), "value");
}

console.log("\nkeys are stored, labels are shown");
{
  ok("a known key resolves to its label",
    S.facetLabel("segments", "lShapedModularKitchen"), "L-shaped modular kitchen");
  /* A key the vocabulary has since dropped is still a fact about that profile.
     It renders as itself rather than as an empty cell, because a blank is
     indistinguishable from "they never answered". */
  ok("a dropped key falls back to itself, not to blank",
    S.facetLabel("segments", "retired_key"), "retired_key");
  ok("an unknown vocabulary falls back rather than throwing",
    S.facetLabel("nothing_here", "x"), "x");
  ok("labelsFor resolves a whole list through the field's own vocabulary",
    S.labelsFor(S.PROFILE_FIELDS.filter((f) => f.key === "dealsIn")[0], ["products", "services"]),
    ["Products", "Services"]);
  ok("classificationMeta answers for both classifications",
    ["active", "deactivated"].map((k) => S.classificationMeta(k).label), ["Active", "Deactivated"]);
  ok("...and every classification explains what it means",
    S.CLASSIFICATIONS.filter((x) => !x.meaning).map((x) => x.key), []);
  ok("...falling back rather than returning undefined",
    !!S.classificationMeta("nonsense").label, true);
  ok("tagMeta answers for a real slug and null for an invented one",
    [S.tagMeta("vip").label, S.tagMeta("nope")], ["VIP", null]);
  ok("every tag carries the sentence that says when to use it",
    S.TAGS.filter((t) => !t.help || !t.tone).map((t) => t.slug), []);
  ok("both open decisions are still named where they bite",
    S.OPEN_DECISIONS.map((d) => d.id), ["UM-OD-09", "UM-OD-10"]);
  ok("...and decision() finds one", S.decision("UM-OD-09").title, "Profile schema");
}

/* ============================================== the filter chip contract === */
console.log("\nevery filter the URL carries can be named and cleared");
{
  ok("FILTER_KEYS covers every key applyFilters reads",
    ["q", "city", "src", "tag", "status", "flag", "registered", "from", "to"]
      .filter((k) => S.FILTER_KEYS.indexOf(k) < 0), []);
  ok("...and carries no key it has stopped reading",
    S.FILTER_KEYS.filter((k) =>
      ["cls", "view", "sort", "page", "term", "start", "end"].indexOf(k) >= 0), []);
  /* A chip with no label renders as its raw key, which is how `src` ends up on
     screen in front of somebody. from/to are the two halves of the custom
     range and are cleared with it rather than shown separately. */
  ok("every chip-bearing key has a human label",
    S.FILTER_KEYS.filter((k) => ["from", "to"].indexOf(k) < 0)
      .filter((k) => !S.FILTER_LABELS[k]), []);
  ok("a status value reads as its classification label",
    S.filterValueLabel("status", "deactivated"), "Deactivated");
  ok("a source reads as its channel name", S.filterValueLabel("src", "web"), "Website signup");
  ok("a tag reads as its label", S.filterValueLabel("tag", "vip"), "VIP");
  ok("a range reads as its own name", S.filterValueLabel("registered", "7d"), "Last 7 days");
  ok("the profile flag reads as a sentence, not as `incomplete`",
    S.filterValueLabel("flag", "incomplete"), "Incomplete profile");
  ok("an unknown value falls back to itself rather than to blank",
    S.filterValueLabel("src", "carrier-pigeon"), "carrier-pigeon");
}

/* ================================================ the analytics arithmetic ===
   The payload is MONTH-KEYED, so a span resolves to real arithmetic rather
   than to whichever two windows somebody pre-summed. Rates are recomputed from
   their own numerator and denominator over the span — never averaged from
   stored percentages, which cannot be re-aggregated without lying.

   IT COMES FROM THE SERVER NOW (GET /admin/users/analytics/), counted from the
   accounts themselves. So the module starts with NO SERIES AT ALL, and the
   first thing asserted is that an empty one answers "nothing yet" rather than
   inventing a month or throwing on the way to one. */
console.log("\nwith no series the arithmetic says so rather than inventing one");
{
  ok("there is no series until the read lands", S.MONTHS.length, 0);
  ok("a range over nothing is nothing", S.clampRange("2026-01", "2026-06"), { from: "", to: "" });
  ok("...and so is a preset", S.presetRange(6), { from: "", to: "" });
  ok("...and no preset lights up as though it were the span on screen",
    S.presetOf("", ""), "");
  const empty = S.rangeTotals("2026-01", "2026-06");
  ok("the totals are empty rather than guessed",
    [empty.monthCount, empty.registrations, empty.profileCompleted, empty.bySource.length],
    [0, 0, 0, 0]);
  /* A RATE WITH NO DENOMINATOR IS UNDEFINED, not zero — it prints as "n/a". */
  ok("...and completion is unavailable, not 0%", empty.completion.value, null);
  /* The tiles fall back to the page they can see until the base arrives, and
     the base is the whole population once it has. */
  ok("the base falls back to the loaded page until the read lands",
    S.baseCounts(all).total, S.countsOf(all).total);
}

/* The payload as the server sends it, in its own shape: twelve months ending
   on the seed's own "today", each with a channel split that sums exactly to
   its own registrations, plus the base counted over the whole population.
   Planted through the real setter, so everything below is asserted on exactly
   the path the screen takes. */
const ANALYTICS = (() => {
  const end = new Date(usersDoc.asOf);
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    const web = 12 + i, funnel = 7 + (i % 3), unset = 2;
    months.push({
      month: key,
      label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
      short: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      registrations: web + funnel + unset,
      profileCompleted: Math.round((web + funnel) / 2),
      bySource: { web: web, funnel: funnel, "": unset },
    });
  }
  return {
    asOf: usersDoc.asOf,
    months: months,
    sources: [{ key: "web", label: "Website signup" }, { key: "funnel", label: "Campaign funnel" },
      { key: "", label: "Not recorded" }],
    base: { total: SEED.total, active: SEED.active, deactivated: SEED.deactivated,
      incompleteProfiles: SEED.incomplete },
  };
})();
S.applyUsersAnalytics(ANALYTICS);

console.log("\nthe range is real arithmetic over the monthly series");
{
  const M = S.MONTHS;
  ok("the series is monthly and long enough to cut", M.length >= 6, true);
  ok("every month carries both series and its own channel split",
    M.filter((m) => typeof m.registrations !== "number"
      || typeof m.profileCompleted !== "number" || !m.bySource).map((m) => m.month), []);
  ok("each month's channels sum exactly to its own total",
    M.filter((m) => Object.keys(m.bySource).reduce((a, k) => a + m.bySource[k], 0)
      !== m.registrations).map((m) => m.month), []);
  /* EVERY CHANNEL IS NAMED, including the one that is not a channel: "" is the
     accounts whose source was never recorded, and it is shown as that rather
     than folded into web or dropped from the split. */
  ok("every channel key is one the payload names",
    Array.from(new Set(M.reduce((a, m) => a.concat(Object.keys(m.bySource)), [])))
      .filter((k) => !ANALYTICS.sources.some((s) => s.key === k)), []);
  ok("the months are in order, oldest first",
    M.map((m) => m.month).slice().sort(), M.map((m) => m.month));
  ok("every month is labelled for an axis and for a sentence",
    M.filter((m) => !m.label || !m.short).map((m) => m.month), []);
  ok("the base is the server's, counted over everybody",
    S.baseCounts([]).total, ANALYTICS.base.total);

  const t = S.rangeTotals(M[M.length - 3].month, M[M.length - 1].month);
  ok("a three-month span holds three months", t.monthCount, 3);
  ok("...and sums them rather than reading a pre-summed figure",
    t.registrations, M.slice(-3).reduce((a, m) => a + m.registrations, 0));
  ok("...profiles completed likewise",
    t.profileCompleted, M.slice(-3).reduce((a, m) => a + m.profileCompleted, 0));
  /* A RATE CARRIES ITS OWN FRACTION. Averaging three stored percentages gives
     a different — and wrong — answer the moment the months differ in size. */
  ok("completion is recomputed from its numerator and denominator",
    [t.completion.num, t.completion.den], [t.profileCompleted, t.registrations]);
  ok("...and equals the fraction, not the mean of the monthly rates",
    t.completion.value, t.profileCompleted / t.registrations);
  ok("the channel split sums to the span's own total",
    t.bySource.reduce((a, s) => a + s.registrations, 0), t.registrations);
  ok("...and every channel is labelled", t.bySource.filter((s) => !s.label).length, 0);
  ok("...the unrecorded one by name rather than as an empty cell",
    t.bySource.filter((s) => s.key === "")[0].label, "Not recorded");
  ok("the prior span is the same length, immediately before",
    t.prev.registrations, M.slice(-6, -3).reduce((a, m) => a + m.registrations, 0));
  ok("...and is null when there is not enough history behind it",
    S.rangeTotals(M[0].month, M[2].month).prev, null);
  ok("a single month is a legal span", S.rangeTotals(M[0].month, M[0].month).monthCount, 1);
  ok("...and labels itself with one month, not a range",
    S.rangeTotals(M[0].month, M[0].month).label, M[0].label);
  ok("a span labels itself from end to end",
    t.label, M[M.length - 3].label + " – " + M[M.length - 1].label);
  ok("the whole series is the widest legal span",
    S.rangeTotals(M[0].month, M[M.length - 1].month).monthCount, M.length);

  ok("a reversed range is corrected rather than refused",
    S.clampRange(M[5].month, M[2].month), { from: M[2].month, to: M[5].month });
  ok("an out-of-bounds range clamps to the series",
    S.clampRange("1999-01", "2099-12"), { from: M[0].month, to: M[M.length - 1].month });
  ok("a preset is a month count back from the newest month",
    S.presetRange(6), { from: M[M.length - 6].month, to: M[M.length - 1].month });
  ok("...and never runs off the start of the series", S.presetRange(999).from, M[0].month);
  /* Derived rather than stored, so a range arrived at by the calendar that
     happens to equal a preset lights that preset up. */
  ok("presetOf recognises a span that matches a preset",
    S.presetOf(S.presetRange(6).from, S.presetRange(6).to), "6m");
  ok("...and says nothing for a hand-picked one", S.presetOf(M[1].month, M[4].month), "");
  ok("every preset is reachable within this series",
    S.RANGE_PRESETS.filter((p) => S.presetOf(S.presetRange(p.months).from,
      S.presetRange(p.months).to) !== p.key).map((p) => p.key), []);
  /* The month picker groups the same series by year, and it is grouped on
     every render rather than memoised on mount — the months arrive late. */
  ok("the picker's grid holds every month exactly once",
    S.monthsByYear().reduce((a, y) => a + y.months.length, 0), M.length);

  /* THE DEFINITIONS TABLE IS THE PAGE'S CONTRACT with the reader: the same
     metric has to mean the same thing in March and in September. */
  ok("every metric definition carries its unit, its formula and its trap",
    S.METRICS.filter((m) => !m.label || !m.unit || !m.formula || !m.caution).map((m) => m.key), []);
  ok("the decision that blocks engagement figures is named", !!S.decision("UM-OD-10"), true);
}

console.log("\na figure with no denominator is a missing answer, not a low one");
ok("pct prints n/a for null rather than 0.0%", S.pct(null), "n/a");
ok("...and for undefined", S.pct(undefined), "n/a");
ok("...and for NaN", S.pct(NaN), "n/a");
ok("a real rate prints as a percentage", S.pct(0.5), "50.0%");
ok("...to the digits asked for", S.pct(0.5, 0), "50%");
ok("delta says `no prior period` rather than inventing a baseline",
  S.delta(10, 0).text, "no prior period");
ok("a rise is signed and toned", S.delta(10, 8), { text: "+25% vs prior period", tone: "ok" });
ok("a fall is toned differently", S.delta(8, 10).tone, "warn");

console.log("\ndates read against the seed's own clock, not the browser's");
ok("NOW is the payload's asOf",
  new Date(S.NOW).toISOString(), new Date(usersDoc.asOf).toISOString());
ok("a missing date is an em dash, never `Invalid Date`", S.fmtDate(null), "—");
ok("...and so is a malformed one", S.fmtDate("not a date"), "—");
ok("fmtDateTime answers the same way", S.fmtDateTime(null), "—");
ok("...and prints the date with a time beside it",
  S.fmtDateTime(usersDoc.asOf).indexOf(S.fmtDate(usersDoc.asOf)), 0);
ok("today is `today`", S.ago(new Date(S.NOW).toISOString()), "today");
ok("yesterday is `yesterday`", S.ago(new Date(S.NOW - S.DAY).toISOString()), "yesterday");
ok("a week is days", S.ago(new Date(S.NOW - 7 * S.DAY).toISOString()), "7 days ago");
ok("two months is months", S.ago(new Date(S.NOW - 60 * S.DAY).toISOString()), "2 months ago");
ok("two years is years", S.ago(new Date(S.NOW - 730 * S.DAY).toISOString()), "2 years ago");
ok("a future date is not `-3 days ago`", S.ago(new Date(S.NOW + 3 * S.DAY).toISOString()), "in 3 days");
ok("no date at all is an em dash", S.ago(null), "—");
/* NOTHING IN THIS MODULE STAMPS A MOMENT OF ITS OWN any more. Every write is an
   endpoint, so every stored stamp is the server's — the browser clock cannot
   put a note four days into the future of a timeline again because the browser
   no longer writes one. */
ok("the module stamps no moments of its own", "stamp" in S, false);
ok("no seeded registration is in the future of the seed's own clock",
  users.filter((u) => new Date(u.registeredAt).getTime() > S.NOW).map((u) => u.userId), []);
ok("no seeded activity predates its own registration",
  users.filter((u) => u.lastActivityAt
    && new Date(u.lastActivityAt).getTime() < new Date(u.registeredAt).getTime())
    .map((u) => u.userId), []);

/* The queued write assertions, in order, and then the summary. */
void (async () => {
  for (const run of PENDING) await run();
  S.resetStore();
  console.log(failed ? "\n" + failed + " FAILED\n" : "\nall checks passed\n");
  process.exit(failed ? 1 : 0);
})();
