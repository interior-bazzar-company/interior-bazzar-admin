import { useState, useEffect, useCallback } from "react";
import { GMBService } from "../../../api/modules/gmbLeads";
import type { GMBLeadType } from "../../../types/content/gmbLeads";
import { logger } from "../../../utils/logger";

const useGMBLeads = () => {
    const [leads, setLeads] = useState<GMBLeadType[]>([]);
    const [loading, setLoading] = useState(false);
    const [pageNo, setPageNo] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [stats, setStats] = useState<any>(null); // Simplified for now
    const [searchText, setSearchText] = useState("");
    const [filters, setFilters] = useState({
        city: "",
        min_rating: "",
        status: "",
        platform: ""
    });
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const res = await GMBService.fetchMyLeads(pageNo, pageSize, {
                ...filters,
                searchText
            });
            if (res.response) {
                setLeads(res.data.leads);
                setTotalPages(res.data.totalPages);
                setHasNext(res.data.hasNext);
                // stats estimation if needed
            }
        } catch (error) {
            logger.error("Failed to fetch GMB leads", error);
        } finally {
            setLoading(false);
        }
    }, [pageNo, pageSize, filters, searchText]);

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
    };

    return {
        leads,
        loading,
        pageNo,
        setPageNo,
        totalPages,
        hasNext,
        stats,
        filters,
        searchText,
        handleFilterClick,
        handleSearchChange,
        handleSearchSubmit,
        handleLeadUpdated,
        refreshTrigger
    };
};

export default useGMBLeads;
