// ── CatRegionView ── admin Categories & Regions taxonomy (promptsadmin task 32).
// Lists categories/segments/states + add a category. Data: /api/v1/admin/taxonomy/.
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface Cat { id: number; value: string; label: string; trending: boolean; }
interface St { id: number; name: string; value: string | null; }

const CatRegionView = () => {
  const [cats, setCats] = useState<Cat[]>([]);
  const [states, setStates] = useState<St[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(""); const [label, setLabel] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = () => { setLoading(true); AdminOpsService.taxonomy().then((r) => { if (r?.response) { setCats(r.data.categories || []); setStates(r.data.states || []); } }).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!value.trim() || !label.trim()) { setNotice({ kind: "err", msg: "Value and label are required." }); return; }
    const r = await AdminOpsService.addCategory(value.trim(), label.trim()).catch(() => null);
    if (r?.response) { setNotice({ kind: "ok", msg: "Category added." }); setValue(""); setLabel(""); load(); }
    else setNotice({ kind: "err", msg: r?.message || "Could not add category." });
  };

  return (
    <div>
      <div className={styles.head}><h1>Categories &amp; Regions</h1><p>The taxonomy powering search and browse. Add categories; states are read-only.</p></div>
      {notice && <div className={`${styles.notice} ${notice.kind === "ok" ? styles.ok : styles.err}`}>{notice.msg}</div>}
      {loading ? <div className={styles.empty}>Loading taxonomy…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>Categories ({cats.length})</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Label</th><th>Value</th><th>Trending</th></tr></thead>
                <tbody>
                  {cats.map((c) => (<tr key={c.id}><td>{c.label}</td><td className={styles.mono}>{c.value}</td><td>{c.trending ? "★" : "—"}</td></tr>))}
                  <tr>
                    <td><input className={styles.num} style={{ width: 140 }} placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} /></td>
                    <td><input className={styles.num} style={{ width: 120 }} placeholder="value" value={value} onChange={(e) => setValue(e.target.value)} /></td>
                    <td><button type="button" className={styles.save} onClick={add}>Add</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>States ({states.length})</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Name</th><th>Value</th></tr></thead>
                <tbody>{states.map((s) => (<tr key={s.id}><td>{s.name}</td><td className={styles.mono}>{s.value || "—"}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatRegionView;
