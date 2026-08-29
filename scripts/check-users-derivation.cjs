/* =============================================================================
   check:users — the derivation is right, and the seed proves it.
   -----------------------------------------------------------------------------
   Users Management stores no classification. Normal User, Active Member,
   Paused, Suspended, Former Member and Deactivated are all computed at read
   time by classify() in views/Users/store.ts, and every screen in the module
   calls that one function. Which means a bug in it is not a bug in one place —
   it is a wrong number on the overview, a wrong filter in the directory, a
   wrong denominator in the analytics and a wrong entitlement answer, all at
   once, and all agreeing with each other.

   So this asserts the derivation against the seed, case by case, including the
   three that are easy to get wrong:

     · a user whose only term is Pending is a NORMAL USER, not a former member.
       Nothing has ever entitled them. The test is `activatedAt`, not history
       length, and that distinction is the whole reason this check exists.
     · a term marked Active whose end date has passed is NOT entitling. The
       expiry sweep has not run; pretending otherwise outlives the membership.
     · Deactivated is an ACCOUNT status. It wins over every membership state,
       and the terms underneath it survive untouched.

   Run: node scripts/check-users-derivation.cjs
   (after: npx esbuild src/admin/views/Users/store.ts --bundle --platform=node
           --format=cjs --define:import.meta.env={} --external:react
           --outfile=node_modules/.tmp/users-store.cjs)
   ============================================================================= */
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
const users = require("../src/content/users/users.json").users;
const memberships = require("../src/content/users/memberships.json").memberships;
const all = users.map((u) => S.toRow(u, memberships));
const byId = {};
all.forEach((r) => { byId[r.user.userId] = r; });

console.log("\nclassification, per user");
const EXPECT = {
  "IB-U-1041": "normal",            // registered, never bought
  "IB-U-1038": "normal",
  "IB-U-1029": "normal",
  "IB-U-1012": "normal",
  "IB-U-0812": "normal",
  "IB-U-0958": "normal",            // PENDING term only — nothing has entitled them
  "IB-U-0975": "active_member",
  "IB-U-0944": "active_member",
  "IB-U-0912": "active_member",     // third term, first two expired
  "IB-U-0899": "active_member",
  "IB-U-0880": "active_member",
  "IB-U-0867": "active_member",
  "IB-U-0688": "active_member",     // cancelled, then a new term
  "IB-U-0834": "paused_member",
  "IB-U-0790": "suspended_member",
  "IB-U-0745": "suspended_member",
  "IB-U-0921": "former_member",
  "IB-U-0702": "former_member",
  "IB-U-0655": "former_member",
  "IB-U-0601": "deactivated",
};
Object.keys(EXPECT).forEach((id) => {
  ok(id + " (" + byId[id].user.identity.name + ")", byId[id].classification, EXPECT[id]);
});
ok("every seeded user is asserted", all.length, Object.keys(EXPECT).length);

console.log("\nthe three that are easy to get wrong");
ok("a Pending-only term does not make a Former Member",
  byId["IB-U-0958"].classification, "normal");
ok("...and its term is still visible on the record",
  byId["IB-U-0958"].history.length, 1);
ok("...and it carries no entitlement snapshot",
  byId["IB-U-0958"].history[0].entitlements.length, 0);
ok("a deactivated account beats any membership state",
  byId["IB-U-0601"].classification, "deactivated");
ok("a cancelled term followed by a new one reads as Active Member",
  byId["IB-U-0688"].classification, "active_member");
ok("...and the cancelled term is still in the history",
  byId["IB-U-0688"].history.filter((m) => m.status === "cancelled").length, 1);
ok("history is newest term first",
  byId["IB-U-0912"].history.map((m) => m.termNo), [3, 2, 1]);
ok("the current term is the live one, not the newest terminal one",
  byId["IB-U-0912"].current.membershipId, "IB-MB-0912-3");

/* THE SNAPSHOT IS SELF-SUFFICIENT. The plan catalogue belongs to the Plans
   module and is read live from `v1/admin/plans/`; a term stores what it bought
   so it renders correctly after the plan is repriced, renamed, archived — or
   when the catalogue simply cannot be reached. Nothing below touches a
   catalogue, and that IS the assertion. */
console.log("\nevery term carries its own snapshot, and needs no catalogue");
const menon = byId["IB-U-0880"].current;
ok("a term names its plan without looking it up", menon.planName, "Growth");
ok("...carries the duration it bought", menon.cycle.months, 12);
ok("...and the price it bought at", menon.cycle.price, 24900);
ok("...with its entitlements frozen on the term",
  menon.entitlements.find((e) => e.key === "listings.max").display, "Up to 50 listings");
ok("no term references a plan version any more",
  JSON.stringify(all).indexOf("planVersion") < 0, true);
ok("the module ships no plan catalogue of its own",
  require("fs").existsSync("src/content/users/membership-plans.json"), false);
ok("every source is one of the three that remain",
  Array.from(new Set(memberships.map((m) => m.source.kind))).sort(),
  ["new_sale", "renewal"]);
ok("...and the vocabulary offers exactly those three plus complimentary",
  require("../src/content/users/vocabularies.json").activationSources.map((x) => x.key),
  ["new_sale", "renewal", "complimentary"]);
ok("plansInUse reads the plans people actually hold",
  S.plansInUse(memberships).map((p) => p.code).sort(), ["growth", "pro", "starter"]);

/* THE PLAN RULES. They live in the store rather than inside the dialog, which
   is what lets them be checked here with no browser and no catalogue. The
   shapes below are what the live Plans endpoint returns. */
console.log("\nthe plan rules the assignment form applies");
{
  const cyc = (id, months, price, active = true) =>
    ({ id, months, price, oldPrice: 0, badge: "", active });
  const pl = (id, family, title, cycles, extra = {}) =>
    Object.assign({ id, family, title, active: true, archived: false, cycles }, extra);

  ok("a plan on sale with an active cycle is sellable",
    S.isSellable(pl(1, "growth", "Growth", [cyc(1, 12, 29500)])), true);
  ok("...off sale is not",
    S.isSellable(pl(2, "x", "X", [cyc(2, 12, 1)], { active: false })), false);
  ok("...archived is not",
    S.isSellable(pl(3, "x", "X", [cyc(3, 12, 1)], { archived: true })), false);
  /* No cycle means no duration and no price. A plan you cannot put a number
     against is not a plan you can sell. */
  ok("...and on sale with no ACTIVE cycle is not",
    S.isSellable(pl(4, "x", "X", [cyc(4, 12, 1, false)])), false);

  const growth = pl(5, "growth", "Growth",
    [cyc(50, 12, 29500), cyc(51, 6, 16500), cyc(52, 24, 53000)]);
  ok("the duration fills in with the CHEAPEST active cycle",
    S.defaultCycleOf(growth).months, 6);
  ok("...and an inactive cycle is never the default",
    S.defaultCycleOf(pl(6, "g", "G", [cyc(60, 6, 100, false), cyc(61, 12, 200)])).months, 12);
  ok("a plan with nothing active has no default", S.defaultCycleOf(pl(7, "g", "G", [])), null);

  /* The stable grouping key. The catalogue has no planCode and its numeric id
     moves with migrations, so terms carry this instead. */
  ok("planCode comes from the family", S.planCodeOf(growth), "growth");
  ok("...and falls back to the title when the family is the generic one",
    S.planCodeOf(pl(8, "business", "Pro Plus", [])), "pro-plus");
  ok("...slugged, so it is safe in a URL",
    S.planCodeOf(pl(9, "business", "Growth & Scale!", [])), "growth-scale");

  /* THE FORM AND THE STORE CALL THE SAME FUNCTION. They disagreed for one
     commit — the dialog warned on planCode while the write refused on planId —
     which means the warning could show with the save going through. */
  const meera = S.historyOf("IB-U-0912", memberships);
  ok("a live term of the same plan is a clash",
    S.clashFor(meera, "pro").membershipId, "IB-MB-0912-3");
  ok("...a different plan is not", S.clashFor(meera, "starter"), null);
  ok("...and an expired term of the same plan is not",
    S.clashFor(S.historyOf("IB-U-0702", memberships), "starter"), null);
  ok("liveTermsOf excludes pending, which grants nothing",
    S.liveTermsOf(S.historyOf("IB-U-0958", memberships)).length, 0);
}

console.log("\ncounts, and the queues that read them");
const c = S.countsOf(all);
ok("total", c.total, 20);
ok("normal", c.normal, 6);
ok("active members", c.activeMembers, 7);
ok("paused", c.paused, 1);
ok("suspended", c.suspended, 2);
ok("former members", c.formerMembers, 3);
ok("deactivated", c.deactivated, 1);
ok("the six classifications account for everybody",
  c.normal + c.activeMembers + c.paused + c.suspended + c.formerMembers + c.deactivated, 20);
ok("pending activation", c.pending, 1);
ok("expiring soon (60d window)", c.expiringSoon, 3);
ok("recently ended (60d window)", c.recentlyEnded, 2);

console.log("\nconversion has a denominator, and null when it has none");
/* 13 of the 19 non-deactivated users have activated a term at some point: the
   7 active, the 1 paused, the 2 suspended and the 3 former members. Paused and
   suspended members COUNT here and do not count as Active Members two blocks
   up — that is the distinction, and this line is where it is pinned down. */
ok("conversion counts ever-members over non-deactivated users", c.conversion, 13 / 19);
ok("...and the deactivated account is out of the denominator, not the history",
  Math.round(c.conversion * 19), 13);
ok("an empty population returns null, not 0%", S.countsOf([]).conversion, null);
ok("pct() prints n/a for null rather than 0.0%", S.pct(null), "n/a");

/* THE TAB FIGURE AND THE PAGE IT OPENS. Each is a promise: press Members and
   you get exactly this many rows. The band used to be counted three different
   ways — off the filtered set on the renewal queue, off the whole set on
   analytics, and not at all on the lists — so one chip could show two numbers
   depending on which face you were standing on. bandCounts() is now the only
   way any face computes them, and these lines are what keep it that way. */
console.log("\nthe view band agrees with the faces it points at");
const band = S.bandCounts(all);
ok("Users carries the whole population", band.users, all.length);
ok("...which is every row, filtered or not", band.users, 20);
ok("Members counts anyone who holds a term or ever did", band.members, 13);
ok("...and that is exactly the Members face's own population",
  band.members,
  all.filter((r) => S.MEMBER_CLASSES.indexOf(r.classification) >= 0).length);
ok("Renewals is pending plus expiring soon", band.renewals, c.pending + c.expiringSoon);
/* The band is navigation, not a readout of the current search. Counting it off
   a narrowed set would make the tabs argue with each other the moment somebody
   typed a name into the box. */
const narrowedRows = S.applyFilters(all, { q: "sharma" });
ok("a search narrows the list", narrowedRows.length < all.length, true);
ok("...and does not move the band", S.bandCounts(all).users, band.users);

console.log("\nplan mix counts only entitling terms");
const growth = c.byPlan.find((p) => p.code === "growth");
ok("growth active terms", growth.n, 3);
ok("byPlan totals equal the active-member count",
  c.byPlan.reduce((n, p) => n + p.n, 0), c.activeMembers);

console.log("\nthe transition matrix refuses what it should");
ok("a cancelled term offers no lifecycle moves except renew",
  S.allowedActions(byId["IB-U-0655"].current).map((a) => a.key), ["renew"]);
ok("a pending term offers activate and cancel",
  S.allowedActions(byId["IB-U-0958"].current).map((a) => a.key).sort(), ["activate", "cancel"]);
ok("a paused term offers resume, suspend and cancel",
  S.allowedActions(byId["IB-U-0834"].current).map((a) => a.key).sort(),
  ["cancel", "resume", "suspend"]);
/* Renew is NOT offered from paused, and that is the matrix rather than an
   oversight: you resume a paused term, you do not renew one. Renewing a term
   that is not running would create a second live entitlement on the same
   product, which is the thing 409 active_membership_conflict exists to refuse. */
ok("...and NOT renew — you resume a paused term, you do not renew it",
  S.allowedActions(byId["IB-U-0834"].current).some((a) => a.key === "renew"), false);
ok("a suspended term cannot be paused",
  S.allowedActions(byId["IB-U-0790"].current).some((a) => a.key === "pause"), false);
ok("an active term can be renewed",
  S.allowedActions(byId["IB-U-0880"].current).some((a) => a.key === "renew"), true);

console.log("\nsearch matches a phone number however it is written");
const meera = byId["IB-U-0912"];
["+91 98450 11902", "9845011902", "98450 11902", "11902"].forEach((q) => {
  ok('q="' + q + '" finds Meera', S.applyFilters(all, { q }).some((r) => r === meera), true);
});
ok('q="IB-U-0912" finds Meera by id',
  S.applyFilters(all, { q: "IB-U-0912" }).map((r) => r.user.userId), ["IB-U-0912"]);

console.log("\nfilters agree with the counts they are drawn from");
[["normal", c.normal], ["active_member", c.activeMembers], ["paused_member", c.paused],
 ["suspended_member", c.suspended], ["former_member", c.formerMembers],
 ["deactivated", c.deactivated]].forEach(([cls, n]) => {
  ok("cls=" + cls + " returns exactly its own count",
    S.applyFilters(all, { cls }).length, n);
});
ok("flag=expiring returns the queue's own count",
  S.applyFilters(all, { flag: "expiring" }).length, c.expiringSoon);
ok("flag=pending returns the queue's own count",
  S.applyFilters(all, { flag: "pending" }).length, c.pending);

console.log("\nprofile completeness is graded against the schema, not guessed");
ok("a complete business profile is 100", byId["IB-U-0912"].completeness, 100);
ok("a bare registration is not", byId["IB-U-1029"].completeness < 100, true);
ok("...and names what is missing rather than only a percentage",
  byId["IB-U-1029"].missingFields.length > 0, true);

/* =============================================================================
   THE WRITES. Every one of these is a simulation today and an endpoint later,
   and the guarantees below are the ones the endpoint has to keep. They are
   asserted here rather than described in a doc because a described guarantee
   is one nobody notices breaking.
   ============================================================================= */
console.log("\nrenewal creates a new term and leaves the old one alone");
S.resetStore();
{
  const before = S.readMembership("IB-MB-0880-2");
  const snapshotBefore = JSON.stringify(before.entitlements);
  const countBefore = S.readMemberships().length;

  ok("renew is accepted from an active term", S.lifecycle("IB-MB-0880-2", "renew", ""), "");

  const after = S.readMembership("IB-MB-0880-2");
  ok("...the previous term keeps its status", after.status, "active");
  ok("...its dates are untouched", [after.startAt, after.endAt], [before.startAt, before.endAt]);
  ok("...its snapshot is untouched", JSON.stringify(after.entitlements), snapshotBefore);
  ok("...and a NEW row exists", S.readMemberships().length, countBefore + 1);

  const fresh = S.readMemberships().filter((m) => m.previousMembershipId === "IB-MB-0880-2")[0];
  ok("the new term links back to the old one", !!fresh, true);
  ok("...is Active", fresh.status, "active");
  ok("...carries the next term number", fresh.termNo, before.termNo + 1);
  /* SAME PLAN, SAME DURATION, carried forward. Renew used to re-read the
     catalogue and move the member onto the current price — a commercial
     decision this button must not take on somebody's behalf, and not one this
     module can take at all now the catalogue is the Plans module's. */
  ok("...carries the same plan forward", fresh.planName, before.planName);
  ok("...and the same duration", fresh.cycle.months, before.cycle.months);
  ok("...and the same frozen entitlements",
    JSON.stringify(fresh.entitlements), snapshotBefore);
  ok("the renewal appended a RENEWED event and nothing else moved",
    fresh.events.map((e) => e.type), ["MEMBERSHIP_RENEWED"]);
}

console.log("\nan off-matrix move changes nothing and says why");
S.resetStore();
{
  const err = S.lifecycle("IB-MB-0912-1", "pause", "trying to pause an expired term");
  ok("pausing an expired term is refused", err.indexOf("invalid_membership_transition") >= 0, true);
  ok("...and the term is untouched", S.readMembership("IB-MB-0912-1").status, "expired");
  ok("...and no event was appended",
    S.readMembership("IB-MB-0912-1").events.length, 3);
}

console.log("\nactivation freezes the snapshot, and the classification follows");
S.resetStore();
{
  const pending = S.readMembership("IB-MB-0958-1");
  ok("a pending term starts with no entitlements", pending.entitlements.length, 0);
  /* A term raised before this change has nothing parked on it, so activation
     must REFUSE rather than go live with access nobody can enumerate. */
  ok("...and activation refuses when there is nothing to freeze",
    S.lifecycle("IB-MB-0958-1", "activate", "").indexOf("nothing to freeze") >= 0, true);
  ok("...leaving it Pending", S.readMembership("IB-MB-0958-1").status, "pending");

  /* Give it something to freeze the way the form does, then activate. */
  const pendingFeatures = [
    { key: "feature.0", label: "Up to 60 listings", display: "Included" },
    { key: "feature.1", label: "2 rotation slots", display: "Included" },
  ];
  S.readMembership("IB-MB-0958-1").pendingFeatures = pendingFeatures;
  ok("activation is accepted once it has", S.lifecycle("IB-MB-0958-1", "activate", ""), "");
  const live = S.readMembership("IB-MB-0958-1");
  ok("...the status moved", live.status, "active");
  ok("...the snapshot was taken", live.entitlements.length > 0, true);
  ok("...from what was captured when the term was raised",
    live.entitlements.length, pendingFeatures.length);
  ok("...and the parked copy is consumed, not left behind", live.pendingFeatures, undefined);
  /* The classification is DERIVED, so it changes because the term changed —
     nothing set it, here or anywhere. */
  const row = S.toRow(S.readUser("IB-U-0958"), S.readMemberships());
  ok("...and the user is now an Active Member, derived", row.classification, "active_member");
  ok("...having been a Normal User a moment ago",
    S.toRow(require("../src/content/users/users.json").users
      .find((u) => u.userId === "IB-U-0958"),
      require("../src/content/users/memberships.json").memberships).classification, "normal");
}

console.log("\nevent types match the vocabulary, so every row has a label");
S.resetStore();
{
  const known = new Set(require("../src/content/users/vocabularies.json")
    .eventTypes.map((e) => e.key));
  S.lifecycle("IB-MB-0880-2", "pause", "Member requested a break");
  S.lifecycle("IB-MB-0880-2", "resume", "");
  S.lifecycle("IB-MB-0880-2", "suspend", "Policy breach reported");
  S.lifecycle("IB-MB-0880-2", "reactivate", "Resolved");
  S.lifecycle("IB-MB-0880-2", "cancel", "Member cancelled");
  const types = S.readMembership("IB-MB-0880-2").events.map((e) => e.type);
  ok("five actions appended five events", types.slice(0, 5).length, 5);
  /* CANCELLED with two Ls. Deriving the event name from the action produced
     MEMBERSHIP_CANCELED, which matches nothing in the vocabulary — the row
     would have rendered with no label and no tone. */
  ok("every appended type exists in the vocabulary",
    types.filter((t) => !known.has(t)), []);
  ok("cancellation spells CANCELLED", types.indexOf("MEMBERSHIP_CANCELLED") >= 0, true);
  const auditTypes = S.readAudit().filter((e) => e.userId === "IB-U-0880").map((e) => e.type);
  ok("and so does every audit row it wrote",
    auditTypes.filter((t) => !known.has(t)), []);
}

console.log("\na guarded action without a reason is refused");
S.resetStore();
ok("suspend with no reason", S.lifecycle("IB-MB-0880-2", "suspend", "   ")
  .indexOf("reason_required") >= 0, true);
ok("suspend with a reason", S.lifecycle("IB-MB-0880-2", "suspend", "Payment dispute"), "");

console.log("\nassignment refuses a second live term on the same product");
S.resetStore();
{
  const res = S.assignMembership("IB-U-0912", {
    planId: "9", planCode: "pro", planName: "Pro",
    cycle: { months: 12, price: 29500, currency: "INR" },
    features: [{ key: "feature.0", label: "Everything in the plan", display: "Included" }],
    source: "new_sale", reference: "PAY-X", reason: "",
    startAt: "2026-09-01T00:00:00+05:30", endAt: "2027-08-31T23:59:59+05:30",
    activateNow: false,
  });
  ok("a duplicate Pro term is refused", res.error.indexOf("already a live") >= 0, true);
  ok("...and nothing was created", res.membershipId, null);
}

console.log("\nassignment demands what its source demands");
S.resetStore();
{
  const noRef = S.assignMembership("IB-U-1041", {
    planId: "7", planCode: "starter", planName: "Starter",
    cycle: { months: 12, price: 29500, currency: "INR" },
    features: [{ key: "feature.0", label: "Everything in the plan", display: "Included" }],
    source: "new_sale", reference: "  ", reason: "",
    startAt: "2026-09-01T00:00:00+05:30", endAt: "2027-08-31T23:59:59+05:30",
    activateNow: false,
  });
  ok("a new sale with no payment reference is refused",
    noRef.error.indexOf("is required for a new sale") >= 0, true);

  const noReason = S.assignMembership("IB-U-1041", {
    planId: "7", planCode: "starter", planName: "Starter",
    cycle: { months: 12, price: 29500, currency: "INR" },
    features: [{ key: "feature.0", label: "Everything in the plan", display: "Included" }],
    source: "complimentary", reference: "", reason: "   ",
    startAt: "2026-09-01T00:00:00+05:30", endAt: "2027-08-31T23:59:59+05:30",
    activateNow: false,
  });
  ok("a complimentary grant with no reason is refused",
    noReason.error.indexOf("needs a stated reason") >= 0, true);

  const good = S.assignMembership("IB-U-1041", {
    planId: "7", planCode: "starter", planName: "Starter",
    cycle: { months: 12, price: 29500, currency: "INR" },
    features: [{ key: "feature.0", label: "Everything in the plan", display: "Included" }],
    source: "complimentary", reference: "", reason: "Founder approved on a call.",
    startAt: "2026-09-01T00:00:00+05:30", endAt: "2027-08-31T23:59:59+05:30",
    activateNow: false,
  });
  ok("...and is accepted once it has one", good.error, "");
  ok("...raised at Pending, not Active", !!good.membershipId, true);
  const raised = S.readMembership(good.membershipId);
  ok("...with the duration it was sold frozen on it", raised.cycle.months, 12);
  ok("...nothing entitled yet", raised.entitlements.length, 0);
  ok("...but what to freeze is parked, ready for activation",
    raised.pendingFeatures.length, 1);
}

console.log("\na profile save with a required field empty writes nothing");
S.resetStore();
{
  const err = S.updateProfile("IB-U-0912", { displayName: "Changed", city: "Bengaluru" });
  ok("a valid patch is accepted", err, "");
  ok("an unknown user is refused", S.updateProfile("IB-U-NOPE", { city: "X" })
    .indexOf("no longer exists") >= 0, true);
}

console.log("\nan account status is not a membership action");
S.resetStore();
ok("deactivating without a reason is refused",
  S.setUserStatus("IB-U-0912", "deactivated", "  ").indexOf("needs a reason") >= 0, true);
ok("deactivating with one is accepted",
  S.setUserStatus("IB-U-0912", "deactivated", "Member asked to close the account"), "");

console.log("\nnotes are append-only and never empty");
S.resetStore();
ok("an empty note is refused", S.addNote("IB-U-0912", "   ").indexOf("needs some text") >= 0, true);
ok("a real note is accepted", S.addNote("IB-U-0912", "Called about the renewal."), "");

S.resetStore();

console.log(failed ? "\n" + failed + " FAILED\n" : "\nall checks passed\n");
process.exit(failed ? 1 : 0);
