/* =============================================================================
   CMS · the editor's inputs
   -----------------------------------------------------------------------------
   One `FieldInput` draws any field a resource spec names, from the panel's own
   kit. Two inputs are CMS-only: `RichText` (Quill — blogs and legal pages are
   stored as QuillField {delta, html} and the site reads the html) and
   `ImageField` (a URL, or a file pushed straight to S3 with a presigned PUT).
   `PreviewCanvas` is the frame every live preview sits in, with the Desktop /
   Mobile switch the CMS docs ask for.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { CommonService } from "../../../api/modules/common";
import {
  Button, ChipInput, FormField, IconButton, Input, Segmented, SelectInput, Textarea, Toggle,
} from "../../ui";
import type { FieldSpec } from "./resources";
import { RecordPicker } from "./RecordPicker";

/** "meta.version" reads/writes inside the meta JSON object. */
export const getAt = (o: Record<string, any>, k: string) =>
  k.split(".").reduce<any>((a, p) => (a == null ? a : a[p]), o);
export const setAt = (o: Record<string, any>, k: string, v: unknown): Record<string, any> => {
  const [h, ...rest] = k.split(".");
  if (!rest.length) return { ...o, [h]: v };
  return { ...o, [h]: setAt((o[h] && typeof o[h] === "object") ? o[h] : {}, rest.join("."), v) };
};

/** An ISO instant as the `datetime-local` value in the browser's own zone. */
const localDT = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Straight to S3; the API only hands out the presigned URL. */
export async function uploadImage(file: File, purpose = "Banner"): Promise<string> {
  const res = await CommonService.getUploadUrl({ fileName: file.name, fileType: file.type, for: purpose });
  if (!res.response) throw new Error(res.message || "Could not get an upload URL.");
  await CommonService.uploadToS3WithProgress(res.data.uploadUrl, file);
  return res.data.fileUrl;
}

/* ---------------------------------------------------------------- image -- */
function ImageField({ value, onChange, purpose, toast }: {
  value: string; onChange: (v: string) => void; purpose?: string; toast: (m: string, t?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const take = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadImage(f, purpose)); } catch (e) { toast((e as Error).message, "bad"); }
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-2">
      {value
        ? <img src={value} alt="" className="size-10 shrink-0 rounded-md object-cover ring-1 ring-secondary" />
        : <span className="size-10 shrink-0 rounded-md bg-secondary ring-1 ring-secondary" />}
      <Input value={value} onChange={onChange} ph="https://…" className="min-w-0 flex-1" />
      <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => void take(e.target.files?.[0])} />
      <Button size="sm" color="secondary" ico="upload" disabled={busy} onClick={() => pick.current?.click()}>
        {busy ? "Uploading…" : "Upload"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------ rich text -- */
const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
  ["blockquote", "code-block"],
  ["link", "image", "video"],
  ["clean"],
];

/** Uncontrolled after mount on purpose: re-feeding Quill its own HTML on every
 *  keystroke would reset the cursor. The parent re-keys it to load a new record. */
export function RichText({ value, onChange, toast, readOnly }: {
  value: string; onChange: (html: string) => void; toast: (m: string, t?: string) => void; readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const box = document.createElement("div");
    el.appendChild(box);
    const q = new Quill(box, { theme: "snow", readOnly, modules: { toolbar: readOnly ? false : TOOLBAR } });
    if (value) q.clipboard.dangerouslyPasteHTML(value);
    q.history.clear();  // the initial load is not an edit: Ctrl+Z must not empty the document
    /* getSemanticHTML(): real <ul>/<ol> for the site, not Quill's internal
       <ol><li data-list="bullet"> (which needs Quill's own CSS to show a bullet).
       It also writes every space as &nbsp;, which stops paragraphs wrapping —
       so those go back to plain spaces. */
    q.on("text-change", () => cb.current(q.getLength() <= 1 ? "" : q.getSemanticHTML().replace(/&nbsp;/g, " ")));
    (q.getModule("toolbar") as { addHandler: (n: string, f: () => void) => void }).addHandler("image", () => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*";
      inp.onchange = async () => {
        const f = inp.files?.[0];
        if (!f) return;
        try {
          const url = await uploadImage(f, "BlogCover");
          const at = q.getSelection(true)?.index ?? q.getLength();
          q.insertEmbed(at, "image", url, "user");
        } catch (e) { toast((e as Error).message, "bad"); }
      };
      inp.click();
    });
    return () => { el.innerHTML = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={host} className="cms-quill rounded-xl bg-primary ring-1 ring-secondary [&_.ql-container]:min-h-[480px] [&_.ql-container]:text-md [&_.ql-toolbar]:rounded-t-xl" />;
}

/* ------------------------------------------------------- banner children -- */
function RowsField({ value, onChange, cols, max }: {
  value: Record<string, any>[]; onChange: (v: Record<string, any>[]) => void;
  cols: { k: string; ph: string; bool?: boolean; max?: number; one?: boolean }[]; max: number;
}) {
  const rows = Array.isArray(value) ? value : [];
  const put = (i: number, k: string, v: unknown) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          {cols.map((c) => c.bool
            /* `one`: turning this on turns it off on the other rows (one primary button) */
            ? <Toggle key={c.k} on={!!r[c.k]} label={c.ph}
                onChange={(v) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.k]: v } : c.one && v ? { ...x, [c.k]: false } : x)))} />
            : <Input key={c.k} value={r[c.k] ?? ""} ph={c.ph} maxLength={c.max} className="min-w-0 flex-1" onChange={(v) => put(i, c.k, v)} />)}
          <IconButton ico="x" label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      {rows.length < max && (
        <Button size="sm" color="secondary" ico="plus" className="self-start" onClick={() => onChange([...rows, {}])}>Add</Button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- field -- */
export function FieldInput({ f, value, onChange, fkOptions, toast, disabled }: {
  f: FieldSpec; value: any; onChange: (v: unknown) => void; disabled?: boolean;
  fkOptions?: { v: string; l: string }[]; toast: (m: string, t?: string) => void;
}) {
  let input: ReactNode;
  switch (f.kind) {
    case "textarea":
      input = <Textarea value={value ?? ""} rows={f.rows || 4} onChange={onChange} disabled={disabled} mono={f.mono} />; break;
    case "number":
      input = <Input type="number" value={value == null ? "" : String(value)}
        onChange={(v) => onChange(v === "" ? null : Number(v))} />; break;
    case "bool":
      return <Toggle on={!!value} label={f.label} hint={f.hint} onChange={onChange} />;
    case "select":
      input = <SelectInput value={value ?? ""} options={f.options || []} onChange={onChange} />; break;
    case "fk":
      input = <SelectInput value={value == null ? "" : String(value)}
        options={[{ v: "", l: "— none —" }, ...(fkOptions || [])]}
        onChange={(v) => onChange(v === "" ? null : Number(v))} />; break;
    case "picker":
      input = <RecordPicker kind={f.picker!.kind} multiple={f.picker!.multiple} max={f.picker!.max}
        value={value ?? (f.picker!.multiple ? [] : null)} onChange={onChange} />; break;
    case "ids":
      input = <ChipInput value={(value || []).map(String)} placeholder="Type an id and press Enter"
        onChange={(vs: string[]) => onChange(vs.map(Number).filter((n) => Number.isFinite(n)))} />; break;
    case "date":
      input = <Input type="date" value={value ? String(value).slice(0, 10) : ""} onChange={(v) => onChange(v || null)} />; break;
    case "datetime":
      input = <Input type="datetime-local" value={localDT(value)} onChange={(v) => onChange(v ? new Date(v).toISOString() : null)} />; break;
    case "image":
      input = <ImageField value={value ?? ""} onChange={onChange} purpose={f.purpose} toast={toast} />; break;
    case "lines":
      input = <Textarea rows={f.rows || 4} value={Array.isArray(value) ? value.join("\n") : ""}
        onChange={(v) => onChange(v.split("\n"))} />; break;
    case "buttons":
      input = <RowsField value={value} onChange={onChange} max={2}
        cols={[{ k: "label", ph: "Label", max: 100 }, { k: "link", ph: "/v3/plans or https://…" }, { k: "isPrimary", ph: "Primary", bool: true, one: true }]} />; break;
    case "metrics":
      input = <RowsField value={value} onChange={onChange} max={3}
        cols={[{ k: "metric", ph: "500+", max: 50 }, { k: "description", ph: "Verified firms", max: 150 }]} />; break;
    default:
      input = <Input value={value ?? ""} onChange={onChange} mono={f.mono} maxLength={f.max} readOnly={disabled} />;
  }
  return <FormField label={f.label} req={f.req} hint={f.hint}>{input}</FormField>;
}

/* -------------------------------------------------------------- canvas -- */
export function PreviewCanvas({ name, children }: { name: string; children: ReactNode }) {
  const [vp, setVp] = useState("desktop");
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-secondary ring-1 ring-secondary">
      <div className="flex items-center justify-between gap-2 border-b border-secondary bg-primary px-4 py-2">
        <span className="text-xs font-semibold tracking-wide text-tertiary uppercase">Live preview · {name}</span>
        <Segmented sm label="Viewport" value={vp} onPick={setVp}
          options={[{ v: "desktop", l: "Desktop" }, { v: "mobile", l: "Mobile 375" }]} />
      </div>
      <div className="flex justify-center overflow-auto p-6">
        {/* bg-white / text-black, not the panel's tokens: the previews are the
            public site, which is light whatever theme the panel is in. */}
        <div className={"cms-preview-canvas bg-white text-black " + (vp === "mobile"
          ? "w-[375px] rounded-2xl p-3 shadow-xl ring-4 ring-primary-solid"
          : "w-full rounded-xl p-4 shadow-xs ring-1 ring-secondary")}>
          {children}
        </div>
      </div>
    </div>
  );
}
