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

   FILTERING AND PAGING ARE SERVER-SIDE, all of it. A log only grows, so a page
   that filtered the forty rows it happened to hold would answer "no entries
   match" about a log that contains the entry. Search, module, actor role,
   severity and the page number all go to the endpoint; the facet counts come
   back with the page and are counted over the whole filtered log, never over
   the rows on screen.

   The page number lives in the URL beside the filters, so a link to page four
   of "destructive, plans" is a link somebody else can open.

   READ SURFACE. The log is append-only: there is no edit, no delete and no
   "clear log" here, and there is no endpoint for one either. The only action
   on the page takes a copy out.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import type { AuditEntry, AuditFacets } from "../../../api/modules/adminOps";
import { Alert, Button, EmptyState, FilterBar, FilterChips, Icon, ListSkeleton, ListTable, PageHeader, Pagination, Person, Pill, Rail, SearchField, Select, StatStrip } from "../../ui";
import type { StatCell } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import { moduleLabel } from "../../shell/modules";

const PAGE_SIZE = 40;

const CHIP_LABELS = { q: "Search", module: "Module", role: "Actor role", sev: "Kind" };

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

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/** `valuePaise` -> "value", `placeOfSupply` -> "place of supply". Field keys
 *  are a server's internal name, not a sentence — this is the one place every
 *  module's audit diff gets read, so it is spelled out here rather than once
 *  per module. */
function fieldLabel(field: string) {
  const bare = field.replace(/Paise$/, "");
  return bare
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** `{field: [before, after]}` -> "Field: before → after, Field two: x → y".
 *  A `…Paise` field is money and prints as money — everything else prints as
 *  the server sent it, since a raw id or free string still says more than
 *  nothing. Same plain-text treatment as `detail` otherwise — never parsed
 *  for markup, just printed. */
function changesLine(changes: Record<string, [unknown, unknown]> | null | undefined) {
  if (!changes) return null;
  const money = (field: string, v: unknown) =>
    field.endsWith("Paise") && typeof v === "number";
  const fmt = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    return money(field, v) ? INR.format((v as number) / 100) : String(v);
  };
  return Object.entries(changes)
    .map(([field, [before, after]]) => fieldLabel(field) + ": " + fmt(field, before) + " → " + fmt(field, after))
    .join(", ");
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
    role: sp.get("role") || "",
    sev: sp.get("sev") || "",
  };
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [facets, setFacets] = useState<AuditFacets>({ modules: {}, roles: {}, destructive: 0, routine: 0 });
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(p);

  /* One query object, built once per filter set: the fetch, the paging and the
     export all send the SAME narrowing, so an export can never be of a
     different log than the one on screen. */
  const query = useCallback((pageNo: number, pageSize: number) => ({
    search: p.q || undefined,
    module: p.module || undefined,
    role: p.role || undefined,
    destructive: p.sev === "bad" ? "1" : p.sev === "routine" ? "0" : undefined,
    pageNo, pageSize,
  }), [p.q, p.module, p.role, p.sev]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setBusy(true);
    call(AdminOpsService.audit(query(page, PAGE_SIZE)))
      .then((d) => {
        if (cancelled) return;
        /* Normalised, not trusted: a backend that predates a facet omits it,
           and a missing count has to read as ZERO — a blank where a number
           belongs looks like the page failed rather than like nothing
           happened. */
        const f = d.facets || ({} as Partial<AuditFacets>);
        setRows(d.entries || []);
        setFacets({
          modules: f.modules || {}, roles: f.roles || {},
          destructive: f.destructive || 0, routine: f.routine || 0,
        });
        setTotal(d.total || 0); setBusy(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]); setError(errMessage(e)); setBusy(false);
      });
    return () => { cancelled = true; };
  }, [key, page, query]);

  /* ------------------------------------------------------------- filters -- */
  const typing = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(typing.current), []);

  /** Narrowing the log always returns to page one — page four of the old query
      is nowhere in the new one. */
  const write = useCallback((next: Record<string, string>, pageNo?: number) => {
    const out: Record<string, string> = {};
    for (const k in next) if (next[k]) out[k] = next[k];
    if (pageNo && pageNo > 1) out.page = String(pageNo);
    setSp(out);
  }, [setSp]);

  const setParam = (name: string, value: string) => write({ ...p, [name]: value });
  const onFilter = (name: string, value: string) => {
    if (name !== "q") return setParam(name, value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => setParam("q", value), 220);
  };
  const onUnfilter = (k: string) => (k === "*" ? setSp({}) : setParam(k, ""));

  /** A stat cell is its own filter, and pressing the one already chosen clears
      it — the same toggle every list page in the panel uses. */
  const route = (k: string, v: string) => {
    const next: Record<string, string> = { ...p, [k]: p[k] === v ? "" : v };
    const out: Record<string, string> = {};
    for (const x in next) if (next[x]) out[x] = next[x];
    return "#/audit" + (Object.keys(out).length ? "?" + new URLSearchParams(out).toString() : "");
  };

  const filtered = !!(p.q || p.module || p.role || p.sev);
  const moduleKeys = useMemo(() => Object.keys(facets.modules).sort(), [facets.modules]);
  const roleKeys = useMemo(() => Object.keys(facets.roles || {}).sort(), [facets.roles]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* Total first, then the one split that matters when you open this page in an
     argument: how much of what happened was destructive. Every cell filters. */
  const cells: (StatCell | "sep")[] = [
    { k: "entries", v: total, to: route("sev", ""), on: !p.sev && !p.module && !p.role },
    "sep",
    { k: "destructive", v: facets.destructive,
      dot: facets.destructive ? "bad" : "neutral", tone: facets.destructive ? "bad" : "",
      to: route("sev", "bad"), on: p.sev === "bad",
      title: "Deletes, rejections, cancellations, archives and reversals" },
    { k: "routine", v: facets.routine, dot: "ok",
      to: route("sev", "routine"), on: p.sev === "routine",
      title: "Everything else — creates, edits, status changes" },
    "sep",
    { k: "modules touched", v: moduleKeys.length,
      title: "How many modules the filtered log reaches" },
  ];

  /* THE WHOLE FILTERED LOG, not the page on screen — the server builds the
     file itself (IST stamps, module labels already resolved) and says how
     many rows it wrote in `X-Row-Count`; this just downloads it as-is. */
  const csv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { csv: text, rowCount } = await AdminOpsService.auditExport(query(1, PAGE_SIZE));
      const el = document.createElement("a");
      el.href = "data:text/csv;charset=utf-8," + encodeURIComponent(text);
      el.download = "audit-log.csv"; el.click();
      /* `rowCount` is X-Row-Count off the response. Null only if a proxy in
         front of the API ever strips it — the CSV's own line count (minus the
         header row) still says how many entries came down. */
      const n = rowCount ?? Math.max(0, text.trim().split("\n").length - 1);
      shell.toast("Exported " + n + " entr" + (n === 1 ? "y" : "ies") + ".");
    } catch (e: unknown) {
      shell.toast(errMessage(e), "bad");
    }
    setExporting(false);
  };

  if (rows === null) return <ListSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Audit"
        meta={<>
          <span>{total.toLocaleString()} entr{total === 1 ? "y" : "ies"}</span>
          {facets.destructive
            ? <span className="text-error-primary">{facets.destructive} destructive</span>
            : null}
          <span className="text-quaternary">append-only — nothing here can be edited or removed</span>
        </>}
        /* Absent rather than greyed when there is nothing to take a copy of —
           an empty CSV is a support ticket, not an export. */
        actions={rows.length
          ? <Button color="secondary" ico="download" data-act="au-export"
              isLoading={exporting} showTextWhileLoading onClick={csv}>Export CSV</Button>
          : null}
      />

      <FilterBar
        search={<SearchField key={"q" + p.q} ph="Search actor, action, module or reference…" val={p.q} onFilter={onFilter} />}
        filters={<>
          <Select key={"module" + p.module} name="module" label="Module" value={p.module} onFilter={onFilter}
            options={moduleKeys.map((m) => ({ v: m, l: moduleLabel(m) + " (" + facets.modules[m] + ")" }))} />
          {roleKeys.length
            ? <Select key={"role" + p.role} name="role" label="Actor role" value={p.role} onFilter={onFilter}
                options={roleKeys.map((r) => ({ v: r, l: r + " (" + facets.roles[r] + ")" }))} />
            : null}
          <Select key={"sev" + p.sev} name="sev" label="Kind" value={p.sev} onFilter={onFilter}
            options={[
              { v: "bad", l: "Destructive (" + facets.destructive + ")", dot: "bad" },
              { v: "routine", l: "Routine (" + facets.routine + ")", dot: "ok" }]} />
        </>}
        chips={filtered
          ? <FilterChips params={p} labels={CHIP_LABELS} onUnfilter={onUnfilter} />
          : null}
      />

      <StatStrip cells={cells} />

      {error
        ? <Alert tone="bad" title="Could not load the log.">{error}</Alert>
        : null}

      {rows.length ? (
        <>
          <ListTable min="66rem" className={busy ? "opacity-60 transition-opacity duration-150" : undefined}
            head={<tr>
              <th className="rail" /><th scope="col">When</th><th scope="col">Module</th>
              <th scope="col">Action</th><th scope="col">Detail</th><th scope="col">Actor</th>
            </tr>}>
            {rows.map((a) => {
              const bad = DESTRUCTIVE.test(a.action);
              return (
                <tr key={a.id}>
                  <Rail tone={bad ? "bad" : undefined}
                    title={bad ? "Destructive — something was removed, reversed or refused" : undefined} />
                  <td className="mono whitespace-nowrap text-tertiary">{stamp(a.ts)}</td>
                  <td><Pill xs tone="neutral" text={moduleLabel(a.module)} /></td>
                  <td>
                    <Pill xs tone={bad ? "bad" : "neutral"} text={actionLabel(a.action, a.module)}
                      title={a.action} />
                  </td>
                  {/* The detail is the record. It is written by the controller that
                      acted, carries the reference (`deal=DL-2501`, `plan=7`), and is
                      rendered as the plain text it is — never parsed for markup.
                      Reason, the before -> after diff and the IP ride under it in the
                      same cell, same treatment, only when the row actually carries
                      them — most rows still won't. */}
                  <td className="mono text-secondary">
                    {a.detail || "—"}
                    {a.reason
                      ? <div className="mt-1 text-xs text-tertiary">reason: {a.reason}</div>
                      : null}
                    {a.changes
                      ? <div className="mt-1 text-xs text-tertiary">{changesLine(a.changes)}</div>
                      : null}
                    {a.ip
                      ? <div className="mt-1 text-xs text-tertiary">ip: {a.ip}</div>
                      : null}
                  </td>
                  <td>
                    {a.actor
                      ? <Person sm name={a.actor} sub={a.role || undefined} />
                      : <span className="inline-flex items-center gap-1.5 text-tertiary">
                          <Icon name="bolt" size="sm" className="text-fg-quaternary" />system
                        </span>}
                  </td>
                </tr>
              );
            })}
          </ListTable>

          <Pagination page={page} pages={pages} total={total} unit="entries" alwaysCount
            pageSize={PAGE_SIZE} shown={rows.length}
            onPage={(n) => write(p, n)} />
        </>
      ) : error ? (
        /* A FAILED READ IS NOT AN EMPTY LOG. Both used to render at once: the
           red "Could not load the log" alert sat directly above "Nothing
           recorded yet — the trail fills as sensitive actions are taken", and
           the second one is the reassuring sentence. Somebody checking whether
           an action had been recorded read the wrong half and concluded the
           audit trail was not being written. When the read failed, the honest
           answer is that we do not know what is in the log. */
        <EmptyState icon="alert"
          title="The log could not be read"
          body="This is not the same as an empty log — entries may well exist. Try again, and if it keeps failing the audit read itself is broken."
          action={<Button color="secondary" ico="refresh" onClick={() => write(p, page)}>Try again</Button>} />
      ) : (
        <EmptyState icon="history"
          title={filtered ? "No entries match" : "Nothing recorded yet"}
          body={filtered
            ? "Nothing in the log matches. Clear a filter to widen the search."
            : "The trail fills as sensitive actions are taken — a price change, a role edit, a deal closed."}
          action={filtered
            ? <Button color="secondary" ico="x" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</Button>
            : null} />
      )}
    </div>
  );
}
