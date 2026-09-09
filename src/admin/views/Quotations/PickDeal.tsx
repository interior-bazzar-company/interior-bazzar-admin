/* =====================================================================
   PICK A DEAL — step 1 of 2 (`#/quotations?new=1`), the prototype's
   pickDeal(). A quotation is born inside a deal and nowhere else, so this is
   a PAGE rather than a modal: it is the first half of creating one, not a
   question asked over the list you were reading.

   The list shows only what CreateDraft will actually accept: closed
   (terminal-stage) deals and deals already carrying a live issued/accepted
   quotation are filtered out rather than offered and then refused on click.
   The server checks remain the authority — this only stops the panel from
   inviting a click it knows will fail.
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { Alert, Button, EmptyState, PageHeader, Pill, SearchField, Table, TbTitle, Toolbar } from "../../ui";
import { inr } from "../../ui/format";
import { errMessage } from "../../../api/apiService";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { getSession } from "../../auth/session";
import { call } from "./api";

type DealHit = {
  ref: string; contactName: string; businessName: string; city: string;
  valuePaise: number | null; stageLabel: string; stageTone: string;
};

export default function PickDeal() {
  const { go } = useNav();
  const { toast } = useShell();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DealHit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /* dealRef → how many quotations it already carries. Its keys double as the
     "already quoted" test, so one fetch answers both the Quotations column and
     which rows to drop. */
  const [chains, setChains] = useState<Record<string, { n: number; live: boolean }>>({});
  const timer = useRef<number | undefined>(undefined);

  usePageChrome({ crumbs: <TbTitle label="Quotations" to="#/quotations" />, right: null, parent: "#/quotations" });

  /* Read ONCE: the set cannot change while this page is open, so it does not
     belong in the search effect.
     ponytail: one page (200 is the server's max), AND the list is scoped — a
     sales session sees quotations on its own deals only, so a deal quoted by
     its other owner arrives here looking unquoted. Both failures point the
     same, safe way: a quoted deal stays in the list and CreateDraft refuses
     the click. The count is therefore a floor, which is why the column says
     whose. Ask the API for a per-deal count if it ever has to be exact. */
  useEffect(() => {
    AdminOpsService.quotations({ pageSize: 200 }).then((r) => {
      if (r.response === false) return;
      const m: Record<string, { n: number; live: boolean }> = {};
      r.data.quotations.forEach((qt) => {
        const c = m[qt.dealRef] || (m[qt.dealRef] = { n: 0, live: false });
        c.n += 1;
        if (qt.status === "issued" || qt.status === "accepted") c.live = true;
      });
      setChains(m);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      AdminOpsService.deals({ search: q, pageSize: 50, sort: "newest" }).then((res) => {
        if (res.response === false) { setHits([]); return; }
        /* Closed deals are refused on create, so they are not offered. Read
           from the vocabulary the response ships rather than naming won/lost
           here — a new terminal stage is then closed the day it is added. */
        const closed = new Set(res.data.stages.filter((s) => s.isTerminal).map((s) => s.key));
        setHits(res.data.deals.filter((d) => !closed.has(d.stageKey)).map((d) => ({
          ref: d.ref, contactName: d.contactName, businessName: d.businessName, city: d.city,
          valuePaise: d.valuePaise, stageLabel: d.stageLabel, stageTone: d.stageTone,
        })));
      }).catch(() => setHits([]));
    }, 220);
    return () => window.clearTimeout(timer.current);
  }, [q]);

  /* Applied at render, not in the fetch: the two requests race, and the deals
     usually land first. */
  const list = hits && hits.filter((d) => !(chains[d.ref] && chains[d.ref].live));
  const session = getSession();
  const head = !!(session && session.isFullAccess);

  const pick = (ref: string) => {
    setErr(null); setBusy(ref);
    call(AdminOpsService.createQuotation(ref))
      .then((row) => { toast("Quotation drafted."); go("#/quotations/" + row.id + "?mode=edit"); })
      .catch((e: unknown) => { setErr(errMessage(e)); setBusy(null); });
  };

  if (!can("quotations", "create")) return (
    <EmptyState icon="lock" title="403 — no quotation-creation access"
      body="Your role can read quotations but not start one."
      action={<Button color="primary" onClick={() => go("#/quotations")}>Back to quotations</Button>} />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The eyebrow carries the step. This is half of a two-part act, and a
          page that does not say so reads as a list somebody landed on. */}
      <PageHeader
        eyebrow="Step 1 of 2"
        title="Which deal is this for?"
        meta="A quotation cannot exist without a deal — closed deals are excluded, reopen the deal first."
        actions={<Button color="secondary" data-go="#/quotations" onClick={() => go("#/quotations")}>Cancel</Button>} />

      {err ? <Alert tone="bad" title={err} /> : null}

      <Toolbar>
        <SearchField ph="Search customer, city or deal ref…" val={q} onFilter={(_n, v) => setQ(v)} />
      </Toolbar>

      <Table
        cols={[{ label: "Customer" }, { label: "Deal" }, { label: "Stage" },
          { label: "Deal value", cls: "n" },
          { label: head ? "Quotations" : "Quotations · yours", cls: "c" }, { label: "", cls: "acts" }]}
        empty={list === null
          ? { icon: "deal", title: "Searching…", body: "" }
          : { icon: "deal", title: "No open deals match",
              body: "Quotations start from a deal. Closed deals, and deals that already have an "
                + "issued or accepted quotation, are not listed." }}
        rows={(list || []).map((d) => {
          const n = chains[d.ref] ? chains[d.ref].n : 0;
          return (
            <tr key={d.ref}>
              <td className="cell-1">
                {d.contactName}{d.businessName ? " · " + d.businessName : ""}
                <div className="cell-2">{d.city || "—"}</div>
              </td>
              <td className="mono">{d.ref}</td>
              <td><Pill text={d.stageLabel} tone={d.stageTone} dot /></td>
              <td className="n">{d.valuePaise ? inr(d.valuePaise) : <span className="text-quaternary">—</span>}</td>
              <td className="c">{n || <span className="text-quaternary">—</span>}</td>
              <td className="acts">
                <Button size="xs" color="primary" data-act="qt-create" data-deal={d.ref}
                  isDisabled={!!busy} isLoading={busy === d.ref} onClick={() => pick(d.ref)}>
                  Select
                </Button>
              </td>
            </tr>
          );
        })}
      />
    </div>
  );
}
