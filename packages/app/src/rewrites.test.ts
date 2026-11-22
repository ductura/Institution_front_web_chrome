import { describe, expect, it } from "vitest";

import { DEFAULT_INSTITUTION_SERVER, institutionRewrites, institutionServerUrl } from "./rewrites";

const SERVER = "http://127.0.0.1:4010";

describe("institutionServerUrl", () => {
  it("falls back to the default server and drops trailing slashes", () => {
    expect(institutionServerUrl(undefined)).toBe(DEFAULT_INSTITUTION_SERVER);
    expect(institutionServerUrl("  ")).toBe(DEFAULT_INSTITUTION_SERVER);
    expect(institutionServerUrl("http://127.0.0.1:4010//")).toBe(SERVER);
  });
});

describe("institutionRewrites", () => {
  it("passes the API on to the server in every mode", () => {
    for (const env of ["development", "production", undefined]) {
      expect(institutionRewrites(SERVER, env)).toContainEqual({
        source: "/api/v1/:path*",
        destination: `${SERVER}/api/v1/:path*`,
        basePath: false,
      });
    }
  });

  it("passes the fake server's role switch on outside production, so a local sign-in completes", () => {
    for (const env of ["development", "test", undefined]) {
      expect(institutionRewrites(SERVER, env)).toContainEqual({
        source: "/__lazni/:path*",
        destination: `${SERVER}/__lazni/:path*`,
        basePath: false,
      });
    }
  });

  it("has no role switch route in a production build", () => {
    const sources = institutionRewrites(SERVER, "production").map((rule) => rule.source);
    expect(sources).toEqual(["/api/v1/:path*"]);
  });
});
