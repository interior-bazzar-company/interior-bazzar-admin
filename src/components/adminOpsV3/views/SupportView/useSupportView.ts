// ── useSupportView ── Support Desk logic (promptsadmin task 37).
// Ticket list (status tabs) + detail drawer with reply + close.
// Data: /api/v1/admin/support/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface TicketRow { id: number; subject: string; status: string; user: string | null; email: string; createdAt: string; lastReplyAt: string; }
export interface TicketDetail extends TicketRow { message: string; replies: Array<{ by: string; role: string; body: string; ts: string }>; }
export const SUPPORT_TABS = ["open", "in_progress", "resolved", "closed"] as const;

const useSupportView = () => {
  const [tab, setTab] = useState<string>("open");
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (status: string) => {
    setLoading(true);
    const res = await AdminOpsService.supportTickets({ status }).catch(() => null);
    if (res?.response && res.data?.tickets) setRows(res.data.tickets);
    else setRows([]);
    setLoading(false);
  };
  useEffect(() => { load(tab); }, [tab]);

  const open = async (id: number) => {
    const res = await AdminOpsService.supportTicket(id).catch(() => null);
    if (res?.response && res.data) { setDetail(res.data); setReply(""); }
  };
  const close = () => setDetail(null);

  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    setBusy(true);
    const res = await AdminOpsService.replyTicket(detail.id, reply.trim()).catch(() => null);
    setBusy(false);
    if (res?.response && res.data) { setDetail(res.data); setReply(""); await load(tab); }
    else setNotice({ kind: "err", msg: "Could not send reply." });
  };

  const closeTicket = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await AdminOpsService.closeTicket(detail.id).catch(() => null);
    setBusy(false);
    if (res?.response) { setNotice({ kind: "ok", msg: "Ticket closed." }); setDetail(null); await load(tab); }
    else setNotice({ kind: "err", msg: "Could not close ticket." });
  };

  return { tab, setTab, rows, loading, notice, detail, reply, setReply, busy, open, close, sendReply, closeTicket };
};

export default useSupportView;
