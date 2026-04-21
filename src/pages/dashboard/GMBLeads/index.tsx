// import React from "react";
// import { FiSearch } from "react-icons/fi";
import useGMBLeads from "./useGMBLeads";
import LeadTable from "./components/LeadTable";
import FilterBar from "./components/FilterBar";
import LeadDetailsModal from "./components/LeadDetailsModal";
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
        kpis,
        handleFilterClick,
        handleLeadUpdated,
        handleAddClick,
        isSuperAdmin,
        eligibleAdmins,
        selectedAdminId,
        handleAdminChange,
        handleAutoAssign,
    } = useGMBLeads();

    const { showModal } = useModal();

    const handleViewLead = (lead: GMBLeadType) => {
        showModal(<LeadDetailsModal lead={lead} readOnly={true} />, { width: '80vw' });
    };

    const handleEditLead = (lead: GMBLeadType) => {
        showModal(<LeadDetailsModal lead={lead} onSuccess={handleLeadUpdated} />, { width: '80vw' });
    };


    return (
        <section className={styles.gmbLeadsContainer}>
            <div className={styles.topBar}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Sales Intelligence</h1>
                    {isSuperAdmin && (
                        <p style={{ fontSize: '13px', color: '#666' }}>Auditing Global Sales Data (Superadmin)</p>
                    )}
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {isSuperAdmin && (
                        <>
                            <select 
                                className={styles.adminSelect}
                                value={selectedAdminId || ""}
                                onChange={(e) => handleAdminChange(e.target.value ? Number(e.target.value) : null)}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '14px',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    background: '#f8fafc'
                                }}
                            >
                                <option value="">Showing My Leads</option>
                                {eligibleAdmins.map(admin => (
                                    <option key={admin.id} value={admin.id}>Staff: {admin.name || admin.username}</option>
                                ))}
                            </select>

                            <button
                                className={styles.autoAssignBtn}
                                onClick={handleAutoAssign}
                                title="Distribute unassigned leads across the team"
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    background: '#fff',
                                    color: '#000',
                                    border: '1px solid #000',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '14px'
                                }}
                            >
                                Auto Assign
                            </button>
                        </>
                    )}

                    <button 
                        className={styles.addBtn}
                        onClick={handleAddClick}
                        style={{ 
                            padding: '10px 24px', 
                            borderRadius: '8px', 
                            background: '#000', 
                            color: '#fff', 
                            border: 'none', 
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                    >
                        + Add New Sales Lead
                    </button>
                </div>
            </div>

            <FilterBar 
                filters={filters} 
                kpis={kpis}
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
                />
            </div>
        </section>
    );
};

export default GMBLeads;
