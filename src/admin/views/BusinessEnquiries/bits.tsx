/* =============================================================================
   Business Enquiries — the small render pieces every screen in the module
   shares. Kept here rather than in ui/ because none of them is general: a
   status pill that reads the module's own vocabulary, a candidate card that
   only means anything beside a ranked business, a lifecycle dot ramp with nine
   fixed steps and an off-ramp the shared `Pipeline` cannot express.

   Everything below is composed from `admin/ui` and Tailwind utilities on the
   semantic tokens. There is no stylesheet in this module any more.
   ============================================================================= */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { InputBase } from "@/components/base/input/input";
import {
  Alert, Button, FormField, Icon, iconOf, InfoDot as UiInfoDot, Input, KvList, LeadStatus, Meter,
  Pill, Priority, Tag, Tags,
} from "../../ui";
import { BarRows } from "../charts";
import {
  CHANNELS, CONTACT_OUTCOMES, RULES, STATUSES, ageLabel, channelOf, contactOutcomeOf,
  dateTimeLabel, findBusinesses, sourceOf, statusOf, tagOf, tierOf, urgencyOf, viaLabel,
} from "./store";
import type { Business, Candidate, ContactEntry, Enquiry } from "./store";

/* ------------------------------------------------------------- the card --- */
/* ONE DRAWING FOR A BUSINESS ON OFFER, wherever it is offered: the ranked
   suggestions, and the hand search that stands in for them when nothing ranked.
   The two used to be near-copies, and the copy is where they would start
   disagreeing about what "eligible" looks like. */
export function CandidateCard({ rank, name, sub, score, top, why, foot, actions, children }: {
  rank?: number | null;
  name: ReactNode;
  sub?: ReactNode;
  /** 0–100, already decided by the server. Absent on an unranked candidate. */
  score?: number | null;
  top?: boolean;
  why?: ReactNode;
  foot?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-lg bg-primary p-3 ring-1 transition duration-100",
        top ? "ring-brand" : "ring-secondary hover:ring-primary",
      )}
    >
      <div className="flex items-start gap-2.5">
        {typeof rank === "number" ? (
          <span
            aria-hidden="true"
            className={cx(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tnum ring-1 ring-inset",
              top ? "bg-brand-solid text-white ring-brand-solid" : "bg-secondary text-secondary ring-secondary",
            )}
          >
            {rank}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-primary">{name}</div>
          {sub ? <div className="mt-0.5 truncate text-xs text-tertiary">{sub}</div> : null}
        </div>
        {typeof score === "number" ? (
          <span className="shrink-0 text-lg font-semibold text-primary tnum" aria-label={score + " of 100"}>
            {score}
          </span>
        ) : null}
      </div>

      {typeof score === "number" ? <ScoreBar score={score} top={top} /> : null}
      {why ? <p className="text-xs text-tertiary">{why}</p> : null}

      {foot || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {foot ? <span className="text-xs text-quaternary">{foot}</span> : null}
          <span className="flex-1" />
          {actions}
        </div>
      ) : null}

      {children}
    </div>
  );
}

/* ---------------------------------------------------------- the search --- */
/* FINDING A BUSINESS BY HAND, for the two places the engine can leave you with
   nothing to pick from: assigning an enquiry no run could rank, and reassigning
   one where the only other candidate was the business you are moving away from.
   Both are the same situation — real work, a business that can obviously take
   it, and no list offering it — and both used to dead-end in a red notice.

   ONE COMPONENT because they are one question. The alternative was a second
   copy in Modals.tsx, and the copy is where the two would start disagreeing
   about what "eligible" means on screen.

   A REQUEST, not a local filter, and only once something is typed — see
   `findBusinesses`. And it is a SEARCH, not a ranking: alphabetical, no score,
   and the only claims made about a business are what its own profile says.
   Anything more would be a matching engine written in a dialog, which is the
   one thing this module refuses to have. */
export function BusinessSearch({ excludeId, action, onPick, picked }: {
  /** The business this cannot offer — the one already holding the enquiry.
   *  Reassigning to the current holder is not a reassignment. */
  excludeId?: string | null;
  /** What the button on each row says. The two callers do different things
   *  with the pick: one opens the assign dialog, one selects into a form. */
  action: string;
  onPick: (b: Business) => void;
  /** Highlighted as chosen, for the caller that selects rather than acts. */
  picked?: string | null;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Business[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  /* NOTHING IS FETCHED UNTIL SOMETHING IS TYPED, and the wait is what makes
     that true rather than nearly true: a request per keystroke would ask the
     server about "s", "sh", "sha" and "shah" to answer one question. The timer
     is cleared on every change, so only the query somebody stopped typing is
     ever sent.

     `live` guards the ORDER, not the count. Two searches can be in flight and
     the slower one must not land last and repaint the list with results for a
     query nobody is looking at any more. */
  useEffect(() => {
    const needle = q.trim();
    if (!needle) { setHits([]); setState("idle"); return; }
    let live = true;
    setState("loading");
    const timer = window.setTimeout(() => {
      findBusinesses(needle)
        .then((rows) => { if (live) { setHits(rows); setState("done"); } })
        .catch(() => { if (live) { setHits([]); setState("error"); } });
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [q]);

  const rows = hits.filter((b) => b.businessId !== excludeId);

  return (
    <div className="flex flex-col gap-3">
      <FormField
        id={"be-bsearch-" + action}
        label="Find a business"
        hint="No ranking and no score — alphabetical, and the only claims made about a business are what its own profile says."
      >
        <Input id={"be-bsearch-" + action} value={q} ph="Name, category or city…" icon="search" onChange={setQ} />
      </FormField>

      {rows.map((b) => (
        <CandidateCard
          key={b.businessId}
          name={b.name}
          top={picked === b.businessId}
          sub={
            <>
              {b.plan || "no plan"} · {b.subscription}
              {b.serviceArea.length ? " · " + b.serviceArea.join(", ") : ""}
            </>
          }
          why={
            b.categories.length
              ? b.categories.join(", ")
              : "No categories on this profile — matching could never have found it."
          }
          /* The same figure the assign dialog rechecks at confirmation — and
             the server rechecks again on the write. Shown here so an obviously
             full business is visible before you commit to it, never instead of
             the check. */
          foot={<>{b.capacity.active} of {b.capacity.configured} this {b.capacity.period}</>}
          actions={
            <Button color={picked === b.businessId ? "primary" : "secondary"} size="xs" onClick={() => onPick(b)}>
              {picked === b.businessId ? "Chosen" : action}
            </Button>
          }
        />
      ))}

      {/* Four states, and they are four different things. "Type to search" is
          not an empty result, and an empty result is not a failed request. */}
      {state === "idle" ? <PanelNote>Type a name, a category or a city to search.</PanelNote> : null}
      {state === "loading" ? <PanelNote>Searching…</PanelNote> : null}
      {state === "done" && !rows.length ? <PanelNote>No business matches “{q.trim()}”.</PanelNote> : null}
      {state === "error" ? <PanelNote>The search did not reach the server. Try again.</PanelNote> : null}
    </div>
  );
}

/* A quiet line inside a panel — a state that is neither a result nor an error.
   Not an `EmptyState`: that is a whole band with a frame, and these sit inside
   one that already has an edge. */
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-secondary px-3 py-2.5 text-sm text-tertiary">{children}</p>
  );
}

/* A DISCLOSURE THAT COSTS ONE LINE until it is opened. This module folds three
   things away — the factor breakdown, the exclusion diagnostics and the hand
   search — and they are folded in a panel and in a dialog, so the control is
   here rather than copied into both. */
export function Disclose({ open, onToggle, children }: {
  open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <Button
      color="link-color"
      size="sm"
      aria-expanded={open}
      iconTrailing={iconOf(open ? "chev" : "chevr")}
      onClick={onToggle}
    >
      {children}
    </Button>
  );
}

/* A PASS/FAIL LINE IN A GUARD DIALOG — the revalidation checklist Assign and
   Reassign both print before you commit. Module-local because it is not a
   status and not a form control: it is one rule, evaluated now, with the
   sentence that says what it means. */
export function GuardCheck({ ok, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-secondary py-2.5 text-sm text-secondary last:border-0">
      <Icon
        name={ok ? "checkcircle" : "alert"}
        size="sm"
        className={cx("mt-0.5 shrink-0", ok ? "text-fg-success-primary" : "text-fg-warning-primary")}
      />
      <div className="min-w-0 flex-1 [&_b]:font-semibold [&_b]:text-primary">{children}</div>
    </div>
  );
}

/* The one place a status becomes a coloured word. Every table cell, card
   header and timeline row goes through it, so a status added to
   vocabularies.json renders everywhere with no second edit.

   THE TONE IS THE DESIGN SYSTEM'S, THE LABEL IS THE VOCABULARY'S. `LeadStatus`
   owns the meaning of every state word in the panel — an enquiry's "Qualified"
   and a lead's "Qualified" must not be two different greens — so the module
   maps its own key onto that vocabulary and keeps its own wording. */
const LEAD_KEY: Record<string, string> = {
  generated: "new",
  processing: "processing",
  qualified: "qualified",
  no_match: "no-match",
  assigned: "assigned",
  converted: "converted",
  not_converted: "closed",
  invalid: "rejected",
};
export function StatusPill({ status, lg }: { status: string; lg?: boolean }) {
  const s = statusOf(status);
  return <LeadStatus status={LEAD_KEY[status] || status} label={s.label} lg={lg} />;
}

/** The same colour the pill wears, as a tone word a `Select` option can carry.
 *  ONE MAP, so the dot beside a status in the filter dropdown and the dot on the
 *  pill in the row it filters to are the same colour — two maps is how they
 *  stop being. */
const LEAD_DOT: Record<string, string> = {
  new: "warn", processing: "info", qualified: "ok", "no-match": "warn",
  assigned: "info", converted: "ok", closed: "neutral", rejected: "bad",
};
export const statusDot = (key: string): string => LEAD_DOT[LEAD_KEY[key] || key] || "neutral";

/* WHAT A ROW OWES SOMEBODY TODAY, as one tone.
   The rail on a queue row and the tone on the attention cell that counts it are
   THE SAME JUDGEMENT, so they are read from one function: a row cannot be
   striped for a condition the strip does not think is worth a colour, and a
   cell cannot go loud over rows that look ordinary. Everything else is a state
   you look things up by, and states have a pill. */
export function attentionTone(status: string): "bad" | "warn" | undefined {
  if (status === "generated") return "bad";
  if (status === "qualified" || status === "no_match") return "warn";
  return undefined;
}

/* Urgency is the customer's timeline, not ours, and it is the column an
   operator sorts by on a Monday. `hot` gets the accent; nothing else does,
   so the accent keeps meaning something. */
export function UrgencyChip({ urgency }: { urgency: string | null }) {
  const u = urgencyOf(urgency);
  if (!u) return <span className="text-sm text-quaternary">—</span>;
  return <Priority level={u.hot ? "high" : "normal"} label={u.label} />;
}

/* TIER. One letter, and the definition on it rather than beside it — the badge
   appears in a table row and in a record header, and neither has room for a
   sentence. It carries no weight in matching; it is an intake signal, which is
   why it is neutral and never a status colour. */
export function TierBadge({ tier }: { tier: string }) {
  const t = tierOf(tier);
  return <Pill xs tone="neutral" text={tier} title={t.label + " — " + t.help} />;
}

/* Operational tags — how the WORK is going, never what the customer is worth.
   Automatic ones carry the system mark so a reader can tell at a glance which
   are the system's read of the contact log and which a person set by hand;
   without it, an operator would not know which of their tags the next logged
   call is about to overwrite. */
export function TagChips({ tags, max }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  return (
    <Tags
      max={max}
      items={tags.map((slug) => {
        const t = tagOf(slug);
        return { label: t.label, tone: t.tone || "neutral", auto: t.auto };
      })}
    />
  );
}

/* WHERE IT CAME FROM. Every enquiry has one and it is never blank — provenance
   is the first thing anyone asks about a record that turns out to be wrong, and
   the last thing anyone can reconstruct if it was not stored.

   A manually added one names the person who typed it, right here on the chip
   rather than a click away. "Added by us" without a name is the absence of
   provenance wearing the word. */
export function SourceChip({ source, full }: {
  source: { kind: string; label: string; createdBy: string | null; via: string | null };
  full?: boolean;
}) {
  const s = sourceOf(source.kind);
  const via = viaLabel(source.via);
  const who = source.createdBy;
  if (!full) return <Tag label={s.short || s.label} tone={s.tone || "neutral"} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Tag label={s.label} tone={s.tone || "neutral"} />
      {via ? <span className="text-xs text-tertiary">{via}</span> : null}
      {who ? <span className="text-xs text-tertiary">added by {who}</span> : null}
    </span>
  );
}

/* Score with the bar under it. The bar IS the score — 0–100, normalised — so it
   needs no axis and no legend. */
export function ScoreBar({ score, top }: { score: number; top?: boolean }) {
  void top;
  return <Meter value={Math.max(2, Math.min(100, score))} max={100} label={score + " of 100"} />;
}

/* THE FACTOR BREAKDOWN. Every rank has to decompose into stored values — a
   number this module cannot explain is a defect, not a feature. Rendered from
   the candidate's own `factors` against the rule version's `weights`, so a
   weight change shows up as a shorter bar, never as a silently different
   total.

   `RULES.factors` is guarded because the rules are a fetch: a document served
   without the key must lose the breakdown, not the screen. */
export function FactorTable({ c }: { c: Candidate }) {
  const factors = RULES.factors || [];
  const total = factors.reduce((a, f) => a + (c.factors[f.key] || 0), 0);
  const ceiling = Math.max(1, ...factors.map((f) => f.weight || 0));
  if (!factors.length) {
    return <PanelNote>The rule version did not carry a factor table, so there is no breakdown to show.</PanelNote>;
  }
  return (
    <div className="flex flex-col gap-3">
      <BarRows
        max={ceiling}
        rows={factors.map((f) => {
          const got = c.factors[f.key] || 0;
          const pct = f.weight ? Math.round((got / f.weight) * 100) : 0;
          return {
            key: f.key,
            label: f.label,
            value: got,
            tone: pct >= 100 ? "st-ok" : pct < 60 ? "st-warn" : "s1",
            hint: <>of {f.weight} · {c.from[f.key] || "—"}</>,
          };
        })}
      />
      <KvList
        pairs={[
          ["Total", <><b className="font-semibold tnum">{total}</b> <span className="text-tertiary">of 100</span></>],
          ["Scale", "normalised 0–100"],
        ]}
      />
    </div>
  );
}

/* =============================================================================
   THE LIFECYCLE DOT RAMP — module-local on purpose.
   -----------------------------------------------------------------------------
   The nine states as one line, with the enquiry's own position on it, so it can
   sit in a record header rather than costing a band of its own.

   IT SHOWS EVERY STAGE, INCLUDING THE ONES MOST RECORDS SKIP. No match yet sits
   between Qualified and Assigned and is always drawn: the pipeline has a shape,
   and hiding part of it makes the shape a secret.

   AN OFF-RAMP IS NEVER "DONE", and that is the whole reason this is not the
   shared `Pipeline`. That component fills everything behind the current step,
   which would mark No match yet complete on every assigned record and claim an
   enquiry passed through a stage it never entered. Here the off-ramp is drawn
   HOLLOW AND DASHED: the stage exists, this record did not use it.

   Solid = behind you. Solid with a halo = here. Hollow = ahead. Dashed hollow =
   an exit you did not take. The terminal three collapse into one final step,
   because they are one position and not three.
   ============================================================================= */
type RampCell = { key: string; label: string; state: "done" | "on" | "next" | "off" };

export function LifecycleRail({ status }: { status: string }) {
  const here = statusOf(status).step;
  const terminal = statusOf(status).terminal;
  const cells: RampCell[] = STATUSES.filter((s) => !s.terminal)
    .map((s) => ({
      key: s.key as string,
      label: s.label,
      state: (s.key === status ? "on" : s.offRamp ? "off" : s.step < here ? "done" : "next") as RampCell["state"],
    }))
    .concat([{
      key: "__end",
      label: terminal ? statusOf(status).label : "Outcome",
      state: terminal ? "on" : "next",
    }]);

  return (
    <ol
      className="flex flex-wrap items-center gap-y-2"
      aria-label={"Lifecycle — currently " + statusOf(status).label}
    >
      {cells.map((c, i) => (
        <li key={c.key} className="flex items-center" aria-current={c.state === "on" ? "step" : undefined}>
          {i ? (
            <span
              aria-hidden="true"
              className={cx("mx-2 h-px w-4", c.state === "done" ? "bg-brand-solid" : "bg-border-secondary")}
            />
          ) : null}
          <span
            aria-hidden="true"
            className={cx(
              "size-2 shrink-0 rounded-full",
              c.state === "done" && "bg-brand-solid",
              c.state === "on" && "bg-brand-solid ring-4 ring-brand-primary",
              c.state === "off" && "border border-dashed border-primary",
              c.state === "next" && "ring-1 ring-primary ring-inset",
            )}
          />
          <span
            className={cx(
              "ml-1.5 text-xs whitespace-nowrap",
              c.state === "on" && "font-semibold text-brand-secondary",
              c.state === "done" && "text-secondary",
              (c.state === "next" || c.state === "off") && "text-quaternary",
            )}
          >
            {c.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* THE FROZEN BAR. Wherever a snapshot is shown, this says what "frozen" means
   there — because the absence of an Edit button is a design decision, and a
   decision nobody can see reads as an oversight. */
export function FrozenBar({ at, children }: { at: string; children?: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2.5 text-xs text-tertiary">
      <Icon name="lock" size="sm" className="mt-px shrink-0 text-fg-quaternary" />
      <span>
        <b className="font-semibold text-secondary">Frozen {at}.</b> {children}
      </span>
    </div>
  );
}

/* Age since intake — how long this enquiry has been Interior bazzar's problem,
   which is the number that keeps meaning something after it is routed. Time
   since DELIVERY is a different measure and is shown on the record itself,
   where the assignment it belongs to is also on screen. */
export function AgeCell({ e }: { e: Enquiry }) {
  return <span title={"Received " + dateTimeLabel(e.createdAt)}>{ageLabel(e.createdAt)}</span>;
}

/* The one line that has to be on every screen that can write: nothing here
   reaches a server. Rendered as a banner rather than a footnote, because a
   demo that looks live and is not is worse than no demo.

   IT ALSO HOLDS THE SCAFFOLDING CONTROL, and that is the point of putting it
   here rather than in the toolbar. "Re-fetch" is not a product feature — on the
   real thing the seed does not exist. A prototype-only button sitting in the
   command row beside Export and Add enquiry teaches the wrong toolbar; sitting
   inside the banner that says "none of this is real", it teaches the right one.

   OFF WHILE THE WRITES ARE BEING WIRED UP. Flipped to `false` rather than
   deleted, because the sentence is still accurate for assign / qualify /
   log-a-contact and has to come back if they are still simulated when this
   ships. `boolean` and not the literal, so the JSX below stays type-checked
   rather than becoming unreachable code the compiler stops reading. */
const SHOW_PROTO_BAR: boolean = false;

export function ProtoBar({ onReset }: { onReset?: () => void }) {
  const local = import.meta.env.DEV;
  if (!SHOW_PROTO_BAR) return null;
  return (
    <Alert
      tone="warn"
      title="Most writes are simulated."
      action={onReset && local ? <Button color="secondary" size="xs" onClick={onReset}>Re-fetch</Button> : undefined}
    >
      The enquiries, vocabulary, matching rules and business directory are live from the API, and{" "}
      <b>Add enquiry</b> really creates one — but assigning, qualifying, logging a contact and every other
      action writes to this browser tab only. A reload re-fetches and discards them. Match runs are still
      read from <span className="font-mono">src/content/business-enquiries/</span> and never ship.
    </Alert>
  );
}

/* A text field with the known values behind it. Category and city stopped being
   dropdowns because an operator on a call hears whatever the customer says, and
   a <select> that cannot hold it forces a wrong pick or a blank — both worse
   than an unfamiliar value.

   The trade is real and is not hidden: stage 1 eliminates on category and
   location, so a value the matching rules have never seen matches nobody. When
   that is about to be true the field says so, as a note and not an error,
   because the value may be perfectly right and the vocabulary simply behind.

   `InputBase` rather than the panel's `Input`: a datalist needs `list` on the
   real element and the wrapper does not forward it. Noted for promotion. */
export function VocabInput({ id, label, value, options, onChange, known, unknownNote, placeholder, req, disabled }: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  /** Optional: when it returns false the note below is shown. */
  known?: (v: string) => boolean;
  unknownNote?: string;
  placeholder?: string;
  req?: boolean;
  disabled?: boolean;
}) {
  const listId = id + "-list";
  const off = !!value.trim() && !!known && !known(value.trim());
  return (
    <FormField
      id={id}
      label={label}
      req={req}
      /* ONLY WHILE IT IS EMPTY. Three of these sit on one form and the same
         sentence under all three read as noise the moment they were filled in —
         which is most of the time. It is guidance for an empty box, so it
         leaves with the empty box. */
      hint={off || value.trim() ? undefined : "Type anything — the values we already use are suggested as you go."}
      err={off ? unknownNote : undefined}
    >
      <InputBase
        id={id}
        size="sm"
        value={value}
        list={listId}
        placeholder={placeholder}
        autoComplete="off"
        isDisabled={disabled}
        onChange={(ev) => onChange(ev.target.value)}
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </FormField>
  );
}

/* ------------------------------------------------------ the contact log --- */
/* WHAT THE CUSTOMER SAID, AS A TIMELINE. Newest last, so it reads as a
   conversation rather than a ledger, and the channel is a `Tag` because a
   channel is a label and not a state. `response` is the customer's own words
   and is quoted; `note` is the operator's read of it and is not — one is
   evidence and can go to a business, the other is interpretation.

   THE VOCABULARY IS READ WHEN THE ROW RENDERS, never at module scope: `CHANNELS`
   and `CONTACT_OUTCOMES` are live bindings that stay empty until the boot lands,
   and a module-scope copy of one would be permanently empty. `channelOf` and
   `contactOutcomeOf` are the store's own lazy readers, so there is one lookup
   and it cannot drift from the one the writes use. */
function logItem(entry: ContactEntry, isLast?: boolean) {
  const o = contactOutcomeOf(entry.outcome);
  return {
    tone: (o.tone === "ok" ? "ok" : o.tone === "warn" ? "warn" : o.tone === "bad" ? "bad" : "info") as
      "ok" | "warn" | "bad" | "info",
    title: (
      <span className="flex flex-wrap items-center gap-1.5">
        <Tag label={channelOf(entry.channel).label} tone="neutral" />
        <Pill xs text={o.label} tone={o.tone || "neutral"} />
        {isLast ? <span className="label-mono">last response</span> : null}
      </span>
    ),
    body: (
      <>
        {entry.response
          ? <span className="text-secondary">“{entry.response}”</span>
          : <span className="text-quaternary">No response — nothing was said to record.</span>}
        {entry.note ? <div className="mt-1 text-xs text-tertiary">{entry.note}</div> : null}
      </>
    ),
    meta: <>{dateTimeLabel(entry.at)} · {entry.direction === "inbound" ? "Inbound · " : ""}{entry.actor}</>,
  };
}

export { logItem as contactLogItem };

/** The two vocabularies the contact composer offers, as `SelectInput` options.
 *  Read inside a render for the same reason everything else here is. */
export const channelOptions = () => CHANNELS.map((c) => ({ v: c.key, l: c.label }));
export const outcomeOptions = () => CONTACT_OUTCOMES.map((o) => ({ v: o.key, l: o.label }));

/* ---------------------------------------------------------------- info --- */
/* THE (i) — explanation on request, not on arrival.

   This module carried about 1,500 words of rationale in its notices and block
   headings alone, all of it permanently on screen. Every sentence was worth
   writing and almost none of it was worth reading twice — and a screen that
   explains itself continuously reads as unsure of itself.

   THE SCREEN CARRIES WHAT YOU NEED TO ACT, AND THE (i) CARRIES WHY. What stays
   visible: anything that blocks or warns before a press, state and counts, and
   empty states — the one place prose IS the content. What moves behind the (i):
   design rationale, policy, and the explanations of why a thing is trustworthy.
   Nothing was deleted. */

/* A block heading with its explanation folded away behind the panel's own
   InfoDot — press to open, and it stays open while it is being read. */
export function BlockHead({ title, info, right }: {
  title: ReactNode;
  /** The rationale. Omit it and this is just a heading. */
  info?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
      {info ? <UiInfoDot label="Why is this here?">{info}</UiInfoDot> : null}
      {right ? <span className="ml-auto flex shrink-0 items-center gap-2">{right}</span> : null}
    </div>
  );
}

/* A notice that shows only the line you have to read, with the rest one press
   away. `short` is the operational half — what is true and what it means for
   the next click — and the children are the reasoning.

   Used WITHOUT children it is just an Alert, which is the right shape for a
   warning that has no subtext: "Nothing matches these filters" explains itself. */
export function InfoNote({ tone, ico, short, children }: {
  tone?: string;
  ico?: string;
  short: ReactNode;
  children?: ReactNode;
}) {
  const t = (tone === "ok" || tone === "warn" || tone === "bad" ? tone : "info") as "ok" | "warn" | "bad" | "info";
  return (
    <Alert tone={t} ico={ico}>
      <span className="inline">{short}</span>
      {children ? (
        <>
          {" "}
          <UiInfoDot label="Why?" className="translate-y-px">{children}</UiInfoDot>
        </>
      ) : null}
    </Alert>
  );
}

/* The (i) on its own, for a label or a heading that is not a BlockHead — the
   caller owns the disclosure state and places the box.
   @deprecated Prefer the shared `InfoDot`, which owns its own popover. Kept
   because it is part of this module's public surface. */
export function InfoDot({ open, onToggle, what }: {
  open: boolean; onToggle: () => void; what?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? "Hide the explanation" : (what || "What does this mean?")}
      className="inline-flex size-4 cursor-pointer items-center justify-center rounded-full font-mono text-2xs font-semibold text-fg-quaternary ring-1 ring-primary outline-focus-ring transition duration-100 ring-inset hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={onToggle}
    >
      i
    </button>
  );
}
