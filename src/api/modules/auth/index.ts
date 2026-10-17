import appUrl from "../../endpoints";
import apiService from "../../apiService";
import type {
  ApiResponseType,
} from "../../../types/reqResType";
import type {
  LoginForm,
  LoginFormResponse,
  ChangePasswordForm,
  ChangePasswordFormResponse,
} from "../../../types/global";

export class AuthService {
  /** Admin panel sign-in — same endpoint, `portal: "admin"` added per the
   * admin RBAC contract. The server refuses a non-admin account with the
   * same generic wording as bad credentials; it never tells the caller which
   * reason applied. */
  static async signinAdmin(data: LoginForm) {
    const url = `${appUrl.auth}/signin/`;
    const response: ApiResponseType<LoginFormResponse> =
      await apiService.getPostApiResponse(url, { ...data, portal: "admin" });
    return response;
  }
  /** Ends the server-side UserSession. Best-effort from the caller's point of
   * view — local tokens are cleared regardless of whether this succeeds. */
  static async signout() {
    const url = `${appUrl.auth}/signout/`;
    const response: ApiResponseType<unknown> = await apiService.getPostApiResponse(url, {});
    return response;
  }
  static async changePassword(data: ChangePasswordForm) {
    const url = `${appUrl.auth}/change-password/`;
    const response: ApiResponseType<ChangePasswordFormResponse> =
      await apiService.getPostApiResponse(url, data);
    return response;
  }
}
