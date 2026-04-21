import React from "react";
import styles from "../GMBLeads.module.css";
import type { GMBKPIDataType } from "../../../../types/content/gmbLeads";

interface FilterBarProps {
  filters: {
    city: string;
    state: string;
    min_rating: string;
    status: string;
    platform: string;
  };
  kpis: GMBKPIDataType | null;
  handleFilterClick: (key: string, value: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, kpis, handleFilterClick }) => {
  const PLATFORMS = kpis?.platform || [];
  const STATUSES = kpis?.status || [];
  const CITIES = kpis?.city || [];
  const STATES = kpis?.state || [];
  const HARDCODED_RATINGS = ["3.0", "3.5", "4.0", "4.5"];

  return (
    <div className={styles.filtersSection}>
      {/* Dropdowns for City & State */}
      <div className={styles.dropDownRow}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className={styles.filterTitle}>State Filter</label>
          <select 
            className={styles.filterSelect}
            value={filters.state}
            onChange={(e) => handleFilterClick("state", e.target.value)}
          >
            <option value="">All States</option>
            {STATES.map(s => (
              <option key={s.value} value={s.value}>{s.label} ({s.count})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label className={styles.filterTitle}>City Filter</label>
          <select 
            className={styles.filterSelect}
            value={filters.city}
            onChange={(e) => handleFilterClick("city", e.target.value)}
          >
            <option value="">All Cities</option>
            {CITIES.map(c => (
              <option key={c.value} value={c.value}>{c.label} ({c.count})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chips for Platform, Status, Rating */}
      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Platform</span>
        <div className={styles.chipsContainer}>
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              className={`${styles.filterChip} ${filters.platform === p.value ? styles.activeChip : ""}`}
              onClick={() => handleFilterClick("platform", p.value)}
            >
              {p.label} <span style={{fontSize: '10px', opacity: 0.7, marginLeft: '4px'}}>({p.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Status</span>
        <div className={styles.chipsContainer}>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              className={`${styles.filterChip} ${filters.status === s.value ? styles.activeChip : ""}`}
              onClick={() => handleFilterClick("status", s.value)}
            >
              {s.label} <span style={{fontSize: '10px', opacity: 0.7, marginLeft: '4px'}}>({s.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Min Rating</span>
        <div className={styles.chipsContainer}>
          {HARDCODED_RATINGS.map((r) => (
            <button
              key={r}
              className={`${styles.filterChip} ${filters.min_rating === r ? styles.activeChip : ""}`}
              onClick={() => handleFilterClick("min_rating", r)}
            >
              {r}+ ⭐
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
