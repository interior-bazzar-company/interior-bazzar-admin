/* =============================================================================
   Finance · Installments & Receivables — tracking who owes, what is due, and overdue.
   -----------------------------------------------------------------------------
   This page provides the sales and finance teams with a single live cockpit
   for all quotation installments:
     - Outstanding / Overdue receivables tracking
     - Instant client contact shortcuts (WhatsApp reminder, Call)
     - Direct deal navigation and invoice auditing
   ============================================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { InstallmentRow, DealPersonRef } from "../../../api/modules/adminOps";
import { useShell } from "../../shell/ShellContext";
import {
  Button,
  EmptyState,
  FilterBar,
  FilterChips,
  Icon,
  Pagination,
  Pill,
  ReasonModal,
  SearchField,
  Select,
  StatStrip,
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { inr, todayIso } from "./store";

const PAGE_SIZE = 50;

const FILTER_LABELS: Record<string, string> = {
  search: "Search",
  status: "Status",
  flag: "Queue",
  owner: "Sales Owner",
};

export default function Installments({ p, onFilter, onSearch, onUnfilter, onParams }: FaceProps) {
  const { toast, modal, closeLayer } = useShell();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [assignees, setAssignees] = useState<DealPersonRef[]>([]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      AdminOpsService.installments({ pageSize: 500 }),
      AdminOpsService.dealAssignees().catch(() => ({ response: false, data: { assignees: [] } })),
    ])
      .then(([instRes, assRes]) => {
        setLoading(false);
        if (instRes && instRes.data && instRes.data.installments) {
          setRows(instRes.data.installments);
        } else {
          setRows([]);
        }
        if (assRes && assRes.data && (assRes.data as { assignees?: DealPersonRef[] }).assignees) {
          setAssignees((assRes.data as { assignees: DealPersonRef[] }).assignees);
        }
      })
      .catch((err) => {
        setLoading(false);
        toast("Failed to load installments ledger: " + String(err), "bad");
      });
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = todayIso().slice(0, 10);

  // Compute metrics across all rows
  const stats = useMemo(() => {
    let totalPaise = 0;
    let overduePaise = 0;
    let overdueCount = 0;
    let dueSoonPaise = 0;
    let dueSoonCount = 0;
    let paidPaise = 0;
    let paidCount = 0;

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysIso = sevenDaysFromNow.toISOString().slice(0, 10);

    for (const r of rows) {
      const amt = r.amountPaise || 0;
      totalPaise += amt;
      const statusKey = r.status?.key || "due";
      const isPaid = statusKey === "paid";
      const isCancelled = statusKey === "cancelled";

      if (isPaid) {
        paidPaise += amt;
        paidCount++;
      } else if (!isCancelled) {
        const isOverdue = r.dueDate < today || statusKey === "failed";
        if (isOverdue) {
          overduePaise += amt;
          overdueCount++;
        } else if (r.dueDate >= today && r.dueDate <= sevenDaysIso) {
          dueSoonPaise += amt;
          dueSoonCount++;
        }
      }
    }

    const outstandingPaise = totalPaise - paidPaise;

    return {
      totalPaise,
      outstandingPaise,
      overduePaise,
      overdueCount,
      dueSoonPaise,
      dueSoonCount,
      paidPaise,
      paidCount,
      totalCount: rows.length,
    };
  }, [rows, today]);

  // Client-side filtering
  const filteredRows = useMemo(() => {
    let list = rows;

    // Filter by quick flag or status
    if (p.flag === "overdue") {
      list = list.filter((r) => (r.status?.key !== "paid" && r.status?.key !== "cancelled" && r.dueDate < today) || r.status?.key === "failed");
    } else if (p.flag === "due_soon") {
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() + 7);
      const sevenDaysIso = sevenDays.toISOString().slice(0, 10);
      list = list.filter((r) => r.status?.key === "due" && r.dueDate >= today && r.dueDate <= sevenDaysIso);
    } else if (p.flag === "paid" || p.status === "paid") {
      list = list.filter((r) => r.status?.key === "paid");
    } else if (p.status) {
      list = list.filter((r) => r.status?.key === p.status);
    }

    // Filter by sales owner
    if (p.owner) {
      const ownerId = Number(p.owner);
      list = list.filter((r) => r.owner?.id === ownerId);
    }

    // Filter by search text
    const searchQ = p.search || p.q;
    if (searchQ) {
      const q = searchQ.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.dealRef && r.dealRef.toLowerCase().includes(q)) ||
          (r.contactName && r.contactName.toLowerCase().includes(q)) ||
          (r.businessName && r.businessName.toLowerCase().includes(q)) ||
          (r.phone && r.phone.toLowerCase().includes(q)) ||
          (r.quotationNumber && r.quotationNumber.toLowerCase().includes(q)) ||
          (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rows, p, today]);

  // Pagination
  const page = Math.max(1, Number(p.page) || 1);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Quick WhatsApp message generator
  const sendWhatsAppReminder = (r: InstallmentRow) => {
    const phone = (r.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast("No phone number recorded for this deal.", "bad");
      return;
    }
    const cleanPhone = phone.length === 10 ? "91" + phone : phone;
    const clientName = r.contactName || "Sir/Madam";
    const amountStr = inr(r.amountPaise);
    const planName = r.planTitle || "Interior Bazzar Subscription";
    const dueDateStr = r.dueDate;

    const message = `Hello ${clientName}, this is a gentle reminder regarding your Interior Bazzar payment of ${amountStr} for ${planName} (Installment ${r.seq} of ${r.count}), which was scheduled for ${dueDateStr}.\n\nPlease let us know if you need any assistance with the invoice or payment link. Thank you!`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleFailModal = (r: InstallmentRow) => {
    if (!r.id) {
      toast("Computed installments cannot be marked failed directly. Issue or reject quotation instead.", "bad");
      return;
    }
    modal(
      <ReasonModal
        heading={`Mark Installment #${r.seq} as Failed`}
        label="Reason for failure"
        confirmLabel="Mark as Failed"
        tone="bad"
        onClose={closeLayer}
        run={async (reasonText) => {
          const res = await AdminOpsService.failInstallment(r.id!, { reason: "overdue", note: reasonText });
          closeLayer();
          if (res.response === false) {
            toast((res.data as { message?: string })?.message || "Failed to update installment", "bad");
          } else {
            toast("Installment marked as failed.");
            loadData();
          }
        }}
      />
    );
  };

  const statCells: (StatCell | "sep")[] = [
    {
      k: <>Total Scheduled</>,
      v: stats.totalCount,
      on: !p.flag && !p.status,
      to: "#/finance-installments",
      tip: <>Every installment recorded across all deals ({inr(stats.totalPaise)} grand total).</>,
    },
    "sep",
    {
      k: (
        <>
          Overdue / Defaulting <b className="tnum text-warning-primary">{inr(stats.overduePaise)}</b>
        </>
      ),
      v: stats.overdueCount,
      dot: stats.overdueCount > 0 ? "warn" : undefined,
      on: p.flag === "overdue",
      to: "#/finance-installments?flag=overdue",
      tip: <>Unpaid installments past their due date requiring sales follow-up.</>,
    },
    {
      k: (
        <>
          Due Next 7 Days <b className="tnum">{inr(stats.dueSoonPaise)}</b>
        </>
      ),
      v: stats.dueSoonCount,
      dot: stats.dueSoonCount > 0 ? "info" : undefined,
      on: p.flag === "due_soon",
      to: "#/finance-installments?flag=due_soon",
      tip: <>Upcoming installments due in the next 7 days.</>,
    },
    "sep",
    {
      k: (
        <>
          Collected & Settled <b className="tnum text-success-primary">{inr(stats.paidPaise)}</b>
        </>
      ),
      v: stats.paidCount,
      dot: "ok",
      on: p.flag === "paid" || p.status === "paid",
      to: "#/finance-installments?flag=paid",
      tip: <>Installments that have been invoiced and collected.</>,
    },
  ];

  const chips = (
    <FilterChips
      params={Object.keys(p)
        .filter((k) => ["page"].indexOf(k) < 0 && p[k])
        .reduce((acc, k) => {
          acc[k] = String(p[k]);
          return acc;
        }, {} as Record<string, string>)}
      labels={FILTER_LABELS}
      onUnfilter={onUnfilter}
    />
  );

  return (
    <Frame
      title="Receivables & Overdue Installments"
      meta={`${filteredRows.length} installment${filteredRows.length === 1 ? "" : "s"} · ${inr(stats.outstandingPaise)} total outstanding`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            color="secondary"
            ico="refresh"
            onClick={loadData}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            color="primary"
            ico="deal"
            onClick={() => go("#/deals")}
          >
            Deals Pipeline
          </Button>
        </div>
      }
      bands={<StatStrip cells={statCells} />}
      cmd={
        <FilterBar
          search={
            <SearchField
              key={"q" + (p.search || p.q || "")}
              val={p.search || p.q}
              onFilter={onSearch}
              ph="Search by Deal Ref, client name, phone, quote #..."
            />
          }
          filters={
            <>
              <Select
                key={"status" + (p.status || p.flag || "")}
                name="status"
                label="Status"
                value={p.status || p.flag || ""}
                onFilter={(_name, v) => {
                  if (v === "overdue" || v === "due_soon") {
                    onParams?.({ ...p, flag: v, status: undefined, page: "1" });
                  } else {
                    onParams?.({ ...p, status: v || undefined, flag: undefined, page: "1" });
                  }
                }}
                options={[
                  { v: "overdue", l: "Overdue (Action Required)", dot: "warn" },
                  { v: "due_soon", l: "Due Next 7 Days", dot: "info" },
                  { v: "due", l: "Due / Scheduled", dot: "neutral" },
                  { v: "paid", l: "Paid / Settled", dot: "ok" },
                  { v: "failed", l: "Failed / Refused", dot: "bad" },
                  { v: "cancelled", l: "Cancelled", dot: "neutral" },
                ]}
              />
              {assignees.length > 0 && (
                <Select
                  key={"owner" + (p.owner || "")}
                  name="owner"
                  label="Sales Owner"
                  value={p.owner || ""}
                  onFilter={onFilter}
                  options={assignees.map((a) => ({ v: String(a.id), l: a.username }))}
                />
              )}
            </>
          }
          chips={chips}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {pagedRows.length === 0 ? (
          <EmptyState
            icon="cash"
            title="No installments matching filters"
            body="Try clearing filters or search to view the full receivables ledger."
            action={
              <Button color="secondary" onClick={() => onParams?.({})}>
                Clear all filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-secondary bg-surface-primary shadow-xs">
            <table className="w-full text-left text-sm text-secondary">
              <thead className="border-b border-secondary bg-surface-secondary text-xs font-semibold uppercase tracking-wider text-tertiary">
                <tr>
                  <th className="px-4 py-3">Client & Deal</th>
                  <th className="px-4 py-3">Plan / Schedule</th>
                  <th className="px-4 py-3">Due Date & Aging</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {pagedRows.map((r, idx) => {
                  const statusKey = r.status?.key || "due";
                  const isPaid = statusKey === "paid";
                  const isOverdue = !isPaid && statusKey !== "cancelled" && (r.dueDate < today || statusKey === "failed");
                  const daysOverdue = isOverdue ? Math.max(1, Math.floor((new Date(today).getTime() - new Date(r.dueDate).getTime()) / (1000 * 3600 * 24))) : 0;

                  return (
                    <tr
                      key={r.id || `${r.dealRef}-${r.seq}-${idx}`}
                      className="transition-colors hover:bg-surface-secondary/60"
                    >
                      {/* Client & Deal */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary">{r.contactName || "—"}</span>
                          {r.businessName && (
                            <span className="text-xs text-tertiary truncate max-w-[180px]">{r.businessName}</span>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => go(`#/deals/${r.dealRef}`)}
                              className="inline-flex items-center gap-1 rounded bg-brand-primary px-1.5 py-0.5 text-xs font-medium text-brand-secondary hover:underline"
                            >
                              <Icon name="deal" size="xs" />
                              {r.dealRef}
                            </button>
                            {r.owner && (
                              <span className="text-xs text-quaternary">
                                by {r.owner.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plan / Schedule */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-primary">
                            {r.planTitle || "Custom Plan"}
                          </span>
                          <span className="text-xs text-tertiary">
                            Installment <b>{r.seq}</b> of <b>{r.count}</b>
                          </span>
                          {r.quotationNumber && (
                            <span className="text-xs text-quaternary mt-0.5">
                              Quote: {r.quotationNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Due Date & Aging */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm text-primary">{r.dueDate}</span>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-primary">
                              <Icon name="clock" size="xs" />
                              Overdue by {daysOverdue}d
                            </span>
                          )}
                          {isPaid && r.paidAt && (
                            <span className="text-xs text-success-primary">
                              Paid {r.paidAt.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-base font-semibold text-primary tnum">
                          {inr(r.amountPaise)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isPaid ? (
                          <Pill tone="ok" dot text="Paid" />
                        ) : isOverdue ? (
                          <Pill tone="warn" dot text="Overdue" />
                        ) : statusKey === "cancelled" ? (
                          <Pill tone="mute" text="Cancelled" />
                        ) : (
                          <Pill tone="info" dot text="Scheduled" />
                        )}
                      </td>

                      {/* Invoice */}
                      <td className="px-4 py-3">
                        {r.invoiceNumber ? (
                          <button
                            type="button"
                            onClick={() => r.invoiceId && go(`#/invoices/${r.invoiceId}`)}
                            className="inline-flex items-center gap-1 font-mono text-xs font-medium text-brand-secondary hover:underline"
                          >
                            <Icon name="invoice" size="xs" />
                            {r.invoiceNumber}
                          </button>
                        ) : (
                          <span className="text-xs text-quaternary">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.phone && !isPaid && (
                            <Button
                              size="sm"
                              color="secondary"
                              ico="message"
                              onClick={() => sendWhatsAppReminder(r)}
                              title={`Send WhatsApp payment reminder to ${r.contactName || r.phone}`}
                            >
                              Remind
                            </Button>
                          )}
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-secondary text-secondary hover:bg-surface-secondary hover:text-primary"
                              title={`Call ${r.phone}`}
                            >
                              <Icon name="phone" size="xs" />
                            </a>
                          )}
                          {r.id && !isPaid && statusKey !== "failed" && (
                            <Button
                              size="sm"
                              color="tertiary"
                              ico="alert"
                              onClick={() => handleFailModal(r)}
                              title="Mark as Failed"
                            />
                          )}
                          <Button
                            size="sm"
                            color="tertiary"
                            ico="chevr"
                            onClick={() => go(`#/deals/${r.dealRef}`)}
                            title="Open Deal details"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-end">
            <Pagination
              page={page}
              pages={totalPages}
              onPage={(pNum) => onParams?.({ ...p, page: String(pNum) })}
            />
          </div>
        )}
      </div>
    </Frame>
  );
}
