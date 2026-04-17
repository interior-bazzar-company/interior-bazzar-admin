import React, { useState } from "react";
import type { GMBLeadType } from "../../../../types/content/gmbLeads";
import { useModal } from "../../../../context/ModalContext";
import { useAlert } from "../../../../context/AlertContext";
import { GMBService } from "../../../../api/modules/gmbLeads";
import { LEADSTATUS } from "../../../../utils/constants/app";
import styles from "../GMBLeads.module.css";
import modalStyles from "../../../../components/dashboard/Lead/UpdateLeadModal.module.css";

interface LeadDetailsModalProps {
  lead: GMBLeadType;
  onSuccess?: () => void;
  readOnly?: boolean;
}

const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({ lead, onSuccess, readOnly = false }) => {
  const { closeModal } = useModal();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [remark, setRemark] = useState(lead.remark || "");
  const [status, setStatus] = useState(lead.status || "New");

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await GMBService.updateLead(lead.id, { remark, status });
      if (res.response) {
        showAlert("Lead updated successfully", "success");
        if (onSuccess) onSuccess();
        closeModal();
      }
    } catch (error) {
      showAlert("Failed to update lead", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={modalStyles.modalContent} style={{ maxWidth: '800px' }}>
      <h2 className={modalStyles.modalTitle}>{readOnly ? "Lead Details" : "Update Lead"}</h2>
      
      <div className={modalStyles.formGrid}>
        <div className={modalStyles.formGroup}>
          <label>Business Name</label>
          <input className={modalStyles.input} value={lead.businessName} readOnly />
        </div>
        <div className={modalStyles.formGroup}>
          <label>Phone</label>
          <input className={modalStyles.input} value={lead.phone || "--"} readOnly />
        </div>
        <div className={modalStyles.formGroup}>
          <label>Platform</label>
          <input className={modalStyles.input} value={lead.platform || "GMB"} readOnly />
        </div>
        <div className={modalStyles.formGroup}>
          <label>Status</label>
          <select 
            className={modalStyles.select} 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            disabled={readOnly}
          >
            {Object.values(LEADSTATUS).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className={`${modalStyles.formGroup} ${modalStyles.fullWidth}`}>
          <label>Address</label>
          <textarea className={modalStyles.textarea} value={lead.address || "--"} readOnly style={{ minHeight: '60px' }} />
        </div>
        <div className={`${modalStyles.formGroup} ${modalStyles.fullWidth}`}>
          <label>Remark</label>
          <textarea 
            className={modalStyles.textarea} 
            value={remark} 
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Add internal remarks..."
            disabled={readOnly}
            style={{ minHeight: '80px' }}
          />
        </div>

        <div className={`${modalStyles.formGroup} ${modalStyles.fullWidth}`}>
          <label>Digital Footprint (Logs)</label>
          <div className={modalStyles.logsSection}>
            <table className={modalStyles.logsTable}>
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Event</th>
                  <th style={{ width: '150px' }}>Date</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {lead.logs && lead.logs.length > 0 ? (
                  lead.logs.map((log, idx) => (
                    <tr key={idx}>
                      <td>{log.event}</td>
                      <td>{log.timestamp}</td>
                      <td>{log.triggered_by || "System"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '12px', color: '#6b7280' }}>No logs found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={modalStyles.actions}>
        <button onClick={closeModal} className={modalStyles.cancelBtn}>
          {readOnly ? "Close" : "Cancel"}
        </button>
        {!readOnly && (
          <button onClick={handleSave} className={modalStyles.saveBtn} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
};

export default LeadDetailsModal;
