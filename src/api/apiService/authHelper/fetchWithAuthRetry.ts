import { TokenService } from "./TokenService";
import { AuthService } from "./AuthService";
import { AppExceptions, SERVICE_MESSAGE } from "../index";

/* `fetch` rejects with a bare TypeError ("Failed to fetch", "NetworkError…")
   when the backend is down, DNS fails, the browser is offline or CORS refuses
   the preflight. That message is browser-internal noise and, left alone, it
   escapes as an unhandled rejection or lands in a toast verbatim. Normalising
   it HERE — the one function every request in the panel goes through — is what
   lets every caller keep its single catch and still say something sane.
   An abort is NOT a failure: it is this app cancelling its own request (the
   deals search does it on every keystroke), so it passes straight through. */
const send = async (url: string, req: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, req);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new AppExceptions(SERVICE_MESSAGE, 503, false);
  }
};

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

  const response = await send(url, requestWithAuth);

  if (response.status === 401 && retry) {
    const refreshed = await AuthService.refreshToken();

    if (refreshed) {
      const newAccessToken = TokenService.getAccessToken();
      const baseHeaders = ensurePlainHeaders(options.headers);
      const retryHeaders: Record<string, string> = {
        ...(baseHeaders || {}),
        Authorization: `Bearer ${newAccessToken}`,
      };

      return send(url, { ...options, headers: retryHeaders });
    }

    TokenService.clearTokens();
    throw new AppExceptions("Unauthorized", 401, false);
  }

  return response;
};
