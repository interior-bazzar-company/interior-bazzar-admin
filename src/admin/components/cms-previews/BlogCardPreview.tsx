// One blog LIST card as the public IB Journal index renders it, plus the featured hero when isFeatured.
// Ported from interior-bazzar-frontend: components/blogV3/BlogGrid (ArticleCard), BlogFeatured, pages/Blog/v3/useBlogV3.ts (adaptBlog / adaptFeatured).
// The public card ignores coverImageUrl: it paints a gradient with the title as a serif word.
import styles from "../../../styles/cms-previews/BlogCardPreview.module.css";

const GRADIENT = "linear-gradient(135deg,#085041,#1d9e75)";

const toExcerpt = (html?: string, max = 180): string => {
  if (!html) return "";
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

export default function BlogCardPreview({ v }: { v: Record<string, any> }) {
  const title = String(v?.title ?? "").trim();
  const author = String(v?.author ?? "").trim();
  const body = typeof v?.description === "string" ? v.description : "";
  const excerpt = toExcerpt(body);
  const words = body.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  const readTime = words ? `${Math.max(1, Math.ceil(words / 200))} min read` : "";

  const d = v?.timestamp ? new Date(v.timestamp) : null;
  const dateStr = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const tw = title.split(/\s+/).filter(Boolean);
  let lead = "";
  let accent = title;
  let trail = "";
  if (tw.length >= 3) {
    lead = tw.slice(0, 2).join(" ") + " ";
    accent = tw[tw.length - 1];
    trail = tw.length > 3 ? " " + tw.slice(2, -1).join(" ") : "";
  } else if (tw.length === 2) {
    lead = tw[0] + " ";
    accent = tw[1];
  }
  const ini = author.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  return (
    <div className={styles.root}>
      <div className={styles.cardWrap}>
        <div className={styles.article}>
          <div className={styles.cardImg}>
            <div className={styles.imgBg} style={{ background: GRADIENT }}>
              <div className={styles.graphicInner}>
                <div className={styles.word}>{title || <span className={styles.empty}>Untitled</span>}</div>
              </div>
            </div>
            <span className={styles.catBadge}>Article</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardCat}>IB Journal</div>
            <h3 className={styles.cardH}>{title || <span className={styles.empty}>Untitled article</span>}</h3>
            <p className={styles.cardExcerpt}>{excerpt || <span className={styles.empty}>No body text yet.</span>}</p>
            <div className={styles.cardFoot}>
              <div className={styles.cardRead}>&#9719; {readTime}</div>
            </div>
          </div>
        </div>
      </div>

      {v?.isFeatured ? (
        <>
          <div className={styles.label}>
            Also shown as the featured story{v?.featuredOrder != null && v.featuredOrder !== "" ? ` (order ${v.featuredOrder})` : ""}
          </div>
          <article className={styles.featured} style={{ marginBottom: 0 }}>
            <div className={styles.img}>
              <div className={styles.fImgBg} style={{ background: GRADIENT }}>
                <div className={styles.fGraphicInner}>
                  <div className={styles.bigWord}>{tw[0] ?? "Read"}</div>
                  <div className={styles.smallWord}>{tw[1] ?? "now"}</div>
                </div>
              </div>
              <div className={styles.badge}>Featured</div>
            </div>
            <div className={styles.body}>
              <div>
                <div className={styles.cat}>IB Journal</div>
                <h2 className={styles.h}>
                  {lead}
                  <em className={styles.accent}>{accent}</em>
                  {trail}
                </h2>
                <p className={styles.excerpt}>{excerpt}</p>
              </div>
              <div className={styles.meta}>
                <div className={styles.metaInfo}>
                  <div className={styles.metaAvatar}>{ini}</div>
                  <div>
                    <div className={styles.metaName}>{author}</div>
                    <div className={styles.metaTime}>{dateStr}</div>
                  </div>
                </div>
                <span className={styles.readBtn}>Read story &rarr;</span>
              </div>
            </div>
          </article>
        </>
      ) : null}
    </div>
  );
}
