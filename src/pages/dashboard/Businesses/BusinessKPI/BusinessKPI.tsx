import styles from "./BusinessKPI.module.css";
import type { DashboardStatsType } from "../../../../types/content";

type Props = {
  data: DashboardStatsType | null;
  selectedPlan?: string;
  onPlanClick?: (planName: string) => void;
};

export const BusinessKPI = ({ data, selectedPlan, onPlanClick }: Props) => {
  if (!data) return null;

  const planEntries = Object.entries(data.plan_metrics || {});

  return (
    <div className={styles.container}>
      {/* Top KPI Cards */}
      <div className={styles.kpiRow}>
        <div className={`${styles.card} ${styles.primary}`}>
          <p className={styles.cardTitle}>Total business</p>
          <p className={styles.cardValue}>{data.totalBusinesses}</p>
        </div>

        <div className={styles.card}>
          <p className={styles.cardTitle}>Active</p>
          <p className={styles.cardValue}>{data.totalActiveBusinesses}</p>
        </div>

        <div className={styles.card}>
          <p className={styles.cardTitle}>Inactive</p>
          <p className={styles.cardValue}>{data.totalInactiveBusinesses}</p>
        </div>
      </div>

      {/* Plan Metrics Row */}
      {planEntries.length > 0 && (
        <div className={styles.planRow}>
          <p className={styles.planLabel}>Dedicated</p>

          <div className={styles.planList}>
            {planEntries.map(([plan, count]) => {
              const isActive = selectedPlan === plan;
              return (
                <div 
                  key={plan} 
                  className={`${styles.planChip} ${isActive ? styles.activePill : ""}`}
                  onClick={() => onPlanClick?.(plan)}
                  style={{ cursor: "pointer", border: isActive ? "2px solid #000" : undefined }}
                >
                  <span className={styles.dot} />
                  <span className={styles.planName}>{plan}</span>
                  <span className={styles.planCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessKPI;
