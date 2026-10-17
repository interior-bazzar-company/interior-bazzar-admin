import config from "../../config";
import { fetchWithAuthRetry } from "./authHelper/fetchWithAuthRetry";
import type { ApiResponseType, RequestOptions } from "../../types/reqResType";
import { getViewAs } from "../../admin/viewAs";

/** The ONE error-code -> words table (F-AD-49). A server or panel refusal can
 *  carry a machine code ("bill_required"); a person must never read it. Known
 *  codes become a sentence; any other trailing "(snake_code)" or bare
 *  snake_case message is dropped / spoken. Add a code here, not in a screen. */
const CODE_WORDS: Record<string, string> = {
  bill_required: "Attach the receipt.",
  bill_type: "The receipt must be an image or a PDF.",
  bill_too_big: "The receipt file is too large.",
  proof_required: "Attach the proof.",
  proof_type: "The proof must be an image or a PDF.",
  proof_too_big: "The proof file is too large.",
  reason_required: "Say why.",
  duplicate_reference: "That reference is already on a record.",
  duplicate_request: "That has already been requested.",
  duplicate_tag: "That name is already in use.",
  invalid_state_transition: "That is not possible in its current state.",
  validation_failed: "Check the details and try again.",
  creation_failed: "It could not be created.",
  super_admin_required: "Only a super admin can do this.",
  already_paid: "It is already paid.",
  nothing_due: "Nothing is due.",
  quotation_lapsed: "This quotation has lapsed. Revise it with a new valid-until date first.",
  no_proof: "No proof is on file for this payment.",
};
export function plainMessage(message: string): string {
  const m = String(message ?? "").trim();
  if (!m) return m;
  if (CODE_WORDS[m]) return CODE_WORDS[m];
  if (/^[a-z]+(_[a-z]+)+$/.test(m)) return m.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) + ".";
  return m.replace(/\s*\([a-z]+(?:_[a-z]+)+\)\s*$/, "").trim();
}

export class AppExceptions extends Error {
  public code: number;
  public response: boolean;

  constructor(message: string, code: number = -1, response: boolean = false) {
    super(plainMessage(message));
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
    const run = async () => {
      const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
      return this.returnResponse<T>(response, options.responseType ?? "json");
    };
    /* Identical GETs in flight at the same moment share ONE request (F-AD-27):
       Overview mounted several widgets that each asked for the same ledger /
       refunds / income URL. Aborted-by-caller requests and non-JSON bodies are
       never shared. */
    if (options.signal || (options.responseType ?? "json") !== "json") return run();
    return this.once("GET", url, null, run);
  }

  /* One write at a time per identical request (F-AD-13). A double click sent
     the same POST twice and the server made two refunds / agreements / notes;
     the second identical call while the first is in flight now shares its
     answer. Keyed on method + URL + JSON body, so two different writes never
     collapse. FormData bodies (uploads) are never shared. */
  private inFlight = new Map<string, Promise<unknown>>();

  private once<T>(method: string, url: string, body: unknown, run: () => Promise<T>): Promise<T> {
    if (body instanceof FormData) return run();
    const key = method + " " + url + " " + JSON.stringify(body ?? null);
    const live = this.inFlight.get(key) as Promise<T> | undefined;
    if (live) return live;
    const p = run().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  async getPostApiResponse<T>(
    url: string,
    body: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "POST",
      body,
      options.responseType ?? "json",
      options.auth ?? true
    );
    return this.once("POST", url, body, async () => {
      const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
      return this.returnResponse<T>(response, options.responseType ?? "json");
    });
  }

  async getPutApiResponse<T>(
    url: string,
    body: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "PUT",
      body,
      "json",
      options.auth ?? true
    );
    return this.once("PUT", url, body, async () => {
      const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
      return this.returnResponse<T>(response, options.responseType ?? "json");
    });
  }

  async getPatchApiResponse<T>(
    url: string,
    body: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "PATCH",
      body,
      options.responseType ?? "json",
      options.auth ?? true
    );

    return this.once("PATCH", url, body, async () => {
      const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
      return this.returnResponse<T>(response, options.responseType ?? "json");
    });
  }

  async getDeleteApiResponse<T>(
    url: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<ApiResponseType<T>> {
    const request = this.createRequest(
      "DELETE",
      body,
      "json",
      options.auth ?? true
    );
    return this.once("DELETE", url, body, async () => {
      const response = await fetchWithAuthRetry(this.buildUrl(url), request, options.auth ?? true);
      return this.returnResponse<T>(response, options.responseType ?? "json");
    });
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

  private createRequest(method: string, body: unknown, data = "json", auth = true) {
    const headers: Record<string, string> = {};
    // remove this because this will be handled by interceptor (fetchWithAuthRetry)
    if (auth) {
      // const token = localStorage.getItem(AUTH_VARS.ACCESS);
      // if (token) {
      //   headers["Authorization"] = `Bearer ${token}`;
      // }
    }

    // Read-only impersonation (Team's "See as this member"): the server keys
    // its read-only, filtered response on this header and refuses every write
    // that carries it, so it goes on EVERY method (without it a write would run
    // as the real admin).
    const viewAs = getViewAs();
    if (viewAs) headers["X-View-As"] = String(viewAs.id);

    if (method === "GET") {
      headers["Content-Type"] = "application/json";
      return { method, headers };
    }

    if (data === "formdata") {
      return { method, body: body as BodyInit, headers };
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
    } catch {
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
