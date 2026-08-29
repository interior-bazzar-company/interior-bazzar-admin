/* =============================================================================
   Screens 3, 6, 7, 12 · the user workspace.
   -----------------------------------------------------------------------------
     ?tab=membership   the current term, its snapshot, its guarded actions
     ?tab=profile      the business profile and what is public
     ?tab=commercial   read-only links into Deals, Invoicing and Finance
     ?tab=history      every term; picking one opens Membership Detail
     ?tab=notes        internal notes and operational tags
     ?tab=audit        the append-only timeline, both streams merged

   Same furniture as the Business Enquiries record: an id bar carrying the
   identity and its badges, one subline, then tabs. One workspace rather than
   five screens, because servicing a customer means holding their profile,
   their entitlement and their history at once.

   Classification, membership status and account status sit together in the id
   bar, always. They are three different facts that get conflated the moment
   they are shown apart.
   ============================================================================= */
import { useMemo } from "react";
import { useShell } from "../../shell/ShellContext";
import { can, useNav } from "../../shell/AdminShell";
import { EmptyState, Icon, KvList, Notice, SectionHead, Tabs } from "../../ui";
import { go } from "../../ui/nav";
import {
  Assumed, ClassPill, Completeness, Entitlements, EventRow, PlanChip, ProtoBar, StatusPill, TagChips,
} from "./bits";
import AssignMembership from "./AssignMembership";
import LifecycleModal from "./LifecycleModal";
import EditProfile from "./EditProfile";
import { DeactivateModal, NoteModal, TagsModal } from "./Modals";
import {
  PROFILE_SCHEMA_VERSION, RENEWAL_WINDOW_DAYS, VOCAB,
  ago, allowedActions, facetLabel, fieldsFor, fmtDate, fmtDateTime, labelsFor, money,
  profileUrl, resetStore, sourceMeta, useTimeline,
} from "./store";
import type { LifecycleAction, Membership, Params, UserRow } from "./store";

const TABS = [
  { k: "membership", label: "Membership" },
  { k: "profile", label: "Profile" },
  { k: "commercial", label: "Commercial" },
  { k: "history", label: "History" },
  { k: "notes", label: "Notes & tags" },
  { k: "audit", label: "Audit" },
];

export default function Detail({ id, p, rows, onFilter }: {
  id: string;
  p: Params;
  rows: UserRow[];
  onFilter: (name: string, value: string) => void;
}) {
  const { toast, modal, closeLayer } = useShell();
  const { go: navGo } = useNav();
  const row = rows.filter((r) => r.user.userId === id)[0] || null;
  const timeline = useTimeline(row ? row.user.userId : null);
  const tab = p.tab || "membership";

  const back = useMemo(() => {
    const keep = Object.keys(p)
      .filter((k) => p[k] && ["tab", "term"].indexOf(k) < 0)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
      .join("&");
    return "#/users" + (keep ? "?" + keep : "");
  }, [p]);

  if (!row) {
    return (
      <div className="um-rec">
        <ProtoBar />
        <EmptyState icon="search" title="No user at that address"
          body={<>There is no record for <span className="mono">{id}</span>.</>}
          action={<button className="btn pri" onClick={() => navGo("#/users")}>Back to the directory</button>} />
      </div>
    );
  }

  const u = row.user;
  const term = row.current;
  const writable = can("users", "edit");
  const act = (m: Membership, action: LifecycleAction) =>
    modal(<LifecycleModal m={m} row={row} action={action} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />);
  const openAssign = () => modal(
    <AssignMembership row={row} onClose={closeLayer}
      onDone={(msg, tone) => { closeLayer(); toast(msg, tone); }} />, "wide");

  return (
    <div className="um-rec">
      <ProtoBar onReset={() => { resetStore(); toast("Back to the seed."); }} />

      <div className="um-idbar">
        <h2>{u.identity.name}</h2>
        <ClassPill k={row.classification} lg />
        <StatusPill k={term ? term.status : null} lg />
        {u.userStatus === "deactivated"
          ? <span className="pill dead lg" title={u.deactivatedReason || ""}>Account off</span>
          : null}
        <TagChips slugs={u.tags.map((t) => t.slug)} />
        <span className="spacer" />
        {row.classification === "normal" && u.userStatus === "active" && can("users", "create")
          ? <button className="btn sm pri" onClick={openAssign}>
              <Icon name="plus" size="sm" />Assign membership
            </button>
          : null}
        {writable
          ? <button className="btn sm" onClick={() => modal(
              <DeactivateModal row={row} onClose={closeLayer}
                onDone={(m, t) => { closeLayer(); toast(m, t); }} />)}>
              <Icon name={u.userStatus === "deactivated" ? "unlock" : "lock"} size="sm" />
              {u.userStatus === "deactivated" ? "Reactivate" : "Deactivate"}
            </button>
          : null}
        <button className="btn sm" onClick={() => navGo(back)}>
          <Icon name="chevl" size="sm" />All users
        </button>
      </div>

      <div className="um-subline">
        <span className="mono">{u.userId}</span>
        {u.identity.email ? <> · <span className="mono">{u.identity.email}</span></> : null}
        {u.identity.phone ? <> · <span className="mono">{u.identity.phone}</span></> : null}
        {u.profile.city ? <> · {u.profile.city}</> : null}
        {" · registered "}{fmtDate(u.registeredAt)}
      </div>

      <Tabs items={TABS.map((t) => ({
        k: t.k, label: t.label,
        n: t.k === "history" ? row.history.length
          : t.k === "notes" ? u.notes.length
          : t.k === "audit" ? timeline.length : undefined,
      }))} cur={tab} onPick={(k) => onFilter("tab", k === "membership" ? "" : k)} />

      {/* ===================================================== membership === */}
      {tab === "membership" ? (
        term ? (
          <div className="um-cards">
            <div className="card">
              <div className="card-h">
                <h3>Current term</h3>
                <span className="d mono">{term.membershipId}</span>
                <span className="r">
                  <PlanChip code={term.planCode} name={term.planName} months={term.cycle.months} />
                  <StatusPill k={term.status} />
                </span>
              </div>
              <div className="card-b">
                <KvList pairs={[
                  ["Entitlement period", <>{fmtDate(term.startAt)} — {fmtDate(term.endAt)}{" "}
                    {row.daysToEnd !== null ? (
                      <em className={row.expiringSoon ? "warn" : "faint"}>
                        ({row.daysToEnd < 0 ? "past its end date"
                          : row.daysToEnd === 0 ? "ends today" : "in " + row.daysToEnd + " days"})
                      </em>
                    ) : null}</>],
                  ["Source", <>
                    {term.source.label}
                    {term.source.reference ? <> · <span className="mono">{term.source.reference}</span></> : null}
                  </>],
                  ["Raised by", <>{term.createdBy} · {fmtDateTime(term.createdAt)}</>],
                  ["Activated", term.activatedAt ? fmtDateTime(term.activatedAt) : "not yet"],
                  ["Plan and duration", <>
                    {term.planName} · {term.cycle.months} months · {money(term.cycle.price)}
                    <div className="um-fine">
                      Frozen on the term. The catalogue can be repriced, renamed or archived
                      without moving this.
                    </div>
                  </>],
                  ...(term.source.note ? [["Reason", term.source.note] as [string, string]] : []),
                ]} />
              </div>
            </div>

            <div className="card">
              <div className="card-h">
                <h3>Entitlements</h3>
                <span className="d"><Icon name="lock" size="sm" />frozen at activation</span>
              </div>
              <div className="card-b"><Entitlements m={term} /></div>
            </div>

            <div className="card">
              <div className="card-h">
                <h3>Lifecycle</h3>
                <span className="d">{sourceMeta(term.source.kind)?.label}</span>
              </div>
              <div className="card-b">
                {writable && allowedActions(term).length ? (
                  <div className="um-actions">
                    {allowedActions(term).map((a) => (
                      <button key={a.key}
                        className={"btn" + (a.tone === "pri" ? " pri" : a.tone === "dgr" ? " dgr" : "")}
                        title={a.help} onClick={() => act(term, a.key as LifecycleAction)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <TransitionRow status={term.status} />
              </div>
            </div>

            {term.status === "paused" ? <Assumed id="UM-OD-04" /> : null}
            {term.status === "suspended" ? <Assumed id="UM-OD-05" /> : null}
            {term.status === "pending" ? <Assumed id="UM-OD-02" /> : null}
          </div>
        ) : (
          <EmptyState icon="tag" title="No membership on this account"
            body={<>
              {u.identity.name} is a User — registered, with a profile, and no term that has
              ever entitled them.{" "}
              {u.commercial.dealRefs.length
                ? <>There {u.commercial.dealRefs.length === 1 ? "is" : "are"}{" "}
                  {u.commercial.dealRefs.length} open deal reference against them.</>
                : null}
            </>}
            action={u.userStatus === "active" && can("users", "create")
              ? <button className="btn pri" onClick={openAssign}>Assign a membership</button>
              : null} />
        )
      ) : null}

      {/* ======================================================== profile === */}
      {tab === "profile" ? (
        <div className="um-cards">
          <div className="card">
            <div className="card-h">
              <h3>Business profile</h3>
              <span className="d">{PROFILE_SCHEMA_VERSION}</span>
              <span className="r">
                <Completeness pct={row.completeness} missing={row.missingFields} />
                {writable ? (
                  <button className="btn sm" onClick={() => modal(
                    <EditProfile row={row} onClose={closeLayer}
                      onDone={(m, t) => { closeLayer(); toast(m, t); }} />, "wide")}>
                    Edit
                  </button>
                ) : null}
              </span>
            </div>
            <div className="card-b">
              <KvList pairs={fieldsFor(row).map((f) => {
                const v = (u.profile as unknown as Record<string, unknown>)[f.key];
                /* A facet renders as the chips it is, not as a comma-joined
                   string. Six segments run together read as one long phrase,
                   and the count — which is the thing you actually check on a
                   profile — cannot be seen at all. Keys become labels here;
                   what is stored is never what is shown. */
                /* The username is an ADDRESS, so on the record it is the
                   thing itself — a link somebody can open or copy — not the
                   string it is made of. */
                const val = f.type === "handle"
                  ? (v
                    ? <a className="um-profile-link" href={profileUrl(String(v))}
                        target="_blank" rel="noreferrer">
                        <span className="mono">{String(v)}</span>
                        <Icon name="ext" size="sm" />
                      </a>
                    : "")
                  : Array.isArray(v)
                  ? (v.length
                    ? <span className="um-chips ro">
                        {labelsFor(f, v as string[]).map((l, i) => (
                          <span className={"pill um-chip " + (f.chip || "")} key={i}>{l}</span>
                        ))}
                      </span>
                    : "")
                  : f.type === "single" && v
                    ? <span className={"pill um-chip " + (f.chip || "")}>
                        {facetLabel(f.vocab || "", String(v))}
                      </span>
                    : ((v as string | null) || "");
                return [
                  <>{f.label}<em className={"um-vis " + (f.public ? "pub" : "int")}>
                    {f.public ? "public" : "internal"}</em></>,
                  val,
                ] as [React.ReactNode, React.ReactNode];
              })} />
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>Identity</h3>
              <span className="d"><Icon name="shield" size="sm" />Authentication · read-only</span>
            </div>
            <div className="card-b">
              <KvList pairs={[
                ["Email", <>{u.identity.email || "—"}{u.identity.emailVerified ? " ✓" : " · unverified"}</>],
                ["Mobile", <>{u.identity.phone || "—"}{u.identity.phoneVerified ? " ✓" : " · unverified"}</>],
                ["Auth identity", <span className="mono">{u.authUserId}</span>],
                ["Registered via", VOCAB.registrationSources.filter((s) => s.key === u.registrationSource)[0]?.label],
                ["Account", u.userStatus === "deactivated"
                  ? <>Deactivated {ago(u.deactivatedAt)} — {u.deactivatedReason}</>
                  : "Active"],
                ["Last edited", <>{u.profile.updatedBy || "—"} · {ago(u.profile.updatedAt)}</>],
              ]} />
            </div>
          </div>
          <Assumed id="UM-OD-09" />
        </div>
      ) : null}

      {/* ===================================================== commercial === */}
      {tab === "commercial" ? (
        <div className="um-cards">
          <div className="card">
            <div className="card-h">
              <h3>Linked records</h3>
              <span className="d"><Icon name="link" size="sm" />read-only</span>
            </div>
            <div className="card-b">
              <KvList pairs={[
                ["Sales owner", u.commercial.salesOwner || ""],
                ["Deals", u.commercial.dealRefs.length
                  ? <span className="chiprow">
                      {u.commercial.dealRefs.map((d) => (
                        <a key={d} className="pill line mono" data-go={"#/deals/" + d}
                          onClick={() => go("#/deals/" + d)}>{d}</a>
                      ))}
                    </span>
                  : ""],
                ["Invoices", u.commercial.invoiceRefs.length
                  ? <span className="chiprow">
                      {u.commercial.invoiceRefs.map((d) => (
                        <a key={d} className="pill line mono" data-go={"#/invoices/" + d}
                          onClick={() => go("#/invoices/" + d)}>{d}</a>
                      ))}
                    </span>
                  : ""],
              ]} />
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>What authorised each term</h3></div>
            <div className="card-b">
              {row.history.length ? (
                <ul className="um-srclist">
                  {row.history.map((m) => (
                    <li key={m.membershipId}>
                      <button className="lnk mono" onClick={() => {
                        onFilter("tab", "history"); onFilter("term", m.membershipId);
                      }}>{m.membershipId}</button>
                      <PlanChip code={m.planCode} name={m.planName} />
                      <span>{m.source.label}</span>
                      {m.source.reference ? <span className="mono">{m.source.reference}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="um-fine">No term has been raised against this account.</p>}
            </div>
          </div>

          <Notice tone="info" ico="lock" text={<>
            <b>This module owns no money.</b> A term references a payment, an invoice or a deal and
            never creates, edits or reverses one. A refund does not move a membership by itself —
            that is an explicit lifecycle decision (<span className="mono">UM-OD-06</span>).
          </>} />
        </div>
      ) : null}

      {/* ======================================================== history === */}
      {tab === "history" ? (
        <History row={row} p={p} onFilter={onFilter} onAct={act} writable={writable} />
      ) : null}

      {/* ========================================================== notes === */}
      {tab === "notes" ? (
        <div className="um-cards">
          <div className="card">
            <div className="card-h">
              <h3>Tags</h3>
              <span className="d">internal segmentation</span>
              <span className="r">
                {writable ? (
                  <button className="btn sm" onClick={() => modal(
                    <TagsModal row={row} onClose={closeLayer}
                      onDone={(m, t) => { closeLayer(); toast(m, t); }} />)}>Edit</button>
                ) : null}
              </span>
            </div>
            <div className="card-b">
              {u.tags.length
                ? <div className="um-taglist">
                    {u.tags.map((t) => (
                      <span key={t.slug} className="um-tagrow">
                        <TagChips slugs={[t.slug]} />
                        <em>{t.assignedBy} · {ago(t.assignedAt)}</em>
                      </span>
                    ))}
                  </div>
                : <p className="um-fine">No tags.</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>Internal notes</h3>
              <span className="d">append-only</span>
              <span className="r">
                {writable ? (
                  <button className="btn sm pri" onClick={() => modal(
                    <NoteModal row={row} onClose={closeLayer}
                      onDone={(m, t) => { closeLayer(); toast(m, t); }} />)}>
                    <Icon name="plus" size="sm" />Add
                  </button>
                ) : null}
              </span>
            </div>
            <div className="card-b">
              {u.notes.length ? (
                <div className="um-notes">
                  {u.notes.map((n) => (
                    <article key={n.noteId}>
                      <header>
                        <b>{n.author}</b><span className="role">{n.authorRole}</span>
                        <time title={n.at}>{ago(n.at)}</time>
                      </header>
                      <p>{n.text}</p>
                    </article>
                  ))}
                </div>
              ) : <p className="um-fine">Nothing recorded yet.</p>}
            </div>
          </div>

          <Notice tone="info" ico="lock" text={<>
            <b>Never customer-visible.</b> Notes and tags are excluded from every customer-facing
            profile response at the contract level. The audit records that a note exists and who
            added it, never what it says.
          </>} />
        </div>
      ) : null}

      {/* ========================================================== audit === */}
      {tab === "audit" ? (
        <div className="um-cards">
          <div className="card">
            <div className="card-h">
              <h3>Timeline</h3>
              <span className="d"><Icon name="lock" size="sm" />append-only · account and term events merged</span>
            </div>
            <div className="card-b">
              <div className="um-evlist">
                {timeline.map((e) => {
                  const meta = VOCAB.eventTypes.filter((x) => x.key === e.type)[0];
                  return (
                    <EventRow key={e.eventId} type={e.type}
                      label={meta ? meta.label : e.type} tone={meta ? meta.tone : ""}
                      text={e.note || "—"} who={e.actor + " · " + e.actorRole} when={e.at}
                      to={e.membershipId
                        ? "#/users/" + u.userId + "?tab=history&term=" + e.membershipId : null} />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** The matrix for the state this term is actually in — shown rather than
 *  described, because "what can happen next" is the question somebody has open
 *  when they are about to press one of the buttons above it. */
function TransitionRow({ status }: { status: string }) {
  const t = VOCAB.transitions.filter((x) => x.from === status)[0];
  if (!t) return null;
  return (
    <div className="um-matrix">
      <span className="l">Allowed next</span>
      <span className="r">
        {t.to.length
          ? t.to.map((k) => <StatusPill key={k} k={k} />)
          : <em className="faint">nothing — this term is terminal</em>}
      </span>
      <p className="um-fine">{t.guard}</p>
    </div>
  );
}

/* ------------------------------------------------- history + term detail --- */

function History({ row, p, onFilter, onAct, writable }: {
  row: UserRow;
  p: Params;
  onFilter: (name: string, value: string) => void;
  onAct: (m: Membership, a: LifecycleAction) => void;
  writable: boolean;
}) {
  const selected = p.term ? row.history.filter((m) => m.membershipId === p.term)[0] || null : null;

  return (
    <div className="um-cards">
      {/* ======================================= Screen 6 · Membership Detail */}
      {selected ? (
        <div className="card um-termcard">
          <div className="card-h">
            <h3>Term #{selected.termNo}</h3>
            <span className="d mono">{selected.membershipId}</span>
            <span className="r">
              <PlanChip code={selected.planCode} name={selected.planName}
                months={selected.cycle.months} />
              <StatusPill k={selected.status} />
              <button className="btn sm" onClick={() => onFilter("term", "")}>
                <Icon name="x" size="sm" />Close
              </button>
            </span>
          </div>
          <div className="card-b">
            <KvList pairs={[
              ["Entitlement period", <>{fmtDate(selected.startAt)} — {fmtDate(selected.endAt)}</>],
              ["Plan snapshot", <>{selected.planName} · {selected.cycle.months} months ·{" "}
                {money(selected.cycle.price)}</>],
              ["Source", <>{selected.source.label}
                {selected.source.reference
                  ? <> · <span className="mono">{selected.source.reference}</span></> : null}</>],
              ["Raised by", <>{selected.createdBy} · {fmtDateTime(selected.createdAt)}</>],
              ["Activated", selected.activatedAt ? fmtDateTime(selected.activatedAt) : "never"],
              ["Paused", selected.pausedAt ? fmtDateTime(selected.pausedAt) : ""],
              ["Suspended", selected.suspendedAt ? fmtDateTime(selected.suspendedAt) : ""],
              ["Cancelled", selected.cancelledAt ? fmtDateTime(selected.cancelledAt) : ""],
              ["Expired", selected.expiredAt ? fmtDateTime(selected.expiredAt) : ""],
              ["Previous term", selected.previousMembershipId
                ? <button className="lnk mono"
                    onClick={() => onFilter("term", selected.previousMembershipId as string)}>
                    {selected.previousMembershipId}
                  </button>
                : "none — their first"],
              ...(selected.source.note ? [["Reason", selected.source.note] as [string, string]] : []),
            ]} />

            <SectionHead title="Entitlements" desc="frozen at activation" />
            <Entitlements m={selected} />

            <SectionHead title="Events" desc="append-only" />
            <div className="um-evlist">
              {selected.events.map((e) => {
                const meta = VOCAB.eventTypes.filter((x) => x.key === e.type)[0];
                return (
                  <EventRow key={e.eventId} type={e.type}
                    label={meta ? meta.label : e.type} tone={meta ? meta.tone : ""}
                    text={<>{e.reason ? <b>{e.reason} — </b> : null}{e.note}</>}
                    who={e.actor + " · " + e.actorRole} when={e.effectiveAt} />
                );
              })}
            </div>

            {writable && allowedActions(selected).length ? (
              <div className="um-actions">
                {allowedActions(selected).map((a) => (
                  <button key={a.key}
                    className={"btn" + (a.tone === "pri" ? " pri" : a.tone === "dgr" ? " dgr" : "")}
                    title={a.help} onClick={() => onAct(selected, a.key as LifecycleAction)}>
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ====================================== Screen 7 · Membership History */}
      <div className="card">
        <div className="card-h">
          <h3>Every term</h3>
          <span className="d"><Icon name="lock" size="sm" />nothing here is overwritten</span>
        </div>
        {row.history.length ? (
          <table className="tbl um-hist">
            <thead>
              <tr>
                <th>Term</th><th>Plan</th><th>Source</th>
                <th>Entitlement period</th><th>Status</th><th className="tight" />
              </tr>
            </thead>
            <tbody>
              {row.history.map((m) => (
                <tr key={m.membershipId}
                  className={"clickable" + (p.term === m.membershipId ? " on" : "")}
                  onClick={() => onFilter("term", m.membershipId)}>
                  <td>
                    <div className="cell-1">#{m.termNo}</div>
                    <div className="cell-2 mono">{m.membershipId}</div>
                  </td>
                  <td><PlanChip code={m.planCode} name={m.planName} months={m.cycle.months} /></td>
                  <td>
                    <div className="cell-1">{m.source.label}</div>
                    <div className="cell-2">
                      {m.previousMembershipId ? "renewal of " + m.previousMembershipId : "first term"}
                    </div>
                  </td>
                  <td>
                    <div className="cell-1">{fmtDate(m.startAt)} — {fmtDate(m.endAt)}</div>
                    <div className="cell-2">
                      {m.activatedAt ? "activated " + ago(m.activatedAt) : "never activated"}
                    </div>
                  </td>
                  <td><StatusPill k={m.status} /></td>
                  <td className="tight"><Icon name="chevr" size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="card-b"><p className="um-fine">No term has been raised against this account.</p></div>
        )}
      </div>

      {row.expiringSoon ? (
        <Notice tone="warn" text={<>
          <b>This term ends in {row.daysToEnd} days.</b> It is in the renewal queue and in the
          churn denominator for the month it ends. Renewing creates a new term rather than
          extending this one.
        </>} />
      ) : null}
      {row.history.length > 1 ? (
        <p className="um-fine">
          {row.history.length} terms, the earliest {ago(row.history[row.history.length - 1].startAt)}.
          Terminal terms are kept: overwriting one on renewal would destroy the renewal chain and
          any lifetime-value figure built on it. Renewal window in force: {RENEWAL_WINDOW_DAYS} days.
        </p>
      ) : null}
    </div>
  );
}
