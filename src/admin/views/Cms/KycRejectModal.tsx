/* Reject a business KYC document with a preset reason. Presets come from
   CMS DOCS/10-business-legal-docs-and-verification/README.md: the wireframe's
   storefront template verbatim, the rest worded from its SOP "Immediate
   Rejection Criteria" table. Picking one only fills the textarea; it stays editable. */
import { useId, useState } from "react";
import { Alert, Button, FormField, ModalShell, SelectInput, Textarea } from "../../ui";
import { errMessage } from "../../../api/apiService";

const MAX = 500;
const PRESETS: { label: string; text: string; for?: RegExp }[] = [
  {
    label: "Stock Photo / Ineligible Image Detected",
    for: /store|shop|photo|office/i,
    text: 'The uploaded storefront image appears to be a generic 3D render or catalog stock photograph. To receive the "IB Verified" trust badge and activate buyer leads, please upload a clear, unedited photograph of your physical showroom or office showing your exterior brand signboard clearly.',
  },
  {
    label: "Storefront Photo: no signboard / blurry",
    for: /store|shop|photo|office/i,
    text: "The storefront photo is extremely blurry, carries another site's watermark, or is an indoor close-up without a signboard. Please upload a real daylight photo showing the shopfront or office with a legible brand nameplate or signboard.",
  },
  {
    label: "GSTIN: expired / cancelled / name mismatch",
    for: /gst/i,
    text: "The GSTIN certificate is expired or shows a cancelled taxpayer status, or the trade name differs completely from the registered owner. Please upload a Regular or Composition GST registration with active status whose trade name matches your business.",
  },
  {
    label: "COA Certificate: invalid",
    for: /coa|architect|council/i,
    text: "The Council of Architecture certificate is not valid: it is a generic diploma, is expired, or the registration number does not follow the CA/YYYY/XXXXX format. Please upload your current COA certificate.",
  },
  {
    label: "Address does not match profile",
    text: "The city and area on the document do not match your profile location. Please upload a document for your operating address, or update your profile location with an explanation.",
  },
];

export function KycRejectModal({ docType, businessName, onClose, run }: { docType: string; businessName: string; onClose: () => void; run: (reason: string) => Promise<unknown> }) {
  const id = useId();
  const own = PRESETS.filter((p) => !p.for || p.for.test(docType));
  // No preset written for this paper: offer only the ones that fit any document.
  const presets = own.length > 1 ? own : PRESETS.filter((p) => !p.for);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    const reason = text.trim();
    if (!reason) return setErr("A reason is required.");
    setErr(null);
    setBusy(true);
    run(reason).catch((e: unknown) => {
      setErr(errMessage(e));
      setBusy(false);
    });
  };

  return (
    <ModalShell
      title={`Reject ${docType}`}
      sub={businessName}
      ico="alert"
      tone="error"
      onClose={onClose}
      actions={
        <>
          <Button color="secondary" onClick={onClose} isDisabled={busy}>Cancel</Button>
          <Button color="primary-destructive" isLoading={busy} onClick={submit}>Reject & notify</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {err ? <Alert tone="bad" title={err} /> : null}
        <FormField label="Preset reason">
          <SelectInput
            value=""
            disabled={busy}
            onChange={(v: string) => setText((presets.find((p) => p.label === v)?.text ?? text).slice(0, MAX))}
            ph="Choose a template…"
            options={presets.map((p) => ({ v: p.label, l: p.label }))}
          />
        </FormField>
        <FormField id={id} label="Feedback to the business owner" req hint={`${text.length}/${MAX}`}>
          <Textarea id={id} rows={5} value={text} maxLength={MAX} disabled={busy} onChange={(v) => setText(v.slice(0, MAX))} err={!!err && !text.trim()} />
        </FormField>
      </div>
    </ModalShell>
  );
}
