import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import { getCache, setCache, CACHE_KEYS } from "../../../utils/cache";

export class PageService {
    static async getDisclaimer() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_disclaimer`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/disclaimer/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getPrivacyPolicy() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_privacy_policy`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/privacy-policy/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getReturnRefund() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_return_refund`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/return-and-refund/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getTermsConditon() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_terms_condition`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/terms-and-conditions/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getPaymentPage() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_payment`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/payment/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getImportantLinks() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_important_links`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/important-links/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getQna() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_qna`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/qna/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getLegal() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_legal`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/legal/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
    static async getLeadPolicy() {
        try {
            const cacheKey = `${CACHE_KEYS.CMS_CONTENT}_lead_policy`;
            const cached = getCache<ApiResponseType<any>>(cacheKey, 'local');
            if (cached) return cached;

            const url = `${appUrl.page}/lead-policy/`;
            const response: ApiResponseType<any> = await apiService.getGetApiResponse(url);

            if (response.response) {
                setCache(cacheKey, response, 1440, 'local');
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
}