/* =============================================================================
   CREATE · STEP 1 — the deal picker
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { KvList, Pill, SearchField, Table, Toolbar } from "../../ui";
import { useNav } from "../../shell/AdminShell";
import { D, E, Q, actor, inr } from "./core";
import { useFilters, useQtActions } from "./useQuotations";

export default function PickDeal({ p }: { p: Record<string, string> }) {
  const me = actor();
  const act = useQtActions();
  const { go } = useNav();
  const { onSearch } = useFilters(p, "#/quotations");

  // A deal arrived in the URL — honour it rather than asking a question whose
  // answer is already on screen.
  const carried = p.deal ? E.dealOf(p.deal) : null;
  if (carried) return <ConfirmDeal dl={carried} />;

  let deals: any[] = E.Analytics.scopeOf(me).filter((d: any) => d.stage < E.STAGE.WON);
  if (p.q) {
    const s = p.q.toLowerCase();
    deals = deals.filter((d: any) =>
      (d.deal_id + " " + d.customer_name + " " + d.city).toLowerCase().indexOf(s) >= 0);
  }

  return (
    <div className="page">
      <div className="ph">
        <div className="ph-t">
          <div className="faint" style={{ fontSize: "var(--text-sm)" }}>Step 1 of 2</div>
          <h1>Which deal is this for?</h1>
          <div className="scope">A quotation cannot exist without a deal — closed deals are excluded,
            reopen the deal first.</div>
        </div>
        <div className="acts">
          <button className="btn" data-go="#/quotations" onClick={() => go("#/quotations")}>Cancel</button>
        </div>
      </div>

      <Toolbar><SearchField ph="Search customer, city or deal ref…" val={p.q} onFilter={onSearch} /></Toolbar>

      <Table
        cols={[{ label: "Customer" }, { label: "Deal" }, { label: "Stage" },
          { label: "Deal value", cls: "n" }, { label: "Quotations", cls: "c" }, { label: "", cls: "c" }]}
        empty={{
          icon: "deal", title: "No open deals in your scope",
          body: "Quotations start from a deal. There is nothing open to quote for."
        }}
        rows={deals.map((d: any) => {
          const n = Q.forDeal(d.deal_id).length;
          return (
            <tr key={d.deal_id}>
              <td><b>{d.customer_name}</b><div className="cell-2">{d.city}</div></td>
              <td className="mono">{d.deal_id}</td>
              <td><Pill text={D.STAGES[d.stage].label} tone={D.STAGES[d.stage].tone} /></td>
              <td className="n">{d.deal_value ? inr(d.deal_value) : <span className="faint">—</span>}</td>
              <td className="c">{n || <span className="faint">—</span>}</td>
              <td className="c">
                <button className="btn sm pri rowact" data-act="qt-create" data-deal={d.deal_id}
                  onClick={() => act.create(d.deal_id)}>Select</button>
              </td>
            </tr>
          );
        })}
      />
    </div>
  );
}

/* Door B carrying a deal: confirm the customer, then straight to the builder. */
function ConfirmDeal({ dl }: { dl: any }) {
  const act = useQtActions();
  const { go } = useNav();
  const n = Q.forDeal(dl.deal_id).length;
  return (
    <div className="page">
      <div className="ph">
        <div className="ph-t">
          <div className="faint" style={{ fontSize: "var(--text-sm)" }}>Step 1 of 2 · confirmed</div>
          <h1>Quote for {dl.customer_name}</h1>
          <div className="scope">
            <a className="lnk mono" data-go={"#/deals/" + dl.deal_id} onClick={() => go("#/deals/" + dl.deal_id)}>
              {dl.deal_id} ↗</a> · {dl.city}
          </div>
        </div>
        <div className="acts">
          <button className="btn" data-go="#/quotations?new=1" onClick={() => go("#/quotations?new=1")}>Change deal</button>
          <button className="btn pri" data-act="qt-from-deal" data-ref={dl.deal_id}
            onClick={() => act.fromDeal(dl.deal_id)}>Start the builder</button>
        </div>
      </div>
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Customer", <b>{dl.customer_name}</b>],
          ["City", dl.city],
          ["Phone", <span className="mono">{dl.phone}</span>],
          ["Stage", <Pill text={D.STAGES[dl.stage].label} tone={D.STAGES[dl.stage].tone} />],
          ["Existing quotations", n ? n + " version(s)" : "none yet"]
        ]} />
        <div className="help">Nothing here is retyped into the quotation — it is snapshotted from
          the deal and frozen again at issue.</div>
      </div></div>
    </div>
  );
}
