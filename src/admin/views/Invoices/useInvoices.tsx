/* =============================================================================
   Invoice — the state and the ~30 `in-*` action handlers
   -----------------------------------------------------------------------------
   In the prototype these were `M["in-save-all"] = function (el) {…}` entries on
   a delegated dispatch table, and every one of them ended in `S.render()` —
   a full innerHTML rebuild that re-read the engine. Here the same call is a
   version bump: the engines are still the only source of truth, the view still
   re-reads all of it, and nothing is mirrored into component state.

   Filters live in the URL, exactly as `?doc=issued&q=foo` did. A filtered list
   has to survive a refresh and be linkable — that is why it was in the query
   string and not in a variable.
   ============================================================================= */
import { createElement, useCallback, useMemo, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useSearchParams } from "react-router-dom";
import { useNav } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { Icon, qs } from "../../ui";
import { IBData, IBInvoice } from "../../engines";
import { actor, head, inr, merge, rupees, val } from "./helpers";
import type { Refusal } from "./helpers";
import { InvoiceDoc } from "./InvoiceDoc";
import { CancelDraftModal, CancelModal, IssueModal, ProofModal, ProofRemoveModal } from "./modals";
import type { Ctx } from "./modals";

const D = IBData, N = IBInvoice;

export type Params = Record<string, string | undefined>;

export type Actions = {
  more: (r: string, anchor: HTMLElement) => void;
  saveDraft: (r: string) => void;
  create: (dealId: string) => void;
  useAmount: (amt: number, seq: string, of: string) => void;
  taxMode: (r: string, v: string) => void;
  addonAdd: (r: string) => void;
  addonDel: (r: string, itemId: string) => void;
  saveAll: (r: string) => void;
  issue: (r: string) => void;
  cancel: (r: string) => void;
  download: (r: string) => void;
  share: (r: string) => void;
  regen: (r: string) => void;
  proof: (r: string) => void;
  proofView: (r: string, proofId: string) => void;
  proofRemove: (r: string, proofId: string) => void;
  exportCsv: () => void;
};

/* Extracted from in-save-all so the three instant-write controls (tax mode,
   add/remove a charge) and the overflow menu can all carry along whatever else
   is sitting typed-but-unsaved before they do their own thing — everything in
   the builder past step 1 commits only through Save changes, and a control that
   writes immediately and re-renders would otherwise discard it silently.

   One combined patch, one call to Draft.saveAll — not four separate PUTs
   chained together. A block that is not on screen (no plan line, no addon rows)
   is left off the patch rather than sent as blank, so Draft.saveAll's own
   "undefined = don't touch" rule leaves it alone. */
function saveAllQuiet(ref: string) {
  const inv = N.invoiceOf(ref);
  if (!inv) return { ok: true };
  const patch: Record<string, unknown> = {
    invoice_date: val("nDate"), due_date: val("nDue"), place_of_supply: val("nPos"),
    gst_rate: document.getElementById("nGst") ? val("nGst") : undefined,
    notes: val("nNotes"), terms: val("nTerms"),
    payment_date: val("nPayDate"), payment_mode: val("nPayMode"), payment_reference: val("nPayRef"),
    row_version: inv.row_version
  };
  if (document.getElementById("pAmt")) {
    const preset = val("pRemark");
    patch.plan_amount_paise = rupees(val("pAmt"));
    patch.plan_remark = preset === "other" ? val("pRemarkOther") : preset;
  }
  if (document.querySelector('[id^="c-d-"]')) {
    patch.addons = N.addonsOf(ref).map(function (it: any) {
      return { item_id: it.item_id, description: val("c-d-" + it.item_id),
        hsn: val("c-h-" + it.item_id), amount_paise: rupees(val("c-a-" + it.item_id)) };
    });
  }
  return N.Draft.saveAll(ref, patch, actor());
}

/* THE FILE IS THE PAGE. Download prints the document itself — the same
   component the preview renders, under the same stylesheet — so there is no
   second renderer left to drift from. The prototype handed `printDoc` an HTML
   string; `renderToStaticMarkup` is how the component becomes that same string
   without a second implementation of the document.

   It renders in an off-screen iframe rather than the live page, so Download
   works from anywhere without first navigating somewhere the print rules
   happen to suit. */
function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function printDoc(html: string, title: string, fail: (m: string) => void) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", title || "Document");
  /* Off-screen rather than display:none — a frame that is not laid out has no
     page box, and a browser will happily print a blank sheet from one. */
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:230mm;height:320mm;border:0;opacity:0";
  document.body.appendChild(frame);

  /* Whatever the host page is wearing. The prototype only had to collect
     <link> hrefs because it was a no-build page; a bundled app serves the same
     theme as an injected <style> in dev, so both are carried across or the
     document prints unstyled exactly half the time. */
  const links: string[] = [];
  const inline: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
    const href = l.getAttribute("href"); if (href) links.push(href);
  });
  document.querySelectorAll("style").forEach((s) => inline.push(s.textContent || ""));

  const d = frame.contentDocument;
  if (!d) { frame.remove(); fail("Could not open the print frame."); return; }
  d.open();
  d.write('<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">' +
    "<title>" + esc(title || "Document") + "</title>" +
    links.map((h) => '<link rel="stylesheet" href="' + esc(h) + '">').join("") +
    inline.map((t) => "<style>" + t + "</style>").join("") +
    /* The document is already millimetre-sized and already carries its own
       print rules; this only strips the frame's own chrome and margin. */
    "<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}" +
    ".qdoc-stage{padding:0;background:#fff}" +
    ".qdoc{box-shadow:none;margin:0 auto}</style></head>" +
    '<body class="qdoc-stage">' + html + "</body></html>");
  d.close();

  const fire = () => {
    try {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
    } catch (e) {
      fail("Could not open the print dialog — " + (e as Error).message);
    }
    /* Kept until the dialog has certainly been handed the document. Removing
       it synchronously after print() cancels the job in some browsers. */
    setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 60000);
  };
  // Wait for the stylesheets and the webfonts, or the first page comes out bare.
  const w = frame.contentWindow;
  const fonts = d.fonts as FontFaceSet | undefined;
  if (fonts && fonts.ready) fonts.ready.then(() => setTimeout(fire, 60));
  else if (w) w.setTimeout(fire, 400);
}

export function useInvoices(id: string | null) {
  const [sp] = useSearchParams();
  const { go } = useNav();
  const shell = useShell();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const render = useCallback(() => bump(), []);

  const p = useMemo(() => {
    const o: Params = {};
    sp.forEach((v, k) => { o[k] = v; });
    return o;
  }, [sp]);

  /* The debounce the prototype's `input` listener had. Without it every
     keystroke is a history entry and Back stops meaning anything. */
  const pRef = useRef(p); pRef.current = p;
  const typing = useRef<number | undefined>(undefined);

  const nav = useCallback((next: Params) => {
    go("#/invoices" + (id ? "/" + id : "") + qs(next));
  }, [go, id]);

  const setFilter = useCallback((name: string, value: string) => {
    const apply = () => nav(merge(pRef.current, { [name]: value }));
    window.clearTimeout(typing.current);
    if (name === "q") typing.current = window.setTimeout(apply, 220);
    else apply();
  }, [nav]);

  const unfilter = useCallback((key: string) => {
    if (key === "*") { go("#/invoices"); return; }
    const next: Params = {};
    for (const k in pRef.current) if (k !== key) next[k] = pRef.current[k];
    go("#/invoices" + qs(next));
  }, [go]);

  /* ---------------------------------------------------------- the handlers */
  const fail = useCallback((r: Refusal) => {
    shell.toast(r.http + " " + r.code + " — " + r.detail, "bad");
  }, [shell]);

  const ctx = useMemo<Ctx>(() => ({
    toast: shell.toast,
    banner: shell.banner,
    closeLayer: shell.closeLayer,
    go,
    render,
    done: (msg: ReactNode, route?: string) => {
      shell.closeLayer(); shell.toast(msg); if (route) go(route); render();
    }
  }), [shell, go, render]);

  const act: Actions = useMemo<Actions>(() => ({

    /* The overflow, same as Module 2's. Read-only things first, then the
       destructive one, ruled off by being last. A draft has no PDF and no link
       to share — the document does not exist until it issues — so its menu is
       the two things that DO apply to an unfinished one. */
    more(r, anchor) {
      const inv = N.invoiceOf(r);
      if (!inv) return;
      const draft = inv.invoice_status === N.DOC.DRAFT;
      const mi = (a: string, ico: string, label: string, hint: string, onClick: () => void, cls?: string) => (
        <button key={a} className={"mi" + (cls ? " " + cls : "")} data-act={a} data-ref={r} onClick={onClick}>
          <Icon name={ico} />
          <span><b>{label}</b><span className="d">{hint}</span></span>
        </button>
      );
      const items = draft
        ? [
            mi("in-save-draft", "check", "Save as draft",
               "Keeps everything applied so far. No number is assigned.", () => act.saveDraft(r)),
            mi("in-cancel-draft", "x", "Cancel draft",
               "Consumes no number, so nothing dangles", () => {
                 shell.closePop(); shell.modal(<CancelDraftModal ref_={r} ctx={ctx} />);
               }, "dgr")
          ]
        : [
            mi("in-download", "download", "Download as PDF",
               "The issued document, as the customer has it", () => act.download(r)),
            mi("in-share", "link", "Share link", "An expiring link, logged as SHARED", () => act.share(r))
          ];
      shell.openPop(anchor, <div className="pop-b">{items}</div>, { width: 268, cls: "pop-views" });
    },

    saveDraft(r: string) {
      const inv = N.invoiceOf(r);
      if (!inv) return;
      const res = saveAllQuiet(r);
      if (res.ok === false) return fail(res as Refusal);
      shell.closePop();
      shell.toast("Draft saved. No number is assigned until it is issued.");
      render();
    },

    create(dealId) {
      const picked = document.querySelector('input[name="invQuote"]:checked') as HTMLInputElement | null;
      if (!picked) return shell.toast("422 quotation_required — select the quotation this invoice is raised against.", "bad");
      const r = N.Draft.create(dealId, picked.value, actor());
      if (r.ok === false) return fail(r);
      shell.toast("Draft created. No number is assigned until it is issued.");
      go("#/invoices/" + r.data.invoice_id + "?mode=edit"); render();
    },

    /* One press fills the amount AND the remark, because they are one decision:
       "this invoice is installment 2 of 4" fixes both, and typing 221250 into one
       box while remembering to pick the matching wording in another is exactly
       where a wrong pair comes from.

       It writes the fields, it does not save. The person still reads what landed
       and presses Apply — a button that silently committed money would be a worse
       shortcut than no shortcut. */
    useAmount(amt, seq, of) {
      const f = document.getElementById("pAmt") as HTMLInputElement | null;
      if (!f || !amt) return;
      f.value = String(Math.round(amt / 100));

      /* The preset list is the source of the wording; if this installment has no
         preset, it goes in as a custom remark rather than being silently dropped. */
      const want = "Installment " + seq;
      const sel = document.getElementById("pRemark") as HTMLSelectElement | null;
      const other = document.getElementById("pRemarkOther") as HTMLInputElement | null;
      if (sel) {
        let hit = false;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === want) { sel.selectedIndex = i; hit = true; break; }
        }
        if (!hit) {
          for (let j = 0; j < sel.options.length; j++) {
            if (sel.options[j].value === "other") { sel.selectedIndex = j; break; }
          }
          if (other) other.value = want;
        } else if (other) { other.value = ""; }
      }
      f.focus();
      shell.toast("Filled " + inr(amt) + " · installment " + seq + " of " + of + ". Press Apply to save it.");
    },

    taxMode(r, v) {
      // Instant, unlike everything else past step 1 — best-effort carry the
      // rest of the form along first, but a save failure there must never
      // block the toggle the person actually clicked.
      const pre = saveAllQuiet(r);
      if (pre.ok === false)
        shell.toast("Couldn't save your other changes: " + (pre as Refusal).detail + ". Tax mode still updated.", "bad");
      const inv = N.invoiceOf(r);
      const res = N.Draft.update(r, { tax_mode: v, row_version: inv.row_version }, actor());
      if (res.ok === false) return fail(res);
      shell.toast(N.TAX_LABEL[res.data.tax_mode] + ". Grand total " + inr(res.data.grand_total_paise) + ".");
      render();
    },

    addonAdd(r) {
      const pre = saveAllQuiet(r);
      if (pre.ok === false)
        shell.toast("Couldn't save your other changes: " + (pre as Refusal).detail + ". The charge was still added.", "bad");
      const inv = N.invoiceOf(r);
      const res = N.Draft.addAddon(r, { description: "One-off charge", amount_paise: 0 }, actor(), inv.row_version);
      if (res.ok === false) return fail(res);
      render();
    },

    addonDel(r, itemId) {
      const pre = saveAllQuiet(r);
      if (pre.ok === false)
        shell.toast("Couldn't save your other changes: " + (pre as Refusal).detail + ". The charge was still removed.", "bad");
      const inv = N.invoiceOf(r);
      const res = N.Draft.removeAddon(r, itemId, actor(), inv.row_version);
      if (res.ok === false) return fail(res);
      render();
    },

    /* THE consolidated write. Header (dates, place of supply, notes, terms),
       the plan amount, the one-off charges and the payment fields land as ONE
       patch — the person filling this in is answering one question, "is this
       invoice ready", and used to need four separate presses to find out.
       Genuinely atomic: either everything in the patch commits, or nothing
       does, so a failure here means exactly what it says. */
    saveAll(r) {
      const res = saveAllQuiet(r);
      if (res.ok === false) return fail(res as Refusal);
      const inv = N.invoiceOf(r);
      shell.toast("Saved. Grand total " + inr(inv.grand_total_paise) + ".");
      render();
    },

    issue(r) {
      const inv = N.invoiceOf(r);
      if (!inv) return;
      shell.modal(<IssueModal inv={inv} ctx={ctx} />);
    },

    cancel(r) {
      const inv = N.invoiceOf(r);
      if (!inv) return;
      shell.modal(<CancelModal inv={inv} ctx={ctx} />);
    },

    download(r) {
      const res = N.Document.download(r, actor());
      if (res.ok === false) return fail(res);
      const inv = N.invoiceOf(r);
      shell.closePop();
      printDoc(renderToStaticMarkup(createElement(InvoiceDoc, { inv })),
        (inv.invoice_number || "Invoice") + " · " + N.seller().brand,
        (m) => shell.toast(m, "bad"));
      shell.toast("Opening " + (inv.invoice_number || "the draft") + " — choose “Save as PDF”.");
      render();
    },

    share(r) {
      const res = N.Document.share(r, actor());
      if (res.ok === false) return fail(res);
      shell.closePop();
      shell.toast("Share link issued, expires " + D.fmtDate(res.data.expires) + ". Logged as SHARED.");
      render();
    },

    regen(r) {
      const res = N.Document.regenerate(r, actor());
      if (res.ok === false) return fail(res);
      shell.toast("Regenerated as v" + res.data.version + ". The earlier version is retained.");
      render();
    },

    proof(r) { shell.modal(<ProofModal ref_={r} ctx={ctx} />); },

    proofView(r, proofId) {
      const res = N.Proofs.view(r, proofId, actor());
      if (res.ok === false) return fail(res);
      shell.toast("Opened " + res.data.filename + ". Access logged as PROOF_VIEWED.");
      render();
    },

    proofRemove(r, proofId) { shell.modal(<ProofRemoveModal ref_={r} proofId={proofId} ctx={ctx} />); },

    exportCsv() {
      if (!head()) return shell.toast("403 admin_required — Export CSV is a Sales Head action.", "bad");
      const rows: (string | number)[][] = [["invoice_number", "deal_id", "quotation_id", "invoice_status",
        "customer", "remark", "installment_seq", "installment_count", "tax_mode",
        "taxable_paise", "tax_paise", "grand_total_paise", "received_paise", "balance_paise",
        "invoice_date", "due_date", "payment_id", "owner"]];
      N.Analytics.scopeOf(actor()).forEach(function (i: any) {
        const plan = N.planOf(i.invoice_id);
        rows.push([i.invoice_number || "", i.deal_id, i.quotation_id || "", i.invoice_status,
          N.billedTo(i).name || "", plan ? (plan.remark || "") : "",
          plan ? (plan.installment_seq || "") : "", plan ? (plan.installment_count || "") : "",
          i.tax_mode || N.TAX_MODE.APPLICABLE,
          i.taxable_total_paise, i.tax_total_paise, i.grand_total_paise,
          N.received(i), N.balance(i), i.invoice_date, i.due_date, i.payment_id || "", i.owner]);
      });
      const csv = rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      a.download = "invoices.csv"; a.click();
      shell.toast("Exported " + (rows.length - 1) + " invoices. Amounts in paise.");
    }

  }), [shell, go, render, ctx, fail]);

  return { p, setFilter, unfilter, go, act };
}
