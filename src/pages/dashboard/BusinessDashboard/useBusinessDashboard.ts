import { useEffect, useState } from "react";
import type { BusinessDashboardStatsType } from "../../../types/content/businessDashboard";
import { AdminBusinessDashboardService } from "../../../api/modules/admin/adminBusinessDashboard";
import { logger } from "../../../utils/logger";

const DEFAULT_DASHBOARD_STATS: BusinessDashboardStatsType = {
  totalBusiness: 0,
  registered: 0,
  planPurchased: 0,
  networkLeader: 0,
  plan_metrics: {
    "Network Leader": 0,
    "Grow with AI": 0,
    "Scale with Partner": 0,
  },
};

const useBusinessDashboard = () => {
  const [dashboardStats, setDashboardStats] = useState<BusinessDashboardStatsType>(
    DEFAULT_DASHBOARD_STATS
  );
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<{ 
    searchText?: string, 
    status?: "active" | "inactive" | "",
    plan?: string 
  }>({
    searchText: "",
    status: "",
    plan: ""
  });
  const [noAccess, setNoAccess] = useState<boolean>(false);

  const fetchStats = async () => {
    try {
      // In a real scenario we'd hit the API, for now using fetchDashboardStats
      // The API returns DashboardV2Type, we map it or just use it. 
      // Based on AIDOCS, v2 dashboard returns totalBusinesses, totalActive, etc.
      // E.g. mapped or exactly as returned. The type matches the design needs.
      const res = await AdminBusinessDashboardService.fetchDashboardStats();
      if (res.response && res.data) {
        // Map backend state to the mockup's exact fields if needed.
        // Assuming backend gives totalBusinesses, etc.
        setDashboardStats({
          ...DEFAULT_DASHBOARD_STATS,
          ...res.data,
          // mockup hardcodes 'registered', 'planPurchased', 'networkLeader' if not supplied
          totalBusiness: res.data.totalBusinesses || res.data.totalBusiness || 0,
          registered: (res.data as any).registered || res.data.totalBusinesses || 0,
          planPurchased: (res.data as any).planPurchased || res.data.totalActiveBusinesses || 0,
          networkLeader: (res.data as any).networkLeader || res.data.plan_metrics?.["Network Leader"] || 0,
        });
      } else {
        if (res.code === 401 || res.code === 403) setNoAccess(true);
      }
    } catch (error: any) {
      logger.error("Failed to fetch dashboard stats", error);
      if (error.code === 401 || error.code === 403) setNoAccess(true);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, searchText }));
  };

  const handleFilterClick = (type: "status" | "plan", value: string) => {
    setFilters(prev => {
      // Toggle off if clicking the same filter
      const isStatusActive = type === "status" && prev.status === value;
      const isPlanActive = type === "plan" && prev.plan === value;

      if (isStatusActive || isPlanActive) {
        return { ...prev, status: "", plan: "" };
      }

      // Mutual exclusion: clear others when one is selected
      return {
        ...prev,
        status: type === "status" ? value as any : "",
        plan: type === "plan" ? value : ""
      };
    });
  };

  return {
    dashboardStats,
    searchText,
    handleSearchChange,
    handleSearchSubmit,
    handleFilterClick,
    filters,
    noAccess,
  };
};

export default useBusinessDashboard;
