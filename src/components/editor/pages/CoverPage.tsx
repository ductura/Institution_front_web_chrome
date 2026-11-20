import styles from "./CoverPage.module.css";
import type { Cover } from "./cover";
import { pagesMessages as t } from "./messages.hr";

/** The cover as it appears on the sheet: one centred page, typeface and size from the page format. */
export function CoverPage({ cover }: { cover: Cover }) {
  return (
    <section aria-label="Naslovnica" className={styles.cover}>
      <p>{cover.university}<br />{cover.unit}{cover.study && <><br />{cover.study}</>}</p>
      <div>
        <p>{cover.student}</p>
        <h1>{cover.title}</h1>
        <p>{cover.kind}</p>
        {cover.mentor && <p>{t.mentorLabel} {cover.mentor}</p>}
      </div>
      <p>{cover.place}, {cover.date}</p>
    </section>
  );
}
