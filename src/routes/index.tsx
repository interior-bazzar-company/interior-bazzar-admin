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
      {/* A THIRD SEGMENT, for a record's own operations. `/team/58/leave` is a
          page about one person's leave, not a tab of a page about the person —
          it has its own crumb, its own toolbar and its own link somebody can
          send. The host still keys on the FIRST segment, so this adds a depth
          and never a module: a route with no third segment behaves exactly as
          it did. */}
      <Route path="/:route/:id/:sub" element={<ViewHost />} />
    </Route>
  </Routes>
);

export default UserRoutes;
