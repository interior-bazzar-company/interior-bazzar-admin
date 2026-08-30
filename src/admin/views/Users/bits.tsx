/* =============================================================================
   Users Management — the shared pieces.
   -----------------------------------------------------------------------------
   Only what is genuinely this module's. Tiles, notices, tables, cards, section
   heads, pills and the stat strip all come from ui/ and admin-theme.css — an
   earlier pass reimplemented most of them under `um-` names, which is how a
   module ends up looking almost like the panel it lives in.

   What is left here is the vocabulary this module owns: an account
   classification, an operational tag, a completeness bar, an audit row, and
   one marker for a decision nobody has taken yet.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon } from "../../ui";
import { ago, classificationMeta, decision, primaryCityOf, tagMeta } from "./store";
import type { Classification, UserRow } from "./store";

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
        {primaryCityOf(u.profile) ? <> · {primaryCityOf(u.profile)}</> : null}
        {u.identity.email ? <> · {u.identity.email}</> : null}
      </div>
      <TagChips slugs={u.tags.map((t) => t.slug)} />
    </div>
  );
}

/* ------------------------------------------------------------- events --- */

export function EventRow({ type, label, tone, text, who, when }: {
  type: string; label: string; tone?: string; text: ReactNode;
  who: string; when: string;
}) {
  return (
    <div className="um-ev">
      <span className={"ty" + (tone ? " " + tone : "")} title={type}>{label}</span>
      <span className="tx">{text}</span>
      <span className="wh">{who}</span>
      <span className="wn" title={when}>{ago(when)}</span>
    </div>
  );
}
