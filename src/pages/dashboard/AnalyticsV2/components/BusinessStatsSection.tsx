import React from "react";
import styles from "../AnalyticsV2.module.css";
import StatCard from "./StatCard";
import StatChips from "./StatChips";
import type { DashboardV2Type } from "../../../../types/content";

interface BusinessStatsSectionProps {
  stats: DashboardV2Type | null;
}

const BusinessStatsSection: React.FC<BusinessStatsSectionProps> = ({ stats }) => {
  const planItems = Object.entries(stats?.plan_metrics || {}).map(([name, count]) => ({
    label: name,
    count: String(count)
  }));

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Business</h2>
      <div className={styles.kpiRow}>
        <StatCard label="Total business" value={stats?.totalBusinesses || 0} isBlack />
        <StatCard label="Registered" value={stats?.weeklySignups || 0} />
        <StatCard label="Plan purchased" value={stats?.totalActiveBusinesses || 0} />
        <StatCard label="Network Leader" value={stats?.totalActiveBusinesses || 0} />
      </div>

      <StatChips title="Dedicated" items={planItems} />
    </div>
  );
};

export default BusinessStatsSection;
