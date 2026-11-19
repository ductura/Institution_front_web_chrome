import { messagesHr as t } from "../lib/i18n/messages.hr";

// WEB-01: the public home for a visitor, with no read of the session. The
// signed-in home and the way to sign in come with WEB-02 and WEB-08; the
// earlier page that read the database is in src/_cekanje/app/page.tsx.
export default function HomePage() {
  return (
    <main id="sadrzaj" className="page">
      <p>{t.landing.eyebrow}</p>
      <h1>
        {t.landing.title} {t.landing.titleAccent}
      </h1>
      <p>{t.landing.intro}</p>
      <p>{t.landing.aaiOnly}</p>
    </main>
  );
}
