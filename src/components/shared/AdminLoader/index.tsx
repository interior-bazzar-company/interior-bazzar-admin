/* =============================================================================
   THE FULL-PAGE LOADER
   -----------------------------------------------------------------------------
   Shown by RequireSession while `me/permissions/` is in flight — the one screen
   with nothing else on it.

   IT LOADS ITSELF LAST, ON PURPOSE. The animation is a 188 KB Lottie and its
   renderer is another 164 KB; the GIF it replaces was 4.2 KB. Put that in the
   main bundle and the thing you look at WHILE WAITING becomes the reason you are
   waiting — a loading screen that has to be loaded is a joke at the user's
   expense.

   So both arrive out of band:

     · `lottie_light` via dynamic import, so it lands in its own chunk rather
       than the entry. `light` is the SVG-only build — 164 KB against the full
       player's 299 KB — and this file is all shape layers, which is exactly
       what it renders.
     · the JSON via `?url`, so Vite emits it as a file to fetch instead of
       inlining 188 KB of vectors into JavaScript.

   Until they arrive the CSS spinner holds the screen. It is 3 lines of CSS and
   it is already there, so the loader is never itself blank.

   REDUCED MOTION gets the spinner and nothing else. The animation is a looping
   character at a desk — pleasant, and precisely the kind of continuous movement
   that setting exists to switch off.
   ========================================================================== */
import { useEffect, useRef, useState } from "react";
import styles from "./AdminLoader.module.css";
import animationUrl from "../../../assets/images/loading-spinner.json?url";

const AdminLoader = () => {
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let anim: { destroy: () => void } | null = null;
    let dead = false;

    (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(animationUrl).then((r) => r.json()),
        ]);
        /* The session can resolve while those two are still in flight, which
           unmounts this component — rendering into a detached node would leak an
           animation nothing ever stops. */
        if (dead || !host.current) return;
        anim = lottie.loadAnimation({
          container: host.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
        setPlaying(true);
      } catch {
        /* A chunk that fails to load is not worth an error screen HERE: the
           spinner is already on screen and still says the true thing. */
      }
    })();

    return () => {
      dead = true;
      anim?.destroy();
    };
  }, []);

  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      {/* The box is reserved at full size from the first paint, and the spinner
          sits INSIDE it — as a sibling it would shift the layout the moment the
          animation swapped in. */}
      <div className={styles.box}>
        <div ref={host} className={styles.anim} aria-hidden="true" />
        {playing ? null : <span className={"spinner " + styles.fallback} aria-hidden="true" />}
      </div>
      <span className={styles.srOnly}>Loading…</span>
    </div>
  );
};

export default AdminLoader;
