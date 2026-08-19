/* =====================================================================
   CREATE · STEP 1 — deal AND quotation, both required (`#/invoices?new=1`,
   then `&deal=<ref>`). The prototype's pick() / quotationStep()
   (views-invoice.js), on the page shape Quotations uses to start one.

   A page, not a dialog over the list: it is the first half of creating an
   invoice, not a question asked about the list you were reading.

   Both halves show only what CreateDraft will actually accept — a deal with
   an accepted quotation and something still uninvoiced — rather than
   offering a row and then refusing the click. Outstanding is the server's
   own cap, `_outstanding_for`: deal.valuePaise less every LIVE
   (non-cancelled) invoice already raised on it. The server checks remain
   the authority.
   ===================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { DealRow, QuotationRow } from "../../../api/modules/adminOps";
import { EmptyState, KvList, Notice, Pill, SearchField, SectionHead, Table, Toolbar } from "../../ui";
import { inr } from "../../ui/format";
import { errMessage } from "../../../api/apiService";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { STATUS_LABEL as Q_LABEL, STATUS_TONE as Q_TONE } from "../Quotations/api";
import { lineNet, planItemOf } from "../Quotations/helpers";
import { call } from "./api";

/** Live (non-cancelled) invoices already raised: money per deal — which is
 *  what the cap is measured in — and a count per quotation, which is how many
 *  installments have been billed. */
type Billed = { byDeal: Record<string, { n: number; paise: number }>; byQuote: Record<number, number> };
const NO_BILLED: Billed = { byDeal: {}, byQuote: {} };

/** Every live invoice, in one read. Both steps need it and neither can change
 *  it while the page is open.
 *  ponytail: one page (200 is the server's max). Overflow can only
 *  under-count what is already billed, and the create refusal still catches
 *  it. */
function useBilled(): Billed {
  const [billed, setBilled] = useState<Billed>(NO_BILLED);
  useEffect(() => {
    call(AdminOpsService.invoices({ pageSize: 200 }))
      .then((d) => {
        const b: Billed = { byDeal: {}, byQuote: {} };
        (d.invoices || []).forEach((inv) => {
          if (inv.status === "cancelled") return;
          const c = b.byDeal[inv.dealRef] || (b.byDeal[inv.dealRef] = { n: 0, paise: 0 });
          c.n += 1; c.paise += inv.grandTotalPaise;
          b.byQuote[inv.quotationId] = (b.byQuote[inv.quotationId] || 0) + 1;
        });
        setBilled(b);
      })
      .catch(() => undefined);
  }, []);
  return billed;
}

/** How many installments the plan was split into, 0 for a lump sum. */
function installmentsOf(q: QuotationRow | null): number {
  const plan = q ? planItemOf(q) : null;
  return plan && plan.installments > 1 ? plan.installments : 0;
}

export default function PickInvoice({ dealRef }: { dealRef: string }) {
  const { go } = useNav();

  usePageChrome({ crumbs: <span className="tb-title">Invoices</span>, right: null, parent: "#/invoices" });

  if (!can("invoices", "create")) return (
    <div className="page">
      <EmptyState icon="lock" title="403 — no invoice-creation access"
        body="Your role can read invoices but not raise one."
        action={<button className="btn" onClick={() => go("#/invoices")}>Back to invoices</button>} />
    </div>
  );

  return (
    <div className="page">
      <div className="ph">
        <div className="ph-t">
          <div className="faint" style={{ fontSize: "var(--text-sm)" }}>Step 1 of 2</div>
          <h1>{dealRef ? "Which quotation is this billed against?" : "Which deal is this for?"}</h1>
          <div className="scope">
            Both the deal and the quotation are required. Neither is assumed
            {dealRef ? "" : " — only deals with an accepted quotation appear below"}.
          </div>
        </div>
        <div className="acts">
          <button className="btn" data-go="#/invoices" onClick={() => go("#/invoices")}>Cancel</button>
        </div>
      </div>
      {dealRef ? <QuotationStep dealRef={dealRef} /> : <DealStep />}
    </div>
  );
}

/* ============================================================ step 1 · deal */
function DealStep() {
  const { go } = useNav();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DealRow[] | null>(null);
  /* dealRef → its ACCEPTED quotation. A deal without one is not billable at
     all, so these keys double as the filter. */
  const [accepted, setAccepted] = useState<Record<string, QuotationRow>>({});
  const billed = useBilled();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    call(AdminOpsService.quotations({ status: "accepted", pageSize: 200 }))
      .then((d) => {
        const m: Record<string, QuotationRow> = {};
        (d.quotations || []).forEach((qt) => { m[qt.dealRef] = qt; });
        setAccepted(m);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      AdminOpsService.deals({ search: q, pageSize: 50, sort: "newest" }).then((res) => {
        if (res.response === false) { setHits([]); return; }
        setHits(res.data.deals);
      }).catch(() => setHits([]));
    }, 220);
    return () => window.clearTimeout(timer.current);
  }, [q]);

  /* Applied at render, not in the fetch: the three requests race, and the
     deals usually land first. Lost is the only stage closed to billing — a won
     deal with every rupee invoiced is stopped by the cap below, not by its
     stage (InvoicesController.CreateDraft). */
  const list = hits && hits.filter((d) => {
    if (d.stageKey === "lost" || !accepted[d.ref]) return false;
    const b = billed.byDeal[d.ref];
    return (d.valuePaise || 0) - (b ? b.paise : 0) > 0;
  });

  return (
    <>
      <div style={{ height: "14px" }}></div>
      <Toolbar>
        <SearchField ph="Search customer, city or deal ref…" val={q} onFilter={(_n, v) => setQ(v)} />
      </Toolbar>

      <Table
        cols={[{ label: "Customer" }, { label: "Deal" }, { label: "Deal value", cls: "n" },
          { label: "Outstanding", cls: "n" }, { label: "Installments", cls: "c" },
          { label: "Invoices", cls: "c" }, { label: "", cls: "c" }]}
        empty={list === null
          ? { icon: "deal", title: "Searching…", body: "" }
          : { icon: "deal", title: "No billable deals in your scope",
              body: "A deal becomes billable when its quotation is accepted and some of its value is "
                + "still uninvoiced." }}
        rows={(list || []).map((d) => {
          const acc = accepted[d.ref];
          const b = billed.byDeal[d.ref];
          const n = b ? b.n : 0;
          const total = installmentsOf(acc);
          const done = billed.byQuote[acc.id] || 0;
          const to = "#/invoices?new=1&deal=" + encodeURIComponent(d.ref);
          return (
            <tr key={d.ref}>
              <td>
                <b>{d.contactName}{d.businessName ? " · " + d.businessName : ""}</b>
                <div className="cell-2">{d.city || <span className="faint">—</span>}</div>
              </td>
              <td className="mono">{d.ref}</td>
              <td className="n tnum">{inr(d.valuePaise)}</td>
              <td className="n tnum">{inr((d.valuePaise || 0) - (b ? b.paise : 0))}</td>
              <td className="c">{total
                ? done + " of " + total + (done >= total ? " · done" : "")
                : <span className="faint">Full amount</span>}</td>
              <td className="c">{n || <span className="faint">—</span>}</td>
              <td className="c">
                <button className="btn sm pri rowact" data-go={to} onClick={() => go(to)}>Select</button>
              </td>
            </tr>
          );
        })}
      />
    </>
  );
}

/* ======================================================= step 1b · quotation */
function QuotationStep({ dealRef }: { dealRef: string }) {
  const { go } = useNav();
  const { toast } = useShell();
  const billed = useBilled();
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [quotes, setQuotes] = useState<QuotationRow[] | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call(AdminOpsService.deal(dealRef))
      .then((d) => setDeal(d.deal))
      .catch((e: unknown) => setErr(errMessage(e)));
    call(AdminOpsService.quotations({ deal: dealRef, pageSize: 50 }))
      .then((d) => {
        const list = d.quotations || [];
        setQuotes(list);
        const acc = list.find((x) => x.status === "accepted");
        if (acc) setChosen(acc.id);
      })
      .catch((e: unknown) => { setErr(errMessage(e)); setQuotes([]); });
  }, [dealRef]);

  const acc = useMemo(() => (quotes || []).find((x) => x.status === "accepted") || null, [quotes]);
  const b = billed.byDeal[dealRef];
  const remaining = Math.max(0, (deal && deal.valuePaise ? deal.valuePaise : 0) - (b ? b.paise : 0));

  const create = () => {
    if (!chosen) return;
    setErr(null); setBusy(true);
    call(AdminOpsService.createInvoice(dealRef, chosen))
      .then((row) => { toast("Invoice drafted."); go("#/invoices/" + row.id + "?mode=edit"); })
      .catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  const plan = acc ? planItemOf(acc) : null;
  const total = installmentsOf(acc);
  const done = acc ? billed.byQuote[acc.id] || 0 : 0;

  return (
    <>
      {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

      <div className="card"><div className="card-b">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div><b>{deal ? deal.contactName : "…"}</b> <span className="faint mono">{dealRef}</span></div>
          {/* The prototype's "Change deal" link -- a button here, because this
              theme has no standalone .lnk rule to hang an anchor on. */}
          <button className="btn sm" data-go="#/invoices?new=1"
            onClick={() => go("#/invoices?new=1")}>Change deal</button>
        </div>
      </div></div>
      <div style={{ height: "14px" }}></div>

      <SectionHead title="Quotation" desc="required — shown and confirmed, never assumed" />
      <div className="card"><div className="card-b">
        {quotes === null ? <div className="faint">Loading quotations…</div> : null}
        {quotes && !quotes.length ? <div className="faint">No quotations on this deal.</div> : null}
        {(quotes || []).map((q) => {
          const usable = q.status === "accepted";
          return (
            <label key={q.id} className="check" style={{
              alignItems: "flex-start",
              border: "1px solid " + (usable ? "var(--brand)" : "var(--line-2)"),
              borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px",
              opacity: usable ? undefined : 0.55,
            }}>
              <input type="radio" name="invQuote" value={q.id} disabled={!usable}
                checked={chosen === q.id} onChange={() => setChosen(q.id)} />
              <span style={{ flex: 1 }}>
                <b className="mono">{q.quotationNumber || "Draft"}</b> · v{q.version} · {inr(q.grandTotalPaise)}
                <span style={{ marginLeft: "6px" }}><Pill text={Q_LABEL[q.status]} tone={Q_TONE[q.status]} /></span>
                {usable ? null : <div className="help">{reasonFor(q.status)}</div>}
              </span>
            </label>
          );
        })}
      </div></div>

      {acc ? <>
        <SectionHead title="What the quotation brings in" desc="this is the cap the invoice must respect" />
        <div className="card"><div className="card-b">
          <KvList cls="wide" pairs={([
            ["Plan", plan ? <b>{plan.name}</b> : "—"],
            ["Total amount", <>
              {inr(plan ? lineNet(plan).net : 0)}{" "}
              <span className="faint">— already net of the {acc.discountPct || 0}% quotation discount,
                applied once</span>
            </>],
            total ? ["Installments", done + " of " + total + " already invoiced"] : null,
            [<b>Remaining</b>, <b>{inr(remaining)}</b>],
          ].filter(Boolean)) as [React.ReactNode, React.ReactNode][]} />
        </div></div>
      </> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
        <button className="btn" data-go="#/invoices" onClick={() => go("#/invoices")}>Cancel</button>
        <button className="btn pri" data-act="in-create" disabled={!chosen || busy} onClick={create}>
          {busy ? "Creating…" : "Continue"}
        </button>
      </div>
    </>
  );
}

/* Why a quotation on this deal cannot be billed — stated on the row itself,
   rather than leaving a disabled radio unexplained. */
function reasonFor(status: string): string {
  return status === "superseded" ? "Replaced by a newer version — only the accepted one can be billed."
    : status === "rejected" ? "The customer rejected this version."
      : status === "expired" ? "Validity ran out before it was accepted."
        : status === "draft" ? "Never issued to the customer."
          : status === "cancelled" ? "Abandoned as a draft."
            : "Not the accepted version.";
}
