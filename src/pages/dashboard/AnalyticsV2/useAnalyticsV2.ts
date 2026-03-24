import { useEffect, useState, useCallback } from "react";
import { AdminService } from "../../../api/modules/admin";
import { logger } from "../../../utils/logger";
import type { DashboardV2Type } from "../../../types/content";

// Mock data for the charts as per the mockup visual

const useAnalyticsV2 = () => {
  const [loading, setLoading] = useState(true);
  const [businessStats, setBusinessStats] = useState<DashboardV2Type | null>(null);
  const [leadStats, setLeadStats] = useState<any>(null);
  const [businessChartData, setBusinessChartData] = useState<any[]>([]);
  const [leadChartData, setLeadChartData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [noAccessBizStats, setNoAccessBizStats] = useState(false);
  const [noAccessLeadStats, setNoAccessLeadStats] = useState(false);
  const [noAccessBizChart, setNoAccessBizChart] = useState(false);
  const [noAccessDistChart, setNoAccessDistChart] = useState(false);
  const [noAccessLeadChart, setNoAccessLeadChart] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [bizRes, leadRes, bizChartRes, leadChartRes, distRes, detailedLeadRes] = await Promise.all([
        AdminService.fetchDashboardV2(),
        AdminService.getLeadsAnalytics(),
        AdminService.getBusinessAnalytics(),
        AdminService.postLeadsStatsV2({
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          page_number: 1,
          page_size: 10
        }),
        AdminService.getUserGrowthAnalytics(),
        AdminService.getDetailedLeadAnalytics(),
      ]);

      if (!bizRes.response && (bizRes.code === 401 || bizRes.code === 403)) setNoAccessBizStats(true);
      if (!leadRes.response && (leadRes.code === 401 || leadRes.code === 403)) setNoAccessLeadStats(true);
      if (!bizChartRes.response && (bizChartRes.code === 401 || bizChartRes.code === 403)) setNoAccessBizChart(true);
      if (!leadChartRes.response && (leadChartRes.code === 401 || leadChartRes.code === 403)) {
        // leadChartRes is not used for primary data currently, but we check for completeness
      }
      if (!distRes.response && (distRes.code === 401 || distRes.code === 403)) setNoAccessDistChart(true);
      if (!detailedLeadRes.response && (detailedLeadRes.code === 401 || detailedLeadRes.code === 403)) setNoAccessLeadChart(true);

      if (bizRes.response) setBusinessStats(bizRes.data);
      if (leadRes.response) setLeadStats(leadRes.data);
      if (bizChartRes.response) setBusinessChartData(bizChartRes.data);
      if (distRes.response) setDistributionData(distRes.data);
      if (detailedLeadRes.response) setLeadChartData(detailedLeadRes.data);
    } catch (e: any) {
      logger.error("Error fetching analytics v2:", e);
      if (e.code === 401 || e.code === 403) {
        setNoAccessBizStats(true);
        setNoAccessLeadStats(true);
        setNoAccessBizChart(true);
        setNoAccessDistChart(true);
        setNoAccessLeadChart(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    businessStats,
    leadStats,
    businessChartData,
    leadChartData,
    distributionData,
    noAccessBizStats,
    noAccessLeadStats,
    noAccessBizChart,
    noAccessDistChart,
    noAccessLeadChart,
    refetch: fetchData,
  };
};

export default useAnalyticsV2;
