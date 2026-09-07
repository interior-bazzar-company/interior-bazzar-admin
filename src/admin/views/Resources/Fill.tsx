/* =============================================================================
   Resources · Fill — the member's end of the link, standing in for the dashboard
   -----------------------------------------------------------------------------
   `submitResponse` was built, tested, and called from nowhere: a member's share
   link resolved to nothing, so this half of the module could not be shown at
   all. This is the same stand-in the sign dialog is for agreements — the admin,
   viewing their own record, answers as themselves. The RULES stay in the store:
   required fields, one submission per person, the size cap. This renders the
   seven field types and mirrors "required" only so the button can say so early.

   A FILE IS NOT UPLOADED. It becomes an object URL in this tab and nothing
   else, and the dialog says so — an identity document must never be put on a
   public URL by this panel, and there is no private store to put it in yet.
   ============================================================================= */
import { useState } from "react";
import { Icon, Notice } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import { acceptAttr, acceptLine, submitResponse } from "./store";
import type { FileAnswer, Resource, ResourceField } from "./store";

export function FillModal({ r, memberId }: { r: Resource; memberId: string }) {
  const shell = useShell();
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, FileAnswer>>({});
  const set = (id: string, v: string) => setValues((o) => ({ ...o, [id]: v }));
  const pick = (f: ResourceField, file: File | null) => setFiles((o) => {
    const next = { ...o };
    if (!file) { delete next[f.fieldId]; return next; }
    next[f.fieldId] = {
      fileName: file.name, mimeType: file.type || "application/octet-stream",
      sizeKb: Math.ceil(file.size / 1024), url: URL.createObjectURL(file),
    };
    return next;
  });
  /* The store's own definition of "answered", so the button and the refusal
     cannot disagree about which fields are still empty. */
  const given = (f: ResourceField) => f.type === "file" ? !!files[f.fieldId] : !!(values[f.fieldId] || "").trim();
  const missing = r.fields.filter((f) => f.required && !given(f)).length;
  const save = () => {
    const x = submitResponse(r.resourceId, memberId, values, files);
    if (!x.ok) { shell.toast(x.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Submitted. It is on your record.");
  };
  const control = (f: ResourceField) => {
    const id = "rf-" + f.fieldId;
    const v = values[f.fieldId] || "";
    switch (f.type) {
      case "textarea": return <textarea id={id} className="inp" rows={3} value={v} onChange={(e) => set(f.fieldId, e.target.value)} />;
      case "number": return <input id={id} type="number" className="inp" value={v} onChange={(e) => set(f.fieldId, e.target.value)} />;
      case "date": return <input id={id} type="date" className="inp" value={v} onChange={(e) => set(f.fieldId, e.target.value)} />;
      case "select": return (
        <select id={id} className="inp" value={v} onChange={(e) => set(f.fieldId, e.target.value)}>
          <option value="">Choose…</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>);
      case "checkbox": return (
        <label className="check" htmlFor={id}>
          <input id={id} type="checkbox" checked={v === "Yes"} onChange={(e) => set(f.fieldId, e.target.checked ? "Yes" : "")} />
          <span></span>Yes
        </label>);
      case "file": return (
        <>
          <input id={id} type="file" className="inp" accept={acceptAttr(f.accept)}
            onChange={(e) => pick(f, e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          <span className="help">{acceptLine(f.accept)}{f.maxMb !== null ? " · up to " + f.maxMb + " MB" : ""}</span>
        </>);
      default: return <input id={id} className="inp" value={v} onChange={(e) => set(f.fieldId, e.target.value)} />;
    }
  };
  return (
    <>
      <div className="md-h">
        <h3>{r.title}</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}><Icon name="x" size="sm" /></button>
      </div>
      <div className="md-b">
        {r.description ? <p className="cell-2">{r.description}</p> : null}
        {r.fields.some((f) => f.type === "file") ? (
          <Notice ico="lock" text="A file you pick stays in this browser tab. Nothing is uploaded until private storage is decided — this panel never puts a document on a public address." />
        ) : null}
        {r.fields.map((f) => (
          <div className="fg" key={f.fieldId}>
            <label htmlFor={"rf-" + f.fieldId}>{f.label}{f.required ? <b className="req"> *</b> : null}</label>
            {control(f)}
            {f.help && f.type !== "file" ? <span className="help">{f.help}</span> : null}
          </div>
        ))}
        <p className="tm-foot">Answered on v{r.version}. Once submitted it cannot be edited, so read it back before you send.</p>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={missing > 0} onClick={save}
          title={missing ? missing + " required field" + (missing === 1 ? "" : "s") + " still empty" : undefined}>Submit</button>
      </div>
    </>
  );
}
