import React, { useState } from "react";
import styles from "./UpdateLeadModal.module.css";
import type { AdminLeadType } from "../../../types/content";
import { useModal } from "../../../context/ModalContext";
import { useAlert } from "../../../context/AlertContext";
import { AdminService } from "../../../api/modules/admin";
import { LEAD_STATUS, STAGES } from "../../../utils/constants/lead";

interface UpdateLeadModalProps {
  lead: AdminLeadType;
  onSuccess?: (updatedLead?: AdminLeadType) => void;
}

const UpdateLeadModal: React.FC<UpdateLeadModalProps> = ({ lead, onSuccess }) => {
  const { closeModal } = useModal();
  const { showAlert } = useAlert();
  
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
  });

  const existingClientLogs = lead.clientLogs || [];
  const [newLogs, setNewLogs] = useState<{by: string; message: string}[]>([]);
  const [newLogBy, setNewLogBy] = useState("business");
  const [newLogMessage, setNewLogMessage] = useState("");

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
        clientLogs: newLogs.length > 0 ? newLogs : undefined
      };
      
      const res = await AdminService.updateQuery(lead.id, payload);
      
      let apiRes: any = res;
      if (Array.isArray(res) && res.length > 0) {
        apiRes = res[0];
      }

      if (apiRes.response) {
         showAlert("Lead updated successfully", "success");
         if (onSuccess) onSuccess(apiRes.data);
         closeModal();
      } else {
         showAlert("Could not update lead", "error");
      }
    } catch (e: any) {
      if (e.message && e.message.toLowerCase().includes("access not granted")) {
          showAlert("Access not granted", "error");
      } else if (e.code === 403) {
          showAlert("Access not granted", "error");
      } else {
          showAlert(e.message || "Failed to update lead", "error");
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

          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label>Query</label>
            <textarea name="query" value={formData.query} onChange={handleChange} className={styles.textarea} />
          </div>

          {/* Client Logs Section */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label>Client Logs</label>
            
            <div className={styles.logsSection}>
              <table className={styles.logsTable}>
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>By</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {existingClientLogs.length === 0 && newLogs.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center", color: "var(--notion-text-muted)" }}>
                        No logs available
                      </td>
                    </tr>
                  ) : null}

                  {/* Render existing logs initially sent from backend */}
                  {existingClientLogs.map((log, idx) => (
                    <tr key={`existing-${idx}`}>
                      <td>{log.by === 'business' ? 'Business' : 'Client'}</td>
                      <td>{log.message}</td>
                    </tr>
                  ))}

                  {/* Render newly added logs */}
                  {newLogs.map((log, idx) => (
                    <tr key={`new-${idx}`}>
                      <td>
                         <span style={{ color: 'var(--notion-text-muted)', fontSize: '12px', marginRight: '4px' }}>[New]</span>
                         {log.by === 'business' ? 'Business' : 'Client'}
                      </td>
                      <td>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className={styles.addLogContainer}>
                 <select 
                   value={newLogBy} 
                   onChange={(e) => setNewLogBy(e.target.value)} 
                   className={styles.select}
                   style={{ width: '120px' }}
                 >
                   <option value="business">Business</option>
                   <option value="client">Client</option>
                 </select>
                 <input 
                   type="text" 
                   placeholder="Add a new log message..." 
                   value={newLogMessage}
                   onChange={(e) => setNewLogMessage(e.target.value)}
                   className={styles.input}
                   style={{ flex: 1 }}
                 />
                 <button 
                   type="button" 
                   className={styles.addLogBtn} 
                   onClick={() => {
                     if (newLogMessage.trim()) {
                       setNewLogs([...newLogs, { by: newLogBy, message: newLogMessage }]);
                       setNewLogMessage("");
                     }
                   }}
                 >
                   Add Log
                 </button>
              </div>
            </div>
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
