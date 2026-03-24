import { 
  MdOutlinePeople, 
  MdManageAccounts, 
  MdBusinessCenter, 
  MdAnalytics, 
  MdOutlineImage, 
  MdFilterAlt 
} from "react-icons/md";
import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PAGES } from "../../../utils/constants/app";
import type { Sidebarlink, BaseUser } from "../../../types/global";
import { UserService } from "../../../api/modules/user";

const useAdmin = () => {
  const location = useLocation();
  const [sidebarLinks] = useState<Sidebarlink[]>([
    {
      label: "Leads",
      url: PAGES.ADMIN_LEADS,
      icon: MdOutlinePeople,
      subLinks: [],
    },
    {
      label: "User Manage",
      url: PAGES.ADMIN_USER_MANAGE,
      icon: MdManageAccounts,
      subLinks: [],
    },
    {
      label: "Business",
      url: PAGES.ADMIN_BUSINESS,
      icon: MdBusinessCenter,
      subLinks: [],
    },
    {
      label: "Analytics",
      url: PAGES.ADMIN_ANALYTICS,
      icon: MdAnalytics,
      subLinks: [],
    },
    {
      label: "Image Upload",
      url: PAGES.ADMIN_IMAGE_UPLOAD,
      icon: MdOutlineImage,
      subLinks: [],
    },
    {
      label: "Funnel Leads",
      url: PAGES.ADMIN_FUNNEL_LEADS,
      icon: MdFilterAlt,
      subLinks: [],
    },
  ]);

  const [userProfile, setUserProfile] = useState<BaseUser | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await UserService.getLoggedInUser();
        if (res.response) {
          setUserProfile(res.data);
        }
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
      }
    };
    fetchProfile();
  }, []);

  const { activeLink } = useMemo(() => {
    let activeLink = "";
    let activeSubLink = "";
    let currentMainLink = undefined;

    for (const link of sidebarLinks) {
       // Check main link
       if (location.pathname === link.url) {
          activeLink = link.url;
          currentMainLink = link;
       }
       // Check sublinks
      for (const sub of link?.subLinks || []) {
        if (location.pathname === sub.url) {
          activeLink = link.url;
          currentMainLink = link;
          activeSubLink = sub.url;
          break;
        }
      }
      if (activeLink) break;
    }

    return { activeLink, activeSubLink, currentMainLink };
  }, [location.pathname, sidebarLinks]);

  const [sideBarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sideBarOpen);
  };

  return {
    activeLink,
    sideBarOpen,
    sidebarLinks,
    userProfile,
    toggleSidebar,
  };
};
export default useAdmin;
