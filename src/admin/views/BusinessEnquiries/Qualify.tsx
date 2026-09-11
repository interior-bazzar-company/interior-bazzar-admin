/* =============================================================================
   Business Enquiries — THE QUALIFICATION WORKSTREAM.
   -----------------------------------------------------------------------------
   What a person does between "a form arrived" and "this is worth a business's
   time". It replaces the Business Suggestions panel while the enquiry is
   still being worked, and it is deliberately the same shape: one column of
   record, one column of decision. The decision here is not which business gets
   it — it is whether anyone should.

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
import {
  Button, Card, Checkbox, FieldRow, FormField, FormSection, InfoDot, Input, Meter, Pill,
  SelectInput, Tag, Textarea, Timeline,
} from "../../ui";
import { channelOptions, contactLogItem, InfoNote, outcomeOptions, PanelNote, VocabInput } from "./bits";
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
    <Card
      title="Requirement · as received, and as confirmed"
      right={
        <InfoDot label="Why is this editable?">
          What the form captured is what the customer typed while skimming a page. Correct it here from
          what they actually told you — every change is listed field by field in the timeline, so a
          correction is visible rather than silent. It stops being editable the moment this enquiry is
          qualified.
        </InfoDot>
      }
      foot={writes ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={dirty ? "text-warning-primary" : undefined}>{dirty ? "Unsaved changes" : "Saved"}</span>
          <span className="flex-1" />
          {dirty ? (
            <Button color="secondary" size="xs" onClick={() => {
              setR(e.requirement); setC(e.customer); setUrgency(e.qualification.urgency || "");
            }}>Discard</Button>
          ) : null}
          <Button color="primary" size="xs" isDisabled={!dirty}
            onClick={() => updateEnquiry(e.enquiryId, { requirement: r, customer: c, urgency: urgency || null })}>
            Save changes
          </Button>
        </div>
      ) : undefined}
    >
      <div className="flex flex-col gap-5">
        <FormSection title="Customer">
          <FieldRow cols={3}>
            <FormField id="be-f-name" label="Customer">
              <Input id="be-f-name" value={c.name} disabled={!writes}
                onChange={(v) => setC({ ...c, name: v })} />
            </FormField>
            <FormField id="be-f-phone" label="Phone" hint="Masked in this prototype.">
              <Input id="be-f-phone" value={c.phone} disabled={!writes} mono
                onChange={(v) => setC({ ...c, phone: v })} />
            </FormField>
            <FormField id="be-f-email" label="Email">
              <Input id="be-f-email" value={c.email || ""} disabled={!writes} ph="—"
                onChange={(v) => setC({ ...c, email: v || null })} />
            </FormField>
          </FieldRow>
        </FormSection>

        <FormSection title="What they want">
          <FieldRow cols={2}>
            <VocabInput id="be-f-cat" label="Category" req value={r.category || ""}
              options={VOCAB.categories} onChange={set("category")} disabled={!writes}
              known={knownCategory} placeholder="Interior Design…"
              unknownNote="Stage 1 eliminates on this, and the matching rules do not know this category — it will match nobody until the list catches up. A wrong category is not a low score, it is the wrong pool." />
            <FormField id="be-f-svc" label="Service">
              <Input id="be-f-svc" value={r.service || ""} disabled={!writes}
                ph="Full home interiors, living room, L-shaped kitchen…"
                onChange={set("service")} />
            </FormField>
          </FieldRow>

          <FieldRow cols={2}>
            <VocabInput id="be-f-city" label="City" req value={r.city || ""}
              options={VOCAB.cities} onChange={set("city")} disabled={!writes}
              known={knownCity} placeholder="New Delhi…"
              unknownNote="Not a city we currently match on. Worth recording — it is the evidence that says where coverage is missing." />
            <VocabInput id="be-f-state" label="State" value={r.state || ""}
              options={STATES} onChange={set("state")} disabled={!writes} placeholder="Delhi…" />
          </FieldRow>

          <FieldRow cols={2}>
            <FormField id="be-f-loc" label="Locality">
              <Input id="be-f-loc" value={r.locality || ""} disabled={!writes} onChange={set("locality")} />
            </FormField>
            <FormField id="be-f-pin" label="PIN code" hint="Captured, not yet matched on — BE-OD-04.">
              <Input id="be-f-pin" value={r.pincode || ""} disabled={!writes} ph="—" onChange={set("pincode")} />
            </FormField>
          </FieldRow>

          <FieldRow cols={3}>
            <FormField id="be-f-proj" label="Project type">
              <Input id="be-f-proj" value={r.projectType || ""} disabled={!writes}
                ph="Residential · 3BHK" onChange={set("projectType")} />
            </FormField>
            <FormField id="be-f-intent" label="Intent">
              <SelectInput id="be-f-intent" value={r.intent || ""} disabled={!writes}
                ph="— not confirmed —"
                options={[{ v: "project", l: "Project" }, { v: "product", l: "Product" }]}
                onChange={set("intent")} />
            </FormField>
            <FormField id="be-f-urg" label="Urgency" req hint="Drives the queue order.">
              <SelectInput id="be-f-urg" value={urgency} disabled={!writes}
                ph="— not confirmed —"
                options={VOCAB.urgency.map((u) => ({ v: u.key, l: u.label }))}
                onChange={setUrgency} />
            </FormField>
          </FieldRow>

          <FormField id="be-f-text" label="What they submitted" hint="Correct typos, never the meaning.">
            <Textarea id="be-f-text" rows={2} value={r.text} disabled={!writes}
              onChange={(v) => setR({ ...r, text: v })} />
          </FormField>
        </FormSection>
      </div>
    </Card>
  );
}

/* ==================================================== THE QUALIFY PANEL === */
/* ORDER INSIDE THE PANEL IS BY FREQUENCY, NOT BY NARRATIVE. Logging a contact
   is the thing an operator does ten times a day and the checklist is the thing
   they do once, so the composer leads even though the checklist reads first as
   an explanation of the job. The foot carries what is still outstanding, so the
   "what do I still need" question is answered next to the button that is
   waiting on the answer. */
export function QualifyPanel({ e, onQualified }: { e: Enquiry; onQualified: (msg: string) => void }) {
  const writes = can("business-enquiries", "edit");
  const missing = checklistMissing(e);
  const done = CHECKLIST.length - missing.length;
  const ready = canQualify(e);
  const last = lastResponse(e);

  return (
    <Card
      title="Qualification"
      sub={
        <>
          {done} of {CHECKLIST.length} confirmed · {e.contactLog.length} contact
          {e.contactLog.length === 1 ? "" : "s"} logged
        </>
      }
      right={<Pill xs tone={ready ? "ok" : "warn"} text={ready ? "Ready" : "In progress"} />}
      tight
    >
      <div className="flex flex-col gap-5">
        <Meter value={done} max={CHECKLIST.length} tone={ready ? "ok" : undefined}
          label={done + " of " + CHECKLIST.length + " qualification checks confirmed"} />

        {writes ? <ContactComposer e={e} /> : null}

        {/* ------------------------------------------------------ checklist --- */}
        <FormSection title="Qualification checks">
          <div className="flex flex-col gap-3">
            {CHECKLIST.map((row) => (
              <Checkbox
                key={row.key}
                id={"be-chk-" + row.key}
                checked={!!e.qualification.checklist[row.key]}
                disabled={!writes}
                label={row.label}
                hint={row.help}
                onChange={(v) => setCheck(e.enquiryId, row.key, v)}
              />
            ))}
          </div>
        </FormSection>

        {/* ----------------------------------------------------------- tags --- */}
        <FormSection title="Tags">
          <div className="flex flex-col gap-2.5">
            {TAGS.map((t) => (
              <Checkbox
                key={t.slug}
                id={"be-tag-" + t.slug}
                checked={e.tags.indexOf(t.slug) >= 0}
                disabled={!writes}
                label={<Tag label={t.label} tone={t.tone} auto={t.auto} />}
                hint={t.help + (t.auto ? " · set automatically from the contact log" : "")}
                onChange={() => toggleTag(e.enquiryId, t.slug)}
              />
            ))}
          </div>
          <InfoNote ico="tag" short={<>Tags with the system mark are set from the contact log.</>}>
            The system recomputes them on every logged attempt, so an override by hand lasts until the
            next one. There is no tag for what a customer might spend, for the same reason there is no
            budget field.
          </InfoNote>
        </FormSection>

        {/* ------------------------------------------------------------ log --- */}
        {/* Inline, not behind the i: this is a live reading off the log below,
            not reference about it. A long date format tips it past the fold
            threshold, so it says so explicitly rather than by luck. */}
        <FormSection
          title="Contact log"
          descInline
          desc={last ? "Last response " + dateTimeLabel(last.at) : undefined}
        >
          {e.contactLog.length ? (
            <ContactLog entries={e.contactLog} lastId={last?.logId} />
          ) : (
            <PanelNote>Nobody has contacted this customer yet. It is still in the untouched pile.</PanelNote>
          )}
        </FormSection>

        <QualifyFoot e={e} ready={ready} missing={missing} writes={writes} onQualified={onQualified} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------- the contact log --- */
/* THE WHOLE LOG AS ONE TIMELINE — the shape the panel uses for "what happened
   to this record" everywhere else. Shared by the qualification panel and by the
   read-only block on a qualified record, so the two can never drift into
   showing different things about the same entry. */
export function ContactLog({ entries, lastId }: { entries: ContactEntry[]; lastId?: string }) {
  return <Timeline items={entries.map((entry) => contactLogItem(entry, entry.logId === lastId))} />;
}

/** One logged attempt, on its own. Kept as part of this module's surface — the
 *  whole-log renderer above is the one every screen actually reaches for. */
export function ContactEntryRow({ entry, isLast }: { entry: ContactEntry; isLast?: boolean }) {
  return <Timeline items={[contactLogItem(entry, isLast)]} />;
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
    <FormSection
      title="Log a contact"
      className="rounded-lg bg-secondary p-4"
      /* Cmd/Ctrl+Enter submits from any field. Somebody logging twenty calls
         should never have to reach for the mouse between them. */
    >
      <div
        className="flex flex-col gap-4"
        onKeyDown={(ev) => {
          if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); submit(); }
        }}
      >
        {/* TWO ON A LINE, NOT THREE. This panel is the narrow column of a
            two-pane page; a third select here clipped its own longest option
            ("We contacted them") to "We contacted t". Direction takes the full
            width because its options are sentences and the other two are words. */}
        <FieldRow cols={2}>
          <FormField id="be-c-chan" label="Channel">
            <SelectInput id="be-c-chan" value={channel} options={channelOptions()} onChange={setChannel} />
          </FormField>
          <FormField id="be-c-out" label="Outcome">
            <SelectInput id="be-c-out" value={outcome} options={outcomeOptions()} onChange={setOutcome} />
          </FormField>
        </FieldRow>
        <FormField id="be-c-dir" label="Direction">
          <SelectInput id="be-c-dir" value={direction}
            options={[{ v: "outbound", l: "We contacted them" }, { v: "inbound", l: "They contacted us" }]}
            onChange={(v) => setDirection(v as "outbound" | "inbound")} />
        </FormField>

        {wantsResponse ? (
          <FormField id="be-c-resp" label="What the customer said">
            <Textarea id="be-c-resp" rows={3} value={response}
              ph="Their words, as close as you can. This is the part a business can be told."
              onChange={setResponse} />
          </FormField>
        ) : null}

        <FormField id="be-c-note" label="Your note">
          <Input id="be-c-note" value={note} ph="Your read of it. Optional." onChange={setNote} />
        </FormField>

        <Button color="primary" block ico="plus" onClick={submit}>
          Log {channelOf(channel).label.toLowerCase()}
        </Button>

        <p className="text-xs text-tertiary">
          <b className="font-mono font-semibold text-secondary">Ctrl</b>+
          <b className="font-mono font-semibold text-secondary">Enter</b> to log.
          {o.autoTag
            ? <> Tags this <b className="font-semibold text-secondary">{TAGS.filter((t) => t.slug === o.autoTag)[0]?.label}</b>.</>
            : null}
        </p>
      </div>
    </FormSection>
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
    return <PanelNote>You have read access to this enquiry. Qualifying it needs write access.</PanelNote>;
  }

  return (
    <div className="flex flex-col gap-4 border-t border-secondary pt-5">
      <FormField id="be-q-sum" label="Requirement summary" req
        hint="Pre-filled from the last thing the customer said. This is what the matching engine scores against and what the assigned business sees first.">
        <Textarea id="be-q-sum" rows={2} value={summary}
          ph="One line a business can read in five seconds."
          onChange={setSummary} />
      </FormField>

      <Button color="primary" size="lg" block ico="check" isDisabled={!ready}
        onClick={() => {
          markQualified(e.enquiryId, summary);
          onQualified("Qualified — the snapshot is frozen and matching can run.");
        }}>
        Mark qualified
      </Button>

      {ready ? (
        <InfoNote ico="lock" short={<>Freezes the snapshot and stamps your name on it.</>}>
          Against <span className="font-mono">{VOCAB.qualificationVersion}</span>. Nothing above stays
          editable afterwards — corrections become annotation events — and the record becomes
          matchable.
        </InfoNote>
      ) : (
        <div className="rounded-lg bg-secondary p-4 text-sm text-tertiary">
          <b className="font-semibold text-primary">Not ready to qualify.</b>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
            {!e.contactLog.length
              ? <li>No contact has been logged. Four ticked boxes on an enquiry nobody rang is a formality, not a record.</li>
              : null}
            {missing.map((m) => <li key={m.key}>{m.label} is not confirmed.</li>)}
          </ul>
          {e.contactLog.length > 0 && !everReached(e)
            ? (
              <p className="mt-2">
                Attempted {e.contactLog.length} time{e.contactLog.length === 1 ? "" : "s"}, never reached.
                If this stays true, the honest end is <b className="font-semibold text-primary">Rejected</b> with
                a reason — not a qualification nobody can stand behind.
              </p>
            )
            : null}
        </div>
      )}
    </div>
  );
}
