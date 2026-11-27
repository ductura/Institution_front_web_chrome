import { describe, expect, it } from "vitest";

import { config } from "../../middleware";

// Next compiles a matcher of this shape to ^<source>$ (path-to-regexp keeps the
// lookahead group as written), so the test reads it the same way.
function matches(path: string): boolean {
  const [source] = config.matcher;
  return new RegExp(`^${source}$`).test(path);
}

describe("middleware matcher (F4-V18-22-R04-MW)", () => {
  it("leaves the sandboxed code-run frame out, so the page policy cannot block it", () => {
    expect(matches("/code-run/frame.html")).toBe(false);
    expect(matches("/code-run/frame.js")).toBe(false);
    expect(matches("/code-run/nested/file.js")).toBe(false);
  });

  it("keeps the page policy on every other page, including look-alike paths", () => {
    for (const path of ["/", "/prijava", "/rad/1", "/code-run", "/code-runner/x", "/x/code-run/frame.html", "/_next/image", "/nepostojeca"])
      expect(matches(path), path).toBe(true);
  });

  it("keeps the earlier exclusions", () => {
    for (const path of ["/api/v1/x", "/_next/static/a.js", "/favicon.ico"]) expect(matches(path), path).toBe(false);
  });
});
