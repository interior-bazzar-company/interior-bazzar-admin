import { useEffect, useState, useCallback } from "react";
import type { LeadFilterType, LeadsDashboardStatsType } from "../../../types/content";
import { AdminService } from "../../../api/modules/admin";
import { logger } from "../../../utils/logger";
import useToast from "../../../components/shared/Toast/useToast";
import { useModal } from "../../../context/ModalContext";
import AddLeadModal from "../../../components/dashboard/Lead/AddLeadModal";

const useLeads = () => {
  const { showToast } = useToast();
  const { showModal } = useModal();
  const [stats, setStats] = useState<LeadsDashboardStatsType | null>(null);
  const [noAccess, setNoAccess] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const [filters, setFilters] = useState<LeadFilterType>({
    sortBy: "",
    searchText: "",
    category: "",
    leadStatus: "",
    filterStatus: "",
    
  });

  const [searchText, setSearchText] = useState<string>("");

  const fetchLeadsStats = useCallback(async () => {
    try {
      const res = await AdminService.getLeadsAnalytics();
      if (!res.response) {
        logger.error("Failed to fetch leads stats");
        if (res.code === 401 || res.code === 403) setNoAccess(true);
        return;
      }
      setStats(res.data);
    } catch (e: any) {
      logger.error("Error while fetching leads stats: ", e);
      if (e.code === 401 || e.code === 403 || (e.message && e.message.toLowerCase().includes("access not granted"))) {
        setNoAccess(true);
        showToast({ greeting: "Error", booldMessage: "Access Denied", normalMessage: "Access not granted", type: "error" });
      } else {
        showToast({ greeting: "Error", booldMessage: "Failed", normalMessage: e.message || "Failed to fetch stats", type: "error" });
      }
    }
  }, [showToast]);

  useEffect(() => {
    fetchLeadsStats();
  }, [fetchLeadsStats]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({
      ...prev,
      searchText: searchText,
    }));
  };

  const handleFilterClick = (filterType: keyof LeadFilterType, value: string) => {
    setFilters(prev => {
      const isAlreadyActive = prev[filterType] === value;
      
      // Enforce strict mutual exclusivity across all rows (Category, Lead Status, Filter Status)
      // Only one filter can be applied at a time as per requirement.
      return {
        ...prev,
        category: filterType === "category" && !isAlreadyActive ? value : "",
        leadStatus: filterType === "leadStatus" && !isAlreadyActive ? value : "",
        filterStatus: filterType === "filterStatus" && !isAlreadyActive ? value : "",
      };
    });
  };


  const handleAddClick = () => {
    showModal(<AddLeadModal onSuccess={() => {
      fetchLeadsStats();
      setRefreshTrigger(prev => prev + 1);
    }} />);
  };

  return {
    searchText,
    filters,
    stats,
    handleSearch,
    handleSearchChange,
    handleFilterClick,
    handleAddClick,
    noAccess,
    refreshTrigger,
  };
};

export default useLeads;
