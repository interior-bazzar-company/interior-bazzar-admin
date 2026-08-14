/* =====================================================================
   PLANS — the catalogue, and the only place a standard price is set.
   ---------------------------------------------------------------------
   Renders the same five bands as Deals, Quotations and Invoices: a title
   in the topbar, a command row, one stat strip, the active filters, and a
   table in a viewport-bounded body. Nothing here is a new design; the
   whole point is that an agent who can read the Deals table can read this
   one without being taught.

   The old page was a mock — three tiers typed into the view at prices
   that disagreed with what the quotation engine actually sold. It is gone.

   Two surfaces, switched from the topbar:
     Catalogue      what we sell            ← this module owns it
     Subscriptions  who is on what          ← DERIVED from M6 Users,
                                              read-only, no write path
   ===================================================================== */
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { IBData, IBPlans } from "../../engines";
import {
  EmptyState, FilterChips, Icon, Pill, SearchField, Select, StatStrip, qs
} from "../../ui";
import type { StatCell } from "../../ui";
import { useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import PlanDrawer from "./PlanDrawer";
import type { Act } from "./PlanDrawer";
import PlanModal from "./PlanModal";
import ConfirmModal from "./ConfirmModal";
import { actor, isRefusal, money, monthsLabel, sorter, urgency } from "./helpers";
import type { FromEngine } from "./helpers";

export default function Plans() {
  const raw = useParams().id;
  const id = raw ? decodeURIComponent(raw) : null;
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { drawer, modal, closeLayer, toast } = useShell();
  const [tick, bump] = useReducer((n: number) => n + 1, 0);

  const params: Record<string, string> = {};
  sp.forEach((v, k) => { params[k] = v; });
  const p = { q: params.q || "", cat: params.cat || "", status: params.status || "", sort: params.sort || "" };

  /* ---------------------------------------------------------- topbar --- */
  /* The module's name, and nothing on the right.

     There used to be a Catalogue / Subscriptions switcher there. The
     subscriptions surface is gone — Plans owns the catalogue and only ever
     read membership, which M6 Users owns — so a switcher between one thing
     and nothing is a control that answers a question nobody has. Where a
     plan's members are is still on the plan itself, in Where it is used. */
  const crumbs = useMemo(() => <span className="tb-title">Plans</span>, []);
  /* ---------------------------------------------------- where "up" is --- */
  usePageChrome({ crumbs, right: null, parent: id ? "#/plans" + qs(params) : null });

  /* ---------------------------------------------------------- writes --- */
  const done = useCallback((msg: string, ref: string | null) => {
    closeLayer(); toast(msg);
    go(ref ? "#/plans/" + encodeURIComponent(ref) : "#/plans");
    bump();
  }, [closeLayer, toast, go]);

  const act = useCallback<Act>((a, ref) => {
    if (a === "pl-new") return modal(<PlanModal plan={null} onClose={closeLayer} onDone={done} />, "wide");

    const pl = ref ? IBPlans.planOf(ref) : null;
    if (!pl || !ref) return;

    if (a === "pl-edit") return modal(<PlanModal plan={pl} onClose={closeLayer} onDone={done} />, "wide");

    /* ------------------------------------------------------- status --- */
    if (a === "pl-on") {
      const r = IBPlans.Catalogue.setStatus(ref, IBPlans.STATUS.ACTIVE, actor());
      if (isRefusal(r)) return toast(r.http + " " + r.code + " — " + r.detail, "bad");
      toast("On sale — it can now be picked in a quotation.");
      return bump();
    }
    if (a === "pl-restore") {
      const r = IBPlans.Catalogue.setStatus(ref, IBPlans.STATUS.INACTIVE, actor());
      if (isRefusal(r)) return toast(r.http + " " + r.code + " — " + r.detail, "bad");
      toast("Restored as Inactive — put it on sale when the price is right.");
      return bump();
    }
    if (a === "pl-off") {
      const mem = IBPlans.membersOf(pl).length;
      return modal(<ConfirmModal
        heading="Take off sale" sub={pl.title} onClose={closeLayer}
        ico="shield" confirmLabel="Take off sale" confirmCls="btn pri" act="pl-off-go"
        notice={<>
          <b>It disappears from the quotation picker.</b> Nothing else changes:{" "}
          {mem ? <>the <b>{mem}</b> member(s) on it keep their membership, and </> : null}
          every quotation that already names it keeps its own copy of the price.
        </>}
        run={() => {
          const r = IBPlans.Catalogue.setStatus(ref, IBPlans.STATUS.INACTIVE, actor());
          if (isRefusal(r)) return r;
          done("Taken off sale.", ref);
          return r;
        }} />);
    }
    if (a === "pl-archive") {
      const refs = IBPlans.referencesTo(ref);
      return modal(<ConfirmModal
        heading="Archive plan" sub={pl.title} onClose={closeLayer}
        ico="lock" confirmLabel="Archive" confirmCls="btn pri" act="pl-archive-go"
        notice={<>
          <b>Archived, not deleted, because history points at it.</b> {refs.quotations} quotation
          line(s) and {refs.members} membership(s) name this plan. Deleting it would leave those
          records pointing at something that does not exist — archiving keeps them explainable and
          takes it out of the catalogue.
        </>}
        run={() => {
          const r = IBPlans.Catalogue.setStatus(ref, IBPlans.STATUS.ARCHIVED, actor());
          if (isRefusal(r)) return r;
          done("Archived.", null);
          return r;
        }} />);
    }
    if (a === "pl-del") {
      return modal(<ConfirmModal
        heading="Delete plan" sub={pl.title} onClose={closeLayer}
        tone="bad" confirmLabel="Delete plan" confirmCls="btn dgr" act="pl-del-go"
        notice={<>
          Nothing references this plan — no quotation line, no membership — so it can go outright.
          The moment anything does, this button becomes <b>Archive</b> instead.
        </>}
        run={() => {
          const r = IBPlans.Catalogue.remove(ref, actor());
          if (isRefusal(r)) return r;
          done("Plan deleted.", null);
          return r;
        }} />);
    }
  }, [modal, closeLayer, toast, done]);

  /* ---------------------------------------------------------- drawer --- */
  /* The prototype opened the drawer from the router on every render and let
     render() close it again first. Here the effect is the render: it re-opens
     on `tick`, which is what `S.render()` did after every mutation. */
  useEffect(() => {
    if (!id) return;
    const pl = IBPlans.planOf(id);
    if (!pl) { toast("404 plan_not_found — no plan " + id + ".", "bad"); go("#/plans"); return; }
    drawer(<PlanDrawer plan={pl} act={act} go={go} />);
  }, [id, tick, act, drawer, go, toast]);

  /* Leaving the record closes its drawer, the way the prototype's render()
     dropped every layer before drawing the next route. */
  useEffect(() => { if (!id) return; return () => closeLayer(); }, [id, closeLayer]);

  /* --------------------------------------------------------- filters --- */
  const timer = useRef<number | undefined>(undefined);
  const caret = useRef<number | null>(null);

  const onFilter = (name: string, value: string) => {
    const q2 = { ...params, [name]: value };
    go("#/plans" + (id ? "/" + encodeURIComponent(id) : "") + qs(q2));
  };
  /* Typing is debounced 220ms, and the caret is handed back afterwards — the
     input is remounted by the new `q` in the URL, exactly as the prototype's
     innerHTML swap replaced it, so the focus has to be re-asked for. */
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
  const all = IBPlans.all();
  let rows = all.slice();

  /* Archived plans are history. They are out of the list unless asked for
     by name, because a catalogue that shows what we no longer sell beside
     what we do is a catalogue you have to read twice. */
  if (p.status === "archived") rows = rows.filter((x: FromEngine) => x.status === "archived");
  else if (p.status) rows = rows.filter((x: FromEngine) => x.status === p.status);
  else rows = rows.filter((x: FromEngine) => x.status !== "archived");

  if (p.cat) rows = rows.filter((x: FromEngine) => x.category === p.cat);
  if (p.q) {
    const s = p.q.toLowerCase();
    rows = rows.filter((x: FromEngine) =>
      (x.title + " " + x.plan_id + " " + (x.description || "") + " " +
        x.features.map((f: FromEngine) => f.label).join(" ")).toLowerCase().indexOf(s) >= 0);
  }
  rows.sort(sorter(p.sort));

  const live = all.filter((x: FromEngine) => x.status !== "archived");
  const byCat: Record<string, number> = {};
  live.forEach((x: FromEngine) => { byCat[x.category] = (byCat[x.category] || 0) + 1; });
  let members = 0;
  all.forEach((x: FromEngine) => { members += IBPlans.membersOf(x).length; });

  function route(k: string, v: string) {
    const q2: Record<string, string> = { ...params };
    q2[k] = String(params[k] || "") === String(v) ? "" : v;
    return "#/plans" + qs(q2);
  }

  /* Categories first, because "what do we sell" is the question this page
     answers; then the two states that decide whether it can be sold at
     all; then the one number that says whether anybody bought it. */
  const cells: (StatCell | "sep")[] = ([
    { k: "total", v: live.length, to: route("cat", ""), on: !p.cat && !p.status },
    "sep"
  ] as (StatCell | "sep")[]).concat(IBPlans.CATEGORIES.map((c: FromEngine) => ({
    k: c.label.toLowerCase(), v: byCat[c.key] || 0,
    to: route("cat", c.key), on: p.cat === c.key, title: c.blurb
  }))).concat([
    "sep",
    { k: "active", v: live.filter((x: FromEngine) => x.status === "active").length,
      dot: "ok", to: route("status", "active"), on: p.status === "active",
      title: "On sale — selectable in a quotation" },
    { k: "draft", v: live.filter((x: FromEngine) => x.status === "draft").length,
      dot: "", to: route("status", "draft"), on: p.status === "draft",
      title: "Being written — not sellable yet" },
    "sep",
    { k: "members", v: members, tone: "ok",
      title: "Memberships pointing at a plan — read from Users, never stored here" }
  ] as (StatCell | "sep")[]);

  const chips = Object.keys(params).filter((k) => params[k] && k !== "tab").length > 0;

  return (
    <div className="dls">
      <div className="dls-cmd">
        <SearchField key={"q" + p.q} ph="Search plan, description or feature…" val={p.q} onFilter={onSearch} />
        <Select key={"cat" + p.cat} name="cat" label="Category" value={p.cat} onFilter={onFilter}
          options={IBPlans.CATEGORIES.map((c: FromEngine) => ({ v: c.key, l: c.label + " (" + (byCat[c.key] || 0) + ")" }))} />
        <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
          options={["active", "draft", "inactive", "archived"].map((st) => ({ v: st, l: IBPlans.LABEL[st] }))} />
        <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[
            { v: "", l: "Sort: Category" }, { v: "title", l: "Title" },
            { v: "price", l: "Price, high first" }, { v: "updated", l: "Recently updated" },
            { v: "members", l: "Members" }]} />
        <span className="spacer"></span>
        <button className="btn pri" data-act="pl-new" onClick={() => act("pl-new")}>
          <Icon name="plus" />Create plan
        </button>
      </div>

      <StatStrip cells={cells} />

      {chips ? <div className="dls-chips">
        <FilterChips params={params} onUnfilter={onUnfilter}
          labels={{ q: "Search", cat: "Category", status: "Status", sort: "Sort" }} />
      </div> : null}

      <div className="dls-body">
        <PlansTable rows={rows} p={p} act={act} go={go} onUnfilter={onUnfilter} />
      </div>
    </div>
  );
}

function PlansTable({ rows, p, act, go, onUnfilter }: {
  rows: FromEngine[]; p: Record<string, string>; act: Act; go: (h: string) => void; onUnfilter: (k: string) => void;
}) {
  const filtered = !!(p.q || p.cat || p.status);
  if (!rows.length)
    return <EmptyState
      icon="tag" title={filtered ? "No plans match these filters" : "No plans yet"}
      body={filtered ? "Nothing matches. Clear a filter to widen the search."
        : "A plan is what we sell: a title, a category, what it includes, and a price for each " +
          "duration it is offered on."}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</button>
        : <button className="btn pri" data-act="pl-new" onClick={() => act("pl-new")}>Create plan</button>} />;

  return (
    <table className="tbl dls-tbl"><thead><tr>
      <th style={{ width: "3px" }}></th><th>Plan</th><th>Category</th><th>Durations</th>
      <th className="n">Price</th><th>Status</th><th className="n">Members</th><th>Updated</th>
    </tr></thead><tbody>
      {rows.map((pl: FromEngine) => {
        const u = urgency(pl);
        const rng = IBPlans.rangeOf(pl);
        const mem = IBPlans.membersOf(pl).length;
        const to = "#/plans/" + pl.plan_id;
        return (
          <tr key={pl.plan_id}
            className={"clickable" + (u ? " " + u.cls : "") + (pl.status === "archived" ? " dim" : "")}
            data-go={to} onClick={() => go(to)}>
            <td className="rail"><i title={u ? u.why : undefined}></i></td>
            <td>
              <div className="cell-1">{pl.title}</div>
              <div className="cell-2">{pl.description || "—"}</div>
            </td>
            <td><Pill text={IBPlans.categoryLabel(pl.category)} /></td>
            <td><DurationChips pl={pl} /></td>
            <td className="n tnum"><PriceCell rng={rng} /></td>
            <td><Pill text={IBPlans.LABEL[pl.status]} tone={IBPlans.TONE[pl.status]} /></td>
            <td className="n tnum">{mem || <span className="faint">—</span>}</td>
            <td><div className="cell-2">{IBData.fmtDate(pl.updated_at)}
              <div className="cell-2">rev {pl.revision}</div></div></td>
          </tr>
        );
      })}
    </tbody></table>
  );
}

/* Every duration this plan can be sold on, as chips. An inactive row is
   shown struck through rather than hidden: "we used to sell 6 months and
   stopped" is a fact worth seeing from the list. */
function DurationChips({ pl }: { pl: FromEngine }) {
  if (!pl.pricing.length) return <span className="faint">not priced</span>;
  return (
    <span className="dls-tags">
      {pl.pricing.map((r: FromEngine, i: number) => (
        <span key={i} className={"pill xs" + (r.active ? "" : " dead")}
          title={monthsLabel(r.months) + " · " + money(IBPlans.finalOf(r)) + (r.active ? "" : " · not on sale")}
          style={r.active ? undefined : { textDecoration: "line-through" }}>
          {r.months}m
        </span>
      ))}
    </span>
  );
}

/* A range, not a price. A plan with four durations does not have "a
   price", and printing only one of them is how a list page starts
   misleading the person reading it. */
function PriceCell({ rng }: { rng: FromEngine }) {
  if (!rng) return <span className="faint">—</span>;
  if (rng.lo === rng.hi) return <>{money(rng.lo)}</>;
  return <>{money(rng.lo)}<div className="cell-2">to {money(rng.hi)}</div></>;
}
