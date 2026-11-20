import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { DealPaymentLinkRow, QuotationRow } from "../../../api/modules/adminOps";
import { Alert, Button, Icon, ModalShell, Pill } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { errMessage } from "../../../api/apiService";
import { call } from "./api";

export default function PaymentLinkModal({
  quotation,
  dealRef,
  onClose,
  onSuccess,
}: {
  quotation: QuotationRow;
  dealRef: string;
  onClose: () => void;
  onSuccess?: (link: DealPaymentLinkRow) => void;
}) {
  const [email, setEmail] = useState(quotation.party?.email || "");
  const [phone, setPhone] = useState(quotation.party?.phone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<DealPaymentLinkRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [syncedMsg, setSyncedMsg] = useState<string | null>(null);

  const customerName = quotation.party?.name || quotation.party?.business || "Customer";
  const amountStr = inr(quotation.grandTotalPaise);

  const handleGenerate = () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid customer email for the invoice dispatch.");
      return;
    }
    setError(null);
    setLoading(true);

    call(
      AdminOpsService.createPaymentLink(dealRef, quotation.id, {
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
      })
    )
      .then((res) => {
        setLoading(false);
        setCreatedLink(res.paymentLink);
        if (onSuccess) onSuccess(res.paymentLink);
      })
      .catch((e: unknown) => {
        setLoading(false);
        setError(errMessage(e));
      });
  };

  const handleCopy = () => {
    if (!createdLink?.shortUrl) return;
    navigator.clipboard.writeText(createdLink.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!createdLink?.shortUrl) return;
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const text = encodeURIComponent(
      `Hello ${customerName},\n\nHere is your secure Razorpay payment link for ${amountStr} for your Interior Bazzar subscription:\n${createdLink.shortUrl}\n\nUpon payment, your official tax invoice will be generated and emailed directly to you.\n\nThank you!`
    );
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, "_blank");
  };

  const handleSync = () => {
    if (!createdLink) return;
    setLoading(true);
    setSyncedMsg(null);
    call(AdminOpsService.syncPaymentLink(createdLink.id))
      .then((res) => {
        setLoading(false);
        setCreatedLink(res.paymentLink);
        setSyncedMsg(res.message || "Payment status checked successfully.");
        if (onSuccess) onSuccess(res.paymentLink);
      })
      .catch((e: unknown) => {
        setLoading(false);
        setError(errMessage(e));
      });
  };

  return (
    <ModalShell
      title="Razorpay Payment Link"
      sub={`Quote ${quotation.quotationNumber || "Draft"} · ${dealRef}`}
      ico="cash"
      tone="brand"
      onClose={onClose}
      actions={
        createdLink ? (
          <Button color="secondary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button color="secondary" onClick={onClose} isDisabled={loading}>
              Cancel
            </Button>
            <Button color="primary" ico="cash" onClick={handleGenerate} isDisabled={loading}>
              {loading ? "Generating Link…" : "Generate Razorpay Link"}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {error ? <Alert tone="bad" title="Action Refused">{error}</Alert> : null}
        {syncedMsg ? <Alert tone="info" title="Status Update">{syncedMsg}</Alert> : null}

        {/* Snapshot breakdown */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-secondary bg-secondary/30 p-3 text-xs">
          <div>
            <span className="text-tertiary block">Client / Business</span>
            <span className="font-semibold text-primary">{customerName}</span>
          </div>
          <div>
            <span className="text-tertiary block">Payable Amount</span>
            <span className="font-semibold text-primary font-mono tnum text-sm text-emerald-600 dark:text-emerald-400">
              {amountStr}
            </span>
          </div>
          <div>
            <span className="text-tertiary block">Place of Supply</span>
            <span className="text-primary">{quotation.placeOfSupply || "Default"}</span>
          </div>
          <div>
            <span className="text-tertiary block">Link Valid Until</span>
            <span className="text-primary">{quotation.validUntil ? fmtDate(quotation.validUntil) : "Quote Expiry"}</span>
          </div>
        </div>

        {!createdLink ? (
          <>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-secondary">
                Customer Email (for automated Tax Invoice dispatch) *
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder focus:border-brand-primary focus:outline-none"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-secondary">
                Customer Phone (optional, for WhatsApp / SMS notifications)
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder focus:border-brand-primary focus:outline-none"
                />
              </label>
            </div>

            <div className="rounded-lg border border-dashed border-utility-brand-300 bg-utility-brand-50/50 dark:bg-utility-brand-950/20 p-3 text-[11px] text-tertiary leading-relaxed flex items-start gap-2">
              <Icon name="check" size="xs" className="text-brand-secondary shrink-0 mt-0.5" />
              <span>
                <strong>Automated Lifecycle:</strong> This creates a non-partial Razorpay hosted link. When paid, the system automatically marks the quotation accepted, issues the official tax invoice, updates the ledger, activates the customer subscription, and sends the invoice PDF to <strong>{email || "the customer"}</strong>.
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-secondary p-3">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-primary">Payment Link Ready</span>
                <span className="text-[11px] text-tertiary truncate font-mono">{createdLink.plinkId}</span>
              </div>
              <Pill
                text={createdLink.status === "paid" ? "Paid" : "Pending Payment"}
                tone={createdLink.status === "paid" ? "ok" : "warn"}
                dot
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-secondary">Razorpay Checkout URL</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdLink.shortUrl}
                  className="flex-1 rounded-lg border border-secondary bg-secondary/40 px-3 py-2 text-xs font-mono text-primary select-all"
                />
                <Button color={copied ? "primary" : "secondary"} size="sm" onClick={handleCopy} ico="link">
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button color="secondary" size="sm" onClick={handleWhatsAppShare} ico="message" className="flex-1">
                Share via WhatsApp
              </Button>
              <Button color="secondary" size="sm" onClick={handleSync} ico="refresh" isDisabled={loading}>
                {loading ? "Checking…" : "Sync Status"}
              </Button>
            </div>

            {createdLink.status === "paid" && createdLink.invoiceNumber ? (
              <Alert tone="ok" title="Invoice Generated">
                Tax Invoice <strong className="font-mono">{createdLink.invoiceNumber}</strong> has been issued and emailed to the customer.
              </Alert>
            ) : null}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
