// ── LeadQueue ── shared list+action UI for the routing and quarantine modules
// (both operate on LeadQuery, differing only by title + the two action buttons).
import { useEffect, useState } from "react";
import styles from "./shared.module.css";

export interface Lead {
  id: number; name: string; phone: string; email: string; interested: string;
  query: string; city: string; state: string; status: string; business: string | null;
}
interface Action { label: string; status: string; kind: "grant" | "del"; }

interface Props {
  title: string; blurb: string;
  fetcher: () => Promise<{ response: boolean; data: { leads: Lead[] } } | null>;
  action: (id: number, status: string) => Promise<{ response: boolean } | null>;
  actions: Action[];
}

const LeadQueue = ({ title, blurb, fetcher, action, actions }: Props) => {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = () => { setLoading(true); fetcher().then((r) => { if (r?.response) setRows(r.data.leads || []); else setRows([]); }).catch(() => setRows([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doAction = async (id: number, status: string) => {
    const r = await action(id, status).catch(() => null);
    if (r?.response) { setNotice({ kind: "ok", msg: "Updated." }); load(); }
    else setNotice({ kind: "err", msg: "Could not update." });
  };

  return (
    <div>
      <div className={styles.head}><h1>{title}</h1><p>{blurb}</p></div>
      {notice && <div className={`${styles.notice} ${notice.kind === "ok" ? styles.ok : styles.err}`}>{notice.msg}</div>}
      {loading ? <div className={styles.empty}>Loading…</div> : rows.length === 0 ? <div className={styles.empty}>Nothing in this queue.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Contact</th><th>Interested</th><th>City</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>{l.name || "—"}</td>
                  <td>{l.phone || l.email || "—"}</td>
                  <td style={{ maxWidth: 260 }}>{l.interested || l.query || "—"}</td>
                  <td>{l.city || "—"}</td>
                  <td><span className={styles.pill}>{l.status || "—"}</span></td>
                  <td className={styles.actions}>
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
    </div>
  );
};

export default LeadQueue;
