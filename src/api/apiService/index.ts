import config from "../../config";
import { fetchWithAuthRetry } from "./authHelper/fetchWithAuthRetry";
import type { ApiResponseType, RequestOptions } from "../../types/reqResType";

export class AppExceptions extends Error {
  public code: number;
  public response: boolean;

  constructor(message: string, code: number = -1, response: boolean = false) {
    super(message);
    this.code = code;
    this.response = response;
  }
}

/** The ONE thing a screen says when the failure is ours, not the user's: the
 *  server is unreachable, it answered 5xx, or it answered something that isn't
 *  JSON (an nginx 502 page, a Django traceback). None of those carry a message
 *  worth showing — a stack trace, a hostname, a "connection refused" or an
 *  upstream error page is internal detail, so it is dropped here at the
 *  boundary rather than trusted not to reach a toast. Only a real, deliberate
 *  4xx business message from the API is ever printed as-is. */
export const SERVICE_MESSAGE = "Something went wrong. Please try again in a moment.";

/** "The service is having a problem", as opposed to a refusal the user can act
 *  on. Guards use it to hold a session through a backend restart instead of
 *  signing the user out over a failed fetch. */
export const isServiceError = (e: unknown) => e instanceof AppExceptions && e.code >= 500;

/** The message a screen may print for any thrown thing. An AppExceptions has
 *  already passed the boundary above, so its text is either a real 4xx reason
 *  meant for a person or SERVICE_MESSAGE; anything else is an unplanned JS
 *  error whose text ("x is not a function", "Failed to fetch") is internal —
 *  so it becomes the generic line instead of reaching a toast. */
export const errMessage = (e: unknown) => (e instanceof AppExceptions ? e.message : SERVICE_MESSAGE);

export class ApiService {
  private buildUrl = (url: string) => {
    return `${config.BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
  };

  async getGetApiResponse<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest("GET", {}, "json", options.auth ?? true);
    //new
    if (options.signal) {
      (request as RequestInit).signal = options.signal;
    }
    //new end
    const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);

    return this.returnResponse(response, options.responseType ?? "json");
  }

  async getPostApiResponse<T>(
    url: string,
    body: any,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "POST",
      body,
      options.responseType ?? "json",
      options.auth ?? true
    );
    const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
    return this.returnResponse(response, options.responseType ?? "json");
  }

  async getPutApiResponse<T>(
    url: string,
    body: any,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "PUT",
      body,
      "json",
      options.auth ?? true
    );
    const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
    return this.returnResponse(response, options.responseType ?? "json");
  }

  async getPatchApiResponse<T>(
    url: string,
    body: any,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "PATCH",
      body,
      options.responseType ?? "json",
      options.auth ?? true
    );

    const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
    return this.returnResponse(response, options.responseType ?? "json");
  }

  async getDeleteApiResponse<T>(
    url: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "DELETE",
      body,
      "json",
      options.auth ?? true
    );
    const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
    return this.returnResponse(response, options.responseType ?? "json");
  }

  // private createRequest(
  //   method: string,
  //   body?: any,
  //   responseType: "json" | "text" | "blob" | "arrayBuffer" = "json",
  //   auth: boolean = true
  // ): RequestInit {
  //   const headers: HeadersInit = {};

  //   // ✅ Only set JSON header if body is NOT FormData
  //   if (!(body instanceof FormData)) {
  //     headers["Content-Type"] = "application/json";
  //   }

  //   let requestBody: BodyInit | undefined;
  //   if (body !== undefined && body !== null) {
  //     if (body instanceof FormData) {
  //       requestBody = body; // ✅ send FormData directly
  //     } else {
  //       requestBody = JSON.stringify(body);
  //     }
  //   }

  //   return {
  //     method,
  //     headers,
  //     body: requestBody,
  //   };
  // }

  private createRequest(method: string, body: any, data = "json", auth = true) {
    const headers: Record<string, string> = {};
    // remove this because this will be handled by interceptor (fetchWithAuthRetry)
    if (auth) {
      // const token = localStorage.getItem(AUTH_VARS.ACCESS);
      // if (token) {
      //   headers["Authorization"] = `Bearer ${token}`;
      // }
    }

    if (method === "GET") {
      headers["Content-Type"] = "application/json";
      return { method, headers };
    }

    if (data === "formdata") {
      return { method, body, headers };
    }

    headers["Content-Type"] = "application/json";
    return { method, body: JSON.stringify(body), headers };
  }

  private async returnResponse<T>(
    response: Response,
    responseType: RequestOptions["responseType"]
  ): Promise<ApiResponseType<T>> {
    let body: ApiResponseType<T> | string | Blob | ArrayBuffer;

    try {
      switch (responseType) {
        case "text":
          body = await response.text();
          break;
        case "blob":
          body = await response.blob();
          break;
        case "arrayBuffer":
          body = await response.arrayBuffer();
          break;
        default:
          body = await response.json();
      }
    } catch (error) {
      // Not JSON — an nginx 502 page, a Django debug traceback, a truncated
      // body. Whatever it is, it is not for the user to read.
      throw new AppExceptions(SERVICE_MESSAGE, 502, false);
    }

    if (response.ok) {
      return body as ApiResponseType<T>;
    }

    // 5xx is never the caller's fault and never carries a printable reason.
    if (response.status >= 500) {
      throw new AppExceptions(SERVICE_MESSAGE, response.status, false);
    }

    // Handle error response shape
    const errBody = body as Partial<ApiResponseType<unknown>>;
    throw new AppExceptions(
      errBody.message || "Unexpected error",
      errBody.code || response.status,
      errBody.response || false
    );
  }
}

const apiService = new ApiService();

export default apiService;
