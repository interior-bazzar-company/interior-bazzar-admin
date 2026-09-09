/* =============================================================================
   The furniture every member surface shares.
   -----------------------------------------------------------------------------
   Three pieces, and the reason each one exists:

   · MemberStrip — WHOSE page this is, drawn identically on the member page and
     on all seven operation pages. An operation page that dropped the name would
     be a leave ledger belonging to nobody, and the fastest way to approve the
     wrong person's leave is to forget which person you are looking at. It is a
     card, and the name inside it is the page's own <h1>: on `/team/:id` the
     person IS the title, so the shell's PageHeader would only say it twice.

   · OpNav — the operations as LINKS, not tabs, drawn as a grid of tiles. They
     navigate; each has its own address and its own entry in the back history,
     so Back goes back one operation instead of leaving the person entirely.
     Each tile carries the one live figure that says whether it is worth
     opening — a launcher whose cards only repeat their own titles is a list of
     links with extra padding.

   · OpHead — the operation page's own title and its one-line reason, plus the
     slot the page's primary action sits in. It is `SectionHead`: the page title
     upstairs belongs to the person, and what follows is a section of their
     record.

   None of these read the route. The page passes what it knows, so the same
   components render under a test with no router at all.
   ============================================================================= */
import type { ReactNode } from "react";
import { Avatar as UIAvatar, Card, EmptyState, Icon, Pill, SectionHead, qs } from "../../../ui";
import { RoleChips } from "../../teamShared";
import type { Member as LiveMember } from "../../teamShared";
import { OpChip, OpTile } from "../bits";
import type { Member } from "../store";
import { readMember } from "../store";
import type { MemberOp, Viewer } from "./ops";

/** The store member wearing the live shape, so the avatar renders for a member
 *  whose server row this admin cannot see. */
export const asLive = (m: Member | null): LiveMember | null =>
  m ? ({ id: Number(m.memberId), name: m.name } as LiveMember) : null;

export const memberHref = (id: string, op?: string) => "#/team/" + id + (op ? "/" + op : "");

const VIEWER_NOTE: Record<Viewer, string> = {
  self: "your own record",
  senior: "reports to you",
  admin: "admin view",
};

export function MemberStrip({ m, live, viewer, right }: {
  m: Member | null; live: LiveMember | null; viewer: Viewer; right?: ReactNode;
}) {
  const senior = m && m.reportsTo ? readMember(m.reportsTo) : null;
  const name = live ? live.name : m ? m.name : "Member";
  const email = (live && live.email) || (m && m.email) || "";
  const phone = (live && live.phone) || (m && m.phone) || "";

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <UIAvatar name={name} size="xl" className="shrink-0" />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="truncate text-xl font-semibold tracking-tight text-primary md:text-display-xs">{name}</h1>
            {live && live.isSuperAdmin ? <Pill text="Full access" tone="brand" /> : null}
            {live && live.isActive === false ? <Pill text="Inactive" tone="bad" dot /> : null}
            {m && m.status !== "active" ? <Pill text={m.status} tone="bad" dot /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tertiary">
            <span className="font-medium text-secondary">{m ? m.designation : "—"}</span>
            {m && m.department ? (
              <>
                <span aria-hidden="true" className="text-quaternary">·</span>
                <span>{m.department}</span>
              </>
            ) : null}
            <span aria-hidden="true" className="text-quaternary">·</span>
            <span>
              {senior ? "reports to " + senior.name : m && !m.reportsTo ? "reports to nobody" : "no reporting line"}
            </span>
            <span aria-hidden="true" className="text-quaternary">·</span>
            <span className="text-quaternary">{VIEWER_NOTE[viewer]}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {email ? (
              <a
                href={"mailto:" + email}
                className="inline-flex min-w-0 items-center gap-1.5 rounded text-tertiary outline-focus-ring hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Icon name="mail" size="xs" className="text-fg-quaternary" />
                <span className="truncate">{email}</span>
              </a>
            ) : null}
            {phone ? (
              <span className="inline-flex items-center gap-1.5 text-tertiary">
                <Icon name="phone" size="xs" className="text-fg-quaternary" />
                <span className="tnum">{phone}</span>
              </span>
            ) : null}
            {live && live.roles && live.roles.length ? <RoleChips u={live} /> : null}
          </div>
        </div>

        {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
      </div>
    </Card>
  );
}

/** THE LAUNCHER, AT TWO DENSITIES.
 *
 *  `cur` is "" on the member page itself, which is why Overview is a door here
 *  rather than a separate control: leaving an operation is the same kind of
 *  move as entering one. `stats` is optional — the member page derives a figure
 *  per operation and hands it in; a caller that has none still gets a working
 *  set of doors.
 *
 *  ON THE MEMBER PAGE the doors ARE the content: nine tiles, each carrying the
 *  live reading that says whether it is worth opening, with a line saying what
 *  the page is for. ON AN OPERATION PAGE the same nine would be three rows of
 *  chrome standing between the topbar and the thing you came to read, so they
 *  collapse to a one-line rail — same order, same figures, same "you are here",
 *  a fifth of the height. */
export function OpNav({ id, ops, cur, stats }: {
  id: string;
  ops: MemberOp[];
  cur: string;
  stats?: Record<string, { v: ReactNode; s?: ReactNode; tone?: string }>;
}) {
  const home = cur === "";

  if (!home) {
    return (
      <nav aria-label="This member" className="flex flex-wrap gap-2">
        <OpChip ico="user" label="Overview" to={memberHref(id, "")} on={false} />
        {ops.map((o) => {
          const st = (stats && stats[o.key]) || null;
          return (
            <OpChip
              key={o.key}
              ico={o.icon}
              label={o.label}
              v={st ? st.v : undefined}
              tone={st ? st.tone : undefined}
              to={memberHref(id, o.key)}
              on={cur === o.key}
            />
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="This member" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <OpTile
        ico="user"
        label="Overview"
        v="The record"
        s="what needs somebody, and the facts"
        blurb="Everything true about this person right now, and every row that has stopped on a human."
        to={memberHref(id, "")}
        on
      />
      {ops.map((o) => {
        const st = (stats && stats[o.key]) || null;
        return (
          <OpTile
            key={o.key}
            ico={o.icon}
            label={o.label}
            v={st ? st.v : "Open"}
            s={st ? st.s : undefined}
            tone={st ? st.tone : undefined}
            blurb={o.blurb}
            to={memberHref(id, o.key)}
          />
        );
      })}
    </nav>
  );
}

export function OpHead({ title, desc, right }: { title: ReactNode; desc?: ReactNode; right?: ReactNode }) {
  return <SectionHead title={title} desc={desc} right={right} className="mb-0" />;
}

/** ONE REFUSAL, TWO PATHS. The card is not drawn for this viewer and the URL is
 *  refused, and both say the same sentence — a screen that hid the door but
 *  opened it to anyone who typed the address would be worse than one that never
 *  hid it, because it would look safe. */
export function OpRefused({ label }: { label: string }) {
  return (
    <EmptyState
      icon="lock"
      title={label + " is not on this view"}
      body={"A reporting line says who reviews somebody's work. It does not carry their pay, the papers they "
        + "signed, or their identity documents — that is a separate grant, and it is held on purpose by "
        + "people who are not their manager."}
    />
  );
}

/** ₹, grouped the Indian way. One place, so no screen invents its own. */
export const rupees = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const workHref = (memberId: string) => "#/work" + qs({ member: memberId, face: "board" });
