/* =============================================================================
   The furniture every member surface shares.
   -----------------------------------------------------------------------------
   Three pieces, and the reason each one exists:

   · MemberStrip — WHOSE page this is, drawn identically on the member page and
     on all seven operation pages. An operation page that dropped the name would
     be a leave ledger belonging to nobody, and the fastest way to approve the
     wrong person's leave is to forget which person you are looking at.

   · OpNav — the operations as LINKS, not tabs. They navigate; each has its own
     address and its own entry in the back history, so Back goes back one
     operation instead of leaving the person entirely.

   · OpHead — the page's own title and its one-line reason, plus the slot the
     page's primary action sits in.

   None of these read the route. The page passes what it knows, so the same
   components render under a test with no router at all.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, Notice, Pill, qs } from "../../../ui";
import { go } from "../../../ui/nav";
import { Avatar } from "../../teamShared";
import type { Member as LiveMember } from "../../teamShared";
import type { Member } from "../store";
import { readMember } from "../store";
import type { MemberOp, Viewer } from "./ops";

/** The store member wearing the live shape, so the avatar renders for a member
 *  whose server row this admin cannot see. */
export const asLive = (m: Member | null): LiveMember | null =>
  m ? ({ id: Number(m.memberId), name: m.name } as LiveMember) : null;

export const memberHref = (id: string, op?: string) => "#/team/" + id + (op ? "/" + op : "");

export function MemberStrip({ m, live, viewer, right }: {
  m: Member | null; live: LiveMember | null; viewer: Viewer; right?: ReactNode;
}) {
  const senior = m && m.reportsTo ? readMember(m.reportsTo) : null;
  return (
    <div className="dls-cmd tm-mh">
      <Avatar u={live || asLive(m)} size="xl" />
      <span className="tm-who-t">
        <b className="tm-mh-n">
          {live ? live.name : m ? m.name : "Member"}
          {live && live.isSuperAdmin ? <Pill text="Full access" tone="brand" /> : null}
          {live && live.isActive === false ? <Pill text="Inactive" tone="bad" /> : null}
          {m && m.status !== "active" ? <Pill text={m.status} tone="bad" /> : null}
        </b>
        <span className="cell-2">
          {m ? m.designation + (m.department ? " · " + m.department : "") : "—"}
          {senior ? " · reports to " + senior.name : m && !m.reportsTo ? " · reports to nobody" : ""}
          {" · "}
          {viewer === "self" ? "your own record"
            : viewer === "senior" ? "reports to you" : "admin view"}
        </span>
      </span>
      <span className="spacer" />
      {right}
    </div>
  );
}

/** The operation switcher. `cur` is "" on the member page itself, which is why
 *  Overview is a row here rather than a separate control: leaving an operation
 *  is the same kind of move as entering one. */
export function OpNav({ id, ops, cur }: { id: string; ops: MemberOp[]; cur: string }) {
  const row = (key: string, icon: string, label: string) => (
    <button key={key || "overview"} className={"tm-op-t" + (cur === key ? " on" : "")}
      aria-current={cur === key ? "page" : undefined}
      data-go={memberHref(id, key)} onClick={() => go(memberHref(id, key))}>
      <Icon name={icon} size="sm" />{label}
    </button>
  );
  return (
    <nav className="tm-opnav" aria-label="This member">
      {row("", "user", "Overview")}
      {ops.map((o) => row(o.key, o.icon, o.label))}
    </nav>
  );
}

export function OpHead({ title, desc, right }: { title: ReactNode; desc?: ReactNode; right?: ReactNode }) {
  return (
    <div className="tm-oph">
      <div className="tm-oph-t">
        <h2>{title}</h2>
        {desc ? <p>{desc}</p> : null}
      </div>
      {right ? <div className="tm-oph-r">{right}</div> : null}
    </div>
  );
}

/** ONE REFUSAL, TWO PATHS. The card is not drawn for this viewer and the URL is
 *  refused, and both say the same sentence — a screen that hid the door but
 *  opened it to anyone who typed the address would be worse than one that never
 *  hid it, because it would look safe. */
export function OpRefused({ label }: { label: string }) {
  return (
    <Notice tone="warn" ico="lock" text={
      <><b>{label} is not on this view.</b> A reporting line says who reviews somebody's work.
        It does not carry their pay, the papers they signed, or their identity documents —
        that is a separate grant, and it is held on purpose by people who are not their manager.</>
    } />
  );
}

/** ₹, grouped the Indian way. One place, so no screen invents its own. */
export const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const workHref = (memberId: string) => "#/work" + qs({ member: memberId, face: "board" });
