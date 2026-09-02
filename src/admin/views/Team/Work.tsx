/* =============================================================================
   Work — #/work
   -----------------------------------------------------------------------------
     #/work                  the board, columns are the status vocabulary
     #/work?face=list        the same rows as a table
     #/work?item=W-K04       one item, in a drawer over whichever face is open

   ONE TABLE FOR THREE THINGS. Tasks, milestones and targets are one entity
   discriminated by `kind`, with `parentId` as the containment. Three tables
   would have produced three lists, three status vocabularies and three places
   to look for what a person is doing — and the relationship between them is
   containment, which is a self-reference and not a third system.

   `Delayed` IS NOT A COLUMN AND NOT A STATUS. It is `dueDate < today` on a
   non-terminal item, derived at read. It appears as a warn rail and an Overdue
   chip, and it can be filtered on, but nothing writes it and no sweep sets it.

   NO API YET — src/content/team/work.json through store.ts.
   ============================================================================= */
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  FilterChips, Icon, KvList, Notice, SearchField, SectionHead, Select, StatStrip, Table, TbTitle, Toolbar, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import {
  TODAY, WORK_STATUS, childrenOf, fmtDate, isDelayed, labelOf, parentOf, readMember,
  scopeLabel, scopeOf, setItemStatus, useItem, useMembers, useWork, workTotals,
} from "./store";
import type { WorkItem, WorkStatus } from "./store";
import {
  DelayFlag, KindMark, PriorityChip, Progress, ProtoBar, ScopeNote, StatusPill, Who, ago,
} from "./bits";
import "./team.css";

const ROUTE = "#/work";
const COLUMNS: WorkStatus[] = ["planned", "in_progress", "blocked", "completed"];

export default function Work() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  const face = p.face === "list" ? "list" : "board";
  const scope = scopeOf("work");
  const rows = useWork({
    member: p.member, kind: p.kind, status: p.status, priority: p.priority,
    due: p.due, q: p.q, parent: p.parent,
  }, scope);
  const members = useMembers();
  const all = useWork({}, scope);
  const shell = useShell();
  const open = useItem(p.item || null);

  usePageChrome({
    crumbs: <TbTitle label="Work" to="#/work" />,
    right: <ScopeNote text={scopeLabel(scope, all.length)} />,
  }, face);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    window.location.hash = ROUTE.slice(1) + qs(next);
  }, [p]);

  const onFilter = (name: string, value: string) => goto({ [name]: value || undefined });
  const openItem = (id: string) => goto({ item: id });

  /* The drawer is the record, and it closes by dropping the param — the same
     arrangement `#/team` uses, so Back and the scrim agree with the URL. */
  useEffect(() => {
    if (!open) return;
    shell.drawer(<ItemDrawer item={open} all={all} onClose={() => goto({ item: undefined })} />);
  }, [open, all, shell, goto]);

  const t = workTotals(all);
  const cells: (StatCell | "sep")[] = [
    { k: "items", v: t.total },
    "sep",
    { k: "in progress", v: t.inProgress, dot: "info", to: ROUTE + qs({ ...p, status: "in_progress" }), on: p.status === "in_progress" },
    { k: "planned", v: t.planned, dot: "", to: ROUTE + qs({ ...p, status: "planned" }), on: p.status === "planned" },
    "sep",
    { k: "overdue", v: t.delayed, dot: t.delayed ? "warn" : "", to: ROUTE + qs({ ...p, status: "delayed" }), on: p.status === "delayed" },
    { k: "blocked", v: t.blocked, dot: t.blocked ? "bad" : "", to: ROUTE + qs({ ...p, status: "blocked" }), on: p.status === "blocked" },
    "sep",
    { k: "done", v: t.completed, dot: "ok", to: ROUTE + qs({ ...p, status: "completed" }), on: p.status === "completed" },
  ];

  return (
    <div className="dls">
      <ProtoBar what="Work" endpoint="GET /admin/team/work" />

      <div className="dls-cmd">
        <Toolbar>
          <div className="tm-faces">
            <button className={"tm-face" + (face === "board" ? " on" : "")} onClick={() => goto({ face: undefined })}>
              <Icon name="menu" size="sm" />Board
            </button>
            <button className={"tm-face" + (face === "list" ? " on" : "")} onClick={() => goto({ face: "list" })}>
              <Icon name="doc" size="sm" />List
            </button>
          </div>
          <SearchField ph="Search work" name="q" val={p.q} onFilter={onFilter} />
          <Select name="member" label="Member" value={p.member} onFilter={onFilter}
            options={members.filter((m) => m.status === "active").map((m) => ({ v: m.memberId, l: m.name }))} />
          <Select name="kind" label="Kind" value={p.kind} onFilter={onFilter}
            options={[{ v: "task", l: "Tasks" }, { v: "milestone", l: "Milestones" }, { v: "target", l: "Targets" }]} />
          <Select name="priority" label="Priority" value={p.priority} onFilter={onFilter}
            options={[{ v: "high", l: "High" }, { v: "medium", l: "Medium" }, { v: "low", l: "Low" }]} />
          <Select name="due" label="Due" value={p.due} onFilter={onFilter}
            options={[{ v: "today", l: "Due today" }, { v: "week", l: "Due this week" }]} />
        </Toolbar>
      </div>

      <StatStrip cells={cells} />

      <div className="dls-chips">
        <FilterChips
          params={{
            q: p.q, kind: p.kind, priority: p.priority, due: p.due,
            member: p.member ? (readMember(p.member)?.name || p.member) : undefined,
            status: p.status ? (p.status === "delayed" ? "overdue" : labelOf(WORK_STATUS, p.status)) : undefined,
            parent: p.parent ? "within " + p.parent : undefined,
          }}
          onUnfilter={(n) => onFilter(n, "")} />
      </div>

      <div className="dls-body">
        {face === "board"
          ? <Board rows={rows} all={all} onOpen={openItem} />
          : <List rows={rows} all={all} onOpen={openItem} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- board --- */

function Board({ rows, all, onOpen }: { rows: WorkItem[]; all: WorkItem[]; onOpen: (id: string) => void }) {
  /* Cancelled has no column. It is terminal and it is not a stage of work —
     giving it one puts a permanent graveyard on a board people read left to
     right. It is reachable from the status filter, which is where somebody
     goes when they are actually looking for it. */
  return (
    <div className="tm-board">
      {COLUMNS.map((col) => {
        const list = rows.filter((i) => i.status === col);
        return (
          <section key={col} className={"tm-col tm-col-" + col}>
            <header>
              <b>{labelOf(WORK_STATUS, col)}</b>
              <span className="tnum">{list.length}</span>
            </header>
            <div className="tm-col-b">
              {list.length ? list.map((i) => (
                <Card key={i.itemId} item={i} all={all} onOpen={onOpen} />
              )) : <p className="tm-col-e">Nothing here.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Card({ item, all, onOpen }: { item: WorkItem; all: WorkItem[]; onOpen: (id: string) => void }) {
  const m = readMember(item.assigneeId);
  const parent = parentOf(item, all);
  const late = isDelayed(item);
  return (
    <button className={"tm-card" + (late ? " late" : "") + (item.status === "cancelled" ? " dead" : "")}
      onClick={() => onOpen(item.itemId)}>
      <span className="tm-card-t">
        <KindMark kind={item.kind} />
        <b>{item.title}</b>
      </span>
      <span className="tm-card-m">
        {m ? <span className="tm-card-who">{m.name}</span> : null}
        <PriorityChip p={item.priority} />
        {late ? <span className="pill warn xs">{ago(item.dueDate, TODAY)}</span> : null}
      </span>
      {parent ? (
        <span className="tm-card-p" title={"Rolls up to " + parent.title}>
          <KindMark kind={parent.kind} />{parent.title}
        </span>
      ) : null}
      {item.kind !== "task" ? <Progress item={item} items={all} /> : null}
    </button>
  );
}

/* ----------------------------------------------------------------- list --- */

function List({ rows, all, onOpen }: { rows: WorkItem[]; all: WorkItem[]; onOpen: (id: string) => void }) {
  return (
    <Table
      scroll min="1020px"
      cols={[
        { label: "", w: "3px" },
        { label: "Item" },
        { label: "Member", w: "180px" },
        { label: "Rolls up to", w: "200px" },
        { label: "Status", w: "130px" },
        { label: "Priority", w: "96px" },
        { label: "Due", w: "130px" },
        { label: "Progress", w: "140px" },
      ]}
      empty={{
        icon: "check", title: "No work matches",
        body: "Clear the filters, or assign the first item.",
      }}
      rows={rows.map((i) => {
        const m = readMember(i.assigneeId);
        const parent = parentOf(i, all);
        const late = isDelayed(i);
        const rail = late ? "u-warn" : i.status === "blocked" ? "u-bad" : "";
        return (
          <tr key={i.itemId} className={"clickable " + rail + (i.status === "cancelled" ? " dim" : "")}
            tabIndex={0} role="link"
            onClick={() => onOpen(i.itemId)}
            onKeyDown={(e) => { if (e.key === "Enter") onOpen(i.itemId); }}>
            <td className="rail"><i className={rail} /></td>
            <td>
              <span className="tm-title"><KindMark kind={i.kind} /><b>{i.title}</b></span>
              {i.expectedOutcome ? <span className="cell-2">{i.expectedOutcome}</span> : null}
            </td>
            <td>{m ? <Who m={m} /> : <span className="dim">—</span>}</td>
            <td>{parent ? <span className="tm-parent"><KindMark kind={parent.kind} />{parent.title}</span> : <span className="dim">—</span>}</td>
            <td><StatusPill status={i.status} /> <DelayFlag item={i} /></td>
            <td><PriorityChip p={i.priority} /></td>
            <td className="tnum">
              {i.dueDate ? fmtDate(i.dueDate) : "—"}
              {i.dueDate ? <span className="cell-2">{ago(i.dueDate, TODAY)}</span> : null}
            </td>
            <td>{i.kind === "task" ? <span className="dim">—</span> : <Progress item={i} items={all} />}</td>
          </tr>
        );
      })}
    />
  );
}

/* --------------------------------------------------------------- drawer --- */

function ItemDrawer({ item, all, onClose }: { item: WorkItem; all: WorkItem[]; onClose: () => void }) {
  const shell = useShell();
  const m = readMember(item.assigneeId);
  const parent = parentOf(item, all);
  const kids = childrenOf(item.itemId, all);
  const late = isDelayed(item);

  const move = (to: WorkStatus, reason?: string) => {
    const r = setItemStatus(item.itemId, to, reason);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast(item.title + " → " + labelOf(WORK_STATUS, to));
  };

  const askReason = (to: WorkStatus, title: string) => {
    shell.modal(
      <ReasonModal title={title} onSubmit={(reason) => { shell.closeLayer(); move(to, reason); }} />,
      "sm");
  };

  return (
    <>
      <div className="dw-h">
        <span className="tm-dw-t"><KindMark kind={item.kind} /><b>{item.title}</b></span>
        <StatusPill status={item.status} />
        <DelayFlag item={item} />
        <span className="spacer" />
        <button className="btn icon sm" aria-label="Close" onClick={onClose}><Icon name="x" size="sm" /></button>
      </div>
      <div className="dw-b">
        {late ? <Notice tone="warn" text={"Due " + fmtDate(item.dueDate) + " — " + ago(item.dueDate, TODAY) + ". Overdue is derived from the due date, not stored; it clears the moment the item does."} /> : null}
        {item.status === "blocked" && item.blockedReason
          ? <Notice tone="bad" text={item.blockedReason} /> : null}
        {item.status === "cancelled" && item.cancelledReason
          ? <Notice text={item.cancelledReason} /> : null}

        <SectionHead title="The item" />
        <KvList cls="wide" pairs={[
          ["Kind", <span className="tm-title" key="k"><KindMark kind={item.kind} />{item.kind}</span>],
          ["Assigned to", m ? m.name + " · " + m.designation : "—"],
          ["Rolls up to", parent
            ? <a key="p" href={"#/work?item=" + parent.itemId}>{parent.title}</a>
            : <span key="p" className="dim">Nothing — it is top level</span>],
          ["Due", item.dueDate ? fmtDate(item.dueDate) + " · " + ago(item.dueDate, TODAY) : "—"],
          ["Priority", item.priority],
          ["Expected outcome", item.expectedOutcome || <span key="e" className="dim">—</span>],
          ["Description", item.description || <span key="d" className="dim">—</span>],
        ]} />

        {item.kind !== "task" ? (
          <>
            <SectionHead title="Progress" desc={item.kind === "target"
              ? "Accumulated from the EOD reports that recorded it. Nothing types this number directly."
              : "Completed children ÷ total children. Nothing types this number directly."} />
            <Progress item={item} items={all} />
            {item.kind === "target" && item.targetValue
              ? <p className="tm-target tnum">{item.currentValue || 0} of {item.targetValue} {item.targetUnit}</p>
              : null}
          </>
        ) : null}

        {kids.length ? (
          <>
            <SectionHead title={"Inside this " + item.kind} desc={kids.length + " items"} />
            <ul className="tm-kids">
              {kids.map((k) => (
                <li key={k.itemId} className={k.status === "completed" ? "done" : ""}>
                  <a href={"#/work?item=" + k.itemId}>
                    <KindMark kind={k.kind} />{k.title}
                  </a>
                  <StatusPill status={k.status} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <div className="dw-f">
        {item.status === "planned" ? <button className="btn pri" onClick={() => move("in_progress")}>Start</button> : null}
        {item.status === "in_progress" ? <button className="btn pri" onClick={() => move("completed")}>Complete</button> : null}
        {item.status === "blocked" ? <button className="btn pri" onClick={() => move("in_progress")}>Unblock</button> : null}
        {item.status === "completed" ? <button className="btn" onClick={() => askReason("in_progress", "Reopen this item")}>Reopen…</button> : null}
        {!["completed", "cancelled", "blocked"].includes(item.status)
          ? <button className="btn" onClick={() => askReason("blocked", "What is blocking it?")}>Block…</button> : null}
        <span className="spacer" />
        {!["completed", "cancelled"].includes(item.status)
          ? <button className="btn dgr" onClick={() => askReason("cancelled", "Why is it cancelled?")}>Cancel…</button> : null}
      </div>
    </>
  );
}

/** Every transition that changes what a reader would conclude asks for a
 *  sentence. A blocked item with no blocker and a cancellation with no reason
 *  are both records that cannot answer the question they will be asked. */
function ReasonModal({ title, onSubmit }: { title: string; onSubmit: (reason: string) => void }) {
  const shell = useShell();
  return (
    <>
      <div className="md-h">
        <h3>{title}</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="tmReason">Reason <b className="req">*</b></label>
          <textarea id="tmReason" className="inp" rows={3} autoFocus
            placeholder="One sentence somebody reading this next month can act on." />
          <span className="help">Stored on the item and shown wherever its status is.</span>
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" onClick={() => {
          const el = document.getElementById("tmReason") as HTMLTextAreaElement | null;
          onSubmit(el ? el.value : "");
        }}>Save</button>
      </div>
    </>
  );
}
