import { describe, expect, it } from "vitest";
import { detectCapabilities, type PlatformEnv } from "./capabilities.ts";

const throwing = (): never => {
  throw new Error("probe failed");
};

function execDocument(supported = true): NonNullable<PlatformEnv["document"]> {
  return {
    createElement: () => ({ value: "", select() {} }),
    body: { appendChild: (n) => n, removeChild: (n) => n },
    execCommand: () => true,
    queryCommandSupported: () => supported,
  };
}

describe("detectCapabilities", () => {
  it("reports every capability a full browser has", () => {
    const env: PlatformEnv = {
      navigator: { clipboard: { writeText: async () => {} }, permissions: { query: async () => ({ state: "granted" }) } },
      document: execDocument(),
      indexedDB: {},
      matchMedia: (q) => ({ matches: q === "(pointer: coarse)" }),
    };
    expect(detectCapabilities(env)).toEqual({ clipboard: "async", permissions: true, storage: "indexeddb", pointer: "coarse" });
  });

  it("falls back to the copy command when the Clipboard API is missing", () => {
    expect(detectCapabilities({ navigator: {}, document: execDocument() }).clipboard).toBe("exec-command");
  });

  it("reports no clipboard when the copy command is unsupported or there is no body", () => {
    expect(detectCapabilities({ document: execDocument(false) }).clipboard).toBe("none");
    expect(detectCapabilities({ document: { ...execDocument(), body: null } }).clipboard).toBe("none");
  });

  it("gives the fallback of every capability in an empty environment", () => {
    expect(detectCapabilities({})).toEqual({ clipboard: "none", permissions: false, storage: "none", pointer: "fine" });
  });

  it("gives the fallback, not an exception, when a probe throws", () => {
    const env = {
      get navigator(): never {
        return throwing();
      },
      get indexedDB(): never {
        return throwing();
      },
      document: { ...execDocument(), queryCommandSupported: throwing },
      matchMedia: throwing,
    } as PlatformEnv;
    expect(detectCapabilities(env)).toEqual({ clipboard: "none", permissions: false, storage: "none", pointer: "fine" });
  });

  it("treats a null indexedDB as missing", () => {
    expect(detectCapabilities({ indexedDB: null }).storage).toBe("none");
  });
});
