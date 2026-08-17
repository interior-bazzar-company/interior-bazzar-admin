/* =====================================================================
   PLANS — the drawer. One plan, everything the server holds about it, and
   the actions that can be taken on it. Same drawer pattern Deals uses.
   ===================================================================== */
import { useEffect, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { AuditEntry } from "../../../api/modules/adminOps";
import { EmptyState, Icon, KvList, Notice, Pill, SectionHead } from "../../ui";
import { can } from "../../shell/AdminShell";
import { familyLabel, inr, money, monthsLabel } from "./helpers";
import { rangeOf, savingOf } from "./api";
import type { Cycle, Plan } from "./api";

export type Act = (a: string, ref?: number) => void;

export default function PlanDrawer({ plan, act, go }: { plan: Plan; act: Act; go: (h: string) => void }) {
  const pl = plan;
  const rng = rangeOf(pl);

  return (
    <>
      <div className="dw-h"><div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 600 }}>{pl.title}</h2>
            <Pill text={familyLabel(pl.family)} />
            {pl.active ? <Pill text="On sale" tone="ok" /> : <Pill text="Off sale" />}
            {pl.badge ? <Pill text={pl.badge} tone="warn" /> : null}
          </div>
          <div className="mono" style={{ fontSize: "var(--text-md)", color: "var(--text-2)", marginTop: "5px" }}>
            #{pl.id}{pl.tag ? " · " + pl.tag : ""}{pl.tier ? " · tier " + pl.tier : ""}
          </div>
        </div>
        <span className="spacer"></span>
        <button className="btn icon sm" data-go="#/plans" aria-label="Close" onClick={() => go("#/plans")}>
          <Icon name="x" />
        </button>
      </div></div>

      <div className="dw-b">
        {pl.subtitle
          ? <p style={{ color: "var(--text-2)", marginBottom: "14px" }}>{pl.subtitle}</p>
          : null}

        {pl.active && !pl.cycles.filter((c) => c.active).length
          ? <Notice tone="bad" ico="alert" text={<>
              <b>On sale with nothing to sell it at.</b> The public plans page prices a card from its
              active durations only, so this one renders with no price and cannot be bought. Switch a
              duration on, or take the plan off sale.
            </>} />
          : null}

        <SectionHead title="Pricing" desc="What a buyer pays. This is the money the checkout charges." />
        <CycleTable pl={pl} act={act} />

        <SectionHead title="Features" desc="The bullet list on the public plan card." />
        {pl.features.length
          ? <ul className="pl-feats">
              {pl.features.map((f, i) => (
                <li key={i}><Icon name="check" size="sm" /><span><b>{f}</b></span></li>
              ))}
            </ul>
          : <EmptyState icon="quote" title="No features listed"
              body="The plan card on the public page would show an empty list." />}

        <SectionHead title="Plan record" />
        <KvList cls="wide" pairs={[
          ["Price range", rng ? money(rng.lo) + (rng.lo === rng.hi ? "" : " – " + money(rng.hi)) : "—"],
          ["Family", familyLabel(pl.family)],
          /* entityType is what a purchase actually unlocks, and it is derived
             from the family at creation — worth showing, because a mismatch is
             what makes a plan unbuyable. */
          ["Unlocks", pl.entityType || <span className="faint">—</span>],
          ["Card order", pl.displayIndex ? "#" + pl.displayIndex + " in " + familyLabel(pl.family)
            : <span className="faint">last</span>],
          ["Upgrade tier", pl.tier || <span className="faint">—</span>],
          /* NOT the price. Spelt out because it looks exactly like one — and
             blank must not print as "Free", which is a price. An unset amount
             is a real hazard: activating a plan that ranks below one the user
             already holds expires itself on the spot. */
          ["Ranking amount", pl.amount
            ? <>{inr(pl.amount)} <span className="faint">· ranks upgrades, never charged</span></>
            : <span className="faint">not set — this plan cannot outrank one a buyer already holds</span>],
          ["Default duration", pl.duration ? monthsLabel(Number(pl.duration)) : <span className="faint">—</span>]
        ]} />

        <SectionHead title="History" />
        <History planId={pl.id} />

        <Notice ico="lock" text={<>
          <b>A price change here is live for the next buyer, immediately.</b> Saving drops the public
          plans cache, so the new figure is on the site at once. Subscriptions already sold keep the
          price they were bought at — nothing here reaches back into them.
        </>} />
      </div>

      <div className="dw-f"><ActionBar pl={pl} act={act} /></div>
    </>
  );
}

/* The billing cycles, which ARE the catalogue's money. `oldPrice` is only a
   saving when it sits above the price — the public page ignores it otherwise,
   so a stale one must not render here as a discount that isn't offered. */
function CycleTable({ pl, act }: { pl: Plan; act: Act }) {
  if (!pl.cycles.length)
    return <EmptyState icon="tag" title="Not priced yet"
      body="Add a duration and this plan becomes buyable."
      action={can("plans", "pricing")
        ? <button className="btn pri" data-act="pl-edit" data-ref={pl.id}
            onClick={() => act("pl-edit", pl.id)}>Set pricing</button>
        : null} />;

  return (
    <table className="tbl pl-price"><thead><tr>
      <th>Duration</th><th className="n">Price</th><th className="n">Was</th>
      <th className="n">Saving</th><th className="n">Per month</th><th>Label</th><th>On sale</th>
    </tr></thead><tbody>
      {pl.cycles.map((c: Cycle) => {
        const save = savingOf(c);
        return (
          <tr key={c.id} className={c.active ? undefined : "dim"}>
            <td><b>{monthsLabel(c.months)}</b></td>
            <td className="n tnum"><b>{money(c.price)}</b></td>
            <td className="n tnum">{save
              ? <span style={{ textDecoration: "line-through", color: "var(--text-3)" }}>{money(c.oldPrice)}</span>
              : <span className="faint">—</span>}</td>
            <td className="n tnum">{save
              ? <span style={{ color: "var(--ok)" }}>−{inr(save)}</span>
              : <span className="faint">—</span>}</td>
            <td className="n tnum faint">{c.months ? inr(Math.round(c.price / c.months)) : "—"}</td>
            <td>{c.badge || <span className="faint">—</span>}</td>
            <td>{c.active ? <Pill text="Yes" tone="ok" /> : <Pill text="No" />}</td>
          </tr>
        );
      })}
    </tbody></table>
  );
}

/* The real audit trail, filtered to this plan. Every plans write appends one
   (`plan=<id> …`), so this is the same log Settings → Audit shows, narrowed —
   not a second history of its own. A session without audit access simply gets
   the empty line rather than an error it can do nothing about. */
function History({ planId }: { planId: number }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  useEffect(() => {
    if (!can("audit")) { setRows([]); return; }
    let cancelled = false;
    AdminOpsService.audit({ module: "plans", pageSize: 200 })
      .then((res) => {
        if (cancelled) return;
        const all = res.response === false ? [] : (res.data.entries || []);
        const mine = new RegExp("plan=" + planId + "\\b");
        setRows(all.filter((e) => mine.test(e.detail || "")));
      })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [planId]);

  if (rows === null) return <div className="faint">Loading…</div>;
  if (!rows.length) return <div className="faint">Nothing yet.</div>;
  return (
    <div className="tl">
      {rows.slice(0, 12).map((e) => (
        <div key={e.id} className={"ti " + (e.action.indexOf("deleted") >= 0 ? "bad" : "ok")}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span className="pill xs">{e.action.replace(/^plan_/, "")}</span>
            <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>
              {e.ts ? new Date(e.ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            </span>
          </div>
          <div style={{ fontSize: "var(--text-base)", lineHeight: 1.45, marginTop: "5px" }}>{e.detail || "—"}</div>
          <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "2px" }}>{e.actor || "—"}</div>
        </div>
      ))}
    </div>
  );
}

/* Locked actions are ABSENT, not greyed — a disabled button invites a click
   and a support ticket. Price edits are level 3 (plans.pricing), the rest are
   level 2; the server re-checks all of it either way. */
function ActionBar({ pl, act }: { pl: Plan; act: Act }) {
  const mayEdit = can("plans", "edit") || can("plans", "pricing");
  return (
    <>
      {mayEdit
        ? <button className="btn pri" data-act="pl-edit" data-ref={pl.id}
            onClick={() => act("pl-edit", pl.id)}><Icon name="quote" />Edit plan</button>
        : null}
      {can("plans", "status")
        ? (pl.active
          ? <button className="btn" data-act="pl-off" data-ref={pl.id}
              onClick={() => act("pl-off", pl.id)}>Take off sale</button>
          : <button className="btn" data-act="pl-on" data-ref={pl.id}
              onClick={() => act("pl-on", pl.id)}><Icon name="check" />Put on sale</button>)
        : null}
      <span className="spacer"></span>
      {can("plans", "archive")
        ? <button className="btn dgr" data-act="pl-del" data-ref={pl.id}
            onClick={() => act("pl-del", pl.id)}>Delete</button>
        : null}
    </>
  );
}
