import type { NextConfig } from "next";

// WEB-01 (Ductus#2028 c.7008147932): the Next.js App Router over src/app, on
// :3000 for `pnpm next:dev`. packages/app (the host under /app/web/) and
// dev-server.mjs (:5173) stay as they are until the pages replace them.
// src/_cekanje is outside src/app, so it is neither routed nor built.
const root = import.meta.dirname;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  agentRules: false,
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
