/* =============================================================================
   Team — the create-item dialog on the backend (overview/d6, 2026-09-14).
   -----------------------------------------------------------------------------
   The dialog (Work.tsx NewItemModal) is shared by #/work and the Overview
   header, and both now create through `POST work/`: kind, target, tags and
   links included. Its lists come from the backend too — people from
   `GET users/`, kinds and priorities from the value lists, tags from the
   assignee's own `GET work/tags/`.

   After a create, the Team store re-reads the backend, so the new item is on
   the board and its drawer opens.
   ============================================================================= */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { VocabItem } from "../../../api/modules/adminOps";
import { getSession } from "../../auth/session";
import { bootTeam } from "./store";
import type { Attachment, Result } from "./store";

type Row = { key: string; label: string; tone: string };
const refused = (e: unknown, fallback: string) =>
  ({ ok: false as const, code: "refused", message: e instanceof Error && e.message ? e.message : fallback });

/** The real calendar date here, not the seed's shifted TODAY. */
export const todayReal = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
/** The signed-in account's id — who a new item goes to unless changed. */
export const myId = () => String(getSession()?.user?.id ?? "");

/** Kinds and priorities in the shapes the dialog already reads (`labelOf(KIND, k)`,
 *  `PRIORITY_SCALE`). Until they answer, labels fall back to their keys. */
export function useWorkVocab() {
  const [v, setV] = useState({ KIND: {} as Record<string, Row>, PRIORITY: {} as Record<string, Row>,
    PRIORITY_SCALE: [] as string[], failed: false });
  useEffect(() => {
    let live = true;
    const active = (xs: VocabItem[]) => xs.filter((x) => x.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const mapOf = (xs: VocabItem[]) => Object.fromEntries(xs.map((x) => [x.key, { key: x.key, label: x.label, tone: x.tone }]));
    Promise.all([call(AdminOpsService.vocab("work-kinds")), call(AdminOpsService.vocab("work-priorities"))])
      .then(([k, p]) => {
        if (live) setV({ KIND: mapOf(active(k.items)), PRIORITY: mapOf(active(p.items)),
          PRIORITY_SCALE: active(p.items).map((x) => x.key), failed: false });
      })
      .catch(() => { if (live) setV((x) => ({ ...x, failed: true })); });
    return () => { live = false; };
  }, []);
  return v;
}

/** Active admin-panel accounts. Without team.view the list is just you — which
 *  is also the only person you may assign to without work.all. */
export function useAssignees() {
  const [rows, setRows] = useState(() => {
    const me = getSession()?.user;
    return me ? [{ memberId: String(me.id), name: me.name || me.username, status: "active" }] : [];
  });
  useEffect(() => {
    let live = true;
    call(AdminOpsService.users())
      .then((us) => {
        if (live) setRows(us.filter((u) => u.isActive !== false)
          .map((u) => ({ memberId: String(u.id), name: u.name || u.username, status: "active" })));
      })
      .catch(() => { /* keep yourself */ });
    return () => { live = false; };
  }, []);
  return rows;
}

const tagListeners = new Set<() => void>();

/** One owner's active tags, in the dialog's chip shape. Refetched when a tag is
 *  made through `createWorkTag`. Somebody else's without work.all: none. */
export function useWorkTags(owner: string) {
  const [rows, setRows] = useState<{ tagId: string; label: string; colourToken: string }[]>([]);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const l = () => setBump((n) => n + 1);
    tagListeners.add(l);
    return () => { tagListeners.delete(l); };
  }, []);
  useEffect(() => {
    let live = true;
    if (!owner) { setRows([]); return; }
    call(AdminOpsService.workTags({ owner }))
      .then((r) => { if (live) setRows(r.tags.map((t) => ({ tagId: String(t.id), label: t.label, colourToken: t.tone.key }))); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [owner, bump]);
  return rows;
}

export async function createWorkTag(owner: string, label: string, tone: string): Promise<Result<{ tagId: string }>> {
  try {
    const t = await call(AdminOpsService.createWorkTag({ label, tone, owner: Number(owner) || undefined }));
    tagListeners.forEach((l) => l());
    await bootTeam(true);
    return { ok: true, data: { tagId: String(t.id) } };
  } catch (e) {
    return refused(e, "The tag could not be made.");
  }
}

export async function createWorkItem(input: {
  title: string; assigneeId: string; kind: string; priority: string; startDate: string | null; dueDate: string | null;
  description: string | null; attachments: Attachment[]; tagIds: string[]; targetValue?: number; targetUnit?: string;
}): Promise<Result<{ itemId: string; title: string }>> {
  try {
    const row = await call(AdminOpsService.createWork({
      title: input.title.trim(), description: input.description || "", assignee: Number(input.assigneeId) || undefined,
      priority: input.priority, kind: input.kind, startDate: input.startDate, dueDate: input.dueDate,
      targetValue: input.kind === "target" ? input.targetValue ?? null : null,
      targetUnit: input.kind === "target" ? input.targetUnit || "" : "",
      tags: input.tagIds.map(Number), links: input.attachments.map((a) => ({ url: a.url, label: a.label })),
    }));
    await bootTeam(true);
    return { ok: true, data: { itemId: String(row.id), title: row.title } };
  } catch (e) {
    return refused(e, "The item could not be created.");
  }
}
