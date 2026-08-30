/* =============================================================================
   Screens 3, 12 · the user workspace.
   -----------------------------------------------------------------------------
     ?tab=profile      the business profile and what is public — the default
     ?tab=commercial   read-only links into Deals, Invoicing and Finance
     ?tab=notes        internal notes and operational tags
     ?tab=audit        the append-only timeline

   Same furniture as the Business Enquiries record: an id bar carrying the
   identity and its badges, one subline, then tabs. One workspace rather than
   four screens, because servicing a customer means holding their profile and
   their history at once.

   THE MEMBERSHIP TAB IS GONE, with the term, its entitlement snapshot, its
   guarded actions and the per-term history table. What a customer bought is a
   subscription and it is recorded in Finance; this record links to the deal
   and the invoice behind it on the Commercial tab and holds none of it.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can, useNav } from "../../shell/AdminShell";
import { EmptyState, Icon, KvList, Notice, Tabs } from "../../ui";
import { go } from "../../ui/nav";
import { Assumed, ClassPill, Completeness, EventRow, ProtoBar, TagChips } from "./bits";
import EditProfile from "./EditProfile";
import { DeactivateModal, NoteModal, TagsModal } from "./Modals";
import {
  PROFILE_FIELDS, PROFILE_SCHEMA_VERSION, VOCAB,
  ago, facetLabel, fmtDate, labelsFor, primaryCityOf, profileUrl, resetStore, useTimeline,
} from "./store";
import type { Params, UserRow } from "./store";

const TABS = [
  { k: "profile", label: "Profile" },
  { k: "commercial", label: "Commercial" },
  { k: "notes", label: "Notes & tags" },
  { k: "audit", label: "Audit" },
];

export default function Detail({ id, p, rows, onParams }: {
  id: string;
  p: Params;
  rows: UserRow[];
  /** Record params, as one navigation. */
  onParams: (patch: Params) => void;
}) {
  const { toast, modal, closeLayer } = useShell();
  const { go: navGo } = useNav();
  const row = rows.filter((r) => r.user.userId === id)[0] || null;
  const timeline = useTimeline(row ? row.user.userId : null);
  const tab = p.tab || "profile";

  const back = (() => {
    const keep = Object.keys(p)
      .filter((k) => p[k] && k !== "tab")
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(p[k] as string))
      .join("&");
    return "#/users" + (keep ? "?" + keep : "");
  })();

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
  const writable = can("users", "edit");

  return (
    <div className="um-rec">
      <ProtoBar onReset={() => { resetStore(); toast("Back to the seed."); }} />

      <div className="um-idbar">
        <h2>{u.identity.name}</h2>
        <ClassPill k={row.classification} lg />
        {u.userStatus === "deactivated"
          ? <span className="pill dead lg" title={u.deactivatedReason || ""}>Account off</span>
          : null}
        <TagChips slugs={u.tags.map((t) => t.slug)} />
        <span className="spacer" />
        {writable
          ? <button className="btn sm" onClick={() => modal(
              <DeactivateModal row={row} onClose={closeLayer}
                onDone={(m, t) => { closeLayer(); toast(m, t); }} />)}>
              <Icon name={u.userStatus === "deactivated" ? "unlock" : "lock"} size="sm" />
              {u.userStatus === "deactivated" ? "Reactivate account" : "Deactivate account"}
            </button>
          : null}
        <button className="btn sm" onClick={() => navGo(back)}>
          <Icon name="chevl" size="sm" />
          {p.view === "analytics" ? "Analytics" : "All users"}
        </button>
      </div>

      <div className="um-subline">
        <span className="mono">{u.userId}</span>
        {u.identity.email ? <> · <span className="mono">{u.identity.email}</span></> : null}
        {u.identity.phone ? <> · <span className="mono">{u.identity.phone}</span></> : null}
        {primaryCityOf(u.profile) ? <> · {primaryCityOf(u.profile)}</> : null}
        {" · registered "}{fmtDate(u.registeredAt)}
      </div>

      <Tabs items={TABS.map((t) => ({
        k: t.k, label: t.label,
        n: t.k === "notes" ? u.notes.length
          : t.k === "audit" ? timeline.length : undefined,
      }))} cur={tab}
        onPick={(k) => onParams({ tab: k === "profile" ? undefined : k })} />

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
              <KvList pairs={PROFILE_FIELDS.map((f) => {
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
                  : f.type === "areas"
                  ? ((v as { state: string; cities: string[] }[]).length
                    ? <span className="um-areas-ro">
                        {(v as { state: string; cities: string[] }[]).map((t, i) => (
                          /* One line per row, the state leading its cities —
                             the same closed/open halves the editor shows. */
                          <span className="um-chips ro" key={i}>
                            <span className="pill um-chip tag-slate">{t.state}</span>
                            {t.cities.map((c, j) => (
                              <span className={"pill um-chip " + (f.chip || "")} key={j}>{c}</span>
                            ))}
                          </span>
                        ))}
                      </span>
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
                  f.label,
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

          <Notice tone="info" ico="lock" text={<>
            <b>This module owns no money and no subscription.</b> What this customer bought, what
            it costs and where it stands in its own lifecycle are recorded in Finance. These are
            pointers to the records that hold that, and following one is how you see it — nothing
            on this screen creates, edits or reverses any of it.
          </>} />
        </div>
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
              <span className="d"><Icon name="lock" size="sm" />append-only · nothing is ever removed</span>
            </div>
            <div className="card-b">
              {timeline.length === 0 ? (
                <p className="um-fine">Nothing has happened on this account yet.</p>
              ) : null}
              <div className="um-evlist">
                {/* AN AUDIT IS A HISTORY. Rows written while this module still
                    ran a membership lifecycle are rows about things that
                    actually happened, so they are still here and still
                    labelled — vocabularies.json keeps those event types as
                    historical for exactly this reason. Dropping them would be
                    editing the past to match today's feature set. */}
                {timeline.map((e) => {
                  const meta = VOCAB.eventTypes.filter((x) => x.key === e.type)[0];
                  return (
                    <EventRow key={e.eventId} type={e.type}
                      label={meta ? meta.label : e.type} tone={meta ? meta.tone : ""}
                      text={e.note || "—"} who={e.actor + " · " + e.actorRole} when={e.at} />
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
