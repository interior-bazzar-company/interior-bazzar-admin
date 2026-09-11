/* =============================================================================
   Business Enquiries — the record's overflow menu, in its two placements.
   -----------------------------------------------------------------------------
   WHAT IS IN HERE AND WHAT IS NOT. The overflow holds the things you do WITH an
   enquiry — copy it, share it, print it, quote its reference. Everything that
   moves it through its lifecycle stays on the record in the open, because a
   state change hidden behind an overflow menu is a state change nobody audits
   and nobody expects. Nothing in either menu changes the record, which is
   exactly why both can live somewhere quieter.

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

   All of them are built from the same field selection, and none carries the
   contact log, the remarks, the match score, the rank, or who else was eligible.

   TWO PLACEMENTS, ONE ACTION LIST. `RecordMenu` is the body of the shell's own
   popover — the record header hands the shell an anchor and this fills it, so
   the menu can be as wide as its descriptions need. `RowMenu` is the same
   actions in a queue row, on the shared `MoreMenu` (React Aria's Menu), where
   there is room for a verb and nothing else. `useEnquiryActions` is the single
   list both read, so the two can never offer different things.
   ============================================================================= */
import { copyToClipboard, MenuDivider, MenuRow, MenuSection, MoreMenu, printHtml } from "../../ui";
import type { MenuItem } from "../../ui";
import { PopBody, useShell } from "../../shell/ShellContext";
import { enquirySheetHtml, shareLine, shareText } from "./share";
import { downloadEnquiryImage } from "./imageSheet";
import type { Enquiry } from "./store";

/* THE COPY ACTION, once. It is reached from several places — the record header,
   the queue row — and all of them go through here so they cannot drift.

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

/** Every way an enquiry leaves this panel, as one list. `after` runs before
 *  each action — the record header uses it to close the popover it was opened
 *  from, because a menu still sitting over the dialog it just opened is the bug
 *  that made that a rule everywhere else in this panel. */
export function useEnquiryActions(e: Enquiry, after?: () => void): MenuItem[] {
  const shell = useShell();
  const doCopy = useCopy();
  const run = (fn: () => void) => () => { if (after) after(); fn(); };
  const copy = (text: string, said: string) => run(() => doCopy(text, said));

  return [
    { icon: "out", label: "Copy detail", title: "Contact, requirement and their own words — plain text, for WhatsApp", act: copy(shareText(e), "Enquiry copied — paste it into WhatsApp.") },
    { icon: "doc", label: "Copy one line", title: "Reference, name, phone, category, location", act: copy(shareLine(e), "One-line summary copied.") },
    { icon: "link", label: "Copy reference", title: e.enquiryId, act: copy(e.enquiryId, "Reference copied.") },
    {
      icon: "download",
      label: "Download image",
      title: "A PNG card to attach in a chat · no company name on it",
      act: run(() => {
        shell.toast("Building the image…");
        downloadEnquiryImage(e)
          .then(() => shell.toast("Image saved — attach it in any chat."))
          /* A canvas can fail for reasons the user can do nothing about, and a
             silent no-op after a click reads as a broken button. */
          .catch(() => shell.toast("Could not build the image. Use Print sheet instead.", "bad"));
      }),
    },
    {
      icon: "print",
      label: "Print sheet",
      title: "A4 document — choose “Save as PDF” in the print dialog",
      act: run(() => printHtml(enquirySheetHtml(e), e.enquiryId + " — enquiry")),
    },
  ];
}

/* ------------------------------------------------------ the record menu --- */
/* The body of the shell's popover: the same actions with the sentence that says
   which one to reach for, which is the whole reason this placement is wider
   than a row menu. */
export function RecordMenu({ e }: { e: Enquiry }) {
  const shell = useShell();
  const items = useEnquiryActions(e, shell.closePop);
  const [copyDetail, copyLine, copyRef, ...sheets] = items;

  return (
    <PopBody>
      <MenuSection title="Copy">
        <MenuRow ico={copyDetail.icon} label={copyDetail.label} desc={copyDetail.title} onClick={copyDetail.act} />
        <MenuRow ico={copyLine.icon} label={copyLine.label} desc={copyLine.title} onClick={copyLine.act} />
        <MenuRow ico={copyRef.icon} label={copyRef.label} desc={<span className="font-mono">{e.enquiryId}</span>} onClick={copyRef.act} />
      </MenuSection>
      <MenuDivider />
      <MenuSection title="Take it out">
        {sheets.map((it) => (
          <MenuRow key={it.label} ico={it.icon} label={it.label} desc={it.title} onClick={it.act} />
        ))}
      </MenuSection>
      <p className="border-t border-secondary px-4 py-3 text-xs text-tertiary">
        All of these carry the customer's phone number. None carries the contact log, the remarks, the
        score, or who else was eligible.
      </p>
    </PopBody>
  );
}

/* --------------------------------------------------------- the row menu --- */
/* The same actions in a queue row. `Open` leads because from a list that is
   what the menu is most often reached for, and it is the one entry the record
   header does not need. */
export function RowMenu({ e, to, onOpen }: { e: Enquiry; to: string; onOpen: (to: string) => void }) {
  const items = useEnquiryActions(e);
  return (
    <MoreMenu
      small
      items={[{ icon: "arrow", label: "Open enquiry", title: e.enquiryId, act: () => onOpen(to) }, ...items]}
    />
  );
}
