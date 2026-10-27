import { useMemo } from "react";
import styles from "../../../styles/cms-previews/LegalPageReaderPreview.module.css";

interface TocEntry { id: string; label: string; sub?: boolean }

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";

// Same algorithm as the frontend's useLegalV3 withToc.
const withToc = (html: string): { html: string; toc: TocEntry[] } => {
  if (!html) return { html, toc: [] };
  const doc = new DOMParser().parseFromString(html, "text/html");
  const heads = Array.from(doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  if (!heads.length) return { html, toc: [] };
  const level = (h: Element) => Number(h.tagName[1]);
  const top = Math.min(...heads.map(level));
  const toc: TocEntry[] = [];
  const used = new Set<string>();
  heads.forEach((h) => {
    const depth = level(h) - top;
    if (depth > 1) return;
    const label = (h.textContent ?? "").trim();
    if (!label) return;
    const base = h.closest("section[id]")?.id || h.id || slugify(label);
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    if (!h.closest("section[id]")) h.id = id;
    h.setAttribute(depth === 0 ? "data-sec" : "data-sub", "");
    toc.push(depth === 0 ? { id, label } : { id, label, sub: true });
  });
  return { html: doc.body.innerHTML, toc };
};

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

export default function LegalPageReaderPreview({ v }: { v: Record<string, any> }) {
  const meta: Record<string, any> = v?.meta && typeof v.meta === "object" ? v.meta : {};
  const title = String(v?.title ?? "").trim();
  const content = typeof v?.content === "string" ? v.content : "";
  const { html, toc } = useMemo(() => withToc(content), [content]);
  const updated = fmtDate(v?.updatedAt);
  const cross: any[] = Array.isArray(meta.cross) ? meta.cross : meta.cross && typeof meta.cross === "object" ? [meta.cross] : [];

  const tocItems = (
    <ol>
      {toc.map((t) => (
        <li key={t.id} data-sub={t.sub ? "" : undefined}>
          <a href={`#${t.id}`} onClick={(e) => e.preventDefault()}>{t.label}</a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.hero}>
        {meta.eyebrow && <div className={styles.eyebrow}>{meta.eyebrow}</div>}
        <h1 className={styles.title} style={title ? undefined : { opacity: 0.4 }}>
          {title || "Untitled document"}
        </h1>
        {meta.sub && <p className={styles.sub}>{meta.sub}</p>}
        <div className={styles.metaRow}>
          {meta.effective && <span>Effective <b>{meta.effective}</b></span>}
          {meta.version && <span>Version <b>{meta.version}</b></span>}
          {updated && <span>Last updated <b>{updated}</b></span>}
          {meta.operatedBy && <span>Operated by <b>{meta.operatedBy}</b></span>}
          {meta.cin && <span>CIN <b>{meta.cin}</b></span>}
        </div>
      </div>

      <div className={styles.grid}>
        {toc.length > 0 && (
          <nav className={styles.toc}>
            <div className={styles.tocHead}>On this page</div>
            {tocItems}
          </nav>
        )}

        <article className={styles.art}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className={styles.state}>Document body is empty.</p>
          )}

          {cross.length > 0 && (
            <div className={styles.cross}>
              {cross.map((c, i) => (
                <a key={i} href="#" onClick={(e) => e.preventDefault()}>
                  <div className={styles.crossTitle}>{c?.title ?? ""}</div>
                  <div className={styles.crossDesc}>{c?.desc ?? ""}</div>
                </a>
              ))}
            </div>
          )}

          <footer className={styles.foot}>
            {meta.operatedBy && (
              <div className={styles.entity}>
                <b>{meta.operatedBy}</b>
                <br />
                Interior bazzar is a product of {meta.operatedBy}. CIN {meta.cin}. MSME registered.
              </div>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}
