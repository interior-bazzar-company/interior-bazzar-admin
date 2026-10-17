import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type {
  ApiResponseType,
} from "../../../types/reqResType";


import {
  getCache,
  setCache,
  CACHE_KEYS,
} from "../../../utils/cache";

export interface UserTotals {
  totalUsers: number;
  activeUsers: number;
  /** Accounts holding a business, shop or architect profile the go-live
   *  checklist still counts as unfinished. An account with none of those is
   *  not counted: there is nothing to grade. */
  incompleteProfiles: number;
  asOf: string;
}

export class AdminService {

  /** Users Management header and stat strip: platform users (admin/staff
   *  excluded), how many are active, how many hold an unfinished seller
   *  profile, and the server's date the count was taken. */
  static async fetchTotalUsers() {
    const cached = getCache<ApiResponseType<UserTotals>>(CACHE_KEYS.TOTAL_USERS, 'session');
    if (cached) return cached;

    const url = `${appUrl.admin}/v2/total-users/`;
    const response: ApiResponseType<UserTotals> =
      await apiService.getGetApiResponse(url);

    if (response.response) {
      setCache(CACHE_KEYS.TOTAL_USERS, response, 10, 'session');
    }

    return response;
  }
  /* Get  Analytics here  */
}
