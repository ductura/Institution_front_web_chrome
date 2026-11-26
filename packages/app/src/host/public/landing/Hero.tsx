import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr";

import { EDGE_LINK } from "./edge";
import styles from "./Hero.module.css";
import { Preview } from "./Preview";

const t = messagesHr.landing.hero;

/**
 * The opening section. The title corrects itself: "dokazuje" is struck
 * through in pencil, "pokazuje" is written in and a margin note follows. The
 * correction is CSS only, so it runs without script; reduced motion shows the
 * end state at once. Screen readers get the finished sentence.
 */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="pocetna-naslov">
      <div className={styles.heading}>
        <h1 id="pocetna-naslov" aria-label={t.title}>
          <span className={styles.line} aria-hidden="true">
            {t.titleStart}{" "}
            <span className={styles.correction}>
              <del>{t.titleStruck}</del>
              <ins>
                {t.titleWritten}
                <span className={styles.note}>{t.titleNote}</span>
              </ins>
            </span>
          </span>
          <span className={`${styles.line} ${styles.second}`} aria-hidden="true">
            {t.titleEnd}
          </span>
        </h1>
        <p className={styles.text}>
          {t.introStart}
          <b>{t.introMarked}</b>
          {t.introEnd}
        </p>
        <div className={styles.buttons}>
          <a className={`${styles.button} ${styles.primary}`} {...EDGE_LINK}>
            {t.signIn}
          </a>
          <a className={`${styles.button} ${styles.outline}`} href="#kako">
            {t.howItWorks}
          </a>
        </div>
      </div>
      <Preview />
    </section>
  );
}
