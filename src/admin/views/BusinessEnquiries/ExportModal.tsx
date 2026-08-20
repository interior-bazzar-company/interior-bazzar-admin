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
import { Icon, Notice } from "../../ui";
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
    <>
      <div className="md-h">
        <h3>Export enquiries</h3>
        <p>A CSV of what is on screen, in the order it is on screen.</p>
        <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b">
        {/* ------------------------------------------------------- scope --- */}
        <div className="be-xscope">
          <div className="n tnum">{rows.length}</div>
          <div>
            <b>{scopeSentence(wholeSet ? {} : p, rows.length, all.length)}</b>
            <div className="be-xfile mono">{name}</div>
          </div>
        </div>

        {p.business && !wholeSet ? (
          <InfoNote ico="shield" short={<><b>Scoped to {p.business}.</b> Nothing about anyone else is in it.</>}>
            This is the file to send a business about its own enquiries. The filename says whose it
            is, so it is still identifiable a week later in somebody's downloads folder.
          </InfoNote>
        ) : null}

        {narrowed ? (
          <label className="be-ackline" style={{ marginTop: "var(--space-3)" }}>
            <input type="checkbox" checked={wholeSet} onChange={(ev) => setWholeSet(ev.target.checked)} />
            <span>
              Ignore the filters and export <b>all {all.length}</b> instead.
              <span className="faint"> The file you get will not match the screen you pressed this from.</span>
            </span>
          </label>
        ) : null}

        {/* ----------------------------------------------------- columns --- */}
        <div className="be-xh">Columns</div>
        <div className="be-xgroups">
          {GROUPS.map((g) => {
            const on = g.key === "core" || groups.indexOf(g.key) >= 0;
            const locked = g.key === "core";
            return (
              <button key={g.key} type="button"
                className={"be-xgroup" + (on ? " on" : "") + (g.sensitive ? " sens" : "") +
                  (g.internal ? " intl" : "") + (locked ? " locked" : "")}
                aria-pressed={on} disabled={locked}
                onClick={() => toggle(g.key)}>
                <span className="bx" aria-hidden="true">{on ? <Icon name="check" size="sm" /> : null}</span>
                <span className="t">
                  <b>{g.label} <span className="ct">{g.cols.length}</span></b>
                  <em>{g.note}</em>
                </span>
              </button>
            );
          })}
        </div>

        {leakToBusiness ? (
          <Notice tone="bad" ico="alert" text={<>
            <b>Matching internals cannot go to {p.business}.</b> A business that can read the rank and
            score it was chosen on is a business that can argue with them — and the weight table stops
            being a rule and becomes a negotiation. Untick <b>Matching internals</b>, or export
            without the business filter for your own analysis.
          </>} />
        ) : null}

        {withContact ? (
          <Notice tone="bad" ico="alert" text={<>
            <b>This file will contain customer names, phone numbers and email addresses.</b> Once it is
            downloaded it has left everything this panel can audit or withdraw. Send it to a person, not
            to a channel, and only if they need to ring the customer.
          </>} />
        ) : null}

        <InfoNote ico="lock" short={<><b>The contact log is never exported</b>, at any tick.</>}>
          Those are our notes about a customer, written by an operator for an operator. The only line
          meant for anyone else to read is the requirement summary, and that is in the Requirement
          group. The same rule governs Copy and Print, deliberately, so there is one answer to
          “what can leave” rather than three.
        </InfoNote>

        {/* ---------------------------------------------------- a preview --- */}
        {rows.length ? (
          <>
            <div className="be-xh">First rows</div>
            <div className="be-xprev">
              {rows.slice(0, 3).map((e) => (
                <div key={e.enquiryId}>
                  <span className="mono">{e.enquiryId}</span>
                  <span>{withContact ? e.customer.name : <em>name withheld</em>}</span>
                  <span className="faint">{statusOf(e.status).label}</span>
                </div>
              ))}
              {rows.length > 3 ? <div className="faint">…and {rows.length - 3} more</div> : null}
            </div>
          </>
        ) : (
          <Notice tone="warn" ico="alert" text={<>
            <b>Nothing matches these filters.</b> The file would have a header row and nothing under it.
          </>} />
        )}
      </div>

      <div className="md-f">
        <span className="faint" style={{ fontSize: "var(--text-sm)" }}>
          {rows.length} row{rows.length === 1 ? "" : "s"} · {cols} column{cols === 1 ? "" : "s"}
        </span>
        <span className="spacer" />
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className={"btn pri" + (withContact ? " dgr" : "")} data-act="be-export-go"
          disabled={!rows.length || leakToBusiness} onClick={run}>
          <Icon name="download" />
          {withContact ? "Download with contact data" : "Download CSV"}
        </button>
      </div>
    </>
  );
}

/* Whether this actor may export at all. The module spec makes a broad export an
   Admin action; the panel greys rather than hides it, because a missing button
   reads as a missing feature and this one is a permission. */
export const canExport = () => can("business-enquiries", "export") || can("business-enquiries", "close");
