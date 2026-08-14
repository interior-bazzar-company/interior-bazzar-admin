/* =============================================================================
   Quotation — Module 2 · the ~30 action handlers
   -----------------------------------------------------------------------------
   The prototype's `M["qt-*"]` map and its `V.__act` dispatch, as one hook. Each
   handler makes the same engine call in the same order and says the same words;
   what changed is that a delegated `data-act` click is now a real onClick, and
   the `#qtErr` slot the modals wrote innerHTML into is their own state.
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useNav } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { Icon, qs } from "../../ui";
import { D, Q, actor, bump, head, inr, saveAllQuiet } from "./core";
import type { QtCtx, Res } from "./core";
import { CancelDraftModal, IssueModal, MarkAcceptedModal, MarkRejectedModal, PlanModal, ReviseModal } from "./modals";
import { printQdoc } from "./doc";

export function useQtActions() {
  const { go } = useNav();
  const shell = useShell();

  const done = useCallback((msg: ReactNode, route?: string) => {
    shell.closeLayer(); shell.toast(msg); if (route) go(route); bump();
  }, [shell, go]);

  const fail = useCallback((r: Res) => {
    shell.toast(r.http + " " + r.code + " — " + r.detail, "bad");
  }, [shell]);

  const ctx = useMemo<QtCtx>(() => ({ go, done, toast: shell.toast, closeLayer: shell.closeLayer }), [go, done, shell]);

  return useMemo(() => {
    const A = {
    ctx,
    fail,

    /* Door A — entered from inside a deal, so there is nothing to pick. The IA
       is explicit: step 1 is "skipped entirely when entering from Door A". */
    fromDeal(dealId: string) {
      const r: Res = Q.Draft.create(dealId, actor());
      if (r.ok === false) return fail(r);
      shell.closeLayer();
      shell.toast("Draft created for " + r.data.deal_id + ". No number until it is issued.");
      go("#/quotations/" + r.data.quotation_id + "?mode=edit"); bump();
    },

    create(dealId: string) {
      const r: Res = Q.Draft.create(dealId, actor());
      if (r.ok === false) return fail(r);
      shell.toast("Draft created. No number is assigned until it is issued.");
      go("#/quotations/" + r.data.quotation_id + "?mode=edit"); bump();
    },

    /* One press, three writes, one commit. Each is the SAME call its own Apply
       button used to make; what changed is that you no longer have to remember
       all three. */
    saveAll(ref: string) {
      const r = saveAllQuiet(ref);
      if (r.ok === false) return fail(r);
      const q = Q.quoteOf(ref);
      shell.toast("Saved. Grand total " + inr(q.grand_total_paise) + ".");
      bump();
    },

    taxMode(ref: string, v: string) {
      // Best-effort: the tax toggle is a specific click and still applies even
      // if whatever else was typed in the builder couldn't be saved first.
      const pre = saveAllQuiet(ref);
      const q = Q.quoteOf(ref);
      const r: Res = Q.Draft.update(ref, { tax_mode: v, row_version: q.row_version }, actor());
      if (r.ok === false) return fail(r);
      if (pre.ok === false)
        shell.toast("Couldn't save your other changes: " + pre.detail + ". Tax switched to " +
          Q.TAX_LABEL[r.data.tax_mode] + " anyway.", "warn");
      else
        shell.toast(Q.TAX_LABEL[r.data.tax_mode] + ". Grand total " + inr(r.data.grand_total_paise) + ".");
      bump();
    },

    addonAdd(ref: string) {
      const pre = saveAllQuiet(ref);
      const q = Q.quoteOf(ref);
      const r: Res = Q.Draft.addAddon(ref, { name: "One-off charge", amount_paise: 0, row_version: q.row_version }, actor());
      if (r.ok === false) return fail(r);
      if (pre.ok === false)
        shell.toast("Couldn't save your other changes: " + pre.detail + ". The new charge row was still added.", "warn");
      bump();
    },

    addonDel(ref: string, itemId: string) {
      const pre = saveAllQuiet(ref);
      const q = Q.quoteOf(ref);
      const r: Res = Q.Draft.removeAddon(ref, itemId, actor(), q.row_version);
      if (r.ok === false) return fail(r);
      if (pre.ok === false)
        shell.toast("Couldn't save your other changes: " + pre.detail + ". The charge was still removed.", "warn");
      bump();
    },

    /* Same write saveAll does — reachable from the header menu instead of the
       builder, for the person who edited a field and looked up for somewhere to
       press. It leaves you on the draft rather than navigating, because "save"
       is not "I am finished". */
    saveDraft(ref: string) {
      if (!Q.quoteOf(ref)) return;
      const r = saveAllQuiet(ref);
      shell.closePop();
      if (r.ok === false) return fail(r);
      const q = Q.quoteOf(ref);
      shell.toast("Draft saved. v" + q.version + " keeps its place until you issue it.");
      bump();
    },

    plan(ref: string) { shell.modal(<PlanModal ref_={ref} ctx={ctx} />); },
    issue(ref: string) { shell.modal(<IssueModal ref_={ref} ctx={ctx} />); },
    accept(ref: string) { shell.modal(<MarkAcceptedModal ref_={ref} ctx={ctx} />); },
    reject(ref: string) { shell.modal(<MarkRejectedModal ref_={ref} ctx={ctx} />); },
    cancel(ref: string) { shell.modal(<CancelDraftModal ref_={ref} ctx={ctx} />); },

    revise(ref: string) {
      const q = Q.quoteOf(ref);
      if (!q) return;
      /* Already editable — no dialog, no ceremony, just open it. */
      if (q.status === Q.ST.DRAFT) { shell.closeLayer(); return go("#/quotations/" + q.quotation_id + "?mode=edit"); }
      shell.modal(<ReviseModal ref_={ref} ctx={ctx} />);
    },

    /* Print IS the PDF here. The document is laid out in millimetres and the
       print stylesheet drops everything that is not it, so the browser's own
       engine produces a better file than a canvas re-draw ever could. */
    print(ref: string) {
      const q = Q.quoteOf(ref);
      if (!q) return;
      shell.closePop();
      printQdoc(q, (q.quotation_number || "Quotation") + " · " + Q.SELLER.brand, shell.toast);
    },

    /* Download and Print are the same act now, because they produce the same
       file. The audit event is unchanged: Document.download still guards and
       still logs DOWNLOADED, so the record of who took a copy is exactly what
       it was. */
    download(ref: string) {
      const r: Res = Q.Document.download(ref, actor());     // guard + DOWNLOADED audit event
      if (r.ok === false) return fail(r);
      const q = Q.quoteOf(ref);
      shell.closePop();
      printQdoc(q, (q.quotation_number || "Quotation") + " · " + Q.SELLER.brand, shell.toast);
      shell.toast("Opening " + (q.quotation_number || "the draft") + " — choose “Save as PDF”.");
      bump();
    },

    share(ref: string) {
      const r: Res = Q.Document.share(ref, actor());
      if (r.ok === false) return fail(r);
      shell.toast("Share link issued, expires " + D.fmtDate(r.data.expires) + ". Logged as SHARED.");
      bump();
    },

    export() {
      if (!head()) return shell.toast("403 admin_required — Export CSV is a Sales Head action.", "bad");
      const rows: any[][] = [["quotation_number", "deal_id", "version", "status", "customer", "tax_mode",
        "taxable_paise", "gst_paise", "grand_total_paise", "discount_pct",
        "issued_at", "valid_until", "owner"]];
      Q.Analytics.scopeOf(actor()).forEach((q: any) => {
        rows.push([q.quotation_number || "", q.deal_id, q.version, q.status,
          Q.partyOf(q).name || "", q.tax_mode || Q.TAX_MODE.APPLICABLE,
          q.taxable_paise, q.tax_amount_paise,
          q.grand_total_paise, q.discount_pct, q.issued_at || "", q.valid_until, q.owner]);
      });
      const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      a.download = "quotations.csv"; a.click();
      shell.toast("Exported " + (rows.length - 1) + " quotations. Amounts in paise.");
    },

    /* The menu. Read-only things first, then the two verdicts, then the
       destructive one — ruled off, and last, because the distance is the
       safeguard. Anything that cannot apply is simply not listed: an accepted
       quotation has no "Mark accepted" row, and a draft has no PDF because there
       is no document until it issues. */
    more(el: HTMLElement, ref: string) {
      const q = Q.quoteOf(ref);
      if (!q) return;
      if (shell.popAnchor === el) return shell.closePop();
      const draft = q.status === Q.ST.DRAFT;

      const mi = (act: string, ico: string, label: string, hint: ReactNode, cls?: string, run?: () => void) => (
        <button key={act} className={"mi" + (cls ? " " + cls : "")} data-act={act} data-ref={ref}
          onClick={() => { shell.closePop(); if (run) run(); }}>
          <Icon name={ico} />
          <span><b>{label}</b><span className="d">{hint}</span></span>
        </button>
      );

      const items: ReactNode[] = [];
      if (!draft) {
        items.push(mi("qt-download", "download", "Download as PDF",
          "The issued document, as the customer has it", undefined, () => A.download(ref)));
        items.push(mi("qt-print", "doc", "Print", "Opens the document and prints it", undefined, () => A.print(ref)));
        items.push(mi("qt-share", "link", "Share link", "An expiring link, logged as SHARED", undefined, () => A.share(ref)));
        if (q.status !== Q.ST.ACCEPTED)
          items.push(mi("qt-accept", "check", "Mark accepted",
            "Writes " + inr(q.grand_total_paise) + " to " + q.deal_id, undefined, () => A.accept(ref)));
        if (q.status !== Q.ST.REJECTED)
          items.push(mi("qt-reject", "x", "Mark rejected", "Records the customer's no", "dgr", () => A.reject(ref)));
      } else {
        items.push(mi("qt-save-draft", "check", "Save as draft",
          "Keeps everything applied so far. No number is assigned.", undefined, () => A.saveDraft(ref)));
        items.push(mi("qt-cancel", "x", "Cancel draft",
          "Consumes no number, so nothing dangles", "dgr", () => A.cancel(ref)));
      }

      shell.openPop(el, <div className="pop-b">{items}</div>, { width: 268, cls: "pop-views" });
    },

    /* Kept for parity with the prototype's debug handlers — they are reachable
       from the design-system page, not from any quotation screen. */
    expiry() {
      const r: Res = Q.Automation.runExpiry();
      if (r.ok === false) return shell.toast(r.http + " " + r.code + " — " + r.detail, "bad");
      shell.toast("Expiry sweep ran — " + r.data.expired + " expired."); bump();
    },
    reset() { Q.reset(); shell.toast("Quotation engine reset."); bump(); },
    drain() {
      const r = Q.drain();
      shell.toast("Outbox drained — " + r.delivered + " delivered" + (r.failed ? ", " + r.failed + " retried" : "") + ".");
      bump();
    }
    };
    return A;
  }, [ctx, fail, go, shell]);
}

export type QtActions = ReturnType<typeof useQtActions>;

/* The trailing overflow. Trailing is where an overflow belongs: the row then
   reads left to right as ordinary, then primary, then "everything else". */
export function MenuBtn({ r, act }: { r: string; act: QtActions }) {
  return (
    <button className="btn icon" data-act="qt-more" data-ref={r}
      aria-haspopup="menu" aria-label="More actions" title="More actions"
      onClick={(e) => act.more(e.currentTarget, r)}>
      <Icon name="dots" />
    </button>
  );
}

/* ----------------------------------------------------------------- filters ---
   Filters live in the URL, exactly as `?stage=won&q=foo` did — a filtered list
   has to survive a refresh and be linkable. The prototype's delegated
   `data-filter` / `data-unfilter` handlers, as callbacks: a select writes
   straight through, a search box waits 220ms so the address bar is not rewritten
   per keystroke, and unfiltering drops the key and re-renders the route. */
export function useFilters(p: Record<string, string>, base: string) {
  const { go } = useNav();
  const typing = useRef<number | undefined>(undefined);

  const write = useCallback((name: string, value: string) => {
    const next: Record<string, string> = {}; for (const k in p) next[k] = p[k];
    next[name] = value;
    go(base + qs(next));
  }, [p, base, go]);

  const onFilter = useCallback((name: string, value: string) => write(name, value), [write]);

  const onSearch = useCallback((name: string, value: string) => {
    clearTimeout(typing.current);
    typing.current = window.setTimeout(() => write(name, value), 220);
  }, [write]);

  const onUnfilter = useCallback((key: string) => {
    const next: Record<string, string> = {};
    if (key !== "*") for (const k in p) if (k !== key) next[k] = p[k];
    go(base + qs(next));
  }, [p, base, go]);

  return { onFilter, onSearch, onUnfilter };
}
