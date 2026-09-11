/* =============================================================================
   Business Enquiries — the export dialog.
   -----------------------------------------------------------------------------
   One job: make it impossible to press Download without knowing what is in the
   file. Three things are on screen before the button —

     · the scope, in a sentence built from the same filters the rows came from,
       so it cannot describe a set other than the one being written
     · the column groups, with contact OFF and the reason beside the tick
     · the row and column count that will actually be produced

   The whole-set escape hatch is here rather than as a second button on the
   toolbar. "Export everything" is a decision, and a decision belongs in the
   dialog where its consequence is printed next to it, not next to the filtered
   export where it is one slip away.
   ============================================================================= */
import { useState } from "react";
import { Alert, Button, Checkbox, FormSection, ModalShell, Pill, Table } from "../../ui";
import { InfoNote } from "./bits";
import { can } from "../../shell/AdminShell";
import { GROUPS, buildCsv, columnCount, downloadCsv, fileNameFor, scopeSentence } from "./exportCsv";
import { statusOf } from "./store";
import type { Enquiry, Params } from "./store";

export default function ExportModal({ filtered, all, p, onClose, onDone }: {
  /** The rows the list is showing — already filtered AND sorted. */
  filtered: Enquiry[];
  all: Enquiry[];
  p: Params;
  onClose: () => void;
  onDone: (msg: string, tone?: string) => void;
}) {
  const [groups, setGroups] = useState<string[]>(["core", "requirement", "handling", "assignment"]);
  const [wholeSet, setWholeSet] = useState(false);

  const rows = wholeSet ? all : filtered;
  const narrowed = filtered.length !== all.length;
  const withContact = groups.indexOf("contact") >= 0;
  const withMatching = groups.indexOf("matching") >= 0;
  /* The combination the dialog exists to prevent: internal matching numbers in
     a file the same dialog describes as the one to send a business. */
  const leakToBusiness = withMatching && !!p.business && !wholeSet;
  const cols = columnCount(groups);
  const name = fileNameFor(wholeSet ? {} : p, rows.length);

  const toggle = (k: string) =>
    setGroups(groups.indexOf(k) >= 0 ? groups.filter((g) => g !== k) : groups.concat([k]));

  const run = () => {
    downloadCsv(buildCsv(rows, groups), name);
    onDone(
      "Exported " + rows.length + " enquir" + (rows.length === 1 ? "y" : "ies") +
      (withContact ? " — including customer contact." : " — without customer contact."),
      withContact ? "warn" : undefined,
    );
  };

  return (
    <ModalShell
      title="Export enquiries"
      sub="A CSV of what is on screen, in the order it is on screen."
      ico="download"
      tone={withContact ? "warning" : "brand"}
      onClose={onClose}
      actions={
        <>
          <span className="mr-2 text-sm text-tertiary tnum">
            {rows.length} row{rows.length === 1 ? "" : "s"} · {cols} column{cols === 1 ? "" : "s"}
          </span>
          <Button color="secondary" data-close="1" onClick={onClose}>Cancel</Button>
          <Button color={withContact ? "primary-destructive" : "primary"} ico="download"
            data-act="be-export-go" isDisabled={!rows.length || leakToBusiness} onClick={run}>
            {withContact ? "Download with contact data" : "Download CSV"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ----------------------------------------------------------- scope --- */}
        <div className="flex items-center gap-4 rounded-xl bg-secondary p-4">
          <span className="text-display-xs font-semibold text-primary tnum">{rows.length}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary">{scopeSentence(wholeSet ? {} : p, rows.length, all.length)}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-tertiary">{name}</p>
          </div>
        </div>

        {p.business && !wholeSet ? (
          <InfoNote ico="shield" short={<><b>Scoped to {p.business}.</b> Nothing about anyone else is in it.</>}>
            This is the file to send a business about its own enquiries. The filename says whose it
            is, so it is still identifiable a week later in somebody's downloads folder.
          </InfoNote>
        ) : null}

        {narrowed ? (
          <Checkbox
            id="be-wholeset"
            checked={wholeSet}
            onChange={setWholeSet}
            label={<>Ignore the filters and export <b className="font-semibold">all {all.length}</b> instead.</>}
            hint="The file you get will not match the screen you pressed this from."
          />
        ) : null}

        {/* --------------------------------------------------------- columns --- */}
        <FormSection title="Columns"
          desc="Identity and status is always written — a row nobody can identify is not a record.">
          <div className="flex flex-col gap-3">
            {GROUPS.map((g) => {
              const on = g.key === "core" || groups.indexOf(g.key) >= 0;
              const locked = g.key === "core";
              return (
                <Checkbox
                  key={g.key}
                  id={"be-xg-" + g.key}
                  checked={on}
                  disabled={locked}
                  onChange={() => toggle(g.key)}
                  label={
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {g.label}
                      <Pill xs tone="neutral" text={String(g.cols.length)} />
                      {g.sensitive ? <Pill xs tone="bad" text="personal data" /> : null}
                      {g.internal ? <Pill xs tone="warn" text="internal only" /> : null}
                      {locked ? <Pill xs tone="neutral" ico="lock" text="always" /> : null}
                    </span>
                  }
                  hint={g.note}
                />
              );
            })}
          </div>
        </FormSection>

        {leakToBusiness ? (
          <Alert tone="bad" title={"Matching internals cannot go to " + p.business + "."}>
            A business that can read the rank and score it was chosen on is a business that can argue
            with them — and the weight table stops being a rule and becomes a negotiation. Untick{" "}
            <b>Matching internals</b>, or export without the business filter for your own analysis.
          </Alert>
        ) : null}

        {withContact ? (
          <Alert tone="bad" title="This file will contain customer names, phone numbers and email addresses.">
            Once it is downloaded it has left everything this panel can audit or withdraw. Send it to a
            person, not to a channel, and only if they need to ring the customer.
          </Alert>
        ) : null}

        <InfoNote ico="lock" short={<><b>The contact log is never exported</b>, at any tick.</>}>
          Those are our notes about a customer, written by an operator for an operator. The only line
          meant for anyone else to read is the requirement summary, and that is in the Requirement
          group. The same rule governs Copy and Print, deliberately, so there is one answer to
          “what can leave” rather than three.
        </InfoNote>

        {/* -------------------------------------------------------- a preview --- */}
        {rows.length ? (
          <FormSection title="First rows">
            <Table
              list
              min="24rem"
              cols={[{ label: "Reference" }, { label: "Customer" }, { label: "Status" }]}
              rows={rows.slice(0, 3).map((e) => (
                <tr key={e.enquiryId}>
                  <td className="mono">{e.enquiryId}</td>
                  <td>{withContact ? e.customer.name : <span className="text-quaternary italic">name withheld</span>}</td>
                  <td className="faint">{statusOf(e.status).label}</td>
                </tr>
              ))}
            />
            {rows.length > 3 ? (
              <p className="text-xs text-quaternary">…and {rows.length - 3} more</p>
            ) : null}
          </FormSection>
        ) : (
          <Alert tone="warn" title="Nothing matches these filters.">
            The file would have a header row and nothing under it.
          </Alert>
        )}
      </div>
    </ModalShell>
  );
}

/* Whether this actor may export at all. The module spec makes a broad export an
   Admin action; the panel greys rather than hides it, because a missing button
   reads as a missing feature and this one is a permission. */
export const canExport = () => can("business-enquiries", "export") || can("business-enquiries", "close");
