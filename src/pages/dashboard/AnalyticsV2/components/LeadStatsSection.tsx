import React from "react";
import styles from "../AnalyticsV2.module.css";
import StatCard from "./StatCard";
import StatChips from "./StatChips";
import type { LeadsDashboardStatsType } from "../../../../types/content";

interface LeadStatsSectionProps {
  stats: LeadsDashboardStatsType | null;
}

const LeadStatsSection: React.FC<LeadStatsSectionProps> = ({ stats }) => {
  const categoryItems = [
    { label: "Residential", count: 50, color: "#f59e0b" },
    { label: "Commercial", count: 30, color: "#8b5cf6" }
  ];

  const statusItems = Object.entries(stats?.statusMetrics || {}).map(([name, count]) => ({
    label: name,
    count: String(count)
  }));

  const filterItems = Object.entries(stats?.stageMetrics || {}).map(([name, count]) => ({
    label: name,
    count: String(count)
  }));

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Leads</h2>
      <div className={styles.kpiRow}>
        <StatCard label="Total Leads" value={stats?.totalLeads || 0} isBlack />
        <StatCard label="Platform Leads" value={stats?.platformLeads || 0} />
        <StatCard label="Generative Leads" value={stats?.unassignedLeads || 0} />
      </div>

      <div className={styles.detailsGrid}>
        <StatChips title="Category" items={categoryItems} />
        <StatChips title="Lead status" items={statusItems} />
        <StatChips title="Filter status" items={filterItems} />
      </div>
    </div>
  );
};

export default LeadStatsSection;
