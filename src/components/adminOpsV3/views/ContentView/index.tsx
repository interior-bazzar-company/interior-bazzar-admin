// ── ContentView ── admin Content / Blog (promptsadmin task 36). Blog list +
// feature toggle. Data: /api/v1/admin/content/. (Full rich editor: future task 60.)
import { useEffect, useState } from "react";
import styles from "../shared.module.css";
import AdminOpsService from "../../../../api/modules/adminOps";

interface Blog { id: number; title: string; slug: string; author: string; coverImageUrl: string; isFeatured: boolean; createdAt: string; }

const ContentView = () => {
  const [rows, setRows] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); AdminOpsService.content().then((r) => { if (r?.response) setRows(r.data.blogs || []); }).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const feature = async (id: number) => { const r = await AdminOpsService.toggleBlogFeatured(id).catch(() => null); if (r?.response) load(); };

  return (
    <div>
      <div className={styles.head}><h1>Content / Blog</h1><p>Published blog posts. Feature the ones to surface on the homepage.</p></div>
      {loading ? <div className={styles.empty}>Loading posts…</div> : rows.length === 0 ? <div className={styles.empty}>No blog posts yet.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Title</th><th>Author</th><th>Featured</th><th></th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td><td>{b.author || "—"}</td>
                  <td>{b.isFeatured ? "★" : "—"}</td>
                  <td className={styles.actions}><button type="button" className={styles.edit} onClick={() => feature(b.id)}>{b.isFeatured ? "Unfeature" : "Feature"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ContentView;
