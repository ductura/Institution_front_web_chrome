import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-2109, PIL-K-IZJAVA-VRATA: step 4 reaches the server only through the shared client, and the
// declaration's gate only through student.declaration.get (summary/declaration-gate.ts).
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=/;
const BROWSER_DECLARATION = /sessionStorage|predaja\/Declaration|useSessionTag|confirmationKey|DECLARED_PARAM|isDeclared|[?&]izjava=/;
const sources = (dir: string) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.fixture\.ts$/.test(f));

describe("no direct API in step 4 (WEB-2109)", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = sources(import.meta.dirname);
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files) expect({ f, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, f), "utf8")) }).toEqual({ f, hit: false });
  });

  it("decides on the declaration only from the server, never from this browser", () => {
    for (const f of sources(import.meta.dirname)) {
      expect({ f, hit: BROWSER_DECLARATION.test(readFileSync(join(import.meta.dirname, f), "utf8")) }).toEqual({ f, hit: false });
    }
    const step = readFileSync(join(import.meta.dirname, "SubmitStep.tsx"), "utf8");
    expect(step).toMatch(/import \{ opensSending, serverGate, useDeclarationGate, type GateRead \} from "\.\.\/summary\/declaration-gate";/);
    const gate = readFileSync(join(import.meta.dirname, "../summary/declaration-gate.ts"), "utf8");
    expect(gate).toMatch(/import \{ readDeclarationGate, type DeclarationGate \} from "[./]+\/src\/client\/declaration\.ts";/);
    expect(gate).toMatch(/import \{ createApi \} from "[./]+\/src\/client\/api\.ts";/);
  });
});
