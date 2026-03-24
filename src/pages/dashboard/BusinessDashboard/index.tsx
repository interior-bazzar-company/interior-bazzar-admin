// import React from "react";
// import { FiSearch } from "react-icons/fi";
import styles from "./BusinessDashboard.module.css";
import useBusinessDashboard from "./useBusinessDashboard";
import BusinessDashboardTable from "../../../components/dashboard/business/BusinessDashboardTable";

const BusinessDashboard = () => {
  const {
    dashboardStats,
    // searchText,
    // handleSearchChange,
    // handleSearchSubmit,
    handleFilterClick,
    filters,
    noAccess,
  } = useBusinessDashboard();

  if (noAccess) {
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#000000", fontWeight: "800", fontSize: "1.2rem", border: "2px solid #000000", padding: "20px" }}>
      YOU DON'T HAVE ACCESS TO THIS PAGE.
    </div>
  }

  return (
    <div className={styles.container}>
      {/* Top Header & Search */}
      <div className={styles.headerRow}>
        <div className={styles.userInfo}>
        </div>
        <div className={styles.actionsRow}>
          {/* <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search query"
              value={searchText}
              onChange={handleSearchChange}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>
              <FiSearch size={18} />
            </button>
          </form> */}
          <button type="button" className={styles.analyticsBtn}>
            Analytics
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className={styles.kpiGrid}>
        <div
          className={`${styles.kpiCard} ${styles.kpiDark}`}
          style={{ cursor: "pointer" }}
          onClick={() => handleFilterClick("status", "")} // Show All
        >
          <div className={styles.kpiLabel}>Total business</div>
          <div className={styles.kpiValue}>{dashboardStats.totalBusiness}</div>
        </div>
        <div
          className={`${styles.kpiCard} ${filters.status === "active" ? styles.activeCard : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => handleFilterClick("status", "active")}
        >
          <div className={styles.kpiLabel}>Active</div>
          <div className={styles.kpiValue}>{(dashboardStats as any).totalActiveBusinesses || 0}</div>
        </div>
        <div
          className={`${styles.kpiCard} ${filters.status === "inactive" ? styles.activeCard : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => handleFilterClick("status", "inactive")}
        >
          <div className={styles.kpiLabel}>Inactive</div>
          <div className={styles.kpiValue}>{(dashboardStats.totalBusiness - (dashboardStats as any).totalActiveBusinesses) || 0}</div>
        </div>
      </div>

      {/* Dedicated Plans Pills Row */}
      <div className={styles.planSection}>
        <span className={styles.planTitle}>Dedicated</span>
        <div className={styles.planPills}>
          {Object.entries(dashboardStats.plan_metrics || {}).map(
            ([name, count], index) => {
              const colors = ["#000000"];
              const color = colors[index % colors.length];
              const isActive = filters.plan === name;

              return (
                <div
                  key={name}
                  className={`${styles.planPill} ${isActive ? styles.activePill : ""}`}
                  onClick={() => handleFilterClick("plan", name)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className={styles.pillDot}
                    style={{ backgroundColor: color }}
                  />
                  <span className={styles.pillName}>{name}</span>
                  <span className={styles.pillCount}>{count}</span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Extended Table */}
      <div className={styles.tableSection}>
        <BusinessDashboardTable key={JSON.stringify(filters)} filter={filters} />
      </div>
    </div>
  );
};

export default BusinessDashboard;
