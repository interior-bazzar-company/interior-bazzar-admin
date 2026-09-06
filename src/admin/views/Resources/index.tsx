/* =============================================================================
   Resources — #/resources
   -----------------------------------------------------------------------------
     #/resources                     Resources — every form, and what it holds
     #/resources?face=responses      Responses — every submission, one table
     #/resources?form=RES-01         one resource, its audience and its answers
     #/resources/new                 the builder, creating
     #/resources/RES-01/edit         the builder, editing that one
     #/resources/RSP-01              one submission, as a page

   THE ID SEGMENT CARRIES TWO KINDS OF RECORD, told apart by their prefix:
   `RES-` is a form and `RSP-` is a submission. That is a small piece of
   cleverness and it is worth its keep — a submission is a record somebody
   sends a link to, and giving it a page under the module it belongs to beats
   inventing a second route just to keep the ids in separate namespaces.

   A BARE `#/resources/RES-01` IS A LINK SOMEBODY WILL SEND, so it resolves to
   that resource's tab rather than 404-ing or silently landing on "All". The
   trap it avoids is the one this panel has hit before: treating an absent third
   segment as a default and quietly showing a different screen than the link
   promised.

   TWO TABS, AND THEY ARE TWO QUESTIONS. Resources is "what forms exist and what
   do they hold"; Responses is "what has come in". Who has NOT sent one in is
   still answered — on the form's own face, where the audience and its links
   live — but it is a question about one form rather than a place of its own.

   THE STRIP IS FIXED. It carried one tab per form once, and chrome that grows
   with the data is chrome that is never in the same place twice. Two labelled
   questions is a strip; N titles is a list pretending to be one.

   OLD NOTE, KEPT BECAUSE THE REASONING STILL HOLDS FOR PER-FORM TABS:
   There was a tab per form, then two tabs, and the honest end of
   that argument is none: this module answers ONE question — who has sent what in
   — and a tab strip over a single table is chrome that says "there is more here"
   when there is not. A list of the forms themselves was the second tab and it
   earned nothing: a form with no rows under it is a form nobody has been asked
   for, which is a fact better learnt from the row that is missing than from a
   second table listing it.

   So `#/resources` IS the member table, and a new resource shows up in it as
   pending rows the moment it is created — which is why `createResource` now
   lands `open` rather than `draft`.

   A SINGLE FORM STILL HAS ITS OWN FACE — its audience, its share links, its Edit
   and Close — reached from the resource named on any row, from the filter, or
   from a link somebody pasted. It is a place you go to, not a tab you navigate
   past.

   NO API YET — everything is src/content/resources/*.json through store.ts.
   ============================================================================= */
import { useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  EmptyState, FilterChips, Icon, KvList, Notice, SearchField, Select, ShareLine,
  StatStrip, Table, TbTitle, qs, shareOrCopy,
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import Builder from "./Builder";
import { AnswerRow, FileChip, Meter, RowStatePill, StatePill, TagChips, TypeMark, Who } from "./bits";
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
import "./resources.css";

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
  /* A bare `#/resources/RES-01` means the tab, and the id in the path wins over
     a stale `?form=` somebody pasted after it. */
  const wanted = deepLink || p.form || "";
  const current = wanted && resourceOf(wanted) ? wanted : "";

  usePageChrome({
    crumbs: <TbTitle label="Resources" to={ROUTE} />,
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

  /* A resource in the path wins over a face — a link to one form is a link to
     that form, whatever stale `?face=` somebody left in the query behind it. */
  const face = resource ? "" : FACES.some((x) => x.k === p.face) ? p.face : "resources";

  const answers = readResponses().length;

  return (
    <div className="dls">
      {/* The strip is the two questions and nothing else. Create resource sits
          in each face's own actions band, where the enquiries list puts its
          primary action — it was here as well for one revision, which drew it
          twice on every tab. */}
      <div className="dls-chips rs-tabwrap">
        <div className="tabs rs-tabs">
          {FACES.map((x) => (
            <button key={x.k} className={face === x.k ? "on" : ""}
              onClick={() => goto({ form: undefined, res: undefined, q: undefined,
                state: undefined, face: x.k === "resources" ? undefined : x.k })}>
              <Icon name={x.icon} size="sm" />{x.label}
              {/* A number on a tab means something is WAITING. Responses carries a
                  plain count instead, because a submission that arrived is not a
                  thing anybody owes you. */}
              {x.k === "responses" && answers ? <span className="n is-quiet">{answers}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {resource ? <FormFace r={resource} p={p} onFilter={onFilter} />
        : face === "responses" ? <ResponsesFace list={list} p={p} onFilter={onFilter} />
          : <ResourcesFace list={list} p={p} onFilter={onFilter} />}
    </div>
  );
}

/* TWO QUESTIONS, IN THE ORDER THEY ARE ASKED. What forms are there, and what
   has come in. Who still owes one is a question about a FORM, and it is
   answered on that form's own face. */
const FACES = [
  { k: "resources", label: "Resources", icon: "doc" },
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
    return <span className="cell-2 rs-noshare" title={"This resource is " + r.state}>—</span>;
  }
  return (
    <button className="btn sm rs-share"
      title={"Send " + name + " the link to " + r.title}
      onClick={async (e) => {
        e.stopPropagation();
        const said = await shareOrCopy(shareLink(r.resourceId, memberId),
          r.title + " — for " + name);
        if (said) onSaid(said);
      }}>
      <Icon name="link" size="sm" />Link
    </button>
  );
}

/* ---------------------------------------------------------- resources -- */

/** WHAT FORMS EXIST, AND WHAT EACH ONE HOLDS. The count leads because it is the
 *  reason to open a row: a form with nothing in it and a form with nine answers
 *  are different objects, and the title alone does not say which is which.
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

  const held = storageOf(readResponses());
  const cells: (StatCell | "sep")[] = [
    { k: "resources", v: list.length, title: "Every form, whatever its state" },
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
          search, then the filters at whatever width their own labels need,
          then a spacer, then the one control that is not a filter. It was a
          bespoke grid here for a revision — equal tracks, the action pinned to
          the last column — which aligned to itself and to nothing else in the
          panel. A module that lays its header out its own way is a module that
          looks like a different product. */}
      <div className="dls-cmd">
        <SearchField ph="Search title, tag or department…" name="q" val={p.q}
          onFilter={onFilter} />
        <Select name="state" label="State" value={p.state} onFilter={onFilter}
          options={(["open", "draft", "closed", "outdated"] as const)
            .map((k) => ({ v: k, l: labelOf(RESOURCE_STATE, k) }))} />
        <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter}
          options={tagsInUse().map((t) => ({ v: t, l: t }))} />
        <Select name="dept" label="Goes to" value={p.dept} onFilter={onFilter}
          options={departmentsInUse().map((d) => ({ v: d, l: d }))} />
        <span className="spacer" />
        {/* Not a filter, so it sits past the spacer rather than in the run of
            them — the same slot Users gives its sort control. */}
        <button className="btn pri rs-new" onClick={() => go(ROUTE + "/new")}>
          <Icon name="plus" size="sm" />Create resource
        </button>
      </div>

      <StatStrip cells={cells} />

      <div className="dls-chips">
        <FilterChips params={{ q: p.q, state: p.state, tag: p.tag, dept: p.dept }}
          labels={{ dept: "goes to" }} onUnfilter={(n) => onFilter(n, "")} />
      </div>

      <div className="dls-body rs-pane">
        <Table
          cols={[
            { label: "Responses", cls: "n", w: "110px" },
            { label: "Resource" },
            { label: "Tags", w: "180px" },
            { label: "Goes to", w: "140px" },
            { label: "State", w: "120px" },
            { label: "", w: "150px" },
          ]}
          empty={{
            icon: "doc",
            title: p.q || p.state || p.tag || p.dept ? "Nothing matches that" : "No resources yet",
            body: p.q || p.state || p.tag || p.dept
              ? "Clear the filter to see every form."
              : "A resource is a form plus the department it goes to. Create the first one and its audience appears under Member data straight away.",
          }}
          rows={rows.map((r) => {
            const t = totalsFor(r);
            return (
              <tr key={r.resourceId} className="rs-row"
                onClick={() => go(ROUTE + qs({ face: "responses", res: r.resourceId }))}>
                <td className="n">
                  <span className="rs-count">
                    <b className="tnum">{t.submitted}</b>
                    <span className="cell-2 tnum">of {t.audience}</span>
                  </span>
                </td>
                <td>
                  <div className="rs-title">
                    <b>{r.title}</b>
                    <span className="cell-2 rs-desc">{r.description || "No description"}</span>
                  </div>
                </td>
                <td><TagChips tags={r.tags} max={3} /></td>
                <td className="cell-2">{audienceLine(r.departments)}</td>
                <td><StatePill state={r.state} /></td>
                <td className="n" onClick={(e) => e.stopPropagation()}>
                  <ResourceActions r={r} shell={shell} />
                </td>
              </tr>
            );
          })}
        />
      </div>
    </>
  );
}

/** THE ACTIONS ON A DEFINITION, in the order they are reached for. Copy link is
 *  the one anybody presses daily, so it is a button; the rest are behind More,
 *  because a row of six controls is a row nobody reads.
 *
 *  Copy link on a whole resource copies the link for the FIRST person who still
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

  /* THREE ITEMS, AND THE FOURTH ONLY WHEN IT IS A WAY BACK. Open-the-form went
     because the row already goes somewhere and a menu item that repeats a click
     is furniture; Duplicate and Close went because neither was reached. Reopen
     stays, and only appears once a resource is not open — without it Outdated
     would be a one-way door, and a form retired by mistake would need
     rebuilding. */
  const items: MenuItem[] = [
    {
      icon: "doc", label: "Edit",
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
      icon: "x", label: "Delete", tone: "dgr",
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
    <span className="rs-acts">
      <button className="btn sm" title={pending.length
        ? "Copy the link for " + pending[0].member.name
        : "Nobody is waiting to fill this in"}
        disabled={!isShareable(r) || !pending.length}
        onClick={async () => {
          const said = await shareOrCopy(shareLink(r.resourceId, pending[0].member.memberId),
            r.title + " — for " + pending[0].member.name);
          if (said) shell.toast(said, "ok");
        }}>
        <Icon name="link" size="sm" />Link
      </button>
      <MoreMenu small items={items} />
    </span>
  );
}

/** NAME THE RECORD, STATE THE CONSEQUENCE, REPEAT THE VERB. A resource with no
 *  answers is a cheap thing to lose and the dialog says so rather than dressing
 *  it up — the expensive delete is the one on a submission, and that one counts
 *  what it destroys. */
function ConfirmDeleteResource({ r }: { r: Resource }) {
  const shell = useShell();
  return (
    <>
      <div className="md-h">
        <h3>Delete “{r.title}”?</h3>
        <p>Nobody has answered it, so nothing is lost but the form itself.</p>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Keep it</button>
        <button className="btn dgr" onClick={() => {
          const res = deleteResource(r.resourceId);
          shell.closeLayer();
          if (!res.ok) shell.toast(res.message, "bad");
          else shell.toast("Deleted.", "ok");
        }}>Delete resource</button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------- responses -- */

/** EVERY SUBMISSION, ONE TABLE. Not the audience — only what has actually come
 *  in, newest first, because this tab is read to see what arrived rather than
 *  to chase what did not. Member data is the tab with rows for things that have
 *  not happened, and keeping the two apart is what stops either from being
 *  half of both.
 *
 *  THE SIZE COLUMN IS HERE BECAUSE DELETING IS. Space is the reason anybody
 *  removes a submission, so the number that justifies it is on the row, and the
 *  strip totals it. */
function ResponsesFace({ list, p, onFilter }: {
  list: Resource[]; p: Record<string, string>; onFilter: (n: string, v: string) => void;
}) {
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
      <div className="dls-cmd">
        <SearchField ph="Search member, form or answer…" name="q" val={p.q}
          onFilter={onFilter} />
        <Select name="res" label="Resource" value={p.res} onFilter={onFilter}
          options={list.map((r) => ({ v: r.resourceId, l: r.title }))} />
        <Select name="files" label="Files" value={p.files} onFilter={onFilter}
          options={[{ v: "1", l: "With an upload" }]} />
        <span className="spacer" />
        <button className="btn pri rs-new" onClick={() => go(ROUTE + "/new")}>
          <Icon name="plus" size="sm" />Create resource
        </button>
      </div>

      <StatStrip cells={cells} />

      <div className="dls-chips">
        <FilterChips params={{ q: p.q, res: p.res, files: p.files }}
          labels={{ res: picked ? picked.title : "one resource", files: "with an upload" }}
          onUnfilter={(n) => onFilter(n, "")} />
      </div>

      <div className="dls-body rs-pane">
        <Table
          cols={[
            { label: "Member" },
            { label: "Resource" },
            { label: "Submitted", w: "130px" },
            { label: "What came back" },
            { label: "Size", cls: "n", w: "90px" },
            { label: "", w: "44px" },
          ]}
          empty={{
            icon: "inbox",
            title: p.q || p.res || p.files ? "Nothing matches that" : "Nothing has come in yet",
            body: p.q || p.res || p.files
              ? "Clear the filter to see every submission."
              : "Send a link from Member data and the answer lands here.",
          }}
          rows={rows.map((x) => {
            const m = readMember(x.memberId);
            const r = resourceOf(x.resourceId);
            const kb = sizeOfResponse(x);
            return (
              <tr key={x.responseId} className="rs-row"
                onClick={() => go(ROUTE + "/" + x.responseId)}>
                <td>{m ? <Who m={m} /> : <span className="mono">{x.memberId}</span>}</td>
                <td>
                  <div className="rs-title">
                    <b>{r ? r.title : x.resourceId}</b>
                    <span className="cell-2 mono">v{x.version}</span>
                  </div>
                </td>
                <td className="tnum cell-2">{fmtDate(x.submittedAt)}</td>
                <td className="rs-peek">
                  {(() => {
                    const fs2 = x.answers.filter((a) => a.file);
                    return fs2.length
                      ? <span className="rs-files">
                          {fs2.map((a) => <FileChip key={a.fieldId} f={a.file!} />)}
                        </span>
                      : <span className="cell-2">{peek(x)}</span>;
                  })()}
                </td>
                <td className="n tnum cell-2">{kb ? fmtSize(kb) : "—"}</td>
                <td className="n"><Icon name="chevr" size="sm" /></td>
              </tr>
            );
          })}
        />
      </div>
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
    <>
      <div className="md-h">
        <h3>Delete this submission?</h3>
        <p>{m ? m.name : x.memberId} · {r.title} · {fmtDate(x.submittedAt)}</p>
      </div>
      <div className="md-b">
        <Notice tone="warn">
          <b>This cannot be undone.</b>{" "}
          {files
            ? files + (files === 1 ? " file goes with it, freeing " : " files go with it, freeing ")
              + fmtSize(kb) + ". "
            : "It holds no files, so nothing is freed. "}
          {m ? m.name.split(" ")[0] : "They"} goes back to pending on this resource, and their
          link starts working again — which is how they would send it a second time.
        </Notice>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Keep it</button>
        <button className="btn dgr" onClick={() => {
          const res = deleteResponse(x.responseId);
          shell.closeLayer();
          if (!res.ok) { shell.toast(res.message, "bad"); return; }
          shell.toast(res.value
            ? "Deleted. " + fmtSize(res.value) + " freed."
            : "Deleted.", "ok");
        }}>Delete submission</button>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- a form -- */

function FormFace({ r, p, onFilter }: {
  r: Resource; p: Record<string, string>; onFilter: (n: string, v: string) => void;
}) {
  const shell = useShell();
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
    <>
      <div className="dls-cmd">
        <SearchField ph="Search member" name="q" val={p.q} onFilter={onFilter} />
        <Select name="state" label="State" value={p.state} onFilter={onFilter}
          options={[{ v: "submitted", l: "Submitted" }, { v: "pending", l: "Pending" }]} />
        <span className="spacer" />
        <span className="rs-ver">v{r.version}</span>
        <button className="btn sm" onClick={() => go(ROUTE + "/" + r.resourceId + "/edit")}>
          <Icon name="doc" size="sm" />Edit
        </button>
        {r.state === "open"
          ? <button className="btn sm" onClick={() => act(() => closeResource(r.resourceId))}>Close</button>
          : <button className="btn pri sm" onClick={() => act(() => openResource(r.resourceId))}>
              {r.state === "draft" ? "Open it" : "Reopen"}
            </button>}
      </div>

      <StatStrip cells={cells} />

      <div className="dls-chips">
        <FilterChips params={{ q: p.q, state: p.state }}
          onUnfilter={(n) => onFilter(n, "")} />
      </div>

      <div className="dls-body rs-pane">
        <div className="rs-head">
          <div className="rs-head-t">
            <h2>{r.title}<StatePill state={r.state} /><TagChips tags={r.tags} /></h2>
            <p>{r.description}</p>
            <p className="cell-2">
              <b>Goes to:</b> {audienceLine(r.departments)}
              {uploads.length ? (
                <>{" · "}<b>Asks for:</b>{" "}
                  {uploads.map((u) => u.label + " (" + acceptLine(u.accept).toLowerCase() + ")")
                    .join(", ")}</>
              ) : null}
            </p>
          </div>
          <div className="rs-head-m">
            <Meter pct={t.pct} tone={t.pct === 100 ? "ok" : t.submitted ? "warn" : ""} />
            <span className="cell-2 tnum">{t.submitted} of {t.audience} in</span>
          </div>
        </div>

        {/* THE LINK, AS THE THING YOU CAME FOR. Per row it is one press; here it
            is the whole list, because sending five people the same form is one
            job and not five. Each is still its own link — they differ by member
            and that is what makes an answer attributable. */}
        {isShareable(r) && t.pending ? (
          <details className="rs-links">
            <summary>
              <Icon name="link" size="sm" />
              Links for the {t.pending} who have not sent anything in
            </summary>
            <div className="rs-links-b">
              <p className="cell-2">
                One link each. Send it however you already talk to them — nothing here
                emails anybody, on purpose. The page it opens is the member’s own, and
                it is <b>not built yet</b>: these links will resolve when the member
                dashboard ships.
              </p>
              {rowsFor(r).filter((x) => x.state === "pending").map((x) => (
                <div key={x.member.memberId} className="rs-link-row">
                  <span className="rs-link-n">{x.member.name}</span>
                  <ShareLine link={shareLink(r.resourceId, x.member.memberId)} />
                </div>
              ))}
            </div>
          </details>
        ) : null}

        {r.state === "draft" ? (
          <Notice tone="warn">
            <b>This is a draft.</b> Nobody can submit it yet — the audience below is who it
            would go to. Open it when the fields are right; a field can still be changed
            afterwards, and changing one after somebody has answered makes a new version
            rather than rewriting their answer.
          </Notice>
        ) : null}

        <Table
          cols={[
            { label: "Member" },
            { label: "State", w: "130px" },
            { label: "Submitted", w: "130px" },
            { label: uploads.length ? "Files" : "Answers" },
            { label: "Share", w: "90px" },
            { label: "", w: "44px" },
          ]}
          empty={{
            icon: "users",
            title: p.q || p.state ? "Nothing matches that" : "Nobody matches this condition",
            body: p.q || p.state
              ? "Clear the filter to see the whole audience."
              : audienceLine(r.departments)
                + " matches nobody on the roster today. It will pick people up as they join.",
          }}
          rows={rows.map((x) => (
            <tr key={x.member.memberId}
              className={"rs-row" + (x.response ? "" : " is-pending")}
              onClick={() => x.response
                ? shell.modal(<ResponseSheet r={r} x={x.response} />)
                : go("#/team/" + x.member.memberId)}>
              <td><Who m={x.member} /></td>
              <td><RowStatePill state={x.state} /></td>
              <td className="tnum cell-2">
                {x.response ? fmtDate(x.response.submittedAt) : "—"}
              </td>
              <td className="rs-peek">
                {x.response
                  ? (() => {
                    /* The files themselves where there are any — a row about a PAN
                       card should let you open the PAN card. */
                    const fs2 = x.response.answers.filter((a) => a.file);
                    return fs2.length
                      ? <span className="rs-files">
                          {fs2.map((a) => <FileChip key={a.fieldId} f={a.file!} />)}
                        </span>
                      : <span className="cell-2">{peek(x.response)}</span>;
                  })()
                  : <span className="cell-2">nothing yet</span>}
              </td>
              <td>
                {x.response
                  ? <span className="cell-2 rs-noshare">in</span>
                  : <ShareCell r={r} memberId={x.member.memberId} name={x.member.name}
                      onSaid={(m) => shell.toast(m, "ok")} />}
              </td>
              <td className="n"><Icon name="chevr" size="sm" /></td>
            </tr>
          ))}
        />

        {stray.length ? (
          <>
            <Notice tone="info" ico="alert">
              <b>{stray.length} answer{stray.length > 1 ? "s" : ""} from outside the audience.</b>{" "}
              Somebody answered and then stopped matching the rule — the condition changed, or
              they left. The answers are kept and listed here; they are out of the count above
              so “complete” still means the people it is asking about today.
            </Notice>
            <Table
              cols={[{ label: "Member" }, { label: "Submitted", w: "130px" },
                { label: "What came back" }]}
              rows={stray.map((s) => {
                const m = readMember(s.memberId);
                return (
                  <tr key={s.responseId} className="rs-row"
                    onClick={() => shell.modal(<ResponseSheet r={r} x={s} />)}>
                    <td>{m ? <Who m={m} /> : <span className="mono">{s.memberId}</span>}</td>
                    <td className="tnum cell-2">{fmtDate(s.submittedAt)}</td>
                    <td className="cell-2 rs-peek">{peek(s)}</td>
                  </tr>
                );
              })}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

/** The first two answers that actually carry a value, so a row says something
 *  without the reader opening it. Never every answer — a table cell that wraps
 *  to six lines has stopped being a table. */
function peek(x: ResourceResponse): string {
  const said = x.answers.filter((a) => String(a.value || "").trim());
  if (!said.length) return "submitted, all blank";
  /* FILES FIRST. When a resource asks for a PAN card and a territory, the
     question a reader has is whether the card came in — so the files lead, and
     the typed answers fill whatever room is left. */
  const files = said.filter((a) => a.file);
  const rest = said.filter((a) => !a.file);
  const shown = files.concat(rest);
  const n = files.length ? 1 : 2;
  return shown.slice(0, n).map((a) => a.value).join(" · ")
    + (shown.length > n ? " +" + (shown.length - n) : "");
}

/* ------------------------------------------------------- one submission -- */

/** A SUBMISSION IS A PLACE, not a layer over a list. It has its own address, so
 *  it can be sent to whoever has to look at it; its own crumb, so the way back
 *  is the module and not "close"; and room for the answers to be read rather
 *  than skimmed — a modal sized for a table row is the wrong shape for eight
 *  fields and three files.
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
    crumbs: (
      <>
        <TbTitle label="Resources" to={ROUTE} />
        <span className="tb-sep">/</span>
        <span className="tb-title is-here">{r ? r.title : "Submission"}</span>
      </>
    ),
    parent: x ? ROUTE + qs({ face: "responses", res: x.resourceId }) : ROUTE,
  }, responseId);

  if (!x || !r) {
    return (
      <div className="page">
        <EmptyState icon="search" title="No such submission"
          body="It may have been deleted to free space, or the link is stale."
          action={
            <button className="btn pri"
              onClick={() => go(ROUTE + qs({ face: "responses" }))}>
              Back to Responses
            </button>} />
      </div>
    );
  }

  const m = readMember(x.memberId);
  const stale = x.version !== r.version;
  const kb = sizeOfResponse(x);
  const files = x.answers.filter((a) => a.file);
  const said = x.answers.filter((a) => !a.file);

  return (
    <div className="page rs-resp">
      <header className="rs-bh">
        <div className="rs-bh-t">
          <span className="rs-eyebrow">Submission</span>
          <h1>{r.title}</h1>
          <p>
            {m ? m.name : x.memberId}
            {m ? " · " + m.designation : ""}
            {" · "}{fmtDate(x.submittedAt)}
            {" · "}<span className="mono">v{x.version}</span>
          </p>
        </div>
        <div className="rs-bh-a">
          {m ? (
            <button className="btn" onClick={() => go("#/team/" + m.memberId + "/resources")}>
              <Icon name="user" size="sm" />{m.name.split(" ")[0]}’s record
            </button>
          ) : null}
          <button className="btn dgr"
            title={kb ? "Frees " + fmtSize(kb) : "It holds no files"}
            onClick={() => shell.modal(<ConfirmDeleteResponse r={r} x={x} />)}>
            <Icon name="x" size="sm" />Delete
          </button>
        </div>
      </header>

      {stale ? (
        <Notice tone="info">
          Answered on <b>version {x.version}</b>; this resource is on v{r.version} now. Every
          label below is the one that was on screen when it was filled in, not today’s.
        </Notice>
      ) : null}

      <div className="rs-resp-cols">
        <div className="rs-col">
          {/* FILES FIRST WHEN THERE ARE ANY. The question anybody opens a
              submission with is whether the document arrived; the typed answers
              are the context around it. */}
          {files.length ? (
            <section className="rs-sec">
              <div className="rs-sec-r">
                <h2 className="rs-sec-h">Files</h2>
                <span className="rs-sec-n">
                  {files.length} · {fmtSize(kb)}
                </span>
              </div>
              <div className="rs-card rs-filelist">
                {files.map((a) => (
                  <div key={a.fieldId} className="rs-filerow">
                    <span className="rs-filerow-k">{a.label}</span>
                    <FileChip f={a.file!} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rs-sec">
            <div className="rs-sec-r">
              <h2 className="rs-sec-h">Answers</h2>
              <span className="rs-sec-n">
                {x.answers.length} {x.answers.length === 1 ? "field" : "fields"}
              </span>
            </div>
            <div className="rs-card">
              {said.length
                ? said.map((a) => <AnswerRow key={a.fieldId} a={a} />)
                : <span className="cell-2">Every field on this form was an upload.</span>}
            </div>
          </section>
        </div>

        <aside className="rs-col rs-side">
          <div className="rs-sticky">
            <div className="rs-sheet-h">
              <span className="rs-eyebrow">The form</span>
            </div>
            <div className="rs-card">
              <KvList pairs={[
                ["Resource", <button key="r" className="lnk"
                  onClick={() => go(ROUTE + qs({ form: r.resourceId }))}>{r.title}</button>],
                ["State", <StatePill key="s" state={r.state} />],
                ["Tags", r.tags.length ? <TagChips key="t" tags={r.tags} /> : "—"],
                ["Goes to", audienceLine(r.departments)],
                ["Answered on", "Version " + x.version],
                ["Held in files", kb ? fmtSize(kb) : "—"],
              ]} />
            </div>
            <p className="cell-2 rs-note">
              <Icon name="lock" size="sm" /> A submitted answer cannot be edited. If it is
              wrong, delete it — {m ? m.name.split(" ")[0] : "the member"} goes back to
              pending and their link starts working again.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ one submission -- */

/** READ-ONLY, ALWAYS. A response is what somebody said; correcting it here would
 *  make it a record of what an admin wishes they had said. If it is wrong, the
 *  answer is a new submission, and the old one stays visible. */
export function ResponseSheet({ r, x }: { r: Resource; x: ResourceResponse }) {
  const shell = useShell();
  const m = readMember(x.memberId);
  const stale = x.version !== r.version;
  const kb = sizeOfResponse(x);
  return (
    <div className="rs-sheet">
      <div className="md-h">
        <h3>{r.title}</h3>
        <p>
          {m ? m.name : x.memberId} · submitted {fmtDate(x.submittedAt)}
          {" · "}<span className="mono">v{x.version}</span>
        </p>
      </div>
      <div className="md-b">
        {stale ? (
          <Notice tone="info">
            Answered on <b>version {x.version}</b>; this resource is on v{r.version} now. The
            labels below are the ones that were on screen when it was filled in, not today’s.
          </Notice>
        ) : null}
        {x.answers.map((a) => <AnswerRow key={a.fieldId} a={a} />)}
      </div>
      <div className="md-f">
        {/* EDIT IS ABSENT, NOT DISABLED. A submitted answer is what somebody said;
            correcting it here would make it a record of what an admin wishes they
            had said. Delete is the only write, and it is the space one. */}
        <span className="cell-2">
          <Icon name="lock" size="sm" /> Cannot be edited{kb ? " · " + fmtSize(kb) + " in files" : ""}
        </span>
        <span className="spacer" />
        {m ? (
          <button className="btn sm" onClick={() => go("#/team/" + m.memberId + "/resources")}>
            Open {m.name.split(" ")[0]}’s record
          </button>
        ) : null}
        <button className="btn sm dgr"
          title={kb ? "Frees " + fmtSize(kb) : "It holds no files"}
          onClick={() => shell.modal(<ConfirmDeleteResponse r={r} x={x} />)}>
          <Icon name="x" size="sm" />Delete
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ preview --- */

/** The form as the member will meet it. Used by the builder, and exported here
 *  because it is the only honest description of what a definition means. */
export function FormPreview({ r }: { r: Pick<Resource, "title" | "description" | "fields"> }) {
  if (!r.fields.length) {
    return (
      <EmptyState icon="doc" title="No fields yet"
        body="Add the first one on the left and it appears here, exactly as the member will see it." />
    );
  }
  return (
    <div className="rs-preview">
      <h4>{r.title || "Untitled resource"}</h4>
      {r.description ? <p className="cell-2">{r.description}</p> : null}
      {r.fields.map((f) => (
        <div key={f.fieldId} className="fg">
          <label>
            {f.label || <i className="rs-unnamed">unnamed field</i>}
            {f.required ? <> <span className="req">*</span></> : null}
          </label>
          {f.type === "textarea"
            ? <textarea className="inp" rows={3} disabled />
            : f.type === "select"
              ? <select className="inp" disabled>
                  {f.options.map((o, i) => <option key={i}>{o}</option>)}
                </select>
              : f.type === "checkbox"
                ? <label className="rs-check"><input type="checkbox" disabled /> Yes</label>
                : f.type === "file"
                  ? <div className="rs-file">
                      <Icon name="download" size="sm" />
                      Choose a file
                      <span className="rs-file-a">
                        {acceptLine(f.accept)}
                        {f.maxMb ? " · up to " + f.maxMb + " MB" : ""}
                      </span>
                    </div>
                  : <input className="inp" type={f.type === "number" ? "number" : f.type} disabled />}
          {f.help ? <div className="help">{f.help}</div> : null}
        </div>
      ))}
    </div>
  );
}

export { TypeMark };
