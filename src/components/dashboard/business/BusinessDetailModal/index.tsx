import React from "react";
import styles from "./BusinessDetailModal.module.css";
import type { AdminBusinessListTypeV2 } from "../../../../types/content";

interface BusinessDetailModalProps {
  business: AdminBusinessListTypeV2;
}

const BusinessDetailModal: React.FC<BusinessDetailModalProps> = ({ business }) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.heading}>Business Details</h3>
        <span className={styles.id}>#{business.id}</span>
      </div>
      <div className={styles.content}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <label>Business Name</label>
            <p>{business.name || "--"}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Joined At</label>
            <p>{business.joinAt || "--"}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Current Plan</label>
            <p className={styles.planBadge}>{business.plan || "--"}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Last Purchase</label>
            <p>{business.lastPurchase || "--"}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Expiry Date</label>
            <p>{business.expire || "--"}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Lead Kota</label>
            <p>{business.leadsKota || 0}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Assigned Leads</label>
            <p>{business.assignedLeads || 0}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Platform Leads</label>
            <p>{business.platformLeads || 0}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Total Leads</label>
            <p>{business.totalLeads || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessDetailModal;
