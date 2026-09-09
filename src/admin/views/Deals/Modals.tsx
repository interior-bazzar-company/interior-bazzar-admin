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
   split or enquiry table server-side. They come back when the models do.
   ============================================================================= */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert, Button, DateInput, FieldRow, FormField, FormSection, Input, ModalShell, Notice, PaneLoading,
  Pill, Radio, Segmented, SelectInput, Textarea
} from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import {
  D, STAGE, apiPriorityKey, apiStageKey, head, inr, refusalOf, rupeeStr, rupees,
  setChan, useDealApi, useDone, useRefuse, val, render
} from "./useDeals";
import type { Params, Refusal } from "./useDeals";
import { ErrSlot, StageChip } from "./bits";
import { TagsModal } from "./Tags";

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

  const edit = (ref: string) => modal(<EditModal dealRef={ref} onClose={close} done={done} />, "lg");
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
      modal(<CreateModal onClose={close} done={done} />, "lg");
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

/** The two footer buttons every dialog here ends on, in the panel's order:
 *  cancel first, the commit last and primary. */
function Commit({ onClose, onGo, busy, label, busyLabel, act, dealRef, ico, tone }: {
  onClose: () => void; onGo: () => void; busy?: boolean; label: string; busyLabel: string;
  act: string; dealRef?: string; ico?: string; tone?: "bad";
}) {
  return (
    <>
      <Button color="secondary" data-close="1" isDisabled={busy} onClick={onClose}>Cancel</Button>
      <Button color={tone === "bad" ? "primary-destructive" : "primary"} ico={ico}
        data-act={act} data-ref={dealRef} isDisabled={busy} onClick={onGo}>
        {busy ? busyLabel : label}
      </Button>
    </>
  );
}

/* THE DEAL IS NOT THERE. useDealApi() reports both "no such deal" and "not in
   your scope" as `deal: null` — the API answers an out-of-scope read with
   not-found, so the dialog cannot tell them apart and does not pretend to.
   Every modal below used to `return null` for it, which left the shell's modal
   layer up over a completely blank dialog. That is reachable any time the list
   is a few seconds stale, which scoping made the ordinary case. */
function Gone({ title, dealRef, onClose }: { title: string; dealRef: string; onClose: () => void }) {
  return (
    <ModalShell title={title} sub={dealRef} mono ico="alert" tone="warning" onClose={onClose}
      actions={<Button color="secondary" data-close="1" onClick={onClose}>Close</Button>}>
      <Alert tone="bad" title="This deal is no longer available.">
        It may have been deleted, or reassigned to somebody else since this list was loaded.
        Close this and reload the list.
      </Alert>
    </ModalShell>
  );
}

/** The waiting state of a dialog that opens over a ref it still has to fetch. */
function Opening({ title, dealRef, onClose }: { title: string; dealRef: string; onClose: () => void }) {
  return (
    <ModalShell title={title} sub={dealRef} mono onClose={onClose}>
      <PaneLoading label={"Opening " + dealRef + "…"} />
    </ModalShell>
  );
}

/* ==========================================================================
   NEW DEAL
   ====================================================================== */
/* Identity first, then what they want, then how hard to chase — the order a
   person actually takes an inbound call in. Priority is a segmented control
   rather than a dropdown: three options are not worth a menu. */
const PRIO_PICKS = [{ v: "1", l: "Normal" }, { v: "2", l: "High" }, { v: "3", l: "Urgent" }];

function PrioRow({ id, value, onPick }: { id: string; value: string; onPick: (v: string) => void }) {
  return (
    <>
      <Segmented sm label="Priority" options={PRIO_PICKS} value={value} onPick={onPick} />
      {/* The segmented picker writes to a hidden input, so anything still
          reading plain values through val() keeps working. */}
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
    <ModalShell ico="deal" tone="brand" title="New deal"
      sub="Off-funnel business — an inbound call, a walk-in, a referral."
      onClose={onClose}
      actions={<Commit onClose={onClose} onGo={() => submit(false)} busy={busy} ico="plus"
        label="Create deal" busyLabel="Creating…" act="dl-create-go" />}
    >
      <div className="flex flex-col gap-6">
        <ErrSlot err={err} />
        {dupRef
          ? <Alert tone="warn" title={dupRef + " is already open on this number."}>
              Add what was said as a remark there instead of starting a second pipeline — or create
              this one anyway if it is genuinely different business.
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button color="secondary" size="xs" onClick={() => { shell.closeLayer(); go("#/deals/" + dupRef); }}>
                  Open {dupRef}</Button>
                <Button color="secondary-destructive" size="xs" isDisabled={busy} onClick={() => submit(true)}>
                  Create anyway</Button>
              </div>
            </Alert>
          : null}

        <FormSection title="Who">
          <FieldRow>
            <FormField id="cName" label="Customer name" req>
              <Input id="cName" ph="e.g. Sandeep Kulkarni" />
            </FormField>
            {/* Optional — a walk-in customer is often a person before they are
                a business, and blocking on it would stall the call. */}
            <FormField id="cBiz" label="Business name">
              <Input id="cBiz" ph="e.g. KitchenCraft" />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField id="cPhone" label="Mobile" req
              hint="Checked against every open deal before anything is created — on the digits, so 090322… and +91 90322… are one customer.">
              <Input id="cPhone" ph="98100 00000" mono />
            </FormField>
            <FormField id="cEmail" label="Email">
              <Input id="cEmail" type="email" ph="name@company.in" />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField id="cCity" label="City"><Input id="cCity" ph="e.g. Mumbai" /></FormField>
            <FormField id="cState" label="State"><Input id="cState" ph="e.g. Maharashtra" /></FormField>
          </FieldRow>
        </FormSection>

        <FormSection title="What they want">
          {/* The package they asked about, not the service they sell. It is a
              note of what was said on the call and binds nothing downstream. */}
          <FormField id="cInterest" label="Interested in"
            hint="Which package they asked about. Free text, and indicative only.">
            <Input id="cInterest" ph="e.g. AutoGrowth · Growth" />
          </FormField>
        </FormSection>

        <FormSection title="How urgent">
          <FormField label="Priority" hint="Visual triage only. It never influences who the deal goes to.">
            <PrioRow id="cPrio" value={prio} onPick={setPrio} />
          </FormField>
        </FormSection>

        <Notice ico="shield" text={<>
          <b>This deal is yours.</b> It is assigned to you, the person taking the call — there is no
          round-robin rotation behind this panel, so a deal goes to whoever created it and is
          reassigned by name when it should sit with somebody else.
        </>} />
      </div>
    </ModalShell>
  );
}

/* ==========================================================================
   EDIT DEAL
   --------------------------------------------------------------------------
   Every field on the deal that is a FACT about it, in one form. What is NOT
   here is as deliberate as what is:

     Stage    the record's stage button owns it, and a dropdown that can refuse
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

  if (loading) return <Opening title="Edit deal" dealRef={dealRef} onClose={onClose} />;
  if (!dl) return <Gone title="Edit deal" dealRef={dealRef} onClose={onClose} />;
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
    <ModalShell ico="deal" tone="brand" title="Edit deal" mono
      sub={<>{dealRef} · {dl.customer_name}</>} onClose={onClose}
      actions={<Commit onClose={onClose} onGo={save} busy={busy}
        label="Save changes" busyLabel="Saving…" act="dl-edit-go" dealRef={dealRef} />}
    >
      <div className="flex flex-col gap-6">
        <ErrSlot err={err} />
        <FormSection title="Who">
          <FieldRow>
            <FormField id="eName" label="Customer name" req>
              <Input id="eName" defaultValue={dl.customer_name} />
            </FormField>
            <FormField id="eBiz" label="Business name">
              <Input id="eBiz" defaultValue={dl.business_name || ""} />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField id="ePhone" label="Mobile" req
              hint="No two OPEN deals may share a number — the server checks the digits, not the formatting.">
              <Input id="ePhone" mono defaultValue={dl.phone || ""} />
            </FormField>
            <FormField id="eEmail" label="Email">
              <Input id="eEmail" type="email" defaultValue={dl.email || ""} />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField id="eCity" label="City">
              <Input id="eCity" defaultValue={dl.city === "—" ? "" : dl.city || ""} />
            </FormField>
            <FormField id="eState" label="State">
              <Input id="eState" defaultValue={dl.state === "—" ? "" : dl.state || ""} />
            </FormField>
          </FieldRow>
        </FormSection>

        <FormSection title="What they want">
          <FormField id="eInterest" label="Interested in"
            hint="Indicative only — what they asked about on the call.">
            <Input id="eInterest" defaultValue={dl.interested_in === "—" ? "" : dl.interested_in || ""} />
          </FormField>
        </FormSection>

        <FormSection title="Money">
          {closed
            ? <Notice ico="shield" text={<>
                This deal is <b>{D.STAGES[dl.stage].label}</b>, so its value is settled history:{" "}
                {dl.deal_value ? inr(dl.deal_value) : "never quoted"}. Move it back to an open stage
                first if that figure is genuinely wrong.
              </>} />
            : <FormField id="eValue" label="Deal value"
                hint="The agreed total, in rupees, stored as integer paise. Clear it to put the deal back to “not quoted yet” — which is not the same as ₹0.">
                <Input id="eValue" mono ph="e.g. 1,20,000" defaultValue={dl.deal_value ? rupeeStr(dl.deal_value) : ""} />
              </FormField>}
        </FormSection>

        <FormSection title="Timing and triage">
          <FormField label="Priority"
            hint="Triage only — it never changes who the deal goes to, what it is worth, or which stage it can reach.">
            <PrioRow id="ePrio" value={prioNow} onPick={setPrio} />
          </FormField>
          <FormField id="eClose" label="Expected close" hint="An annotation. It gates nothing and feeds no target.">
            <DateInput id="eClose" defaultValue={dl.expected_close_date || ""} ariaLabel="Expected close" />
          </FormField>
        </FormSection>
      </div>
    </ModalShell>
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
    <ModalShell ico="note" title="Add remark" mono sub={<>{dealRef} · appended, never edited</>}
      onClose={onClose}
      actions={<Commit onClose={onClose} onGo={add} busy={busy}
        label="Add remark" busyLabel="Adding…" act="dl-remark-go" dealRef={dealRef} />}
    >
      <div className="flex flex-col gap-5">
        <ErrSlot err={err} />
        <FormField id="rText" label="What happened" req>
          <Textarea id="rText" rows={4} autoFocus
            ph="Called — customer is comparing two quotes, wants a revision on the kitchen line." />
        </FormField>
        <FormField id="rNext" label="Next action date"
          hint="Advisory. It drives the Due today / Overdue grouping on the list, and it is what the stall sweep measures silence against.">
          <DateInput id="rNext" ariaLabel="Next action date" />
        </FormField>
      </div>
    </ModalShell>
  );
}

/* ==========================================================================
   STAGE
   ====================================================================== */
function StageModal({ dealRef, from, onClose, onPick }: {
  dealRef: string; from: number; onClose: () => void; onPick: (to: number) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [to, setTo] = useState<string>("");
  const targets = Object.keys(D.STAGES).map(Number).filter((t) => t !== from);
  const commit = () => {
    if (!to) return setErr({ http: 400, code: "", detail: "Choose a target stage." });
    onPick(parseInt(to, 10));
  };
  return (
    <ModalShell ico="route" title="Change stage" mono
      sub={<>{dealRef} · currently {D.STAGES[from].label}</>} onClose={onClose}
      actions={<Commit onClose={onClose} onGo={commit} label="Change stage" busyLabel="" act="dl-stage-go" dealRef={dealRef} />}
    >
      <div className="flex flex-col gap-4">
        <ErrSlot err={err} />
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Target stage">
          {targets.map((t) => (
            <label key={t}
              className={"flex cursor-pointer gap-3 rounded-lg bg-primary p-3 ring-1 transition duration-100 ring-inset " +
                (String(t) === to ? "ring-2 ring-brand bg-brand-primary" : "ring-secondary hover:ring-primary")}>
              <Radio name="stageTo" value={String(t)} checked={String(t) === to} onChange={setTo} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <StageChip stage={t} />
                  {t < from ? <Pill xs tone="warn" text="backward · logged" /> : null}
                </span>
                {D.STAGES[t].hint ? <span className="text-sm text-tertiary">{D.STAGES[t].hint}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <Notice ico="shield" text={<>
          <b>Every stage is a legal target from every other — there is no matrix to rule one out.</b>{" "}
          Nothing here refuses a move. Picking one asks you to say why, and the deal moves when you
          have: the server requires that reason, and it is the only record of it.
        </>} />
      </div>
    </ModalShell>
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
    <ModalShell ico="route" title="Change stage" mono sub={<>{dealRef} · a remark is required</>}
      onClose={onClose}
      actions={<Commit onClose={onClose} onGo={commit} busy={busy}
        label="Change stage" busyLabel="Moving…" act="dl-stage-commit" dealRef={dealRef} />}
    >
      <div className="flex flex-col gap-5">
        <ErrSlot err={err} />
        {/* Both stages on one line, in the order the deal moves through them, so
            "what am I about to do" is answered without reading a sentence. */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2.5">
          <StageChip stage={from} />
          <span aria-hidden="true" className="text-quaternary">→</span>
          <StageChip stage={to} />
          {back ? <Pill xs tone="warn" text="backward · logged" /> : null}
        </div>
        <FormField id="stRemark" label="What changed" req
          hint="Goes on the transition and on the timeline, under your name and today's date. Appended, never edited — this is the only record of why the stage changed.">
          <Textarea id="stRemark" rows={4} autoFocus
            ph={D.STAGES[to].hint
              ? "Why the deal is now " + D.STAGES[to].label + ". " + D.STAGES[to].hint + "."
              : "Why the deal is now " + D.STAGES[to].label + "."} />
        </FormField>
      </div>
    </ModalShell>
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
  if (loading) return <Opening title="Set deal value" dealRef={dealRef} onClose={onClose} />;
  if (!dl) return <Gone title="Set deal value" dealRef={dealRef} onClose={onClose} />;
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
    <ModalShell ico="rupee" title="Set deal value" mono sub={<>{dealRef} · the agreed total</>}
      onClose={onClose}
      actions={<Commit onClose={onClose} onGo={save} busy={busy}
        label="Save" busyLabel="Saving…" act="dl-value-go" dealRef={dealRef} />}
    >
      <div className="flex flex-col gap-4">
        <ErrSlot err={err} />
        <FormField id="vAmt" label="Total agreed deal value"
          hint="Stored as integer paise — no float reaches a commercial total. Leave it blank to record that nothing has been quoted yet, which is not the same as ₹0.">
          <Input id="vAmt" mono autoFocus ph="8,85,000" defaultValue={dl.deal_value ? rupeeStr(dl.deal_value) : ""} />
        </FormField>
      </div>
    </ModalShell>
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
  const [as, setAs] = useState<string>("");
  if (loading) return <Opening title="Close deal" dealRef={dealRef} onClose={onClose} />;
  if (!dl) return <Gone title="Close deal" dealRef={dealRef} onClose={onClose} />;

  const commit = () => {
    if (!as) return setErr({ http: 400, code: "", detail: "Choose Won or Lost." });
    const why = String(val("clReason") || "").trim();
    if (!why) return setErr({ http: 400, code: "",
      detail: "A reason is required — say why this deal is being closed." });
    setErr(null); setBusy(true);
    const to = Number(as);
    call(AdminOpsService.dealStage(dealRef, apiStageKey(String(to)) as string, why))
      .then(() => done("Deal closed " + (to === STAGE.WON ? "Won" : "Lost") + ".", dealRef))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
  };

  const outcome = (v: number, title: string, hint: ReactNode, tone: "ok" | "bad") => (
    <label className={"flex cursor-pointer gap-3 rounded-lg p-3 ring-1 transition duration-100 ring-inset " +
      (as === String(v)
        ? (tone === "ok" ? "bg-success-primary ring-2 ring-utility-green-300" : "bg-error-primary ring-2 ring-utility-red-300")
        : "bg-primary ring-secondary hover:ring-primary")}>
      <Radio name="closeAs" value={String(v)} checked={as === String(v)} onChange={setAs} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <Pill dot tone={tone} text={title} />
        </span>
        <span className="text-sm text-tertiary">{hint}</span>
      </span>
    </label>
  );

  return (
    <ModalShell ico="alert" tone="error" title="Close deal" mono
      sub={<>{dealRef} · Won or Lost, and reversible either way</>} onClose={onClose}
      actions={<Commit onClose={onClose} onGo={commit} busy={busy} tone="bad"
        label="Close deal" busyLabel="Closing…" act="dl-close-go" dealRef={dealRef} />}
    >
      <div className="flex flex-col gap-4">
        <ErrSlot err={err} />
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Outcome">
          {dl.stage !== STAGE.WON
            ? outcome(STAGE.WON, "Closed - Won",
                dl.deal_value ? "Worth " + inr(dl.deal_value) + "." : "No value was ever quoted on this deal.", "ok")
            : null}
          {dl.stage !== STAGE.LOST
            ? outcome(STAGE.LOST, "Closed - Lost",
                "The reason below is stored on the deal as well as on the timeline, so the list can show why without opening it.", "bad")
            : null}
        </div>
        <FormField id="clReason" label="Reason" req>
          <Textarea id="clReason" rows={3} ph="Chose a local vendor on price." />
        </FormField>
        <Notice ico="shield" text={<>
          <b>Closing sets a stage, it does not freeze anything.</b> Remarks can still be added
          afterwards, and the deal can be moved back out — a record you cannot annotate is a record
          people keep somewhere else. Closing needs the level-3{" "}
          <span className="font-mono">deals.close</span> permission, which the server checks again.
        </>} />
      </div>
    </ModalShell>
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
  /* Kept apart from `err`, which belongs to the SAVE. The roster failing is not
     a failed reassignment, it just means there is nothing to pick from. */
  const [teamErr, setTeamErr] = useState<Refusal | null>(null);
  /* THE TWO PICKS LIVE IN STATE, not in the DOM. `SelectInput` renders the
     library's native select, which owns its own element id — so `val("raOwner")`
     reads nothing at all and the dialog would post an empty patch. State is
     also what lets the hidden inputs below keep the ids anything else expects. */
  const [owner, setOwner] = useState("");
  const [co, setCo] = useState("__keep");

  /* The team list, from the admin user endpoint — the same roster Settings →
     Team shows. The deals list only knows the owners who happen to appear on
     the loaded page, which is not who you can hand a deal TO. */
  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.users())
      .then((rows) => { if (!cancelled) setPeople(rows.map((u) => ({ id: u.id, name: u.name || u.username }))); })
      /* Reassign is gated on `deals.close`, NOT on team-module access, so a
         sales head whose role has no /users/ grant lands here every time. It
         used to fail silently: the "Loading the team…" line vanished and left
         two selects holding nothing but "— leave as it is —". Say so. */
      .catch((e: unknown) => { if (!cancelled) { setPeople([]); setTeamErr(refusalOf(e)); } });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Opening title="Reassign" dealRef={dealRef} onClose={onClose} />;
  if (!dl) return <Gone title="Reassign" dealRef={dealRef} onClose={onClose} />;

  const commit = () => {
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
  /* WHO HOLDS IT NOW, ON THE ROWS THAT DECIDE IT. Both selects default to a
     keep-option, and "— leave as it is —" does not say what it is leaving: the
     person adding a co-owner could not see whose deal they were adding
     themselves to without closing the dialog. Worse when the roster fails to
     load, which is the state a sales head is permanently in.

     Read off the deal, never off `people`: the deal is already loaded by the
     time this renders, so the current owner and co-owner are legible even when
     the roster call was refused outright. */
  const ownerNow = dl.owner_id || "unassigned";
  const coOwnerNow = dl.co_owner_id || "none";

  return (
    <ModalShell ico="recon" title="Reassign" mono
      sub={<>{dealRef} · owner {ownerNow} · co-owner {coOwnerNow}</>} onClose={onClose}
      actions={<Commit onClose={onClose} onGo={commit} busy={busy}
        label="Save" busyLabel="Saving…" act="dl-reassign-go" dealRef={dealRef} />}
    >
      <div className="flex flex-col gap-5">
        <ErrSlot err={err} />
        {people === null ? <PaneLoading label="Loading the team…" /> : null}
        {teamErr
          ? <Alert tone="bad" title="The team list could not be loaded.">
              This dialog reads the same roster as Settings → Team, which your role may not
              include — there is nobody to pick from until an Admin grants it.{" "}
              <span className="font-mono">{teamErr.detail}</span>
            </Alert>
          : null}
        <FormField label="Owner" hint="Everyone with an admin account. A deal always has exactly one owner.">
          <SelectInput ariaLabel="Owner" value={owner} onChange={setOwner}
            options={[{ v: "", l: "— leave as it is (" + ownerNow + ") —" }].concat(opts)} />
          <input type="hidden" id="raOwner" value={owner} readOnly />
        </FormField>
        <FormField label="Co-owner" hint="A second pair of hands. Optional, and it never removes the owner.">
          <SelectInput ariaLabel="Co-owner" value={co} onChange={setCo}
            options={([{ v: "__keep", l: "— leave as it is (" + coOwnerNow + ") —" }, { v: "", l: "None" }] as { v: string; l: string }[]).concat(opts)} />
          <input type="hidden" id="raCo" value={co} readOnly />
        </FormField>
        <FormField id="raReason" label="Reason" req
          hint="Mandatory, and enforced by the server. It is appended to the timeline as a remark.">
          <Textarea id="raReason" rows={3} ph="Owner on extended leave; customer needs a response this week." />
        </FormField>
      </div>
    </ModalShell>
  );
}
