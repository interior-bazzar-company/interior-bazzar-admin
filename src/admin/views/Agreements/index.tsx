/* =============================================================================
   Agreements — #/agreements
   -----------------------------------------------------------------------------
     #/agreements                    Templates — the wording, written once
     #/agreements?face=sent          Sent — every copy, and where each one stopped
     #/agreements/new                the editor, writing a new template
     #/agreements/TPL-NDA/edit       the editor, on an existing one
     #/agreements/AG-02              one agreement — the deed and its evidence

   TWO TABS, TWO QUESTIONS: what do we ask people to sign, and who has signed.
   The id segment carries both kinds of record, told apart by prefix — `TPL-` a
   template, `AG-` a sent copy — the same arrangement the Resources module uses,
   for the same reason: a sent agreement is a record somebody follows a link to,
   and it belongs under the module rather than at a route invented to keep ids
   apart.

   THE AGREEMENTS ARE TEAM'S RECORDS, read here across everybody instead of one
   person at a time. `#/team/:id/agreements` still works and still shows the
   same rows. See store.ts.
   ============================================================================= */
import { useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, Card, EmptyState, FilterBar, FilterChips, Icon, KvList, ModalShell, PageHeader, qs,
  SearchField, Select, shareOrCopy, StatStrip, Table, Tabs, TbTitle,
} from "../../ui";
import type { StatCell } from "../../ui";
import { MoreMenu } from "../../ui/menu";
import type { MenuItem } from "../../ui/menu";
import { go } from "../../ui/nav";
import Editor from "./Editor";
import { Evidence, Sheet, SignatureLine, StatePill, TemplatePill, Who } from "./bits";
import {
  AGREEMENT_KIND, AGREEMENT_STATE_LABEL, activateTemplate, agreementOf, allAgreements,
  bodyOf, deleteTemplate, fmtDate, fmtWhen, isExpired, isSendable, labelOf, readMember,
  readMembers, readTemplates, retireTemplate, revokeAgreement, sendTemplate, sentFrom,
  signLink, stateOf, templateOf, totalsOf, useAgreements, useTemplates,
} from "./store";
import type { Agreement, Template } from "./store";

const ROUTE = "#/agreements";

export default function Agreements() {
  const { id, sub } = useParams();

  if (id === "new") return <Editor mode="create" />;
  if (id && sub === "edit") return <Editor mode="edit" templateId={id} />;
  if (id && id.indexOf("AG-") === 0) return <DeedPage agreementId={id} />;
  return <Workspace deepLink={id || null} />;
}

/* ------------------------------------------------------------ workspace -- */

const FACES = [
  { k: "templates", label: "Templates", icon: "doc" },
  { k: "sent", label: "Sent", icon: "inbox" },
];

function Workspace({ deepLink }: { deepLink: string | null }) {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  useTemplates();
  useAgreements();

  /* A bare `#/agreements/TPL-NDA` means that template's copies, which is the
     question anybody clicking a template row actually has. */
  const wanted = deepLink && templateOf(deepLink) ? deepLink : "";
  const face = wanted ? "sent" : FACES.some((x) => x.k === p.face) ? p.face : "templates";

  usePageChrome({
    crumbs: <TbTitle label="Agreements" to={ROUTE} />,
  }, face + (p.q || "") + (p.state || "") + (p.tpl || wanted || ""));

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    go(ROUTE + qs(next));
  }, [p]);

  const onFilter = (name: string, value: string) => goto({ [name]: value || undefined });

  const waiting = totalsOf(allAgreements()).waiting;
  const params = wanted ? { ...p, tpl: wanted } : p;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Agreements"
        meta={waiting
          ? <span className="tnum">{waiting} waiting on a signature</span>
          : <span>Every copy signed</span>}
        actions={<Button color="primary" ico="plus" onClick={() => go(ROUTE + "/new")}>New template</Button>}
        tabs={
        /* A number means somebody has not signed yet. Nothing else here is
           waiting on anybody. */
        <Tabs cur={face}
          items={FACES.map((x) => ({ k: x.k, label: x.label, icon: x.icon,
            n: x.k === "sent" ? waiting : undefined }))}
          onPick={(k) => goto({ face: k === "templates" ? undefined : k,
            q: undefined, state: undefined, tpl: undefined })} />
        } />

      {face === "sent"
        ? <SentFace p={params} onFilter={onFilter} />
        : <TemplatesFace p={p} onFilter={onFilter} />}
    </div>
  );
}

/* ------------------------------------------------------------ templates -- */

/** THE WORDING, WRITTEN ONCE. A row is a document you can send, and the number
 *  that matters is how many copies are out — a template nobody has sent and a
 *  template with nine signatures behind it are different objects, and the title
 *  does not say which.
 *
 *  Clicking a row shows that template's copies, because "sent 9 times" is only
 *  useful next to *which nine*. */
function TemplatesFace({ p, onFilter }: {
  p: Record<string, string>; onFilter: (n: string, v: string) => void;
}) {
  const shell = useShell();
  let rows = readTemplates();

  if (p.q) {
    const q = p.q.toLowerCase();
    rows = rows.filter((t) => t.title.toLowerCase().indexOf(q) >= 0
      || t.purpose.toLowerCase().indexOf(q) >= 0
      || labelOf(AGREEMENT_KIND, t.kind).toLowerCase().indexOf(q) >= 0);
  }
  if (p.state) rows = rows.filter((t) => t.state === p.state);

  const all = readTemplates();
  const cells: (StatCell | "sep")[] = [
    { k: "templates", v: all.length, title: "Every document, whatever its state" },
    "sep",
    { k: "in use", v: all.filter((t) => t.state === "active").length, dot: "ok" },
    { k: "draft", v: all.filter((t) => t.state === "draft").length },
    { k: "retired", v: all.filter((t) => t.state === "retired").length },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FilterBar
        search={<SearchField ph="Search title, purpose or kind…" name="q" val={p.q} onFilter={onFilter} />}
        filters={
          <Select name="state" label="State" value={p.state} onFilter={onFilter}
            options={[{ v: "active", l: "In use" }, { v: "draft", l: "Draft" },
              { v: "retired", l: "Retired" }]} />
        }
        chips={p.q || p.state
          ? <FilterChips params={{ q: p.q, state: p.state }} onUnfilter={(n) => onFilter(n, "")} />
          : null} />

      <StatStrip cells={cells} />

      <Table list
          cols={[
            { label: "Sent", cls: "n", w: "110px" },
            { label: "Document" },
            { label: "Kind", w: "130px" },
            { label: "Clauses", cls: "n", w: "90px" },
            { label: "State", w: "120px" },
            { label: "", cls: "acts", w: "150px" },
          ]}
          empty={{
            icon: "doc",
            title: p.q || p.state ? "Nothing matches that" : "No templates yet",
            body: p.q || p.state
              ? "Clear the filter to see every document."
              : "A template is the wording, written once and sent as many times as you need. Write the first one and it becomes something you can send from anybody's record.",
          }}
          rows={rows.map((t) => {
            const out = sentFrom(t.templateId);
            const tot = totalsOf(out);
            return (
              <tr key={t.templateId} className="clickable"
                onClick={() => go(ROUTE + qs({ face: "sent", tpl: t.templateId }))}>
                {/* SIGNED OF SENT, one figure. "9" alone does not say whether
                    anybody is still being waited on. */}
                <td className="n">
                  <b className="text-primary">{tot.signed}</b>
                  <div className="cell-2">of {tot.sent}</div>
                </td>
                <td className="cell-1">
                  <span className="flex flex-wrap items-baseline gap-1.5">
                    {t.title}
                    <span className="font-mono text-xs font-normal text-quaternary tnum">v{t.version}</span>
                  </span>
                  <div className="cell-2">{t.purpose || "No description"}</div>
                </td>
                <td>{labelOf(AGREEMENT_KIND, t.kind)}</td>
                <td className="n">{t.clauses.length}</td>
                <td><TemplatePill state={t.state} /></td>
                <td className="acts" onClick={(e) => e.stopPropagation()}>
                  <TemplateActions t={t} shell={shell} />
                </td>
              </tr>
            );
          })}
      />
    </div>
  );
}

function TemplateActions({ t, shell }: { t: Template; shell: ReturnType<typeof useShell> }) {
  const out = sentFrom(t.templateId).length;

  const act = (fn: () => { ok: boolean; message?: string }, said: string) => {
    const r = fn() as { ok: boolean; message?: string };
    if (!r.ok) shell.toast(r.message, "bad"); else shell.toast(said, "ok");
  };

  const items: MenuItem[] = [
    { icon: "doc", label: "Edit", act: () => go(ROUTE + "/" + t.templateId + "/edit"),
      disabled: t.state === "retired", title: t.state === "retired" ? "Reinstate it first" : undefined },
    ...(t.state === "active"
      ? [{ icon: "lock", label: "Retire", tone: "dgr",
          act: () => act(() => retireTemplate(t.templateId), "Retired.") }]
      : [{ icon: "unlock", label: t.state === "draft" ? "Put in use" : "Reinstate",
          act: () => act(() => activateTemplate(t.templateId), "In use.") }]),
    { icon: "x", label: "Delete", tone: "dgr",
      act: () => {
        if (out) {
          shell.toast("It has been sent " + out + (out === 1 ? " time" : " times")
            + ". Retire it instead — deleting would leave those signatures pointing at nothing.", "bad");
          return;
        }
        const r = deleteTemplate(t.templateId);
        if (!r.ok) shell.toast(r.message, "bad"); else shell.toast("Deleted.", "ok");
      },
      title: out ? "It has been sent — retire it instead" : "Nobody has been sent this" },
  ];

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <Button size="xs" color="secondary" ico="ext" isDisabled={t.state !== "active"}
        title={t.state === "active" ? "Send it to somebody" : "Put it in use first"}
        onClick={() => shell.modal(<SendModal t={t} />)}>
        Send
      </Button>
      <MoreMenu small ico items={items} aria-label={"Actions for " + t.title} />
    </span>
  );
}

/** SEND ONE COPY TO ONE PERSON. The roster with its state beside each name, so
 *  the decision and the evidence for it are the same list — somebody who
 *  already has this out is shown as such rather than being refused after the
 *  click. */
function SendModal({ t }: { t: Template }) {
  const shell = useShell();
  const out = sentFrom(t.templateId);
  const stateFor = (memberId: string) => {
    const live = out.filter((a) => a.memberId === memberId && a.state !== "revoked")[0];
    return live || null;
  };
  const roster = readMembers().filter((m) => m.status === "active");

  return (
    <ModalShell
      title={"Send “" + t.title + "”"}
      sub={"Version " + t.version + ". The wording is copied into their copy as it stands now."}
      ico="ext"
      tone="brand"
      onClose={() => shell.closeLayer()}
      danger={<span className="text-xs text-tertiary">Nothing is emailed. You send the link yourself.</span>}
      actions={<Button color="secondary" onClick={() => shell.closeLayer()}>Close</Button>}>
      {/* THE ROSTER WITH ITS STATE BESIDE EACH NAME: the decision and the
          evidence for it are one list, so somebody who already has this out is
          shown as such rather than refused after the click. */}
      <div className="flex flex-col divide-y divide-secondary">
        {roster.map((m) => {
          const live = stateFor(m.memberId);
          return (
            <div key={m.memberId} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1"><Who m={m} /></span>
              {live
                ? <StatePill a={live} />
                : <Button size="xs" color="primary" onClick={() => {
                    const r = sendTemplate(t.templateId, m.memberId);
                    if (!r.ok) { shell.toast(r.message, "bad"); return; }
                    shell.closeLayer();
                    shell.toast("Sent to " + m.name + ".", "ok");
                    go(ROUTE + "/" + r.data.agreementId);
                  }}>Send</Button>}
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

/* ----------------------------------------------------------------- sent -- */

/** EVERY COPY, AND WHERE EACH ONE STOPPED. The member page answers this one
 *  person at a time; this is the same rows read the other way, which is the
 *  view anybody chasing signatures actually needs. */
function SentFace({ p, onFilter }: {
  p: Record<string, string>; onFilter: (n: string, v: string) => void;
}) {
  const shell = useShell();
  let rows = allAgreements();

  if (p.tpl) rows = rows.filter((a) => a.templateId === p.tpl);
  if (p.state) rows = rows.filter((a) => stateOf(a) === p.state);
  if (p.q) {
    const q = p.q.toLowerCase();
    rows = rows.filter((a) => {
      const m = readMember(a.memberId);
      return a.title.toLowerCase().indexOf(q) >= 0
        || (m ? m.name.toLowerCase().indexOf(q) >= 0 : false)
        || String(a.signedName || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  const t = totalsOf(rows);
  const expired = rows.filter((a) => isExpired(a)).length;
  const picked = p.tpl ? templateOf(p.tpl) : null;

  const cells: (StatCell | "sep")[] = [
    { k: "sent", v: t.sent, title: "Copies that have gone out" },
    "sep",
    { k: "signed", v: t.signed, dot: t.signed ? "ok" : "",
      to: ROUTE + qs({ ...p, face: "sent", state: "signed" }), on: p.state === "signed" },
    { k: "waiting", v: t.waiting, dot: t.waiting ? "info" : "",
      to: ROUTE + qs({ ...p, face: "sent", state: "sent" }), on: p.state === "sent" },
    { k: "expired", v: expired, dot: expired ? "warn" : "",
      to: ROUTE + qs({ ...p, face: "sent", state: "expired" }), on: p.state === "expired" },
    { k: "revoked", v: t.revoked },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FilterBar
        search={<SearchField ph="Search member or document…" name="q" val={p.q} onFilter={onFilter} />}
        filters={<>
          <Select name="tpl" label="Template" value={p.tpl} onFilter={onFilter}
            options={readTemplates().map((x) => ({ v: x.templateId, l: x.title }))} />
          <Select name="state" label="State" value={p.state} onFilter={onFilter}
            options={["sent", "viewed", "signed", "expired", "revoked"]
              .map((k) => ({ v: k, l: AGREEMENT_STATE_LABEL[k] }))} />
        </>}
        chips={p.q || p.tpl || p.state
          ? <FilterChips params={{ q: p.q, tpl: p.tpl, state: p.state }}
              labels={{ tpl: picked ? picked.title : "one template" }}
              onUnfilter={(n) => onFilter(n, "")} />
          : null} />

      <StatStrip cells={cells} />

      <Table list
          cols={[
            { label: "Member" },
            { label: "Document" },
            { label: "Sent", w: "130px" },
            { label: "State", w: "130px" },
            { label: "Signed by" },
            { label: "", cls: "acts", w: "120px" },
          ]}
          empty={{
            icon: "inbox",
            title: p.q || p.tpl || p.state ? "Nothing matches that" : "Nothing has been sent",
            body: p.q || p.tpl || p.state
              ? "Clear the filter to see every copy."
              : "Put a template in use and send it from its row. Each copy appears here with its own link.",
          }}
          rows={rows.map((a) => {
            const m = readMember(a.memberId);
            return (
              <tr key={a.agreementId} className="clickable"
                onClick={() => go(ROUTE + "/" + a.agreementId)}>
                <td>{m ? <Who m={m} /> : <span className="font-mono tnum">{a.memberId}</span>}</td>
                <td className="cell-1">
                  {a.title}
                  <div className="cell-2 font-mono tnum">v{a.version}</div>
                </td>
                <td className="mono">{fmtDate(a.sentAt)}</td>
                <td><StatePill a={a} /></td>
                <td>
                  {/* A NAME IS EVIDENCE; everything else here is a reason there
                      is no name yet, so it is quieter than one. */}
                  {a.signedName
                    ? <span className="font-medium text-primary">{a.signedName}</span>
                    : <span className="text-tertiary">{isExpired(a)
                      ? "Link ran out " + fmtDate(a.expiresAt)
                      : a.state === "revoked" ? "Revoked" : "Not yet"}</span>}
                </td>
                <td className="acts" onClick={(e) => e.stopPropagation()}>
                  {isSendable(a) ? (
                    <Button size="xs" color="secondary" ico="link"
                      title={"Copy the link for " + (m ? m.name : "them")}
                      onClick={async () => {
                        const said = await shareOrCopy(signLink(a), a.title);
                        if (said) shell.toast(said, "ok");
                      }}>Link</Button>
                  ) : <span className="text-quaternary">—</span>}
                </td>
              </tr>
            );
          })}
      />
    </div>
  );
}

/* ----------------------------------------------------------- one deed -- */

/** THE DEED, AND WHAT CAN BE PROVEN ABOUT IT. The document on the left at
 *  reading width with its signature line at the foot, exactly where one goes on
 *  paper; the evidence beside it — name, time, address, version, token — which
 *  is what the system can actually stand behind.
 *
 *  Two readings of one fact, the human and the forensic, and they are separate
 *  on purpose: the signature line is what the member agreed to, the evidence
 *  block is why anybody else should believe it. */
function DeedPage({ agreementId }: { agreementId: string }) {
  const shell = useShell();
  useAgreements();
  useTemplates();

  const a = agreementOf(agreementId);
  const m = a ? readMember(a.memberId) : null;

  usePageChrome({
    crumbs: (
      <>
        <TbTitle label="Agreements" to={ROUTE} />
        <span aria-hidden="true" className="text-quaternary">/</span>
        <span className="truncate text-sm font-semibold text-primary">{a ? a.title : "Agreement"}</span>
      </>
    ),
    parent: ROUTE + qs({ face: "sent" }),
  }, agreementId);

  if (!a) {
    return (
      <EmptyState icon="search" title="No such agreement"
        body="It may have been removed, or the link is stale."
        action={<Button color="primary" onClick={() => go(ROUTE + qs({ face: "sent" }))}>
          Back to Sent</Button>} />
    );
  }

  const { clauses, frozen } = bodyOf(a);
  const t = a.templateId ? templateOf(a.templateId) : null;

  /* The occasional actions fold into one menu under `lg` — a phone showed
     three buttons wrapped under the title. */
  const acts: MenuItem[] = [];
  if (m) acts.push({ icon: "user", label: m.name.split(" ")[0] + "’s record",
    act: () => go("#/team/" + m.memberId + "/agreements") });
  if (isSendable(a)) acts.push({ icon: "link", label: "Copy link",
    title: "The member signs through it", act: async () => {
      const said = await shareOrCopy(signLink(a), a.title);
      if (said) shell.toast(said, "ok");
    } });
  if (a.state !== "signed" && a.state !== "revoked") acts.push({ icon: "x", label: "Revoke", tone: "bad",
    title: "The link stops working immediately", act: () => {
      const r = revokeAgreement(a.agreementId);
      if (!r.ok) shell.toast(r.message, "bad");
      else shell.toast("Revoked. The link stops working.", "ok");
    } });

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow={AGREEMENT_STATE_LABEL[stateOf(a)]}
        title={a.title}
        back={{ label: "Sent", to: ROUTE + qs({ face: "sent" }) }}
        meta={<>
          <span>{m ? m.name : a.memberId}</span>
          {m ? <span>{m.designation}</span> : null}
          <span>sent {fmtWhen(a.sentAt)}</span>
        </>}
        fold={acts} />

      {!frozen ? (
        <Alert tone="info" ico="alert" title="This copy has no frozen text.">
          It predates templates, so what is shown below is{" "}
          {t ? "the current wording of " + t.title : "unavailable"} — not necessarily what was
          agreed to. Anything sent from now on carries its own copy.
        </Alert>
      ) : null}

      {isExpired(a) ? (
        <Alert tone="warn" ico="clock" title={"The link ran out on " + fmtDate(a.expiresAt) + "."}>
          Nothing was signed. Revoke this copy and send a fresh one from the template.
        </Alert>
      ) : null}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Sheet title={a.title} clauses={clauses}>
          <SignatureLine a={a} />
        </Sheet>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
          <Evidence a={a} />
          <Card tight>
            <KvList pairs={[
              ["Template", t
                ? <Button key="t" color="link-color" size="xs"
                    onClick={() => go(ROUTE + "/" + t.templateId + "/edit")}>{t.title}</Button>
                : "None — sent before templates"],
              ["Kind", labelOf(AGREEMENT_KIND, a.kind)],
              ["Expires", a.expiresAt ? fmtDate(a.expiresAt) : "—"],
            ]} />
          </Card>
          <p className="flex items-start gap-1.5 text-xs text-tertiary">
            <Icon name="lock" size="xs" className="mt-0.5 shrink-0" />
            <span>A sent agreement cannot be edited, and a signed one cannot be revoked. To change
              the wording, edit the template and send a new copy.</span>
          </p>
        </aside>
      </div>
    </div>
  );
}

export { Sheet };
export type { Agreement, Template };
