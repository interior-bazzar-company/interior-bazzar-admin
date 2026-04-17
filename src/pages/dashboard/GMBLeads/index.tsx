import React from "react";
import { FiSearch } from "react-icons/fi";
import useGMBLeads from "./useGMBLeads";
import LeadTable from "./components/LeadTable";
import FilterBar from "./components/FilterBar";
import LeadDetailsModal from "./components/LeadDetailsModal";
import AssignLead from "../../../components/dashboard/AssignLead";
import { useModal } from "../../../context/ModalContext";
import styles from "./GMBLeads.module.css";
import type { GMBLeadType } from "../../../types/content/gmbLeads";

const GMBLeads = () => {
    const {
        leads,
        loading,
        pageNo,
        setPageNo,
        totalPages,
        hasNext,
        filters,
        searchText,
        handleFilterClick,
        handleSearchChange,
        handleSearchSubmit,
        handleLeadUpdated,
    } = useGMBLeads();

    const { showModal } = useModal();

    const handleViewLead = (lead: GMBLeadType) => {
        showModal(<LeadDetailsModal lead={lead} readOnly={true} />);
    };

    const handleEditLead = (lead: GMBLeadType) => {
        showModal(<LeadDetailsModal lead={lead} onSuccess={handleLeadUpdated} />);
    };

    const handleAssignLead = (lead: GMBLeadType) => {
        // Reusing existing AssignLead component if possible, 
        // but need to ensure it works with GMBLeadType IDs
        showModal(<AssignLead lead={lead as any} onAssigned={handleLeadUpdated} />);
    };

    return (
        <section className={styles.gmbLeadsContainer}>
            <div className={styles.topBar}>
                <h1 style={{ fontSize: '24px', fontWeight: 700 }}>GMB Leads Management</h1>
                
                <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
                    <input 
                        type="text"
                        className={styles.searchInput} 
                        placeholder="Search business name..." 
                        value={searchText} 
                        onChange={handleSearchChange} 
                    />
                    <button type="submit" className={styles.searchIconBtn}>
                        <FiSearch size={18} />
                    </button>
                </form>
            </div>

            <FilterBar 
                filters={filters} 
                handleFilterClick={handleFilterClick} 
            />

            <div className={styles.tableContainer}>
                <LeadTable 
                    leads={leads}
                    loading={loading}
                    pageNo={pageNo}
                    totalPages={totalPages}
                    hasNext={hasNext}
                    setPageNo={setPageNo}
                    onView={handleViewLead}
                    onEdit={handleEditLead}
                    onAssign={handleAssignLead}
                />
            </div>
        </section>
    );
};

export default GMBLeads;
