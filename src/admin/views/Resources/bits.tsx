/* =============================================================================
   Data Forms — the small drawings this module owns.
   -----------------------------------------------------------------------------
   Nothing here holds state or reads the store. Anything that needs either lives
   in the screen that needs it, so a piece can be read in one sitting.

   Everything is composed from `../../ui` on the semantic tokens — a file chip,
   an answer row and a field card are module-local DRAWINGS, which is exactly
   what a bits file is for; none of them is a second Button, Badge or Table.
   ============================================================================= */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Icon, IconButton, Meter as UiMeter, Person, Pill, Tag, Tags } from "../../ui";
import type { Member } from "../Team/store";
import { RESOURCE_STATE, ROW_STATE, labelOf, toneOf, typeLabel } from "./store";
import { fmtSize } from "./store";
import type { Answer, FieldType, FileAnswer, ResourceField, ResourceState, RowState } from "./store";

/* ---------------------------------------------------------------- who --- */

/** The same object every other screen draws a person with. It stays a named
 *  component rather than an inline `Person` so the module has one place to
 *  decide what a member's second line says. */
export function Who({ m, sub }: { m: Member; sub?: ReactNode }) {
    return <Person name={m.name} sub={sub ?? m.designation} sm />;
}

/* -------------------------------------------------------------- status --- */

/** TAGS ARE NOT A STATUS, so they are square and untoned. Colour in this panel
 *  means a state — open, pending, overdue — and a tag that borrowed it would be
 *  a word somebody typed pretending to be a signal the system understands. */
export function TagChips({ tags, max }: { tags: string[]; max?: number }) {
    if (!tags.length) return null;
    return <Tags items={tags.map((t) => ({ label: t }))} max={max} />;
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
    const t = tone === "ok" || tone === "warn" || tone === "bad" ? tone : undefined;
    return (
        <span aria-hidden="true" className="block w-full min-w-24">
            <UiMeter value={Math.max(0, Math.min(100, pct))} tone={t} />
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
        <div className="grid grid-cols-1 gap-1 border-b border-secondary py-2.5 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[minmax(8rem,13rem)_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-tertiary">{a.label}</dt>
            <dd className="min-w-0">
                {a.file ? (
                    <FileChip f={a.file} />
                ) : (
                    <span className={cx("text-sm [overflow-wrap:anywhere]", empty ? "text-quaternary" : "text-primary")}>{empty ? "—" : a.value}</span>
                )}
            </dd>
        </div>
    );
}

/* ----------------------------------------------------------------- file --- */

const FILE_ICON = (mime: string) => (mime.indexOf("image/") === 0 ? "image" : mime.indexOf("pdf") >= 0 ? "doc" : "file");

/** WHAT CAME BACK, as something you can press. It names the file, says what it
 *  is and how big, and opens it in a new tab — a reader deciding whether a PAN
 *  card has actually arrived needs all three before they commit to a download.
 *
 *  `target="_blank"` with `rel="noreferrer"`: these are member-uploaded
 *  documents and the panel must not hand its own URL to whatever serves them. */
export function FileChip({ f }: { f: FileAnswer }) {
    return (
        <a
            className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-xs font-medium text-secondary ring-1 ring-secondary outline-focus-ring transition duration-100 ring-inset hover:bg-primary_hover hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
            href={f.url}
            target="_blank"
            rel="noreferrer"
            title={f.fileName + " · " + f.mimeType}
        >
            <Icon name={FILE_ICON(f.mimeType)} size="xs" className="shrink-0 text-fg-quaternary" />
            <span className="truncate">{f.fileName}</span>
            <span className="shrink-0 font-mono text-quaternary tnum">{fmtSize(f.sizeKb)}</span>
            <Icon name="ext" size="xs" className="shrink-0 text-fg-quaternary" />
        </a>
    );
}

/** A row of them, wrapping rather than stretching a table cell to six lines. */
export function FileChips({ answers }: { answers: Answer[] }) {
    return (
        <span className="flex flex-wrap items-center gap-1">
            {answers.map((a) => (a.file ? <FileChip key={a.fieldId} f={a.file} /> : null))}
        </span>
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
    return <Icon name={TYPE_ICON[type] || "doc"} size="sm" className="text-fg-quaternary" />;
}

/** The KIND of a field is a label, not a state — square, untoned. */
export function KindTag({ type }: { type: FieldType }) {
    return <Tag label={typeLabel(type)} />;
}

/* ------------------------------------------------------------ field card -- */

/** A FIELD, AS A ROW ON THE LIST. The number is its position and the position is
 *  real information: it is the order the member meets the questions in, and
 *  moving one is a thing people do. Pressing the row opens its editor; the two
 *  arrows and the bin never do, so a mis-press cannot be destructive. */
export function FieldCard({
    f,
    i,
    n,
    on,
    onOpen,
    onMove,
    onRemove,
}: {
    f: ResourceField;
    i: number;
    n: number;
    on?: boolean;
    onOpen: () => void;
    onMove: (by: number) => void;
    onRemove: () => void;
}) {
    return (
        <li>
            <div
                className={cx(
                    "flex items-center gap-2 rounded-xl bg-primary p-2.5 shadow-xs ring-1 transition duration-100 sheen",
                    on ? "ring-2 ring-brand" : "ring-secondary hover:ring-primary",
                )}
            >
                <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-current={on ? "true" : undefined}
                    onClick={onOpen}
                >
                    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-2xs font-semibold text-tertiary tnum">
                        {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className={cx("truncate text-sm font-medium", f.label ? "text-primary" : "text-quaternary italic")}>{f.label || "Unnamed field"}</span>
                        <span className="flex flex-wrap items-center gap-1">
                            <KindTag type={f.type} />
                            {f.required ? <Pill xs tone="warn" text="Required" /> : null}
                            {f.type === "select" && !f.options.length ? <Pill xs tone="bad" text="No options" /> : null}
                        </span>
                    </span>
                </button>
                <span className="flex shrink-0 items-center gap-0.5">
                    <IconButton size="xs" ico="chevu" label={"Move field " + (i + 1) + " up"} isDisabled={i === 0} onClick={() => onMove(-1)} />
                    <IconButton size="xs" ico="chev" label={"Move field " + (i + 1) + " down"} isDisabled={i === n - 1} onClick={() => onMove(1)} />
                    <IconButton size="xs" ico="trash" label={"Remove field " + (i + 1)} onClick={onRemove} />
                </span>
            </div>
        </li>
    );
}

/* ----------------------------------------------------------- suggestions -- */

/** The words already in use, offered back so the same idea is not spelled three
 *  ways. A suggestion already taken is clutter, so the caller filters it out. */
export function Suggestions({ label, items, onPick }: { label: string; items: string[]; onPick: (v: string) => void }) {
    if (!items.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-mono">{label}</span>
            {items.map((t) => (
                <button
                    key={t}
                    type="button"
                    className="cursor-pointer rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary ring-1 ring-secondary outline-focus-ring transition duration-100 ring-inset hover:bg-primary_hover hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
                    onClick={() => onPick(t)}
                >
                    + {t}
                </button>
            ))}
        </div>
    );
}
