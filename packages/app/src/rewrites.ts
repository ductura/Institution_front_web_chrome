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
 * Old callers of /api/auth/* (login, callback, logout, logout-all) are sent on to the
 * server's /api/v1/auth/*. A temporary redirect (307) keeps the method, so an old logout
 * form still posts. Only these paths: "/" and the rest of the origin are never touched, the
 * front lives under its basePath only (D-318, KA-07-WEB), and after sign-out the server
 * leads the person back to "/".
 */
export function legacyAuthRedirects(): Redirect[] {
  return [{ source: "/api/auth/:path+", destination: "/api/v1/auth/:path+", basePath: false, permanent: false }];
}
