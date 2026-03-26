import { useEffect, useRef, useState } from "react";
import type { AdminLeadType, BusinessType } from "../../../types/content";
import type { BusinessSearchType } from "../../../types/reqResType";
import { AdminService } from "../../../api/modules/admin";
import { logger } from "../../../utils/logger";
import { useModal } from "../../../context/ModalContext";
import { useAlert } from "../../../context/AlertContext";

type LoadingKeys = "search" | "detail" | "assign";

const useAssignLead = (
  lead: AdminLeadType,
  onAssigned: (lead: AdminLeadType) => void
) => {
  const { closeModal } = useModal();
  const { showAlert } = useAlert();
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<BusinessSearchType[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessType | null>(
    null
  );

  const [loading, setLoading] = useState<Record<LoadingKeys, boolean>>({
    search: false,
    detail: false,
    assign: false,
  });

  const controllerRef = useRef<AbortController | null>(null);

  /** Utility helper to run async operations with loading state */
  const runAsync = async <T>(
    key: LoadingKeys,
    fn: () => Promise<T>
  ): Promise<T | undefined> => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      return await fn();
    } catch (err) {
      if ((err as any).name !== "AbortError") {
        logger.error(`${key} error:`, err);
      }
      throw err;
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  /** Fetch search suggestions */
  const fetchSearchResults = async (query: string) => {
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    await runAsync("search", async () => {
      const res = await AdminService.getSearchedBusinesses(
        query,
        controller.signal
      );
      setSearchResults(res.data.businesses || []);
    });
  };

  /** Fetch selected business detail */
  const fetchBusinessDetail = async (businessId: number) => {
    await runAsync("detail", async () => {
      const res = await AdminService.getBusinessDetail(businessId);
      if (!res.response) return;
      setSelectedBusiness(res.data);
      setSearchResults([]);
      setSearchText("");
    });
  };

  /** Handle input change with debounce */
  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }

    const debounce = setTimeout(() => {
      fetchSearchResults(searchText);
    }, 300);

    return () => {
      clearTimeout(debounce);
      controllerRef.current?.abort();
    };
  }, [searchText]);

  /** When user selects a business */
  const handleSelectBusiness = (business: BusinessSearchType) => {
    setSearchText(business.businessName);
    setSearchResults([]);
    fetchBusinessDetail(business.id);
  };

  /** Assign lead to selected business */
  const handleAssignLead = async () => {
    if (!selectedBusiness) return;

    await runAsync("assign", async () => {
      const data = {
        leadId: lead.id,
        businessId: selectedBusiness.id,
      };
      const res = await AdminService.assignLeadToBusiness(data);
      let apiRes: any = res;
      if (Array.isArray(res) && res.length > 0) {
        apiRes = res[0];
      }
      if (!apiRes.response) return;
      closeModal();
      onAssigned(apiRes.data);
      showAlert("Lead assigned successfully.", "success");
    }).catch(() => {
      alert("Failed to assign lead.");
    });
  };

  /** Input handler */
  const handleSearchTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    if (e.target.value === "") setSearchResults([]);
  };

  return {
    loading,
    searchText,
    searchResults,
    selectedBusiness,
    handleAssignLead,
    handleSelectBusiness,
    handleSearchTextChange,
  };
};

export default useAssignLead;
