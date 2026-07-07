import type { JSX } from "react";
import { Route, Routes } from "react-router-dom";
import { PAGES } from "../utils/constants/app";
import AdminLayout from "../components/layout/Admin";
import FullPageLayout from "../components/layout/FullPage";
// Pages
import SignInPage from "../pages/auth/Signin";
import useInitUser from "../hooks/auth/useInitUser";
import ScrollToTop from "../components/shared/ScrollToTop";
import ProtectedRoute from "./ProtectedRoutes";
import PublicRoute from "./PublicRoutes";
import AdminLoader from "../components/shared/AdminLoader";
import LeadDashboard from "../pages/dashboard/Leads";
import Businessses from "../pages/dashboard/Businesses";
import BusinessDashboard from "../pages/dashboard/BusinessDashboard"; // NEW
import UserManage from "../pages/dashboard/UserManage"; // NEW
import Analytics from "../pages/dashboard/AnalyticsV2"; // UPDATED V2
import ImageUpload from "../pages/dashboard/ImageUpload";
import FunnelPage from "../pages/dashboard/Funnel";
import GMBLeads from "../pages/dashboard/GMBLeads";
import AdminOpsLayout from "../components/adminOpsV3/AdminOpsLayout";
import RequireAdminOps from "../components/adminOpsV3/RequireAdminOps";
import AdminOpsLogin from "../pages/AdminOps/Login";

const UserRoutes = () => {
  const { loading } = useInitUser();

  const routesConfig = {
    fullPage: [
      {
        path: PAGES.HOME,
        element: (
          <PublicRoute>
            <SignInPage />
          </PublicRoute>
        ),
      },
      {
        path: PAGES.SIGN_IN,
        element: (
          <PublicRoute>
            <SignInPage />
          </PublicRoute>
        ),
      },
    ],
    admin: [
      {
        path: PAGES.ADMIN_LEADS,
        element: (
          <ProtectedRoute>
            <LeadDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: PAGES.ADMIN_BUSINESS,
        element: (
          <ProtectedRoute>
            <Businessses />
          </ProtectedRoute>
        ),
      },
      {
        path: PAGES.ADMIN_BUSINESS_DASHBOARD,
        element: (
          <ProtectedRoute>
            <BusinessDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: PAGES.ADMIN_USER_MANAGE,
        element: (
          <ProtectedRoute>
            <UserManage />
          </ProtectedRoute>
        ),
      },
      {
        path: PAGES.ADMIN_ANALYTICS,
        element: (
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        ),
      },
      {
        path: PAGES.ADMIN_IMAGE_UPLOAD,
        element: (
          <ProtectedRoute>
            <ImageUpload />
          </ProtectedRoute>
        ),
      },
      {
        path: PAGES.ADMIN_FUNNEL_LEADS,
        element: (
          <ProtectedRoute>
            <FunnelPage />
          </ProtectedRoute>
        ),
      },
      {
        path: PAGES.ADMIN_GMB_LEADS,
        element: (
          <ProtectedRoute>
            <GMBLeads />
          </ProtectedRoute>
        ),
      },
    ],
  };

  const renderRoutesWithLayout = (
    routes: { path: string; element: React.ReactNode }[],
    Layout: (props: { children: React.ReactNode }) => JSX.Element
  ) =>
    routes.map(({ path, element }) => (
      <Route key={path} path={path} element={<Layout>{element}</Layout>} />
    ));

  if (loading) {
    return (
      <AdminLoader />
    )
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        {renderRoutesWithLayout(routesConfig.fullPage, FullPageLayout)}
        {renderRoutesWithLayout(routesConfig.admin, AdminLayout)}
        {/* v3 Admin Ops Console — own staff login (prototype-ported) + self-contained
            shell. Static /login must precede /:section so it isn't captured as a section. */}
        <Route path={PAGES.ADMIN_OPS_LOGIN} element={<AdminOpsLogin />} />
        <Route
          path={PAGES.ADMIN_OPS_ROOT}
          element={<RequireAdminOps><AdminOpsLayout /></RequireAdminOps>}
        />
        <Route
          path={PAGES.ADMIN_OPS_SECTION}
          element={<RequireAdminOps><AdminOpsLayout /></RequireAdminOps>}
        />
      </Routes>
    </>
  );
};

export default UserRoutes;
