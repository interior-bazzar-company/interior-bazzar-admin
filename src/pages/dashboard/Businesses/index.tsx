import styles from "./Businesses.module.css"
import useBusinesses from "./useBusinesses";

// import BusinessTable from "../../../components/dashboard/business/BusinessTable";
import { BusinessTableV2 } from "../../../components/dashboard/business/BusinessTable";
import { UsersIcon } from "../../../components/ui/Icons/SVG";
import {BusinessKPI} from "./BusinessKPI/BusinessKPI";
const Businesses = () => {
    const {
        filters,
        noOfUsers,
        handleFilterClick,
        dashboardStats,
        noAccessDashboard,
        noAccessUsers } = useBusinesses();

    return (
        <>
            <section className={styles.leadDashboardContainer}>
                <div className={`${styles.sectionHeader}`}>
                    <UsersIcon className={`${styles.icon}`} />
                    {noAccessUsers ? (
                        <p className={`${styles.sectionPara}`} style={{ color: "#ef4444" }}>Permission denied for user statistics</p>
                    ) : (
                        <p className={`${styles.sectionPara}`}>Total no of users: <span>{noOfUsers}</span></p>
                    )}
                </div>
                {noAccessDashboard ? (
                    <div style={{ padding: "20px", textAlign: "center", border: "1px solid #fee2e2", backgroundColor: "#fef2f2", color: "#b91c1c", marginBottom: "20px", borderRadius: "8px" }}>
                        You don't have access to dashboard statistics.
                    </div>
                ) : (
                    <BusinessKPI 
                       data={dashboardStats} 
                       selectedPlan={filters.plan} 
                       onPlanClick={handleFilterClick} 
                    />
                )}
                <div>
                    {/* <BusinessTable filter={filters} /> */}
                    <BusinessTableV2 filter={filters} />
                </div>
            </section>

        </>
    );
};
export default Businesses;