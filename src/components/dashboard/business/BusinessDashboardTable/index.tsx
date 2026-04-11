import React from "react";
import { useModal } from "../../../../context/ModalContext";
import styles from "./BusinessDashboardTable.module.css";
import useBusinessDashboardTable from "./useBusinessDashboardTable";
import type { AdminBusinessDashboardRowType } from "../../../../types/content/businessDashboard";
import BusinessRemarksPopup from "../BusinessRemarksPopup";
import BusinessBuyPlanModal from "../BusinessBuyPlanModal";

const PLAN_COLORS: Record<string, string> = {
  "Network Leader": "#000000",
  "Grow with AI": "#4B5563",
  "Scale with Partner": "#6B7280",
  "Sales": "#9CA3AF",
  "Default": "#D1D5DB",
};

const getPlanColor = (plan: string) =>
  PLAN_COLORS[plan] ?? PLAN_COLORS["Default"];

const renderValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "--";
  return value;
};

interface Props {
  filter?: { searchText?: string; status?: string; plan?: string };
}

/**
 * BusinessDashboardTable — NEW component.
 * Existing BusinessTable/index.tsx is NOT modified.
 * To revert: stop importing this component in BusinessDashboard page.
 */
const BusinessDashboardTable: React.FC<Props> = ({ filter }) => {
  const {
    pageNo,
    loading,
    hasNext,
    pageSize,
    setPageNo,
    businesses,
    totalPages,
    incrementPage,
    refetch,
    noAccess,
    setBusinesses,
  } = useBusinessDashboardTable(filter ?? {});

  const { showModal } = useModal();

  const handleRemarkClick = (business: AdminBusinessDashboardRowType) => {
    showModal(
      <BusinessRemarksPopup
        businessId={business.id}
        currentRemark={business.remark ?? ""}
        onSuccess={refetch}
      />
    );
  };

  const handleBuyPlanClick = (business: AdminBusinessDashboardRowType) => {
    showModal(
      <BusinessBuyPlanModal
        planId={business.planId}
        currentIntent={business.buyPlan}
        onSuccess={(newIntent) => {
          setBusinesses((prev) =>
            prev.map((b) => (b.id === business.id ? { ...b, buyPlan: newIntent } : b))
          );
          refetch();
        }}
      />
    );
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Create</th>
            <th>Plan</th>
            <th>Last Purchase</th>
            <th>Plans Expired</th>
            <th>Username</th>
            <th>Lead Kota</th>
            <th>Assigned Leads</th>
            <th>Platform Leads</th>
            <th>Feedback</th>
            <th>Logs</th>
            <th>Buy Plan</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
              <tr key={i} className={styles.loadingRow}>
                <td colSpan={12} style={{ textAlign: "center", color: "#9ca3af" }}>
                  Loading...
                </td>
              </tr>
            ))
            : noAccess ? (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: "32px", color: "#ef4444", fontWeight: "600" }}>
                  You don't have access to this resource.
                </td>
              </tr>
            )
              : businesses.length === 0
                ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                      No businesses found
                    </td>
                  </tr>
                )
                : businesses.map((business) => (
                  <tr key={business.id}>
                    {/* Create */}
                    <td>{renderValue(business.joinAt)}</td>

                    {/* Plan badge */}
                    <td>
                      {business.plan ? (
                        <span className={styles.planBadge}>
                          <span
                            className={styles.planDot}
                            style={{ backgroundColor: getPlanColor(business.plan) }}
                          />
                          {business.plan}
                        </span>
                      ) : "--"}
                    </td>

                    {/* Last Purchase */}
                    <td>{renderValue(business.lastPurchase)}</td>

                    {/* Plans Expired */}
                    <td>{renderValue(business.expire)}</td>

                    {/* Username */}
                    <td>{renderValue(business.name)}</td>

                    {/* Lead Kota */}
                    <td>{renderValue(business.leadsKota)}</td>

                    {/* Assigned Leads */}
                    <td>{renderValue(business.assignedLeads)}</td>

                    {/* Platform Leads */}
                    <td>{renderValue(business.platformLeads)}</td>

                    {/* Feedback */}
                    <td>
                      <span className={styles.feedbackChip}>
                        {business.feedback ?? "Ask"}
                        <span className={styles.starIcon}>☆</span>
                      </span>
                    </td>

                    {/* Logs */}
                    <td>
                      <button className={styles.logsBtn} disabled>
                        <span className={styles.logsCount}>
                          {business.logs ?? 0}
                        </span>
                        {business.logsDate ? business.logsDate : "--"}
                      </button>
                    </td>

                    {/* Buy Plan */}
                    <td>
                      <button
                        onClick={() => handleBuyPlanClick(business)}
                        style={{
                          background: "none",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "70px",
                          transition: "background 0.2s"
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                        title="Update Buy Plan"
                      >
                        {business.buyPlan ? (
                          <span className={styles.planBadge} style={{ border: 'none', padding: 0, background: 'none' }}>
                            <span
                              className={styles.planDot}
                              style={{ backgroundColor: getPlanColor(business.buyPlan) }}
                            />
                            {business.buyPlan}
                          </span>
                        ) : (
                          <span style={{ color: "#4b5563", fontSize: "0.85rem", fontWeight: 500 }}>Update</span>
                        )}
                      </button>
                    </td>

                    {/* Remark */}
                    <td
                      className={styles.remarkCell}
                      onClick={() => handleRemarkClick(business)}
                      title={business.remark ?? ""}
                    >
                      {business.remark ? business.remark : (
                        <span style={{ color: "#9ca3af" }}>Add remark…</span>
                      )}
                    </td>
                  </tr>
                ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className={styles.pagination}>
        <button
          disabled={pageNo === 1}
          onClick={() => setPageNo((prev) => prev - 1)}
        >
          Prev
        </button>

        {[...Array(totalPages)].map((_, i) => {
          const page = i + 1;
          return (
            <button
              key={page}
              className={pageNo === page ? styles.activePage : ""}
              onClick={() => setPageNo(page)}
            >
              {page}
            </button>
          );
        })}

        <button disabled={!hasNext} onClick={incrementPage}>
          Next
        </button>
      </div>
    </div>
  );
};

export default BusinessDashboardTable;
