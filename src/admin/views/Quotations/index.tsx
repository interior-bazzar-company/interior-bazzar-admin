/* =====================================================================
   QUOTATIONS — the list. Same five bands Deals/Invoices/Plans render: a
   title in the topbar, a command row, one stat strip, the active filters,
   and a table in a viewport-bounded body.
   ===================================================================== */
import { useCallback, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { inr, fmtDate } from "../../ui/format";
import { EmptyState, FilterChips, Notice, Pill, Select, StatStrip, qs, Icon } from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { ListSkeleton } from "../../ui";
import { STATUS_LABEL, STATUS_TONE, useQuotationsList } from "./api";
import type { QuotationRow } from "./api";
import { partyLine } from "./helpers";
import QuotationDetail from "./Detail";
import QuotationBuilder from "./Builder";
import QuotationPreview from "./Preview";
import PickDealModal from "./PickDealModal";

const STATUSES = ["draft", "issued", "accepted", "rejected", "expired", "superseded", "cancelled"];

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
  if (id && mode === "preview") return <QuotationPreview id={id} params={routeParams} />;
  if (id && mode === "edit") return <QuotationBuilder id={id} params={routeParams} />;
  if (id) return <QuotationDetail id={id} tab={tab} params={routeParams} />;
  return <QuotationsList />;
}

function QuotationsList() {
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const params: Record<string, string> = {};
  sp.forEach((v, k) => { params[k] = v; });
  const p = { status: params.status || "", sort: params.sort || "" };

  const { loading, rows, error } = useQuotationsList(tick, { status: p.status || undefined });

  const crumbs = useMemo(() => <span className="tb-title">Quotations</span>, []);
  usePageChrome({ crumbs, right: null, parent: null });

  /* A new draft opens on its own editor page -- the prototype's builder(). */
  const done = useCallback((msg: string, ref: number | null) => {
    closeLayer(); toast(msg);
    go(ref ? "#/quotations/" + ref + "?mode=edit" : "#/quotations");
    bump();
  }, [closeLayer, toast, go, bump]);

  const onFilter = (name: string, value: string) => {
    go("#/quotations" + qs({ ...params, [name]: value }));
  };
  const onUnfilter = (k: string) => {
    const q2: Record<string, string> = {};
    if (k !== "*") for (const x in params) if (x !== k) q2[x] = params[x];
    go("#/quotations" + qs(q2));
  };

  const byStatus: Record<string, number> = {};
  rows.forEach((q) => { byStatus[q.status] = (byStatus[q.status] || 0) + 1; });
  function route(k: string, v: string) {
    const q2: Record<string, string> = { ...params };
    q2[k] = String(params[k] || "") === String(v) ? "" : v;
    return "#/quotations" + qs(q2);
  }
  const cells: (StatCell | "sep")[] = [
    { k: "quotations", v: rows.length, to: route("status", ""), on: !p.status },
    "sep",
    ...STATUSES.filter((s) => byStatus[s]).map((s) => ({
      k: STATUS_LABEL[s].toLowerCase(), v: byStatus[s] || 0,
      to: route("status", s), on: p.status === s, tone: STATUS_TONE[s],
    })),
  ];

  const chips = Object.keys(params).filter((k) => params[k]).length > 0;

  const openPick = () => {
    if (!can("quotations", "create")) return toast("403 — you do not have quotation-creation access.", "bad");
    modal(<PickDealModal onClose={closeLayer} onDone={(qid: number) => done("Quotation drafted.", qid)} />, "wide");
  };

  if (loading && !rows.length) return <ListSkeleton />;

  return (
    <div className="dls">
      <div className="dls-cmd">
        <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
          options={STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] }))} />
        <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[{ v: "newest", l: "Newest first" }, { v: "oldest", l: "Oldest first" }]} />
        <span className="spacer"></span>
        {can("quotations", "create")
          ? <button className="btn pri" data-act="qt-new" onClick={openPick}><Icon name="plus" />Create quotation</button>
          : null}
      </div>

      <StatStrip cells={cells} />

      {error ? <Notice tone="bad" ico="alert" text={<><b>Could not load quotations.</b> {error}</>} /> : null}

      {chips ? <div className="dls-chips">
        <FilterChips params={params} onUnfilter={onUnfilter} labels={{ status: "Status", sort: "Sort" }} />
      </div> : null}

      <div className="dls-body">
        <QuotationsTable rows={rows} p={p} go={go} onUnfilter={onUnfilter} openPick={openPick} />
      </div>
    </div>
  );
}

function QuotationsTable({ rows, p, go, onUnfilter, openPick }: {
  rows: ReturnType<typeof useQuotationsList>["rows"]; p: Record<string, string>;
  go: (h: string) => void; onUnfilter: (k: string) => void; openPick: () => void;
}) {
  const filtered = !!p.status;
  if (!rows.length)
    return <EmptyState
      icon="quote" title={filtered ? "No quotations match this filter" : "No quotations yet"}
      body={filtered ? "Nothing matches. Clear the filter to widen the search."
        : "A quotation is born inside a deal — open a deal and quote it, or start one from here."}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear filter</button>
        : can("quotations", "create")
          ? <button className="btn pri" data-act="qt-new" onClick={openPick}>Create quotation</button>
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

/** Whole days from today to a date-only ISO string. Local-time field parse,
 *  same reason fmtDate does it that way. */
function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const p = String(iso).slice(0, 10).split("-");
  const then = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((then.getTime() - now.getTime()) / 86400000);
}
