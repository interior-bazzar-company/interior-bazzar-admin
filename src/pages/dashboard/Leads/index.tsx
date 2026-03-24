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
        noAccess: noAccessStats
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
                        <div className={`${styles.statCard} ${styles.statBlack}`}>
                            <span className={styles.statLabel}>Total Leads</span>
                            <span className={styles.statValue}>{stats?.totalLeads || 0}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Platform Leads</span>
                            <span className={styles.statValue}>{stats?.platformLeads || 0}</span>
                        </div>
                        <div className={styles.statCard}>
                            <span className={styles.statLabel}>Generative Leads</span>
                            <span className={styles.statValue}>{generativeLeadsCount}</span>
                        </div>
                    </div>

                    <div className={styles.filtersSection}>
                        {/* <div className={styles.filterRow}>
                            <span className={styles.filterTitle}>Category</span>
                            <div className={styles.chipsContainer}>
                                <FilterChip label="Residential" count={0} dotColor="#6366f1" isActive={filters.category === "Residential"} onClick={() => handleFilterClick("category", "Residential")} />
                                <FilterChip label="Commercial" count={0} dotColor="#f59e0b" isActive={filters.category === "Commercial"} onClick={() => handleFilterClick("category", "Commercial")} />
                            </div>
                        </div> */}

                        <div className={styles.filterRow}>
                            <span className={styles.filterTitle}>Lead status</span>
                            <div className={styles.chipsContainer}>
                                {stats?.statusMetrics && Object.keys(stats.statusMetrics).length > 0 ? (() => {
                                    const STATUS_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
                                    return Object.entries(stats.statusMetrics)
                                        .filter(([key]) => key !== "") // skip empty-key entries that cause false active matches
                                        .map(([key, count], index) => (
                                        <FilterChip 
                                            key={key}
                                            label={key.charAt(0).toUpperCase() + key.slice(1)} 
                                            count={count} 
                                            dotColor={STATUS_COLORS[index % STATUS_COLORS.length]} 
                                            isActive={filters.leadStatus !== "" && filters.leadStatus === key} 
                                            onClick={() => handleFilterClick("leadStatus", key)} 
                                        />
                                    ));
                                })() : (
                                    <>
                                        <FilterChip label="New" count={0} dotColor="#10b981" isActive={filters.leadStatus === "New"} onClick={() => handleFilterClick("leadStatus", "New")} />
                                        <FilterChip label="Assigned" count={0} dotColor="#3b82f6" isActive={filters.leadStatus === "Assigned"} onClick={() => handleFilterClick("leadStatus", "Assigned")} />
                                        <FilterChip label="Deny" count={0} dotColor="#ef4444" isActive={filters.leadStatus === "Deny"} onClick={() => handleFilterClick("leadStatus", "Deny")} />
                                        <FilterChip label="Rejected" count={0} dotColor="#f59e0b" isActive={filters.leadStatus === "Rejected"} onClick={() => handleFilterClick("leadStatus", "Rejected")} />
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={styles.filterRow}>
                            <span className={styles.filterTitle}>Filter status</span>
                            <div className={styles.chipsContainer}>
                                {stats?.stageMetrics && Object.keys(stats.stageMetrics).length > 0 ? (() => {
                                    const ADMIN_STATUS_COLORS = ["#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1", "#14b8a6", "#eab308"];
                                    return Object.entries(stats.stageMetrics)
                                        .filter(([key]) => key !== "") // skip empty-key entries that cause false active matches
                                        .map(([key, count], index) => (
                                        <FilterChip 
                                            key={key}
                                            label={key.charAt(0).toUpperCase() + key.slice(1)} 
                                            count={count} 
                                            dotColor={ADMIN_STATUS_COLORS[index % ADMIN_STATUS_COLORS.length]} 
                                            isActive={filters.filterStatus !== "" && filters.filterStatus === key} 
                                            onClick={() => handleFilterClick("filterStatus", key)}
                                        />
                                    ));
                                })() : (
                                    <> 
                                        <FilterChip label="Pending" count={0} dotColor="#8b5cf6" isActive={filters.filterStatus === "Pending"} onClick={() => handleFilterClick("filterStatus", "Pending")} />
                                        <FilterChip label="Detail verified" count={0} dotColor="#06b6d4" isActive={filters.filterStatus === "Detail verified"} onClick={() => handleFilterClick("filterStatus", "Detail verified")} />
                                        <FilterChip label="Intent verified" count={0} dotColor="#f97316" isActive={filters.filterStatus === "Intent verified"} onClick={() => handleFilterClick("filterStatus", "Intent verified")} />
                                        <FilterChip label="AI verified" count={0} dotColor="#ec4899" isActive={filters.filterStatus === "AI verified"} onClick={() => handleFilterClick("filterStatus", "AI verified")} />
                                        <FilterChip label="manual verified" count={0} dotColor="#84cc16" isActive={filters.filterStatus === "manual verified"} onClick={() => handleFilterClick("filterStatus", "manual verified")} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className={styles.tableContainer}>
                <LeadTable filter={filters} />
            </div>
        </section>
    )
}

export default LeadDashboard;