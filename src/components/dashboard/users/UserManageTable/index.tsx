import React from "react";
import { FiCopy, FiEdit2, FiMail } from "react-icons/fi";
import useUserManageTable from "./useUserManageTable";
import styles from "./UserManageTable.module.css";
import useToast from "../../../shared/Toast/useToast";
import type { AdminUserType } from "../../../../types/content/userManagement";

import { useModal } from "../../../../context/ModalContext";
import AddUserModal from "../AddUserModal";
import UserDetailModal from "../UserDetailModal";

interface Props {
  searchText: string;
  onRefresh?: () => void;
}

const renderValue = (val: string | number | null | undefined) => {
  if (val === null || val === undefined || val === "") return "--";
  return val;
};

const UserManageTable: React.FC<Props> = ({ searchText, onRefresh }) => {
  const { 
    loading, 
    users, 
    refetch, 
    noAccess, 
    sendCredentials, 
    sendingCreds 
  } = useUserManageTable(searchText);
  const { showToast } = useToast();
  const { showModal } = useModal();

  const handleSendCredentials = async (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    try {
      const res = await sendCredentials(userId);
      if (res && res.response) {
        showToast({
          greeting: "Success",
          booldMessage: "Sent",
          normalMessage: "Credentials sent to user email",
          type: "success",
        });
      }
    } catch (err: any) {
      showToast({
        greeting: "Error",
        booldMessage: "Failed",
        normalMessage: err.message || "Failed to send credentials",
        type: "error",
      });
    }
  };


  const copyDetailedData = (user: AdminUserType) => {
    const rolesStr = user.roles && user.roles.length > 0 
      ? user.roles.map(r => r.name).join(", ") 
      : null;
      
    const data = `
👤 *User Profile Details*
--------------------------
🆔 *ID:* ${String(user.id).padStart(10, '0')}
📛 *Name:* ${user.name || "--"}
👤 *Username:* ${user.username || "--"}
📧 *Email:* ${user.email || "--"}
📞 *Phone:* ${user.phone || "--"}${rolesStr ? `\n🔐 *Roles:* ${rolesStr}` : ""}
--------------------------
_Interior Bazzar Admin_
    `.trim();

    navigator.clipboard.writeText(data);
    showToast({
      greeting: "Success",
      booldMessage: "Copied",
      normalMessage: "Full data copied in WhatsApp format",
      type: "success",
    });
  };

  const handleEditClick = (e: React.MouseEvent, user: AdminUserType) => {
    e.stopPropagation();
    showModal(<AddUserModal user={user} onSuccess={() => {
      refetch();
      if (onRefresh) onRefresh();
    }} />);
  };

  const handleRowClick = (user: AdminUserType) => {
    showModal(<UserDetailModal user={user} />);
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Created</th>
            <th>Update</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Password</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className={styles.loadingRow}>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                  Loading users...
                </td>
              </tr>
            ))
          ) : noAccess ? (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#ef4444", fontWeight: "600" }}>
                You don't have access to this resource.
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                No users found
              </td>
            </tr>
          ) : (
            users.map((user) => {
              // Extract dates manually from roles payload if root object lacks it based on API payload
              const dateFallback = 
                user.roles && user.roles.length > 0 && user.roles[0].createdAt
                  ? new Date(user.roles[0].createdAt).toLocaleDateString()
                  : "--";
              const lastUpdateFallback = 
                user.roles && user.roles.length > 0 && user.roles[0].updatedAt
                  ? new Date(user.roles[0].updatedAt).toLocaleDateString()
                  : "--";

              const roleNames = user.roles && user.roles.length > 0 
                ? user.roles.map(r => r.name).join(", ")
                : "No Role";

              return (
                <tr 
                  key={user.id} 
                  onClick={() => handleRowClick(user)} 
                  style={{ cursor: "pointer", transition: "background-color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
                >
                  {/* ID */}
                  <td>
                    <div className={styles.idLayout}>
                      {String(user.id).padStart(10, '0')}
                      <button 
                        className={styles.copyDetailedBtn}
                        title="Copy details in WhatsApp format"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyDetailedData(user);
                        }}
                      >
                        <FiCopy />
                      </button>
                    </div>
                  </td>

                  {/* Created */}
                  <td>{dateFallback}</td>

                  {/* Update Date */}
                  <td>{lastUpdateFallback}</td>

                  {/* Name */}
                  <td>{renderValue(user.name)}</td>

                  {/* Phone */}
                  <td>{renderValue(user.phone)}</td>

                  {/* Password (Protected) */}
                  <td>
                    <span className={styles.passwordHidden}>********</span>
                  </td>

                  {/* Update Action */}
                  <td>
                    <div className={styles.editBtnLayout}>
                      <button 
                        className={styles.sendCredsBtn} 
                        onClick={(e) => handleSendCredentials(e, user.id)}
                        disabled={sendingCreds.includes(user.id)}
                        title="Send Credentials to Email"
                      >
                        <FiMail size={14} />
                        {sendingCreds.includes(user.id) ? "Sending..." : "Send Creds"}
                      </button>
                      <button className={styles.editBtn} onClick={(e) => handleEditClick(e, user)}>
                        {roleNames}
                        <FiEdit2 size={13} style={{ marginLeft: "4px" }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserManageTable;
