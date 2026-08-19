/* =====================================================================
   PLANS — the catalogue, and the only place a price is set.
   ---------------------------------------------------------------------
   Reads and writes `v1/admin/plans/` (interior_admin PlansViews). These are
   the same Subscription / PlanBillingCycle rows the public plans page
   renders from, so a price changed here is the price a buyer is charged —
   the controller drops the public plans cache on every write, and the
   change is live immediately.

   Renders the same five bands as Deals, Quotations and Invoices: a title in
   the topbar, a command row, one stat strip, the active filters, and a table
   in a viewport-bounded body.

   Two states, not four. The server has one `isActive` flag per plan (plus a
   soft delete), so "draft" and "inactive" — engine inventions with nowhere
   to be stored — are gone rather than shown as states a save would silently
   drop. On sale · off sale is the whole vocabulary.
   ===================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AdminOpsService from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import {
  EmptyState, FilterChips, Icon, Notice, Pill, SearchField, Select, StatStrip, qs
} from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { ListSkeleton } from "../../ui";
import PlanDrawer from "./PlanDrawer";
import type { Act } from "./PlanDrawer";
import PlanModal from "./PlanModal";
import ConfirmModal from "./ConfirmModal";
import { call, familiesOf, rangeOf, usePlans } from "./api";
import type { Plan } from "./api";
import { familyLabel, money, monthsLabel, sorter, statusOf, urgency } from "./helpers";

export default function Plans() {
  const raw = useParams().id;
  const id = raw ? decodeURIComponent(raw) : null;
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { drawer, modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const params: Record<string, string> = {};
  sp.forEach((v, k) => { params[k] = v; });
  const p = { q: params.q || "", fam: params.fam || "", status: params.status || "", sort: params.sort || "" };

  const { loading, plans, error } = usePlans(tick);

  /* ---------------------------------------------------------- topbar --- */
  const crumbs = useMemo(() => <span className="tb-title">Plans</span>, []);
  usePageChrome({ crumbs, right: null, parent: id ? "#/plans" + qs(params) : null });

  /* ---------------------------------------------------------- writes --- */
  const done = useCallback((msg: string, ref: number | null) => {
    closeLayer(); toast(msg);
    go(ref ? "#/plans/" + ref : "#/plans");
    bump();
  }, [closeLayer, toast, go, bump]);

  const act = useCallback<Act>((a, ref) => {
    if (a === "pl-new") return modal(<PlanModal plan={null} families={familiesOf(plans)}
      onClose={closeLayer} onDone={done} />, "wide");

    const pl = ref ? plans.filter((x) => x.id === ref)[0] : null;
    if (!pl || !ref) return;

    if (a === "pl-edit") return modal(<PlanModal plan={pl} families={familiesOf(plans)}
      onClose={closeLayer} onDone={done} />, "wide");

    /* ------------------------------------------------------- on sale --- */
    if (a === "pl-on") {
      call(AdminOpsService.setPlanActive(ref, true))
        .then(() => { toast("On sale — it is on the public plans page now."); bump(); })
        .catch((e: unknown) => toast(errMessage(e), "bad"));
      return;
    }
    if (a === "pl-off") {
      return modal(<ConfirmModal
        heading="Take off sale" sub={pl.title} onClose={closeLayer}
        ico="shield" confirmLabel="Take off sale" confirmCls="btn pri" act="pl-off-go"
        notice={<>
          <b>It disappears from the public plans page and can no longer be bought.</b> Nothing else
          changes: everyone already subscribed keeps their plan until it expires, and you can put it
          back on sale at any time.
        </>}
        run={() => call(AdminOpsService.setPlanActive(ref, false)).then(() => done("Taken off sale.", ref))} />);
    }
    if (a === "pl-archive") {
      const lines = pl.usage.quotationLines, members = pl.usage.members;
      return modal(<ConfirmModal
        heading="Archive plan" sub={pl.title} onClose={closeLayer}
        ico="lock" confirmLabel="Archive" confirmCls="btn pri" act="pl-archive-go"
        notice={<>
          <b>Archived, not deleted, because history points at it.</b> {lines} quotation line
          {lines === 1 ? "" : "s"} and {members} membership{members === 1 ? "" : "s"} name this plan.
          Deleting it would leave those records pointing at something that does not exist —
          archiving keeps them explainable and takes it out of the catalogue.
        </>}
        run={() => call(AdminOpsService.archivePlan(ref)).then(() => done("Archived.", ref))} />);
    }
    if (a === "pl-restore") {
      /* Restored OFF sale on purpose — see PlansController.SetArchived. Said here
         too, because "restore" reads like "put it back the way it was". */
      call(AdminOpsService.setPlanArchived(ref, false))
        .then(() => { toast("Restored — back in the catalogue, off sale."); bump(); })
        .catch((e: unknown) => toast(errMessage(e), "bad"));
      return;
    }
  }, [modal, closeLayer, toast, done, bump, plans]);

  /* ---------------------------------------------------------- drawer --- */
  /* The drawer IS the record: it re-opens on every data change, which is what
     the prototype's render() did after a write. */
  useEffect(() => {
    if (!id || loading) return;
    const pl = plans.filter((x) => String(x.id) === id)[0];
    if (!pl) { toast("404 plan_not_found — no plan " + id + ".", "bad"); go("#/plans"); return; }
    drawer(<PlanDrawer plan={pl} act={act} go={go} />);
  }, [id, tick, loading, plans, act, drawer, go, toast]);

  useEffect(() => { if (!id) return; return () => closeLayer(); }, [id, closeLayer]);

  /* --------------------------------------------------------- filters --- */
  const timer = useRef<number | undefined>(undefined);
  const caret = useRef<number | null>(null);

  const onFilter = (name: string, value: string) => {
    go("#/plans" + (id ? "/" + encodeURIComponent(id) : "") + qs({ ...params, [name]: value }));
  };
  /* Typing is debounced 220ms, and the caret is handed back afterwards — the
     input is remounted by the new `q` in the URL, so the focus has to be
     re-asked for. */
  const onSearch = (name: string, value: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
      caret.current = el ? el.selectionStart : null;
      go("#/plans" + qs({ ...params, [name]: value }));
    }, 220);
  };
  useEffect(() => {
    const pos = caret.current;
    if (pos === null) return;
    caret.current = null;
    const el = document.querySelector('input[data-filter="q"]') as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(pos, pos); } catch { /* type=search may refuse */ }
  });
  const onUnfilter = (k: string) => {
    const q2: Record<string, string> = {};
    if (k !== "*") for (const x in params) if (x !== k) q2[x] = params[x];
    go("#/plans" + qs(q2));
  };

  /* ------------------------------------------------------- catalogue --- */
  const families = familiesOf(plans);
  let rows = plans.slice();
  /* Archived plans are OUT of the default catalogue — the page answers "what do
     we sell", and a shelf of dead plans buries it. They are one filter away, and
     the drawer opens for any of them by id whatever the filter says. */
  if (p.status) rows = rows.filter((x) => statusOf(x) === p.status);
  else rows = rows.filter((x) => !x.archived);
  if (p.fam) rows = rows.filter((x) => x.family === p.fam);
  if (p.q) {
    const s = p.q.toLowerCase();
    rows = rows.filter((x) =>
      (x.title + " " + x.subtitle + " " + x.tag + " " +
        x.features.map((f) => f.text + " " + f.detail).join(" ")).toLowerCase().indexOf(s) >= 0);
  }
  rows.sort(sorter(p.sort));

  /* Counted over the LIVE catalogue: an archived plan is not one of the things
     we sell, and folding it into the family tallies would overstate every one. */
  const live = plans.filter((x) => !x.archived);
  const byFam: Record<string, number> = {};
  live.forEach((x) => { byFam[x.family] = (byFam[x.family] || 0) + 1; });

  function route(k: string, v: string) {
    const q2: Record<string, string> = { ...params };
    q2[k] = String(params[k] || "") === String(v) ? "" : v;
    return "#/plans" + qs(q2);
  }

  /* Families first, because "what do we sell" is the question this page
     answers; then the one state that decides whether it can be bought. */
  const cells: (StatCell | "sep")[] = ([
    { k: "plans", v: live.length, to: route("fam", ""), on: !p.fam && !p.status },
    "sep"
  ] as (StatCell | "sep")[]).concat(families.map((f) => ({
    k: familyLabel(f).toLowerCase(), v: byFam[f] || 0,
    to: route("fam", f), on: p.fam === f, title: familyLabel(f) + " plans"
  }))).concat([
    "sep",
    { k: "on sale", v: live.filter((x) => x.active).length,
      dot: "ok", to: route("status", "active"), on: p.status === "active",
      title: "Live on the public plans page" },
    { k: "off sale", v: live.filter((x) => !x.active).length,
      dot: "", to: route("status", "off"), on: p.status === "off",
      title: "Hidden from buyers — existing subscribers unaffected" },
    { k: "archived", v: plans.filter((x) => x.archived).length,
      dot: "", to: route("status", "archived"), on: p.status === "archived",
      title: "Out of the catalogue for good — still readable, and restorable" }
  ] as (StatCell | "sep")[]);

  const chips = Object.keys(params).filter((k) => params[k]).length > 0;

  if (loading && !plans.length) return <ListSkeleton />;

  return (
    <div className="dls">
      <div className="dls-cmd">
        <SearchField key={"q" + p.q} ph="Search plan, description or feature…" val={p.q} onFilter={onSearch} />
        <Select key={"fam" + p.fam} name="fam" label="Family" value={p.fam} onFilter={onFilter}
          options={families.map((f) => ({ v: f, l: familyLabel(f) + " (" + (byFam[f] || 0) + ")" }))} />
        <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
          options={[{ v: "active", l: "On sale" }, { v: "off", l: "Off sale" },
            { v: "archived", l: "Archived" }]} />
        <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[
            { v: "", l: "Sort: Card order" }, { v: "title", l: "Title" },
            { v: "price", l: "Price, high first" }]} />
        <span className="spacer"></span>
        {can("plans", "create")
          ? <button className="btn pri" data-act="pl-new" onClick={() => act("pl-new")}>
              <Icon name="plus" />Create plan
            </button>
          : null}
      </div>

      <StatStrip cells={cells} />

      {error ? <Notice tone="bad" ico="alert" text={<><b>Could not load the catalogue.</b> {error}</>} /> : null}

      {chips ? <div className="dls-chips">
        <FilterChips params={params} onUnfilter={onUnfilter}
          labels={{ q: "Search", fam: "Family", status: "Status", sort: "Sort" }} />
      </div> : null}

      <div className="dls-body">
        <PlansTable rows={rows} p={p} act={act} go={go} onUnfilter={onUnfilter} />
      </div>
    </div>
  );
}

function PlansTable({ rows, p, act, go, onUnfilter }: {
  rows: Plan[]; p: Record<string, string>; act: Act; go: (h: string) => void; onUnfilter: (k: string) => void;
}) {
  const filtered = !!(p.q || p.fam || p.status);
  if (!rows.length)
    return <EmptyState
      icon="tag" title={filtered ? "No plans match these filters" : "No plans yet"}
      body={filtered ? "Nothing matches. Clear a filter to widen the search."
        : "A plan is what we sell: a title, a family, what it includes, and a price for each " +
          "duration it is offered on."}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</button>
        : can("plans", "create")
          ? <button className="btn pri" data-act="pl-new" onClick={() => act("pl-new")}>Create plan</button>
          : null} />;

  return (
    <table className="tbl dls-tbl"><thead><tr>
      <th style={{ width: "3px" }}></th><th>Plan</th><th>Family</th><th>Durations</th>
      <th className="n">Price</th><th>Status</th><th className="n">Tier</th>
    </tr></thead><tbody>
      {rows.map((pl) => {
        const u = urgency(pl);
        const rng = rangeOf(pl);
        const to = "#/plans/" + pl.id;
        return (
          <tr key={pl.id}
            className={"clickable" + (u ? " " + u.cls : "") + (pl.active && !pl.archived ? "" : " dim")}
            data-go={to} onClick={() => go(to)}>
            <td className="rail"><i title={u ? u.why : undefined}></i></td>
            <td>
              <div className="cell-1">{pl.title}{pl.badge ? <> <span className="pill xs">{pl.badge}</span></> : null}</div>
              <div className="cell-2">{pl.subtitle || pl.tag || "—"}</div>
            </td>
            <td><Pill text={familyLabel(pl.family)} /></td>
            <td><DurationChips pl={pl} /></td>
            <td className="n tnum"><PriceCell rng={rng} /></td>
            <td>{pl.archived
              ? <Pill text="Archived" />
              : pl.active ? <Pill text="On sale" tone="ok" /> : <Pill text="Off sale" />}</td>
            <td className="n tnum faint">{pl.tier || "—"}</td>
          </tr>
        );
      })}
    </tbody></table>
  );
}

/* Every duration this plan can be sold on, as chips. A switched-off cycle is
   shown struck through rather than hidden: "we used to sell 6 months and
   stopped" is a fact worth seeing from the list. */
function DurationChips({ pl }: { pl: Plan }) {
  if (!pl.cycles.length) return <span className="faint">not priced</span>;
  return (
    <span className="dls-tags">
      {pl.cycles.map((c) => (
        <span key={c.id} className={"pill xs" + (c.active ? "" : " dead")}
          title={monthsLabel(c.months) + " · " + money(c.price) + (c.active ? "" : " · not on sale")}
          style={c.active ? undefined : { textDecoration: "line-through" }}>
          {c.months}m
        </span>
      ))}
    </span>
  );
}

/* A range, not a price. A plan with three durations does not have "a price",
   and printing only one of them is how a list page starts misleading the
   person reading it. */
function PriceCell({ rng }: { rng: { lo: number; hi: number } | null }) {
  if (!rng) return <span className="faint">—</span>;
  if (rng.lo === rng.hi) return <>{money(rng.lo)}</>;
  return <>{money(rng.lo)}<div className="cell-2">to {money(rng.hi)}</div></>;
}
