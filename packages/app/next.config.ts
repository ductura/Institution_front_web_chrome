import path from "node:path";

import type { NextConfig } from "next";

import { institutionRewrites, institutionServerUrl } from "./src/rewrites.ts";

// The institution front under /app/web/ and /app/chrome/ (#2028 c.6993786629
// §1): basePath "/app" and the segment app/[base]/ (web or chrome). The edge
// routes only those two prefixes here, so the build's own files are asked for
// under /app/web/_next/ (assetPrefix) and Next serves them from there.
const root = path.join(import.meta.dirname, "../..");

// The API path belongs to the institution server. Behind the edge it never reaches
// this app; on `next dev`, `next start` and Vercel it is passed on to
// INSTITUTION_SERVER_URL, read when the app is built (src/rewrites.ts).
const institutionServer = institutionServerUrl(process.env.INSTITUTION_SERVER_URL);

const nextConfig: NextConfig = {
  basePath: "/app",
  assetPrefix: "/app/web",
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  agentRules: false,
  // /app/web/ is where sign-in returns (§3); the host reads both forms of a
  // path, so neither is redirected to the other.
  skipTrailingSlashRedirect: true,
  // LOK-WEB-6: `next dev` serves its own scripts and HMR only to localhost, so a
  // page opened on 127.0.0.1 hung on "Učitavanje". Development only; a build
  // ignores it.
  allowedDevOrigins: ["127.0.0.1"],
  // The screens, locales and the client are imported from the workspace root.
  turbopack: { root },
  outputFileTracingRoot: root,
  async rewrites() {
    return institutionRewrites(institutionServer, process.env.NODE_ENV);
  },
};

export default nextConfig;
