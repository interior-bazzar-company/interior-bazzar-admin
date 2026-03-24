// AdminUserManagementService for handling RBAC and user creation
// Separate from admin/index.ts to follow full versioning

import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import type { 
  AdminUserType, 
  RoleType, 
  CreateAdminUserPayload, 
  UpdateAdminUserPayload 
} from "../../../types/content/userManagement";
import { logger } from "../../../utils/logger";

export class AdminUserManagementService {
  /** Fetch users created by the requesting admin */
  static async fetchUsers() {
    try {
      const url = `${appUrl.admin}/users/`;
      const response: ApiResponseType<AdminUserType[]> = await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.fetchUsers error:", error);
      throw error;
    }
  }

  /** Fetch a specific user by ID */
  static async fetchUserById(userId: number) {
    try {
      const url = `${appUrl.admin}/users/${userId}`;
      const response: ApiResponseType<AdminUserType> = await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.fetchUserById error:", error);
      throw error;
    }
  }

  /** Create a new sub-admin user */
  static async createUser(payload: CreateAdminUserPayload) {
    try {
      const url = `${appUrl.admin}/users/`;
      const response: ApiResponseType<AdminUserType> = await apiService.getPostApiResponse(url, payload);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.createUser error:", error);
      throw error;
    }
  }

  /** Update an existing user */
  static async updateUser(userId: number, payload: UpdateAdminUserPayload) {
    try {
      const url = `${appUrl.admin}/users/${userId}`;
      const response: ApiResponseType<AdminUserType> = await apiService.getPutApiResponse(url, payload);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.updateUser error:", error);
      throw error;
    }
  }

  /** Fetch available roles for dropdowns */
  static async fetchRoles() {
    try {
      // Use the actual RBAC module path
      const url = `${appUrl.rbac}/roles/`;
      const response: ApiResponseType<RoleType[]> = await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.fetchRoles error:", error);
      throw error;
    }
  }

  /** Create a new role */
  static async createRole(payload: any) {
    try {
      const url = `${appUrl.rbac}/roles/`;
      const response: ApiResponseType<RoleType> = await apiService.getPostApiResponse(url, payload);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.createRole error:", error);
      throw error;
    }
  }

  /** Update an existing role */
  static async updateRole(roleId: number, payload: any) {
    try {
      const url = `${appUrl.rbac}/roles/${roleId}`;
      const response: ApiResponseType<RoleType> = await apiService.getPutApiResponse(url, payload);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.updateRole error:", error);
      throw error;
    }
  }

  /** Delete a role */
  static async deleteRole(roleId: number) {
    try {
      const url = `${appUrl.rbac}/roles/${roleId}`;
      const response: ApiResponseType<any> = await apiService.getDeleteApiResponse(url);
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.deleteRole error:", error);
      throw error;
    }
  }

  /** Send login credentials to a user's registered email */
  static async sendUserCredentials(userId: number) {
    try {
      const url = `${appUrl.admin}/users/${userId}/send-credentials/`;
      const response: ApiResponseType<any> = await apiService.getPostApiResponse(url, {});
      return response;
    } catch (error) {
      logger.error("AdminUserManagementService.sendUserCredentials error:", error);
      throw error;
    }
  }
}
