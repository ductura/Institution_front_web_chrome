"use client";

import { useLocale } from "../../i18n";
import { SignOutDialogButton } from "../SignOut";
import own from "./SignIn.module.css";
import type { SignInView } from "./sign-in-view";
import { signInTextFor } from "./text";

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
 *
 * The look (owner decision 25 Nov 2026): the screen only signs in, apart from
 * the public landing page. One column, one heading (#prijava-kartica keeps the
 * screen dark), the landing page's gold Prijava with AAI@EduHr in a capsule,
 * and the two questions as plain rows below it.
 */
export default function SignInScreen({ view, href, onStart }: SignInScreenProps) {
  const { t, work, app, locale } = useLocale();
  const p = work.prijava;
  const extra = signInTextFor(locale);
  const start = (event: { preventDefault(): void }) => {
    event.preventDefault();
    onStart();
  };
  const notice = view === "signedOut"
    ? { title: work.signInState.signedOutTitle, body: work.signInState.signedOutBody }
    : view === "expired" ? { title: work.access.expiredTitle, body: work.access.expiredBody } : null;

  const home = <a className={own.quiet} href="/">{work.auth.home}</a>;
  const retry = <a className={own.primary} href={href} onClick={start}>{work.auth.retry}</a>;
  // The visible label is "Prijava" with AAI@EduHr in its capsule; the name a
  // screen reader hears is the catalogue's "Prijava sustavom AAI@EduHr", which
  // starts with the visible word (label in name).
  const signInLabel = (
    <>
      {p.title} <span className={own.aai}>AAI@EduHr</span>
    </>
  );
  /** "Trebate pomoć?": AAI@EduHr's own help, and whom to ask about access. */
  const help = (
    <details className={own.details} open={view === "help"}>
      <summary>{p.helpSummary}</summary>
      <div className={own.detailsBody}>
        <h2>{p.helpAaiTitle}</h2>
        <p className={own.small}>{p.helpAaiBody}</p>
        <a className={own.link} href={AAI_HELP_URL} rel="noopener noreferrer">{p.helpAaiLink}</a>
        <h2>{p.helpAccessTitle}</h2>
        <p className={own.small}>{extra.helpAccessBody}</p>
      </div>
    </details>
  );

  let content;
  if (view === "redirecting") {
    content = (
      <section className={own.stack} role="status" aria-labelledby="prijava-kartica">
        <h1 id="prijava-kartica" className={own.title}>{app.host.signInRedirecting}</h1>
        <div className={own.bar} aria-hidden="true"><span /></div>
        <div className={own.actions}>
          <button type="button" className={`${own.primary} ${own.busy}`} disabled aria-label={p.button}>{signInLabel}</button>
        </div>
        <p className={own.note}>{p.passwordNote}</p>
      </section>
    );
  } else if (view === "refused") {
    // P-15: a refusal is not a fault of the sign-in, so there is no "Pokušaj ponovno".
    content = (
      <section className={own.stack} role="alert" aria-labelledby="prijava-kartica">
        <h1 id="prijava-kartica" className={own.title}>{extra.refusedTitle}</h1>
        <p className={own.body}>{extra.refusedBody}</p>
        <p className={own.body}>{extra.refusedContact}</p>
        <div className={own.actions}>{home}</div>
      </section>
    );
  } else if (view === "failed" || view === "unavailable") {
    content = (
      <section className={own.stack} role="alert" aria-labelledby="prijava-kartica">
        <h1 id="prijava-kartica" className={own.title}>{view === "failed" ? work.auth.failedTitle : extra.unavailableTitle}</h1>
        <p className={own.body}>{view === "failed" ? work.auth.failedBody : work.auth.unavailableBody}</p>
        <div className={own.actions}>
          {retry}
          {home}
        </div>
      </section>
    );
  } else if (view === "noRole") {
    content = (
      <section className={own.stack} role="status" aria-labelledby="prijava-kartica">
        <h1 id="prijava-kartica" className={own.title}>{app.host.signInNoRoleTitle}</h1>
        <p className={own.body}>{app.host.signInNoRoleBody} {extra.noRoleWho}</p>
        <p className={own.body}>{extra.noRoleContact}</p>
        <div className={own.actions}>
          <SignOutDialogButton className={own.glass} />
        </div>
      </section>
    );
  } else {
    content = (
      <section className={own.stack} aria-labelledby="prijava-kartica">
        <h1 id="prijava-kartica" className={own.title}>{p.title}</h1>
        {notice ? (
          <p className={own.notice} role="status">
            <strong>{notice.title}</strong> {notice.body}
          </p>
        ) : null}
        <p className={own.body}>{p.cardBody}</p>
        <div className={own.actions}>
          <a className={own.primary} href={href} onClick={start} aria-label={p.button}>{signInLabel}</a>
        </div>
        <p className={own.note}>{p.passwordNote}</p>
        <div className={own.more}>
          <details className={own.details} open={view !== "help"}>
            <summary>{p.codeSummary}</summary>
            <div className={own.detailsBody}>
              <p className={own.small}>{p.codeNote}</p>
              <p className={own.small}>{p.roleBody}</p>
            </div>
          </details>
          {help}
        </div>
      </section>
    );
  }

  return (
    <div className={own.screen}>
      {/* The landing page's ground: three slow lights and faint lines, the same on every part of the page. */}
      <div className={own.backdrop} aria-hidden="true"><i /><i /><i /></div>
      <header className={own.top}>
        <a className={own.brand} href="/">{t.app.name}</a>
        <a className={own.back} href="/">
          <span aria-hidden="true">←</span> {p.back}
        </a>
      </header>
      <main id="sadrzaj" tabIndex={-1} className={own.main}>
        <div className={own.column}>
          {content}
          {/* Outside the alert or status, so a screen reader does not read the help with it. */}
          {view === "refused" || view === "failed" || view === "unavailable" || view === "noRole"
            ? <div className={own.more}>{help}</div>
            : null}
        </div>
      </main>
    </div>
  );
}

/** The card of an account signed in through AAI@EduHr that the server answered 403: no role (A-5), outside the shell. */
export function NoRoleScreen() {
  return <SignInScreen view="noRole" href="/" onStart={() => undefined} />;
}
