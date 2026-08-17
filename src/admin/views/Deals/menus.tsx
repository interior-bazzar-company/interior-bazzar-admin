/* =============================================================================
   Deals — the popover menus.
   -----------------------------------------------------------------------------
   Stage, Priority, More, the chat pane's filter chips, the view switcher and
   the gate explainer. All of them render into the shell's popover, so each one
   closes it before it acts — the prototype's shell closed the popover before
   dispatching, and a menu that stays open over the dialog it just opened is
   the bug that produced that rule.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, qs } from "../../ui";
import { go } from "../../ui/nav";
import { useShell } from "../../shell/ShellContext";
import {
  ALL_STAGES, D, PRIO_HINT, VIEWS, VIEW_ORDER, head, merge, prioTone, viewOf
} from "./useDeals";
import type { DealsApiState, Params } from "./useDeals";
import { Mi, toneClass } from "./bits";

/* Every stage, every time, all of them pressable. There is no matrix to be
   off and no gate to be behind — see deals-engine.js — so the only thing a
   row still says about itself is whether it is where the deal already is and
   whether picking it moves the deal backwards. Backwards is marked, never
   refused: it is a correction, and corrections are the reason the stage can
   be set at all. */
export function StageMenu({ dl, onPick }: { dl: any; onPick: (to: number) => void }) {
  const shell = useShell();
  return (
    <div className="pop-b">
      {ALL_STAGES.map((t) => {
        const cur = t === dl.stage;
        const line = D.STAGES[t].hint || "";
        const tip = D.STAGES[t].label + (line ? " — " + line : "") + (cur ? " · current stage" : "");
        const inner = (
          <>
            <span className={"dws-sdot " + (D.STAGES[t].tone || "")}></span>
            <span><b>{D.STAGES[t].label}</b><span className="d">{line}</span></span>
            {cur ? <span className="r"><span className="pill xs">current</span></span>
              : t < dl.stage ? <span className="r"><span className="pill warn xs">back</span></span> : null}
          </>
        );
        return cur
          ? <div key={t} className="mi on" title={tip}>{inner}</div>
          : <button key={t} className="mi" title={tip} data-act="dl-stagego" data-ref={dl.deal_id} data-to={t}
              onClick={() => { shell.closePop(); onPick(t); }}>{inner}</button>;
      })}
    </div>
  );
}

/* Priority menu. No matrix and no guards — priority is an annotation, so any
   of the three is always reachable and the only unpickable row is the one
   already set. Listed 1-2-3, the order the values themselves are in.

   No footnote. The rule it stated — priority never moves money, ownership or a
   stage — is enforced in the engine and repeated on the button's own title. */
export function PrioMenu({ dl, onPick }: { dl: any; onPick: (to: number) => void }) {
  const shell = useShell();
  return (
    <div className="pop-b">
      {[1, 2, 3].map((v) => {
        const cur = v === dl.priority;
        const inner = (
          <>
            <span className={"dws-odot " + prioTone(v)}></span>
            <span><b>{D.PRIORITY[v]}</b><span className="d">{PRIO_HINT[v]}</span></span>
            {cur ? <span className="r"><span className="pill xs">current</span></span> : null}
          </>
        );
        const tip = D.PRIORITY[v] + " — " + PRIO_HINT[v] + (cur ? " · current" : "");
        return cur
          ? <div key={v} className="mi on" title={tip}>{inner}</div>
          : <button key={v} className="mi" title={tip} data-act="dl-priogo" data-ref={dl.deal_id} data-to={v}
              onClick={() => { shell.closePop(); onPick(v); }}>{inner}</button>;
      })}
    </div>
  );
}

/* Only what has no other button on this screen. Raise invoice, Log payment,
   Edit deal, Tags and Co-assign all already sit in the chat header or the
   context panel's Actions block — a second way to reach the same control is a
   second place it can go stale, not a convenience. Set deal value, Reassign
   and Close deal have no other home, which is why they are still here. */
export function MoreMenu({ dl, onValue, onReassign, onClose }: {
  dl: any; onValue: () => void; onReassign: () => void; onClose: () => void;
}) {
  const shell = useShell();
  const fire = (fn: () => void) => { shell.closePop(); fn(); };
  return (
    <div className="pop-b">
      {/* Offered whether or not a value is already set — it is the only way to
          correct one, now that no accepted quotation can write it for you. */}
      <Mi act="dl-value" ico="tag" label={dl.deal_value ? "Change deal value" : "Set deal value"}
        hint="The agreed total" onClick={() => fire(onValue)} />
      {head()
        ? <Mi act="dl-reassign" ico="recon" label="Reassign" hint="Change the owner" onClick={() => fire(onReassign)} />
        : null}
      <Mi act="dl-close" ico="x" label="Close deal" hint="Won or Lost" cls="dgr" onClick={() => fire(onClose)} />
    </div>
  );
}

/* One definition of what each filter offers, shared by the chip that renders
   it and the menu that opens from it — so the two can never drift. */
export const CHIP_LABEL: Record<string, string> = {
  stage: "Stage", tag: "List", priority: "Priority", owner: "Owner", sort: "Sort"
};
/* `dot` is the option's own colour. Only the filters whose values ARE
   colour-coded elsewhere in the app carry one — stage, tag and priority all
   render as toned pills on the rows, so the dot in the menu is the same
   signal, not a new one. Owner and Sort have no colour to be faithful to,
   and inventing one would imply a meaning that does not exist. */
/* Every option list comes from the ONE fetch the page already made — the API
   returns its own stage, priority and tag vocabularies with the list, and the
   owners are the ones actually on it. Nothing here is a hardcoded enum, and
   nothing reads a second store that could disagree with the rows on screen.
   `out` (sort by outstanding) is gone with the payment data it ranked on. */
export function chipOptions(name: string, api: DealsApiState): { v: string | number; l: string; dot?: string }[] {
  if (name === "stage") return ALL_STAGES.map((s) => ({ v: s, l: D.STAGES[s].label, dot: D.STAGES[s].tone || "" }));
  /* A tag's dot draws from the tag palette, not the status one — same class
     the pill on the row uses, so the menu and the row cannot disagree. */
  if (name === "tag") return api.tags.map((t) => ({ v: t.slug, l: t.label, dot: toneClass(t.tone).replace(/^ /, "") }));
  if (name === "priority") return [{ v: 3, l: "Urgent", dot: "bad" }, { v: 2, l: "High", dot: "warn" }, { v: 1, l: "Normal", dot: "" }];
  if (name === "owner") return api.owners.map((m) => ({ v: m.id, l: m.name }));
  if (name === "sort") return [{ v: "", l: "Newest first" }, { v: "age", l: "Stage age" },
    { v: "close", l: "Close date" }, { v: "value", l: "Deal value" },
    { v: "act", l: "Last activity" }];
  return [];
}
export function Odot({ o }: { o?: { dot?: string } | null }) {
  return o && o.dot !== undefined ? <span className={"dws-odot " + o.dot}></span> : null;
}

export function ChipMenu({ name, p, api }: { name: string; p: Params; api: DealsApiState }) {
  const shell = useShell();
  const cur = p[name];
  const opts = chipOptions(name, api);
  const nav = (to: string) => { shell.closePop(); go(to); };
  const rows: ReactNode[] = [];
  // Clearing is its own row rather than a blank option, which reads as a gap.
  if (cur) rows.push(
    <button key="__any" className="mi" data-go={"#/deals" + qs(merge(p, { [name]: "" }))}
      onClick={() => nav("#/deals" + qs(merge(p, { [name]: "" })))}>
      <Icon name="x" /><span><b>Any {(CHIP_LABEL[name] || name).toLowerCase()}</b></span>
    </button>);
  opts.forEach((o, i) => {
    const isOn = String(cur || "") === String(o.v);
    const to = "#/deals" + qs(merge(p, { [name]: o.v }));
    rows.push(
      <button key={i} className={"mi" + (isOn ? " on" : "")} data-go={to} onClick={() => nav(to)}>
        <Odot o={o} /><span><b>{o.l}</b></span>
        {isOn ? <span className="r"><Icon name="check" size="sm" /></span> : null}
      </button>);
  });
  if (!rows.length) rows.push(<div key="__none" className="mi off"><span><b>Nothing to filter by yet</b></span></div>);
  return <div className="pop-b">{rows}</div>;
}

export function ViewMenu({ p }: { p: Params }) {
  const shell = useShell();
  const cur = viewOf(p);
  return (
    <div className="pop-b">
      {VIEW_ORDER.map((k) => {
        const v = VIEWS[k];
        const to = "#/deals" + qs(merge(p, { view: v.param }));
        return (
          <button key={k} className={"mi" + (k === cur ? " on" : "")} data-go={to}
            onClick={() => { shell.closePop(); go(to); }}>
            <Icon name={v.icon} />
            <span><b>{v.label}</b><span className="d">{v.hint}</span></span>
            {k === cur ? <span className="r"><Icon name="check" size="sm" /></span> : null}
          </button>
        );
      })}
    </div>
  );
}

/* The refusal, stated on demand rather than printed under every button. Same
   shape as the stage menu's locked-row explainer, for the same reason: the
   rule is worth reading once, at the moment you reach for it. */
export function GateBody({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="pop-b">
      <div className="pop-gate">
        <div className="pop-gate-h"><Icon name="alert" /><b>{title}</b></div>
        <p>{body}</p>
      </div>
    </div>
  );
}
