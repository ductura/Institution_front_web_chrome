import type { Messages } from "../../../../../../locales/hr.ts";

import { SHOTS, shotSrc } from "./demo-link";
import styles from "./about.module.css";

type Props = { t: Messages["landing"]; signInHref: string; demoUrl: string | null };

/**
 * DEMO-1: what the app is, whom it is for, how it looks (screenshots of
 * invented data) and, when the build has one, the way to the demo. Public,
 * outside the shell; it reads no session and no data.
 */
export function AboutView({ t, signInHref, demoUrl }: Props) {
  const d = t.demo;
  return (
    <main id="sadrzaj" tabIndex={-1} className={`page ${styles.about}`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h1>{t.title} {t.titleAccent}</h1>
        <p>{t.intro}</p>
      </header>

      <section aria-labelledby="o-aplikaciji-za-koga">
        <h2 id="o-aplikaciji-za-koga">{t.forWhomTitle}</h2>
        <p>{t.forWhomLead}</p>
        <div className={styles.roles}>
          <div>
            <h3>{t.studentEyebrow}</h3>
            <p>{t.studentBody}</p>
            <ul>{Object.values(t.studentPoints).map((point) => <li key={point}>{point}</li>)}</ul>
          </div>
          <div>
            <h3>{t.teacherEyebrow}</h3>
            <p>{t.teacherBody}</p>
            <ul>{Object.values(t.teacherPoints).map((point) => <li key={point}>{point}</li>)}</ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="o-aplikaciji-izgled">
        <h2 id="o-aplikaciji-izgled">{d.screensTitle}</h2>
        <p>{d.screensLead}</p>
        <ul className={styles.shots}>
          {SHOTS.map((shot) => (
            <li key={shot}>
              <figure>
                <img src={shotSrc(shot)} alt={d.shots[shot]} width={1280} height={800} loading="lazy" />
                <figcaption>{d.shots[shot]}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      {demoUrl !== null && (
        <section aria-labelledby="o-aplikaciji-demo">
          <h2 id="o-aplikaciji-demo">{d.tryTitle}</h2>
          <p>{d.tryBody}</p>
          <p><a className={styles.button} href={demoUrl}>{d.tryButton}</a></p>
        </section>
      )}

      <section aria-labelledby="o-aplikaciji-prijava">
        <h2 id="o-aplikaciji-prijava">{d.signInTitle}</h2>
        <p>{t.aaiOnly}</p>
        <p><a href={signInHref}>{t.enter}</a></p>
      </section>
    </main>
  );
}
