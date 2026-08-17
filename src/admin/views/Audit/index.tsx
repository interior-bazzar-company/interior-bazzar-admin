/* =============================================================================
   Admin Access · Audit log
   -----------------------------------------------------------------------------
   THE trail, from `v1/admin/audit/` (interior_admin AuditViews). Every level-3
   action across the panel appends one row through `append_audit()` — 68 call
   sites in 23 controllers today — so this is the one screen that can answer
   "who changed that, and when" about anything.

   It used to read `IBTeam.audit()`: a localStorage array seeded with invented
   events, which meant the page most likely to be opened in an argument was the
   least likely to be true.

   FILTERING IS SERVER-SIDE, all of it. A log only grows, so a page that
   filtered the twenty rows it happened to hold would answer "no entries match"
   about a log that contains the entry. Search, module, severity and paging all
   go to the endpoint; the facet counts come back with the page and are counted
   over the whole filtered log, never over the rows on screen.

   Same list shell every other module uses: a .dls-cmd command row, one
   clickable StatStrip, then a viewport-bounded table body.

   READ SURFACE. The log is append-only: there is no edit, no delete and no
   "clear log" here, and there is no endpoint for one either.
   ============================================================================= */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import type { AuditEntry, AuditFacets } from "../../../api/modules/adminOps";
import { FilterChips, Icon, Notice, Pill, SearchField, Select, StatStrip, Table } from "../../ui";
import type { StatCell } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import { moduleLabel } from "../../shell/modules";
import { ListSkeleton } from "../../ui";

const PAGE_SIZE = 40;

/* The same words the SERVER counts as destructive (DESTRUCTIVE_WORDS in
   AuditValidators). Repeated here only to tone a row — the filter and the
   counts are the server's, so the two cannot disagree about which rows they
   select, and at worst a row is toned differently from how it is counted. */
const DESTRUCTIVE = /delete|reject|cancel|archive|revoke|remove|reverse/i;

/** `plan_price_updated` → `price updated`. The module is its own column, so
 *  repeating it inside the action is noise; the underscores are a key, not a
 *  sentence. */
function actionLabel(action: string, moduleKey: string) {
  const singular = moduleKey.replace(/s$/, "");
  return action.replace(new RegExp("^" + singular + "_"), "").replace(/_/g, " ");
}

/** "17 Aug 2026, 06:41". The row is a forensic record — the time matters as
 *  much as the day, and it is what orders two entries a second apart. */
function stamp(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function Audit() {
  const [sp, setSp] = useSearchParams();
  const shell = useShell();

  /* Filters live in the URL: a filtered log is linkable and survives a
     refresh, which is exactly what you want when you are sending somebody a
     link to the thing that happened. */
  const p: Record<string, string> = {
    q: sp.get("q") || "",
    module: sp.get("module") || "",
    sev: sp.get("sev") || "",
  };

  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [facets, setFacets] = useState<AuditFacets>({ modules: {}, roles: {}, destructive: 0, routine: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(p);
  /* A filter change starts the list again at page 1 — appending page 2 of a
     different query onto page 1 of the old one is how a log stops being a
     record of anything. */
  useEffect(() => { setPage(1); setRows(null); }, [key]);

  const params = useCallback((pageNo: number) => ({
    search: p.q || undefined,
    module: p.module || undefined,
    destructive: p.sev === "bad" ? "1" : p.sev === "routine" ? "0" : undefined,
    pageNo, pageSize: PAGE_SIZE,
  }), [p.q, p.module, p.sev]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    call(AdminOpsService.audit(params(1)))
      .then((d) => {
        if (cancelled) return;
        setRows(d.entries); setFacets(d.facets); setTotal(d.total); setPage(1);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]); setError(errMessage(e));
      });
    return () => { cancelled = true; };
  }, [key, params]);

  const more = () => {
    setLoadingMore(true);
    call(AdminOpsService.audit(params(page + 1)))
      .then((d) => {
        setRows((cur) => (cur || []).concat(d.entries));
        setPage(d.pageNo); setTotal(d.total); setLoadingMore(false);
      })
      .catch((e: unknown) => { setError(errMessage(e)); setLoadingMore(false); });
  };

  /* ------------------------------------------------------------- filters -- */
  const typing = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(typing.current), []);
  const setParam = (name: string, value: string) => {
    const next: Record<string, string> = { ...p, [name]: value };
    const out: Record<string, string> = {};
    for (const k in next) if (next[k]) out[k] = next[k];
    setSp(out);
  };
  const onFilter = (name: string, value: string) => {
    if (name !== "q") return setParam(name, value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => setParam("q", value), 220);
  };
  const onUnfilter = (k: string) => (k === "*" ? setSp({}) : setParam(k, ""));

  const sevRoute = (v: string) => {
    const next: Record<string, string> = { ...p, sev: p.sev === v ? "" : v };
    const out: Record<string, string> = {};
    for (const k in next) if (next[k]) out[k] = next[k];
    return "#/audit" + (Object.keys(out).length ? "?" + new URLSearchParams(out).toString() : "");
  };

  const filtered = !!(p.q || p.module || p.sev);
  const moduleKeys = Object.keys(facets.modules).sort();

  /* Total first, then the one split that matters when you open this page in an
     argument: how much of what happened was destructive. Both cells filter. */
  const cells: (StatCell | "sep")[] = [
    { k: "entries", v: total, to: sevRoute(""), on: !p.sev },
    "sep",
    { k: "destructive", v: facets.destructive,
      dot: facets.destructive ? "bad" : "", tone: facets.destructive ? "bad" : "",
      to: sevRoute("bad"), on: p.sev === "bad",
      title: "Deletes, rejections, cancellations, archives and reversals" },
    { k: "routine", v: facets.routine, dot: "ok",
      to: sevRoute("routine"), on: p.sev === "routine",
      title: "Everything else — creates, edits, status changes" },
  ];

  const csv = () => {
    const list = rows || [];
    const head = ["when", "module", "action", "actor", "role", "detail"];
    const lines = [head].concat(list.map((a) => [
      a.ts || "", a.module, a.action, a.actor || "system", a.role || "", a.detail || "",
    ]));
    const text = lines.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const el = document.createElement("a");
    el.href = "data:text/csv;charset=utf-8," + encodeURIComponent(text);
    el.download = "audit-log.csv"; el.click();
    shell.toast("Exported the " + list.length + " entries loaded here" +
      (list.length < total ? " of " + total + " — load more first for the rest." : "."));
  };

  if (rows === null) return <ListSkeleton />;

  return (
    <div className="dls">
      <div className="dls-cmd">
        <SearchField key={"q" + p.q} ph="Search actor, action, module or reference…" val={p.q} onFilter={onFilter} />
        <Select key={"module" + p.module} name="module" label="Module" value={p.module} onFilter={onFilter}
          options={moduleKeys.map((m) => ({ v: m, l: moduleLabel(m) + " (" + facets.modules[m] + ")" }))} />
        <span className="spacer"></span>
        <button className="btn" data-act="au-export" onClick={csv}>
          <Icon name="download" />Export
        </button>
      </div>

      <StatStrip cells={cells} />

      {error ? <Notice tone="bad" ico="alert" text={<><b>Could not load the log.</b> {error}</>} /> : null}

      {filtered ? (
        <div className="dls-chips">
          <FilterChips params={p} labels={{ q: "Search", module: "Module", sev: "Severity" }}
            onUnfilter={onUnfilter} />
        </div>
      ) : null}

      <div className="dls-body">
        <Table
          scroll
          min="900px"
          cols={[{ label: "When" }, { label: "Module" }, { label: "Action" }, { label: "Detail" }, { label: "Actor" }]}
          empty={{
            icon: "history",
            title: filtered ? "No entries match" : "Nothing recorded yet",
            body: filtered
              ? "Nothing in the log matches. Clear a filter to widen the search."
              : "The trail fills as sensitive actions are taken — a price change, a role edit, a deal closed.",
            action: filtered ? (
              <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</button>
            ) : "",
          }}
          rows={rows.map((a) => (
            <tr key={a.id}>
              <td className="mono nowrap" style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
                {stamp(a.ts)}
              </td>
              <td><Pill text={moduleLabel(a.module)} tone="line" /></td>
              <td>
                <span className={"tag " + (DESTRUCTIVE.test(a.action) ? "bad" : "")}>
                  {actionLabel(a.action, a.module)}
                </span>
              </td>
              {/* The detail is the record. It is written by the controller that
                  acted, carries the reference (`deal=DL-2501`, `plan=7`), and is
                  rendered as the plain text it is — never parsed for markup. */}
              <td className="mono" style={{ fontSize: "var(--text-sm)" }}>{a.detail || "—"}</td>
              <td>
                {a.actor || <span className="faint">system</span>}
                <div className="cell-2">{a.role || "—"}</div>
              </td>
            </tr>
          ))}
        />

        {rows.length < total ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 2px" }}>
            <button className="btn" data-act="au-more" disabled={loadingMore} onClick={more}>
              {loadingMore ? "Loading…" : "Load older entries"}
            </button>
            <span className="faint" style={{ fontSize: "var(--text-sm)" }}>
              Showing {rows.length} of {total}
            </span>
          </div>
        ) : rows.length ? (
          <div className="faint" style={{ fontSize: "var(--text-sm)", padding: "12px 2px" }}>
            All {total} entr{total === 1 ? "y" : "ies"} shown.
          </div>
        ) : null}
      </div>
    </div>
  );
}
