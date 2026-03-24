import React from "react";
// import { FiSearch, FiPlus } from "react-icons/fi";
import { FiPlus } from "react-icons/fi";
import styles from "./UserManage.module.css";
import useUserManage from "./useUserManage";
import UserManageTable from "../../../components/dashboard/users/UserManageTable";
import AddUserModal from "../../../components/dashboard/users/AddUserModal";
import { useModal } from "../../../context/ModalContext";

// Force table re-render / refetch by changing the key when a user is successfully added
const UserManage = () => {
  const {
    appliedSearchText,
    // searchInput,
    // handleSearchChange,
    // handleSearchSubmit,
  } = useUserManage();

  const { showModal } = useModal();
  const [refreshKey, setRefreshKey] = React.useState(0);

  const handleAddSuccess = () => {
    // Increment the key to force the table component to remount so it fetches the new list
    setRefreshKey(prev => prev + 1);
  };

  const handleAddClick = () => {
    showModal(<AddUserModal onSuccess={handleAddSuccess} />);
  };

  return (
    <div className={styles.container}>
      {/* Top Header & Search */}
      <div className={styles.headerRow}>
        <div className={styles.actionsRow}>
          {/* <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search query"
              value={searchInput}
              onChange={handleSearchChange}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>
              <FiSearch size={20} />
            </button>
          </form> */}

          <button type="button" className={styles.addBtn} onClick={handleAddClick}>
            <FiPlus size={18} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className={styles.tableSection}>
        <UserManageTable key={refreshKey} searchText={appliedSearchText} />
      </div>
    </div>
  );
};

export default UserManage;
