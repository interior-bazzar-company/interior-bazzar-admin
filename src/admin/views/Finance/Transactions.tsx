/* =============================================================================
   Other Transaction — the list face.
   -----------------------------------------------------------------------------
   Company money in and out under a custom tag: everything that is not a
   subscription and not a salary. Two tabs read the same ledger two ways —
   TRANSACTIONS is the rows, TAGS is the vocabulary that files them. The tab is
   not a filter: clearing every chip on Tags still shows Tags.

   THE TWO RULES THAT HAVE TO SHOW UP HERE, not just live in the store:
     · a tag's KIND is the only part of it that is not free — it decides where
       the money lands in Analytics, and a tag is deactivated, never deleted;
     · a row is a FACT. There is no draft and no recurring rule, only
       `recorded` or `reversed`. Money IN is three non-revenue kinds and
       nothing else — customer money has exactly one way in, a subscription.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, FilterChips, Icon, qs, SearchField, Select, StatStrip } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame, ViewBand } from "./Frame";
import type { FaceProps } from "./Frame";
import { BudgetBar, Dir, Money, TagChip, TxnPill } from "./bits";
import { BudgetModal, DeactivateTagModal, TagModal, TxnModal } from "./TxnModals";
import {
  BILL_THRESHOLD_PAISE, FILTER_LABELS, PERIOD, TAG_KINDS, TXN_STATES,
  ago, applyTxnFilters, fmtDate, inr, isSuperAdmin, tagKindMeta,
  useOverview, useTagTotals, useTags, useTxnRows,
} from "./store";
import type { Params, Tag, TagTotal, TxnRow } from "./store";

/** `filterValueLabel` needs the live tag list to turn a `tag` filter's key
 *  into its label. Taking it as an argument, rather than reading the store
 *  itself, keeps every hook call at the top of the one component that owns
 *  them — this function runs inside a render, and a hook call whose count
 *  depends on which filters happen to be set is exactly what React's rules
 *  forbid. */
function filterValueLabel(key: string, value: string, tags: Tag[]): string {
  if (key === "dir") return value === "out" ? "Debit" : "Credit";
  if (key === "flag" && value === "wrong") return "Marked wrong";
  if (key === "tag") return tags.filter((t) => t.tagKey === value)[0]?.label || value;
  if (key === "kind") return tagKindMeta(value)?.label || value;
  if (key === "state") return TXN_STATES.filter((s) => s.key === value)[0]?.label || value;
  if (key === "range") return value === "month" ? PERIOD.label : value;
  if (key === "flag") return value === "nobill" ? "Missing a bill" : value;
  return value;
}

/** Params that mean something on the record too, carried across the jump so
 *  Back is a return and not a reset. `tab` is this list's own sub-view (or the
 *  record's) and means nothing on the other side, so it never travels. */
function carry(p: Params): Params {
  const o: Params = {};
  Object.keys(p).forEach((k) => { if (p[k] && k !== "tab" && k !== "page") o[k] = p[k]; });
  return o;
}

export default function Transactions({ p, onFilter, onSearch, onUnfilter, onParams }: FaceProps) {
  const { toast, modal, closeLayer } = useShell();
  const writable = can("finance-transactions", "edit");
  const tab = p.tab === "tags" ? "tags" : "transactions";
  /* Called unconditionally, once, regardless of which tab is showing — a
     Select on the Transactions tab and the chip labels both need the live
     tag list, and a hook whose call count depends on `tab` is exactly what
     React's rules forbid. */
  const tags = useTags();

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  const openTxnModal = () => modal(<TxnModal onClose={closeLayer} onDone={done} />);
  const openTagModal = () => modal(<TagModal onClose={closeLayer} onDone={done} />);
  const openBudget = (t: Tag) => modal(<BudgetModal tag={t} onClose={closeLayer} onDone={done} />);
  const openDeactivate = (t: Tag) => modal(<DeactivateTagModal tag={t} onClose={closeLayer} onDone={done} />);

  /* THE ROWS AND THE VOCABULARY THAT FILES THEM. Both are records somebody
     acts on one at a time, so both carry a count — unlike an analytics tab,
     where a badge would invite somebody to read a derivation as a record. */
  const txnRows = useTxnRows();
  const o = useOverview();
  const totals = useTagTotals();
  const missingBillN = txnRows.filter((r) => r.missingBill).length;
  const wrongN = txnRows.filter((r) => !!r.t.wrong).length;

  /* A CELL TOGGLES: pressing the filter it already applied clears it, because
     the only other way back is to hunt for the chip. It navigates rather than
     calling back, so the address bar always says what is on screen. */
  const cellHash = (patch: Record<string, string | undefined>) => {
    const q: Record<string, string> = {};
    Object.keys(p).forEach((k) => {
      if (p[k] && ["page"].indexOf(k) < 0) q[k] = p[k] as string;
    });
    Object.keys(patch).forEach((k) => {
      if (patch[k] && p[k] !== patch[k]) q[k] = patch[k] as string; else delete q[k];
    });
    return "#/finance-transactions" + qs(q);
  };

  /* THE STRIP EVERY LIST IN THIS PANEL CARRIES: a stated Total, then its
     parts. Each part is one period where it says so, deliberately unlike the
     topbar above it, which is all time — the label says which.

     ONLY WHAT CAN BE FILTERED IS A LINK. `Excluded spend` is a read-out: it is
     a property of the tags money was filed under rather than a column anything
     narrows on, and a cell that looks pressable and does nothing is worse than
     one that plainly is not. */
  const txnCells: (StatCell | "sep")[] = [
    { k: <>Total</>, v: txnRows.length, on: !Object.keys(p).some((k) => p[k] && k !== "tab"),
      to: "#/finance-transactions",
      tip: <>Every company transaction ever recorded, money in and money out, before any
        filter. The figures beside it are for {PERIOD.label}.</> },
    "sep",
    /* CREDIT BEFORE DEBIT, and the words are the bank statement's rather than
       this module's own `out`/`in`: a credit is money arriving, which is what
       the two of them mean on every statement anybody reconciles against. The
       stored value is untouched — the ledger still holds `out` and `in`, and
       only what a person reads changed. */
    { k: <>Credit <b className="tnum">{inr(o.otherInPaise)}</b></>,
      v: o.otherInN, dot: "ok", on: p.dir === "in", to: cellHash({ dir: "in" }),
      tip: <><b>Never revenue.</b> Interest, own transfers and vendor refunds are the only
        three ways money comes in here. Customer money has exactly one way in — a
        subscription — and if anyone could hand-key a credit, anyone could fabricate
        revenue.</> },
    { k: <>Debit · {PERIOD.label} <b className="tnum">{inr(o.otherOutPaise)}</b></>,
      v: o.otherOutN, dot: "bad", on: p.dir === "out", to: cellHash({ dir: "out" }),
      tip: <>Recorded payments out in {PERIOD.label}, under every tag. Excluded spend is
        inside this figure and called out separately at the end of the strip — it left the
        bank like everything else.</> },
    "sep",
    { k: <>Marked wrong</>, v: wrongN, dot: wrongN ? "bad" : undefined,
      on: p.flag === "wrong", to: cellHash({ flag: "wrong" }),
      tip: <>Rows somebody has looked at and disputed. <b>They still count</b> — the money moved,
        and a doubt about a row is not a reversal of it. This is the gap between noticing and
        correcting: anyone with edit can raise one, and only a Super Admin can settle it with a
        counter-entry.</> },
    { k: <>Missing a bill</>, v: missingBillN, dot: missingBillN ? "warn" : undefined,
      on: p.flag === "nobill", to: cellHash({ flag: "nobill" }),
      tip: <>Recorded transactions with no bill attached. One above {inr(BILL_THRESHOLD_PAISE)}
        blocks the period from closing, which is the whole reason this is a queue and not a
        note.</> },
    { k: <>Excluded spend <b className="tnum">{inr(o.excludedPaise)}</b></>,
      tone: "mute",
      tip: <>Taxes and statutory payments, filed under tags whose kind is <b>excluded</b>.
        Cash out of the door like any other, and deliberately not part of the operating
        picture — so it is stated here rather than quietly left inside a total.</> },
  ];

  /* THE TAGS TAB HAD NO STRIP AT ALL, and a standing Notice instead. The rule
     that notice carried — a budget warns and never blocks — is on the cell it
     is about now: a caution above a table is read once, and a caution on the
     figure it governs is read when somebody doubts the figure. */
  const overBudgetN = totals.rows.filter((r) => r.overBudget).length;
  const tagCells: (StatCell | "sep")[] = [
    { k: <>Total</>, v: tags.length,
      tip: <>Every tag, active and deactivated. A tag is never deleted once it has been
        used — deleting one would silently re-bucket every transaction filed under it.</> },
    "sep",
    { k: <>Active</>, v: tags.filter((t) => t.active).length, dot: "ok",
      tip: <>Tags a new transaction can be filed under. Deactivating one keeps its history
        and takes it out of the picker.</> },
    { k: <>Made here</>, v: tags.filter((t) => t.custom).length,
      tip: <>Created in the panel rather than shipped with it. Anyone with edit rights can
        make one; its <b>kind</b> is chosen at creation and is what decides where the money
        lands in Analytics.</> },
    "sep",
    { k: <>Over budget · {PERIOD.label} <b className="tnum">{inr(totals.totalPaise)}</b></>,
      v: overBudgetN, dot: overBudgetN ? "warn" : undefined,
      tip: <><b>A budget warns at 90% of itself and never blocks.</b> Rent still has to be
        paid in a month somebody set its budget too low — the number is a flag for a person,
        not a limit the panel enforces.</> },
  ];

  return (
    <Frame toast={toast}
      tabs={
        /* A VIEW BAND ABOVE THE FILTERS, where Subscriptions and Salaries A/C
           already put theirs. It was a segmented `SubTabs` strip BELOW the
           command row, which said the two levels backwards: the tab decides
           WHAT the filters narrow, so a control that changes the whole page
           cannot sit under one that narrows part of it. */
        <ViewBand cur={tab}
          items={[
            { k: "transactions", label: "Transactions", icon: "invoice", n: txnRows.length },
            { k: "tags", label: "Tags", icon: "tag", n: tags.length },
          ]}
          onPick={(k) => onParams({
            tab: k === "transactions" ? undefined : k,
            /* Each tab has its own vocabulary of filters; carrying one across
               would narrow a list with a control it does not show. */
            q: undefined, dir: undefined, tag: undefined, kind: undefined,
            state: undefined, range: undefined, flag: undefined, page: undefined,
          })} />
      }
      cmd={tab === "transactions" ? (
        <>
          <SearchField key={"q" + (p.q || "")} ph="Description, party, ID or reference…" val={p.q} onFilter={onSearch} />
          <Select key={"dir" + (p.dir || "")} name="dir" label="Direction" value={p.dir} onFilter={onFilter}
            /* CREDIT FIRST. It is the order the record dialog offers them and
               the order the strip above counts them in — one ordering across
               the section, so nobody re-reads the list every time they meet
               it. */
            options={[{ v: "in", l: "Credit" }, { v: "out", l: "Debit" }]} />
          <Select key={"tag" + (p.tag || "")} name="tag" label="Tag" value={p.tag} onFilter={onFilter}
            options={tags.map((t) => ({ v: t.tagKey, l: t.label + (t.active ? "" : " — inactive") }))} />
          <Select key={"kind" + (p.kind || "")} name="kind" label="Rolls up to" value={p.kind} onFilter={onFilter}
            options={TAG_KINDS.map((k) => ({ v: k.key, l: k.label }))} />
          <Select key={"state" + (p.state || "")} name="state" label="State" value={p.state} onFilter={onFilter}
            options={TXN_STATES.map((s) => ({ v: s.key, l: s.label }))} />
          <Select key={"range" + (p.range || "")} name="range" label="Period" value={p.range} onFilter={onFilter}
            options={[{ v: "month", l: PERIOD.label }]} />
          <Select key={"flag" + (p.flag || "")} name="flag" label="Queue" value={p.flag} onFilter={onFilter}
            options={[{ v: "wrong", l: "Marked wrong" }, { v: "nobill", l: "Missing a bill" }]} />
          <span className="spacer" />
          {writable ? (
            <button className="btn pri" onClick={openTxnModal}><Icon name="plus" size="sm" />Record a transaction</button>
          ) : null}
        </>
      ) : (
        <>
          <span className="spacer" />
          {writable ? (
            <button className="btn pri" onClick={openTagModal}><Icon name="plus" size="sm" />Create a tag</button>
          ) : null}
        </>
      )}
      bands={<>
        {/* ONE STRIP STYLE FOR BOTH TABS, which is what every other list in
            the panel carries: a stated Total, then its parts, each cell a
            filter. It replaced four `.fin-mt` tiles that said the same four
            things at four times the height and matched no other list here. */}
        <StatStrip cells={tab === "transactions" ? txnCells : tagCells} />
        {tab === "transactions" ? (
          <div className="dls-chips">
            <FilterChips
              params={Object.keys(p)
                .filter((k) => k !== "tab" && k !== "page" && p[k])
                .reduce((o, k) => { o[k] = filterValueLabel(k, p[k] as string, tags); return o; }, {} as Record<string, string>)}
              labels={FILTER_LABELS}
              onUnfilter={onUnfilter} />
          </div>
        ) : null}
      </>}>
      {tab === "transactions"
        ? <TxnTable p={p} writable={writable} onRecord={openTxnModal} onUnfilter={onUnfilter} />
        : <TagsTab writable={writable} onBudget={openBudget} onDeactivate={openDeactivate} />}
    </Frame>
  );
}

/* MONEY TILES STOOD HERE — four `.fin-mt` blocks, each the height of a card,
   saying what one row of the panel's own strip says. They are `txnCells`
   above now. Their one real constraint survived the move and is worth
   restating: a tile could carry an `i` beside its label because it was a div,
   and a strip cell is a BUTTON — an `i` inside it would swallow half its own
   click target. The definitions ride `tip` instead, which is the strip's own
   description channel and the same answer Salaries A/C and Subscriptions
   reached. */

/* -------------------------------------------------------------- the table --- */
function TxnTable({ p, writable, onRecord, onUnfilter }: {
  p: Params; writable: boolean; onRecord: () => void; onUnfilter: (key: string) => void;
}) {
  const rows = useTxnRows();
  const filtered = applyTxnFilters(rows, p);
  const narrowed = Object.keys(p).some((k) => p[k] && k !== "tab" && k !== "page");

  if (!filtered.length) {
    return (
      <EmptyState icon={narrowed ? "search" : "inbox"}
        title={narrowed ? "Nothing matches those filters" : "Nothing recorded yet"}
        body={narrowed
          ? "Every count in the tiles above is for the whole ledger before any filter."
          : "A row here means money actually moved — rent paid, interest credited, a deposit topped up. Record one to start."}
        action={narrowed
          ? <button className="btn" onClick={() => onUnfilter("*")}>Clear all filters</button>
          : (writable ? <button className="btn pri" onClick={onRecord}>Record a transaction</button> : null)} />
    );
  }
  return (
    <table className="tbl dls-tbl fin-tbl">
      <thead>
        <tr>
          <th className="rail" />
          <th>Transaction</th>
          <th>What</th>
          <th>Tag</th>
          <th>Direction</th>
          <th className="num">Amount</th>
          <th>Value date</th>
          <th>Paper trail</th>
          <th>State</th>
          <th className="tight" />
        </tr>
      </thead>
      <tbody>
        {filtered.map((r) => <TxnLine key={r.t.txnId} r={r} p={p} />)}
      </tbody>
    </table>
  );
}

function TxnLine({ r, p }: { r: TxnRow; p: Params }) {
  const t = r.t;
  /* A DISPUTED ROW OUTRANKS A MISSING BILL on the rail: one is paperwork that
     can be chased, the other is somebody saying the money should not have
     moved. Reversed still wins over both — that one is settled. */
  const rail = t.state === "reversed" ? "bad" : t.wrong ? "bad" : r.missingBill ? "warn" : "";
  const to = "#/finance-transactions/" + encodeURIComponent(t.txnId) + qs(carry(p));
  const open = () => go(to);
  return (
    <tr className="clickable" tabIndex={0} role="link" aria-label={"Open " + t.txnId}
      onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <td className="rail"><i className={rail} /></td>
      <td>
        <div className="cell-1 mono">{t.txnId}</div>
        <div className="cell-2">
          {t.reversesTxnId ? "counter-entry for " + t.reversesTxnId
            : t.reversal ? "reversed → " + t.reversal.counterId
            : "—"}
        </div>
      </td>
      <td>
        <div className="cell-1 fin-desc" title={t.description}>{t.description}</div>
        <div className="cell-2 faint fin-desc" title={t.party || undefined}>{t.party || "—"}</div>
      </td>
      <td><TagChip k={t.tagKey} /></td>
      <td><Dir d={t.direction} /></td>
      <td className="num"><Money paise={t.amountPaise} sign={t.direction === "in"} strong /></td>
      <td>
        <div className="cell-1">{fmtDate(t.valueDate)}</div>
        <div className="cell-2">{ago(t.valueDate)}</div>
      </td>
      <td>
        {t.bill
          ? <div className="cell-1"><Icon name="check" size="sm" />{t.bill.filename}</div>
          : r.missingBill
            ? <div className="cell-1 fin-fine warn"><Icon name="alert" size="sm" />Missing — required</div>
            : <div className="cell-1 faint">no bill needed</div>}
        {t.bankLineId ? <div className="cell-2"><Icon name="link" size="sm" />matched to bank</div> : null}
      </td>
      <td>
        <TxnPill k={t.state} />
        {/* THE MARK IS NOT A STATE and does not replace one — it sits beside it,
            because the row is still `recorded` and still counts. A pill that
            replaced the state would be the third state this module refuses to
            have. */}
        {t.wrong
          ? <div className="cell-2 fin-wrongmark" title={t.wrong.reason}>
            marked wrong by {t.wrong.by}
          </div>
          : null}
      </td>
      <td className="tight"><Icon name="chevr" size="sm" /></td>
    </tr>
  );
}

/* --------------------------------------------------------------- the tags --- */
function TagsTab({ writable, onBudget, onDeactivate }: {
  writable: boolean; onBudget: (t: Tag) => void; onDeactivate: (t: Tag) => void;
}) {
  const { rows } = useTagTotals();
  if (!rows.length) {
    return <EmptyState icon="tag" title="No tag exists yet" body="Every company transaction needs one. Create the first." />;
  }
  return (
    <>
      {/* THE BUDGET NOTICE THAT STOOD HERE is on the strip cell it is about,
          above. A caution over a table is read once and then looked past; the
          same sentence on the figure it governs is read at the moment somebody
          doubts the figure, which is the only moment it does any work. */}
      <table className="tbl dls-tbl fin-tbl">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Rolls up to</th>
            <th>Origin</th>
            <th className="num">Spend · {PERIOD.label}</th>
            <th>Budget</th>
            <th>Bill</th>
            <th className="tight" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <TagLine key={r.tag.tagKey} r={r} writable={writable} onBudget={onBudget} onDeactivate={onDeactivate} />
          ))}
        </tbody>
      </table>
    </>
  );
}

function TagLine({ r, writable, onBudget, onDeactivate }: {
  r: TagTotal; writable: boolean; onBudget: (t: Tag) => void; onDeactivate: (t: Tag) => void;
}) {
  const t = r.tag;
  const kind = tagKindMeta(t.kind);
  const sa = isSuperAdmin();
  return (
    <tr className={t.active ? "" : "dim"}>
      <td><TagChip k={t.tagKey} big /></td>
      <td>
        <div className="cell-1">{kind?.label || t.kind}</div>
        <div className="cell-2">lands in {kind?.landsIn || "—"}</div>
      </td>
      <td>{t.custom ? <span className="pill info">Custom</span> : <span className="pill mute">Shipped</span>}</td>
      <td className="num">
        <Money paise={r.spentPaise} />
        {r.n ? <div className="cell-2">{r.n} row{r.n === 1 ? "" : "s"}</div> : null}
      </td>
      <td>
        <BudgetBar pct={r.pctOfBudget} />
        {t.budgetPaise ? <div className="cell-2">of {inr(t.budgetPaise)}</div> : null}
      </td>
      <td>{t.proofRequired ? <span className="fin-fine">Bill required</span> : <span className="faint">optional</span>}</td>
      <td className="tight">
        {t.active ? (
          <>
            {writable ? <button className="btn sm" onClick={() => onBudget(t)}>Budget</button> : null}
            {" "}
            {writable ? (
              <button className="btn sm dgr" disabled={!sa}
                title={sa ? undefined : "Deactivating a tag is Super Admin only."}
                onClick={() => onDeactivate(t)}>
                Deactivate
              </button>
            ) : null}
          </>
        ) : <span className="pill mute">Inactive</span>}
      </td>
    </tr>
  );
}
