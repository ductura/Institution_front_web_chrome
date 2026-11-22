"use client";

import AppHeader from "../../../../../src/components/shell/AppHeader";

import { useLocale } from "../../i18n";
import { SignOutDialogButton } from "../SignOut";
import screen from "../../../../../src/components/auth/SignInScreen.module.css";
import own from "./SignIn.module.css";
import type { SignInView } from "./sign-in-view";

/** Official AAI@EduHr help: identity problems belong to the home institution (R-8). */
const AAI_HELP_URL = "https://www.aaiedu.hr/kontakt";

export type SignInScreenProps = {
  view: SignInView;
  /** The login route with a checked returnTo (signInHref). */
  href: string;
  /** The button and "Pokušaj ponovno": the page shows "preusmjeravanje" and leaves for `href`. */
  onStart: () => void;
};

/**
 * E-1 Prijava in the host (paritet 2101), after the prototype's six variants:
 * zadano, pomoc (help open, first details closed), preusmjeravanje (role=status,
 * bar, disabled button), greska (role=alert, "Pokušaj ponovno" and "Na
 * početnu"), nedostupno and bezuloge (role=status, "Odjava" with its dialog).
 * AAI@EduHr is the only way in (D-09): no role picker, e-mail or password
 * field; the button is a link to the login route, so it works without script.
 */
export default function SignInScreen({ view, href, onStart }: SignInScreenProps) {
  const { work, app } = useLocale();
  const p = work.prijava;
  const start = (event: { preventDefault(): void }) => {
    event.preventDefault();
    onStart();
  };
  const notice = view === "signedOut"
    ? { title: work.signInState.signedOutTitle, body: work.signInState.signedOutBody }
    : view === "expired" ? { title: work.access.expiredTitle, body: work.access.expiredBody } : null;

  const home = <a className={own.homeLink} href="/">{work.auth.home}</a>;
  const retry = <a className={screen.button} href={href} onClick={start}>{work.auth.retry}</a>;

  let card;
  if (view === "redirecting") {
    card = (
      <section className={screen.panel} role="status" aria-labelledby="prijava-kartica">
        <h2 id="prijava-kartica" className={screen.panelTitle}>{app.host.signInRedirecting}</h2>
        <div className={own.bar} aria-hidden="true"><span /></div>
        <button type="button" className={`${screen.button} ${own.disabled}`} disabled>
          <span className={screen.aai} aria-hidden="true">aai</span> <span className={screen.buttonLabel}>{p.button}</span>
        </button>
        <p className={screen.note}>{p.passwordNote}</p>
      </section>
    );
  } else if (view === "failed" || view === "unavailable") {
    card = (
      <section className={screen.panel} role="alert" aria-labelledby="prijava-kartica">
        <h2 id="prijava-kartica" className={screen.panelTitle}>{work.auth.failedTitle}</h2>
        <p className={screen.body}>{view === "failed" ? work.auth.failedBody : work.auth.unavailableBody}</p>
        <div className={own.actions}>
          {retry}
          {home}
        </div>
      </section>
    );
  } else if (view === "noRole") {
    card = (
      <section className={screen.panel} role="status" aria-labelledby="prijava-kartica">
        <h2 id="prijava-kartica" className={screen.panelTitle}>{app.host.signInNoRoleTitle}</h2>
        <p className={screen.body}>{app.host.signInNoRoleBody}</p>
        <p className={screen.body}>{p.helpAccessBody}</p>
        <div className={own.actions}>
          <SignOutDialogButton className={own.plain} />
        </div>
      </section>
    );
  } else {
    card = (
      <section className={screen.panel} aria-labelledby="prijava-kartica">
        <p className={screen.eyebrow}>{p.cardEyebrow}</p>
        <h2 id="prijava-kartica" className={screen.panelTitle}>
          {p.cardTitle} <br />
          <em className={screen.accent}>{p.cardTitleAccent}</em>
        </h2>
        <p className={screen.body}>{p.cardBody}</p>
        {notice ? (
          <div className={screen.notice} role="status">
            <strong>{notice.title}</strong> {notice.body}
          </div>
        ) : null}
        <a className={screen.button} href={href} onClick={start}>
          <span className={screen.aai} aria-hidden="true">aai</span> <span className={screen.buttonLabel}>{p.button}</span>{" "}
          <span aria-hidden="true">→</span>
        </a>
        <p className={screen.note}>{p.passwordNote}</p>
        <div className={screen.role}>
          <h3 className={screen.roleTitle}>{p.roleTitle}</h3>
          <p className={screen.small}>{p.roleBody}</p>
        </div>
        <details className={screen.details} open={view !== "help"}>
          <summary>{p.codeSummary}</summary>
          <p className={screen.small}>{p.codeNote}</p>
        </details>
      </section>
    );
  }

  return (
    <div className={screen.screen}>
      <AppHeader
        end={
          <a className={screen.back} href="/">
            <span aria-hidden="true">←</span> {p.back}
          </a>
        }
      />
      <main id="sadrzaj" tabIndex={-1} className={screen.main}>
        <section className={screen.intro} aria-labelledby="prijava-naslov">
          <p className={screen.eyebrow}>{p.eyebrow}</p>
          <h1 id="prijava-naslov" className={screen.title}>
            {p.heading} <br />
            {p.headingMore} <em className={screen.accent}>{p.headingAccent}</em>
          </h1>
          <p className={screen.lead}>
            {p.lead} <br />
            {p.leadMore}
          </p>
          <div className={screen.book} aria-hidden="true">
            <div className={screen.stack}>
              <div className={screen.bookBack} />
              <div className={`sheet ${screen.paper}`} data-sheet-theme="light">
                <div className={screen.paperMeta}>
                  <span>{p.paperMeta}</span> <span>01</span>
                </div>
                <p className={screen.paperTitle}>
                  {p.paperTitle} <br />
                  <em className={screen.accent}>{p.paperTitleAccent}</em>
                </p>
                <div className={screen.inkLines}><i /><i /><i /></div>
                <p className={screen.paperNote}>{p.paperNote}</p>
              </div>
            </div>
            <div className={screen.bookCaption}>
              <span>{p.paperStudent}</span> <span>{p.paperTeacher}</span>
            </div>
          </div>
        </section>
        {card}
      </main>
      <footer className={screen.footer}>
        <p className={screen.footerNote}>{p.footer}</p>
        <details className={screen.help} open={view === "help"}>
          <summary>{p.helpSummary}</summary>
          <div className={screen.helpBody}>
            <h3 className={screen.roleTitle}>{p.helpAaiTitle}</h3>
            <p className={screen.small}>{p.helpAaiBody}</p>
            <a className={screen.link} href={AAI_HELP_URL} rel="noopener noreferrer">{p.helpAaiLink}</a>
            <h3 className={screen.roleTitle}>{p.helpAccessTitle}</h3>
            <p className={screen.small}>{p.helpAccessBody}</p>
          </div>
        </details>
      </footer>
    </div>
  );
}

/** The card of an account signed in through AAI@EduHr that the server answered 403: no role (A-5), outside the shell. */
export function NoRoleScreen() {
  return <SignInScreen view="noRole" href="/" onStart={() => undefined} />;
}
