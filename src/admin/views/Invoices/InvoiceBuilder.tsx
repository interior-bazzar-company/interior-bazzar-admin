/* =============================================================================
   STEP 2 — the builder
   ============================================================================= */
import type { CSSProperties, ReactNode } from "react";
import { Field, Icon, Notice, Pill, Table } from "../../ui";
import { IBData, IBDeals, IBInvoice, IBQuote } from "../../engines";
import { inr, quoteNumberOf, REMARK_PRESETS } from "./helpers";
import type { Actions } from "./useInvoices";

const D = IBData, N = IBInvoice, Q = IBQuote, E = IBDeals;

export function InvoiceBuilder({ inv, go, act }: { inv: any; go: (h: string) => void; act: Actions }) {
  const plan = N.planOf(inv.invoice_id), addons = N.addonsOf(inv.invoice_id);
  const t = N.price(inv, N.itemsOf(inv.invoice_id));
  const b = N.billedTo(inv);
  const blockers = N.Issuance.blockers(inv.invoice_id);
  /* The prototype also read `Q.installmentSchedule(inv.quotation_id)` and
     `N.installmentsBilled(…)` here and handed both to planBlock(), which never
     touched either — the schedule now reaches the screen through billingPlan()
     instead. Dead in the prototype, so dead here; `noUnusedLocals` would have
     rejected them anyway. */
  const bp = N.billingPlan(inv);
  const cap = N.outstandingFor(inv.deal_id, inv.invoice_id);
  const qn = quoteNumberOf(inv);
  const dl = E.dealOf(inv.deal_id);
  const seller = N.seller();

  return (
    <div className="page wide">
      <div className="ph"><div className="ph-t">
        <div className="faint" style={{ fontSize: "var(--text-sm)" }}>Step 2 of 2</div>
        <h1>New invoice</h1>
        <div className="scope"><Pill text="Draft" /> <span className="mono">Number assigned on issue</span></div>
      </div>
        <div className="acts">
          <button className="btn" data-go={"#/invoices/" + inv.invoice_id}
            onClick={() => go("#/invoices/" + inv.invoice_id)}><Icon name="chevl" />Back</button>
          <button className="btn pri" data-go={"#/invoices/" + inv.invoice_id + "?mode=preview"}
            onClick={() => go("#/invoices/" + inv.invoice_id + "?mode=preview")}>Preview &amp; issue</button>
          <MenuBtn r={inv.invoice_id} act={act} />
        </div>
      </div>

      {/* Source strip — the two links, the deal's own stage and the cap,
          always visible. Stage matters here specifically because a deal that
          closed after this draft was opened blocks issuing (I5) — the
          builder should never be the one place that fact is invisible. */}
      <div className="card" style={{ marginBottom: "14px" }}><div className="card-b"
        style={{ display: "flex", gap: "22px", flexWrap: "wrap", alignItems: "center" }}>
        <a className="lnk mono" data-go={"#/deals/" + inv.deal_id}
          onClick={() => go("#/deals/" + inv.deal_id)}>{inv.deal_id} ↗</a>
        {dl && D.STAGES[dl.stage] ? <Pill text={D.STAGES[dl.stage].label} tone={D.STAGES[dl.stage].tone} /> : null}
        {qn
          ? <a className="lnk mono" data-go={"#/quotations/" + qn} onClick={() => go("#/quotations/" + qn)}>{qn} ↗</a>
          : <span className="pill bad xs">quotation_required</span>}
        <span style={{ marginLeft: "auto" }} className="tnum"><b>{inr(cap)}</b>
          <span className="faint"> · {plan && plan.installment_count
            ? "installment " + plan.installment_seq + " of " + plan.installment_count
            : "remaining on the deal"}</span></span>
      </div></div>

      {/* Four numbered steps instead of seven flat sections — the same
          reshape the quotation builder went through, for the same reason: a
          heading per field group reads as seven equally-weighted things, when
          it is really four questions asked in order. */}
      <div className="qbld">
        <div>

          {/* ---- 1 · who, and when ---- */}
          <Step n={1} title="Who and when" hint="the invoice's own dates, and who it is billed to" />
          <div className="card"><div className="card-b">
            <div className="qparties">
              <div><span className="qparties-k">From</span>
                <b>{seller.name}</b><br />{seller.addr || ""}<br />
                <span className="mono">{seller.gstin ? "GSTIN " + seller.gstin : "CIN " + (seller.cin || "")}</span>
              </div>
              <div><span className="qparties-k">Bill to <span className="faint">· from the deal</span></span>
                <b>{b.name || "—"}</b><br />{b.address || "—"}<br />
                <span className="mono">{b.phone || "—"}</span>{" "}
                <a className="lnk" data-go={"#/deals/" + inv.deal_id}
                  onClick={() => go("#/deals/" + inv.deal_id)}>Edit on deal ↗</a></div>
            </div>
            <div className="f3" style={{ marginTop: "var(--space-4)" }}>
              <Field id="nDate" label="Invoice date" type="date" value={inv.invoice_date} />
              <Field id="nDue" label="Due date" type="date" value={inv.due_date}
                help={"Defaults to +" + N.DUE_DAYS + " days. Drives Overdue."} />
              <Field id="nPos" label="Place of supply" type="select"
                options={N.states().map(function (x: string) { return { v: x, l: x, sel: x === inv.place_of_supply }; })}
                help="Drives the CGST/SGST ↔ IGST split." />
            </div>
            <div className="help">The billing block is a <b>column, not a join</b>. It is copied now and frozen
              again at issue, so a later profile edit in Module 4 cannot reach a historical document.</div>
          </div></div>

          {/* ---- 2 · what you're billing ---- */}
          <Step n={2} title="What you're billing" hint="the quotation's schedule, the plan, and anything one-off" />
          <PricingPanel inv={inv} bp={bp} cap={cap} go={go} act={act} />
          <div className="card">
            <PlanBlock plan={plan} />
            <AddonBlock inv={inv} addons={addons} act={act} />
          </div>

          {/* ---- 3 · payment received ---- */}
          <Step n={3} title="Payment received" hint="required — an invoice is raised only after the client has paid" />
          <PaymentBlock inv={inv} act={act} />

          {/* ---- 4 · what it says ---- */}
          <Step n={4} title="What it says" hint="notes and terms, printed on the document" />
          <div className="card"><div className="card-b">
            <Field id="nNotes" label="Notes (customer-facing)" type="textarea" value={inv.notes} />
            <Field id="nTerms" label="Payment terms" type="textarea" value={inv.terms} rows={6} />
          </div></div>
        </div>

        <div className="qbld-rail">
          <SummaryCard inv={inv} t={t} plan={plan} addons={addons} blockers={blockers} cap={cap} act={act} />
        </div>
      </div>
    </div>
  );
}

/* A numbered step rather than a section heading — copied from the
   quotation builder's own step(), which solved the same "five equal
   headings read as five things, not a sequence" problem first. */
export function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="qstep"><span className="qstep-n">{n}</span>
      <div><b>{title}</b>{hint ? <span className="qstep-h">{hint}</span> : null}</div>
    </div>
  );
}

export function MenuBtn({ r, act }: { r: string; act: Actions }) {
  return (
    <button className="btn icon" data-act="in-more" data-ref={r} aria-haspopup="menu"
      aria-label="More actions" title="More actions"
      onClick={(e) => act.more(r, e.currentTarget)}><Icon name="dots" /></button>
  );
}

/* WHAT TO BILL, AND WHY — the whole of it, above the field you type into.

   This was a row of pills reading "#2 · ₹2.2L" with the due date hidden in a
   tooltip, sitting UNDER the Apply button. Everything a person needed in
   order to raise the invoice correctly — what was quoted, what has already
   been billed, which installment is next and what it comes to — was spread
   across a quotation in another tab and an invoice list in a third, and the
   only thing preventing a double-bill was them adding it up right.

   So it is a table, and it is first. Three figures at the top answer "how
   much is left", the rows answer "which one am I on", and the row that IS the
   one carries a button that fills the amount and the remark in a single
   press. Nothing here decides anything — the amount field below is still free
   text and the team can still raise any figure with any remark. It just stops
   making them do the arithmetic to find the ordinary one. */
function PricingPanel({ inv, bp, cap, go, act }: { inv: any; bp: any; cap: number; go: (h: string) => void; act: Actions }) {
  if (!bp) return null;
  const left = Math.max(0, bp.quoted_paise - bp.billed_paise);

  const fig = (k: string, v: string, cls?: string) => (
    <div className={"inp-fig" + (cls ? " " + cls : "")}>
      <span className="k">{k}</span><b className="tnum">{v}</b>
    </div>
  );

  return (
    <div className="card inp-price">
      <div className="card-h">
        <h3>From the accepted quotation</h3>
        {bp.quotation_number
          ? <a className="lnk mono" data-go={"#/quotations/" + bp.quotation_number}
              onClick={() => go("#/quotations/" + bp.quotation_number)}>{bp.quotation_number} ↗</a>
          : null}
      </div>
      <div className="card-b">
        <div className="inp-figs">
          {fig("Quoted total", inr(bp.quoted_paise))}
          {fig("Already invoiced", bp.billed_paise ? "−" + inr(bp.billed_paise) : "—")}
          {fig("Left to invoice", inr(left), left ? "ok" : "dead")}
        </div>

        <table className="tbl inp-sched">
          <thead><tr>
            <th style={{ width: "34px" }}>#</th><th>Due</th><th className="n">Amount</th>
            <th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {bp.rows.map(function (r: any) {
              return (
                <tr key={r.seq} className={r.current ? "on" : r.billed ? "dim" : ""}>
                  <td className="faint">{r.seq}</td>
                  <td>{D.fmtDate(r.due_date)}</td>
                  <td className="n tnum">{inr(r.billed ? r.billed_amount_paise : r.amount_paise)}</td>
                  <td>{r.billed
                    ? <>{<Pill text="Invoiced" tone="ok" />}
                        {r.billed_by ? <> <span className="mono cell-2">{r.billed_by}</span></> : null}</>
                    : r.current ? <Pill text="Raise this" tone="warn" />
                    : <span className="faint">Not yet</span>}</td>
                  <td className="c">{!r.billed
                    ? <button className={"btn sm" + (r.current ? " pri" : "")} data-act="in-use-amount"
                        data-ref={inv.invoice_id} data-amt={r.amount_paise} data-seq={r.seq} data-of={bp.count}
                        onClick={() => act.useAmount(r.amount_paise, String(r.seq), String(bp.count))}>
                        Use {inr(r.amount_paise, { compact: true })}</button>
                    : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* The cap is the deal's, not the schedule's — a deal whose value was
            edited after the quotation was accepted can allow less than the rows
            add up to, and the person needs to know that BEFORE they type. */}
        {cap < left
          ? <Notice tone="warn" ico="alert" text={<>
              <b>The deal allows {inr(cap)}.</b> That is less than the {inr(left)} these rows come
              to — the deal value changed after this quotation was accepted, and the cap is what
              the engine enforces.</>} />
          : null}
      </div>
    </div>
  );
}

/* No negotiated-adjustment line, no reconciliation against plan arithmetic —
   the team can raise this invoice for any amount, with a mandatory remark
   saying what it is (an installment, a registration amount, a balance
   payment…). The quotation's own schedule still supplies a starting figure
   (shown as "suggested" + the chips below), but it is only ever a default. */
function PlanBlock({ plan }: { plan: any }) {
  if (!plan) return <div className="card-b faint">No plan block.</div>;
  return (
    <div className="card-b">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>{plan.description}</div>
          <div className="faint" style={{ fontSize: "var(--text-md)" }}>From the accepted quotation · suggested: {
            plan.installment_count
              ? "installment " + plan.installment_seq + " of " + plan.installment_count
              : "the plan's full amount"}</div>
          {plan.remark
            ? <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "3px" }}>
                <Icon name="tag" size="sm" />{plan.remark}</div>
            : null}
        </div>
        <div className="tnum" style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{inr(plan.amount_paise)}</div>
      </div>
      {(plan.features || []).length
        ? <div style={{ marginTop: "12px" }}>
            <div className="lbl">What the plan includes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
              {plan.features.map((f: any, i: number) =>
                <span key={i} className="pill xs" title={f.text || ""}>{f.label}</span>)}
            </div>
            <div className="help">Snapshotted from the quotation, which read them from{" "}
              <span className="mono">IBPlanInfo</span>. Frozen at issue.</div>
          </div>
        : null}
      <div className="f3" style={{ marginTop: "14px" }}>
        <Field id="pAmt" label="Amount ₹" value={Math.round(plan.amount_paise / 100)} />
        <Field id="pRemark" label="Remark" type="select"
          options={REMARK_PRESETS.map(function (r) { return { v: r, l: r, sel: plan.remark === r }; })
            .concat([{ v: "other", l: "Other (type below)", sel: REMARK_PRESETS.indexOf(plan.remark) < 0 }])}
          help="One-click preset, or Other for anything else." />
        <Field id="pRemarkOther" label="Custom remark"
          value={REMARK_PRESETS.indexOf(plan.remark) < 0 ? (plan.remark || "") : ""}
          ph="e.g. Registration amount, balance payment…"
          help="Used only when Remark above is Other — mandatory in that case." />
      </div>
    </div>
  );
}

/* The invoice is raised only after the client has paid — this IS the payment
   the invoice raises. Issuing writes it to the deal ledger in one action, so
   both the reference and the evidence must exist before Issue is reachable. */
function PaymentBlock({ inv, act }: { inv: any; act: Actions }) {
  const proofs = N.proofsOf(inv.invoice_id);
  const hasProof = proofs.length > 0;
  return (
    <div className="card"><div className="card-b">
      <div className="f3">
        <Field id="nPayDate" label="Date received" type="date" value={inv.payment_date} />
        <Field id="nPayMode" label="Mode" type="select"
          options={["NEFT", "IMPS", "UPI", "RTGS", "Cheque"].map(function (m) {
            return { v: m, l: m, sel: m === inv.payment_mode }; })} />
        <Field id="nPayRef" label="Reference / UTR" req value={inv.payment_reference || ""}
          ph="NEFT0026JUN4471"
          help="Mandatory — without it the payment cannot be reconciled against the bank." />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
        <span style={{ fontSize: "var(--text-sm)" }}>
          {hasProof
            ? <b style={{ color: "var(--ok)" }}><Icon name="check" size="sm" />{proofs.length} proof
                {proofs.length === 1 ? "" : "s"} attached</b>
            : <b style={{ color: "var(--bad)" }}><Icon name="alert" size="sm" />
                No payment proof attached yet — required to issue</b>}
          {" "}<span className="faint">· internal record, never shown to the customer</span></span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn sm" data-act="in-proof" data-ref={inv.invoice_id}
            onClick={() => act.proof(inv.invoice_id)}><Icon name="plus" />Attach payment proof</button>
        </div>
      </div>
      {hasProof
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
            {proofs.map((pf: any) => (
              <span key={pf.proof_id} className="pill xs ok" title={pf.filename}>
                <Icon name="shield" size="sm" />{pf.filename}</span>))}
          </div>
        : null}
    </div></div>
  );
}

function AddonBlock({ inv, addons, act }: { inv: any; addons: any[]; act: Actions }) {
  if (!addons.length) {
    return (
      <div className="card-b" style={{ display: "flex", alignItems: "center", gap: "10px",
                                       borderTop: "1px solid var(--line)" }}>
        <button className="btn" data-act="in-addon-add" data-ref={inv.invoice_id}
          onClick={() => act.addonAdd(inv.invoice_id)}><Icon name="plus" />Add charge</button>
        <span className="faint" style={{ fontSize: "var(--text-md)" }}>Onboarding, a shoot, a custom
          integration. <b>No months and no quantity</b> — a one-off charge has an amount and
          nothing else.</span>
      </div>
    );
  }
  return (
    <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
      <Table
        cols={[{ label: "#", w: "36px" }, { label: "Description" }, { label: "HSN / SAC", w: "120px" },
               { label: "Amount ₹", cls: "n", w: "150px" }, { label: "", w: "44px" }]}
        rows={addons.map(function (it: any, ix: number) {
          return (
            <tr key={it.item_id}>
              <td className="faint">{ix + 1}</td>
              <td><input className="inp sm" id={"c-d-" + it.item_id} defaultValue={it.description} /></td>
              <td><input className="inp sm" id={"c-h-" + it.item_id} defaultValue={it.hsn || ""} /></td>
              <td className="n"><input className="inp sm n" id={"c-a-" + it.item_id}
                defaultValue={Math.round(it.amount_paise / 100)} /></td>
              <td className="c"><button className="btn sm icon dgr" data-act="in-addon-del"
                data-ref={inv.invoice_id} data-item={it.item_id}
                onClick={() => act.addonDel(inv.invoice_id, it.item_id)}><Icon name="x" /></button></td>
            </tr>
          );
        })} />
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <button className="btn" data-act="in-addon-add" data-ref={inv.invoice_id}
          onClick={() => act.addonAdd(inv.invoice_id)}><Icon name="plus" />Add charge</button>
      </div>
    </div>
  );
}

function SummaryCard({ inv, t, plan, addons, blockers, cap, act }: {
  inv: any; t: any; plan: any; addons: any[]; blockers: any[]; cap: number; act: Actions;
}) {
  let n = 0;
  const row = (k: ReactNode, v: ReactNode, extra?: CSSProperties) => (
    <div key={n++} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", ...extra }}>
      <span>{k}</span><span className="tnum">{v}</span>
    </div>
  );
  const taxed = N.taxApplicable(inv);
  const seller = N.seller();

  return (
    <div className="card">
      <div className="card-h"><h3>Summary</h3>
        <span className="d">display only — the server recomputes</span></div>
      <div className="card-b">
        {row("Plan" + (plan && plan.remark ? " · " + plan.remark
              : plan && plan.installment_count
                ? " · installment " + plan.installment_seq + " of " + plan.installment_count : ""),
            inr(t.plan))}
        {addons.length ? row("One-off charges", inr(t.addons)) : null}
        {row("Taxable value", inr(t.taxable), { borderTop: "1px solid var(--line)", marginTop: "4px" })}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
          <span>Tax</span>
          <div className="btn-group">
            <button className={taxed ? "on" : ""} data-act="in-tax-mode" data-ref={inv.invoice_id}
              data-v={N.TAX_MODE.APPLICABLE}
              onClick={() => act.taxMode(inv.invoice_id, N.TAX_MODE.APPLICABLE)}>Applicable</button>
            <button className={!taxed ? "on" : ""} data-act="in-tax-mode" data-ref={inv.invoice_id}
              data-v={N.TAX_MODE.NOT_APPLICABLE}
              onClick={() => act.taxMode(inv.invoice_id, N.TAX_MODE.NOT_APPLICABLE)}>Not applicable</button>
          </div>
        </div>
        {taxed
          ? <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                <span>GST rate</span>
                <select className="inp sm" id="nGst" style={{ width: "96px" }} defaultValue={String(inv.gst_rate)}>
                  {(Q ? Q.GST_RATES : [18]).map((r: number) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              {t.intra
                ? <>{row("CGST (" + (t.gst_rate / 2) + "%)", inr(t.cgst))}
                    {row("SGST (" + (t.gst_rate / 2) + "%)", inr(t.sgst))}</>
                : row("IGST (" + t.gst_rate + "%)", inr(t.igst))}
            </>
          : <div className="help">Tax not applicable — the grand total excludes GST entirely.</div>}
        {row(<b style={{ fontSize: "var(--text-lg)" }}>Grand total</b>,
             <b style={{ fontSize: "var(--text-lg)" }}>{inr(t.grand_total)}</b>,
             { borderTop: "2px solid var(--line-2)", marginTop: "6px", paddingTop: "9px" })}
        <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "4px" }}>
          {D.inrWords ? D.inrWords(t.grand_total) : ""}</div>
        {taxed
          ? <div className="help" style={{ marginTop: "10px" }}>{t.intra
              ? <><b>Intra-state.</b> Place of supply is {inv.place_of_supply}, the same state as
                  Interior bazzar — so GST splits into CGST + SGST.</>
              : <><b>Inter-state.</b> Place of supply is {inv.place_of_supply} and Interior bazzar is
                  in {seller.state} — so a single IGST applies.</>}</div>
          : null}
      </div>
      {/* THE save. One button for the whole page, in the one place that
          already shows what every field on it adds up to — the same move the
          quotation builder made first. There were four, in four sections, and
          nothing said which of them still had unwritten work. */}
      <div className="card-f qsave">
        <button className="btn pri" data-act="in-save-all" data-ref={inv.invoice_id}
          onClick={() => act.saveAll(inv.invoice_id)}><Icon name="check" />Save changes</button>
        <span className="qsave-h">Writes the dates, the plan, the charges and the payment together.</span>
      </div>
      <div className="card-f">
        {blockers.length
          ? <Notice tone="bad" text={<><b>Cannot be issued yet</b>
              <ul style={{ margin: "5px 0 0 16px" }}>
                {blockers.map((bl: any, i: number) =>
                  <li key={i}>{bl.text} <span className="mono">{bl.code}</span></li>)}
              </ul></>} />
          : <div style={{ color: "var(--ok)", marginBottom: "6px" }}>
              <Icon name="check" size="sm" /> Ready to issue</div>}
        <div className="faint" style={{ fontSize: "var(--text-sm)" }}>
          <b>{inr(cap)}</b> deal outstanding</div>
      </div>
    </div>
  );
}
