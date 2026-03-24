
import useFunnel from "./useFunnel";
import styles from "./FunnelPage.module.css"
// import { Button, Input, SelectPrimitive } from "../../../components/ui";
import { UsersIcon } from "../../../components/ui/Icons/SVG";
import FunnelTable from "../../../components/dashboard/Funnel/FunnelTable";

const FunnelPage = () => {
    const { 
        // searchText,
        // selectedOption,
        // selectOptions,
        // handleSearch,
        // handleChange,
        filters,
        noOfUsers,
    } = useFunnel();
    return (
        <>
            <section className={styles.leadDashboardContainer}>
                <div className={`${styles.sectionHeader}`}>
                    <UsersIcon className={`${styles.icon}`} />
                    <p className={`${styles.sectionPara}`}>Total no of users: <span>{noOfUsers}</span></p>
                </div>
                {/* <form onSubmit={handleSearch} className={`${styles.filteresContainer}`}>
                    <SelectPrimitive
                        id="sortBy"
                        name="sortBy"
                        value={selectedOption}
                        onChange={handleChange}
                        options={selectOptions}
                        className={`${styles.select}`}
                        placeholder="Sort by"
                    />
                    <Input name="searchText" id="searchText" placeholder="Search" value={searchText} onChange={handleChange} />
                    <Button type="submit" radius={true} variant="gradient">Search</Button>
                </form> */}
                <div>
                    <FunnelTable filter={filters} />
                </div>
            </section>

        </>
    )
}
export default FunnelPage;