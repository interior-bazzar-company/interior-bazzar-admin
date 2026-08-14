/* =====================================================================
   Interior bazzar — PLAN FEATURE EXPLAINERS (IBPlanInfo)
   ---------------------------------------------------------------------
   THE single source of truth for the "i" button content next to every
   plan feature and comparison row.

   Plan features are written in product shorthand — "Pro Visibility
   Booster (6x)", "Advanced Connection Qualification". A buyer cannot
   price that. Each line therefore carries a key resolving to a plain
   language explainer, taken in meaning from the Business Plan and
   AutoGrowth plan sheets.

   Loaded by both plans-checkout.html (desktop) and plans-mobile.html so
   the two pages cannot drift apart. Load it BEFORE the page's own
   script block — the plan card renderers read it at render time.

   Adding a feature
   ----------------------------------------------------------------------
   Give the <li> / <td> a data-info key (desktop) or list the key in the
   tier's feats array (mobile), and add the matching entry here. An
   unknown key renders no button at all rather than a broken one.

   API (window.IBPlanInfo):
     get(key)   -> {title, text} or null
     title(key) -> the feature's display name, or the key itself if unknown
     text(key)  -> the explainer, or '' if unknown
     has(key)   -> boolean
   ===================================================================== */
(function () {
  'use strict';
  if (window.IBPlanInfo) return;

  /* key: [display name, what it means] */
  var MAP = {

    /* ── AUTOGROWTH · STARTER ── */
    'ag-reach-3':        ['3-State Network Reach', 'Build your business presence across three selected states.'],
    'ag-cat-2':          ['2 Portfolio Categories', 'Showcase your portfolio in two relevant business categories.'],
    'ag-kw-3':           ['3 Search Keywords', 'Position your profile around three relevant service searches.'],
    'ag-boost-3x':       ['Optimum Visibility Booster (3x)', 'Enhance your business visibility across the Interior bazzar network.'],
    'ag-net-basic':      ['Basic Network Access', 'Participate in the Interior bazzar industry network and build relevant connections.'],
    'ag-pos-enhanced':   ['Enhanced Profile Positioning', 'Present your business and portfolio with stronger visibility.'],
    'ag-route-standard': ['Standard Connection Routing', 'Relevant platform connections are routed through the standard matching flow.'],
    'ag-badge-verified': ['Verified Business Badge', 'Strengthen profile credibility with Verified positioning.'],
    'ag-crm-smart':      ['Smart Proposal Builder + CRM Hub', 'Create proposals and manage business connections from one place.'],
    'ag-analytics-basic':['Basic Analytics', 'Track essential profile and network activity.'],
    'ag-ai-standard':    ['Standard AI Matching', 'Use AI-driven requirement matching to identify relevant matches.'],
    'ag-qual-3step':     ['3-Step Connection Qualification', 'Adds a structured relevance check before you manage a connection.'],
    'ag-support-chat':   ['24×7 Chat Support', 'Access platform assistance through 24×7 chat support.'],

    /* ── AUTOGROWTH · GROWTH ── */
    'ag-reach-5':          ['5-State Network Reach', 'Expand your business presence across five selected states.'],
    'ag-cat-3':            ['3 Portfolio Categories', 'Position your expertise across three relevant business categories.'],
    'ag-kw-6':             ['6 Search Keywords', 'Broaden your discoverability across six relevant service searches.'],
    'ag-boost-6x':         ['Pro Visibility Booster (6x)', 'Gain stronger visibility and positioning across the network.'],
    'ag-net-priority':     ['Priority Network Access', 'Receive a higher level of network participation and access.'],
    'ag-pos-priority':     ['Priority Profile Positioning', 'Give your business stronger placement within relevant discovery areas.'],
    'ag-comp-controlled':  ['Controlled Competition Exposure', 'Create more focused positioning alongside a controlled competitive set.'],
    'ag-route-priority':   ['Priority Connection Routing', 'Relevant matches receive priority routing within the platform flow.'],
    'ag-badge-trusted':    ['Trusted Business Badge', 'Build stronger credibility with Trusted positioning.'],
    'ag-crm-advanced':     ['Advanced CRM + Visual Pipeline', 'Organize and manage connections through clear relationship stages.'],
    'ag-proposal-pro':     ['Professional Proposal Builder', 'Present your business with more professional proposals.'],
    'ag-analytics-advanced':['Advanced Analytics', 'Get deeper visibility into profile, network and connection activity.'],
    'ag-ai-advanced':      ['Advanced AI Matching', 'Improve matching relevance between your business and user requirements.'],
    'ag-qual-advanced':    ['Advanced Connection Qualification', 'Apply a stronger qualification layer to organize relevant connections.'],
    'ag-support-priority': ['Priority Support', 'Receive priority assistance for platform and account needs.'],

    /* ── AUTOGROWTH · SCALE ── */
    'ag-reach-pan':          ['Pan-India Network Reach', 'Build and position your business across the national Interior bazzar network.'],
    'ag-cat-5':              ['5 Portfolio Categories', 'Showcase a broader range of capabilities across five categories.'],
    'ag-kw-10':              ['10 Search Keywords', 'Build stronger discovery across ten relevant service searches.'],
    'ag-boost-10x':          ['Max Visibility Booster (10x)', 'Access the highest AutoGrowth visibility level across the network.'],
    'ag-net-exclusive':      ['Exclusive Network Access', 'Participate at the highest AutoGrowth network-access tier.'],
    'ag-pos-featured':       ['Featured Profile Positioning', 'Give your business premium prominence within relevant platform discovery.'],
    'ag-comp-limited':       ['Limited Competition Exposure', 'Create more focused positioning with limited competitive exposure.'],
    'ag-route-priority-ltd': ['Priority Connection Routing + Limited Competition', 'Combine priority routing with a more focused competitive environment.'],
    'ag-badge-leader':       ['Industry Leader Badge', 'Position your profile at the highest AutoGrowth credibility tier.'],
    'ag-crm-branded':        ['Professional CRM + Branded Proposals', 'Manage connections professionally with branded proposal capabilities.'],
    'ag-pipeline-multi':     ['Multi-stage Pipeline', 'Organize connections across multiple relationship and management stages.'],
    'ag-analytics-multi':    ['Multi-stage Analytics', 'Understand activity and performance across different stages of the network journey.'],
    'ag-ai-priority':        ['Priority AI Matching', 'Access the highest priority level of AI-driven requirement matching.'],
    'ag-qual-ai':            ['Advanced AI Connection Qualification', 'Use advanced AI qualification to improve relevance and connection management.'],
    'ag-support-personal':   ['Personal Support', 'Receive personalized support for your AutoGrowth account.'],

    /* ── AUTOGROWTH · COMPARISON ROWS ── */
    'ag-purpose':       ['Purpose', 'What the tier is built to do — establish and grow, expand and position, or lead and scale.'],
    'ag-row-reach':     ['Network reach', 'How many states your business presence is built across. Scale covers all of India.'],
    'ag-row-cat':       ['Portfolio categories', 'How many business categories your portfolio can be showcased in.'],
    'ag-row-kw':        ['Search keywords', 'How many relevant service searches your profile is positioned around.'],
    'ag-row-boost':     ['Visibility booster', 'The visibility multiplier applied to your business across the Interior bazzar network.'],
    'ag-row-net':       ['Network access', 'Your level of participation in the Interior bazzar industry network.'],
    'ag-row-comp':      ['Competition exposure', 'How focused your positioning is against the competitive set — open, controlled or limited.'],
    'ag-row-route':     ['Connection routing', 'How relevant platform connections are routed to you within the matching flow.'],
    'ag-row-pos':       ['Profile positioning', 'How prominently your business and portfolio are presented in discovery.'],
    'ag-row-badge':     ['Business badge', 'The credibility badge shown on your profile — Verified, Trusted or Industry Leader.'],
    'ag-row-crm':       ['CRM & proposals', 'The proposal-building and connection-management tools included in the tier.'],
    'ag-row-analytics': ['Analytics', 'The depth of reporting on profile, network and connection activity.'],
    'ag-row-ai':        ['AI matching', 'The priority level of AI-driven requirement matching applied to your business.'],
    'ag-row-qual':      ['Connection qualification', 'The relevance check applied before a connection reaches your pipeline.'],
    'ag-row-support':   ['Support', 'How you reach us — 24×7 chat, priority assistance, or a personal point of contact.'],
    'ag-row-price':     ['Annual price', 'Selling price for twelve months, excluding 18% GST. Starter is also sold on shorter terms — ₹38,499 for 3 months or ₹69,499 for 6 months. Growth and Scale are annual only.'],

    /* ── BUSINESS · FREE FOREVER ── */
    'biz-free-reach':     ['1-State Reach', 'Create your business presence within one selected state.'],
    'biz-free-cat':       ['1 Category', 'Showcase your business in one relevant category.'],
    'biz-free-kw':        ['1 Search Keyword', 'Position your profile around one relevant service search.'],
    'biz-free-crm':       ['Limited CRM & Proposals', 'Access the basic limited CRM and proposal capabilities available in the free tier.'],
    'biz-free-analytics': ['Profile Views Analytics', 'View basic profile visibility activity.'],

    /* ── BUSINESS · SIGNATURE ── */
    'biz-sig-reach':      ['3-State Visibility', 'Build your business presence across three selected states.'],
    'biz-sig-catkw':      ['2 Categories + 3 Search Keywords', 'Showcase your business in two categories and position it around three relevant service searches.'],
    'biz-route-standard': ['Standard Connection Routing', 'Relevant platform connections follow the standard routing flow.'],
    'biz-net-basic':      ['Basic Network Access', 'Participate in the Interior bazzar business network at the basic access level.'],
    'biz-crm-smart':      ['Smart Proposal Builder + CRM Hub', 'Create proposals and manage business connections from one place.'],
    'biz-analytics-basic':['Basic Analytics Dashboard', 'Track essential profile and business activity.'],
    'biz-badge-verified': ['Verified Badge', 'Strengthen your profile credibility with Verified positioning.'],
    'biz-support-chat':   ['24×7 Chat Support', 'Access platform assistance through 24×7 chat support.'],

    /* ── BUSINESS · PREMIUM ── */
    'biz-prem-reach':      ['5-State Visibility + Priority Placement', 'Expand your business presence across five states with priority placement.'],
    'biz-prem-catkw':      ['3 Categories + 6 Search Keywords', 'Position your expertise across three categories and six relevant service searches.'],
    'biz-route-controlled':['Standard Connection Routing + Controlled Competition', 'Use standard connection routing within a more controlled competitive environment.'],
    'biz-net-priority':    ['Priority Network Access', 'Receive a higher level of access within the Interior bazzar network.'],
    'biz-crm-advanced':    ['Advanced CRM + Visual Deal Pipeline', 'Organize and manage business connections through a visual pipeline.'],
    'biz-proposal-pro':    ['Professional Proposal Builder', 'Create more professional proposals for business conversations.'],
    'biz-analytics-advanced':['Advanced Analytics Dashboard', 'Get deeper visibility into profile and business activity.'],
    'biz-badge-trusted':   ['Trusted Badge', 'Build stronger credibility with Trusted positioning.'],
    'biz-support-priority':['Priority Support', 'Receive priority assistance for platform and account needs.'],

    /* ── BUSINESS · ELITE ── */
    'biz-elite-reach':    ['Pan-India Visibility + Featured Placement', 'Build your presence nationally with featured placement.'],
    'biz-elite-catkw':    ['5 Categories + 10 Search Keywords', 'Showcase a broader range of capabilities across five categories and ten relevant service searches.'],
    'biz-route-priority': ['Priority Connection Routing + Limited Competition', 'Receive priority routing within a more limited competitive environment.'],
    'biz-net-exclusive':  ['Exclusive Network Access', 'Participate at the highest Business Plan network-access tier.'],
    'biz-crm-branded':    ['Professional CRM + Branded Proposals', 'Manage connections professionally with branded proposal capabilities.'],
    'biz-pipeline-multi': ['Multi-stage Deal Pipeline', 'Organize business connections across multiple pipeline stages.'],
    'biz-badge-leader':   ['Leader Badge', 'Position your business at the highest Business Plan badge tier.'],
    'biz-support-personal':['Personal 1:1 Support', 'Receive personal support for your Business Plan account.'],

    /* ── BUSINESS · COMPARISON ROWS ── */
    'biz-purpose':       ['Purpose', 'What the plan is built to do — establish presence, build across regions, or hold a national position.'],
    'biz-row-reach':     ['Reach', 'How many states your business is visible across. Elite is national with featured placement.'],
    'biz-row-cat':       ['Categories', 'How many business categories you can be showcased in.'],
    'biz-row-kw':        ['Search keywords', 'How many relevant service searches your profile is positioned around.'],
    'biz-row-comp':      ['Competition', 'How focused your positioning is against the competitive set — open, controlled or limited.'],
    'biz-row-net':       ['Network access', 'Your level of access within the Interior bazzar business network.'],
    'biz-row-crm':       ['CRM & proposals', 'The proposal-building and connection-management tools included in the plan.'],
    'biz-row-analytics': ['Analytics', 'The depth of reporting on profile and business activity.'],
    'biz-row-badge':     ['Badge', 'The credibility badge shown on your profile — Verified, Trusted or Leader.'],
    'biz-row-support':   ['Support', 'How you reach us — 24×7 chat, priority assistance, or personal support.'],
    'biz-row-monthly':   ['Monthly price', 'Selling price per month, exclusive of 18% GST. Billed monthly.'],
    'biz-row-quarterly': ['Quarterly price', 'Selling price per quarter, exclusive of 18% GST. Billed every three months.'],
    'biz-row-annual':    ['Annual price', 'Selling price per year, exclusive of 18% GST. Annual billing offers the lowest effective rate.']
  };

  window.IBPlanInfo = {
    MAP: MAP,
    has:   function (k) { return !!MAP[k]; },
    get:   function (k) { var e = MAP[k]; return e ? { title: e[0], text: e[1] } : null; },
    // Falls back to the key so a missing entry shows something readable rather
    // than an empty row — mobile renders feature labels straight from here.
    title: function (k) { return MAP[k] ? MAP[k][0] : String(k || ''); },
    text:  function (k) { return MAP[k] ? MAP[k][1] : ''; },
    // Every key the registry knows. Added for the admin Plan editor's feature
    // picker, which offers the registry rather than asking an operator to
    // remember keys like `ag-boost-6x`. Read-only: a sorted copy, never MAP.
    keys:  function () { return Object.keys(MAP).sort(); }
  };
})();

/* ---------------------------------------------------------------- ES module
   The IIFE above is verbatim from the prototype and still attaches to
   `window`, because the engines find each other through `root.IB*` at
   runtime. This only re-exports what it already published. */
export const IBPlanInfo = window.IBPlanInfo;
export default window.IBPlanInfo;
