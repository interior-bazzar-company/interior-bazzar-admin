/* =============================================================================
   Deals — MODALS. Each states the rule before you commit.
   -----------------------------------------------------------------------------
   Every guard dialog, one component each, plus useActs() — the action table
   every call site (table, board, chat, drawer, popover menus) reaches, so a
   second copy cannot grow and drift.

   EVERY ACTION HERE IS AN HTTP CALL to interior_admin's deals endpoints. The
   local engine is gone from this module: a write goes to the server, the
   server re-checks it, and `render()` re-fetches the list and the open drawer
   from the response's own source of truth rather than from a store this tab
   happens to hold.

   WHAT LEFT, and why it is not hiding in a menu somewhere: log payment,
   reverse payment, raise invoice, create quotation, co-assignment splits and
   the funnel-response viewer. Every one of them read or wrote a browser-side
   store with no model behind it — there is no payment, invoice, quotation,
   split or enquiry table server-side. They were operating on seed data that
   the real deal list never contained, so on any live deal they either did
   nothing or wrote a record nobody else could ever see. They come back when
   the models do.
   ============================================================================= */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Field, Icon, Notice } from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import {
  D, STAGE, apiPriorityKey, apiStageKey, head, inr, refusalOf, rupeeStr, rupees,
  setChan, useDealApi, useDone, useRefuse, val, render
} from "./useDeals";
import type { Params, Refusal } from "./useDeals";
import { ErrSlot } from "./bits";
import { TagsModal } from "./Tags";

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

  /* One place that turns a thrown API refusal into the module's toast, so no
     handler below has to remember the envelope. */
  const failed = (e: unknown) => refuse(refusalOf(e));

  const edit = (ref: string) => modal(<EditModal dealRef={ref} onClose={close} done={done} />, "wide");
  const stageRemark = (ref: string, to: number, from: number) => {
    if (to === from) return;                    // not a change; nothing to explain
    modal(<StageRemarkModal dealRef={ref} to={to} from={from} onClose={close} done={done} />);
  };
  const closeDeal = (ref: string) => modal(<CloseModal dealRef={ref} onClose={close} done={done} />);

  return {
    /* ------------------------------------------------------ create/edit */
    create() {
      if (!can("deals", "create"))
        return shell.toast("403 — you do not have deal-creation access.", "bad");
      modal(<CreateModal onClose={close} done={done} />);
    },
    edit,

    /* ---------------------------------------------------------- remarks */
    remark(ref: string) { modal(<RemarkModal dealRef={ref} onClose={close} done={done} />); },
    /* Three clicks and one text field — the most repeated action in the
       module. Adding a remark also clears the stalled flag, server-side. */
    quick(ref: string) {
      const text = val("dlQuickRemark");
      call(AdminOpsService.dealRemark(ref, text))
        .then(() => { shell.toast("Remark added. Stalled flag cleared."); render(); })
        .catch(failed);
    },
    /* The chat composer. Returns a promise the composer awaits so it only
       clears the box on a write the server actually accepted. `channel`
       tags how the agent reached the customer (manual/whatsapp/email);
       reset to manual on success, same as the prototype's CHAN reset. */
    send(ref: string, text: string, channel?: string) {
      return call(AdminOpsService.dealRemark(ref, text, undefined, channel))
        .then(() => { setChan("manual"); render(); return true; })
        .catch((e: unknown) => { failed(e); return false; });
    },

    /* ----------------------------------------------------------- stages */
    stage(ref: string, from: number) {
      modal(<StageModal dealRef={ref} from={from} onClose={close}
        onPick={(to: number) => {
          // Won and Lost stay pickable here — every stage is a legal target
          // from every other — but committing either from this generic list
          // would skip the reason field Close deal exists to show. Land on the
          // one guarded flow, not two.
          close();
          if (to === STAGE.LOST || to === STAGE.WON) closeDeal(ref);
          else stageRemark(ref, to, from);
        }} />);
    },
    stageRemark,
    priority(ref: string, to: number) {
      call(AdminOpsService.updateDeal(ref, { priorityKey: apiPriorityKey(String(to)) }))
        .then(() => { shell.toast("Priority set to " + D.PRIORITY[to] + "."); render(); })
        .catch(failed);
    },
    clearNext(ref: string) {
      // null CLEARS it server-side; omitting the key would leave it alone.
      call(AdminOpsService.updateDeal(ref, { nextActionDate: null }))
        .then(() => { shell.toast("Next action cleared."); render(); })
        .catch(failed);
    },

    /* ------------------------------------------------------------ money */
    value(ref: string) { modal(<ValueModal dealRef={ref} onClose={close} done={done} />); },

    /* ---------------------------------------------------------- closing */
    closeDeal,

    /* --------------------------------------------------------- ownership */
    reassign(ref: string) { modal(<ReassignModal dealRef={ref} onClose={close} done={done} />); },

    /* ------------------------------------------------------------- tags */
    tags(ref: string) {
      modal(<TagsModal dealRef={ref} onClose={close} onSaved={(msg: string) => {
        close(); shell.toast(msg); render();
      }} />);
    },
    untag(ref: string, slug: string) {
      call(AdminOpsService.dealTag(ref, slug, false))
        .then(() => { shell.toast("Removed from the list — " + ref + "."); render(); })
        .catch(failed);
    },

    /* ----------------------------------------------------------- export */
    /* What the list endpoint actually returns, and nothing more. The old
       version wrote collected/outstanding/quotation/invoice columns out of the
       local engine's seed money — a spreadsheet of figures with no source. */
    exportCsv(list: any[]) {
      if (!head()) return shell.toast("403 — Export is a Sales Head action.", "bad");
      const rows: (string | number)[][] = [["deal_ref", "customer", "business", "phone", "city",
        "stage", "priority", "owner", "deal_value_paise", "expected_close", "next_action", "tags"]];
      list.forEach((d: any) => {
        rows.push([d.deal_id, d.customer_name, d.business_name || "", d.phone, d.city,
          D.STAGES[d.stage].label, D.PRIORITY[d.priority], d.owner_id || "",
          d.deal_value == null ? "" : d.deal_value, d.expected_close_date || "",
          d.next_action ? d.next_action.date : "",
          (d.tags || []).map((t: any) => t.slug).join(" ")]);
      });
      const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      a.download = "deals.csv"; a.click();
      shell.toast("Exported " + (rows.length - 1) + " deals — the rows currently filtered. " +
        "Amounts are in paise, unrounded.");
    },

    /* ------------------------------------------------------- automation */
    stallJob() {
      call(AdminOpsService.dealStallSweep())
        .then((r) => {
          shell.toast("Stall sweep ran — " + r.flagged + " flagged, " + r.cleared +
            " cleared, " + r.scanned + " scanned.");
          render();
        })
        .catch(failed);
    },
  };
}

/* Loads the one deal a dialog is about. Every modal below opens over a ref,
   not over a row somebody passed in: the list row may be a page old, and a
   form that saves what it was showing rather than what is stored is how two
   people overwrite each other. */
function useDeal(ref: string) {
  const { deal, loading } = useDealApi(ref);
  return { dl: deal, loading };
}

function Loading() {
  return <div className="md-b"><div className="faint">Loading…</div></div>;
}

/* ==========================================================================
   NEW DEAL
   ====================================================================== */
/* Identity first, then what they want, then how hard to chase — the order a
   person actually takes an inbound call in. Priority is a segmented control
   rather than a dropdown: three options are not worth a menu. */
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
  const [dupRef, setDupRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shell = useShell();
  useEffect(() => { const f = document.getElementById("cName"); if (f) setTimeout(() => f.focus(), 60); }, []);

  const submit = (allowDuplicate: boolean) => {
    setErr(null); setBusy(true);
    call(AdminOpsService.createDeal({
      contactName: val("cName"), businessName: val("cBiz"),
      email: val("cEmail"), phone: val("cPhone"), city: val("cCity"), state: val("cState"),
      interestedIn: val("cInterest"), priorityKey: apiPriorityKey(prio), allowDuplicate,
    }))
      .then((row) => done("Created " + row.ref + ", assigned to you.", row.ref))
      .catch((e: unknown) => {
        const r = refusalOf(e);
        setErr(r); setBusy(false);
        /* The server names the deal already open on this number. Offering to
           open it is the useful half of the refusal — the duplicate check
           exists so one customer does not become two pipelines each holding
           half the history. */
        const m = /\b(DL-\d+)\b/.exec(r.detail || "");
        setDupRef(m ? m[1] : null);
      });
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
        {dupRef
          ? <Notice tone="warn" ico="alert" text={<>
              <b>{dupRef} is already open on this number.</b> Add what was said as a remark there
              instead of starting a second pipeline — or create this one anyway if it is genuinely
              different business.
              <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                <button className="btn sm" onClick={() => { shell.closeLayer(); go("#/deals/" + dupRef); }}>
                  Open {dupRef}</button>
                <button className="btn sm dgr" disabled={busy} onClick={() => submit(true)}>
                  Create anyway</button>
              </div>
            </>} />
          : null}
        <div className="fset"><div className="fset-h">Who</div>
          <div className="f2">
            <Field id="cName" label="Customer name" req ph="e.g. Sandeep Kulkarni" />
            {/* Optional — a walk-in customer is often a person before they are
                a business, and blocking on it would stall the call. */}
            <Field id="cBiz" label="Business name" ph="e.g. KitchenCraft" />
          </div>
          <div className="f2">
            <Field id="cPhone" label="Mobile" req ph="98100 00000"
              help="Checked against every open deal before anything is created — on the digits, so 090322… and +91 90322… are one customer." />
            <Field id="cEmail" label="Email" type="email" ph="name@company.in" />
          </div>
          <div className="f2">
            <Field id="cCity" label="City" ph="e.g. Mumbai" />
            <Field id="cState" label="State" ph="e.g. Maharashtra" />
          </div>
        </div>

        <div className="fset"><div className="fset-h">What they want</div>
          {/* The package they asked about, not the service they sell. It is a
              note of what was said on the call and binds nothing downstream. */}
          <Field id="cInterest" label="Interested in" ph="e.g. AutoGrowth · Growth"
            help="Which package they asked about. Free text, and indicative only." />
        </div>

        <div className="fset"><div className="fset-h">How urgent</div>
          <div className="fg"><label>Priority</label>
            <PrioRow id="cPrio" value={prio} onPick={setPrio} />
            <div className="help">Visual triage only. It never influences who the deal goes to.</div>
          </div>
        </div>

        <Notice ico="shield" text={<>
          <b>This deal is yours.</b> It is assigned to you, the person taking the call — there is no
          round-robin rotation behind this panel, so a deal goes to whoever created it and is
          reassigned by name when it should sit with somebody else.
        </>} />
      </div>

      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-create-go" disabled={busy} onClick={() => submit(false)}>
          <Icon name="plus" />{busy ? "Creating…" : "Create deal"}</button>
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
     Owner    Reassign is a named action that takes a reason, because changing
              who a deal belongs to is an event.
     Tags     their own editor.

   The form posts ONE patch, carrying only the fields that actually changed —
   the server treats an absent key as untouched, so a form that always sent all
   twelve would overwrite a colleague's edit with stale values it happened to
   have on screen.
   ====================================================================== */
function EditModal({ dealRef, onClose, done }: {
  dealRef: string; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const { dl, loading } = useDeal(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  const [prio, setPrio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const f = document.getElementById("eName") as HTMLInputElement | null;
    if (f) setTimeout(() => { f.focus(); f.select(); }, 60);
  }, [loading]);

  if (loading) return <><div className="md-h"><h3>Edit deal</h3><p className="mono">{dealRef}</p><MdX onClose={onClose} /></div><Loading /></>;
  if (!dl) return null;
  const prioNow = prio === null ? String(dl.priority) : prio;
  const closed = dl.stage >= STAGE.WON;

  const save = () => {
    const patch: Record<string, unknown> = {};
    const put = (k: string, v: unknown, was: unknown) => { if (String(v ?? "") !== String(was ?? "")) patch[k] = v; };
    put("contactName", val("eName").trim(), dl.customer_name);
    put("businessName", val("eBiz").trim(), dl.business_name);
    put("email", val("eEmail").trim(), dl.email);
    put("phone", val("ePhone").trim(), dl.phone);
    put("city", val("eCity").trim(), dl.city);
    put("state", val("eState").trim(), dl.state);
    put("interestedIn", val("eInterest").trim(), dl.interested_in);
    put("expectedClose", val("eClose") || null, dl.expected_close_date);
    if (prioNow !== String(dl.priority)) patch.priorityKey = apiPriorityKey(prioNow);
    if (!closed && document.getElementById("eValue")) {
      const typed = val("eValue").trim();
      const next = typed ? rupees(typed) : null;      // null = back to "not quoted yet"
      if (next !== dl.deal_value) patch.valuePaise = next;
    }
    if (!Object.keys(patch).length) { onClose(); return; }

    setErr(null); setBusy(true);
    call(AdminOpsService.updateDeal(dealRef, patch))
      .then(() => done("Deal " + dealRef + " updated.", dealRef))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
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
              help="No two OPEN deals may share a number — the server checks the digits, not the formatting." />
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
            help="Indicative only — what they asked about on the call." />
        </div>

        <div className="fset"><div className="fset-h">Money</div>
          {closed
            ? <Notice ico="shield" text={<>
                This deal is <b>{D.STAGES[dl.stage].label}</b>, so its value is settled history:{" "}
                {dl.deal_value ? inr(dl.deal_value) : "never quoted"}. Move it back to an open stage
                first if that figure is genuinely wrong.
              </>} />
            : <Field id="eValue" label="Deal value" value={dl.deal_value ? rupeeStr(dl.deal_value) : ""}
                ph="e.g. 1,20,000"
                help="The agreed total, in rupees, stored as integer paise. Clear it to put the deal back to “not quoted yet” — which is not the same as ₹0." />}
        </div>

        <div className="fset"><div className="fset-h">Timing and triage</div>
          <div className="fg"><span className="fg-lb">Priority</span>
            <PrioRow id="ePrio" value={prioNow} onPick={setPrio} />
            <div className="help">Triage only — it never changes who the deal goes to, what it is worth, or which stage it can reach.</div>
          </div>
          <Field id="eClose" label="Expected close" type="date" value={dl.expected_close_date || ""}
            help="An annotation. It gates nothing and feeds no target." />
        </div>
      </div>

      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-edit-go" data-ref={dealRef} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}</button>
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
  const [busy, setBusy] = useState(false);
  const add = () => {
    setErr(null); setBusy(true);
    call(AdminOpsService.dealRemark(dealRef, val("rText"), val("rNext") || null))
      .then(() => done("Remark appended.", dealRef))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
  };
  return (
    <>
      <div className="md-h"><h3>Add remark</h3><p>{dealRef} · appended, never edited</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="rText" label="What happened" req type="textarea"
          ph="Called — customer is comparing two quotes, wants a revision on the kitchen line." />
        <Field id="rNext" label="Next action date" type="date"
          help="Advisory. It drives the Due today / Overdue grouping on the list, and it is what the stall sweep measures silence against." />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-remark-go" data-ref={dealRef} disabled={busy} onClick={add}>
          {busy ? "Adding…" : "Add remark"}</button>
      </div>
    </>
  );
}

/* ==========================================================================
   STAGE
   ====================================================================== */
function StageModal({ dealRef, from, onClose, onPick }: {
  dealRef: string; from: number; onClose: () => void; onPick: (to: number) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const targets = Object.keys(D.STAGES).map(Number).filter((t) => t !== from);
  const commit = () => {
    const picked = document.querySelector('input[name="stageTo"]:checked') as HTMLInputElement | null;
    if (!picked) return setErr({ http: 400, code: "", detail: "Choose a target stage." });
    onPick(parseInt(picked.value, 10));
  };
  return (
    <>
      <div className="md-h"><h3>Change stage</h3>
        <p>{dealRef} · currently {D.STAGES[from].label}</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        {targets.map((t) => (
          <label key={t} className="check" style={{ alignItems: "flex-start", border: "1px solid var(--line-2)",
            borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px" }}>
            <input type="radio" name="stageTo" value={t} />
            <span><b>{D.STAGES[t].label}</b>
              {D.STAGES[t].hint ? <> <span className="faint">— {D.STAGES[t].hint}</span></> : null}
              {t < from ? <> <span className="pill warn xs">backward · logged</span></> : null}
            </span>
          </label>
        ))}
        <Notice ico="shield" text={<>
          <b>Every stage is a legal target from every other — there is no matrix to rule one out.</b>{" "}
          Nothing here refuses a move. Picking one asks you to say why, and the deal moves when you
          have: the server requires that reason, and it is the only record of it.
        </>} />
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
  const [busy, setBusy] = useState(false);
  const back = to < from && to !== STAGE.LOST;
  const commit = () => {
    /* Whitespace is not a remark. Trimmed here so " " cannot buy its way past
       the check — and the server trims and refuses it again regardless. */
    const text = String(val("stRemark") || "").trim();
    if (!text) return setErr({ http: 400, code: "",
      detail: "A remark is required — say why the stage is changing." });
    setErr(null); setBusy(true);
    call(AdminOpsService.dealStage(dealRef, apiStageKey(String(to)) as string, text))
      .then(() => done("Stage changed to " + D.STAGES[to].label + ".", dealRef))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });  // stage unchanged; dialog stays open
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
          help="Goes on the transition and on the timeline, under your name and today's date. Appended, never edited — this is the only record of why the stage changed." />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-stage-commit" data-ref={dealRef} data-to={to}
          disabled={busy} onClick={commit}>{busy ? "Moving…" : "Change stage"}</button>
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
  const { dl, loading } = useDeal(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <><div className="md-h"><h3>Set deal value</h3><p>{dealRef}</p><MdX onClose={onClose} /></div><Loading /></>;
  if (!dl) return null;
  const save = () => {
    const typed = val("vAmt").trim();
    setErr(null); setBusy(true);
    call(AdminOpsService.updateDeal(dealRef, { valuePaise: typed ? rupees(typed) : null }))
      .then((row) => done(row.valuePaise
        ? "Deal value set to " + inr(row.valuePaise) + "."
        : "Deal value cleared — back to not quoted yet.", dealRef))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
  };
  return (
    <>
      <div className="md-h"><h3>Set deal value</h3><p>{dealRef} · the agreed total</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="vAmt" label="Total agreed deal value" ph="8,85,000"
          value={dl.deal_value ? rupeeStr(dl.deal_value) : ""}
          help="Stored as integer paise — no float reaches a commercial total. Leave it blank to record that nothing has been quoted yet, which is not the same as ₹0." />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-value-go" data-ref={dealRef} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}</button>
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
  const { dl, loading } = useDeal(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <><div className="md-h"><h3>Close deal</h3><p>{dealRef}</p><MdX onClose={onClose} /></div><Loading /></>;
  if (!dl) return null;

  const commit = () => {
    const picked = document.querySelector('input[name="closeAs"]:checked') as HTMLInputElement | null;
    if (!picked) return setErr({ http: 400, code: "", detail: "Choose Won or Lost." });
    const why = String(val("clReason") || "").trim();
    if (!why) return setErr({ http: 400, code: "",
      detail: "A reason is required — say why this deal is being closed." });
    setErr(null); setBusy(true);
    const to = Number(picked.value);
    call(AdminOpsService.dealStage(dealRef, apiStageKey(String(to)) as string, why))
      .then(() => done("Deal closed " + (to === STAGE.WON ? "Won" : "Lost") + ".", dealRef))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
  };
  return (
    <>
      <div className="md-h"><h3>Close deal</h3><p>{dealRef} · Won or Lost, and reversible either way</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        {dl.stage !== STAGE.WON
          ? <label className="check" style={{ alignItems: "flex-start", border: "1px solid var(--ok-line)",
              borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px", background: "var(--ok-bg)" }}>
              <input type="radio" name="closeAs" value={STAGE.WON} />
              <span><b>Closed - Won</b>
                <div className="help" style={{ marginTop: "3px" }}>
                  {dl.deal_value ? "Worth " + inr(dl.deal_value) + "." : "No value was ever quoted on this deal."}
                </div>
              </span>
            </label>
          : null}
        {dl.stage !== STAGE.LOST
          ? <label className="check" style={{ alignItems: "flex-start", border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)", padding: "11px 13px", marginBottom: "8px" }}>
              <input type="radio" name="closeAs" value={STAGE.LOST} />
              <span><b>Closed - Lost</b>
                <div className="help" style={{ marginTop: "3px" }}>
                  The reason below is stored on the deal as well as on the timeline, so the list can
                  show why without opening it.
                </div>
              </span>
            </label>
          : null}
        <Field id="clReason" label="Reason" req type="textarea" ph="Chose a local vendor on price." />
        <Notice ico="shield" text={<>
          <b>Closing sets a stage, it does not freeze anything.</b> Remarks can still be added
          afterwards, and the deal can be moved back out — a record you cannot annotate is a record
          people keep somewhere else. Closing needs the level-3 <span className="mono">deals.close</span>{" "}
          permission, which the server checks again.
        </>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-close-go" data-ref={dealRef} disabled={busy} onClick={commit}>
          {busy ? "Closing…" : "Close deal"}</button>
      </div>
    </>
  );
}

/* ==========================================================================
   OWNERSHIP
   --------------------------------------------------------------------------
   Owner and co-owner in one dialog, because they are one question — who is
   working this — and two dialogs would let the answers disagree. There is no
   split percentage: nothing server-side stores one, and a number that decides
   somebody's commission is the last thing to invent a home for.
   ====================================================================== */
function ReassignModal({ dealRef, onClose, done }: {
  dealRef: string; onClose: () => void; done: (m: string, r?: string | null) => void;
}) {
  const { dl, loading } = useDeal(dealRef);
  const [err, setErr] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<{ id: number; name: string }[] | null>(null);

  /* The team list, from the admin user endpoint — the same roster Settings →
     Team shows. The deals list only knows the owners who happen to appear on
     the loaded page, which is not who you can hand a deal TO. */
  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.users())
      .then((rows) => { if (!cancelled) setPeople(rows.map((u) => ({ id: u.id, name: u.name || u.username }))); })
      .catch(() => { if (!cancelled) setPeople([]); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <><div className="md-h"><h3>Reassign</h3><p>{dealRef}</p><MdX onClose={onClose} /></div><Loading /></>;
  if (!dl) return null;

  const commit = () => {
    const owner = val("raOwner"), co = val("raCo");
    const body: { ownerId?: number; coOwnerId?: number | null; reason: string } = { reason: val("raReason") };
    if (owner) body.ownerId = Number(owner);
    // "" is the None row and means "no co-owner" — an explicit null clears it.
    if (co !== "__keep") body.coOwnerId = co ? Number(co) : null;
    setErr(null); setBusy(true);
    call(AdminOpsService.dealOwner(dealRef, body))
      .then(() => done("Ownership updated.", dealRef))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
  };

  const opts = (people || []).map((m) => ({ v: String(m.id), l: m.name }));
  return (
    <>
      <div className="md-h"><h3>Reassign</h3><p>{dealRef} · currently {dl.owner_id || "unassigned"}</p><MdX onClose={onClose} /></div>
      <div className="md-b">
        <ErrSlot err={err} />
        {people === null ? <div className="faint">Loading the team…</div> : null}
        <Field id="raOwner" label="Owner" type="select" options={[{ v: "", l: "— leave as it is —" }].concat(opts)}
          help="Everyone with an admin account. A deal always has exactly one owner." />
        <Field id="raCo" label="Co-owner" type="select"
          options={([{ v: "__keep", l: "— leave as it is —" }, { v: "", l: "None" }] as { v: string; l: string }[]).concat(opts)}
          help="A second pair of hands. Optional, and it never removes the owner." />
        <Field id="raReason" label="Reason" req type="textarea"
          ph="Owner on extended leave; customer needs a response this week."
          help="Mandatory, and enforced by the server. It is appended to the timeline as a remark." />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="dl-reassign-go" data-ref={dealRef} disabled={busy} onClick={commit}>
          {busy ? "Saving…" : "Save"}</button>
      </div>
    </>
  );
}
