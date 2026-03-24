import React from "react";
import { useModal } from "../../../../context/ModalContext";
import useLeadTable from "./useLeadTable";
import styles from "./LeadTable.module.css";
import type { AdminLeadType, LeadFilterType } from "../../../../types/content";
import LeadDetail from "../LeadDetail";
import AssignLead from "../../AssignLead";

const LeadTable = React.memo(({ filter }: { filter: LeadFilterType }) => {

    const {
        leads,
        pageNo,
        loading,
        hasNext,
        pageSize,
        setPageNo,
        totalPages,
        incrementPage,
        noAccess,
        onLeadAssigned
    } = useLeadTable(filter);
    
    const { showModal } = useModal();

    const handleViewLead = (lead: AdminLeadType) => {
        showModal(<LeadDetail lead={lead} />);
    };

    const handleAssignClick = (lead: AdminLeadType) => {
        showModal(<AssignLead lead={lead} onAssigned={onLeadAssigned} />);
    };
    
    // Handlers mapped dynamically below
    const renderValue = (value: string | null | undefined) => {
        if (!value) return "--";
        return value;
    };

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Mail</th>
                        <th>Interested</th>
                        <th>Assign</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ?
                        Array.from({ length: pageSize }).map((_, i) => <tr key={i}>
                            <td colSpan={7}>
                                loading....
                            </td>
                        </tr>) : noAccess ? (
                    <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#ef4444", fontWeight: "600" }}>
                            You don't have access to this resource.
                        </td>
                    </tr>
                ) : leads.map((lead) => (
                            <tr key={lead.id}>
                                <td>{renderValue(lead.date)}</td>
                                <td 
                                    onClick={() => handleViewLead(lead)}
                                    style={{ cursor: 'pointer', color: 'var(--color-brand-primary)', fontWeight: 600 }}
                                >
                                    {renderValue(lead.name)}
                                </td>
                                <td>{renderValue(lead.phone)}</td>
                                <td>{renderValue(lead.email)}</td>
                                <td>
                                    {renderValue(lead.interested)}
                                </td>
                                <td>
                                    <button
                                        className={`${styles.assignButton} ${lead.assigned ? styles.assigned : ""}`}
                                        onClick={() => handleAssignClick(lead)}
                                    >
                                        {lead.assigned ? "Assigned" : "Assign"}
                                    </button>
                                </td>
                                <td>
                                    <button
                                        className={styles.assignButton}
                                        onClick={() => handleViewLead(lead)}
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}

                </tbody>
            </table>

            <div className={styles.pagination}>
                <button
                    disabled={pageNo === 1}
                    onClick={() => setPageNo((prev) => prev - 1)}
                >
                    Prev
                </button>

                {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    return (
                        <button
                            key={page}
                            className={pageNo === page ? styles.activePage : ""}
                            onClick={() => setPageNo(page)}
                        >
                            {page}
                        </button>
                    );
                })}

                <button
                    disabled={!hasNext}
                    onClick={incrementPage}
                >
                    Next
                </button>
            </div>
        </div>
    );
});

export default LeadTable;
