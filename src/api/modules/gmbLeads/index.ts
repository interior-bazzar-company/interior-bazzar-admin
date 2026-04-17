import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import type { GMBLeadResponse, GMBLeadType } from "../../../types/content/gmbLeads";
import { logger } from "../../../utils/logger";

export class GMBService {
  static async fetchMyLeads(pageNo: number, pageSize: number, filters?: any) {
    try {
      let url = `${appUrl.admin}/v1/leads/my-leads/?pageNo=${pageNo}&pageSize=${pageSize}`;
      if (filters) {
        if (filters.city) url += `&city=${encodeURIComponent(filters.city)}`;
        if (filters.min_rating) url += `&min_rating=${filters.min_rating}`;
        if (filters.status) url += `&status=${encodeURIComponent(filters.status)}`;
        if (filters.platform) url += `&platform=${encodeURIComponent(filters.platform)}`;
        if (filters.searchText) url += `&searchText=${encodeURIComponent(filters.searchText)}`;
      }
      const response: ApiResponseType<GMBLeadResponse> = await apiService.getGetApiResponse(url);
      return response;
    } catch (error) {
      logger.error("Error fetching GMB leads:", error);
      throw error;
    }
  }

  static async updateLead(leadId: number, data: Partial<GMBLeadType>) {
    try {
      const url = `${appUrl.admin}/v1/leads/${leadId}/`;
      const response: ApiResponseType<GMBLeadType> = await apiService.getPatchApiResponse(url, data);
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
      return response;
    } catch (error) {
      logger.error(`Error assigning GMB lead ${data.lead_id}:`, error);
      throw error;
    }
  }
}
