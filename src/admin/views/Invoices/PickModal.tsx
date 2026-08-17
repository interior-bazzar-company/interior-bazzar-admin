/* =====================================================================
   PICK A DEAL, THEN ITS ACCEPTED QUOTATION — an invoice is never raised
   without one; quotationId is mandatory and never inferred server-side
   (contract: shown and confirmed by a human, not assumed).
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { QuotationRow } from "../../../api/modules/adminOps";
import { Icon, Notice } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { errMessage } from "../../../api/apiService";
import { call } from "./api";

type DealHit = { ref: string; contactName: string; businessName: string; valuePaise: number | null };

export default function PickInvoiceModal({ onClose, onDone }: {
  onClose: () => void; onDone: (invoiceId: number) => void;
}) {
  const [step, setStep] = useState<"deal" | "quotation">("deal");
  const [deal, setDeal] = useState<DealHit | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DealHit[] | null>(null);
  const [quotes, setQuotes] = useState<QuotationRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (step === "deal") inputRef.current?.focus(); }, [step]);

  useEffect(() => {
    if (step !== "deal") return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      AdminOpsService.deals({ search: q, pageSize: 20, sort: "newest" }).then((res) => {
        if (res.response === false) { setHits([]); return; }
        setHits(res.data.deals.map((d) => ({
          ref: d.ref, contactName: d.contactName, businessName: d.businessName, valuePaise: d.valuePaise,
        })));
      }).catch(() => setHits([]));
    }, 220);
    return () => window.clearTimeout(timer.current);
  }, [q, step]);

  const pickDeal = (d: DealHit) => {
    setDeal(d); setStep("quotation"); setQuotes(null); setErr(null);
    call(AdminOpsService.quotations({ deal: d.ref, status: "accepted", pageSize: 10 }))
      .then((data) => setQuotes(data.quotations || []))
      .catch((e: unknown) => setErr(errMessage(e)));
  };

  const pickQuotation = (qid: number) => {
    if (!deal) return;
    setErr(null); setBusy(qid);
    call(AdminOpsService.createInvoice(deal.ref, qid))
      .then((row) => onDone(row.id))
      .catch((e: unknown) => { setErr(errMessage(e)); setBusy(null); });
  };

  return (
    <>
      <div className="md-h">
        <h3>Create invoice</h3>
        <p>{step === "deal" ? "Pick the deal to bill." : deal ? deal.contactName + " · " + deal.ref : ""}</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        {step === "deal"
          ? <>
              <div className="field grow" style={{ marginBottom: "10px" }}>
                <Icon name="search" />
                <input ref={inputRef} type="search" placeholder="Search by name, business or phone…"
                  value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
              </div>
              {hits === null
                ? <div className="faint">Searching…</div>
                : !hits.length
                  ? <div className="faint" style={{ padding: "16px 0" }}>No deals match.</div>
                  : <div className="pick-list">
                      {hits.map((d) => (
                        <button key={d.ref} type="button" className="pick-row" onClick={() => pickDeal(d)}>
                          <div className="cell-1">{d.contactName}{d.businessName ? " · " + d.businessName : ""}</div>
                          <div className="cell-2">{d.ref}</div>
                          <span className="spacer"></span>
                          <span className="tnum">{d.valuePaise ? inr(d.valuePaise) : <span className="faint">not quoted</span>}</span>
                          <Icon name="chev" size="sm" />
                        </button>
                      ))}
                    </div>}
            </>
          : <>
              <button className="btn sm" style={{ marginBottom: "10px" }} onClick={() => { setStep("deal"); setDeal(null); }}>
                <Icon name="arrow" size="sm" />Back to deals
              </button>
              {quotes === null
                ? <div className="faint">Loading accepted quotations…</div>
                : !quotes.length
                  ? <Notice tone="bad" text={<>
                      <b>This deal has no accepted quotation.</b> An invoice can only be raised against
                      one — issue and accept a quotation first.
                    </>} />
                  : <div className="pick-list">
                      {quotes.map((qr) => (
                        <button key={qr.id} type="button" className="pick-row" disabled={busy !== null}
                          onClick={() => pickQuotation(qr.id)}>
                          <div className="cell-1">{qr.quotationNumber}</div>
                          <div className="cell-2">Accepted {fmtDate(qr.acceptedAt)}</div>
                          <span className="spacer"></span>
                          <span className="tnum">{inr(qr.grandTotalPaise)}</span>
                          {busy === qr.id ? <span className="faint">Creating…</span> : <Icon name="chev" size="sm" />}
                        </button>
                      ))}
                    </div>}
            </>}
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
