import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import type { NextConfig } from "next";

// WEB-01 (Ductus#2028 c.7008147932): the Next.js App Router over src/app, on
// :3000 for `pnpm next:dev`. packages/app (the host under /aplikacija/) and
// dev-server.mjs (:5173) stay as they are until the pages replace them.
// src/_cekanje is outside src/app, so it is neither routed nor built.
const root = import.meta.dirname;

export default function config(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    reactStrictMode: true,
    devIndicators: false,
    agentRules: false,
    turbopack: { root },
    outputFileTracingRoot: root,
    // WEB-03: `page.dev.tsx` (the /ui-pregled preview) is a page on `next dev`
    // only; a build reads it as a plain module and gives it no route.
    pageExtensions: phase === PHASE_DEVELOPMENT_SERVER ? ["dev.tsx", "tsx", "ts"] : ["tsx", "ts"],
  };
}
