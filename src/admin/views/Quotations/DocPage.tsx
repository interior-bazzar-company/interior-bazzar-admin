/* =====================================================================
   THE DOCUMENT PAGE — the prototype's preview() screen, for a quotation or
   an invoice. Full width, the sheet on its stage, the version rail above it,
   and two controls: the way out, and a kebab holding everything else.

   Back stays a button because it is the one control you reach for without
   reading — everything else (issue, share, copy, save) goes behind the dots,
   the same popover the detail pages already use.

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
import { useShell } from "../../shell/ShellContext";
import { Mi } from "../Deals/bits";
import { errMessage } from "../../../api/apiService";

export default function DocPage({ label, scope, fetchHtml, back, menu, rail, banner }: {
  label: string;
  scope: ReactNode;
  fetchHtml: () => Promise<{ html: string }>;
  /* The way out. The only thing still rendered as a button. */
  back: () => void;
  /* `<Mi>` rows for the kebab. Save as PDF is appended here, not passed in —
     it belongs to this component, which owns the frame that prints. */
  menu: ReactNode;
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
  const { openPop, closePop, popAnchor } = useShell();

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
          <button className="btn" onClick={back}><Icon name="chevl" />Back</button>
          {/* One press on the anchor opens it, a second closes it — the rule the
              detail pages' kebabs already follow. The rows close the popover by
              bubbling: an action that leaves its own menu open over the dialog
              it just opened is the bug that rule exists for. */}
          {/* data-act is load-bearing, not decoration: the shell's outside-click
              listener closes the popover on any click that is neither inside
              .pop nor on a [data-act] element — and the press that OPENS it
              reaches document after React has already mounted that listener.
              Without the attribute the menu opens and shuts on one click. */}
          <button className="btn icon" data-act="doc-more" aria-haspopup="menu" aria-label="More actions"
            title="More actions"
            onClick={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (popAnchor === el) return closePop();
              openPop(el, (
                <div className="pop-b" onClick={closePop}>
                  {menu}
                  {html
                    ? <Mi ico="download" label="Save as PDF"
                        hint="Prints the sheet itself — no panel chrome" onClick={print} />
                    : null}
                </div>
              ), { width: 268, cls: "pop-views" });
            }}>
            <Icon name="dots" />
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
