/* =====================================================================
   PLANS — the drawer. One plan, everything the server holds about it, and
   the actions that can be taken on it. Same drawer pattern Deals uses.
   ---------------------------------------------------------------------
   Read in the order the questions are asked: what is this and can it be
   bought (the badges and the two conditions worth interrupting for), what
   does it cost (the cycles, which ARE the money), what does it promise
   (the features), what already points at it, the record's own facts, and
   finally what has been done to it.
   ===================================================================== */
import { useEffect, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { AuditEntry } from "../../../api/modules/adminOps";
import { Alert, Button, DrawerShell, EmptyState, KvList, PaneLoading, Pill, SectionHead, Table, Timeline } from "../../ui";
import { can } from "../../shell/AdminShell";
import { dateLabel, familyLabel, inr, money, monthsLabel } from "./helpers";
import { rangeOf, savingOf } from "./api";
import type { Cycle, Plan } from "./api";
import { FeatureList, PlanStatus } from "./bits";

export type Act = (a: string, ref?: number) => void;

export default function PlanDrawer({ plan, act, go }: { plan: Plan; act: Act; go: (h: string) => void }) {
  const pl = plan;
  const rng = rangeOf(pl);
  const unbuyable = !pl.archived && pl.active && !pl.cycles.filter((c) => c.active).length;

  return (
    <DrawerShell
      title={pl.title}
      sub={<span className="font-mono tnum">#{pl.id}{pl.tag ? " · " + pl.tag : ""}{pl.updatedAt ? " · updated " + dateLabel(pl.updatedAt) : ""}</span>}
      onClose={() => go("#/plans")}
      actions={<ActionBar pl={pl} act={act} />}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PlanStatus plan={pl} lg />
            <Pill tone="neutral" text={familyLabel(pl.family)} title="What buying it unlocks" />
            {pl.tier ? <Pill tone="neutral" text={"tier " + pl.tier} /> : null}
            {pl.badge ? <Pill tone="brand" text={pl.badge} title="The ribbon printed on the public card" /> : null}
          </div>
          {pl.subtitle ? <p className="text-sm text-tertiary">{pl.subtitle}</p> : null}

          {pl.archived ? (
            <Alert tone="info" ico="lock" title="Archived — out of the catalogue, and kept.">
              It cannot be bought and cannot be put back on sale until it is restored. Everything that
              already names it — quotation lines, memberships, the audit trail — still reads as it always did.
            </Alert>
          ) : null}

          {unbuyable ? (
            <Alert tone="bad" title="On sale with nothing to sell it at.">
              The public plans page prices a card from its active durations only, so this one renders
              with no price and cannot be bought. Switch a duration on, or take the plan off sale.
            </Alert>
          ) : null}
        </div>

        <section>
          <SectionHead title="Pricing" desc="What a buyer pays. This is the money the checkout charges." />
          <CycleTable pl={pl} act={act} />
        </section>

        <section>
          <SectionHead title="Features" desc="The bullet list on the public plan card." />
          {pl.features.length
            ? <FeatureList features={pl.features} />
            : <EmptyState icon="quote" title="No features listed"
                body="The plan card on the public page would show an empty list." />}
        </section>

        <section>
          <SectionHead title="Where it is used"
            desc="What already points at this plan — and would be left unexplainable if the row went away." />
          <KvList pairs={[
            /* Quotation lines carry no plan FK: the line snapshots a title typed by
               hand. Counted by the NAME they carry, and labelled as such — a link
               this weak must not be printed as if it were a foreign key. */
            ["On quotations", pl.usage.quotationLines
              ? <>{pl.usage.quotationLines} line{pl.usage.quotationLines === 1 ? "" : "s"}{" "}
                  <span className="text-quaternary">· matched by the title they name</span></>
              : <span className="text-quaternary">none</span>],
            ["Members", pl.usage.members
              ? <>{pl.usage.members} bought{" "}
                  <span className="text-quaternary">· {pl.usage.membersActive} still active</span></>
              : <span className="text-quaternary">none</span>]
          ]} />
        </section>

        <section>
          <SectionHead title="Plan record" />
          <KvList pairs={[
            ["Price range", rng ? money(rng.lo) + (rng.lo === rng.hi ? "" : " – " + money(rng.hi)) : "—"],
            ["Family", familyLabel(pl.family)],
            /* entityType is what a purchase actually unlocks, and it is derived
               from the family at creation — worth showing, because a mismatch is
               what makes a plan unbuyable. */
            ["Unlocks", pl.entityType || null],
            ["Card order", pl.displayIndex ? "#" + pl.displayIndex + " in " + familyLabel(pl.family)
              : <span className="text-quaternary">last</span>],
            ["Upgrade tier", pl.tier || null],
            /* NOT the price. Spelt out because it looks exactly like one — and
               blank must not print as "Free", which is a price. An unset amount
               is a real hazard: activating a plan that ranks below one the user
               already holds expires itself on the spot. */
            ["Ranking amount", pl.amount
              ? <><span className="font-mono tnum">{inr(pl.amount)}</span>{" "}
                  <span className="text-quaternary">· ranks upgrades, never charged</span></>
              : <span className="text-warning-primary">not set — this plan cannot outrank one a buyer already holds</span>],
            ["Default duration", pl.duration ? monthsLabel(Number(pl.duration)) : null]
          ]} />
        </section>

        <section>
          <SectionHead title="History" desc="Every level-3 write that named this plan." />
          <History planId={pl.id} />
        </section>

        <Alert tone="info" ico="lock" title="Editing this plan cannot change a quotation that already exists.">
          A quotation copies the price, the discount, the term and the feature list at the moment it is
          created, and reads nothing from here afterwards. New quotations get the new numbers; issued
          ones keep theirs.
        </Alert>
      </div>
    </DrawerShell>
  );
}

/* The billing cycles, which ARE the catalogue's money. `oldPrice` is only a
   saving when it sits above the price — the public page ignores it otherwise,
   so a stale one must not render here as a discount that isn't offered. */
function CycleTable({ pl, act }: { pl: Plan; act: Act }) {
  if (!pl.cycles.length)
    return <EmptyState icon="tag" title="Not priced yet"
      body="Add a duration and this plan becomes buyable."
      action={can("plans", "pricing")
        ? <Button color="primary" ico="plus" data-act="pl-edit" data-ref={pl.id}
            onClick={() => act("pl-edit", pl.id)}>Set pricing</Button>
        : null} />;

  return (
    <Table
      min="34rem"
      cols={[
        { label: "Duration" }, { label: "Price", cls: "n" }, { label: "Per month", cls: "n" },
        { label: "Label" }, { label: "On sale", cls: "c" },
      ]}
      rows={pl.cycles.map((c: Cycle) => {
        const save = savingOf(c);
        return (
          <tr key={c.id}>
            <td className="cell-1">{monthsLabel(c.months)}</td>
            <td className="n">
              <span className="font-medium text-primary">{money(c.price)}</span>
              {save ? <div className="cell-2">
                <span className="line-through">{money(c.oldPrice)}</span>{" "}
                <span className="text-success-primary">−{inr(save)}</span>
              </div> : null}
            </td>
            <td className="n text-quaternary">{c.months ? inr(Math.round(c.price / c.months)) : "—"}</td>
            <td>{c.badge ? <Pill xs tone="neutral" text={c.badge} /> : <span className="text-quaternary">—</span>}</td>
            <td className="c">{c.active
              ? <Pill xs dot tone="ok" text="Yes" />
              : <Pill xs dot tone="neutral" text="No" title="Kept, but off the public card" />}</td>
          </tr>
        );
      })}
    />
  );
}

/* The real audit trail, filtered to this plan. Every plans write appends one
   (`plan=<id> …`), so this is the same log Settings → Audit shows, narrowed —
   not a second history of its own. A session without audit access simply gets
   the empty line rather than an error it can do nothing about. */
function History({ planId }: { planId: number }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  useEffect(() => {
    if (!can("audit")) { setRows([]); return; }
    let cancelled = false;
    AdminOpsService.audit({ module: "plans", pageSize: 200 })
      .then((res) => {
        if (cancelled) return;
        const all = res.response === false ? [] : (res.data.entries || []);
        const mine = new RegExp("plan=" + planId + "\\b");
        setRows(all.filter((e) => mine.test(e.detail || "")));
      })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [planId]);

  if (rows === null) return <PaneLoading label="Loading the history…" />;
  if (!rows.length) return <p className="text-sm text-tertiary">Nothing yet.</p>;
  return (
    /* the shared timeline — see the note in Deals/Drawer.tsx */
    <Timeline items={rows.slice(0, 12).map((e) => ({
      tone: e.action.indexOf("deleted") >= 0 ? "bad" as const : "ok" as const,
      title: <span className="flex flex-wrap items-center gap-2">
        <Pill xs tone="neutral" text={e.action.replace(/^plan_/, "").replace(/_/g, " ")} />
        <span className="text-xs font-normal text-quaternary tnum">{dateLabel(e.ts || "")}</span>
      </span>,
      body: e.detail || "—",
      meta: e.actor || "—",
    }))} />
  );
}

/* Locked actions are ABSENT, not greyed — a disabled button invites a click
   and a support ticket. Price edits are level 3 (plans.pricing), the rest are
   level 2; the server re-checks all of it either way. */
function ActionBar({ pl, act }: { pl: Plan; act: Act }) {
  const mayEdit = can("plans", "edit") || can("plans", "pricing");

  /* An archived plan sells nothing, so the sale switches are gone rather than
     offered and then refused — restore is the only way back to the catalogue. */
  if (pl.archived)
    return can("plans", "archive")
      ? <Button color="primary" ico="undo" data-act="pl-restore" data-ref={pl.id}
          onClick={() => act("pl-restore", pl.id)}>Restore plan</Button>
      : null;

  return (
    <>
      {/* Archive, never delete: every row that names this plan has to keep
          resolving. Not styled danger-red, because nothing is destroyed. */}
      {can("plans", "archive")
        ? <Button color="secondary" ico="archive" data-act="pl-archive" data-ref={pl.id}
            onClick={() => act("pl-archive", pl.id)}>Archive</Button>
        : null}
      {can("plans", "status")
        ? (pl.active
          ? <Button color="secondary" ico="eyeoff" data-act="pl-off" data-ref={pl.id}
              onClick={() => act("pl-off", pl.id)}>Take off sale</Button>
          : <Button color="secondary" ico="check" data-act="pl-on" data-ref={pl.id}
              onClick={() => act("pl-on", pl.id)}>Put on sale</Button>)
        : null}
      {mayEdit
        ? <Button color="primary" ico="edit" data-act="pl-edit" data-ref={pl.id}
            onClick={() => act("pl-edit", pl.id)}>Edit plan</Button>
        : null}
    </>
  );
}
