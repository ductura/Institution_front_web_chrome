// No API call outside the generated client (DAN-752, web 2.c3). Every source
// file that ships to the browser (src, public, packages, catalog, app) is read
// and any network primitive, HTTP library, way around a static name, or API
// URL fails the test, except in src/client/api.ts and the closed list below.
// The gate is the network primitive: a URL without fetch cannot call anything.
// Test files and e2e are not scanned (they drive the app, they are not the app);
// root tooling (dev-server.mjs, playwright.config.js) is not app code.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const SCANNED = ["src", "public", "packages", "catalog", "app"];
const SKIP_DIRS = new Set(["node_modules", "dist", "test-results", "playwright-report", "e2e", ".git"]);
const SOURCE = /\.(?:[cm]?[jt]sx?|html?|svelte|vue)$/;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** The client itself. */
const CLIENT = "src/client/api.ts";
/**
 * Closed list (POTVRDA UGOVORA w752a t. 3). A new entry fails "the exception
 * list is closed" below.
 * - public/app.js: the npm skeleton calls its in-memory /api/documents (not in
 *   the contract) until E-0.3 replaces it.
 * - src/client/evidence-ingest.ts: evidence/open and evidence/commit need the
 *   ductus-protocol header, Origin and the cookie, which the generated client
 *   does not send (ductura/server docs/vs1-rute.md). Ductus's module comes in a
 *   later cut with the domain; README.md records the exception.
 */
export const EXCEPTIONS: Readonly<Record<string, string>> = {
  "public/app.js": "npm skeleton, until E-0.3",
  "src/client/evidence-ingest.ts": "evidence ingest headers, ductura/server docs/vs1-rute.md",
};

const RULES: readonly (readonly [string, RegExp])[] = [
  ["fetch", /\bfetch\b/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["sendBeacon", /\bsendBeacon\b/],
  ["EventSource", /\bEventSource\b/],
  ["WebSocket", /\bWebSocket(?:Stream)?\b/],
  ["WebTransport", /\bWebTransport\b/],
  ["importScripts", /\bimportScripts\b/],
  ["Cache API", /\bcaches\b/],
  ["HTTP library", /["'`](?:axios|ky|got|superagent|undici|node-fetch|cross-fetch|isomorphic-fetch|ofetch|redaxios|wretch|(?:node:)?(?:https?|http2|net|tls))["'`]/],
  ["axios", /\baxios\b/],
  ["computed global", /\b(?:globalThis|window|self|top|parent|frames|document\.defaultView)\s*(?:\?\.)?\s*\[/],
  ["Reflect.get", /\bReflect\s*\.\s*get\b/],
  ["eval", /\beval\s*\(/],
  ["Function constructor", /\bFunction\s*\(/],
  ["API URL", /["'`}]\/api\b|["'`]api\b|\bapi\/v\d/],
];

/** The rules a text breaks. */
export function directCalls(text: string): string[] {
  return RULES.filter(([, rule]) => rule.test(text)).map(([name]) => name);
}

function sources(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : sources(path);
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });
}

describe("no API call outside src/client/api.ts", () => {
  const files = SCANNED.flatMap((dir) => sources(join(ROOT, dir))).map((path) => relative(ROOT, path));

  it("reads the app sources, the client and the skeleton included", () => {
    expect(files).toContain(CLIENT);
    expect(files).toContain("public/app.js");
    expect(files).toContain("src/client/schema-check.ts");
  });

  it("finds no direct call in any other file", () => {
    const found = files
      .filter((file) => file !== CLIENT && !Object.hasOwn(EXCEPTIONS, file))
      .map((file) => [file, directCalls(readFileSync(join(ROOT, file), "utf8"))] as const)
      .filter(([, rules]) => rules.length > 0);
    expect(found).toEqual([]);
  });

  it("the exception list is closed", () => {
    expect(Object.keys(EXCEPTIONS).sort()).toEqual(["public/app.js", "src/client/evidence-ingest.ts"]);
  });

  it("still sees the skeleton's call, so the exception is not stale", () => {
    expect(directCalls(readFileSync(join(ROOT, "public/app.js"), "utf8"))).toContain("fetch");
  });
});

describe("the scan catches the ways around it", () => {
  const caught: readonly string[] = [
    'fetch("/api/v1/health")',
    "await fetch(`${origin}/api/${path}`)",
    "const f = fetch; f(url)",
    "globalThis.fetch(url)",
    'window["fet" + "ch"](url)',
    "globalThis?.[name](url)",
    "Reflect.get(globalThis, name)(url)",
    "const x = new XMLHttpRequest()",
    'import axios from "axios"; axios.get(u)',
    'const { request } = await import("node:https")',
    'import ky from "ky"',
    "navigator.sendBeacon(u, data)",
    "new EventSource(u)",
    "new WebSocket(u)",
    'importScripts("/x.js")',
    "caches.open('c').then((c) => c.add(u))",
    'eval("fet" + "ch")(u)',
    'new Function("return this")()',
    "Function('return fetch')()",
    'location.href = "/api/v1/auth/login"',
    "const u = base + '/api' + rest",
    'const u = ["", "api", "v1"].join("/")',
    '<form action="/api/v1/auth/logout" method="post">',
    'const u = new URL("api/v1/health", base)',
  ];
  for (const text of caught) {
    it(`catches ${text}`, () => {
      expect(directCalls(text)).not.toEqual([]);
    });
  }

  it("lets plain code through", () => {
    expect(directCalls('import { createApi } from "../client/api";\nconst api = createApi();\nawait api("platform.health.get", input);')).toEqual([]);
    expect(directCalls("const prefetched = true; // nothing is fetched here")).toEqual([]);
  });
});
