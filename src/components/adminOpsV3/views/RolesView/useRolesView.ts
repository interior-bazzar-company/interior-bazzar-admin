// ── useRolesView ── Roles & Permissions matrix logic (promptsadmin task 39).
// role × module → level(0-3) grid; cells cycle; save per role. super_admin is
// full-access (read-only). Data: /api/v1/admin/roles/.
import { useEffect, useState } from "react";
import AdminOpsService from "../../../../api/modules/adminOps";

export interface RoleRow { name: string; isFullAccess: boolean; modules: Record<string, number>; }

const useRolesView = () => {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await AdminOpsService.listRoles().catch(() => null);
    if (res?.response && res.data) { setRoles(res.data.roles); setModuleKeys(res.data.moduleKeys); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // cycle a cell 0→1→2→3→0
  const cycle = (roleName: string, mod: string) => {
    setRoles((rs) => rs.map((r) => {
      if (r.name !== roleName || r.isFullAccess) return r;
      const next = ((r.modules[mod] ?? 0) + 1) % 4;
      return { ...r, modules: { ...r.modules, [mod]: next } };
    }));
    setDirty((d) => ({ ...d, [roleName]: true }));
  };

  const saveRole = async (role: RoleRow) => {
    setSaving(role.name);
    const res = await AdminOpsService.updateRole(role.name, role.modules).catch(() => null);
    setSaving("");
    if (res?.response) {
      setNotice({ kind: "ok", msg: `${role.name} saved.` });
      setDirty((d) => ({ ...d, [role.name]: false }));
    } else setNotice({ kind: "err", msg: `Could not save ${role.name}.` });
  };

  return { roles, moduleKeys, loading, saving, dirty, notice, cycle, saveRole };
};

export default useRolesView;
