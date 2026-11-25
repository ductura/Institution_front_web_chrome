import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-V21-KOD-POKRETANJE: the host reaches the server only through createApi (port.ts); the runner and the frame
// page hold no network primitive and no API URL. The frame page is checked as text too, apart from the one place
// where it removes those globals from the Worker.
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\baxios\b|["'`]\/?api\/|<form\b[^>]*\baction\s*=/;

describe("no direct API in the code runner", () => {
  it("source files hold no network primitive and no API URL", () => {
    const files = readdirSync(import.meta.dirname).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThan(4);
    for (const f of files) expect({ f, hit: FORBIDDEN.test(readFileSync(join(import.meta.dirname, f), "utf8")) }).toEqual({ f, hit: false });
  });
  it("the frame page never calls a network primitive", () => {
    const frame = readFileSync(join(import.meta.dirname, "../../../../public/code-run/frame.js"), "utf8");
    expect(/\bfetch\s*\(|new\s+XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon|importScripts\s*\(/.test(frame)).toBe(false);
    expect(frame).toContain("Object.defineProperty(self, n");
  });
});
