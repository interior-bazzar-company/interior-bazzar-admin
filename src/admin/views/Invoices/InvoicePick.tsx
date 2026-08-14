/* =============================================================================
   CREATE · STEP 1 — deal AND quotation, both required
   ============================================================================= */
import type { ReactNode } from "react";
import { KvList, Pill, SearchField, SectionHead, Table, Toolbar } from "../../ui";
import { IBDeals, IBInvoice, IBQuote } from "../../engines";
import { actor, inr } from "./helpers";
import type { Params } from "./useInvoices";

const N = IBInvoice, Q = IBQuote, E = IBDeals;

export function InvoicePick({ p, setFilter, go, onCreate }: {
  p: Params;
  setFilter: (name: string, value: string) => void;
  go: (hash: string) => void;
  onCreate: (dealId: string) => void;
}) {
  const me = actor();
  let deals = E.Analytics.scopeOf(me).filter(function (d: any) {
    return d.stage < E.STAGE.WON && Q && Q.acceptedOf(d.deal_id) && N.outstandingFor(d.deal_id) > 0; });
  if (p.q) {
    const s = p.q.toLowerCase();
    deals = deals.filter(function (d: any) {
      return (d.deal_id + " " + d.customer_name + " " + d.city).toLowerCase().indexOf(s) >= 0; });
  }
  const chosen = p.deal ? E.dealOf(p.deal) : null;

  return (
    <div className="page">
      <div className="ph"><div className="ph-t">
        <div className="faint" style={{ fontSize: "var(--text-sm)" }}>Step 1 of 2</div>
        <h1>{chosen ? "Which quotation is this billed against?" : "Which deal is this for?"}</h1>
        <div className="scope">Both the deal and the quotation are required. Neither is assumed
          {chosen ? "" : " — only deals with an accepted quotation appear below"}.</div>
      </div><div className="acts">
        <button className="btn" data-go="#/invoices" onClick={() => go("#/invoices")}>Cancel</button>
      </div></div>

      {chosen
        ? <QuotationStep dl={chosen} go={go} onCreate={onCreate} />
        : <>
            <div style={{ height: "14px" }}></div>
            <Toolbar><SearchField ph="Search customer, city or deal ref…" val={p.q} onFilter={setFilter} /></Toolbar>
            <Table
              cols={[{ label: "Customer" }, { label: "Deal" }, { label: "Deal value", cls: "n" },
                     { label: "Outstanding", cls: "n" }, { label: "Installments", cls: "c" },
                     { label: "Invoices", cls: "c" }, { label: "", cls: "c" }]}
              empty={{ icon: "deal", title: "No billable deals in your scope",
                body: "A deal becomes billable when its quotation is accepted and some of its value is still uninvoiced." }}
              rows={deals.map(function (d: any) {
                const n = N.liveOf(d.deal_id).length;
                const to = "#/invoices?new=1&deal=" + d.deal_id;
                return (
                  <tr key={d.deal_id}>
                    <td><b>{d.customer_name}</b><div className="cell-2">{d.city}</div></td>
                    <td className="mono">{d.deal_id}</td>
                    <td className="n">{inr(d.deal_value)}</td>
                    <td className="n">{inr(N.outstandingFor(d.deal_id))}</td>
                    <td className="c"><InstallmentsCell dealId={d.deal_id} /></td>
                    <td className="c">{n || <span className="faint">—</span>}</td>
                    <td className="c"><button className="btn sm pri rowact" data-go={to}
                      onClick={() => go(to)}>Select</button></td>
                  </tr>
                );
              })} />
          </>}
    </div>
  );
}

/* "2 of 3 invoiced" for an installment plan, "Full amount" for a lump-sum
   one, "—" when the deal has no accepted quotation yet. */
function InstallmentsCell({ dealId }: { dealId: string }) {
  const acc = Q ? Q.acceptedOf(dealId) : null;
  const plan = acc ? Q.planOf(acc.quotation_id) : null;
  if (!plan) return <>—</>;
  const schedule = Q.installmentSchedule ? Q.installmentSchedule(acc.quotation_id) : null;
  if (!schedule) return <span className="faint">Full amount</span>;
  const billed = N.installmentsBilled(acc.quotation_id);
  return <>{billed} of {schedule.length}{billed >= schedule.length ? " · done" : ""}</>;
}

function QuotationStep({ dl, go, onCreate }: { dl: any; go: (h: string) => void; onCreate: (dealId: string) => void }) {
  const qs = Q ? Q.forDeal(dl.deal_id) : [];
  const acc = Q ? Q.acceptedOf(dl.deal_id) : null;
  const plan = acc ? Q.planOf(acc.quotation_id) : null;
  const schedule = acc && Q.installmentSchedule ? Q.installmentSchedule(acc.quotation_id) : null;
  const billed = acc ? N.installmentsBilled(acc.quotation_id) : 0;

  const pairs: [ReactNode, ReactNode][] = [
    ["Plan", plan ? <b>{plan.name}</b> : "—"],
    ["Total amount", <>{inr(plan ? Q.lineNet(plan).net : 0)}{" "}
      <span className="faint">— already net of the {(acc && acc.discount_pct) || 0}% quotation discount, applied once</span></>]
  ];
  if (schedule) pairs.push(["Installments", billed + " of " + schedule.length + " already invoiced"]);
  pairs.push([<b>Remaining</b>, <b>{inr(N.outstandingFor(dl.deal_id))}</b>]);

  return (
    <>
      <div className="card"><div className="card-b">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div><b>{dl.customer_name}</b> <span className="faint mono">{dl.deal_id}</span></div>
          <a className="lnk" data-go="#/invoices?new=1" onClick={() => go("#/invoices?new=1")}>Change deal</a>
        </div>
      </div></div>
      <div style={{ height: "14px" }}></div>

      <SectionHead title="Quotation" desc="required — shown and confirmed, never assumed" />
      <div className="card"><div className="card-b">
        {qs.map(function (q: any) {
          const usable = q.status === "accepted";
          return (
            <label key={q.quotation_id} className="check" style={{
              alignItems: "flex-start",
              border: "1px solid " + (usable ? "var(--brand)" : "var(--line-2)"),
              borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px",
              ...(usable ? {} : { opacity: .55 })
            }}>
              <input type="radio" name="invQuote" value={q.quotation_id}
                defaultChecked={usable} disabled={!usable} />
              <span style={{ flex: 1 }}>
                <b className="mono">{q.quotation_number || "Draft"}</b> · v{q.version} · {inr(q.grand_total_paise)}
                <span style={{ marginLeft: "6px" }}><Pill text={Q.LABEL[q.status]} tone={Q.TONE[q.status]} /></span>
                {usable ? null : <div className="help">{reasonFor(q)}</div>}
              </span>
            </label>
          );
        })}
        {qs.length ? null : <div className="faint">No quotations on this deal.</div>}
      </div></div>

      {acc ? <>
        <SectionHead title="What the quotation brings in" desc="this is the cap the invoice must respect" />
        <div className="card"><div className="card-b"><KvList pairs={pairs} cls="wide" /></div></div>
      </> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
        <button className="btn" data-go="#/invoices" onClick={() => go("#/invoices")}>Cancel</button>
        <button className="btn pri" data-act="in-create" data-deal={dl.deal_id}
          onClick={() => onCreate(dl.deal_id)}>Continue</button>
      </div>
    </>
  );
}

function reasonFor(q: any) {
  return q.status === "superseded" ? "Replaced by a newer version — only the accepted one can be billed."
    : q.status === "rejected" ? "The customer rejected this version."
    : q.status === "expired" ? "Validity ran out before it was accepted."
    : q.status === "draft" ? "Never issued to the customer."
    : q.status === "cancelled" ? "Abandoned as a draft."
    : "Not the accepted version.";
}
