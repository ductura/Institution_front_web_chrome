import { DEFAULT_INTERFACE_LOCALE, messagesFor, type InterfaceLocale } from "../../../../../../src/lib/i18n/locale";

import { appHref } from "../../../../../../src/components/shell/nav";

import { EDGE_LINK } from "./edge";
import s from "./Download.module.css";
import h from "./Hero.module.css";
import { Mark } from "./Mark";

type Props = { base: string; locale?: InterfaceLocale };

/** "Ductura za računalo" of koncepti/naslovnica (DAN-1520): the desktop app, or the browser without installing. */
export function Download({ base, locale = DEFAULT_INTERFACE_LOCALE }: Props) {
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
          <a className={`${h.button} ${h.primary}`} href="#">
            {t.windows}
          </a>
          <a className={`${h.button} ${h.outline}`} href="#">
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
export function SiteFooter({ base, locale = DEFAULT_INTERFACE_LOCALE }: Props) {
  const m = messagesFor(locale);
  const t = m.landing.footer;
  const links = [
    ["#", t.help],
    ["#", t.contact],
    ["#privatnost", t.privacy],
    ["#", t.terms],
    ["#", t.accessibility],
    ["#", t.status],
  ] as const;
  return (
    <footer className={s.footer}>
      <div className={s.inner}>
        <a className={s.home} href={appHref(base, "/naslovnica")}>
          <Mark width={26} height={26} />
          {m.app.name}
          <small>{t.year}</small>
        </a>
        <nav className={s.links} aria-label={t.nav}>
          {links.map(([href, label]) => (
            <a key={label} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
