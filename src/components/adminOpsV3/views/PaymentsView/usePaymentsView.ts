// ── usePaymentsView ── Payments logic (promptsadmin task 22).
// Transaction list + refund action (modal, level-3). Data: /api/v1/admin/payments/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface PaymentRow {
  id: number; orderId: string; transactionId: string; amount: string;
  paymentFor: string; orderStatus: string; refundStatus: string; refundAmount: string; createdAt: string;
  paymentMethod?: string; proofUrl?: string;
  refundReason?: string | null; refundedBy?: string | null; refundedAt?: string | null;
  verifiedAt?: string | null;
}

const usePaymentsView = (opts: { refundedOnly?: boolean } = {}) => {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [refundId, setRefundId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.payments(opts.refundedOnly ? { refunded: true } : {}).catch(() => null);
    if (res?.response && res.data?.payments) setRows(res.data.payments);
    else setRows([]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openRefund = (p: PaymentRow) => { setRefundId(p.id); setReason(""); setAmount(p.amount); };
  const cancelRefund = () => setRefundId(null);
  const submitRefund = async (reject: boolean) => {
    if (refundId == null) return;
    if (!reason.trim()) { setNotice({ kind: "err", msg: "A reason is required." }); return; }
    setBusy(true);
    const res = await AdminOpsService.refund(refundId, { amount, reason: reason.trim(), reject }).catch(() => null);
    setBusy(false);
    if (res?.response) { setNotice({ kind: "ok", msg: reject ? "Refund rejected." : "Refund recorded." }); setRefundId(null); await load(); }
    else setNotice({ kind: "err", msg: res?.message || "Could not process refund." });
  };

  // Manual-payment verify/reject (task 11).
  const verify = async (id: number) => {
    setBusy(true);
    const res = await AdminOpsService.verifyPayment(id).catch(() => null);
    setBusy(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Payment verified — plan activated." }); await load(); }
    else setNotice({ kind: "err", msg: res?.message || "Could not verify payment." });
  };
  const reject = async (id: number) => {
    const why = window.prompt("Reason for rejecting this payment?") ?? "";
    setBusy(true);
    const res = await AdminOpsService.rejectPayment(id, why).catch(() => null);
    setBusy(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Payment rejected." }); await load(); }
    else setNotice({ kind: "err", msg: res?.message || "Could not reject payment." });
  };

  // Manual payments awaiting review vs everything already processed.
  const pending = rows.filter((r) => r.paymentMethod === "manual" && r.orderStatus === "SUBMITTED");
  const history = rows.filter((r) => !(r.paymentMethod === "manual" && r.orderStatus === "SUBMITTED"));
  const verifiedCount = rows.filter((r) => r.paymentMethod === "manual" && !!r.verifiedAt && r.orderStatus !== "SUBMITTED").length;

  return { rows, pending, history, verifiedCount, loading, notice, refundId, reason, setReason, amount, setAmount, busy, openRefund, cancelRefund, submitRefund, verify, reject };
};

export default usePaymentsView;
