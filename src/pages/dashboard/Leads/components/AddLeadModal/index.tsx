import React, { useState } from "react";
import styles from "./AddLeadModal.module.css";
import { AdminService } from "../../../../api/modules/admin";

interface AddLeadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    interested: "",
    query: "",
    city: "",
    state: "",
    country: "India",
    leadStatus: "New",
    stage: "New Lead",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await AdminService.createLead(formData);
      if (res.response) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error creating lead:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Add New Lead</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label>Name*</label>
            <input name="name" value={formData.name} onChange={handleChange} required placeholder="Full Name" />
          </div>
          <div className={styles.field}>
            <label>Phone*</label>
            <input name="phone" value={formData.phone} onChange={handleChange} required placeholder="Phone Number" />
          </div>
        </div>

        <div className={styles.field}>
          <label>Email</label>
          <input name="email" value={formData.email} onChange={handleChange} placeholder="Email Address" />
        </div>

        <div className={styles.field}>
          <label>Interested In</label>
          <input name="interested" value={formData.interested} onChange={handleChange} placeholder="Category (e.g. Interior Design)" />
        </div>

        <div className={styles.field}>
          <label>Query / Message</label>
          <textarea name="query" value={formData.query} onChange={handleChange} placeholder="Detailed query" rows={3} />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label>City</label>
            <input name="city" value={formData.city} onChange={handleChange} placeholder="City" />
          </div>
          <div className={styles.field}>
            <label>State</label>
            <input name="state" value={formData.state} onChange={handleChange} placeholder="State" />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label>Status</label>
            <select name="leadStatus" value={formData.leadStatus} onChange={handleChange}>
               <option value="New">New</option>
               <option value="Assigned">Assigned</option>
               <option value="In Progress">In Progress</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Stage</label>
            <select name="stage" value={formData.stage} onChange={handleChange}>
               <option value="New Lead">New Lead</option>
               <option value="Contacted">Contacted</option>
               <option value="Qualified">Qualified</option>
            </select>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>Cancel</button>
          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? "Creating..." : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddLeadModal;
