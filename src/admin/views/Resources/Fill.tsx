/* =============================================================================
   Resources · Fill — the member's end of the link, standing in for the dashboard
   -----------------------------------------------------------------------------
   `submitResponse` was built, tested, and called from nowhere: a member's share
   link resolved to nothing, so this half of the module could not be shown at
   all. This is the same stand-in the sign dialog is for agreements — the admin,
   viewing their own record, answers as themselves. The RULES stay in the store:
   required fields, one submission per person, the size cap. This renders the
   seven field types and mirrors "required" only so the button can say so early.

   IT IS THE FORM, NOT A PICTURE OF ONE. Every control is the panel's real
   control for that kind of answer — the same Input, SelectInput, Checkbox,
   DateInput and FileUpload every other form in the admin uses — so a member's
   half of the product is built out of the product rather than beside it.

   A FILE IS NOT UPLOADED. It becomes an object URL in this tab and nothing
   else, and the dialog says so — an identity document must never be put on a
   public URL by this panel, and there is no private store to put it in yet.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import {
  Alert, Button, Checkbox, DateInput, FileUpload, FormField, FormSection, IconButton, Input,
  ModalShell, SelectInput, Textarea,
} from "../../ui";
import { useShell } from "../../shell/ShellContext";
import { FileChip } from "./bits";
import { acceptAttr, acceptLine, answered, submitResponse } from "./store";
import type { FileAnswer, Resource, ResourceField } from "./store";

export function FillModal({ r, memberId }: { r: Resource; memberId: string }) {
  const shell = useShell();
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, FileAnswer>>({});
  const set = (id: string, v: string) => setValues((o) => ({ ...o, [id]: v }));
  /* An object URL lives until it is revoked. Replacing or clearing a pick
     revokes the old one; leaving the dialog revokes every one that was not
     handed to the store — those it keeps, because the record points at them. */
  const latest = useRef(files);
  useEffect(() => { latest.current = files; }, [files]);
  const kept = useRef(false);
  useEffect(() => () => {
    if (!kept.current) Object.values(latest.current).forEach((a) => URL.revokeObjectURL(a.url));
  }, []);
  const pick = (f: ResourceField, file: File | null) => setFiles((o) => {
    const next = { ...o };
    if (next[f.fieldId]) URL.revokeObjectURL(next[f.fieldId].url);
    if (!file) { delete next[f.fieldId]; return next; }
    next[f.fieldId] = {
      fileName: file.name, mimeType: file.type || "application/octet-stream",
      sizeKb: Math.ceil(file.size / 1024), url: URL.createObjectURL(file),
    };
    return next;
  });
  /* The store's own `answered`, so the button and the refusal cannot disagree. */
  const missing = r.fields.filter((f) => f.required && !answered(f, values, files)).length;
  const save = () => {
    const x = submitResponse(r.resourceId, memberId, values, files);
    if (!x.ok) { shell.toast(x.message, "bad"); return; }
    kept.current = true;
    shell.closeLayer();
    shell.toast("Submitted. It is on your record.");
  };

  const control = (f: ResourceField) => {
    const id = "rf-" + f.fieldId;
    const v = values[f.fieldId] || "";
    switch (f.type) {
      case "textarea":
        return <Textarea id={id} rows={3} value={v} onChange={(t) => set(f.fieldId, t)} />;
      case "number":
        return <Input id={id} type="number" value={v} onChange={(t) => set(f.fieldId, t)} />;
      case "date":
        return <DateInput id={id} value={v} onChange={(t) => set(f.fieldId, t)} />;
      case "select":
        return (
          <SelectInput id={id} value={v} ph="Choose…" options={f.options}
            onChange={(t) => set(f.fieldId, t)} />
        );
      case "checkbox":
        return (
          <Checkbox id={id} label="Yes" checked={v === "Yes"}
            onChange={(on) => set(f.fieldId, on ? "Yes" : "")} />
        );
      case "file": {
        const got = files[f.fieldId];
        return got ? (
          <div className="flex flex-wrap items-center gap-2">
            <FileChip f={got} />
            <IconButton size="xs" ico="x" label={"Remove " + got.fileName}
              onClick={() => pick(f, null)} />
          </div>
        ) : (
          <FileUpload id={id} accept={acceptAttr(f.accept)}
            hint={acceptLine(f.accept) + (f.maxMb !== null ? " · up to " + f.maxMb + " MB" : "")}
            onFiles={(list) => pick(f, list[0] || null)} />
        );
      }
      default:
        return <Input id={id} value={v} onChange={(t) => set(f.fieldId, t)} />;
    }
  };

  return (
    <ModalShell
      title={r.title}
      sub={r.description || undefined}
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button color="primary" isDisabled={missing > 0} onClick={save}
            aria-label={missing
              ? missing + " required field" + (missing === 1 ? "" : "s") + " still empty"
              : undefined}>
            Submit
          </Button>
        </>
      }>
      <FormSection>
        {r.fields.some((f) => f.type === "file") ? (
          <Alert tone="info" ico="lock" title="Nothing is uploaded.">
            A file you pick stays in this browser tab. Nothing leaves it until private storage
            is decided — this panel never puts a document on a public address.
          </Alert>
        ) : null}

        {/* `hintInline`: the help below is the form author's own, written for
            the person answering. They are filling this in once and have no
            reason to suspect an i hides the sentence that tells them how. */}
        {r.fields.map((f) => (
          <FormField key={f.fieldId} id={"rf-" + f.fieldId} hintInline
            label={f.type === "checkbox" ? undefined : f.label}
            req={f.type === "checkbox" ? undefined : f.required}
            hint={f.type === "file" ? undefined : f.help || undefined}>
            {/* A CHECKBOX CARRIES ITS OWN LABEL, beside the box where the eye
                expects it, so the question is not printed twice. */}
            {f.type === "checkbox" ? (
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-sm font-medium text-secondary">
                  {f.label}
                  {f.required ? <span className="text-brand-tertiary" title="Required">*</span> : null}
                </span>
                {control(f)}
              </div>
            ) : control(f)}
          </FormField>
        ))}

        <p className="text-xs text-tertiary">
          Answered on v{r.version}. Once submitted it cannot be edited, so read it back
          before you send.
          {missing
            ? " " + missing + " required field" + (missing === 1 ? " is" : "s are") + " still empty."
            : ""}
        </p>
      </FormSection>
    </ModalShell>
  );
}
