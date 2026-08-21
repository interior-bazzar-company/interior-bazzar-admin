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

     · a submission id, prefixed `man-` so the origin is legible in the id
     · the SAME duplicate check every inbound enquiry gets — run as you type the
       phone number, shown before the record exists rather than reported after
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
import { Icon, Notice } from "../../ui";
import { InfoNote, VocabInput } from "./bits";
import {
  MANUAL_VIA, SOURCES, STATES, VOCAB, createEnquiry, findDuplicates, knownCategory, knownCity,
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
  const [ack, setAck] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const src = sourceOf(source);

  /* Live, as the number is typed — the whole point is to catch it before the
     record exists rather than to report it afterwards. */
  const dupes = useMemo(() => findDuplicates(f.phone), [f.phone]);

  const needsName = !f.name.trim();
  const needsPhone = f.phone.replace(/[^0-9]/g, "").length < 10;
  const needsAck = dupes.length > 0 && !ack;
  const blocked = needsName || needsPhone || needsAck;

  const submit = () => {
    if (blocked) { setTouched(true); return; }
    const id = createEnquiry({
      source, via: src.manual ? via : null, ...f,
      duplicateAcknowledged: ack,
    });
    onDone(id, "Enquiry " + id + " created — it is yours, and it still needs qualifying.");
  };

  return (
    <>
      <div className="md-h">
        <h3>Add an enquiry</h3>
        <p>For a call, a walk-in or a referral — anything that did not come through a form.</p>
        <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b">
        {/* ------------------------------------------------------- source --- */}
        {/* Three chips on one line, and the descriptions behind an (i). They
            were four cards carrying a sentence each — a paragraph of reading
            before the first field, every time, for a choice that is usually
            obvious. The explanation still exists for the once it is not. */}
        <div className="fg">
          <label>
            Where did it come from? <span className="req">*</span>
            <button type="button" className="be-i" aria-expanded={showHelp}
              aria-label={showHelp ? "Hide the descriptions" : "What do these mean?"}
              title="What do these mean?"
              onClick={() => setShowHelp(!showHelp)}>i</button>
          </label>
          <div className="be-srcchips" role="radiogroup" aria-label="Source">
            {SOURCES.map((x) => (
              <button key={x.key} type="button" role="radio" aria-checked={source === x.key}
                className={"be-srcchip " + (x.tone || "") + (source === x.key ? " on" : "")}
                title={x.help}
                onClick={() => setSource(x.key)}>
                {x.manual ? <Icon name="user" size="sm" /> : null}{x.label}
              </button>
            ))}
          </div>
          {showHelp ? (
            <dl className="be-srchelp">
              {SOURCES.map((x) => (
                <div key={x.key}><dt>{x.label}</dt><dd>{x.help}</dd></div>
              ))}
            </dl>
          ) : null}
        </div>

        {src.manual ? (
          <div className="fg">
            <label htmlFor="ne-via">How did it reach us? <span className="req">*</span></label>
            <select id="ne-via" className="inp" value={via} onChange={(ev) => setVia(ev.target.value)}>
              {MANUAL_VIA.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
            <div className="help">
              “Added by us” on its own is not provenance — it is the absence of it. This is the line that
              answers “where did this actually come from?” a year from now.
            </div>
          </div>
        ) : (
          <InfoNote tone="warn" ico="alert"
            short={<>This channel normally posts to the intake endpoint itself.</>}>
            Adding one by hand is for a submission that was lost, or that arrived by another route. It
            will still be marked as typed by you, because it was.
          </InfoNote>
        )}

        {/* ------------------------------------------------------ customer --- */}
        <div className="be-fields" style={{ marginTop: "var(--space-4)" }}>
        <div className="be-form">
          <div className="fg">
            <label htmlFor="ne-name">Customer name <span className="req">*</span></label>
            <input id="ne-name" className={"inp" + (touched && needsName ? " bad" : "")} value={f.name}
              autoFocus onChange={(ev) => set("name")(ev.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ne-phone">Phone <span className="req">*</span></label>
            <input id="ne-phone" className={"inp" + (touched && needsPhone ? " bad" : "")} value={f.phone}
              inputMode="tel" placeholder="+91 …" onChange={(ev) => set("phone")(ev.target.value)} />
            {touched && needsPhone
              ? <div className="help bad">Ten digits at least. The phone number is how this customer is identified and de-duplicated.</div>
              : <div className="help">Matched against every existing enquiry as you type.</div>}
          </div>
          <div className="fg">
            <label htmlFor="ne-email">Email</label>
            <input id="ne-email" className="inp" value={f.email} placeholder="—"
              onChange={(ev) => set("email")(ev.target.value)} />
          </div>
          <VocabInput id="ne-cat" label="Category" value={f.category}
            options={VOCAB.categories} onChange={set("category")}
            known={knownCategory} placeholder="Interior Design, Modular Kitchen…"
            unknownNote="Not a category the matching rules know. Stage 1 eliminates on this, so it will match nobody until the category list catches up — worth recording anyway, and worth telling whoever maintains that list." />
          <div className="fg">
            <label htmlFor="ne-svc">Service</label>
            <input id="ne-svc" className="inp" value={f.service} placeholder="Full home interiors, bathroom…"
              onChange={(ev) => set("service")(ev.target.value)} />
          </div>
          <VocabInput id="ne-city" label="City" value={f.city}
            options={VOCAB.cities} onChange={set("city")}
            known={knownCity} placeholder="New Delhi, Pune…"
            unknownNote="Not a city we currently match on. The enquiry is still worth recording — it is exactly the evidence that says where coverage is missing." />
          <VocabInput id="ne-state" label="State" value={f.state}
            options={STATES} onChange={set("state")} placeholder="Maharashtra…" />
          <div className="fg">
            <label htmlFor="ne-loc">Locality</label>
            <input id="ne-loc" className="inp" value={f.locality}
              onChange={(ev) => set("locality")(ev.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ne-pin">PIN code</label>
            <input id="ne-pin" className="inp" value={f.pincode} inputMode="numeric" placeholder="—"
              onChange={(ev) => set("pincode")(ev.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ne-proj">Project type</label>
            <input id="ne-proj" className="inp" value={f.projectType} placeholder="Residential · 3BHK"
              onChange={(ev) => set("projectType")(ev.target.value)} />
          </div>
          <div className="fg">
            <label htmlFor="ne-urg">Urgency</label>
            <select id="ne-urg" className="inp" value={f.urgency} onChange={(ev) => set("urgency")(ev.target.value)}>
              <option value="">— not established yet —</option>
              {VOCAB.urgency.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
        </div>
        </div>

        <div className="fg">
          <label htmlFor="ne-text">What did they ask for?</label>
          <textarea id="ne-text" className="inp" rows={3} value={f.text}
            placeholder="In their words, as close as you can."
            onChange={(ev) => set("text")(ev.target.value)} />
          <div className="help">
            Everything above except name and phone is optional. You are probably still on the call —
            a field you cannot answer yet is one you will guess at, and a guess is worse than a blank.
          </div>
        </div>

        {/* --------------------------------------------------- duplicates --- */}
        {dupes.length ? (
          <div className="be-dupes">
            <Notice tone="bad" ico="alert" text={<>
              <b>{dupes.length} existing enquir{dupes.length === 1 ? "y has" : "ies have"} this phone number.</b>{" "}
              Creating another does not merge them — it makes a second record for one customer, and a
              business can then be assigned the same person twice.
            </>} />
            {dupes.map((x) => (
              <div className="be-dupe" key={x.enquiryId}>
                <span className="mono">{x.enquiryId}</span>
                <span>{x.customer.name} · {x.requirement.category || "—"} · {place(x)}</span>
                <span className="spacer" />
                <span className="faint">{statusOf(x.status).label}</span>
              </div>
            ))}
            <label className="be-ackline">
              <input type="checkbox" checked={ack} onChange={(ev) => setAck(ev.target.checked)} />
              <span>
                I have checked, and this is a <b>separate</b> enquiry from the same customer.
                It will be tagged <b>Duplicate suspected</b> either way.
              </span>
            </label>
            {touched && needsAck
              ? <div className="help bad">Tick the box, or close this and open the existing enquiry instead.</div>
              : null}
          </div>
        ) : null}

        <InfoNote ico="shield"
          short={<><b>It still has to be qualified.</b> This lands in <b>New</b> with an empty checklist.</>}>
          No snapshot, exactly like a funnel submission — even though you have just spoken to the
          customer. Typing it yourself buys no shortcut past the gate, because the gate is what a
          business is trusting when it accepts the enquiry.
        </InfoNote>
      </div>

      <div className="md-f">
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="be-create-go" onClick={submit}>
          <Icon name="plus" />Create enquiry
        </button>
      </div>
    </>
  );
}
