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
