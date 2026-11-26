import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig, { CODE_RUN_FRAME_CSP } from "../next.config";

describe("next.config (LOK-WEB-6)", () => {
  it("lets next dev serve its scripts and HMR to a page opened on 127.0.0.1", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });

  it("keeps the host under /app/web/", () => {
    expect(nextConfig.basePath).toBe("/app");
    expect(nextConfig.assetPrefix).toBe("/app/web");
  });

  it("redirects the root /prijava to the app's, so the server's greska codes land on E-1 (F4-STU-R01)", async () => {
    expect(await nextConfig.redirects?.()).toContainEqual(
      expect.objectContaining({ source: "/prijava", destination: "/app/web/prijava", basePath: false }),
    );
  });

  it("sends the frame's CSP on every code-run page and on nothing else (PL-CSP-OKVIR)", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/code-run/:path*", headers: [{ key: "Content-Security-Policy", value: CODE_RUN_FRAME_CSP }] }]);
    expect(rules.some((rule) => (rule as { basePath?: unknown }).basePath === false)).toBe(false);
    for (const part of ["default-src 'none'", "script-src 'self'", "worker-src blob:", "frame-ancestors 'self'"])
      expect(CODE_RUN_FRAME_CSP).toContain(part);
    expect(CODE_RUN_FRAME_CSP).not.toMatch(/connect-src|unsafe-eval|unsafe-inline/);
  });

  it("matches the policy the frame e2e simulates", () => {
    const spec = readFileSync(join(import.meta.dirname, "../e2e/code-run-frame.spec.ts"), "utf8");
    expect(spec).toContain(`const FRAME_CSP = "${CODE_RUN_FRAME_CSP}"`);
  });
});
