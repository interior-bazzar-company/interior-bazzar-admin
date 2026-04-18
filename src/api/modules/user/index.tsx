import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type { ApiResponseType } from "../../../types/reqResType";
import type { UserProfileResponse, ProfileForm, ProfileFormResponse } from "../../../types/global";

export class UserService {
    static async getLoggedInUser() {
        try {
            const url = `${appUrl.user}/profile/`;
            const response: ApiResponseType<UserProfileResponse> =
                await apiService.getGetApiResponse(url);
            return response;
        } catch (error) {
            throw error;
        }
    };
    static async getProfile() {
        try {
            const url = `${appUrl.user}/profile/`;
            const response: ApiResponseType<ProfileFormResponse> =
                await apiService.getGetApiResponse(url);
            return response;
        } catch (error) {
            throw error;
        }
    }

    static async createProfile(data: ProfileForm) {
        try {
            const url = `${appUrl.user}/profile/create/`;
            const response: ApiResponseType<ProfileFormResponse> =
                await apiService.getPostApiResponse(url, data);
            return response;
        } catch (error) {
            throw error;
        }
    }
    static async updateProfile(data: ProfileForm) {
        try {
            const url = `${appUrl.user}/update-profile/`;
            const response: ApiResponseType<ProfileFormResponse> =
                await apiService.getPatchApiResponse(url, data);
            return response;
        } catch (error) {
            throw error;
        }
    }
}
