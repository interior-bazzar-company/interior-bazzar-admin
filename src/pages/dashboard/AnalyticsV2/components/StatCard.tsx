import React from "react";
import styles from "../AnalyticsV2.module.css";

interface StatCardProps {
  label: string;
  value: number | string;
  isBlack?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, isBlack }) => {
  return (
    <div className={`${styles.kpiCard} ${isBlack ? styles.black : ""}`}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
    </div>
  );
};

export default StatCard;
