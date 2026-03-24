import type { BusinessFilterType, FunnelLeadType } from "../../../../types/content";
import styles from "./FunnelTable.module.css";
import useFunnelTable from "./useFunnelTable";
import { useModal } from "../../../../context/ModalContext";
import FunnelDetail from "../FunnelDetail";

const FunnelTable = ({ filter }: { filter: BusinessFilterType }) => {
    const { showModal } = useModal();
    const {
        pageNo,
        loading,
        hasNext,
        pageSize,
        setPageNo,
        leads,
        totalPages,
        incrementPage,
        noAccess,
    } = useFunnelTable(filter);

    const handleLeadDetailView = (lead: FunnelLeadType) => {
        showModal(<FunnelDetail lead={lead} />);
    }

    const renderValue = (value: string | null | undefined | number) => {
        if (!value && value !== 0) return "--";
        return value;
    };

    return (
        <div className={styles.wrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Company Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Plan Type</th>
                        <th>Plan</th>
                        <th>Intrest</th>
                        <th>View</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? Array.from({ length: pageSize }).map((_, i) => <tr key={i}>
                        <td colSpan={9}>
                            loading....
                        </td>
                    </tr>) : noAccess ? (
                        <tr>
                            <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#ef4444", fontWeight: "600" }}>
                                You don't have access to this resource.
                            </td>
                        </tr>
                    ) : leads.map((lead) => (
                        <tr key={lead.id}>
                            <td>{renderValue(lead.id)}</td>
                            <td>{renderValue(lead.name)}</td>
                            <td>{renderValue(lead.companyName)}</td>
                            <td>{renderValue(lead.email)}</td>
                            <td>
                                {renderValue(lead.phone)}
                            </td>
                            <td>{renderValue(lead.planType)}</td>
                            <td>
                                {renderValue(lead.plan)}
                            </td>
                            <td>
                                {renderValue(lead.intrest)}
                            </td>
                            <td>
                                <button
                                    className={`${styles.viewButton}`}
                                    onClick={() => handleLeadDetailView(lead)}
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
};

export default FunnelTable;
