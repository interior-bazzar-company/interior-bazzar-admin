/* =====================================================================
   QUOTATIONS — the list, and the module's router.

   The five bands every queue in this panel renders: the page header with
   the one primary action, the filter bar, the stat strip whose every count
   is also its own filter, the table, and the pager. Nothing here counts
   anything the API did not send.
   ===================================================================== */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { inr, fmtDate } from "../../ui/format";
import {
  Alert, Button, EmptyState, FilterBar, FilterChips, ListSkeleton, ListTable, MoreMenu, PageHeader, Pagination, Pill, qs, Rail,
  SearchField, Select, StatStrip, TbTitle,
} from "../../ui";
import type { MenuItem, StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { getSession } from "../../auth/session";
import { STATUS_LABEL, STATUS_TONE, useQuotationsList } from "./api";
import type { QuotationRow } from "./api";
import { daysUntil, expiringSoon, filterQuotations, partyLine, summarize } from "./helpers";
import QuotationDetail from "./Detail";
import QuotationBuilder from "./Builder";
import QuotationPreview from "./Preview";
import PickDeal from "./PickDeal";

const STATUSES = ["draft", "issued", "accepted", "rejected", "expired", "superseded", "cancelled"];
const NEW_HASH = "#/quotations?new=1";
const PAGE_SIZE = 25;
const LABELS: Record<string, string> = { q: "Search", status: "Status", owner: "Owner", sort: "Sort" };

/* THE MODULE ROUTER. Four screens, exactly as the prototype has them
   (views-quotation.js: list / detail / builder / preview) -- no drawer. A 720px
   panel could never show a 210mm document, which is why the sheet had nowhere
   to live; and one panel doing detail AND editing meant "read it" and "change
   it" were the same screen. */
export default function Quotations() {
  const raw = useParams().id;
  const id = raw ? Number(raw) : null;
  const [sp] = useSearchParams();
  const mode = sp.get("mode") || "";
  const tab = sp.get("tab") || "items";
  const routeParams: Record<string, string> = {};
  sp.forEach((v, k) => { if (k !== "mode") routeParams[k] = v; });
  /* `?new=1` is step 1 of creating one — a page, not a dialog over the list. */
  if (!id && sp.get("new") === "1") return <PickDeal />;
  if (id && mode === "preview") return <QuotationPreview id={id} params={routeParams} />;
  if (id && mode === "edit") return <QuotationBuilder id={id} params={routeParams} />;
  if (id) return <QuotationDetail id={id} tab={tab} params={routeParams} />;
  return <QuotationsList />;
}

function QuotationsList() {
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { toast } = useShell();

  const params: Record<string, string> = {};
  sp.forEach((v, k) => { params[k] = v; });
  const p = { q: params.q || "", status: params.status || "", owner: params.owner || "", sort: params.sort || "" };
  const page = Math.max(1, Number(params.page || 1) || 1);

  /* The WHOLE page, then narrowed below. Status/owner/search all filter
     client-side because the strip has to keep counting the states you are NOT
     looking at — a server-side `?status=` makes every other cell read 0 the
     moment you pick one.
     ponytail: 200-row ceiling (PAGE_SIZE_MAX). Move q/owner to the API and add
     a counts endpoint when quotations outgrow one page. */
  const { loading, rows: all, error } = useQuotationsList(0, { sort: p.sort || undefined });

  const crumbs = useMemo(() => <TbTitle label="Quotations" to="#/quotations" />, []);
  usePageChrome({ crumbs, right: null, parent: null });

  /* Narrowing the list always returns to its first page: page 3 of the old
     result set is nowhere in the new one. */
  const onFilter = (name: string, value: string) => {
    go("#/quotations" + qs({ ...params, page: "", [name]: value }));
  };
  /* Typing would otherwise push one history entry per keystroke — the same
     220ms the Deals search debounces on. */
  const timer = useRef(0);
  const search = sp.toString();
  const onSearch = useCallback((name: string, value: string) => {
    const next: Record<string, string> = {};
    new URLSearchParams(search).forEach((v, k) => { next[k] = v; });
    next[name] = value;
    next.page = "";
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go("#/quotations" + qs(next)), 220);
  }, [search, go]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onUnfilter = (k: string) => {
    const q2: Record<string, string> = {};
    if (k !== "*") for (const x in params) if (x !== k && x !== "page") q2[x] = params[x];
    go("#/quotations" + qs(q2));
  };

  const rows = filterQuotations(all, p);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  /* Owner is a full-access control only: every other session is already scoped
     to its own rows, so the picker would be a one-option list filtering
     nothing. Locked controls are ABSENT here, not greyed. */
  const session = getSession();
  const head = !!(session && session.isFullAccess);
  const owners = useMemo(() => {
    const m = new Map<number, string>();
    all.forEach((x) => { if (x.owner) m.set(x.owner.id, x.owner.name); });
    return Array.from(m, ([v, l]) => ({ v: String(v), l }));
  }, [all]);

  /* EVERY figure below is counted over what the API actually returned, and the
     API returns only the deals this session owns or co-owns unless it has full
     access. So a sales session's strip is a statement about ITS OWN
     quotations, not the company's — and two people reading identically-worded
     cells would see different money with nothing on screen saying why. The
     labels carry the scope instead: `mine` marks the money cells, `only` ends
     the tooltips. Both are empty for a full-access viewer, which leaves that
     wording exactly as it was. */
  const mine = head ? "" : " · yours";
  const only = head ? "" : " — yours only";
  const yrs = head ? "" : " yours";

  const { byStatus, expiring, awaitingPaise, agreedPaise } = summarize(all);
  function route(k: string, v: string) {
    const q2: Record<string, string> = { ...params, page: "" };
    q2[k] = String(params[k] || "") === String(v) ? "" : v;
    return "#/quotations" + qs(q2);
  }
  /* Seven cells, in the order a quotation is worked: how many there are, the
     three live states, the one number that gets worse while nobody looks at
     it, then the money those states hold. Rejected/expired/superseded/
     cancelled are where a quotation LEAVES the funnel, not a position in it —
     each is one pick away in the Status control instead. */
  const cells: (StatCell | "sep")[] = [
    { k: "total" + mine, v: all.length, to: route("status", ""), on: !p.status,
      title: "Quotations" + only },
    "sep",
    { k: "draft", v: byStatus.draft || 0, dot: "", to: route("status", "draft"), on: p.status === "draft",
      title: "Draft quotations" + only },
    { k: "issued", v: byStatus.issued || 0, dot: "info", to: route("status", "issued"), on: p.status === "issued",
      title: "Issued quotations" + only },
    { k: "accepted", v: byStatus.accepted || 0, dot: "ok", to: route("status", "accepted"), on: p.status === "accepted",
      title: "Accepted quotations" + only },
    "sep",
    { k: "expiring", v: expiring, dot: expiring ? "bad" : "", tone: expiring ? "bad" : "",
      to: route("status", "expiring"), on: p.status === "expiring",
      title: "Issued quotations within 3 days of lapsing" + only },
    "sep",
    { k: "awaiting" + mine, v: inr(awaitingPaise, { compact: true }), tone: "warn",
      title: "Value of quotations issued and not yet answered" + only },
    "sep",
    { k: "agreed" + mine, v: inr(agreedPaise, { compact: true }), tone: "ok",
      title: "Value of accepted quotations — the agreed value written back to the deals" + only },
  ];

  const chips = Object.keys(params).filter((k) => params[k] && k !== "page").length > 0;

  /* Step 1 of 2 — its own page. See PickDeal.tsx. */
  const openPick = () => go(NEW_HASH);

  /* What the list endpoint actually returns, and nothing more — the rows on
     screen, filters and all. Amounts stay in paise, unrounded. */
  const exportCsv = () => {
    const out: (string | number)[][] = [["quotation_number", "version", "status", "deal_ref",
      "customer", "value_paise", "quotation_date", "valid_until", "issued_at", "owner"]];
    rows.forEach((x) => out.push([x.quotationNumber || "", x.version, x.status, x.dealRef,
      partyLine(x), x.grandTotalPaise, x.quotationDate || "", x.validUntil || "",
      x.issuedAt || "", x.owner ? x.owner.name : ""]));
    const csv = out.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "quotations.csv"; a.click();
    toast("Exported " + rows.length + " quotations — the rows currently filtered. Amounts are in paise, unrounded.");
  };

  if (loading && !all.length) return <ListSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <PageHead total={all.length} awaiting={byStatus.issued || 0} onNew={openPick} onExport={exportCsv} />

      <FilterBar
        search={<SearchField ph="Search quotation no, deal ref or customer…" val={p.q} onFilter={onSearch} />}
        filters={
          <>
            <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
              options={STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] + " (" + (byStatus[s] || 0) + yrs + ")", dot: STATUS_TONE[s] || "neutral" }))
                .concat([{ v: "expiring", l: "Expiring ≤3 days (" + expiring + yrs + ")", dot: "bad" }])} />
            {head
              ? <Select key={"owner" + p.owner} name="owner" label="Owner" value={p.owner}
                  onFilter={onFilter} options={owners} />
              : null}
            <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
              options={[{ v: "newest", l: "Newest first" }, { v: "oldest", l: "Oldest first" }]} />
          </>
        }
        chips={chips ? <FilterChips params={{ ...params, page: "" }} onUnfilter={onUnfilter} labels={LABELS} /> : null}
      />

      <StatStrip cells={cells} />

      {error ? <Alert tone="bad" title="Could not load quotations." action={<Button color="secondary" size="xs" ico="refresh" onClick={() => go("#/quotations" + qs(params))}>Retry</Button>}>{error}</Alert> : null}

      <QuotationsTable rows={shown} p={p} go={go} onUnfilter={onUnfilter} openPick={openPick} />

      <Pagination page={cur} pages={pages} total={rows.length} unit={rows.length === 1 ? "quotation" : "quotations"}
        pageSize={PAGE_SIZE} shown={shown.length} alwaysCount={rows.length > 0}
        onPage={(n) => go("#/quotations" + qs({ ...params, page: n > 1 ? String(n) : "" }))} />
    </div>
  );
}

/* The one primary action of the view, and the count that says what is in
   front of you before any filter narrows it. */
function PageHead({ total, awaiting, onNew, onExport }: {
  total: number; awaiting: number; onNew: () => void; onExport: () => void;
}) {
  return (
    <PageHeader
      title="Quotations"
      meta={<>
        <span className="tnum">{total.toLocaleString()} {total === 1 ? "quotation" : "quotations"}</span>
        {awaiting ? <span className="tnum">{awaiting} awaiting an answer</span> : null}
      </>}
      actions={<>
        <Button color="secondary" ico="download" data-act="qt-export" onClick={onExport}>Export</Button>
        {can("quotations", "create")
          ? <Button color="primary" ico="plus" data-act="qt-new" data-go={NEW_HASH} onClick={onNew}>New quotation</Button>
          : null}
      </>}
    />
  );
}

function QuotationsTable({ rows, p, go, onUnfilter, openPick }: {
  rows: QuotationRow[]; p: Record<string, string>;
  go: (h: string) => void; onUnfilter: (k: string) => void; openPick: () => void;
}) {
  const filtered = !!(p.q || p.status || p.owner);
  if (!rows.length)
    return <EmptyState
      icon="quote" title={filtered ? "No quotations match these filters" : "No quotations yet"}
      body={filtered ? "Nothing matches. Clear a filter to widen the search."
        : "A quotation is born inside a deal — open a deal and quote it, or start one from here."}
      action={filtered
        ? <Button color="secondary" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</Button>
        : can("quotations", "create")
          ? <Button color="primary" ico="plus" data-act="qt-new" data-go={NEW_HASH} onClick={openPick}>New quotation</Button>
          : null} />;

  return (
    <ListTable min="60rem" head={<tr>
      <th className="rail" />
      <th scope="col">Quotation</th>
      <th scope="col">Status</th>
      <th scope="col">Deal</th>
      <th scope="col" className="n">Value</th>
      <th scope="col">Valid until</th>
      <th scope="col">Owner</th>
      <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
    </tr>}>
      {rows.map((q) => {
        const to = "#/quotations/" + q.id;
        const lapsed = q.status === "issued" && daysUntil(q.validUntil) < 0;
        const items: MenuItem[] = [
          { icon: "quote", label: q.status === "draft" ? "Preview & issue" : "View document", act: () => go(to + "?mode=preview") },
          ...(q.status === "draft" && can("quotations", "edit")
            ? [{ icon: "edit", label: "Edit draft", act: () => go(to + "?mode=edit") }]
            : []),
          { icon: "deal", label: "Open the deal", act: () => go("#/deals/" + q.dealRef) },
        ];
        return (
          <tr key={q.id} className="clickable" data-go={to} onClick={() => go(to)}>
            <Rail tone={lapsed ? "bad" : expiringSoon(q) ? "warn" : q.status === "accepted" ? "ok" : undefined}
              title={lapsed ? "Lapsed" : expiringSoon(q) ? "Lapses within three days" : undefined} />
            <td className="cell-1">
              <span className="font-mono tnum">{q.quotationNumber || <span className="font-sans font-normal text-quaternary">Assigned on issue</span>}</span>
              <div className="cell-2">{partyLine(q)}</div>
            </td>
            <td>
              <Pill dot text={STATUS_LABEL[q.status]} tone={STATUS_TONE[q.status] || "neutral"} />
              <div className="cell-2">v{q.version} · {q.issuedAt ? "issued " + fmtDate(q.issuedAt) : "made " + fmtDate(q.createdAt)}</div>
            </td>
            <td className="mono">{q.dealRef}</td>
            <td className="n">{inr(q.grandTotalPaise)}</td>
            <td><ValidityChip q={q} /></td>
            <td>{q.owner ? q.owner.name : <span className="text-quaternary">—</span>}</td>
            <td className="acts" onClick={(e) => e.stopPropagation()}>
              <MoreMenu items={items} small align="right" />
            </td>
          </tr>
        );
      })}
    </ListTable>
  );
}

/* Valid until, read the way the prototype reads it (views-quotation.js
   validityChip): a date nobody is waiting on is quiet, and only an ISSUED
   quotation's deadline earns colour — struck red once it has lapsed, red
   inside 3 days, amber inside a week, with the countdown underneath. */
function ValidityChip({ q }: { q: QuotationRow }) {
  if (q.status !== "issued")
    return <span className="text-quaternary tnum">{q.validUntil ? fmtDate(q.validUntil) : "—"}</span>;
  const d = daysUntil(q.validUntil);
  if (d < 0) return <span className="text-error-primary line-through tnum">{fmtDate(q.validUntil)}</span>;
  return <>
    <span className={d <= 3 ? "font-medium text-error-primary tnum" : d <= 7 ? "text-warning-primary tnum" : "tnum"}>{fmtDate(q.validUntil)}</span>
    <div className="cell-2">{d === 0 ? "today" : "in " + d + "d"}</div>
  </>;
}
