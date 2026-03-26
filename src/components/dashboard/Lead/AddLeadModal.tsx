import React, { useState } from "react";
import styles from "./AddLeadModal.module.css";
import { useModal } from "../../../context/ModalContext";
import useToast from "../../shared/Toast/useToast";
import { AdminService } from "../../../api/modules/admin";
import { LEAD_STATUS, STAGES } from "../../../utils/constants/lead";

interface AddLeadModalProps {
  onSuccess?: () => void;
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ onSuccess }) => {
  const { closeModal } = useModal();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    interested: "",
    query: "",
    city: "",
    state: "",
    country: "India",
    leadStatus: LEAD_STATUS[0],
    stage: STAGES[0],
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      showToast({ 
        greeting: "Warning", 
        booldMessage: "Incomplete Form", 
        normalMessage: "Name and Phone are required", 
        type: "error" 
      });
      return;
    }

    if (formData.phone.length < 7 || formData.phone.length > 15 || !/^\d+$/.test(formData.phone)) {
      showToast({ 
        greeting: "Warning", 
        booldMessage: "Invalid Phone", 
        normalMessage: "Phone must contain 7-15 digits only", 
        type: "error" 
      });
      return;
    }

    try {
      setLoading(true);
      
      // Align with AdminLeadsCreateSchema
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
      };
      
      const res = await AdminService.createLead(payload);
      
      let apiRes: any = res;
      if (Array.isArray(res) && res.length > 0) {
        apiRes = res[0];
      }

      if (apiRes.response) {
         showToast({ 
           greeting: "Success", 
           booldMessage: "Created", 
           normalMessage: "Lead created successfully", 
           type: "success" 
         });
         if (onSuccess) onSuccess();
         closeModal();
      } else {
         showToast({ 
           greeting: "Error", 
           booldMessage: "Failed", 
           normalMessage: apiRes.message || "Could not create lead", 
           type: "error" 
         });
      }
    } catch (e: any) {
      showToast({ 
        greeting: "Error", 
        booldMessage: "Failed", 
        normalMessage: e.message || "Failed to create lead", 
        type: "error" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalContent}>
      <h2 className={styles.modalTitle}>Add New Lead</h2>
      <div className={styles.formGrid}>
         <div className={styles.formGroup}>
           <label>Name</label>
           <input 
             name="name" 
             placeholder="Full Name"
             value={formData.name} 
             onChange={handleChange} 
             className={styles.input} 
           />
         </div>
         
         <div className={styles.formGroup}>
           <label>Phone</label>
           <input 
             name="phone" 
             placeholder="Phone Number"
             value={formData.phone} 
             onChange={handleChange} 
             className={styles.input} 
           />
         </div>

         <div className={styles.formGroup}>
           <label>Email Address</label>
           <input 
             name="email" 
             type="email"
             placeholder="email@example.com"
             value={formData.email} 
             onChange={handleChange} 
             className={styles.input} 
           />
         </div>

         <div className={styles.formGroup}>
           <label>Interested In</label>
           <input 
             name="interested" 
             placeholder="e.g. Interior Design"
             value={formData.interested} 
             onChange={handleChange} 
             className={styles.input} 
           />
         </div>

         <div className={`${styles.formGroup} ${styles.fullWidth}`}>
           <label>Query / Requirements</label>
           <textarea 
             name="query" 
             placeholder="Detailed requirements..."
             value={formData.query} 
             onChange={handleChange} 
             className={styles.textarea} 
           />
         </div>

         <div className={styles.formGroup}>
           <label>City</label>
           <input 
             name="city" 
             placeholder="City"
             value={formData.city} 
             onChange={handleChange} 
             className={styles.input} 
           />
         </div>

         <div className={styles.formGroup}>
           <label>State</label>
           <input 
             name="state" 
             placeholder="State"
             value={formData.state} 
             onChange={handleChange} 
             className={styles.input} 
           />
         </div>

         <div className={styles.formGroup}>
           <label>Country</label>
           <input 
             name="country" 
             placeholder="Country"
             value={formData.country} 
             onChange={handleChange} 
             className={styles.input} 
           />
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




      </div>
      
      <div className={styles.actions}>
         <button onClick={closeModal} className={styles.cancelBtn}>Cancel</button>
         <button onClick={handleSave} className={styles.saveBtn} disabled={loading}>
           {loading ? 'Creating...' : 'Create Lead'}
         </button>
      </div>
    </div>
  );
};

export default AddLeadModal;
