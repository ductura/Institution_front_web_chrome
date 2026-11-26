import { messagesHr } from "../../lib/i18n/messages.hr";

import { appHref } from "../shell/nav";

import { Mark } from "./Mark";
import styles from "./SiteHeader.module.css";

const t = messagesHr.landing.header;

const SECTIONS = [
  ["#kako", t.howItWorks],
  ["#nastavnik", t.forTeachers],
  ["#privatnost", t.privacy],
  ["#ustanove", t.forInstitutions],
  ["#preuzmi", t.app],
] as const;

/** The public header: mark and name on the left, the sections and sign-in on the right. */
export function SiteHeader({ base }: { base: string }) {
  return (
    <header className={styles.header}>
      <a className={styles.home} href={appHref(base, "/naslovnica")} aria-label={t.home}>
        <Mark width={32} height={32} />
        {messagesHr.app.name}
      </a>
      <nav className={styles.nav} aria-label={t.nav}>
        {SECTIONS.map(([href, label]) => (
          <a key={href} className={styles.section} href={href}>
            {label}
          </a>
        ))}
        <a className={styles.signIn} href={appHref(base, "/prijava")}>
          {t.signIn}
        </a>
      </nav>
    </header>
  );
}
