// ── useAdminOpsLayout ── sidebar collapse state + active section resolution.
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PAGES } from "../../../utils/constants/app";
import { ADMIN_OPS_NAV, ADMIN_OPS_MODULES } from "../../../content/admin-ops-nav.content";
import { levelFor, OPS_ROLE_LABEL, type OpsRole } from "../../../content/admin-ops-rbac";
import { useAppSelector } from "../../../redux/store/hook";
import useLogout from "../../../hooks/auth/useLogout";
import AdminOpsService from "../../../api/modules/adminOps";

const useAdminOpsLayout = () => {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { logout } = useLogout();

  // Signed-in admin for the topbar user chip (hydrated by useInitUser).
  const user = useAppSelector((s) => s.user.user);

  // Sign out: clear tokens + auth/user state, then hard-replace to login so the
  // back button can't return to the console.
  const signOut = () => {
    logout();
    navigate(PAGES.ADMIN_OPS_LOGIN, { replace: true });
  };

  // Acting role — resolved from GET /api/v1/admin/me/permissions/ (task 55). Nav
  // gating uses the static PERMS map keyed by OpsRole; a backend role name outside
  // that union (e.g. a custom-created role) stays least-privileged for nav but is
  // still authorized server-side by its real module levels.
  // ponytail: least-privileged ("analyst") until permissions resolve — avoids a
  // flash of the full super_admin nav for a non-super user. roleName holds the raw
  // backend name for the topbar chip label.
  const [role, setRole] = useState<OpsRole>("analyst");
  const [roleName, setRoleName] = useState<string | null>(null);
  // Backend-resolved per-module levels — authoritative once loaded. Covers
  // legacy/custom role names (e.g. migrated prod "Admin", "sales team") that
  // aren't OpsRole keys and used to silently degrade to analyst.
  const [modules, setModules] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    AdminOpsService.mePermissions()
      .then((res) => {
        const r = res?.data?.role ?? null;
        const mods = res?.data?.modules ?? null;
        setRoleName(r);
        if (mods && typeof mods === "object") setModules(mods);
        if (r && r in OPS_ROLE_LABEL) setRole(r as OpsRole);
        else if (mods && Object.values(mods).every((l) => l === 3))
          setRole("super_admin"); // legacy is_full_access role under a custom name
      })
      .catch(() => {});
  }, []);

  // Level resolution: the backend modules map wins; the static PERMS map only
  // fills in until permissions resolve (least-privileged analyst default).
  const lvl = (key: string) =>
    modules ? (modules[key] ?? 0) : levelFor(role, key);

  // Nav gated by RBAC level: hide any module the role can't see (level 0), and
  // drop groups left empty. (admin-rbac-plan.md; nav gating is not security by
  // itself — the backend authorizes too.)
  const nav = ADMIN_OPS_NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => lvl(i.key) >= 1) }))
    .filter((g) => g.items.length > 0);

  // Active module key: the :section param, defaulting to "overview". A section the
  // role can't see falls back to overview.
  const requested = section && section in ADMIN_OPS_MODULES ? section : "overview";
  const activeKey = lvl(requested) >= 1 ? requested : "overview";
  const activeLabel = ADMIN_OPS_MODULES[activeKey] ?? "Overview";
  const activeLevel = lvl(activeKey);

  // Collapsed groups (all open by default; Overview is solo so never collapses).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (grp: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(grp) ? next.delete(grp) : next.add(grp);
      return next;
    });

  const goSection = (key: string) =>
    navigate(`${PAGES.ADMIN_OPS_ROOT}/${key}`);

  return {
    nav, activeKey, activeLabel, activeLevel, collapsed, toggleGroup, goSection,
    role,
    roleLabel: roleName ? (OPS_ROLE_LABEL[roleName as OpsRole] ?? roleName) : OPS_ROLE_LABEL[role],
    user, signOut,
  };
};

export default useAdminOpsLayout;
