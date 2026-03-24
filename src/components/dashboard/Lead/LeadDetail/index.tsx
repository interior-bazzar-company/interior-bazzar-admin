// LeadDetail.tsx

import type { AdminLeadType } from "../../../../types/content";
import styles from "./LeadDetail.module.css";

const LeadDetail = ({ lead }: { lead: AdminLeadType }) => {
    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h3 className={styles.heading}>Lead Details</h3>
                <span className={styles.id}>#{lead.id}</span>
            </div>
            <div className={styles.content}>
                <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                        <label>Name</label>
                        <p>{lead.name || "--"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Phone</label>
                        <p>{lead.phone || "--"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Email</label>
                        <p>{lead.email || "--"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Interested In</label>
                        <p>{lead.interested || "--"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Status</label>
                        <p className={styles.statusBadge}>{lead.leadStatus || "New"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Stage</label>
                        <p>{lead.stage || "Discovery"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Type</label>
                        <p>{lead.type || "Service"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Item ID</label>
                        <p>{lead.itemId || "--"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Location</label>
                        <p>{lead.city || "--"}, {lead.country || "--"}</p>
                    </div>
                    <div className={styles.infoItem}>
                        <label>Assigned To</label>
                        <p>{lead.assigned || "Unassigned"}</p>
                    </div>
                </div>
                <div className={styles.querySection}>
                    <label>Query / Requirement</label>
                    <p>{lead.query || "--"}</p>
                </div>
            </div>
        </div>
    );
};

export default LeadDetail;
