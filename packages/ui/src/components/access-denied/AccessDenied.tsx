import styles from "./AccessDenied.module.css";

/** What the screen says: no right to the view (403), or no session (401), idle or otherwise. */
export type AccessKind = "denied" | "expired" | "signedOut";

export type AccessDeniedLabels = {
  /** Heading per kind. */
  title: Readonly<Record<AccessKind, string>>;
  /** Body per kind. "denied" must not say whether the thing asked for exists. */
  body: Readonly<Record<AccessKind, string>>;
  /** The sign-in button, shown for "expired" and "signedOut" (AAI@EduHr only, D-09). */
  signIn: string;
  /** Shown under "expired" when unsent input is kept on this device. */
  heldNote: string;
  /** The link home, shown for every kind. */
  home: string;
};

export type AccessDeniedProps = {
  kind: AccessKind;
  labels: AccessDeniedLabels;
  /** Address of the sign-in (from the client's signInHref). */
  signInHref: string;
  homeHref: string;
  /** Whether unsent input is kept on this device; only "expired" mentions it. */
  holdsInput?: boolean;
};

/**
 * "Nema ovlasti" and "sesija je istekla" (M1.8, DAN-378). Pure markup with the
 * app's texts: no request and no read. The "denied" text is the same whatever
 * the resource is, so the screen never tells whether it exists. Sign-in is a
 * plain link to the AAI@EduHr route, never a form.
 */
export function AccessDenied({ kind, labels, signInHref, homeHref, holdsInput = false }: AccessDeniedProps) {
  const offersSignIn = kind !== "denied";
  return (
    <main id="sadrzaj" tabIndex={-1} className={`page ${styles.screen}`} data-access={kind}>
      <h1>{labels.title[kind]}</h1>
      <p role={kind === "denied" ? undefined : "alert"}>{labels.body[kind]}</p>
      {kind === "expired" && holdsInput ? <p className={styles.held}>{labels.heldNote}</p> : null}
      <p className={styles.actions}>
        {offersSignIn ? <a className="btn" href={signInHref}>{labels.signIn}</a> : null}
        <a className={offersSignIn ? `btn ${styles.quiet}` : "btn"} href={homeHref}>{labels.home}</a>
      </p>
    </main>
  );
}
