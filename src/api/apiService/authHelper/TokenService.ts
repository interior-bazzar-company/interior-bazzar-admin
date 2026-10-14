import { AUTH_VARS } from "../../../utils/constants/app";
export class TokenService {
  static getAccessToken() {
    return localStorage.getItem(AUTH_VARS.ACCESS);
  }

  static getRefreshToken() {
    return localStorage.getItem(AUTH_VARS.REFRESH);
  }

  static setTokens(access: string, refresh: string) {
    localStorage.setItem(AUTH_VARS.ACCESS, access);
    localStorage.setItem(AUTH_VARS.REFRESH, refresh);
  }

  static clearTokens() {
    localStorage.removeItem(AUTH_VARS.ACCESS);
    localStorage.removeItem(AUTH_VARS.REFRESH);
  }
}
