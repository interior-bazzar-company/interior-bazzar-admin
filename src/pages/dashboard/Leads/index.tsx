import { useNavigate } from "react-router-dom";
// import { FiSearch } from "react-icons/fi";
import { PAGES } from "../../../utils/constants/app";
import styles from "./Leads.module.css"
import LeadTable from "../../../components/dashboard/Lead/LeadTable"
import useLeads from "./useLeads.tsx";

const FilterChip = ({ 
  label, 
  count, 
  dotColor, 
  isActive, 
  onClick 
}: { 
  label: string, 
  count?: number, 
  dotColor: string, 
  isActive: boolean, 
  onClick: () => void 
}) => (
  <button 
    className={`${styles.filterChip} ${isActive ? styles.activeChip : ''}`} 
    onClick={onClick}
    type="button"
  >
    <span className={styles.chipDot} style={{ backgroundColor: dotColor }} />
    <span className={styles.chipLabel}>{label}</span>
    {count !== undefined && <span className={styles.chipCount}>{count}</span>}
  </button>
);

const CHIP_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#84cc16"  // Lime
];

const LeadDashboard = () => {
    const navigate = useNavigate();
    const { 
        // searchText,
        filters,
        stats,
        // handleSearchChange,
        // handleSearch,
        handleFilterClick,
        handleAddClick,
        noAccess: noAccessStats,
        refreshTrigger
    } = useLeads();

    console.log( "stats: ", stats );

    const generativeLeadsCount = stats ? (stats.totalLeads - stats.platformLeads) : 0;

    return (
        <section className={styles.leadDashboardContainer}>
            <div className={styles.topBar}>
                {/* <form onSubmit={handleSearch} className={styles.searchForm}>
                    <input 
                       type="text"
                       className={styles.searchInput} 
                       placeholder="Search query" 
                       value={searchText} 
                       onChange={handleSearchChange} 
                    />
                    <button type="submit" className={styles.searchIconBtn}>
                        <FiSearch />
                    </button>
                </form> */}
                <div className={styles.topActions}>
                    <button 
                        className={styles.analyticsBtn} 
                        onClick={() => navigate(PAGES.ADMIN_ANALYTICS)}
                    >
                        Analytics
                    </button>
                    <button 
                        className={styles.addBtn}
                        onClick={handleAddClick}
                    >
                        + Add
                    </button>
                </div>
            </div>

            {noAccessStats ? (
                <div style={{ padding: "32px", textAlign: "center", backgroundColor: "#ffffff", color: "#000000", border: "2px solid #000000", fontWeight: "800", textTransform: "uppercase" }}>
                    ACCESS DENIED: YOU DON'T HAVE PERMISSION TO VIEW LEAD ANALYTICS AND FILTERS.
                </div>
            ) : (
                <>
                    <div className={styles.statsRow}>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>TOTAL LEADS</span>
                            <span className={styles.statValue}>{stats?.totalLeads || 0}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>PLATFORM LEADS</span>
                            <span className={styles.statValue}>{stats?.platformLeads || 0}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>GENERATIVE LEADS</span>
                            <span className={styles.statValue}>{generativeLeadsCount}</span>
                        </div>
                    </div>

                    <div className={styles.filtersSection}>
                        <div className={styles.filterRow}>
                            <span className={styles.filterTitle}>Category</span>
                            <div className={styles.chipsContainer}>
                                {stats?.categoryMetrics && Object.keys(stats.categoryMetrics).length > 0 ? (() => {
                                    return Object.entries(stats.categoryMetrics)
                                        .filter(([key]) => key !== "")
                                        .map(([key, count], index) => (
                                        <FilterChip 
                                            key={key}
                                            label={key.charAt(0).toUpperCase() + key.slice(1)} 
                                            count={count} 
                                            dotColor={CHIP_COLORS[index % CHIP_COLORS.length]} 
                                            isActive={filters.category !== "" && filters.category === key} 
                                            onClick={() => handleFilterClick("category", key)} 
                                        />
                                    ));
                                })() : (
                                    <>
                                        <FilterChip label="Residential" count={0} dotColor={CHIP_COLORS[0]} isActive={filters.leadStatus === "New"} onClick={() => handleFilterClick("leadStatus", "New")} />
                                        <FilterChip label="Commercial" count={0} dotColor={CHIP_COLORS[1]} isActive={filters.leadStatus === "Assigned"} onClick={() => handleFilterClick("leadStatus", "Assigned")} />
                                    </>
                                )}
                            </div>
                        </div>
                        <div className={styles.filterRow}>
                            <span className={styles.filterTitle}>Lead Status</span>
                            <div className={styles.chipsContainer}>
                                {stats?.statusMetrics && Object.keys(stats.statusMetrics).length > 0 ? (() => {
                                    return Object.entries(stats.statusMetrics)
                                        .filter(([key]) => key !== "")
                                        .map(([key, count], index) => (
                                        <FilterChip 
                                            key={key}
                                            label={key.charAt(0).toUpperCase() + key.slice(1)} 
                                            count={count} 
                                            dotColor={CHIP_COLORS[index % CHIP_COLORS.length]} 
                                            isActive={filters.leadStatus !== "" && filters.leadStatus === key} 
                                            onClick={() => handleFilterClick("leadStatus", key)} 
                                        />
                                    ));
                                })() : (
                                    <>
                                        <FilterChip label="New" count={0} dotColor={CHIP_COLORS[0]} isActive={filters.leadStatus === "New"} onClick={() => handleFilterClick("leadStatus", "New")} />
                                        <FilterChip label="Assigned" count={0} dotColor={CHIP_COLORS[1]} isActive={filters.leadStatus === "Assigned"} onClick={() => handleFilterClick("leadStatus", "Assigned")} />
                                        <FilterChip label="Deny" count={0} dotColor={CHIP_COLORS[2]} isActive={filters.leadStatus === "Deny"} onClick={() => handleFilterClick("leadStatus", "Deny")} />
                                        <FilterChip label="Rejected" count={0} dotColor={CHIP_COLORS[3]} isActive={filters.leadStatus === "Rejected"} onClick={() => handleFilterClick("leadStatus", "Rejected")} />
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={styles.filterRow}>
                            <span className={styles.filterTitle}>Stage</span>
                            <div className={styles.chipsContainer}>
                                {stats?.stageMetrics && Object.keys(stats.stageMetrics).length > 0 ? (() => {
                                    return Object.entries(stats.stageMetrics)
                                        .filter(([key]) => key !== "")
                                        .map(([key, count], index) => (
                                        <FilterChip 
                                            key={key}
                                            label={key.charAt(0).toUpperCase() + key.slice(1)} 
                                            count={count} 
                                            dotColor={CHIP_COLORS[index % CHIP_COLORS.length]} 
                                            isActive={filters.filterStatus !== "" && filters.filterStatus === key} 
                                            onClick={() => handleFilterClick("filterStatus", key)}
                                        />
                                    ));
                                })() : (
                                    <> 
                                        <FilterChip label="Pending" count={0} dotColor={CHIP_COLORS[0]} isActive={filters.filterStatus === "Pending"} onClick={() => handleFilterClick("filterStatus", "Pending")} />
                                        <FilterChip label="Verified" count={0} dotColor={CHIP_COLORS[1]} isActive={filters.filterStatus === "Verified"} onClick={() => handleFilterClick("filterStatus", "Verified")} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className={styles.tableContainer}>
                <LeadTable filter={filters} refreshTrigger={refreshTrigger} />
            </div>
        </section>
    )
}

export default LeadDashboard;