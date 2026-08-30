/* =============================================================================
   Analytics — the one place the numbers live.
   -----------------------------------------------------------------------------
   Overview is folded in here: two dashboards over one population was a split
   with no seam to justify it, and they agreed only because both called the same
   derivation.

   IT COUNTS PEOPLE, NOT MONEY, AND THAT IS THE WHOLE SHAPE OF IT. Conversion to
   a first membership, renewal and churn, cohort retention, terms by plan and
   revenue per member all used to live on this page. They asked about a
   commercial relationship this module no longer records, so they are gone —
   and cohort retention in particular is not rebuilt anywhere. Finance carries
   MRR, ARPU and the fail-to-pay rate against the subscription that holds the
   money. What is left here is the base and how it grew: registrations, the
   channels they arrived through, and how far their profiles got.

   EVERY FIGURE IS IN A CARD, and the cards pair up. Loose sections in one
   column read as an undifferentiated scroll — nothing tells you where an idea
   starts, and the eye has nothing to catch on the way down. A card gives each
   figure a boundary and a subtitle that states what it counts.

   THE RANGE IS REAL. It drives every range-dependent figure on the page through
   `rangeTotals()`, which sums the monthly series and recomputes each rate from
   its own numerator and denominator.
   ============================================================================= */
import { useMemo } from "react";
import { useShell } from "../../shell/ShellContext";
import { Icon, Notice, Tiles } from "../../ui";
import { go } from "../../ui/nav";
import { Block, Blocks, Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { EventRow } from "./bits";
import { BarRows, ColumnChart, FunnelChart } from "../charts";
import type { BarRow, Series } from "../charts";
import DateRange from "./DateRange";
import {
  METRICS, VOCAB,
  bandCounts, clampRange, countsOf, delta, pct, presetRange, rangeTotals,
  useRecentActivity,
} from "./store";

const dir = (extra: Record<string, string>) =>
  "#/users" + Object.keys(extra).map((k, i) => (i ? "&" : "?") + k + "=" + extra[k]).join("");

/* Fixed slot order. Registrations is the base volume, completed profiles the
   share of it that finished the job — assigned in this order and never
   reassigned, so a colour always means the same series. */
const GROWTH: Series[] = [
  { key: "registrations", label: "Registrations", slot: 1 },
  { key: "profileCompleted", label: "Profiles completed", slot: 2 },
];

export default function Analytics({ rows, p, onView, onParams }: FaceProps) {
  const { toast } = useShell();
  const c = countsOf(rows);
  const recent = useRecentActivity(6);

  /* The range lives in the URL like every other control in this module, so a
     narrowed dashboard is a link somebody can send. Six months is the default
     because it is the shortest span that shows a seasonal shape at all.

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

  /* Sources are nominal — no natural order — so every bar takes the same slot-1
     hue. Shading them by value would double-encode the bar length as colour. */
  const sourceRows: BarRow[] = t.bySource
    .slice().sort((a, b) => b.registrations - a.registrations)
    .map((s) => ({
      key: s.key,
      label: s.label,
      value: s.registrations,
      hint: <>{pct(t.registrations ? s.registrations / t.registrations : null, 0)} of the range</>,
      title: s.label + ": " + s.registrations + " registrations in this range.",
    }));

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
        <button className="btn" onClick={() => onView("users")}>
          <Icon name="users" />Users
        </button>
      </>}>

      {/* ======================================================= the base === */}
      <Blocks>
        <Block wide title="The base" desc="unique users · counted now, not over the range"
          foot={<>Active and Deactivated are derived from the account's own status at read time;
            there is no stored flag behind either number. Neither says anything about whether
            somebody is paying — that is a Finance figure, counted against the subscription that
            holds the money.</>}>
          <Tiles list={[
            { k: "Total registered", v: c.total, s: c.deactivated + " deactivated, kept in history",
              to: dir({}) },
            { k: "Active accounts", v: c.active, tone: "ok", s: "the account works",
              to: dir({ status: "active" }) },
            { k: "Deactivated", v: c.deactivated,
              s: "profile, links and audit all retained", to: dir({ status: "deactivated" }) },
            { k: "Incomplete profiles", v: c.incompleteProfiles,
              tone: c.incompleteProfiles ? "warn" : undefined,
              s: "graded against profile v1", to: dir({ flag: "incomplete" }) },
          ]} />
        </Block>

        {/* ========================================================= growth === */}
        <Block wide title="How the base grew" desc={t.label + " · unique users per month"}
          right={<span className="um-blocknums">
            {t.registrations.toLocaleString("en-IN")} registered ·{" "}
            {t.profileCompleted.toLocaleString("en-IN")} profiles completed
          </span>}
          foot={<>Profiles completed sits beside registrations and is never subtracted from it:
            a profile finished this month may belong to somebody who registered last month, so
            the two series are counted in the month each event happened and not netted off.
            {t.prev ? <> Registrations are {delta(t.registrations, t.prev.registrations).text}.</> : null}</>}>
          <ColumnChart series={GROWTH} labelSeries="registrations"
            points={t.months.map((m) => ({
              key: m.month, label: m.label,
              values: {
                registrations: m.registrations,
                profileCompleted: m.profileCompleted,
              },
            }))}
            unit="hover or tab a group for both figures" />
        </Block>

        {/* ===================================================== the funnel === */}
        <Block title="Registered to a usable profile"
          desc="unique users · stages with a real event behind them"
          foot={<>Two stages, because two things are recorded. There is no <em>viewed plans</em>
            {" "}stage and no membership stage — nothing here records the first, and the second is
            a Finance fact now. A funnel with an invented stage is worse than a short one.</>}>
          <FunnelChart unit=""
            stages={[
              { key: "registered", label: "Registered", value: t.registrations,
                note: "Distinct users who completed registration in this range." },
              { key: "profile", label: "Profile completed", value: t.profileCompleted,
                note: "Met the profile v1 completion threshold. Re-graded if the schema versions." },
            ]} />
          <Tiles cols={2} list={[
            { k: "Completion", v: pct(t.completion.value),
              s: t.completion.num + " of " + t.completion.den + " in range" },
            { k: "Still incomplete", v: c.incompleteProfiles, tone: "warn",
              s: "across the whole base, counted now",
              to: dir({ flag: "incomplete" }) },
          ]} />
        </Block>

        {/* ======================================================== sources === */}
        <Block title="Where they come from" desc={"unique users · " + t.label}
          foot={<>One hue: these are names, not an order. Shading them by size would say the
            bar length twice.</>}>
          <BarRows rows={sourceRows} />
        </Block>

        {/* ===================================================== engagement === */}
        <Block title="How they use it" desc="blocked on the event taxonomy">
          <div className="um-unavailable">
            <Icon name="chart" size="lg" />
            <div>
              <b>Unavailable, not zero.</b>
              <p>
                DAU, WAU and MAU need a defined set of qualifying product events. That taxonomy
                does not exist (<span className="mono">UM-OD-10</span>), so the payload carries{" "}
                <span className="mono">engagement: null</span> rather than zeros — which would be
                indistinguishable from a platform nobody opens.
              </p>
            </div>
          </div>
        </Block>

        {/* ========================================================= recent === */}
        <Block title="Just happened" desc="registrations, profile edits, tags, notes, account status">
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
          <Notice tone="info" ico="lock" text={<>
            <b>The commercial metrics are not missing, they moved.</b> Conversion to a paid plan,
            renewal rate, churn, revenue per customer and cohort retention are asked of the
            subscription that holds the money, in Finance. Answering them from the user base
            would be this module estimating a figure another one records.
          </>} />
        </Block>
      </Blocks>
    </Frame>
  );
}
