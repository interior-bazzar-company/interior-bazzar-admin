/* =============================================================================
   Business Enquiries — the record's overflow menu.
   -----------------------------------------------------------------------------
   Renders into the shell's popover, and closes it before it acts: a menu still
   sitting over the dialog it just opened is the bug that made that a rule
   everywhere else in this panel.

   WHAT IS IN HERE AND WHAT IS NOT. The three dots hold the things you do WITH
   an enquiry — copy it, share it, print it, quote its reference. Everything that
   moves it through its lifecycle stays on the action bar in the open, because a
   state change hidden behind an overflow menu is a state change nobody audits
   and nobody expects. Nothing in this menu changes the record, which is exactly
   why it can live somewhere quieter.

   TWO WAYS OUT, FOR TWO DIFFERENT PLACES.

     · Copy detail  → plain text, for a chat box. No markdown, because *bold*
                      renders in one app and shows as punctuation in every other.
     · Download     → a PNG card, for the same chat box when a picture reads
                      better than eighteen lines of text. It carries NO company
                      name: the reference identifies it, and whoever receives it
                      already knows who sent it.
     · Print sheet  → the A4 document, which DOES carry the company name and
                      should. It is an internal record, not a thing forwarded to
                      a chat, and the distinction is the whole reason both exist.

   All three are built from the same field selection, and none of them carries
   the contact log, the remarks, the match score, the rank, or who else was
   eligible.
   ============================================================================= */
import { Icon, copyToClipboard, printHtml } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import { enquirySheetHtml, shareLine, shareText } from "./share";
import { downloadEnquiryImage } from "./imageSheet";
import type { Enquiry } from "./store";

/* THE COPY ACTION, once. It is reached from two places — the button in the
   record header and the row in this menu — and both go through here so they
   cannot drift.

   `copyToClipboard` reports what actually happened rather than assuming: on an
   origin where the async clipboard is refused (`vite --host` on a LAN IP is
   one) it falls back to selecting the text and telling the user to press
   Ctrl+C. Saying "Copied." over a clipboard that was never written is the
   failure worth avoiding, so the toast is whatever it reports. */
export function useCopy() {
  const shell = useShell();
  return (text: string, said: string) => {
    copyToClipboard(text).then((msg) =>
      shell.toast(msg === "Copied." ? said : msg, msg === "Copied." ? undefined : "warn"));
  };
}

export function RecordMenu({ e }: { e: Enquiry }) {
  const shell = useShell();
  const doCopy = useCopy();

  const run = (fn: () => void) => { shell.closePop(); fn(); };

  const copy = (text: string, said: string) => run(() => doCopy(text, said));

  return (
    <div className="pop-b">
      {/* First, because it is the one anyone actually reaches for. */}
      <button className="mi" onClick={() => copy(shareText(e), "Enquiry copied — paste it into WhatsApp.")}>
        <Icon name="out" />
        <span>
          <b>Copy detail</b>
          <span className="d">Contact, requirement and their own words — plain text, for WhatsApp</span>
        </span>
      </button>

      <button className="mi" onClick={() => copy(shareLine(e), "One-line summary copied.")}>
        <Icon name="doc" />
        <span>
          <b>Copy one line</b>
          <span className="d">Reference, name, phone, category, location</span>
        </span>
      </button>

      <button className="mi" onClick={() => copy(e.enquiryId, "Reference copied.")}>
        <Icon name="link" />
        <span>
          <b>Copy reference</b>
          <span className="d mono">{e.enquiryId}</span>
        </span>
      </button>

      <div className="pop-sep" />

      <button className="mi" onClick={() => run(() => {
        shell.toast("Building the image…");
        downloadEnquiryImage(e)
          .then(() => shell.toast("Image saved — attach it in any chat."))
          /* A canvas can fail for reasons the user can do nothing about, and a
             silent no-op after a click reads as a broken button. */
          .catch(() => shell.toast("Could not build the image. Use Print sheet instead.", "bad"));
      })}>
        <Icon name="download" />
        <span>
          <b>Download image</b>
          <span className="d">A PNG card to attach in a chat · no company name on it</span>
        </span>
      </button>

      <button className="mi" onClick={() => run(() =>
        printHtml(enquirySheetHtml(e), e.enquiryId + " — enquiry"))}>
        <Icon name="doc" />
        <span>
          <b>Print sheet</b>
          <span className="d">A4 document — choose “Save as PDF” in the print dialog</span>
        </span>
      </button>

      <div className="pop-note">
        All three carry the customer's phone number. None carries the contact log, the remarks, the
        score, or who else was eligible.
      </div>
    </div>
  );
}
