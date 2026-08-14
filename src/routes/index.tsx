/* =============================================================================
   Routes
   -----------------------------------------------------------------------------
   The panel is one shell with one workspace inside it, exactly as the prototype
   is. `/:route` and `/:route/:id` cover every module — the module inventory in
   admin/shell/modules.ts decides which of those are real, and the view registry
   decides what renders. Adding a module never touches this file.

   `/login` is outside the shell: it is the door, and it must render without a
   session.
   ============================================================================= */
import { Navigate, Route, Routes } from "react-router-dom";
import AdminShell from "../admin/shell/AdminShell";
import AdminAuth from "../admin/auth/AdminAuth";
import { ViewHost } from "../admin/views/registry";
import RequireSession from "./RequireSession";
import { HOME_ROUTE } from "../admin/shell/modules";

const UserRoutes = () => (
  <Routes>
    <Route path="/login" element={<AdminAuth />} />
    <Route
      element={
        <RequireSession>
          <AdminShell />
        </RequireSession>
      }
    >
      <Route path="/" element={<Navigate to={"/" + HOME_ROUTE} replace />} />
      <Route path="/:route" element={<ViewHost />} />
      <Route path="/:route/:id" element={<ViewHost />} />
    </Route>
  </Routes>
);

export default UserRoutes;
