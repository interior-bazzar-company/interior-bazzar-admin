/* =============================================================================
   Agreements · the rules that fail silently.
   -----------------------------------------------------------------------------
   Bundles views/Agreements/store.ts against the real seeds. Every assertion
   covers something neither `tsc` nor eslint can see:

     · THE BODY IS COPIED AT SEND, not referenced. Get this wrong and a template
       edit silently rewrites documents people have already signed — and every
       screen keeps rendering, showing today's wording as what was agreed to.
     · a template edit bumps the version only when it has been sent, and only
       when the CLAUSES changed. A title is not something anybody signed.
     · expiry is DERIVED. It is a fact about today, so it must not be a stored
       state; stored, it would be wrong between sweeps and nothing would throw.
     · the write refusals — a second live copy to the same person, revoking a
       signature, sending a draft, deleting a template that has been sent.
     · ONE LIST OF AGREEMENTS. This module writes through Team's store; if it
       ever grows its own, both would render perfectly and disagree.

     node scripts/check-agreements.cjs
   ============================================================================= */
const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "node_modules", ".tmp", "agreements-store.cjs");

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
  entryPoints: [path.join(ROOT, "src", "admin", "views", "Agreements", "store.ts")],
  bundle: true, platform: "node", format: "cjs",
  define: { "import.meta.env": '{"DEV":false}' },
  external: ["react"],
  loader: { ".css": "empty" },
  logLevel: "error",
  outfile: OUT,
}).then(() => {
  const S = require(OUT);
  console.log("\nAgreements\n");
  S.resetTemplates();

  /* ---- the seed ------------------------------------------------------- */
  eq("four templates in the seed", S.readTemplates().length, 4);
  eq("six agreements, read from Team's store", S.allAgreements().length, 6);
  ok("…ordered newest first",
    S.allAgreements().every((a, i, all) =>
      i === 0 || String(all[i - 1].sentAt) >= String(a.sentAt)));
  ok("active templates sort above drafts",
    S.readTemplates()[0].state === "active"
    && S.readTemplates()[S.readTemplates().length - 1].state === "draft");

  /* ---- ONE LIST ------------------------------------------------------- */
  console.log("\nOne list of agreements, not two\n");
  const before = S.readAgreements().length;
  const sent = S.sendTemplate("TPL-ASSET", "41");
  ok("sending writes through Team's store", sent.ok === true
    && S.readAgreements().length === before + 1);
  ok("…and the new copy is visible from this module",
    sent.ok && !!S.agreementOf(sent.data.agreementId));
  ok("…and from the template it came from",
    sent.ok && S.sentFrom("TPL-ASSET").some((a) => a.agreementId === sent.data.agreementId));

  /* ---- THE FROZEN BODY ------------------------------------------------ */
  console.log("\nThe body is copied at send, never referenced\n");
  ok("a sent copy carries its own body", sent.ok && !!sent.data.body);
  ok("…which is the template's text, filled in",
    sent.ok && sent.data.body.indexOf("V. Shakya") >= 0
    && sent.data.body.indexOf("{{name}}") < 0);
  eq("…stamped with the template's version at that moment",
    sent.ok ? sent.data.version : null, S.templateOf("TPL-ASSET").version);

  /* THE ONE THAT MATTERS. Edit the template afterwards and the copy must not
     move — this is the assertion that fails if `body` is ever read through to
     the template, and nothing else would notice. */
  const draft = (t) => ({
    title: t.title, kind: t.kind, purpose: t.purpose,
    clauses: JSON.parse(JSON.stringify(t.clauses)),
  });
  const d = draft(S.templateOf("TPL-ASSET"));
  d.clauses[0].text = "COMPLETELY DIFFERENT WORDING.";
  const up = S.updateTemplate("TPL-ASSET", d);
  ok("editing a sent template bumps its version", up.ok && up.data.version === 2);
  ok("…and the copy already out keeps the wording it went with",
    S.agreementOf(sent.data.agreementId).body.indexOf("COMPLETELY DIFFERENT") < 0);
  eq("…and keeps the version it was sent under",
    S.agreementOf(sent.data.agreementId).version, 1);
  ok("…while the template itself has moved on",
    S.templateOf("TPL-ASSET").clauses[0].text.indexOf("COMPLETELY DIFFERENT") >= 0);

  ok("bodyOf reads the frozen copy and says so",
    S.bodyOf(S.agreementOf(sent.data.agreementId)).frozen === true);
  ok("…and falls back to the template for a copy that has none, saying so too",
    S.bodyOf(S.agreementOf("AG-02")).frozen === false);

  /* Editing only the title must NOT bump — nobody signed a title. */
  S.resetTemplates();
  const d2 = draft(S.templateOf("TPL-OFFER"));
  d2.title = "Offer letter (2026)";
  const up2 = S.updateTemplate("TPL-OFFER", d2);
  eq("editing only the title does not bump the version",
    up2.ok ? up2.data.version : null, 2);

  /* An unsent template never bumps, however much it changes. */
  const d3 = draft(S.templateOf("TPL-EXIT"));
  d3.clauses.push({ clauseId: "C9", heading: "New", text: "Anything." });
  const up3 = S.updateTemplate("TPL-EXIT", d3);
  eq("editing a template nobody has been sent stays on version 1",
    up3.ok ? up3.data.version : null, 1);

  /* ---- THE PLACEHOLDERS ----------------------------------------------- */
  console.log("\nTwo placeholders, and only two\n");
  const filled = S.renderBody(
    [{ clauseId: "C1", heading: "{{name}}", text: "For {{name}} on {{date}}. Keep {{other}}." }],
    "Priya Iyer", "2026-09-06");
  ok("`{{name}}` is filled, in the heading and the text",
    filled[0].heading === "Priya Iyer" && filled[0].text.indexOf("For Priya Iyer") === 0);
  ok("`{{date}}` is filled, and readable rather than an ISO string",
    filled[0].text.indexOf("6 Sep 2026") >= 0
    && filled[0].text.indexOf("2026-09-06") < 0);
  /* A hole in a document is worse than a stray brace, because only the second
     is obvious to whoever proof-reads it. */
  ok("anything else is left exactly as typed, not blanked",
    filled[0].text.indexOf("{{other}}") >= 0);

  /* ---- EXPIRY IS DERIVED ---------------------------------------------- */
  console.log("\nExpiry is a fact about today, not a state\n");
  S.resetTemplates();
  const out = S.allAgreements().filter((a) => a.state === "sent" || a.state === "viewed");
  ok("some copies are out for signature", out.length > 0);
  ok("no stored state anywhere says 'expired'",
    S.allAgreements().every((a) => a.state !== "expired"));
  ok("…and one past its date reads as expired today",
    S.isExpired({ state: "sent", expiresAt: "2020-01-01" }) === true);
  ok("…while a signed one never does, whatever its date",
    S.isExpired({ state: "signed", expiresAt: "2020-01-01" }) === false);
  ok("…and stateOf reports it without it being stored",
    S.stateOf({ state: "sent", expiresAt: "2020-01-01" }) === "expired");
  ok("a link is only worth sending while it is live",
    S.isSendable({ state: "sent", expiresAt: "2099-01-01" }) === true
    && S.isSendable({ state: "sent", expiresAt: "2020-01-01" }) === false
    && S.isSendable({ state: "signed", expiresAt: null }) === false
    && S.isSendable({ state: "revoked", expiresAt: null }) === false);

  /* ---- THE LINK -------------------------------------------------------- */
  const a2 = S.agreementOf("AG-01");
  ok("a link carries the agreement's own token",
    S.signLink(a2).indexOf(a2.token) > 0);
  ok("…and points at the public site, not at this panel",
    S.signLink(a2).indexOf("/sign/") > 0 && S.signLink(a2).indexOf("undefined") < 0);

  /* ---- THE REFUSALS ---------------------------------------------------- */
  console.log("\nThe writes, and what they refuse\n");
  S.resetTemplates();

  ok("a draft template cannot be sent",
    S.sendTemplate("TPL-EXIT", "41").ok === false);
  ok("…and the refusal says to put it in use",
    S.sendTemplate("TPL-EXIT", "41").message.indexOf("draft") >= 0);

  const first = S.sendTemplate("TPL-ASSET", "63");
  ok("an active one can be", first.ok === true);
  ok("a second live copy to the same person is refused",
    S.sendTemplate("TPL-ASSET", "63").ok === false);
  ok("…and the refusal names them",
    S.sendTemplate("TPL-ASSET", "63").message.indexOf("Meera") >= 0);
  ok("…but a different person is fine",
    S.sendTemplate("TPL-ASSET", "70").ok === true);

  /* Revoking frees the person for a fresh copy — the route the refusal offers. */
  ok("revoking lets a fresh copy go out",
    S.revokeAgreement(first.data.agreementId).ok === true
    && S.sendTemplate("TPL-ASSET", "63").ok === true);

  ok("a signed agreement cannot be revoked",
    S.revokeAgreement("AG-02").ok === false);
  ok("a signed agreement cannot be signed again",
    S.signAgreement("AG-02", "Someone Else").ok === false);
  ok("signing needs a real name",
    S.signAgreement("AG-01", "x").ok === false);
  const signed = S.signAgreement("AG-01", "N. Pillai");
  ok("…and a real one works", signed.ok === true);
  ok("…capturing the name, the time and the address",
    signed.ok && signed.data.signedName === "N. Pillai"
    && !!signed.data.signedAt && !!signed.data.signerIp);
  ok("…and clearing the expiry, because it no longer means anything",
    signed.ok && signed.data.expiresAt === null);

  ok("a template that has been sent cannot be deleted",
    S.deleteTemplate("TPL-NDA").ok === false);
  ok("…and the refusal offers retiring instead",
    S.deleteTemplate("TPL-NDA").message.indexOf("Retire") >= 0);
  ok("an unsent one can be", S.deleteTemplate("TPL-EXIT").ok === true);

  S.resetTemplates();
  const heldBefore = S.sentFrom("TPL-NDA").length;
  ok("the seed has copies of it to keep", heldBefore === 3);
  ok("retiring stops it being sent and keeps every copy already made",
    S.retireTemplate("TPL-NDA").ok === true
    && S.sendTemplate("TPL-NDA", "41").ok === false
    && S.sentFrom("TPL-NDA").length === heldBefore);
  ok("…and a retired template cannot be edited until reinstated",
    S.updateTemplate("TPL-NDA", draft(S.templateOf("TPL-NDA"))).ok === false);
  ok("reinstating it works", S.activateTemplate("TPL-NDA").ok === true);

  /* ---- WHAT THE BUILDER REFUSES ---------------------------------------- */
  console.log("\nWhat the editor refuses to create\n");
  const base = { title: "T", kind: "custom", purpose: "" };
  ok("a template with no clauses is refused",
    S.createTemplate({ ...base, clauses: [] }).ok === false);
  ok("a clause with no text is refused",
    S.createTemplate({ ...base, clauses: [{ clauseId: "C1", heading: "H", text: "  " }] }).ok === false);
  ok("an untitled template is refused",
    S.createTemplate({ ...base, title: "", clauses: [{ clauseId: "C1", heading: "", text: "x" }] }).ok === false);
  const made = S.createTemplate({
    ...base, title: "Vendor NDA",
    clauses: [{ clauseId: "C1", heading: "Scope", text: "It applies to {{name}}." }],
  });
  ok("a valid one is created", made.ok === true);
  ok("…as a DRAFT, so nothing goes out by accident",
    made.ok && made.data.state === "draft" && made.data.version === 1);

  /* ---- reset ----------------------------------------------------------- */
  S.resetTemplates();
  eq("reset restores the authored four", S.readTemplates().length, 4);

  console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
