import React, { useState } from "react";
import styles from "../../../../components/dashboard/Lead/AddLeadModal.module.css";
import { useModal } from "../../../../context/ModalContext";
import { useAlert } from "../../../../context/AlertContext";
import { GMBService } from "../../../../api/modules/gmbLeads";
import { MdBusiness, MdPhone, MdStar, MdPlace, MdLanguage, MdLabel, MdCategory, MdLink } from "react-icons/md";

interface AddGMBLeadModalProps {
  onSuccess?: () => void;
}

const AddGMBLeadModal: React.FC<AddGMBLeadModalProps> = ({ onSuccess }) => {
  const { closeModal } = useModal();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    businessName: "",
    phone: "",
    rating: "",
    address: "",
    website: "",
    map_link: "",
    category: "",
    platform: "GMB",
    remark: ""
  });

  const [socialLinks, setSocialLinks] = useState<string[]>([]);
  const [newSocialLink, setNewSocialLink] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleAddSocial = () => {
    if (newSocialLink.trim()) {
      setSocialLinks([...socialLinks, newSocialLink.trim()]);
      setNewSocialLink("");
    }
  };

  const removeSocial = (idx: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!formData.businessName) {
      showAlert("Business Name is required", "error");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        socialLinks: socialLinks.length > 0 ? socialLinks : undefined
      };

      const res = await GMBService.createLead(payload);
      if (res.response) {
        showAlert("Lead added successfully", "success");
        if (onSuccess) onSuccess();
        closeModal();
      } else {
        showAlert(res.message || "Failed to add lead", "error");
      }
    } catch (error: any) {
      showAlert(error.message || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalContent} style={{ width: '60vw', maxWidth: '800px' }}>
      <h2 className={styles.modalTitle}>Add New GMB Lead</h2>
      
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>Business Name*</label>
          <div style={{ position: 'relative' }}>
            <MdBusiness style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input 
              name="businessName"
              className={styles.input} 
              style={{ paddingLeft: '35px' }} 
              value={formData.businessName}
              onChange={handleChange}
              placeholder="e.g. Dream Interiors"
            />
          </div>
          <span className={styles.helpText}>Full name as shown on Google Maps</span>
        </div>

        <div className={styles.formGroup}>
          <label>Phone</label>
          <div style={{ position: 'relative' }}>
            <MdPhone style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input 
              name="phone"
              className={styles.input} 
              style={{ paddingLeft: '35px' }} 
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 99999 00000"
            />
          </div>
          <span className={styles.helpText}>Primary contact number for the business</span>
        </div>

        <div className={styles.formGroup}>
          <label>Category</label>
          <div style={{ position: 'relative' }}>
            <MdCategory style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input 
              name="category"
              className={styles.input} 
              style={{ paddingLeft: '35px' }} 
              value={formData.category}
              onChange={handleChange}
              placeholder="Interior Designer"
            />
          </div>
          <span className={styles.helpText}>Industry or service category</span>
        </div>

        <div className={styles.formGroup}>
          <label>Platform</label>
          <div style={{ position: 'relative' }}>
            <MdLabel style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <select 
              name="platform"
              className={styles.input} 
              style={{ paddingLeft: '35px' }} 
              value={formData.platform}
              onChange={handleChange}
            >
              <option value="GMB">GMB</option>
              <option value="Website">Website</option>
              <option value="MY">MY</option>
              <option value="ADS">ADS</option>
            </select>
          </div>
          <span className={styles.helpText}>Source platform (default: GMB)</span>
        </div>

        <div className={styles.formGroup}>
          <label>Rating (e.g. 4.5(20))</label>
          <div style={{ position: 'relative' }}>
            <MdStar style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#f59e0b' }} />
            <input 
              name="rating"
              className={styles.input} 
              style={{ paddingLeft: '35px' }} 
              value={formData.rating}
              onChange={handleChange}
              placeholder="4.8(150)"
            />
          </div>
          <span className={styles.helpText}>Value followed by reviews in brackets</span>
        </div>

        <div className={styles.formGroup}>
          <label>Website</label>
          <div style={{ position: 'relative' }}>
            <MdLanguage style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input 
              name="website"
              className={styles.input} 
              style={{ paddingLeft: '35px' }} 
              value={formData.website}
              onChange={handleChange}
              placeholder="https://example.com"
            />
          </div>
          <span className={styles.helpText}>Official business website URL</span>
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label>Maps Link</label>
          <div style={{ position: 'relative' }}>
            <MdPlace style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#dc2626' }} />
            <input 
              name="map_link"
              className={styles.input} 
              style={{ paddingLeft: '35px' }} 
              value={formData.map_link}
              onChange={handleChange}
              placeholder="Google Maps URL"
            />
          </div>
          <span className={styles.helpText}>Direct URL to the business location</span>
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label>Address</label>
          <textarea 
            name="address"
            className={styles.textarea} 
            value={formData.address}
            onChange={handleChange}
            placeholder="Full physical address"
            style={{ minHeight: '60px' }}
          />
          <span className={styles.helpText}>Include city and PIN code</span>
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label>Remark</label>
          <textarea 
            name="remark"
            className={styles.textarea} 
            value={formData.remark}
            onChange={handleChange}
            placeholder="Internal notes..."
            style={{ minHeight: '60px' }}
          />
          <span className={styles.helpText}>Internal notes or context for this lead</span>
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label>Social Links</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input 
              className={styles.input} 
              value={newSocialLink}
              onChange={(e) => setNewSocialLink(e.target.value)}
              placeholder="Add social link (FB, IG, etc.)"
              style={{ flex: 1 }}
            />
            <button 
              type="button" 
              onClick={handleAddSocial}
              style={{ padding: '0 15px', borderRadius: '4px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {socialLinks.map((link, idx) => (
              <div key={idx} style={{ background: '#f3f4f6', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MdLink /> {link.length > 30 ? link.substring(0, 30) + "..." : link}
                <span onClick={() => removeSocial(idx)} style={{ cursor: 'pointer', color: '#ef4444', fontWeight: 'bold', marginLeft: '4px' }}>×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={closeModal} className={styles.cancelBtn}>Cancel</button>
        <button onClick={handleSave} className={styles.saveBtn} disabled={loading}>
          {loading ? "Adding..." : "Add Lead"}
        </button>
      </div>
    </div>
  );
};

export default AddGMBLeadModal;
