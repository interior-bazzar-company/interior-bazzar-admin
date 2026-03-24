import styles from "./AnalyticsV2.module.css";
import useAnalyticsV2 from "./useAnalyticsV2";
import BusinessAnalyticsChart from "./components/BusinessAnalyticsChart";
import LeadAnalyticsChart from "./components/LeadAnalyticsChart";
import DistributionChart from "./components/DistributionChart";
import BusinessStatsSection from "./components/BusinessStatsSection";
import LeadStatsSection from "./components/LeadStatsSection";

const AnalyticsV2 = () => {
  const { 
    loading, 
    businessStats, 
    leadStats, 
    businessChartData, 
    leadChartData, 
    distributionData,
    noAccessBizStats,
    noAccessLeadStats,
    noAccessBizChart,
    noAccessDistChart,
    noAccessLeadChart,
  } = useAnalyticsV2();

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        Loading analytics...
      </div>
    );
  }


  return (
    <div className={styles.container}>
      {/* Charts Row */}
      <div className={styles.chartsRow}>
        {noAccessBizChart ? (
          <div style={{ flex: 1, padding: "20px", textAlign: "center", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px" }}>Access Denied: Business Analytics</div>
        ) : (
          <BusinessAnalyticsChart data={businessChartData} />
        )}
        {noAccessLeadChart ? (
          <div style={{ flex: 1, padding: "20px", textAlign: "center", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px" }}>Access Denied: Lead Analytics</div>
        ) : (
          <LeadAnalyticsChart data={leadChartData} />
        )}
        {noAccessDistChart ? (
          <div style={{ flex: 1, padding: "20px", textAlign: "center", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px" }}>Access Denied: User Distribution</div>
        ) : (
          <DistributionChart data={distributionData} />
        )}
      </div>

      {/* Business Section */}
      {noAccessBizStats ? (
        <div style={{ padding: "20px", textAlign: "center", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px", marginTop: "20px" }}>Access Denied: Business Statistics</div>
      ) : (
        <BusinessStatsSection stats={businessStats} />
      )}

      {/* Leads Section */}
      {noAccessLeadStats ? (
        <div style={{ padding: "20px", textAlign: "center", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px", marginTop: "20px" }}>Access Denied: Lead Statistics</div>
      ) : (
        <LeadStatsSection stats={leadStats} />
      )}
    </div>
  );
};

export default AnalyticsV2;
