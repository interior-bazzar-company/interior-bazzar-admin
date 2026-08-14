/* =============================================================================
   STEP 2 — the builder
   -----------------------------------------------------------------------------
   WHAT WAS WRONG WITH IT, and what changed. Nothing was removed; every field,
   every control and every write is still here. What moved is where they sit.

     · THREE Apply buttons, in three unrelated places. "Apply changes" for the
       dates and the place of supply lived in the summary card — in the OTHER
       COLUMN from the fields it saved. "Apply" for the plan sat in the plan
       card. "Apply" for the add-ons sat under their table. Nothing told you
       which of the three was still unsaved, and pressing one silently left
       the other two behind.
       → ONE Save, in the sticky rail, that writes all three. The engine calls
         are unchanged and still separate; what is one is the button.

     · TAX HAD TWO CONTROLS — the strip at the top and the toggle in the
       summary — for one stored value.
       → One, in the summary, beside the number it changes.

     · ADD-ON ENTRY HAD THREE ENTRY POINTS: the strip, the empty state, and
       the table footer.
       → One, in the section that already holds what the customer is buying.

     · FIVE EQUAL SECTIONS for what is really three questions. "From and Bill
       to" had a heading and a card of its own for text nobody can edit here.
       → Three numbered steps, in the order the document itself reads: who and
         when, what they are buying, what it says. Bill-to is reference, so it
         is a strip inside step 1 rather than a section competing with it.

   The right rail is unchanged in content and is now the only thing on the
   page that both shows the total and commits to it.
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Field, Icon, Notice, Pill, Table } from "../../ui";
import { useNav } from "../../shell/AdminShell";
import { D, E, Q, inr } from "./core";
import { MenuBtn, useQtActions } from "./useQuotations";
import type { QtActions } from "./useQuotations";

export default function Builder({ q }: { q: any; p: Record<string, string> }) {
  const act = useQtActions();
  const { go } = useNav();
  const plan = Q.planOf(q.quotation_id), addons = Q.addonsOf(q.quotation_id);
  const t = Q.price(q, Q.itemsOf(q.quotation_id));
  const cs = Q.partyOf(q);
  const blockers = Q.Issuance.blockers(q.quotation_id);
  // The deal may have moved city since this draft was created — the stored
  // place_of_supply does not follow it (see snapshotOf / partyOf), so a
  // drift is worth a word without rewriting the field out from under anyone.
  const dl = E.dealOf(q.deal_id);
  const derivedPos = dl ? Q.stateOf(dl.city) : null;
  const posStale = derivedPos && derivedPos !== q.place_of_supply;

  return (
    <div className="page wide">
      <div className="ph">
        <div className="ph-t">
          <div className="faint" style={{ fontSize: "var(--text-sm)" }}>
            Step 2 of 2 · <a className="lnk" data-go={"#/deals/" + q.deal_id}
              onClick={() => go("#/deals/" + q.deal_id)}>{q.deal_id}</a> · v{q.version}
          </div>
          <h1>{q.parent_quotation_id ? "Revision" : "New quotation"}</h1>
          <div className="scope">
            <Pill text="Draft" /> <span className="mono">Number assigned on issue</span>
          </div>
        </div>
        <div className="acts">
          <button className="btn" data-go={"#/quotations/" + q.quotation_id}
            onClick={() => go("#/quotations/" + q.quotation_id)}><Icon name="chevl" />Back</button>
          <button className="btn pri" data-go={"#/quotations/" + q.quotation_id + "?mode=preview"}
            onClick={() => go("#/quotations/" + q.quotation_id + "?mode=preview")}>Preview &amp; issue</button>
          <MenuBtn r={q.quotation_id} act={act} />
        </div>
      </div>

      <div className="qbld">
        <div>

          {/* ---- 1 · who, and when ---- */}
          <Step n={1} title="Who and when" hint="snapshotted from the deal, frozen again at issue" />
          <div className="card"><div className="card-b">
            {/* Reference, not input: it reads as a strip, not as a form somebody
                is meant to fill in and then wonders why they cannot. */}
            <div className="qparties">
              <div><span className="qparties-k">From</span>
                <b>{Q.SELLER.brand}</b><br />
                <span className="faint">{Q.SELLER.tagline}</span><br />
                {Q.SELLER.addr}<br />
                <span className="mono">{Q.SELLER.gstin ? "GSTIN " + Q.SELLER.gstin : "CIN " + Q.SELLER.cin}</span>
              </div>
              <div><span className="qparties-k">Bill to</span>
                <b>{cs.name || "—"}</b>
                {cs.business ? " · " + cs.business : ""}<br />
                {cs.address || cs.city || "—"}<br />
                <span className="mono">{cs.phone || "—"}</span>{" "}
                <a className="lnk" data-go={"#/deals/" + q.deal_id}
                  onClick={() => go("#/deals/" + q.deal_id)}>Edit on deal ↗</a>
              </div>
            </div>
            <div className="f3" style={{ marginTop: "var(--space-4)" }}>
              <Field id="qDate" label="Quotation date" type="date" value={q.quotation_date} />
              <Field id="qValid" label="Valid until" type="date" value={q.valid_until}
                help={"Defaults to +" + Q.DEFAULT_VALIDITY_DAYS + " days (QT-OD-02)."} />
              <Field id="qPos" label="Place of supply" type="select"
                options={Q.STATES.map((s2: string) => ({ v: s2, l: s2, sel: s2 === q.place_of_supply }))}
                help="Drives the CGST/SGST ↔ IGST split." />
            </div>
            {posStale
              ? <Notice tone="warn" ico="alert" text={
                  <><b>The deal's city now maps to {derivedPos}</b> — this quotation still says{" "}
                    {q.place_of_supply}. Update it if that's not intentional.</>} />
              : null}
            <div className="help">Nothing here is retyped. It is snapshotted from the deal at creation and{" "}
              <b>frozen again at issue</b> — a later change to the deal never rewrites a document the
              customer already holds.</div>
          </div></div>

          {/* ---- 2 · what they are buying ----
              The plan and the one-off charges are one question, so they are one
              card. Two sections with two Apply buttons made "what is on this
              quotation" something you had to assemble from two places. */}
          <Step n={2} title="What they are buying" hint="one plan, and anything one-off beside it" />
          <div className="card">
            <PlanBlock q={q} plan={plan} act={act} />
            <AddonBlock q={q} addons={addons} act={act} />
          </div>

          {/* ---- 3 · what it says ---- */}
          <Step n={3} title="What it says" hint="printed on the document, under the figures" />
          <div className="card"><div className="card-b">
            <Field id="qNotes" label="Notes (customer-facing)" type="textarea" value={q.notes}
              ph="Anything the customer should read alongside the price." />
            <Field id="qTerms" label="Commercial terms" type="textarea" value={q.terms} rows={6} />
          </div></div>
        </div>

        {/* right rail · the live summary, and the one commit */}
        <div className="qbld-rail">
          <SummaryCard q={q} t={t} plan={plan} addons={addons} blockers={blockers} act={act} />
        </div>
      </div>
    </div>
  );
}

/* A numbered step rather than a section heading. Five equal headings read as
   a list of five things; three numbers read as a sequence you are part way
   through, which is what a two-step builder should feel like. */
function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="qstep"><span className="qstep-n">{n}</span>
      <div><b>{title}</b>{hint ? <span className="qstep-h">{hint}</span> : null}</div>
    </div>
  );
}

/* The plan, as the top half of "what they are buying". It returns a card BODY
   now, not a card — its other half is the one-off charges, and the two share
   one surface because they are one answer. */
function PlanBlock({ q, plan, act }: { q: any; plan: any; act: QtActions }) {
  if (!plan) return <div className="card-b faint">No plan block.</div>;
  const n = Q.lineNet(plan);
  const ip = Q.installmentPlan(plan);
  return (
    <div className="card-b">
      <div className="qplan-h">
        <div>
          <div className="qplan-nm">{plan.name}</div>
          <div className="faint" style={{ fontSize: "var(--text-md)" }}>{plan.description}</div>
        </div>
        <div className="qplan-amt">
          <b className="tnum">{inr(n.net)}</b>
          {n.disc ? <span className="faint tnum"><s>{inr(n.base)}</s> −{inr(n.disc)}</span> : null}
        </div>
        <button className="btn sm" data-act="qt-plan" data-ref={q.quotation_id}
          onClick={() => act.plan(q.quotation_id)}>Change plan</button>
      </div>

      {/* The features are what the tier IS, so they stay — but folded, because
          ten pills between the plan name and the price you are negotiating put
          the two things you are comparing on different screens. */}
      <details className="qfeat">
        <summary>{(plan.features || []).length} features included</summary>
        <div>
          {(plan.features || []).map((f: any, i: number) =>
            <span className="pill xs" title={f.text} key={i}>{f.label}</span>)}
          <div className="help">Snapshotted from <span className="mono">IBPlanInfo</span> — the same registry the
            pricing page reads. A later edit to the plan sheet cannot rewrite a proposal already sent.</div>
        </div>
      </details>

      <div className="f3" style={{ marginTop: "var(--space-3)" }}>
        <Field id="pTerm" label="Term (months)" type="number" value={plan.term_months} help="Replaces quantity." />
        <Field id="pTotal" label="Total amount ₹" value={Math.round(n.base / 100)}
          help="One negotiated total for the full term." />
        <div className="fg"><label htmlFor="pDisc">Discount</label>
          <div className="qdisc">
            <input className="inp" id="pDisc" type="number" defaultValue={plan.discount_value} />
            <select className="inp" id="pDiscT" defaultValue={plan.discount_type}>
              <option value="pct">%</option>
              <option value="amt">₹</option>
            </select>
          </div>
          <div className="help">Above 30%, Module 1 turns off Target 2 eligibility on this deal.</div>
        </div>
      </div>

      <div className="f2" style={{ marginTop: "var(--space-2)" }}>
        <Field id="pInstallments" label="Payments" type="select"
          options={[1, 2, 3, 4, 5].map((k) => ({
            v: String(k), l: k === 1 ? "1 (full amount)" : k + " payments", sel: k === ip.count
          }))}
          help="How many payments the total splits into." />
        {ip.count > 1
          ? <Field id="pGap" label="Gap between payments" type="select"
              options={[1, 2, 3, 4, 5].map((k) => ({
                v: String(k), l: k === 1 ? "Every month" : "Every " + k + " months", sel: k === ip.gap
              }))}
              help="A yearly package can be paid quarterly; a short one, monthly." />
          : <div className="fg"><span className="fg-lb">Gap between payments</span>
              <div className="help">Paid in full, so there is no gap to set.</div></div>}
      </div>
      {ip.count > 1 ? <ScheduleStrip q={q} plan={plan} ip={ip} /> : null}
    </div>
  );
}

/* The dates the cadence produces, right under the two controls that produce
   them — because "every 3 months" is the setting and "the last one lands in
   March" is the consequence, and the consequence is what gets argued about. */
function ScheduleStrip({ q, plan, ip }: { q: any; plan: any; ip: any }) {
  const sched: any[] = Q.installmentSchedule(q.quotation_id) || [];
  const over = ip.spans > (plan.term_months || 0);
  return (
    <div className="fg" style={{ marginBottom: 0 }}><span className="fg-lb">Schedule</span>
      <div className="emirow">
        {sched.map((r, i) => (
          /* the gap chip is a SIBLING of the payment chips, not a wrapper —
             `.emirow` lays all of them out on one line */
          <Fragment key={r.seq}>
            {i ? <span className="emi-gap">{ip.gap}m</span> : null}
            <span className={"emi" + (i === 0 ? " first" : "")}
              title={"Payment " + r.seq + " of " + ip.count + " · " + inr(r.amount_paise)}>
              <b className="tnum">{inr(r.amount_paise, { compact: true })}</b>
              <i>{D.fmtDate(r.due_date)}</i>
            </span>
          </Fragment>
        ))}
      </div>
      <div className={"help" + (over ? " warn" : "")}>
        {over
          ? "The last payment falls " + (ip.spans - (plan.term_months || 0)) +
            " month(s) after the " + plan.term_months + "-month term ends. Allowed — worth a word to the customer."
          : ip.count + " payments of " + inr(sched.length ? sched[0].amount_paise : 0) +
            ", finishing " + (ip.spans ? "in month " + ip.spans + " of " + plan.term_months : "immediately") + "."}
      </div>
    </div>
  );
}

/* The other half of the same card. One entry point, in the place the thing it
   adds will appear — there used to be three, and none of them was here. */
function AddonBlock({ q, addons, act }: { q: any; addons: any[]; act: QtActions }) {
  const head = (
    <div className="qaddon-h">
      <span><b>One-off charges</b>
        <span className="faint"> · {addons.length ? addons.length + " on this quotation"
          : "onboarding, a shoot, a custom build — no months, no quantity"}</span></span>
      <button className="btn sm" data-act="qt-addon-add" data-ref={q.quotation_id}
        onClick={() => act.addonAdd(q.quotation_id)}><Icon name="plus" />Add a charge</button>
    </div>
  );

  if (!addons.length) return <div className="card-b qaddon">{head}</div>;

  return (
    <div className="card-b qaddon">
      {head}
      <Table
        cols={[{ label: "#", w: "32px" }, { label: "Description" }, { label: "HSN / SAC", w: "104px" },
          { label: "Discount", w: "142px" }, { label: "Amount ₹", cls: "n", w: "128px" }, { label: "", w: "40px" }]}
        rows={addons.map((it: any, ix: number) => {
          const n = Q.lineNet(it);
          return (
            <tr key={it.item_id}>
              <td className="faint">{ix + 1}</td>
              <td><input className="inp sm" id={"a-nm-" + it.item_id} defaultValue={it.name} /></td>
              <td><input className="inp sm" id={"a-hs-" + it.item_id} defaultValue={it.hsn || ""} /></td>
              <td><div style={{ display: "flex", gap: "4px" }}>
                <input className="inp sm" id={"a-dv-" + it.item_id} defaultValue={it.discount_value} style={{ width: "58px" }} />
                <select className="inp sm" id={"a-dt-" + it.item_id} defaultValue={it.discount_type} style={{ width: "54px" }}>
                  <option value="pct">%</option>
                  <option value="amt">₹</option>
                </select>
              </div></td>
              <td className="n">
                <input className="inp sm n" id={"a-am-" + it.item_id} defaultValue={Math.round(it.amount_paise / 100)} />
                {n.disc ? <div className="cell-2">net {inr(n.net)}</div> : null}
              </td>
              <td className="c">
                <button className="btn sm icon dgr" data-act="qt-addon-del" data-ref={q.quotation_id}
                  data-item={it.item_id} onClick={() => act.addonDel(q.quotation_id, it.item_id)}>
                  <Icon name="x" /></button>
              </td>
            </tr>
          );
        })}
      />
    </div>
  );
}

function SummaryCard({ q, t, plan, addons, blockers, act }: {
  q: any; t: any; plan: any; addons: any[]; blockers: any[]; act: QtActions;
}) {
  const row = (k: ReactNode, v: ReactNode, extra?: CSSProperties) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", ...extra }}>
      <span>{k}</span><span className="tnum">{v}</span>
    </div>
  );
  const applicable = Q.taxApplicable(q);
  return (
    <div className="card">
      <div className="card-h"><h3>Summary</h3><span className="d">display only — the server recomputes</span></div>
      <div className="card-b">
        {row("Plan · " + (plan ? plan.term_months + " months" : "—"), inr(plan ? Q.lineNet(plan).base : 0))}
        {addons.length ? row("Add-ons", inr(addons.reduce((a: number, i: any) => a + Q.lineNet(i).base, 0))) : null}
        {row(<b>Gross amount</b>, <b>{inr(t.gross)}</b>, { borderTop: "1px solid var(--line)", marginTop: "4px" })}
        {t.discount
          ? row(<span style={{ color: "var(--warn)" }}>Discount</span>,
              <span style={{ color: "var(--warn)" }}>−{inr(t.discount)}</span>)
          : null}
        {row("Taxable value", inr(t.taxable), { borderTop: "1px solid var(--line)" })}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
          <span>Tax</span>
          <div className="btn-group">
            <button className={applicable ? "on" : ""} data-act="qt-tax-mode" data-ref={q.quotation_id}
              data-v={Q.TAX_MODE.APPLICABLE} onClick={() => act.taxMode(q.quotation_id, Q.TAX_MODE.APPLICABLE)}>
              Applicable</button>
            <button className={!applicable ? "on" : ""} data-act="qt-tax-mode" data-ref={q.quotation_id}
              data-v={Q.TAX_MODE.NOT_APPLICABLE} onClick={() => act.taxMode(q.quotation_id, Q.TAX_MODE.NOT_APPLICABLE)}>
              Not applicable</button>
          </div>
        </div>
        {applicable
          ? <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
                <span>GST rate</span>
                <select className="inp sm" id="qGst" style={{ width: "96px" }} defaultValue={String(q.gst_rate)}>
                  {Q.GST_RATES.map((r: number) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              {t.intra
                ? <>
                    {row("CGST (" + (t.gst_rate / 2) + "%)", inr(t.cgst))}
                    {row("SGST (" + (t.gst_rate / 2) + "%)", inr(t.sgst))}
                  </>
                : row("IGST (" + t.gst_rate + "%)", inr(t.igst))}
            </>
          : <div className="help" style={{ marginTop: "10px" }}><b>Tax not applicable.</b> The grand total excludes
              GST entirely — the Sales Team's explicit choice for this quotation, for a client paying with
              no tax.</div>}
        {row(<b style={{ fontSize: "var(--text-lg)" }}>Grand total</b>,
          <b style={{ fontSize: "var(--text-lg)" }}>{inr(t.grand_total)}</b>,
          { borderTop: "2px solid var(--line-2)", marginTop: "6px", paddingTop: "9px" })}
        <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "4px" }}>
          {D.inrWords ? D.inrWords(t.grand_total) : ""}
        </div>
        {applicable
          ? <div className="help" style={{ marginTop: "10px" }}>
              {t.intra
                ? <><b>Intra-state.</b> Place of supply is {q.place_of_supply}, the same state as
                  Interior bazzar — so GST splits into CGST + SGST.</>
                : <><b>Inter-state.</b> Place of supply is {q.place_of_supply} and Interior bazzar is in{" "}
                  {Q.SELLER.state} — so a single IGST applies.</>}
            </div>
          : null}
      </div>
      {/* THE save. One button for the whole page, in the one place that already
          shows what every field on it adds up to. There were three, in three
          columns, and nothing said which of them still had unwritten work. */}
      <div className="card-f qsave">
        <button className="btn pri" data-act="qt-save-all" data-ref={q.quotation_id}
          onClick={() => act.saveAll(q.quotation_id)}><Icon name="check" />Save changes</button>
        <span className="qsave-h">Writes the dates, the plan and the charges together.</span>
      </div>
      {blockers.length
        ? <div className="card-f">
            <Notice tone="bad" text={
              <><b>Cannot be issued yet</b>
                <ul style={{ margin: "5px 0 0 16px" }}>
                  {blockers.map((b: any) => <li key={b.code}>{b.text} <span className="mono">422 {b.code}</span></li>)}
                </ul></>} />
          </div>
        : <div className="card-f"><span style={{ color: "var(--ok)" }}>
            <Icon name="check" size="sm" /> Ready to issue</span></div>}
    </div>
  );
}
