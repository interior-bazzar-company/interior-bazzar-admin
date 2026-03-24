import { useEffect, useState } from "react";
import type { BusinessFilterType,DashboardStatsType } from "../../../types/content";
import { AdminService } from "../../../api/modules/admin";
import { logger } from "../../../utils/logger";
const useBusinesses = () => {
  const DEFAULT_DASHBOARD_STATS: DashboardStatsType = {
    totalBusinesses: 0,
    weeklySignups: 0,
    totalActiveBusinesses: 0,
    totalInactiveBusinesses: 0,
    plan_metrics: {
      "Grow with AI": 0,
      "Scale with Partner": 0,
      "Network Leader": 0,
      "Verified seller":0,
      
    },
  };
  const [noOfUsers, setNoOfUsers] = useState<number>(0);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsType | null>(DEFAULT_DASHBOARD_STATS);
  const [selectOptions] = useState<string[]>(["All", "Active"]);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [filters, setFilters] = useState<BusinessFilterType>({
    sortBy: "",
    searchText: "",
  });
  const [searchText, setSearchText] = useState<string>("");
  const [noAccessDashboard, setNoAccessDashboard] = useState<boolean>(false);
  const [noAccessUsers, setNoAccessUsers] = useState<boolean>(false);
  const handleChange = (
    e:
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    if (e.target.name === "searchText") setSearchText(value);
    else if (e.target.name === "sortBy") setSelectedOption(value);
  };
  const fetchDashboard = async () => {
    try {
      const res = await AdminService.fetchDashboardV2();

      if (!res.response) {
        logger.error("Failed to fetch dashboard");
        if (res.code === 401 || res.code === 403) setNoAccessDashboard(true);
        return;
      }

      setDashboardStats(res.data);
    } catch (e: any) {
      logger.error("Error while setting dashboard stats: ", e);
      if (e.code === 401 || e.code === 403) setNoAccessDashboard(true);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({
      ...prev,
      searchText: searchText,
      sortBy: selectedOption,
    }));
  };

  const handleFilterClick = (planName: string) => {
    setFilters(prev => ({
      ...prev,
      plan: prev.plan === planName ? undefined : planName
    }));
  };
  const fetchUsers = async () => {
    try {
      const res = await AdminService.fetchTotalUsers();
      if (!res.response) {
        logger.error("Failed to fetch total users");
        return;
      }
      setNoOfUsers(res.data.totalUsers);
    } catch (e: any) {
      logger.error("Error while setting total User: ", e);
      if (e.code === 401 || e.code === 403) setNoAccessUsers(true);
    }
  };
  useEffect(() => {
    fetchUsers();
    fetchDashboard();
  }, []);
  return {
    searchText,
    selectedOption,
    filters,
    noOfUsers,
    selectOptions,
    handleSearch,
    handleChange,
    handleFilterClick,
    dashboardStats,
    noAccessDashboard,
    noAccessUsers,
  };
};
export default useBusinesses;
