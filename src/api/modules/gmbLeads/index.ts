import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import type { GMBLeadResponse, GMBLeadType } from "../../../types/content/gmbLeads";
import { logger } from "../../../utils/logger";

import { getCache, setCache, CACHE_KEYS, clearCache } from "../../../utils/cache";

export class GMBService {
  static async fetchMyLeads(pageNo: number, pageSize: number, filters?: any) {
    try {
      const isDefaultView = pageNo === 1 && (!filters || Object.values(filters).every(v => !v));
      if (isDefaultView) {
        const cached = getCache<ApiResponseType<GMBLeadResponse>>(CACHE_KEYS.GMB_LEAD_LIST_PAGE_1, 'session');
        if (cached) return cached;
      }

      let url = `${appUrl.admin}/v1/leads/my-leads/?pageNo=${pageNo}&pageSize=${pageSize}`;
      if (filters) {
        if (filters.city) url += `&city=${encodeURIComponent(filters.city)}`;
        if (filters.state) url += `&state=${encodeURIComponent(filters.state)}`;
        if (filters.min_rating) url += `&min_rating=${filters.min_rating}`;
        if (filters.status) url += `&status=${encodeURIComponent(filters.status)}`;
        if (filters.platform) url += `&platform=${encodeURIComponent(filters.platform)}`;
        if (filters.searchText) url += `&searchText=${encodeURIComponent(filters.searchText)}`;
      }
      const response: ApiResponseType<GMBLeadResponse> = await apiService.getGetApiResponse(url);

      if (response.response && isDefaultView) {
        setCache(CACHE_KEYS.GMB_LEAD_LIST_PAGE_1, response, 10, 'session');
      }

      return response;
    } catch (error) {
      logger.error("Error fetching GMB leads:", error);
      throw error;
    }
  }

  static async fetchKPIs() {
    try {
      const cached = getCache<ApiResponseType<any>>(CACHE_KEYS.GMB_KPIs, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/v1/leads/kpis/`;
      const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.GMB_KPIs, response, 5, 'session');
      }

      return response;
    } catch (error) {
      logger.error("Error fetching lead KPIs:", error);
      throw error;
    }
  }

  static async updateLead(leadId: number, data: Partial<GMBLeadType>) {
    try {
      const url = `${appUrl.admin}/v1/leads/${leadId}/`;
      const response: ApiResponseType<GMBLeadType> = await apiService.getPatchApiResponse(url, data);

      if (response.response) {
        clearCache(CACHE_KEYS.GMB_LEAD_LIST_PAGE_1, 'session');
        clearCache(CACHE_KEYS.GMB_KPIs, 'session');
      }

      return response;
    } catch (error) {
      logger.error(`Error updating GMB lead ${leadId}:`, error);
      throw error;
    }
  }

  static async assignLead(data: { lead_id: number; user_id: number }) {
    try {
      const url = `${appUrl.admin}/v1/leads/assign/`;
      const response: ApiResponseType<{ status: string; user: string }> = await apiService.getPostApiResponse(url, data);

      if (response.response) {
        clearCache(CACHE_KEYS.GMB_LEAD_LIST_PAGE_1, 'session');
        clearCache(CACHE_KEYS.GMB_KPIs, 'session');
        // Also clear user-specific leads cache for the assigned user
        clearCache(`${CACHE_KEYS.GMB_USER_LEADS}_${data.user_id}_page_1`, 'session');
      }

      return response;
    } catch (error) {
      logger.error(`Error assigning GMB lead ${data.lead_id}:`, error);
      throw error;
    }
  }

  static async ingestGMBData(data: Partial<GMBLeadType> | Partial<GMBLeadType>[]) {
    try {
      const url = `${appUrl.admin}/v1/ingest/gmb-data/`;
      const response: ApiResponseType<{ processedCount: number; totalReceived: number }> = await apiService.getPostApiResponse(url, data);

      if (response.response) {
        clearCache(CACHE_KEYS.GMB_LEAD_LIST_PAGE_1, 'session');
        clearCache(CACHE_KEYS.GMB_KPIs, 'session');
      }

      return response;
    } catch (error) {
      logger.error("Error ingesting GMB data:", error);
      throw error;
    }
  }

  static async createLead(data: Partial<GMBLeadType>) {
    try {
      const url = `${appUrl.admin}/v1/leads/create/`;
      const response: ApiResponseType<GMBLeadType> = await apiService.getPostApiResponse(url, data);

      if (response.response) {
        clearCache(CACHE_KEYS.GMB_LEAD_LIST_PAGE_1, 'session');
        clearCache(CACHE_KEYS.GMB_KPIs, 'session');
      }

      return response;
    } catch (error) {
      logger.error("Error creating GMB lead:", error);
      throw error;
    }
  }

  static async fetchAdmins() {
    try {
      const cached = getCache<ApiResponseType<{ id: number; username: string; name: string }[]>>(CACHE_KEYS.ADMIN_TEAM_LIST, 'local');
      if (cached) return cached;

      const url = `${appUrl.admin}/v1/admins/`;
      const response: ApiResponseType<{ id: number; username: string; name: string }[]> = await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.ADMIN_TEAM_LIST, response, 60, 'local');
      }

      return response;
    } catch (error) {
      logger.error("Error fetching eligible admins:", error);
      throw error;
    }
  }

  static async fetchUserLeads(userId: number, pageNo: number, pageSize: number) {
    try {
      const cacheKey = `${CACHE_KEYS.GMB_USER_LEADS}_${userId}_page_1`;
      if (pageNo === 1) {
        const cached = getCache<ApiResponseType<GMBLeadResponse>>(cacheKey, 'session');
        if (cached) return cached;
      }

      const url = `${appUrl.admin}/v1/leads/user/${userId}/?pageNo=${pageNo}&pageSize=${pageSize}`;
      const response: ApiResponseType<GMBLeadResponse> = await apiService.getGetApiResponse(url);

      if (response.response && pageNo === 1) {
        setCache(cacheKey, response, 10, 'session');
      }

      return response;
    } catch (error) {
      logger.error(`Error fetching leads for user ${userId}:`, error);
      throw error;
    }
  }

  static async autoAssignLeads() {
    try {
      const url = `${appUrl.admin}/v1/leads/auto-assign/`;
      const response: ApiResponseType<{ processedCount: number }> = await apiService.getPostApiResponse(url, {});

      if (response.response) {
        clearCache(CACHE_KEYS.GMB_LEAD_LIST_PAGE_1, 'session');
        clearCache(CACHE_KEYS.GMB_KPIs, 'session');
      }

      return response;
    } catch (error) {
      logger.error("Error triggering auto-assignment:", error);
      throw error;
    }
  }
}
