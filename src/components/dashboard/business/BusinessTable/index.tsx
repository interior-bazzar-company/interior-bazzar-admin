import type { BusinessFilterType } from "../../../../types/content";
import styles from "./BusinessTable.module.css";
import useBusinessTable, { useBusinessTableV2 } from "./useBusinessTable";

const BusinessTable = ({ filter }: { filter: BusinessFilterType }) => {
  const {
    pageNo,
    loading,
    hasNext,
    pageSize,
    setPageNo,
    businesses,
    totalPages,
    incrementPage,
  } = useBusinessTable(filter);


  const renderValue = (value: string | null | undefined | number) => {
    if (!value && value !== 0) return "--";
    return value;
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Joined</th>
            <th>Plan</th>
            <th>Last purchase</th>
            <th>Expired</th>
            <th>Name</th>
            {/* <th>Lead Kota</th> */}
            <th>Assigned Leads</th>
            <th>Platform Leads</th>
            
          </tr>
        </thead>
        <tbody>
          {loading ? Array.from({ length: pageSize }).map((_, i) => <tr key={i}>
            <td colSpan={10}>
              loading....
            </td>
          </tr>) : businesses.map((business) => (
            <tr key={business.id}>
              <td>{renderValue(business.id)}</td>
              <td>{renderValue(business.joinAt)}</td>
              <td>{renderValue(business.plan)}</td>
              <td>{renderValue(business.lastPurchase)}</td>
              <td>{renderValue(business.expireAt)}</td>
              <td>{renderValue(business.name)}</td>
              {/* <td>
                {Array.isArray(business.plan)
                  ? business.plan.map(p => p.name).join(", ")
                  : renderValue(business.plan as unknown as string)}
              </td> */}

              <td>
                {business.assignedLeads}
              </td>
              <td>{business.platformLeads}</td>
              {/* <td>
                {renderValue(business.totalLeads)}
              </td> */}
            </tr>
          ))}

        </tbody>
      </table>
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

        <button
          disabled={!hasNext}
          onClick={incrementPage}
        >
          Next
        </button>
      </div>
    </div>
  );
};




import BusinessDetailModal from "../BusinessDetailModal";
import { useModal } from "../../../../context/ModalContext";
import BusinessBuyPlanModal from "../BusinessBuyPlanModal";

export const BusinessTableV2 = ({ filter }: { filter: BusinessFilterType }) => {
  const {
    pageNo,
    loading,
    hasNext,
    pageSize,
    setPageNo,
    businesses,
    totalPages,
    incrementPage,
  } = useBusinessTableV2(filter);

  const { showModal } = useModal();

  const handleViewBusiness = (business: any) => {
    showModal(<BusinessDetailModal business={business} />);
  };

  const handleBuyPlanClick = (business: any) => {
    showModal(
      <BusinessBuyPlanModal
        planId={business.id}
        currentIntent={business.buyIntent}
        onSuccess={() => setPageNo((prev) => prev)} // force re-render/refetch in BusinessTableV2
      />
    );
  };

  const renderValue = (
    value: string | null | undefined | number
  ) => {
    if (value === null || value === undefined || value === "")
      return "--";
    return value;
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Joined</th>
            <th>Plan</th>
            <th>Last purchase</th>
            <th>Expired</th>
            <th>Name</th>
            <th>Kota</th>
            <th>Assigned Leads</th>
            <th>Platform Leads</th>
            <th>Total Leads</th>
            <th>Buy Plan</th>
          </tr>
        </thead>

        <tbody>
          {loading
            ? Array.from({ length: pageSize }).map((_, i) => (
              <tr key={i}>
                <td colSpan={7}>Loading...</td>
              </tr>
            ))
            : businesses.length === 0
              ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#9ca3af" }}>
                    No businesses found
                  </td>
                </tr>
              )
              : businesses.map((business) => (
                <tr key={business.id}>
                  <td>{renderValue(business.id)}</td>
                  <td>{renderValue(business.joinAt)}</td>
                  <td>{renderValue(business.plan)}</td>
                  <td>{renderValue(business.lastPurchase)}</td>
                  <td>{renderValue(business.expireAt)}</td>
                  <td
                    onClick={() => handleViewBusiness(business)}
                    style={{ cursor: 'pointer', color: 'var(--color-brand-primary)', fontWeight: 600 }}
                  >
                    {renderValue(business.name)}
                  </td>
                  <td>{business.kota}</td>
                  <td>{business.assignedLead}</td>
                  <td>{business.platformLead}</td>
                  <td>{business.totalLeads}</td>
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
                      {business.buyIntent ? business.buyIntent : (
                        <span style={{ color: "#4b5563", fontSize: "0.85rem", fontWeight: 500 }}>Update</span>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>

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

export default BusinessTable;

