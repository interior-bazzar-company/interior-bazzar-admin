/* =============================================================================
   Business Enquiries — the small render pieces every screen in the module
   shares. Kept here rather than in ui/ because none of them is general: a
   status pill that reads the module's own vocabulary, a score bar that only
   means anything beside a candidate, a lifecycle rail with nine fixed steps.
   ============================================================================= */
import { useState } from "react";
import type { ReactNode } from "react";
import { Icon, Pill } from "../../ui";
import { RULES, STATUSES, ageLabel, dateTimeLabel, followUpOverdue, initialsOf, sourceOf, statusOf, tagOf, tierOf, urgencyOf, viaLabel } from "./store";
import type { Candidate, Enquiry, Owner } from "./store";

/* The one place a status becomes a coloured word. Every table cell, drawer
   header and timeline row goes through it, so a status added to
   vocabularies.json renders everywhere with no second edit. */
export function StatusPill({ status, lg }: { status: string; lg?: boolean }) {
  const s = statusOf(status);
  return <Pill text={s.label} tone={s.tone} lg={lg} title={s.meaning} />;
}

/* Urgency is the customer's timeline, not ours, and it is the column an
   operator sorts by on a Monday. `hot` gets the accent; nothing else does,
   so the accent keeps meaning something. */
export function UrgencyChip({ urgency }: { urgency: string | null }) {
  const u = urgencyOf(urgency);
  if (!u) return <span className="faint">—</span>;
  return <span className={"be-urg" + (u.hot ? " hot" : "")}>{u.label}</span>;
}

/* TIER. One letter, in a 20px square, and nothing else inside it.

   It used to take a `withHelp` prop that rendered the tier's definition as a
   second child — and `.be-tier` is an `inline-grid`, so two children became two
   ROWS. In the record's id bar an override released the width, and the badge
   stretched across the whole flex line as a black bar with the letter floating
   in the middle of it and the definition spilling out below the fixed 20px
   height. One prop, both artefacts.

   The definition did not go anywhere: it is on the badge's own `title` and
   `aria-label` wherever the badge appears, and it is written out in full behind
   the (i) on the Enquiry block. A badge is a badge. */
export function TierBadge({ tier }: { tier: string }) {
  const t = tierOf(tier);
  return (
    <span className={"be-tier t" + tier} title={t.label + " — " + t.help}
      aria-label={t.label + ". " + t.help}>{tier}</span>
  );
}

/* Who is working this, or nobody. The empty case is styled as a state rather
   than a dash: unowned is the condition that produces two people ringing the
   same customer, and it should look like something to fix. */
export function OwnerCell({ owner }: { owner: Owner | null }) {
  if (!owner) {
    return (
      <span className="be-owner none" title="Nobody has claimed this enquiry">
        <span className="av" aria-hidden="true">?</span>Unclaimed
      </span>
    );
  }
  return (
    <span className="be-owner" title={"Owned by " + owner.name}>
      <span className="av" aria-hidden="true">{initialsOf(owner.name)}</span>{owner.name}
    </span>
  );
}

/* A promised callback. Overdue is the loudest state in the module, deliberately
   above a breached SLA — that one is a business failing to answer us; this one
   is us failing a customer we personally told we would ring. */
export function FollowUpCell({ e }: { e: Enquiry }) {
  if (!e.followUpAt) return <span className="be-due none">—</span>;
  const over = followUpOverdue(e);
  return (
    <span className={"be-due" + (over ? " over" : "")}
      title={(over ? "Callback was due " : "Callback due ") + dateTimeLabel(e.followUpAt)}>
      {over ? "Overdue · " : ""}{dateTimeLabel(e.followUpAt)}
    </span>
  );
}

/* Operational tags — how the WORK is going, never what the customer is worth.
   Automatic ones carry a dotted leader so a reader can tell at a glance which
   are the system's read of the contact log and which a person set by hand;
   without that mark, an operator would not know which of their tags the next
   logged call is about to overwrite. */
export function TagChips({ tags, max }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  const show = max ? tags.slice(0, max) : tags;
  const rest = tags.length - show.length;
  return (
    <span className="be-tags">
      {show.map((slug) => {
        const t = tagOf(slug);
        return (
          <span key={slug} className={"be-tag " + (t.tone || "")} title={t.help}>
            {t.auto ? <i className="auto" /> : null}{t.label}
          </span>
        );
      })}
      {rest > 0 ? <span className="be-tag more">+{rest}</span> : null}
    </span>
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
  const title = s.label + (via ? " · " + via : "") + (who ? " · added by " + who : "") + " — " + s.help;
  return (
    <span className={"be-src " + (s.tone || "") + (s.manual ? " manual" : "")} title={title}>
      {s.manual ? <Icon name="user" size="sm" /> : null}
      {full ? s.label : s.short}
      {full && via ? <em> · {via}</em> : null}
      {full && who ? <em> · {who}</em> : null}
    </span>
  );
}

/* Score with the bar under it. The bar is the score — 0–100, normalised — so
   it needs no axis and no legend. */
export function ScoreBar({ score, top }: { score: number; top?: boolean }) {
  return (
    <div className="be-bar" title={score + " of 100"}>
      <i className={top ? "top" : ""} style={{ width: Math.max(2, Math.min(100, score)) + "%" }} />
    </div>
  );
}

/* THE FACTOR BREAKDOWN. Every rank has to decompose into stored values — a
   number this module cannot explain is a defect, not a feature. Rendered from
   the candidate's own `factors` against the rule version's `weights`, so a
   weight change shows up as a shorter bar, never as a silently different
   total. */
export function FactorTable({ c }: { c: Candidate }) {
  const total = RULES.factors.reduce((a, f) => a + (c.factors[f.key] || 0), 0);
  return (
    <div className="tw scroll">
      <table className="tbl be-ftbl">
        <thead>
          <tr>
            <th>Factor</th>
            <th className="n">Weight</th>
            <th className="n">Scored</th>
            <th style={{ width: "120px" }}></th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          {RULES.factors.map((f) => {
            const got = c.factors[f.key] || 0;
            const pct = f.weight ? Math.round((got / f.weight) * 100) : 0;
            const cls = pct >= 100 ? "full" : pct < 60 ? "low" : "";
            return (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td className="n faint tnum">{f.weight}</td>
                <td className="n tnum"><b>{got}</b></td>
                <td><div className={"be-fb " + cls}><i style={{ width: pct + "%" }} /></div></td>
                <td className="faint">{c.from[f.key] || "—"}</td>
              </tr>
            );
          })}
          <tr className="be-ftot">
            <td><b>Total</b></td>
            <td className="n faint tnum">100</td>
            <td className="n tnum"><b>{total}</b></td>
            <td><div className="be-fb full"><i style={{ width: total + "%" }} /></div></td>
            <td className="faint">normalised 0–100</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* The nine states as a rail, with the enquiry's own position on it. Reads as
   one line so it can sit in a drawer header; the terminal three collapse into
   the seventh step because they are one position, not three. */
export function LifecycleRail({ status }: { status: string }) {
  const here = statusOf(status).step;
  const steps = STATUSES.filter((s) => s.step <= 6);
  const terminal = statusOf(status).terminal;
  return (
    <div className="be-rail" aria-label={"Lifecycle — currently " + statusOf(status).label}>
      {steps.map((s) => (
        <span key={s.key} className={"be-step" + (s.step < here ? " done" : s.step === here ? " on" : "")}
          title={s.label + " — " + s.meaning}>
          <i />
          <b>{s.label}</b>
        </span>
      ))}
      <span className={"be-step" + (terminal ? " on end" : " end")} title="Converted · Not Converted · Invalid">
        <i />
        <b>{terminal ? statusOf(status).label : "Outcome"}</b>
      </span>
    </div>
  );
}

/* THE FROZEN BAR. Wherever a snapshot is shown, this says what "frozen" means
   there — because the absence of an Edit button is a design decision, and a
   decision nobody can see reads as an oversight. */
export function FrozenBar({ at, children }: { at: string; children?: ReactNode }) {
  return (
    <div className="be-frozen">
      <Icon name="lock" size="sm" />
      <span><b>Frozen {at}.</b> {children}</span>
    </div>
  );
}

/* Age since intake — how long this enquiry has been Interior bazzar's problem,
   which is the number that keeps meaning something after it is routed. The
   post-delivery clock is a different measure and lives with the SLA, on the
   record, where the threshold it is measured against is also on screen. */
export function AgeCell({ e }: { e: Enquiry }) {
  return (
    <span className="tnum" title={"Created " + dateTimeLabel(e.createdAt)}>
      {ageLabel(e.createdAt)}
    </span>
  );
}

/* The one line that has to be on every screen that can write: nothing here
   reaches a server. Rendered as a banner rather than a footnote, because a
   demo that looks live and is not is worse than no demo.

   IT ALSO HOLDS THE SCAFFOLDING CONTROLS, and that is the point of putting them
   here rather than in the toolbar. "Reset data" and "Run the SLA sweep" are not
   product features — on the real thing the seed does not exist and the sweep is
   a cron job nobody presses. A prototype-only button sitting in the command row
   beside Export and Add enquiry teaches the wrong toolbar; sitting inside the
   banner that says "none of this is real", it teaches the right one. */
/* OFF WHILE THE WRITES ARE BEING WIRED UP. The bar said "most writes are
   simulated", which was true and is on its way to not being true — the enquiry
   list, Add enquiry and the record read are on the API now and the rest are
   following. Flipped to `false` rather than deleted, because the sentence is
   still accurate for assign / qualify / log-a-contact and has to come back if
   they are still simulated when this ships. It also carries the two local-only
   scaffolding buttons, which go quiet with it.

   `boolean` and not the literal, so the JSX below stays type-checked rather than
   becoming unreachable code the compiler stops reading. */
const SHOW_PROTO_BAR: boolean = false;

export function ProtoBar({ onReset, onSweep }: { onReset?: () => void; onSweep?: () => void }) {
  /* THE BANNER RENDERS EVERYWHERE, the two buttons do not. The records are real
     now — the enquiry list is served by the API on dev, stage and prod alike —
     but every WRITE is still simulated in the tab, and that is exactly the state
     a deployed panel must not keep quiet about: somebody assigns an enquiry,
     sees it move, and nobody is ever sent it. Reset and Run SLA sweep are
     scaffolding rather than product (the sweep is a cron job on the real thing),
     so those stay local. */
  const local = import.meta.env.DEV;
  if (!SHOW_PROTO_BAR) return null;
  return (
    <div className="be-proto">
      <Icon name="alert" size="sm" />
      <span>
        <b>Most writes are simulated.</b> The enquiries, vocabulary, matching rules and
        business directory are live from the API, and <b>Add enquiry</b> really creates one —
        but assigning, qualifying, logging a contact and every other action writes to this
        browser tab only. A reload re-fetches and discards them. Match runs are still read
        from <span className="mono">src/content/business-enquiries/</span> and never ship.
      </span>
      {onSweep && local
        ? <button className="btn sm" onClick={onSweep}
            title="Flag delivered enquiries past their acknowledgement threshold. A nightly cron job on the real thing.">
            <Icon name="clock" size="sm" />Run SLA sweep
          </button>
        : null}
      {onReset && local ? <button className="btn sm" onClick={onReset}>Re-fetch</button> : null}
    </div>
  );
}

/* A text field with the known values behind it. Category and city stopped being
   dropdowns because an operator on a call hears whatever the customer says, and
   a <select> that cannot hold it forces a wrong pick or a blank — both worse
   than an unfamiliar value.

   The trade is real and is not hidden: stage 1 eliminates on category and
   location, so a value the matching rules have never seen matches nobody. When
   that is about to be true the field says so, as a note and not an error,
   because the value may be perfectly right and the vocabulary simply behind. */
export function VocabInput({ id, label, value, options, onChange, known, unknownNote, placeholder, req }: {
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
}) {
  const listId = id + "-list";
  const off = !!value.trim() && !!known && !known(value.trim());
  return (
    <div className="fg">
      <label htmlFor={id}>{label}{req ? <> <span className="req">*</span></> : null}</label>
      <input id={id} className="inp" value={value} list={listId} placeholder={placeholder}
        autoComplete="off" onChange={(ev) => onChange(ev.target.value)} />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
      {off
        ? <div className="help warn">{unknownNote}</div>
        : <div className="help">Type anything — the values we already use are suggested as you go.</div>}
    </div>
  );
}

/* =============================================================================
   THE (i) — explanation on request, not on arrival.
   -----------------------------------------------------------------------------
   This module carried about 1,500 words of rationale in its notices and block
   headings alone, all of it permanently on screen: why a snapshot is frozen,
   why the panel ranks but never computes, why an enquiry is not a deal. Every
   sentence was worth writing and almost none of it was worth reading twice —
   and a screen that explains itself continuously reads as unsure of itself. The
   prose crowded out the numbers and the states somebody opened the page for.

   340 of those words now stay on screen. The other ~1,160 are one press away.

   So the rule is now: THE SCREEN CARRIES WHAT YOU NEED TO ACT, AND THE (i)
   CARRIES WHY.

   What stays visible, always:
     · anything that blocks or warns before a press — a validation failure, the
       duplicate check, the contact-data warning on export
     · state, counts, and what is outstanding
     · empty states, which are the one place prose IS the content

   What moves behind the (i):
     · design rationale and policy — true, useful once, re-read never
     · "this is stored, not recomputed", "copied not referenced", and the rest
       of the explanations of why a thing is trustworthy

   Nothing was deleted. An explanation worth writing down is worth keeping; it
   just stops being the first thing on the screen every single time.
   ============================================================================= */

/* A block heading with its explanation folded away behind an (i). Most of the
   module's prose sat at the top of a card, which is exactly where this goes. */
export function BlockHead({ title, info, right }: {
  title: ReactNode;
  /** The rationale. Omit it and this is just an <h4>. */
  info?: ReactNode;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="be-bh">
        <h4>{title}</h4>
        {info ? (
          <button type="button" className="be-i" aria-expanded={open}
            aria-label={open ? "Hide the explanation" : "Why is this here?"}
            title={open ? "Hide the explanation" : "Why is this here?"}
            onClick={() => setOpen(!open)}>i</button>
        ) : null}
        {right ? <span className="r">{right}</span> : null}
      </div>
      {open && info ? <div className="be-infobox">{info}</div> : null}
    </>
  );
}

/* A notice that shows only the line you have to read, with the rest one press
   away. `short` is the operational half — what is true and what it means for
   the next click — and the children are the reasoning.

   Used WITHOUT children it is just a Notice, which is the right shape for a
   warning that has no subtext: "Nothing matches these filters" explains itself. */
export function InfoNote({ tone, ico, short, children }: {
  tone?: string;
  ico?: string;
  short: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"notice be-note-i" + (tone ? " " + tone : "")}>
      <Icon name={ico || "alert"} />
      <div>
        <span className="s">{short}</span>
        {children ? (
          <button type="button" className="be-i" aria-expanded={open}
            aria-label={open ? "Hide the explanation" : "Why?"}
            title={open ? "Hide the explanation" : "Why?"}
            onClick={() => setOpen(!open)}>i</button>
        ) : null}
        {open && children ? <div className="be-infobox flush">{children}</div> : null}
      </div>
    </div>
  );
}

/* The (i) on its own, for a label or a heading that is not a BlockHead. The
   caller places the box; this is only the button. */
export function InfoDot({ open, onToggle, what }: {
  open: boolean; onToggle: () => void; what?: string;
}) {
  return (
    <button type="button" className="be-i" aria-expanded={open}
      aria-label={open ? "Hide the explanation" : (what || "What does this mean?")}
      title={what || "What does this mean?"}
      onClick={onToggle}>i</button>
  );
}

