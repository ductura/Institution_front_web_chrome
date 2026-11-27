// What this host passes on to the institution server. Behind the edge neither path
// reaches the app; on `next dev`, `next start` and Vercel the rules below apply.

export const DEFAULT_INSTITUTION_SERVER = "http://127.0.0.1:4000";

export interface Rewrite {
  source: string;
  destination: string;
  basePath: false;
}

/** The server URL from INSTITUTION_SERVER_URL, without a trailing slash. */
export function institutionServerUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  return (trimmed === undefined || trimmed === "" ? DEFAULT_INSTITUTION_SERVER : trimmed).replace(/\/+$/, "");
}

/**
 * The API always goes to the server. Outside production the fake server's role
 * switch does too: its login answers with a relative /__lazni/uloga, so without
 * this rule a local sign-in through the front ends on a 404. A production build
 * has no such route.
 */
export function institutionRewrites(server: string, nodeEnv: string | undefined): Rewrite[] {
  const rules: Rewrite[] = [{ source: "/api/v1/:path*", destination: `${server}/api/v1/:path*`, basePath: false }];
  if (nodeEnv !== "production")
    rules.push({ source: "/__lazni/:path*", destination: `${server}/__lazni/:path*`, basePath: false });
  return rules;
}

export interface Redirect {
  source: string;
  destination: string;
  basePath: false;
  permanent: false;
}

/**
 * F4-STU-R01: the server's failed or refused sign-in returns to /prijava?greska=<code> at the root
 * (login_refused, login_failed, provider_unavailable), but the app has only /aplikacija/prijava.
 * This sends the root path there, and Next carries the whole query (greska, returnTo) over. Not
 * permanent: the answer depends on the code and must not be cached by the browser.
 */
export function institutionRedirects(): Redirect[] {
  return [{ source: "/prijava", destination: "/aplikacija/prijava", basePath: false, permanent: false }];
}
