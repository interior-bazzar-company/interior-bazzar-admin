/* =============================================================================
   Deals — the menus a deal's own header carries.
   -----------------------------------------------------------------------------
   Stage, Priority, More, and the gate explainer. The first three are React
   Aria menus now (Untitled UI's Dropdown): they own their trigger, their
   placement, their keyboard and their dismissal, so the module no longer
   positions a popup or remembers to close one before it acts. Each trigger
   READS the value it sets — a menu you have to open to find out where the deal
   is is a menu, not a control.

   The filter vocabularies (`CHIP_LABEL`, `chipOptions`) stay: the chat pane's
   filter row and the table's filter bar both read them, so the two can never
   offer different options for the same filter.
   ============================================================================= */
import type { ReactNode } from "react";
import { ChevronDown } from "@untitledui/icons";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { cx } from "@/utils/cx";
import { Button, Icon, Pill } from "../../ui";
import {
  ALL_STAGES, D, PRIO_HINT, head, prioTone
} from "./useDeals";
import type { DealsApiState } from "./useDeals";

const DOT: Record<string, string> = {
  ok: "bg-utility-green-500",
  warn: "bg-utility-yellow-500",
  bad: "bg-utility-red-500",
  info: "bg-utility-blue-500",
  dead: "bg-utility-neutral-400",
  "": "bg-utility-neutral-400",
};
const Dot = ({ tone }: { tone?: string }) => (
  <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", DOT[tone || ""] || DOT[""])} />
);

/* =========================================================== STAGE =========
   Every stage, every time, all of them pressable. There is no matrix to be off
   and no gate to be behind — see deals-engine.js — so the only thing a row
   still says about itself is whether it is where the deal already is and
   whether picking it moves the deal backwards. Backwards is marked, never
   refused: it is a correction, and corrections are the reason the stage can be
   set at all. */
export function StageMenu({ dl, onPick, size }: { dl: any; onPick: (to: number) => void; size?: "xs" | "sm" }) {
  const cur = D.STAGES[dl.stage] || { label: String(dl.stage), tone: "" };
  return (
    <Dropdown.Root>
      <Button
        color="secondary"
        size={size || "sm"}
        aria-haspopup="menu"
        aria-label={"Stage — currently " + cur.label}
        data-act="dl-stagemenu"
        data-ref={dl.deal_id}
        iconLeading={<Dot tone={cur.tone} />}
        iconTrailing={ChevronDown}
      >
        {cur.label}
      </Button>
      <Dropdown.Popover placement="bottom end" className="w-72">
        <Dropdown.Menu aria-label="Change stage" selectionMode="single" selectedKeys={[String(dl.stage)]}>
          {ALL_STAGES.map((t) => {
            const s = D.STAGES[t];
            return (
              <Dropdown.Item
                key={t}
                id={String(t)}
                textValue={s.label}
                onAction={() => { if (t !== dl.stage) onPick(t); }}
                isDisabled={t === dl.stage}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Dot tone={s.tone} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{s.label}</span>
                    {s.hint ? <span className="truncate text-xs font-normal text-tertiary">{s.hint}</span> : null}
                  </span>
                  {t < dl.stage ? <Pill xs tone="warn" text="back" className="ml-auto" /> : null}
                </span>
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/* ======================================================== PRIORITY =========
   No matrix and no guards — priority is an annotation, so any of the three is
   always reachable and the only unpickable row is the one already set. Listed
   1-2-3, the order the values themselves are in. The rule it used to state in
   a footnote — priority never moves money, ownership or a stage — is enforced
   in the engine and repeated on the trigger's own label. */
export function PrioMenu({ dl, onPick, size }: { dl: any; onPick: (to: number) => void; size?: "xs" | "sm" }) {
  const tone = prioTone(dl.priority);
  return (
    <Dropdown.Root>
      <Button
        color="secondary"
        size={size || "sm"}
        aria-haspopup="menu"
        aria-label={"Priority — currently " + D.PRIORITY[dl.priority] + ". Visual triage only; it never changes who the deal goes to."}
        data-act="dl-priomenu"
        data-ref={dl.deal_id}
        iconLeading={<Dot tone={tone} />}
        iconTrailing={ChevronDown}
      >
        {D.PRIORITY[dl.priority]}
      </Button>
      <Dropdown.Popover placement="bottom end" className="w-64">
        <Dropdown.Menu aria-label="Set priority" selectionMode="single" selectedKeys={[String(dl.priority)]}>
          {[1, 2, 3].map((v) => (
            <Dropdown.Item
              key={v}
              id={String(v)}
              textValue={D.PRIORITY[v]}
              onAction={() => { if (v !== dl.priority) onPick(v); }}
              isDisabled={v === dl.priority}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <Dot tone={prioTone(v)} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{D.PRIORITY[v]}</span>
                  <span className="truncate text-xs font-normal text-tertiary">{PRIO_HINT[v]}</span>
                </span>
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/* ============================================================ MORE =========
   Only what has no other button on this screen. Edit deal, Lists and the chain
   actions all already sit in the chat header or the context panel — a second
   way to reach the same control is a second place it can go stale. Set deal
   value, Reassign and Close deal have no other home, which is why they are
   still here. Destructive last, behind the separator the shared menu draws. */
export function MoreMenu({ dl, onValue, onReassign, onClose }: {
  dl: any; onValue: () => void; onReassign: () => void; onClose: () => void;
}) {
  return (
    <Dropdown.Root>
      <Button color="tertiary" size="sm" aria-haspopup="menu" aria-label="More actions" data-act="dl-more" data-ref={dl.deal_id} iconLeading={<Icon name="dots" />} />
      <Dropdown.Popover placement="bottom end" className="w-64">
        <Dropdown.Menu aria-label="Deal actions">
          <Dropdown.Section>
            {/* Offered whether or not a value is already set — it is the only
                way to correct one, now that no accepted quotation can write it
                for you. */}
            <Dropdown.Item id="value" icon={undefined} label={dl.deal_value ? "Change deal value" : "Set deal value"} addon="₹" onAction={onValue} />
            {head() ? <Dropdown.Item id="reassign" label="Reassign" addon="owner" onAction={onReassign} /> : null}
          </Dropdown.Section>
          <Dropdown.Separator />
          <Dropdown.Section>
            <Dropdown.Item id="close" label="Close deal" addon="won / lost" onAction={onClose} className="[&_span]:text-error-primary" />
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/* ========================================================== FILTERS ========
   One definition of what each filter offers, shared by every control that
   renders it — so the table's filter bar and the chat pane's filter row can
   never drift.

   `dot` is the option's own colour. Only the filters whose values ARE
   colour-coded elsewhere in the app carry one — stage, tag and priority all
   render as toned chips on the rows, so the dot in the list is the same
   signal, not a new one. Owner and Sort have no colour to be faithful to, and
   inventing one would imply a meaning that does not exist.

   Every option list comes from the ONE fetch the page already made — the API
   returns its own stage, priority and tag vocabularies with the list, and the
   owners are the ones actually on it. Nothing here is a hardcoded enum, and
   nothing reads a second store that could disagree with the rows on screen. */
export const CHIP_LABEL: Record<string, string> = {
  stage: "Stage", tag: "List", priority: "Priority", owner: "Owner", sort: "Sort"
};

export function chipOptions(name: string, api: DealsApiState): { v: string | number; l: string; dot?: string }[] {
  if (name === "stage") return ALL_STAGES.map((s) => ({ v: s, l: D.STAGES[s].label, dot: D.STAGES[s].tone || "neutral" }));
  /* A tag's dot draws from the tag palette, not the status one — the same hue
     the chip on the row wears, so the menu and the row cannot disagree. */
  if (name === "tag") return api.tags.map((t) => ({ v: t.slug, l: t.label, dot: t.tone || "neutral" }));
  if (name === "priority") return [{ v: 3, l: "Urgent", dot: "bad" }, { v: 2, l: "High", dot: "warn" }, { v: 1, l: "Normal", dot: "neutral" }];
  if (name === "owner") return api.owners.map((m) => ({ v: m.id, l: m.name }));
  if (name === "sort") return [{ v: "", l: "Newest first" }, { v: "age", l: "Stage age" },
    { v: "close", l: "Close date" }, { v: "value", l: "Deal value" },
    { v: "act", l: "Last activity" }];
  return [];
}

/** The same options in the shape `Select` takes (string values, one dot). */
export function selectOptions(name: string, api: DealsApiState) {
  return chipOptions(name, api).map((o) => ({ v: String(o.v), l: o.l, dot: o.dot }));
}

/* ============================================================= GATE ========
   The refusal, stated on demand rather than printed under every button. The
   rule is worth reading once, at the moment you reach for it — so it lives in
   the popover the gated control opens, never in a tooltip that vanishes while
   you are still reading the second sentence. */
export function GateBody({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="flex max-w-72 gap-3 p-3.5">
      <Icon name="alert" size="sm" className="mt-0.5 shrink-0 text-fg-warning-primary" />
      <div className="min-w-0">
        <b className="block text-sm font-semibold text-primary">{title}</b>
        <p className="mt-1 text-sm text-tertiary">{body}</p>
      </div>
    </div>
  );
}
