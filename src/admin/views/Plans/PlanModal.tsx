/* =====================================================================
   ONE FORM, EVERY FIELD, for both create and edit.

   Create used to take a title, a category and a description, and then say
   "price it next" — which meant naming a plan, closing the dialog, opening
   Pricing, closing that, opening Features, and closing that. Three doors
   into one form. Authoring a plan is a single act and it now looks like one.

   Sectioned rather than tabbed. Tabs would hide the pricing grid behind a
   click on the screen whose whole purpose is pricing, and they hide exactly
   the field somebody forgot to fill in. Everything is on one scroll, in the
   order the decisions are actually made: what it is → what it costs → what
   it includes → whether it is on sale.

   It writes through `Catalogue.save`, ONE transaction. A rejected discount
   cannot leave a renamed plan behind, and the plan is never briefly on sale
   with no price between two calls.
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import { IBData, IBPlans } from "../../engines";
import { Field, Icon, Notice, SectionHead } from "../../ui";
import { actor, isRefusal, monthsLabel } from "./helpers";
import type { FromEngine, Refusal } from "./helpers";

/* An existing row at ₹0 is Business · Free Forever, and it must not render
   as a blank box — blank means "no row", and the two look identical once
   the value is gone. `base:""` keeps them apart: a stored row always shows
   its number, even when that number is zero. */
type RowState = {
  months: number; base: string; dtype: string; dval: string;
  icount: string; igap: string; active: boolean;
};
type FeatState = { label: string; key: string };

function initRows(pl: FromEngine): RowState[] {
  /* The four offered durations, plus any non-standard row this plan already
     carries, so an unusual term survives being edited. */
  const months: number[] = IBPlans.DURATIONS.slice();
  if (pl) pl.pricing.forEach((r: FromEngine) => { if (months.indexOf(r.months) < 0) months.push(r.months); });
  months.sort((a, b) => a - b);
  return months.map((m) => {
    const r = pl ? IBPlans.rowFor(pl, m) : null;
    const d = r || { base_paise: 0, discount_type: "pct", discount_value: 0,
                     installments: 1, gap_months: m, active: false };
    return {
      months: m,
      base: r ? String(Math.round(d.base_paise / 100)) : "",
      dtype: d.discount_type,
      dval: d.discount_value ? String(d.discount_value) : "",
      icount: String(d.installments || 1),
      igap: String(d.gap_months || m),
      active: !!d.active
    };
  });
}

function readRow(r: RowState) {
  return {
    months: r.months,
    base_paise: Math.round((parseFloat(r.base) || 0) * 100),
    discount_type: r.dtype,
    discount_value: parseFloat(r.dval) || 0,
    installments: parseInt(r.icount, 10) || 1,
    gap_months: parseInt(r.igap, 10) || 1,
    active: r.active
  };
}

const val = (id: string) => {
  const e = document.getElementById(id) as HTMLInputElement | null;
  return e ? e.value : "";
};

export default function PlanModal({ plan, onClose, onDone }: {
  plan: FromEngine; onClose: () => void; onDone: (msg: string, ref: string | null) => void;
}) {
  const pl = plan;
  const isNew = !pl;
  const reg = IBPlans.Features.registry();

  const [rows, setRows] = useState<RowState[]>(() => initRows(pl));
  const [feats, setFeats] = useState<FeatState[]>(() =>
    pl && pl.features.length
      ? pl.features.map((f: FromEngine) => ({ label: f.label || "", key: f.key || "" }))
      : [{ label: "", key: "" }]);
  const [err, setErr] = useState<Refusal | null>(null);
  const errRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (err && errRef.current) errRef.current.scrollIntoView({ block: "nearest" }); }, [err]);

  const setRow = (i: number, patch: Partial<RowState>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => {
    const payload = {
      title: val("plTitle"),
      category: val("plCat"),
      description: val("plDesc"),
      status: val("plStatus"),
      pricing: rows.map(readRow)
        /* A row with no price that is not on sale was never filled in.
           Dropping it keeps the stored grid to what somebody decided; a ₹0
           row that IS on sale is Free, and kept. */
        .filter((r) => r.base_paise > 0 || r.active),
      features: feats.map((f) => ({ label: f.label, key: f.key }))
    };
    const r = IBPlans.Catalogue.save(pl ? pl.plan_id : null, payload, actor());
    if (isRefusal(r)) return setErr(r);
    onDone(pl ? "Plan saved — rev " + r.data.revision + "."
              : "Plan created" + (r.data.status === "active" ? " and put on sale." : " as a draft."),
           r.data.plan_id);
  };

  return (
    <>
      <div className="md-h">
        <h3>{isNew ? "Create plan" : "Edit plan"}</h3>
        <p className={isNew ? undefined : "mono"}>
          {isNew ? "Everything about the plan, on one form" : pl.plan_id + " · rev " + pl.revision}
        </p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b">
        <div id="plErr" ref={errRef}>
          {err ? <Notice tone="bad" text={<>
            <b>{err.http} <span className="mono">{err.code}</span></b>
            <div style={{ marginTop: "3px" }}>{err.detail}</div>
          </>} /> : null}
        </div>

        <SectionHead title="Plan information" />
        <Field id="plTitle" label="Plan title" req value={pl ? pl.title : ""} ph="AutoGrowth · Growth" />
        <Field id="plCat" label="Category" req type="select"
          options={IBPlans.CATEGORIES.map((c: FromEngine) =>
            ({ v: c.key, l: c.label, sel: c.key === (pl ? pl.category : "") }))} />
        <Field id="plDesc" label="Description" type="textarea" value={pl ? pl.description : ""}
          ph="One line an agent can read out on a call."
          help="Shown on the catalogue list and beside the plan in the quotation picker." />

        <SectionHead title="Pricing" />
        <div className="pl-grid" id="plGrid">
          <div className="pl-grid-h">
            <span>Duration</span><span>Base ₹</span><span>Discount</span>
            <span>Payments</span><span>Final</span><span>On sale</span>
          </div>
          {rows.map((r, i) => {
            /* Live final, recomputed through the ENGINE's own function — not a
               copy of the formula written again in the view. */
            const rr = readRow(r);
            const typed = r.base !== "";
            const fin = rr.base_paise ? IBData.inr(IBPlans.finalOf(rr)) : (typed ? "Free" : "—");
            return (
              <div className="pl-row" data-months={r.months} key={r.months}>
                <span className="pl-dur">{monthsLabel(r.months)}</span>
                <input className="inp pl-base" type="number" min="0" step="100" placeholder="0"
                  value={r.base} onChange={(e) => setRow(i, { base: e.target.value })} />
                <span className="pl-disc">
                  <select className="inp pl-dtype" value={r.dtype}
                    onChange={(e) => setRow(i, { dtype: e.target.value })}>
                    <option value="pct">%</option>
                    <option value="amt">₹</option>
                  </select>
                  <input className="inp pl-dval" type="number" min="0" step="1" placeholder="0"
                    value={r.dval} onChange={(e) => setRow(i, { dval: e.target.value })} />
                </span>
                <span className="pl-inst">
                  <input className="inp pl-icount" type="number" min="1" max="12"
                    value={r.icount} onChange={(e) => setRow(i, { icount: e.target.value })} />
                  <input className="inp pl-igap" type="number" min="1" title="Months between payments"
                    value={r.igap} onChange={(e) => setRow(i, { igap: e.target.value })} />
                </span>
                <span className={"pl-final tnum" + (!rr.base_paise && !typed ? " faint" : "")}>{fin}</span>
                <label className="check pl-live">
                  <input type="checkbox" className="pl-active" checked={r.active}
                    onChange={(e) => setRow(i, { active: e.target.checked })} /><span></span>
                </label>
              </div>
            );
          })}
        </div>
        <div className="help" style={{ marginTop: "8px" }}>
          Discount is a <b>percentage</b> by default — switch the selector to ₹ for a flat amount.{" "}
          <b>Final is calculated, never typed</b>: base minus discount, rounded once, by the same
          function the quotation uses, so the number quoted and the number shown here cannot drift
          apart. A row at ₹0 that is on sale is <b>Free</b>.
        </div>

        <SectionHead title="Features" />
        <div id="plFeats">
          {feats.map((f, i) => (
            <div className="pl-frow" key={i}>
              <input className="inp pl-flabel" list="plFeatList" placeholder="Feature name"
                value={f.label}
                onChange={(e) => setFeats((fs) => fs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <input className="inp pl-fkey mono" placeholder="registry key (optional)"
                value={f.key}
                onChange={(e) => setFeats((fs) => fs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} />
              <button className="btn icon sm" data-act="pl-feat-del" aria-label="Remove"
                onClick={() => setFeats((fs) => {
                  const out = fs.filter((_, j) => j !== i);
                  return out.length ? out : [{ label: "", key: "" }];
                })}><Icon name="x" size="sm" /></button>
            </div>
          ))}
        </div>
        <button className="btn sm" data-act="pl-feat-add" style={{ marginTop: "8px" }}
          onClick={() => setFeats((fs) => fs.concat([{ label: "", key: "" }]))}>
          <Icon name="plus" size="sm" />Add feature
        </button>
        <datalist id="plFeatList">
          {reg.map((f: FromEngine, i: number) => <option key={i} value={f.label} data-key={f.key} />)}
        </datalist>
        <div className="help" style={{ marginTop: "8px" }}>
          Pick a name from the list and it links to the shared registry, so the wording on a proposal
          matches the public pricing page. Type your own and it is plain text.
        </div>

        <SectionHead title="Status" />
        <Field id="plStatus" label="Status" type="select"
          options={[
            { v: "draft", l: "Draft — being written, not sellable",
              sel: (pl ? pl.status : "draft") === "draft" },
            { v: "active", l: "Active — on sale, selectable in a quotation",
              sel: !!pl && pl.status === "active" },
            { v: "inactive", l: "Inactive — withdrawn, existing records unaffected",
              sel: !!pl && pl.status === "inactive" }
          ]}
          help="Active needs at least one duration switched on — a plan on sale with no price would be an option that fails the moment somebody picks it." />

        {pl && IBPlans.isReferenced(pl.plan_id)
          ? <Notice ico="lock" text={<>
              <b>This plan is already on quotations or memberships.</b> Changing anything here
              changes the catalogue, not those records — each one kept its own copy of the name, the
              price and the features at the time it was written.
            </>} />
          : null}
      </div>

      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="pl-save" data-ref={pl ? pl.plan_id : undefined} onClick={save}>
          {isNew ? "Create plan" : "Save changes"}
        </button>
      </div>
    </>
  );
}
