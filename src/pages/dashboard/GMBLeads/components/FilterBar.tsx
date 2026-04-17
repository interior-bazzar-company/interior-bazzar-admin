import React from "react";
import styles from "../GMBLeads.module.css";
import { LEADSTATUS } from "../../../../utils/constants/app";

interface FilterBarProps {
  filters: {
    city: string;
    min_rating: string;
    status: string;
    platform: string;
  };
  handleFilterClick: (key: string, value: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, handleFilterClick }) => {
  const PLATFORMS = ["GMB", "Yelp", "YellowPages"];
  const RATINGS = ["4.5", "4.0", "3.5", "3.0"];

  return (
    <div className={styles.filtersSection}>
      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Platform</span>
        <div className={styles.chipsContainer}>
          {PLATFORMS.map((platform) => (
            <button
              key={platform}
              className={`${styles.filterChip} ${filters.platform === platform ? styles.activeChip : ""}`}
              onClick={() => handleFilterClick("platform", platform)}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Status</span>
        <div className={styles.chipsContainer}>
          {Object.values(LEADSTATUS).map((status) => (
            <button
              key={status}
              className={`${styles.filterChip} ${filters.status === status ? styles.activeChip : ""}`}
              onClick={() => handleFilterClick("status", status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.filterRow}>
        <span className={styles.filterTitle}>Min Rating</span>
        <div className={styles.chipsContainer}>
          {RATINGS.map((rating) => (
            <button
              key={rating}
              className={`${styles.filterChip} ${filters.min_rating === rating ? styles.activeChip : ""}`}
              onClick={() => handleFilterClick("min_rating", rating)}
            >
              {rating}+ ⭐
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
