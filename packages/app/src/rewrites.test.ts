import { describe, expect, it } from "vitest";

import {
  DEFAULT_INSTITUTION_SERVER,
  institutionRedirects,
  institutionRewrites,
  institutionServerUrl,
  legacyAuthRedirects,
} from "./rewrites";

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

describe("legacyAuthRedirects", () => {
  const [rule] = legacyAuthRedirects();
  const match = (path: string): string | null => {
    const m = new RegExp(`^${rule!.source.replace(":path+", "(.+)")}$`).exec(path);
    return m === null ? null : rule!.destination.replace(":path+", m[1]!);
  };

  it("sends old /api/auth/* calls on to /api/v1/auth/*, keeping the method (307)", () => {
    expect(rule).toMatchObject({ basePath: false, permanent: false });
    for (const name of ["login", "callback", "logout", "logout-all"])
      expect(match(`/api/auth/${name}`)).toBe(`/api/v1/auth/${name}`);
  });

  it("leaves / and the rest of the origin alone", () => {
    for (const path of ["/", "/aplikacija", "/api/auth", "/api/v1/auth/logout", "/api/authx/login", "/prijava"])
      expect(match(path)).toBeNull();
    expect(institutionRewrites(SERVER, "development").some((r) => r.source === "/" || r.source === "/:path*")).toBe(false);
  });
});

describe("institutionRedirects (F4-STU-R01)", () => {
  it("sends the root /prijava of the server's failed sign-in to the app's own /prijava, not permanently", () => {
    expect(institutionRedirects()).toEqual([
      { source: "/prijava", destination: "/aplikacija/prijava", basePath: false, permanent: false },
    ]);
  });
});
