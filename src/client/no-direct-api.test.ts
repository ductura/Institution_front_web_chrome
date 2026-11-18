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

/**
 * Closed list of rules waived for one exact file each (ODLUKA ORKESTRATORA
 * Ductus#2028 c.6982164435, DAN-888). Both files are verbatim Ductus code in
 * editor-core that inspects a value's own keys to reject unsafe JSON; it never
 * reaches the network, and verbatim code is not edited. Only the named rule is
 * waived for the named path; every other rule, the network ones included,
 * still applies there, and an entry that no longer matches a finding fails.
 */
export const WAIVED_RULES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "packages/editor-core/src/domain/json.ts": Object.freeze(["Reflect"]),
  "packages/editor-core/src/domain/forensics/jcs.ts": Object.freeze(["property descriptor"]),
});

/** The only line each waived file may have that breaks its waived rule. */
const WAIVED_LINES: Readonly<Record<string, string>> = {
  "packages/editor-core/src/domain/json.ts": "  return Reflect.ownKeys(value).every(",
  "packages/editor-core/src/domain/forensics/jcs.ts": "      const descriptor = Object.getOwnPropertyDescriptor(object, key);",
};

/** The rules a file breaks once its waivers, if any, are taken out. */
export function unwaived(file: string, broken: readonly string[]): string[] {
  const waived = Object.hasOwn(WAIVED_RULES, file) ? (WAIVED_RULES[file] ?? []) : [];
  return broken.filter((rule) => !waived.includes(rule));
}

/** Waivers (file and rule) that match no finding of that file; findings maps file to rules broken. */
export function staleWaivers(findings: ReadonlyMap<string, readonly string[]>): string[] {
  return Object.entries(WAIVED_RULES).flatMap(([file, rules]) =>
    rules.filter((rule) => !(findings.get(file) ?? []).includes(rule)).map((rule) => `${file}: ${rule}`));
}

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
  // A test file or anything in a directory the scan skips (catalog/e2e, dist ...).
  ["test file import", /["'`][^"'`\n]*(?:\.(?:test|spec)(?:\.[cm]?[jt]sx?)?|(?:^|[/"'`])(?:e2e|dist|test-results|playwright-report)(?:\/[^"'`\n]*)?)["'`]/],
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

  const findings = new Map(files
    .filter((file) => file !== CLIENT && !Object.hasOwn(EXCEPTIONS, file))
    .map((file) => [file, directCalls(readFileSync(join(ROOT, file), "utf8"), file)] as const));

  it("finds no direct call in any other file", () => {
    const found = [...findings]
      .map(([file, rules]) => [file, unwaived(file, rules)] as const)
      .filter(([, rules]) => rules.length > 0);
    expect(found).toEqual([]);
  });

  it("the exception list is closed", () => {
    expect(Object.keys(EXCEPTIONS).sort()).toEqual(["public/app.js"]);
  });

  it("the waiver list is closed: one exact path, one exact rule", () => {
    expect(Object.entries(WAIVED_RULES).sort()).toEqual([
      ["packages/editor-core/src/domain/forensics/jcs.ts", ["property descriptor"]],
      ["packages/editor-core/src/domain/json.ts", ["Reflect"]],
    ]);
    // Own keys of every kind, so a hidden (non-enumerable) entry cannot slip past.
    expect(Reflect.ownKeys(WAIVED_RULES).map(String).sort()).toEqual([
      "packages/editor-core/src/domain/forensics/jcs.ts",
      "packages/editor-core/src/domain/json.ts",
    ]);
    expect(Object.isFrozen(WAIVED_RULES)).toBe(true);
    for (const rules of Object.values(WAIVED_RULES)) {
      expect(Object.isFrozen(rules)).toBe(true);
      expect(Reflect.ownKeys(rules)).toEqual(["0", "length"]);
    }
  });

  it("each waiver covers only the one verbatim line that needs it", () => {
    for (const [file, rules] of Object.entries(WAIVED_RULES)) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const name of rules) {
        const rule = RULES.find(([n]) => n === name)?.[1];
        expect(rule).toBeDefined();
        const global = new RegExp(rule!.source, "g");
        expect([text.match(global)?.length, normalise(text).match(global)?.length]).toEqual([1, 1]);
        expect(text.split("\n").filter((line) => rule!.test(line))).toEqual([WAIVED_LINES[file]]);
      }
    }
  });

  it("every waiver still matches a finding in its file", () => {
    expect(staleWaivers(findings)).toEqual([]);
  });

  it("the skeleton keeps its three calls to /api/documents, no more", () => {
    const text = readFileSync(join(ROOT, "public/app.js"), "utf8");
    expect(text.match(/\bfetch\b/g)).toHaveLength(EXCEPTIONS["public/app.js"]?.fetchCalls ?? 0);
    expect(new Set(directCalls(text, "public/app.js"))).toEqual(new Set(["fetch", "API URL", "image or src"]));
    expect([...text.matchAll(/`\$\{API\}([^`]*)`/g)].map((m) => m[1]?.split("/")[1])).toEqual(["documents", "documents", "documents"]);
  });
});

describe("a waiver lifts one rule in one file, nothing more", () => {
  const JSON_FILE = "packages/editor-core/src/domain/json.ts";
  const JCS_FILE = "packages/editor-core/src/domain/forensics/jcs.ts";
  const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
  const network = ['fetch("/x")', "new XMLHttpRequest()", "navigator.sendBeacon(u, d)", "new WebSocket(u)",
    'new Image().src = "/ap" + "i/v1/health"', "Reflect.get(globalThis, name)(url)",
    'Object.getOwnPropertyDescriptor(globalThis, "fe" + "tch")!.value(u)', 'import mande from "mande"'];

  for (const file of [JSON_FILE, JCS_FILE]) {
    for (const call of network) {
      it(`a call inserted into ${file} is still caught: ${call}`, () => {
        expect(unwaived(file, directCalls(read(file), file))).toEqual([]);
        expect(unwaived(file, directCalls(`${read(file)}\n${call}\n`, file))).not.toEqual([]);
      });
    }
  }

  it("a fetch( inserted into json.ts is caught as fetch", () => {
    expect(unwaived(JSON_FILE, directCalls(`${read(JSON_FILE)}\nfetch(url);\n`, JSON_FILE))).toContain("fetch");
  });

  it("each rule stays on for the other waived file", () => {
    expect(unwaived(JCS_FILE, directCalls("Reflect.ownKeys(value)", JCS_FILE))).toEqual(["Reflect"]);
    expect(unwaived(JSON_FILE, directCalls("Object.getOwnPropertyDescriptor(o, k)", JSON_FILE)))
      .toEqual(["property descriptor"]);
  });

  for (const file of ["src/client/schema-check.ts", "packages/editor-core/src/domain/document/schema.ts",
    "packages/editor-core/src/domain/json.tsx", "./packages/editor-core/src/domain/json.ts",
    "packages/editor-core/src/domain/JSON.ts", "packages/editor-core/src/domain/json.ts ", "__proto__", "constructor"]) {
    it(`Reflect is still caught in ${JSON.stringify(file)}`, () => {
      expect(unwaived(file, directCalls("Reflect.ownKeys(value)", file))).toEqual(["Reflect"]);
      expect(unwaived(file, directCalls("Object.getOwnPropertyDescriptor(o, k)", file))).toEqual(["property descriptor"]);
    });
  }

  it("a waiver that matches no finding is reported as stale", () => {
    const findings = new Map([[JSON_FILE, ["Reflect"]], [JCS_FILE, ["property descriptor"]]]);
    expect(staleWaivers(findings)).toEqual([]);
    expect(staleWaivers(new Map([[JSON_FILE, ["Reflect"]]]))).toEqual([`${JCS_FILE}: property descriptor`]);
    expect(staleWaivers(new Map([[JSON_FILE, ["fetch"]], [JCS_FILE, ["property descriptor"]]])))
      .toEqual([`${JSON_FILE}: Reflect`]);
    expect(staleWaivers(new Map())).toEqual([`${JSON_FILE}: Reflect`, `${JCS_FILE}: property descriptor`]);
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
    'import { health } from "../e2e/net"',
    'const m = await import("../e2e/net.ts")',
    'export * from "../../dist/client.js"',
    'import "./e2e"',
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
