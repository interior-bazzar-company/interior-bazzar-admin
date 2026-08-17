import type { AUTH_VARS } from "../../utils/constants/app";
import type {
  AdminBusinessListType,
  AdminBusinessListTypeV2,
  AdminLeadType,
  BusinessCardProps,
  FunnelLeadType,
  SignupData,
} from "../content";
import type { BlogType } from "../global";
/* ############################################################################################## */
export interface ApiResponseType<T> {
  data: T;
  response: boolean;
  message: string;
  code: number;
}

export interface ApiErrorType {
  message: string;
  status: string;
  code: number;
}

export interface RequestOptions {
  auth?: boolean;
  /** "formdata" tells apiService.createRequest to send `body` as-is (a
   *  FormData instance) instead of JSON.stringify-ing it — the runtime branch
   *  for this already existed, this literal was just never in the type so
   *  nothing could reach it. The response is still parsed as JSON either way
   *  (returnResponse's switch has no "formdata" case, so it falls to the
   *  default `response.json()`), which is exactly right: a multipart
   *  REQUEST with a JSON response, e.g. a file upload. */
  responseType?: "json" | "text" | "blob" | "arrayBuffer" | "formdata";
  signal?: AbortSignal;
}
// admin panel here

export interface BusinessAnalyticsRes {
  daily: SignupData[];
  monthly: SignupData[];
  weekly: SignupData[];
}
export interface GetPaginatedAdminLeadsType {
  pageNo: number;
  hasNext: boolean;
  totalPages: number;
  leads?: AdminLeadType[];
  results?: AdminLeadType[];
}
export interface GetPaginatedAdminBusinessesType {
  pageNo: number;
  hasNext: boolean;
  totalPages: number;
  businesses: AdminBusinessListType[];
}
export interface GetPaginatedAdminBusinessesTypeV2 {
  pageNo: number;
  hasNext: boolean;
  totalPages: number;
  businesses: AdminBusinessListTypeV2[];
}
export interface GetPaginatedFunnelLeadType {
  pageNo: number;
  hasNext: boolean;
  totalPages: number;
  leads: FunnelLeadType[];
}

export interface GetPaginatedBusinessAnalytics {
  pageNo: number;
  hasNext: boolean;
  totalPages: number;
  businessAnalytics: BusinessAnalyticsRes;
}
export interface GetPaginated {
  pageNo: number;
  hasNext: boolean;
  totalPages: number;
  leads: FunnelLeadType[];
}
export interface LeadsAnalytics {
  unassignedLeads: number;
  assignedLeads: number;
  platformLeads: number;
  totalLeads: number;
  todayLeads: number;
}
export interface UserGrowthAnalytics {
  date: string;
  users: number;
}

/* ############################################################################################## */

export interface BusinessSearchType {
  id: number;
  businessName: string;
  businessImage: string;
}
export interface BusinessSearchResType {
  businesses: BusinessSearchType[];
}

//admin auth req res types ends

// Response After sendin Mobile no to auth

export interface VerifyOtpReqType {
  [AUTH_VARS.SESSION]: string | null;
  otp: string;
}
export interface VerifyOtpEmployeeResType {
  id: number;
}
export interface SendMobileResType {
  [AUTH_VARS.SESSION]: string;
}

export interface VerifyOtpResType {
  [AUTH_VARS.ACCESS]: string;
  [AUTH_VARS.REFRESH]: string;
  isAuthenticated?: boolean;
}

export interface UploadUrlReqType {
  fileName: string;
  fileType: string;
  for: string;
}

export interface UploadUrlResType {
  uploadUrl: string;
  fileUrl: string;
}

// home page req res types

export interface GetPaginatedBusinessResType {
  pageNo: number;
  hasNext: boolean;
  totalPages: number;
  data: BusinessCardProps[];
}
export interface GetTopSellersResType {
  // data: BusinessCardProps[];

  // topSeller: BusinessCardProps;
  topSeller: BusinessCardProps[];
  businesses: BusinessCardProps[];
  hasNext: boolean;
  totalPage: number;
  pageNo: number;
}

export interface GetPaginatedBlogs {
  blogs: BlogType[];
  hasNext: boolean;
  totalPage: number;
  pageNo: number;
}
