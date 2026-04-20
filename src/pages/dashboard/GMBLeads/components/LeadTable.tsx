import React from "react";
import { MdWhatsapp, MdVisibility, MdEdit, MdStar } from "react-icons/md";
import type { GMBLeadType } from "../../../../types/content/gmbLeads";
import styles from "../GMBLeads.module.css";
import tableStyles from "../../../../components/dashboard/Lead/LeadTable/LeadTable.module.css";

interface LeadTableProps {
  leads: GMBLeadType[];
  loading: boolean;
  onView: (lead: GMBLeadType) => void;
  onEdit: (lead: GMBLeadType) => void;
  pageNo: number;
  totalPages: number;
  hasNext: boolean;
  setPageNo: (page: number) => void;
}

const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  loading,
  onView,
  onEdit,
  pageNo,
  totalPages,
  hasNext,
  setPageNo
}) => {
  const renderStars = (rating?: string | number) => {
    const val = typeof rating === 'string' ? parseFloat(rating) : rating;
    if (!val) return "--";
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', color: '#f59e0b' }}>
        <MdStar />
        <span>{val}</span>
      </div>
    );
  };

  const getStatusBadgeClass = (status?: string) => {
    const s = status?.toLowerCase() || "new";
    switch (s) {
      case "done":
      case "crack":
        return { backgroundColor: "#dcfce7", color: "#166534" };
      case "deny":
      case "rejected":
        return { backgroundColor: "#fee2e2", color: "#991b1b" };
      case "pending":
      case "followup":
        return { backgroundColor: "#fef9c3", color: "#854d0e" };
      case "hotprospect":
        return { backgroundColor: "#ffedd5", color: "#9a3412" };
      case "assigned":
        return { backgroundColor: "#e0f2fe", color: "#075985" };
      default:
        return { backgroundColor: "#f3f4f6", color: "#374151" };
    }
  };

  const getPlatformBadgeClass = (platform?: string) => {
    const p = platform?.toLowerCase() || "gmb";
    switch (p) {
      case "gmb": return styles.badgeGmb;
      case "yelp": return styles.badgeYelp;
      case "yellowpages": return styles.badgeYellowPages;
      default: return "";
    }
  };

  return (
    <div className={tableStyles.wrapper}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th>Business Name</th>
            <th>State</th>
            <th>Phone</th>
            <th>Rating</th>
            <th>Location</th>
            <th>Web</th>
            <th>Map</th>
            <th>Remark</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={11} style={{ padding: "20px" }}>Loading leads...</td>
              </tr>
            ))
          ) : leads.length === 0 ? (
            <tr>
              <td colSpan={11} style={{ padding: "40px" }}>No leads found.</td>
            </tr>
          ) : (
            leads.map((lead) => (
              <tr key={lead.id}>
                <td style={{ fontWeight: 600, color: "#111827" }}>{lead.businessName}</td>
                <td>{lead.state || "--"}</td>
                <td>
                  <a href={`tel:${lead.phone}`} style={{ color: "#3b82f6", textDecoration: "none" }}>
                    {lead.phone || "--"}
                  </a>
                </td>
                <td>{renderStars(lead.ratingValue || lead.rating)}</td>
                <td title={lead.address}>{lead.address || "--"}</td>
                <td>
                  {lead.website ? (
                    <a href={lead.website} target="_blank" rel="noreferrer" style={{ color: "#3b82f6" }}>Link</a>
                  ) : "--"}
                </td>
                <td>
                  {(lead.mapLink || lead.gmbLink) ? (
                    <a href={lead.mapLink || lead.gmbLink} target="_blank" rel="noreferrer" style={{ color: "#dc2626", fontWeight: 600 }}>Map</a>
                  ) : "--"}
                </td>
                <td style={{ fontStyle: "italic", color: "#6b7280", background: "#f9fafb" }}>
                  {lead.remark || "--"}
                </td>
                <td>
                  <span className={`${styles.badge} ${getPlatformBadgeClass(lead.platform)}`}>
                    {lead.platform || "GMB"}
                  </span>
                </td>
                <td>
                  <span className={styles.statusBadge} style={getStatusBadgeClass(lead.status)}>
                    {lead.status || "NEW"}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {lead.waMessage && (
                      <button
                        className={tableStyles.assignButton}
                        onClick={() => window.open(lead.waMessage, '_blank')}
                        title="WhatsApp"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '36px' }}
                      >
                        <MdWhatsapp size={18} color="#25D366" />
                      </button>
                    )}
                    <button
                      className={tableStyles.assignButton}
                      onClick={() => onView(lead)}
                      title="Full Data"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '36px' }}
                    >
                      <MdVisibility size={18} color="var(--notion-text)" />
                    </button>
                    <button
                      className={tableStyles.assignButton}
                      onClick={() => onEdit(lead)}
                      title="Edit"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '36px' }}
                    >
                      <MdEdit size={18} color="var(--notion-text)" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className={tableStyles.pagination}>
          <button disabled={pageNo === 1} onClick={() => setPageNo(pageNo - 1)}>Prev</button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              className={pageNo === i + 1 ? tableStyles.activePage : ""}
              onClick={() => setPageNo(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button disabled={!hasNext} onClick={() => setPageNo(pageNo + 1)}>Next</button>
        </div>
      )}
    </div>
  );
};

export default LeadTable;
