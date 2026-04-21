import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { GMBService } from "../../../api/modules/gmbLeads";
import type { GMBLeadType, GMBKPIDataType } from "../../../types/content/gmbLeads";
import { logger } from "../../../utils/logger";
import { useModal } from "../../../context/ModalContext";
import { useAlert } from "../../../context/AlertContext";
import useAdmin from "../../../components/layout/Admin/useAdmin";
import AddGMBLeadModal from "./components/AddGMBLeadModal";

const useGMBLeads = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const userIdParam = searchParams.get("userId");

    const { userProfile } = useAdmin();
    const { showAlert } = useAlert();
    const { showModal } = useModal();

    const [leads, setLeads] = useState<GMBLeadType[]>([]);
    const [loading, setLoading] = useState(false);
    const [pageNo, setPageNo] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [filters, setFilters] = useState({
        city: "",
        state: "",
        min_rating: "",
        status: "",
        platform: ""
    });
    const [kpis, setKpis] = useState<GMBKPIDataType | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Superadmin specific states
    const [eligibleAdmins, setEligibleAdmins] = useState<{ id: number; username: string; name: string }[]>([]);
    const [selectedAdminId, setSelectedAdminId] = useState<number | null>(
        userIdParam ? Number(userIdParam) : null
    );

    // Sync selectedAdminId with URL param
    useEffect(() => {
        setSelectedAdminId(userIdParam ? Number(userIdParam) : null);
        setPageNo(1);
    }, [userIdParam]);

    const isSuperAdmin = !!(userProfile?.isSuperAdmin || userProfile?.is_superuser || (userProfile as any)?.is_super_admin);

    const fetchAdmins = useCallback(async () => {
        if (!isSuperAdmin) return;
        try {
            const res = await GMBService.fetchAdmins();
            if (res.response) {
                setEligibleAdmins(res.data);
            }
        } catch (error) {
            logger.error("Failed to fetch admins", error);
        }
    }, [isSuperAdmin]);

    const fetchKPIs = useCallback(async () => {
        try {
            const res = await GMBService.fetchKPIs();
            if (res.response) {
                setKpis(res.data);
            }
        } catch (error) {
            logger.error("Failed to fetch KPIs", error);
        }
    }, []);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            if (isSuperAdmin && selectedAdminId) {
                // Audit specific user leads
                res = await GMBService.fetchUserLeads(selectedAdminId, pageNo, pageSize);
            } else {
                // Fetch own leads
                res = await GMBService.fetchMyLeads(pageNo, pageSize, {
                    ...filters,
                    searchText
                });
            }

            if (res.response) {
                setLeads(res.data.leads);
                setTotalPages(res.data.totalPages);
                setHasNext(res.data.hasNext);
            }
        } catch (error) {
            logger.error("Failed to fetch GMB leads", error);
        } finally {
            setLoading(false);
        }
    }, [pageNo, pageSize, filters, searchText, isSuperAdmin, selectedAdminId]);

    useEffect(() => {
        fetchKPIs();
        if (isSuperAdmin) fetchAdmins();
    }, [isSuperAdmin, fetchAdmins, fetchKPIs]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads, refreshTrigger]);

    const handleFilterClick = (key: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: prev[key as keyof typeof filters] === value ? "" : value
        }));
        setPageNo(1);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPageNo(1);
        fetchLeads();
    };

    const handleLeadUpdated = () => {
        setRefreshTrigger(prev => prev + 1);
        fetchKPIs(); // Refresh KPIs if lead updated
    };

    const handleAddClick = () => {
        showModal(<AddGMBLeadModal onSuccess={handleLeadUpdated} />);
    };

    const handleAutoAssign = async () => {
        try {
            setLoading(true);
            const res = await GMBService.autoAssignLeads();
            if (res.response) {
                showAlert(`Successfully assigned ${res.data.processedCount} leads`, "success");
                setRefreshTrigger(prev => prev + 1);
                fetchKPIs();
            }
        } catch (error: any) {
            showAlert(error.message || "Auto-assignment failed", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAdminChange = (adminId: number | null) => {
        if (adminId) {
            setSearchParams({ userId: adminId.toString() });
        } else {
            setSearchParams({});
        }
        setPageNo(1);
    };

    return {
        leads,
        loading,
        pageNo,
        setPageNo,
        totalPages,
        hasNext,
        filters,
        kpis,
        searchText,
        isSuperAdmin,
        eligibleAdmins,
        selectedAdminId,
        handleAdminChange,
        handleAutoAssign,
        handleFilterClick,
        handleSearchChange,
        handleSearchSubmit,
        handleLeadUpdated,
        handleAddClick,
        refreshTrigger
    };
};

export default useGMBLeads;
