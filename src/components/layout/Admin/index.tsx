import React from "react";
import useAdmin from "./useAdmin";
import styles from "./Admin.module.css";
import Sidebar from "../../shared/Sidebar";
const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const {
    activeLink,
    sideBarOpen,
    sidebarLinks,
    userProfile,
    toggleSidebar,
  } = useAdmin();

  return (
    <div className={`${styles.adminWrapper}`}>
      <div className={`${styles.sidebarContainer}`}>
        <Sidebar
          links={sidebarLinks}
          activeLink={activeLink}
          sidebarOpen={sideBarOpen}
          toggleSidebar={toggleSidebar}
          user={userProfile}
        />
      </div>
      <div className={`${styles.headerContainer}`}>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
};
export default AdminLayout;
