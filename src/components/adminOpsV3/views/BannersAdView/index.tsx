// ── BannersAdView ── admin Banner Ads moderation (port of prototype
// bannerAdsView). Status tab strip + approve + reject-with-reason (custom form,
// no native prompt). Data: /api/v1/admin/banners-ad/.
import { Fragment } from "react";
import styles from "./BannersAdView.module.css";
import useBannersAdView, { AD_TABS } from "./useBannersAdView";

const BannersAdView = () => {
  const v = useBannersAdView();

  return (
    <div>
      <div className={styles.head}>
        <h1>Banner Ads</h1>
        <p>Moderate advertiser banner submissions.</p>
      </div>

      {v.notice && (
        <div className={`${styles.notice} ${v.notice.kind === "ok" ? styles.ok : styles.err}`}>{v.notice.msg}</div>
      )}

      <div className={styles.tabs}>
        {AD_TABS.map((t) => (
          <button key={t} type="button" className={`${styles.tab} ${v.tab === t ? styles.tabActive : ""}`} onClick={() => v.setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {v.loading ? (
        <div className={styles.empty}>Loading ads…</div>
      ) : v.ads.length === 0 ? (
        <div className={styles.empty}>No {v.tab} ads.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Title</th><th>Advertiser</th><th>Days</th><th>Price</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {v.ads.map((a) => (
                <Fragment key={a.id}>
                  <tr>
                    <td>{a.title}</td>
                    <td>{a.advertiser}</td>
                    <td>{a.days}</td>
                    <td>₹{a.priceTotal}</td>
                    <td><span className={styles.status}>{a.status || "—"}</span></td>
                    <td className={styles.actions}>
                      {v.tab !== "approved" && (
                        <button type="button" className={styles.approve} disabled={v.busy} onClick={() => v.approve(a.id)}>Approve</button>
                      )}
                      {v.tab !== "rejected" && (
                        <button type="button" className={styles.reject} disabled={v.busy} onClick={() => v.openReject(a.id)}>Reject</button>
                      )}
                    </td>
                  </tr>
                  {v.rejectingId === a.id && (
                    <tr className={styles.rejectRow}>
                      <td colSpan={6}>
                        <div className={styles.rejectForm}>
                          <input
                            placeholder="Reason for rejection (required)"
                            value={v.reason}
                            onChange={(e) => v.setReason(e.target.value)}
                          />
                          <button type="button" className={styles.reject} disabled={v.busy} onClick={v.submitReject}>
                            {v.busy ? "…" : "Confirm reject"}
                          </button>
                          <button type="button" className={styles.cancel} onClick={v.cancelReject}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {a.rejectReason && v.tab === "rejected" && (
                    <tr><td colSpan={6} className={styles.reason}>Reason: {a.rejectReason}</td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BannersAdView;
