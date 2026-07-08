// ── useAdminOpsLayout ── sidebar collapse state + active section resolution.
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PAGES } from "../../../utils/constants/app";
import { ADMIN_OPS_NAV, ADMIN_OPS_MODULES } from "../../../content/admin-ops-nav.content";
import { canSee, levelFor, OPS_ROLE_LABEL, type OpsRole } from "../../../content/admin-ops-rbac";
import { useAppSelector } from "../../../redux/store/hook";
import useLogout from "../../../hooks/auth/useLogout";

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

  // Acting role — TODO(backend, promptsadmin task 55): resolve from
  // GET /api/v1/admin/me/permissions/. Placeholder until then: super_admin (sees
  // all). The backend authorizes every action regardless of this client value.
  const role: OpsRole = "super_admin";

  // Nav gated by RBAC level: hide any module the role can't see (level 0), and
  // drop groups left empty. (admin-rbac-plan.md; nav gating is not security by
  // itself — the backend authorizes too.)
  const nav = ADMIN_OPS_NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(role, i.key)) }))
    .filter((g) => g.items.length > 0);

  // Active module key: the :section param, defaulting to "overview". A section the
  // role can't see falls back to overview.
  const requested = section && section in ADMIN_OPS_MODULES ? section : "overview";
  const activeKey = canSee(role, requested) ? requested : "overview";
  const activeLabel = ADMIN_OPS_MODULES[activeKey] ?? "Overview";
  const activeLevel = levelFor(role, activeKey);

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
    role, roleLabel: OPS_ROLE_LABEL[role], user, signOut,
  };
};

export default useAdminOpsLayout;
