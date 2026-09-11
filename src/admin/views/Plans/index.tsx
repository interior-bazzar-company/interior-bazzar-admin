/* =====================================================================
   PLANS — the catalogue, and the only place a price is set.
   ---------------------------------------------------------------------
   Reads and writes `v1/admin/plans/` (interior_admin PlansViews). These are
   the same Subscription / PlanBillingCycle rows the public plans page
   renders from, so a price changed here is the price a buyer is charged —
   the controller drops the public plans cache on every write, and the
   change is live immediately.

   The page reads top to bottom the way the question is asked: what is this
   page (header + the one primary action), how do I narrow it (filter bar),
   what is in it (the stat strip, every cell its own filter), and then the
   catalogue itself as one queue table with the exception rail on the left.

   Two states, not four. The server has one `isActive` flag per plan (plus a
   soft delete), so "draft" and "inactive" — engine inventions with nowhere
   to be stored — are gone rather than shown as states a save would silently
   drop. On sale · off sale is the whole vocabulary.
   ===================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AdminOpsService from "../../../api/modules/adminOps";
import { errMessage } from "../../../api/apiService";
import { Alert, Button, EmptyState, FilterBar, FilterChips, ListSkeleton, ListTable, MoreMenu, PageHeader, Pill, qs, Rail, SearchField, Select, StatStrip, TbTitle } from "../../ui";
import type { MenuItem, StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import PlanDrawer from "./PlanDrawer";
import type { Act } from "./PlanDrawer";
import PlanModal from "./PlanModal";
import ConfirmModal from "./ConfirmModal";
import { call, familiesOf, rangeOf, usePlans } from "./api";
import type { Plan } from "./api";
import { familyLabel, sorter, statusOf, urgency } from "./helpers";
import { DurationChips, PlanStatus, PriceRange, railTone } from "./bits";

const CHIP_LABELS = { q: "Search", fam: "Family", status: "Status", sort: "Sort" };

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
  const crumbs = useMemo(() => <TbTitle label="Plans" to="#/plans" />, []);
  usePageChrome({ crumbs, right: null, parent: id ? "#/plans" + qs(params) : null });

  /* ---------------------------------------------------------- writes --- */
  const done = useCallback((msg: string, ref: number | null) => {
    closeLayer(); toast(msg);
    go(ref ? "#/plans/" + ref : "#/plans");
    bump();
  }, [closeLayer, toast, go, bump]);

  const act = useCallback<Act>((a, ref) => {
    if (a === "pl-new") return modal(<PlanModal plan={null} families={familiesOf(plans)}
      onClose={closeLayer} onDone={done} />, "xl");

    const pl = ref ? plans.filter((x) => x.id === ref)[0] : null;
    if (!pl || !ref) return;

    if (a === "pl-edit") return modal(<PlanModal plan={pl} families={familiesOf(plans)}
      onClose={closeLayer} onDone={done} />, "xl");

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
        ico="shield" confirmLabel="Take off sale" confirmCls="pri" act="pl-off-go"
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
        ico="lock" confirmLabel="Archive" confirmCls="pri" act="pl-archive-go"
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
     the prototype's render() did after a write. Wide, because the pricing
     table inside it is the point of the record. */
  useEffect(() => {
    if (!id || loading) return;
    const pl = plans.filter((x) => String(x.id) === id)[0];
    if (!pl) { toast("404 plan_not_found — no plan " + id + ".", "bad"); go("#/plans"); return; }
    drawer(<PlanDrawer plan={pl} act={act} go={go} />, undefined, "xl");
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
  const onSale = live.filter((x) => x.active).length;
  const byFam: Record<string, number> = {};
  live.forEach((x) => { byFam[x.family] = (byFam[x.family] || 0) + 1; });

  function route(k: string, v: string) {
    const q2: Record<string, string> = { ...params };
    q2[k] = String(params[k] || "") === String(v) ? "" : v;
    return "#/plans" + qs(q2);
  }

  /* Families first, because "what do we sell" is the question this page
     answers; then the one state that decides whether it can be bought. A
     separator with nothing on either side of it is not drawn — an empty
     catalogue must read as empty, not as broken furniture. */
  const cells: (StatCell | "sep")[] = [
    { k: "plans", v: live.length, to: route("fam", ""), on: !p.fam && !p.status },
  ];
  if (families.length) {
    cells.push("sep");
    families.forEach((f) => cells.push({
      k: familyLabel(f).toLowerCase(), v: byFam[f] || 0,
      to: route("fam", f), on: p.fam === f, title: familyLabel(f) + " plans",
    }));
  }
  cells.push(
    "sep",
    { k: "on sale", v: onSale,
      dot: "ok", to: route("status", "active"), on: p.status === "active",
      title: "Live on the public plans page" },
    { k: "off sale", v: live.length - onSale,
      dot: "neutral", to: route("status", "off"), on: p.status === "off",
      title: "Hidden from buyers — existing subscribers unaffected" },
    { k: "archived", v: plans.filter((x) => x.archived).length,
      dot: "neutral", to: route("status", "archived"), on: p.status === "archived",
      title: "Out of the catalogue for good — still readable, and restorable" },
  );

  const chips = Object.keys(params).filter((k) => params[k]).length > 0;

  if (loading && !plans.length) return <ListSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Plans"
        meta={<>
          <span>{live.length} in the catalogue</span>
          <span>{onSale} on sale</span>
          {chips ? <span>{rows.length} shown</span> : null}
        </>}
        actions={can("plans", "create")
          ? <Button color="primary" ico="plus" data-act="pl-new" onClick={() => act("pl-new")}>New plan</Button>
          : null}
      />

      <FilterBar
        search={<SearchField key={"q" + p.q} ph="Search plan, description or feature…" val={p.q} onFilter={onSearch} />}
        filters={<>
          {families.length
            ? <Select key={"fam" + p.fam} name="fam" label="Family" value={p.fam} onFilter={onFilter}
                options={families.map((f) => ({ v: f, l: familyLabel(f) + " (" + (byFam[f] || 0) + ")" }))} />
            : null}
          <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
            options={[
              { v: "active", l: "On sale", dot: "ok" },
              { v: "off", l: "Off sale", dot: "neutral" },
              { v: "archived", l: "Archived", dot: "neutral" }]} />
          <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
            allLabel="Card order"
            options={[{ v: "title", l: "Title" }, { v: "price", l: "Price, high first" }]} />
        </>}
        chips={chips
          ? <FilterChips params={params} labels={CHIP_LABELS} onUnfilter={onUnfilter} />
          : null}
      />

      <StatStrip cells={cells} />

      {error
        ? <Alert tone="bad" title="Could not load the catalogue">{error}</Alert>
        : null}

      <PlansTable rows={rows} p={p} act={act} go={go} onUnfilter={onUnfilter} />
    </div>
  );
}

/* THE CATALOGUE ITSELF. One row per plan, the exception rail on the left for
   the one failure a catalogue can have, and the row's own actions behind a
   menu so the whole row stays a link to the record. */
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
        ? <Button color="secondary" ico="x" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</Button>
        : can("plans", "create")
          ? <Button color="primary" ico="plus" data-act="pl-new" onClick={() => act("pl-new")}>New plan</Button>
          : null} />;

  return (
    <ListTable min="60rem" head={<tr>
      <th className="rail" /><th scope="col">Plan</th><th scope="col">Family</th>
      <th scope="col">Durations</th><th scope="col" className="n">Price</th>
      <th scope="col">Status</th><th scope="col" className="n">Tier</th>
      <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
    </tr>}>
      {rows.map((pl) => {
        const u = urgency(pl);
        const to = "#/plans/" + pl.id;
        return (
          <tr key={pl.id} className="clickable" data-go={to} onClick={() => go(to)}>
            <Rail tone={railTone(u)} title={u ? u.why : undefined} />
            <td className="cell-1">
              <span className="flex flex-wrap items-center gap-1.5">
                {pl.title}
                {pl.badge ? <Pill xs tone="brand" text={pl.badge} title="The ribbon printed on the public card" /> : null}
              </span>
              <span className="cell-2 flex">{pl.subtitle || pl.tag || "—"}</span>
            </td>
            <td><Pill tone="neutral" text={familyLabel(pl.family)} /></td>
            <td><DurationChips cycles={pl.cycles} /></td>
            <td className="n"><PriceRange range={rangeOf(pl)} /></td>
            <td><PlanStatus plan={pl} /></td>
            <td className="n text-quaternary">{pl.tier || "—"}</td>
            <td className="acts" onClick={(e) => e.stopPropagation()}>
              <RowMenu plan={pl} act={act} />
            </td>
          </tr>
        );
      })}
    </ListTable>
  );
}

/* Locked actions are ABSENT, not greyed — a disabled row action invites a
   click and a support ticket. Archive is not drawn destructive: nothing is
   destroyed by it, and the confirm says exactly what survives. */
function RowMenu({ plan: pl, act }: { plan: Plan; act: Act }) {
  const items: MenuItem[] = [];
  if (pl.archived) {
    if (can("plans", "archive"))
      items.push({ icon: "undo", label: "Restore plan", act: () => act("pl-restore", pl.id) });
  } else {
    if (can("plans", "edit") || can("plans", "pricing"))
      items.push({ icon: "edit", label: "Edit plan", act: () => act("pl-edit", pl.id) });
    if (can("plans", "status"))
      items.push(pl.active
        ? { icon: "eyeoff", label: "Take off sale", act: () => act("pl-off", pl.id) }
        : { icon: "check", label: "Put on sale", act: () => act("pl-on", pl.id) });
    if (can("plans", "archive"))
      items.push({ icon: "archive", label: "Archive", act: () => act("pl-archive", pl.id) });
  }
  if (!items.length) return null;
  return <MoreMenu small items={items} align="right" />;
}
