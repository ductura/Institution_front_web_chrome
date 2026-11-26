import { Download, SiteFooter } from "./Download";
import { Hero } from "./Hero";
import { How } from "./How";
import { Institutions } from "./Institutions";
import styles from "./Landing.module.css";
import { Privacy } from "./Privacy";
import { Questions } from "./Questions";
import { SiteHeader } from "./SiteHeader";
import { Teacher } from "./Teacher";

/**
 * The public home page after koncepti/naslovnica (DAN-1520), ported section
 * by section from the top. Text: `messagesHr.landing`.
 */
/** `base`: the app's address prefix, for the links to sign in and home (`appHref`). */
export function Landing({ base }: { base: string }) {
  return (
    <div className={styles.landing}>
      <SiteHeader base={base} />
      <div className={styles.backdrop} aria-hidden="true" />
      <main id="sadrzaj" className={styles.main}>
        <div className={styles.opening}>
          <Hero base={base} />
        </div>
        <How />
        <Teacher />
        <Privacy />
        <Institutions />
        <Questions />
        <Download base={base} />
      </main>
      <SiteFooter base={base} />
    </div>
  );
}
