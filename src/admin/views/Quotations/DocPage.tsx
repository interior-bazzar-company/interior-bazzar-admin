/* =====================================================================
   THE DOCUMENT PAGE — the prototype's preview() screen, for a quotation or
   an invoice. Full width, the sheet on its stage, the version rail above it,
   and two controls: the way out, and the way to keep a copy.

   The sheet itself is NOT re-implemented here. It is fetched from the server,
   rendered by the same template the customer's share link serves, and dropped
   into a sandboxed frame. Two renderers of one document is how the agent's copy
   and the customer's copy start disagreeing about money — and this way "what the
   customer sees" is not an approximation, it is the same bytes.

   Printing goes to the frame, not the page: the sheet's own stylesheet already
   has the @page rules, so Ctrl-P inside it produces the PDF with no admin
   chrome to strip.
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon, Notice, PaneLoading } from "../../ui";
import { errMessage } from "../../../api/apiService";

export default function DocPage({ label, scope, fetchHtml, acts, rail, banner }: {
  label: string;
  scope: ReactNode;
  fetchHtml: () => Promise<{ html: string }>;
  acts: ReactNode;
  rail?: ReactNode;
  /* Anything that must appear WHERE THE BUTTON WAS PRESSED — the share line, in
     practice. It used to render after this component, which put it below a
     full-height sheet: the link was minted, and pressing the button looked like
     it had done nothing at all. */
  banner?: ReactNode;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let live = true;
    setHtml(null); setErr(null);
    fetchHtml()
      .then((d) => { if (live) setHtml(d.html); })
      .catch((e: unknown) => { if (live) setErr(errMessage(e)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  /* The sheet prints itself. Going through the frame keeps the panel's own
     sidebar and topbar out of the output without a single print rule here. */
  const print = () => frame.current?.contentWindow?.print();

  return (
    <div className="page qpage">
      <div className="ph">
        <div className="ph-t">
          <h1 className="mono">{label}</h1>
          <div className="scope">{scope}</div>
        </div>
        <div className="acts">
          {acts}
          <button className="btn pri" onClick={print} disabled={!html}>
            <Icon name="download" />Save as PDF
          </button>
        </div>
      </div>
      {rail}
      {banner}
      {err ? <Notice tone="bad" ico="alert" text={<><b>Could not render the document.</b> {err}</>} /> : null}
      <div className="qdoc-stage">
        {html === null
          ? (err ? null : <PaneLoading label="Rendering the document…" />)
          : <iframe ref={frame} title={label} srcDoc={html} sandbox="allow-same-origin allow-modals"
              /* Grown to the sheet's real height once it lays out: a document
                 that runs onto a second page must not end up with its own
                 scrollbar inside the panel. */
              onLoad={(e) => {
                const d = e.currentTarget.contentDocument;
                if (d) e.currentTarget.style.height = d.documentElement.scrollHeight + "px";
              }}
              style={{ width: "210mm", maxWidth: "100%", height: "297mm", border: 0,
                       background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.18), 0 12px 40px rgba(0,0,0,.22)" }} />}
      </div>
    </div>
  );
}
