/* =====================================================================
   THE DOCUMENT MODULES' OWN DRAWINGS — quotations AND invoices.

   Two screens in this panel are not screens at all: a quotation and an
   invoice are PAPER. Everything else inverts with the theme; a document
   does not, because the customer's copy is white with black type whatever
   the agent's monitor is set to. So the sheet below is drawn on explicit
   `bg-white text-neutral-900` with `border-neutral-200` rules — the one
   place in the product that names a colour outside the semantic set, on
   purpose, and the reason it is a component rather than a page's own markup:
   there is exactly ONE sheet, and the list, the builder rail, the detail
   page and the preview all render it.

   The chrome around it is normal panel furniture and carries
   `data-print-hide`, so Ctrl-P on any of those screens produces the sheet
   and nothing else (globals.css owns the @page rules).
   ===================================================================== */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import type { InvoiceRow, QuotationRow, TaxMode } from "../../../api/modules/adminOps";
import { BrandLogo, Button, Card, Icon, Pill, Radio, Segmented, SelectInput, Timeline } from "../../ui";
import { inr, inrWords, fmtDate } from "../../ui/format";
import { GST_RATES, SELLER } from "./helpers";

/* ------------------------------------------------------------- the ink --- */
/* The micro-label, in paper's own palette. `label-mono` is the same device
   for the panel, but it reads its colour from a theme token and would go
   pale-on-white in dark. */
export function PaperKey({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("block font-mono text-2xs font-medium tracking-wider text-neutral-500 uppercase", className)}>{children}</span>;
}

/* The sheet. `compact` is the builder rail and the detail column: the same
   document at reading density rather than at printing density. */
export function Paper({ children, compact, className }: { children: ReactNode; compact?: boolean; className?: string }) {
  return (
    <article
      className={cx(
        "relative mx-auto flex w-full flex-col overflow-hidden bg-white text-neutral-900 ring-1 ring-neutral-200",
        compact ? "rounded-lg p-5 text-xs shadow-xs" : "max-w-3xl rounded-lg p-6 text-sm shadow-lg sm:p-10",
        "print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0",
        className,
      )}
    >
      {children}
    </article>
  );
}

/* DRAFT, across the page, the way a proof copy is stamped. Behind the type
   rather than over it, and never on an issued document. */
function Watermark({ text }: { text: string }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
      <span className="-rotate-12 font-mono text-display-2xl font-bold tracking-widest text-neutral-100 select-none">{text}</span>
    </span>
  );
}

export type SheetItem = {
  key: string | number;
  name: ReactNode;
  sub?: ReactNode;
  hsn?: string | null;
  term?: ReactNode;
  taxablePaise: number;
  taxRate: number;
  taxPaise: number;
  totalPaise: number;
};

export type SheetMoneyRow = {
  k: ReactNode;
  v: ReactNode;
  /** the grand total: heavier, ruled above */
  strong?: boolean;
  /** a hairline over this row — where the arithmetic changes subject */
  rule?: boolean;
};

/* ============================================================ THE SHEET === */
/* One drawing, both documents. The caller hands it a normalised model rather
   than a QuotationRow or an InvoiceRow, so neither module can drift from the
   other and the whole thing stays readable at 24rem. */
export function DocSheet({
  kind,
  number,
  draft,
  stamp,
  meta,
  billTo,
  items,
  taxed,
  money,
  totalPaise,
  notes,
  terms,
  foot,
  compact,
  className,
}: {
  kind: string;
  number: ReactNode;
  draft?: boolean;
  /** the word stamped across the sheet — DRAFT, CANCELLED */
  stamp?: string;
  meta: [ReactNode, ReactNode][];
  billTo: { title: string; lines: ReactNode[] };
  items: SheetItem[];
  taxed: boolean;
  money: SheetMoneyRow[];
  totalPaise: number;
  notes?: string;
  terms?: string;
  foot?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const mark = stamp || (draft ? "DRAFT" : "");
  return (
    <Paper compact={compact} className={className}>
      {mark ? <Watermark text={mark} /> : null}

      <div className="relative z-10 flex min-w-0 flex-col">
        {/* --------------------------------------------------- letterhead */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <BrandLogo size={compact ? 32 : 40} />
            <div className="min-w-0">
              <div className={cx("font-semibold text-neutral-900", compact ? "text-sm" : "text-md")}>{SELLER.brand}</div>
              <div className="text-neutral-500">{SELLER.tagline}</div>
              <div className="mt-1 max-w-xs text-neutral-500">{SELLER.addr}</div>
              <div className="mt-1 font-mono text-neutral-600 tnum">{SELLER.gstin ? "GSTIN " + SELLER.gstin : "CIN " + SELLER.cin}</div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <PaperKey className="text-right">{kind}</PaperKey>
            <div className={cx("mt-0.5 font-mono font-semibold text-neutral-900 tnum", compact ? "text-sm" : "text-lg")}>{number}</div>
          </div>
        </header>

        {/* ----------------------------------------------- parties & dates */}
        <div className="grid gap-5 border-b border-neutral-200 py-4 sm:grid-cols-2">
          <div className="min-w-0">
            <PaperKey>{billTo.title}</PaperKey>
            <div className="mt-1 flex flex-col gap-0.5">
              {billTo.lines.map((l, i) => (
                <div key={i} className={cx("[overflow-wrap:anywhere]", i === 0 ? "font-semibold text-neutral-900" : "text-neutral-600")}>
                  {l}
                </div>
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-start sm:justify-self-end sm:text-right">
            {meta.map((m, i) => (
              <div key={i} className="contents">
                <dt className="font-mono text-2xs tracking-wider text-neutral-500 uppercase">{m[0]}</dt>
                <dd className="font-medium text-neutral-800 tnum">{m[1]}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ------------------------------------------------------- the lines */}
        <div className="-mx-1 overflow-x-auto py-4">
          <table className="w-full border-collapse px-1 text-left">
            <thead>
              <tr className="border-b border-neutral-300">
                <th scope="col" className="py-1.5 pr-2 font-mono text-2xs font-medium tracking-wider text-neutral-500 uppercase">
                  Description
                </th>
                {taxed ? (
                  <th scope="col" className="px-2 py-1.5 text-right font-mono text-2xs font-medium tracking-wider text-neutral-500 uppercase">
                    Taxable
                  </th>
                ) : null}
                {taxed ? (
                  <th scope="col" className="px-2 py-1.5 text-right font-mono text-2xs font-medium tracking-wider text-neutral-500 uppercase">
                    GST
                  </th>
                ) : null}
                <th scope="col" className="py-1.5 pl-2 text-right font-mono text-2xs font-medium tracking-wider text-neutral-500 uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((it) => (
                  <tr key={it.key} className="border-b border-neutral-200 align-top last:border-0">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-neutral-900">{it.name}</div>
                      {it.sub ? <div className="mt-0.5 text-neutral-500">{it.sub}</div> : null}
                      {it.hsn || it.term ? (
                        <div className="mt-0.5 font-mono text-2xs text-neutral-500 tnum">
                          {it.hsn ? "HSN " + it.hsn : ""}
                          {it.hsn && it.term ? " · " : ""}
                          {it.term}
                        </div>
                      ) : null}
                    </td>
                    {taxed ? <td className="px-2 py-2 text-right font-mono text-neutral-700 tnum">{inr(it.taxablePaise)}</td> : null}
                    {taxed ? (
                      <td className="px-2 py-2 text-right font-mono text-neutral-700 tnum">
                        {inr(it.taxPaise)}
                        <span className="block text-2xs text-neutral-500">{it.taxRate}%</span>
                      </td>
                    ) : null}
                    <td className="py-2 pl-2 text-right font-mono font-semibold text-neutral-900 tnum">{inr(it.totalPaise)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={taxed ? 4 : 2} className="py-6 text-center text-neutral-400">
                    No lines on this document yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------- the money block */}
        <div className="flex justify-end border-t border-neutral-200 pt-3">
          <dl className="w-full max-w-xs">
            {money.map((r, i) => (
              <div key={i} className={cx("flex items-baseline justify-between gap-4 py-1", r.rule && "mt-1 border-t border-neutral-200 pt-2", r.strong && "mt-1 border-t-2 border-neutral-800 pt-2")}>
                <dt className={cx(r.strong ? "font-semibold text-neutral-900" : "text-neutral-600")}>{r.k}</dt>
                <dd className={cx("font-mono tnum", r.strong ? "text-md font-semibold text-neutral-900" : "text-neutral-800")}>{r.v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-1 text-right text-neutral-500 italic">{inrWords(totalPaise)}</div>

        {/* --------------------------------------------------- what it says */}
        {notes || terms ? (
          <div className="mt-4 grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2">
            {notes ? (
              <div className="min-w-0">
                <PaperKey>Notes</PaperKey>
                <p className="mt-1 whitespace-pre-wrap text-neutral-700">{notes}</p>
              </div>
            ) : null}
            {terms ? (
              <div className="min-w-0">
                <PaperKey>Terms</PaperKey>
                <p className="mt-1 whitespace-pre-wrap text-neutral-700">{terms}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3 text-neutral-500">
          <span>{SELLER.brand} · {SELLER.state}</span>
          <span className="text-right">{foot || "This is a computer-generated document."}</span>
        </footer>
      </div>
    </Paper>
  );
}

/* ------------------------------------------------- the two real sheets --- */
/* A row from the API is not a document; these two turn one into the model
   `DocSheet` draws. They live here, beside the sheet, so the quotation's paper
   and the invoice's paper cannot drift — and so the detail page, the builder
   rail and the preview all render the SAME sheet from the SAME mapping.

   `live` is the builder's unsaved typing: the form's inputs are uncontrolled
   (the server recomputes every figure on save, so re-rendering per keystroke
   buys nothing), but what a person TYPES should still appear on the paper
   beside them. Only text is mirrored — every figure below comes from the row
   the server last computed, and the rail says so. */
export type LiveDoc = {
  date?: string;
  until?: string;
  placeOfSupply?: string;
  notes?: string;
  terms?: string;
  planName?: string;
  planHsn?: string;
  termMonths?: string;
  addons?: Record<number, string>;
};

const QUOTE_STAMP: Record<string, string> = { draft: "DRAFT", cancelled: "CANCELLED", superseded: "SUPERSEDED", expired: "EXPIRED", rejected: "REJECTED" };

export function QuotationSheet({ q, compact, live, className }: { q: QuotationRow; compact?: boolean; live?: LiveDoc; className?: string }) {
  const taxed = q.taxMode !== "not_applicable";
  const plan = q.items.find((i) => i.kind === "plan") || null;
  const addons = q.items.filter((i) => i.kind === "addon");
  const p = q.party;
  const term = live && live.termMonths !== undefined && live.termMonths !== "" ? Number(live.termMonths) : plan ? plan.termMonths : null;
  const money: SheetMoneyRow[] = [{ k: "Gross amount", v: inr(q.subtotalPaise) }];
  if (q.discountAmountPaise) money.push({ k: "Discount " + (q.discountPct ? "(" + q.discountPct + "%)" : ""), v: "−" + inr(q.discountAmountPaise) });
  money.push({ k: taxed ? "Taxable value" : "Subtotal", v: inr(q.taxablePaise), rule: true });
  if (taxed && q.igstPaise) money.push({ k: "IGST @ " + q.gstRate + "%", v: inr(q.igstPaise) });
  else if (taxed) {
    money.push({ k: "CGST @ " + q.gstRate / 2 + "%", v: inr(q.cgstPaise) });
    money.push({ k: "SGST @ " + q.gstRate / 2 + "%", v: inr(q.sgstPaise) });
  } else money.push({ k: "GST", v: "Not applicable" });
  money.push({ k: "Grand total", v: inr(q.grandTotalPaise), strong: true });

  return (
    <DocSheet
      kind="Quotation"
      number={q.quotationNumber || "Draft"}
      stamp={QUOTE_STAMP[q.status]}
      compact={compact}
      className={className}
      meta={[
        ["Date", fmtDate((live && live.date) || q.quotationDate)],
        ["Valid until", fmtDate((live && live.until) || q.validUntil)],
        ["Deal", q.dealRef],
        ["Place of supply", (live && live.placeOfSupply) || q.placeOfSupply || "—"],
      ]}
      billTo={{
        title: "Quotation for",
        lines: [p.business ? p.name + " · " + p.business : p.name || "—", p.address || [p.city, p.state].filter(Boolean).join(", ") || "—", p.phone || "", p.gstin ? "GSTIN " + p.gstin : ""].filter(Boolean),
      }}
      items={[
        ...(plan
          ? [
              {
                key: plan.id,
                name: (live && live.planName) || plan.name || "No plan chosen yet",
                sub: plan.description,
                hsn: (live && live.planHsn) || plan.hsn,
                term: term ? term + " months" + (plan.installments > 1 ? " · " + plan.installments + " payments" : "") : null,
                taxablePaise: plan.taxableAmountPaise,
                taxRate: plan.taxRate,
                taxPaise: plan.taxAmountPaise,
                totalPaise: plan.lineTotalPaise,
              } as SheetItem,
            ]
          : []),
        ...addons.map(
          (a): SheetItem => ({
            key: a.id,
            name: (live && live.addons && live.addons[a.id]) || a.name || "One-off charge",
            sub: a.description,
            hsn: a.hsn,
            taxablePaise: a.taxableAmountPaise,
            taxRate: a.taxRate,
            taxPaise: a.taxAmountPaise,
            totalPaise: a.lineTotalPaise,
          }),
        ),
      ]}
      taxed={taxed}
      money={money}
      totalPaise={q.grandTotalPaise}
      notes={live && live.notes !== undefined ? live.notes : q.notes}
      terms={live && live.terms !== undefined ? live.terms : q.terms}
      foot={q.validUntil ? "Valid until " + fmtDate((live && live.until) || q.validUntil) : undefined}
    />
  );
}

export function InvoiceSheet({ inv, compact, live, className }: { inv: InvoiceRow; compact?: boolean; live?: LiveDoc; className?: string }) {
  const taxed = inv.taxMode !== "not_applicable";
  const plan = inv.items.find((i) => i.kind === "plan") || null;
  const addons = inv.items.filter((i) => i.kind === "addon");
  const b = inv.billing;
  const money: SheetMoneyRow[] = [{ k: "Subtotal", v: inr(inv.subtotalPaise) }];
  money.push({ k: taxed ? "Taxable value" : "Amount", v: inr(inv.taxableTotalPaise), rule: true });
  if (taxed && inv.igstPaise) money.push({ k: "IGST @ " + inv.gstRate + "%", v: inr(inv.igstPaise) });
  else if (taxed) {
    money.push({ k: "CGST @ " + inv.gstRate / 2 + "%", v: inr(inv.cgstPaise) });
    money.push({ k: "SGST @ " + inv.gstRate / 2 + "%", v: inr(inv.sgstPaise) });
  } else money.push({ k: "GST", v: "Not applicable" });
  money.push({ k: "Grand total", v: inr(inv.grandTotalPaise), strong: true });

  return (
    <DocSheet
      kind="Tax invoice"
      number={inv.invoiceNumber || "Draft"}
      stamp={inv.status === "draft" ? "DRAFT" : inv.status === "cancelled" ? "CANCELLED" : undefined}
      compact={compact}
      className={className}
      meta={[
        ["Invoice date", fmtDate((live && live.date) || inv.invoiceDate)],
        ["Due", fmtDate((live && live.until) || inv.dueDate)],
        ["Against", inv.quotationNumber || "quotation #" + inv.quotationId],
        ["Deal", inv.dealRef],
        ["Place of supply", (live && live.placeOfSupply) || inv.placeOfSupply || "—"],
      ]}
      billTo={{ title: "Billed to", lines: [b.name || "—", b.address || "—", b.phone || "", b.gstin ? "GSTIN " + b.gstin : ""].filter(Boolean) }}
      items={[
        ...(plan
          ? [
              {
                key: plan.id,
                name: (live && live.planName) || plan.description || "Plan",
                sub: plan.remark || (plan.installmentCount ? "Installment " + plan.installmentSeq + " of " + plan.installmentCount : "Full amount"),
                hsn: (live && live.planHsn) || plan.hsn,
                taxablePaise: plan.taxableAmountPaise,
                taxRate: plan.taxRate,
                taxPaise: plan.taxAmountPaise,
                totalPaise: plan.lineTotalPaise,
              } as SheetItem,
            ]
          : []),
        ...addons.map(
          (a): SheetItem => ({
            key: a.id,
            name: (live && live.addons && live.addons[a.id]) || a.description || "One-off charge",
            hsn: a.hsn,
            taxablePaise: a.taxableAmountPaise,
            taxRate: a.taxRate,
            taxPaise: a.taxAmountPaise,
            totalPaise: a.lineTotalPaise,
          }),
        ),
      ]}
      taxed={taxed}
      money={money}
      totalPaise={inv.grandTotalPaise}
      notes={live && live.notes !== undefined ? live.notes : inv.notes}
      terms={live && live.terms !== undefined ? live.terms : inv.terms}
      foot={inv.status === "issued" ? "Received" + (inv.paymentReference ? " · ref " + inv.paymentReference : "") : "Payable by " + fmtDate((live && live.until) || inv.dueDate)}
    />
  );
}

/* THE STAGE a sheet stands on — a neutral well so the paper reads as an
   object rather than as the page's own background, in both themes. */
export function PaperStage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex w-full justify-center rounded-xl bg-tertiary p-4 ring-1 ring-secondary print:bg-transparent print:p-0 print:ring-0 sm:p-6", className)}>{children}</div>;
}

/* ------------------------------------------------------ builder chrome --- */
/* THE BUILDER: what is being filled in on the left, what it will look like on
   the right. Under `lg` the sheet drops below the form rather than beside it —
   a 210mm document in a 320px column is not a preview of anything. */
export function BuilderLayout({ form, rail, className }: { form: ReactNode; rail: ReactNode; className?: string }) {
  return (
    <div className={cx("grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]", className)}>
      <div className="flex min-w-0 flex-col gap-5">{form}</div>
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0">{rail}</aside>
    </div>
  );
}

/* A NUMBERED STEP rather than a fifth equal heading: three headings read as
   three things, three numbers read as a sequence you are part way through. */
export function StepHead({ n, title, hint }: { n: number; title: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary font-mono text-2xs font-semibold text-brand-secondary ring-1 ring-brand ring-inset tnum">{n}</span>
      <span className="min-w-0 text-sm font-semibold text-primary">{title}</span>
      {hint ? <span className="min-w-0 truncate text-xs text-tertiary">{hint}</span> : null}
    </div>
  );
}

/* BILL TO — one line of reference, not input. The seller's own letterhead is
   not repeated beside it: it is printed on the sheet, and it is the same on
   every document the company has ever raised. */
export function BillTo({ name, address, phone, edit }: { name: ReactNode; address: ReactNode; phone: ReactNode; edit?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-secondary px-3 py-2.5 text-sm ring-1 ring-secondary ring-inset">
      <span className="label-mono">Bill to</span>
      <span className="font-medium text-primary [overflow-wrap:anywhere]">{name}</span>
      <span className="text-tertiary [overflow-wrap:anywhere]">{address}</span>
      <span className="font-mono text-tertiary tnum">{phone}</span>
      {edit ? <span className="ml-auto">{edit}</span> : null}
    </div>
  );
}

/* THE SUMMARY — every figure the SERVER last computed, the one control that
   changes them (tax), and the one commit for the whole page. ONE drawing for
   both builders: the quotation used to print its totals as a full-width card
   in the form column while the invoice kept them in the rail, and the two
   "twins" had quietly stopped agreeing about where the money is read. */
export function BuilderSummary({
  lines, gstId, gstRate, taxMode, onTaxMode, placeOfSupply,
  cgstPaise, sgstPaise, igstPaise, grandTotalPaise, blockers, busy, onSave, saveLabel, saveAct,
}: {
  lines: { k: ReactNode; v: ReactNode; rule?: boolean; tone?: "warn" | "ok" }[];
  /** the id `patch()` reads the rate back from — stays per module */
  gstId: string; gstRate: number; taxMode: string; onTaxMode: (m: TaxMode) => void;
  placeOfSupply: string; cgstPaise: number; sgstPaise: number; igstPaise: number; grandTotalPaise: number;
  blockers: { text: string; code?: string }[];
  busy: boolean; onSave: () => void; saveLabel: string; saveAct: string;
}) {
  const applicable = taxMode !== "not_applicable";
  const intra = placeOfSupply === SELLER.state;
  return (
    <Card title="Summary" sub="recomputed on save" ticks
      foot={
        <div className="flex flex-col gap-3">
          <Button color="primary" ico="check" block data-act={saveAct} isLoading={busy} onClick={onSave}>{saveLabel}</Button>
          <ReadyLine blockers={blockers} verb="issue" />
        </div>
      }>
      <div className="flex min-w-0 flex-col">
        {lines.map((l, i) => <MoneyLine key={i} k={l.k} v={l.v} rule={l.rule} tone={l.tone} />)}
      </div>

      {/* TAX IS A DECISION ON THIS DOCUMENT, not a property of the customer —
          so it is a control in the figures, where its effect is visible. */}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-secondary py-2">
        <span className="text-sm text-tertiary">Tax</span>
        <Segmented sm label="Tax" value={applicable ? "applicable" : "not_applicable"}
          onPick={(m) => onTaxMode(m as TaxMode)}
          options={[{ v: "applicable", l: "Applicable" }, { v: "not_applicable", l: "Not applicable" }]} />
      </div>
      {applicable ? (
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between gap-3 py-1">
            <label htmlFor={gstId} className="text-sm text-tertiary">GST rate</label>
            <SelectInput id={gstId} defaultValue={String(gstRate)} className="w-24"
              options={GST_RATES.map((r) => ({ v: String(r), l: r + "%" }))} />
          </div>
          {intra
            ? <>
                <MoneyLine k={"CGST (" + gstRate / 2 + "%)"} v={inr(cgstPaise)} />
                <MoneyLine k={"SGST (" + gstRate / 2 + "%)"} v={inr(sgstPaise)} />
              </>
            : <MoneyLine k={"IGST (" + gstRate + "%)"} v={inr(igstPaise)} />}
          <p className="text-xs text-tertiary">
            {intra
              ? "Intra-state supply · " + SELLER.state
              : "Inter-state supply · " + (placeOfSupply || "place of supply not set") + " → " + SELLER.state}
          </p>
        </div>
      ) : <MoneyLine k="GST" v="Not applicable" />}

      <MoneyLine k="Grand total" v={inr(grandTotalPaise)} strong />
      <p className="mt-1 text-xs text-tertiary italic">{inrWords(grandTotalPaise)}</p>
    </Card>
  );
}

/* A LINE OF THE RUNNING TOTAL, in the rail. The figure column is mono and
   tabular so the rows compare down the page. */
export function MoneyLine({ k, v, strong, rule, tone }: { k: ReactNode; v: ReactNode; strong?: boolean; rule?: boolean; tone?: "warn" | "ok" }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4 py-1", rule && "mt-1 border-t border-secondary pt-2", strong && "mt-1 border-t border-primary pt-2.5")}>
      <span className={cx("text-sm", strong ? "font-semibold text-primary" : tone === "warn" ? "text-warning-primary" : "text-tertiary")}>{k}</span>
      <span className={cx("font-mono tnum", strong ? "text-lg font-semibold text-primary" : tone === "warn" ? "text-sm text-warning-primary" : tone === "ok" ? "text-sm text-success-primary" : "text-sm text-secondary")}>{v}</span>
    </div>
  );
}

/* WHY ISSUE WOULD REFUSE, stated before it is pressed. Green when there is
   nothing left to say — an empty list is the point of the block. */
export function ReadyLine({ blockers, verb }: { blockers: { text: string; code?: string }[]; verb: string }) {
  if (!blockers.length)
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-success-primary">
        <Icon name="check" size="sm" />
        Ready to {verb}
      </p>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-error-primary">
        <Icon name="alert" size="sm" />
        Cannot be {verb}d yet
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-tertiary">
        {blockers.map((b) => (
          <li key={b.code ? b.code + b.text : b.text}>
            {b.text} {b.code ? <span className="font-mono text-xs text-quaternary">422 {b.code}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* THE FEATURE LIST a tier ships with — folded, because ten chips between the
   plan name and the price being negotiated put the two things being compared
   on different screens. */
export function FeatureFold({ feats, note }: { feats: string[]; note?: ReactNode }) {
  if (!feats.length) return null;
  return (
    <details className="group/f rounded-lg bg-secondary p-3 ring-1 ring-secondary ring-inset">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-secondary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
        <Icon name="chevr" size="xs" className="text-fg-quaternary transition duration-100 group-open/f:rotate-90" />
        {feats.length} features included
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {feats.map((f, i) => (
          <span key={i} className="inline-flex items-center rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-secondary ring-1 ring-secondary ring-inset" title={f}>
            {f}
          </span>
        ))}
      </div>
      {note ? <p className="mt-2 text-xs text-tertiary">{note}</p> : null}
    </details>
  );
}

/* --------------------------------------------------------- the record --- */
/* THE FIGURES a money document is opened for. One row, tabular, so amount ·
   received · balance compare across the line instead of down a list. */
export function Figures({ items, className }: { items: { k: ReactNode; v: ReactNode; tone?: "ok" | "bad" | "warn"; sub?: ReactNode }[]; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start gap-x-10 gap-y-4", className)}>
      {items.map((f, i) => (
        <div key={i} className="min-w-0">
          <div className="label-mono">{f.k}</div>
          <div
            className={cx(
              "mt-1 text-display-xs font-semibold tracking-tight tnum",
              f.tone === "ok" ? "text-success-primary" : f.tone === "bad" ? "text-error-primary" : f.tone === "warn" ? "text-warning-primary" : "text-primary",
            )}
          >
            {f.v}
          </div>
          {f.sub ? <div className="mt-0.5 text-xs text-tertiary">{f.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

const VDOT: Record<string, string> = {
  ok: "bg-utility-green-500",
  warn: "bg-utility-yellow-500",
  bad: "bg-utility-red-500",
  dead: "bg-utility-neutral-400",
};

/* ONE VERSION of a negotiation — 4.8L, then 4.2L, then 4.4L accepted. The rail
   these sit in IS the plot, which is why it rides on every quotation screen
   rather than hiding inside a tab. */
export function VersionChip({ n, money, tone, on, title, onClick }: { n: number; money: ReactNode; tone?: string; on?: boolean; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-current={on ? "true" : undefined}
      onClick={onClick}
      className={cx(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left ring-1 outline-focus-ring transition duration-100 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2",
        on ? "bg-brand-primary ring-brand" : "bg-primary ring-secondary hover:bg-primary_hover hover:ring-primary",
      )}
    >
      <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", VDOT[tone || ""] || "bg-utility-neutral-400")} />
      <span className={cx("text-sm font-semibold tnum", on ? "text-brand-secondary" : "text-primary")}>v{n}</span>
      <span className="font-mono text-xs text-tertiary tnum">{money}</span>
    </button>
  );
}

/* The rail itself: a label and its chips, wrapping rather than scrolling —
   a negotiation with nine rounds still has to be readable at once. */
export function VersionRailFrame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-2 ring-1 ring-secondary ring-inset">
      <span className="label-mono px-1">Versions</span>
      {children}
      {right ? <span className="ml-auto">{right}</span> : null}
    </div>
  );
}

/* A CHOICE THAT IS A WHOLE BLOCK — a plan tier and its lengths, a quotation
   to bill against. The radio stays the control; the card is its target. */
export function PickCard({ name, value, checked, disabled, onPick, children, className }: { name: string; value: string; checked?: boolean; disabled?: boolean; onPick: (v: string) => void; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-lg p-3 ring-1 transition duration-100 ring-inset",
        checked ? "bg-brand-primary ring-brand" : "bg-primary ring-secondary",
        disabled ? "opacity-60" : !checked && "hover:ring-primary",
        className,
      )}
    >
      <Radio name={name} value={value} checked={checked} disabled={disabled} onChange={onPick} label={children} />
    </div>
  );
}

/* WHAT HAPPENED TO THIS DOCUMENT. Both modules log the same event shape, so
   they read it the same way: the machine word as a chip, the sentence under
   it, who and when at the foot. */
export type DocEvent = { id: number; eventType: string; actor: { name: string } | null; actorRole: string; detail: string; createdAt: string };
export function DocTimeline({ events }: { events: DocEvent[] }) {
  return (
    <Timeline
      items={events.map((e) => ({
        tone: EVENT_TONE[e.eventType.toLowerCase()],
        title: (
          <span className="flex flex-wrap items-center gap-2">
            <Pill xs text={e.eventType} tone={EVENT_TONE[e.eventType.toLowerCase()] || "neutral"} />
            <span className="text-xs font-normal text-quaternary tnum">{fmtDate(e.createdAt)}</span>
          </span>
        ),
        body: e.detail || null,
        meta: e.actor ? e.actor.name : e.actorRole || "System",
      }))}
    />
  );
}
const EVENT_TONE: Record<string, "sys" | "bad" | "ok" | "warn" | "info"> = {
  created: "info",
  issued: "ok",
  accepted: "ok",
  paid: "ok",
  shared: "info",
  downloaded: "info",
  viewed: "info",
  revised: "warn",
  superseded: "warn",
  expired: "warn",
  rejected: "bad",
  cancelled: "bad",
};

/* ------------------------------------------------------------ the frame --- */
/* THE ISSUED DOCUMENT, as the server renders it. A 210mm sheet in a sandboxed
   frame: the customer's copy and the agent's copy are the same bytes, and the
   frame's own stylesheet carries the @page rules, so printing it produces the
   PDF with no panel chrome to strip. The measure is a physical one — a page is
   210mm wide wherever it is read — so it is geometry, not a design size. */
export function DocFrame({ title, html, frameRef }: { title: string; html: string; frameRef: React.Ref<HTMLIFrameElement> }) {
  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin allow-modals"
      className="w-full max-w-full rounded-lg border-0 bg-white shadow-lg print:rounded-none print:shadow-none"
      /* grown to the sheet's real height once it lays out, so a document that
         runs onto a second page does not get its own scrollbar inside the panel */
      onLoad={(e) => {
        const d = e.currentTarget.contentDocument;
        if (d) e.currentTarget.style.height = d.documentElement.scrollHeight + "px";
      }}
      style={{ width: "210mm", height: "297mm" }}
    />
  );
}
