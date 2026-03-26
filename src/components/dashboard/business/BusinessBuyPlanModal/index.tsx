import React, { useState } from "react";
import styles from "./BusinessBuyPlanModal.module.css";
import { useModal } from "../../../../context/ModalContext";
import useToast from "../../../shared/Toast/useToast";
import { AdminBusinessDashboardService } from "../../../../api/modules/admin/adminBusinessDashboard";

interface Props {
  planId: number;
  currentIntent?: string;
  onSuccess?: () => void;
}

const OPTIONS = ["sales", "website", "refrance"];

const BusinessBuyPlanModal: React.FC<Props> = ({ planId, currentIntent, onSuccess }) => {
  const { closeModal } = useModal();
  const { showToast } = useToast();
  // if currentIntent is valid use it, else default to "sales"
  const defaultIntent = currentIntent && OPTIONS.includes(currentIntent.toLowerCase())
    ? currentIntent.toLowerCase()
    : "sales";

  const [intent, setIntent] = useState(defaultIntent);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await AdminBusinessDashboardService.updateBusinessBuyPlan(planId, intent);

      if (res.response) {
        showToast({
          greeting: "Success",
          booldMessage: "Saved",
          normalMessage: "Buy Plan updated successfully",
          type: "success",
        });
        if (onSuccess) onSuccess();
        closeModal();
      } else {
        showToast({
          greeting: "Error",
          booldMessage: "Failed",
          normalMessage: "Could not update buy plan",
          type: "error",
        });
      }
    } catch (e: any) {
      if (e.message && e.message.toLowerCase().includes("access not granted")) {
        showToast({ greeting: "Error", booldMessage: "Access Denied", normalMessage: "Access not granted", type: "error" });
      } else if (e.code === 403) {
        showToast({ greeting: "Error", booldMessage: "Access Denied", normalMessage: "Access not granted", type: "error" });
      } else {
        showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: e.message || "Failed to update buy plan", type: "error" });
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
            <strong>Update Buy Plan</strong>
          </h2>
        </div>

        <select
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className={styles.dropdown}
          disabled={loading}
        >
          {OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <div className={styles.actions}>
          <button onClick={closeModal} className={styles.cancelBtn} disabled={loading}>
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

export default BusinessBuyPlanModal;
