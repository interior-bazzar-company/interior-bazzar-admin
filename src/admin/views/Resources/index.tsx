/* =============================================================================
   Data Forms — #/resources
   -----------------------------------------------------------------------------
     #/resources                     Data Forms — every form, and what it holds
     #/resources?face=responses      Responses — every submission, one table
     #/resources?form=RES-01         one form, its audience and its answers
     #/resources/new                 the builder, creating
     #/resources/RES-01/edit         the builder, editing that one
     #/resources/RSP-01              one submission, as a page

   THE ID SEGMENT CARRIES TWO KINDS OF RECORD, told apart by their prefix:
   `RES-` is a form and `RSP-` is a submission. That is a small piece of
   cleverness and it is worth its keep — a submission is a record somebody
   sends a link to, and giving it a page under the module it belongs to beats
   inventing a second route just to keep the ids in separate namespaces.

   A BARE `#/resources/RES-01` IS A LINK SOMEBODY WILL SEND, so it resolves to
   that form's own face rather than 404-ing or silently landing on "All". The
   trap it avoids is the one this panel has hit before: treating an absent third
   segment as a default and quietly showing a different screen than the link
   promised.

   TWO TABS, AND THEY ARE TWO QUESTIONS. Data Forms is "what forms exist and
   what do they hold"; Responses is "what has come in". Who has NOT sent one in
   is still answered — on the form's own face, where the audience and its links
   live — but it is a question about one form rather than a place of its own.

   THE STRIP IS FIXED. It carried one tab per form once, and chrome that grows
   with the data is chrome that is never in the same place twice. Two labelled
   questions is a strip; N titles is a list pretending to be one.

   A FORM'S OWN FACE IS A PLACE, NOT A TAB. It gets the page header, the way
   back and its own primary action, because everything on it is about that one
   document.

   NO API YET — everything is src/content/resources/*.json through store.ts.
   ============================================================================= */
import { useCallback, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, Card, DrawerShell, EmptyState, FilterBar, FilterChips, Icon, KvList, ListTable,
  ModalShell, PageHeader, Pill, Rail, SearchField, Select, ShareLine, StatStrip, Tabs, TbTitle, qs, shareOrCopy,
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import Builder from "./Builder";
import { AnswerRow, FileChips, Meter, RowStatePill, StatePill, TagChips, TypeMark, Who } from "./bits";
import {
  RESOURCE_STATE, acceptLine, audienceLine, deleteResource, deleteResponse, departmentsInUse,
  fmtDate, fmtSize, isShareable, labelOf, openResource, orderedResources, outdateResource,
  readResponses, resourceOf, responseOf, responsesFor, rowsFor, shareLink, sizeOfResponse,
  storageOf, strayResponses, tagsInUse, totalsFor, useResources, useResponses,
} from "./store";
import type { AudienceRow, Resource, ResourceResponse } from "./store";
import { MoreMenu } from "../../ui/menu";
import { closeResource } from "./store";
import type { MenuItem } from "../../ui/menu";
import { readMember } from "../Team/store";

const ROUTE = "#/resources";

export default function Resources() {
  const { id, sub } = useParams();

  /* THE BUILDER IS A PAGE, NOT A MODAL. It is the longest form in the panel and
     the one most likely to be interrupted; a modal that loses eleven fields to
     a stray Esc is not where this belongs. */
  if (id === "new") return <Builder mode="create" />;
  if (id && sub === "edit") return <Builder mode="edit" resourceId={id} />;
  if (id && id.indexOf("RSP-") === 0) return <ResponsePage responseId={id} />;
  return <Workspace deepLink={id || null} />;
}

/* --------------------------------------------------------------- crumbs -- */

/** The module's claim on the topbar: the way up, then where you are. */
function Crumb({ here }: { here?: string }) {
  return (
    <>
      <TbTitle label="Data Forms" to={ROUTE} />
      {here ? (
        <>
          <Icon name="chevr" size="xs" className="shrink-0 text-fg-quaternary" />
          <span className="truncate text-sm font-semibold text-primary">{here}</span>
        </>
      ) : null}
    </>
  );
}

/** The most recent thing that happened to a definition. There is no `updatedAt`
 *  on the record and inventing one would be a lie; this is the honest reading of
 *  the three stamps there are. */
function lastTouched(r: Resource): string {
  return [r.closedAt, r.openedAt, r.createdAt].filter(Boolean).sort().slice(-1)[0] || r.createdAt;
}

/* ------------------------------------------------------------ workspace -- */

function Workspace({ deepLink }: { deepLink: string | null }) {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  useResources();
  useResponses();

  const list = orderedResources();
  /* A bare `#/resources/RES-01` means that form's face, and the id in the path
     wins over a stale `?form=` somebody pasted after it. */
  const wanted = deepLink || p.form || "";
  const current = wanted && resourceOf(wanted) ? wanted : "";

  usePageChrome({
    crumbs: <Crumb />,
  }, current + "/" + (p.q || "") + (p.state || ""));

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    go(ROUTE + qs(next));
  }, [p]);

  const onFilter = (name: string, value: string) => goto({ [name]: value || undefined });

  const resource = current ? resourceOf(current) : null;

  /* A form in the path wins over a face — a link to one form is a link to that
     form, whatever stale `?face=` somebody left in the query behind it. */
  const face = resource ? "" : FACES.some((x) => x.k === p.face) ? p.face : "resources";

  const responses = readResponses();
  const answers = responses.length;

  if (resource) return <FormFace r={resource} p={p} onFilter={onFilter} />;

  const open = list.filter((r) => r.state === "open").length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={face === "responses" ? "Responses" : "Data Forms"}
        meta={face === "responses"
          ? <>{answers} {answers === 1 ? "submission" : "submissions"} · {fmtSize(storageOf(responses))} held in files</>
          : <>{list.length} {list.length === 1 ? "form" : "forms"} · {open} open · {answers} {answers === 1 ? "response" : "responses"}</>}
        actions={
          <Button color="primary" ico="plus" onClick={() => go(ROUTE + "/new")}>New form</Button>
        }
        /* The strip is the two questions and nothing else. A number on a tab
           means something is WAITING; Responses carries a plain count instead,
           because a submission that arrived is not a thing anybody owes you. */
        tabs={
          <Tabs cur={face}
            items={FACES.map((x) => ({ k: x.k, label: x.label, icon: x.icon,
              n: x.k === "responses" ? answers : undefined, quiet: true }))}
            onPick={(k) => goto({ form: undefined, res: undefined, q: undefined,
              state: undefined, face: k === "resources" ? undefined : k })} />
        }
      />

      {face === "responses"
        ? <ResponsesFace list={list} p={p} onFilter={onFilter} />
        : <ResourcesFace list={list} p={p} onFilter={onFilter} />}
    </div>
  );
}

/* TWO QUESTIONS, IN THE ORDER THEY ARE ASKED. What forms are there, and what
   has come in. Who still owes one is a question about a FORM, and it is
   answered on that form's own face. */
const FACES = [
  { k: "resources", label: "Data Forms", icon: "doc" },
  { k: "responses", label: "Responses", icon: "inbox" },
];

/* --------------------------------------------------------------- share -- */

/** THE LINK, ON THE ROW THAT NEEDS IT. A pending row is a person who has not
 *  sent something in, and the only thing this panel can do about that is hand
 *  you the link to send them. It is one press away rather than two screens.
 *
 *  The link carries the member, so what comes back attributes itself. A row that
 *  has already been answered does not get one: there is nothing to send, and the
 *  module refuses a second submission anyway.
 *
 *  IT DOES NOT NAVIGATE. `shareOrCopy` opens the OS share sheet where there is
 *  one and copies where there is not; either way the reader stays on the list
 *  they are working down, which is the whole reason the control is here and not
 *  behind the row. */
function ShareCell({ r, memberId, name, onSaid }: {
  r: Resource; memberId: string; name: string; onSaid: (m: string) => void;
}) {
  if (!isShareable(r)) {
    return <span className="text-xs text-quaternary" title={"This form is " + r.state}>—</span>;
  }
  return (
    <Button color="secondary" size="xs" ico="link"
      aria-label={"Send " + name + " the link to " + r.title}
      onClick={async (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        const said = await shareOrCopy(shareLink(r.resourceId, memberId),
          r.title + " — for " + name);
        if (said) onSaid(said);
      }}>
      Link
    </Button>
  );
}

/* ---------------------------------------------------------- data forms -- */

/** WHAT FORMS EXIST, AND WHAT EACH ONE HOLDS. The count leads the reason to
 *  open a row: a form with nothing in it and a form with nine answers are
 *  different objects, and the title alone does not say which is which.
 *
 *  CLICKING A ROW FILTERS RESPONSES TO IT rather than opening a page about it.
 *  The question anybody has after reading "9 of 12" is *which nine*, and that
 *  question is answered by the next tab — so the row goes there with the filter
 *  already set, instead of to a third place that would have to repeat it. The
 *  form's own face is still reachable from the menu, where the things that act
 *  on the definition live. */
function ResourcesFace({ list, p, onFilter }: {
  list: Resource[]; p: Record<string, string>; onFilter: (n: string, v: string) => void;
}) {
  const shell = useShell();

  let rows = list;
  if (p.q) {
    const q = p.q.toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().indexOf(q) >= 0
      || r.description.toLowerCase().indexOf(q) >= 0
      || r.tags.some((t) => t.toLowerCase().indexOf(q) >= 0)
      || audienceLine(r.departments).toLowerCase().indexOf(q) >= 0);
  }
  if (p.state) rows = rows.filter((r) => r.state === p.state);
  if (p.tag) rows = rows.filter((r) => r.tags.indexOf(p.tag) >= 0);
  if (p.dept) rows = rows.filter((r) => r.departments.indexOf(p.dept) >= 0);

  const filtered = !!(p.q || p.state || p.tag || p.dept);
  const held = storageOf(readResponses());
  const cells: (StatCell | "sep")[] = [
    { k: "forms", v: list.length, title: "Every form, whatever its state" },
    "sep",
    ...(["open", "draft", "closed", "outdated"] as const).map((k) => ({
      k: labelOf(RESOURCE_STATE, k).toLowerCase(),
      v: list.filter((r) => r.state === k).length,
      dot: k === "open" ? "ok" : k === "outdated" ? "bad" : "",
      to: ROUTE + qs({ ...p, state: k }),
      on: p.state === k,
    })),
    "sep",
    { k: "held in files", v: fmtSize(held), title: "Uploads across every submission" },
  ];

  return (
    <>
      {/* THE SHARED COMMAND ROW, the one Users and every other list uses:
          search, then the filters at whatever width their own labels need. The
          one control that is not a filter is the page header's primary, where
          every other module puts it. */}
      <FilterBar
        search={<SearchField ph="Search title, tag or department…" name="q" val={p.q} onFilter={onFilter} />}
        filters={
          <>
            <Select name="state" label="State" value={p.state} onFilter={onFilter}
              options={(["open", "draft", "closed", "outdated"] as const)
                .map((k) => ({ v: k, l: labelOf(RESOURCE_STATE, k),
                  dot: k === "open" ? "ok" : k === "outdated" ? "bad" : "neutral" }))} />
            <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter}
              options={tagsInUse().map((t) => ({ v: t, l: t }))} />
            <Select name="dept" label="Goes to" value={p.dept} onFilter={onFilter}
              options={departmentsInUse().map((d) => ({ v: d, l: d }))} />
          </>
        }
        chips={
          <FilterChips params={{ q: p.q, state: p.state, tag: p.tag, dept: p.dept }}
            labels={{ dept: "goes to" }} onUnfilter={(n) => onFilter(n, "")} />
        } />

      <StatStrip cells={cells} />

      {rows.length ? (
        <ListTable min="60rem" head={
          <tr>
            <th className="rail" />
            <th>Form</th>
            <th>Tags</th>
            <th className="n">In</th>
            <th>State</th>
            <th>Updated</th>
            <th className="acts" />
          </tr>
        }>
          {rows.map((r) => {
            const t = totalsFor(r);
            return (
              <tr key={r.resourceId} className="clickable"
                onClick={() => go(ROUTE + qs({ face: "responses", res: r.resourceId }))}>
                <Rail tone={r.state === "outdated" ? "bad" : r.state === "draft" ? "warn" : undefined}
                  title={r.state === "outdated" ? "Retired — do not send it again"
                    : r.state === "draft" ? "Not open yet — nobody can submit it" : undefined} />
                <td className="cell-1">
                  {r.title}
                  <span className="cell-2">{audienceLine(r.departments)} · {r.fields.length} {r.fields.length === 1 ? "field" : "fields"}</span>
                </td>
                <td><TagChips tags={r.tags} max={2} /></td>
                <td className="n">
                  <span className="font-medium text-primary">{t.submitted}</span>
                  <span className="text-quaternary"> / {t.audience}</span>
                </td>
                <td><StatePill state={r.state} /></td>
                <td className="font-mono text-tertiary tnum">{fmtDate(lastTouched(r))}</td>
                <td className="acts" onClick={(e) => e.stopPropagation()}>
                  <ResourceActions r={r} shell={shell} />
                </td>
              </tr>
            );
          })}
        </ListTable>
      ) : (
        <EmptyState icon="doc"
          title={filtered ? "Nothing matches that" : "No forms yet"}
          body={filtered
            ? "Clear the filter to see every form."
            : "A form is a set of questions plus the department it goes to. Create the first one and its audience appears under Member data straight away."}
          action={filtered
            ? <Button color="secondary" onClick={() => onFilter("*", "")}>Clear the filters</Button>
            : <Button color="primary" ico="plus" onClick={() => go(ROUTE + "/new")}>New form</Button>} />
      )}
    </>
  );
}

/** THE ACTIONS ON A DEFINITION, in the order they are reached for. Copy link is
 *  the one anybody presses daily, so it is a button; the rest are behind More,
 *  because a row of six controls is a row nobody reads.
 *
 *  Copy link on a whole form copies the link for the FIRST person who still
 *  owes it — the per-member links live on the form's own face, and a link that
 *  named the form alone would come back as an answer from nobody. When nobody
 *  owes it there is nothing to copy and the control says so rather than handing
 *  over a link that resolves to a completed form. */
function ResourceActions({ r, shell }: { r: Resource; shell: ReturnType<typeof useShell> }) {
  const pending = rowsFor(r).filter((x) => x.state === "pending");
  const answered = responsesFor(r.resourceId).length;

  const act = (fn: () => { ok: boolean; message?: string }, said?: string) => {
    const res = fn() as { ok: boolean; message?: string };
    if (!res.ok) shell.toast(res.message, "bad");
    else if (said) shell.toast(said, "ok");
  };

  /* FOUR ITEMS, AND THE FOURTH ONLY WHEN IT IS A WAY BACK. Open-the-form went
     because the row already goes somewhere and a menu item that repeats a click
     is furniture; Duplicate and Close went because neither was reached. Reopen
     stays, and only appears once a form is not open — without it Outdated would
     be a one-way door, and a form retired by mistake would need rebuilding. */
  const items: MenuItem[] = [
    {
      icon: "eye", label: "Open the form",
      act: () => go(ROUTE + qs({ form: r.resourceId })),
    },
    {
      icon: "edit", label: "Edit",
      act: () => go(ROUTE + "/" + r.resourceId + "/edit"),
      disabled: r.state === "closed",
      title: r.state === "closed" ? "Reopen it first" : undefined,
    },
    ...(r.state === "open" ? [] : [{
      icon: "unlock", label: "Reopen",
      act: () => act(() => openResource(r.resourceId), "Open again."),
    }]),
    {
      icon: "alert", label: "Outdated", tone: "dgr",
      act: () => act(() => outdateResource(r.resourceId), "Marked outdated."),
      disabled: r.state === "outdated",
      title: r.state === "outdated" ? "It already is" : "Retires it and keeps every answer",
    },
    {
      icon: "trash", label: "Delete", tone: "dgr",
      act: () => {
        if (answered) {
          shell.toast("It holds " + answered + (answered === 1 ? " response" : " responses")
            + ". Delete " + (answered === 1 ? "it" : "them") + " under Responses first, or mark this outdated.", "bad");
          return;
        }
        shell.modal(<ConfirmDeleteResource r={r} />);
      },
      title: answered ? "Delete its responses first" : "Nobody has answered it",
    },
  ];

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <Button color="secondary" size="xs" ico="link"
        isDisabled={!isShareable(r) || !pending.length}
        aria-label={pending.length
          ? "Copy the link for " + pending[0].member.name
          : "Nobody is waiting to fill this in"}
        onClick={async () => {
          const said = await shareOrCopy(shareLink(r.resourceId, pending[0].member.memberId),
            r.title + " — for " + pending[0].member.name);
          if (said) shell.toast(said, "ok");
        }}>
        Link
      </Button>
      <MoreMenu small items={items} />
    </span>
  );
}

/** NAME THE RECORD, STATE THE CONSEQUENCE, REPEAT THE VERB. A form with no
 *  answers is a cheap thing to lose and the dialog says so rather than dressing
 *  it up — the expensive delete is the one on a submission, and that one counts
 *  what it destroys. */
function ConfirmDeleteResource({ r }: { r: Resource }) {
  const shell = useShell();
  return (
    <ModalShell
      title={<>Delete “{r.title}”?</>}
      sub="Nobody has answered it, so nothing is lost but the form itself."
      ico="alert" tone="error"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Keep it</Button>
          <Button color="primary-destructive" onClick={() => {
            const res = deleteResource(r.resourceId);
            shell.closeLayer();
            if (!res.ok) shell.toast(res.message, "bad");
            else shell.toast("Deleted.", "ok");
          }}>Delete form</Button>
        </>
      }>
      <p className="text-sm text-tertiary">
        It disappears from every list and from the audience of everybody it was aimed at.
      </p>
    </ModalShell>
  );
}

/* ---------------------------------------------------------- responses -- */

/** EVERY SUBMISSION, ONE TABLE. Not the audience — only what has actually come
 *  in, newest first, because this tab is read to see what arrived rather than
 *  to chase what did not. A form's own face is the place with rows for things
 *  that have not happened, and keeping the two apart is what stops either from
 *  being half of both.
 *
 *  THE SIZE COLUMN IS HERE BECAUSE DELETING IS. Space is the reason anybody
 *  removes a submission, so the number that justifies it is on the row, and the
 *  strip totals it. */
function ResponsesFace({ list, p, onFilter }: {
  list: Resource[]; p: Record<string, string>; onFilter: (n: string, v: string) => void;
}) {
  const shell = useShell();
  let rows = readResponses().slice()
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

  if (p.res) rows = rows.filter((x) => x.resourceId === p.res);
  if (p.q) {
    const q = p.q.toLowerCase();
    rows = rows.filter((x) => {
      const m = readMember(x.memberId);
      const r = resourceOf(x.resourceId);
      return (m ? m.name.toLowerCase().indexOf(q) >= 0 : false)
        || (r ? r.title.toLowerCase().indexOf(q) >= 0 : false)
        || x.answers.some((a) => String(a.value || "").toLowerCase().indexOf(q) >= 0);
    });
  }
  if (p.files) rows = rows.filter((x) => sizeOfResponse(x) > 0);

  const filtered = !!(p.q || p.res || p.files);
  const held = storageOf(rows);
  const withFiles = rows.filter((x) => sizeOfResponse(x) > 0).length;

  const cells: (StatCell | "sep")[] = [
    { k: "submissions", v: rows.length, title: "Answers that have come in" },
    "sep",
    {
      k: "with files", v: withFiles, dot: withFiles ? "info" : "",
      to: ROUTE + qs({ ...p, face: "responses", files: "1" }), on: !!p.files,
    },
    { k: "held in files", v: fmtSize(held), title: "Delete a submission to free it" },
  ];

  const picked = p.res ? resourceOf(p.res) : null;

  return (
    <>
      <FilterBar
        search={<SearchField ph="Search member, form or answer…" name="q" val={p.q} onFilter={onFilter} />}
        filters={
          <>
            <Select name="res" label="Form" value={p.res} onFilter={onFilter}
              options={list.map((r) => ({ v: r.resourceId, l: r.title }))} />
            <Select name="files" label="Files" value={p.files} onFilter={onFilter}
              options={[{ v: "1", l: "With an upload", dot: "info" }]} />
          </>
        }
        chips={
          <FilterChips params={{ q: p.q, res: p.res, files: p.files }}
            labels={{ res: picked ? picked.title : "one form", files: "with an upload" }}
            onUnfilter={(n) => onFilter(n, "")} />
        } />

      <StatStrip cells={cells} />

      {rows.length ? (
        <ListTable min="64rem" head={
          <tr>
            <th className="rail" />
            <th>Member</th>
            <th>Form</th>
            <th>Answered</th>
            <th>Submitted</th>
            <th>What came back</th>
            <th className="n">Size</th>
            <th className="acts" />
          </tr>
        }>
          {rows.map((x) => {
            const m = readMember(x.memberId);
            const r = resourceOf(x.resourceId);
            const kb = sizeOfResponse(x);
            const stale = !!r && x.version !== r.version;
            const files = x.answers.filter((a) => a.file);
            return (
              <tr key={x.responseId} className="clickable"
                onClick={() => r && shell.drawer(<ResponseSheet r={r} x={x} />, undefined, "md")}>
                <Rail tone={stale ? "warn" : undefined}
                  title={stale ? "Answered on an older version of this form" : undefined} />
                <td className="cell-1">
                  {m ? <Who m={m} /> : <span className="font-mono text-xs tnum">{x.memberId}</span>}
                </td>
                <td className="cell-1">
                  {r ? r.title : x.resourceId}
                  <span className="cell-2">{x.answers.length} {x.answers.length === 1 ? "answer" : "answers"}</span>
                </td>
                <td>
                  {stale
                    ? <Pill dot tone="warn" text={"v" + x.version + " · older"} />
                    : <Pill dot tone="ok" text={"v" + x.version} />}
                </td>
                <td className="font-mono text-tertiary tnum">{fmtDate(x.submittedAt)}</td>
                <td>
                  {files.length
                    ? <FileChips answers={files} />
                    : <span className="text-xs text-tertiary">{peek(x)}</span>}
                </td>
                <td className="n text-tertiary">{kb ? fmtSize(kb) : "—"}</td>
                <td className="acts" onClick={(e) => e.stopPropagation()}>
                  <MoreMenu small items={[
                    { icon: "expand", label: "Open as a page", act: () => go(ROUTE + "/" + x.responseId) },
                    ...(r ? [{ icon: "doc", label: "Open the form",
                      act: () => go(ROUTE + qs({ form: r.resourceId })) }] : []),
                    ...(m ? [{ icon: "user", label: m.name.split(" ")[0] + "’s record",
                      act: () => go("#/team/" + m.memberId + "/resources") }] : []),
                    ...(r ? [{ icon: "trash", label: "Delete", tone: "dgr",
                      act: () => shell.modal(<ConfirmDeleteResponse r={r} x={x} />) }] : []),
                  ]} />
                </td>
              </tr>
            );
          })}
        </ListTable>
      ) : (
        <EmptyState icon="inbox"
          title={filtered ? "Nothing matches that" : "Nothing has come in yet"}
          body={filtered
            ? "Clear the filter to see every submission."
            : "Send a link from a form’s own face and the answer lands here."}
          action={filtered
            ? <Button color="secondary" onClick={() => onFilter("*", "")}>Clear the filters</Button>
            : <Button color="primary" ico="plus" onClick={() => go(ROUTE + "/new")}>New form</Button>} />
      )}
    </>
  );
}

/** THE ONE DIALOG IN THIS MODULE THAT DESTROYS SOMETHING. It counts what goes —
 *  the files, their size, and the fact that the person returns to pending with a
 *  working link — because a confirmation that only asks "are you sure" has told
 *  the reader nothing they did not already know. */
function ConfirmDeleteResponse({ r, x }: { r: Resource; x: ResourceResponse }) {
  const shell = useShell();
  const m = readMember(x.memberId);
  const kb = sizeOfResponse(x);
  const files = x.answers.filter((a) => a.file).length;
  return (
    <ModalShell
      title="Delete this submission?"
      sub={<>{m ? m.name : x.memberId} · {r.title} · {fmtDate(x.submittedAt)}</>}
      ico="alert" tone="error"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Keep it</Button>
          <Button color="primary-destructive" onClick={() => {
            const res = deleteResponse(x.responseId);
            shell.closeLayer();
            if (!res.ok) { shell.toast(res.message, "bad"); return; }
            shell.toast(res.value
              ? "Deleted. " + fmtSize(res.value) + " freed."
              : "Deleted.", "ok");
          }}>Delete submission</Button>
        </>
      }>
      <Alert tone="warn" title="This cannot be undone.">
        {files
          ? files + (files === 1 ? " file goes with it, freeing " : " files go with it, freeing ")
            + fmtSize(kb) + ". "
          : "It holds no files, so nothing is freed. "}
        {m ? m.name.split(" ")[0] : "They"} goes back to pending on this form, and their
        link starts working again — which is how they would send it a second time.
      </Alert>
    </ModalShell>
  );
}

/* --------------------------------------------------------------- a form -- */

function FormFace({ r, p, onFilter }: {
  r: Resource; p: Record<string, string>; onFilter: (n: string, v: string) => void;
}) {
  const shell = useShell();
  const [linksOpen, setLinksOpen] = useState(false);
  const t = totalsFor(r);
  const stray = strayResponses(r);
  /* What this form actually asks somebody to upload. Printed in the header so a
     reader knows what is coming back before any of it has, and so the accept
     list is visible to the person sending the link rather than only to the
     person following it. */
  const uploads = r.fields.filter((x) => x.type === "file");

  let rows: AudienceRow[] = rowsFor(r);
  if (p.q) {
    const q = p.q.toLowerCase();
    rows = rows.filter((x) => x.member.name.toLowerCase().indexOf(q) >= 0
      || x.member.designation.toLowerCase().indexOf(q) >= 0);
  }
  if (p.state) rows = rows.filter((x) => x.state === p.state);

  const act = (fn: () => { ok: boolean; message?: string }) => {
    const res = fn() as { ok: boolean; message?: string };
    if (!res.ok) shell.toast(res.message, "bad");
  };

  const cells: (StatCell | "sep")[] = [
    { k: "in the audience", v: t.audience, title: audienceLine(r.departments) },
    "sep",
    {
      k: "submitted", v: t.submitted, dot: t.submitted ? "ok" : "",
      to: ROUTE + qs({ ...p, form: r.resourceId, state: "submitted" }),
      on: p.state === "submitted",
    },
    {
      k: "pending", v: t.pending, dot: t.pending ? "warn" : "",
      to: ROUTE + qs({ ...p, form: r.resourceId, state: "pending" }),
      on: p.state === "pending",
    },
    "sep",
    { k: "complete", v: t.pct + "%" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Data form"
        back={{ label: "Data Forms", to: ROUTE }}
        title={r.title}
        meta={
          <>
            <StatePill state={r.state} />
            <span className="font-mono tnum">v{r.version}</span>
            <span>{audienceLine(r.departments)}</span>
            <span>{r.fields.length} {r.fields.length === 1 ? "field" : "fields"}</span>
            <TagChips tags={r.tags} />
          </>
        }
        actions={
          <>
            <Button color="secondary" ico="edit"
              onClick={() => go(ROUTE + "/" + r.resourceId + "/edit")}>Edit</Button>
            {r.state === "open"
              ? <Button color="secondary" ico="lock"
                  onClick={() => act(() => closeResource(r.resourceId))}>Close</Button>
              : <Button color="primary" ico="unlock"
                  onClick={() => act(() => openResource(r.resourceId))}>
                  {r.state === "draft" ? "Open it" : "Reopen"}
                </Button>}
          </>
        } />

      {r.state === "draft" ? (
        <Alert tone="warn" title="This is a draft.">
          Nobody can submit it yet — the audience below is who it would go to. Open it when
          the fields are right; a field can still be changed afterwards, and changing one
          after somebody has answered makes a new version rather than rewriting their answer.
        </Alert>
      ) : null}

      <StatStrip cells={cells} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <FilterBar
            search={<SearchField ph="Search member" name="q" val={p.q} onFilter={onFilter} />}
            filters={
              <Select name="state" label="State" value={p.state} onFilter={onFilter}
                options={[{ v: "submitted", l: "Submitted", dot: "ok" },
                  { v: "pending", l: "Pending", dot: "warn" }]} />
            }
            chips={<FilterChips params={{ q: p.q, state: p.state }} onUnfilter={(n) => onFilter(n, "")} />} />

          {rows.length ? (
            <ListTable min="46rem" head={
              <tr>
                <th className="rail" />
                <th>Member</th>
                <th>State</th>
                <th>Submitted</th>
                <th>{uploads.length ? "Files" : "Answers"}</th>
                <th className="acts">Share</th>
              </tr>
            }>
              {rows.map((x) => {
                const files = x.response ? x.response.answers.filter((a) => a.file) : [];
                return (
                  <tr key={x.member.memberId} className="clickable"
                    onClick={() => x.response
                      ? shell.drawer(<ResponseSheet r={r} x={x.response as ResourceResponse} />, undefined, "md")
                      : go("#/team/" + x.member.memberId)}>
                    <Rail tone={x.response ? undefined : "warn"}
                      title={x.response ? undefined : "Has not sent anything in"} />
                    <td className="cell-1"><Who m={x.member} /></td>
                    <td><RowStatePill state={x.state} /></td>
                    <td className="font-mono text-tertiary tnum">
                      {x.response ? fmtDate(x.response.submittedAt) : "—"}
                    </td>
                    <td>
                      {x.response
                        /* The files themselves where there are any — a row about
                           a PAN card should let you open the PAN card. */
                        ? files.length
                          ? <FileChips answers={files} />
                          : <span className="text-xs text-tertiary">{peek(x.response)}</span>
                        : <span className="text-xs text-quaternary">nothing yet</span>}
                    </td>
                    <td className="acts" onClick={(e) => e.stopPropagation()}>
                      {x.response
                        ? <span className="text-xs text-quaternary">in</span>
                        : <ShareCell r={r} memberId={x.member.memberId} name={x.member.name}
                            onSaid={(m) => shell.toast(m, "ok")} />}
                    </td>
                  </tr>
                );
              })}
            </ListTable>
          ) : (
            <EmptyState icon="users"
              title={p.q || p.state ? "Nothing matches that" : "Nobody matches this condition"}
              body={p.q || p.state
                ? "Clear the filter to see the whole audience."
                : audienceLine(r.departments)
                  + " matches nobody on the roster today. It will pick people up as they join."}
              action={p.q || p.state
                ? <Button color="secondary" onClick={() => onFilter("*", "")}>Clear the filters</Button>
                : undefined} />
          )}

          {stray.length ? (
            <>
              <Alert tone="info" title={stray.length + " answer" + (stray.length > 1 ? "s" : "") + " from outside the audience."}>
                Somebody answered and then stopped matching the rule — the condition changed, or
                they left. The answers are kept and listed here; they are out of the count above
                so “complete” still means the people it is asking about today.
              </Alert>
              <ListTable min="36rem" head={
                <tr><th>Member</th><th>Submitted</th><th>What came back</th></tr>
              }>
                {stray.map((s) => {
                  const m = readMember(s.memberId);
                  return (
                    <tr key={s.responseId} className="clickable"
                      onClick={() => shell.drawer(<ResponseSheet r={r} x={s} />, undefined, "md")}>
                      <td className="cell-1">
                        {m ? <Who m={m} /> : <span className="font-mono text-xs tnum">{s.memberId}</span>}
                      </td>
                      <td className="font-mono text-tertiary tnum">{fmtDate(s.submittedAt)}</td>
                      <td className="text-xs text-tertiary">{peek(s)}</td>
                    </tr>
                  );
                })}
              </ListTable>
            </>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card title="Completion" ticks tight
            sub={t.submitted + " of " + t.audience + " in"}>
            <div className="flex flex-col gap-2">
              <Meter pct={t.pct} tone={t.pct === 100 ? "ok" : t.submitted ? "warn" : ""} />
              <div className="text-display-xs font-semibold text-primary tnum">{t.pct}%</div>
            </div>
          </Card>

          <Card title="The form" tight>
            <KvList pairs={[
              ["About", r.description || "—"],
              ["Goes to", audienceLine(r.departments)],
              ["Tags", r.tags.length ? <TagChips key="t" tags={r.tags} /> : "—"],
              ["Version", <span key="v" className="font-mono tnum">v{r.version}</span>],
              ["Asks for", uploads.length
                ? uploads.map((u) => u.label + " (" + acceptLine(u.accept).toLowerCase() + ")").join(", ")
                : "Nothing to upload"],
            ]} />
          </Card>

          {/* THE LINK, AS THE THING YOU CAME FOR. Per row it is one press; here
              it is the whole list, because sending five people the same form is
              one job and not five. Each is still its own link — they differ by
              member and that is what makes an answer attributable. */}
          {isShareable(r) && t.pending ? (
            <Card tight
              title={"Links for the " + t.pending + " still to answer"}
              right={
                <Button color="secondary" size="xs" ico={linksOpen ? "chevu" : "chev"}
                  onClick={() => setLinksOpen(!linksOpen)}>
                  {linksOpen ? "Hide" : "Show"}
                </Button>
              }>
              {linksOpen ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-tertiary">
                    One link each. Send it however you already talk to them — nothing here
                    emails anybody, on purpose. The page it opens is the member’s own, and
                    it is <b className="font-semibold text-secondary">not built yet</b>: these
                    links will resolve when the member dashboard ships.
                  </p>
                  {rowsFor(r).filter((x) => x.state === "pending").map((x) => (
                    <div key={x.member.memberId} className="flex flex-col">
                      <span className="text-sm font-medium text-primary">{x.member.name}</span>
                      <ShareLine link={shareLink(r.resourceId, x.member.memberId)} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-tertiary">
                  One link each, carrying the member — which is what makes an answer
                  attributable. Nothing is emailed.
                </p>
              )}
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** The first two answers that actually carry a value, so a row says something
 *  without the reader opening it. Never every answer — a table cell that wraps
 *  to six lines has stopped being a table. */
function peek(x: ResourceResponse): string {
  const said = x.answers.filter((a) => String(a.value || "").trim());
  if (!said.length) return "submitted, all blank";
  /* FILES FIRST. When a form asks for a PAN card and a territory, the question a
     reader has is whether the card came in — so the files lead, and the typed
     answers fill whatever room is left. */
  const files = said.filter((a) => a.file);
  const rest = said.filter((a) => !a.file);
  const shown = files.concat(rest);
  const n = files.length ? 1 : 2;
  return shown.slice(0, n).map((a) => a.value).join(" · ")
    + (shown.length > n ? " +" + (shown.length - n) : "");
}

/* ------------------------------------------------------- one submission -- */

/** A SUBMISSION IS A PLACE, not only a layer over a list. It has its own
 *  address, so it can be sent to whoever has to look at it; its own crumb, so
 *  the way back is the module and not "close"; and room for the answers to be
 *  read rather than skimmed.
 *
 *  READ-ONLY, ALWAYS. There is no edit here and none is coming: a response is
 *  what somebody said, and correcting it would make it a record of what an
 *  admin wishes they had said. The single write is Delete, which is the space
 *  one, and it counts what it destroys before it does it. */
function ResponsePage({ responseId }: { responseId: string }) {
  const shell = useShell();
  useResources();
  useResponses();

  const x = responseOf(responseId);
  const r = x ? resourceOf(x.resourceId) : null;

  usePageChrome({
    crumbs: <Crumb here={r ? r.title : "Submission"} />,
    parent: x ? ROUTE + qs({ face: "responses", res: x.resourceId }) : ROUTE,
  }, responseId);

  if (!x || !r) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState icon="search" title="No such submission"
          body="It may have been deleted to free space, or the link is stale."
          action={
            <Button color="primary" onClick={() => go(ROUTE + qs({ face: "responses" }))}>
              Back to Responses
            </Button>} />
      </div>
    );
  }

  const m = readMember(x.memberId);
  const stale = x.version !== r.version;
  const kb = sizeOfResponse(x);
  const files = x.answers.filter((a) => a.file);
  const said = x.answers.filter((a) => !a.file);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Submission"
        back={{ label: "Responses", to: ROUTE + qs({ face: "responses", res: x.resourceId }) }}
        title={r.title}
        meta={
          <>
            <span>{m ? m.name : x.memberId}{m ? " · " + m.designation : ""}</span>
            <span className="font-mono tnum">{fmtDate(x.submittedAt)}</span>
            <span className="font-mono tnum">v{x.version}</span>
          </>
        }
        actions={
          <>
            {m ? (
              <Button color="secondary" ico="user"
                onClick={() => go("#/team/" + m.memberId + "/resources")}>
                {m.name.split(" ")[0]}’s record
              </Button>
            ) : null}
            <Button color="secondary-destructive" ico="trash"
              aria-label={kb ? "Delete — frees " + fmtSize(kb) : "Delete — it holds no files"}
              onClick={() => shell.modal(<ConfirmDeleteResponse r={r} x={x} />)}>
              Delete
            </Button>
          </>
        } />

      {stale ? (
        <Alert tone="info">
          Answered on <b>version {x.version}</b>; this form is on v{r.version} now. Every
          label below is the one that was on screen when it was filled in, not today’s.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* FILES FIRST WHEN THERE ARE ANY. The question anybody opens a
              submission with is whether the document arrived; the typed answers
              are the context around it. */}
          {files.length ? (
            <Card title="Files" sub={files.length + " · " + fmtSize(kb)}>
              <div className="flex flex-col gap-2">
                {files.map((a) => (
                  <div key={a.fieldId} className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary pb-2 last:border-0 last:pb-0">
                    <span className="text-xs font-medium text-tertiary">{a.label}</span>
                    <span className="min-w-0"><FileChips answers={[a]} /></span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Answers" sub={x.answers.length + " " + (x.answers.length === 1 ? "field" : "fields")}>
            {said.length ? (
              <dl className="flex flex-col">
                {said.map((a) => <AnswerRow key={a.fieldId} a={a} />)}
              </dl>
            ) : (
              <p className="text-sm text-tertiary">Every field on this form was an upload.</p>
            )}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card title="The form" tight>
            <KvList pairs={[
              ["Form", <button key="r" type="button"
                className="cursor-pointer rounded text-left text-sm font-medium text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => go(ROUTE + qs({ form: r.resourceId }))}>{r.title}</button>],
              ["State", <StatePill key="s" state={r.state} />],
              ["Tags", r.tags.length ? <TagChips key="t" tags={r.tags} /> : "—"],
              ["Goes to", audienceLine(r.departments)],
              ["Answered on", "Version " + x.version],
              ["Held in files", kb ? fmtSize(kb) : "—"],
            ]} />
          </Card>
          <p className="flex items-start gap-2 text-xs text-tertiary">
            <Icon name="lock" size="sm" className="mt-0.5 shrink-0 text-fg-quaternary" />
            <span>
              A submitted answer cannot be edited. If it is wrong, delete it —{" "}
              {m ? m.name.split(" ")[0] : "the member"} goes back to pending and their link
              starts working again.
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ one submission -- */

/** THE SUBMISSION BESIDE ITS LIST. A drawer inspects; it does not decide — the
 *  one write in it is Delete and that goes through its own dialog.
 *
 *  READ-ONLY, ALWAYS. A response is what somebody said; correcting it here would
 *  make it a record of what an admin wishes they had said. If it is wrong, the
 *  answer is a new submission, and the old one stays visible. */
export function ResponseSheet({ r, x }: { r: Resource; x: ResourceResponse }) {
  const shell = useShell();
  const m = readMember(x.memberId);
  const stale = x.version !== r.version;
  const kb = sizeOfResponse(x);
  const files = x.answers.filter((a) => a.file);
  return (
    <DrawerShell
      title={r.title}
      sub={<>{m ? m.name : x.memberId} · submitted {fmtDate(x.submittedAt)} · v{x.version}</>}
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary-destructive" size="sm" ico="trash"
            aria-label={kb ? "Delete — frees " + fmtSize(kb) : "Delete — it holds no files"}
            onClick={() => shell.modal(<ConfirmDeleteResponse r={r} x={x} />)}>
            Delete
          </Button>
          <span className="flex-1" />
          {m ? (
            <Button color="secondary" size="sm"
              onClick={() => go("#/team/" + m.memberId + "/resources")}>
              {m.name.split(" ")[0]}’s record
            </Button>
          ) : null}
          <Button color="primary" size="sm" ico="expand"
            onClick={() => { shell.closeLayer(); go(ROUTE + "/" + x.responseId); }}>
            Open as a page
          </Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        {stale ? (
          <Alert tone="info">
            Answered on <b>version {x.version}</b>; this form is on v{r.version} now. The
            labels below are the ones that were on screen when it was filled in, not today’s.
          </Alert>
        ) : null}

        <KvList pairs={[
          ["Member", m ? m.name : x.memberId],
          ["Submitted", <span key="s" className="font-mono tnum">{fmtDate(x.submittedAt)}</span>],
          ["Answered on", "Version " + x.version],
          ["Files", files.length ? files.length + " · " + fmtSize(kb) : "None"],
        ]} />

        <div>
          <div className="label-mono mb-2">Answers</div>
          <dl className="flex flex-col">
            {x.answers.map((a) => <AnswerRow key={a.fieldId} a={a} />)}
          </dl>
        </div>

        {/* EDIT IS ABSENT, NOT DISABLED. A submitted answer is what somebody
            said; correcting it here would make it a record of what an admin
            wishes they had said. Delete is the only write, and it is the space
            one. */}
        <p className="flex items-start gap-2 text-xs text-tertiary">
          <Icon name="lock" size="sm" className="mt-0.5 shrink-0 text-fg-quaternary" />
          <span>Cannot be edited{kb ? " · " + fmtSize(kb) + " in files" : ""}</span>
        </p>
      </div>
    </DrawerShell>
  );
}

/* ------------------------------------------------------------ preview --- */

/** The form as the member will meet it. Used by the builder, and exported here
 *  because it is the only honest description of what a definition means.
 *
 *  Every control is disabled: this is a picture of the form, not the form. The
 *  real one is `Fill.tsx`. */
export function FormPreview({ r }: { r: Pick<Resource, "title" | "description" | "fields"> }) {
  if (!r.fields.length) {
    return (
      <EmptyState icon="doc" title="No fields yet"
        body="Add the first one and it appears here, exactly as the member will see it." />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="text-md font-semibold text-primary">{r.title || "Untitled form"}</h4>
        {r.description ? <p className="mt-0.5 text-sm text-tertiary">{r.description}</p> : null}
      </div>
      {r.fields.map((f) => (
        <div key={f.fieldId} className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1 text-sm font-medium text-secondary">
            {f.label || <i className="font-normal text-quaternary">unnamed field</i>}
            {f.required ? <span className="text-brand-tertiary" title="Required">*</span> : null}
          </span>
          <PreviewControl f={f} />
          {f.help ? <span className="text-sm text-tertiary">{f.help}</span> : null}
        </div>
      ))}
    </div>
  );
}

const DEAD_BOX = "flex min-h-9 w-full items-center rounded-lg bg-secondary px-3 py-2 text-sm text-placeholder ring-1 ring-secondary ring-inset";

function PreviewControl({ f }: { f: Resource["fields"][number] }) {
  if (f.type === "textarea") {
    return <div aria-hidden="true" className={DEAD_BOX + " min-h-16 items-start"}>Their answer</div>;
  }
  if (f.type === "select") {
    return (
      <div aria-hidden="true" className={DEAD_BOX + " justify-between gap-2"}>
        <span className="truncate">{f.options.length ? f.options[0] : "No options yet"}</span>
        <Icon name="chev" size="sm" className="shrink-0 text-fg-quaternary" />
      </div>
    );
  }
  if (f.type === "checkbox") {
    return (
      <div aria-hidden="true" className="flex items-center gap-2 text-sm text-tertiary">
        <span className="size-4 shrink-0 rounded bg-primary ring-1 ring-primary ring-inset" />
        Yes
      </div>
    );
  }
  if (f.type === "file") {
    return (
      <div aria-hidden="true" className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary px-3 py-2.5 text-sm text-tertiary">
        <Icon name="upload" size="sm" className="text-fg-quaternary" />
        Choose a file
        <span className="text-xs text-quaternary">
          {acceptLine(f.accept)}{f.maxMb ? " · up to " + f.maxMb + " MB" : ""}
        </span>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className={DEAD_BOX}>
      {f.type === "date" ? "dd / mm / yyyy" : f.type === "number" ? "0" : "Their answer"}
    </div>
  );
}

export { TypeMark };
