/**
 * Frontend Caching Utility for InteriorBazaar Admin
 * Supports LocalStorage and SessionStorage with TTL (Time-To-Live)
 */

export const CACHE_KEYS = {
  TOTAL_USERS: "admin_total_users",
  ALL_ANALYTICS: "admin_all_analytics",
  BUSINESS_ANALYTICS: "admin_business_analytics",
  USER_GROWTH: "admin_user_growth",
  DASHBOARD_V2: "admin_dashboard_v2",
  DETAILED_LEAD_ANALYTICS: "admin_detailed_lead_analytics",
  BUSINESS_LIST_PAGE_1: "admin_business_list_page_1",
  BUSINESS_LIST_V2: "admin_business_list_v2", // Query-aware
  LEAD_LIST_PAGE_1: "admin_lead_list_page_1",
  FUNNEL_LIST_PAGE_1: "admin_funnel_list_page_1",
  SEARCH_RESULTS: "admin_search_results", // Query-aware
  BUSINESS_DETAIL: "admin_business_detail", // ID-aware
  LEADS_SUMMARY: "admin_leads_summary",
  LEADS_STATS_V2: "admin_leads_stats_v2", // Query-aware
  GMB_LEAD_LIST_PAGE_1: "admin_gmb_lead_list_page_1",
  GMB_KPIs: "admin_gmb_kpis",
  ADMIN_TEAM_LIST: "admin_team_list",
  GMB_USER_LEADS: "admin_gmb_user_leads", // ID-aware
  USER_PROFILE: "admin_user_profile",
  CMS_CONTENT: "admin_cms_content", // Key-aware
  USER_MANAGEMENT_LIST: "admin_management_user_list",
  RBAC_ROLES: "admin_rbac_roles",
};

interface CacheData<T> {
  data: T;
  expiry: number;
}

/**
 * Set data in cache
 * @param key Cache key
 * @param data Data to store
 * @param ttlInMinutes Time to live in minutes
 * @param storage Storage engine ('session' or 'local')
 */
export const setCache = <T>(
  key: string,
  data: T,
  ttlInMinutes: number,
  storage: "session" | "local" = "session"
) => {
  try {
    const expiry = Date.now() + ttlInMinutes * 60 * 1000;
    const cacheData: CacheData<T> = { data, expiry };
    const engine = storage === "session" ? window.sessionStorage : window.localStorage;
    engine.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error("Cache Set Error:", error);
  }
};

/**
 * Get data from cache
 * @param key Cache key
 * @param storage Storage engine ('session' or 'local')
 * @returns Cached data or null if expired/not found
 */
export const getCache = <T>(
  key: string,
  storage: "session" | "local" = "session"
): T | null => {
  try {
    const engine = storage === "session" ? window.sessionStorage : window.localStorage;
    const cached = engine.getItem(key);
    if (!cached) return null;

    const { data, expiry }: CacheData<T> = JSON.parse(cached);
    if (Date.now() > expiry) {
      engine.removeItem(key);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Cache Get Error:", error);
    return null;
  }
};

/**
 * Clear specific cache key
 */
export const clearCache = (key: string, storage: "session" | "local" = "session") => {
  const engine = storage === "session" ? window.sessionStorage : window.localStorage;
  engine.removeItem(key);
};
