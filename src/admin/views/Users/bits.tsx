/* =============================================================================
   Users Management — the shared pieces.
   -----------------------------------------------------------------------------
   Only what is genuinely this module's. Tiles, notices, tables, cards, section
   heads, pills and the stat strip all come from ui/ and admin-theme.css — an
   earlier pass reimplemented most of them under `um-` names, which is how a
   module ends up looking almost like the panel it lives in.

   What is left here is the vocabulary this module owns: a classification, a
   membership status, a plan, a term cell, an entitlement snapshot, and one
   marker for a decision nobody has taken yet.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, Notice } from "../../ui";
import { go } from "../../ui/nav";
import { ago, classificationMeta, decision, fmtDate, membershipMeta, tagMeta } from "./store";
import type { Classification, Membership, UserRow } from "./store";

/* ------------------------------------------------------------- banner --- */

/** Deliberately loud, and never dismissible. A demo that reads as live is
 *  worse than no demo. */
export function ProtoBar({ onReset }: { onReset?: () => void }) {
  return (
    <div className="um-proto">
      <Icon name="alert" size="sm" />
      <span>
        <b>Nothing here is live.</b> Records come from{" "}
        <span className="mono">src/content/users/</span> and every action writes to this tab only.
      </span>
      {onReset && import.meta.env.DEV ? <button className="btn sm" onClick={onReset}>Reset</button> : null}
    </div>
  );
}

/* -------------------------------------------------------------- pills --- */

export function ClassPill({ k, lg }: { k: Classification; lg?: boolean }) {
  const m = classificationMeta(k);
  return (
    <span className={"pill um-cls" + (m.tone ? " " + m.tone : "") + (lg ? " lg" : "")}
      title={m.meaning}>
      <span className={"dot c-" + k} />{m.label}
    </span>
  );
}

export function StatusPill({ k, lg }: { k: string | null | undefined; lg?: boolean }) {
  if (!k) return <span className="faint">—</span>;
  const m = membershipMeta(k);
  if (!m) return <span className="faint">{k}</span>;
  return (
    <span className={"pill um-ms" + (m.tone ? " " + m.tone : "") + (lg ? " lg" : "")}
      title={m.meaning}>
      <span className={"dot m-" + k} />{m.label}
    </span>
  );
}

export function PlanChip({ code, name, version }: { code: string; name: string; version?: number }) {
  return (
    <span className={"um-plan p-" + code}>
      {name}{version ? <span className="v">v{version}</span> : null}
    </span>
  );
}

export function TagChips({ slugs }: { slugs: string[] }) {
  if (!slugs.length) return null;
  return (
    <span className="um-tags">
      {slugs.map((s) => {
        const t = tagMeta(s);
        return (
          <span key={s} className={"um-tag" + (t ? " " + t.tone : "")} title={t ? t.help : undefined}>
            {t ? t.label : s}
          </span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------- notices --- */

/** A decision nobody has taken, named where it bites. One line by default —
 *  the register in vocabularies.json carries the rest, and the id is what ties
 *  the code and the spec together. */
export function Assumed({ id, children }: { id: string; children?: ReactNode }) {
  const d = decision(id);
  return (
    <p className="um-assumed">
      <Icon name="alert" size="sm" />
      <span><b className="mono">{id}</b> {children || (d ? d.position : null)}</span>
    </p>
  );
}

/* ------------------------------------------------------------- figures --- */

/** Completeness, with what is missing rather than only the percentage — 60%
 *  tells nobody what to ask the customer for. */
export function Completeness({ pct, missing, bare }: {
  pct: number; missing: string[]; bare?: boolean;
}) {
  const tone = pct >= 100 ? "ok" : pct >= 60 ? "warn" : "bad";
  return (
    <span className="um-comp">
      <span className="t"><i className={tone} style={{ width: pct + "%" }} /></span>
      <span className={"p tnum " + tone}>{pct}%</span>
      {bare ? null : missing.length
        ? <span className="m">no {missing.join(", ").toLowerCase()}</span>
        : null}
    </span>
  );
}

/* -------------------------------------------------------------- cells --- */

export function WhoCell({ r }: { r: UserRow }) {
  const u = r.user;
  return (
    <div>
      <div className="cell-1">{u.identity.name}</div>
      <div className="cell-2">
        <span className="mono">{u.userId}</span>
        {u.profile.city ? <> · {u.profile.city}</> : null}
        {u.identity.email ? <> · {u.identity.email}</> : null}
      </div>
      <TagChips slugs={u.tags.map((t) => t.slug)} />
    </div>
  );
}

/** Plan, status, and when it ends — with the urgency in words, because
 *  "01 Sep 2026" does not read as "next week" at a glance. */
export function TermCell({ r }: { r: UserRow }) {
  const m = r.current;
  if (!m) return <span className="faint">—</span>;
  const running = m.status === "active" || m.status === "paused" || m.status === "suspended";
  return (
    <div>
      <div className="um-termtop">
        <PlanChip code={m.planCode} name={m.planName} version={m.planVersion} />
        <StatusPill k={m.status} />
      </div>
      <div className="cell-2">
        {m.status === "pending"
          ? <>raised {ago(m.createdAt)}</>
          : running
            ? <>
                {fmtDate(m.endAt)}
                {r.daysToEnd !== null
                  ? <em className={r.expiringSoon ? "warn" : ""}>
                      {r.daysToEnd < 0 ? " · past its end date"
                        : r.daysToEnd === 0 ? " · ends today" : " · in " + r.daysToEnd + " days"}
                    </em>
                  : null}
              </>
            : <>{ago(m.expiredAt || m.cancelledAt || m.endAt)}</>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- events --- */

export function EventRow({ type, label, tone, text, who, when, to }: {
  type: string; label: string; tone?: string; text: ReactNode;
  who: string; when: string; to?: string | null;
}) {
  return (
    <div className="um-ev">
      <span className={"ty" + (tone ? " " + tone : "")} title={type}>{label}</span>
      <span className="tx">
        {text}
        {to ? <> · <a className="mono" data-go={to} onClick={() => go(to)}>{to.split("=").pop()}</a></> : null}
      </span>
      <span className="wh">{who}</span>
      <span className="wn" title={when}>{ago(when)}</span>
    </div>
  );
}

/* ------------------------------------------------------- entitlements --- */

/** The frozen snapshot, or an honest statement that there is not one. A
 *  Pending term grants nothing, and previewing the plan as though it did is
 *  the confusion that state exists to prevent. */
export function Entitlements({ m }: { m: Membership }) {
  if (!m.entitlements.length) {
    return (
      <Notice tone="warn" text={<>
        <b>No snapshot yet.</b> Entitlements freeze at activation, not when the term is raised —
        this member has no access from it.
      </>} />
    );
  }
  return (
    <ul className="um-ent">
      {m.entitlements.map((e) => (
        <li key={e.key}>
          <Icon name="check" size="sm" />
          <span className="l">{e.label}</span>
          <span className="v">{e.display}</span>
          <span className="k mono">{e.key}</span>
        </li>
      ))}
    </ul>
  );
}
