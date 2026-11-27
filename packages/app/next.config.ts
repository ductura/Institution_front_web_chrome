import path from "node:path";

import type { NextConfig } from "next";

import { BASE_PATH } from "./src/bases.ts";
import { institutionRewrites, institutionServerUrl } from "./src/rewrites.ts";

// The institution front under /aplikacija/ (D-318, DAN-1574): basePath
// "/aplikacija", the pages in the route group app/(host)/. The edge routes
// only that prefix here, so the build's own files are asked for under
// /aplikacija/_next/ and Next serves them from there.
const root = path.join(import.meta.dirname, "../..");

// The API path belongs to the institution server. Behind the edge it never reaches
// this app; on `next dev`, `next start` and Vercel it is passed on to
// INSTITUTION_SERVER_URL, read when the app is built (src/rewrites.ts).
const institutionServer = institutionServerUrl(process.env.INSTITUTION_SERVER_URL);

// PL-CSP-OKVIR (V21-14): the sandboxed code-run frame (public/code-run/) refuses to run code unless its own
// page carries this policy (frame.js "fails closed"). No script from elsewhere, no network (no connect-src), a
// Worker only from blob:, and only this origin may embed it. Source paths are relative to basePath "/aplikacija".
export const CODE_RUN_FRAME_CSP = "default-src 'none'; script-src 'self'; worker-src blob:; frame-ancestors 'self'";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  agentRules: false,
  // No skipTrailingSlashRedirect: with it Next answers "/aplikacija/" with an empty
  // page (no route for the bare base with a slash); "/aplikacija/" now leads to "/aplikacija".
  // LOK-WEB-6: `next dev` serves its own scripts and HMR only to localhost, so a
  // page opened on 127.0.0.1 hung on "Učitavanje". Development only; a build
  // ignores it.
  allowedDevOrigins: ["127.0.0.1"],
  // The screens, locales and the client are imported from the workspace root.
  turbopack: { root },
  outputFileTracingRoot: root,
  async headers() {
    return [{ source: "/code-run/:path*", headers: [{ key: "Content-Security-Policy", value: CODE_RUN_FRAME_CSP }] }];
  },
  async rewrites() {
    return institutionRewrites(institutionServer, process.env.NODE_ENV);
  },
};

export default nextConfig;
