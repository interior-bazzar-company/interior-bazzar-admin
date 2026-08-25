/* =============================================================================
   Assign a membership.
   -----------------------------------------------------------------------------
   THE PLANS ARE THE REAL ONES. This form reads `v1/admin/plans/` through the
   Plans module's own `usePlans()` — the same Subscription and PlanBillingCycle
   rows the Plans screen edits and the public plans page charges from. It used
   to read a catalogue seeded inside this module, which is two sources of truth
   for one price: the moment somebody repriced Growth in Plans, this form would
   have carried on selling the old number, and nobody would have found out
   until a member queried their invoice. UM-OD-01 asked whether the catalogue
   lives here; the answer is no, and this is what that answer looks like.

   THE BILLING CYCLE IS THE DURATION. The catalogue does not have "plan
   versions" — it has a plan with billing cycles, each one a number of months
   and a price. That is what a member buys, so it is what this form picks and
   what the term freezes. Choosing a plan fills the duration in with that
   plan's default cycle; changing it is one click, and only the chosen one is
   ever carried onto the term.

   THREE SOURCES, not five. The old list mixed two different questions — WHY
   the term exists and WHERE the money is recorded — and the second is not a
   source, it is a reference, which is one field below. Five near-synonyms get
   picked inconsistently and the analytics inherit the inconsistency.

   NOTHING HERE CREATES REVENUE. A complimentary grant produces entitlement and
   no money; a sale references the record that took it. Finance's ledger is not
   touched by any of this (UM-BR-06, UM-FR-032).
   ============================================================================= */
import { useEffect, useMemo, useState } from "react";
import { Icon, Notice } from "../../ui";
import { usePlans, rangeOf } from "../Plans/api";
import type { Cycle, Plan } from "../Plans/api";
import { ACTIVATION_SOURCES, assignMembership, fmtDate, money, sourceMeta } from "./store";
import type { Entitlement, UserRow } from "./store";
import { Assumed, ClassPill } from "./bits";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The plan's default duration: its cheapest ACTIVE cycle. Cheapest rather
 *  than longest, because that is the one a buyer lands on and the one this
 *  form should not talk somebody out of by accident. */
const defaultCycle = (p: Plan): Cycle | null => {
  const on = p.cycles.filter((c) => c.active);
  return on.slice().sort((a, b) => a.price - b.price)[0] || null;
};

/** A plan is offerable when it is on sale, not archived, and has at least one
 *  active cycle — because without a cycle there is no duration and no price,
 *  and a plan you cannot put a number against is not a plan you can sell. */
const sellable = (p: Plan) => p.active && !p.archived && p.cycles.some((c) => c.active);

export default function AssignMembership({ row, onClose, onDone }: {
  row: UserRow;
  onClose: () => void;
  onDone: (msg: string, tone?: string) => void;
}) {
  const [tick, setTick] = useState(0);
  const { loading, plans, error } = usePlans(tick);
  const catalogue = useMemo(() => plans.filter(sellable), [plans]);

  const [planId, setPlanId] = useState<number | null>(null);
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [source, setSource] = useState("new_sale");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [activateNow, setActivateNow] = useState(false);
  const [start, setStart] = useState(iso(new Date()));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = catalogue.filter((p) => p.id === planId)[0] || null;
  const cycles = plan ? plan.cycles.filter((c) => c.active) : [];
  const cycle = cycles.filter((c) => c.id === cycleId)[0] || null;
  const src = sourceMeta(source);

  /* THE DURATION FILLS ITSELF IN. Picking a plan selects that plan's default
     cycle, so the common path is one click and the form is never in a state
     where a plan is chosen and the duration is blank. Changing it afterwards
     is one more click and only the chosen one is carried onto the term. */
  useEffect(() => {
    if (!plan) return;
    if (cycle && cycle.active && plan.cycles.some((c) => c.id === cycle.id)) return;
    const d = defaultCycle(plan);
    setCycleId(d ? d.id : null);
  }, [plan, cycle]);

  /* End date is DERIVED from the chosen duration and shown read-only. A
     hand-typed end date is a term whose length nobody can explain later, and
     the length is a property of what was bought. */
  const end = useMemo(() => {
    if (!cycle) return null;
    const d = new Date(start + "T00:00:00");
    d.setMonth(d.getMonth() + cycle.months);
    d.setDate(d.getDate() - 1);
    return d;
  }, [start, cycle]);

  /* Everything already live on this account, and separately the one term that
     would CLASH with the plan selected right now. Two different questions: the
     live terms are context and are always shown, the clash is a refusal and
     appears only when it applies. */
  const live = row.history.filter((m) =>
    ["active", "paused", "suspended"].indexOf(m.status) >= 0);
  const clash = plan ? live.filter((m) => m.planCode === planCode(plan))[0] || null : null;

  const submit = () => {
    if (!plan || !cycle) { setErr("Pick a plan and a duration."); return; }
    setErr(null);
    setBusy(true);
    const res = assignMembership(row.user.userId, {
      planId: String(plan.id),
      planCode: planCode(plan),
      planName: plan.title,
      cycle: { months: cycle.months, price: cycle.price, currency: "INR" },
      /* Captured NOW, from the live catalogue, and frozen at activation. The
         term carries them so nothing has to read the catalogue again — after
         which a reprice, a rename or an archive cannot change what this member
         was sold. */
      features: plan.features.map((f, i): Entitlement => ({
        key: "feature." + i,
        label: f.text,
        display: f.detail || "Included",
      })),
      source, reference, reason,
      startAt: new Date(start + "T00:00:00").toISOString(),
      endAt: new Date(iso(end as Date) + "T23:59:59").toISOString(),
      activateNow,
    });
    if (res.error) { setErr(res.error); setBusy(false); return; }
    onDone(
      activateNow
        ? plan.title + " is active for " + cycle.months + " months. "
          + row.user.identity.name + " is an Active Member — derived from the term, not set."
        : plan.title + " raised at Pending Activation. It grants nothing until somebody activates it.",
      "ok");
  };

  const ready = !!plan && !!cycle && !clash
    && !(src?.requiresReference && !reference.trim())
    && !(src?.requiresReason && !reason.trim());

  return (
    <>
      <div className="md-h">
        <h3>Assign a membership</h3>
        <p>
          {row.user.identity.name} · <span className="mono">{row.user.userId}</span> ·{" "}
          <ClassPill k={row.classification} />
        </p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b um-form um-assign">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        {live.length ? (
          <Notice ico="tag" text={<>
            <b>Already live on this account:</b>{" "}
            {live.map((m, i) => (
              <span key={m.membershipId}>
                {i ? ", " : ""}{m.planName} to {fmtDate(m.endAt)}
              </span>
            ))}
            . A different plan is fine; the same one is not.
          </>} />
        ) : null}

        {clash ? (
          <Notice tone="warn" ico="alert" text={<>
            <b>{row.user.identity.name} already holds a live {plan?.title} term.</b>{" "}
            <span className="mono">{clash.membershipId}</span> runs to {fmtDate(clash.endAt)}. End
            or renew that one instead of raising a second — the same refusal the API returns as{" "}
            <span className="mono">409 active_membership_conflict</span>.
          </>} />
        ) : null}

        {/* ------------------------------------------------------- 1 · plan */}
        <fieldset className="um-fs">
          <legend>
            1 · Plan <span className="req">*</span>
            <i>from the live catalogue — the same rows a buyer is charged from</i>
          </legend>

          {loading ? (
            <p className="um-fine">Reading the plan catalogue…</p>
          ) : error ? (
            /* PRINTED, not papered over. There is no bundled copy of the
               catalogue any more, and inventing one here is the two-sources-of-
               truth bug this whole change removed. */
            <Notice tone="bad" ico="alert" text={<>
              <b>The plan catalogue could not be read.</b> {error} Nothing can be assigned until it
              answers — this module keeps no copy of it on purpose.{" "}
              <button className="lnk" onClick={() => setTick((t) => t + 1)}>Try again</button>
            </>} />
          ) : !catalogue.length ? (
            <Notice tone="warn" ico="alert" text={<>
              <b>No plan is on sale.</b> A plan needs to be active, un-archived and to have at
              least one active billing cycle before it can be assigned — a plan with no cycle has
              no duration and no price. Put one on sale in{" "}
              <span className="mono">#/plans</span>.
            </>} />
          ) : (
            <div className="um-choices">
              {catalogue.map((pl) => {
                const d = defaultCycle(pl);
                const r = rangeOf(pl);
                return (
                  <button key={pl.id} type="button"
                    className={"um-choice" + (pl.id === planId ? " on" : "")}
                    onClick={() => setPlanId(pl.id)}>
                    <b>{pl.title}</b>
                    <span>{pl.subtitle || pl.family}</span>
                    <em>
                      {d ? money(d.price) : "—"}
                      {r && r.lo !== r.hi ? <i className="um-choice-alt"> · up to {money(r.hi)}</i> : null}
                    </em>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        {/* --------------------------------------------------- 2 · duration */}
        {plan ? (
          <fieldset className="um-fs">
            <legend>
              2 · Duration <span className="req">*</span>
              <i>filled in from {plan.title}&rsquo;s default — change it if the sale differs</i>
            </legend>
            <div className="um-choices tight">
              {cycles.map((cy) => (
                <button key={cy.id} type="button"
                  className={"um-choice sm" + (cy.id === cycleId ? " on" : "")}
                  onClick={() => setCycleId(cy.id)}>
                  <b>{cy.months} months</b>
                  <span>{money(cy.price)}</span>
                  {cy.badge ? <em>{cy.badge}</em> : null}
                </button>
              ))}
            </div>
            <p className="um-fine">
              <b>Only the duration you pick is carried onto the term.</b> The others exist in the
              catalogue and mean nothing to this member — the term freezes the one they bought,
              along with its price, so a later reprice cannot move it.
            </p>
          </fieldset>
        ) : null}

        {/* ----------------------------------------------------- 3 · source */}
        <fieldset className="um-fs">
          <legend>3 · Source <span className="req">*</span></legend>
          <div className="um-radios tight">
            {ACTIVATION_SOURCES.map((s) => (
              <label key={s.key} className={s.key === source ? "on" : ""}>
                <input type="radio" name="um-source" checked={s.key === source}
                  onChange={() => { setSource(s.key); setReference(""); }} />
                <b>{s.label}</b>
                <span>{s.help}</span>
              </label>
            ))}
          </div>
          {source === "complimentary" ? <Assumed id="UM-OD-03" /> : null}
        </fieldset>

        {/* ------------------------------------------- 4 · reference/reason */}
        <fieldset className="um-fs">
          <legend>
            4 · {src?.requiresReference ? "Reference" : "Reason"}
            <span className="req"> *</span>
          </legend>
          {src?.requiresReference ? (
            <label className="fg">
              <span className="fg-lb">{src.referenceLabel}</span>
              <input className="inp" value={reference} placeholder="e.g. INV-2026-0511 or DL-3310"
                onChange={(e) => setReference(e.target.value)} />
              <div className="help">
                Points at the record in Deals, Invoicing or Finance that took the money. This
                module stores the pointer and never the amount.
              </div>
            </label>
          ) : (
            <label className="fg">
              <span className="fg-lb">Why this is being granted, and who approved it</span>
              <textarea className="inp" rows={3} value={reason}
                placeholder="The record when somebody asks in six months."
                onChange={(e) => setReason(e.target.value)} />
              <div className="help warn">
                A grant with no recorded authority is the misuse this rule exists to prevent.
              </div>
            </label>
          )}
        </fieldset>

        {/* ------------------------------------------------------ 5 · dates */}
        <fieldset className="um-fs">
          <legend>5 · Starts</legend>
          <div className="um-f2">
            <label className="fg">
              <span className="fg-lb">Start date</span>
              <input className="inp" type="date" value={start}
                onChange={(e) => setStart(e.target.value)} />
            </label>
            <div className="fg">
              <span className="fg-lb">Ends</span>
              <div className="inp ro">{end ? fmtDate(end.toISOString()) : "pick a duration"}</div>
              <div className="help">
                {cycle ? cycle.months + " months from the start date." : "Derived, not typed."}
              </div>
            </div>
          </div>
        </fieldset>

        {/* ------------------------------------------------ 6 · activate now */}
        <fieldset className="um-fs">
          <legend>6 · Activate now?</legend>
          <div className="um-radios">
            <label className={!activateNow ? "on" : ""}>
              <input type="radio" name="um-activate" checked={!activateNow}
                onChange={() => setActivateNow(false)} />
              <b>Hold at Pending Activation</b>
              <span>The record exists and grants nothing until somebody confirms the payment.</span>
            </label>
            <label className={activateNow ? "on" : ""}>
              <input type="radio" name="um-activate" checked={activateNow}
                onChange={() => setActivateNow(true)} />
              <b>Activate immediately</b>
              <span>
                Freezes the plan features as they read today and entitles them now.
              </span>
            </label>
          </div>
          <Assumed id="UM-OD-02" />
        </fieldset>

        {/* --------------------------------------------------- what is bought */}
        {plan && cycle ? (
          <div className="um-summary">
            <div className="um-summary-h">
              <b>{plan.title}</b>
              <span>{cycle.months} months</span>
              <span className="um-summary-p">{money(cycle.price)}</span>
            </div>
            <div className="um-summary-b">
              {start && end ? (
                <span>{fmtDate(new Date(start + "T00:00:00").toISOString())} — {fmtDate(end.toISOString())}</span>
              ) : null}
              <span>{src?.label}{reference.trim() ? " · " + reference.trim() : ""}</span>
              <span>{activateNow ? "Active immediately" : "Pending activation"}</span>
            </div>
            {plan.features.length ? (
              <ul className="um-ent preview">
                {plan.features.slice(0, 6).map((f, i) => (
                  <li key={i}>
                    <Icon name="check" size="sm" />
                    <span className="l">{f.text}</span>
                    <span className="v">{f.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="um-fine">
                This plan lists no features, so there is nothing to freeze — activation will
                refuse rather than create a term whose access nobody can enumerate.
              </p>
            )}
            <p className="um-fine">
              The price is what the buyer is charged by Finance. Recording it here freezes what
              was sold; it does not create a payment, and no revenue is written by this form.
            </p>
          </div>
        ) : null}
      </div>

      <div className="md-f">
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={busy || !ready} onClick={submit}>
          {busy ? "Working…" : activateNow ? "Create and activate" : "Create at Pending Activation"}
        </button>
      </div>
    </>
  );
}

/* The live catalogue has no `planCode`; the terms this module writes need a
   stable, readable key to group and filter by. The family is that key where the
   plan has one, falling back to a slug of the title — derived once, here, so
   every term this form writes groups the same way. */
function planCode(p: Plan): string {
  const base = (p.family && p.family !== "business" ? p.family : p.title) || p.title;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
