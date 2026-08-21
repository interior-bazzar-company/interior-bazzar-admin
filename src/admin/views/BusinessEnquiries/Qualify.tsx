/* =============================================================================
   Business Enquiries — THE QUALIFICATION WORKSTREAM.
   -----------------------------------------------------------------------------
   What a person does between "a form arrived" and "this is worth a business's
   time". It replaces the Business Suggestions panel while the enquiry is
   still being worked, and it is deliberately the same shape: one column of record, one
   column of decision. The decision here is not which business gets it — it is
   whether anyone should.

   The premise, and the reason the first cut of this module was wrong: a funnel
   submission is a CLAIM, not a fact. Someone skimming a landing page types
   "full home interiors" for what turns out to be one room, picks the nearest
   city from a dropdown, and leaves urgency at the default. Matching on that and
   then freezing the result as history is how a business gets handed an enquiry
   that was never real, with a snapshot proving we thought it was.

   So three things happen on this screen, in this order:

     1. THE RECORD IS EDITABLE. The operator on the phone is the one who finds
        out it is a renovation, not a fit-out. Every edit is listed field by
        field in the event log — a correction should be visible, not silent.
     2. EVERY ATTEMPT IS LOGGED, with what the customer actually said kept
        apart from what the operator made of it. The first is evidence and can
        be quoted to a business; the second is a read and cannot.
     3. A NAMED PERSON MARKS IT QUALIFIED, and that is the moment the snapshot
        freezes — not intake. Immutability is unchanged, it just starts at the
        point there is something worth making immutable.
   ============================================================================= */
import { useEffect, useState } from "react";
import { Icon, Pill } from "../../ui";
import { BlockHead, InfoNote, VocabInput } from "./bits";
import { can } from "../../shell/AdminShell";
import {
  CHANNELS, CHECKLIST, CONTACT_OUTCOMES, STATES, TAGS, VOCAB, canQualify, checklistMissing,
  contactOutcomeOf, channelOf, dateTimeLabel, everReached, knownCategory, knownCity,
  lastResponse, logContact, markQualified, setCheck, toggleTag, updateEnquiry,
} from "./store";
import type { ContactEntry, Enquiry } from "./store";

/* ================================================== THE EDITABLE RECORD === */
/* Local state, one explicit Save. Not autosave-on-blur: an operator typing a
   locality while still on the call should not be generating an event per
   keystroke, and the event log is the reason the edit is worth anything. */
export function RequirementForm({ e }: { e: Enquiry }) {
  const [r, setR] = useState(e.requirement);
  const [c, setC] = useState(e.customer);
  const [urgency, setUrgency] = useState(e.qualification.urgency || "");
  const writes = can("business-enquiries", "edit");

  /* Re-seed when the record changes underneath — a logged contact bumps the
     store, and the form must not hold a stale copy over the top of it. */
  useEffect(() => {
    setR(e.requirement); setC(e.customer); setUrgency(e.qualification.urgency || "");
  }, [e.requirement, e.customer, e.qualification.urgency]);

  const dirty =
    JSON.stringify(r) !== JSON.stringify(e.requirement) ||
    JSON.stringify(c) !== JSON.stringify(e.customer) ||
    urgency !== (e.qualification.urgency || "");

  const set = (k: keyof typeof r) => (v: string) => setR({ ...r, [k]: v || null });

  return (
    <div className="be-blk">
      <BlockHead title="Requirement · as received, and as confirmed" info={<>
        What the form captured is what the customer typed while skimming a page. Correct it here from
        what they actually told you — every change is listed field by field in the timeline, so a
        correction is visible rather than silent. It stops being editable the moment this enquiry is
        qualified.
      </>} />

      <div className="be-form">
        <div className="fg">
          <label htmlFor="be-f-name">Customer</label>
          <input id="be-f-name" className="inp" value={c.name} disabled={!writes}
            onChange={(ev) => setC({ ...c, name: ev.target.value })} />
        </div>
        <div className="fg">
          <label htmlFor="be-f-phone">Phone</label>
          <input id="be-f-phone" className="inp" value={c.phone} disabled={!writes}
            onChange={(ev) => setC({ ...c, phone: ev.target.value })} />
          <div className="help">Masked in this prototype.</div>
        </div>
        <div className="fg">
          <label htmlFor="be-f-email">Email</label>
          <input id="be-f-email" className="inp" value={c.email || ""} disabled={!writes}
            placeholder="—" onChange={(ev) => setC({ ...c, email: ev.target.value || null })} />
        </div>

        <VocabInput id="be-f-cat" label="Category" req value={r.category || ""}
          options={VOCAB.categories} onChange={set("category")}
          known={knownCategory} placeholder="Interior Design…"
          unknownNote="Stage 1 eliminates on this, and the matching rules do not know this category — it will match nobody until the list catches up. A wrong category is not a low score, it is the wrong pool." />
        <div className="fg">
          <label htmlFor="be-f-svc">Service</label>
          <input id="be-f-svc" className="inp" value={r.service || ""} disabled={!writes}
            placeholder="Full home interiors, living room, L-shaped kitchen…"
            onChange={(ev) => set("service")(ev.target.value)} />
        </div>
        <VocabInput id="be-f-city" label="City" req value={r.city || ""}
          options={VOCAB.cities} onChange={set("city")}
          known={knownCity} placeholder="New Delhi…"
          unknownNote="Not a city we currently match on. Worth recording — it is the evidence that says where coverage is missing." />
        <VocabInput id="be-f-state" label="State" value={r.state || ""}
          options={STATES} onChange={set("state")} placeholder="Delhi…" />
        <div className="fg">
          <label htmlFor="be-f-loc">Locality</label>
          <input id="be-f-loc" className="inp" value={r.locality || ""} disabled={!writes}
            onChange={(ev) => set("locality")(ev.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="be-f-pin">PIN code</label>
          <input id="be-f-pin" className="inp" value={r.pincode || ""} disabled={!writes}
            placeholder="—" onChange={(ev) => set("pincode")(ev.target.value)} />
          <div className="help">Captured, not yet matched on — BE-OD-04.</div>
        </div>
        <div className="fg">
          <label htmlFor="be-f-proj">Project type</label>
          <input id="be-f-proj" className="inp" value={r.projectType || ""} disabled={!writes}
            placeholder="Residential · 3BHK" onChange={(ev) => set("projectType")(ev.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="be-f-intent">Intent</label>
          <select id="be-f-intent" className="inp" value={r.intent || ""} disabled={!writes}
            onChange={(ev) => set("intent")(ev.target.value)}>
            <option value="">— not confirmed —</option>
            <option value="project">Project</option>
            <option value="product">Product</option>
          </select>
        </div>
        <div className="fg">
          <label htmlFor="be-f-urg">Urgency <span className="req">*</span></label>
          <select id="be-f-urg" className="inp" value={urgency} disabled={!writes}
            onChange={(ev) => setUrgency(ev.target.value)}>
            <option value="">— not confirmed —</option>
            {VOCAB.urgency.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
          </select>
          <div className="help">Drives the queue order.</div>
        </div>
      </div>

      <div className="fg" style={{ marginTop: "var(--space-3)" }}>
        <label htmlFor="be-f-text">What they submitted</label>
        <textarea id="be-f-text" className="inp" rows={2} value={r.text} disabled={!writes}
          onChange={(ev) => setR({ ...r, text: ev.target.value })} />
        <div className="help">Correct typos, never the meaning.</div>
      </div>

      {writes ? (
        <div className="be-form-f">
          <span className="faint">{dirty ? "Unsaved changes" : "Saved"}</span>
          <span className="spacer" />
          {dirty
            ? <button className="btn" onClick={() => {
                setR(e.requirement); setC(e.customer); setUrgency(e.qualification.urgency || "");
              }}>Discard</button>
            : null}
          <button className="btn pri" disabled={!dirty}
            onClick={() => updateEnquiry(e.enquiryId, { requirement: r, customer: c, urgency: urgency || null })}>
            Save changes
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ==================================================== THE QUALIFY PANEL === */
/* Header, scrolling body, pinned footer — see .be-sp in enquiries.css for the
   bug that shape exists to fix.

   ORDER INSIDE THE BODY IS BY FREQUENCY, NOT BY NARRATIVE. Logging a contact is
   the thing an operator does ten times a day and the checklist is the thing
   they do once, so the composer leads even though the checklist reads first as
   an explanation of the job. The footer carries what is still outstanding, so
   the "what do I still need" question is answered next to the button that is
   waiting on the answer. */
export function QualifyPanel({ e, onQualified }: { e: Enquiry; onQualified: (msg: string) => void }) {
  const writes = can("business-enquiries", "edit");
  const missing = checklistMissing(e);
  const done = CHECKLIST.length - missing.length;
  const ready = canQualify(e);
  const last = lastResponse(e);

  return (
    <div className="be-sp be-qp">
      <div className="be-sp-h">
        <b>Qualification</b>
        <div className="r">
          {done} of {CHECKLIST.length} confirmed · {e.contactLog.length} contact
          {e.contactLog.length === 1 ? "" : "s"} logged
        </div>
        <div className="be-qp-bar" aria-hidden="true">
          <i style={{ width: Math.round((done / CHECKLIST.length) * 100) + "%" }} />
        </div>
      </div>

      <div className="be-sp-scroll">
        {writes ? <ContactComposer e={e} /> : null}

        {/* ------------------------------------------------------ checklist --- */}
        <div className="be-qp-sec">
          <div className="be-qp-h">Qualification checks</div>
          {CHECKLIST.map((row) => {
            const on = e.qualification.checklist[row.key];
            return (
              <button key={row.key} className={"be-check" + (on ? " on" : "")} disabled={!writes}
                aria-pressed={on}
                onClick={() => setCheck(e.enquiryId, row.key, !on)}>
                <span className="bx" aria-hidden="true">{on ? <Icon name="check" size="sm" /> : null}</span>
                <span className="t">
                  <b>{row.label}</b>
                  <em>{row.help}</em>
                </span>
              </button>
            );
          })}
        </div>

        {/* ----------------------------------------------------------- tags --- */}
        <div className="be-qp-sec">
          <div className="be-qp-h">Tags</div>
          <div className="be-tagpick">
            {TAGS.map((t) => {
              const on = e.tags.indexOf(t.slug) >= 0;
              return (
                <button key={t.slug} className={"be-tag pick " + (t.tone || "") + (on ? " on" : "")}
                  disabled={!writes} aria-pressed={on}
                  aria-label={t.label + " — " + t.help + (t.auto ? " Set automatically from the contact log." : "")}
                  title={t.help + (t.auto ? " · set automatically from the contact log" : "")}
                  onClick={() => toggleTag(e.enquiryId, t.slug)}>
                  {t.auto ? <i className="auto" aria-hidden="true" /> : null}{t.label}
                </button>
              );
            })}
          </div>
          <InfoNote ico="tag" short={<>Dotted tags are set from the contact log.</>}>
            The system recomputes them on every logged attempt, so an override by hand lasts until the
            next one. There is no tag for what a customer might spend, for the same reason there is no
            budget field.
          </InfoNote>
        </div>

        {/* ------------------------------------------------------------ log --- */}
        <div className="be-qp-sec">
          <div className="be-qp-h">
            Contact log
            {last ? <span className="faint"> · last response {dateTimeLabel(last.at)}</span> : null}
          </div>
          {e.contactLog.length ? (
            <div className="be-log">
              {e.contactLog.map((entry) => (
                <ContactEntryRow key={entry.logId} entry={entry} isLast={entry.logId === last?.logId} />
              ))}
            </div>
          ) : (
            <div className="be-qp-empty">
              Nobody has contacted this customer yet. It is still in the untouched pile.
            </div>
          )}
        </div>
      </div>

      <QualifyFoot e={e} ready={ready} missing={missing} writes={writes} onQualified={onQualified} />
    </div>
  );
}

/* One logged attempt. Shared by the panel and by the read-only block on a
   qualified record, so the two can never drift into showing different things
   about the same entry. */
export function ContactEntryRow({ entry, isLast }: { entry: ContactEntry; isLast?: boolean }) {
  const o = contactOutcomeOf(entry.outcome);
  return (
    <div className={"be-log-i" + (isLast ? " last" : "")}>
      <div className="r1">
        <b>{channelOf(entry.channel).label}</b>
        <Pill text={o.label} tone={o.tone} />
        {isLast ? <span className="be-lastmark">last response</span> : null}
        <span className="spacer" />
        <span className="w">{dateTimeLabel(entry.at)}</span>
      </div>
      {entry.response
        ? <div className="resp">“{entry.response}”</div>
        : <div className="resp none">No response — nothing was said to record.</div>}
      {entry.note ? <div className="nt">{entry.note}</div> : null}
      <div className="by">{entry.direction === "inbound" ? "Inbound · " : ""}{entry.actor}</div>
    </div>
  );
}

/* --------------------------------------------------------- the composer --- */
function ContactComposer({ e }: { e: Enquiry }) {
  const [channel, setChannel] = useState(CHANNELS[0].key);
  const [outcome, setOutcome] = useState(CONTACT_OUTCOMES[0].key);
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [response, setResponse] = useState("");
  const [note, setNote] = useState("");

  const o = contactOutcomeOf(outcome);
  /* A "no answer" has nothing to record, so the response box is not asked for.
     Demanding one would train people to type "n/a" into the field that is
     supposed to hold the customer's words. */
  const wantsResponse = o.reached;

  const submit = () => {
    logContact(e.enquiryId, { channel, direction, outcome, response, note });
    setResponse(""); setNote("");
  };

  return (
    <div className="be-qp-sec be-compose"
      /* Cmd/Ctrl+Enter submits from any field. Somebody logging twenty calls
         should never have to reach for the mouse between them. */
      onKeyDown={(ev) => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); submit(); }
      }}>
      <div className="be-qp-h">Log a contact</div>
      <div className="be-compose-r">
        <select className="inp sm" value={channel} onChange={(ev) => setChannel(ev.target.value)}
          aria-label="Channel">
          {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="inp sm" value={direction} aria-label="Direction"
          onChange={(ev) => setDirection(ev.target.value as "outbound" | "inbound")}>
          <option value="outbound">We contacted them</option>
          <option value="inbound">They contacted us</option>
        </select>
        <select className="inp sm" value={outcome} onChange={(ev) => setOutcome(ev.target.value)}
          aria-label="Outcome">
          {CONTACT_OUTCOMES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </div>

      {wantsResponse ? (
        <div className="fg">
          <label htmlFor="be-c-resp">What the customer said</label>
          <textarea id="be-c-resp" className="inp" rows={3} value={response}
            placeholder="Their words, as close as you can. This is the part a business can be told."
            onChange={(ev) => setResponse(ev.target.value)} />
        </div>
      ) : null}

      <div className="fg">
        <label htmlFor="be-c-note">Your note</label>
        <input id="be-c-note" className="inp" value={note}
          placeholder="Your read of it. Optional."
          onChange={(ev) => setNote(ev.target.value)} />
      </div>

      <button className="btn pri full" onClick={submit}>
        <Icon name="plus" />Log {channelOf(channel).label.toLowerCase()}
      </button>
      <div className="be-qp-help">
        <span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> to log.
        {o.autoTag
          ? <> Tags this <b>{TAGS.filter((t) => t.slug === o.autoTag)[0]?.label}</b>.</>
          : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the freeze --- */
function QualifyFoot({ e, ready, missing, writes, onQualified }: {
  e: Enquiry;
  ready: boolean;
  missing: { key: string; label: string }[];
  writes: boolean;
  onQualified: (msg: string) => void;
}) {
  const last = lastResponse(e);
  const [summary, setSummary] = useState("");

  useEffect(() => { setSummary(last?.response || ""); }, [last?.response]);

  if (!writes) {
    return <div className="be-sp-f">You have read access to this enquiry. Qualifying it needs write access.</div>;
  }

  return (
    <div className="be-qp-foot">
      <div className="fg">
        <label htmlFor="be-q-sum">Requirement summary <span className="req">*</span></label>
        <textarea id="be-q-sum" className="inp" rows={2} value={summary}
          placeholder="One line a business can read in five seconds."
          onChange={(ev) => setSummary(ev.target.value)} />
        <div className="help">
          Pre-filled from the last thing the customer said. This is what the matching engine scores
          against and what the assigned business sees first.
        </div>
      </div>

      <button className="btn pri full lg" disabled={!ready}
        onClick={() => {
          markQualified(e.enquiryId, summary);
          onQualified("Qualified — the snapshot is frozen and matching can run.");
        }}>
        <Icon name="check" />Mark qualified
      </button>

      {ready ? (
        <InfoNote ico="lock"
          short={<>Freezes the snapshot and stamps your name on it.</>}>
          Against <span className="mono">{VOCAB.qualificationVersion}</span>. Nothing above stays
          editable afterwards — corrections become annotation events — and the record becomes
          matchable.
        </InfoNote>
      ) : (
        <div className="be-qp-block">
          <b>Not ready to qualify.</b>
          <ul>
            {!e.contactLog.length
              ? <li>No contact has been logged. Four ticked boxes on an enquiry nobody rang is a formality, not a record.</li>
              : null}
            {missing.map((m) => <li key={m.key}>{m.label} is not confirmed.</li>)}
          </ul>
          {e.contactLog.length > 0 && !everReached(e)
            ? <span className="be-qp-hint">
                Attempted {e.contactLog.length} time{e.contactLog.length === 1 ? "" : "s"}, never reached.
                If this stays true, the honest end is <b>Rejected</b> with a reason — not a qualification
                nobody can stand behind.
              </span>
            : null}
        </div>
      )}
    </div>
  );
}
