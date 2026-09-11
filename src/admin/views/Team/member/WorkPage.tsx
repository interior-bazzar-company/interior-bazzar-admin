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
import { Alert, Button, ListTable, SelectInput, Tag } from "../../../ui";
import { go } from "../../../ui/nav";
import { useShell } from "../../../shell/ShellContext";
import {
  TAG_CAP, VOCAB, archiveTag, fmtDate, readItems, restoreTag, setTagTone, tagsOwnedBy, useTags,
} from "../store";
import type { Member, Tag as TagRecord } from "../store";
import { MarksBlock, TasksBlock } from "../workBits";
import type { Viewer } from "./ops";
import { OpHead, workHref } from "./frame";
import { NewTagModal, RenameTagModal } from "./modals";

const openItem = (id: string) => go("#/work?item=" + id);

export default function WorkPage({ m, viewer }: { m: Member; viewer: Viewer }) {
  return (
    <div className="flex flex-col gap-5">
      <OpHead
        title="Work"
        desc="What is assigned, then milestones, then targets. Every bar is derived from its own children — nothing on this page was typed."
        right={
          <Button color="secondary" ico="calendar" onClick={() => go(workHref(m.memberId))}>
            Open their board
          </Button>
        } />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TasksBlock who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="milestone" who={m.memberId} onOpen={openItem} />
        <MarksBlock kind="target" who={m.memberId} onOpen={openItem} />
      </div>

      {viewer === "self" ? <TagManager m={m} /> : <TheirTags m={m} />}
    </div>
  );
}

const tagCount = (t: TagRecord) =>
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
  const tones = (VOCAB.tagTones as { key: string; label: string }[]).map((o) => ({ v: o.key, l: o.label }));
  const act = (r: { ok: boolean } & { message?: string }) => {
    if (!r.ok) shell.toast((r as { message: string }).message, "bad");
  };

  return (
    <section className="flex flex-col">
      <OpHead
        title="Their tags"
        desc={active.length + " of " + TAG_CAP + ". A count here is their own items — a board groups by name "
          + "across everybody, so its column may read higher. Two numbers, both right."}
        right={
          <Button color="secondary" size="xs" ico="plus"
            onClick={() => shell.modal(<NewTagModal ownerId={m.memberId} />, "sm")}>
            New tag
          </Button>
        } />

      {active.length >= TAG_CAP ? (
        <Alert tone="warn" className="mb-3">
          Past {TAG_CAP} tags they stop being findable. Nothing blocks — archive what is finished.
        </Alert>
      ) : null}

      <ListTable min="44rem" head={<tr>
        <th scope="col">Tag</th>
        <th scope="col" className="n">On</th>
        <th scope="col">Tone</th>
        <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
      </tr>}>
        {mine.map((t) => (
          <tr key={t.tagId}>
            <td>
              <Tag label={t.label} tone={t.colourToken || "slate"} />
              {t.archivedAt
                ? <span className="block cell-2 tnum">archived {fmtDate(t.archivedAt.slice(0, 10))}</span>
                : null}
            </td>
            <td className="n">{tagCount(t)}</td>
            <td>
              {t.archivedAt ? <span className="text-quaternary">—</span> : (
                <SelectInput
                  options={tones}
                  value={t.colourToken || "slate"}
                  ariaLabel={"Tone for " + t.label}
                  onChange={(v) => act(setTagTone(t.tagId, v))}
                />
              )}
            </td>
            <td className="acts">
              <span className="inline-flex items-center gap-2">
                {t.archivedAt ? (
                  <Button color="secondary" size="xs" ico="undo" onClick={() => act(restoreTag(t.tagId))}>Restore</Button>
                ) : (
                  <>
                    <Button color="secondary" size="xs" onClick={() => shell.modal(<RenameTagModal t={t} />, "sm")}>Rename…</Button>
                    <Button color="secondary" size="xs" ico="archive" onClick={() => act(archiveTag(t.tagId))}>Archive</Button>
                  </>
                )}
              </span>
            </td>
          </tr>
        ))}
        {mine.length ? null : (
          <tr>
            <td colSpan={4} className="p-0!">
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-primary">No tags yet</p>
                <p className="mt-1 text-sm text-tertiary">The first one is a keystroke away, here or from the item drawer.</p>
              </div>
            </td>
          </tr>
        )}
      </ListTable>
    </section>
  );
}

/** Somebody else's tags are readable and nothing more. There is no admin
 *  override: member-owned means member-owned, and there is no company owner to
 *  hang a replacement on. */
function TheirTags({ m }: { m: Member }) {
  useTags();
  const mine = tagsOwnedBy(m.memberId);
  return (
    <section className="flex flex-col">
      <OpHead title="Their tags" desc="Records they own. Nobody else may rename, retone or archive one." />
      <div className="flex flex-wrap items-center gap-1.5">
        {mine.length ? mine.map((t) => (
          <Tag key={t.tagId} tone={t.colourToken || "slate"}
            label={<>{t.label} <span className="opacity-60 tnum">{tagCount(t)}</span></>} />
        )) : <span className="text-sm text-quaternary">None yet.</span>}
      </div>
    </section>
  );
}
