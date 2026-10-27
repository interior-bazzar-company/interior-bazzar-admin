// ── CmsService ──
// The admin CMS: one route family, `v1/admin/cms/<resource>/`, over the backend's
// CmsController.RESOURCES (interior_admin/Controllers/Cms). Every write goes
// through `call()` so a `response:false` refusal throws like a transport error.
import appUrl from "../../endpoints";
import apiService, { AppExceptions } from "../../apiService";
import { fetchWithAuthRetry } from "../../apiService/authHelper/fetchWithAuthRetry";
import config from "../../../config";
import { call } from "../adminOps";

const base = `${appUrl.admin}/cms`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are whatever the resource's model holds
export type CmsRow = Record<string, any> & { id: number };
export type CmsList = {
  rows: CmsRow[]; total: number; pageNo: number; pageSize: number;
  canCreate: boolean; canDelete: boolean;
  /** days a deleted row stays restorable; null = this resource is never deleted */
  keepDays: number | null;
  /** distinct values of the resource's facet fields, for filter dropdowns */
  facets: Record<string, string[]>;
};
export type BinRow = {
  id: number; resource: string; rowId: string; title: string;
  deletedBy: string; deletedAt: string; purgeAt: string;
};

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== "") s.set(k, String(v)); });
  const out = s.toString();
  return out ? "?" + out : "";
};

export default class CmsService {
  static list(resource: string, params: Record<string, string | number | undefined> = {}) {
    return call(apiService.getGetApiResponse<CmsList>(`${base}/${resource}/${qs(params)}`));
  }
  static get(resource: string, id: number | string) {
    return call(apiService.getGetApiResponse<CmsRow>(`${base}/${resource}/${id}/`));
  }
  static save(resource: string, data: Record<string, unknown>, id?: number | string) {
    return call(id
      ? apiService.getPutApiResponse<CmsRow>(`${base}/${resource}/${id}/`, data)
      : apiService.getPostApiResponse<CmsRow>(`${base}/${resource}/`, data));
  }
  /** Into the recycle bin — restorable until `purgeAt`. */
  static remove(resource: string, id: number | string) {
    return call(apiService.getDeleteApiResponse<{ id: number; result: "deleted"; binId: number; purgeAt: string }>(
      `${base}/${resource}/${id}/`));
  }
  static bin(params: { resource?: string; pageNo?: number } = {}) {
    return call(apiService.getGetApiResponse<{ rows: BinRow[]; total: number; pageNo: number; pageSize: number }>(
      `${base}/bin/${qs(params)}`));
  }
  static restore(binId: number) {
    return call(apiService.getPostApiResponse<{ resource: string; id: number }>(`${base}/bin/${binId}/restore/`, {}));
  }
  static purge(binId: number) {
    return call(apiService.getDeleteApiResponse<{ id: number }>(`${base}/bin/${binId}/`));
  }
  static normalizeCity(q: string) {
    return call(apiService.getGetApiResponse<{
      input: string; canonical: string; matchedCity: { id: number; name: string } | null; via: "alias" | "exact" | "none";
    }>(`${base}/cities/normalize/${qs({ q })}`));
  }
  static reorder(resource: string, ids: number[]) {
    return call(apiService.getPostApiResponse<{ ids: number[] }>(`${base}/${resource}/reorder/`, { ids }));
  }
  static reviewKyc(id: number, status: "verified" | "rejected", rejectReason = "") {
    return call(apiService.getPostApiResponse<{ id: number; status: string; businessVerified: boolean }>(
      `${base}/kyc/${id}/review/`, { status, rejectReason }));
  }
  static subscriberStats() {
    return call(apiService.getGetApiResponse<{
      total: number; active: number; confirmed: number; bySource: { source: string; n: number }[];
    }>(`${base}/subscribers/stats/`));
  }
  /** The body IS the CSV, not the envelope — so this goes around apiService. */
  static async subscriberExport(params: Record<string, string | undefined> = {}) {
    const res = await fetchWithAuthRetry(`${config.BASE_URL}/${base}/subscribers/export/${qs(params)}`, { method: "GET" });
    if (!res.ok) throw new AppExceptions("Could not export subscribers.", res.status, false);
    return res.text();
  }
}
