import type { AdminLeadType } from "../../../types/content";
import useAssignLead from "./useAssignLead";
import styles from "./AssignLead.module.css";
import { Button, Input } from "../../ui";
const AssignLead = ({ lead, onAssigned }: { lead: AdminLeadType, onAssigned: (lead: AdminLeadType) => void }) => {
    const {
        loading,
        searchText,
        searchResults,
        selectedBusiness,
        handleAssignLead,
        handleSelectBusiness,
        handleSearchTextChange,
    } = useAssignLead(lead, onAssigned);
    const getVal = (b: any, ...keys: string[]) => {
        if (!b) return "—";
        for (const k of keys) {
            if (b[k] !== undefined && b[k] !== null && b[k] !== "") return b[k];
        }
        return "—";
    };


    // const formatDate = (iso?: string) => {
    //     if (!iso) return "—";
    //     try {
    //         const d = new Date(iso);
    //         return d.toLocaleString();
    //     } catch {
    //         return iso;
    //     }
    // };



    const PLACEHOLDER = ""



    return (
        <>
            <div className={styles.wrapper}>
                <style>{`
                    @media (min-width: 769px) {
                        div[data-dialog="true"] > div:last-child {
                            width: 85vw !important;
                            max-width: 1100px !important;
                        }
                    }
                `}</style>

                <div className={styles.leftColumn}>

                    <div className={styles.searchContainer}>

                        <Input
                            value={searchText}
                            onChange={handleSearchTextChange}
                            placeholder="Search business..."
                            className={styles.input}
                        />
                        {searchText ? (
                            <div className={styles.resultsListContainer}>
                                {loading?.search ? (
                                    <div className={styles.loading}>Loading...</div>
                                ) : searchResults?.length > 0 ? (
                                    <ul className={styles.resultsList}>
                                        {searchResults.map((b: any) => {
                                            const thumb = getVal(b, "businessImage") || PLACEHOLDER;
                                            const name = getVal(b, "businessName", "business_name", "name");
                                            const meta = getVal(b, "city", "state", "segment");
                                            const isSelected = selectedBusiness && selectedBusiness.id === b.id;
                                            return (
                                                <li
                                                    key={b.id}
                                                    onClick={() => handleSelectBusiness(b)}
                                                    className={`${styles.resultItem} ${isSelected ? styles.selected : ""}`}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleSelectBusiness(b);
                                                    }}
                                                >
                                                    <img
                                                        src={thumb}
                                                        alt={name as string}
                                                        className={styles.resultThumb}
                                                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                                            const t = e.currentTarget as HTMLImageElement;
                                                            t.src = PLACEHOLDER;
                                                        }}
                                                    />
                                                    <div className={styles.resultMeta}>
                                                        <div className={styles.resultName}>{name}</div>
                                                        <div className={styles.resultSmall}>{meta}</div>
                                                    </div>
                                                    <div className={styles.resultPin}>{getVal(b, "pin_code")}</div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <div className={styles.noResults}>No businesses found</div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <div className={styles.tip}>Tip: search by name, city or pin code</div>
                </div>
                <div className={styles.middleColumn}>
                    {selectedBusiness ?
                        <div className={styles.previewCard}>

                            <div className={styles.coverWrap}>
                                <img
                                    src={getVal(selectedBusiness || {}, "coverImageUrl") || PLACEHOLDER}
                                    alt={getVal(selectedBusiness || {}, "businessName", "business_name", "name") as string}
                                    className={styles.coverImage}
                                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                        const t = e.currentTarget as HTMLImageElement;
                                        t.src = PLACEHOLDER;
                                    }}
                                />
                            </div>
                            <div className={styles.previewBody}>

                                <div className={styles.previewHeader}>
                                    <div>
                                        <h3 className={styles.businessTitle}>{getVal(selectedBusiness || {}, "businessName", "business_name", "name")}</h3>

                                    </div>
                                </div>
                                {/* <dl className={styles.detailList}>
                                    <dt className={styles.detailDt}>City</dt>
                                    <dd className={styles.detailDd}>{getVal(selectedBusiness || {}, "city")}</dd>


                                    <dt className={styles.detailDt}>State</dt>
                                    <dd className={styles.detailDd}>{getVal(selectedBusiness || {}, "state")}</dd>


                                    <dt className={styles.detailDt}>Pin</dt>
                                    <dd className={styles.detailDd}>{getVal(selectedBusiness || {}, "pin_code", "pin")}</dd>


                                    <dt className={styles.detailDt}>Last updated</dt>
                                    <dd className={styles.detailDd}>{formatDate(getVal(selectedBusiness || {}, "updated_at", "updatedAt"))}</dd>
                                </dl> */}

                            </div>
                        </div>
                        :
                        <div className={styles.noBusiness}>
                            selcte business to see here
                        </div>}
                </div>
                <div className={styles.rightColumn}>
                    <div className={styles.leadCard}>
                        <h4 className={styles.cardTitle}>Lead Info</h4>
                        <div className={styles.leadBody}>
                            <div className={styles.rowItem}>
                                <div className={styles.rowLabel}>Name</div>
                                <div className={styles.rowValue}>{lead.name}</div>
                            </div>
                            <div className={styles.rowItem}>
                                <div className={styles.rowLabel}>Inrested</div>
                                <div className={styles.rowValue}>{lead.interested}</div>
                            </div>
                            <div className={styles.rowItem}>
                                <div className={styles.rowLabel}>Query</div>
                                <div className={styles.rowValue}>{lead.query}</div>
                            </div>
                        </div>
                    </div>
                    <div className={styles.assignRow}>
                        <Button radius onClick={handleAssignLead} disabled={loading?.assign || !selectedBusiness}>
                            {loading?.assign ? "Assigning..." : "Assign Lead"}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
export default AssignLead;

