/* =============================================================================
   The description marks — the toolbar, and what it writes.
   -----------------------------------------------------------------------------
   SHARED, because two dialogs hold a description: the create dialog in Work.tsx
   and the edit dialog in Detail.tsx. Every button here has a branch in
   `RichText` (workBits.tsx) — a mark the parser does not know writes characters
   that render as themselves, which is worse than having no button for it.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon } from "../../ui";

/** Wrap the selection in a mark, or drop one in and put the caret inside it.
 *  The selection is restored afterwards so a second press is an undo rather
 *  than a second pair of asterisks somewhere else. */
export function wrapSel(
  ref: React.RefObject<HTMLTextAreaElement | null>, value: string,
  set: (v: string) => void, mark: string, word = "text",
) {
  const el = ref.current;
  if (!el) return;
  const a = el.selectionStart, b = el.selectionEnd;
  const sel = value.slice(a, b);
  const wrapped = sel.slice(0, mark.length) === mark && sel.slice(-mark.length) === mark;
  const next = wrapped ? sel.slice(mark.length, -mark.length) : mark + (sel || word) + mark;
  set(value.slice(0, a) + next + value.slice(b));
  requestAnimationFrame(() => {
    el.focus();
    const from = wrapped ? a : a + mark.length;
    el.setSelectionRange(from, from + (wrapped ? next.length : (sel || "bold").length));
  });
}

/** Toggle "- " on every line the selection touches, whole lines at a time. */
/** A MARK ON EVERY LINE THE SELECTION TOUCHES, AND PRESSING IT AGAIN TAKES IT
 *  OFF. One function for all three list marks, because they differ only in what
 *  goes in front of a line — and a numbered list differs again only in that the
 *  thing in front counts. */
type LineMark = "bullet" | "number" | "check";

/* Checklist is tested and stripped FIRST: `- [ ] x` satisfies the bullet
   pattern too, and it is the more specific of the two. */
const LINE_RE: Record<LineMark, RegExp> = {
  check: /^\s*[-*]\s+\[[ xX]\]\s+/,
  number: /^\s*\d+[.)]\s+/,
  bullet: /^\s*[-*]\s+/,
};
const MARKS: LineMark[] = ["check", "number", "bullet"];
const markFor = (k: LineMark, n: number) =>
  k === "number" ? n + ". " : k === "check" ? "- [ ] " : "- ";

function lineSel(
  ref: React.RefObject<HTMLTextAreaElement | null>, value: string,
  set: (v: string) => void, kind: LineMark,
) {
  const el = ref.current;
  if (!el) return;
  const a = value.lastIndexOf("\n", Math.max(0, el.selectionStart - 1)) + 1;
  const end = value.indexOf("\n", el.selectionEnd);
  const b = end < 0 ? value.length : end;
  const lines = (value.slice(a, b) || "item").split("\n");
  /* On means EVERY line already carries this mark — one unmarked line in the
     block means the press is meant to mark the block, not clear it. A
     checklist line is not a bulleted line for this test, or Checklist could
     never be turned off. */
  const on = lines.every((l) => (kind === "bullet" ? !LINE_RE.check.test(l) : true)
    && LINE_RE[kind].test(l));
  /* Strip whatever mark IS there before adding the new one: pressing Numbered
     on a bulleted line should renumber it, not write "1. - line". */
  const bare = lines.map((l) => {
    for (const k of MARKS) if (LINE_RE[k].test(l)) return l.replace(LINE_RE[k], "");
    return l;
  });
  const next = (on ? bare : bare.map((l, i) => markFor(kind, i + 1) + l)).join("\n");
  set(value.slice(0, a) + next + value.slice(b));
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + next.length, a + next.length); });
}

/** A LINK IS TWO THINGS AND A SELECTION IS ONLY EVER ONE OF THEM. Selected text
 *  becomes the label and the caret lands after `https://`, which is the half
 *  that still has to be pasted. With nothing selected both halves are
 *  placeholders and the label is what comes up selected, because that is the
 *  half you would type first. */
function linkSel(
  ref: React.RefObject<HTMLTextAreaElement | null>, value: string, set: (v: string) => void,
) {
  const el = ref.current;
  if (!el) return;
  const a = el.selectionStart, b = el.selectionEnd;
  const sel = value.slice(a, b);
  const label = sel || "the brief";
  const next = "[" + label + "](https://)";
  set(value.slice(0, a) + next + value.slice(b));
  const from = sel ? a + next.length - 1 : a + 1;
  const to = sel ? a + next.length - 1 : a + 1 + label.length;
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(from, to); });
}

/** THE MARKS, IN ONE PLACE AND ON BOTH SCREENS.
 *
 *  Every button here has a branch in `RichText` — a mark the parser does not
 *  know writes characters that render as themselves, which is worse than
 *  having no button for it. The bar was two of these, bold and bullets, on the
 *  one dialog that could set a description at all.
 *
 *  `onMouseDown` is stopped rather than the click: pressing a button blurs the
 *  textarea, and the selection the mark is supposed to wrap goes with it. */
export function MarkBar({ ta, value, set }: {
  ta: React.RefObject<HTMLTextAreaElement | null>;
  value: string; set: (v: string) => void;
}) {
  const b = (title: string, on: () => void, kid: ReactNode) => (
    <button type="button" className="tm-rt-b" title={title} aria-label={title}
      onMouseDown={(e) => e.preventDefault()} onClick={on}>{kid}</button>
  );
  return (
    <span className="tm-rt-bar">
      {b("Bold", () => wrapSel(ta, value, set, "**", "bold"), <b>B</b>)}
      {b("Italic", () => wrapSel(ta, value, set, "_", "italic"), <i className="tm-rt-i">I</i>)}
      {b("Bulleted list", () => lineSel(ta, value, set, "bullet"), <Icon name="menu" size="sm" />)}
      {b("Numbered list", () => lineSel(ta, value, set, "number"), <span className="tm-rt-n">1.</span>)}
      {b("Checklist", () => lineSel(ta, value, set, "check"), <Icon name="check" size="sm" />)}
      {b("Link", () => linkSel(ta, value, set), <Icon name="link" size="sm" />)}
    </span>
  );
}
