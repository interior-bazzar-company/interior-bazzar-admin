/* =============================================================================
   The task panel — what one item is, and the one thing you came to change.
   -----------------------------------------------------------------------------
   REDESIGNED FROM THE FRAME OUT. What it replaces had accreted: a header, a
   notice, a facts strip, a second facts list at a different width, six sections
   each introduced by a sentence explaining the data model, and a footer of six
   buttons that were the real controls — so the thing you most often opened the
   panel to do (move the status) was the furthest from the top, spelled as
   Start / Complete / Reopen… / Restore… / Cancel…, five buttons for one field.

   THE SHAPE IS FOUR BANDS, and they are in the order the questions are asked:

     1  WHAT IS IT      kind, title, and the way out
     2  WHERE IS IT     the status, as a control, on a line of its own — plus
                        whatever is wrong with it right now
     3  THE FACTS       who, when, how loud, what it belongs to
     4  THE WORK        steps, details, tags, links, related

   ONE FIELD, ONE CONTROL. Status is a menu of the moves the store actually
   allows (`transitionsFrom`), so the footer's five buttons collapse into the
   chip that was already sitting there being read-only — and the same control
   is on the table row, because a status you can change in one place and only
   read in another is a status people go hunting for.

   THE FOOTER IS THE TWO RELATIONSHIPS. Waiting-on and Related are the only
   things left that are neither a fact nor a field, and they were scattered —
   one in the old footer, one hung off a section heading.
   ============================================================================= */
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { Icon, Notice, SectionHead } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import {
  KIND, PRIORITY, PRIORITY_SCALE, TODAY, addCheckLine, addLink, addResourceLink,
  blockerOf, checkCount, childrenOf, createTag, fmtDate, isDelayed, isTerminal, labelOf,
  linkLabelOf, linksOf, parentOf, parentOptions, readMember, removeCheckLine, removeLink,
  removeResourceLink, setBlockedBy, tagItem, tagsOwnedBy, toggleCheckLine, updateItem, useItem,
  useLinks, useMembers, useTags, useWork,
} from "./store";
import type { LinkRelation, Priority, Tag, WorkItem } from "./store";
import { KindMark, PriorityChip, TagTypePicker, Who, ago } from "./bits";
import { ProgressWindow, RichText, StagePill, daysOver, noteOf } from "./workBits";
import { StatusPicker } from "./status";
import { MarkBar } from "./marks";


/* ------------------------------------------------------------- the panel -- */

export function ItemDrawer({ itemId, onClose, onOpen }: {
  itemId: string; onClose: () => void; onOpen: (id: string) => void;
}) {
  const shell = useShell();
  useLinks();
  const item = useItem(itemId);
  const all = useWork({}, "all");
  const tags = useTags();

  /* The record can go while the panel is over it — somebody else's delete, or
     one made in another tab. Saying so beats an empty panel or a crash. */
  if (!item) {
    return (
      <>
        <div className="dw-h tm-dw-h">
          <span className="tm-dw-t"><b>Item not found</b></span>
          <button className="btn icon sm" aria-label="Close" onClick={onClose}>
            <Icon name="x" size="sm" />
          </button>
        </div>
        <div className="dw-b">
          <Notice tone="warn" text="This item was removed while the panel was open." />
        </div>
      </>
    );
  }

  const links = linksOf(item.itemId);
  const m = readMember(item.assigneeId);
  const parent = parentOf(item, all);
  const kids = childrenOf(item.itemId, all);
  const late = isDelayed(item);
  const blocker = blockerOf(item, all);
  const mine = tagsOwnedBy(item.assigneeId);
  const on = item.tagIds || [];
  const ck = checkCount(item);
  /* Both halves of the one idea — `attachments` from the create dialog and
     `links` from this panel hold the same thing, and LinkList draws them as one
     list, so the heading counts them as one too. */
  const linkCount = (item.attachments || []).length + (item.links || []).length;

  /* BUILT, NOT WRITTEN INLINE, so a fact that is not set costs no cell at all
     rather than a cell saying it is not set. Status is not among them: it is
     band 2, as a control, and printing it here as well would be the same fact
     twice one scroll-line apart. */
  const facts: { k: string; v: ReactNode; wide?: boolean }[] = [
    { k: "Assigned to", v: m ? <Who m={m} /> : <span className="dim">Nobody</span> },
    {
      k: "Due",
      v: item.dueDate
        ? <span className={late ? "u-warn-t" : ""}>
            {fmtDate(item.dueDate)}<span className="cell-2">{ago(item.dueDate, TODAY)}</span>
          </span>
        : <span className="dim">No date</span>,
    },
    { k: "Priority", v: <PriorityChip p={item.priority} /> },
  ];
  if (item.startDate) facts.push({ k: "Starts", v: fmtDate(item.startDate) });
  if (item.kind !== "task") {
    facts.push({ k: "Kind", v: <span className="tm-dw-lk"><KindMark kind={item.kind} />{labelOf(KIND, item.kind)}</span> });
  }
  if (parent) {
    facts.push({
      k: "Rolls up to", wide: true,
      v: <a className="tm-dw-lk" data-go={"#/work?item=" + parent.itemId}
        onClick={() => onOpen(parent.itemId)}>
        <KindMark kind={parent.kind} />{parent.title}
      </a>,
    });
  }
  if (blocker) {
    facts.push({
      k: "Waiting on", wide: true,
      v: <a className="tm-dw-lk" data-go={"#/work?item=" + blocker.itemId}
        onClick={() => onOpen(blocker.itemId)}>
        <KindMark kind={blocker.kind} />{blocker.title}
      </a>,
    });
  }

  return (
    <>
      {/* 1 — WHAT IS IT */}
      <div className="dw-h tm-dw-h">
        <span className="tm-dw-t"><KindMark kind={item.kind} /><b>{item.title}</b></span>
        {!isTerminal(item.status) ? (
          <button className="btn sm" onClick={() => shell.modal(<EditItemModal item={item} all={all} />, "sm")}>
            Edit
          </button>
        ) : null}
        <button className="btn icon sm" aria-label="Close" onClick={onClose}>
          <Icon name="x" size="sm" />
        </button>
      </div>

      <div className="dw-b tm-dw-b">
        {/* 2 — WHERE IS IT. The status is the control, not a badge, and it is
            the first thing under the title because it is the most common
            reason this panel is open. */}
        <div className="tm-dw-st">
          <StatusPicker item={item} />
          {late ? (
            <span className="tm-dw-flag u-warn-t">
              <Icon name="alert" size="sm" />{daysOver(item)} days over
            </span>
          ) : null}
        </div>

        {blocker ? (
          <Notice tone="bad" text={(item.blockedReason || "Waiting on another item.") + " → " + blocker.title} />
        ) : null}
        {item.status === "cancelled" && item.cancelledReason
          ? <Notice text={item.cancelledReason} /> : null}

        {/* 3 — THE FACTS */}
        <dl className="tm-facts">
          {facts.map((f) => (
            <div key={f.k} className={"tm-fact" + (f.wide ? " wide" : "")}>
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>

        {/* 4 — THE WORK. Steps lead: they are the only part of this panel you
            act on repeatedly, and the heading answers "how far along" where the
            section is named rather than in a sentence beside it. */}
        {item.kind === "task" ? (
          <>
            <SectionHead title="Steps" desc={ck.total ? ck.done + " of " + ck.total : undefined}
              right={ck.total ? <ProgressWindow item={item} bare /> : undefined} />
            <CheckList item={item} />
          </>
        ) : (
          <>
            <SectionHead title="Progress" desc={noteOf(item)} />
            <ProgressWindow item={item} showNote />
          </>
        )}

        {item.description ? (
          <>
            <SectionHead title="Details" />
            <RichText text={item.description} />
          </>
        ) : null}

        <SectionHead title="Tags" desc={on.length ? String(on.length) : undefined} />
        <TagPicker item={item} mine={mine} on={on} tags={tags} />

        <SectionHead title="Links" desc={linkCount ? String(linkCount) : undefined} />
        <LinkList item={item} />

        {links.length ? (
          <>
            <SectionHead title="Related" desc={String(links.length)} />
            <ul className="tm-kids">
              {links.map(({ link, other, outward }) => (
                <li key={link.linkId}>
                  <a data-go={"#/work?item=" + other.itemId} onClick={() => onOpen(other.itemId)}>
                    <span className="tm-lk-rel">{linkLabelOf(link.relation, outward)}</span>
                    <KindMark kind={other.kind} />{other.title}
                  </a>
                  <button className="btn icon sm" aria-label="Remove this link"
                    onClick={() => removeLink(link.linkId)}><Icon name="x" size="sm" /></button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {kids.length ? (
          <>
            <SectionHead title={"Inside this " + item.kind} desc={String(kids.length)} />
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

      {/* THE TWO RELATIONSHIPS, together. Everything else that used to live
          down here was the status field spelled as five buttons. */}
      {!isTerminal(item.status) ? (
        <div className="dw-f">
          <button className="btn" onClick={() => shell.modal(<WaitModal item={item} all={all} />, "sm")}>
            <Icon name="lock" size="sm" />{blocker ? "Waiting on…" : "Wait on…"}
          </button>
          <button className="btn" onClick={() => shell.modal(<LinkModal item={item} all={all} />, "sm")}>
            <Icon name="link" size="sm" />Link…
          </button>
        </div>
      ) : null}
    </>
  );
}

/* --------------------------------------------------- the panel's parts --- */

/** THE FIELDS THE CREATE DIALOG SET, editable. Same `.fg` rows, same rules,
 *  and the kind is not among them — a kind decides what may sit under an item,
 *  so changing it would orphan children without saying so. */
function EditItemModal({ item, all }: { item: WorkItem; all: WorkItem[] }) {
  const shell = useShell();
  const members = useMembers();
  const [title, setTitle] = useState(item.title);
  const [who, setWho] = useState(item.assigneeId);
  const [pri, setPri] = useState<string>(item.priority);
  const [start, setStart] = useState(item.startDate || "");
  const [due, setDue] = useState(item.dueDate || "");
  const [parent, setParent] = useState(item.parentId || "");
  /* THE DESCRIPTION WAS WRITE-ONCE. It could be set on the create dialog and
     nowhere afterwards — so the one field holding what the work actually IS
     could not be corrected, and the marks the toolbar writes were reachable
     only in the seconds before the item existed. */
  const [desc, setDesc] = useState(item.description || "");
  const ta = useRef<HTMLTextAreaElement | null>(null);
  /* The store's own rule — never itself, never anything under it — and
     memoised, because it does not change with a keystroke in the title. */
  const parents = useMemo(() => {
    const opts = parentOptions(item.kind, all, item.itemId);
    /* The parent it HAS stays on the list even when the rule would not offer
       it now — completed, say — or the select shows "Nothing" over a state
       that still holds the old id, and what is read is not what is saved. */
    const cur = item.parentId ? all.filter((i) => i.itemId === item.parentId)[0] : null;
    return cur && !opts.some((o) => o.itemId === cur.itemId) ? [cur].concat(opts) : opts;
  }, [item.kind, item.itemId, item.parentId, all]);
  const save = () => {
    const r = updateItem(item.itemId, {
      title, assigneeId: who, priority: pri as Priority,
      startDate: start || null, dueDate: due || null,
      parentId: item.kind === "target" ? null : (parent || null),
      description: desc.trim() || null,
    });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Saved.");
  };
  return (
    <>
      <div className="md-h">
        <h3>Edit {labelOf(KIND, item.kind).toLowerCase()}</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="eiTitle">Title <b className="req">*</b></label>
          <input id="eiTitle" className="inp" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="eiWho">Assigned to</label>
          <select id="eiWho" className="inp" value={who} onChange={(e) => setWho(e.target.value)}>
            {members.filter((m) => m.status === "active" || m.memberId === item.assigneeId)
              .map((m) => <option key={m.memberId} value={m.memberId}>{m.name}</option>)}
          </select>
          {who !== item.assigneeId
            ? <span className="help">Tags belong to a member. Handing this over drops the last person's.</span>
            : null}
        </div>
        <div className="fg">
          <label htmlFor="eiPri">Priority</label>
          <select id="eiPri" className="inp" value={pri} onChange={(e) => setPri(e.target.value)}>
            {PRIORITY_SCALE.map((k) => <option key={k} value={k}>{labelOf(PRIORITY, k)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label htmlFor="eiStart">Starts</label>
          <input id="eiStart" type="date" className="inp" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="eiDue">Due</label>
          <input id="eiDue" type="date" className="inp" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        {item.kind !== "target" ? (
          <div className="fg">
            <label htmlFor="eiParent">Rolls up to</label>
            <select id="eiParent" className="inp" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Nothing — it is top level</option>
              {parents.map((i) => <option key={i.itemId} value={i.itemId}>{i.title}</option>)}
            </select>
          </div>
        ) : null}

        {/* The same field and the same bar as the create dialog, so a
            description reads and is written the same on both screens. */}
        <div className="fg">
          <div className="tm-fgh">
            <label htmlFor="eiDesc">Details</label>
            <MarkBar ta={ta} value={desc} set={setDesc} />
          </div>
          <textarea id="eiDesc" ref={ta} className="inp tm-ni-ta" rows={4} value={desc}
            placeholder="What does done look like?"
            onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!title.trim()} onClick={save}>Save</button>
      </div>
    </>
  );
}

/** THE ONE STORED THING, AND THE ONE PLACE IT CAN BE WRITTEN.
 *
 *  Ticking is an act somebody performs; delay, stage and progress are all read
 *  off other facts. So this is a real control and not a read-out — a checkbox
 *  that toggles, a line that can be dropped, and one field that adds.
 *
 *  It did not exist. `checklist` shipped with the store, `progressOf` reads it,
 *  the Analysis face counts it and the task row draws it, but the drawer is the
 *  only screen that can edit a task and it had no checklist in it — so a line
 *  could never be written and every task's bar was stuck at 0 or 100. */
function CheckList({ item }: { item: WorkItem }) {
  const shell = useShell();
  const [draft, setDraft] = useState("");
  const lines = item.checklist || [];
  const add = () => {
    const r = addCheckLine(item.itemId, draft);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    setDraft("");
  };
  return (
    <div className="tm-ck">
      {lines.length ? (
        <ul className="tm-ck-l">
          {lines.map((l) => (
            <li key={l.lineId} className={l.done ? "done" : ""}>
              {/* A LABEL, so the words are the hit area too. A 13px box is a
                  hard target and the text beside it is the obvious thing to
                  press. */}
              <label className="tm-ck-x">
                <input type="checkbox" checked={l.done}
                  onChange={() => toggleCheckLine(item.itemId, l.lineId)} />
                <span>{l.text}</span>
              </label>
              <button className="btn icon sm" aria-label={"Remove step: " + l.text}
                onClick={() => removeCheckLine(item.itemId, l.lineId)}>
                <Icon name="x" size="sm" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="tm-foot">No steps yet — so its progress can only be 0 or 100.</p>}
      <div className="tm-ck-new">
        <input className="inp" value={draft} placeholder="Add a step" aria-label="Add a step"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="btn sm" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
    </div>
  );
}

/** A URL WITH A NAME ON IT — the brief, the folder, the board.
 *
 *  Three different things in this module read as "links" and the store names
 *  them apart on purpose: `attachments` are files this panel holds, an
 *  item↔item link is a relationship between records, and these are addresses
 *  out of the panel. The drawer used to draw `attachments` under the heading
 *  "Links" while `addResourceLink` wrote `links`, so a saved address went into
 *  the record and was never seen — and nothing could save one anyway.
 *
 *  The name is required and the scheme is checked in the store, because
 *  `docs.google.com/…` with no scheme resolves against THIS panel's origin and
 *  404s, which reads as a broken document rather than a typo. */
function LinkList({ item }: { item: WorkItem }) {
  const shell = useShell();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const add = () => {
    const r = addResourceLink(item.itemId, label, url);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    setLabel(""); setUrl("");
  };

  /* TWO FIELDS, ONE IDEA — AND THE READER MUST NOT PAY FOR THAT. The create
     modal's link field writes `attachments`; `addResourceLink` writes `links`.
     They hold the same thing, a named address, and the record carries both, so
     drawing only one of them loses whatever was typed on the other screen —
     which is what the old block did, from the opposite side. They are drawn as
     one list here. Only the `links` half can be removed, because that is the
     half with an id and a store function; collapsing the two into one field is
     a store change and it is on the backend list, not smuggled into a drawer. */
  const rows = (item.attachments || []).map((a, i) => ({
    key: "att-" + i, label: a.label, url: a.url, drop: null as null | (() => void),
  })).concat((item.links || []).map((l) => ({
    key: l.linkId, label: l.label, url: l.url,
    drop: () => { removeResourceLink(item.itemId, l.linkId); },
  })));

  return (
    <div className="tm-lkbox">
      {rows.length ? (
        <ul className="tm-lk">
          {rows.map((l) => (
            <li key={l.key}>
              <Icon name="ext" size="sm" />
              <span className="tm-lk-t">
                {/* noreferrer as well as noopener: the target must not be
                    handed this panel's URL in its referrer. */}
                <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                <span className="cell-2">{l.url}</span>
              </span>
              {l.drop ? (
                <button className="btn icon sm" aria-label={"Remove link: " + l.label}
                  onClick={l.drop}><Icon name="x" size="sm" /></button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="tm-foot">Nothing linked yet.</p>}
      {/* THE ADDRESS IS THE FIELD, AND IT LEADS. Add was disabled until BOTH
          were filled and the store then refused anything without a scheme, so
          pasting `docs.google.com/brief` — which the create dialog's own link
          field accepts — either did nothing or toasted a rule about http://.
          The name is optional here as it is there, and falls back to the host.
          Enter on either field adds, because a two-input row where only the
          button commits is a row people leave half-filled. */}
      <div className="tm-lk-new">
        <input className="inp" value={url} placeholder="docs.google.com/…" aria-label="Link address"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <input className="inp" value={label} placeholder="Name — optional" aria-label="Link name"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="btn sm" onClick={add} disabled={!url.trim()}>Add</button>
      </div>
    </div>
  );
}

/** Own tags first, then create. This is the only place in Tasks a tag is born
 *  — a separate screen would be a second entry point to a record with six
 *  fields — and it is now the only place in Tasks that can say what TYPE the
 *  new one is. The store has taken a tone since it shipped; nothing here ever
 *  passed one, so every tag made from this panel came out grey. */
function TagPicker({ item, mine, on, tags }: { item: WorkItem; mine: Tag[]; on: string[]; tags: Tag[] }) {
  const shell = useShell();
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState("slate");
  const add = () => {
    const r = createTag(item.assigneeId, draft, tone);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    tagItem(item.itemId, r.data.tagId, true);
    setDraft(""); setTone("slate");
  };
  const others = tags.filter((t) => t.ownerId !== item.assigneeId && !t.archivedAt
    && !mine.some((x) => x.slug === t.slug));
  return (
    <div className="tm-tagpick">
      <div className="tm-tagrow">
        {mine.map((t) => (
          <button key={t.tagId} type="button"
            aria-pressed={on.indexOf(t.tagId) >= 0}
            className={"pill xs tm-tag tm-pick" + (on.indexOf(t.tagId) >= 0 ? " on" : "")
              + " tag-" + (t.colourToken || "slate")}
            onClick={() => tagItem(item.itemId, t.tagId, on.indexOf(t.tagId) < 0)}>
            {t.label}
          </button>
        ))}
        {mine.length ? null : <span className="dim">No tags yet.</span>}
      </div>
      <div className="tm-tagnew">
        <input className="inp sm" placeholder="New tag" aria-label="New tag" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="btn sm" disabled={!draft.trim()} onClick={add}>Create</button>
      </div>
      <div className="tm-tagtype-row">
        <span className={"pill xs tm-tag tag-" + tone}>{draft.trim() || "Preview"}</span>
        <TagTypePicker tone={tone} onPick={setTone} />
      </div>
      {others.length ? (
        <p className="tm-foot">{others.length} more on other members.</p>
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
