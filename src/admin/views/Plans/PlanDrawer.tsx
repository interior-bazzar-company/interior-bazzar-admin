/* =====================================================================
   PLANS — the drawer. One plan, everything about it, and the actions
   that can be taken on it. Same drawer pattern Deals uses.
   ===================================================================== */
import { IBData, IBPlans } from "../../engines";
import { EmptyState, Icon, KvList, Notice, Pill, SectionHead } from "../../ui";
import { money, monthsLabel } from "./helpers";
import type { FromEngine } from "./helpers";

export type Act = (a: string, ref?: string) => void;

export default function PlanDrawer({ plan, act, go }: { plan: FromEngine; act: Act; go: (h: string) => void }) {
  const pl = plan;
  const rng = IBPlans.rangeOf(pl);
  const mem = IBPlans.membersOf(pl);
  const refs = IBPlans.referencesTo(pl.plan_id);

  return (
    <>
      <div className="dw-h"><div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{pl.title}</h2>
            <Pill text={IBPlans.categoryLabel(pl.category)} />
            <Pill text={IBPlans.LABEL[pl.status]} tone={IBPlans.TONE[pl.status]} />
          </div>
          <div className="mono" style={{ fontSize: "var(--text-md)", color: "var(--text-2)", marginTop: "5px" }}>
            {pl.plan_id} · rev {pl.revision} · updated {IBData.fmtDate(pl.updated_at)} by {pl.updated_by}
          </div>
        </div>
        <span className="spacer"></span>
        <button className="btn icon sm" data-go="#/plans" aria-label="Close" onClick={() => go("#/plans")}>
          <Icon name="x" />
        </button>
      </div></div>

      <div className="dw-b">
        {pl.description
          ? <p style={{ color: "var(--text-2)", marginBottom: "14px" }}>{pl.description}</p>
          : null}

        {pl.status === "active" && !IBPlans.activeRows(pl).length
          ? <Notice tone="bad" ico="alert" text={<>
              <b>On sale with nothing to sell it at.</b> Every duration is switched off, so this plan
              cannot be put on a quotation. Price a duration or take it off sale.
            </>} />
          : null}

        <SectionHead title="Pricing" />
        <PricingTable pl={pl} act={act} />

        <SectionHead title="Features" />
        {pl.features.length
          ? <ul className="pl-feats">
              {pl.features.map((f: FromEngine, i: number) => (
                <li key={i}>
                  <Icon name="check" size="sm" />
                  <span>
                    <b>{f.label}</b>
                    {f.text ? <span className="d">{f.text}</span> : null}
                    {f.key ? <span className="mono pl-fkey">{f.key}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          : <EmptyState icon="quote" title="No features listed"
              body="A quotation built from this plan would carry an empty feature list." />}

        <SectionHead title="Where it is used" />
        <KvList cls="wide" pairs={[
          ["On quotations", refs.quotations
            ? <>{refs.quotations} line(s){" "}
                <a className="lnk" data-go="#/quotations" onClick={() => go("#/quotations")}>open Quotations</a></>
            : <span className="faint">none yet</span>],
          /* A count, not a link. Membership belongs to Users, and this page
             only ever counted it — a link into a surface that merely repeated
             the count was a longer way to learn the same number. */
          ["Members", mem.length
            ? <>{mem.length} <span className="faint">· managed in Users</span></>
            : <span className="faint">none</span>],
          ["Price range", rng ? money(rng.lo) + (rng.lo === rng.hi ? "" : " – " + money(rng.hi)) : "—"],
          ["Created", IBData.fmtDate(pl.created_at) + " by " + pl.created_by]
        ]} />

        <SectionHead title="History" />
        <HistoryList pl={pl} />

        <Notice ico="lock" text={<>
          <b>Editing this plan cannot change a quotation that already exists.</b> A quotation copies
          the price, the discount, the term and the feature list at the moment it is created, and
          reads nothing from here afterwards. New quotations get the new numbers; issued ones keep
          theirs.
        </>} />
      </div>

      <div className="dw-f"><ActionBar pl={pl} act={act} /></div>
    </>
  );
}

function PricingTable({ pl, act }: { pl: FromEngine; act: Act }) {
  if (!pl.pricing.length)
    return <EmptyState icon="tag" title="Not priced yet"
      body="Add a duration and this plan becomes sellable."
      action={<button className="btn pri" data-act="pl-edit" data-ref={pl.plan_id}
        onClick={() => act("pl-edit", pl.plan_id)}>Set pricing</button>} />;

  return (
    <table className="tbl pl-price"><thead><tr>
      <th>Duration</th><th className="n">Base</th><th className="n">Discount</th>
      <th className="n">Final</th><th className="n">Per month</th><th>Payments</th><th>On sale</th>
    </tr></thead><tbody>
      {pl.pricing.map((r: FromEngine, i: number) => {
        const fin = IBPlans.finalOf(r), disc = r.discount_value > 0;
        return (
          <tr key={i} className={r.active ? undefined : "dim"}>
            <td><b>{monthsLabel(r.months)}</b></td>
            {/* The base is struck through ONLY when a discount actually applies.
                A permanently-struck price implies a saving that is not there. */}
            <td className="n tnum">{disc
              ? <span style={{ textDecoration: "line-through", color: "var(--text-3)" }}>{money(r.base_paise)}</span>
              : money(r.base_paise)}</td>
            <td className="n tnum">{disc
              ? <span style={{ color: "var(--ok)" }}>−{r.discount_type === "amt"
                  ? IBData.inr(Math.round(r.discount_value * 100)) : r.discount_value + "%"}</span>
              : <span className="faint">—</span>}</td>
            <td className="n tnum"><b>{money(fin)}</b></td>
            <td className="n tnum faint">{r.base_paise ? IBData.inr(IBPlans.perMonth(r)) : "—"}</td>
            <td>{r.installments}{r.installments > 1
              ? <> <span className="faint">every {r.gap_months}mo</span></> : null}</td>
            <td>{r.active ? <Pill text="Yes" tone="ok" /> : <Pill text="No" />}</td>
          </tr>
        );
      })}
    </tbody></table>
  );
}

function HistoryList({ pl }: { pl: FromEngine }) {
  const evs = IBPlans.eventsFor(pl.plan_id);
  if (!evs.length) return <div className="faint">Nothing yet.</div>;
  return (
    <div className="tl">
      {evs.slice(0, 12).map((e: FromEngine, i: number) => (
        <div key={i} className={"ti " + (e.kind === "status" ? "ok" : e.kind === "deleted" ? "bad" : "")}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span className="pill xs">{e.kind}</span>
            <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>
              {IBData.fmtDate(e.at)}
            </span>
          </div>
          <div style={{ fontSize: "var(--text-base)", lineHeight: 1.45, marginTop: "5px" }}>{e.detail || "—"}</div>
          <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "2px" }}>{e.actor}</div>
        </div>
      ))}
    </div>
  );
}

function ActionBar({ pl, act }: { pl: FromEngine; act: Act }) {
  const arch = pl.status === "archived";
  if (arch)
    return <button className="btn pri" data-act="pl-restore" data-ref={pl.plan_id}
      onClick={() => act("pl-restore", pl.plan_id)}>Restore</button>;

  return (
    <>
      {/* ONE door. There used to be three — Edit details, Pricing, Features —
          each opening a slice of the same form, which is how a plan ends up
          half-written. Edit plan opens all of it. */}
      <button className="btn pri" data-act="pl-edit" data-ref={pl.plan_id}
        onClick={() => act("pl-edit", pl.plan_id)}><Icon name="quote" />Edit plan</button>
      {/* One primary per surface, and it is Edit plan. */}
      {pl.status === "active"
        ? <button className="btn" data-act="pl-off" data-ref={pl.plan_id}
            onClick={() => act("pl-off", pl.plan_id)}>Take off sale</button>
        : <button className="btn" data-act="pl-on" data-ref={pl.plan_id}
            onClick={() => act("pl-on", pl.plan_id)}><Icon name="check" />Put on sale</button>}
      <span className="spacer"></span>
      {IBPlans.isReferenced(pl.plan_id)
        ? <button className="btn" data-act="pl-archive" data-ref={pl.plan_id}
            onClick={() => act("pl-archive", pl.plan_id)}>Archive</button>
        : <button className="btn dgr" data-act="pl-del" data-ref={pl.plan_id}
            onClick={() => act("pl-del", pl.plan_id)}>Delete</button>}
    </>
  );
}
