/* =============================================================================
   Business Enquiries — seed invariants.   `npm run check:enquiries`
   -----------------------------------------------------------------------------
   The module has no API and therefore no integration test. This is the next
   best thing: an executable statement of the rules the SCREENS assume, run
   against the content files that stand in for the endpoints.

   It is also the shortest description of the contract a backend engineer has to
   honour. Every assertion below is a thing the API must guarantee too — if the
   real GET /business-enquiries can return a record that fails one of these, the
   panel will render something incoherent for it.
   ========================================================================== */
const path = require('path');
const here = (f) => path.join(__dirname, '..', 'src/content/business-enquiries', f);

const enq = require(here('enquiries.json'));
const voc = require(here('vocabularies.json'));
const sug = require(here('suggestions.json'));

const fail = [];
const phoneKeys = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

const tagSlugs = new Set(voc.tags.map(t => t.slug));
const channels = new Set(voc.contactChannels.map(c => c.key));
const outcomes = new Map(voc.contactOutcomes.map(o => [o.key, o]));
const statuses = new Set(voc.statuses.map(s => s.key));
const urgencies = new Set(voc.urgency.map(u => u.key));
const checkKeys = voc.qualificationChecklist.map(c => c.key);
const tierKeys = new Set(voc.tiers.map(t => t.key));
// The team vocabulary lost its last runtime consumer when ownership was
// removed. Rather than let it rot as decoration, it anchors actor names:
// an Operations event written by somebody who is not on the team is either
// a typo or a person nobody can look up later.
const teamNames = new Set(voc.team.map(m => m.name));
const sources = new Map(voc.sources.map(x => [x.key, x]));
ok(voc.sources.length === 3, 'expected exactly three channels, got ' + voc.sources.length);
const stateNames = new Set(voc.states);
const viaKeys = new Set(voc.manualVia.map(m => m.key));

for (const e of enq.enquiries) {
  const id = e.enquiryId;
  ok(statuses.has(e.status), `${id}: unknown status ${e.status}`);
  ok(Array.isArray(e.tags), `${id}: no tags array`);
  ok(!!e.submissionId, `${id}: no submissionId — nothing to de-duplicate against`);
  e.tags.forEach(t => ok(tagSlugs.has(t), `${id}: unknown tag "${t}"`));
  ok(Array.isArray(e.contactLog), `${id}: no contactLog array`);
  ok(Array.isArray(e.remarks), `${id}: no remarks array`);
  e.remarks.forEach(r => {
    ok(!!r.remarkId && !!r.text && !!r.actor && !!r.at, `${id}: malformed remark`);
  });
  for (let i = 1; i < e.remarks.length; i++) {
    ok(new Date(e.remarks[i - 1].at) >= new Date(e.remarks[i].at),
      `${id}: remarks are not newest-first`);
  }
  // A remark is not evidence that anyone rang. The qualification gate counts
  // contact-log rows, and remarks must never be able to satisfy it.
  if (e.status === 'generated' && !e.contactLog.length) {
    ok(!e.qualification.frozenAt, `${id}: qualified on remarks alone`);
  }
  // PROVENANCE. Never blank, and a manual record must name who typed it and
  // how it reached us — "added by us" on its own is the absence of provenance
  // wearing the word.
  const src = sources.get(e.source.kind);
  ok(!!src, `${id}: unknown source "${e.source.kind}"`);
  if (src && src.manual) {
    ok(!!e.source.createdBy, `${id}: manual source with no createdBy`);
    ok(viaKeys.has(e.source.via), `${id}: manual source with no valid via`);
    ok(String(e.submissionId).startsWith('man-'),
      `${id}: manual source without a man- submission id`);
  } else if (src) {
    ok(!e.source.createdBy, `${id}: inbound source claims a createdBy`);
    ok(!e.source.via, `${id}: inbound source claims a via`);
  }

  ok(tierKeys.has(e.tier), `${id}: unknown tier "${e.tier}"`);
  // State is part of the address, so it travels with the city or not at all —
  // a state with no city is an address nobody can act on.
  ok('state' in e.requirement, `${id}: requirement has no state field`);
  if (e.requirement.state) {
    ok(!!e.requirement.city, `${id}: has a state but no city`);
    ok(stateNames.has(e.requirement.state), `${id}: unknown state "${e.requirement.state}"`);
  }
  ok(!('priority' in e), `${id}: priority is back — it renders nowhere`);
  e.contactLog.forEach(c => {
    ok(channels.has(c.channel), `${id}: unknown channel "${c.channel}"`);
    ok(outcomes.has(c.outcome), `${id}: unknown outcome "${c.outcome}"`);
    ok(c.direction === 'inbound' || c.direction === 'outbound', `${id}: bad direction`);
    ok('response' in c && 'note' in c, `${id}: log entry missing response/note`);
  });
  // newest first — the UI reads [0] as "latest"
  for (let i = 1; i < e.contactLog.length; i++) {
    ok(new Date(e.contactLog[i - 1].at) >= new Date(e.contactLog[i].at),
      `${id}: contactLog is not newest-first`);
  }
  for (const ev of e.events) {
    if (ev.actorRole && ev.actorRole.toLowerCase().startsWith('operations'))
      ok(teamNames.has(ev.actor),
        `${id}: event ${ev.eventId} is by "${ev.actor}", who is not on the team`);
  }
  if (e.qualification.qualifiedBy)
    ok(teamNames.has(e.qualification.qualifiedBy),
      `${id}: qualified by "${e.qualification.qualifiedBy}", who is not on the team`);

  for (let i = 1; i < e.events.length; i++) {
    ok(new Date(e.events[i - 1].at) >= new Date(e.events[i].at),
      `${id}: events are not newest-first`);
  }

  // A phone the dedupe cannot key on is not test data. `phoneKey()` takes the
  // LAST TEN digits; the seed once stored masked numbers ("+91 98xxxxxxx27"),
  // which leave only six - so the duplicate check was comparing country codes
  // and had never been exercised on a realistic number.
  const digits = String(e.customer.phone || '').replace(/[^0-9]/g, '');
  ok(digits.length >= 12, `${id}: phone "${e.customer.phone}" has ${digits.length} digits - masked?`);
  ok(/^[6-9]/.test(digits.slice(-10)), `${id}: "${e.customer.phone}" is not an Indian mobile`);
  phoneKeys.push(digits.slice(-10));
  if (e.customer.email)
    ok(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e.customer.email),
      `${id}: email "${e.customer.email}" is not a usable address`);

  const cl = e.qualification.checklist;
  ok(cl && checkKeys.every(k => typeof cl[k] === 'boolean'), `${id}: checklist incomplete`);
  ok(e.qualification.urgency === null || urgencies.has(e.qualification.urgency),
    `${id}: unknown urgency ${e.qualification.urgency}`);

  // The enquiry-level follow-up must be the newest log entry's, never a stale
  // one left behind by a later call — that is what makes the overdue count
  // trustworthy enough to sort the whole queue on.

  const frozen = !!e.qualification.frozenAt;
  // THE FREEZE IS AT QUALIFIED, not at leaving New. New and Processing are both
  // still being WORKED - the difference between them is only whether anyone has
  // tried to reach the customer yet - so neither may carry a snapshot, and
  // everything from Qualified onward must.
  const working = e.status === 'generated' || e.status === 'processing';
  if (working) {
    ok(!frozen, `${id}: ${e.status} but already frozen`);
    ok(!e.qualification.qualifiedBy, `${id}: ${e.status} but has qualifiedBy`);
    ok(!e.activeAssignmentId, `${id}: ${e.status} but assigned`);
    // The one thing that separates the two states, asserted in both directions
    // so a migration cannot leave a record in the wrong one.
    if (e.status === 'generated')
      ok(e.contactLog.length === 0, `${id}: New but a contact attempt is logged - should be Processing`);
    else
      ok(e.contactLog.length > 0, `${id}: Processing but no contact attempt logged - should be New`);
  } else if (e.status === 'invalid') {
    // may or may not have been qualified before it failed
  } else {
    ok(frozen, `${id}: past Processing but never frozen`);
    ok(!!e.qualification.qualifiedBy, `${id}: frozen with nobody answerable for it`);
    ok(checkKeys.every(k => cl[k]), `${id}: qualified with an unchecked box`);
    ok(e.contactLog.length > 0, `${id}: qualified with no contact ever logged`);
    ok(!!e.qualification.requirementSummary, `${id}: qualified with no summary`);
  }

  // the single active assignment pointer must resolve
  if (e.activeAssignmentId) {
    ok(e.assignments.some(a => a.assignmentId === e.activeAssignmentId),
      `${id}: activeAssignmentId points at nothing`);
    const active = e.assignments.filter(a => !a.supersededAt);
    ok(active.length === 1, `${id}: ${active.length} assignments are open, expected 1`);
  }

  // a matching run only exists for something that has been qualified
  if (sug.runs[id]) ok(e.status !== 'generated', `${id}: Generated but has a match run`);
}

// candidate factors must sum to the score, or the breakdown lies
for (const key of Object.keys(sug.runs)) {
  for (const c of sug.runs[key].eligible) {
    const sum = Object.values(c.factors).reduce((a, b) => a + b, 0);
    ok(sum === c.score, `${key}/${c.name}: factors sum to ${sum}, score says ${c.score}`);
  }
}

// The thing that must never come back. Skips $comment keys — the files SAY
// there is no budget field, and that sentence is not a budget field.
const strip = (v) => JSON.stringify(v, (k, val) => (k.startsWith('$comment') ? undefined : val));
const blob = strip(enq) + strip(voc) + strip(sug);
ok(!/budget/i.test(blob), 'a budget field has appeared in the content');

// Two customers sharing a phone key would make the intake dedupe reject a real
// enquiry as a duplicate of the wrong one.
{
  const seen = new Set(), dupes = [];
  for (const k of phoneKeys) { if (seen.has(k)) dupes.push(k); seen.add(k); }
  ok(!dupes.length, 'two seed records share a phone key: ' + dupes.join(', '));
}

if (fail.length) { console.error('FAIL\n' + fail.map(f => '  · ' + f).join('\n')); process.exit(1); }
const by = (k) => enq.enquiries.filter(e => e.status === k).length;
console.log('seed ok —', enq.enquiries.length, 'enquiries,',
  by('generated'), 'New,', by('processing'), 'Processing');
