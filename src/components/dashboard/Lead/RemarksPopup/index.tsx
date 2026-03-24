import React, { useState } from "react";
import styles from "./RemarksPopup.module.css";
import { useModal } from "../../../../context/ModalContext";
import useToast from "../../../shared/Toast/useToast";
import { AdminService } from "../../../../api/modules/admin";

interface RemarksPopupProps {
  leadId: number | string;
  currentRemark?: string;
  logs?: any[];
  onSuccess?: () => void;
}

const RemarksPopup: React.FC<RemarksPopupProps> = ({ leadId, currentRemark = "", logs = [], onSuccess }) => {
  const { closeModal } = useModal();
  const { showToast } = useToast();
  const [remarkText, setRemarkText] = useState(currentRemark);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await AdminService.updateQuery(Number(leadId), { remark: remarkText });
      
      if (res.response) {
         showToast({ greeting: "Success", booldMessage: "Saved", normalMessage: "Remark updated successfully", type: "success" });
         if (onSuccess) onSuccess();
         closeModal();
      } else {
         showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: "Could not update remark", type: "error" });
      }
    } catch (e: any) {
      if (e.message && e.message.toLowerCase().includes("access not granted")) {
          showToast({ greeting: "Error", booldMessage: "Access Denied", normalMessage: "Access not granted", type: "error" });
      } else if (e.code === 403) {
          showToast({ greeting: "Error", booldMessage: "Access Denied", normalMessage: "Access not granted", type: "error" });
      } else {
          showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: e.message || "Failed to update remark", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.popupContent}>
      <div className={styles.popupHeader}>
        <h2 className={styles.popupTitle}>
          <strong>Remarks ?</strong> On going update is improve conversion 20%
        </h2>
      </div>
      
      <textarea 
        className={styles.remarkTextarea} 
        value={remarkText}
        onChange={(e) => setRemarkText(e.target.value)}
        placeholder="Enter your remarks here..."
      />
      
      <table className={styles.logsTable} style={{ marginTop: '16px' }}>
        <tbody>
          {logs.length > 0 ? (
            logs.map((log, idx) => (
              <tr key={idx}>
                <td width="30%">{log.created}</td>
                <td>{log.desc}</td>
              </tr>
            ))
          ) : (
             // Render empty slots to match design
            Array.from({ length: 4 }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td width="30%">&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      <div className={styles.actions}>
         <button onClick={closeModal} className={styles.cancelBtn}>Cancel</button>
         <button onClick={handleSave} className={styles.saveBtn} disabled={loading}>
           {loading ? 'Saving...' : 'Save'}
         </button>
      </div>
    </div>
  );
};

export default RemarksPopup;
