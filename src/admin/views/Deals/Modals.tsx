/* =============================================================================
   Deals — MODALS. Each states the rule before you commit.
   -----------------------------------------------------------------------------
   Every guard dialog in views-deals.js, one component each, plus useActs() —
   the React form of the prototype's `M` action table. One hook, so every call
   site (table, board, chat, drawer, popover menus) reaches the same handler
   rather than growing a second copy that can drift.
   ============================================================================= */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Field, Icon, KvList, Notice, EmptyState } from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { IBInvoice, IBQuote } from "../../engines";
import {
  D, E, STAGE, actor, head, inr, isoToday, rupeeStr, rupees, useDone,
  useRefuse, val, render
} from "./useDeals";
import type { Params, Refusal } from "./useDeals";
import { ErrSlot, Fig } from "./bits";
import { TagsModal } from "./Tags";

const N = IBInvoice;

/* A modal's own close button. The shell owns the layer; every dialog closes
   the same way. */
function MdX({ onClose }: { onClose: () => void }) {
  return <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>;
}

/* ==========================================================================
   THE ACTION TABLE
   ====================================================================== */
export function useActs(p: Params) {
  const shell = useShell();
  const done = useDone(p);
  const refuse = useRefuse();

  const modal = (node: ReactNode, size?: string) => shell.modal(node, size);
  const close = () => shell.closeLayer();

  /* Edit and the funnel response open each other, so both are named before the
     table is built rather than reached through `this` — a destructured handler
     must keep working. */
  const edit = (ref: string) => {
    const dl = E.dealOf(ref); if (!dl) return;
    if (!E.inScope(actor(), dl)) { shell.toast("403 out_of_scope — that deal is not yours.", "bad"); return; }
    modal(<EditModal dealRef={ref} onClose={close} onEdited={() => {
      close(); shell.toast("Deal " + ref + " updated."); render();
    }} openResponse={() => response(ref)} />, "wide");
  };
  const response = (ref: string) => {
    const dl = E.dealOf(ref); if (!dl) return;
    modal(<ResponseModal dealRef={ref} onClose={close} onEdit={() => edit(ref)} />, "wide");
  };
  const stageRemark = (ref: string, to: number) => {
    const dl = E.dealOf(ref); if (!dl) return;
    if (to === dl.stage) return;                // not a change; nothing to explain
    modal(<StageRemarkModal dealRef={ref} to={to} from={dl.stage} onClose={close} done={done} />);
  };
  const closeDeal = (ref: string) => {
    const dl = E.dealOf(ref); if (!dl) return;
    modal(<CloseModal dealRef={ref} onClose={close} done={done} />);
  };

  return {
    /* ------------------------------------------------------ create/edit */
    create() {
      if (!can("deals", "create"))
        return shell.toast("403 forbidden — you do not have deal-creation access.", "bad");
      modal(<CreateModal onClose={close} done={done} />);
    },
    edit,
    response,

    /* ---------------------------------------------------------- remarks */
    remark(ref: string) { modal(<RemarkModal dealRef={ref} onClose={close} done={done} />); },
    /* Three clicks and one text field — the most repeated action in the
       module. Adding a remark also clears the stalled flag. */
    quick(ref: string) {
      const r = E.Activity.remark(ref, val("dlQuickRemark"), null, actor());
      if (r.ok === false) return refuse(r);
      shell.toast("Remark added. Stalled flag cleared.");
      render();
    },
    send(ref: string, text: string, chan: string) {
      const r = E.Activity.remark(ref, text, null, actor(), chan);
      if (r.ok === false) { refuse(r); return false; }
      render();
      return true;
    },

    /* ----------------------------------------------------------- stages */
    stage(ref: string) {
      modal(<StageModal dealRef={ref} onClose={close}
        onPick={(to: number) => {
          // Won and Lost stay pickable here — every stage is still a legal
          // target from every other — but committing either from this generic
          // list would skip the money context and reason field Close deal
          // exists to show. Land on the one guarded flow, not two.
          close();
          if (to === STAGE.LOST || to === STAGE.WON) closeDeal(ref);
          else stageRemark(ref, to);
        }} />);
    },
    /* THE STAGE-CHANGE REMARK — mandatory, every time, on every path. The
       stage is not written until a remark is. Same dialog from the Chat
       quick-pick and from the drawer's Change stage, because a rule that
       holds on one of two paths is not a rule. */
    stageRemark,
    priority(ref: string, to: number) {
      const r = E.Lifecycle.setPriority(ref, to, actor());
      if (r.ok === false) return refuse(r);
      shell.toast("Priority set to " + D.PRIORITY[to] + ".");
      render();
    },
    clearNext(ref: string) {
      const r = E.Lifecycle.clearNextAction(ref, actor());
      if (r.ok === false) return refuse(r);
      shell.toast("Next action cleared.");
      render();
    },

    /* Door A of QUOTATION_IA §2 — the primary path into Module 2. The builder,
       the revision and Mark accepted all live over there. In the prototype this
       button carried `data-act="qt-from-deal"` and Module 2's own handler
       picked it up off the shared dispatch table; there is no shared table in
       React, so Deals makes the same two calls Module 2's handler made — the
       draft belongs to Module 2 either way, and nothing about it is
       re-implemented here. */
    createQuote(ref: string) {
      const r = IBQuote.Draft.create(ref, actor());
      if (r.ok === false) return refuse(r);
      shell.closeLayer();
      shell.toast("Draft created for " + r.data.deal_id + ". No number until it is issued.");
      go("#/quotations/" + r.data.quotation_id + "?mode=edit");
      render();
    },

    /* ------------------------------------------------------------ money */
    value(ref: string) { modal(<ValueModal dealRef={ref} onClose={close} done={done} />); },
    pay(ref: string) {
      /* Only invoices awaiting payment are listed. A settled one is not an
         option, because the balance needs its own invoice. */
      const open = E.invoicesFor(ref).filter((i: any) => i.status === "raised");
      if (!open.length)
        return shell.toast("422 invoice_required — there is no unsettled invoice on this deal.", "bad");
      modal(<PayModal dealRef={ref} open={open} onClose={close} done={done} />);
    },
    reverse(paymentId: string) {
      const pay = E.load().payments.filter((x: any) => x.payment_id === paymentId)[0];
      if (!pay) return;
      modal(<ReverseModal pay={pay} onClose={close} done={done} />);
    },

    /* ---------------------------------------------------------- closing */
    closeDeal,

    /* --------------------------------------------------------- ownership */
    reassign(ref: string) { modal(<ReassignModal dealRef={ref} onClose={close} done={done} />); },
    coassign(ref: string) {
      const dl = E.dealOf(ref); if (!dl) return;
      const pending = E.coAssignmentsFor(ref).filter((c: any) => c.status === "pending")[0];
      if (pending && head()) return modal(<DecideCoAssignModal ca={pending} dl={dl} onClose={close} done={done} />);
      modal(<CoAssignModal dealRef={ref} pending={pending} onClose={close} done={done} />);
    },

    /* ------------------------------------------------------------- tags */
    tags(ref: string) {
      if (!E.dealOf(ref)) return;
      modal(<TagsModal dealRef={ref} onClose={close} onSaved={(msg: string) => {
        close(); shell.toast(msg); render();
      }} />);
    },
    untag(ref: string, slug: string) {
      const r = E.Tags.unapply(ref, slug, actor());
      if (r.ok === false) return refuse(r);
      shell.toast("Removed from the list — " + ref + ".");
      render();
    },

    /* ----------------------------------------------------------- export */
    exportCsv() {
      if (!head()) return shell.toast("403 admin_required — Export CSV is a Sales Head action.", "bad");
      const rows: (string | number)[][] = [["deal_id", "customer", "city", "stage", "owner",
        "deal_value_paise", "collected_paise", "outstanding_paise", "quotation_status", "invoice_status"]];
      E.Analytics.scopeOf(actor()).forEach((d: any) => {
        rows.push([d.deal_id, d.customer_name, d.city, D.STAGES[d.stage].label, d.owner_id,
          d.deal_value || 0, d.revenue_collected, d.outstanding, d.quotation_status, d.invoice_status]);
      });
      const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      a.download = "deals.csv"; a.click();
      shell.toast("Exported " + (rows.length - 1) + " deals. Amounts are in paise — no display rounding is written out.");
    },

    /* ------------------------------------------------------- automation */
    stallJob() {
      const r = E.Automation.runStallDetection();
      if (r.ok === false) return refuse(r);
      shell.toast("Stall detection ran — " + r.data.flagged + " flagged, " + r.data.cleared + " cleared.");
      render();
    },
    resetEngine() {
      E.reset(); shell.toast("Deals engine reset to the seeded dataset."); render();
    }
  };
}

/* ==========================================================================
   NEW DEAL
   ====================================================================== */
/* Identity first, then what they want, then how hard to chase — the order
   a person actually takes an inbound call in. Priority is a segmented
   control rather than a dropdown: three options are not worth a menu. */
const PRIO_PICKS: [string, string, string][] = [["1", "Normal", ""], ["2", "High", "warn"], ["3", "Urgent", "bad"]];

function PrioRow({ id, value, onPick }: { id: string; value: string; onPick: (v: string) => void }) {
  return (
    <>
      <div className="pickrow" id={id + "Row"}>
        {PRIO_PICKS.map((o) => (
          <button key={o[0]} type="button" className={"pick " + o[2] + (value === o[0] ? " on" : "")}
            data-pick={id} data-v={o[0]} onClick={() => onPick(o[0])}>
            <span className={"dws-odot " + o[2]}></span>{o[1]}
          </button>
        ))}
      </div>
      {/* Segmented pickers write to a hidden input, so the commit handler keeps
          reading plain values through val() exactly as it did with selects. */}
      <input type="hidden" id={id} value={value} readOnly />
    </>
  );
}

function CreateModal({ onClose, done }: { onClose: () => void; done: (m: string, r?: string | null) => void }) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [prio, setPrio] = useState("1");
  const shell = useShell();
  useEffect(() => { const f = document.getElementById("cName"); if (f) setTimeout(() => f.focus(), 60); }, []);

  const submit = () => {
    const me = actor();
    const r = E.Intake.submit({
      customer_name: val("cName"), business_name: val("cBiz"),
      email: val("cEmail"), phone: val("cPhone"), city: val("cCity"), state: val("cState"),
      interested_in: val("cInterest"), priority: parseInt(prio, 10),
      source: "manual (" + me.name + ")", actor: me
    });
    if (r.ok === false) return setErr(r);
    if (r.data.attached) {
      onClose(); shell.toast(r.data.note); go("#/deals/" + r.data.deal.deal_id); render(); return;
    }
    done(r.data.selfAssigned
      ? "Created " + r.data.deal.deal_id + "."
      : "Created " + r.data.deal.deal_id + " and assigned to " + r.data.deal.owner_id + " by round-robin.",
      r.data.deal.deal_id);
  };

  return (
    <>
      <div className="md-h md-hero">
        <span className="md-ic"><Icon name="deal" /></span>
        <div><h3>New deal</h3><p>Off-funnel business — an inbound call, a walk-in, a referral.</p></div>
        <MdX onClose={onClose} />
      </div>

      <div className="md-b">
        <ErrSlot err={err} />
        <div className="fset"><div className="fset-h">Who</div>
          <div className="f2">
            <Field id="cName" label="Customer name" req ph="e.g. Sandeep Kulkarni" />
            {/* Optional — a walk-in customer is often a person before they are
                a business, and blocking on it would stall the call. */}
            <Field id="cBiz" label="Business name" ph="e.g. KitchenCraft" />
          </div>
          <div className="f2">
            <Field id="cPhone" label="Mobile" req ph="98100 00000"
              help="Checked against every existing deal before anything is created." />
            <Field id="cEmail" label="Email" type="email" ph="name@company.in" />
          </div>
          <div className="f2">
            <Field id="cCity" label="City" ph="e.g. Mumbai" />
            <Field id="cState" label="State" ph="e.g. Maharashtra" />
          </div>
        </div>

        <div className="fset"><div className="fset-h">What they want</div>
          {/* The package they asked about, not the service they sell. It is a
              note of what was said on the call — the quotation is what actually
              decides the plan, so this never binds anything downstream. */}
          <Field id="cInterest" label="Interested in" ph="e.g. AutoGrowth · Growth"
            help="Which package they asked about — Starter, Growth, Pro or Signature Trial. Free text, and indicative only: the quotation sets the real plan." />
        </div>

        <div className="fset"><div className="fset-h">How urgent</div>
          <div className="fg"><label>Priority</label>
            <PrioRow id="cPrio" value={prio} onPick={setPrio} />
            <div className="help">Visual triage only. It never influences who the deal goes to.</div>
          </div>
        </div>

        {head()
          ? <Notice ico="shield" text={<><b>You do not pick the owner.</b> This creates a synthetic enquiry and then follows the <i>identical</i> path as the funnel — duplicate check, then round-robin. Letting a Head choose would break rotation fairness, which is what <span className="mono">DM-BR-03</span> exists to protect.</>} />
          : <Notice ico="shield" text={<><b>This deal is yours.</b> A duplicate check runs first — if this number already has a deal it attaches there instead — otherwise it's created and assigned straight to you, not round-robin, since you're the one who took the call.</>} />}
      </div>

      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-create-go" onClick={submit}><Icon name="plus" />Create and assign</button>
      </div>
    </>
  );
}

/* ==========================================================================
   EDIT DEAL
   --------------------------------------------------------------------------
   Every field on the deal that is a FACT about it, in one form. What is NOT
   here is as deliberate as what is:

     Stage    the header's stage button owns it, and a dropdown that can refuse
              you is not a form field.
     Owner    round-robin owns it. Reassign is a named action that takes a
              reason, because changing who a deal belongs to is an event.
     Tags     their own store and their own editor.

   Money is here but conditional: on a Won or Lost deal the value is settled
   history — Won is DEFINED by ₹0 outstanding — so the fields are absent
   rather than disabled, and the panel says why.

   The whole form posts as ONE patch to Lifecycle.edit, which validates
   everything before it writes anything. A bad phone number never leaves a
   saved name behind.
   ====================================================================== */
function EditModal({ dealRef, onClose, onEdited, openResponse }: {
  dealRef: string; onClose: () => void; onEdited: () => void; openResponse: () => void;
}) {
  const dl = E.dealOf(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  const [prio, setPrio] = useState(String(dl ? dl.priority : 1));
  useEffect(() => {
    const f = document.getElementById("eName") as HTMLInputElement | null;
    if (f) setTimeout(() => { f.focus(); f.select(); }, 60);
  }, []);
  if (!dl) return null;

  const closed = dl.stage >= STAGE.WON;
  const enq = E.enquiryOf(dealRef);
  const resp = enq && enq.response;

  const save = () => {
    /* Only the fields this form actually renders go into the patch. On a
       closed deal the money inputs are absent, and sending `deal_value:""`
       for a field that was never on screen would ask the engine to consider a
       change nobody made — which is exactly the case `edit` refuses with
       `deal_closed`. */
    const patch: Record<string, unknown> = {
      customer_name: val("eName"), business_name: val("eBiz"),
      email: val("eEmail"), phone: val("ePhone"),
      city: val("eCity"), state: val("eState"),
      interested_in: val("eInterest"),
      priority: parseInt(prio, 10),
      expected_close_date: val("eClose")
    };
    if (document.getElementById("eValue")) {
      patch.deal_value = val("eValue") ? rupees(val("eValue")) : "";
      patch.discount_pct = val("eDiscount");
    }
    const r = E.Lifecycle.edit(dealRef, patch, actor());
    if (r.ok === false) return setErr(r);
    onEdited();
  };

  return (
    <>
      <div className="md-h md-hero">
        <span className="md-ic"><Icon name="deal" /></span>
        <div><h3>Edit deal</h3><p className="mono">{dealRef} · {dl.customer_name}</p></div>
        <MdX onClose={onClose} />
      </div>

      <div className="md-b">
        <ErrSlot err={err} />
        <div className="fset"><div className="fset-h">Who</div>
          <div className="f2">
            <Field id="eName" label="Customer name" req value={dl.customer_name} />
            <Field id="eBiz" label="Business name" value={dl.business_name} />
          </div>
          <div className="f2">
            <Field id="ePhone" label="Mobile" req value={dl.phone}
              help="Intake matches repeat submissions on this number, so no two deals may share one." />
            <Field id="eEmail" label="Email" type="email" value={dl.email} />
          </div>
          <div className="f2">
            <Field id="eCity" label="City" value={dl.city === "—" ? "" : dl.city} />
            <Field id="eState" label="State" value={dl.state === "—" ? "" : dl.state} />
          </div>
        </div>

        <div className="fset"><div className="fset-h">What they want</div>
          <Field id="eInterest" label="Interested in"
            value={dl.interested_in === "—" ? "" : dl.interested_in}
            help="Indicative only — the accepted quotation is what sets the real plan." />
        </div>

        <div className="fset"><div className="fset-h">Money</div>
          {closed
            ? <>
                <Notice ico="shield" text={<>This deal is <b>{D.STAGES[dl.stage].label}</b>, so its value and discount are settled. {dl.stage === STAGE.WON
                  ? "Won is defined by ₹0 outstanding — moving the value now would leave a won deal that no longer adds up."
                  : "A lost deal's figures are what it was worth when it was lost."} Reopen it first if they are genuinely wrong.</>} />
                <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
                  <Fig k="Deal value" v={dl.deal_value ? inr(dl.deal_value) : "—"} />
                  <Fig k="Collected" v={inr(dl.revenue_collected)} style={{ color: "var(--ok)" }} />
                  <Fig k="Discount" v={dl.discount_pct === null || dl.discount_pct === undefined ? "—" : dl.discount_pct + "%"} />
                </div>
              </>
            : <div className="f2">
                <Field id="eValue" label="Deal value" value={dl.deal_value ? rupeeStr(dl.deal_value) : ""}
                  ph="e.g. 1,20,000"
                  help={dl.revenue_collected
                    ? "Cannot go below " + inr(dl.revenue_collected) + ", already collected."
                    : "The agreed total, in rupees. Leave blank to keep it unset."} />
                <Field id="eDiscount" label="Discount %"
                  value={dl.discount_pct === null || dl.discount_pct === undefined ? "" : String(dl.discount_pct)}
                  ph="0" help="Above 30% clears Target 2 eligibility automatically." />
              </div>}
        </div>

        <div className="fset"><div className="fset-h">Timing and triage</div>
          <div className="fg"><span className="fg-lb">Priority</span>
            <PrioRow id="ePrio" value={prio} onPick={setPrio} />
            <div className="help">Triage only — it never changes who the deal goes to, what it is worth, or which stage it can reach.</div>
          </div>
          <Field id="eClose" label="Expected close" type="date" value={dl.expected_close_date || ""}
            help="An annotation. It gates nothing and feeds no target." />
        </div>
      </div>

      <div className="md-f">
        {/* The answers are one click away rather than scrolled past. Editing a
            field and checking what they actually said are two different jobs. */}
        {resp
          ? <button className="btn" data-act="dl-response" data-ref={dealRef} onClick={openResponse}>
              <Icon name="quote" />View funnel response</button>
          : <span className="faint" style={{ fontSize: "var(--text-sm)" }}>Keyed in by hand · no funnel response</span>}
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-edit-go" data-ref={dealRef} onClick={save}>Save changes</button>
      </div>
    </>
  );
}

/* Which submission this is, and when it landed. */
export function FunnelMeta({ enq }: { enq: any }) {
  if (!enq) return null;
  const r = enq.response;
  return (
    <div className="dws-form-meta">
      <span className="mono">{enq.submission_id}</span>
      {enq.source ? " · " + enq.source : ""}
      {r && r.received_at ? " · " + D.fmtDate(r.received_at) : ""}
    </div>
  );
}

/* The funnel submission, on demand. It lives in a dialog of its own rather
   than in the Edit form: it is thirty read-only fields sitting under six
   editable ones. Nothing here is editable, and now nothing here is next to
   something that is. */
function ResponseModal({ dealRef, onClose, onEdit }: { dealRef: string; onClose: () => void; onEdit: () => void }) {
  const dl = E.dealOf(dealRef);
  const enq = E.enquiryOf(dealRef);
  const r = enq && enq.response;
  if (!dl) return null;
  return (
    <>
      <div className="md-h md-hero">
        <span className="md-ic"><Icon name="doc" /></span>
        <div><h3>Funnel response</h3><p className="mono">{dealRef} · {dl.customer_name}</p></div>
        <MdX onClose={onClose} />
      </div>

      <div className="md-b">
        {r
          ? <>
              <FunnelMeta enq={enq} />
              {r.error ? <Notice ico="alert" tone={r.fields.length ? "warn" : "bad"} text={r.error} /> : null}
              {r.fields.length
                ? <KvList cls="kv-resp" pairs={r.fields.map((f: any) => [f.label,
                    f.value ? f.value : <span className="faint">left blank</span>] as [ReactNode, ReactNode])} />
                : null}
              <details className="dws-raw"><summary>Raw JSON as received</summary><pre>{r.raw}</pre></details>
            </>
          : <EmptyState icon="doc" title="Nothing was submitted"
              body={<>This deal was keyed in by hand{enq && enq.source ? " (" + enq.source + ")" : ""}, not through the funnel, so there is no form to show.</>} />}
      </div>

      <div className="md-f">
        <span className="faint" style={{ fontSize: "var(--text-sm)", marginRight: "auto" }}>
          What was submitted, verbatim. Editing the deal never rewrites it.</span>
        <button className="btn" data-close="1" onClick={onClose}>Close</button>
        <button className="btn pri" data-act="dl-edit" data-ref={dealRef} onClick={onEdit}>Edit deal</button>
      </div>
    </>
  );
}

/* ==========================================================================
   REMARK
   ====================================================================== */
function RemarkModal({ dealRef, onClose, done }: {
  dealRef: string; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const add = () => {
    const r = E.Activity.remark(dealRef, val("rText"), val("rNext") || null, actor());
    if (r.ok === false) return setErr(r);
    done("Remark appended.", dealRef);
  };
  return (
    <>
      <div className="md-h"><h3>Add remark</h3><p>{dealRef} · appended, never edited</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="rText" label="What happened" req type="textarea"
          ph="Called — customer is comparing two quotes, wants a revision on the kitchen line." />
        <Field id="rNext" label="Next action date" type="date"
          help="Advisory. It drives the Due today / Overdue grouping on the list and nothing else — it never gates a stage or touches a compensation figure." />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-remark-go" data-ref={dealRef} onClick={add}>Add remark</button>
      </div>
    </>
  );
}

/* ==========================================================================
   STAGE
   ====================================================================== */
function StageModal({ dealRef, onClose, onPick }: {
  dealRef: string; onClose: () => void; onPick: (to: number) => void;
}) {
  const dl = E.dealOf(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  const targets: number[] = E.Lifecycle.legalTargets(dealRef);
  if (!dl) return null;
  const commit = () => {
    const picked = document.querySelector('input[name="stageTo"]:checked') as HTMLInputElement | null;
    if (!picked) return setErr({ http: 400, code: "validation_failed", detail: "Choose a target stage." });
    onPick(parseInt(picked.value, 10));
  };
  return (
    <>
      <div className="md-h"><h3>Change stage</h3>
        <p>{dealRef} · currently {D.STAGES[dl.stage].label}</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        {targets.map((t) => (
          <label key={t} className="check" style={{ alignItems: "flex-start", border: "1px solid var(--line-2)",
            borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px" }}>
            <input type="radio" name="stageTo" value={t} />
            <span><b>{D.STAGES[t].label}</b>
              {D.STAGES[t].hint ? <> <span className="faint">— {D.STAGES[t].hint}</span></> : null}
              {t < dl.stage ? <> <span className="pill warn xs">backward · logged</span></> : null}
            </span>
          </label>
        ))}
        {/* The reason field left this modal. It asked for one only when Lost was
            among the targets, which made "why" look like a property of losing
            rather than of moving. Picking a stage now opens the remark dialog,
            which asks the same question about every move. */}
        <Notice ico="shield" text={<><b>Every stage is a legal target from every other stage — there is no matrix left to rule one out.</b> Nothing here refuses a move. Picking one asks you to say why, and the deal moves when you have.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-stage-go" data-ref={dealRef} onClick={commit}>Change stage</button>
      </div>
    </>
  );
}

function StageRemarkModal({ dealRef, to, from, onClose, done }: {
  dealRef: string; to: number; from: number; onClose: () => void;
  done: (m: string, r?: string | null) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const back = to < from && to !== STAGE.LOST;
  const commit = () => {
    /* Whitespace is not a remark. Trimmed here so " " cannot buy its way past
       a check for emptiness, and trimmed again on the way into the store. */
    const text = String(val("stRemark") || "").trim();
    if (!text) return setErr({ http: 400, code: "validation_failed",
      detail: "A remark is required — say why the stage is changing." });
    const r = E.Lifecycle.change(dealRef, to, text, actor());
    if (r.ok === false) return setErr(r);        // stage unchanged; dialog stays open
    done("Stage changed to " + D.STAGES[r.data.stage].label + ".", dealRef);
  };
  return (
    <>
      <div className="md-h"><h3>Change stage</h3><p>{dealRef} · a remark is required</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        {/* Both stages on one line, in the order the deal moves through them, so
            "what am I about to do" is answered without reading a sentence. */}
        <div className="dl-stagemove">
          <span className={"dws-stagebtn " + (D.STAGES[from].tone || "")} aria-hidden="true">
            <span className={"dws-sdot " + (D.STAGES[from].tone || "")}></span>{D.STAGES[from].label}</span>
          <span className="dl-stagearrow"><Icon name="chevr" size="sm" /></span>
          <span className={"dws-stagebtn " + (D.STAGES[to].tone || "")} aria-hidden="true">
            <span className={"dws-sdot " + (D.STAGES[to].tone || "")}></span>{D.STAGES[to].label}</span>
          {back ? <span className="pill warn xs">backward · logged</span> : null}
        </div>
        <Field id="stRemark" label="What changed" req type="textarea"
          ph={D.STAGES[to].hint
            ? "Why the deal is now " + D.STAGES[to].label + ". " + D.STAGES[to].hint + "."
            : "Why the deal is now " + D.STAGES[to].label + "."}
          help="Goes on the timeline attached to this move, under your name and today's date. It is appended, never edited — this is the only record of why the stage changed." />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-stage-commit" data-ref={dealRef} data-to={to} onClick={commit}>Change stage</button>
      </div>
    </>
  );
}

/* ==========================================================================
   SET DEAL VALUE
   ====================================================================== */
function ValueModal({ dealRef, onClose, done }: {
  dealRef: string; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const dl = E.dealOf(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  if (!dl) return null;
  const save = () => {
    const r = E.Lifecycle.setValue(dealRef, rupees(val("vAmt")), val("vDisc"), actor());
    if (r.ok === false) return setErr(r);
    done("Deal value set to " + inr(r.data.deal_value) + ".", dealRef);
  };
  return (
    <>
      <div className="md-h"><h3>Set deal value</h3><p>{dealRef} · the agreed total</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="vAmt" label="Total agreed deal value" req ph="8,85,000"
          value={dl.deal_value ? Math.round(dl.deal_value / 100) : ""}
          tone={dl.revenue_collected ? "warn" : ""}
          help={dl.revenue_collected
            ? <>Cannot be set below {inr(dl.revenue_collected)} already collected → <span className="mono">422 deal_value_below_collected</span>.</>
            : "Stored as integer paise. No float reaches a commercial total."} />
        <Field id="vDisc" label="Discount %" type="number" value={dl.discount_pct || 0} tone="warn"
          help={<>Above 30% sets <span className="mono">is_target2_eligible = false</span> <b>automatically</b> — not as a choice someone can forget to make.</>} />
        <Notice ico="alert" text={<>This form survives only for deals that never carried a quotation. Once one is marked <b>Accepted</b> in Module 2, it writes the agreed value back and this becomes read-only history.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-value-go" data-ref={dealRef} onClick={save}>Save</button>
      </div>
    </>
  );
}

/* ==========================================================================
   LOG PAYMENT — no invoice, no payment.
   ====================================================================== */
type Proof = { filename: string; mime: string; bytes: number; thumb: string | null; bad: string | null };

function fileSize(b: number) {
  return b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
}

function PayModal({ dealRef, open, onClose, done }: {
  dealRef: string; open: any[]; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [picked, setPicked] = useState<Proof[]>([]);
  const first = open[0], due = first.amount_paise - first.received_paise;

  /* Reads the files the user actually picked. Only a downscaled preview is
     kept — a 5 MB screenshot in localStorage would blow the quota on the
     second upload. The original goes to object storage through the API. */
  const take = (fileList: FileList | null) => {
    const files = Array.prototype.slice.call(fileList || []) as File[];
    if (!files.length) return;
    files.forEach((file) => {
      const rec: Proof = { filename: file.name, mime: file.type, bytes: file.size, thumb: null,
        bad: (N && N.PROOF_TYPES.indexOf(file.type) < 0) ? "proof_type_unsupported"
          : (N && file.size > N.PROOF_MAX_BYTES) ? "proof_too_large" : null };
      const push = () => setPicked((cur) => cur.concat([rec]));
      if (rec.bad || file.type.indexOf("image/") !== 0) return push();
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 240, sc = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          (c.getContext("2d") as CanvasRenderingContext2D).drawImage(img, 0, 0, c.width, c.height);
          try { rec.thumb = c.toDataURL("image/jpeg", 0.6); } catch { /* tainted canvas */ }
          push();
        };
        img.onerror = push;
        img.src = fr.result as string;
      };
      fr.onerror = push;
      fr.readAsDataURL(file);
    });
  };

  const log = () => {
    if (!picked.length)
      return setErr({ http: 400, code: "validation_failed",
        detail: "Payment proof is required — attach at least one file before logging this payment." });
    const bad = picked.filter((f) => f.bad)[0];
    if (bad) return setErr({ http: 400, code: bad.bad as string,
      detail: bad.filename + " — " + (bad.bad === "proof_too_large"
        ? "over the 5 MB limit." : "unsupported file type. Use PNG, JPG or PDF.") });
    const invId = val("pInv");
    const r = E.Ledger.pay({ dealId: dealRef, invoiceId: invId, amountPaise: rupees(val("pAmt")),
      date: val("pDate"), mode: val("pMode"), reference: val("pRef"),
      idempotency_key: "ui-" + dealRef + "-" + val("pRef") + "-" + val("pAmt") }, actor());
    if (r.ok === false) return setErr(r);
    // The payment is committed — Module 3 has already synced payment_id onto
    // the invoice (tx() runs cross-module callbacks before returning).
    // Attaching now means each proof records the payment_id it evidences.
    let proofErr: Refusal | null = null;
    picked.forEach((f) => {
      if (proofErr || !N) return;
      const pr = N.Proofs.attach(invId, f, actor());
      if (pr.ok === false) proofErr = pr;
    });
    done(r.data.closedWon
      ? "Payment logged with proof attached. Outstanding is ₹0 — this deal closed as Won automatically."
      : "Payment logged with proof attached. " + inr(r.data.outstanding) + " outstanding." +
        (proofErr ? " (One proof file failed to attach: " + (proofErr as Refusal).detail + ")" : ""), dealRef);
  };

  return (
    <>
      <div className="md-h"><h3>Log payment</h3><p>{dealRef} · money actually received</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="pInv" label="Invoice" req type="select"
          options={open.map((i: any) => ({ v: String(i.invoice_id),
            l: (i.number || i.invoice_id) + " — " + inr(i.amount_paise - i.received_paise) + " due" }))}
          help="Only invoices awaiting payment are listed. A settled invoice is not an option — the balance needs its own invoice." />
        <div className="f2">
          <Field id="pAmt" label="Amount" req value={Math.round(due / 100)} tone="warn"
            help={<>Capped at <b>that invoice's</b> amount, not the deal outstanding → <span className="mono">422 payment_exceeds_outstanding</span>. Rejected, never clamped.</>} />
          <Field id="pDate" label="Date received" type="date" value={isoToday()}
            help="IST. Closes the compensation month." />
        </div>
        <div className="f2">
          <Field id="pMode" label="Mode" type="select" options={[
            { v: "NEFT", l: "NEFT" }, { v: "IMPS", l: "IMPS" }, { v: "UPI", l: "UPI" },
            { v: "RTGS", l: "RTGS" }, { v: "Cheque", l: "Cheque" }]} />
          <Field id="pRef" label="Reference / UTR" req ph="NEFT0026JUN4471"
            help="Mandatory. Without it the row cannot be reconciled against the bank." />
        </div>
        <Notice ico="lock" text={<><b>No invoice, no payment.</b> There is no token, advance or unallocated payment anywhere in this module. A customer promising to pay, or naming a figure, is a <b>remark</b> — it is not money and never touches the ledger.</>} />

        <div className="fg" style={{ marginTop: "4px" }}>
          <label>Payment proof <span className="req">*</span></label>
          <label htmlFor="pfFile" id="pfDrop"
            style={{ display: "block", position: "relative", border: "1.5px dashed var(--line-control)",
              borderRadius: "var(--radius-lg)", padding: "26px 18px", textAlign: "center", cursor: "pointer" }}
            onDragEnter={(e) => e.preventDefault()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); take(e.dataTransfer && e.dataTransfer.files); }}>
            <div style={{ fontWeight: 600 }}>Choose files or drop them here</div>
            <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "3px" }}>
              PNG, JPG or PDF, up to 5 MB each. Several at once.</div>
            <input type="file" id="pfFile" multiple accept="image/png,image/jpeg,application/pdf"
              style={{ position: "absolute", width: "1px", height: "1px", opacity: 0, left: 0, top: 0 }}
              onChange={(e) => take(e.target.files)} />
          </label>
          <div id="pfList" style={{ marginTop: "12px" }}>
            {picked.length ? picked.map((f, ix) => (
              <div key={ix} style={{ display: "flex", gap: "10px", alignItems: "center",
                border: "1px solid " + (f.bad ? "var(--bad-line)" : "var(--line)"),
                borderRadius: "var(--radius-md)", padding: "8px", marginBottom: "6px" }}>
                {f.thumb
                  ? <img src={f.thumb} alt="" style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "var(--radius-sm)" }} />
                  : <span style={{ width: "44px", height: "44px", display: "grid", placeItems: "center",
                      background: "var(--bg-inset)", borderRadius: "var(--radius-sm)", fontSize: "10px" }}>PDF</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: "var(--text-md)" }}>{f.filename}</b>
                  <div className="cell-2">{fileSize(f.bytes)}
                    {f.bad ? <> · <span style={{ color: "var(--bad)" }}>{f.bad}</span></> : null}</div>
                </span>
                <button className="btn sm icon dgr" data-act="dl-pay-proof-drop" data-ix={ix}
                  onClick={() => setPicked((cur) => cur.filter((_, i) => i !== ix))}><Icon name="x" /></button>
              </div>
            )) : <div className="faint" style={{ fontSize: "var(--text-md)" }}>No file chosen yet.</div>}
          </div>
          <div className="help">Mandatory — a UPI screenshot, bank transfer receipt or transaction confirmation. Internal record only: it is attached to the invoice for verification, never shown to the customer and never on the invoice document.</div>
        </div>
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-pay-go" data-ref={dealRef} onClick={log}>Log payment</button>
      </div>
    </>
  );
}

/* ==========================================================================
   REVERSE PAYMENT — the original entry is never deleted.
   ====================================================================== */
function ReverseModal({ pay, onClose, done }: {
  pay: any; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const commit = () => {
    const r = E.Ledger.reverse(pay.payment_id, val("revReason"), actor());
    if (r.ok === false) return setErr(r);
    done("Reversal appended. The original row is untouched.", pay ? pay.deal_id : null);
  };
  return (
    <>
      <div className="md-h"><h3>Reverse payment</h3><p>{pay.payment_id} · Sales Head, audited</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <KvList cls="wide" pairs={[
          ["Payment", <span className="mono">{pay.payment_id}</span>],
          ["Amount", <b>{inr(pay.amount_paise)}</b>],
          ["Mode · reference", pay.mode + " · " + pay.reference],
          ["Invoice", <span className="mono">{pay.invoice_id || "—"}</span>],
          ["Recorded by", pay.recorded_by]
        ]} />
        <div style={{ height: "14px" }}></div>
        <Field id="revReason" label="Reason" req type="textarea"
          ph="Customer double-paid; the second transfer was returned to the remitter." />
        <Notice tone="bad" text={<><b>The original entry is never deleted.</b> A negative entry is appended referencing it, and <b>{pay.invoice_id || "the invoice"} is cancelled</b> — its amount returns to the uninvoiced balance. Both rows are retained. If this payment was behind a Closed-Won, the deal reopens.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn dgr" data-act="dl-reverse-go" data-pay={pay.payment_id} onClick={commit}>Append reversal</button>
      </div>
    </>
  );
}

/* ==========================================================================
   CLOSE DEAL
   ====================================================================== */
function CloseModal({ dealRef, onClose, done }: {
  dealRef: string; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const dl = E.dealOf(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  if (!dl) return null;
  const canWon = dl.stage !== STAGE.WON;
  const commit = () => {
    const picked = document.querySelector('input[name="closeAs"]:checked') as HTMLInputElement | null;
    if (!picked) return setErr({ http: 400, code: "validation_failed", detail: "Choose Won or Lost." });
    const why = String(val("clReason") || "").trim();
    if (!why) return setErr({ http: 400, code: "validation_failed",
      detail: "A reason is required — say why this deal is being closed." });
    const r = E.Lifecycle.change(dealRef, picked.value, why, actor());
    if (r.ok === false) return setErr(r);
    done("Deal closed " + (Number(picked.value) === STAGE.WON ? "Won" : "Lost") + ".", dealRef);
  };
  return (
    <>
      <div className="md-h"><h3>Close deal</h3><p>{dealRef} · Won or Lost, and reversible either way</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        {canWon
          ? <label className="check" style={{ alignItems: "flex-start", border: "1px solid var(--ok-line)",
              borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px", background: "var(--ok-bg)" }}>
              <input type="radio" name="closeAs" value={STAGE.WON} />
              <span><b>Closed - Won</b>
                {/* States the money rather than gating on it. Won means paid in
                    full, and when it is not, saying so is more use than a
                    disabled radio — the operator may know a transfer landed
                    that the ledger has not seen yet. */}
                <div className={"help" + (dl.outstanding > 0 ? " warn" : "")} style={{ marginTop: "3px" }}>
                  {dl.outstanding > 0
                    ? inr(dl.outstanding) + " is still outstanding. Won normally means ₹0 — close it anyway if the money has arrived and the ledger has not caught up."
                    : "Outstanding is ₹0. The full deal value has been collected."}
                </div>
              </span>
            </label>
          : null}
        <label className="check" style={{ alignItems: "flex-start", border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px" }}>
          <input type="radio" name="closeAs" value={STAGE.LOST} />
          <span><b>Closed - Lost</b>
            <div className="help" style={{ marginTop: "3px" }}>
              A reason is worth writing even though nothing here demands one.
              {dl.revenue_collected > 0
                ? <> <b>{inr(dl.revenue_collected)} has been collected on this deal</b> — losing it after money arrived is worth a sentence somebody can read next year.</>
                : null}
            </div>
          </span>
        </label>
        {/* Required, like every other stage change. Won and Lost are the two
            moves nobody revisits casually and the two most likely to be
            questioned a year later. */}
        <Field id="clReason" label="Reason" req type="textarea" ph="Chose a local vendor on price." />
        <Notice ico="shield" text={<><b>Closing sets a stage, it does not freeze anything.</b> Remarks and payments can still be logged afterwards — money often arrives after a deal is called, and a record you cannot annotate is a record people keep somewhere else.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-close-go" data-ref={dealRef} onClick={commit}>Close deal</button>
      </div>
    </>
  );
}

/* ==========================================================================
   OWNERSHIP
   ====================================================================== */
function ReassignModal({ dealRef, onClose, done }: {
  dealRef: string; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const dl = E.dealOf(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  if (!dl) return null;
  const commit = () => {
    const r = E.Assignment.reassign(dealRef, val("raOwner"), val("raReason"), actor());
    if (r.ok === false) return setErr(r);
    done("Owner reassigned. Ledger attribution unchanged.", dealRef);
  };
  return (
    <>
      <div className="md-h"><h3>Reassign owner</h3><p>{dealRef} · currently {dl.owner_id}</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="raOwner" label="New owner" req type="select"
          options={E.Assignment.roster().members.filter((m: any) => m.active && m.id !== dl.owner_id)
            .map((m: any) => ({ v: String(m.id), l: String(m.id) }))}
          help="Active roster members only. The round-robin cursor is not reset." />
        <Field id="raReason" label="Reason" req type="textarea"
          ph="Owner on extended leave; customer needs a response this week."
          help="Mandatory. It is appended to the timeline as a system remark." />
        <Notice tone="warn" ico="shield" text={<><b>Payments already collected keep their original attribution.</b> Every ledger row snapshotted its owner and split at write time, so analytics and compensation are unaffected by this change. This is the subtlest rule in the module.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-reassign-go" data-ref={dealRef} onClick={commit}>Reassign</button>
      </div>
    </>
  );
}

function CoAssignModal({ dealRef, pending, onClose, done }: {
  dealRef: string; pending: any; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const dl = E.dealOf(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  if (!dl) return null;
  const commit = () => {
    const r = E.Assignment.requestCoAssign(dealRef, val("caWho"), val("caSplit"), val("caReason"), actor());
    if (r.ok === false) return setErr(r);
    done("Co-assignment requested. Awaiting Sales Head approval.", dealRef);
  };
  return (
    <>
      <div className="md-h"><h3>Request co-assignment</h3><p>{dealRef} · owner stays {dl.owner_id}</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        {pending ? <>
          <Notice tone="warn" ico="clock" text={<>A request for <b>{pending.co_owner}</b> at {100 - pending.proposed_split} / {pending.proposed_split} is already pending Sales Head approval.</>} />
          <div style={{ height: "14px" }}></div>
        </> : null}
        <Field id="caWho" label="Co-owner" req type="select"
          options={E.Assignment.roster().members.filter((m: any) => m.active && m.id !== dl.owner_id)
            .map((m: any) => ({ v: String(m.id), l: String(m.id) }))} />
        <Field id="caSplit" label="Proposed split to the co-owner (%)" req type="number" value={30}
          help={<>The owner keeps the remainder. Co-assignment <b>adds</b> a second name — it never removes the first.</>} />
        <Field id="caReason" label="Reason" req type="textarea" ph="Site visit and technical scoping handled jointly." />
        <Notice ico="shield" text={<><b>Requires Sales Head approval before it takes effect</b>, and applies to <b>future payments only</b>. Money already collected keeps the attribution it was written with.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-coassign-go" data-ref={dealRef} onClick={commit}>Send request</button>
      </div>
    </>
  );
}

function DecideCoAssignModal({ ca, dl, onClose, done }: {
  ca: any; dl: any; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const decide = (approve: boolean) => {
    const r = E.Assignment.decideCoAssign(ca.co_assignment_id, approve, approve ? val("caFinal") : null, actor());
    if (r.ok === false) return setErr(r);
    done(approve ? "Co-assignment approved." : "Co-assignment rejected.", r.data.deal_id);
  };
  return (
    <>
      <div className="md-h"><h3>Approve co-assignment</h3><p>{ca.deal_id} · requested by {ca.requested_by}</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <KvList cls="wide" pairs={[
          ["Owner", dl.owner_id],
          ["Proposed co-owner", <b>{ca.co_owner}</b>],
          ["Proposed split", (100 - ca.proposed_split) + " / " + ca.proposed_split],
          ["Reason", ca.reason]
        ]} />
        <div style={{ height: "14px" }}></div>
        <Field id="caFinal" label="Approved split to the co-owner (%)" type="number" value={ca.proposed_split}
          help="Edit before approving if the proposed split is wrong." />
        <Notice ico="alert" text={<>Applies to <b>future payments only</b>.</>} />
      </div>
      <div className="md-f">
        <button className="btn dgr" data-act="dl-ca-reject" data-ca={ca.co_assignment_id} onClick={() => decide(false)}>Reject</button>
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-ca-approve" data-ca={ca.co_assignment_id} onClick={() => decide(true)}>Approve</button>
      </div>
    </>
  );
}
