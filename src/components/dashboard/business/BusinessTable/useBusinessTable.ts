import { useEffect, useState } from "react";
import { logger } from "../../../../utils/logger";
import { AdminService } from "../../../../api/modules/admin";
import type {
  AdminBusinessListType,
  BusinessFilterType,
  AdminBusinessListTypeV2,
} from "../../../../types/content";
const useBusinessTable = (_filter: BusinessFilterType) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [businesses, setBusinesses] = useState<AdminBusinessListType[]>([]);
  const [pageNo, setPageNo] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageSize] = useState<number>(20);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const res = await AdminService.fetchBusinesses(pageNo, pageSize);
      if (!res.response) {
        logger.error("Failed to fetch businesses");
        return;
      }
      setHasNext(res.data.hasNext);
      setTotalPages(res.data.totalPages);
      setBusinesses(res.data.businesses);
    } catch (e) {
      logger.error("Error while fetching businesses: ", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
    return () => {};
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
    businesses,
    totalPages,
    incrementPage,
  };
};


export const useBusinessTableV2 = (_filter: BusinessFilterType) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [businesses, setBusinesses] = useState<AdminBusinessListTypeV2[]>([]);
  const [pageNo, setPageNo] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageSize] = useState<number>(20);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const reqData: any = {
        page_number: _filter?.plan ? 1 : pageNo,
        page_size: pageSize,
        start_date: "2020-01-01",
        end_date: "2030-12-31",
      };
      if (_filter?.plan) {
         reqData.plan = _filter.plan; // user says: instead of id, send name
      }
      const res = await AdminService.fetchBusinessesv2(reqData);
      if (!res.response) {
        logger.error("Failed to fetch businesses");
        return;
      }
      setHasNext(res.data.hasNext);
      setTotalPages(res.data.totalPages);
      setBusinesses(res.data.businesses || (res.data as any).results || []);
    } catch (e) {
      logger.error("Error while fetching businesses: ", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageNo(1);
  }, [_filter?.plan]);

  useEffect(() => {
    fetchBusinesses();
  }, [pageNo, _filter?.plan]);

  
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
    incrementPage,
    setBusinesses,
  };
};



export default useBusinessTable;
