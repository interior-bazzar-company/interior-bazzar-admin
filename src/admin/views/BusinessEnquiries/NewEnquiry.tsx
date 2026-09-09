/* =============================================================================
   Business Enquiries — add one by hand.
   -----------------------------------------------------------------------------
   THIS SUPERSEDES "there is no Create button", and the reasoning is worth
   keeping because the original objection was half right.

   The objection was that a hand-typed enquiry has no submission id, no
   duplicate check and no qualification snapshot — so it is a record with no
   provenance sitting in a queue that runs on provenance. True of a naive
   Create form. But the danger is the missing guarantees, not the human typing:
   people ring the office, walk in, and get referred, and refusing to record
   that does not stop it happening. It just means the enquiry gets worked in
   somebody's notebook and the business it eventually reaches is picked with
   none of this module's machinery.

   So the form exists and the guarantees are kept instead:

     · a submission id, and a real row — this posts to the API and the record
       that comes back is the one in the database, not a hopeful local copy
     · the customer's HISTORY, looked up as the number is typed — what this
       person has enquired about before, so the operator has it on the call. It
       is context and not a gate: one customer enquires more than once, for
       different work at different addresses months apart, and every one of
       those is a real enquiry a business should get
     · it lands in New and must be qualified by a person like any other.
       Typing it yourself buys no shortcut past the gate; the checklist starts
       empty even though you have just had the conversation
     · and one thing an inbound enquiry cannot record: who typed it

   The form asks for very little. Everything except name, phone and how it
   reached us is optional, because the person filling this in is usually still
   on the call — and a required field they cannot answer yet is a field they
   will guess at, which is worse than an empty one.
   ============================================================================= */
import { useMemo, useState } from "react";
import {
  Alert, Button, FieldRow, FormField, FormSection, InfoDot, Input, ModalShell, Pill, Segmented,
  SelectInput, Textarea,
} from "../../ui";
import { InfoNote, VocabInput } from "./bits";
import {
  MANUAL_VIA, SOURCES, STATES, VOCAB, createEnquiry, findEarlierFrom, knownCategory, knownCity,
  place, sourceOf, statusOf,
} from "./store";

export default function NewEnquiryModal({ onClose, onDone }: {
  onClose: () => void;
  onDone: (id: string, msg: string) => void;
}) {
  const [source, setSource] = useState("own");
  const [via, setVia] = useState(MANUAL_VIA[0].key);
  const [f, setF] = useState({
    name: "", phone: "", email: "",
    category: "", service: "", city: "", state: "", locality: "", pincode: "",
    projectType: "", intent: "", urgency: "", text: "",
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const src = sourceOf(source);

  /* Live, as the number is typed — so the operator has this person's history in
     front of them while they are still on the call, which is when it is worth
     something. It does not block anything. */
  const earlier = useMemo(() => findEarlierFrom(f.phone), [f.phone]);

  const needsName = !f.name.trim();
  const needsPhone = f.phone.replace(/[^0-9]/g, "").length < 10;
  const blocked = needsName || needsPhone;

  /* THIS ONE REACHES THE SERVER, which is why it has a busy state and a failure
     state and none of the other actions in this module do. A create that
     silently did nothing would leave the operator believing a customer is on
     record when nobody is, and a second click while the first is in flight is
     how you get the duplicate this form is built to prevent. */
  const submit = async () => {
    if (blocked || busy) { setTouched(true); return; }
    setBusy(true);
    setErr("");
    try {
      const id = await createEnquiry({ source, via: src.manual ? via : null, ...f });
      onDone(id, "Enquiry " + id + " created — it is yours, and it still needs qualifying.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The enquiry was not created.");
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Add an enquiry"
      sub="For a call, a walk-in or a referral — anything that did not come through a form."
      ico="plus"
      tone="brand"
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" data-close="1" isDisabled={busy} onClick={onClose}>Cancel</Button>
          <Button color="primary" ico="plus" data-act="be-create-go" isLoading={busy} onClick={submit}>
            Create enquiry
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {err ? <Alert tone="bad" title="The enquiry was not created.">{err}</Alert> : null}

        {/* --------------------------------------------------------- source --- */}
        {/* One control, and the descriptions behind an (i). They were four cards
            carrying a sentence each — a paragraph of reading before the first
            field, every time, for a choice that is usually obvious. The
            explanation still exists for the once it is not. */}
        <FormSection title="Where did it come from?">
          <FormField
            label="Source"
            req
            tip={
              <InfoDot label="What do these mean?">
                {SOURCES.map((x) => (
                  <p key={x.key}><b>{x.label}</b> — {x.help}</p>
                ))}
              </InfoDot>
            }
          >
            <Segmented
              label="Source"
              value={source}
              onPick={setSource}
              options={SOURCES.map((x) => ({ v: x.key, l: x.label, ico: x.manual ? "user" : undefined }))}
            />
          </FormField>

          {src.manual ? (
            <FormField id="ne-via" label="How did it reach us?" req
              hint="“Added by us” on its own is not provenance — it is the absence of it. This is the line that answers “where did this actually come from?” a year from now.">
              <SelectInput id="ne-via" value={via} onChange={setVia}
                options={MANUAL_VIA.map((m) => ({ v: m.key, l: m.label }))} />
            </FormField>
          ) : (
            <InfoNote tone="warn" ico="alert"
              short={<>This channel normally posts to the intake endpoint itself.</>}>
              Adding one by hand is for a submission that was lost, or that arrived by another route. It
              will still be marked as typed by you, because it was.
            </InfoNote>
          )}
        </FormSection>

        {/* ------------------------------------------------------- customer --- */}
        <FormSection title="Who is calling">
          <FieldRow cols={3}>
            <FormField id="ne-name" label="Customer name" req
              err={touched && needsName ? "A name is required." : undefined}>
              <Input id="ne-name" value={f.name} autoFocus err={touched && needsName}
                onChange={set("name")} />
            </FormField>
            <FormField id="ne-phone" label="Phone" req
              hint={touched && needsPhone ? undefined : "Matched against every existing enquiry as you type."}
              err={touched && needsPhone
                ? "Ten digits at least. The phone number is how this customer is identified and de-duplicated."
                : undefined}>
              <Input id="ne-phone" value={f.phone} type="tel" ph="+91 …" mono
                err={touched && needsPhone} onChange={set("phone")} />
            </FormField>
            <FormField id="ne-email" label="Email">
              <Input id="ne-email" value={f.email} ph="—" onChange={set("email")} />
            </FormField>
          </FieldRow>
        </FormSection>

        {/* ---------------------------------------------------- requirement --- */}
        <FormSection title="What they want"
          desc="Everything here is optional. You are probably still on the call — a field you cannot answer yet is one you will guess at, and a guess is worse than a blank.">
          <FieldRow cols={2}>
            <VocabInput id="ne-cat" label="Category" value={f.category}
              options={VOCAB.categories} onChange={set("category")}
              known={knownCategory} placeholder="Interior Design, Modular Kitchen…"
              unknownNote="Not a category the matching rules know. Stage 1 eliminates on this, so it will match nobody until the category list catches up — worth recording anyway, and worth telling whoever maintains that list." />
            <FormField id="ne-svc" label="Service">
              <Input id="ne-svc" value={f.service} ph="Full home interiors, bathroom…"
                onChange={set("service")} />
            </FormField>
          </FieldRow>

          <FieldRow cols={2}>
            <VocabInput id="ne-city" label="City" value={f.city}
              options={VOCAB.cities} onChange={set("city")}
              known={knownCity} placeholder="New Delhi, Pune…"
              unknownNote="Not a city we currently match on. The enquiry is still worth recording — it is exactly the evidence that says where coverage is missing." />
            <VocabInput id="ne-state" label="State" value={f.state}
              options={STATES} onChange={set("state")} placeholder="Maharashtra…" />
          </FieldRow>

          <FieldRow cols={3}>
            <FormField id="ne-loc" label="Locality">
              <Input id="ne-loc" value={f.locality} onChange={set("locality")} />
            </FormField>
            <FormField id="ne-pin" label="PIN code">
              <Input id="ne-pin" value={f.pincode} ph="—" onChange={set("pincode")} />
            </FormField>
            <FormField id="ne-proj" label="Project type">
              <Input id="ne-proj" value={f.projectType} ph="Residential · 3BHK"
                onChange={set("projectType")} />
            </FormField>
          </FieldRow>

          <FormField id="ne-urg" label="Urgency">
            <SelectInput id="ne-urg" value={f.urgency} ph="— not established yet —"
              options={VOCAB.urgency.map((u) => ({ v: u.key, l: u.label }))}
              onChange={set("urgency")} />
          </FormField>

          <FormField id="ne-text" label="What did they ask for?">
            <Textarea id="ne-text" rows={3} value={f.text}
              ph="In their words, as close as you can." onChange={set("text")} />
          </FormField>
        </FormSection>

        {/* ------------------------------------------------ their history --- */}
        {/* NOT A DUPLICATE WARNING. A customer who comes back is the best kind
            there is, and a second enquiry from one number is usually a second
            piece of work — a bathroom after a kitchen, a parent's flat after
            their own. This is here so the person on the call knows that, not so
            they hesitate before recording it. If it really is the same job typed
            twice, they can say so with the Duplicate suspected tag. */}
        {earlier.length ? (
          <FormSection title="This customer before">
            <Alert tone="info"
              title={<>This customer has enquired {earlier.length === 1 ? "once" : earlier.length + " times"} before.</>}>
              Worth knowing on the call. Recording this one is still right — a second enquiry is
              usually a second job, and it goes through qualification like any other.
            </Alert>
            <ul className="flex flex-col divide-y divide-border-secondary rounded-lg bg-secondary px-3">
              {earlier.map((x) => (
                <li key={x.enquiryId} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 text-sm">
                  <span className="font-mono text-xs text-tertiary">{x.enquiryId}</span>
                  <span className="min-w-0 flex-1 truncate text-secondary">
                    {x.customer.name} · {x.requirement.category || "—"} · {place(x)}
                  </span>
                  <Pill xs tone="neutral" text={statusOf(x.status).label} />
                </li>
              ))}
            </ul>
          </FormSection>
        ) : null}

        <InfoNote ico="shield"
          short={<><b>It still has to be qualified.</b> This lands in <b>New</b> with an empty checklist.</>}>
          No snapshot, exactly like a funnel submission — even though you have just spoken to the
          customer. Typing it yourself buys no shortcut past the gate, because the gate is what a
          business is trusting when it accepts the enquiry.
        </InfoNote>
      </div>
    </ModalShell>
  );
}
