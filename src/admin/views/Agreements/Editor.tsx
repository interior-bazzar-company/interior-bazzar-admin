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
import {
  Alert, Button, Card, EmptyState, FormField, FormSection, IconButton, Input, PageHeader,
  SectionHead, SelectInput, TbTitle, Textarea,
} from "../../ui";
import { go } from "../../ui/nav";
import { Sheet } from "./index";
import {
  AGREEMENT_KIND, createTemplate, emptyClause, labelOf, readMembers, renderBody,
  sentFrom, templateOf, updateTemplate, TODAY_PLACEHOLDER,
} from "./store";
import type { Clause } from "./store";

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
        <span aria-hidden="true" className="text-quaternary">/</span>
        <span className="truncate text-sm font-semibold text-primary">{existing ? "Edit" : "New template"}</span>
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
      <EmptyState icon="search" title="No such template"
        body="It may have been deleted, or the link is stale."
        action={<Button color="primary" onClick={() => go(ROUTE)}>Back to Agreements</Button>} />
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
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow={existing ? "Editing" : "New template"}
        title={existing ? existing.title : title || "Untitled document"}
        back={{ label: "Agreements", to: ROUTE }}
        meta={existing
          ? "Version " + existing.version + " · sent " + out + (out === 1 ? " time" : " times")
          : "It is saved as a draft. Put it in use when the wording is right, then send it."}
        actions={<>
          <Button color="secondary" onClick={() => go(ROUTE)}>Cancel</Button>
          <Button color="primary" onClick={save}>
            {existing ? "Save changes" : "Create template"}
          </Button>
        </>} />

      {out > 0 && changed ? (
        <Alert tone="warn" ico="alert"
          title={"This becomes version " + (existing ? existing.version + 1 : 2) + "."}>
          {out} {out === 1 ? "copy has" : "copies have"} already gone out, and those keep the
          wording they were sent with. A signature over a body that can still change is not a
          signature — nothing already signed is touched by this.
        </Alert>
      ) : null}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex min-w-0 flex-col gap-3">
            <SectionHead title="Details" />
            <Card>
              <FormSection>
                <FormField id="ag-title" label="Title" req
                  hint="What the member sees at the top of the document.">
                  <Input id="ag-title" value={title} ph="NDA · 2026" onChange={setTitle} />
                </FormField>
                <FormField id="ag-purpose" label="Purpose"
                  hint="One line, for the list. Who it is for and why.">
                  <Input id="ag-purpose" value={purpose} onChange={setPurpose}
                    ph="Confidentiality, for everyone with access to client work." />
                </FormField>
                <FormField id="ag-kind" label="Kind">
                  <SelectInput id="ag-kind" value={kind} onChange={(v) => setKind(v || "custom")}
                    options={Object.keys(AGREEMENT_KIND)
                      .map((k) => ({ v: k, l: labelOf(AGREEMENT_KIND, k) }))} />
                </FormField>
              </FormSection>
            </Card>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <SectionHead
              title="Clauses"
              desc={clauses.length + (clauses.length === 1 ? " clause" : " clauses")}
              right={<Button size="xs" color="secondary" ico="plus" onClick={add}>Add clause</Button>} />

            <Alert tone="info" ico="sparkle" title="Two placeholders are filled in on send.">
              Type <b>{"{{name}}"}</b> or <b>{"{{date}}"}</b> anywhere and they are filled in when
              the document is sent. Anything else in braces is left exactly as you typed it.
            </Alert>

            {clauses.length ? (
              /* THE NUMBER IS THE CLAUSE’S IDENTITY — it is how a signed document
                 refers to itself, so it is drawn rather than implied by order. */
              <ol className="flex flex-col gap-3">
                {clauses.map((c, i) => (
                  <li key={c.clauseId} className="flex min-w-0 gap-3">
                    <span aria-hidden="true"
                      className="label-mono mt-2.5 w-5 shrink-0 text-right">{i + 1}</span>
                    <Card tight className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Input className="min-w-0 flex-1" value={c.heading}
                            ph="Heading — optional"
                            ariaLabel={"Clause " + (i + 1) + " heading"}
                            onChange={(v) => setClause(i, { heading: v })} />
                          <IconButton ico="chev" size="xs" label={"Move clause " + (i + 1) + " up"}
                            isDisabled={i === 0} onClick={() => move(i, -1)} />
                          <IconButton ico="chevr" size="xs" label={"Move clause " + (i + 1) + " down"}
                            isDisabled={i === clauses.length - 1} onClick={() => move(i, 1)} />
                          <IconButton ico="x" size="xs" label={"Remove clause " + (i + 1)}
                            onClick={() => setClauses(clauses.filter((_, n) => n !== i))} />
                        </div>
                        <Textarea rows={4} value={c.text}
                          ph="The wording of this clause, as the member will read it."
                          ariaLabel={"Clause " + (i + 1) + " text"}
                          onChange={(v) => setClause(i, { text: v })} />
                      </div>
                    </Card>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon="doc" title="No clauses yet"
                body="There is nothing to sign until the document says something."
                action={<Button color="primary" onClick={add}>Write the first clause</Button>} />
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label-mono">What they read</span>
            <span className="text-xs text-tertiary">filled in for {sample}</span>
          </div>
          <Sheet title={title || "Untitled document"} clauses={preview}>
            {/* The line the member signs on, shown empty. The preview IS the
                document, so the space for the signature belongs in it. */}
            <div className="mt-6 flex flex-col gap-1">
              <div aria-hidden="true" className="h-8 w-56 border-b border-neutral-400" />
              <span className="text-xs text-neutral-500">The member types their full name here.</span>
            </div>
          </Sheet>
        </aside>
      </div>
    </div>
  );
}
