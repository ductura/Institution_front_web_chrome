import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr";

import { EDGE_DOWNLOADS_LINK, EDGE_HOME_LINK, EDGE_LINK } from "./edge";
import { Mark } from "./Mark";
import styles from "./SiteHeader.module.css";

const t = messagesHr.landing.header;

const SECTIONS = [
  ["#kako", t.howItWorks],
  ["#nastavnik", t.forTeachers],
  ["#privatnost", t.privacy],
  ["#ustanove", t.forInstitutions],
] as const;

/** The public header: mark and name on the left, the sections and sign-in on the right. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a className={styles.home} {...EDGE_HOME_LINK} aria-label={t.home}>
        <Mark width={32} height={32} />
        {messagesHr.app.name}
      </a>
      <nav className={styles.nav} aria-label={t.nav}>
        {SECTIONS.map(([href, label]) => (
          <a key={href} className={styles.section} href={href}>
            {label}
          </a>
        ))}
        <a className={styles.section} {...EDGE_DOWNLOADS_LINK}>
          {t.app}
        </a>
        <a className={styles.signIn} {...EDGE_LINK}>
          {t.signIn}
        </a>
      </nav>
    </header>
  );
}
