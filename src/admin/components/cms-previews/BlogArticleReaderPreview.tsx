import styles from "../../../styles/cms-previews/BlogArticleReaderPreview.module.css";

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

export default function BlogArticleReaderPreview({ v }: { v: Record<string, any> }) {
  const title = String(v?.title ?? "").trim();
  const author = String(v?.author ?? "").trim();
  const body = typeof v?.description === "string" ? v.description : "";
  const words = body.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  const readTime = words ? Math.max(1, Math.ceil(words / 200)) : 0;
  const date = fmtDate(v?.timestamp || v?.updatedAt);

  return (
    <article className={styles.article}>
      {/* The public detail page has no breadcrumb and no share bar; its only nav is this back link (desktop). */}
      <span className={styles.back}>&larr; Back to IB Journal</span>
      <div className={styles.eyebrow}>IB Journal</div>
      <h1 className={styles.title} style={title ? undefined : { opacity: 0.4 }}>
        {title || "Untitled article"}
      </h1>

      <div className={styles.meta}>
        {v?.authorImageUrl ? (
          <img src={v.authorImageUrl} alt={author} className={styles.avatar} />
        ) : (
          <div className={styles.avatarFallback}>{initials(author || "IB")}</div>
        )}
        <div className={styles.metaText}>
          <span className={styles.authorName}>{author || "Unknown author"}</span>
          <span className={styles.metaSub}>
            {date}
            {readTime ? `${date ? " · " : ""}${readTime} min read` : ""}
          </span>
        </div>
      </div>

      {v?.coverImageUrl ? (
        <img src={v.coverImageUrl} alt={title} className={styles.cover} />
      ) : (
        <svg className={styles.cover} viewBox="0 0 760 380" role="img" aria-label="No cover image">
          <rect width="760" height="380" fill="#f7f6f2" />
          <text x="380" y="195" textAnchor="middle" fontSize="16" fill="#6b6b6b">No cover image</text>
        </svg>
      )}

      {body ? (
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: body }} />
      ) : (
        <div className={styles.content} style={{ opacity: 0.4 }}>Article body is empty.</div>
      )}
    </article>
  );
}
