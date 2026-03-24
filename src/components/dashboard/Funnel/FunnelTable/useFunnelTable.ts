import { useEffect, useState } from "react";
import { logger } from "../../../../utils/logger";
import { AdminService } from "../../../../api/modules/admin";
import type {
  FunnelLeadType,
  TableFilterType,
} from "../../../../types/content";
const useFunnelTable = (filter: TableFilterType) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [leads, setLeads] = useState<FunnelLeadType[]>([]);
  const [pageNo, setPageNo] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [noAccess, setNoAccess] = useState<boolean>(false);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const res = await AdminService.fetchFunnelLeads(pageNo, pageSize);
      if (!res.response) {
        logger.error("Failed to fetch businesses");
        return;
      }
      setHasNext(res.data.hasNext);
      setTotalPages(res.data.totalPages);
      setLeads(res.data.leads);
    } catch (e: any) {
      logger.error("Error while fetching businesses: ", e);
      if (e.code === 401 || e.code === 403) setNoAccess(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
    return () => {
      logger.warn("this is it:", filter);
    };
  }, [pageNo]);
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
    leads,
    totalPages,
    noAccess,
    incrementPage,
  };
};

export default useFunnelTable;
