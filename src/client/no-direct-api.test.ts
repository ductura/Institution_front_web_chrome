// No API call outside the generated client (DAN-752, web 2.c3). Every source
// file that ships to the browser (src, public, packages, catalog, app) is read
// and any network primitive, request-making element, HTTP library, way around
// a static name, or API URL fails the test, except in src/client/api.ts and
// the closed list below. Text is normalised first (escapes and HTML entities
// decoded, comments dropped, adjacent string pieces joined), and a bare import
// must be on an allowlist, so an unlisted library cannot bring its own fetch.
// Known limit: this is a text scan, not an AST lint (the web has no ESLint yet);
// review still reads new code. Test files and catalog/e2e (and the same in a
// package) are not scanned, and no app file may import a test file.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const SCANNED = ["src", "public", "packages", "catalog", "app"];
/** Skipped by name at any depth (installed or built output). */
const SKIP_ANYWHERE = new Set(["node_modules", ".git"]);
/** Skipped only directly under catalog/ or packages/<name>/ (their own e2e and build output). */
const SKIP_TOP = new Set(["e2e", "dist", "test-results", "playwright-report"]);
const SOURCE = /\.(?:[cm]?[jt]sx?|html?|xhtml|svg|css|svelte|vue)$/;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const CONFIG = /^(?:catalog|packages\/[^/]+)\/(?:vite|vitest|playwright)\.config\.[cm]?[jt]s$/;

/** The client itself. */
const CLIENT = "src/client/api.ts";
/**
 * Closed list (POTVRDA UGOVORA w752a t. 3); a new entry fails "the exception
 * list is closed". public/app.js: the npm skeleton calls its in-memory
 * /api/documents (not in the contract) until E-0.3, and only its three
 * existing fetch calls. Evidence ingest (README.md) joins this list with its
 * module, limited to evidence/open and evidence/commit.
 */
export const EXCEPTIONS: Readonly<Record<string, { readonly fetchCalls: number }>> = {
  "public/app.js": { fetchCalls: 3 },
};

const BARE_IMPORTS = new Set(["react", "react-dom/client", "react/jsx-runtime", "@ductura/ui", "@ductura/ui/fonts.css",
  "@ductura/ui/tokens.css", "@ductura/contracts/openapi/v1.json"]);
const CONFIG_IMPORTS = new Set(["vite", "vitest/config", "@playwright/test", "@vitejs/plugin-react"]);

const RULES: readonly (readonly [string, RegExp])[] = [
  ["fetch", /\bfetch\b/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["sendBeacon", /\bsendBeacon\b/],
  ["EventSource", /\bEventSource\b/],
  ["WebSocket", /\bWebSocket(?:Stream)?\b/],
  ["WebTransport", /\bWebTransport\b/],
  ["RTCPeerConnection", /\bRTCPeerConnection\b/],
  ["importScripts", /\bimportScripts\b/],
  ["Cache API", /\bcaches\b/],
  ["worker", /\b(?:Shared)?Worker\s*\(|serviceWorker/],
  ["axios", /\baxios\b/],
  ["generated client outside api.ts", /["'`]@ductura\/contracts["'`]/],
  ["test fakes", /@ductura\/test-fakes/],
  ["test file import", /["'`][^"'`\n]*\.(?:test|spec)(?:\.[cm]?[jt]sx?)?["'`]/],
  ["computed global", /\b(?:globalThis|window|self|top|parent|frames|opener|defaultView)\s*(?:\?\.)?\s*\[/],
  ["global alias", /(?:[=(,:]|\breturn)\s*(?:globalThis|window|self|top|parent|frames|opener)\b\s*(?![\s.?\w])|\(\s*(?:globalThis|window|self)\s+as\b/],
  ["Reflect", /\bReflect\b/],
  ["property descriptor", /\bgetOwnPropertyDescriptors?\b|\b__lookupGetter__\b/],
  ["eval", /(?<![\w-])eval\b/],
  ["Function constructor", /\bFunction\s*\(|\.constructor\s*(?:\(|\[)/],
  ["string timer", /\bset(?:Timeout|Interval)\s*\(\s*["'`]/],
  ["code from URL", /\bimport\s*\(\s*(?!["'`]\.)|createObjectURL|["'`](?:data|blob|javascript):/],
  ["form submit", /\.(?:requestS|s)ubmit\s*\(|\.action\s*=|\bformAction\b/],
  ["image or src", /\bnew\s+Image\b|\.(?:src|srcset|href|data|poster)\s*=|setAttribute\s*\(\s*["'`](?:src|srcset|href|action|formaction|ping|data|poster)["'`]/],
  ["window.open", /\b(?:window|globalThis|self)\s*\.\s*open\s*\(|\bopen\s*\(\s*["'`]/],
  ["navigation", /\blocation\s*(?:\.\s*(?:href|assign|replace)\b|=)/],
  ["ping", /\bping\s*=/],
  ["API URL", /["'`}(=]\s*\/?api(?:\/|\b)|\bapi\/v\d|(?<![.\w])\/api["'`)\s]/],
];

const ENTITY = /&#(?:x([0-9a-f]+)|(\d+));?/gi;
const ESCAPE = /\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})|%([0-9a-f]{2})/gi;

/** Decoded text: escapes and entities resolved, comments dropped, string pieces joined. */
export function normalise(text: string): string {
  const decoded = text
    .replace(ENTITY, (_, hex: string | undefined, dec: string | undefined) => String.fromCodePoint(hex ? parseInt(hex, 16) : Number(dec)))
    .replace(ESCAPE, (_, a?: string, b?: string, c?: string, d?: string) => String.fromCodePoint(parseInt((a ?? b ?? c ?? d) as string, 16)));
  return decoded
    .replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, "")
    .replace(/(["'`])\s*\+\s*(["'`])/g, "")
    .replace(/(["'`])\s*,\s*(["'`])/g, "$1/$2");
}

function bareImports(text: string): string[] {
  const found = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|@import\s+(?:url\()?)["'`]([^"'`]+)["'`]/g)];
  return found.map((m) => m[1] ?? "").filter((spec) => !spec.startsWith(".") && !spec.startsWith("/"));
}

/** The rules a text breaks. */
export function directCalls(text: string, file = ""): string[] {
  const plain = normalise(text);
  const config = CONFIG.test(file);
  const broken = RULES.filter(([name, rule]) => !(config && name === "test file import") && (rule.test(text) || rule.test(plain)))
    .map(([name]) => name);
  const allowed = config ? new Set([...BARE_IMPORTS, ...CONFIG_IMPORTS]) : BARE_IMPORTS;
  for (const spec of bareImports(plain)) if (!allowed.has(spec)) broken.push(`import ${spec}`);
  return broken;
}

function sources(dir: string, top: boolean): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (SKIP_ANYWHERE.has(name) || (top && SKIP_TOP.has(name))) return [];
      return sources(path, dir.endsWith("/packages"));
    }
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });
}

describe("no API call outside src/client/api.ts", () => {
  const files = SCANNED.flatMap((dir) => sources(join(ROOT, dir), dir === "catalog")).map((path) => relative(ROOT, path));

  it("reads the app sources, the client and the skeleton included", () => {
    for (const file of [CLIENT, "public/app.js", "public/index.html", "src/client/schema-check.ts", "catalog/src/main.tsx"]) {
      expect(files).toContain(file);
    }
  });

  it("finds no direct call in any other file", () => {
    const found = files
      .filter((file) => file !== CLIENT && !Object.hasOwn(EXCEPTIONS, file))
      .map((file) => [file, directCalls(readFileSync(join(ROOT, file), "utf8"), file)] as const)
      .filter(([, rules]) => rules.length > 0);
    expect(found).toEqual([]);
  });

  it("the exception list is closed", () => {
    expect(Object.keys(EXCEPTIONS).sort()).toEqual(["public/app.js"]);
  });

  it("the skeleton keeps its three calls to /api/documents, no more", () => {
    const text = readFileSync(join(ROOT, "public/app.js"), "utf8");
    expect(text.match(/\bfetch\b/g)).toHaveLength(EXCEPTIONS["public/app.js"]?.fetchCalls ?? 0);
    expect(new Set(directCalls(text, "public/app.js"))).toEqual(new Set(["fetch", "API URL", "image or src"]));
    expect([...text.matchAll(/`\$\{API\}([^`]*)`/g)].map((m) => m[1]?.split("/")[1])).toEqual(["documents", "documents", "documents"]);
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
    'window/**/["fe"+"tch"](u)',
    'const g = globalThis; g["fe"+"tch"](u)',
    '(globalThis as any)["fe"+"tch"](u)',
    "Reflect.get(globalThis, name)(url)",
    'Reflect["get"](globalThis, n)(u)',
    'Object.getOwnPropertyDescriptor(globalThis, "fe" + "tch")!.value(u)',
    '(() => {}).constructor("return fe" + "tch")()',
    'setTimeout("fe" + "tch(\'/x\')")',
    'new Worker(URL.createObjectURL(new Blob(["self.fe" + "tch(u)"])))',
    'await import("data:text/javascript,fe%74ch(\'/ap%69/v1/health\')")',
    "\\u0066etch(\"/ap\" + \"i/v1/auth/logout\", { method: \"POST\" })",
    'navigator["send" + "Beacon"](u, d)',
    "const x = new XMLHttpRequest()",
    'import axios from "axios"; axios.get(u)',
    'import mande from "mande"',
    'const { request } = await import("node:https")',
    'import { createClient } from "@ductura/contracts"',
    'import { net } from "./net.spec"',
    "navigator.sendBeacon(u, data)",
    "new EventSource(u)",
    "new WebSocket(u)",
    'importScripts("/x.js")',
    "caches.open('c').then((c) => c.add(u))",
    'eval("fet" + "ch")(u)',
    "Function('return fetch')()",
    'f.action = "/ap" + "i/v1/auth/logout"; f.submit()',
    'new Image().src = "/ap" + "i/v1/health"',
    'window.open("/ap" + "i/v1/auth/login")',
    'el.style.backgroundImage = "url(/ap" + "i/v1/health)"',
    '<form action="/ap&#105;/v1/auth/logout" method="post">',
    '<img src="/ap&#105;/v1/health">',
    '<a ping="/ap&#x69;/v1/x" href="/">',
    'body { background: url("/api/v1/health") }',
    '<svg><script>fetch("/api/v1/health")</script></svg>',
    'location.href = "/api/v1/auth/login"',
    "const u = base + '/api' + rest",
    'const u = ["", "api", "v1"].join("/")',
    'const u = new URL("api/v1/health", base)',
  ];
  for (const text of caught) {
    it(`catches ${text}`, () => {
      expect(directCalls(text)).not.toEqual([]);
    });
  }

  it("lets plain code through", () => {
    expect(directCalls('import { createApi } from "../client/api";\nconst api = createApi();\nawait api("platform.health.get", input);')).toEqual([]);
    expect(directCalls('import { useState } from "react";\nconst prefetched = true; // nothing is fetched here')).toEqual([]);
  });

  it("allows tool imports only in the config files of the catalogue and packages", () => {
    expect(directCalls('import { defineConfig } from "vite";', "catalog/vite.config.ts")).toEqual([]);
    expect(directCalls('import { defineConfig } from "vite";', "catalog/src/main.tsx")).toEqual(["import vite"]);
  });
});
