import React, { useState } from "react";
import styles from "./UpdateLeadModal.module.css";
import type { AdminLeadType } from "../../../types/content";
import { useModal } from "../../../context/ModalContext";
import useToast from "../../shared/Toast/useToast";
import { AdminService } from "../../../api/modules/admin";
import { LEAD_STATUS, STAGES } from "../../../utils/constants/lead";

interface UpdateLeadModalProps {
  lead: AdminLeadType;
  onSuccess?: (updatedLead?: AdminLeadType) => void;
}

const UpdateLeadModal: React.FC<UpdateLeadModalProps> = ({ lead, onSuccess }) => {
  const { closeModal } = useModal();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    interested: lead.interested || "",
    query: lead.query || "",
    leadStatus: lead.leadStatus || LEAD_STATUS[0],
    stage: lead.stage || STAGES[0],
    city: lead.city || "",
    state: lead.state || "",
    country: lead.country || "India",
    type: lead.type || "service",
    itemId: lead.itemId ? String(lead.itemId) : ""
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // Constructing data to send. Make sure it matches API expectations if they exist.
      // Align with AdminLeadsUpdateSchema
      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        interested: formData.interested || undefined,
        query: formData.query || undefined,
        leadStatus: formData.leadStatus || undefined,
        stage: formData.stage || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        country: formData.country || undefined,
        type: formData.type || undefined,
        itemId: formData.itemId ? parseInt(formData.itemId) : undefined
      };
      
      const res = await AdminService.updateQuery(lead.id, payload);
      
      let apiRes: any = res;
      if (Array.isArray(res) && res.length > 0) {
        apiRes = res[0];
      }

      if (apiRes.response) {
         showToast({ greeting: "Success", booldMessage: "Saved", normalMessage: "Lead updated successfully", type: "success" });
         if (onSuccess) onSuccess(apiRes.data);
         closeModal();
      } else {
         showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: "Could not update lead", type: "error" });
      }
    } catch (e: any) {
      if (e.message && e.message.toLowerCase().includes("access not granted")) {
          showToast({ greeting: "Error", booldMessage: "Access Denied", normalMessage: "Access not granted", type: "error" });
      } else if (e.code === 403) {
          showToast({ greeting: "Error", booldMessage: "Access Denied", normalMessage: "Access not granted", type: "error" });
      } else {
          showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: e.message || "Failed to update lead", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalContent}>
      <h2 className={styles.modalTitle}>Update Status</h2>
      <div className={styles.formGrid}>
         <div className={styles.formGroup}>
           <label>Name</label>
           <input name="name" value={formData.name} onChange={handleChange} className={styles.input} />
         </div>
         
         <div className={styles.formGroup}>
           <label>Phone</label>
           <input name="phone" value={formData.phone} onChange={handleChange} className={styles.input} />
         </div>

         <div className={styles.formGroup}>
           <label>Mail address</label>
           <input name="email" value={formData.email} onChange={handleChange} className={styles.input} />
         </div>

         <div className={styles.formGroup}>
           <label>Interested in</label>
           <input name="interested" value={formData.interested} onChange={handleChange} className={styles.input} />
         </div>

          <div className={styles.formGroup}>
            <label>Lead Status</label>
            <select name="leadStatus" value={formData.leadStatus} onChange={handleChange} className={styles.select}>
              {LEAD_STATUS.map(status => (
                 <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Funnel Stage</label>
            <select name="stage" value={formData.stage} onChange={handleChange} className={styles.select}>
              {STAGES.map(stage => (
                 <option key={stage} value={stage}>{stage.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
              ))}
            </select>
          </div>

          {/* <div className={styles.formGroup}>
            <label>Type</label>
            <select name="type" value={formData.type} onChange={handleChange} className={styles.select}>
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="catalogue">Catalogue</option>
            </select>
          </div> */}

          <div className={styles.formGroup}>
            <label>City</label>
            <input name="city" value={formData.city} onChange={handleChange} className={styles.input} />
          </div>

          <div className={styles.formGroup}>
            <label>State</label>
            <input name="state" value={formData.state} onChange={handleChange} className={styles.input} />
          </div>

          <div className={styles.formGroup}>
            <label>Country</label>
            <input name="country" value={formData.country} onChange={handleChange} className={styles.input} />
          </div>

          {/* <div className={styles.formGroup}>
            <label>Item ID (Optional)</label>
            <input 
              name="itemId" 
              type="number"
              value={formData.itemId} 
              onChange={handleChange} 
              className={styles.input} 
            />
          </div> */}

         <div className={styles.formGroup}>
           <label>Query</label>
           <textarea name="query" value={formData.query} onChange={handleChange} className={styles.textarea} />
         </div>
      </div>
      
      <div className={styles.actions}>
         <button onClick={closeModal} className={styles.cancelBtn}>Cancel</button>
         <button onClick={handleSave} className={styles.saveBtn} disabled={loading}>
           {loading ? 'Saving...' : 'Save'}
         </button>
      </div>
    </div>
  );
};

export default UpdateLeadModal;
