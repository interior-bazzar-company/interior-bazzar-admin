/* =============================================================================
   Business Enquiries — the fixture the checks run on.
   -----------------------------------------------------------------------------
   THE BUNDLED SEED IS GONE. src/content/business-enquiries/ went when the module
   moved onto the API (`GET admin/business-enquiries/`), so the three checks that
   read `enquiries.json` and `vocabularies.json` had nothing to read. They assert
   RULES — a half-open clock window, a CSV that never carries contact-log text, a
   strip cell that agrees with its own filter — and a rule needs rows, not
   THESE rows. So the rows are built here, in the shape the API adapter hands
   the store, and every date is relative to the moment the check runs.

   Small on purpose: four enquiries, each different in the one way a rule cares
   about — when it arrived, what status it carries, whether anyone reached the
   customer, whether it was assigned.
   ========================================================================== */
const DAY = 86400000;
const iso = (ms) => new Date(Date.now() - ms).toISOString();

/* The vocabulary the API serves at boot. Only what the checks print: a label
   that came back as its own key would pass a check on a file shipping
   `no_match` in a column headed Status, so these are the real labels. */
const VOCAB = {
  statuses: [
    { key: "generated", label: "New", tone: "", step: 1 },
    { key: "processing", label: "Processing", tone: "warn", step: 2 },
    { key: "qualified", label: "Qualified", tone: "info", step: 3 },
    { key: "no_match", label: "No match yet", tone: "warn", step: 4 },
    { key: "assigned", label: "Assigned", tone: "info", step: 5 },
    { key: "converted", label: "Converted", tone: "ok", step: 6 },
    { key: "not_converted", label: "Not converted", tone: "dead", step: 6 },
    { key: "invalid", label: "Rejected", tone: "dead", step: 7 },
  ],
  urgency: [
    { key: "within_30d", label: "Within 30 days", hot: true },
    { key: "30_90d", label: "30–90 days" },
    { key: "90_plus", label: "90+ days" },
    { key: "browsing", label: "Browsing" },
  ],
  sources: [
    { key: "funnel", label: "Funnel page", short: "Funnel" },
    { key: "portal", label: "Portal", short: "Portal" },
    { key: "own", label: "Added by us", short: "Own" },
  ],
  manualVia: [
    { key: "phone", label: "Phone call" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "walk_in", label: "Walk-in" },
    { key: "referral", label: "Referral" },
    { key: "email", label: "Email" },
    { key: "event", label: "Event or exhibition" },
  ],
  qualificationChecklist: [
    { key: "reachable", label: "Contact reachable" },
    { key: "requirement", label: "Requirement confirmed" },
    { key: "genuine", label: "Genuine enquiry" },
    { key: "urgency", label: "Urgency confirmed" },
  ],
  contactOutcomes: [
    { key: "spoke", label: "Spoke", reached: true },
    { key: "no_answer", label: "No answer", reached: false },
  ],
};

const assignment = (over) => Object.assign({
  assignmentId: "A-1", businessId: "B-1", businessName: "Studio Aangan",
  candidateRank: 1, candidateScore: 82, eligibleCount: 4, factorSnapshot: { fairness: 0.4 },
  ruleVersion: "v3", assignedBy: "Asha", assignedByRole: "ops",
  assignedAt: iso(2 * DAY), deliveryStatus: "delivered", deliveredAt: iso(2 * DAY),
  overrideReason: null, supersededAt: null,
}, over || {});

const enquiry = (over) => {
  const e = Object.assign({
    enquiryId: "IB-E-0001", submissionId: "S-1",
    source: { kind: "funnel", page: "/premium", label: "Premium funnel", createdBy: null, via: null },
    customer: { name: "Anita Rao", phone: "+91 98200 11111", email: "anita@example.test" },
    requirement: {
      category: "Modular kitchen", service: "Full interiors", city: "Mumbai", state: "Maharashtra",
      locality: "Andheri West", pincode: "400053", projectType: "2BHK", intent: "ready_to_start",
      text: "Wants a modular kitchen done before Diwali",
    },
    qualification: {
      contactVerified: true, verifiedVia: "phone", genuineness: "genuine", genuinenessNote: "",
      urgency: "within_30d", requirementSummary: "Kitchen and two wardrobes, ready to start",
      version: "v1", frozenAt: iso(3 * DAY),
      checklist: { reachable: true, requirement: true, genuine: true, urgency: true },
      qualifiedBy: "Asha", qualifiedByRole: "ops",
    },
    tags: ["hot", "repeat-building"],
    contactLog: [{
      logId: "L-1", channel: "phone", direction: "outbound", at: iso(3 * DAY),
      actor: "Asha", actorRole: "ops", outcome: "spoke",
      /* The two fields the export must NEVER carry. Distinctive strings, so a
         leak is found by searching the file rather than by reading it. */
      response: "SAID-ON-THE-CALL-possession-in-October",
      note: "OPERATOR-NOTE-sounds-genuine",
    }],
    remarks: [{
      remarkId: "R-1", text: "REMARK-TEXT-her-architect-decides", actor: "Asha",
      actorRole: "ops", at: iso(3 * DAY),
    }],
    status: "assigned", tier: "A", createdAt: iso(4 * DAY),
    activeAssignmentId: "A-1", assignments: [assignment()],
    outcome: {
      assignmentId: "A-1", firstContactAt: iso(DAY), status: "closed", outcome: "converted",
      reason: "Signed", notes: null, updatedBy: "Asha", updatedAt: iso(DAY),
    },
    events: [], matchRun: null,
  }, over || {});
  return e;
};

/* One per rule the checks read: inside 30 days and outside it, reached and
   never reached, assigned and never assigned, and a status per strip cell. */
const rows = [
  enquiry({}),
  enquiry({
    enquiryId: "IB-E-0002", status: "generated", tier: "B", createdAt: iso(2 * DAY),
    customer: { name: "Bala Nair", phone: "+91 98200 22222", email: null },
    qualification: Object.assign({}, enquiry().qualification, {
      urgency: null, requirementSummary: null, version: null, frozenAt: null,
      qualifiedBy: null, qualifiedByRole: null,
      checklist: { reachable: false, requirement: false, genuine: false, urgency: false },
    }),
    tags: [], contactLog: [], remarks: [], activeAssignmentId: null, assignments: [], outcome: null,
  }),
  enquiry({
    enquiryId: "IB-E-0003", status: "no_match", createdAt: iso(100 * DAY),
    customer: { name: "Chitra Iyer", phone: "+91 98200 33333", email: "chitra@example.test" },
    activeAssignmentId: null, assignments: [], outcome: null,
  }),
  enquiry({
    enquiryId: "IB-E-0004", status: "invalid", createdAt: iso(400 * DAY),
    customer: { name: "Dev Menon", phone: "+91 98200 44444", email: null },
    contactLog: [{
      logId: "L-2", channel: "phone", direction: "outbound", at: iso(399 * DAY),
      actor: "Rahul", actorRole: "ops", outcome: "no_answer",
      response: null, note: "OPERATOR-NOTE-number-rings-out",
    }],
    activeAssignmentId: null, assignments: [], outcome: null,
  }),
];

module.exports = { DAY, VOCAB, rows, enquiry, assignment };
