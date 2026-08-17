/* =============================================================================
   TAGS — the fourth view mode. Not a way of looking at deals but a way of
   labelling them, so it gets a management surface rather than a list layout.
   -----------------------------------------------------------------------------
   Plus the per-deal editor: one editable row per tag. A name field, a colour
   dot that opens its swatches, and an × that takes the list off. "Add to list"
   appends an empty row. That is the whole editor.

   Nothing commits until Save. Rows are component state and are never rebuilt
   from the store while the dialog is open, because rebuilding would throw away
   whatever is half-typed in the other four rows.
   ============================================================================= */
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, Field, Icon, Notice, qs } from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { DealTagRow } from "../../../api/modules/adminOps";
import { merge, omit, refusalOf, render, val } from "./useDeals";
import type { Params, Refusal } from "./useDeals";
import { ErrSlot, toneClass, toneName, toneOpts } from "./bits";
import { ListSkeleton } from "../../ui";

/* Django's own slugify rule, near enough to spot a collision before asking the
   server to. The SERVER derives the real slug — this is only used to warn. */
function tagKey(name: string) {
  return String(name || "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
function tagBySlug(all: DealTagRow[], slug: string) {
  return all.filter((t) => t.slug === slug)[0] || null;
}

/* The catalogue, fetched on demand. Both surfaces below need the same list —
   the manager to render it, the per-deal editor to resolve a typed name onto
   an existing tag — so there is one hook rather than two fetches that can
   disagree about what exists. */
function useTagCatalogue() {
  const [tags, setTags] = useState<DealTagRow[] | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.dealTags())
      .then((d) => { if (!cancelled) setTags(d.tags); })
      .catch(() => { if (!cancelled) setTags([]); });
    return () => { cancelled = true; };
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { tags, reload };
}

/* ==========================================================================
   THE MANAGER
   ====================================================================== */
export function TagsView({ p }: { p: Params }) {
  const shell = useShell();
  const { tags, reload } = useTagCatalogue();
  const close = () => shell.closeLayer();
  /* Both refreshes, deliberately: the catalogue for this screen, and the
     module-wide one so the tag filter and every deal's chips pick the change
     up too. */
  const after = (msg: string) => { close(); shell.toast(msg); reload(); render(); };

  const newList = () => shell.modal(<ToneModal kind="new" onClose={close} after={after} />);
  const rename = (t: DealTagRow) => shell.modal(<ToneModal kind="edit" tag={t} onClose={close} after={after} />);
  const remove = (t: DealTagRow) => shell.modal(<DeleteListModal tag={t} onClose={close} after={after} />);

  if (tags === null) return <ListSkeleton />;
  const all = tags.slice().sort((x, y) => y.count - x.count);

  return (
    <div className="dls">
      <div className="dls-cmd">
        {/* The local back arrow that used to sit here is gone. This screen had
            to invent its own way out because the shell had none; it has one
            now, in the topbar, in the same place on every screen. */}
        <span className="dls-tagline">
          {all.length} list{all.length === 1 ? "" : "s"} · {all.filter((t) => !t.count).length} on no deal
        </span>
        <span className="spacer"></span>
        <button className="btn pri" data-act="tg-new" onClick={newList}><Icon name="plus" />New list</button>
      </div>
      <div className="dls-body">
        {all.length
          ? <table className="tbl dls-tbl">
              <thead><tr><th>List</th><th>Slug</th><th>Status</th><th className="n">Deals</th><th></th></tr></thead>
              <tbody>
                {all.map((t) => {
                  const to = "#/deals" + qs(merge(omit(p, ["view"]), { tag: t.slug }));
                  return (
                    <tr key={t.slug} className="clickable" data-go={to} onClick={() => go(to)}>
                      <td><span className={"pill" + toneClass(t.tone)}>{t.label}</span></td>
                      <td className="mono cell-2">{t.slug}</td>
                      <td className="cell-2">{t.isActive ? "Active" : "Archived"}</td>
                      <td className="n"><b>{t.count}</b></td>
                      <td className="c">
                        <button className="btn sm rowact" data-act="tg-edit" data-slug={t.slug}
                          onClick={(e) => { e.stopPropagation(); rename(t); }}>Rename</button>
                        <button className="btn sm dgr rowact" data-act="tg-del" data-slug={t.slug}
                          style={{ marginLeft: "4px" }}
                          onClick={(e) => { e.stopPropagation(); remove(t); }}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          : <EmptyState icon="tag" title="No lists yet"
              body="Make one for whatever your team actually sorts by — a campaign, a city push, a follow-up batch."
              action={<button className="btn pri" data-act="tg-new" onClick={newList}>New list</button>} />}

        <Notice ico="tag" text={<>
          <b>A list is a label, never a record.</b> Nothing here gates a stage, changes a target or
          touches money — which is exactly why every list is yours to make, rename and recolour.
          Deleting one that no deal carries removes it; deleting one that deals DO carry{" "}
          <b>archives</b> it instead, so their history keeps saying what it said.
        </>} />
      </div>
    </div>
  );
}

/* One tone list for everywhere a tag colour is picked. The colour IS the
   label; spelling out "Amber" adds a word you then have to map back onto the
   swatch. The names survive as tooltips and aria-labels only. */
function Swatches({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <div className="tgdots">
      {toneOpts(value).map((o) => (
        <button key={o.v || "none"} type="button" className={"tgdot " + (o.v || "none") + (o.sel ? " on" : "")}
          data-pick="tgTone" data-v={o.v} title={o.l} aria-label={o.l}
          onClick={() => onPick(o.v)}></button>
      ))}
      {/* Picking a colour is a state change, never a re-fetch — the name field
          beside it is usually half-typed when you reach for a dot. */}
      <input type="hidden" id="tgTone" value={value} readOnly />
    </div>
  );
}

function ToneModal({ kind, tag, onClose, after }: {
  kind: "new" | "edit"; tag?: DealTagRow; onClose: () => void; after: (msg: string) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [tone, setTone] = useState<string>(tag ? tag.tone || "" : "");
  const [busy, setBusy] = useState(false);
  const commit = () => {
    setErr(null); setBusy(true);
    const p = kind === "new"
      ? call(AdminOpsService.createDealTag({ label: val("tgName"), tone }))
        .then((t) => after("List “" + t.label + "” created."))
      : call(AdminOpsService.updateDealTag((tag as DealTagRow).slug, { label: val("tgName"), tone }))
        .then(() => after("List renamed."));
    p.catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
  };
  return (
    <>
      <div className="md-h">
        <h3>{kind === "new" ? "New list" : "Rename list"}</h3>
        <p>{kind === "new" ? "Yours to apply and remove freely" : (tag ? tag.label : "")}</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Field id="tgName" label="Name" req
          ph={kind === "new" ? "Site visit due" : undefined}
          value={tag ? tag.label : ""}
          help={kind === "new" ? "The slug is derived from it, on the server." : undefined} />
        <div className="fg"><span className="fg-lb">Colour</span><Swatches value={tone} onPick={setTone} /></div>
        {kind === "edit"
          ? <Notice ico="link" text={<>Renaming keeps the slug <span className="mono">{tag ? tag.slug : ""}</span>, so every deal already on this list stays on it.</>} />
          : null}
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act={kind === "new" ? "tg-new-go" : "tg-edit-go"}
          disabled={busy} onClick={commit}>
          {busy ? "Saving…" : kind === "new" ? "Create list" : "Save"}</button>
      </div>
    </>
  );
}

function DeleteListModal({ tag, onClose, after }: { tag: DealTagRow; onClose: () => void; after: (m: string) => void }) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const commit = () => {
    setErr(null); setBusy(true);
    call(AdminOpsService.deleteDealTag(tag.slug))
      .then((r) => after(r.archived
        ? "List archived — the " + r.count + " deal(s) on it keep it."
        : "List deleted."))
      .catch((e: unknown) => { setErr(refusalOf(e)); setBusy(false); });
  };
  return (
    <>
      <div className="md-h"><h3>Delete list</h3><p>{tag.label}</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <Notice tone={tag.count ? "warn" : "bad"} text={tag.count
          ? <>This list is on <b>{tag.count} deal(s)</b>, so it is <b>archived</b> rather than deleted:
              it disappears from the pickers and stops being applicable, and those deals keep saying
              what they said. A label that vanishes out of a deal's history rewrites the history.</>
          : <>No deal carries this list, so it is deleted outright.</>} />
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn dgr" data-act="tg-del-go" data-slug={tag.slug} disabled={busy} onClick={commit}>
          {busy ? "Working…" : tag.count ? "Archive list" : "Delete list"}</button>
      </div>
    </>
  );
}

/* ==========================================================================
   TAGS ON A DEAL — one editable row per tag
   ====================================================================== */
type Row = { slug: string; name: string; tone: string; pop: boolean };

export function TagsModal({ dealRef, onClose, onSaved }: {
  dealRef: string; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);
  const { tags: catalogue } = useTagCatalogue();
  /* Seeded from the DEAL, fetched once. Rows are component state from then on
     and are never rebuilt while the dialog is open — rebuilding would throw
     away whatever is half-typed in the other four. */
  const [rows, setRows] = useState<Row[] | null>(null);
  const [before, setBefore] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    call(AdminOpsService.deal(dealRef))
      .then((d) => {
        if (cancelled) return;
        const mine = d.deal.tags || [];
        setBefore(mine.map((t) => t.slug));
        setRows(mine.length
          ? mine.map((t) => ({ slug: t.slug, name: t.label, tone: t.tone || "", pop: false }))
          : [{ slug: "", name: "", tone: "", pop: false }]);
      })
      .catch((e: unknown) => { if (!cancelled) { setErr(refusalOf(e)); setRows([]); } });
    return () => { cancelled = true; };
  }, [dealRef]);
  const host = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);

  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    const inputs = host.current ? host.current.querySelectorAll(".tgr-inp") : null;
    const last = inputs && inputs.length ? inputs[inputs.length - 1] as HTMLInputElement : null;
    if (last) last.focus();
  }, [rows && rows.length]);

  const closePops = () => setRows((cur) => (cur || []).map((r) => ({ ...r, pop: false })));
  const addRow = () => {
    focusLast.current = true;
    setRows((cur) => (cur || []).map((r) => ({ ...r, pop: false })).concat([{ slug: "", name: "", tone: "", pop: false }]));
  };
  const delRow = (ix: number) => setRows((cur) => {
    const next = (cur || []).filter((_, i) => i !== ix).map((r) => ({ ...r, pop: false }));
    /* Never leave the tile empty — an editor with nothing in it reads as
       broken, and adding a row is the only thing you would do next anyway. */
    return next.length ? next : [{ slug: "", name: "", tone: "", pop: false }];
  });

  /* Two passes on purpose. Everything is checked before anything is written, so
     a bad fifth row cannot leave the first four saved and the dialog standing
     open with an error about work that already happened.

     The writes themselves are sequential API calls — rename an existing list,
     create a new one, apply it, take off what was removed — because there is
     no batch endpoint, and inventing one to save four requests would put the
     same reconciliation logic in two places. */
  const save = async () => {
    const draft: { slug: string; name: string; tone: string }[] = [];
    const seen: Record<string, number> = {};
    let bad: string | null = null;

    (rows || []).forEach((row) => {
      if (bad) return;
      const name = row.name.trim();
      if (!name) return;                    // a blank row is a row you did not fill in
      const key = tagKey(name);
      if (!key) { bad = "\u201c" + name + "\u201d has no letters or digits in it."; return; }
      if (seen[key]) { bad = "\u201c" + name + "\u201d is on two rows. One row per list."; return; }
      seen[key] = 1;
      draft.push({ slug: row.slug, name, tone: row.tone || "" });
    });
    if (bad) return setErr({ http: 400, code: "", detail: bad });

    /* A rename must not collide with a list that already exists under that
       name. The slug does not move on a rename — that is what keeps every
       other deal carrying the tag — so the two would end up sharing a label
       with nothing on screen able to tell them apart. */
    const all = catalogue || [];
    for (const d of draft) {
      if (!d.slug) continue;
      const clash = tagBySlug(all, tagKey(d.name));
      if (clash && clash.slug !== d.slug) return setErr({ http: 409, code: "",
        detail: "A different list is already called \u201c" + clash.label + "\u201d." });
    }

    setErr(null); setBusy(true);
    try {
      const kept: string[] = [];
      for (const row of draft) {
        if (row.slug) {
          const cur = tagBySlug(all, row.slug);
          if (cur && (cur.label !== row.name || (cur.tone || "") !== row.tone))
            await call(AdminOpsService.updateDealTag(row.slug, { label: row.name, tone: row.tone }));
          kept.push(row.slug);
          if (before.indexOf(row.slug) < 0)
            await call(AdminOpsService.dealTag(dealRef, row.slug, true));
        } else {
          /* Typed by hand. It may already exist under that name — the name
             field's datalist is exactly that path — so reuse it rather than
             asking the server to create a duplicate it would refuse. */
          const existing = tagBySlug(all, tagKey(row.name));
          const slug = existing
            ? existing.slug
            : (await call(AdminOpsService.createDealTag({ label: row.name, tone: row.tone }))).slug;
          await call(AdminOpsService.dealTag(dealRef, slug, true));
          kept.push(slug);
        }
      }
      /* Anything the deal carried that the tile no longer lists comes off.
         That is what \u00d7 did, deferred to Save like every other edit here. */
      for (const gone of before.filter((sl) => kept.indexOf(sl) < 0))
        await call(AdminOpsService.dealTag(dealRef, gone, false));

      onSaved(kept.length
        ? kept.length + (kept.length === 1 ? " list on " : " lists on ") + dealRef + "."
        : "All lists removed from " + dealRef + ".");
    } catch (e) {
      setErr(refusalOf(e));
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    /* Escape peels one layer at a time. With swatches open it closes those and
       stops there — the shell's own Escape would otherwise take the whole
       dialog down, losing four filled rows to a keystroke meant for one. */
    if (e.key === "Escape" && (rows || []).some((r) => r.pop)) {
      e.preventDefault(); e.stopPropagation(); closePops(); return;
    }
    /* Enter commits the whole tile rather than only the row you are in —
       there is one Save, so there is one thing Enter can mean. */
    if (e.key === "Enter" && (e.target as HTMLElement).classList.contains("tgr-inp")) {
      e.preventDefault(); save();
    }
  };

  const setRow = (ix: number, patch: Partial<Row>) =>
    setRows((cur) => (cur || []).map((r, i) => (i === ix ? { ...r, ...patch } : r)));

  return (
    <div onKeyDownCapture={onKeyDown}>
      <div className="md-h"><h3>Lists</h3><p className="mono">{dealRef}</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button></div>
      <div className="md-b">
        <ErrSlot err={err} />
        <div className="tgtile" id="tgEdit" data-ref={dealRef} ref={host}>
          <div className="tgrows">
            {(rows || []).map((row, ix) => (
              /* A row carries its slug: that is what tells Save whether it is
                 editing a tag or making one, and an empty slug never lies. */
              <div className="tgr" key={ix} data-slug={row.slug} data-tone={row.tone}>
                <input className="tgr-inp" maxLength={24} placeholder="List name" spellCheck={false}
                  list="tgNames" aria-label="List name" value={row.name}
                  onChange={(e) => setRow(ix, { name: e.target.value })} />
                <div className={"tgr-col" + (row.pop ? " on" : "")}>
                  {/* The dot says which colour it IS, not that it is a colour
                      control — the swatch already says the second thing. */}
                  <button type="button" className={"tgr-dot " + (row.tone || "none")} data-tgr="pick"
                    aria-haspopup="true" aria-label={"Colour: " + toneName(row.tone)}
                    title={"Colour: " + toneName(row.tone)}
                    onClick={() => setRows((cur) => (cur || []).map((r, i) =>
                      ({ ...r, pop: i === ix ? !r.pop : false })))}></button>
                  {/* The swatches live inside the row and stay hidden until
                      asked for, so the picker cannot outlive the row. */}
                  <div className="tgr-pop">
                    {toneOpts(row.tone).map((o) => (
                      <button key={o.v || "none"} type="button"
                        className={"tgdot " + (o.v || "none") + (o.sel ? " on" : "")}
                        data-tgr="tone" data-v={o.v} title={o.l} aria-label={o.l}
                        onClick={() => setRow(ix, { tone: o.v, pop: false })}></button>
                    ))}
                  </div>
                </div>
                <button type="button" className="tgr-x" data-tgr="del" title="Remove from this deal"
                  aria-label="Remove from this deal" onClick={() => delRow(ix)}><Icon name="x" size="sm" /></button>
              </div>
            ))}
          </div>
          <button type="button" className="tgadd" data-tgr="add" onClick={addRow}>
            <Icon name="plus" />Add to list</button>
        </div>
        {/* The name field suggests every tag that already exists. That is the
            whole apply-an-existing-tag path — type two letters, pick it, and
            Save resolves it to the tag that is already there. */}
        <datalist id="tgNames">
          {(catalogue || []).filter((t) => t.isActive).map((t) => <option key={t.slug} value={t.label}></option>)}
        </datalist>
        <p className="tgnote">A list can hold any number of deals. Renaming or recolouring one here changes it on all of them; <b>×</b> only takes it off this deal. To delete a list everywhere, use <a data-go={"#/deals" + qs({ view: "tags" })} onClick={() => go("#/deals" + qs({ view: "tags" }))}>Manage lists</a>.</p>
      </div>
      <div className="md-f"><span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-tgr="save" disabled={busy || rows === null} onClick={save}>
          {busy ? "Saving\u2026" : "Save"}</button>
      </div>
    </div>
  );
}
