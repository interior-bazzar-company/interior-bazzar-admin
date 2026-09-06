/* =============================================================================
   The template editor — #/agreements/new and #/agreements/:id/edit
   -----------------------------------------------------------------------------
   YOU ARE WRITING A DOCUMENT, so the page is shaped like one being written:
   the clauses on the left at the width you type them, the deed on the right at
   the width somebody reads it. The preview is not decoration — a clause list
   reads as configuration, and the thing being written is a page a person
   outside the company has to understand end to end.

   THE PREVIEW SHOWS IT FILLED IN. `{{name}}` and `{{date}}` resolve against a
   real member from the roster, because a document that reads correctly with the
   braces in it can still read badly with a name in it — "Dear {{name}}," and
   "Dear Priya Iyer," are different sentences, and only one of them ships.

   NOTHING SAVES UNTIL SAVE. One call, on leaving; a builder that wrote through
   on every keystroke would version a document a hundred times.
   ============================================================================= */
import { useMemo, useState } from "react";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { EmptyState, Icon, Notice, Select, TbTitle } from "../../ui";
import { go } from "../../ui/nav";
import { Sheet } from "./index";
import {
  AGREEMENT_KIND, createTemplate, emptyClause, labelOf, readMembers, renderBody,
  sentFrom, templateOf, updateTemplate, TODAY_PLACEHOLDER,
} from "./store";
import type { Clause } from "./store";
import "./agreements.css";

const ROUTE = "#/agreements";

export default function Editor({ mode, templateId }: {
  mode: "create" | "edit"; templateId?: string;
}) {
  const shell = useShell();
  const existing = mode === "edit" && templateId ? templateOf(templateId) : null;

  const [title, setTitle] = useState(existing ? existing.title : "");
  const [kind, setKind] = useState(existing ? existing.kind : "custom");
  const [purpose, setPurpose] = useState(existing ? existing.purpose : "");
  const [clauses, setClauses] = useState<Clause[]>(
    existing ? JSON.parse(JSON.stringify(existing.clauses)) as Clause[] : [emptyClause()]);

  usePageChrome({
    crumbs: (
      <>
        <TbTitle label="Agreements" to={ROUTE} />
        <span className="tb-sep">/</span>
        <span className="tb-title is-here">{existing ? "Edit" : "New template"}</span>
      </>
    ),
    parent: ROUTE,
  }, templateId || "new");

  /* A real name, so the preview shows the sentence that ships rather than the
     one with braces in it. */
  const sample = useMemo(() => {
    const m = readMembers().filter((x) => x.status === "active")[0];
    return m ? m.name : "the member";
  }, []);
  const preview = useMemo(() => renderBody(clauses, sample, TODAY_PLACEHOLDER),
    [clauses, sample]);

  if (mode === "edit" && !existing) {
    return (
      <div className="page">
        <EmptyState icon="search" title="No such template"
          body="It may have been deleted, or the link is stale."
          action={<button className="btn pri" onClick={() => go(ROUTE)}>Back to Agreements</button>} />
      </div>
    );
  }

  const out = existing ? sentFrom(existing.templateId).length : 0;
  const changed = !!existing
    && JSON.stringify(existing.clauses) !== JSON.stringify(clauses);

  const setClause = (i: number, patch: Partial<Clause>) =>
    setClauses(clauses.map((c, n) => (n === i ? { ...c, ...patch } : c)));

  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= clauses.length) return;
    const next = clauses.slice();
    const t = next[i];
    next[i] = next[j];
    next[j] = t;
    setClauses(next);
  };

  const add = () => setClauses(clauses.concat([emptyClause()]));

  const save = () => {
    const draft = { title, kind, purpose, clauses };
    const r = existing ? updateTemplate(existing.templateId, draft) : createTemplate(draft);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast(existing ? "Changes saved." : "Template created as a draft.", "ok");
    go(ROUTE);
  };

  return (
    <div className="page wide ag-editor">
      <header className="ag-bh">
        <div className="ag-bh-t">
          <span className="ag-eyebrow">{existing ? "Editing" : "New template"}</span>
          <h1>{existing ? existing.title : title || "Untitled document"}</h1>
          <p>
            {existing
              ? "Version " + existing.version + " · sent " + out
                + (out === 1 ? " time" : " times")
              : "It is saved as a draft. Put it in use when the wording is right, then send it."}
          </p>
        </div>
        <div className="ag-bh-a">
          <button className="btn" onClick={() => go(ROUTE)}>Cancel</button>
          <button className="btn pri lg" onClick={save}>
            {existing ? "Save changes" : "Create template"}
          </button>
        </div>
      </header>

      {out > 0 && changed ? (
        <Notice tone="warn">
          <b>This becomes version {existing ? existing.version + 1 : 2}.</b>{" "}
          {out} {out === 1 ? "copy has" : "copies have"} already gone out, and those keep the
          wording they were sent with. A signature over a body that can still change is not a
          signature — nothing already signed is touched by this.
        </Notice>
      ) : null}

      <div className="ag-cols">
        <div className="ag-col">
          <section className="ag-sec">
            <h2 className="ag-sec-h">Details</h2>
            <div className="ag-card">
              <div className="fg">
                <label htmlFor="ag-title">Title <span className="req">*</span></label>
                <input className="inp" id="ag-title" value={title}
                  placeholder="NDA · 2026"
                  onChange={(e) => setTitle(e.target.value)} />
                <div className="help">What the member sees at the top of the document.</div>
              </div>
              <div className="fg">
                <label htmlFor="ag-purpose">Purpose</label>
                <input className="inp" id="ag-purpose" value={purpose}
                  placeholder="Confidentiality, for everyone with access to client work."
                  onChange={(e) => setPurpose(e.target.value)} />
                <div className="help">One line, for the list. Who it is for and why.</div>
              </div>
              <Select name="kind" label="Kind" value={kind}
                onFilter={(_n, v) => setKind(v || "custom")}
                options={Object.keys(AGREEMENT_KIND)
                  .map((k) => ({ v: k, l: labelOf(AGREEMENT_KIND, k) }))} />
            </div>
          </section>

          <section className="ag-sec">
            <div className="ag-sec-r">
              <h2 className="ag-sec-h">Clauses</h2>
              <span className="ag-sec-n">
                {clauses.length} {clauses.length === 1 ? "clause" : "clauses"}
              </span>
              <span className="spacer" />
              <button className="btn sm" onClick={add}>
                <Icon name="plus" size="sm" />Add clause
              </button>
            </div>

            <Notice tone="info" ico="sparkle">
              Type <b>{"{{name}}"}</b> or <b>{"{{date}}"}</b> anywhere and they are filled in when
              the document is sent. Anything else in braces is left exactly as you typed it.
            </Notice>

            {clauses.length ? (
              <ol className="ag-clauses">
                {clauses.map((c, i) => (
                  <li key={c.clauseId} className="ag-cl">
                    <span className="ag-cl-n" aria-hidden="true">{i + 1}</span>
                    <div className="ag-cl-b">
                      <div className="ag-cl-h">
                        <input className="inp ag-cl-head" value={c.heading}
                          placeholder="Heading — optional"
                          aria-label={"Clause " + (i + 1) + " heading"}
                          onChange={(e) => setClause(i, { heading: e.target.value })} />
                        <button className="btn icon sm" title="Move up"
                          aria-label={"Move clause " + (i + 1) + " up"}
                          disabled={i === 0} onClick={() => move(i, -1)}>
                          <Icon name="chev" size="sm" /></button>
                        <button className="btn icon sm" title="Move down"
                          aria-label={"Move clause " + (i + 1) + " down"}
                          disabled={i === clauses.length - 1} onClick={() => move(i, 1)}>
                          <Icon name="chevr" size="sm" /></button>
                        <button className="btn icon sm dgr" title="Remove"
                          aria-label={"Remove clause " + (i + 1)}
                          onClick={() => setClauses(clauses.filter((_, n) => n !== i))}>
                          <Icon name="x" size="sm" /></button>
                      </div>
                      <textarea className="inp ag-cl-text" rows={4} value={c.text}
                        placeholder="The wording of this clause, as the member will read it."
                        aria-label={"Clause " + (i + 1) + " text"}
                        onChange={(e) => setClause(i, { text: e.target.value })} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="ag-card">
                <EmptyState icon="doc" title="No clauses yet"
                  body="There is nothing to sign until the document says something."
                  action={<button className="btn pri" onClick={add}>Write the first clause</button>} />
              </div>
            )}
          </section>
        </div>

        <aside className="ag-col ag-side">
          <div className="ag-sticky">
            <div className="ag-sheet-h">
              <span className="ag-eyebrow">What they read</span>
              <span className="cell-2">filled in for {sample}</span>
            </div>
            <Sheet title={title || "Untitled document"} clauses={preview}>
              <div className="ag-sig">
                <div className="ag-sig-l" aria-hidden="true" />
                <span className="cell-2">The member types their full name here.</span>
              </div>
            </Sheet>
          </div>
        </aside>
      </div>
    </div>
  );
}
