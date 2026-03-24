import styles from "./Sidebar.module.css";
import SidebarLink from "../AdminLayout/SidebarLink";
import type { Sidebarlink, BaseUser } from "../../../types/global";

const Sidebar = ({
  links,
  activeLink,
  sidebarOpen,
  toggleSidebar,
  user,
}: {
  links: Sidebarlink[];
  activeLink: string;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  user?: BaseUser | null;
}) => {


  return (
    <aside
      className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.closed} `}
    >
      <div className={styles.hamburger} onClick={toggleSidebar}>
          {sidebarOpen ? '❮' : '❯'}
      </div>

      <div className={`${styles.topContainer}`}>
        {sidebarOpen && (
          <div className={styles.userProfile}>
            <img 
              src={user?.profile_image_url || "https://secure.gravatar.com/avatar/60c0429a1737e96e7090f4d36ef1945d?s=100&d=mm&r=g"} 
              className={styles.avatar} 
              alt="User" 
            />
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.username || "Admin"}</span>
              <span className={styles.userRole}>{user?.role || "Sub-Admin"}</span>
            </div>
          </div>
        )}
      </div>

      <div className={`${styles.linksContainer} scrollbar-hidden `}>
        {links?.map((link, idx) => (
          <SidebarLink
            key={idx}
            item={link}
            style={{ radius: true, active: activeLink === link.url }}
            isOpen={sidebarOpen}
          />
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;

