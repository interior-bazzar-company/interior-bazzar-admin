import { TokenService } from "./TokenService";
import { AuthService } from "./AuthService";
import { AppExceptions } from "../index";

const ensurePlainHeaders = (headers: unknown): Record<string, string> => {
  if (!headers || typeof headers !== "object") return {};
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
  return headers as Record<string, string>;
};

export const fetchWithAuthRetry = async (
  url: string,
  options: RequestInit,
  auth = true,
  retry = true
): Promise<Response> => {
  const accessToken = auth ? TokenService.getAccessToken() : null;
  const baseHeaders = ensurePlainHeaders(options.headers);
  const headers: Record<string, string> = {
    ...(baseHeaders || {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const requestWithAuth: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, requestWithAuth);

  if (response.status === 401 && retry) {
    const refreshed = await AuthService.refreshToken();

    if (refreshed) {
      const newAccessToken = TokenService.getAccessToken();
      const baseHeaders = ensurePlainHeaders(options.headers);
      const retryHeaders: Record<string, string> = {
        ...(baseHeaders || {}),
        Authorization: `Bearer ${newAccessToken}`,
      };

      return fetch(url, { ...options, headers: retryHeaders });
    }

    TokenService.clearTokens();
    throw new AppExceptions("Unauthorized", 401, false);
  }

  return response;
};
