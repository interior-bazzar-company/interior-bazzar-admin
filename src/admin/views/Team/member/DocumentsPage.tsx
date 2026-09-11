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
import { Alert, Button, ListTable, Pill, Rail } from "../../../ui";
import { useShell } from "../../../shell/ShellContext";
import {
  REQUIRED_DOCS, DOCUMENT_KIND, deleteDocument, fmtDate, labelOf, missingDocs, readMember,
  documentsFor, useDocuments, verifyDocument,
} from "../store";
import type { Member, MemberDocument } from "../store";
import type { Viewer } from "./ops";
import { OpHead } from "./frame";
import { AddDocumentModal } from "./modals";

export default function DocumentsPage({ m, viewer }: { m: Member; viewer: Viewer }) {
  const shell = useShell();
  useDocuments();
  const all = documentsFor(m.memberId);
  const missing = missingDocs(m.memberId);
  const other = all.filter((r) => REQUIRED_DOCS.indexOf(r.kind) < 0);
  const unverified = all.filter((r) => !r.verifiedById);

  const remove = (r: MemberDocument) => {
    const x = deleteDocument(r.documentId);
    shell.toast(x.ok ? "Deleted." : (x as { message: string }).message, x.ok ? "" : "bad");
  };
  const verify = (r: MemberDocument) => {
    const x = verifyDocument(r.documentId);
    shell.toast(x.ok ? "Marked as checked." : (x as { message: string }).message, x.ok ? "" : "bad");
  };

  return (
    <div className="flex flex-col gap-5">
      <OpHead
        title="Documents"
        desc="Member to company. These are theirs to give and theirs to withdraw."
        right={viewer === "self"
          ? (
            <Button color="primary" ico="plus"
              onClick={() => shell.modal(<AddDocumentModal memberId={m.memberId} />)}>
              Add a document
            </Button>
          )
          : null} />

      <Alert tone="warn" ico="lock" title="Nothing here is downloadable from this panel yet, and that is on purpose">
        Every stored object in this backend is readable by anyone holding its URL. Identity documents
        need private objects behind a signed, short-lived read, and the open control arrives with
        that and not before it.
      </Alert>

      {/* REQUIRED FIRST, and the missing ones are rows rather than a warning
          banner — a banner says "two missing" and a row says WHICH two and
          gives the person the button that fixes it. */}
      <section className="flex flex-col">
        <OpHead
          title="Required"
          desc={missing.length
            ? missing.length + " of " + REQUIRED_DOCS.length + " still to come. Nothing in the panel blocks on it."
            : "All " + REQUIRED_DOCS.length + " are in."} />
        <ListTable min="56rem" head={<tr>
          <th className="rail" />
          <th scope="col">Document</th>
          <th scope="col">State</th>
          <th scope="col">Added</th>
          <th scope="col">Checked by</th>
          <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
        </tr>}>
          {REQUIRED_DOCS.map((kind) => {
            const r = all.filter((x) => x.kind === kind)[0] || null;
            return (
              <tr key={kind}>
                <Rail tone={r ? undefined : "warn"} title={r ? undefined : "Still to come"} />
                <td className="cell-1">
                  {labelOf(DOCUMENT_KIND, kind)}
                  <span className="block cell-2">{r ? r.label + " · " + r.sizeKb + " KB" : "required"}</span>
                </td>
                <td>{r
                  ? <Pill xs dot tone="ok" text="Handed over" />
                  : <Pill xs dot tone="warn" text="Not uploaded" />}</td>
                <td className="tnum">{r ? fmtDate(r.uploadedAt.slice(0, 10)) : <span className="text-quaternary">—</span>}</td>
                <td><Checked r={r} /></td>
                <td className="acts">
                  <span className="inline-flex items-center gap-2">
                    {!r && viewer === "self" ? (
                      <Button color="primary" size="xs" ico="upload" onClick={() =>
                        shell.modal(<AddDocumentModal memberId={m.memberId} kind={kind} />)}>Upload</Button>
                    ) : null}
                    {r && viewer === "admin" && !r.verifiedById ? (
                      <Button color="secondary" size="xs" onClick={() => verify(r)}>Mark as checked</Button>
                    ) : null}
                    {r && viewer === "self" ? (
                      <Button color="secondary" size="xs" onClick={() =>
                        shell.modal(<AddDocumentModal memberId={m.memberId} kind={kind} />)}>Replace</Button>
                    ) : null}
                  </span>
                </td>
              </tr>
            );
          })}
        </ListTable>
      </section>

      <section className="flex flex-col">
        <OpHead
          title="Everything else"
          desc="Not required. The member may delete these at any time — they gave them." />
        <ListTable min="56rem" head={<tr>
          <th scope="col">Document</th>
          <th scope="col">Kind</th>
          <th scope="col">Added</th>
          <th scope="col">Checked by</th>
          <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
        </tr>}>
          {other.map((r) => (
            <tr key={r.documentId}>
              <td className="cell-1">
                {r.label}
                <span className="block cell-2">{r.fileName} · {r.sizeKb} KB</span>
              </td>
              <td>{labelOf(DOCUMENT_KIND, r.kind)}</td>
              <td className="tnum">{fmtDate(r.uploadedAt.slice(0, 10))}</td>
              <td><Checked r={r} /></td>
              <td className="acts">
                <span className="inline-flex items-center gap-2">
                  {viewer === "admin" && !r.verifiedById
                    ? <Button color="secondary" size="xs" onClick={() => verify(r)}>Mark as checked</Button> : null}
                  {viewer === "self"
                    ? <Button color="secondary-destructive" size="xs" onClick={() => remove(r)}>Delete</Button> : null}
                </span>
              </td>
            </tr>
          ))}
          {other.length ? null : (
            <tr>
              <td colSpan={5} className="p-0!">
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-medium text-primary">Nothing else</p>
                  <p className="mt-1 text-sm text-tertiary">Only the required documents are on this record.</p>
                </div>
              </td>
            </tr>
          )}
        </ListTable>
      </section>

      {unverified.length && viewer === "admin" ? (
        <p className="text-xs text-quaternary">
          {unverified.length} document{unverified.length > 1 ? "s have" : " has"} not been checked
          against the original. Checking is a person saying they looked; it is not a validation the
          panel can perform.
        </p>
      ) : null}

      {viewer === "self" ? (
        <p className="text-xs text-quaternary">
          Only you and a holder of the document-reading grant can open these. A required document
          cannot be removed while you are active — the rest are yours to take back.
        </p>
      ) : null}
    </div>
  );
}

function Checked({ r }: { r: MemberDocument | null }) {
  if (!r) return <span className="text-quaternary">—</span>;
  if (!r.verifiedById) return <Pill xs dot tone="warn" text="Not checked" />;
  const by = readMember(r.verifiedById);
  return (
    <>
      <span className="font-medium text-primary">{by ? by.name : "checked"}</span>
      <span className="block cell-2 tnum">{r.verifiedAt ? fmtDate(r.verifiedAt.slice(0, 10)) : ""}</span>
    </>
  );
}
