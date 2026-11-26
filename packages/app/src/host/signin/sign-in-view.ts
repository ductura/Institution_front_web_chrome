// E-1 (INVENTAR-student, paritet 2101): the states of /prijava in the host and
// the reading of the query that asks for one.

/**
 * The variants of E-1 (zadano, preusmjeravanje, greska, nedostupno, bezuloge, pomoc,
 * and odbijeno of P-15) and the two notices of A-1/A-6.
 */
export type SignInView = "signIn" | "help" | "signedOut" | "expired" | "redirecting" | "failed" | "unavailable" | "refused" | "noRole";

/** The `stanje` query /prijava understands, as in the Ductus tree. */
const STANJE: Readonly<Record<string, SignInView>> = {
  odjava: "signedOut",
  istekla: "expired",
  greska: "failed",
  nedostupno: "unavailable",
  bezuloge: "noRole",
  odbijeno: "refused",
  pomoc: "help",
};

/** The `greska` codes of the institution server's login route (INVENTAR PO-2; login_refused is the callback's 403, P-15). */
const GRESKA: Readonly<Record<string, SignInView>> = {
  login_failed: "failed",
  provider_unavailable: "unavailable",
  login_refused: "refused",
};

/** The view the query asks for: a server error code wins over `stanje`; anything else is the plain sign-in. */
export function signInViewOf(query: { get(name: string): string | null }): SignInView {
  const code = query.get("greska");
  if (code !== null && Object.hasOwn(GRESKA, code)) return GRESKA[code]!;
  const asked = query.get("stanje");
  if (asked !== null && Object.hasOwn(STANJE, asked)) return STANJE[asked]!;
  return "signIn";
}

/** A footer link of the sign-in screen; `href` null is a page that does not exist yet (shown as plain text). */
export type FooterLink = { readonly key: "help" | "contact" | "privacy" | "terms" | "accessibility" | "status"; readonly href: string | null };

/**
 * The six links of the footer (KA-05-WEB, concept koncepti/prijava): Pomoć opens the help of this
 * screen, Privatnost the landing page's section, Pristupačnost and Stanje the public pages.
 * Kontakt and Uvjeti have no page yet, so they carry no href.
 */
export function footerLinks(href: (path: string) => string): FooterLink[] {
  return [
    { key: "help", href: href("/prijava?stanje=pomoc") },
    { key: "contact", href: null },
    { key: "privacy", href: "/#privatnost" },
    { key: "terms", href: null },
    { key: "accessibility", href: href("/pristupacnost") },
    { key: "status", href: href("/stanje") },
  ];
}

/** Where a visitor who already has a session goes instead of the sign-in screen. */
export function skipTarget(session: { readonly kind: string }, home: string): string | null {
  return session.kind === "signedIn" ? home : null;
}
