/* =============================================================================
   Resources — the small shared pieces.
   -----------------------------------------------------------------------------
   Nothing here holds state or reads the store. Anything that needs either lives
   in the screen that needs it, so a piece can be read in one sitting.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, Pill, avatarTone, initials } from "../../ui";
import type { Member } from "../Team/store";
import { RESOURCE_STATE, ROW_STATE, labelOf, toneOf } from "./store";
import { fmtSize } from "./store";
import type { Answer, FieldType, FileAnswer, ResourceState, RowState } from "./store";

/* ---------------------------------------------------------------- who --- */

/** The same shape Team draws, because it is the same person. Kept as its own
 *  component rather than imported from Team/bits so this module does not reach
 *  into another module's presentation layer for a name and an avatar. */
export function Who({ m, sub }: { m: Member; sub?: ReactNode }) {
  return (
    <div className="rs-who">
      <span className={"av " + avatarTone(m.name)}>{initials(m.name)}</span>
      <span className="rs-who-t">
        <b>{m.name}</b>
        <span className="cell-2">{sub ?? m.designation}</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- status --- */

/** TAGS ARE NOT A STATUS, so they are not toned. Colour in this panel means a
 *  state — paid, overdue, pending — and a tag that borrowed it would be a word
 *  somebody typed pretending to be a signal the system understands. They read
 *  as what they are: labels, in a row, quiet. */
export function TagChips({ tags, max }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  const cap = max || tags.length;
  const shown = tags.slice(0, cap);
  const rest = tags.length - shown.length;
  return (
    <span className="rs-tags">
      {shown.map((t) => <span key={t} className="rs-tagm">{t}</span>)}
      {rest ? <span className="rs-tagm is-more" title={tags.join(", ")}>+{rest}</span> : null}
    </span>
  );
}

export function StatePill({ state }: { state: ResourceState }) {
  return <Pill text={labelOf(RESOURCE_STATE, state)} tone={toneOf(RESOURCE_STATE, state)} dot />;
}

/** Submitted or pending. `pending` has no record behind it — see the store
 *  header — so this pill is drawn from a derived state, never from a field. */
export function RowStatePill({ state }: { state: RowState }) {
  return <Pill text={labelOf(ROW_STATE, state)} tone={toneOf(ROW_STATE, state)} dot />;
}

/* --------------------------------------------------------------- meter --- */

/** Completion. The number is stated beside it in words; the bar is decoration
 *  over a figure that is already written, so it is hidden from a screen reader
 *  rather than read out twice. */
export function Meter({ pct, tone }: { pct: number; tone?: string }) {
  return (
    <span className={"rs-meter " + (tone || "")} aria-hidden="true">
      <i style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} />
    </span>
  );
}

/* --------------------------------------------------------------- answer --- */

/** ONE ANSWER, AS IT WAS GIVEN. The label comes off the response, not off the
 *  resource — that is the whole point of copying it at submit time, and reading
 *  it from the live definition here would quietly undo it. */
export function AnswerRow({ a }: { a: Answer }) {
  const empty = !String(a.value || "").trim();
  return (
    <div className="rs-answer">
      <span className="rs-answer-k">{a.label}</span>
      {a.file
        ? <FileChip f={a.file} />
        : <span className={"rs-answer-v" + (empty ? " is-empty" : "")}>
            {empty ? "—" : a.value}
          </span>}
    </div>
  );
}

/* ----------------------------------------------------------------- file --- */

const FILE_ICON = (mime: string) =>
  mime.indexOf("image/") === 0 ? "eye" : mime.indexOf("pdf") >= 0 ? "doc" : "doc";

/** WHAT CAME BACK, as something you can press. It names the file, says what it
 *  is and how big, and opens it in a new tab — a reader deciding whether a PAN
 *  card has actually arrived needs all three before they commit to a download.
 *
 *  `target="_blank"` with `rel="noreferrer"`: these are member-uploaded
 *  documents and the panel must not hand its own URL to whatever serves them. */
export function FileChip({ f }: { f: FileAnswer }) {
  return (
    <a className="rs-file-chip" href={f.url} target="_blank" rel="noreferrer"
      title={f.fileName + " · " + f.mimeType}>
      <Icon name={FILE_ICON(f.mimeType)} size="sm" />
      <span className="rs-file-n">{f.fileName}</span>
      <span className="rs-file-s tnum">{fmtSize(f.sizeKb)}</span>
      <Icon name="ext" size="sm" className="rs-file-go" />
    </a>
  );
}

/* ---------------------------------------------------------------- field --- */

const TYPE_ICON: Record<FieldType, string> = {
  text: "doc",
  textarea: "doc",
  number: "chart",
  date: "calendar",
  select: "filter",
  checkbox: "check",
  file: "download",
};

export function TypeMark({ type }: { type: FieldType }) {
  return <Icon name={TYPE_ICON[type] || "doc"} size="sm" className="rs-type" />;
}
