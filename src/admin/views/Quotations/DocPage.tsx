/* =====================================================================
   THE DOCUMENT PAGE — one screen, two modules: a quotation or an invoice
   as the customer receives it.

   THE PAPER IS NOT THEMED. Everything else in this panel inverts; a
   document does not, because the customer's copy is white with black type
   whatever the agent's monitor is set to. The sheet is fetched from the
   server and rendered by the same template the public share link serves —
   two renderers of one document is how the agent's copy and the customer's
   copy start disagreeing about money — and it is dropped into the sandboxed
   `DocFrame` (bits.tsx), which is the ONE place the A4 measure is written.

   The chrome around it carries `data-print-hide`, so Ctrl-P on this screen
   produces the sheet and nothing else; `globals.css` owns the @page rules.
   Printing goes through the frame's own window, so the sheet's stylesheet
   does the work and there is no panel chrome to strip.
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Button, MoreMenu, PageHeader, PaneLoading } from "../../ui";
import type { MenuItem } from "../../ui";
import { errMessage } from "../../../api/apiService";
import { DocFrame, PaperStage } from "./bits";

export default function DocPage({ kind, label, scope, fetchHtml, back, backLabel, menu, rail, banner }: {
  /** the eyebrow — "Quotation", "Tax invoice" */
  kind?: string;
  label: string;
  scope: ReactNode;
  fetchHtml: () => Promise<{ html: string }>;
  /* The way out. The only thing still rendered as a button. */
  back: () => void;
  backLabel?: string;
  /* The kebab's rows. Save as PDF is appended here, not passed in — it
     belongs to this component, which owns the frame that prints. */
  menu: MenuItem[];
  rail?: ReactNode;
  /* Anything that must appear WHERE THE BUTTON WAS PRESSED — the share line,
     in practice. It used to render after this component, which put it below a
     full-height sheet: the link was minted, and pressing the button looked
     like it had done nothing at all. */
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

  const items: MenuItem[] = html
    ? menu.concat([{ icon: "print", label: "Save as PDF", title: "Prints the sheet itself — no panel chrome", act: print }])
    : menu;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div data-print-hide>
        <PageHeader
          eyebrow={kind}
          title={<span className="font-mono tnum">{label}</span>}
          meta={scope}
          actions={<>
            {items.length
              ? <MoreMenu items={items} label="Document" data-act="doc-more"
                  aria-label="Everything this document can do" />
              : null}
            <Button color="primary" ico="chevl" onClick={back}>{backLabel || "Back"}</Button>
          </>}
        />
        {rail}
        {banner}
        {err ? <Alert tone="bad" title="Could not render the document." className="mt-3">{err}</Alert> : null}
      </div>

      <PaperStage>
        {html === null
          ? (err ? null : <PaneLoading label="Rendering the document…" />)
          : <DocFrame title={label} html={html} frameRef={frame} />}
      </PaperStage>
    </div>
  );
}
