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

  // ── Add role ── inline draft row: name + a module→level map that cycles.
  const [draft, setDraft] = useState<{ name: string; modules: Record<string, number> } | null>(null);
  const startDraft = () => setDraft({ name: "", modules: {} });
  const cancelDraft = () => setDraft(null);
  const setDraftName = (name: string) => setDraft((d) => (d ? { ...d, name } : d));
  const cycleDraft = (mod: string) =>
    setDraft((d) => (d ? { ...d, modules: { ...d.modules, [mod]: ((d.modules[mod] ?? 0) + 1) % 4 } } : d));

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setNotice({ kind: "err", msg: "Role name is required." }); return; }
    setSaving("__draft__");
    const res = await AdminOpsService.createRole(name, draft.modules).catch(() => null);
    setSaving("");
    if (res?.response) {
      setNotice({ kind: "ok", msg: `Role "${name}" created.` });
      setDraft(null);
      await load();
    } else setNotice({ kind: "err", msg: res?.message || `Could not create "${name}".` });
  };

  return {
    roles, moduleKeys, loading, saving, dirty, notice, cycle, saveRole,
    draft, startDraft, cancelDraft, setDraftName, cycleDraft, saveDraft,
  };
};

export default useRolesView;
