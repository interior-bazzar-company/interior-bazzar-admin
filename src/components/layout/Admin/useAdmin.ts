import { 
  MdOutlinePeople, 
  MdManageAccounts, 
  MdBusinessCenter, 
  MdAnalytics, 
  MdOutlineImage, 
  MdFilterAlt,
  // MdOutlineLocationOn,
  MdInsights
} from "react-icons/md";
import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PAGES } from "../../../utils/constants/app";
import type { Sidebarlink, BaseUser, UserProfileResponse } from "../../../types/global";
import { UserService } from "../../../api/modules/user";

import { GMBService } from "../../../api/modules/gmbLeads";

const useAdmin = () => {
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<BaseUser | null>(null);
  const [userPlan, setUserPlan] = useState<UserProfileResponse['plan']>();
  const [salesAdmins, setSalesAdmins] = useState<{ id: number; username: string; name: string }[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await UserService.getLoggedInUser();
        if (res.response) {
          // Handle both flat and nested responses defensively
          const rawData = res.data as any;
          const user = rawData.user || rawData;
          const plan = rawData.plan;
          
          setUserProfile(user as BaseUser);
          setUserPlan(plan);
          
          // Fetch admins if superadmin
          const isSuper = user.isSuperAdmin || (user as any).is_superuser || (user as any).is_super_admin;
          if (isSuper) {
            const adminRes = await GMBService.fetchAdmins();
            if (adminRes.response) {
              setSalesAdmins(adminRes.data);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
      }
    };
    fetchProfile();
  }, []);

  const sidebarLinks = useMemo<Sidebarlink[]>(() => {
    const isSuper = userProfile?.isSuperAdmin || userProfile?.is_superuser || (userProfile as any)?.is_super_admin;
    const links: Sidebarlink[] = [
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
      {
        label: "Sales Intelligence",
        url: PAGES.ADMIN_GMB_LEADS,
        icon: MdInsights,
        subLinks: isSuper ? [
          { label: "My Sheet", url: PAGES.ADMIN_GMB_LEADS },
          ...salesAdmins.map(admin => ({
            label: admin.name || admin.username,
            url: `${PAGES.ADMIN_GMB_LEADS}?userId=${admin.id}`
          }))
        ] : [],
      },
    ];
    return links;
  }, [userProfile, salesAdmins]);

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
    userPlan,
    toggleSidebar,
  };
};
export default useAdmin;
