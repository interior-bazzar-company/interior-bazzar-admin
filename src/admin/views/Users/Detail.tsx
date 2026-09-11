/* =============================================================================
   Screens 3, 12 · the user workspace.
   -----------------------------------------------------------------------------
     ?tab=profile      the business profile and what is public — the default
     ?tab=commercial   read-only links into Deals, Invoicing and Finance
     ?tab=notes        internal notes and operational tags
     ?tab=audit        the append-only timeline

   The panel's record furniture: a `PageHeader` carrying the face, the name,
   the state pills and the record's actions; the way back is the topbar's own
   module title, which every record in the panel now uses. Then `Tabs`, then a
   two-column read — the record's own facts on the left, what the system knows
   about the identity on the right.

   THE MEMBERSHIP TAB IS GONE, with the term, its entitlement snapshot, its
   guarded actions and the per-term history table. What a customer bought is a
   subscription and it is recorded in Finance; this record links to the deal
   and the invoice behind it on the Commercial tab and holds none of it.
   ============================================================================= */
import type { ReactNode } from "react";
import { useShell } from "../../shell/ShellContext";
import { can, useNav } from "../../shell/AdminShell";
import {
  Avatar, Button, Card, EmptyState, Icon, KvList, LinkChip, MoreMenu, Notice,
  PageHeader, Pill, Table, Tabs, Tag, Timeline, ActivityFeed,
} from "../../ui";
import { Assumed, ClassPill, Completeness, ProtoBar, TagChips } from "./bits";
import EditProfile from "./EditProfile";
import { DeactivateModal, NoteModal, TagsModal } from "./Modals";
import {
  PROFILE_FIELDS, PROFILE_SCHEMA_VERSION, VOCAB,
  ago, facetLabel, fmtDate, fmtDateTime, labelsFor, primaryCityOf, profileUrl,
  resetStore, useTimeline,
} from "./store";
import type { Params, ProfileField, TargetArea, UserRow } from "./store";

const TABS = [
  { k: "profile", label: "Profile" },
  { k: "commercial", label: "Commercial" },
  { k: "notes", label: "Notes & tags" },
  { k: "audit", label: "Audit" },
];

/* The audit vocabulary's tone words → the timeline's. `stop` is this module's
   spelling of a hard stop, and an untoned event is a plain fact. */
const DOT: Record<string, "sys" | "bad" | "ok" | "warn" | "info" | "brand"> = {
  sys: "sys", ok: "ok", warn: "warn", stop: "bad", bad: "bad", info: "info",
};

/* Everything but the two fields that get their own drawing: the address, which
   is a link, and the service areas, which are a table. */
const FACT_FIELDS = PROFILE_FIELDS.filter((f) => f.type !== "handle" && f.type !== "areas");

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
      <div className="flex flex-col gap-4">
        <ProtoBar />
        <EmptyState icon="search" title="No user at that address"
          body={<>There is no record for <span className="font-mono">{id}</span>.</>}
          action={<Button color="primary" onClick={() => navGo("#/users")}>Back to the directory</Button>} />
      </div>
    );
  }

  const u = row.user;
  const writable = can("users", "edit");
  const off = u.userStatus === "deactivated";
  const city = primaryCityOf(u.profile);

  const editProfile = () => modal(
    <EditProfile row={row} onClose={closeLayer}
      onDone={(m, t) => { closeLayer(); toast(m, t); }} />, "xl");

  /* The record's actions, behind one button — the panel's rule. The account
     switch is destructive and goes last, below the separator. */
  const menu = [
    { icon: "edit", label: "Edit profile", act: editProfile, disabled: !writable },
    { icon: "note", label: "Add an internal note", disabled: !writable,
      act: () => modal(<NoteModal row={row} onClose={closeLayer}
        onDone={(m, t) => { closeLayer(); toast(m, t); }} />) },
    { icon: "tag", label: "Edit operational tags", disabled: !writable,
      act: () => modal(<TagsModal row={row} onClose={closeLayer}
        onDone={(m, t) => { closeLayer(); toast(m, t); }} />) },
    { icon: "list", label: "Back to the directory", act: () => navGo(back) },
    {
      icon: off ? "unlock" : "lock",
      label: off ? "Reactivate account" : "Deactivate account",
      tone: off ? undefined : "bad",
      disabled: !writable,
      act: () => modal(<DeactivateModal row={row} onClose={closeLayer}
        onDone={(m, t) => { closeLayer(); toast(m, t); }} />),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ProtoBar onReset={() => { resetStore(); toast("Back to the seed."); }} />

      {/* The record header: the face leads, the states sit under the name with
          the identity line, and the actions close the row. Back is the topbar's
          module title — one way up, panel-wide. */}
      <PageHeader
        className="mb-0"
        eyebrow={<span className="font-mono">{u.userId}</span>}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <Avatar lg name={u.identity.name} />
            <span className="truncate">{u.identity.name}</span>
          </span>
        }
        meta={
          <>
            <ClassPill k={row.classification} />
            {off ? <Pill tone="dead" text="Account off" title={u.deactivatedReason || ""} /> : null}
            <TagChips slugs={u.tags.map((t) => t.slug)} max={4} />
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tertiary">
              {u.identity.email ? <span className="font-mono">{u.identity.email}</span> : null}
              {u.identity.phone ? <span className="font-mono tnum">{u.identity.phone}</span> : null}
              {city ? <span>{city}</span> : null}
              <span>registered {fmtDate(u.registeredAt)}</span>
            </span>
          </>
        }
        actions={
          <>
            <MoreMenu items={menu} label="Actions" />
            {writable ? <Button color="primary" ico="edit" onClick={editProfile}>Edit profile</Button> : null}
          </>
        }
        tabs={
          <Tabs items={TABS.map((t) => ({
            k: t.k, label: t.label, quiet: true,
            n: t.k === "notes" ? u.notes.length
              : t.k === "audit" ? timeline.length : undefined,
          }))} cur={tab}
            onPick={(k) => onParams({ tab: k === "profile" ? undefined : k })} />
        }
      />

      {/* ======================================================== profile === */}
      {tab === "profile" ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Card
              title="Business profile"
              sub={PROFILE_SCHEMA_VERSION}
              right={<Completeness pct={row.completeness} missing={row.missingFields} />}
            >
              <KvList pairs={([
                /* The username is an ADDRESS, so on the record it is the thing
                   itself — a link somebody can open — not the string it is
                   made of. */
                ["Public profile", u.profile.username
                  ? <a className="inline-flex items-center gap-1 rounded font-mono text-sm text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      href={profileUrl(u.profile.username)} target="_blank" rel="noreferrer">
                      {u.profile.username}
                      <Icon name="ext" size="xs" />
                    </a>
                  : ""],
              ] as [ReactNode, ReactNode][]).concat(
                FACT_FIELDS.map((f) => [f.label, factOf(f, u.profile as unknown as Record<string, unknown>)]),
              )} />
            </Card>

            {/* WHERE THEY TAKE WORK, as the structured rows it is stored as: a
                closed state per row so claims aggregate, open cities inside it.
                A comma-joined string cannot be counted and cannot be read. */}
            <Card title="Service areas" sub="where they take work — one row per state" tight flush>
              <Table
                list
                className="rounded-none ring-0 shadow-none"
                cols={[{ label: "State", w: "12rem" }, { label: "Cities" }]}
                empty={{ icon: "pin", title: "No service areas", body: "Nobody has said where this business works. It is a required field on the profile." }}
                rows={(u.profile.targetAreas || []).map((a: TargetArea, i) => (
                  <tr key={i}>
                    <td className="cell-1">{a.state}</td>
                    <td>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {a.cities.map((c) => <Tag key={c} label={c} tone="tag-teal" />)}
                      </span>
                    </td>
                  </tr>
                ))}
              />
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card title="Identity" sub="authentication · read-only"
              right={<Icon name="shield" size="sm" className="text-fg-quaternary" />}>
              <KvList pairs={[
                ["Email", u.identity.email
                  ? <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono">{u.identity.email}</span>
                      <Pill xs tone={u.identity.emailVerified ? "ok" : "warn"}
                        text={u.identity.emailVerified ? "verified" : "unverified"} />
                    </span>
                  : ""],
                ["Mobile", u.identity.phone
                  ? <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono tnum">{u.identity.phone}</span>
                      <Pill xs tone={u.identity.phoneVerified ? "ok" : "warn"}
                        text={u.identity.phoneVerified ? "verified" : "unverified"} />
                    </span>
                  : ""],
                ["Auth identity", <span className="font-mono">{u.authUserId}</span>],
                ["Registered via", VOCAB.registrationSources.filter((s) => s.key === u.registrationSource)[0]?.label],
                ["Registered", <span className="tnum">{fmtDate(u.registeredAt)}</span>],
                ["Last seen", <span className="tnum">{ago(u.lastActivityAt)}</span>],
                ["Account", off
                  ? <span className="text-error-primary">Deactivated {ago(u.deactivatedAt)} — {u.deactivatedReason}</span>
                  : "Active"],
                ["Last edited", <>{u.profile.updatedBy || "—"} · <span className="tnum">{ago(u.profile.updatedAt)}</span></>],
              ]} />
            </Card>
            <Assumed id="UM-OD-09" />
          </div>
        </div>
      ) : null}

      {/* ===================================================== commercial === */}
      {tab === "commercial" ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <Card title="Linked records" sub="pointers into the modules that own them"
            className="lg:col-span-2"
            right={<Icon name="link" size="sm" className="text-fg-quaternary" />}>
            <KvList pairs={[
              ["Sales owner", u.commercial.salesOwner || ""],
              ["Deals", u.commercial.dealRefs.length
                ? <span className="flex flex-wrap items-center gap-1.5">
                    {u.commercial.dealRefs.map((d) => (
                      <LinkChip key={d} refText={d} to={"#/deals/" + d} ico="deal" />
                    ))}
                  </span>
                : ""],
              ["Invoices", u.commercial.invoiceRefs.length
                ? <span className="flex flex-wrap items-center gap-1.5">
                    {u.commercial.invoiceRefs.map((d) => (
                      <LinkChip key={d} refText={d} to={"#/invoices/" + d} ico="invoice" />
                    ))}
                  </span>
                : ""],
            ]} />
          </Card>

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
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <Card
            title="Internal notes"
            sub="append-only · never customer-visible"
            className="lg:col-span-2"
            right={writable
              ? <Button size="xs" color="secondary" ico="plus" onClick={() => modal(
                  <NoteModal row={row} onClose={closeLayer}
                    onDone={(m, t) => { closeLayer(); toast(m, t); }} />)}>Add note</Button>
              : undefined}
          >
            {u.notes.length ? (
              <ActivityFeed items={u.notes.map((n) => ({
                who: n.author,
                what: <>
                  <span className="font-medium text-primary">{n.author}</span>
                  <span className="text-quaternary"> · {n.authorRole}</span>
                  <p className="mt-0.5 text-sm text-secondary">{n.text}</p>
                </>,
                when: ago(n.at),
              }))} />
            ) : (
              <EmptyState flat icon="note" title="Nothing recorded yet"
                body="A note is what the next person servicing this account needs to know." />
            )}
          </Card>

          <div className="flex flex-col gap-4">
            <Card title="Tags" sub="internal segmentation"
              right={writable
                ? <Button size="xs" color="secondary" ico="edit" onClick={() => modal(
                    <TagsModal row={row} onClose={closeLayer}
                      onDone={(m, t) => { closeLayer(); toast(m, t); }} />)}>Edit</Button>
                : undefined}>
              {u.tags.length ? (
                <ul className="flex flex-col gap-2.5">
                  {u.tags.map((t) => (
                    <li key={t.slug} className="flex flex-wrap items-center gap-2">
                      <TagChips slugs={[t.slug]} />
                      <span className="text-xs text-quaternary">{t.assignedBy} · {ago(t.assignedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-quaternary">No tags.</p>
              )}
            </Card>

            <Notice tone="info" ico="lock" text={<>
              <b>Never customer-visible.</b> Notes and tags are excluded from every customer-facing
              profile response at the contract level. The audit records that a note exists and who
              added it, never what it says.
            </>} />
          </div>
        </div>
      ) : null}

      {/* ========================================================== audit === */}
      {tab === "audit" ? (
        <Card title="Timeline" sub="append-only · nothing is ever removed"
          right={<Icon name="lock" size="sm" className="text-fg-quaternary" />}>
          {timeline.length ? (
            /* AN AUDIT IS A HISTORY. Rows written while this module still ran a
               membership lifecycle are rows about things that actually
               happened, so they are still here and still labelled —
               vocabularies.json keeps those event types as historical for
               exactly this reason. Dropping them would be editing the past to
               match today's feature set. */
            <Timeline items={timeline.map((e) => {
              const meta = VOCAB.eventTypes.filter((x) => x.key === e.type)[0];
              return {
                title: meta ? meta.label : e.type,
                tone: meta && meta.tone ? DOT[meta.tone] : undefined,
                body: e.note || undefined,
                meta: <>{e.actor} · {e.actorRole} · <span title={e.at}>{fmtDateTime(e.at)}</span></>,
              };
            })} />
          ) : (
            <EmptyState flat icon="history" title="Nothing has happened on this account yet"
              body="Registration, profile edits, tags, notes and account status all land here." />
          )}
        </Card>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** One profile field, rendered as what it IS. A facet is the chips it holds —
 *  six segments comma-joined read as one long phrase, and the count, which is
 *  the thing you actually check on a profile, cannot be seen at all. Keys
 *  become labels here; what is stored is never what is shown. */
function factOf(f: ProfileField, profile: Record<string, unknown>): ReactNode {
  const v = profile[f.key];
  if (Array.isArray(v)) {
    if (!v.length) return "";
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {labelsFor(f, v as string[]).map((l, i) => <Tag key={i} label={l} tone={f.chip} />)}
      </span>
    );
  }
  if (f.type === "single") return v ? <Tag label={facetLabel(f.vocab || "", String(v))} tone={f.chip} /> : "";
  return (v as string | null) || "";
}
