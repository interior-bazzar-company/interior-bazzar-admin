import config from "../../../config";
import appUrl from "../../endpoints";
import { TokenService } from "./TokenService";

export class AuthService {
  static async refreshToken(): Promise<boolean> {
    const refreshToken = TokenService.getRefreshToken();
    if (!refreshToken) return false;

    try {
      // Built from appUrl, not hand-written: this used to be "/auth/…" with the
      // v1 prefix missing, so every refresh 404'd and the session simply died at
      // access-token expiry instead of renewing.
      const response = await fetch(
        `${config.BASE_URL}/${appUrl.auth}/get-refresh-token/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        }
      );

      if (!response.ok) return false;

      const data = await response.json();
      TokenService.setTokens(data.access, data.refresh);
      return true;
    } catch {
      return false;
    }
  }
}
