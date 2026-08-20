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
const ok = (cond, msg) => { if (!cond) fail.push(msg); };

const tagSlugs = new Set(voc.tags.map(t => t.slug));
const channels = new Set(voc.contactChannels.map(c => c.key));
const outcomes = new Map(voc.contactOutcomes.map(o => [o.key, o]));
const statuses = new Set(voc.statuses.map(s => s.key));
const urgencies = new Set(voc.urgency.map(u => u.key));
const checkKeys = voc.qualificationChecklist.map(c => c.key);
const tierKeys = new Set(voc.tiers.map(t => t.key));
const teamIds = new Set(voc.team.map(m => m.id));
const followUpOutcomes = new Set(voc.contactOutcomes.filter(o => o.requiresFollowUp).map(o => o.key));
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
  // Owner: null is a real state (unclaimed), but a named one must be real.
  ok(e.owner === null || (e.owner && teamIds.has(e.owner.id)),
    `${id}: owner is not a known team member`);
  e.contactLog.forEach(c => {
    ok(channels.has(c.channel), `${id}: unknown channel "${c.channel}"`);
    ok(outcomes.has(c.outcome), `${id}: unknown outcome "${c.outcome}"`);
    ok(c.direction === 'inbound' || c.direction === 'outbound', `${id}: bad direction`);
    ok('response' in c && 'note' in c, `${id}: log entry missing response/note`);
    // A callback with no time on it is a promise nobody can keep, and a time
    // on an outcome that is not a callback is a due date nothing will clear.
    ok('followUpAt' in c, `${id}: log entry missing followUpAt`);
    if (followUpOutcomes.has(c.outcome)) {
      ok(!!c.followUpAt, `${id}: ${c.outcome} logged with no callback time`);
    } else {
      ok(!c.followUpAt, `${id}: followUpAt set on outcome "${c.outcome}"`);
    }
  });
  // newest first — the UI reads [0] as "latest"
  for (let i = 1; i < e.contactLog.length; i++) {
    ok(new Date(e.contactLog[i - 1].at) >= new Date(e.contactLog[i].at),
      `${id}: contactLog is not newest-first`);
  }
  for (let i = 1; i < e.events.length; i++) {
    ok(new Date(e.events[i - 1].at) >= new Date(e.events[i].at),
      `${id}: events are not newest-first`);
  }

  const cl = e.qualification.checklist;
  ok(cl && checkKeys.every(k => typeof cl[k] === 'boolean'), `${id}: checklist incomplete`);
  ok(e.qualification.urgency === null || urgencies.has(e.qualification.urgency),
    `${id}: unknown urgency ${e.qualification.urgency}`);

  // The enquiry-level follow-up must be the newest log entry's, never a stale
  // one left behind by a later call — that is what makes the overdue count
  // trustworthy enough to sort the whole queue on.
  ok(e.followUpAt === (e.contactLog[0] ? e.contactLog[0].followUpAt : null),
    `${id}: followUpAt disagrees with the newest contact-log entry`);

  const frozen = !!e.qualification.frozenAt;
  if (e.status === 'generated') {
    ok(!frozen, `${id}: Generated but already frozen`);
    ok(!e.qualification.qualifiedBy, `${id}: Generated but has qualifiedBy`);
    ok(!e.activeAssignmentId, `${id}: Generated but assigned`);
  } else if (e.status === 'invalid') {
    // may or may not have been qualified before it failed
  } else {
    ok(!e.followUpAt, `${id}: past Generated with a callback still outstanding`);
    ok(frozen, `${id}: past Generated but never frozen`);
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

if (fail.length) { console.error('FAIL\n' + fail.map(f => '  · ' + f).join('\n')); process.exit(1); }
console.log('seed ok —', enq.enquiries.length, 'enquiries,',
  enq.enquiries.filter(e => e.status === 'generated').length, 'in qualification');
