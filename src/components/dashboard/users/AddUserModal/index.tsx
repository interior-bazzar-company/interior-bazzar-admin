import React, { useEffect, useState } from "react";
import styles from "./AddUserModal.module.css";
import { useModal } from "../../../../context/ModalContext";
import useToast from "../../../shared/Toast/useToast";
import { AdminUserManagementService } from "../../../../api/modules/admin/adminUserManagement";
import type { 
  RoleType, 
  CreateAdminUserPayload, 
  AdminUserType, 
  UpdateAdminUserPayload 
} from "../../../../types/content/userManagement";

interface Props {
  onSuccess: () => void;
  user?: AdminUserType;
}

const AddUserModal: React.FC<Props> = ({ onSuccess, user }) => {
  const { closeModal } = useModal();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetchingRoles, setFetchingRoles] = useState(true);
  const [roles, setRoles] = useState<RoleType[]>([]);

  const isEdit = !!user;

  // Form State
  const [formData, setFormData] = useState({
    name: user?.name || "",
    username: user?.username || "",
    phone: user?.phone || "",
    email: user?.email || "",
    password: "", 
    selectedRoleIds: user?.roles?.map(r => r.id) || [] as number[],
  });

  const [fetchingUser, setFetchingUser] = useState(isEdit);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!isEdit || !user?.id) return;
      try {
        setFetchingUser(true);
        const res = await AdminUserManagementService.fetchUserById(user.id);
        if (res.response && res.data) {
          const u = res.data;
          setFormData(prev => ({
            ...prev,
            name: u.name || prev.name,
            username: u.username || prev.username,
            phone: u.phone || prev.phone,
            email: u.email || prev.email,
            selectedRoleIds: u.roles?.map(r => r.id) || []
          }));
        }
      } catch (err) {
        console.error("Failed to fetch user data for edit:", err);
      } finally {
        setFetchingUser(false);
      }
    };
    fetchUserData();
  }, [isEdit, user?.id]);

  useEffect(() => {
    const fetchDropdownRoles = async () => {
      try {
        setFetchingRoles(true);
        const res = await AdminUserManagementService.fetchRoles();
        if (res.response && Array.isArray(res.data)) {
          setRoles(res.data);
          // Only auto-select if not editing or if current selection is empty
          if (res.data.length > 0 && !formData.selectedRoleId) {
            setFormData(prev => ({ ...prev, selectedRoleId: String(res.data[0].id) }));
          }
        }
      } catch (e) {
        console.error("Failed to fetch roles", e);
      } finally {
        setFetchingRoles(false);
      }
    };
    fetchDropdownRoles();
  }, [formData.selectedRoleId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleToggle = (roleId: number) => {
    setFormData(prev => {
      const current = prev.selectedRoleIds;
      if (current.includes(roleId)) {
        return { ...prev, selectedRoleIds: current.filter(id => id !== roleId) };
      } else {
        return { ...prev, selectedRoleIds: [...current, roleId] };
      }
    });
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.name || !formData.email || !formData.phone || formData.selectedRoleIds.length === 0) {
      showToast({ greeting: "Warning", booldMessage: "Required", normalMessage: "Please fill essential fields and select at least one role", type: "warning" });
      return;
    }

    // Passwords and usernames are mandatory on creation
    if (!isEdit && (!formData.password || !formData.username)) {
      showToast({ greeting: "Warning", booldMessage: "Required", normalMessage: "Username and password required for new users", type: "warning" });
      return;
    }

    try {
      setLoading(true);
      
      if (isEdit && user) {
        const payload: UpdateAdminUserPayload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          roles: formData.selectedRoleIds,
        };
        // Only pack password if user entered a new one
        if (formData.password) payload.password = formData.password;
        // Username typically shouldn't change, but pack if provided
        if (formData.username !== user.username) payload.username = formData.username;

        const res = await AdminUserManagementService.updateUser(user.id, payload);
        if (res.response) {
          showToast({ greeting: "Success", booldMessage: "Updated", normalMessage: "User updated successfully", type: "success" });
          onSuccess();
          closeModal();
        } else {
          showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: res.message || "Update failed", type: "error" });
        }
      } else {
        const payload: CreateAdminUserPayload = {
          name: formData.name,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          roles: formData.selectedRoleIds,
        };
        const res = await AdminUserManagementService.createUser(payload);
        if (res.response) {
          showToast({ greeting: "Success", booldMessage: "Created", normalMessage: "User added successfully", type: "success" });
          onSuccess();
          closeModal();
        } else {
          showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: res.message || "Creation failed", type: "error" });
        }
      }
    } catch (e: any) {
      showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: e.message || "An error occurred", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalContent}>
      <h2 className={styles.title}>{isEdit ? "Edit User" : "Add New User"}</h2>
      
      <div className={styles.formGroup}>
        <input
          name="name"
          type="text"
          className={styles.inputField}
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
        />
        <input
          name="username"
          type="text"
          className={styles.inputField}
          placeholder="Username (e.g. john_doe)"
          value={formData.username}
          onChange={handleChange}
          disabled={isEdit} 
        />
        <input
          name="phone"
          type="tel"
          className={styles.inputField}
          placeholder="Phone"
          value={formData.phone}
          onChange={handleChange}
        />
        <input
          name="email"
          type="email"
          className={styles.inputField}
          placeholder="Mail"
          value={formData.email}
          onChange={handleChange}
        />
        <input
          name="password"
          type="password"
          className={styles.inputField}
          placeholder={isEdit ? "Enter new password if changing" : "Initial Password"}
          value={formData.password}
          onChange={handleChange}
        />
        
        <div className={styles.rolesSection}>
          <p className={styles.rolesTitle}>Select Access Roles:</p>
          {(fetchingRoles || (isEdit && fetchingUser)) ? (
            <p className={styles.loadingText}>Fetching roles and user details...</p>
          ) : (
            <div className={styles.rolesGrid}>
              {roles.map(r => (
                <label key={r.id} className={styles.roleItem}>
                  <input 
                    type="checkbox" 
                    checked={formData.selectedRoleIds.includes(r.id)}
                    onChange={() => handleRoleToggle(r.id)}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={closeModal} disabled={loading}>
          Cancel
        </button>
        <button className={styles.primaryBtn} onClick={handleSubmit} disabled={loading || fetchingRoles || (isEdit && fetchingUser)}>
          {loading ? (isEdit ? "Saving..." : "Adding...") : (isEdit ? "Save Changes" : "Add")}
        </button>
      </div>
    </div>
  );
};

export default AddUserModal;
