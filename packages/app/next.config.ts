import path from "node:path";

import type { NextConfig } from "next";

// The institution front under /app/web/ and /app/chrome/ (#2028 c.6993786629
// §1): basePath "/app" and the segment app/[base]/ (web or chrome). The edge
// routes only those two prefixes here, so the build's own files are asked for
// under /app/web/_next/ (assetPrefix) and Next serves them from there.
const root = path.join(import.meta.dirname, "../..");

// /api/v1 belongs to the institution server. Behind the edge it never reaches
// this app; on `next dev`, `next start` and Vercel it is passed on to
// INSTITUTION_SERVER_URL, read when the app is built.
const institutionServer = (process.env.INSTITUTION_SERVER_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");

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
  // The screens, locales and the client are imported from the workspace root.
  turbopack: { root },
  outputFileTracingRoot: root,
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${institutionServer}/api/v1/:path*`, basePath: false }];
  },
};

export default nextConfig;
