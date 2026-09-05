/* =============================================================================
   The member's operations — one registry, read by three things.
   -----------------------------------------------------------------------------
   `/team/:id` is a PERSON. Each row below is something you DO about that person,
   and each one gets a page of its own at `/team/:id/<key>`: its own crumb, its
   own toolbar, its own link that somebody can paste into a message. That is the
   whole reason this file exists rather than a `?tab=` string — a tab is a piece
   of a screen, and "N. Pillai's leave" is not a piece of a screen, it is a
   place.

   Three things read this list and they must not disagree:
     · the launcher on the member page draws a card per op,
     · MemberPage routes the third URL segment to a component,
     · and both of them refuse an op whose `viewers` excludes the reader.

   THE REFUSAL IS THE POINT OF `viewers`. A senior sees somebody's attendance,
   work, leave and reports because a reporting line is about the work. It does
   NOT see their pay, the agreements the company sent them, or the identity
   documents they handed over: a reporting line is not a grant, and the panel
   should not be the thing that teaches an office that it is. Hiding the card
   is not enough on its own — the URL is guessable — so MemberPage checks the
   same list before it renders, and the summary block on the launcher drops
   every row it derived from an op this reader cannot open (§3.13: "a nudge
   must never leak what a tab hides").
   ============================================================================= */

/** Who is reading. Derived from the route id against the signed-in member and
 *  their `reportsTo`, never stored, never passed in a URL. */
export type Viewer = "self" | "senior" | "admin";

export interface MemberOp {
  /** The third URL segment, and the key everything else joins on. */
  key: string;
  label: string;
  icon: string;
  /** One line on the launcher card. It says what the page is FOR, because a
   *  card that only repeats its own title has told the reader nothing. */
  blurb: string;
  viewers: Viewer[];
}

export const MEMBER_OPS: MemberOp[] = [
  {
    key: "attendance", label: "Attendance", icon: "clock",
    blurb: "Every day of the last fortnight, and what each one actually was.",
    viewers: ["self", "senior", "admin"],
  },
  {
    key: "work", label: "Work", icon: "check",
    blurb: "Their tasks, the milestones those roll into, and the targets above them.",
    viewers: ["self", "senior", "admin"],
  },
  {
    key: "leave", label: "Leave", icon: "calendar",
    blurb: "Requested, approved, refused — and the days an approval covers.",
    viewers: ["self", "senior", "admin"],
  },
  {
    key: "reports", label: "Reports", icon: "doc",
    blurb: "The daily plan and the end-of-day report, and who has read them.",
    viewers: ["self", "senior", "admin"],
  },
  {
    key: "agreements", label: "Agreements", icon: "shield",
    blurb: "What the company sent them to sign, and where each one stopped.",
    viewers: ["self", "admin"],
  },
  {
    key: "documents", label: "Documents", icon: "lock",
    blurb: "What they handed over. Identity papers, and what is still missing.",
    viewers: ["self", "admin"],
  },
  {
    key: "pay", label: "Pay", icon: "cash",
    blurb: "Salary, payslips and incentives — read from Finance, never written here.",
    viewers: ["self", "admin"],
  },
];

export const opOf = (key: string): MemberOp | null =>
  MEMBER_OPS.filter((o) => o.key === key)[0] || null;

/** May this reader open this op at all? Used by the launcher AND by the router,
 *  so typing the URL gets the same answer as not seeing the card. */
export const opAllowed = (key: string, viewer: Viewer): boolean => {
  const o = opOf(key);
  return !!o && o.viewers.indexOf(viewer) >= 0;
};

export const opsFor = (viewer: Viewer): MemberOp[] =>
  MEMBER_OPS.filter((o) => o.viewers.indexOf(viewer) >= 0);
