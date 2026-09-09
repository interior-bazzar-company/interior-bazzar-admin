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

     1  WHAT IS IT      kind, title, and the way out — `DrawerShell`'s own head
     2  WHERE IS IT     the status, as a control, on a line of its own — plus
                        whatever is wrong with it right now
     3  THE FACTS       who, when, how loud, what it belongs to — one `KvList`
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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Button, Checkbox, DateInput, DrawerShell, FormField, FormSection, Icon, IconButton,
  Input, KvList, ModalShell, SectionHead, SelectInput, Tag, Textarea,
} from "../../ui";
import { cx } from "@/utils/cx";
import { useShell } from "../../shell/ShellContext";
import {
  KIND, PRIORITY, PRIORITY_SCALE, TODAY, addCheckLine, addLink, addResourceLink,
  blockerOf, checkCount, childrenOf, createTag, fmtDate, isDelayed, isTerminal, labelOf,
  linkLabelOf, linksOf, parentOf, parentOptions, readMember, removeCheckLine, removeLink,
  removeResourceLink, setBlockedBy, tagItem, tagsOwnedBy, toggleCheckLine, updateItem, useItem,
  useLinks, useMembers, useTags, useWork,
} from "./store";
import type { LinkRelation, Priority, Tag as TagRecord, WorkItem } from "./store";
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
      <DrawerShell title="Item not found" onClose={onClose}>
        <Alert tone="warn" title="This item was removed while the panel was open." />
      </DrawerShell>
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
  const facts: [ReactNode, ReactNode][] = [
    ["Assigned to", m ? <Who m={m} /> : <span className="text-quaternary">Nobody</span>],
    [
      "Due",
      item.dueDate
        ? (
          <span className={cx("flex flex-wrap items-baseline gap-2", late && "text-warning-primary")}>
            <span className="tnum">{fmtDate(item.dueDate)}</span>
            <span className="text-xs text-tertiary">{ago(item.dueDate, TODAY)}</span>
          </span>
        )
        : <span className="text-quaternary">No date</span>,
    ],
    ["Priority", <PriorityChip key="p" p={item.priority} />],
  ];
  if (item.startDate) facts.push(["Starts", <span key="s" className="tnum">{fmtDate(item.startDate)}</span>]);
  if (item.kind !== "task") {
    facts.push(["Kind", (
      <span className="inline-flex items-center gap-1.5">
        <KindMark kind={item.kind} />{labelOf(KIND, item.kind)}
      </span>
    )]);
  }
  if (parent) {
    facts.push(["Rolls up to", <ItemLink key="up" item={parent} onOpen={onOpen} />]);
  }
  if (blocker) {
    facts.push(["Waiting on", <ItemLink key="blk" item={blocker} onOpen={onOpen} />]);
  }

  return (
    <DrawerShell
      title={item.title}
      sub={labelOf(KIND, item.kind)}
      mark={<KindMark kind={item.kind} />}
      onClose={onClose}
      actions={!isTerminal(item.status) ? (
        <>
          <Button color="secondary" ico="lock" onClick={() => shell.modal(<WaitModal item={item} all={all} />, "sm")}>
            {blocker ? "Waiting on…" : "Wait on…"}
          </Button>
          <Button color="secondary" ico="link" onClick={() => shell.modal(<LinkModal item={item} all={all} />, "sm")}>
            Link…
          </Button>
        </>
      ) : undefined}
    >
      <div className="flex flex-col gap-5">
        {/* 2 — WHERE IS IT. The status is the control, not a badge, and it is
            the first thing under the title because it is the most common
            reason this panel is open. */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPicker item={item} />
          {late ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-primary tnum">
              <Icon name="alert" size="xs" />{daysOver(item)} days over
            </span>
          ) : null}
          <span className="flex-1" />
          {!isTerminal(item.status) ? (
            <Button color="secondary" size="xs" ico="edit"
              onClick={() => shell.modal(<EditItemModal item={item} all={all} />, "md")}>
              Edit
            </Button>
          ) : null}
        </div>

        {blocker ? (
          <Alert tone="bad" ico="lock" title="Waiting on another item">
            {(item.blockedReason || "Waiting on another item.") + " → " + blocker.title}
          </Alert>
        ) : null}
        {item.status === "cancelled" && item.cancelledReason
          ? <Alert tone="info" title="Cancelled">{item.cancelledReason}</Alert> : null}

        {/* 3 — THE FACTS */}
        <KvList pairs={facts} />

        {/* 4 — THE WORK. Steps lead: they are the only part of this panel you
            act on repeatedly, and the heading answers "how far along" where the
            section is named rather than in a sentence beside it. */}
        <section>
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
        </section>

        {item.description ? (
          <section>
            <SectionHead title="Details" />
            <RichText text={item.description} />
          </section>
        ) : null}

        <section>
          <SectionHead title="Tags" desc={on.length ? String(on.length) : undefined} />
          <TagPicker item={item} mine={mine} on={on} tags={tags} />
        </section>

        <section>
          <SectionHead title="Links" desc={linkCount ? String(linkCount) : undefined} />
          <LinkList item={item} />
        </section>

        {links.length ? (
          <section>
            <SectionHead title="Related" desc={String(links.length)} />
            <ul className="flex flex-col divide-y divide-border-secondary rounded-xl bg-primary px-3 ring-1 ring-secondary">
              {links.map(({ link, other, outward }) => (
                <li key={link.linkId} className="flex items-center gap-2 py-2">
                  <span className="label-mono shrink-0">{linkLabelOf(link.relation, outward)}</span>
                  <ItemLink item={other} onOpen={onOpen} className="min-w-0 flex-1" />
                  <IconButton ico="x" size="xs" label={"Remove this link to " + other.title}
                    onClick={() => removeLink(link.linkId)} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {kids.length ? (
          <section>
            <SectionHead title={"Inside this " + item.kind} desc={String(kids.length)} />
            <ul className="flex flex-col divide-y divide-border-secondary rounded-xl bg-primary px-3 ring-1 ring-secondary">
              {kids.map((k) => (
                <li key={k.itemId} className="flex items-center gap-2 py-2">
                  <ItemLink item={k} onOpen={onOpen} done={k.status === "completed"} className="min-w-0 flex-1" />
                  <StagePill item={k} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DrawerShell>
  );
}

/* --------------------------------------------------- the panel's parts --- */

/** One item, named and reachable. The panel links to itself constantly — a
 *  parent, a blocker, a child, a related edge — and every one of those is the
 *  same object: the kind's mark, the title, and a press that swaps the record
 *  under the panel rather than leaving it. */
function ItemLink({ item, onOpen, done, className }: {
  item: WorkItem; onOpen: (id: string) => void; done?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      data-go={"#/work?item=" + item.itemId}
      onClick={() => onOpen(item.itemId)}
      className={cx(
        "inline-flex cursor-pointer items-center gap-1.5 rounded text-left text-sm outline-focus-ring hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2",
        done ? "text-quaternary line-through" : "text-primary",
        className,
      )}
    >
      <KindMark kind={item.kind} />
      <span className="min-w-0 truncate">{item.title}</span>
    </button>
  );
}

/** THE FIELDS THE CREATE DIALOG SET, editable. Same rows, same rules, and the
 *  kind is not among them — a kind decides what may sit under an item, so
 *  changing it would orphan children without saying so. */
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
  /* MarkBar needs the real element — it reads and restores the selection, and a
     selection belongs to a DOM node, not to a value. `Textarea` in ui/ takes no
     ref (noted in the changelog as a missing prop), so the element is claimed by
     its own id once, the same way every uncontrolled field in this module is
     read. */
  const ta = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { ta.current = document.getElementById("eiDesc") as HTMLTextAreaElement | null; }, []);
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
    <ModalShell
      title={"Edit " + labelOf(KIND, item.kind).toLowerCase()}
      ico="edit"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button color="primary" isDisabled={!title.trim()} onClick={save}>Save</Button>
        </>
      }
    >
      <FormSection>
        <FormField id="eiTitle" label="Title" req>
          <Input id="eiTitle" autoFocus value={title} onChange={setTitle} />
        </FormField>
        <FormField id="eiWho" label="Assigned to"
          hint={who !== item.assigneeId
            ? "Tags belong to a member. Handing this over drops the last person's."
            : undefined}>
          <SelectInput id="eiWho" value={who} onChange={setWho}
            options={members.filter((x) => x.status === "active" || x.memberId === item.assigneeId)
              .map((x) => ({ v: x.memberId, l: x.name }))} />
        </FormField>
        <FormField id="eiPri" label="Priority">
          <SelectInput id="eiPri" value={pri} onChange={setPri}
            options={PRIORITY_SCALE.map((k) => ({ v: k, l: labelOf(PRIORITY, k) }))} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="eiStart" label="Starts">
            <DateInput id="eiStart" value={start} onChange={setStart} className="w-full" />
          </FormField>
          <FormField id="eiDue" label="Due">
            <DateInput id="eiDue" value={due} onChange={setDue} className="w-full" />
          </FormField>
        </div>
        {item.kind !== "target" ? (
          <FormField id="eiParent" label="Rolls up to">
            <SelectInput id="eiParent" value={parent} onChange={setParent}
              options={[{ v: "", l: "Nothing — it is top level" }]
                .concat(parents.map((i) => ({ v: i.itemId, l: i.title })))} />
          </FormField>
        ) : null}

        {/* The same field and the same bar as the create dialog, so a
            description reads and is written the same on both screens. */}
        <FormField id="eiDesc" label="Details" tip={<MarkBar ta={ta} value={desc} set={setDesc} />}>
          <Textarea id="eiDesc" rows={4} value={desc}
            ph="What does done look like?" onChange={setDesc} />
        </FormField>
      </FormSection>
    </ModalShell>
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
    <div className="flex flex-col gap-2">
      {lines.length ? (
        <ul className="flex flex-col divide-y divide-border-secondary rounded-xl bg-primary px-3 ring-1 ring-secondary">
          {lines.map((l) => (
            <li key={l.lineId} className="flex items-center gap-2 py-2">
              {/* THE WORDS ARE THE HIT AREA TOO — a 16px box is a hard target
                  and the text beside it is the obvious thing to press. */}
              <Checkbox
                checked={l.done}
                onChange={() => toggleCheckLine(item.itemId, l.lineId)}
                className="min-w-0 flex-1"
                label={<span className={cx(l.done && "text-quaternary line-through")}>{l.text}</span>}
              />
              <IconButton ico="x" size="xs" label={"Remove step: " + l.text}
                onClick={() => removeCheckLine(item.itemId, l.lineId)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-quaternary">No steps yet — so its progress can only be 0 or 100.</p>
      )}
      <div className="flex items-center gap-2">
        <Input value={draft} ph="Add a step" ariaLabel="Add a step" className="flex-1"
          onChange={setDraft} onEnter={add} />
        <Button color="secondary" size="sm" isDisabled={!draft.trim()} onClick={add}>Add</Button>
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
 *  The scheme is checked in the store, because `docs.google.com/…` with no
 *  scheme resolves against THIS panel's origin and 404s, which reads as a
 *  broken document rather than a typo. */
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
    <div className="flex flex-col gap-2">
      {rows.length ? (
        <ul className="flex flex-col divide-y divide-border-secondary rounded-xl bg-primary px-3 ring-1 ring-secondary">
          {rows.map((l) => (
            <li key={l.key} className="flex items-center gap-2 py-2">
              <Icon name="ext" size="sm" className="shrink-0 text-fg-quaternary" />
              <span className="flex min-w-0 flex-1 flex-col">
                {/* noreferrer as well as noopener: the target must not be
                    handed this panel's URL in its referrer. */}
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="truncate rounded text-sm font-medium text-primary outline-focus-ring hover:text-brand-secondary hover:underline focus-visible:outline-2">
                  {l.label}
                </a>
                <span className="truncate text-xs text-tertiary">{l.url}</span>
              </span>
              {l.drop ? (
                <IconButton ico="x" size="xs" label={"Remove link: " + l.label} onClick={l.drop} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-quaternary">Nothing linked yet.</p>
      )}
      {/* THE ADDRESS IS THE FIELD, AND IT LEADS. Add was disabled until BOTH
          were filled and the store then refused anything without a scheme, so
          pasting `docs.google.com/brief` — which the create dialog's own link
          field accepts — either did nothing or toasted a rule about http://.
          The name is optional here as it is there, and falls back to the host.
          Enter on either field adds, because a two-input row where only the
          button commits is a row people leave half-filled. */}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={url} ph="docs.google.com/…" ariaLabel="Link address"
          className="min-w-0 flex-1 basis-48" onChange={setUrl} onEnter={add} />
        <Input value={label} ph="Name — optional" ariaLabel="Link name"
          className="min-w-0 flex-1 basis-40" onChange={setLabel} onEnter={add} />
        <Button color="secondary" size="sm" isDisabled={!url.trim()} onClick={add}>Add</Button>
      </div>
    </div>
  );
}

/** Own tags first, then create. This is the only place in Tasks a tag is born
 *  — a separate screen would be a second entry point to a record with six
 *  fields — and it is now the only place in Tasks that can say what TYPE the
 *  new one is. The store has taken a tone since it shipped; nothing here ever
 *  passed one, so every tag made from this panel came out grey. */
function TagPicker({ item, mine, on, tags }: {
  item: WorkItem; mine: TagRecord[]; on: string[]; tags: TagRecord[];
}) {
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {mine.map((t) => {
          const isOn = on.indexOf(t.tagId) >= 0;
          return (
            <button
              key={t.tagId}
              type="button"
              aria-pressed={isOn}
              onClick={() => tagItem(item.itemId, t.tagId, !isOn)}
              className={cx(
                "cursor-pointer rounded-md p-0.5 outline-focus-ring transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2",
                isOn ? "ring-2 ring-brand" : "opacity-60 hover:opacity-100",
              )}
            >
              <Tag label={t.label} tone={t.colourToken || "slate"} />
            </button>
          );
        })}
        {mine.length ? null : <span className="text-xs text-quaternary">No tags yet.</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input value={draft} ph="New tag" ariaLabel="New tag" className="min-w-0 flex-1 basis-40"
          onChange={setDraft} onEnter={() => { if (draft.trim()) add(); }} />
        <Button color="secondary" size="sm" isDisabled={!draft.trim()} onClick={add}>Create</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tag label={draft.trim() || "Preview"} tone={tone} />
        <TagTypePicker tone={tone} onPick={setTone} />
      </div>

      {others.length ? (
        <p className="text-xs text-quaternary">{others.length} more on other members.</p>
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
    <ModalShell
      title="Waiting on"
      ico="lock"
      onClose={() => shell.closeLayer()}
      danger={item.blockedByItemId
        ? <Button color="secondary" onClick={() => save(true)}>Clear</Button>
        : undefined}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button color="primary" isDisabled={!pick} onClick={() => save()}>Save</Button>
        </>
      }
    >
      <FormSection>
        <FormField id="tmWaitOn" label="Item">
          <SelectInput id="tmWaitOn" value={pick} onChange={setPick}
            options={[{ v: "", l: "—" }].concat(options.map((i) => ({ v: i.itemId, l: i.title })))} />
        </FormField>
        <FormField id="tmWaitWhy" label="Reason" req
          hint="The stage does not move. Waiting is a relationship, not a stage.">
          <Input id="tmWaitWhy" value={why} ph="What it is waiting for." onChange={setWhy} />
        </FormField>
      </FormSection>
    </ModalShell>
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
    <ModalShell
      title="Link an item"
      ico="link"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button color="primary" isDisabled={!pick} onClick={save}>Link</Button>
        </>
      }
    >
      <FormSection>
        <FormField id="lkRel" label="Relation">
          <SelectInput id="lkRel" value={rel} onChange={(v) => setRel(v as LinkRelation)}
            options={(["relates_to", "duplicates", "follows"] as LinkRelation[])
              .map((k) => ({ v: k, l: linkLabelOf(k, true) }))} />
        </FormField>
        <FormField id="lkTo" label="Item" req
          hint="Gates nothing. A follows edge draws a sequence; it never blocks the work.">
          <SelectInput id="lkTo" value={pick} onChange={setPick}
            options={[{ v: "", l: "—" }].concat(options.map((i) => ({ v: i.itemId, l: i.title })))} />
        </FormField>
      </FormSection>
    </ModalShell>
  );
}
