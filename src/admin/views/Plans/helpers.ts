/* =====================================================================
   PLANS — the small pure helpers the catalogue, the drawer and the
   pricing editor all share, so the three surfaces cannot disagree.
   ===================================================================== */
import type { Plan } from "./api";
import { rangeOf } from "./api";

/* "1 months" reads as a typo. One helper, used by the drawer table and the
   pricing editor alike, so the two cannot disagree. */
export function monthsLabel(n: number) { return n + (n === 1 ? " month" : " months"); }

/* Indian lakh/crore grouping, no decimals — what `Intl` already does for
   en-IN, so there is no formatter of our own to keep correct.

   ₹0 is a real price (Business · Free Forever) and "₹0" reads as a number
   somebody forgot to fill in, so it prints as Free. Takes RUPEES: the plans
   API speaks rupee strings end to end, unlike the paise the older modules
   carry. */
const IN = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export function money(rupees: number) { return rupees ? "₹" + IN.format(rupees) : "Free"; }
/** Same grouping, but ₹0 stays a number — for a saving or a total that is
 *  genuinely zero rather than free. */
export const inr = (rupees: number) => "₹" + IN.format(rupees);

/** "autogrowth" → "Autogrowth". The server's families are free strings, so
 *  there is no label table to fall out of sync with them. */
export const familyLabel = (k: string) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : "—");

export const STATUS_LABEL: Record<string, string> = {
  active: "On sale", off: "Off sale", archived: "Archived"
};
/* Archived outranks on/off sale: an archived plan cannot be bought whatever its
   isActive flag says, so showing it as "on sale" would be a lie. */
export const statusOf = (pl: Plan) => (pl.archived ? "archived" : pl.active ? "active" : "off");

/** "17 Aug 2026", or "—". One formatter for every date this module prints. */
export function dateLabel(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—"
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function sorter(k?: string) {
  return function (a: Plan, b: Plan) {
    if (k === "title") return a.title < b.title ? -1 : 1;
    if (k === "price") {
      const ra = rangeOf(a), rb = rangeOf(b);
      return (rb ? rb.hi : 0) - (ra ? ra.hi : 0);
    }
    /* Default: the server's own order — family, then displayIndex, which IS
       the card order the public plans page renders in. Sorting it any other
       way here would show a ladder the buyer never sees. */
    if (a.family !== b.family) return a.family < b.family ? -1 : 1;
    if (a.displayIndex !== b.displayIndex) return a.displayIndex - b.displayIndex;
    return a.id - b.id;
  };
}

/* The one failure state a catalogue can have: on sale, and unbuyable. The
   public page renders prices from ACTIVE billing cycles only, so a live plan
   with none shows a card nobody can purchase. */
export function urgency(pl: Plan): { cls: string; why: string } | null {
  /* Nothing about an archived plan is urgent — it is out of the catalogue on
     purpose, and flagging it would bury the live plans that do need attention. */
  if (pl.archived) return null;
  if (pl.active && !pl.cycles.filter((c) => c.active).length)
    return { cls: "u-bad", why: "On sale with no active price — the plans page shows it with nothing to buy" };
  if (!pl.active && !pl.cycles.length)
    return { cls: "u-warn", why: "Never priced" };
  return null;
}
