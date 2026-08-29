/* =============================================================================
   Analytics — the one place the numbers live.
   -----------------------------------------------------------------------------
   Overview is folded in here: two dashboards over one population was a split
   with no seam to justify it, and they agreed only because both called the same
   derivation.

   EVERY FIGURE IS IN A CARD, and the cards pair up. Thirteen loose sections in
   one column read as an undifferentiated scroll — nothing tells you where an
   idea starts, and the eye has nothing to catch on the way down. A card gives
   each figure a boundary and a subtitle that states what it counts.

   THE RANGE IS REAL. It drives every range-dependent figure on the page through
   `rangeTotals()`, which sums the monthly series and recomputes each rate from
   its own numerator and denominator. Two things are deliberately NOT re-cut and
   say so on their own cards: cohort retention, which is cohort-keyed by nature,
   and revenue, which Finance settles on its own calendar.
   ============================================================================= */
import { useMemo } from "react";
import { useShell } from "../../shell/ShellContext";
import { Icon, Tiles } from "../../ui";
import { go } from "../../ui/nav";
import { Block, Blocks, Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { Assumed, EventRow, StatusPill } from "./bits";
import { BarRows, CohortHeat, ColumnChart, FunnelChart } from "./charts";
import type { BarRow, Series } from "./charts";
import DateRange from "./DateRange";
import {
  ANALYTICS, LAST_MONTH, MEMBERSHIP_STATUSES, METRICS, RENEWAL_WINDOW_DAYS, VOCAB,
  bandCounts, clampRange, countsOf, delta, money, pct, presetRange, rangeTotals,
  useRecentActivity,
} from "./store";

const dir = (extra: Record<string, string>) =>
  "#/users" + Object.keys(extra).map((k, i) => (i ? "&" : "?") + k + "=" + extra[k]).join("");

/* Fixed slot order. Registrations is the base volume, first-time members the
   conversion, renewals the retention — assigned in this order and never
   reassigned, so a colour always means the same series. */
const GROWTH: Series[] = [
  { key: "registrations", label: "Registrations", slot: 1 },
  { key: "firstTimeMembers", label: "First-time members", slot: 2 },
  { key: "renewals", label: "Renewals", slot: 3 },
];

/* Membership state is a state, so it wears the reserved status tokens rather
   than a categorical slot — and every row carries its own pill, so colour is
   never the only thing saying which state it is. */
const STATUS_TONE: Record<string, string> = {
  active: "st-ok", pending: "st-warn", paused: "st-warn",
  suspended: "st-bad", expired: "st-mute", cancelled: "st-mute",
};

export default function Analytics({ rows, p, onView, onParams }: FaceProps) {
  const { toast } = useShell();
  const c = countsOf(rows);
  const recent = useRecentActivity(6);

  /* The range lives in the URL like every other control in this module, so a
     narrowed dashboard is a link somebody can send. Six months is the default
     because it is the shortest span in which a renewal cycle is visible.

     `start`/`end`, NOT `from`/`to`. The users list already owns `from`/`to` for
     its custom registration window, and switching faces carries the filters
     across — so one click from a narrowed list would have handed this control
     two ISO dates and meant something entirely different by them. Two meanings
     for one param is a bug waiting for the first person who uses both. */
  const range = useMemo(() => {
    const fallback = presetRange(6);
    return clampRange(p.start || fallback.from, p.end || fallback.to);
  }, [p.start, p.end]);
  const t = useMemo(() => rangeTotals(range.from, range.to), [range]);

  /* One navigation for the pair. Setting them one at a time would navigate
     twice and the second call would read a stale `p`. */
  const onRange = (from: string, to: string) => onParams({ start: from, end: to });

  const statusRows: BarRow[] = c.byStatus.map((s) => ({
    key: s.key,
    label: <StatusPill k={s.key} />,
    value: s.n,
    tone: STATUS_TONE[s.key],
    hint: <button className="lnk" onClick={() => go(dir({ ms: s.key }))}>open the list</button>,
    title: MEMBERSHIP_STATUSES.filter((x) => x.key === s.key)[0]?.meaning,
  }));

  /* Plans are size tiers, so they are ORDINAL — the order means something and
     the colour says so. Three unrelated hues would spend the identity channel
     on something the sequence already carries. */
  const planRows: BarRow[] = t.byPlan.map((x, i) => ({
    key: x.code,
    label: x.label,
    value: x.activeAtEnd,
    tone: "o" + (i + 1),
    hint: <>{x.newTerms} new · {x.renewals} renewed · {x.expired} expired</>,
    title: x.label + ": " + x.activeAtEnd + " terms standing at the end of the range. "
      + "That is a level, not a flow — it is not the sum of the months.",
  }));

  /* Sources are nominal — no natural order — so every bar takes the same slot-1
     hue. Shading them by value would double-encode the bar length as colour. */
  const sourceRows: BarRow[] = t.bySource
    .slice().sort((a, b) => b.registrations - a.registrations)
    .map((s) => ({
      key: s.key,
      label: s.label,
      value: s.registrations,
      hint: <>{s.firstTimeMembers} converted · {pct(
        s.registrations ? s.firstTimeMembers / s.registrations : null, 0)}</>,
    }));

  const rev = ANALYTICS.revenueContext;
  const notThisRange = range.to !== LAST_MONTH || t.monthCount !== 1;

  return (
    <Frame view="analytics" onView={onView} toast={toast}
      counts={bandCounts(rows)}
      cmd={<>
        <DateRange from={range.from} to={range.to} onPick={onRange} />
        <span className="um-against">
          {t.monthCount} month{t.monthCount === 1 ? "" : "s"}
          {t.prev ? <> · against the {t.monthCount} before</> : <> · no prior span to compare</>}
        </span>
        <span className="spacer" />
        <button className="btn" onClick={() => onView("renewals")}>
          <Icon name="clock" />Renewal queue
        </button>
        <button className="btn" onClick={() => onView("users")}>
          <Icon name="users" />Users
        </button>
      </>}>

      {/* ======================================================= the base === */}
      <Blocks>
        <Block wide title="The base" desc="unique users · counted now, not over the range"
          foot={<>User and Active Member are derived from membership state at read
            time. There is no stored flag behind either number.</>}>
          <Tiles list={[
            { k: "Total registered", v: c.total, s: c.deactivated + " deactivated, kept in history",
              to: dir({}) },
            { k: "Users", v: c.normal, tone: "warn", s: "no entitling term",
              to: dir({ cls: "normal" }) },
            { k: "Active Members", v: c.activeMembers, tone: "ok",
              s: c.paused + " paused · " + c.suspended + " suspended, counted apart",
              to: dir({ view: "members", cls: "active_member" }) },
            { k: "Registered to member", v: pct(c.conversion), s: "lifetime, this base" },
          ]} />
        </Block>

        {/* ========================================================= growth === */}
        <Block wide title="How the base grew" desc={t.label + " · unique users per month"}
          right={<span className="um-blocknums">
            {t.registrations.toLocaleString("en-IN")} registered ·{" "}
            {t.firstTimeMembers.toLocaleString("en-IN")} converted
          </span>}
          foot={<>Renewals sit beside first-time members and are never added to them — counting
            the {t.renewals.toLocaleString("en-IN")} renewals in this range as new members would
            overstate acquisition by{" "}
            {pct(t.firstTimeMembers ? t.renewals / t.firstTimeMembers : null, 0)}.</>}>
          <ColumnChart series={GROWTH} labelSeries="registrations"
            points={t.months.map((m) => ({
              key: m.month, label: m.label,
              values: {
                registrations: m.registrations,
                firstTimeMembers: m.firstTimeMembers,
                renewals: m.renewals,
              },
            }))}
            unit="hover or tab a group for its three figures" />
        </Block>

        {/* ===================================================== conversion === */}
        <Block title="Registered to member" desc="unique users · stages with a real event behind them"
          foot={<>There is no <em>viewed plans</em> stage because nothing records one. A funnel
            with an invented stage is worse than a short one.</>}>
          <FunnelChart unit=""
            stages={[
              { key: "registered", label: "Registered", value: t.registrations,
                note: "Distinct users who completed registration in this range." },
              { key: "profile", label: "Profile completed", value: t.profileCompleted,
                note: "Met the profile v1 completion threshold. Re-graded if the schema versions." },
              { key: "member", label: "First membership", value: t.firstTimeMembers,
                note: "First-ever activation. Renewals are not in this figure." },
            ]} />
          <Tiles cols={2} list={[
            { k: "Conversion", v: pct(t.conversion.value),
              s: t.conversion.num + " of " + t.conversion.den + " in cohort" },
            { k: "Still to convert", v: c.normal, tone: "warn", s: "Users with no term right now",
              to: dir({ cls: "normal" }) },
          ]} />
        </Block>

        {/* ====================================================== retention === */}
        <Block title="Whether they stay" desc="memberships, not users"
          foot={<>Both rates divide by memberships eligible in this range — never by all
            registered users, which would flatter churn every time marketing had a good
            month.</>}>
          <Tiles cols={2} list={[
            { k: "Renewal rate", v: pct(t.renewalRate.value), tone: "ok",
              s: t.renewalRate.num + " of " + t.renewalRate.den + " eligible" },
            { k: "Membership churn", v: pct(t.churn.value), tone: "warn",
              s: t.churn.num + " of " + t.churn.den + " ending" },
            { k: "Ended in range", v: t.expiries + t.cancellations,
              s: t.expiries + " expired · " + t.cancellations + " cancelled" },
            { k: "Expiring soon", v: c.expiringSoon, tone: c.expiringSoon ? "warn" : undefined,
              s: RENEWAL_WINDOW_DAYS + "-day window", to: "#/users?view=renewals" },
          ]} />
        </Block>

        {/* ======================================================== cohorts === */}
        <Block wide title="Cohort retention"
          desc="by first-membership month · share still entitled"
          right={<span className="um-blocknote">not re-cut by the range</span>}
          foot={<>A registration cohort would mix in people who never bought anything — that
            measures marketing and calls it retention. Cohorts are keyed by their own start
            month, so the range control does not reshape them.</>}>
          <CohortHeat rows={ANALYTICS.cohorts.rows} />
          <Assumed id="UM-OD-11" />
        </Block>

        {/* ========================================================= status === */}
        <Block title="Where the memberships stand" desc="memberships · counted now"
          foot={<>Paused, suspended, expired and cancelled are four different facts and are
            counted separately.</>}>
          <BarRows rows={statusRows} />
        </Block>

        {/* ======================================================== sources === */}
        <Block title="Where they come from" desc={"unique users · " + t.label}
          foot={<>One hue: these are names, not an order. Shading them by size would say the
            bar length twice.</>}>
          <BarRows rows={sourceRows} />
        </Block>

        {/* ========================================================== plans === */}
        <Block title="By plan" desc="terms standing at the end of the range"
          foot={<>Starter to Pro is a sequence, so the colour carries the order. The bar is a
            level and the hint is the flow — they are not the same unit and are not
            added.</>}>
          <BarRows rows={planRows} />
        </Block>

        {/* ======================================================== revenue === */}
        <Block title="What it is worth" desc="read from Finance · never calculated here"
          right={notThisRange
            ? <span className="um-blocknote warn">{rev.window}, not the range</span>
            : null}
          foot={<>{rev.caveat} Finance settles on its own calendar, so this figure is labelled
            with the window it actually covers rather than silently re-cut to the range above.</>}>
          <Tiles cols={2} list={[
            { k: "Collected", v: money(rev.collected.amount),
              s: delta(rev.collected.amount, rev.previous.amount).text },
            { k: "Per active member", v: money(rev.arpm.amount), s: rev.arpm.denominatorLabel },
          ]} />
          <Assumed id="UM-OD-12" />
        </Block>

        {/* ===================================================== engagement === */}
        <Block title="How they use it" desc="blocked on the event taxonomy">
          <div className="um-unavailable">
            <Icon name="chart" size="lg" />
            <div>
              <b>Unavailable, not zero.</b>
              <p>
                DAU, WAU, MAU and member engagement need a defined set of qualifying product
                events. That taxonomy does not exist (<span className="mono">UM-OD-10</span>), so
                the payload carries <span className="mono">engagement: null</span> rather than
                zeros — which would be indistinguishable from a platform nobody opens.
              </p>
            </div>
          </div>
        </Block>

        {/* ========================================================= queues === */}
        <Block title="What needs a person today" desc="each opens the list it counts">
          <Tiles cols={2} list={[
            { k: "Pending activation", v: c.pending, s: "grants nothing yet",
              tone: c.pending ? "warn" : undefined, to: dir({ flag: "pending" }) },
            { k: "Expiring soon", v: c.expiringSoon, s: RENEWAL_WINDOW_DAYS + " days",
              tone: c.expiringSoon ? "warn" : undefined, to: "#/users?view=renewals" },
            { k: "Ended recently", v: c.recentlyEnded, s: "no renewal",
              to: "#/users?view=renewals&flag=ended" },
            { k: "Incomplete profiles", v: c.incompleteProfiles, s: "profile v1",
              tone: c.incompleteProfiles ? "warn" : undefined, to: dir({ flag: "incomplete" }) },
          ]} />
        </Block>

        {/* ========================================================= recent === */}
        <Block title="Just happened" desc="registrations, activations, renewals, lifecycle actions">
          <div className="um-evlist">
            {recent.map((e) => {
              const meta = VOCAB.eventTypes.filter((x) => x.key === e.type)[0];
              return (
                <EventRow key={e.eventId} type={e.type}
                  label={meta ? meta.label : e.type} tone={meta ? meta.tone : ""}
                  text={<>
                    <a data-go={"#/users/" + e.userId} onClick={() => go("#/users/" + e.userId)}>
                      {e.userName}
                    </a>
                    {e.note ? <span className="um-evnote"> — {e.note}</span> : null}
                  </>}
                  who={e.actor} when={e.at} />
              );
            })}
          </div>
        </Block>

        {/* ==================================================== definitions === */}
        <Block wide title="Definitions"
          desc="the same metric has to mean the same thing in March and in September">
          <table className="tbl um-defs">
            <thead>
              <tr><th>Metric</th><th>Unit</th><th>Definition</th><th>Easy to get wrong</th></tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.key}>
                  <td className="cell-1">{m.label}</td>
                  <td className="um-fine">{m.unit}</td>
                  <td>{m.formula}</td>
                  <td className="um-fine">{m.caution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      </Blocks>
    </Frame>
  );
}
