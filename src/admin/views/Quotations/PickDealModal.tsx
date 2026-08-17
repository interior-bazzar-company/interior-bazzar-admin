/* =====================================================================
   PICK A DEAL — the only way a quotation is born. Search the open pipeline,
   pick one, and QuotationsController.CreateDraft does the rest.

   The list now shows only what CreateDraft will actually accept: closed
   (terminal-stage) deals and deals already carrying a live issued/accepted
   quotation are filtered out rather than offered and then refused on click.
   The server checks remain the authority — this only stops the panel from
   inviting a click it knows will fail.
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { Icon, Notice } from "../../ui";
import { inr } from "../../ui/format";
import { errMessage } from "../../../api/apiService";
import { call } from "./api";

type DealHit = { ref: string; contactName: string; businessName: string; valuePaise: number | null; stageLabel: string };

export default function PickDealModal({ onClose, onDone }: {
  onClose: () => void; onDone: (quotationId: number) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DealHit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [quoted, setQuoted] = useState<Set<string>>(new Set());
  const timer = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  /* The refs the server will refuse a second quotation on — the same
     LIVE_STATUSES the create path checks. Read ONCE per modal: the set cannot
     change while this is open, so it does not belong in the search effect.
     ponytail: one page of each status (200 is the server's max). Overflow puts
     a quoted deal back in the list, where the create refusal still catches it. */
  useEffect(() => {
    Promise.all(["issued", "accepted"].map((status) =>
      AdminOpsService.quotations({ status, pageSize: 200 })
        .then((r) => (r.response === false ? [] : r.data.quotations.map((qt) => qt.dealRef)))
        .catch(() => [])))
      .then((refs) => setQuoted(new Set(refs.flat())));
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      AdminOpsService.deals({ search: q, pageSize: 20, sort: "newest" }).then((res) => {
        if (res.response === false) { setHits([]); return; }
        /* Closed deals are refused on create, so they are not offered. Read
           from the vocabulary the response ships rather than naming won/lost
           here — a new terminal stage is then closed the day it is added. */
        const closed = new Set(res.data.stages.filter((s) => s.isTerminal).map((s) => s.key));
        setHits(res.data.deals.filter((d) => !closed.has(d.stageKey)).map((d) => ({
          ref: d.ref, contactName: d.contactName, businessName: d.businessName,
          valuePaise: d.valuePaise, stageLabel: d.stageLabel,
        })));
      }).catch(() => setHits([]));
    }, 220);
    return () => window.clearTimeout(timer.current);
  }, [q]);

  /* Applied at render, not in the fetch: the two requests race, and the deals
     usually land first. */
  const list = hits && hits.filter((d) => !quoted.has(d.ref));

  const pick = (ref: string) => {
    setErr(null); setBusy(ref);
    call(AdminOpsService.createQuotation(ref))
      .then((row) => onDone(row.id))
      .catch((e: unknown) => { setErr(errMessage(e)); setBusy(null); });
  };

  return (
    <>
      <div className="md-h">
        <h3>Create quotation</h3>
        <p>Pick the deal this quotation is for.</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        <div className="field grow" style={{ marginBottom: "10px" }}>
          <Icon name="search" />
          <input ref={inputRef} type="search" placeholder="Search by name, business or phone…"
            value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        {list === null
          ? <div className="faint">Searching…</div>
          : !list.length
            ? <div className="faint" style={{ padding: "16px 0" }}>
                No open deals match. Closed deals, and deals that already have an issued quotation, are not listed.
              </div>
            : <div className="pick-list">
                {list.map((d) => (
                  <button key={d.ref} type="button" className="pick-row" disabled={!!busy}
                    onClick={() => pick(d.ref)}>
                    <div className="cell-1">{d.contactName}{d.businessName ? " · " + d.businessName : ""}</div>
                    <div className="cell-2">{d.ref} · {d.stageLabel}</div>
                    <span className="spacer"></span>
                    <span className="tnum">{d.valuePaise ? inr(d.valuePaise) : <span className="faint">not quoted</span>}</span>
                    {busy === d.ref ? <span className="faint">Creating…</span> : <Icon name="chev" size="sm" />}
                  </button>
                ))}
              </div>}
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
