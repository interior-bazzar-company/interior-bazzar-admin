import React from "react";
import { useModal } from "../../../../context/ModalContext";
import useLeadTable from "./useLeadTable";
import styles from "./LeadTable.module.css";
import type { AdminLeadType, LeadFilterType } from "../../../../types/content";
import LeadDetail from "../LeadDetail";
import AssignLead from "../../AssignLead";
import LogsPopup from "../LogsPopup";
import UpdateLeadModal from "../UpdateLeadModal";

const LeadTable = React.memo(({ filter, refreshTrigger, onUpdate }: { filter: LeadFilterType, refreshTrigger?: number, onUpdate?: () => void }) => {

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
    } = useLeadTable(filter, refreshTrigger);
    
    const { showModal } = useModal();

    const handleViewLead = (lead: AdminLeadType) => {
        showModal(<LeadDetail lead={lead} />);
    };

    const handleAssignClick = (e: React.MouseEvent, lead: AdminLeadType) => {
        e.stopPropagation();
        showModal(<AssignLead lead={lead} onAssigned={(updatedLead) => {
            onLeadAssigned(updatedLead);
            if (onUpdate) onUpdate();
        }} />);
    };
    
    const handleEditClick = (e: React.MouseEvent, lead: AdminLeadType) => {
        e.stopPropagation();
        showModal(<UpdateLeadModal lead={lead} onSuccess={(updatedLead) => {
            if (updatedLead) onLeadAssigned(updatedLead);
            if (onUpdate) onUpdate();
        }} />);
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
                        <th>Created</th>
                        <th>Updated</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Mail</th>
                        <th>Interested</th>
                        <th>Tag</th>
                        <th>Category</th>
                        <th>Filter Stage</th>
                        <th>Status</th>
                        <th>Query</th>
                        <th>Assigned business</th>
                        <th>Business Status </th>
                        <th>Logs</th>
                        <th>Client Logs</th>
                        <th>Lead Id</th>
                        <th>Remark</th>
                        <th>Assign</th>
                        <th>Edit</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {loading ?
                        Array.from({ length: pageSize }).map((_, i) => <tr key={i}>
                            <td colSpan={8}>
                                loading....
                            </td>
                        </tr>) : noAccess ? (
                    <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#ef4444", fontWeight: "600" }}>
                            You don't have access to this resource.
                        </td>
                    </tr>
                ) : leads.map((lead) => (
                            <tr key={lead.id} onClick={() => handleViewLead(lead)} style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}>
                                <td>{renderValue(lead.date)}</td>
                                <td>{renderValue(lead.updatedAt)}</td>
                                <td>
                                    <span style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>{renderValue(lead.name)}</span>
                                </td>
                                <td>{renderValue(lead.phone)}</td>
                                <td>{renderValue(lead.email)}</td>
                                <td>
                                    {renderValue(lead.interested)}
                                </td>
                                <td>{renderValue(lead.tag || "")}</td>
                                <td>{renderValue(lead.category || "")}</td>
                                <td>{renderValue(lead.stage || "")}</td>
                                <td>{renderValue(lead.leadStatus || "")}</td>
                                <td>{renderValue(lead.query || "")}</td>
                                <td>{renderValue(lead.assigned || "")}</td>
                                <td>{renderValue(lead.status || "")}</td>
                                <td>
                                    <button 
                                        className={styles.assignButton} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const formattedLogs = lead.logs && lead.logs.length > 0 
                                                ? lead.logs.map(log => ({ created: log.timestamp, tag: lead.tag || "Update", desc: log.event }))
                                                : [];
                                            showModal(<LogsPopup leadId={lead.id} logs={formattedLogs} />);
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'none', border: '1px solid #e5e7eb', color: '#000', padding: '4px 8px' }}
                                    >
                                        <span style={{ border: '1px solid #EAB308', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                            {lead.logs ? lead.logs.length : 0}
                                        </span>
                                        <span style={{ fontSize: '12px' }}>Logs</span>
                                    </button>
                                </td>
                                <td>
                                    <button 
                                         className={styles.assignButton} 
                                         onClick={(e) => {
                                             e.stopPropagation();
                                             showModal(<LogsPopup leadId={lead.id} logs={lead.clientLogs || []} type="client" />);
                                         }}
                                         style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'none', border: '1px solid #e5e7eb', color: '#000', padding: '4px 8px' }}
                                     >
                                         <span style={{ border: '1px solid #3b82f6', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                             {lead.clientLogs ? lead.clientLogs.length : 0}
                                         </span>
                                         <span style={{ fontSize: '12px' }}>Client Logs</span>
                                     </button>
                                 </td>
                                <td>{lead.id}</td>
                                <td>{renderValue(lead.remark)}</td>
                                <td>
                                    <button
                                        className={`${styles.assignButton} ${lead.assigned ? styles.assigned : ""}`}
                                        onClick={(e) => handleAssignClick(e, lead)}
                                    >
                                        {lead.assigned ? "Assigned" : "Assign"}
                                    </button>
                                </td>
                                <td>
                                    <button
                                        className={styles.assignButton}
                                        onClick={(e) => handleEditClick(e, lead)}
                                    >
                                        Edit
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
