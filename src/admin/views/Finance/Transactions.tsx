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
import { EmptyState, FilterChips, Icon, Notice, qs, SearchField, Select } from "../../ui";
import { go } from "../../ui/nav";
import { SubTabs, Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { BudgetBar, Dir, Money, TagChip, TxnPill } from "./bits";
import { MetricTip } from "./InfoTip";
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
  if (key === "dir") return value === "out" ? "Money out" : "Money in";
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

  return (
    <Frame toast={toast}
      cmd={tab === "transactions" ? (
        <>
          <SearchField key={"q" + (p.q || "")} ph="Description, party, ID or reference…" val={p.q} onFilter={onSearch} />
          <Select key={"dir" + (p.dir || "")} name="dir" label="Direction" value={p.dir} onFilter={onFilter}
            options={[{ v: "out", l: "Money out" }, { v: "in", l: "Money in" }]} />
          <Select key={"tag" + (p.tag || "")} name="tag" label="Tag" value={p.tag} onFilter={onFilter}
            options={tags.map((t) => ({ v: t.tagKey, l: t.label + (t.active ? "" : " — inactive") }))} />
          <Select key={"kind" + (p.kind || "")} name="kind" label="Rolls up to" value={p.kind} onFilter={onFilter}
            options={TAG_KINDS.map((k) => ({ v: k.key, l: k.label }))} />
          <Select key={"state" + (p.state || "")} name="state" label="State" value={p.state} onFilter={onFilter}
            options={TXN_STATES.map((s) => ({ v: s.key, l: s.label }))} />
          <Select key={"range" + (p.range || "")} name="range" label="Period" value={p.range} onFilter={onFilter}
            options={[{ v: "month", l: PERIOD.label }]} />
          <Select key={"flag" + (p.flag || "")} name="flag" label="Queue" value={p.flag} onFilter={onFilter}
            options={[{ v: "nobill", l: "Missing a bill" }]} />
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
        <SubTabs items={[{ k: "transactions", label: "Transactions" }, { k: "tags", label: "Tags" }]} cur={tab}
          onPick={(k) => onParams({ tab: k === "transactions" ? undefined : k })} />
        {tab === "transactions" ? (
          <>
            <MoneyTiles p={p} onParams={onParams} />
            <div className="dls-chips">
              <FilterChips
                params={Object.keys(p)
                  .filter((k) => k !== "tab" && k !== "page" && p[k])
                  .reduce((o, k) => { o[k] = filterValueLabel(k, p[k] as string, tags); return o; }, {} as Record<string, string>)}
                labels={FILTER_LABELS}
                onUnfilter={onUnfilter} />
            </div>
          </>
        ) : null}
      </>}>
      {tab === "transactions"
        ? <TxnTable p={p} writable={writable} onRecord={openTxnModal} onUnfilter={onUnfilter} />
        : <TagsTab writable={writable} onBudget={openBudget} onDeactivate={openDeactivate} />}
    </Frame>
  );
}

/* -------------------------------------------------------------- money tiles --- */
/** What a person opens this face to know: what left, what came in and why
 *  that is never revenue, what has no paper behind it, and what is spent but
 *  deliberately not part of the operating picture.
 *
 *  Only "missing a bill" is a button: it is the one figure worth jumping to
 *  the queue for. The other three carry the "i" reference button from
 *  InfoTip inside them, and an interactive element cannot nest inside
 *  another one — a `<button>` around a `<button>` breaks the DOM and the
 *  click along with it — so those three are read-outs, not controls. */
function MoneyTiles({ p, onParams }: { p: Params; onParams: (patch: Params) => void }) {
  const o = useOverview();
  const rows = useTxnRows();
  const missingBillN = rows.filter((r) => r.missingBill).length;
  const on = (patch: Params) => Object.keys(patch).every((k) => (p[k] || undefined) === patch[k]);
  return (
    <div className="fin-money-strip">
      <div className="fin-mt">
        <span className="k">Money out · {PERIOD.label}<MetricTip k="other_out" /></span>
        <span className="v">{inr(o.otherOutPaise)}</span>
        <span className="s">{o.otherOutN} transaction{o.otherOutN === 1 ? "" : "s"}{o.excludedPaise ? " · " + inr(o.excludedPaise) + " excluded, apart" : ""}</span>
      </div>
      <div className="fin-mt">
        <span className="k">Money in — never revenue<MetricTip k="other_in" /></span>
        <span className="v">{inr(o.otherInPaise)}</span>
        <span className="s">{o.otherInN} credit{o.otherInN === 1 ? "" : "s"} · interest, own transfers, vendor refunds only</span>
      </div>
      <button type="button" className={"fin-mt" + (missingBillN ? " warn" : " mute") + (on({ flag: "nobill" }) ? " on" : "")}
        onClick={() => onParams({ flag: "nobill" })}>
        <span className="k">Missing a bill</span>
        <span className="v">{missingBillN}</span>
        <span className="s">above {inr(BILL_THRESHOLD_PAISE)} blocks closing the period</span>
      </button>
      <div className="fin-mt mute">
        <span className="k">Excluded spend</span>
        <span className="v">{inr(o.excludedPaise)}</span>
        <span className="s">taxes &amp; statutory — cash out, not an operating cost</span>
      </div>
    </div>
  );
}

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
  const rail = r.missingBill ? "warn" : t.state === "reversed" ? "bad" : "";
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
      <td><TxnPill k={t.state} /></td>
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
      <Notice tone="info" text={<>
        <b>A budget warns at 90% of itself and never blocks.</b> Rent still has to be paid in a
        month somebody set its budget too low — the number is a flag for a person, not a limit
        the panel enforces.
      </>} />
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
