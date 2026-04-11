import { useCallback, useEffect, useState } from "react";
import { AdminBusinessDashboardService } from "../../../../api/modules/admin/adminBusinessDashboard";
import type { AdminBusinessDashboardRowType } from "../../../../types/content/businessDashboard";
import { logger } from "../../../../utils/logger";

export interface BusinessDashboardTableFilter {
  searchText?: string;
  status?: string;
  plan?: string;
}

const useBusinessDashboardTable = (filter: BusinessDashboardTableFilter) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [businesses, setBusinesses] = useState<AdminBusinessDashboardRowType[]>([]);
  const [pageNo, setPageNo] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [noAccess, setNoAccess] = useState<boolean>(false);

  const fetchBusinesses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await AdminBusinessDashboardService.fetchBusinesses(pageNo, pageSize, filter);
      if (!res.response) {
        logger.error("BusinessDashboardTable: Failed to fetch businesses");
        return;
      }
      setHasNext(res.data.hasNext);
      setTotalPages(res.data.totalPages);
      setBusinesses(res.data.businesses || (res.data as any).results || []);
    } catch (error: any) {
      logger.error("BusinessDashboardTable: Error fetching businesses:", error);
      if (error.code === 401 || error.code === 403) setNoAccess(true);
    } finally {
      setLoading(false);
    }
  }, [pageNo, pageSize,filter.searchText, filter.status, filter.plan]);

  useEffect(() => {
    // Reset to page 1 when filter changes
    setPageNo(1);
  }, [filter.plan]);

  useEffect(() => {
  fetchBusinesses();
  }, [pageNo, filter.searchText, filter.status, filter.plan]);

  const incrementPage = () => {
    if (pageNo < totalPages) {
      setPageNo((prev) => prev + 1);
    }
  };

  return {
    pageNo,
    loading,
    hasNext,
    pageSize,
    setPageNo,
    businesses,
    totalPages,
    noAccess,
    incrementPage,
    refetch: fetchBusinesses,
    setBusinesses,
  };
};

export default useBusinessDashboardTable;
