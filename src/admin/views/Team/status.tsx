/* =============================================================================
   The status control — one chip, and the moves it is actually allowed.
   -----------------------------------------------------------------------------
   IT IS THE SAME CONTROL ON THE ROW AND IN THE PANEL. A status you can change
   in one place and only read in another is a status people go looking for, and
   the two would drift the moment either grew a rule. So this is one component
   with one behaviour, rendered at two sizes.

   THE MOVES COME FROM THE STORE, NEVER FROM HERE. `transitionsFrom` reads the
   same vocabulary row `setItemStatus` enforces with, so the menu cannot offer
   something the store will refuse. The drawer's old footer hard-coded its
   buttons and had no branch for cancelled -> planned, which made a cancelled
   item a dead end the store would happily have let out of.

   DELAY IS DERIVED AND HAS NO MOVES OF ITS OWN. The chip shows the stage a
   reader sees — Delay, when the date has passed — while the menu offers what
   the STORED status allows, and says so, because otherwise the menu looks
   broken: you opened "Delay" and were offered "Complete".

   THE POPUP IS THE LIBRARY'S. It used to position itself against its own
   button and listen for scroll, resize, Escape and an outside press by hand;
   React Aria's Menu does all four, portals out of any scrolling table body, and
   is keyboard-complete without a line of it here.
   ============================================================================= */
import { useState } from "react";
import { ChevronDown } from "@untitledui/icons";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Button, FormField, ModalShell, Pill, Textarea } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import {
  WORK_STATUS, labelOf, setItemStatus, stageOf, toneOf, transitionsFrom,
} from "./store";
import type { WorkItem, WorkStatus } from "./store";

/** Every transition that changes what a reader would conclude asks for a
 *  sentence. A cancellation with no reason cannot answer the question it will
 *  be asked. */
export function ReasonModal({ title, onSubmit }: {
  title: string; onSubmit: (reason: string) => void;
}) {
  const shell = useShell();
  const [v, setV] = useState("");
  return (
    <ModalShell
      title={title}
      ico="note"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button isDisabled={!v.trim()} onClick={() => onSubmit(v)}>Save</Button>
        </>
      }
    >
      <FormField id="tmReason" label="Reason" req hint="Stored on the item and shown wherever its stage is.">
        <Textarea id="tmReason" rows={3} autoFocus value={v} onChange={setV} />
      </FormField>
    </ModalShell>
  );
}

/** The dot beside a move, so the menu says what colour the item becomes. */
const DOT: Record<string, string> = {
  ok: "bg-utility-green-500",
  warn: "bg-utility-yellow-500",
  bad: "bg-utility-red-500",
  info: "bg-utility-blue-500",
  neutral: "bg-utility-neutral-400",
};

export function StatusPicker({ item, sm }: { item: WorkItem; sm?: boolean }) {
  const shell = useShell();

  const stage = stageOf(item);
  const moves = transitionsFrom(item.status);
  /* Derived, so the chip and the menu are talking about two different things
     and the menu has to say which. */
  const derived = stage !== item.status;

  const move = (to: WorkStatus, reason?: string) => {
    const r = setItemStatus(item.itemId, to, reason);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast(item.title + " is now " + labelOf(WORK_STATUS, to).toLowerCase() + ".");
  };

  const pick = (t: { to: WorkStatus; requiresReason: boolean; label: string }) => {
    if (!t.requiresReason) { move(t.to); return; }
    shell.modal(
      <ReasonModal title={t.label + " this item"}
        onSubmit={(reason) => { shell.closeLayer(); move(t.to, reason); }} />,
      "sm",
    );
  };

  /* NOTHING TO OFFER IS NOT A BUTTON. Every stored status has at least one move
     today, but a vocabulary is data and a row could lose its last one; a chip
     that opens an empty menu is worse than a chip that plainly does not open. */
  if (!moves.length) return <Pill text={labelOf(WORK_STATUS, stage)} tone={toneOf(WORK_STATUS, stage)} />;

  return (
    /* `stopPropagation` on the wrapper: this sits inside a row that is itself a
       link to the record, and changing a status must not also open the drawer
       behind the menu you are reading. */
    <span
      className="inline-flex"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
    >
      <Dropdown.Root>
        <Button
          color="tertiary"
          size="xs"
          iconTrailing={ChevronDown}
          className="-mx-1 gap-1.5 px-1 py-0.5"
          aria-haspopup="menu"
          aria-label={"Status: " + labelOf(WORK_STATUS, stage) + ". Change it."}
        >
          <Pill xs={sm} text={labelOf(WORK_STATUS, stage)} tone={toneOf(WORK_STATUS, stage)} />
        </Button>
        <Dropdown.Popover placement="bottom left" className="w-max min-w-52">
          {derived ? (
            <p className="border-b border-secondary px-3 py-2 text-xs text-tertiary">
              Delay is read from the due date. Stored: <b className="font-medium text-secondary">{labelOf(WORK_STATUS, item.status)}</b>
            </p>
          ) : null}
          <Dropdown.Menu aria-label="Change status">
            {moves.map((t) => (
              <Dropdown.Item
                key={t.to}
                id={t.to}
                addon={t.requiresReason ? "needs a reason" : undefined}
                onAction={() => pick(t)}
                icon={() => (
                  <span data-icon className={"mx-0.5 size-2 shrink-0 rounded-full " + (DOT[toneOf(WORK_STATUS, t.to)] || DOT.neutral)} />
                )}
                label={t.label}
              />
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </span>
  );
}
