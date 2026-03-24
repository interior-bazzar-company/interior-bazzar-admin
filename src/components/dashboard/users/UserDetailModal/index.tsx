import React, { useEffect, useState } from "react";
import { FiShield, FiUser, FiCopy } from "react-icons/fi";
import useToast from "../../../shared/Toast/useToast";
import styles from "./UserDetailModal.module.css";
import type { AdminUserType } from "../../../../types/content/userManagement";
import { AdminUserManagementService } from "../../../../api/modules/admin/adminUserManagement";

interface Props {
  user: AdminUserType;
}

const renderValue = (val: string | number | null | undefined) => {
  if (val === null || val === undefined || val === "") return "--";
  return val;
};

const UserDetailModal: React.FC<Props> = ({ user: initialUser }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState<AdminUserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleCopyAll = () => {
    const currentUser = user || initialUser;
    const rolesStr = currentUser.roles && currentUser.roles.length > 0 
      ? currentUser.roles.map(r => r.name).join(", ") 
      : null;

    const data = `
👤 *User Profile Details*
--------------------------
🆔 *ID:* ${String(currentUser.id).padStart(10, "0")}
📛 *Name:* ${currentUser.name || "--"}
👤 *Username:* ${currentUser.username || "--"}
📧 *Email:* ${currentUser.email || "--"}
📞 *Phone:* ${currentUser.phone || "--"}
💼 *Designation:* ${currentUser.type || "--"}${rolesStr ? `\n🔐 *Roles:* ${rolesStr}` : ""}
--------------------------
_Interior Bazzar Admin_
    `.trim();

    navigator.clipboard.writeText(data);
    showToast({
      greeting: "Success",
      booldMessage: "Copied",
      normalMessage: "User data copied in WhatsApp format",
      type: "success"
    });
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await AdminUserManagementService.fetchUserById(initialUser.id);
        if (res.response && res.data) {
          setUser(res.data);
        } else {
          setError(res.message || "Failed to fetch user details");
          // Fallback to initial data if versioning/access allows
          setUser(initialUser);
        }
      } catch (err: any) {
        console.error("UserDetailModal fetch error:", err);
        setError(err?.message || "An error occurred while fetching user data");
        setUser(initialUser);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [initialUser.id]);

  // Display initial data while loading to avoid blank screen if possible,
  // or show a targeted loader.
  const currentUser = user || initialUser;

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <h2 className={styles.title}>User Details</h2>
        <button 
          className={styles.copyAllBtn} 
          onClick={handleCopyAll}
          title="Copy all user data"
        >
          <FiCopy size={16} style={{ marginRight: "6px" }} />
          Copy All Data
        </button>
      </div>

      <div className={styles.body}>
          {loading && (
            <div className={styles.noAccess} style={{ textAlign: "center", padding: "20px" }}>
              Updating details from server...
            </div>
          )}
          
          {error && !loading && (
            <div className={styles.statusInactive} style={{ margin: "10px 0", fontSize: "11px", padding: "8px" }}>
              {error}
            </div>
          )}

          {/* Basic User Information */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <FiUser style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Profile Information
            </div>
            
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>User ID</span>
              <span className={styles.detailValue}>{String(currentUser.id).padStart(10, "0")}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Name</span>
              <span className={styles.detailValue}>{renderValue(currentUser.name)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Username</span>
              <span className={styles.detailValue}>{renderValue(currentUser.username)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Email</span>
              <span className={styles.detailValue}>{renderValue(currentUser.email)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Phone</span>
              <span className={styles.detailValue}>{renderValue(currentUser.phone)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Type</span>
              <span className={styles.detailValue} style={{ textTransform: 'capitalize' }}>
                {renderValue(currentUser.type)}
              </span>
            </div>
          </div>

          {/* RBAC Rules & Ownership */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <FiShield style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Roles & Access Mapping
            </div>
            
            <div className={styles.rolesContainer}>
              {(!currentUser.roles || currentUser.roles.length === 0) ? (
                <div className={styles.noAccess}>No roles assigned. User has no access.</div>
              ) : (
                currentUser.roles.map((role) => (
                  <div key={role.id} className={styles.roleCard}>
                    <div className={styles.roleName}>
                      {role.name}
                      <span className={styles.detailLabel} style={{ marginLeft: "auto", fontSize: "11px" }}>
                        ID: {role.id}
                      </span>
                    </div>
                    {/* Access mapping payload depending on endpoint (could be an array of strings or objects) */}
                    <div className={styles.accessList}>
                      {(!role.accessList || role.accessList.length === 0) ? (
                        <span className={styles.noAccess}>No specific access configured for this role.</span>
                      ) : (
                        role.accessList.map((access, i) => {
                          const accessName = typeof access === 'string' ? access : access.name;
                          return (
                            <span key={i} className={styles.accessBadge}>
                              {accessName}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

      </div>
    </div>
  );
};

export default UserDetailModal;
