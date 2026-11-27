import { DEFAULT_INTERFACE_LOCALE, messagesFor, type InterfaceLocale } from "../../../../../../src/lib/i18n/locale";

import { EDGE_DOWNLOADS_LINK, EDGE_FOOTER, EDGE_HOME_LINK, EDGE_LINK, edgeLink } from "./edge";
import s from "./Download.module.css";
import h from "./Hero.module.css";
import { Mark } from "./Mark";

type Props = { locale?: InterfaceLocale };

/** "Ductura za računalo" of koncepti/naslovnica (DAN-1520): the desktop app, or the browser without installing. */
export function Download({ locale = DEFAULT_INTERFACE_LOCALE }: Props) {
  const t = messagesFor(locale).landing.download;
  return (
    <section className={s.download} id="preuzmi" aria-labelledby="pr">
      <div className={s.content}>
        <div className={s.mark} aria-hidden="true">
          <Mark />
        </div>
        <h2 id="pr">{t.title}</h2>
        <p>{t.body}</p>
        <div className={`${h.buttons} ${s.buttons}`}>
          <a className={`${h.button} ${h.primary}`} {...EDGE_DOWNLOADS_LINK}>
            {t.windows}
          </a>
          <a className={`${h.button} ${h.outline}`} {...EDGE_DOWNLOADS_LINK}>
            {t.macos}
          </a>
        </div>
        <p className={s.small}>
          {t.orStart}
          <a {...EDGE_LINK}>{t.orLink}</a>
        </p>
      </div>
    </section>
  );
}

/** The footer of the home page: the mark with the year, and the links. */
export function SiteFooter({ locale = DEFAULT_INTERFACE_LOCALE }: Props) {
  const m = messagesFor(locale);
  const t = m.landing.footer;
  const links = [
    [EDGE_FOOTER.help, t.help],
    [EDGE_FOOTER.contact, t.contact],
    [EDGE_FOOTER.privacy, t.privacy],
    [EDGE_FOOTER.terms, t.terms],
    [EDGE_FOOTER.accessibility, t.accessibility],
    [EDGE_FOOTER.status, t.status],
  ] as const;
  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <a className={s.home} {...EDGE_HOME_LINK}>
          <Mark width={26} height={26} />
          {m.app.name}
          <small>{t.year}</small>
        </a>
        <nav className={s.links} aria-label={t.nav}>
          {links.map(([href, label]) => (
            <a key={label} {...edgeLink(href)}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
