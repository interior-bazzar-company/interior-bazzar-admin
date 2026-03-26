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

export class AdminService {

  static async fetchTotalUsers() {
    try {
      const url = `${appUrl.admin}/total-users/`;
      const response: ApiResponseType<{ totalUsers: number }> =
        await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async fetchBusinesses(pageNo: number, pageSize: number) {
    try {
      const url = `${appUrl.admin}/businesses/${pageNo}/${pageSize}/`;
      const response: ApiResponseType<GetPaginatedAdminBusinessesType> =
        await apiService.getGetApiResponse(url);
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
      const url = `${appUrl.admin}/v2/paginate-business/`;
      const response: ApiResponseType<GetPaginatedAdminBusinessesTypeV2> =
        await apiService.getPostApiResponse(url, data);
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async fetchLeads(pageNo: number, pageSize: number, filters?: LeadFilterType) {
    try {
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
      return response;
    } catch (error) {
      logger.error("Error fetching leads:", error);
      throw error;
    }
  }
  static async fetchFunnelLeads(pageNo: number, pageSize: number) {
    try {
      const url = `${appUrl.admin}/funnel/${pageNo}/${pageSize}/`;
      const response: ApiResponseType<GetPaginatedFunnelLeadType> =
        await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      logger.error("Error fetching leads:", error);
      throw error;
    }
  }
  static async getSearchedBusinesses(query: string, signal?: AbortSignal) {
    try {
      const url = `${appUrl.admin}/business/search/${encodeURIComponent(
        query
      )}/`;
      const response: ApiResponseType<BusinessSearchResType> =
        await apiService.getGetApiResponse(url, { signal });
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getBusinessDetail(businessId: number, signal?: AbortSignal) {
    try {
      const url = `${appUrl.admin}/business/${businessId}/`;
      const response: ApiResponseType<BusinessType> =
        await apiService.getGetApiResponse(url, { signal });
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
      const url = `${appUrl.admin}/analytics/`;
      const response: ApiResponseType<any> = await apiService.getGetApiResponse(
        url
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getBusinessAnalytics() {
    try {
      const url = `${appUrl.admin}/chart/`;
      const response: ApiResponseType<SignupData[]> =
        await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getLeadsAnalytics() {
    try {
      const url = `${appUrl.admin}/v2/leads/`;
      const response: ApiResponseType<any> =
        await apiService.getGetApiResponse(url);
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
      const url = `${appUrl.admin}/v2/leads/stats/`;
      const response: ApiResponseType<any> =
        await apiService.getPostApiResponse(url, data);
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getUserGrowthAnalytics() {
    try {
      const url = `${appUrl.admin}/analytics/users/`;
      const response: ApiResponseType<UserGrowthAnalytics[]> =
        await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async getDetailedLeadAnalytics() {
    try {
      const url = `${appUrl.admin}/v2/analytics/leads/`;
      const response: ApiResponseType<any[]> =
        await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      throw error;
    }
  }
  static async fetchDashboardV2() {
    try {
      const url = `${appUrl.admin}/v2/dashboard/`;
      const response: ApiResponseType<DashboardV2Type> =
        await apiService.getGetApiResponse(url);
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
