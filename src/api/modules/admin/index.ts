import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type {
  ApiResponseType,
  BusinessSearchResType,
  GetPaginatedAdminBusinessesType,
  GetPaginatedAdminBusinessesTypeV2,
  GetPaginatedFunnelLeadType,
  UserGrowthAnalytics,
} from "../../../types/reqResType";
import { logger } from "../../../utils/logger";
import type {
  AdminLeadType,
  BusinessType,
  LeadFilterType,
  SignupData,
  DashboardV2Type,
} from "../../../types/content";

import { getCache, setCache, CACHE_KEYS } from "../../../utils/cache";

export class AdminService {

  static async fetchTotalUsers() {
    try {
      const cached = getCache<{ totalUsers: number }>(CACHE_KEYS.TOTAL_USERS, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/total-users/`;
      const response: ApiResponseType<{ totalUsers: number }> =
        await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.TOTAL_USERS, response, 10, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async fetchBusinesses(pageNo: number, pageSize: number) {
    try {
      if (pageNo === 1) {
        const cached = getCache<GetPaginatedAdminBusinessesType>(CACHE_KEYS.BUSINESS_LIST_PAGE_1, 'session');
        if (cached) return cached;
      }

      const url = `${appUrl.admin}/businesses/${pageNo}/${pageSize}/`;
      const response: ApiResponseType<GetPaginatedAdminBusinessesType> =
        await apiService.getGetApiResponse(url);

      if (response.response && pageNo === 1) {
        setCache(CACHE_KEYS.BUSINESS_LIST_PAGE_1, response, 15, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async fetchBusinessesv2(data: {
    page_number: number;
    page_size: number;
    start_date?: string;
    end_date?: string;
    plan?: string;
  }) {
    try {
      const cacheKey = `${CACHE_KEYS.BUSINESS_LIST_V2}_${JSON.stringify(data)}`;
      const cached = getCache<GetPaginatedAdminBusinessesTypeV2>(cacheKey, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/v2/paginate-business/`;
      const response: ApiResponseType<GetPaginatedAdminBusinessesTypeV2> =
        await apiService.getPostApiResponse(url, data);

      if (response.response) {
        setCache(cacheKey, response, 10, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async fetchLeads(pageNo: number, pageSize: number, filters?: LeadFilterType) {
    try {
      const isDefaultView = pageNo === 1 && (!filters || Object.values(filters).every(v => !v));
      if (isDefaultView) {
        const cached = getCache<any>(CACHE_KEYS.LEAD_LIST_PAGE_1, 'session');
        if (cached) return cached;
      }

      // Using v2/query which is specifically for paginated leads as per AIDOCS
      let url = `${appUrl.admin}/v2/query/?pageNo=${pageNo}&pageSize=${pageSize}`;
      if (filters) {
        if (filters.leadStatus) url += `&leadStatus=${encodeURIComponent(filters.leadStatus)}`;
        if (filters.filterStatus) url += `&stages=${encodeURIComponent(filters.filterStatus)}`;
        if (filters.category) url += `&category=${encodeURIComponent(filters.category)}`;
        if (filters.searchText) url += `&searchText=${encodeURIComponent(filters.searchText)}`;
      }
      const response: ApiResponseType<any> =
        await apiService.getGetApiResponse(url);

      if (response.response && isDefaultView) {
        setCache(CACHE_KEYS.LEAD_LIST_PAGE_1, response, 5, 'session');
      }

      return response;
    } catch (error) {
      logger.error("Error fetching leads:", error);
      throw error;
    }
  }
  static async fetchFunnelLeads(pageNo: number, pageSize: number) {
    try {
      if (pageNo === 1) {
        const cached = getCache<GetPaginatedFunnelLeadType>(CACHE_KEYS.FUNNEL_LIST_PAGE_1, 'session');
        if (cached) return cached;
      }

      const url = `${appUrl.admin}/funnel/${pageNo}/${pageSize}/`;
      const response: ApiResponseType<GetPaginatedFunnelLeadType> =
        await apiService.getGetApiResponse(url);

      if (response.response && pageNo === 1) {
        setCache(CACHE_KEYS.FUNNEL_LIST_PAGE_1, response, 10, 'session');
      }

      return response;
    } catch (error) {
      logger.error("Error fetching leads:", error);
      throw error;
    }
  }
  static async getSearchedBusinesses(query: string, signal?: AbortSignal) {
    try {
      const cacheKey = `${CACHE_KEYS.SEARCH_RESULTS}_${query}`;
      const cached = getCache<BusinessSearchResType>(cacheKey, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/business/search/${encodeURIComponent(
        query
      )}/`;
      const response: ApiResponseType<BusinessSearchResType> =
        await apiService.getGetApiResponse(url, { signal });

      if (response.response) {
        setCache(cacheKey, response, 10, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getBusinessDetail(businessId: number, signal?: AbortSignal) {
    try {
      const cacheKey = `${CACHE_KEYS.BUSINESS_DETAIL}_${businessId}`;
      const cached = getCache<BusinessType>(cacheKey, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/business/${businessId}/`;
      const response: ApiResponseType<BusinessType> =
        await apiService.getGetApiResponse(url, { signal });

      if (response.response) {
        setCache(cacheKey, response, 15, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  static async assignLeadToBusiness(data: {
    leadId: number;
    businessId: number;
  }) {
    try {
      const url = `${appUrl.admin}/lead/assign/`;
      const response: ApiResponseType<AdminLeadType> =
        await apiService.getPostApiResponse(url, data);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /* Get  Analytics here  */
  static async getAllAnalytics() {
    try {
      const cached = getCache<any>(CACHE_KEYS.ALL_ANALYTICS, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/analytics/`;
      const response: ApiResponseType<any> = await apiService.getGetApiResponse(
        url
      );

      if (response.response) {
        setCache(CACHE_KEYS.ALL_ANALYTICS, response, 5, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getBusinessAnalytics() {
    try {
      const cached = getCache<SignupData[]>(CACHE_KEYS.BUSINESS_ANALYTICS, 'local');
      if (cached) return cached;

      const url = `${appUrl.admin}/chart/`;
      const response: ApiResponseType<SignupData[]> =
        await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.BUSINESS_ANALYTICS, response, 120, 'local');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getLeadsAnalytics() {
    try {
      const cached = getCache<any>(CACHE_KEYS.LEADS_SUMMARY, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/v2/leads/`;
      const response: ApiResponseType<any> =
        await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.LEADS_SUMMARY, response, 5, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async createLead(data: any) {
    try {
      const url = `${appUrl.admin}/v2/query/`;
      const response: ApiResponseType<any> =
        await apiService.getPostApiResponse(url, data);
      return response;
    } catch (error) {
      throw error;
    }
  }

  static async postLeadsStatsV2(data: { start_date: string; end_date: string; page_number: number; page_size: number }) {
    try {
      const cacheKey = `${CACHE_KEYS.LEADS_STATS_V2}_${JSON.stringify(data)}`;
      const cached = getCache<any>(cacheKey, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/v2/leads/stats/`;
      const response: ApiResponseType<any> =
        await apiService.getPostApiResponse(url, data);

      if (response.response) {
        setCache(cacheKey, response, 30, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getUserGrowthAnalytics() {
    try {
      const cached = getCache<UserGrowthAnalytics[]>(CACHE_KEYS.USER_GROWTH, 'local');
      if (cached) return cached;

      const url = `${appUrl.admin}/analytics/users/`;
      const response: ApiResponseType<UserGrowthAnalytics[]> =
        await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.USER_GROWTH, response, 60, 'local');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getDetailedLeadAnalytics() {
    try {
      const cached = getCache<any[]>(CACHE_KEYS.DETAILED_LEAD_ANALYTICS, 'local');
      if (cached) return cached;

      const url = `${appUrl.admin}/v2/analytics/leads/`;
      const response: ApiResponseType<any[]> =
        await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.DETAILED_LEAD_ANALYTICS, response, 60, 'local');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
  static async fetchDashboardV2() {
    try {
      const cached = getCache<DashboardV2Type>(CACHE_KEYS.DASHBOARD_V2, 'session');
      if (cached) return cached;

      const url = `${appUrl.admin}/v2/dashboard/`;
      const response: ApiResponseType<DashboardV2Type> =
        await apiService.getGetApiResponse(url);

      if (response.response) {
        setCache(CACHE_KEYS.DASHBOARD_V2, response, 5, 'session');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  static async updateQuery(leadId: number, data: any) {
    try {
      const url = `${appUrl.admin}/v2/query/${leadId}/`;
      const response: ApiResponseType<any> = await apiService.getPutApiResponse(url, data);
      return response;
    } catch (error) {
      throw error;
    }
  }

}
