import React from "react";
import styles from "../AnalyticsV2.module.css";

interface StatChipItem {
  label: string;
  count: number | string;
  color?: string;
}

interface StatChipsProps {
  title: string;
  items: StatChipItem[];
  colors?: string[];
}

const StatChips: React.FC<StatChipsProps> = ({ title, items, colors }) => {
  const DEFAULT_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#ec4899"];

  return (
    <div className={styles.detailRow}>
      <span className={styles.rowLabel}>{title}</span>
      <div className={styles.pillsContainer}>
        {items.map((item, i) => (
          <div key={item.label} className={styles.pill}>
            <div 
              className={styles.dot} 
              style={{ backgroundColor: item.color || colors?.[i % (colors?.length || 1)] || DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} 
            />
            <span>{item.label}</span>
            <span className={styles.pillValue}>{String(item.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatChips;
