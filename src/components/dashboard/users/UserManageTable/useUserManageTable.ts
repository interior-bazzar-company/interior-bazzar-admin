import { useCallback, useEffect, useState } from "react";
import { AdminUserManagementService } from "../../../../api/modules/admin/adminUserManagement";
import type { AdminUserType } from "../../../../types/content/userManagement";
import { logger } from "../../../../utils/logger";

const useUserManageTable = (searchText: string) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [noAccess, setNoAccess] = useState<boolean>(false);
  const [users, setUsers] = useState<AdminUserType[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setNoAccess(false);
      const res = await AdminUserManagementService.fetchUsers();
      if (res && res.response) {
        setUsers(res.data);
      } else {
        logger.error("UserManageTable: Failed to fetch users");
        // Check for specific response shape if handled without exception
        if (res.code === 401 || res.code === 403) setNoAccess(true);
      }
    } catch (e: any) {
      logger.error("UserManageTable: Error fetching users:", e);
      if (e.code === 401 || e.code === 403) {
        setNoAccess(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const [sendingCreds, setSendingCreds] = useState<number[]>([]);

  // Client-side text filtering logic matching the mockup's Search Query bar
  const displayedUsers = users.filter((u) => {
    if (!searchText) return true;
    const lowerQ = searchText.toLowerCase();
    return (
      u.name?.toLowerCase().includes(lowerQ) ||
      u.username?.toLowerCase().includes(lowerQ) ||
      u.email?.toLowerCase().includes(lowerQ) ||
      u.phone?.toLowerCase().includes(lowerQ)
    );
  });

  const sendCredentials = async (userId: number) => {
    try {
      setSendingCreds((prev) => [...prev, userId]);
      const res = await AdminUserManagementService.sendUserCredentials(userId);
      return res;
    } catch (e) {
      logger.error(`useUserManageTable: Error sending credentials for user ${userId}:`, e);
      throw e;
    } finally {
      setSendingCreds((prev) => prev.filter((id) => id !== userId));
    }
  };

  return {
    loading,
    noAccess,
    users: displayedUsers,
    sendingCreds,
    sendCredentials,
    refetch: fetchUsers,
  };
};

export default useUserManageTable;
