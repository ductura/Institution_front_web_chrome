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
