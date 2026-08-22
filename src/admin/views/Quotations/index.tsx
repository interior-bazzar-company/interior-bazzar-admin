/* =====================================================================
   QUOTATIONS — the list. Same five bands Deals/Invoices/Plans render: a
   title in the topbar, a command row, one stat strip, the active filters,
   and a table in a viewport-bounded body.
   ===================================================================== */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { inr, fmtDate } from "../../ui/format";
import { EmptyState, FilterChips, Notice, Pill, SearchField, Select, StatStrip, qs, Icon } from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { getSession } from "../../auth/session";
import { ListSkeleton } from "../../ui";
import { STATUS_LABEL, STATUS_TONE, useQuotationsList } from "./api";
import type { QuotationRow } from "./api";
import { daysUntil, filterQuotations, partyLine, summarize } from "./helpers";
import QuotationDetail from "./Detail";
import QuotationBuilder from "./Builder";
import QuotationPreview from "./Preview";
import PickDeal from "./PickDeal";

const STATUSES = ["draft", "issued", "accepted", "rejected", "expired", "superseded", "cancelled"];
const NEW_HASH = "#/quotations?new=1";

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

  /* The WHOLE page, then narrowed below. Status/owner/search all filter
     client-side because the strip has to keep counting the states you are NOT
     looking at — a server-side `?status=` makes every other cell read 0 the
     moment you pick one.
     ponytail: 200-row ceiling (PAGE_SIZE_MAX). Move q/owner to the API and add
     a counts endpoint when quotations outgrow one page. */
  const { loading, rows: all, error } = useQuotationsList(0, { sort: p.sort || undefined });

  const crumbs = useMemo(() => <span className="tb-title">Quotations</span>, []);
  usePageChrome({ crumbs, right: null, parent: null });

  const onFilter = (name: string, value: string) => {
    go("#/quotations" + qs({ ...params, [name]: value }));
  };
  /* Typing would otherwise push one history entry per keystroke — the same
     220ms the Deals search debounces on. */
  const timer = useRef(0);
  const search = sp.toString();
  const onSearch = useCallback((name: string, value: string) => {
    const next: Record<string, string> = {};
    new URLSearchParams(search).forEach((v, k) => { next[k] = v; });
    next[name] = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go("#/quotations" + qs(next)), 220);
  }, [search, go]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onUnfilter = (k: string) => {
    const q2: Record<string, string> = {};
    if (k !== "*") for (const x in params) if (x !== k) q2[x] = params[x];
    go("#/quotations" + qs(q2));
  };

  const rows = filterQuotations(all, p);

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
    const q2: Record<string, string> = { ...params };
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

  const chips = Object.keys(params).filter((k) => params[k]).length > 0;

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
    <div className="dls">
      <div className="dls-cmd">
        <SearchField ph="Search quotation no, deal ref or customer…" val={p.q} onFilter={onSearch} />
        <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
          options={STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] + " (" + (byStatus[s] || 0) + yrs + ")" }))
            .concat([{ v: "expiring", l: "Expiring ≤3 days (" + expiring + yrs + ")" }])} />
        {head
          ? <Select key={"owner" + p.owner} name="owner" label="Owner" value={p.owner}
              onFilter={onFilter} options={owners} />
          : null}
        <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[{ v: "newest", l: "Newest first" }, { v: "oldest", l: "Oldest first" }]} />
        <span className="spacer"></span>
        <button className="btn" data-act="qt-export" onClick={exportCsv}><Icon name="download" />Export</button>
        {can("quotations", "create")
          ? <button className="btn pri" data-act="qt-new" data-go={NEW_HASH} onClick={openPick}><Icon name="plus" />Create quotation</button>
          : null}
      </div>

      <StatStrip cells={cells} />

      {error ? <Notice tone="bad" ico="alert" text={<><b>Could not load quotations.</b> {error}</>} /> : null}

      {chips ? <div className="dls-chips">
        <FilterChips params={params} onUnfilter={onUnfilter}
          labels={{ q: "Search", status: "Status", owner: "Owner", sort: "Sort" }} />
      </div> : null}

      <div className="dls-body">
        <QuotationsTable rows={rows} p={p} go={go} onUnfilter={onUnfilter} openPick={openPick} />
      </div>
    </div>
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
        ? <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</button>
        : can("quotations", "create")
          ? <button className="btn pri" data-act="qt-new" data-go={NEW_HASH} onClick={openPick}>Create quotation</button>
          : null} />;

  return (
    <table className="tbl dls-tbl"><thead><tr>
      <th style={{ width: "3px" }}></th><th>Quotation</th><th>Status</th><th>Deal</th>
      <th className="n">Value</th><th>Valid until</th><th>Owner</th>
    </tr></thead><tbody>
      {rows.map((q) => {
        const to = "#/quotations/" + q.id;
        return (
          <tr key={q.id} className="clickable" data-go={to} onClick={() => go(to)}>
            <td className="rail"><i></i></td>
            <td>
              <div className="cell-1 mono">
                {q.quotationNumber || <span className="faint">Assigned on issue</span>}{" "}
                <span className="pill xs">v{q.version}</span>
              </div>
              <div className="cell-2">{partyLine(q)}</div>
            </td>
            <td>
              <Pill text={STATUS_LABEL[q.status]} tone={STATUS_TONE[q.status]} />
              <div className="cell-2">{q.issuedAt ? "issued " + fmtDate(q.issuedAt) : "made " + fmtDate(q.createdAt)}</div>
            </td>
            <td className="mono cell-2">{q.dealRef}</td>
            <td className="n tnum">{inr(q.grandTotalPaise)}</td>
            <td><ValidityChip q={q} /></td>
            <td>{q.owner ? q.owner.name : <span className="faint">—</span>}</td>
          </tr>
        );
      })}
    </tbody></table>
  );
}

/* Valid until, read the way the prototype reads it (views-quotation.js
   validityChip): a date nobody is waiting on is quiet, and only an ISSUED
   quotation's deadline earns colour — struck red once it has lapsed, red
   inside 3 days, amber inside a week, with the countdown underneath. */
function ValidityChip({ q }: { q: QuotationRow }) {
  if (q.status !== "issued")
    return q.validUntil ? <span className="faint">{fmtDate(q.validUntil)}</span> : <span className="faint">—</span>;
  const d = daysUntil(q.validUntil);
  if (d < 0) return <span style={{ textDecoration: "line-through", color: "var(--bad)" }}>{fmtDate(q.validUntil)}</span>;
  const style = d <= 3 ? { color: "var(--bad)", fontWeight: 500 } : d <= 7 ? { color: "var(--warn)" } : undefined;
  return <>
    <span style={style}>{fmtDate(q.validUntil)}</span>
    <div className="cell-2">{d === 0 ? "today" : "in " + d + "d"}</div>
  </>;
}
