/* =============================================================================
   Business Enquiries — the small render pieces every screen in the module
   shares. Kept here rather than in ui/ because none of them is general: a
   status pill that reads the module's own vocabulary, a score bar that only
   means anything beside a candidate, a lifecycle rail with nine fixed steps.
   ============================================================================= */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon, Pill } from "../../ui";
import {
  RULES, STATUSES, ageLabel, dateTimeLabel, findBusinesses, sourceOf, statusOf, tagOf,
  tierOf, urgencyOf, viaLabel,
} from "./store";
import type { Business, Candidate, Enquiry } from "./store";

/* ---------------------------------------------------------- the search --- */
/* FINDING A BUSINESS BY HAND, for the two places the engine can leave you with
   nothing to pick from: assigning an enquiry no run could rank, and reassigning
   one where the only other candidate was the business you are moving away from.
   Both are the same situation — real work, a business that can obviously take
   it, and no list offering it — and both used to dead-end in a red notice.

   ONE COMPONENT because they are one question. The alternative was a second
   copy in Modals.tsx, and the copy is where the two would start disagreeing
   about what "eligible" means on screen.

   A LOCAL FILTER, not a request: the directory is already in the tab, one of
   the three reads the module boots with. And it is a SEARCH, not a ranking —
   alphabetical, no score, and the only claims made about a business are what
   its own profile says. Anything more would be a matching engine written in a
   dialog, which is the one thing this module refuses to have. */
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
    <>
      <div className="fg">
        <label htmlFor={"be-bsearch-" + action}>Find a business</label>
        <input id={"be-bsearch-" + action} className="inp" value={q} autoComplete="off"
          placeholder="Name, category or city…"
          onChange={(ev) => setQ(ev.target.value)} />
        <div className="help">
          Searched on the server as you type. No ranking and no score — alphabetical, and the only
          claims made about a business are what its own profile says.
        </div>
      </div>

      {rows.map((b) => (
        <div className={"be-sugg" + (picked === b.businessId ? " top" : "")} key={b.businessId}>
          <div className="be-sugg-r1">
            <div className="be-sugg-nm">
              <div className="nm">{b.name}</div>
              <div className="band">
                {b.plan || "no plan"} · {b.subscription}
                {b.serviceArea.length ? " · " + b.serviceArea.join(", ") : ""}
              </div>
            </div>
          </div>
          <div className="be-why">
            {b.categories.length
              ? b.categories.join(", ")
              : "No categories on this profile — matching could never have found it."}
          </div>
          <div className="be-sugg-a">
            {/* The same figure the assign dialog rechecks at confirmation — and
                the server rechecks again on the write. Shown here so an
                obviously full business is visible before you commit to it,
                never instead of the check. */}
            <span className="faint">
              {b.capacity.active} of {b.capacity.configured} this {b.capacity.period}
            </span>
            <span className="spacer" />
            <button className="btn sm" onClick={() => onPick(b)}>
              {picked === b.businessId ? "Chosen" : action}
            </button>
          </div>
        </div>
      ))}

      {/* Four states, and they are four different things. "Type to search" is
          not an empty result, and an empty result is not a failed request. */}
      {state === "idle" ? (
        <div className="be-qp-empty">Type a name, a category or a city to search.</div>
      ) : null}
      {state === "loading" ? <div className="be-qp-empty">Searching…</div> : null}
      {state === "done" && !rows.length ? (
        <div className="be-qp-empty">No business matches “{q.trim()}”.</div>
      ) : null}
      {state === "error" ? (
        <div className="be-qp-empty">The search did not reach the server. Try again.</div>
      ) : null}
    </>
  );
}

/* The one place a status becomes a coloured word. Every table cell, drawer
   header and timeline row goes through it, so a status added to
   vocabularies.json renders everywhere with no second edit. */
/* The pill carries the status's IDENTITY dot as well as its semantic tone.
   The tone says how to feel about it — four of them, shared across the module.
   The dot says which state it is — eight of them, one per status, and the same
   mark the Status filter shows. Without it the filter taught a colour code the
   rows never repeated, which is a code nobody learns. */
export function StatusPill({ status, lg }: { status: string; lg?: boolean }) {
  const s = statusOf(status);
  return (
    <Pill tone={s.tone} lg={lg} title={s.meaning}
      text={<><span className={"be-dot s-" + status} />{s.label}</>} />
  );
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
/* THE RAIL SHOWS EVERY STAGE, INCLUDING THE ONES MOST RECORDS SKIP.
   No match yet sits between Qualified and Assigned and is always drawn: the
   pipeline has a shape, and hiding part of it makes the shape a secret.

   AN OFF-RAMP IS NEVER "DONE", and that is the whole reason it needs its own
   state. It has step 4 and Assigned has 5, so the ordinary rule — anything
   behind you is filled — would mark it complete on every assigned record and
   the rail would claim an enquiry passed through a stage it never entered.
   `off` is drawn dashed and muted instead: the stage exists, this record did
   not use it. */
export function LifecycleRail({ status }: { status: string }) {
  const here = statusOf(status).step;
  const steps = STATUSES.filter((s) => !s.terminal);
  const terminal = statusOf(status).terminal;
  return (
    <div className="be-rail" aria-label={"Lifecycle — currently " + statusOf(status).label}>
      {steps.map((s) => {
        const state = s.key === status ? " on"
          : s.offRamp ? " off"
            : s.step < here ? " done" : "";
        return (
        <span key={s.key} className={"be-step" + state}
          title={s.label + " — " + s.meaning
            + (s.offRamp && s.key !== status ? " (not taken by this enquiry)" : "")}>
          <i />
          <b>{s.label}</b>
        </span>
        );
      })}
      <span className={"be-step" + (terminal ? " on end" : " end")} title="Converted · Not Converted · Rejected">
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
   which is the number that keeps meaning something after it is routed. Time
   since DELIVERY is a different measure and is shown on the record itself,
   where the assignment it belongs to is also on screen. */
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
   here rather than in the toolbar. "Reset data" is not a product feature — on
   the real thing the seed does not exist. A prototype-only button sitting in
   the command row beside Export and Add enquiry teaches the wrong toolbar;
   sitting inside the banner that says "none of this is real", it teaches the
   right one. */
/* OFF WHILE THE WRITES ARE BEING WIRED UP. The bar said "most writes are
   simulated", which was true and is on its way to not being true — the enquiry
   list, Add enquiry and the record read are on the API now and the rest are
   following. Flipped to `false` rather than deleted, because the sentence is
   still accurate for assign / qualify / log-a-contact and has to come back if
   they are still simulated when this ships. It also carries the local-only
   scaffolding button, which goes quiet with it.

   `boolean` and not the literal, so the JSX below stays type-checked rather than
   becoming unreachable code the compiler stops reading. */
const SHOW_PROTO_BAR: boolean = false;

export function ProtoBar({ onReset }: { onReset?: () => void }) {
  /* THE BANNER RENDERS EVERYWHERE, the button does not. The records are real
     now — the enquiry list is served by the API on dev, stage and prod alike —
     but every WRITE is still simulated in the tab, and that is exactly the state
     a deployed panel must not keep quiet about: somebody assigns an enquiry,
     sees it move, and nobody is ever sent it. Re-fetch is scaffolding rather
     than product, so it stays local. */
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

