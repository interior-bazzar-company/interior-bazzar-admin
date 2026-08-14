/* =============================================================================
   SALES ANALYTICS — Own and Team, both from the one ledger.
   -----------------------------------------------------------------------------
   Registered on its own route (`#/sales-analytics`) rather than inside the
   Deals page: mixing a work queue with a reporting surface makes both worse.
   ============================================================================= */
import { useSearchParams } from "react-router-dom";
import { Icon, Notice, SectionHead, Table, Tiles } from "../../ui";
import { go } from "../../ui/nav";
import { ALL_STAGES, D, E, STAGE, actor, head, inr, useEngineTick } from "./useDeals";
import { useActs } from "./Modals";

export default function SalesAnalytics() {
  useEngineTick();
  const [sp] = useSearchParams();
  const p: Record<string, string> = {};
  sp.forEach((v, k) => { p[k] = v; });
  const acts = useActs(p);
  const me = actor();
  let teamTab = p.tab === "team";
  if (teamTab && !head()) teamTab = false;
  const a = E.Analytics.forActor(me, teamTab);
  const gap = a.gap;
  const stageMax = Math.max.apply(null, [1].concat(Object.keys(a.byStage).map((k) => a.byStage[k])) as number[]);

  return (
    <div className="page">
      <div className="ph">
        <div className="ph-t"><h1>Sales Analytics</h1>
          <div className="scope">Deliberately not inside the Deals page — mixing a work queue with a reporting surface makes both worse</div>
        </div>
        <div className="acts">
          <button className="btn" data-act="dl-export" onClick={() => acts.exportCsv()}>
            <Icon name="download" />Export CSV</button>
        </div>
      </div>

      <div className="tabs">
        <button className={!teamTab ? "on" : ""} data-go="#/sales-analytics"
          onClick={() => go("#/sales-analytics")}>Own</button>
        {head()
          ? <button className={teamTab ? "on" : ""} data-go="#/sales-analytics?tab=team"
              onClick={() => go("#/sales-analytics?tab=team")}>Team</button>
          : null}
      </div>

      <Tiles cols={4} list={[
        { k: "Closing rate", v: a.closingRate === null ? "—" : a.closingRate + "%",
          s: a.won + " won of " + (a.won + a.lost) + " closed", serif: true },
        { k: "Collected", v: inr(a.collected, { compact: true }), s: "verified ledger rows only", tone: "ok", serif: true },
        { k: "Outstanding", v: inr(a.outstanding, { compact: true }), s: "across open deals", tone: "warn", serif: true },
        { k: "Stalled", v: a.stalled, s: "no remark past threshold", tone: a.stalled ? "bad" : "" }
      ]} />

      <div className="two" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px",
        alignItems: "start", marginTop: "20px" }}>
        <div className="card"><div className="card-h"><h3>Deals by stage</h3></div>
          <div className="card-b">
            {ALL_STAGES.map((st) => {
              const n = a.byStage[st] || 0;
              return (
                <div key={st} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "6px 0" }}>
                  <span style={{ width: "140px", flex: "0 0 140px", fontSize: "var(--text-md)", color: "var(--text-2)" }}>
                    {D.STAGES[st].label}</span>
                  <span className="bar" style={{ flex: 1 }}>
                    <i className={st === STAGE.WON ? "ok" : st === STAGE.LOST ? "bad" : "brand"}
                      style={{ width: (n / stageMax * 100) + "%" }}></i></span>
                  <span className="tnum" style={{ width: "28px", textAlign: "right", fontSize: "var(--text-md)" }}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Conversion gap</h3><span className="d">the number the Head actually watches</span></div>
          <div className="card-b">
            {([["Followup or beyond", gap.comm, 0],
               ["…that produced a quotation", gap.quoted, 1],
               ["…that was accepted", gap.accepted, 2],
               ["…that was invoiced", gap.invoiced, 3],
               ["…that produced money", gap.paid, 4]] as [string, number, number][])
              .map((r, ix) => (
                <div key={r[0]} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "7px 0",
                  borderTop: ix ? "1px solid var(--line)" : undefined }}>
                  <span style={{ flex: 1, fontSize: "var(--text-base)",
                    paddingLeft: ix ? r[2] * 12 + "px" : undefined,
                    color: ix ? "var(--text-2)" : undefined }}>{r[0]}</span>
                  <span className="tnum" style={{ fontWeight: 600 }}>{r[1]}</span>
                </div>
              ))}
            <div className="help" style={{ marginTop: "10px" }}>A conversation is not a conversion. The drop between <b>accepted</b> and <b>produced money</b> is the gap this module exists to make visible.</div>
          </div>
        </div>
      </div>

      {teamTab
        ? <>
            <SectionHead title="By salesperson" desc="split ratios applied from the ledger row, not the deal record" />
            <Table
              cols={[{ label: "Salesperson" }, { label: "Attributed", cls: "n" }, { label: "Share", w: "180px" }]}
              empty={{ icon: "users", title: "No attributed money yet", body: "" }}
              rows={Object.keys(a.byPerson).sort((x, y) => a.byPerson[y] - a.byPerson[x]).map((who) => {
                const v = a.byPerson[who];
                const max = Math.max.apply(null, Object.keys(a.byPerson).map((k) => a.byPerson[k]) as number[]);
                return (
                  <tr key={who}>
                    <td><b>{who}</b></td>
                    <td className="n">{inr(v)}</td>
                    <td><span className="bar"><i className="ok" style={{ width: (max ? v / max * 100 : 0) + "%" }}></i></span></td>
                  </tr>
                );
              })} />
          </>
        : null}

      <Notice ico="shield" text={<><b>Own and Team read the same append-only payment ledger</b>, with co-assignment split ratios applied from the <b>ledger row</b> — never from the current deal record. There is no second source (<span className="mono">DM-BR-10</span>), and no figure here comes from an invoice total: issuing is not collecting.</>} />

      <SectionHead title="Automation" desc="engine jobs" />
      <div className="card">
        <div className="card-b" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" data-act="dl-stalljob" onClick={() => acts.stallJob()}>
            <Icon name="clock" />Run stall detection</button>
          <span className="faint" style={{ fontSize: "var(--text-md)" }}>
            Last run: {E.Automation.lastRun() || "never"} · thresholds 4 days Followup, 7 elsewhere</span>
          <span className="spacer"></span>
          <button className="btn ghost" data-act="dl-reset" onClick={() => acts.resetEngine()}>Reset engine data</button>
        </div>
        <div className="card-f"><span className="faint">AD-10 was open — undefined behaviour on an overlapping run. Implemented here with a run lock and an idempotent body.</span></div>
      </div>

      {/* The prototype ships this one media query inline on the page — it is
          the only rule the two-column grid above needs and it is carried across
          verbatim rather than invented as a new stylesheet. */}
      <style>{"@media(max-width:1180px){.two{grid-template-columns:1fr !important}}"}</style>
    </div>
  );
}
