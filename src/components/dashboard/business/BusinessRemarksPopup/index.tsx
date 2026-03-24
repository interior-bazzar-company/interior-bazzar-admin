import React, { useState } from "react";
import styles from "./BusinessRemarksPopup.module.css";
import { useModal } from "../../../../context/ModalContext";
import useToast from "../../../shared/Toast/useToast";
import { AdminBusinessDashboardService } from "../../../../api/modules/admin/adminBusinessDashboard";

interface BusinessRemarksPopupProps {
  businessId: number | string;
  currentRemark?: string;
  onSuccess?: () => void;
}

/**
 * BusinessRemarksPopup — NEW component for Business Dashboard.
 * Existing Lead/RemarksPopup is NOT modified.
 * To revert: just stop importing this component.
 */
const BusinessRemarksPopup: React.FC<BusinessRemarksPopupProps> = ({
  businessId,
  currentRemark = "",
  onSuccess,
}) => {
  const { closeModal } = useModal();
  const { showToast } = useToast();
  const [remarkText, setRemarkText] = useState(currentRemark);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await AdminBusinessDashboardService.updateBusinessRemark(
        Number(businessId),
        remarkText
      );

      if (res.response) {
        showToast({
          greeting: "Success",
          booldMessage: "Saved",
          normalMessage: "Remark updated successfully",
          type: "success",
        });
        if (onSuccess) onSuccess();
        closeModal();
      } else {
        showToast({
          greeting: "Error",
          booldMessage: "Failed",
          normalMessage: "Could not update remark",
          type: "error",
        });
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
    <div className={styles.popupOverlay}>
      <div className={styles.popupContent}>
        <div className={styles.popupHeader}>
          <h2 className={styles.popupTitle}>
            <strong>Remarks ?</strong> On going update to improve conversion
          </h2>
        </div>

        <textarea
          className={styles.remarkTextarea}
          value={remarkText}
          onChange={(e) => setRemarkText(e.target.value)}
          placeholder="Add a remark..."
        />

        <div className={styles.actions}>
          <button onClick={closeModal} className={styles.cancelBtn}>
            Cancel
          </button>
          <button onClick={handleSave} className={styles.saveBtn} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessRemarksPopup;
