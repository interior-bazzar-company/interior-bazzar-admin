/* =============================================================================
   TAGS — the fourth view mode. Not a way of looking at deals but a way of
   labelling them, so it gets a management surface rather than a list layout.
   -----------------------------------------------------------------------------
   Plus the per-deal editor: one editable row per list. A name field, a colour
   chip that opens its swatches, and an × that takes the list off. "Add to list"
   appends an empty row. That is the whole editor.

   Nothing commits until Save. Rows are component state and are never rebuilt
   from the catalogue while the dialog is open, because rebuilding would throw
   away whatever is half-typed in the other four rows.
   ============================================================================= */
import { useCallback, useEffect, useRef, useState } from "react";
import { InputBase } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import {
  Alert, Button, EmptyState, FormField, Icon, IconButton, Input, ListSkeleton, ListTable,
  ModalShell, MoreMenu, Notice, PageHeader, Pill, Tag, qs, tagClasses
} from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { DealTagRow } from "../../../api/modules/adminOps";
import { merge, omit, refusalOf, render, val } from "./useDeals";
import type { Params, Refusal } from "./useDeals";
import { ErrSlot, Swatches, toneName } from "./bits";

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

  if (tags === null) return <ListSkeleton rows={5} />;
  const all = tags.slice().sort((x, y) => y.count - x.count);
  const unused = all.filter((t) => !t.count).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Lists"
        meta={
          <>
            <span className="tnum">{all.length} list{all.length === 1 ? "" : "s"}</span>
            {unused ? <span className="tnum">{unused} on no deal</span> : null}
            <span>A label, never a rule</span>
          </>
        }
        actions={<Button color="primary" ico="plus" data-act="tg-new" onClick={newList}>New list</Button>}
      />

      {all.length
        ? <ListTable min="42rem" head={
            <tr>
              <th>List</th>
              <th>Slug</th>
              <th>Status</th>
              <th className="n">Deals</th>
              <th className="acts"><span className="sr-only">Actions</span></th>
            </tr>
          }>
            {all.map((t) => {
              const to = "#/deals" + qs(merge(omit(p, ["view"]), { tag: t.slug }));
              return (
                <tr key={t.slug} className="clickable" data-go={to} onClick={() => go(to)}>
                  <td className="cell-1"><Tag label={t.label} tone={t.tone || ""} /></td>
                  <td className="mono">{t.slug}</td>
                  <td>{t.isActive
                    ? <Pill xs dot tone="ok" text="Active" />
                    : <Pill xs dot tone="neutral" text="Archived" />}</td>
                  <td className="n">{t.count || <span className="text-quaternary">0</span>}</td>
                  <td className="acts">
                    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
                      <MoreMenu small label="" items={[
                        { icon: "eye", label: "Show its deals", act: () => go(to) },
                        { icon: "edit", label: "Rename or recolour", act: () => rename(t) },
                        { icon: "trash", label: t.count ? "Archive list" : "Delete list", act: () => remove(t), tone: "bad" },
                      ]} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </ListTable>
        : <EmptyState icon="tag" title="No lists yet"
            body="Make one for whatever your team actually sorts by — a campaign, a city push, a follow-up batch."
            action={<Button color="primary" ico="plus" data-act="tg-new" onClick={newList}>New list</Button>} />}

      <Notice ico="tag" text={<>
        <b>A list is a label, never a record.</b> Nothing here gates a stage, changes a target or
        touches money — which is exactly why every list is yours to make, rename and recolour.
        Deleting one that no deal carries removes it; deleting one that deals DO carry{" "}
        <b>archives</b> it instead, so their history keeps saying what it said.
      </>} />
    </div>
  );
}

function ToneModal({ kind, tag, onClose, after }: {
  kind: "new" | "edit"; tag?: DealTagRow; onClose: () => void; after: (msg: string) => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [tone, setTone] = useState<string>(tag ? tag.tone || "" : "");
  const [name, setName] = useState<string>(tag ? tag.label : "");
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
    <ModalShell ico="tag" title={kind === "new" ? "New list" : "Rename list"}
      sub={kind === "new" ? "Yours to apply and remove freely" : (tag ? tag.label : "")}
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" isDisabled={busy} onClick={onClose}>Cancel</Button>
          <Button color="primary" data-act={kind === "new" ? "tg-new-go" : "tg-edit-go"}
            isDisabled={busy} onClick={commit}>
            {busy ? "Saving…" : kind === "new" ? "Create list" : "Save"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ErrSlot err={err} />
        <FormField id="tgName" label="Name" req
          hint={kind === "new" ? "The slug is derived from it, on the server." : undefined}>
          <Input id="tgName" autoFocus maxLength={24} value={name} onChange={setName}
            ph={kind === "new" ? "Site visit due" : undefined} onEnter={commit} />
        </FormField>
        <FormField label="Colour" hint="The hue means nothing by contract — it is a label, not a verdict.">
          <div className="flex flex-col gap-3">
            <Swatches value={tone} onPick={setTone} name="tgTone" />
            {/* The chip you are actually making, at the size it will be read. */}
            <span className="flex items-center gap-2">
              <span className="label-mono">Preview</span>
              <Tag label={name.trim() || "List name"} tone={tone} />
            </span>
          </div>
        </FormField>
        {kind === "edit"
          ? <Notice ico="link" text={<>Renaming keeps the slug{" "}
              <span className="font-mono">{tag ? tag.slug : ""}</span>, so every deal already on this
              list stays on it.</>} />
          : null}
      </div>
    </ModalShell>
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
    <ModalShell ico="alert" tone={tag.count ? "warning" : "error"}
      title={tag.count ? "Archive list" : "Delete list"} sub={tag.label} onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" isDisabled={busy} onClick={onClose}>Cancel</Button>
          <Button color="primary-destructive" data-act="tg-del-go" data-slug={tag.slug}
            isDisabled={busy} onClick={commit}>
            {busy ? "Working…" : tag.count ? "Archive list" : "Delete list"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ErrSlot err={err} />
        <div className="flex items-center gap-2">
          <Tag label={tag.label} tone={tag.tone || ""} />
          <span className="text-sm text-tertiary tnum">on {tag.count} deal{tag.count === 1 ? "" : "s"}</span>
        </div>
        <Alert tone={tag.count ? "warn" : "bad"}>
          {tag.count
            ? <>This list is on <b>{tag.count} deal(s)</b>, so it is <b>archived</b> rather than
                deleted: it disappears from the pickers and stops being applicable, and those deals
                keep saying what they said. A label that vanishes out of a deal's history rewrites
                the history.</>
            : <>No deal carries this list, so it is deleted outright.</>}
        </Alert>
      </div>
    </ModalShell>
  );
}

/* ==========================================================================
   TAGS ON A DEAL — one editable row per list
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
  const focusLast = useRef(false);

  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    const n = (rows || []).length;
    const last = document.getElementById("tgRow" + (n - 1)) as HTMLInputElement | null;
    if (last) last.focus();
  }, [rows]);

  const closePops = () => setRows((cur) => (cur || []).map((r) => ({ ...r, pop: false })));
  const addRow = () => {
    focusLast.current = true;
    setRows((cur) => (cur || []).map((r) => ({ ...r, pop: false })).concat([{ slug: "", name: "", tone: "", pop: false }]));
  };
  const delRow = (ix: number) => setRows((cur) => {
    const next = (cur || []).filter((_, i) => i !== ix).map((r) => ({ ...r, pop: false }));
    /* Never leave the editor empty — one with nothing in it reads as broken,
       and adding a row is the only thing you would do next anyway. */
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
      if (!key) { bad = "“" + name + "” has no letters or digits in it."; return; }
      if (seen[key]) { bad = "“" + name + "” is on two rows. One row per list."; return; }
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
        detail: "A different list is already called “" + clash.label + "”." });
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
             field's suggestion list is exactly that path — so reuse it rather
             than asking the server to create a duplicate it would refuse. */
          const existing = tagBySlug(all, tagKey(row.name));
          const slug = existing
            ? existing.slug
            : (await call(AdminOpsService.createDealTag({ label: row.name, tone: row.tone }))).slug;
          await call(AdminOpsService.dealTag(dealRef, slug, true));
          kept.push(slug);
        }
      }
      /* Anything the deal carried that the editor no longer lists comes off.
         That is what × did, deferred to Save like every other edit here. */
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

  /* Escape peels one layer at a time. With swatches open it closes those and
     stops there — the shell's own Escape would otherwise take the whole dialog
     down, losing four filled rows to a keystroke meant for one. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && (rows || []).some((r) => r.pop)) {
      e.preventDefault(); e.stopPropagation(); closePops();
    }
  };

  const setRow = (ix: number, patch: Partial<Row>) =>
    setRows((cur) => (cur || []).map((r, i) => (i === ix ? { ...r, ...patch } : r)));

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDownCapture={onKeyDown}>
      <ModalShell title="Lists" sub={dealRef} mono ico="tag" onClose={onClose}
        actions={
          <>
            <Button color="secondary" data-close="1" isDisabled={busy} onClick={onClose}>Cancel</Button>
            <Button color="primary" data-tgr="save" isDisabled={busy || rows === null} onClick={save}>
              {busy ? "Saving…" : "Save"}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <ErrSlot err={err} />
          <div className="flex flex-col gap-2" id="tgEdit" data-ref={dealRef}>
            {(rows || []).map((row, ix) => (
              /* A row carries its slug: that is what tells Save whether it is
                 editing a list or making one, and an empty slug never lies. */
              <div key={ix} data-slug={row.slug} data-tone={row.tone}
                className="flex flex-col gap-2 rounded-lg bg-secondary p-2 ring-1 ring-secondary ring-inset">
                <div className="flex items-center gap-2">
                  {/* `list=` is the whole apply-an-existing-list path — type two
                      letters, pick it, and Save resolves it onto the list that
                      is already there. `Input` cannot forward the attribute, so
                      this one field is the library control directly. */}
                  <InputBase
                    id={"tgRow" + ix}
                    size="sm"
                    maxLength={24}
                    spellCheck={false}
                    list="tgNames"
                    aria-label="List name"
                    placeholder="List name"
                    value={row.name}
                    wrapperClassName="min-w-0 flex-1"
                    onChange={(e) => setRow(ix, { name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
                  />
                  {/* The chip says which colour it IS, not that it is a colour
                      control — the swatches it opens already say the second. */}
                  <button type="button" data-tgr="pick" aria-haspopup="true" aria-expanded={row.pop}
                    aria-label={"Colour: " + toneName(row.tone)} title={"Colour: " + toneName(row.tone)}
                    className={cx(
                      "size-9 shrink-0 cursor-pointer rounded-lg ring-1 outline-focus-ring transition duration-100 ring-inset hover:ring-2 focus-visible:outline-2 focus-visible:outline-offset-2",
                      tagClasses(row.tone),
                      row.pop && "ring-2 ring-brand",
                    )}
                    onClick={() => setRows((cur) => (cur || []).map((r, i) => ({ ...r, pop: i === ix ? !r.pop : false })))}>
                    <Icon name={row.pop ? "chevu" : "chev"} size="xs" className="mx-auto" />
                  </button>
                  <IconButton ico="x" size="sm" label="Remove from this deal" onClick={() => delRow(ix)} />
                </div>
                {/* The swatches live inside the row and stay hidden until asked
                    for, so the picker cannot outlive the row. */}
                {row.pop
                  ? <Swatches value={row.tone} name={"tgTone" + ix}
                      onPick={(v) => setRow(ix, { tone: v, pop: false })} />
                  : null}
              </div>
            ))}
          </div>
          <div>
            <Button color="secondary" ico="plus" data-tgr="add" onClick={addRow}>Add to list</Button>
          </div>
          {/* Every list that already exists, as the name field's suggestions. */}
          <datalist id="tgNames">
            {(catalogue || []).filter((t) => t.isActive).map((t) => <option key={t.slug} value={t.label} />)}
          </datalist>
          <p className="text-sm text-tertiary">
            A list can hold any number of deals. Renaming or recolouring one here changes it on all
            of them; <b className="font-semibold text-secondary">×</b> only takes it off this deal.
            To delete a list everywhere, use{" "}
            <a className="rounded text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2"
              href={"#/deals" + qs({ view: "tags" })} data-go={"#/deals" + qs({ view: "tags" })}
              onClick={(e) => { e.preventDefault(); go("#/deals" + qs({ view: "tags" })); }}>Manage lists</a>.
          </p>
        </div>
      </ModalShell>
    </div>
  );
}
