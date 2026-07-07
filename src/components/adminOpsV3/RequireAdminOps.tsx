// ── RequireAdminOps ── guard for the /v3/admin ops-console subtree.
// Anonymous → the ops-console staff login (ADMIN_OPS_LOGIN), NOT the old
// admin panel's /sign-in. Backend authorizes every action independently.
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../../redux/store/hook";
import { PAGES } from "../../utils/constants/app";

const RequireAdminOps = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  if (!isAuthenticated) {
    return <Navigate to={PAGES.ADMIN_OPS_LOGIN} replace />;
  }
  return <>{children}</>;
};

export default RequireAdminOps;
