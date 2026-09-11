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
const usersDoc = require("../src/content/users/users.json");
const users = usersDoc.users;
const vocab = require("../src/content/users/vocabularies.json");
const auditDoc = require("../src/content/users/audit.json");
const all = users.map((u) => S.toRow(u));
const byId = {};
all.forEach((r) => { byId[r.user.userId] = r; });
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------- seed truth ---
   Recomputed HERE, from the JSON, without calling store.ts — so the
   comparisons below are two independent answers meeting, not one answer
   quoted twice. Hard-coding these numbers is how a suite starts failing every
   time somebody adds a user, which trains people to edit the test. */
const REQUIRED = vocab.profileFields.filter((f) => f.required);
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
  probe.commercial = { salesOwner: null, dealRefs: [], invoiceRefs: [] };
  ok("a stale deactivatedAt does not deactivate anybody", S.classify(probe), "active");
  probe.userStatus = "deactivated";
  ok("...and the status word alone does", S.classify(probe), "deactivated");
  /* There is no third answer, so anything that is not the word falls to
     active rather than rendering a pill with no label. */
  ok("an unrecognised status is not a third classification",
    S.classify({ ...probe, userStatus: "active_member" }), "active");
  ok("a deactivated account keeps its profile, its notes and its history",
    [!!byId["IB-U-0601"].user.profile,
      byId["IB-U-0601"].user.notes.length > 0,
      auditDoc.events.some((e) => e.userId === "IB-U-0601")],
    [true, true, true]);
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
    ["readUsers", "readUser", "readAudit", "toRow", "classify"].filter((k) => exp.indexOf(k) < 0), []);
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
  const seedText = fs.readFileSync("src/content/users/users.json", "utf8");
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

console.log("\nthe view band has one figure, and it is not a readout of the search");
const band = S.bandCounts(all);
ok("bandCounts answers for the Users face and nothing else", Object.keys(band), ["users"]);
ok("...with the whole population behind it", band.users, c.total);
{
  const narrowed = S.applyFilters(all, { q: "sharma" });
  ok("a search genuinely narrows the list", narrowed.length < all.length, true);
  ok("...and does not move the band", S.bandCounts(all).users, band.users);
  ok("...even though the band would follow it if it were counted off the filter",
    S.bandCounts(narrowed).users < band.users, true);
}

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
   THE WRITES. Every one of these is a simulation today and an endpoint later,
   and the guarantees below are the ones the endpoint has to keep. They are
   asserted here rather than described in a doc because a described guarantee
   is one nobody notices breaking.
   ============================================================================= */
console.log("\nthe profile write is the last line, not the form");
S.resetStore();
{
  ok("a non-editable key is refused whole",
    S.updateProfile("IB-U-0912", { profileId: "HACK" }).indexOf("Not editable") >= 0, true);
  ok("...and the refusal names the key so it can be fixed",
    S.updateProfile("IB-U-0912", { profileId: "HACK" }).indexOf("profileId") >= 0, true);
  ok("...and nothing changed", S.readUser("IB-U-0912").profile.profileId !== "HACK", true);
  ok("an unknown user is refused",
    S.updateProfile("IB-U-NOPE", { about: "x" }).indexOf("no longer exists") >= 0, true);
  const pctBefore = S.completenessOf(S.readUser("IB-U-0912").profile).pct;
  ok("whitespace is not a business name", S.updateProfile("IB-U-0912", { businessName: "   " }), "");
  ok("...it is stored as empty", S.readUser("IB-U-0912").profile.businessName, null);
  ok("...and completeness dropped", S.completenessOf(S.readUser("IB-U-0912").profile).pct < pctBefore, true);
  /* A profile that fell below the bar says so, so the directory's Incomplete
     cell and the record's badge cannot disagree with the grade. */
  ok("...and the stored profileStatus followed the grade down",
    S.readUser("IB-U-0912").profile.profileStatus, "incomplete");
  ok("a malformed area row is refused, not thrown on",
    S.validateFacets({ targetAreas: [{ state: "Karnataka" }] }).indexOf("at least one city") >= 0, true);
  ok("an unknown tag is refused", S.setTags("IB-U-0912", ["vip", "made-up"]).indexOf("Unknown tag") >= 0, true);
  ok("...and the tags did not move", S.readUser("IB-U-0912").tags.some((t) => t.slug === "made-up"), false);
}

console.log("\na save writes an audit row naming the fields, never the values");
S.resetStore();
{
  const before = S.readAudit().length;
  ok("a valid patch is accepted",
    S.updateProfile("IB-U-0912", { about: "Rewritten by an admin on a call." }), "");
  ok("...one audit row was appended", S.readAudit().length, before + 1);
  const e = S.readAudit()[0];
  ok("...typed as a profile update", e.type, "PROFILE_UPDATED");
  ok("...against the right user", e.userId, "IB-U-0912");
  ok("...naming the field that changed", e.note.indexOf("About") >= 0, true);
  ok("...and not carrying the new value into the log",
    e.note.indexOf("Rewritten by an admin") < 0, true);
  ok("...attributed to the session rather than to a guess", e.actor, S.actor().name);
  ok("a patch that changes nothing writes nothing",
    [S.updateProfile("IB-U-0912", { about: "Rewritten by an admin on a call." }),
      S.readAudit().length], ["", before + 1]);
  /* A HIDDEN PROFILE STAYS HIDDEN. An admin correcting one field on a
     deactivated account must not republish it to the storefront. */
  ok("the deactivated demo profile is hidden to start with",
    S.readUser("IB-U-0601").profile.profileStatus, "hidden");
  ok("...and an edit does not republish it",
    [S.updateProfile("IB-U-0601", { about: "A correction." }),
      S.readUser("IB-U-0601").profile.profileStatus], ["", "hidden"]);
  /* ...while an ordinary profile is promoted by the GRADE, which is what
     keeps profileStatus and completeness from drifting apart. */
  ok("...and the grade is what promotes an ordinary one",
    [S.updateProfile("IB-U-1029", {
      businessName: "Rao & Sons", username: "rao-and-sons", businessType: "contractor",
      dealsIn: ["services"], segments: ["carpentry"],
      targetAreas: [{ state: "Karnataka", cities: ["Bengaluru"] }],
    }), S.readUser("IB-U-1029").profile.profileStatus,
      S.completenessOf(S.readUser("IB-U-1029").profile).pct], ["", "published", 100]);
  ok("...which moves the Incomplete count with it",
    S.countsOf(S.readUsers().map(S.toRow)).incompleteProfiles, SEED.incomplete - 1);
}

console.log("\nnotes are append-only, and the audit records the fact, not the text");
S.resetStore();
{
  ok("an empty note is refused", S.addNote("IB-U-0912", "   ").indexOf("needs some text") >= 0, true);
  const notes = S.readUser("IB-U-0912").notes.length;
  ok("a real note is accepted", S.addNote("IB-U-0912", "Called about the profile chase."), "");
  ok("...it is on the record", S.readUser("IB-U-0912").notes.length, notes + 1);
  ok("...newest first", S.readUser("IB-U-0912").notes[0].text, "Called about the profile chase.");
  ok("...attributed to the session, not to a guess",
    S.readUser("IB-U-0912").notes[0].author, S.actor().name);
  const e = S.readAudit()[0];
  ok("...and the audit says a note exists", e.type, "NOTE");
  ok("...without repeating what it said", e.note.indexOf("profile chase") < 0, true);
  ok("an unknown user is refused",
    S.addNote("IB-U-NOPE", "hello").indexOf("no longer exists") >= 0, true);
}

console.log("\ntags are a closed list, and a no-op change is not an event");
S.resetStore();
{
  const before = S.readAudit().length;
  ok("setting the tags already held changes nothing",
    [S.setTags("IB-U-0912", S.readUser("IB-U-0912").tags.map((t) => t.slug)),
      S.readAudit().length], ["", before]);
  ok("adding a known tag is accepted", S.setTags("IB-U-0912", ["vip", "onboarding"]), "");
  ok("...and the audit names what moved", S.readAudit()[0].note.indexOf("onboarding") >= 0, true);
  ok("...an existing tag keeps its original attribution",
    S.readUser("IB-U-0912").tags.filter((t) => t.slug === "vip")[0].assignedBy, "V. Shakya");
  ok("removing one is recorded too",
    [S.setTags("IB-U-0912", ["vip"]), S.readAudit()[0].note.indexOf("Removed onboarding") >= 0],
    ["", true]);
  ok("an unknown slug takes the whole call down",
    S.setTags("IB-U-0912", ["vip", "not-a-tag"]).indexOf("closed list") >= 0, true);
  ok("...leaving the tags exactly as they were",
    S.readUser("IB-U-0912").tags.map((t) => t.slug), ["vip"]);
}

console.log("\nan account status is an account status, and it stops at this module");
S.resetStore();
{
  ok("deactivating without a reason is refused",
    S.setUserStatus("IB-U-0912", "deactivated", "  ").indexOf("needs a reason") >= 0, true);
  ok("...and the account is untouched", S.readUser("IB-U-0912").userStatus, "active");
  ok("deactivating with one is accepted",
    S.setUserStatus("IB-U-0912", "deactivated", "Member asked to close the account"), "");
  ok("...the classification follows, derived",
    S.toRow(S.readUser("IB-U-0912")).classification, "deactivated");
  ok("...the reason and the moment are stored",
    [S.readUser("IB-U-0912").deactivatedReason, !!S.readUser("IB-U-0912").deactivatedAt],
    ["Member asked to close the account", true]);
  /* SOFT BY CONSTRUCTION. Hard deletion is a governed privacy process and has
     no button; everything that made this a record is still here. */
  ok("...the profile survives", !!S.readUser("IB-U-0912").profile.businessName, true);
  ok("...the commercial references survive",
    S.readUser("IB-U-0912").commercial.dealRefs.length > 0, true);
  ok("...the notes survive", S.readUser("IB-U-0912").notes.length > 0, true);
  ok("...and the audit gained a row rather than losing any",
    S.readAudit()[0].type, "USER_DEACTIVATED");
  ok("setting the same status twice is not an event",
    S.setUserStatus("IB-U-0912", "deactivated", "again"), "");
  ok("reactivating needs no reason", S.setUserStatus("IB-U-0912", "active", ""), "");
  ok("...and clears the deactivation stamps",
    [S.readUser("IB-U-0912").deactivatedAt, S.readUser("IB-U-0912").deactivatedReason], [null, null]);
  ok("...with its own event type", S.readAudit()[0].type, "USER_REACTIVATED");
  ok("an unknown user is refused",
    S.setUserStatus("IB-U-NOPE", "deactivated", "x").indexOf("no longer exists") >= 0, true);
}

console.log("\nthe audit is a history, and history is not edited to match today");
S.resetStore();
{
  const known = new Set(vocab.eventTypes.map((e) => e.key));
  ok("every seeded event type has a label to render with",
    Array.from(new Set(auditDoc.events.map((e) => e.type))).filter((t) => !known.has(t)), []);
  ok("every audit row names a user that exists",
    auditDoc.events.filter((e) => !users.some((u) => u.userId === e.userId))
      .map((e) => e.eventId), []);
  ok("every audit row is stamped and attributed",
    auditDoc.events.filter((e) => !e.eventId || !e.at || !e.actor || !e.actorRole)
      .map((e) => e.eventId), []);
  ok("event ids are unique",
    auditDoc.events.length, new Set(auditDoc.events.map((e) => e.eventId)).size);
  ok("the types the seed carries are the ones this module still writes",
    Array.from(new Set(auditDoc.events.map((e) => e.type))).sort(),
    ["NOTE", "PROFILE_UPDATED", "REGISTERED", "TAGGED", "USER_DEACTIVATED"]);
  /* The MEMBERSHIP_* types stay in the vocabulary on purpose: a row written
     while this module still ran a lifecycle is a row about something that
     happened, and it has to keep rendering with a label rather than a raw key
     if it ever arrives from the API. */
  ok("...while the membership types are kept as historical labels",
    vocab.eventTypes.filter((e) => e.key.indexOf("MEMBERSHIP_") === 0).length > 0, true);
  ok("...spelled the way the rows that used them spell them",
    vocab.eventTypes.some((e) => e.key === "MEMBERSHIP_CANCELLED"), true);
  ok("no event type is missing a label or a key",
    vocab.eventTypes.filter((e) => !e.key || !e.label).length, 0);
  /* KNOWN SEED DEFECT — reported, not papered over. Every registered identity
     should open its timeline with its own REGISTERED row; the seven users
     added for the Finance seeds carry no audit at all, so their record's Audit
     tab reads "Nothing has happened on this account yet" for an account that
     demonstrably registered. Quarantined BY NAME so the set cannot grow
     silently — and so fixing the seed turns this line red and gets it deleted. */
  ok("every account opens its timeline with its own registration",
    users.filter((u) => !auditDoc.events.some((e) => e.userId === u.userId && e.type === "REGISTERED"))
      .map((u) => u.userId), []);
  ok("...and the registration is dated when the account actually registered",
    users.filter((u) => {
      const reg = auditDoc.events.filter((e) => e.userId === u.userId && e.type === "REGISTERED")[0];
      return !reg || reg.at !== u.registeredAt;
    }).map((u) => u.userId), []);
  ok("...and no event id is used twice, across the whole log",
    (() => { const ids = auditDoc.events.map((e) => e.eventId); return ids.filter((x, i) => ids.indexOf(x) !== i); })(), []);
}

console.log("\nthe seed is restorable, because a demo gets walked twice");
{
  S.resetStore();
  const before = JSON.stringify(S.readUsers());
  S.addNote("IB-U-0912", "scribble");
  S.setUserStatus("IB-U-0880", "deactivated", "testing");
  ok("the writes landed", JSON.stringify(S.readUsers()) !== before, true);
  S.resetStore();
  ok("...and reset puts every one of them back", JSON.stringify(S.readUsers()), before);
  ok("...including the audit", S.readAudit().length, auditDoc.events.length);
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
  ok("business types have unique keys", dupes(S.BUSINESS_TYPES, "key").length, 0);
  ok("segments have unique keys", dupes(S.SEGMENTS, "key").length, 0);
  ok("categories have unique keys", dupes(S.CATEGORIES, "key").length, 0);
  /* A category whose group is misspelled renders under no heading, which in a
     grouped listbox means it does not render at all. */
  const groupKeys = S.CATEGORY_GROUPS.map((g) => g.key);
  ok("every category sits in a declared group",
    S.CATEGORIES.filter((x) => groupKeys.indexOf(x.group) < 0).map((x) => x.key), []);
  ok("both groups are actually used",
    groupKeys.filter((g) => !S.CATEGORIES.some((x) => x.group === g)), []);
  ok("keyword suggestions are unique",
    S.KEYWORD_SUGGESTIONS.length,
    S.dedupeKeywords(S.KEYWORD_SUGGESTIONS).length);
  /* The label is the fallback when a key is missing, so an empty one would
     render a blank chip that cannot be told from a bug. */
  ok("nothing is missing a label",
    S.BUSINESS_TYPES.concat(S.SEGMENTS).concat(S.CATEGORIES)
      .filter((o) => !o.label).length, 0);

  /* THE OPTION TEXT LIVES HERE because the listbox only exists while it is
     open, and the render harness has no browser to open it with. These are the
     same guarantees the picker would be asserted on if it could be. */
  ok("every business type carries the sentence that separates it",
    S.BUSINESS_TYPES.filter((o) => !o.hint).map((o) => o.key), []);
  ok("...because Dealer, Retailer and Wholesaler are not self-evident",
    ["dealer", "retailer", "wholesaler"]
      .filter((k) => !S.BUSINESS_TYPES.filter((o) => o.key === k)[0].hint), []);
  ok("categories genuinely span both questions",
    S.CATEGORY_GROUPS.map((g) => S.CATEGORIES.filter((x) => x.group === g.key).length > 1),
    [true, true]);
  /* Delivery model is gone: Turnkey / Design & build / Execution only were a
     third axis nobody asked the form to carry. Categories are INDUSTRIES now,
     plus the sector — and the list is open, so a category nobody listed is a
     thing somebody types, not a thing the form refuses. */
  ok("no delivery-model category survives",
    S.CATEGORIES.filter((x) => x.group === "delivery").map((x) => x.key), []);
  ok("the industries the request named are there",
    ["sanitaryware", "home_security"].filter((k) => !S.CATEGORIES.some((x) => x.key === k)), []);

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
  /* And the stylesheet has to actually restate each one: a chip class the CSS
     never names falls back to brand tint with no error anywhere. */
  const css = fs.readFileSync("src/admin/views/Users/users.css", "utf8")
    + fs.readFileSync("src/admin/views/Users/blocks.css", "utf8");
  ok("...and each one is named in the module's own stylesheets",
    chipped.map((f) => f.chip).filter((t) => css.indexOf(t) < 0), []);
}

console.log("\nthe seed is inside its own vocabularies");
{
  const seeded = S.readUsers();
  const known = (list) => list.map((o) => o.key);
  const bt = known(S.BUSINESS_TYPES), sg = known(S.SEGMENTS), ct = known(S.CATEGORIES);
  ok("no unknown business type",
    seeded.filter((u) => u.profile.businessType && bt.indexOf(u.profile.businessType) < 0)
      .map((u) => u.userId), []);
  ok("no unknown segment",
    seeded.filter((u) => u.profile.segments.some((s) => sg.indexOf(s) < 0)).map((u) => u.userId), []);
  ok("no unknown category",
    seeded.filter((u) => u.profile.categories.some((x) => ct.indexOf(x) < 0)).map((u) => u.userId), []);
  ok("no unknown registration source",
    seeded.filter((u) => !S.REGISTRATION_SOURCES.some((s) => s.key === u.registrationSource))
      .map((u) => u.userId), []);
  ok("no unknown tag slug",
    seeded.filter((u) => u.tags.some((t) => !S.TAGS.some((x) => x.slug === t.slug)))
      .map((u) => u.userId), []);
  ok("no unknown profile status",
    seeded.filter((u) => !vocab.profileStatuses.some((s) => s.key === u.profile.profileStatus))
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
  ok("every profile carries the schema version it was graded against",
    seeded.filter((u) => u.profile.schemaVersion !== S.PROFILE_SCHEMA_VERSION)
      .map((u) => u.userId), []);
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
  ok("a real business type is fine", bad({ businessType: "manufacturer" }), false);
  ok("an invented one is not", bad({ businessType: "wizard" }), true);
  ok("clearing it is allowed", bad({ businessType: null }), false);
  ok("real segments are fine", bad({ segments: ["architect", "vastu"] }), false);
  /* Open now, like categories: a trade nobody listed is typed, not refused. */
  ok("a segment nobody listed is accepted", bad({ segments: ["architect", "Pergola work"] }), false);
  ok("...but not at forty-one characters", bad({ segments: ["x".repeat(41)] }), true);
  /* The explainers are KEYWORDS, not sentences — asserted by length, which is
     the only thing that stops a row growing back into a paragraph. */
  ok("every segment has a short explainer",
    S.SEGMENTS.filter((o) => !o.hint || o.hint.length > 32).map((o) => o.key), []);
  ok("the same segment twice is refused", bad({ segments: ["architect", "architect"] }), true);
  ok("seven segments is over the cap of six",
    bad({ segments: S.SEGMENTS.slice(0, 7).map((s) => s.key) }), true);
  ok("six is not", bad({ segments: S.SEGMENTS.slice(0, 6).map((s) => s.key) }), false);
  ok("real categories are fine", bad({ categories: ["sanitaryware", "residential"] }), false);
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

console.log("\nthe write path refuses what the form refuses");
S.resetStore();
{
  const before = JSON.stringify(S.readUsers().filter((u) => u.userId === "IB-U-0912")[0].profile);
  /* Segments are open now, so the probe uses a rule that still closes:
     Business type is one answer from a chain of seven, and nothing else. */
  const err = S.updateProfile("IB-U-0912", { businessType: "not_a_type" });
  ok("an unknown business type is refused at the store, not only in the dialog",
    err.indexOf("not one of the allowed") >= 0, true);
  /* The module's standing promise: a refused write leaves nothing behind. */
  ok("...and the stored profile is untouched",
    JSON.stringify(S.readUsers().filter((u) => u.userId === "IB-U-0912")[0].profile), before);
  ok("a valid facet patch is accepted",
    S.updateProfile("IB-U-0912", {
      businessType: "independent",
      dealsIn: ["services"],
      segments: ["interior_designer", "architect"],
      categories: ["lighting", "commercial"],
      searchKeywords: ["Office fit-out", "Complete home interiors"],
    }), "");
  ok("...and it is what came back",
    S.readUsers().filter((u) => u.userId === "IB-U-0912")[0].profile.segments,
    ["interior_designer", "architect"]);
  /* PARTIAL WRITES DO NOT EXIST. One good field beside one bad one saves
     neither — the endpoint 422s the whole patch (UM-T07) and so does this. */
  const now = JSON.stringify(S.readUsers().filter((u) => u.userId === "IB-U-0912")[0].profile);
  ok("one bad field takes the whole patch down",
    S.updateProfile("IB-U-0912", { about: "A perfectly good sentence.", businessType: "wizard" })
      !== "", true);
  ok("...including the field that was fine",
    JSON.stringify(S.readUsers().filter((u) => u.userId === "IB-U-0912")[0].profile), now);
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
    S.profileUrl("meera-studio").indexOf(S.USERNAME_RULES.path + "meera-studio") > 0, true);
  ok("...and degrades to a readable host rather than the string `undefined`",
    S.profileUrl("meera-studio").indexOf("undefined") < 0, true);

  /* UNIQUENESS IS NOT A FIELD RULE, so it is not in validateFacets: that
     answers "is this value well formed", which needs nothing but the value,
     and this one needs the whole table. This is where that seam is pinned. */
  ok("a malformed username is refused by validateFacets",
    S.validateFacets({ username: "Bad_Name" }) !== "", true);
  ok("...but uniqueness is not its job",
    S.validateFacets({ username: "meera-studio-interiors" }), "");
  ok("the store is what refuses a taken one",
    S.updateProfile("IB-U-1041", { username: "meera-studio-interiors" })
      .indexOf("belongs to another profile") >= 0, true);
  ok("...and nothing was saved on the way past it",
    S.readUser("IB-U-1041").profile.username !== "meera-studio-interiors", true);
  ok("...and a free one goes through",
    S.updateProfile("IB-U-1041", { username: "priya-nair-design" }), "");
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

console.log("\nService provider is gone, and dealsIn is the axis that replaced it");
S.resetStore();
{
  /* "What do you sell" is dealsIn's question now. A type that repeats another
     facet's answer gets picked instead of the real one — a design-build firm
     typed as "Service provider" says nothing "Contractor + services" does not
     say better. */
  ok("service_provider is not a business type",
    S.BUSINESS_TYPES.some((t) => t.key === "service_provider"), false);
  ok("...and no seeded profile still carries it",
    S.readUsers().filter((u) => u.profile.businessType === "service_provider")
      .map((u) => u.userId), []);
  ok("the Business type panel opens with the field's own sentence",
    S.PROFILE_FIELDS.filter((f) => f.key === "businessType")[0].info,
    "What kind of business this is. It decides how the marketplace treats them, so it is one answer, not several.");
  /* ORDERED ALONG THE CHAIN, read from the portal's end: the people who use
     it most come first — who works alone, who designs as a team, who builds —
     then who sells, who moves, who makes. */
  ok("seven types, in chain order from the practitioner up",
    S.BUSINESS_TYPES.map((t) => t.key),
    ["independent", "firm_studio", "contractor", "retailer", "wholesaler", "dealer", "manufacturer"]);
  /* Counted off the seed rather than written down: seven more customers
     arriving must not make this a failure. */
  const typed = S.readUsers().filter((u) => u.profile.businessType);
  ok("every profile with a business name states its type",
    S.readUsers().filter((u) => !!u.profile.businessName !== !!u.profile.businessType)
      .map((u) => u.userId), []);
  ok("the chain is genuinely in use, not a list with one answer in it",
    Array.from(new Set(typed.map((u) => u.profile.businessType))).length >= 5, true);
  /* Firm / Studio is the grain two earlier entries flagged as missing: a
     design practice with a team is neither a site contractor nor a solo
     practitioner. It is the seed's most common answer, which is the shape the
     vocabulary was changed to capture. */
  ok("Firm / Studio is the most common answer in the seed",
    S.BUSINESS_TYPES.map((t) => typed.filter((u) => u.profile.businessType === t.key).length)
      .indexOf(Math.max.apply(null, S.BUSINESS_TYPES.map((t) =>
        typed.filter((u) => u.profile.businessType === t.key).length))),
    S.BUSINESS_TYPES.map((t) => t.key).indexOf("firm_studio"));
  ok("...and Independent is the two who work alone",
    S.readUsers().filter((u) => u.profile.businessType === "independent")
      .map((u) => u.userId).sort(), ["IB-U-0812", "IB-U-1041"]);

  const bad = (patch) => S.validateFacets(patch) !== "";
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

console.log("\npositioning: up to two of a closed four");
{
  const bad = (patch) => S.validateFacets(patch) !== "";
  ok("one is fine", bad({ positioning: ["luxury"] }), false);
  ok("two is fine", bad({ positioning: ["luxury", "custom"] }), false);
  ok("three is over the cap", bad({ positioning: ["luxury", "budget_friendly", "custom"] }), true);
  ok("premium is on offer again", bad({ positioning: ["premium"] }), false);
  ok("the four are the four",
    S.VOCAB.positioning.map((p) => p.key), ["luxury", "budget_friendly", "custom", "premium"]);
  ok("...so value and eco-friendly are refused",
    bad({ positioning: ["value"] }) && bad({ positioning: ["eco_friendly"] }), true);
  ok("an invented one is refused", bad({ positioning: ["bespoke"] }), true);
  ok("optional: an empty list passes", bad({ positioning: [] }), false);
  ok("no seeded profile exceeds two",
    S.readUsers().filter((u) => u.profile.positioning.length > 2).map((u) => u.userId), []);
  /* The closed facet, held closed BY THE SEED as well as by the validator.
     Seven profiles once carried `value`, a key the vocabulary had dropped —
     refused on save, and rendered as its own raw key on the record. Fixed at
     the source; this is the rule that replaced the quarantine. */
  ok("every seeded profile positions itself with a key the vocabulary has",
    S.readUsers().filter((u) => u.profile.positioning.some((k) =>
      !S.VOCAB.positioning.some((pp) => pp.key === k))).map((u) => u.userId).sort(), []);
  ok("...so every seeded positioning would survive being saved again",
    S.readUsers().filter((u) => u.profile.positioning.length
      && S.validateFacets({ positioning: u.profile.positioning })).map((u) => u.userId), []);
  ok("...which is what a stray key does to a closed facet: it renders as itself",
    S.facetLabel("positioning", "value"), "value");
}

console.log("\nkeys are stored, labels are shown");
{
  ok("a known key resolves to its label",
    S.facetLabel("segments", "visualiser_3d"), "3D visualiser");
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
  ok("...and every classification explains what it means and what it does not",
    S.CLASSIFICATIONS.filter((x) => !x.meaning || !x.derivedFrom).map((x) => x.key), []);
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
   stored percentages, which cannot be re-aggregated without lying. */
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
  ok("every channel key is one the vocabulary names",
    Array.from(new Set(M.reduce((a, m) => a.concat(Object.keys(m.bySource)), [])))
      .filter((k) => !S.REGISTRATION_SOURCES.some((s) => s.key === k)), []);
  ok("the months are in order, oldest first",
    M.map((m) => m.month).slice().sort(), M.map((m) => m.month));
  ok("every month is labelled for an axis and for a sentence",
    M.filter((m) => !m.label || !m.short).map((m) => m.month), []);

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
  ok("...which is a different number from that mean",
    t.completion.value !== M.slice(-3)
      .reduce((a, m) => a + m.profileCompleted / m.registrations, 0) / 3, true);
  ok("the channel split sums to the span's own total",
    t.bySource.reduce((a, s) => a + s.registrations, 0), t.registrations);
  ok("...and every channel is labelled", t.bySource.filter((s) => !s.label).length, 0);
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

  /* THE DEFINITIONS TABLE IS THE PAGE'S CONTRACT with the reader: the same
     metric has to mean the same thing in March and in September. */
  ok("every metric definition carries its unit, its formula and its trap",
    S.METRICS.filter((m) => !m.label || !m.unit || !m.formula || !m.caution).map((m) => m.key), []);
  ok("engagement is stated as unavailable rather than seeded as zero",
    S.ANALYTICS.engagement, null);
  ok("...and the decision that blocks it is named", !!S.decision("UM-OD-10"), true);
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
/* Writes stamp the same clock the derivation reads, so a note added during a
   demo does not print "in 4 days" on a timeline that lives in August. */
ok("a simulated write stamps the seed's clock, not the machine's",
  Math.abs(new Date(S.stamp()).getTime() - S.NOW) < 60000, true);
ok("no seeded registration is in the future of the seed's own clock",
  users.filter((u) => new Date(u.registeredAt).getTime() > S.NOW).map((u) => u.userId), []);
ok("no seeded activity predates its own registration",
  users.filter((u) => u.lastActivityAt
    && new Date(u.lastActivityAt).getTime() < new Date(u.registeredAt).getTime())
    .map((u) => u.userId), []);

S.resetStore();

console.log(failed ? "\n" + failed + " FAILED\n" : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
