/* =============================================================================
   The Team and Resources stores against a real backend, read-only.
   -----------------------------------------------------------------------------
   Replaces the seed-fixture checks (check-team-derivation, check-resources,
   check-agreements): those stores no longer carry a seed. This signs in, boots
   all three stores and checks that the mapping from the server's rows holds up
   -- member documents and the agreement body/token (2026-09-15), and the task
   extras, the private document file and the agreement templates (2026-09-16),
   which were the last of this module's bundled JSON. Also the lists Finance,
   Resources and Users read off the server instead of their vocabularies.json
   (2026-09-16): each is checked as filled, never against a copy of its labels.

     VITE_BASE_URL=http://localhost:8000/api IB_USER=... IB_PASS=... npm run check:live

   Skips cleanly (exit 0) when those are not set. Writes nothing.
   ============================================================================= */
const mem: Record<string, string> = {};
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { mem[k] = v; },
  removeItem: (k: string) => { delete mem[k]; },
};
g.window = globalThis;

import { AUTH_VARS } from "../src/utils/constants/app";
import { loadSession } from "../src/admin/auth/session";
import * as T from "../src/admin/views/Team/store";
import * as R from "../src/admin/views/Resources/store";
import * as G from "../src/admin/views/Agreements/store";
import * as F from "../src/admin/views/Finance/store";
import * as U from "../src/admin/views/Users/store";

const API = process.env.VITE_BASE_URL || "";
let failed = 0;
const ok = (what: string, cond: boolean) => { console.log("  " + (cond ? "ok  " : "FAIL") + " " + what); if (!cond) failed++; };

(async () => {
  if (!process.env.IB_USER || !API) { console.log("\nLive store check SKIPPED — set VITE_BASE_URL, IB_USER and IB_PASS.\n"); process.exit(0); }
  const res = await fetch(API + "/v1/auth/signin/", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: process.env.IB_USER, password: process.env.IB_PASS, portal: "admin" }),
  }).then((r) => r.json());
  localStorage.setItem(AUTH_VARS.ACCESS, res.data.accessToken);
  const s = await loadSession(true);
  ok("signed in", !!s);

  await T.bootTeam();
  const members = T.readMembers();
  const ids = members.map((m) => m.memberId);
  ok("boot ready", T.teamBootState() === "ready");
  ok("clock is a date", /^\d{4}-\d{2}-\d{2}$/.test(T.TODAY));
  ok("the viewer is a member", ids.indexOf(T.meId()) >= 0);
  ok("vocab: leave kinds, priorities, statuses, transitions",
    Object.keys(T.LEAVE_KIND).length > 0 && T.PRIORITY_SCALE.length > 0
    && ["planned", "in_progress", "completed", "cancelled", "delayed"].every((k) => !!T.WORK_STATUS[k])
    && T.transitionsFrom("planned").length > 0);
  ok("days carry a start and a known member", T.readDays().every((d) => !!d.startedAt && ids.indexOf(d.memberId) >= 0));
  ok("items map kind/status/priority keys", T.readItems().every((i) =>
    ["task", "milestone", "target"].indexOf(i.kind) >= 0 && !!T.WORK_STATUS[i.status] && !!i.priority));
  ok("item tags resolve", T.readItems().every((i) => (i.tagIds || []).every((t) => !!T.readTag(t))));
  ok("stage counts add up", (() => {
    const t = T.workTotals(T.workRows({}, "all"));
    return t.planned + t.inProgress + t.delayed + t.completed + t.cancelled === t.total;
  })());
  ok("one day row per active member", T.dayRows(T.TODAY, "all").length === members.filter((m) => m.status === "active").length);
  ok("Sunday is the only weekly off", T.isWeekend("2026-09-13") && !T.isWeekend("2026-09-12"));
  ok("plans and reports belong to members", T.readPlans().concat(T.readReports() as never[]).every((p) => ids.indexOf(p.memberId) >= 0));
  ok("leave states are known", T.readLeave().every((l) => ["requested", "approved", "rejected", "withdrawn"].indexOf(l.state) >= 0));
  ok("a write with nothing to write refuses", (await T.renameTag("1", "")).ok === false
    && (await T.sendAgreement("1", "nda", "x")).ok === false);
  ok("documents map to a known kind, and any file is a SIGNED read",
    T.readDocuments().every((d) => ids.indexOf(d.memberId) >= 0 && !!T.DOCUMENT_KIND[d.kind]
      && (!d.file || (d.file.url.indexOf("X-Amz-Signature") > 0 || d.file.url.indexOf("Signature=") > 0))));
  ok("agreements carry the document and its token", T.readAgreements().every((a) =>
    ids.indexOf(a.memberId) >= 0 && !!T.AGREEMENT_STATE[a.state]
    && (a.state === "draft" || (!!a.token && !!a.body))));
  /* The three that were bundled JSON until 2026-09-16. Each one is only a real
     check if the list behind it came from the server. */
  ok("link relations come from the vocabulary, inverse included",
    T.LINK_RELATIONS.length > 0 && T.LINK_RELATIONS.every((r) => !!r.label)
    && T.linkLabelOf("duplicates", false) !== T.linkLabelOf("duplicates", true));
  ok("every edge points at a task and never at itself", T.readLinks().every((l) =>
    l.fromItemId !== l.toItemId && !!T.readItem(l.fromItemId) && !!T.LINK_RELATIONS.some((r) => r.key === l.relation)));
  ok("checklists carry stable ids and drive a task's progress", T.readItems().every((i) => {
    const lines = i.checklist || [];
    if (lines.some((l) => !l.lineId)) return false;
    if (i.kind !== "task" || i.status === "completed" || !lines.length) return true;
    return T.progressOf(i) === Math.round((lines.filter((l) => l.done).length / lines.length) * 100);
  }));
  ok("a waiting-on reason only exists while something blocks it",
    T.readItems().every((i) => !i.blockedReason || !!i.blockedByItemId));

  await G.bootTemplates();
  const tpls = G.readTemplates();
  ok("agreement templates are server rows", tpls.length > 0
    && tpls.every((t) => !!t.templateId && !!t.title && t.clauses.length > 0
      && ["draft", "active", "retired"].indexOf(t.state) >= 0));
  ok("a sent copy finds its template by key, not by title",
    T.readAgreements().every((a) => !a.templateId || tpls.some((t) => t.templateId === a.templateId)));
  ok("a template write with nothing to write refuses",
    (await G.createTemplate({ title: "", kind: "custom", purpose: "", clauses: [] })).ok === false
    && (await G.deleteTemplate("agreement.no-such-thing")).ok === false);

  await R.bootResources();
  ok("resource states from the server", Object.keys(R.RESOURCE_STATE).length === 4);
  ok("resource ids keep the RES- prefix", R.readResources().every((r) => r.resourceId.indexOf("RES-") === 0));
  ok("responses point at a resource", R.readResponses().every((x) => x.responseId.indexOf("RSP-") === 0 && !!R.resourceOf(x.resourceId)));
  ok("field types and tag suggestions are served", R.FIELD_TYPES.length === 7 && R.TAG_SUGGESTIONS.length > 0
    && R.FIELD_TYPES.every((t) => !!t.label));

  await F.bootSubs();
  ok("finance lists are served: modes, failure reasons, states, tag kinds, sources, origins",
    F.MODES.length > 0 && F.FAILURE_REASONS.length > 0 && F.SUB_STATUSES.length === 7 && F.TAG_KINDS.length === 4
    && F.SUB_SOURCES.length === 2 && F.REFUND_ORIGINS.length === 3);
  ok("finance words are served: statuses, run states, definitions, slip rule, decisions (2026-09-17)",
    F.INSTALLMENT_STATUSES.length > 0 && F.RUN_STATES.length > 0 && F.EVENT_TYPES.length > 0
    && [...F.METRICS, ...F.KPIS, ...F.PAYROLL_METRICS].every((d) => !!d.formula && !!d.caution)
    && F.kpis().every((k) => !!F.kpiMeta(k.key)) && !!F.SLIP_RULE && !!F.decision("FN-OD-07"));
  ok("finance section names are the sidebar's", F.RECORD_TYPES.map((r) => r.label).join("|")
    === "Subscriptions|Salaries A/C|Other Transaction|Refunds|Analytics");
  ok("every subscription's source and status is a served key", F.readSubscriptions().every((s) =>
    !!F.sourceMeta(s.source) && !!F.subStatusMeta(s.status)));
  await F.bootFinanceLive();
  ok("the refund policy is the refunds read's", F.REFUND_POLICY.windowDays > 0);
  ok("every refund's origin is a served key", F.readRefunds().every((r) => !!F.originMeta(r.origin)));

  await U.bootUsersVocab();
  ok("username rules and reserved handles are served", U.USERNAME_RULES.min > 0
    && U.USERNAME_RULES.max > U.USERNAME_RULES.min && U.RESERVED_USERNAMES.length > 0 && !!U.USERNAME_RULES.help);

  console.log(failed ? "\n" + failed + " FAILED\n" : "\nall live store checks passed\n");
  process.exit(failed ? 1 : 0);
})();
