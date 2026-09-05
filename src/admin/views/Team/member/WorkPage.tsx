/* =============================================================================
   /team/:id/work — their tasks, milestones and targets, plus their own tags.
   -----------------------------------------------------------------------------
   THE SAME THREE BLOCKS AS THE CALENDAR RAIL, in the same order, from the same
   four functions. Tasks first, then milestones, then targets: that is the order
   somebody works in — the task is what you do today, the milestone is what the
   tasks add up to, the target is the number the quarter is judged on. Reading
   down the page you zoom out, and the block you can act on is the one you reach
   first.

   Three surfaces computed progress their own way once, and that is exactly how
   a roll-up came to print two typed percentages its own children disagreed
   with. Progress is `completed children ÷ total` for a milestone and
   `currentValue ÷ targetValue` for a target, derived at read. Nothing is typed.

   THE TAG MANAGER IS HERE and only for the owner. A tag is a record somebody
   owns; two members may both hold "Client call" and neither can rename or
   delete the other's.
   ============================================================================= */
import { Icon, Notice, Table } from "../../../ui";
import { go } from "../../../ui/nav";
import { useShell } from "../../../shell/ShellContext";
import {
  TAG_CAP, VOCAB, archiveTag, fmtDate, readItems, restoreTag, setTagTone, tagsOwnedBy, useTags,
} from "../store";
import type { Member, Tag } from "../store";
import { MarksBlock, TasksBlock } from "../workBits";
import type { Viewer } from "./ops";
import { OpHead, workHref } from "./frame";
import { NewTagModal, RenameTagModal } from "./modals";

const openItem = (id: string) => go("#/work?item=" + id);

export default function WorkPage({ m, viewer }: { m: Member; viewer: Viewer }) {
  return (
    <>
      <OpHead
        title="Work"
        desc="Tasks, then milestones, then targets. Every bar is derived from its own children — nothing on this page was typed."
        right={<button className="btn" onClick={() => go(workHref(m.memberId))}>
          <Icon name="calendar" size="sm" />Open their board
        </button>} />

      <div className="tm-cols3">
        <TasksBlock who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="milestone" who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="target" who={m.memberId} onOpen={openItem} />
      </div>

      {viewer === "self" ? <TagManager m={m} /> : <TheirTags m={m} />}
    </>
  );
}

const tagCount = (t: Tag) =>
  readItems().filter((i) => (i.tagIds || []).indexOf(t.tagId) >= 0).length;

/** The owner's own list: rename, retone, archive, restore, and a soft cap of
 *  twenty that warns and never blocks. ARCHIVE, NOT DELETE — a delete would
 *  either strip the tag from finished items, rewriting what a completed task
 *  was filed under, or leave ids pointing at nothing. */
function TagManager({ m }: { m: Member }) {
  const shell = useShell();
  useTags();
  const mine = tagsOwnedBy(m.memberId, true);
  const active = mine.filter((t) => !t.archivedAt);
  const act = (r: { ok: boolean } & { message?: string }) => {
    if (!r.ok) shell.toast((r as { message: string }).message, "bad");
  };

  return (
    <>
      <div className="sh">
        <h2>Their tags</h2>
        <span className="d">
          {active.length} of {TAG_CAP}. A count here is their own items — a board groups by name
          across everybody, so its column may read higher. Two numbers, both right.
        </span>
        <span className="r">
          <button className="btn sm" onClick={() => shell.modal(<NewTagModal ownerId={m.memberId} />, "sm")}>
            <Icon name="plus" size="sm" />New tag
          </button>
        </span>
      </div>

      {active.length >= TAG_CAP ? (
        <Notice tone="warn" text={"Past " + TAG_CAP + " tags they stop being findable. Nothing blocks — archive what is finished."} />
      ) : null}

      <Table
        cols={[{ label: "Tag" }, { label: "On", w: "90px", cls: "n" },
          { label: "Tone", w: "160px" }, { label: "", w: "220px" }]}
        empty={{
          icon: "tag", title: "No tags yet",
          body: "The first one is a keystroke away, here or from the item drawer.",
        }}
        rows={mine.map((t) => (
          <tr key={t.tagId} className={t.archivedAt ? "dim" : ""}>
            <td>
              <span className={"pill xs tag-" + (t.colourToken || "slate")}>{t.label}</span>
              {t.archivedAt
                ? <span className="cell-2">archived {fmtDate(t.archivedAt.slice(0, 10))}</span>
                : null}
            </td>
            <td className="n tnum">{tagCount(t)}</td>
            <td>
              {t.archivedAt ? <span className="dim">—</span> : (
                <select className="inp sm" value={t.colourToken || "slate"}
                  aria-label={"Tone for " + t.label}
                  onChange={(e) => act(setTagTone(t.tagId, e.target.value))}>
                  {(VOCAB.tagTones as { key: string; label: string }[]).map((o) =>
                    <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              )}
            </td>
            <td>
              {t.archivedAt ? (
                <button className="btn sm" onClick={() => act(restoreTag(t.tagId))}>Restore</button>
              ) : (
                <>
                  <button className="btn sm" onClick={() => shell.modal(<RenameTagModal t={t} />, "sm")}>Rename…</button>
                  <button className="btn sm" onClick={() => act(archiveTag(t.tagId))}>Archive</button>
                </>
              )}
            </td>
          </tr>
        ))} />
    </>
  );
}

/** Somebody else's tags are readable and nothing more. There is no admin
 *  override: member-owned means member-owned, and there is no company owner to
 *  hang a replacement on. */
function TheirTags({ m }: { m: Member }) {
  useTags();
  const mine = tagsOwnedBy(m.memberId);
  return (
    <>
      <div className="sh">
        <h2>Their tags</h2>
        <span className="d">Records they own. Nobody else may rename, retone or archive one.</span>
      </div>
      <div className="tm-tagrow">
        {mine.length ? mine.map((t) => (
          <span key={t.tagId} className={"pill xs tag-" + (t.colourToken || "slate")}>
            {t.label}<span className="dim"> {tagCount(t)}</span>
          </span>
        )) : <span className="dim">None yet.</span>}
      </div>
    </>
  );
}
