// ── LeadQueue ── shared list+action UI for the routing and quarantine modules
// (both operate on LeadQuery, differing only by title + the two action buttons).
// Routing opts into extra behaviour via OPTIONAL props (tierFilter + onAdd/onEdit)
// so Quarantine, which passes none of them, is completely unaffected.
import { useEffect, useState } from "react";
import styles from "./shared.module.css";

export interface Lead {
  id: number; name: string; phone: string; email: string; interested: string;
  query: string; city: string; state: string; status: string; business: string | null;
  tier?: string; score?: number; remark?: string;
}
interface Action { label: string; status: string; kind: "grant" | "del"; }

// The add/edit form mirrors AdminLeadsCreateSchema (backend).
export interface LeadForm {
  name: string; phone: string; email: string; city: string; state: string; country: string;
  interested: string; query: string; status: string; leadStatus: string; stage: string;
  tag: string; priority: string; remark: string;
}
const emptyForm = (): LeadForm => ({
  name: "", phone: "", email: "", city: "", state: "", country: "",
  interested: "", query: "", status: "", leadStatus: "", stage: "", tag: "", priority: "", remark: "",
});
const toForm = (l: Lead): LeadForm => ({
  ...emptyForm(), name: l.name || "", phone: l.phone || "", email: l.email || "",
  city: l.city || "", state: l.state || "", interested: l.interested || "",
  query: l.query || "", status: l.status || "",
});

const TIERS = ["A", "B", "C", "D", "E"];

interface Props {
  title: string; blurb: string;
  fetcher: (tier?: string) => Promise<{ response: boolean; data: { leads: Lead[] } } | null>;
  action: (id: number, status: string) => Promise<{ response: boolean } | null>;
  actions: Action[];
  // Routing-only opt-ins (Quarantine omits all three):
  tierFilter?: boolean;
  onAdd?: (data: LeadForm) => Promise<{ response: boolean; message?: string } | null>;
  onEdit?: (id: number, data: LeadForm) => Promise<{ response: boolean; message?: string } | null>;
  // Quarantine opt-in: render a Reason column from remark ("quarantine:<reason>").
  showReason?: boolean;
}

const LeadQueue = ({ title, blurb, fetcher, action, actions, tierFilter, onAdd, onEdit, showReason }: Props) => {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Add/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm());
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetcher(tierFilter ? tier || undefined : undefined)
      .then((r) => { if (r?.response) setRows(r.data.leads || []); else setRows([]); })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [tier]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAction = async (id: number, status: string) => {
    const r = await action(id, status).catch(() => null);
    if (r?.response) { setNotice({ kind: "ok", msg: "Updated." }); load(); }
    else setNotice({ kind: "err", msg: "Could not update." });
  };

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setModalOpen(true); setNotice(null); };
  const openEdit = (l: Lead) => { setEditingId(l.id); setForm(toForm(l)); setModalOpen(true); setNotice(null); };
  const closeModal = () => setModalOpen(false);
  const setField = (k: keyof LeadForm, val: string) =>
    setForm((f) => ({ ...f, [k]: k === "phone" ? val.replace(/[^\d]/g, "") : val }));

  const submitModal = async () => {
    if (form.name.trim().length < 2) { setNotice({ kind: "err", msg: "Name must be at least 2 characters." }); return; }
    if (form.phone.replace(/[^\d]/g, "").length < 7) { setNotice({ kind: "err", msg: "Phone must be at least 7 digits." }); return; }
    setBusy(true);
    const fn = editingId != null ? onEdit?.(editingId, form) : onAdd?.(form);
    const r = fn ? await fn.catch(() => null) : null;
    setBusy(false);
    if (r?.response) { setNotice({ kind: "ok", msg: editingId != null ? "Lead updated." : "Lead created." }); setModalOpen(false); load(); }
    else setNotice({ kind: "err", msg: r?.message || "Could not save lead." });
  };

  const showTierCols = !!tierFilter;

  return (
    <div>
      <div className={styles.head}>
        <div><h1>{title}</h1><p>{blurb}</p></div>
        {onAdd && <button type="button" className={styles.add} onClick={openAdd}>+ Add lead</button>}
      </div>

      {notice && <div className={`${styles.notice} ${notice.kind === "ok" ? styles.ok : styles.err}`}>{notice.msg}</div>}

      {tierFilter && (
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${tier === "" ? styles.tabActive : ""}`} onClick={() => setTier("")}>All tiers</button>
          {TIERS.map((t) => (
            <button key={t} type="button" className={`${styles.tab} ${tier === t ? styles.tabActive : ""}`} onClick={() => setTier(t)}>Tier {t}</button>
          ))}
        </div>
      )}

      {loading ? <div className={styles.empty}>Loading…</div> : rows.length === 0 ? <div className={styles.empty}>Nothing in this queue.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {showTierCols && <><th>Tier</th><th>Score</th></>}
                <th>Name</th><th>Contact</th><th>Interested</th><th>City</th><th>Status</th>{showReason && <th>Reason</th>}<th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  {showTierCols && (
                    <>
                      <td>{l.tier ? <span className={`${styles.pill} ${styles[`tier${l.tier}`] || ""}`}>{l.tier}</span> : "—"}</td>
                      <td className={styles.mono}>{l.score ?? 0}</td>
                    </>
                  )}
                  <td>{l.name || "—"}</td>
                  <td>{l.phone || l.email || "—"}</td>
                  <td style={{ maxWidth: 260 }}>{l.interested || l.query || "—"}</td>
                  <td>{l.city || "—"}</td>
                  <td><span className={styles.pill}>{l.status || "—"}</span></td>
                  {showReason && <td>{l.remark ? l.remark.replace(/^quarantine:/, "") : "—"}</td>}
                  <td className={styles.actions}>
                    {onEdit && <button type="button" className={styles.edit} onClick={() => openEdit(l)}>Edit</button>}
                    {actions.map((a) => (
                      <button key={a.status} type="button" className={styles[a.kind]} onClick={() => doAction(l.id, a.status)}>{a.label}</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>{editingId != null ? "Edit lead" : "Add lead"}</h2>
            <div className={styles.formGrid}>
              <label>Name*<input value={form.name} onChange={(e) => setField("name", e.target.value)} /></label>
              <label>Phone*<input value={form.phone} inputMode="numeric" onChange={(e) => setField("phone", e.target.value)} /></label>
              <label>Email<input value={form.email} onChange={(e) => setField("email", e.target.value)} /></label>
              <label>City<input value={form.city} onChange={(e) => setField("city", e.target.value)} /></label>
              <label>State<input value={form.state} onChange={(e) => setField("state", e.target.value)} /></label>
              <label>Country<input value={form.country} onChange={(e) => setField("country", e.target.value)} /></label>
              <label>Status<input value={form.status} onChange={(e) => setField("status", e.target.value)} /></label>
              <label>Priority<input value={form.priority} onChange={(e) => setField("priority", e.target.value)} /></label>
              <label>Lead status<input value={form.leadStatus} onChange={(e) => setField("leadStatus", e.target.value)} /></label>
              <label>Stage<input value={form.stage} onChange={(e) => setField("stage", e.target.value)} /></label>
            </div>
            <label className={styles.full}>Interested<input value={form.interested} onChange={(e) => setField("interested", e.target.value)} /></label>
            <label className={styles.full}>Query<textarea rows={2} value={form.query} onChange={(e) => setField("query", e.target.value)} /></label>
            <label className={styles.full}>Remark<input value={form.remark} onChange={(e) => setField("remark", e.target.value)} /></label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.save} disabled={busy} onClick={submitModal}>{busy ? "Saving…" : "Save"}</button>
              <button type="button" className={styles.cancel} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadQueue;
