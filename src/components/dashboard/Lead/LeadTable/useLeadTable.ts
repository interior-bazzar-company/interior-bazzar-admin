import { useEffect, useState } from "react";
import { logger } from "../../../../utils/logger";
import { AdminService } from "../../../../api/modules/admin";
import type {
  AdminLeadType,
  LeadFilterType,
} from "../../../../types/content";
const useLeadTable = (filters: LeadFilterType, refreshTrigger?: number) => {
  const [pageSize] = useState<number>(20);
  const [pageNo, setPageNo] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [leads, setLeads] = useState<AdminLeadType[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [noAccess, setNoAccess] = useState<boolean>(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await AdminService.fetchLeads(pageNo, pageSize, filters);
      if (!res.response) {
        logger.error("Failed to fetch leads");
        return;
      }
      setLeads(res.data?.leads || res.data?.results || []);
      setHasNext(res.data?.hasNext || false);
      setTotalPages(res.data?.totalPages || 1);
    } catch (e: any) {
      logger.error("Error while fetching leads: ", e);
      if (e.code === 401 || e.code === 403) setNoAccess(true);
    } finally {
      setLoading(false);
    }
  };

  const onLeadAssigned = (lead: AdminLeadType) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
  };
  useEffect(() => {
    fetchLeads();
    return () => {};
  }, [pageNo, filters, refreshTrigger]);

  useEffect(() => {
    setPageNo(1);
  }, [filters]);
  const incrementPage = () => {
    if (pageNo < totalPages) {
      setPageNo((prev) => prev + 1);
    }
  };

  return {
    leads,
    hasNext,
    pageNo,
    loading,
    pageSize,
    totalPages,
    noAccess,
    setPageNo,
    incrementPage,
    onLeadAssigned,
  };
};

export default useLeadTable;
