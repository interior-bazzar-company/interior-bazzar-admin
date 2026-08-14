/* =============================================================================
   Deals — THE DRAWER. Table and Pipeline open a deal here; Chat replaces it
   with its own three-pane workspace.
   ============================================================================= */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChainStrip, Icon, KvList, Notice, Pill, SectionHead, Table, cap
} from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import { IBQuote } from "../../engines";
import {
  D, E, STAGE, actor, head, inr, listHash, place, prioTone, useEngineTick, usePop, val
} from "./useDeals";
import type { Params } from "./useDeals";
import { Fig, Rich, orDash } from "./bits";
import { useActs } from "./Modals";
import { PrioMenu } from "./menus";

export function DealDrawer({ dealRef, p }: { dealRef: string; p: Params }) {
  useEngineTick();
  const shell = useShell();
  const acts = useActs(p);
  const pop = usePop();
  const [tab, setTab] = useState("timeline");

  const dl = E.dealOf(dealRef);
  const missing = !dl;
  const out = !!(dl && !E.inScope(actor(), dl));
  useEffect(() => {
    if (missing) {
      shell.toast("Deal " + dealRef + " not found — 404 deal_not_found.", "bad");
      shell.closeLayer(); go("#/deals"); return;
    }
    if (out) {
      shell.toast("403 out_of_scope — that deal is not yours.", "bad");
      shell.closeLayer(); go("#/deals");
    }
  }, [missing, out, dealRef, shell]);
  if (!dl || out) return null;

  const c = E.Chain.state(dealRef);
  const pct = dl.deal_value ? Math.round(dl.revenue_collected / dl.deal_value * 100) : 0;
  const over = dl.next_action && D.days(D.d(dl.next_action.date)) < 0 && dl.stage < STAGE.WON;
  const back = listHash(p);

  const tabBtn = (k: string, label: string, n?: number) => (
    <button className={tab === k ? "on" : ""} data-tab={k} onClick={() => setTab(k)}>
      {label}{n ? <span className="n">{n}</span> : null}
    </button>
  );

  return (
    <>
      <div className="dw-h">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{dl.customer_name}</h2>
              {dl.business_name ? <span className="faint">{dl.business_name}</span> : null}
              <Pill text={D.STAGES[dl.stage].label} tone={D.STAGES[dl.stage].tone} />
              {/* PRIORITY, EDITABLE, IN THE TOP SECTION — the same control Chat
                  has, not a second implementation of it: same menu, same
                  Lifecycle.setPriority, same three values, same tones. It was a
                  read-only pill here, and only here, which meant a deal opened
                  from Table could be read as Urgent and never made Urgent.
                  Worse, the pill vanished entirely at Normal, so the one deal
                  you most wanted to raise showed no priority control at all. */}
              <button className={"dws-priobtn " + prioTone(dl.priority)} data-act="dl-priomenu"
                data-ref={dl.deal_id} aria-haspopup="menu"
                title="Priority · visual triage only, it never changes who the deal goes to"
                onClick={(e) => pop(e, <PrioMenu dl={dl} onPick={(v) => acts.priority(dl.deal_id, v)} />,
                  { width: 250, cls: "pop-views" })}>
                <span className={"dws-odot " + prioTone(dl.priority)}></span>
                {D.PRIORITY[dl.priority]}<Icon name="chev" size="sm" />
              </button>
              {dl.is_stalled ? <Pill text="Stalled" tone="warn" /> : null}
            </div>
            <div className="mono" style={{ fontSize: "var(--text-md)", color: "var(--text-2)", marginTop: "5px" }}>
              {dl.deal_id} · {dl.phone}{dl.email ? " · " + dl.email : ""} · {place(dl)} · {dl.enquiry_id}
              {dl.duplicate_count ? " · " + dl.duplicate_count + " repeat submission(s)" : ""}
            </div>
          </div>
          <span className="spacer"></span>
          <button className="btn icon sm" data-go={back} aria-label="Close"
            onClick={() => { shell.closeLayer(); go(back); }}><Icon name="x" /></button>
        </div>
      </div>

      <div className="dw-b">
        {/* money — the fastest read of "how close is this to Won" */}
        <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginBottom: "12px" }}>
          <Fig k="Deal value" v={dl.deal_value ? inr(dl.deal_value) : "—"} />
          <Fig k="Collected" v={inr(dl.revenue_collected)} style={{ color: "var(--ok)" }} />
          <Fig k="Outstanding" v={inr(dl.outstanding)}
            style={{ color: dl.outstanding ? "var(--warn)" : "var(--ok)" }} />
        </div>
        <div className="bar"><i className="ok" style={{ width: pct + "%" }}></i></div>
        <div className="faint" style={{ fontSize: "var(--text-md)", marginTop: "6px" }}>
          {pct}% collected · Closed-Won unlocks at ₹0 outstanding
        </div>

        <SectionHead title="Document chain" />
        <ChainStrip dealRef={dealRef} here="deal" />
        {c.uninvoiced > 0 && dl.quotation_status === "final"
          ? <div className="faint" style={{ fontSize: "var(--text-md)", marginTop: "8px" }}>
              {inr(c.uninvoiced)} of the deal is still uninvoiced.</div>
          : null}
        <AllInvoiceLinks dealRef={dealRef} />

        {dl.next_action
          ? <div className={"notice " + (over ? "bad" : "")} style={{ marginTop: "16px" }}>
              <Icon name={over ? "alert" : "clock"} />
              <div><b>Next action {D.relative(dl.next_action.date)}{over ? " — overdue" : ""}</b>
                <div style={{ marginTop: "2px" }}>{dl.next_action.note}</div></div>
              <span className="spacer"></span>
              <button className="btn sm" data-act="dl-clear-next" data-ref={dealRef}
                title="Clear it — a fresh remark with a date sets a new one"
                onClick={() => acts.clearNext(dealRef)}>Clear</button>
            </div>
          : null}

        <SectionHead title="Deal facts" />
        <KvList cls="wide" pairs={([
          ["Owner", <>{dl.owner_id || "—"}{dl.co_owner_id
            ? <> <span className="faint">+ {dl.co_owner_id} ({dl.split_ratio || ""})</span></> : null}</>],
          ["Business", orDash(dl.business_name)],
          ["Email", dl.email ? <a href={"mailto:" + dl.email}>{dl.email}</a> : <span className="faint">—</span>],
          ["Location", place(dl)],
          ["Interested in", dl.interested_in],
          ["Enquiry", <span className="mono">{dl.enquiry_id}</span>],
          ["Created", D.fmtDate(dl.created_at)],
          ["Stage age", Math.abs(D.days(D.d(dl.stage_since))) + " days"],
          dl.expected_close_date ? ["Expected close", D.fmtDate(dl.expected_close_date)] : null,
          dl.discount_pct === null || dl.discount_pct === undefined ? null
            : ["Discount", <>{dl.discount_pct}%{dl.is_target2_eligible ? null
                : <> <Pill text="Target 2 ineligible" tone="bad" /></>}</>],
          /* Priority is not a fact row any more. It is a control, eighteen
             lines up, and a read-only copy of a value you can edit above is a
             second place for it to look wrong. */
          ["Last remark", <>{D.fmtDate(dl.last_remark_at)}
            {dl.is_stalled ? <> <Pill text="stalled" tone="warn" /></> : null}</>],
          dl.close_reason ? ["Close reason", dl.close_reason] : null
        ].filter(Boolean)) as [ReactNode, ReactNode][]} />

        {dl.stage === STAGE.WON
          ? <Notice tone="warn" ico="alert" text={<>
              <b>AD-01 — this deal emitted <span className="mono">deal.won</span> and nothing consumed it.</b> No
              module creates the subscription or activates the profile. The customer has paid in full and still has
              no route to receive enquiries. This is the highest-priority gap in the suite, and the engine records
              it rather than pretending otherwise.</>} />
          : null}

        <div className="tabs" style={{ marginTop: "22px" }}>
          {tabBtn("timeline", "Timeline")}
          {tabBtn("payments", "Payments", E.paymentsFor(dealRef).length)}
          {tabBtn("documents", "Documents", E.quotesFor(dealRef).length + E.invoicesFor(dealRef).length)}
        </div>
        <div data-tabbody="timeline" className={tab === "timeline" ? undefined : "hide"}>
          <TimelineTab dl={dl} p={p} /></div>
        <div data-tabbody="payments" className={tab === "payments" ? undefined : "hide"}>
          <PaymentsTab dl={dl} p={p} /></div>
        <div data-tabbody="documents" className={tab === "documents" ? undefined : "hide"}>
          <DocumentsTab dl={dl} c={c} /></div>
      </div>

      <div className="dw-f"><ActionBar dl={dl} c={c} p={p} /></div>
    </>
  );
}

/* Exactly one new action appears per chain step, and unavailable actions are
   ABSENT rather than greyed out. `Raise invoice` does not exist until the quote
   is accepted; `Log payment` does not exist until an invoice is raised — and it
   disappears again once that invoice is settled, because the balance needs its
   own invoice. */
function ActionBar({ dl, c, p }: { dl: any; c: any; p: Params }) {
  const acts = useActs(p);
  const ref = dl.deal_id;
  const out: ReactNode[] = [];
  const btn = (key: string, act: string, label: string, onClick: () => void, cls?: string, ico?: string) => (
    <button key={key} className={"btn " + (cls || "")} data-act={act} data-ref={ref} onClick={onClick}>
      {ico ? <Icon name={ico} /> : null}{label}
    </button>
  );

  out.push(btn("remark", "dl-remark", "Add remark", () => acts.remark(ref)));
  if (E.Lifecycle.legalTargets(ref).length)
    out.push(btn("stage", "dl-stage", "Change stage", () => acts.stage(ref)));

  // Door A of QUOTATION_IA §2 — the primary path into Module 2. The builder,
  // the revision and Mark accepted all live over there; this is a link, not a
  // second implementation of them.
  if (c.quoteStatus === "none" && c.canCreateQuote) {
    out.push(btn("quote", "qt-from-deal", "Create quote", () => acts.createQuote(ref), "pri", "plus"));
  } else if (c.quoteStatus === "issued") {
    const to = "#/quotations/" + (c.quote ? (c.quote.quotation_number || c.quote.quotation_id) : "");
    out.push(<button key="openq" className="btn pri" data-go={to} onClick={() => go(to)}>Open quotation ↗</button>);
  } else if (c.canRaiseInvoice) {
    const to = "#/invoices?new=1&deal=" + ref;
    out.push(<button key="raise" className="btn pri" data-go={to} onClick={() => go(to)}>
      <Icon name="plus" />Raise invoice · {inr(c.uninvoiced)}</button>);
  } else if (c.canLogPayment) {
    out.push(btn("pay", "dl-pay", "Log payment", () => acts.pay(ref), "pri"));
  }
  if (!dl.deal_value && c.quoteStatus !== "accepted")
    out.push(btn("value", "dl-value", "Set deal value", () => acts.value(ref)));

  // Was reachable only from Chat's context panel — a user working exclusively
  // in Table/Pipeline had no way to correct a name/phone/email without
  // switching the whole module into Chat view first.
  out.push(btn("edit", "dl-edit", "Edit deal", () => acts.edit(ref)));
  out.push(btn("tags", "dl-tag", "Lists", () => acts.tags(ref)));
  out.push(btn("co", "dl-coassign", "Co-assign", () => acts.coassign(ref)));
  if (head()) out.push(btn("re", "dl-reassign", "Reassign", () => acts.reassign(ref)));
  out.push(<span key="sp" className="spacer"></span>);
  out.push(btn("close", "dl-close", "Close deal", () => acts.closeDeal(ref), "dgr"));
  return <>{out}</>;
}

function TimelineTab({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const ev = E.Activity.timeline(dl.deal_id);
  const add = () => {
    const text = val("dlQuickRemark");
    if (!text) return;
    acts.quick(dl.deal_id);
    const el = document.getElementById("dlQuickRemark") as HTMLInputElement | null;
    if (el) el.value = "";
  };
  return (
    <>
      <div className="card" style={{ marginBottom: "14px" }}>
        <div className="card-b tight" style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input className="inp" id="dlQuickRemark" placeholder="Log a call, a message, a site visit…"
              style={{ flex: 1 }} />
            <button className="btn pri" data-act="dl-quick" data-ref={dl.deal_id} onClick={add}>Add</button>
          </div>
          <div className="help">Three clicks and one text field — the most repeated action in the module.
            Adding a remark also clears the stalled flag
            {dl.stage === STAGE.DEAL ? " and moves this deal to Followup" : ""}.</div>
        </div>
      </div>
      <div className="tl">
        {ev.map((e: any, i: number) => (
          <div className={"ti " + (e.tone || "")} key={i}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span className="pill xs">{e.kind}</span>
              <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>{D.fmtDate(e.at)}</span>
            </div>
            <div style={{ fontSize: "var(--text-base)", lineHeight: 1.45, marginTop: "5px" }}>
              {e.kind === "REMARK" || e.kind === "SYSTEM" ? e.text : <Rich text={e.text} />}
            </div>
            <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "2px" }}>{e.by}</div>
          </div>
        ))}
      </div>
      <Notice ico="lock" text={<>Nothing in this timeline is editable or deletable. <b>There is no PUT and no DELETE endpoint</b> for a remark or a payment — immutability is enforced by the absence of the API, not by a permission check.</>} />
    </>
  );
}

function PaymentsTab({ dl, p }: { dl: any; p: Params }) {
  const acts = useActs(p);
  const rows = E.paymentsFor(dl.deal_id);
  return (
    <>
      <Table
        cols={[{ label: "Payment" }, { label: "Amount", cls: "n" }, { label: "Mode · reference" },
          { label: "Invoice" }, { label: "Attribution" }, { label: "", cls: "c" }]}
        empty={{ icon: "cash", title: "No payment yet",
          body: "Money is received against an invoice. Raise one from the chain above — there is no advance, no token and no unallocated payment." }}
        rows={rows.map((pay: any) => {
          const rev = pay.type === "reversal";
          return (
            <tr key={pay.payment_id} className={rev || pay.voided ? "dim" : undefined}>
              <td className="mono cell-1">{pay.payment_id}
                {pay.reverses_payment_id ? <div className="cell-2">reverses {pay.reverses_payment_id}</div> : null}</td>
              <td className="n" style={rev ? { color: "var(--bad)" } : undefined}>
                <b>{rev ? "−" : ""}{inr(Math.abs(pay.amount_paise))}</b></td>
              <td>{pay.mode}<div className="cell-2 mono">{pay.reference}</div></td>
              <td className="mono" style={{ fontSize: "var(--text-sm)" }}>{pay.invoice_id || "—"}</td>
              <td>{pay.owner_id || "—"}
                {pay.co_owner_id ? <div className="cell-2">+ {pay.co_owner_id} · {pay.split_ratio || ""}</div> : null}</td>
              <td className="c">
                {!rev && !pay.voided && head()
                  ? <button className="btn sm dgr rowact" data-act="dl-reverse" data-pay={pay.payment_id}
                      onClick={() => acts.reverse(pay.payment_id)}>Reverse</button>
                  : rev ? <span className="pill bad xs">reversal</span>
                  : pay.voided ? <span className="pill dead xs">reversed</span> : null}
              </td>
            </tr>
          );
        })} />
      <Notice ico="shield" text={<><b>Every ledger row carries an invoice and an attribution snapshot.</b> Owner, co-owner and split are copied onto the row at write time — a later reassignment never re-attributes money already collected. A correction is a <b>reversal</b>: a negative entry referencing the original, which is never amended or deleted.</>} />
    </>
  );
}

/* Every invoice this deal has ever raised, as a clickable chip — including
   cancelled ones, so "all" means all, not just the ones still live. This sits
   right under the chain strip (which only ever shows the current one + a
   "+N more" count) so the deal detail view surfaces every invoice link without
   a tab click. */
function AllInvoiceLinks({ dealRef }: { dealRef: string }) {
  const invs = E.invoicesFor(dealRef);
  if (!invs.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
      {invs.map((i: any) => {
        // .pill.line and a tone class (.ok/.warn/.dead) collide at equal CSS
        // specificity — line would silently win and swallow the tone. Skip it
        // and use the plain toned pill, same as every status pill elsewhere.
        const tone = i.status === "paid" ? "ok" : i.status === "cancelled" ? "dead"
          : i.status === "draft" ? "" : "warn";
        const to = "#/invoices/" + (i.number || i.invoice_id);
        return (
          <a key={i.invoice_id} className={"pill" + (tone ? " " + tone : "")} data-go={to} onClick={() => go(to)}>
            <Icon name="invoice" size="sm" />
            <span className="mono">{i.number || "Draft"}</span>
            <span className="faint" style={{ marginLeft: "5px" }}>{inr(i.amount_paise, { compact: true })}</span>
          </a>
        );
      })}
    </div>
  );
}

function DocumentsTab({ dl, c }: { dl: any; c: any }) {
  const Q = IBQuote || { LABEL: {}, TONE: {} };
  const quotes = E.quotesFor(dl.deal_id).sort((a: any, b: any) => b.version - a.version);
  const invs = E.invoicesFor(dl.deal_id);
  return (
    <>
      <SectionHead title="Quotations" desc={quotes.length + " version(s)"} />
      {quotes.length
        ? <div className="card">
            {quotes.map((q: any) => {
              const to = "#/quotations/" + (q.quotation_number || q.quotation_id);
              return (
                <div className="q" key={q.quotation_id}>
                  <span className="qi"><Icon name="quote" /></span>
                  <span className="qt">
                    <a className="lnk mono" data-go={to} onClick={() => go(to)}>
                      <b>{(q.quotation_number || "Draft") + " · v" + q.version}</b></a>
                    <span>{inr(q.grand_total_paise)}{q.discount_pct ? " · " + q.discount_pct + "% off" : ""}
                      {" · valid to " + D.fmtDate(q.valid_until)}</span>
                  </span>
                  <span><Pill text={Q.LABEL[q.status] || cap(q.status)} tone={Q.TONE[q.status]} /></span>
                </div>
              );
            })}
          </div>
        : <div className="card"><div className="card-b faint" style={{ fontSize: "var(--text-md)" }}>
            No quotation on this deal.</div></div>}

      <SectionHead title="Invoices" desc={invs.length + " raised · " + inr(c.uninvoiced) + " uninvoiced"} />
      {invs.length
        ? <div className="card">
            {invs.map((i: any) => {
              const to = "#/invoices/" + (i.number || i.invoice_id);
              return (
                <div className="q" key={i.invoice_id}>
                  <span className="qi"><Icon name="invoice" /></span>
                  <span className="qt">
                    <a className="lnk mono" data-go={to} onClick={() => go(to)}><b>{i.number || "Draft"}</b></a>
                    <span>{inr(i.amount_paise)} · received {inr(i.received_paise)} · due {D.fmtDate(i.due)}
                      {i.cancelled_reason ? " · " + i.cancelled_reason : ""}</span>
                  </span>
                  <span><Pill text={cap(i.status)}
                    tone={i.status === "paid" ? "ok" : i.status === "cancelled" ? "dead" : "warn"} /></span>
                </div>
              );
            })}
          </div>
        : <div className="card"><div className="card-b faint" style={{ fontSize: "var(--text-md)" }}>
            Invoices become possible once a quotation is Accepted.{" "}
            <b>Billing against a number the customer has not accepted is the error that gate prevents.</b>
          </div></div>}

      <Notice ico="link" text={<><b>Deals stores four scalars only</b> — <span className="mono">quotation_id · quotation_status · invoice_id · invoice_status</span>. Line items, tax and the rendered PDF stay inside Modules 2 and 3. That is what keeps the modules decoupled.</>} />
    </>
  );
}
