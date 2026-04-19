import React, { useState } from "react";
import { MdStar, MdLanguage, MdPlace, MdCategory, MdTrendingUp, MdLayers, MdEvent, MdPhone, MdBusiness, MdLabel } from "react-icons/md";
import type { GMBLeadType } from "../../../../types/content/gmbLeads";
import { useModal } from "../../../../context/ModalContext";
import { useAlert } from "../../../../context/AlertContext";
import { GMBService } from "../../../../api/modules/gmbLeads";
import { LEADSTATUS } from "../../../../utils/constants/app";
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
  const [phone, setPhone] = useState(lead.phone || "");
  // const [city, setCity] = useState(lead.city || "");
  const [state, setState] = useState(lead.state || "");

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await GMBService.updateLead(lead.id, { remark, status, phone, state });
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

  const getSocialLabel = (url: string) => {
    if (url.includes("facebook.com")) return "Facebook";
    if (url.includes("instagram.com")) return "Instagram";
    if (url.includes("linkedin.com")) return "LinkedIn";
    if (url.includes("twitter.com") || url.includes("x.com")) return "Twitter";
    if (url.includes("youtube.com")) return "YouTube";
    if (url.includes("tiktok.com")) return "TikTok";
    return "Social";
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "--";
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className={modalStyles.modalContent} style={{ width: '100%' }}>
      <h2 className={modalStyles.modalTitle}>{readOnly ? "Lead Details" : "Update Lead"}</h2>

      <div style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '12px', marginBottom: '20px' }}>
        <div className={modalStyles.formGrid} style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' }}>
          {/* Row 1 & 2 */}
          <div className={modalStyles.formGroup}>
            <label>Business Name</label>
            <div style={{ position: 'relative' }}>
              <MdBusiness style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input className={modalStyles.input} style={{ paddingLeft: '35px' }} value={lead.businessName} readOnly title={lead.businessName} />
            </div>
          </div>
          <div className={modalStyles.formGroup}>
            <label>Phone</label>
            <div style={{ position: 'relative' }}>
              <MdPhone style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                className={modalStyles.input}
                style={{ paddingLeft: '35px' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                readOnly={readOnly}
              />
            </div>
          </div>
          {/* <div className={modalStyles.formGroup}>
            <label>Location (City)</label>
            <div style={{ position: 'relative' }}>
              <MdPlace style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input 
                className={modalStyles.input} 
                style={{ paddingLeft: '35px' }} 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                readOnly={readOnly}
                placeholder="City"
              />
            </div>
          </div> */}
          <div className={modalStyles.formGroup}>
            <label>State</label>
            <div style={{ position: 'relative' }}>
              <MdLayers style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                className={modalStyles.input}
                style={{ paddingLeft: '35px' }}
                value={state}
                onChange={(e) => setState(e.target.value)}
                readOnly={readOnly}
                placeholder="State"
              />
            </div>
          </div>
          <div className={modalStyles.formGroup}>
            <label>Rating & Reviews</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <MdStar color="#f59e0b" size={18} />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{lead.rating || lead.ratingValue || "0"}</span>
              <span style={{ color: '#6b7280', fontSize: '11px' }}>({lead.reviewCount || 0})</span>
            </div>
          </div>

          {/* Row 2 */}
          <div className={modalStyles.formGroup}>
            <label>Tier & Ranking</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 10px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <span title="Tier" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '12px' }}>
                <MdLayers color="#3b82f6" /> {lead.tier || "--"}
              </span>
              <span title="Ranking Rate" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '12px' }}>
                <MdTrendingUp color="#10b981" /> {lead.rankingRate ? `${(lead.rankingRate * 100).toFixed(1)}%` : "--"}
              </span>
            </div>
          </div>
          <div className={modalStyles.formGroup}>
            <label>Website</label>
            {lead.website ? (
              <a href={lead.website} target="_blank" rel="noreferrer" className={modalStyles.input} style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', height: '38px', fontSize: '13px' }}>
                <MdLanguage /> Web
              </a>
            ) : (
              <input className={modalStyles.input} value="--" readOnly />
            )}
          </div>
          <div className={modalStyles.formGroup}>
            <label>Map Link</label>
            {(lead.gmbLink || lead.mapLink) ? (
              <a href={lead.gmbLink || lead.mapLink} target="_blank" rel="noreferrer" className={modalStyles.input} style={{ color: '#dc2626', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', height: '38px', fontSize: '13px' }}>
                <MdPlace /> Map
              </a>
            ) : (
              <input className={modalStyles.input} value="--" readOnly />
            )}
          </div>
          <div className={modalStyles.formGroup}>
            <label>Status</label>
            <select
              className={modalStyles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={readOnly}
              style={{ height: '38px', fontSize: '13px' }}
            >
              {Object.values(LEADSTATUS).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className={modalStyles.formGroup}>
            <label>Assigned To</label>
            <input className={modalStyles.input} value={lead.assignedUser ? (typeof lead.assignedUser === 'object' ? lead.assignedUser.name : lead.assignedUser) : "None"} readOnly style={{ fontSize: '13px' }} />
          </div>

          {/* Row 3 */}
          <div className={modalStyles.formGroup}>
            <label>Category</label>
            <div style={{ position: 'relative' }}>
              <MdCategory style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input className={modalStyles.input} style={{ paddingLeft: '35px' }} value={lead.category || "--"} readOnly />
            </div>
          </div>
          <div className={modalStyles.formGroup}>
            <label>Platform</label>
            <div style={{ position: 'relative' }}>
              <MdLabel style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input className={modalStyles.input} style={{ paddingLeft: '35px' }} value={lead.platform || "GMB"} readOnly />
            </div>
          </div>
          <div className={modalStyles.formGroup}>
            <label>Created At</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px', padding: '0 12px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '11px', color: '#6b7280' }}>
              <MdEvent /> {formatDate(lead.createdAt).split(',')[0]}
            </div>
          </div>
        </div>
      </div>

      <div className={modalStyles.formGrid} style={{ gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        <div className={modalStyles.formGroup}>
          <label>Social Footprint</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '10px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb', minHeight: '60px' }}>
            {lead.socialLinks && lead.socialLinks.length > 0 ? (
              lead.socialLinks.map((link, i) => (
                <a key={i} href={link} target="_blank" rel="noreferrer" style={{
                  padding: '2px 10px',
                  borderRadius: '15px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontSize: '11px',
                  textDecoration: 'none',
                  fontWeight: 500,
                  border: '1px solid #dbeafe'
                }}>
                  {getSocialLabel(link)}
                </a>
              ))
            ) : <span style={{ color: '#9ca3af', fontSize: '12px' }}>No social links</span>}
          </div>
        </div>
        <div className={modalStyles.formGroup}>
          <label>Address</label>
          <textarea className={modalStyles.textarea} value={lead.address || "--"} readOnly style={{ minHeight: '60px', fontSize: '12px' }} />
        </div>
      </div>

      <div className={modalStyles.formGroup} style={{ width: '100%' }}>
        <label>Remark</label>
        <textarea
          className={modalStyles.textarea}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Add internal remarks..."
          disabled={readOnly}
          style={{ minHeight: '120px', background: '#fff9db', fontStyle: 'italic', marginTop: '6px' }}
        />
      </div>

      {/* Logs */}
      <div className={modalStyles.formGroup} style={{ width: '100%' }}>
        <label>Digital Footprint (Logs)</label>
        <div className={modalStyles.logsSection} style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <table className={modalStyles.logsTable}>
            <thead>
              <tr>
                <th style={{ width: '200px' }}>Date</th>
                <th style={{ width: '150px' }}>By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {lead.logs && lead.logs.length > 0 ? (
                lead.logs.map((log, idx) => (
                  <tr key={idx}>
                    <td>{log.timestamp}</td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#f3f4f6', fontSize: '12px' }}>
                        {log.triggered_by || "System"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.event}</td>
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

      <div className={modalStyles.actions}>
        <div style={{ marginRight: 'auto', fontSize: '12px', color: '#9ca3af' }}>
          Last updated: {formatDate(lead.updatedAt)}
        </div>
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
