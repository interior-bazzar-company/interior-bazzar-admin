/* =============================================================================
   Calendar — #/work
   -----------------------------------------------------------------------------
     #/work                     the calendar face, which is what the row opens on
     #/work?face=board          the board, columns are the five stages
     #/work?face=board&group=…  the column axis is a choice: stage · kind ·
                                assignee · priority · tag
     #/work?face=list           the same rows as a table
     #/work?face=timeline       target ▸ milestone lanes, tasks as bars
     #/work?item=W-K04          one item, in a drawer over whichever face is open

   THE SIDEBAR ROW READS CALENDAR AND THE ROUTE STAYS /work. Label and default
   only: the entity is still WorkItem, the grant is still team.work.*, and
   ?face=board opens exactly the board that shipped, so no link moves.

   FIVE STAGES, the same five for everybody: Planning · In progress · Delay ·
   Complete · Cancel. Four are stored. DELAY IS DERIVED — dueDate < today on a
   non-terminal item — and it takes precedence in the grouping, so an item is in
   exactly one column and the strip and the board cannot disagree. Nothing
   writes it and no sweep sets it. Blocked is not a stage: waiting on someone is
   a relationship and lives on `blockedByItemId` with a reason.

   THE RAIL IS THE CALENDAR FACE'S OWN. The board is five columns and the
   timeline is a date grid behind a lane column — both need their width, and on
   both the same information is already on screen in a better shape.

   NO API YET — src/content/team/*.json through store.ts.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  FilterChips, Icon, KvList, Notice, SearchField, SectionHead, Select, Table, Tabs, TbTitle, qs,
} from "../../ui";
import { go } from "../../ui/nav";
import {
  KIND, PRIORITY, TODAY, WORK_STATUS, addDays, addLink, blockerOf, childrenOf, createItem, createTag,
  eventsOn, fmtDate, fmtMonth, gridDays, isDelayed, isTerminal, labelOf, lanesOf, leaveOn,
  linkLabelOf, linksOf, monthStep,
  meId, membersInScope, parentOf, readMember, removeLink, setBlockedBy, setItemStatus, stageOf,
  normaliseUrl, tagItem, tagsOf, tagsOwnedBy, toneOf, useItem, useLinks, useMembers, useTags,
  useWork, workTotals,
} from "./store";
import type {
  Attachment, CalEvent, LinkRelation, Member, Tag, WorkItem, WorkStage, WorkStatus,
} from "./store";
import { ensureAdopted } from "./adopt";
import { KindMark, PriorityChip, Who, ago } from "./bits";
import {
  MarksBlock, ProgressWindow, RichText, StagePill, TagChips, TasksBlock, WaitFlag, daysOver, noteOf,
} from "./workBits";
import "./team.css";

const ROUTE = "#/work";
const FACES = [
  { k: "calendar", l: "Calendar", i: "calendar", d: "The month, and what each day owes" },
  { k: "board", l: "Board", i: "menu", d: "Five stages, or group by kind, member, priority or tag" },
  { k: "list", l: "List", i: "doc", d: "Every item as one table" },
  { k: "timeline", l: "Timeline", i: "chart", d: "Target and milestone lanes, tasks as bars" },
];
/** Lifecycle order, not the order the five were listed in: Delay is work that
 *  is not finished, so it sits before the two terminal columns. */
const STAGES: WorkStage[] = ["planned", "in_progress", "delayed", "completed", "cancelled"];
/** The params that put a chip in the band — listed so the band can be absent
 *  when none of them is set. On a face bounded to the viewport an empty row
 *  still costs its padding, and this one was costing it on every load. */
const FILTERS = ["q", "kind", "priority", "due", "tag", "member", "status", "parent", "wait"];
const GROUPS = [
  { v: "", l: "Stage" }, { v: "kind", l: "Kind" }, { v: "assignee", l: "Assignee" },
  { v: "priority", l: "Priority" }, { v: "tag", l: "Tag" },
];

export default function Work() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  const face = FACES.some((f) => f.k === p.face) ? p.face : "calendar";
  const scope = "all" as const;
  const rows = useWork({
    member: p.member, kind: p.kind, status: p.status, priority: p.priority,
    due: p.due, q: p.q, parent: p.parent, tag: p.tag, wait: p.wait,
  }, scope);
  const members = useMembers();
  const all = useWork({}, scope);
  const tags = useTags();
  const shell = useShell();
  const open = useItem(p.item || null);
  const me = meId();


  useEffect(() => { ensureAdopted(); }, []);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    go(ROUTE + qs(next));
  }, [p]);

  const onFilter = (name: string, value: string) => goto({ [name]: value || undefined });
  const openItem = useCallback((id: string) => goto({ item: id }), [goto]);

  /* THE HEADER IS THE TOPBAR, the way Deals settled it: the title on the left,
     and on the right the one control that changes what this page IS. A
     dropdown rather than four tabs — it names the face you are in, which a row
     of icons cannot do without spending the width of the filter row on it.

     No scope line beside the title any more: "47 items" was a second rendering
     of the strip's own first cell, sitting where you cannot click it. */
  usePageChrome({
    crumbs: <><TbTitle label="Calendar" to="#/work" /><WorkStats p={p} /></>,
    right: <FaceSwitch face={face} goto={goto} />,
  }, face);

  /* The drawer is the record, and it closes by dropping the param — the same
     arrangement `#/team` uses, so Back and the scrim agree with the URL. */
  useEffect(() => {
    if (!open) return;
    shell.drawer(<ItemDrawer item={open} all={all} tags={tags}
      onClose={() => goto({ item: undefined })} onOpen={openItem} />);
  }, [open, all, tags, shell, goto, openItem]);

  return (
    <div className="dls">
      {/* NO FILTER BAND ON THE CALENDAR. A month is read, not queried: the
          rail already answers "what is mine", the grid answers "what is when",
          and the row cost 56px of the one face that is bounded to the viewport.
          The three faces that ARE lists keep every filter — and a filter set on
          one of them survives the switch, because the chips band below stays
          and can still clear it.

          ONE BAND, NOT A TOOLBAR INSIDE A BAND: `.dls-cmd` is already the flex
          row every list screen uses. */}
      {face === "calendar" ? null : (
        <div className="dls-cmd">
          <SearchField ph="Search work" name="q" val={p.q} onFilter={onFilter} />
          <Select name="member" label="Member" value={p.member} onFilter={onFilter}
            options={members.filter((m) => m.status === "active").map((m) => ({ v: m.memberId, l: m.name }))} />
          <Select name="kind" label="Kind" value={p.kind} onFilter={onFilter}
            options={[{ v: "task", l: "Tasks" }, { v: "milestone", l: "Milestones" }, { v: "target", l: "Targets" }]} />
          <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter}
            options={slugOptions(tags)} />
          <Select name="priority" label="Priority" value={p.priority} onFilter={onFilter}
            options={[{ v: "high", l: "High" }, { v: "medium", l: "Medium" }, { v: "low", l: "Low" }]} />
          <span className="spacer" />
          {/* Create rides this row on the three faces with no rail; the
              calendar carries it at the top of its own. */}
          <CreateMenu onPick={(k) => shell.modal(<NewItemModal kind={k} members={members} all={all} />)} />
        </div>
      )}

      {FILTERS.some((k) => p[k]) ? (
        <div className="dls-chips">
          <FilterChips
            params={{
              q: p.q, kind: p.kind, priority: p.priority, due: p.due, tag: p.tag,
              member: p.member ? (readMember(p.member)?.name || p.member) : undefined,
              status: p.status ? labelOf(WORK_STATUS, p.status) : undefined,
              parent: p.parent ? "within " + p.parent : undefined,
              wait: p.wait ? "waiting" : undefined,
            }}
            onUnfilter={(n) => onFilter(n, "")} />
        </div>
      ) : null}

      <div className={"dls-body tm-pane" + (face === "calendar" ? " tm-body" : "")}>
        {face === "calendar" ? <CalendarFace rows={rows} me={me} p={p} goto={goto} onOpen={openItem} members={members} all={all} />
          : face === "board" ? <Board rows={rows} all={all} group={p.group || ""} goto={goto} onOpen={openItem} />
          : face === "timeline" ? <Timeline rows={rows} onOpen={openItem} />
          : <List rows={rows} all={all} onOpen={openItem} />}
      </div>
    </div>
  );
}

const slugOptions = (tags: Tag[]) => {
  const seen: Record<string, string> = {};
  tags.filter((t) => !t.archivedAt).forEach((t) => { seen[t.slug] = t.label; });
  return Object.keys(seen).sort().map((s) => ({ v: s, l: seen[s] }));
};

/** Wrap the selection in a mark, or drop one in and put the caret inside it.
 *  The selection is restored afterwards so a second press is an undo rather
 *  than a second pair of asterisks somewhere else. */
function wrapSel(
  ref: React.RefObject<HTMLTextAreaElement | null>, value: string,
  set: (v: string) => void, mark: string,
) {
  const el = ref.current;
  if (!el) return;
  const a = el.selectionStart, b = el.selectionEnd;
  const sel = value.slice(a, b);
  const wrapped = sel.slice(0, mark.length) === mark && sel.slice(-mark.length) === mark;
  const next = wrapped ? sel.slice(mark.length, -mark.length) : mark + (sel || "bold") + mark;
  set(value.slice(0, a) + next + value.slice(b));
  requestAnimationFrame(() => {
    el.focus();
    const from = wrapped ? a : a + mark.length;
    el.setSelectionRange(from, from + (wrapped ? next.length : (sel || "bold").length));
  });
}

/** Toggle "- " on every line the selection touches, whole lines at a time. */
function bulletSel(
  ref: React.RefObject<HTMLTextAreaElement | null>, value: string, set: (v: string) => void,
) {
  const el = ref.current;
  if (!el) return;
  const a = value.lastIndexOf("\n", Math.max(0, el.selectionStart - 1)) + 1;
  const end = value.indexOf("\n", el.selectionEnd);
  const b = end < 0 ? value.length : end;
  const lines = (value.slice(a, b) || "item").split("\n");
  const on = lines.every((l) => /^\s*-\s/.test(l));
  const next = lines.map((l) => (on ? l.replace(/^\s*-\s/, "") : "- " + l)).join("\n");
  set(value.slice(0, a) + next + value.slice(b));
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + next.length, a + next.length); });
}

/** A list of links, and one row to add another. The address is normalised
 *  before it can be added, so what lands on the item is always a real http(s)
 *  URL and never a `javascript:` one. */
function LinkField({ links, onChange }: {
  links: Attachment[]; onChange: (v: Attachment[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const ok = normaliseUrl(url);
  const add = () => {
    if (!ok) return;
    onChange(links.concat([{ url: ok, label: label.trim() || hostOf(ok) }]));
    setUrl(""); setLabel("");
  };
  const bad = !!url.trim() && !ok;
  return (
    <>
      {links.length ? (
        <ul className="tm-lk">
          {links.map((l, i) => (
            <li key={l.url + i}>
              <Icon name="ext" size="sm" />
              <span className="tm-lk-t"><b>{l.label}</b><span className="cell-2">{l.url}</span></span>
              <button className="btn icon sm" aria-label={"Remove the link to " + l.label}
                onClick={() => onChange(links.filter((_, n) => n !== i))}>
                <Icon name="x" size="sm" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {/* The address and the name are two questions, so they are two lines. The
          refusal is tied to the field it is about with aria-describedby — an
          error somewhere else on the form is an error nobody can act on. */}
      <div className="tm-lk-add">
        <label className="tm-ni-sub" htmlFor="niUrl">Address</label>
        <input id="niUrl" className={"inp" + (bad ? " bad" : "")} value={url}
          placeholder="docs.google.com/…" aria-describedby={bad ? "niUrlErr" : undefined}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        {bad ? (
          <p id="niUrlErr" className="help bad">That is not a web address — links have to be http or https.</p>
        ) : null}

        <label className="tm-ni-sub" htmlFor="niUrlName">Name <span className="tm-opt">optional</span></label>
        <input id="niUrlName" className="inp" value={label} placeholder="The brief"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />

        <button className="btn tm-lk-btn" disabled={!ok} onClick={add}>
          <Icon name="plus" size="sm" />Add link
        </button>
      </div>
    </>
  );
}

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** A tag is born here as it is in the drawer — one field, one keystroke. It is
 *  a record of its own, so it survives this dialog being cancelled. */
function NewTagField({ ownerId, onMade }: { ownerId: string; onMade: (id: string) => void }) {
  const shell = useShell();
  const [draft, setDraft] = useState("");
  const add = () => {
    const r = createTag(ownerId, draft);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    onMade(r.data.tagId);
    setDraft("");
  };
  return (
    <>
      {/* The group's own label is a `.fg-lb` span — it names the chips, which
          are buttons and cannot carry a `for`. This input therefore needs its
          own, or it is the one control in the dialog with nothing naming it. */}
      <label className="tm-ni-sub" htmlFor="niTag">New tag</label>
      <div className="tm-tagnew">
        <input id="niTag" className="inp" value={draft} placeholder="Name a new tag"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="btn" disabled={!draft.trim()} onClick={add}>Create</button>
      </div>
    </>
  );
}

/** THE COUNTS LIVE IN THE HEADER, beside the title — the arrangement Deals
 *  settled on. They were a band of their own under the command row, which on a
 *  face bounded to the viewport is a row of six numbers charging full height
 *  for a line of text.
 *
 *  It reads the store ITSELF rather than taking the totals as a prop: the
 *  chrome node is captured once per location, so a prop would freeze at
 *  whatever the numbers were before the last write landed.
 *
 *  Every count is still the filter for itself, and pressing the one you are
 *  already on clears it — so the header is never a trap you have to leave by
 *  the chip row. Stage and waiting are one axis here: they are two answers to
 *  "what state is this in", and a strip that could hold both at once would
 *  show two cells lit for one list. */
function WorkStats({ p }: { p: Record<string, string> }) {
  const t = workTotals(useWork({}, "all"));

  const route = (key?: string, val?: string) => {
    const next: Record<string, string> = { ...p };
    delete next.status; delete next.wait;
    if (key && val) next[key] = val;
    return ROUTE + qs(next);
  };
  const cell = (k: string, v: number, on: boolean, to: string, dot?: string) => (
    <button key={k} className={"tb-stat" + (on ? " on" : "")} data-go={to}
      title={v + " " + k} onClick={() => go(to)}>
      {dot !== undefined ? <span className={"dls-cdot " + dot}></span> : null}
      <span className="v tnum">{v}</span><span className="k">{k}</span>
    </button>
  );
  const stage = (k: string, v: number, st: string, dot?: string) =>
    cell(k, v, p.status === st, p.status === st ? route() : route("status", st), dot);

  return (
    <span className="tb-stats">
      {cell("items", t.total, !p.status && !p.wait, route())}
      {stage("in progress", t.inProgress, "in_progress", "info")}
      {stage("planning", t.planned, "planned", "")}
      {stage("in delay", t.delayed, "delayed", t.delayed ? "warn" : "")}
      {cell("waiting", t.waiting, !!p.wait, p.wait ? route() : route("wait", "1"), t.waiting ? "bad" : "")}
      {stage("complete", t.completed, "completed", "ok")}
    </span>
  );
}

/** THE SWITCHER IS A COMPONENT, NOT A NODE, and that is not a style choice.
 *  Published chrome is captured once per location, so a `shell` closed over at
 *  publish time keeps the `popAnchor` it had then — forever null. The
 *  toggle-to-close branch could never fire, and pressing the button a second
 *  time re-opened the menu instead of shutting it. Reading the shell inside the
 *  component reads it at click time, which is when the answer matters. */
function FaceSwitch({ face, goto }: {
  face: string; goto: (q: Record<string, string | undefined>) => void;
}) {
  const shell = useShell();
  const cur = FACES.filter((f) => f.k === face)[0] || FACES[0];
  return (
    <button className="btn tb-view-btn" aria-haspopup="menu"
      onClick={(e) => {
        const el = e.currentTarget;
        if (shell.popAnchor === el) { shell.closePop(); return; }
        shell.openPop(el, <FaceMenu face={face} goto={goto} />,
          { width: 268, align: "right", cls: "pop-views" });
      }}>
      <Icon name={cur.i} />{cur.l}<Icon name="chev" size="sm" />
    </button>
  );
}

/** The four faces, one per row, each saying what it is for. `on` marks the one
 *  you are in — a switcher that cannot answer "where am I" is a switcher you
 *  have to open to read. */
function FaceMenu({ face, goto }: {
  face: string; goto: (q: Record<string, string | undefined>) => void;
}) {
  const shell = useShell();
  return (
    <div className="pop-b">
      {FACES.map((f) => (
        <button key={f.k} className={"mi" + (f.k === face ? " on" : "")}
          onClick={() => { shell.closePop(); goto({ face: f.k === "calendar" ? undefined : f.k }); }}>
          <Icon name={f.i} />
          <span><b>{f.l}</b><span className="d">{f.d}</span></span>
          {f.k === face ? <span className="r"><Icon name="check" size="sm" /></span> : null}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- create --- */

/** One control, three kinds. All three open the same form with `kind`
 *  prefilled — they are one WorkItem with a kind, and a target only adds two
 *  fields to it. Three buttons become three forms, then three lists. */
function CreateMenu({ onPick, big }: { onPick: (k: string) => void; big?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);
  return (
    <span className={"ib-menu" + (big ? " tm-create-b" : "")} ref={box}>
      <button className="btn pri" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={big ? undefined : "sm"} />Create
      </button>
      {open ? (
        <span className="ib-menu-pop" role="menu" aria-label="Create">
          {["task", "milestone", "target"].map((k) => (
            <button key={k} role="menuitem" className="mi"
              onClick={() => { setOpen(false); onPick(k); }}>
              <KindMark kind={k} />{labelOf(KIND, k)}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** ONE FORM, THREE KINDS, AND THE TITLE IS THE FORM.
 *
 *  It was six labelled fields in a two-column grid, which asks somebody to read
 *  the form before they can write the one thing they came to write. Google's
 *  create dialog opens on a single empty title and lets every other fact be a
 *  quiet row under the icon that names it — no labels, no boxes until you reach
 *  for one — and that is the shape borrowed here.
 *
 *  The kind switcher is the panel's own tab row directly under the title: they
 *  are one record with a `kind`, and a target only adds two fields to the same
 *  five. Enter in the title creates, because for most of these the title IS the
 *  whole entry. */
function NewItemModal({ kind: initial, members, all, date }: {
  kind: string; members: Member[]; all: WorkItem[]; date?: string;
}) {
  const shell = useShell();
  const [kind, setKind] = useState(initial);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState(meId());
  const [pri, setPri] = useState("medium");
  /* A day was clicked: it is both the start and the due date, so the item
     lands on the day somebody pointed at rather than near it. */
  const [start, setStart] = useState(date || "");
  const [due, setDue] = useState(date || addDays(TODAY, 3));
  const [parent, setParent] = useState("");
  const [tv, setTv] = useState("");
  const [tu, setTu] = useState("");
  const [desc, setDesc] = useState("");
  const [links, setLinks] = useState<Attachment[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const ta = useRef<HTMLTextAreaElement | null>(null);
  useTags();
  const mine = tagsOwnedBy(who);

  /* A tag belongs to a member, so handing the item to somebody else cannot
     carry the last person's tags with it. */
  const assign = (id: string) => { setWho(id); setTags([]); };

  /* Depth 3, target ▸ milestone ▸ task. A target is always top level; a task
     may sit under either, and nothing sits under a task. */
  const parents = all.filter((i) => !isTerminal(i.status)
    && (kind === "task" ? i.kind !== "task" : i.kind === "target"));

  const save = () => {
    const r = createItem({
      title, assigneeId: who, kind: kind as "task" | "milestone" | "target",
      priority: pri as "high" | "medium" | "low",
      startDate: start || null, dueDate: due || null,
      parentId: parent || null,
      description: desc.trim() || null,
      attachments: links, tagIds: tags,
      targetValue: kind === "target" && tv ? Number(tv) : undefined,
      targetUnit: kind === "target" ? tu || undefined : undefined,
    });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast(r.data.title + " created");
    go(ROUTE + qs({ item: r.data.itemId }));
  };

  return (
    <>
      {/* The title lives in the header slot: it is the heading, so a second one
          above it would be the dialog naming itself twice. */}
      <div className="md-h tm-ni-h">
        <input className="tm-ni-t" autoFocus value={title} aria-label="Title"
          placeholder={"Add a " + labelOf(KIND, kind).toLowerCase()}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) save(); }} />
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>

      <div className="md-b tm-ni">
        <Tabs items={["task", "milestone", "target"].map((k) => ({ k, label: labelOf(KIND, k) }))}
          cur={kind} onPick={(k) => { setKind(k); if (k === "target") setParent(""); }} />

        {/* THE PANEL'S OWN FIELD, NOT A SECOND ONE. `.fg` puts a bold label over
            a full-width `.inp` with a real border, and it is what every other
            dialog here already looks like — Edit member, Send credentials, the
            leave form. Borderless controls under an icon column read as a
            settings list, not as a form: there was nothing to say where a field
            began, and nothing tying this dialog to the rest of the panel. */}
        <div className="fg">
          <label htmlFor="niStart">Starts</label>
          <input id="niStart" type="date" className="inp" value={start}
            onChange={(e) => setStart(e.target.value)} />
        </div>

        <div className="fg">
          <label htmlFor="niDue">Due</label>
          <input id="niDue" type="date" className="inp" value={due}
            onChange={(e) => setDue(e.target.value)} />
        </div>

        <div className="fg">
          <label htmlFor="niWho">Assigned to</label>
          <select id="niWho" className="inp" value={who} onChange={(e) => assign(e.target.value)}>
            {members.filter((m) => m.status === "active")
              .map((m) => <option key={m.memberId} value={m.memberId}>{m.name}</option>)}
          </select>
        </div>

        <div className="fg">
          <label htmlFor="niPri">Priority</label>
          <select id="niPri" className="inp" value={pri} onChange={(e) => setPri(e.target.value)}>
            {["high", "medium", "low"].map((k) =>
              <option key={k} value={k}>{labelOf(PRIORITY, k)}</option>)}
          </select>
        </div>

        {kind === "target" ? (
          <>
            <div className="fg">
              <label htmlFor="niTv">Target</label>
              <input id="niTv" type="number" className="inp" value={tv} placeholder="60"
                onChange={(e) => setTv(e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="niTu">Unit</label>
              <input id="niTu" className="inp" value={tu} placeholder="businesses"
                onChange={(e) => setTu(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="fg">
            <label htmlFor="niParent">Rolls up to</label>
            <select id="niParent" className="inp" value={parent}
              onChange={(e) => setParent(e.target.value)}>
              <option value="">Nothing — it is top level</option>
              {parents.map((i) => <option key={i.itemId} value={i.itemId}>{i.title}</option>)}
            </select>
          </div>
        )}

        <div className="tm-ni-sep" />

        {/* DESCRIPTION — plain text with two marks in it. The buttons write the
            marks so nobody has to know them; see RichText for why this is not
            a contentEditable. */}
        <div className="fg">
          <div className="tm-fgh">
            <label htmlFor="niDesc">Details</label>
            <span className="tm-rt-bar">
              <button className="tm-rt-b" title="Bold" aria-label="Bold"
                onClick={() => wrapSel(ta, desc, setDesc, "**")}><b>B</b></button>
              <button className="tm-rt-b" title="Bulleted list" aria-label="Bulleted list"
                onClick={() => bulletSel(ta, desc, setDesc)}><Icon name="menu" size="sm" /></button>
            </span>
          </div>
          <textarea id="niDesc" ref={ta} className="inp tm-ni-ta" rows={3} value={desc}
            placeholder="What does done look like?"
            onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="fg">
          <span className="fg-lb">Links</span>
          <LinkField links={links} onChange={setLinks} />
        </div>

        <div className="fg">
          <span className="fg-lb">Tags</span>
          <div className="tm-tagrow">
            {mine.map((t) => (
              <button key={t.tagId}
                className={"pill xs tm-pick" + (tags.indexOf(t.tagId) >= 0 ? " on" : "")
                  + " tag-" + (t.colourToken || "slate")}
                aria-pressed={tags.indexOf(t.tagId) >= 0}
                onClick={() => setTags(tags.indexOf(t.tagId) >= 0
                  ? tags.filter((x) => x !== t.tagId) : tags.concat([t.tagId]))}>
                {t.label}
              </button>
            ))}
            {mine.length ? null : <span className="dim">None yet — the first one is a word away.</span>}
          </div>
          <NewTagField ownerId={who} onMade={(id) => setTags((v) => v.concat([id]))} />
        </div>

        <p className="tm-ni-note">It opens in Planning. Nothing sets Delay — the due date does.</p>
      </div>

      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!title.trim()} onClick={save}>Create</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ calendar --- */

/** GOOGLE'S SHAPE, this module's data. A sidebar that opens with Create and a
 *  mini month, a date bar reading Today ‹ › over a large month name, and a flat
 *  seven-column grid whose cells are equal and whose TODAY is marked on the
 *  number — never as a wash over the whole square, which reads as a warning in
 *  a panel where a tinted row means something is wrong. */
function CalendarFace({ rows, me, p, goto, onOpen, members, all }: {
  rows: WorkItem[]; me: string; p: Record<string, string>;
  goto: (q: Record<string, string | undefined>) => void; onOpen: (id: string) => void;
  members: Member[]; all: WorkItem[];
}) {
  const shell = useShell();
  const mode = p.cal === "week" ? "week" : "month";
  const anchor = p.on || TODAY;
  const days = gridDays(anchor, mode);
  const month = anchor.slice(0, 7);
  const teamIds = membersInScope("team", me).map((m) => m.memberId);

  const move = (n: number) => goto({
    on: mode === "week" ? addDays(anchor, n * 7) : monthStep(anchor, n),
  });
  const create = (kind: string, date?: string) =>
    shell.modal(<NewItemModal kind={kind} members={members} all={all} date={date} />);

  return (
    <div className="tm-shell">
      <aside className="tm-rail">
        <Rail me={me} anchor={anchor} rows={rows} onCreate={(k) => create(k)} onOpen={onOpen} />
      </aside>
      <div className="tm-shell-b">
        {/* Everything that MOVES the calendar sits together at the right edge,
            over the grid it moves; the legend holds the left rather than
            leaving the row half empty. */}
        <div className="tm-calbar">
          <span className="spacer" />
          <button className="btn sm" onClick={() => goto({ on: undefined })}>Today</button>
          <button className="btn icon sm" aria-label="Previous" onClick={() => move(-1)}><Icon name="chevl" size="sm" /></button>
          <button className="btn icon sm" aria-label="Next" onClick={() => move(1)}><Icon name="chevr" size="sm" /></button>
          <h2 className="tm-calh">{monthLabel(anchor, mode)}</h2>
          <span className="btn-group">
            <button className={mode === "month" ? "on" : ""} onClick={() => goto({ cal: undefined })}>Month</button>
            <button className={mode === "week" ? "on" : ""} onClick={() => goto({ cal: "week" })}>Week</button>
          </span>
        </div>
        <div className={"tm-cal" + (mode === "week" ? " week" : "")}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="tm-cal-h">{d}</div>
          ))}
          {days.map((d) => {
            const evs = eventsOn(d, rows);
            const away = leaveOn(d, teamIds);
            /* THE CAP IS A HEIGHT, NOT A TASTE. A month row is 128px: the date
               takes 26, each chip 21, the "+n more" 18. Three chips fit with
               the overflow link still visible — four did not, which is why the
               last one was being sliced in half by the cell's own clip. The
               leave banner is a row like any other and counts against it. */
            const cap = Math.max(1, (mode === "week" ? 12 : 3) - (away.length ? 1 : 0));
            return (
              /* Clicking the EMPTY part of a day starts something on it — the
                 one Google gesture worth keeping. The test is the event target
                 being the cell itself, so a chip inside it still opens. */
              <div key={d} className={"tm-day"
                + (d.slice(0, 7) !== month && mode === "month" ? " out" : "")
                + (isWeekendDay(d) ? " we" : "")
                + (d === anchor && d !== TODAY ? " sel" : "")
                + (d === TODAY ? " today" : "")}
                onClick={(e) => { if (e.target === e.currentTarget) create("task", d); }}>
                <span className="tm-day-n">{Number(d.slice(8))}</span>
                {/* THE CELL'S CLICK IS A POINTER SHORTCUT, AND A SHORTCUT IS ALL
                    IT CAN BE: a div that only answers a mouse announces nothing
                    to a screen reader and cannot be reached by tab. The real
                    control is this button — named, focusable, and revealed by
                    focus as well as by hover, so the keyboard finds it exactly
                    where the pointer does. */}
                <button className="tm-day-add" aria-label={"Add on " + fmtDate(d)}
                  onClick={() => create("task", d)}>
                  <Icon name="plus" size="sm" />
                </button>
                {away.length ? (
                  <span className="tm-ev leave">{away.map((l) => nameOf(l.memberId)).join(", ")} on leave</span>
                ) : null}
                {evs.slice(0, cap).map((e) => <CalChip key={e.item.itemId + e.edge} ev={e} onOpen={onOpen} />)}
                {evs.length > cap ? (
                  <button className="tm-more" onClick={() => goto({ cal: "week", on: d })}
                    aria-label={evs.length - cap + " more on " + fmtDate(d) + " — open the week"}>
                    +{evs.length - cap} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="tm-calfoot">
          <span className="tm-legend">
            <i className="k-info" />stage
            <i className="k-warn" />delay
            <i className="k-bad" />waiting
          </span>
          <p className="tm-foot">
            A task of a week or less spans every day it covers; anything longer, and every milestone
            and target, is drawn twice — where it starts and where it is due.
          </p>
        </div>
      </div>
    </div>
  );
}

const nameOf = (id: string) => (readMember(id)?.name || id).split(" ").slice(-1)[0];

function monthLabel(d: string, mode: string) {
  if (mode === "week") return fmtDate(d) + " – " + fmtDate(addDays(d, 6));
  return fmtMonth(d, true);
}

function CalChip({ ev, onOpen }: { ev: CalEvent; onOpen: (id: string) => void }) {
  const i = ev.item;
  const st = stageOf(i);
  const wait = !!blockerOf(i);
  return (
    <button className={"tm-ev s-" + (wait && st === "delayed" ? "bad" : toneOf(WORK_STATUS, st) || "none")}
      onClick={() => onOpen(i.itemId)} title={i.title}>
      <KindMark kind={i.kind} />
      {ev.edge ? <em>{ev.edge === "starts" ? "starts" : "due"}</em> : null}
      {i.title}
    </button>
  );
}

/* ---------------------------------------------------------------- rail --- */

/** Create, this month's counts, then tasks ▸ milestones ▸ targets. It belongs
 *  to this face and no other.
 *
 *  NO MINI MONTH. It sat a second month grid immediately beside the first one,
 *  and the two answered the same question at two sizes — the big grid is
 *  already the date picker, and ‹ › on the bar is already the month step. */
function Rail({ me, anchor, rows, onCreate, onOpen }: {
  me: string; anchor: string; rows: WorkItem[];
  onCreate: (kind: string) => void; onOpen: (id: string) => void;
}) {
  const month = anchor.slice(0, 7);
  const inMonth = rows.filter((i) => {
    const a = i.startDate || i.dueDate, b = i.dueDate || i.startDate;
    return !!a && !!b && a.slice(0, 7) <= month && (b as string).slice(0, 7) >= month;
  });
  const t = workTotals(inMonth);

  return (
    <>
      {/* Create PINS; the blocks scroll under it. It is the control somebody
          reaches for at any scroll position, and a sidebar that scrolls its own
          Create button away has lost the plot. */}
      <div className="tm-rail-t">
        <CreateMenu big onPick={onCreate} />
      </div>

      <div className="tm-rail-b">
        <section className="tm-blk">
          <header><b>{fmtMonth(anchor)}</b><span className="tm-blk-c">{inMonth.length} dated</span></header>
          <span className="tm-stack">
            <i className="k-ok" style={{ width: pct(t.completed, inMonth.length) }} />
            <i className="k-info" style={{ width: pct(t.inProgress + t.planned, inMonth.length) }} />
            <i className="k-warn" style={{ width: pct(t.delayed, inMonth.length) }} />
          </span>
          <p className="tm-blk-m">
            <span className="u-ok-t">{t.completed} done</span>
            <span>{t.inProgress + t.planned} open</span>
            <span className="u-warn-t">{t.delayed} in delay</span>
          </p>
        </section>

        <TasksBlock who={me} onOpen={onOpen} />
        <MarksBlock kind="milestone" who={me} onOpen={onOpen} compact />
        {/* ONE target. It is the number the quarter is judged on, and a column
            of four of them is a list, not an indicator. */}
        <MarksBlock kind="target" who={me} onOpen={onOpen} compact limit={1} />
      </div>
    </>
  );
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) + "%" : "0%");

/* --------------------------------------------------------------- board --- */

function Board({ rows, all, group, goto, onOpen }: {
  rows: WorkItem[]; all: WorkItem[]; group: string;
  goto: (q: Record<string, string | undefined>) => void; onOpen: (id: string) => void;
}) {
  const cols = columnsFor(rows, group);
  return (
    <>
      <div className="tm-groupbar">
        <label htmlFor="tmGroup">Group by</label>
        <select id="tmGroup" className="inp sm" value={group}
          onChange={(e) => goto({ group: e.target.value || undefined })}>
          {GROUPS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
        </select>
        <span className="spacer" />
        <span className="tm-groupnote">
          {group
            ? "A grouping, not a workflow — a drag here would mean a reassignment, which needs a reason."
            : "Four stored stages take a drop. Delay takes none: there is nothing to write."}
        </span>
      </div>
      <div className="tm-boardwrap">
        <div className="tm-board">
          {cols.map((c) => (
            <section key={c.key} className={"tm-col tm-col-" + c.key}>
              <header><b>{c.label}</b><span className="tnum">{c.list.length}</span></header>
              <div className="tm-col-b">
                {c.list.length
                  ? c.list.map((i) => <Card key={i.itemId} item={i} all={all} onOpen={onOpen} />)
                  : <p className="tm-col-e">Nothing here.</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

/** The last column is never hidden. A grouping that silently drops its
 *  ungrouped rows is a board that lies about its own count. */
function columnsFor(rows: WorkItem[], group: string) {
  const cols: { key: string; label: string; list: WorkItem[] }[] = [];
  const rest: WorkItem[] = [];
  if (!group) {
    STAGES.forEach((s) => cols.push({ key: s, label: labelOf(WORK_STATUS, s), list: rows.filter((i) => stageOf(i) === s) }));
    return cols;
  }
  const seen: Record<string, { key: string; label: string; list: WorkItem[] }> = {};
  const put = (key: string, label: string, i: WorkItem) => {
    if (!seen[key]) { seen[key] = { key, label, list: [] }; cols.push(seen[key]); }
    seen[key].list.push(i);
  };
  rows.forEach((i) => {
    if (group === "kind") put(i.kind, labelOf(KIND, i.kind), i);
    else if (group === "assignee") put(i.assigneeId, readMember(i.assigneeId)?.name || i.assigneeId, i);
    else if (group === "priority") put(i.priority, labelOf(PRIORITY, i.priority), i);
    else {
      const ts = tagsOf(i);
      if (!ts.length) rest.push(i);
      else ts.forEach((t) => put(t.slug, t.label, i));
    }
  });
  cols.sort((a, b) => a.label.localeCompare(b.label));
  cols.push({ key: "_rest", label: group === "tag" ? "Untagged" : "Ungrouped", list: rest });
  return cols;
}

function Card({ item, all, onOpen }: { item: WorkItem; all: WorkItem[]; onOpen: (id: string) => void }) {
  const m = readMember(item.assigneeId);
  const parent = parentOf(item, all);
  const late = isDelayed(item);
  return (
    <button className={"tm-card" + (late ? " late" : "") + (item.status === "cancelled" ? " dead" : "")}
      onClick={() => onOpen(item.itemId)}>
      <span className="tm-card-t"><KindMark kind={item.kind} /><b>{item.title}</b></span>
      <span className="tm-card-m">
        {m ? <span className="tm-card-who">{m.name}</span> : null}
        <PriorityChip p={item.priority} />
        {late ? <span className="pill warn xs">{ago(item.dueDate, TODAY)}</span> : null}
        <WaitFlag item={item} />
        <TagChips item={item} />
      </span>
      {parent ? (
        <span className="tm-card-p" title={"Rolls up to " + parent.title}>
          <KindMark kind={parent.kind} />{parent.title}
        </span>
      ) : null}
      {item.kind !== "task" ? <ProgressWindow item={item} /> : null}
    </button>
  );
}

/* ------------------------------------------------------------ timeline --- */

/** Lanes are the work, never the worker. A lane per person is a productivity
 *  chart this module has no estimate field to justify. */
function Timeline({ rows, onOpen }: { rows: WorkItem[]; onOpen: (id: string) => void }) {
  const [weeks, setWeeks] = useState(2);
  const [from, setFrom] = useState(() => addDays(TODAY, -((new Date(TODAY).getDay() + 6) % 7) - 7));
  const days: string[] = [];
  for (let i = 0; i < weeks * 7; i++) days.push(addDays(from, i));
  const lanes = lanesOf(rows);
  const undated = rows.filter((i) => !i.startDate && !isTerminal(i.status));
  const span = (a: string, b: string) => {
    const s = days.indexOf(a) >= 0 ? days.indexOf(a) : (a < days[0] ? 0 : -1);
    const e = days.indexOf(b) >= 0 ? days.indexOf(b) : (b > days[days.length - 1] ? days.length - 1 : -1);
    if (s < 0 || e < 0 || e < s) return null;
    return { left: (s / days.length) * 100 + "%", width: ((e - s + 1) / days.length) * 100 + "%" };
  };

  return (
    <div className="tm-tl">
      <div className="tm-calbar">
        <button className="btn icon sm" aria-label="Previous" onClick={() => setFrom(addDays(from, -7 * weeks))}><Icon name="chevl" size="sm" /></button>
        <b>{fmtDate(days[0])} – {fmtDate(days[days.length - 1])}</b>
        <button className="btn icon sm" aria-label="Next" onClick={() => setFrom(addDays(from, 7 * weeks))}><Icon name="chevr" size="sm" /></button>
        <span className="tm-seg">
          {[2, 4, 13].map((w) => (
            <button key={w} className={weeks === w ? "on" : ""} onClick={() => setWeeks(w)}>
              {w === 13 ? "Quarter" : w + "w"}
            </button>
          ))}
        </span>
        <span className="spacer" />
        <span className="tm-legend"><i className="k-none" />dashed = the lane's own window</span>
      </div>

      <div className="tm-tl-head">
        <span className="tm-tl-lane">Target · milestone</span>
        <span className="tm-tl-grid">
          {days.map((d) => (
            <i key={d} className={isWeekendDay(d) ? "we" : ""}>{Number(d.slice(8))}</i>
          ))}
        </span>
      </div>

      {lanes.map((ln, n) => {
        const host = ln.item;
        const bars: { i: WorkItem; win: boolean }[] = [];
        if (host && host.startDate) bars.push({ i: host, win: true });
        ln.tasks.filter((i) => i.startDate).forEach((i) => bars.push({ i, win: false }));
        return (
          <div key={host ? host.itemId : "none" + n} className="tm-tl-row">
            <span className={"tm-tl-lane" + (ln.sub ? " sub" : "")}>
              {host ? (
                <>
                  <b><KindMark kind={host.kind} />{host.title}</b>
                  <span className="cell-2">{labelOf(KIND, host.kind)} · {noteOf(host)}{host.dueDate ? " · due " + fmtDate(host.dueDate) : ""}</span>
                </>
              ) : (
                <>
                  <b>No milestone</b>
                  <span className="cell-2">{ln.tasks.length} tasks hang off nothing</span>
                </>
              )}
            </span>
            <span className="tm-tl-grid">
              {days.map((d) => <i key={d} className={isWeekendDay(d) ? "we" : ""} />)}
              {bars.map((b, k) => {
                const s = span(b.i.startDate as string, (b.i.dueDate || b.i.startDate) as string);
                if (!s) return null;
                const st = stageOf(b.i);
                return (
                  <button key={b.i.itemId + k} title={b.i.title}
                    className={"tm-tlbar t-" + (toneOf(WORK_STATUS, st) || "none") + (b.win ? " win" : "")}
                    style={{ left: s.left, width: s.width, top: 6 + k * 22 }}
                    onClick={() => onOpen(b.i.itemId)}>
                    {b.win ? null : <span className="tm-tlbar-w">{nameOf(b.i.assigneeId)} · </span>}
                    {b.i.title}
                  </button>
                );
              })}
            </span>
          </div>
        );
      })}

      <p className="tm-foot">
        {undated.length
          ? undated.length + " open items have no start date and cannot be drawn: "
            + undated.map((i) => i.title).join(" · ")
          : "Every open item has a start date."}
      </p>
    </div>
  );
}

const isWeekendDay = (d: string) => {
  const n = new Date(d + "T00:00:00").getDay();
  return n === 0 || n === 6;
};

/* ----------------------------------------------------------------- list --- */

function List({ rows, all, onOpen }: { rows: WorkItem[]; all: WorkItem[]; onOpen: (id: string) => void }) {
  return (
    <Table
      scroll min="1100px"
      cols={[
        { label: "", w: "3px" },
        { label: "Item" },
        { label: "Member", w: "170px" },
        { label: "Rolls up to", w: "190px" },
        { label: "Stage", w: "130px" },
        { label: "Priority", w: "92px" },
        { label: "Due", w: "128px" },
        { label: "Progress", w: "140px" },
      ]}
      empty={{ icon: "check", title: "No work matches", body: "Clear the filters, or create the first item." }}
      rows={rows.map((i) => {
        const m = readMember(i.assigneeId);
        const parent = parentOf(i, all);
        const late = isDelayed(i);
        const rail = late && blockerOf(i) ? "u-bad" : late ? "u-warn" : "";
        return (
          <tr key={i.itemId} className={"clickable " + rail + (i.status === "cancelled" ? " dim" : "")}
            tabIndex={0} role="link"
            onClick={() => onOpen(i.itemId)}
            onKeyDown={(e) => { if (e.key === "Enter") onOpen(i.itemId); }}>
            <td className="rail"><i className={rail} /></td>
            <td>
              <span className="tm-title"><KindMark kind={i.kind} /><b>{i.title}</b></span>
              <span className="cell-2"><TagChips item={i} /><WaitFlag item={i} /></span>
            </td>
            <td>{m ? <Who m={m} /> : <span className="dim">—</span>}</td>
            <td>{parent ? <span className="tm-parent"><KindMark kind={parent.kind} />{parent.title}</span> : <span className="dim">—</span>}</td>
            <td><StagePill item={i} /></td>
            <td><PriorityChip p={i.priority} /></td>
            <td className="tnum">
              {i.dueDate ? fmtDate(i.dueDate) : "—"}
              {i.dueDate ? <span className="cell-2">{ago(i.dueDate, TODAY)}</span> : null}
            </td>
            <td>{i.kind === "task" ? <span className="dim">—</span> : <ProgressWindow item={i} />}</td>
          </tr>
        );
      })}
    />
  );
}

/* --------------------------------------------------------------- drawer --- */

function ItemDrawer({ item, all, tags, onClose, onOpen }: {
  item: WorkItem; all: WorkItem[]; tags: Tag[]; onClose: () => void; onOpen: (id: string) => void;
}) {
  const shell = useShell();
  useLinks();
  const links = linksOf(item.itemId);
  const m = readMember(item.assigneeId);
  const parent = parentOf(item, all);
  const kids = childrenOf(item.itemId, all);
  const late = isDelayed(item);
  const blocker = blockerOf(item, all);
  const st = stageOf(item);
  const mine = tagsOwnedBy(item.assigneeId);
  const on = (item.tagIds || []);

  const move = (to: WorkStatus, reason?: string) => {
    const r = setItemStatus(item.itemId, to, reason);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast(item.title + " → " + labelOf(WORK_STATUS, to));
  };
  const askReason = (to: WorkStatus, title: string) => {
    shell.modal(<ReasonModal title={title} onSubmit={(reason) => { shell.closeLayer(); move(to, reason); }} />, "sm");
  };

  return (
    <>
      <div className="dw-h">
        <span className="tm-dw-t"><KindMark kind={item.kind} /><b>{item.title}</b></span>
        <StagePill item={item} />
        <span className="spacer" />
        <button className="btn icon sm" aria-label="Close" onClick={onClose}><Icon name="x" size="sm" /></button>
      </div>
      <div className="dw-b">
        {late ? (
          <Notice tone="warn" text={"Due " + fmtDate(item.dueDate) + " — " + daysOver(item) + " days over. Delay is derived from the date; the stored stage is still " + labelOf(WORK_STATUS, item.status) + "."} />
        ) : null}
        {blocker ? (
          <Notice tone="bad" text={(item.blockedReason || "Waiting on another item.") + " → " + blocker.title} />
        ) : null}
        {item.status === "cancelled" && item.cancelledReason
          ? <Notice text={item.cancelledReason} /> : null}

        <SectionHead title="The item" />
        <KvList cls="wide" pairs={[
          ["Kind", <span className="tm-title" key="k"><KindMark kind={item.kind} />{labelOf(KIND, item.kind)}</span>],
          ["Assigned to", m ? m.name + " · " + m.designation : "—"],
          ["Stage", <span key="s">{labelOf(WORK_STATUS, st)}{st === "delayed"
            ? <span className="cell-2">derived · stored stage is {labelOf(WORK_STATUS, item.status)}</span> : null}</span>],
          ["Priority", labelOf(PRIORITY, item.priority)],
          ["Rolls up to", parent
            ? <a key="p" data-go={"#/work?item=" + parent.itemId}
                onClick={() => onOpen(parent.itemId)}>{parent.title}</a>
            : <span key="p" className="dim">Nothing — it is top level</span>],
          ["Starts", item.startDate ? fmtDate(item.startDate) : <span key="st" className="dim">Not set — it cannot be drawn on the timeline</span>],
          ["Due", item.dueDate ? fmtDate(item.dueDate) + " · " + ago(item.dueDate, TODAY) : "—"],
          ["Waiting on", blocker
            ? <a key="b" data-go={"#/work?item=" + blocker.itemId}
                onClick={() => onOpen(blocker.itemId)}>{blocker.title}</a>
            : <span key="b" className="dim">Nothing</span>],
        ]} />

        {item.description ? (
          <>
            <SectionHead title="Description" />
            <RichText text={item.description} />
          </>
        ) : null}

        {(item.attachments || []).length ? (
          <>
            <SectionHead title="Links" desc="Opens in a new tab." />
            <ul className="tm-lk">
              {(item.attachments || []).map((l, i) => (
                <li key={l.url + i}>
                  <Icon name="ext" size="sm" />
                  <span className="tm-lk-t">
                    {/* noreferrer as well as noopener: the target must not be
                        handed this panel's URL in its referrer. */}
                    <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                    <span className="cell-2">{l.url}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <SectionHead title="Tags" desc="A tag is a record its owner holds. Two members may both hold Call." />
        <TagPicker item={item} mine={mine} on={on} tags={tags} />

        <SectionHead title="Linked items"
          desc="Soft edges. The parent and the waiting-on links live above; an edge here never touches rollup."
          right={<button className="btn sm" onClick={() => shell.modal(<LinkModal item={item} all={all} />, "sm")}>Link…</button>} />
        {links.length ? (
          <ul className="tm-kids">
            {links.map(({ link, other, outward }) => (
              <li key={link.linkId}>
                <a data-go={"#/work?item=" + other.itemId} onClick={() => onOpen(other.itemId)}>
                  <span className="tm-lk">{linkLabelOf(link.relation, outward)}</span>
                  <KindMark kind={other.kind} />{other.title}
                </a>
                <button className="btn icon sm" aria-label="Remove this link"
                  onClick={() => removeLink(link.linkId)}><Icon name="x" size="sm" /></button>
              </li>
            ))}
          </ul>
        ) : <p className="tm-foot">Nothing linked.</p>}

        {item.kind !== "task" ? (
          <>
            <SectionHead title="Progress" desc={item.kind === "target"
              ? "Current value ÷ target. Nothing types the percentage."
              : "Completed children ÷ total. The marker is where today sits in the window."} />
            <ProgressWindow item={item} showNote />
            <p className="tm-target tnum">{noteOf(item)}</p>
          </>
        ) : null}

        {kids.length ? (
          <>
            <SectionHead title={"Inside this " + item.kind} desc={kids.length + " items"} />
            <ul className="tm-kids">
              {kids.map((k) => (
                <li key={k.itemId} className={k.status === "completed" ? "done" : ""}>
                  <a data-go={"#/work?item=" + k.itemId} onClick={() => onOpen(k.itemId)}>
                    <KindMark kind={k.kind} />{k.title}
                  </a>
                  <StagePill item={k} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="dw-f">
        {item.status === "planned" ? <button className="btn pri" onClick={() => move("in_progress")}>Start</button> : null}
        {item.status === "in_progress" ? <button className="btn pri" onClick={() => move("completed")}>Complete</button> : null}
        {item.status === "completed" ? <button className="btn" onClick={() => askReason("in_progress", "Reopen this item")}>Reopen…</button> : null}
        {!isTerminal(item.status) ? (
          <button className="btn" onClick={() => shell.modal(
            <WaitModal item={item} all={all} />, "sm")}>
            {blocker ? "Waiting on…" : "Waiting on…"}
          </button>
        ) : null}
        <span className="spacer" />
        {!isTerminal(item.status)
          ? <button className="btn dgr" onClick={() => askReason("cancelled", "Why is it cancelled?")}>Cancel…</button> : null}
      </div>
    </>
  );
}

/** Own tags first, then the suggestions, then create. This is the only place a
 *  tag is born — a separate screen would be a second entry point to a record
 *  with six fields. */
function TagPicker({ item, mine, on, tags }: { item: WorkItem; mine: Tag[]; on: string[]; tags: Tag[] }) {
  const shell = useShell();
  const [draft, setDraft] = useState("");
  const add = () => {
    const r = createTag(item.assigneeId, draft);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    tagItem(item.itemId, r.data.tagId, true);
    setDraft("");
  };
  const others = tags.filter((t) => t.ownerId !== item.assigneeId && !t.archivedAt
    && !mine.some((x) => x.slug === t.slug));
  return (
    <div className="tm-tagpick">
      <div className="tm-tagrow">
        {mine.map((t) => (
          <button key={t.tagId}
            className={"pill xs tm-pick" + (on.indexOf(t.tagId) >= 0 ? " on" : "") + " tag-" + (t.colourToken || "slate")}
            onClick={() => tagItem(item.itemId, t.tagId, on.indexOf(t.tagId) < 0)}>
            {t.label}
          </button>
        ))}
        {mine.length ? null : <span className="dim">No tags yet.</span>}
      </div>
      <div className="tm-tagnew">
        <input className="inp sm" placeholder="New tag" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="btn sm" disabled={!draft.trim()} onClick={add}>Create</button>
      </div>
      {others.length ? (
        <p className="cell-2">{others.length} more tags exist on other members. Cross-member views group by slug.</p>
      ) : null}
    </div>
  );
}

function WaitModal({ item, all }: { item: WorkItem; all: WorkItem[] }) {
  const shell = useShell();
  const [pick, setPick] = useState(item.blockedByItemId || "");
  const [why, setWhy] = useState(item.blockedReason || "");
  const options = all.filter((i) => i.itemId !== item.itemId && !isTerminal(i.status));
  const save = (clear?: boolean) => {
    const r = setBlockedBy(item.itemId, clear ? null : pick || null, why);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast(clear ? "No longer waiting." : "Waiting on another item.");
  };
  return (
    <>
      <div className="md-h">
        <h3>Waiting on</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="tmWaitOn">Item</label>
          <select id="tmWaitOn" className="inp" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">—</option>
            {options.map((i) => <option key={i.itemId} value={i.itemId}>{i.title}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="tmWaitWhy">Reason <b className="req">*</b></label>
          <input id="tmWaitWhy" className="inp" value={why} onChange={(e) => setWhy(e.target.value)}
            placeholder="What it is waiting for." />
          <span className="help">The stage does not move. Waiting is a relationship, not a stage.</span>
        </div>
      </div>
      <div className="md-f">
        {item.blockedByItemId ? <button className="btn" onClick={() => save(true)}>Clear</button> : null}
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!pick} onClick={() => save()}>Save</button>
      </div>
    </>
  );
}

/** One picker, one relation. The list already excludes the parent and the
 *  blocker — those are the strong links, and the store refuses them anyway. */
function LinkModal({ item, all }: { item: WorkItem; all: WorkItem[] }) {
  const shell = useShell();
  const [pick, setPick] = useState("");
  const [rel, setRel] = useState<LinkRelation>("relates_to");
  const options = all.filter((i) => i.itemId !== item.itemId
    && i.itemId !== item.parentId && i.parentId !== item.itemId
    && i.itemId !== item.blockedByItemId);
  const save = () => {
    const r = addLink(item.itemId, pick, rel);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Linked.");
  };
  return (
    <>
      <div className="md-h">
        <h3>Link an item</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="lkRel">Relation</label>
          <select id="lkRel" className="inp" value={rel}
            onChange={(e) => setRel(e.target.value as LinkRelation)}>
            {(["relates_to", "duplicates", "follows"] as LinkRelation[]).map((k) =>
              <option key={k} value={k}>{linkLabelOf(k, true)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="lkTo">Item</label>
          <select id="lkTo" className="inp" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">—</option>
            {options.map((i) => <option key={i.itemId} value={i.itemId}>{i.title}</option>)}
          </select>
          <span className="help">Gates nothing. A follows edge draws a sequence; it never blocks the work.</span>
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!pick} onClick={save}>Link</button>
      </div>
    </>
  );
}

/** Every transition that changes what a reader would conclude asks for a
 *  sentence. A cancellation with no reason cannot answer the question it will
 *  be asked. */
function ReasonModal({ title, onSubmit }: { title: string; onSubmit: (reason: string) => void }) {
  const shell = useShell();
  const [v, setV] = useState("");
  return (
    <>
      <div className="md-h">
        <h3>{title}</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="tmReason">Reason <b className="req">*</b></label>
          <textarea id="tmReason" className="inp" rows={3} autoFocus value={v}
            onChange={(e) => setV(e.target.value)} />
          <span className="help">Stored on the item and shown wherever its stage is.</span>
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!v.trim()} onClick={() => onSubmit(v)}>Save</button>
      </div>
    </>
  );
}

