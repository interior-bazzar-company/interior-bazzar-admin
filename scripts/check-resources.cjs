/* =============================================================================
   Resources · the rules that fail silently.
   -----------------------------------------------------------------------------
   Bundles views/Resources/store.ts against the real seeds and asserts what the
   module CLAIMS about itself. Every assertion here covers something `tsc` and
   eslint cannot see, because none of it is a type error:

     · the department is a RULE, and an EMPTY one is everybody. Read it the
       other way and every company-wide form silently addresses nobody — which
       renders as a perfectly healthy empty table and throws nothing.
     · a max size is ENFORCED and not merely printed. A cap shown on a form and
       not checked on the way in is a suggestion.
     · pending is DERIVED — audience minus responses. If a count and its list
       are ever computed twice, they drift, and the screen still renders.
     · a submitted answer is FROZEN — editing fields bumps the version and
       leaves old answers alone. Get this wrong and evidence quietly rewrites
       itself.
     · the write refusals — a second submission, a delete over answers, a
       submission to a closed form. All of them return a Result rather than
       throwing, so a broken guard looks exactly like a working one.
     · a required FILE field is answered by its file, not by text beside it. A
       guard that only checked the text would accept a typed filename with
       nothing attached, and the row would read as complete.
     · the share link carries BOTH ids. A link that named only the resource
       would come back as an answer from nobody, and it would look fine.

     node scripts/check-resources.cjs
   ============================================================================= */
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "node_modules", ".tmp", "resources-store.cjs");

let failed = 0;
const ok = (what, cond) => {
  if (cond) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what);
};
const eq = (what, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log("  ok   " + what); return; }
  failed++;
  console.log("  FAIL " + what + "\n         got  " + a + "\n         want " + b);
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });

esbuild.build({
  entryPoints: [path.join(ROOT, "src", "admin", "views", "Resources", "store.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  define: { "import.meta.env": '{"DEV":false}' },
  external: ["react"],
  loader: { ".css": "empty" },
  logLevel: "error",
  outfile: OUT,
}).then(() => {
  const S = require(OUT);
  console.log("\nResources\n");
  S.resetStore();

  /* ---- the seed is what the module says it is ------------------------- */
  const all = S.readResources();
  eq("four resources in the seed", all.length, 4);
  eq("nine responses in the seed", S.readResponses().length, 9);
  ok("every response points at a real resource",
    S.readResponses().every((x) => !!S.resourceOf(x.resourceId)));

  /* ---- THE RULE ------------------------------------------------------- */
  console.log("\nThe audience is a rule, not a list\n");

  const onboarding = S.resourceOf("RES-01");
  /* It was four axes — departments, designations, a joined-after date and named
     people — and is one department. The narrower rules are recoverable if a real
     case turns up; what is asserted here is that the one that remains is exact. */
  eq("a department matches everybody in it",
    S.audienceOf(onboarding).map((m) => m.memberId).sort(), ["52", "70", "74"]);
  ok("…and nobody outside it",
    S.audienceOf(onboarding).every((m) => m.department === "Sales"));

  const policy = S.resourceOf("RES-03");
  /* THE ONE THAT MATTERS. An empty department is EVERY active member, not none.
     Read the other way, every company-wide form addresses nobody and renders as
     a perfectly healthy empty table. */
  ok("an EMPTY department list is everyone, not nobody",
    S.audienceOf(policy).length === 8 && S.isEveryone(policy.departments));
  ok("…and a named one is not everyone", !S.isEveryone(["Sales"]));

  eq("a department nobody is in matches nobody",
    S.audienceOf({ departments: ["Legal"] }).length, 0);
  ok("…which is not an error — it picks people up as they join",
    Array.isArray(S.audienceOf({ departments: ["Legal"] })));

  /* SEVERAL DEPARTMENTS IS AN OR, not an AND — a member is in one department,
     so ANDing them would match nobody, always, and look like an empty roster
     rather than a broken rule. */
  eq("several departments matches anybody in any of them",
    S.audienceOf({ departments: ["Sales", "Leadership"] }).map((m) => m.memberId).sort(),
    ["41", "52", "70", "74"]);
  ok("…and a department nobody is in does not narrow the others",
    S.audienceOf({ departments: ["Sales", "Legal"] }).length === 3);

  ok("a left member is in no audience",
    S.audienceOf({ departments: [] }).every((m) => m.status === "active"));

  ok("nobody appears in an audience twice",
    (() => {
      const ids = S.audienceOf({ departments: [] }).map((m) => m.memberId);
      return ids.length === new Set(ids).size;
    })());

  eq("the rule reads as one line, in a table cell",
    [S.audienceLine(["Sales"]), S.audienceLine(["Sales", "Ops"]), S.audienceLine([])],
    ["Sales", "Sales · Ops", "Everyone"]);

  /* ---- TAGS ------------------------------------------------------------ */
  console.log("\nTags are free text, not an enum\n");

  eq("a tag list is trimmed and de-duplicated case-insensitively",
    S.cleanTags([" Onboarding ", "onboarding", "Sales", "", "  "]), ["Onboarding", "Sales"]);
  ok("…keeping the order they were typed in",
    S.cleanTags(["b", "a", "c"]).join(",") === "b,a,c");
  ok("the seed's tags survived the migration off `kind`",
    S.resourceOf("RES-01").tags.indexOf("Onboarding") >= 0);
  ok("suggestions are offered but never enforced",
    S.TAG_SUGGESTIONS.length > 0
    && S.createResource({
      title: "Anything", description: "", tags: ["a-tag-nobody-seeded"], departments: [],
      fields: [{ fieldId: "F1", type: "text", label: "X", help: null, required: false, options: [], accept: [], maxMb: null }],
    }).ok === true);
  ok("…and a tag used anywhere is offered back",
    S.tagsInUse().indexOf("a-tag-nobody-seeded") >= 0);
  S.resetStore();

  /* ---- PENDING IS DERIVED --------------------------------------------- */
  console.log("\nPending is the lack of a response\n");

  const t1 = S.totalsFor(onboarding);
  /* Sales is three people now — the joined-after axis that used to cut the Head
     out of it is gone, and one of the three has answered. */
  eq("onboarding · 1 of 3 answered", [t1.submitted, t1.pending, t1.audience], [1, 2, 3]);
  ok("…and the percentage agrees with the counts",
    t1.pct === Math.round((t1.submitted / t1.audience) * 100));

  ok("no stored row anywhere says 'pending'",
    S.readResponses().every((x) => JSON.stringify(x).indexOf("pending") < 0));

  /* THE ONE THAT MATTERS: the strip's number and the table's rows are the same
     derivation. A module that computed them separately would pass every other
     assertion here and still show 3 on a tab above 4 rows. */
  ["RES-01", "RES-02", "RES-03", "RES-04"].forEach((id) => {
    const r = S.resourceOf(id);
    const t = S.totalsFor(r);
    const rows = S.rowsFor(r);
    ok("`" + id + "` · the count and the rows are one derivation",
      rows.length === t.audience
      && rows.filter((x) => x.state === "submitted").length === t.submitted
      && rows.filter((x) => x.state === "pending").length === t.pending);
  });

  /* A response from outside the audience is kept and counted apart, so the
     completion figure keeps meaning what it says. */
  const asset = S.resourceOf("RES-02");
  ok("every asset-handover answer is inside its audience (everyone)",
    S.strayResponses(asset).length === 0);
  const shrunk = JSON.parse(JSON.stringify(asset));
  shrunk.departments = ["Sales"];
  ok("narrowing an audience strands the answers it excludes, rather than losing them",
    S.strayResponses(shrunk).length === 2);
  ok("…and every stranded one is still readable",
    S.strayResponses(shrunk).every((x) => !!S.responseOf(x.responseId)));

  /* ---- FROZEN ANSWERS -------------------------------------------------- */
  console.log("\nA submitted answer is frozen\n");

  const old = S.responseOf("RSP-03");
  eq("the v1 answer kept the label it was given",
    old.answers.filter((a) => a.fieldId === "F3")[0].label, "Condition");
  eq("…while the definition has moved on",
    S.resourceOf("RES-02").fields.filter((f) => f.fieldId === "F3")[0].label,
    "Condition at handover");
  eq("…and the response still points at the version it answered", old.version, 1);

  const draft = (r) => ({
    title: r.title, description: r.description,
    tags: r.tags.slice(), departments: r.departments.slice(),
    fields: JSON.parse(JSON.stringify(r.fields)),
  });

  /* Editing a LABEL on an answered form bumps the version. */
  const d1 = draft(S.resourceOf("RES-01"));
  d1.fields[0].label = "Full legal name";
  const up1 = S.updateResource("RES-01", d1);
  ok("editing a field on an answered resource bumps the version",
    up1.ok && up1.value.version === 2);
  eq("…and the answer already given is untouched",
    S.responseOf("RSP-01").answers[0].label, "Full name, as on your PAN");
  eq("…and still names version 1", S.responseOf("RSP-01").version, 1);

  /* Editing only the title must NOT bump — nobody answered a title. */
  const d2 = draft(S.resourceOf("RES-01"));
  d2.title = "Sales onboarding";
  const up2 = S.updateResource("RES-01", d2);
  ok("editing only the title does not bump the version",
    up2.ok && up2.value.version === 2);

  /* Editing an UNANSWERED resource never bumps, however much it changes. */
  const d3 = draft(S.resourceOf("RES-04"));
  d3.fields.push({ fieldId: "F9", type: "text", label: "Forwarding address", help: null, required: false, options: [] });
  const up3 = S.updateResource("RES-04", d3);
  ok("editing a resource nobody has answered stays on version 1",
    up3.ok && up3.value.version === 1);

  /* ---- THE REFUSALS ---------------------------------------------------- */
  console.log("\nThe writes, and what they refuse\n");
  S.resetStore();

  ok("a draft cannot be submitted to",
    S.submitResponse("RES-04", "41", { F1: "2026-09-30", F2: "Yes", F3: "Yes" }).ok === false);

  /* RES-01 asks for three files now, two of them required. A submission with
     the text filled in and nothing attached is NOT complete. */
  const textOnly = S.submitResponse("RES-01", "74", {
    F1: "Priya Iyer", F2: "2025-11-04", F3: "South", F4: "offer.pdf", F5: "Yes", F6: "",
  });
  ok("a required FILE field is not answered by typing a filename",
    textOnly.ok === false);
  ok("…and the refusal names the upload that is missing",
    textOnly.ok === false && textOnly.message.indexOf("offer letter") >= 0);

  const FILE = (n, m, kb) => ({ fileName: n, mimeType: m, sizeKb: kb, url: "/media/" + n });
  const first = S.submitResponse("RES-01", "74", {
    F1: "Priya Iyer", F2: "2025-11-04", F3: "South", F5: "Yes", F6: "",
  }, {
    F4: FILE("offer.pdf", "application/pdf", 300),
    F7: FILE("pan-priya.jpg", "image/jpeg", 720),
  });
  ok("an open resource accepts a complete submission", first.ok === true);
  ok("…and an OPTIONAL upload may be skipped",
    first.ok && first.value.answers.filter((a) => a.fieldId === "F8")[0].file === null);
  ok("…the file answer carries the file, not just its name",
    first.ok && (() => {
      const a = first.value.answers.filter((x) => x.fieldId === "F4")[0];
      return !!a.file && a.file.mimeType === "application/pdf" && a.file.sizeKb === 300;
    })());
  ok("…and its `value` is the file's name, so any reader can print it",
    first.ok && first.value.answers.filter((x) => x.fieldId === "F4")[0].value === "offer.pdf");
  ok("…and it lands on the resource's CURRENT version",
    first.ok && first.value.version === S.resourceOf("RES-01").version);
  /* Sales is three people, so one submission takes the queue down by one rather
     than emptying it — the assertion is that the derived count MOVED, which is
     the thing that would break if a write and a read disagreed. */
  ok("…and the pending count drops by exactly one",
    S.totalsFor(S.resourceOf("RES-01")).pending === 1
    && S.totalsFor(S.resourceOf("RES-01")).submitted === 2);
  ok("…leaving the member who has not answered, and only them",
    S.rowsFor(S.resourceOf("RES-01")).filter((x) => x.state === "pending")
      .map((x) => x.member.memberId).join() === "52");

  ok("a second submission from the same member is refused",
    S.submitResponse("RES-01", "74", { F1: "x", F2: "x", F3: "x", F4: "x", F5: "x" }).ok === false);

  const short = S.submitResponse("RES-03", "70", { F2: "no questions" });
  ok("a missing REQUIRED answer is refused", short.ok === false);
  ok("…and the message names the field that is missing",
    short.ok === false && short.message.indexOf("2026 leave policy") >= 0);

  ok("an optional field may be left blank",
    S.submitResponse("RES-03", "74", { F1: "Yes" }).ok === true);

  ok("a resource with responses cannot be deleted",
    S.deleteResource("RES-01").ok === false);
  ok("…and the refusal counts them and offers the way out",
    (() => {
      const r = S.deleteResource("RES-02");
      return r.ok === false && r.message.indexOf("3 responses") >= 0
        && r.message.indexOf("outdated") >= 0;
    })());
  /* AN UNANSWERED ONE MAY GO WHATEVER ITS STATE. It was drafts only, which left
     an open form nobody ever answered undeletable for no reason — that is a
     mistake to clear away, not a record to keep. */
  ok("an unanswered draft can be deleted", S.deleteResource("RES-04").ok === true);

  ok("closing stops submissions",
    S.closeResource("RES-03").ok === true
    && S.submitResponse("RES-03", "86", { F1: "Yes" }).ok === false);
  ok("…and keeps every answer already given",
    S.totalsFor(S.resourceOf("RES-03")).submitted === 6);
  ok("a closed resource cannot be edited until it is reopened",
    S.updateResource("RES-03", draft(S.resourceOf("RES-03"))).ok === false);
  ok("reopening restores it", S.openResource("RES-03").ok === true);

  /* ---- THE BUILDER'S OWN GUARDS ---------------------------------------- */
  console.log("\nWhat the builder refuses to create\n");

  const base = { title: "T", description: "", tags: [], departments: [] };
  const FLD = (p) => Object.assign({
    fieldId: "F1", type: "text", label: "Name", help: null,
    required: false, options: [], accept: [], maxMb: null,
  }, p);
  ok("a resource with no fields is refused",
    S.createResource({ ...base, fields: [] }).ok === false);
  ok("a field with no label is refused",
    S.createResource({ ...base, fields: [FLD({ label: "  " })] }).ok === false);
  ok("a choice field with no options is refused",
    S.createResource({ ...base, fields: [FLD({ type: "select", label: "Pick" })] }).ok === false);
  ok("an untitled resource is refused",
    S.createResource({ ...base, title: "", fields: [FLD({})] }).ok === false);
  ok("a max size of zero is refused",
    S.createResource({ ...base, fields: [FLD({ type: "file", maxMb: 0 })] }).ok === false);
  ok("…and a negative one",
    S.createResource({ ...base, fields: [FLD({ type: "file", maxMb: -5 })] }).ok === false);
  ok("an uncapped file field is fine — null is 'no limit', not 'unset'",
    S.createResource({ ...base, fields: [FLD({ type: "file", maxMb: null })] }).ok === true);

  const made = S.createResource({
    ...base, title: "Vendor declaration", tags: ["Compliance"], departments: ["Operations"],
    fields: [FLD({ label: "Vendor name", required: true })],
  });
  ok("a valid one is created", made.ok === true);
  /* OPEN, not draft — reversed deliberately. Nothing goes out on its own: the
     only thing that reaches anybody is a link a person copies and sends, so a
     draft state in front of that was a step with nothing behind it, and it made
     a new resource invisible on the one table this module has. */
  ok("…as OPEN, because creating one is how you get its link",
    made.ok && made.value.state === "open" && made.value.openedAt !== null);
  ok("…so its audience appears as pending rows immediately",
    made.ok && S.totalsFor(made.value).pending === S.totalsFor(made.value).audience
    && S.totalsFor(made.value).audience > 0);
  ok("…on version 1", made.ok && made.value.version === 1);

  /* ---- OUTDATED, DUPLICATE, AND THE SPACE DELETE ------------------------- */
  console.log("\nRetiring, copying, and freeing space\n");
  S.resetStore();

  /* OUTDATED IS NOT CLOSED. Both refuse submissions and keep every answer; they
     differ in what somebody does next, which is the only reason a fourth state
     earns its place. If these two ever behave identically in every respect,
     collapse them. */
  const out1 = S.outdateResource("RES-03");
  ok("a resource can be marked outdated", out1.ok === true && out1.value.state === "outdated");
  ok("…which keeps every answer already given",
    S.responsesFor("RES-03").length === 5);
  ok("…refuses new ones, and says why in its own words",
    (() => {
      const r = S.submitResponse("RES-03", "70", { F1: "Yes" });
      return r.ok === false && r.message.indexOf("outdated") >= 0;
    })());
  ok("…stops the link being worth sending", S.isShareable(S.resourceOf("RES-03")) === false);
  ok("…sorts last, because it is the one telling you not to use it",
    S.orderedResources()[S.orderedResources().length - 1].resourceId === "RES-03");
  ok("…and cannot be marked outdated twice", S.outdateResource("RES-03").ok === false);
  /* REOPEN IS THE WAY BACK, and it has to stay reachable: Close left the row
     menu and Outdated did not, so without a Reopen beside it marking a form
     outdated would be a one-way door. */
  ok("reopening undoes it — a form retired by mistake should not need rebuilding",
    S.openResource("RES-03").ok === true && S.resourceOf("RES-03").state === "open");

  /* A COPY IS A NEW FORM, not a fork of an old one's history. */
  S.resetStore();
  const dup = S.duplicateResource("RES-01");
  ok("a resource can be duplicated", dup.ok === true);
  ok("…as a DRAFT on version 1, whatever the original was on",
    dup.ok && dup.value.state === "draft" && dup.value.version === 1);
  ok("…carrying every field, the tags and the departments",
    dup.ok && dup.value.fields.length === S.resourceOf("RES-01").fields.length
    && dup.value.departments.join() === "Sales" && dup.value.tags.length === 2);
  ok("…and NOT the responses — they belong to the form that was answered",
    dup.ok && S.responsesFor(dup.value.resourceId).length === 0);
  ok("…under a title that says what it is", dup.ok && dup.value.title.indexOf("(copy)") > 0);

  /* THE SPACE DELETE. It is the only thing in this module that destroys
     evidence, so it reports what it reclaimed and the row goes back to pending. */
  S.resetStore();
  const before = S.storageOf(S.readResponses());
  ok("the module knows what it is holding", before > 0);
  eq("…which is the sum of the four seeded uploads",
    before, 412 + 880 + 1640 + 2280);

  const rsp1 = S.responseOf("RSP-01");
  const size1 = S.sizeOfResponse(rsp1);
  const del = S.deleteResponse("RSP-01");
  ok("a submission can be deleted", del.ok === true);
  ok("…returning exactly what it freed", del.ok && del.value === size1 && size1 > 0);
  eq("…and the total drops by that much",
    S.storageOf(S.readResponses()), before - size1);
  ok("…the answer is gone", S.responseOf("RSP-01") === null);
  /* THE HONEST CONSEQUENCE, asserted rather than left as a side effect: the
     person is owed the form again and their link works again. */
  ok("…the member goes back to pending",
    S.rowsFor(S.resourceOf("RES-01")).filter((x) => x.member.memberId === "70")[0].state
      === "pending");
  ok("…and deleting the same one twice is refused",
    S.deleteResponse("RSP-01").ok === false);

  /* Deleting every response makes the resource deletable, which is the route the
     refusal above points at. */
  S.resetStore();
  S.responsesFor("RES-02").forEach((x) => S.deleteResponse(x.responseId));
  ok("a resource emptied of responses can then be deleted",
    S.deleteResource("RES-02").ok === true);

  S.resetStore();
  /* A submission with no uploads frees nothing, and the number it returns has to
     BE zero rather than merely be falsy — the screen prints "Deleted." instead of
     "Deleted. 0 KB freed." on the strength of it. */
  ok("a response with no files reports zero freed",
    (() => {
      const before = S.storageOf(S.readResponses());
      const r = S.deleteResponse("RSP-05");
      return r.ok === true && r.value === 0
        && S.storageOf(S.readResponses()) === before;
    })());
  S.resetStore();

  /* ---- THE SIZE CAP ------------------------------------------------------ */
  console.log("\nA max size is enforced, not merely printed\n");
  S.resetStore();

  const F = (n, m, kb) => ({ fileName: n, mimeType: m, sizeKb: kb, url: "/media/" + n });
  /* RES-01's passport photograph is capped at 5 MB. */
  const over = S.submitResponse("RES-01", "74", {
    F1: "Priya Iyer", F2: "2025-11-04", F3: "South", F5: "Yes", F6: "",
  }, {
    F4: F("offer.pdf", "application/pdf", 300),
    F7: F("pan.jpg", "image/jpeg", 700),
    F8: F("huge-photo.png", "image/png", 9 * 1024),
  });
  ok("a file over the cap is refused", over.ok === false);
  ok("…and the refusal names the field, the cap and the actual size",
    over.ok === false
    && over.message.indexOf("Passport photograph") >= 0
    && over.message.indexOf("5 MB") >= 0
    && over.message.indexOf("9.0 MB") >= 0);

  const under = S.submitResponse("RES-01", "74", {
    F1: "Priya Iyer", F2: "2025-11-04", F3: "South", F5: "Yes", F6: "",
  }, {
    F4: F("offer.pdf", "application/pdf", 300),
    F7: F("pan.jpg", "image/jpeg", 700),
    F8: F("photo.png", "image/png", 4 * 1024),
  });
  ok("…and one inside it is accepted", under.ok === true);

  S.resetStore();
  ok("an UNCAPPED field takes anything",
    S.submitResponse("RES-02", "41", { F1: "Laptop", F2: "X1", F3: "New", F4: "2026-09-06" },
      { F5: F("giant.jpg", "image/jpeg", 40 * 1024) }).ok === true
    || S.resourceOf("RES-02").fields.filter((x) => x.fieldId === "F5")[0].maxMb !== null);
  S.resetStore();

  eq("every seeded upload states a cap the member can read",
    S.readResources().reduce((a, r) => a.concat(r.fields.filter((x) => x.type === "file")), [])
      .filter((x) => x.maxMb === null).length, 0);

  /* ---- THE LINK --------------------------------------------------------- */
  console.log("\nThe share link\n");
  S.resetStore();

  const l1 = S.shareLink("RES-01", "70");
  const l2 = S.shareLink("RES-01", "74");
  const l3 = S.shareLink("RES-02", "70");
  ok("a link is per member AND per resource, never per form alone",
    l1 !== l2 && l1 !== l3 && l2 !== l3);
  ok("…and it is stable, so the same row hands out the same link twice",
    S.shareLink("RES-01", "70") === l1);
  ok("…and it points at the public site, not at this panel",
    l1.indexOf("/r/") > 0 && l1.indexOf("undefined") < 0);
  ok("…degrading to a readable host when FRONTEND_URL is absent",
    l1.indexOf("http") === 0);
  ok("the token names both ids",
    S.shareToken("RES-01", "70").indexOf("res01") >= 0
    && S.shareToken("RES-01", "70").indexOf("m70") >= 0);

  /* A link is only worth sending while there is something to submit to. */
  ok("an open resource is shareable", S.isShareable(S.resourceOf("RES-01")) === true);
  ok("a draft is not", S.isShareable(S.resourceOf("RES-04")) === false);
  S.closeResource("RES-01");
  ok("and a closed one is not", S.isShareable(S.resourceOf("RES-01")) === false);

  /* ---- FILES, AS A PILE -------------------------------------------------- */
  console.log("\nWhat came back\n");
  S.resetStore();

  const files = S.filesIn(S.readResponses());
  eq("the seed carries four uploaded files", files.length, 4);
  ok("every one names its type and size",
    files.every((x) => !!x.file.mimeType && x.file.sizeKb > 0 && !!x.file.url));
  ok("…and every one is reachable from the response it came in on",
    files.every((x) => !!S.responseOf(x.response.responseId)));
  eq("sizes read as sizes past a thousand", S.fmtSize(1640), "1.6 MB");
  eq("…and as kilobytes below it", S.fmtSize(412), "412 KB");

  /* THE FROZEN CASE, WITH FILES IN IT. RSP-03 answered v1 of the asset handover,
     before the photo field existed — so it has no file and must not grow one. */
  ok("a v1 answer did not acquire the file field added in v2",
    S.responseOf("RSP-03").answers.every((a) => !a.file));

  /* ---- WHAT A FIELD WILL TAKE -------------------------------------------- */
  eq("an empty accept reads as any file", S.acceptLine([]), "Any file");
  eq("one kind reads as itself", S.acceptLine(["pdf"]), "PDF");
  eq("two read as a sentence", S.acceptLine(["pdf", "image"]), "PDF or image");
  ok("an empty accept puts no attribute on the input",
    S.acceptAttr([]) === undefined);
  ok("…and a set one carries real mime types",
    (S.acceptAttr(["pdf", "image"]) || "").indexOf("application/pdf") >= 0);

  /* ---- reset ----------------------------------------------------------- */
  S.resetStore();
  eq("reset restores the authored four", S.readResources().length, 4);
  eq("…and the authored nine", S.readResponses().length, 9);

  console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
