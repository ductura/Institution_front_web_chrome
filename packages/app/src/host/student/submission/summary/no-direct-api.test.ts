import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-2108: step 3 reaches the server only through the shared client, never a network primitive of its own.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=/;

describe("no direct API in WEB-2108 modules", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) expect({ f, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, f), "utf8")) }).toEqual({ f, hit: false });
  });

  // WEB-1305: the summary's event marks go through src/client/event-disputes.ts and nothing else.
  it("names no event-disputes route of its own and reads the marks only through the client's port", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    for (const f of files) expect({ f, hit: /work\.event-disputes|event-disputes["'`]/.test(readFileSync(join(import.meta.dirname, f), "utf8")) }).toEqual({ f, hit: false });
    const step = readFileSync(join(import.meta.dirname, "BeforeSubmitStep.tsx"), "utf8");
    expect(step).toMatch(/import \{ createEventDisputes \} from "[./]+\/src\/client\/event-disputes\.ts";/);
  });

  // PIL-K-IZJAVA-VRATA: whether the student may go on is the server's answer, never this browser's.
  it("decides on the declaration only from the server, never from sessionStorage or ?izjava=", () => {
    const BROWSER_DECLARATION = /sessionStorage|predaja\/Declaration|useSessionTag|confirmationKey|DECLARED_PARAM|isDeclared|[?&]izjava=/;
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.fixture\.ts$/.test(f));
    for (const f of files) expect({ f, hit: BROWSER_DECLARATION.test(readFileSync(join(import.meta.dirname, f), "utf8")) }).toEqual({ f, hit: false });
    const step = readFileSync(join(import.meta.dirname, "BeforeSubmitStep.tsx"), "utf8");
    expect(step).toMatch(/import \{ opensSending, serverGate, useDeclarationGate, type GateRead \} from "\.\/declaration-gate";/);
  });
});
