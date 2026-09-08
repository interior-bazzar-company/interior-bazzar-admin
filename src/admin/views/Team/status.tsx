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
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import { Icon, ModalHead, Pill } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import { useMenuPlacement } from "../../ui/menu";
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
    <>
      <ModalHead title={title} onClose={() => shell.closeLayer()} />
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

export function StatusPicker({ item, sm }: { item: WorkItem; sm?: boolean }) {
  const shell = useShell();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  const pop = useRef<HTMLSpanElement | null>(null);
  const { style } = useMenuPlacement(open, box, pop, "left");

  const stage = stageOf(item);
  const moves = transitionsFrom(item.status);
  /* Derived, so the chip and the menu are talking about two different things
     and the menu has to say which. */
  const derived = stage !== item.status;

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
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  const move = (to: WorkStatus, reason?: string) => {
    const r = setItemStatus(item.itemId, to, reason);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast(item.title + " is now " + labelOf(WORK_STATUS, to).toLowerCase() + ".");
  };

  const pick = (t: { to: WorkStatus; requiresReason: boolean; label: string }) => {
    setOpen(false);
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
    <span className="ib-menu tm-st" ref={box}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}>
      <button className={"tm-st-b" + (sm ? " sm" : "")} aria-haspopup="menu" aria-expanded={open}
        aria-label={"Status: " + labelOf(WORK_STATUS, stage) + ". Change it."}
        onClick={() => setOpen((o) => !o)}>
        <Pill text={labelOf(WORK_STATUS, stage)} tone={toneOf(WORK_STATUS, stage)} />
        <Icon name="chev" size="sm" />
      </button>
      {open ? (
        <span ref={pop} className="ib-menu-pop tm-st-p" role="menu" aria-label="Change status"
          style={style}>
          {derived ? (
            <span className="tm-st-n">
              Delay is read from the due date. Stored: <b>{labelOf(WORK_STATUS, item.status)}</b>
            </span>
          ) : null}
          {moves.map((t) => (
            <button key={t.to} role="menuitem" className="mi" onClick={() => pick(t)}>
              <span className={"dot " + (toneOf(WORK_STATUS, t.to) || "idle")} />
              {t.label}
              {t.requiresReason ? <span className="r tm-st-r">needs a reason</span> : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
