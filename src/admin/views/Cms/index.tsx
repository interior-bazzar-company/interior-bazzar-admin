/* =============================================================================
   CMS — #/content
   -----------------------------------------------------------------------------
     #/content                       every content area, grouped
     #/content/blog                  one resource's list
     #/content/blog/new              the editor, a new row
     #/content/blog/12               the editor, row 12
     #/content/bin                   recently deleted, restorable until purged

   ONE MODULE, MANY RESOURCES. The server gates the whole CMS with one module
   key (`content`) and serves every resource through one route family
   (`v1/admin/cms/<resource>/`), so the panel is one view that reads its
   resource from the URL and its shape from resources.tsx — adding a resource
   is a row there, not a screen.

   Editors follow the CMS docs: atomic content (banners, tiles, cards) is a
   50/50 form + live preview; long-form (blog, legal pages) is full width with
   an Edit / Preview toggle, so the reader preview keeps its real measure.

   HIDE IS NOT DELETE. Hide (the Live switch) takes a row off the site and keeps
   it here indefinitely. Delete moves it to the recycle bin for the resource's
   restore window (longer for what matters more), after which it is erased.
   ============================================================================= */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { can } from "../../auth/session";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, Card, ConfirmModal, DrawerShell, EmptyState, FilterBar, FilterChips, Icon, IconButton, Input,
  KvList, ListSkeleton, ModalShell, PageHeader, Pagination, PaneLoading, Pill, qs, SearchField, Segmented, Select,
  StatStrip, Table, TbTitle, fmtDate,
} from "../../ui";
import { go } from "../../ui/nav";
import { errMessage } from "../../../api/apiService";
import CmsService from "../../../api/modules/cms";
import type { BinRow, CmsList, CmsRow } from "../../../api/modules/cms";
import { FieldInput, getAt, PreviewCanvas, RichText, setAt } from "./fields";
import { KycRejectModal } from "./KycRejectModal";
import { RES_OF, RESOURCES } from "./resources";
import type { FieldSpec, ResSpec } from "./resources";
import { confirmLeave, useUnsavedGuard } from "./useUnsavedGuard";

const ROUTE = "#/content";
const BlogCardPreview = lazy(() => import("../../components/cms-previews/BlogCardPreview"));

/** Areas that live in other modules, linked so the CMS home is the one map. */
const ELSEWHERE = [
  { label: "Plans", desc: "The plan catalogue: prices, cycles, features.", icon: "tag", to: "#/plans", key: "plans" },
  { label: "Subscriptions", desc: "Who holds which plan, renewals and defaults.", icon: "cash", to: "#/finance", key: "finance" },
];

export default function Cms() {
  const { id, sub } = useParams();
  const spec = id ? RES_OF[id] : undefined;
  if (!id) return <Landing />;
  if (id === "bin") return <BinPage />;
  if (!spec) return <EmptyState icon="doc" title="No such content area" body="Pick one from the CMS home." />;
  if (sub === "new" && spec.singleton) return <ListPage key={spec.key} spec={spec} />;
  if (sub && !spec.readOnly) return <Editor key={spec.key + sub} spec={spec} rowId={sub === "new" ? null : sub} />;
  return <ListPage key={spec.key} spec={spec} />;
}

/** The viewer's own calendar day of an instant (the API sends UTC). */
const dayOf = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return fmtDate(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
};
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

/* -------------------------------------------------------------- landing -- */
function Tile({ icon, label, desc, onClick }: { icon: string; label: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex cursor-pointer items-start gap-3 rounded-xl bg-primary p-4 text-left ring-1 ring-secondary outline-focus-ring transition hover:bg-primary_hover focus-visible:outline-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-fg-secondary">
        <Icon name={icon} size="sm" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-primary">{label}</span>
        <span className="mt-0.5 block text-xs text-tertiary">{desc}</span>
      </span>
    </button>
  );
}

function Landing() {
  usePageChrome({ crumbs: <TbTitle label="CMS" to={ROUTE} /> });
  const groups = useMemo(() => {
    const out: Record<string, ResSpec[]> = {};
    RESOURCES.filter((r) => !r.hidden).forEach((r) => { (out[r.group] = out[r.group] || []).push(r); });
    return Object.entries(out);
  }, []);
  const elsewhere = ELSEWHERE.filter((x) => can(x.key));
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="CMS" meta={<span>Everything the public site says, edited here and live on save.</span>}
        actions={<Button color="secondary" ico="trash" onClick={() => go(ROUTE + "/bin")}>Recently deleted</Button>} />
      {groups.map(([g, items]) => (
        <section key={g} className="flex flex-col gap-3">
          <h2 className="label-mono">{g}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => <Tile key={r.key} icon={r.icon} label={r.label} desc={r.desc} onClick={() => go(ROUTE + "/" + r.key)} />)}
          </div>
        </section>
      ))}
      {elsewhere.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="label-mono">Plans & subscriptions — in their own modules</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {elsewhere.map((x) => <Tile key={x.key} icon={x.icon} label={x.label} desc={x.desc} onClick={() => go(x.to)} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ bin -- */
function BinPage() {
  const shell = useShell();
  const [rows, setRows] = useState<BinRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  usePageChrome({ crumbs: <TbTitle label="CMS" to={ROUTE} />, parent: ROUTE });

  useEffect(() => {
    let cancelled = false;
    CmsService.bin({ pageNo: page })
      .then((d) => { if (!cancelled) { setRows(d.rows); setTotal(d.total); } })
      .catch((e) => { if (!cancelled) { setRows([]); shell.toast(errMessage(e), "bad"); } });
    return () => { cancelled = true; };
  }, [tick, page, shell]);

  const restore = async (b: BinRow) => {
    try {
      const r = await CmsService.restore(b.id);
      shell.toast("Restored — back on the site.", "ok");
      go(ROUTE + "/" + r.resource + "/" + r.id);
    } catch (e) { shell.toast(errMessage(e), "bad"); setTick((t) => t + 1); }
  };
  const purge = (b: BinRow) => shell.modal(
    <ConfirmModal tone="bad" verb="Erase now" title={"Erase " + b.title + " for good?"}
      body="It cannot be restored after this." onClose={shell.closeLayer}
      onConfirm={async () => {
        try { await CmsService.purge(b.id); shell.closeLayer(); shell.toast("Erased.", "ok"); setTick((t) => t + 1); }
        catch (e) { shell.closeLayer(); shell.toast(errMessage(e), "bad"); setTick((t) => t + 1); }
      }} />,
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title="Recently deleted" back={{ label: "CMS", to: ROUTE }}
        meta={<span>Deleted content waits here until its date, then is erased for good.</span>} />
      {!rows ? <ListSkeleton /> : (
        <Table list
          cols={[{ label: "What" }, { label: "Area", w: "190px" }, { label: "Deleted", w: "170px" },
            { label: "Erased on", w: "150px" }, { label: "", cls: "acts", w: "200px" }]}
          empty={{ icon: "trash", title: "Nothing deleted", body: "Deleted content shows up here while it can still be restored." }}
          rows={rows.map((b) => (
            <tr key={b.id}>
              <td><span className="line-clamp-2 break-words">{b.title || "Untitled"}</span><div className="cell-2">#{b.rowId}</div></td>
              <td>{RES_OF[b.resource]?.label || b.resource}</td>
              <td>{dayOf(b.deletedAt)}<div className="cell-2">{b.deletedBy ? "by " + b.deletedBy : ""}</div></td>
              <td>{dayOf(b.purgeAt)}<div className="cell-2">{daysLeft(b.purgeAt)} days left</div></td>
              <td className="acts">
                {can("content", "delete") ? (
                  <span className="inline-flex gap-1">
                    <Button size="sm" color="secondary" ico="undo" onClick={() => void restore(b)}>Restore</Button>
                    <Button size="sm" color="secondary-destructive" onClick={() => purge(b)}>Erase</Button>
                  </span>
                ) : null}
              </td>
            </tr>
          ))} />
      )}
      <Pagination page={page} pages={Math.ceil(total / 50)} total={total} pageSize={50} unit="deleted items" onPage={setPage} />
    </div>
  );
}

/* ----------------------------------------------------------------- list -- */
function ListPage({ spec }: { spec: ResSpec }) {
  const shell = useShell();
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);
  const pageNo = Number(p.page || 1);
  const pageSize = spec.reorder ? 200 : 25;
  const [data, setData] = useState<CmsList | null>(null);
  const [tick, setTick] = useState(0);
  const [stats, setStats] = useState<{ total: number; active: number; confirmed: number } | null>(null);
  const [fkOpts, setFkOpts] = useState<Record<string, { v: string; l: string }[]>>({});
  const drag = useRef<number | null>(null);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const here = ROUTE + "/" + spec.key;
  const filterKeys = useMemo(() => ["q", "from", "to", ...(spec.filters || []).map((f) => f.k)], [spec]);

  usePageChrome({ crumbs: <TbTitle label="CMS" to={ROUTE} />, parent: ROUTE });

  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string | number> = { pageNo, pageSize };
    filterKeys.forEach((k) => { if (p[k]) params[k] = p[k]; });
    CmsService.list(spec.key, params)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (!cancelled) {
          setData({ rows: [], total: 0, pageNo: 1, pageSize, canCreate: false, canDelete: false, keepDays: null, facets: {} });
          shell.toast(errMessage(e), "bad");
        }
      });
    if (spec.key === "subscribers") CmsService.subscriberStats().then((s) => { if (!cancelled) setStats(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [spec, p, pageNo, pageSize, tick, shell, filterKeys]);

  useEffect(() => {
    (spec.filters || []).filter((f) => f.fk).forEach((f) => {
      CmsService.list(f.fk!.res, { pageSize: 200 })
        .then((d) => setFkOpts((o) => ({ ...o, [f.k]: d.rows.map((r) => ({ v: String(r.id), l: String(r[f.fk!.label] || r.id) })) })))
        .catch(() => {});
    });
  }, [spec]);

  const onFilter = (name: string, value: string) => {
    const next = { ...p, [name]: value };
    delete next.page;
    if (!value) delete next[name];
    go(here + qs(next));
  };
  const filtered = filterKeys.some((k) => !!p[k]);
  /* Reorder renumbers exactly the rows on screen, so it is allowed only when
     they are a whole set: no filter, or just the resource's scope (a banner's
     page, an option's group). */
  const reorderable = !!spec.reorder && filterKeys.every((k) => !p[k] || k === spec.reorderScope)
    && (!spec.reorderScope || !!p[spec.reorderScope]);
  const canEdit = can("content", "edit");

  const commitOrder = async (rows: CmsRow[]) => {
    if (!data) return;
    setData({ ...data, rows });
    try { await CmsService.reorder(spec.key, rows.map((r) => r.id)); }
    catch (e) { shell.toast(errMessage(e), "bad"); }
    refresh();
  };
  const move = (i: number, j: number) => {
    if (!data || j < 0 || j >= data.rows.length || i === j) return;
    const rows = data.rows.slice();
    const [r] = rows.splice(i, 1);
    rows.splice(j, 0, r);
    void commitOrder(rows);
  };
  const dragProps = (i: number) => (reorderable && canEdit ? {
    draggable: true,
    onDragStart: (e: DragEvent) => { drag.current = i; e.dataTransfer.effectAllowed = "move"; },
    onDragOver: (e: DragEvent) => { if (drag.current !== null) e.preventDefault(); },
    onDrop: (e: DragEvent) => { e.preventDefault(); if (drag.current !== null) move(drag.current, i); drag.current = null; },
    onDragEnd: () => { drag.current = null; },
  } : {});

  const toggleLive = async (r: CmsRow) => {
    try {
      await CmsService.save(spec.key, { isActive: !r.isActive }, r.id);
      shell.toast(spec.key === "subscribers" ? (r.isActive ? "Unsubscribed." : "Subscribed again.") : (r.isActive ? "Hidden from the site." : "Live again."), "ok");
      refresh();
    } catch (e) { shell.toast(errMessage(e), "bad"); }
  };

  const remove = (r: CmsRow) => shell.modal(
    <ConfirmModal tone="bad" verb="Delete" title={"Delete " + spec.titleOf(r) + "?"}
      body={spec.key === "subscribers"
        ? "Their email is erased in " + data?.keepDays + " days (until then it can be restored from Recently deleted). To stop mail but keep the record, unsubscribe instead."
        : "It leaves the site now and waits in Recently deleted for " + data?.keepDays
          + " days — restore it any time before then. After that it is erased for good."}
      onClose={shell.closeLayer}
      onConfirm={async () => {
        try {
          const res = await CmsService.remove(spec.key, r.id);
          shell.closeLayer();
          shell.toast("Deleted — restorable until " + dayOf(res.purgeAt) + ".", "ok");
          refresh();
        } catch (e) { shell.closeLayer(); shell.toast(errMessage(e), "bad"); refresh(); }
      }} />,
  );

  const review = (r: CmsRow, status: "verified" | "rejected") => {
    const run = async (reason = "") => {
      const res = await CmsService.reviewKyc(r.id, status, reason);
      shell.closeLayer();
      shell.toast(status === "verified"
        ? (res.businessVerified ? "Verified — the business is now verified." : "Verified.")
        : (r.businessVerified ? "Rejected — the business is no longer verified." : "Rejected."), "ok");
      refresh();
    };
    if (status === "verified") {
      shell.modal(<ConfirmModal tone="pri" verb="Verify" title={"Verify " + r.docType + " for " + r.businessName + "?"}
        body="Check the storefront photo is a real photo of the premises with signage, and the paper matches the business name and number."
        onClose={shell.closeLayer} onConfirm={() => void run().catch((e) => shell.toast(errMessage(e), "bad"))} />);
    } else {
      shell.modal(<KycRejectModal docType={r.docType} businessName={r.businessName} onClose={shell.closeLayer} run={run} />);
    }
  };

  const openSubscriber = (r: CmsRow) => shell.drawer(
    <DrawerShell title={r.email} sub={r.isActive ? "Subscribed" : "Unsubscribed"} onClose={shell.closeLayer}
      actions={canEdit ? <Button color={r.isActive ? "secondary-destructive" : "primary"}
        onClick={() => { shell.closeLayer(); void toggleLive(r); }}>{r.isActive ? "Unsubscribe" : "Subscribe again"}</Button> : null}>
      <KvList pairs={[
        ["Email", r.email], ["Source", r.source], ["Confirmed", r.isConfirmed ? "Yes" : "Pending"],
        ["Status", r.isActive ? "Subscribed" : "Unsubscribed"], ["Joined", r.timestamp ? dayOf(r.timestamp) : ""],
        ["Account", r.userName || "Not signed in when subscribing"],
      ]} />
      <p className="mt-4 text-xs text-tertiary">Confirmation emails are not sent by the platform yet, so there is nothing to resend.</p>
    </DrawerShell>,
  );

  const exportCsv = async () => {
    try {
      const csv = await CmsService.subscriberExport(Object.fromEntries(filterKeys.map((k) => [k, p[k]])));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "newsletter-subscribers.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { shell.toast(errMessage(e), "bad"); }
  };

  const editable = !spec.readOnly;
  const hasLive = (r: CmsRow) => typeof r.isActive === "boolean" && spec.key !== "kyc";
  const rowActs = (r: CmsRow, i: number) => (
    <td className="acts" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex items-center gap-1">
        {spec.key === "kyc" ? (
          <>
            {r.fileUrl ? <IconButton ico="ext" label="Open file" onClick={() => window.open(r.fileUrl, "_blank", "noopener")} /> : null}
            {can("content", "verify") && r.isCurrent && r.status !== "verified" ? <Button size="sm" color="secondary" onClick={() => review(r, "verified")}>Verify</Button> : null}
            {can("content", "verify") && r.isCurrent && r.status !== "rejected" ? <Button size="sm" color="secondary-destructive" onClick={() => review(r, "rejected")}>Reject</Button> : null}
          </>
        ) : (
          <>
            {reorderable && canEdit ? (
              <>
                <IconButton ico="up" label="Move up" isDisabled={i === 0} onClick={() => move(i, i - 1)} />
                <IconButton ico="down" label="Move down" isDisabled={!data || i === data.rows.length - 1} onClick={() => move(i, i + 1)} />
              </>
            ) : null}
            {hasLive(r) && canEdit && spec.key !== "subscribers"
              ? <IconButton ico={r.isActive ? "eyeoff" : "eye"} label={r.isActive ? "Hide from the site" : "Show on the site"} onClick={() => void toggleLive(r)} /> : null}
            {data?.canDelete && can("content", "delete")
              ? <IconButton ico="trash" label="Delete" onClick={() => remove(r)} /> : null}
          </>
        )}
      </span>
    </td>
  );

  const filterOptions = (f: NonNullable<ResSpec["filters"]>[number]) =>
    f.options || (f.facet ? (data?.facets?.[f.k] || []).map((v) => ({ v, l: v })) : fkOpts[f.k] || []);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={spec.label} meta={<span>{spec.desc}</span>}
        back={{ label: "CMS", to: ROUTE }}
        actions={<>
          {spec.key === "subscribers" && can("content", "export") ? <Button color="secondary" ico="download" onClick={() => void exportCsv()}>Export CSV</Button> : null}
          {data?.canCreate && editable && !spec.singleton && can("content", "create")
            ? <Button color="primary" ico="plus" onClick={() => go(here + "/new")}>New {spec.noun}</Button> : null}
        </>} />

      {stats ? <StatStrip cells={[{ k: "subscribers", v: stats.total }, "sep", { k: "subscribed", v: stats.active, dot: "ok" }, { k: "confirmed", v: stats.confirmed }]} /> : null}

      {spec.key === "support-config" || spec.key === "brand-asset" ? null : (
        <FilterBar
          search={<SearchField ph={"Search " + spec.label.toLowerCase() + "…"} name="q" val={p.q} onFilter={onFilter} />}
          filters={<>
            {(spec.filters || []).map((f) => (
              <Select key={f.k} name={f.k} label={f.label} value={p[f.k]} onFilter={onFilter} options={filterOptions(f)} />
            ))}
            {spec.dates ? (
              <span className="inline-flex items-center gap-1.5">
                <Input type="date" ariaLabel="From" value={p.from || ""} max={p.to} onChange={(v) => onFilter("from", v)} />
                <span className="text-xs text-tertiary">to</span>
                <Input type="date" ariaLabel="To" value={p.to || ""} min={p.from} onChange={(v) => onFilter("to", v)} />
              </span>
            ) : null}
          </>}
          chips={filtered ? <FilterChips params={Object.fromEntries(filterKeys.map((k) => [k, p[k]]))} onUnfilter={(n) => onFilter(n, "")} /> : null} />
      )}
      {spec.reorder && !reorderable ? <Alert tone="info" title={spec.reorderScope
        ? "Pick one " + (spec.filters || []).find((f) => f.k === spec.reorderScope)?.label.toLowerCase() + " (and nothing else) to change its order."
        : "Clear the filters to change the order."} /> : null}
      {reorderable && canEdit && (data?.rows.length || 0) > 1 ? <p className="text-xs text-tertiary">Drag a row, or use the arrows, to change the order on the site.</p> : null}

      {!data ? <ListSkeleton /> : (
        <>
          <Table list
            cols={[...spec.cols.map((c) => ({ label: c.label, w: c.w, cls: c.cls })), { label: "", cls: "acts", w: spec.key === "kyc" ? "220px" : "150px" }]}
            empty={{ icon: spec.icon, title: filtered ? "Nothing matches that" : "Nothing here yet", body: filtered ? "Clear the filters to see everything." : spec.desc }}
            rows={data.rows.map((r, i) => {
              const open = editable ? () => go(here + "/" + r.id) : spec.key === "subscribers" ? () => openSubscriber(r) : undefined;
              return (
                <tr key={r.id} className={open ? "clickable" : ""} onClick={open} {...dragProps(i)}>
                  {spec.cols.map((c, j) => <td key={j} className={c.cls || ""}>{c.cell(r)}</td>)}
                  {rowActs(r, i)}
                </tr>
              );
            })} />
          <Pagination page={data.pageNo} pages={Math.ceil(data.total / pageSize)} total={data.total} pageSize={pageSize}
            unit={spec.noun + "s"} onPage={(n) => go(here + qs({ ...p, page: String(n) }))} />
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- editor -- */
function CityCheck() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof CmsService.normalizeCity>> | null>(null);
  useEffect(() => {
    if (!q.trim()) { setRes(null); return; }
    const t = setTimeout(() => { CmsService.normalizeCity(q).then(setRes).catch(() => setRes(null)); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Card>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-primary">Spelling check</span>
        <span className="text-xs text-tertiary">Type any spelling a seller might enter to see the city it is stored as.</span>
        <Input value={q} onChange={setQ} ph="e.g. gurgaon" />
        {res ? (
          <span className="text-sm text-secondary">
            Stored as <b className="text-primary">{res.canonical || "—"}</b>{" "}
            {res.matchedCity ? <Pill tone="ok" text={res.via === "alias" ? "via alias" : "exact match"} /> : <Pill tone="warn" text="no city row" />}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/** For "unsaved?": a field typed into and emptied again is not a change. */
const norm = (o: Record<string, unknown>) =>
  JSON.stringify(o, (_k, x) => (x === "" || x === null ? undefined : x));

/** Markup the visual editor cannot keep (tables, divs, code blocks, inline styles). */
const NEEDS_SOURCE = /<(table|div|pre|section|article|figure)\b|\sstyle=/i;

function Editor({ spec, rowId }: { spec: ResSpec; rowId: string | null }) {
  const shell = useShell();
  const here = ROUTE + "/" + spec.key;
  const [v, setV] = useState<Record<string, any> | null>(rowId ? null : { ...(spec.defaults || {}) });
  const [saved, setSaved] = useState<string>(rowId ? "" : JSON.stringify(spec.defaults || {}));
  const [mode, setMode] = useState("edit");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fkOpts, setFkOpts] = useState<Record<string, { v: string; l: string }[]>>({});
  const dirty = !!v && norm(v) !== norm(saved ? JSON.parse(saved) : {});
  useUnsavedGuard(dirty);

  usePageChrome({ crumbs: <TbTitle label="CMS" to={ROUTE} />, parent: here }, spec.key + (rowId || "new"));

  useEffect(() => {
    if (!rowId) return;
    let cancelled = false;
    CmsService.get(spec.key, rowId)
      .then((r) => {
        if (cancelled) return;
        setV(r); setSaved(JSON.stringify(r));
        const body = spec.fields.find((f) => f.kind === "rich");
        if (body && NEEDS_SOURCE.test(String(getAt(r, body.k) || ""))) setMode("html");
      })
      .catch((e) => { if (!cancelled) { shell.toast(errMessage(e), "bad"); go(here); } });
    return () => { cancelled = true; };
  }, [spec.key, rowId, here, shell]);

  useEffect(() => {
    spec.fields.filter((f) => f.kind === "fk" && f.fk).forEach((f) => {
      CmsService.list(f.fk!.res, { pageSize: 200 })
        .then((d) => setFkOpts((o) => ({ ...o, [f.k]: d.rows.map((r) => ({ v: String(r.id), l: String(r[f.fk!.label] || r.id) })) })))
        .catch(() => {});
    });
  }, [spec]);

  if (!v) return <PaneLoading />;

  const set = (k: string, val: unknown) => { setErr(""); setV((o) => setAt(o || {}, k, val)); };
  const writable = rowId ? can("content", "edit") : can("content", "create");
  const leave = () => { if (confirmLeave()) go(here); };

  const save = async (patch: Record<string, unknown> = {}) => {
    const missing = spec.fields.find((f) => f.req && (rowId ? !f.createOnly : true) && [undefined, null, ""].includes(getAt(v, f.k)));
    if (missing) { setErr(missing.label + " is required."); return; }
    const body: Record<string, unknown> = {};
    spec.fields.forEach((f) => {
      if (rowId && f.createOnly) return;
      const top = f.k.split(".")[0];
      if (v[top] !== undefined) body[top] = v[top];
    });
    if (Array.isArray(body.aliases)) body.aliases = (body.aliases as string[]).map((a) => a.trim()).filter(Boolean);
    Object.assign(body, patch);
    setBusy(true); setErr("");
    try {
      const row = await CmsService.save(spec.key, body, rowId || undefined);
      const draft = spec.key === "blog" && row.status === "draft";
      shell.toast(draft ? "Draft saved — not on the site yet." : "Saved — live on the site.", "ok");
      setSaved(JSON.stringify(row));
      if (!rowId) { setV(row); go(here + "/" + row.id); } else setV(row);
    } catch (e) { setErr(errMessage(e)); }
    setBusy(false);
  };

  const rich = spec.fields.find((f) => f.kind === "rich");
  const plain = spec.fields.filter((f) => f.kind !== "rich");
  const Preview = spec.preview;
  const title = rowId ? spec.titleOf(v as CmsRow) : "New " + spec.noun;

  const form = (fields: FieldSpec[]) => (
    /* a disabled fieldset disables EVERY control inside — uploads, toggles,
       selects, pickers — not only the plain text inputs */
    <fieldset disabled={!writable} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.k} className={["textarea", "buttons", "metrics", "image", "lines", "picker"].includes(f.kind || "") ? "sm:col-span-2" : ""}>
          <FieldInput f={f} value={getAt(v, f.k)} disabled={!writable || (!!rowId && !!f.createOnly)}
            onChange={(val) => set(f.k, val)}
            fkOptions={fkOpts[f.k]} toast={shell.toast} />
        </div>
      ))}
    </fieldset>
  );

  const preview = Preview
    ? <PreviewCanvas name={spec.label}><Suspense fallback={<PaneLoading />}><Preview v={v} /></Suspense></PreviewCanvas>
    : null;
  const cardPreview = () => shell.modal(
    <ModalShell title="How it looks in the blog list" onClose={shell.closeLayer}>
      <PreviewCanvas name="Blog card"><Suspense fallback={<PaneLoading />}><BlogCardPreview v={v} /></Suspense></PreviewCanvas>
    </ModalShell>, "lg");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={title} meta={dirty ? <span className="text-warning-primary">Unsaved changes</span> : null}
        actions={<>
          <Button color="tertiary" ico="left" onClick={leave}>{spec.label}</Button>
          {spec.mode === "toggle" && Preview
            ? <Segmented label="Mode" value={mode} onPick={setMode} options={[{ v: "edit", l: "Edit", ico: "doc" }, { v: "html", l: "HTML", ico: "file" }, { v: "preview", l: "Preview", ico: "eye" }]} />
            : null}
          {spec.key === "blog" ? <Button color="secondary" ico="grid" onClick={cardPreview}>Preview card</Button> : null}
          {writable && spec.key === "blog" ? <>
            <Button color="secondary" disabled={busy} onClick={() => void save({ status: "draft" })}>Save draft</Button>
            <Button color="primary" ico="check" disabled={busy} onClick={() => void save({ status: "published" })}>
              {busy ? "Saving…" : v.status === "published" ? "Update" : "Publish"}
            </Button>
          </> : writable ? <Button color="primary" ico="check" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button> : null}
        </>} />
      {err ? <Alert tone="bad" title={err} /> : null}

      {spec.mode === "toggle" ? (
        mode === "preview" && preview ? preview : (
          <div className="flex flex-col gap-4">
            <Card>{form(plain)}</Card>
            {rich && mode === "html" ? (
              <>
                {NEEDS_SOURCE.test(String(getAt(v, rich.k) || ""))
                  ? <Alert tone="info" title="This document has formatting the visual editor would rewrite (tables, blocks or inline styles), so it opens as HTML. Switching to Edit converts it." /> : null}
                <FieldInput f={{ k: rich.k, label: "HTML source", kind: "textarea", rows: 28, mono: true }}
                  value={getAt(v, rich.k) || ""} disabled={!writable} onChange={(h) => set(rich.k, h)} toast={shell.toast} />
              </>
            ) : rich ? <RichText key={(rowId || "new") + rich.k + writable} value={getAt(v, rich.k) || ""} onChange={(h) => set(rich.k, h)} toast={shell.toast} readOnly={!writable} /> : null}
          </div>
        )
      ) : (
        <div className={preview ? "grid grid-cols-1 items-start gap-4 xl:grid-cols-2" : ""}>
          <div className="flex flex-col gap-4">
            <Card>{form(plain)}</Card>
            {spec.key === "cities" ? <CityCheck /> : null}
          </div>
          {preview ? <div className="xl:sticky xl:top-4">{preview}</div> : null}
        </div>
      )}
    </div>
  );
}
