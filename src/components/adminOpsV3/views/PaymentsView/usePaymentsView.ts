// ── usePaymentsView ── Payments logic (promptsadmin task 22).
// Transaction list + refund action (modal, level-3). Data: /api/v1/admin/payments/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface PaymentRow {
  id: number; orderId: string; transactionId: string; amount: string;
  paymentFor: string; orderStatus: string; refundStatus: string; refundAmount: string; createdAt: string;
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

  return { rows, loading, notice, refundId, reason, setReason, amount, setAmount, busy, openRefund, cancelRefund, submitRefund };
};

export default usePaymentsView;
