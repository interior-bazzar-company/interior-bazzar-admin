/* =====================================================================
   The guard modals — take off sale, archive. Same shape (header · error
   slot · one notice · cancel/confirm), so one component with the copy
   passed in, rather than copies of the same markup that can drift.

   NOT the shared `ConfirmModal` in ui/overlays, and deliberately: this one
   RENDERS the refusal in the dialog that tried it and stays open, so the
   notice it has just contradicted is still on screen. The shared one closes
   on confirm and has nowhere to put a server's "no".
   ===================================================================== */
import { useState } from "react";
import type { ReactNode } from "react";
import { Alert, Button, ModalShell } from "../../ui";
import { errMessage } from "../../../api/apiService";

export default function ConfirmModal({
  heading, sub, notice, tone, ico, confirmLabel, confirmCls, act, run, onClose
}: {
  heading: string;
  sub: string;
  notice: ReactNode;
  tone?: string;
  ico?: string;
  confirmLabel: string;
  /** The confirm button's weight, as a word: `dgr` draws it destructive,
   *  anything else draws the ordinary primary. */
  confirmCls: string;
  act: string;
  run: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const destructive = /dgr|danger|dest/.test(confirmCls);
  const noticeTone = tone === "bad" || tone === "warn" || tone === "ok" ? tone : "info";

  return (
    <ModalShell
      title={heading}
      sub={sub}
      ico={ico || (destructive ? "alert" : "help")}
      tone={destructive ? "error" : "gray"}
      onClose={onClose}
      actions={<>
        <Button color="secondary" data-close="1" onClick={onClose} isDisabled={busy}>Cancel</Button>
        <Button
          color={destructive ? "primary-destructive" : "primary"}
          data-act={act}
          isLoading={busy}
          showTextWhileLoading
          onClick={() => {
            setErr(null); setBusy(true);
            run().catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
          }}
        >{confirmLabel}</Button>
      </>}
    >
      <div className="flex flex-col gap-3">
        {err ? <div id="plErr"><Alert tone="bad" title={err} /></div> : null}
        <Alert tone={noticeTone} ico={ico}>{notice}</Alert>
      </div>
    </ModalShell>
  );
}
