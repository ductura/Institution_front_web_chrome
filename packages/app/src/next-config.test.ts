import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("next.config (LOK-WEB-6)", () => {
  it("lets next dev serve its scripts and HMR to a page opened on 127.0.0.1", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });

  it("keeps the host under /app/web/", () => {
    expect(nextConfig.basePath).toBe("/app");
    expect(nextConfig.assetPrefix).toBe("/app/web");
  });
});
