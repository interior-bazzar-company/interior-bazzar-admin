/* =============================================================================
   /team/:id/documents — what the member handed over.
   -----------------------------------------------------------------------------
   THE MOST SENSITIVE SURFACE IN THE MODULE. These are government identity
   papers: a PAN card, an Aadhaar, a bank passbook. Two things follow from that
   and neither is negotiable.

   · **The page is not on a senior's view at all.** Not greyed, not "no access"
     — absent, and the URL is refused with the same sentence. A reporting line
     is not a grant to read somebody's Aadhaar.
   · **No public URL, ever.** Every other file in this panel is a publicly
     readable object; these must be private objects behind a short-lived signed
     read. Until that exists there is no open/download control here, because a
     button that worked would be the leak.

   REQUIRED IS A VOCABULARY, NOT A GATE. Which kinds are required is a list in
   vocabularies.json, so it changes without a deploy — and NOTHING in the panel
   blocks on it. A hard gate would stop somebody working on their first day over
   a missing scan. It shows as missing here, on the roster row and in the
   roster's filter, and that is the whole enforcement.
   ============================================================================= */
import { Icon, Notice, Pill, Table } from "../../../ui";
import { useShell } from "../../../shell/ShellContext";
import {
  REQUIRED_DOCS, RESOURCE_KIND, deleteResource, fmtDate, labelOf, missingDocs, readMember,
  resourcesFor, useResources, verifyResource,
} from "../store";
import type { Member, Resource } from "../store";
import type { Viewer } from "./ops";
import { OpHead } from "./frame";
import { AddResourceModal } from "./modals";

export default function DocumentsPage({ m, viewer }: { m: Member; viewer: Viewer }) {
  const shell = useShell();
  useResources();
  const all = resourcesFor(m.memberId);
  const missing = missingDocs(m.memberId);
  const other = all.filter((r) => REQUIRED_DOCS.indexOf(r.kind) < 0);
  const unverified = all.filter((r) => !r.verifiedById);

  const remove = (r: Resource) => {
    const x = deleteResource(r.resourceId);
    shell.toast(x.ok ? "Deleted." : (x as { message: string }).message, x.ok ? "" : "bad");
  };
  const verify = (r: Resource) => {
    const x = verifyResource(r.resourceId);
    shell.toast(x.ok ? "Marked as checked." : (x as { message: string }).message, x.ok ? "" : "bad");
  };

  return (
    <>
      <OpHead
        title="Documents"
        desc="Member to company. These are theirs to give and theirs to withdraw."
        right={viewer === "self"
          ? <button className="btn pri" onClick={() => shell.modal(<AddResourceModal memberId={m.memberId} />)}>
            <Icon name="plus" size="sm" />Add a document
          </button>
          : null} />

      <Notice tone="warn" ico="lock" text={
        <><b>Nothing here is downloadable from this panel yet, and that is on purpose.</b> Every
          stored object in this backend is readable by anyone holding its URL. Identity documents
          need private objects behind a signed, short-lived read, and the open control arrives with
          that and not before it.</>
      } />

      {/* REQUIRED FIRST, and the missing ones are rows rather than a warning
          banner — a banner says "two missing" and a row says WHICH two and
          gives the person the button that fixes it. */}
      <div className="sh">
        <h2>Required</h2>
        <span className="d">
          {missing.length
            ? missing.length + " of " + REQUIRED_DOCS.length + " still to come. Nothing in the panel blocks on it."
            : "All " + REQUIRED_DOCS.length + " are in."}
        </span>
      </div>
      <Table
        cols={[{ label: "Document" }, { label: "State", w: "170px" }, { label: "Added", w: "150px" },
          { label: "Checked by", w: "190px" }, { label: "", w: "200px" }]}
        rows={REQUIRED_DOCS.map((kind) => {
          const r = all.filter((x) => x.kind === kind)[0] || null;
          return (
            <tr key={kind} className={r ? "" : "u-warn"}>
              <td>
                <span className="cell-1"><b>{labelOf(RESOURCE_KIND, kind)}</b></span>
                {r ? <span className="cell-2">{r.label} · {r.sizeKb} KB</span>
                  : <span className="cell-2">required</span>}
              </td>
              <td>{r
                ? <Pill text="Handed over" tone="ok" />
                : <Pill text="Not uploaded" tone="warn" />}</td>
              <td>{r ? fmtDate(r.uploadedAt.slice(0, 10)) : <span className="dim">—</span>}</td>
              <td><Checked r={r} /></td>
              <td>
                {!r && viewer === "self" ? (
                  <button className="btn sm pri" onClick={() =>
                    shell.modal(<AddResourceModal memberId={m.memberId} kind={kind} />)}>Upload</button>
                ) : null}
                {r && viewer === "admin" && !r.verifiedById ? (
                  <button className="btn sm" onClick={() => verify(r)}>Mark as checked</button>
                ) : null}
                {r && viewer === "self" ? (
                  <button className="btn sm" onClick={() =>
                    shell.modal(<AddResourceModal memberId={m.memberId} kind={kind} />)}>Replace</button>
                ) : null}
              </td>
            </tr>
          );
        })} />

      <div className="sh">
        <h2>Everything else</h2>
        <span className="d">Not required. The member may delete these at any time — they gave them.</span>
      </div>
      <Table
        cols={[{ label: "Document" }, { label: "Kind", w: "170px" }, { label: "Added", w: "150px" },
          { label: "Checked by", w: "190px" }, { label: "", w: "200px" }]}
        empty={{
          icon: "doc", title: "Nothing else",
          body: "Only the required documents are on this record.",
        }}
        rows={other.map((r) => (
          <tr key={r.resourceId}>
            <td>
              <span className="cell-1"><b>{r.label}</b></span>
              <span className="cell-2">{r.fileName} · {r.sizeKb} KB</span>
            </td>
            <td>{labelOf(RESOURCE_KIND, r.kind)}</td>
            <td>{fmtDate(r.uploadedAt.slice(0, 10))}</td>
            <td><Checked r={r} /></td>
            <td>
              {viewer === "admin" && !r.verifiedById
                ? <button className="btn sm" onClick={() => verify(r)}>Mark as checked</button> : null}
              {viewer === "self"
                ? <button className="btn sm dgr" onClick={() => remove(r)}>Delete</button> : null}
            </td>
          </tr>
        ))} />

      {unverified.length && viewer === "admin" ? (
        <p className="tm-foot">
          {unverified.length} document{unverified.length > 1 ? "s have" : " has"} not been checked
          against the original. Checking is a person saying they looked; it is not a validation the
          panel can perform.
        </p>
      ) : null}

      {viewer === "self" ? (
        <p className="tm-foot">
          Only you and a holder of the document-reading grant can open these. A required document
          cannot be removed while you are active — the rest are yours to take back.
        </p>
      ) : null}
    </>
  );
}

function Checked({ r }: { r: Resource | null }) {
  if (!r) return <span className="dim">—</span>;
  if (!r.verifiedById) return <Pill text="Not checked" tone="warn" />;
  const by = readMember(r.verifiedById);
  return (
    <>
      <span className="cell-1">{by ? by.name : "checked"}</span>
      <span className="cell-2">{r.verifiedAt ? fmtDate(r.verifiedAt.slice(0, 10)) : ""}</span>
    </>
  );
}
