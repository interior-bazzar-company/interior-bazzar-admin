// Brand-new API service for Business Dashboard.
// Existing admin/index.ts is NOT modified — swap imports here to revert.

import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import type {
  AdminBusinessDashboardRowType,
  BusinessDashboardStatsType,
} from "../../../types/content/businessDashboard";
import { logger } from "../../../utils/logger";

export interface GetPaginatedBusinessDashboardType {
  businesses: AdminBusinessDashboardRowType[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export class AdminBusinessDashboardService {
  /** Fetch paginated list of businesses for the dashboard table */
  static async fetchBusinesses(pageNo: number, pageSize: number, filters?: { searchText?: string, status?: string, plan?: string }) {
    try {
      const url = `${appUrl.admin}/v2/paginate-business/`;
      const data: any = {
        page_number: pageNo,
        page_size: pageSize,
        start_date: "2020-01-01",
        end_date: "2030-12-31",
      };
      if (filters?.searchText) data.searchText = filters.searchText;
      if (filters?.status) data.status = filters.status;
      if (filters?.plan) data.plan = filters.plan;

      const response: ApiResponseType<GetPaginatedBusinessDashboardType> =
        await apiService.getPostApiResponse(url, data);
      return response;
    } catch (error) {
      logger.error("AdminBusinessDashboardService.fetchBusinesses error:", error);
      throw error;
    }
  }

  /** Fetch KPI/stats for the business dashboard */
  static async fetchDashboardStats() {
    try {
      const url = `${appUrl.admin}/v2/dashboard/`;
      const response: ApiResponseType<BusinessDashboardStatsType> =
        await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      logger.error("AdminBusinessDashboardService.fetchDashboardStats error:", error);
      throw error;
    }
  }

  /** Update / save a remark on a business */
  static async updateBusinessRemark(businessId: number, remark: string) {
    try {
      const url = `${appUrl.admin}/v2/businesses/${businessId}/`;
      const response: ApiResponseType<any> = await apiService.getPutApiResponse(url, { remark });
      return response;
    } catch (error) {
      logger.error("AdminBusinessDashboardService.updateBusinessRemark error:", error);
      throw error;
    }
  }

  /** Update / save buy plan intent on a business */
  static async updateBusinessBuyPlan(planId: number, buyIntent: string) {
    try {
      const url = `${appUrl.admin}/v2/business/plan/`;
      const response: ApiResponseType<any> = await apiService.getPostApiResponse(url, {
        buyIntent,
        planId,
      });
      return response;
    } catch (error) {
      logger.error("AdminBusinessDashboardService.updateBusinessBuyPlan error:", error);
      throw error;
    }
  }
}
