// ── LeadQueue ── shared list+action UI for the routing and quarantine modules
// (both operate on LeadQuery, differing only by title + the two action buttons).
// Routing opts into extra behaviour via OPTIONAL props (tierFilter + onAdd/onEdit)
// so Quarantine, which passes none of them, is completely unaffected.
import { useEffect, useState } from "react";
import styles from "./shared.module.css";
import { useModal } from "../../../context/ModalContext";
import AssignLead from "../../dashboard/AssignLead";
import LeadDetail from "../../dashboard/Lead/LeadDetail";
import type { AdminLeadType } from "../../../types/content";

export interface Lead {
  id: number; name: string; phone: string; email: string; interested: string;
  query: string; city: string; state: string; status: string; business: string | null;
  tier?: string; score?: number; remark?: string;
  country?: string; category?: string; stage?: string; tag?: string; leadStatus?: string;
  timeline?: string;
}

// Buyer timeline options → the urgency qualification signal (task 33). Must match
// the backend LeadQuery.TIMELINE_CHOICES.
export const TIMELINE_OPTIONS = [
  { value: "", label: "— not set —" },
  { value: "30d", label: "Within 30 days" },
  { value: "90d", label: "30–90 days" },
  { value: "90plus", label: "90+ days" },
  { value: "browsing", label: "Just browsing" },
];

// v3 routing rows are a subset of AdminLeadType (the shape the ported AssignLead /
// LeadDetail popups expect). Fill the fields those popups render; business -> assigned.
const toAdminLead = (l: Lead): AdminLeadType => ({
  id: l.id, date: "", updatedAt: "", name: l.name, phone: l.phone, email: l.email,
  interested: l.interested ?? "", query: l.query ?? "", country: l.country ?? "",
  city: l.city, state: l.state, assigned: l.business ?? null, status: l.status,
  leadStatus: l.leadStatus, category: l.category, stage: l.stage, tag: l.tag, remark: l.remark,
});
interface Action { label: string; status: string; kind: "grant" | "del"; }

// The add/edit form mirrors AdminLeadsCreateSchema (backend).
export interface LeadForm {
  name: string; phone: string; email: string; city: string; state: string; country: string;
  interested: string; query: string; status: string; leadStatus: string; stage: string;
  tag: string; priority: string; remark: string; timeline: string;
}
const emptyForm = (): LeadForm => ({
  name: "", phone: "", email: "", city: "", state: "", country: "",
  interested: "", query: "", status: "", leadStatus: "", stage: "", tag: "", priority: "", remark: "", timeline: "",
});
const toForm = (l: Lead): LeadForm => ({
  ...emptyForm(), name: l.name || "", phone: l.phone || "", email: l.email || "",
  city: l.city || "", state: l.state || "", interested: l.interested || "",
  query: l.query || "", status: l.status || "", timeline: l.timeline || "",
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
  // Routing opt-in: per-row Assign (search-first business picker) + Details popups.
  assignable?: boolean;
}

const LeadQueue = ({ title, blurb, fetcher, action, actions, tierFilter, onAdd, onEdit, showReason, assignable }: Props) => {
  const { showModal } = useModal();
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

  // Reuse the old-admin popups (same app): search-first assign + full lead detail.
  const openAssign = (l: Lead) => showModal(
    <AssignLead lead={toAdminLead(l)} onAssigned={() => load()} />,
    { width: "85vw", maxWidth: "1100px" },
  );
  const openDetails = (l: Lead) => showModal(<LeadDetail lead={toAdminLead(l)} />);

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

  const showTier = !!tierFilter;
  // ponytail: backend LeadQuery has no ref column — synthesize a stable display ref from id.
  const refOf = (id: number) => `IB-ENQ-${String(id).padStart(4, "0")}`;

  return (
    <div>
      <div className={styles.head}>
        <div><h1>{title}</h1><p>{blurb}</p></div>
        <div className={styles.headRight}>
          <span className={styles.count}>{rows.length}</span>
          {onAdd && <button type="button" className={styles.add} onClick={openAdd}>+ Add lead</button>}
        </div>
      </div>

      {notice && <div className={`${styles.notice} ${notice.kind === "ok" ? styles.ok : styles.err}`}>{notice.msg}</div>}

      {tierFilter && (
        <>
          <div className={styles.legend}>
            <span><span className={`${styles.pill} ${styles.tierA}`}>A / B</span> Assign to senior closer</span>
            <span><span className={`${styles.pill} ${styles.tierC}`}>C</span> Telesales validate first</span>
            <span><span className={`${styles.pill} ${styles.tierD}`}>D / E</span> Flag niche or nurture</span>
          </div>
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tab} ${tier === "" ? styles.tabActive : ""}`} onClick={() => setTier("")}>All tiers</button>
            {TIERS.map((t) => (
              <button key={t} type="button" className={`${styles.tab} ${tier === t ? styles.tabActive : ""}`} onClick={() => setTier(t)}>Tier {t}</button>
            ))}
          </div>
        </>
      )}

      {loading ? <div className={styles.empty}>Loading…</div> : rows.length === 0 ? <div className={styles.empty}>Nothing in this queue.</div> : (
        <div className={styles.cards}>
          {rows.map((l) => (
            <div key={l.id} className={`${styles.card} ${showTier ? styles[`brd${l.tier}`] || "" : styles.brdWarn}`}>
              <div className={styles.cardTop}>
                <span className={styles.mono}>{refOf(l.id)}</span>
                {showTier && l.tier && <span className={`${styles.pill} ${styles[`tier${l.tier}`] || ""}`}>{l.tier}</span>}
                {showTier && <span className={styles.score}>score {l.score ?? 0}</span>}
                {showReason && <span className={`${styles.pill} ${styles.amber}`}><i className="ti ti-alert-triangle" /> {l.remark ? l.remark.replace(/^quarantine:/, "") : "flagged"}</span>}
                {!showTier && !showReason && <span className={`${styles.pill} ${styles.info}`}>{l.status || "—"}</span>}
              </div>
              <div className={styles.cardMeta}>
                {l.name && <span><i className="ti ti-user" /> <b>{l.name}</b>{l.phone ? ` · ${l.phone}` : ""}</span>}
                {(l.interested) && <span><i className="ti ti-tag" /> <b>{l.interested}</b></span>}
                {(l.state || l.city) && <span><i className="ti ti-map-pin" /> <b>{l.state || l.city}</b></span>}
              </div>
              {l.query && <div className={styles.cardReq}>“{l.query}”</div>}
              <div className={styles.cardActions}>
                {assignable && <button type="button" className={styles.grant} onClick={() => openAssign(l)}>Assign</button>}
                {assignable && <button type="button" className={styles.edit} onClick={() => openDetails(l)}>Details</button>}
                {onEdit && <button type="button" className={styles.edit} onClick={() => openEdit(l)}>Edit</button>}
                {actions.map((a) => (
                  <button key={a.status} type="button" className={styles[a.kind]} onClick={() => doAction(l.id, a.status)}>{a.label}</button>
                ))}
              </div>
            </div>
          ))}
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
              <label>Timeline
                <select value={form.timeline} onChange={(e) => setField("timeline", e.target.value)}>
                  {TIMELINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
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
