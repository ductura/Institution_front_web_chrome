// No API call outside the generated client (DAN-752, web 2.c3). Every source
// file that ships to the browser (src, public, packages, catalog, app) is read
// and any network primitive, request-making element, HTTP library, way around
// a static name, or API URL fails the test, except in src/client/api.ts and
// the closed list below. Text is normalised first (escapes and HTML entities
// decoded, comments dropped, adjacent string pieces joined), and a bare import
// must be on an allowlist, so an unlisted library cannot bring its own fetch.
// Known limit: this is a text scan, not an AST lint (the web has no ESLint yet);
// review still reads new code. Test files and catalog/e2e (and the same in a
// package) are not scanned, and no app file may import a test file. Paths are
// compared in POSIX form: on Windows "\\" is read as "/" (list keys always), so
// the scan is the same there; elsewhere "\\" is part of a name and fails the scan.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, resolve, sep, win32 } from "node:path";
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
 * Closed list of rules waived for one exact file (ODLUKA ORKESTRATORA
 * Ductus#2028 c.6982164435, DAN-888): path, then rule, then the one line that
 * may break it. Empty until the verbatim editor-core files it is for arrive.
 * Every other rule, the network ones included, still applies to a listed file,
 * and an entry that matches no finding fails.
 */
export const WAIVED_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({});

/** The path in POSIX form; "\\" is a separator only where the platform says so. */
export function toPosix(path: string, separator: string = sep): string {
  return separator === "\\" ? path.replaceAll("\\", "/") : path;
}

/** The own key of a closed list that names a POSIX path; keys are read with "\\" as "/", and two that meet fail. */
export function listed(list: object, file: string): string | undefined {
  const keys = Object.keys(list).filter((key) => toPosix(key, "\\") === file);
  if (keys.length > 1) throw new Error(`${file} is listed ${keys.length} times: ${keys.join(", ")}`);
  return keys[0];
}

/** Own keys of a list not already in POSIX form, on any platform. */
export function nonPosixKeys(list: object): string[] {
  return Reflect.ownKeys(list).map(String).filter((key) => key !== toPosix(key, "\\"));
}

/** Whether a directory is a packages/ directory, whose children skip their own e2e and build output. */
export function isPackagesDir(dir: string, separator: string = sep): boolean {
  return toPosix(dir, separator).endsWith("/packages");
}

/** The rules a file breaks once its waivers, if any, are taken out. */
export function unwaived(file: string, broken: readonly string[], list = WAIVED_RULES): string[] {
  const key = listed(list, file);
  const waived = key === undefined ? [] : Object.keys(list[key] ?? {});
  return broken.filter((rule) => !waived.includes(rule));
}

/** Waivers ("file: rule") that match no finding; findings maps a POSIX path to the rules it breaks. */
export function staleWaivers(findings: ReadonlyMap<string, readonly string[]>, list = WAIVED_RULES): string[] {
  return Object.entries(list).flatMap(([key, rules]) => {
    const file = toPosix(key, "\\");
    return Object.keys(rules).filter((rule) => !(findings.get(file) ?? []).includes(rule)).map((rule) => `${file}: ${rule}`);
  });
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
  ["test file import", /["'`][^"'`\n]*(?:\.(?:test|spec)(?:\.[cm]?[jt]sx?)?|(?:^|[/\\"'`])(?:e2e|dist|test-results|playwright-report)(?:[/\\][^"'`\n]*)?)["'`]/],
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

/**
 * What is wrong with a file's waivers: each names a rule that matches once, on
 * the recorded line, in the text as written and in the normalised text alike.
 */
export function waiverProblems(text: string, rules: Readonly<Record<string, string>>): string[] {
  return Object.entries(rules).flatMap(([name, line]) => {
    const rule = RULES.find(([n]) => n === name)?.[1];
    if (!rule) return [`${name}: no such rule`];
    const all = new RegExp(rule.source, `${rule.flags}g`);
    const forms = [text, normalise(text)];
    const hits = forms.map((form) => form.split(/\r?\n/).flatMap((each) => (each.match(all) ?? []).map(() => each)));
    const ok = forms.every((form, i) => form.match(all)?.length === 1 && hits[i]?.length === 1 && hits[i]?.[0] === line);
    return ok ? [] : [`${name}: ${JSON.stringify(hits)}`];
  });
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
      return sources(path, isPackagesDir(dir));
    }
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });
}

describe("no API call outside src/client/api.ts", () => {
  const files = SCANNED.flatMap((dir) => sources(join(ROOT, dir), dir === "catalog")).map((path) => toPosix(relative(ROOT, path)));

  it("reads the app sources, the client and the skeleton included", () => {
    for (const file of [CLIENT, "public/app.js", "public/index.html", "src/client/schema-check.ts", "catalog/src/main.tsx"]) {
      expect(files).toContain(file);
    }
  });

  const findings = new Map(files
    .filter((file) => file !== CLIENT && listed(EXCEPTIONS, file) === undefined)
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

  it("the waiver list is closed and empty until its files arrive", () => {
    expect(Reflect.ownKeys(WAIVED_RULES)).toEqual([]);
    expect(Object.isFrozen(WAIVED_RULES)).toBe(true);
  });

  it("no scanned path holds a backslash, so no name can pose as another path", () => {
    expect(files.filter((file) => file.includes("\\"))).toEqual([]);
  });

  it("every list key is already in POSIX form", () => {
    expect(Object.getPrototypeOf(WAIVED_RULES)).toBe(Object.prototype);
    expect([...nonPosixKeys(EXCEPTIONS), ...nonPosixKeys(WAIVED_RULES)]).toEqual([]);
  });

  it("each waiver covers only its recorded line and still matches a finding", () => {
    for (const [file, rules] of Object.entries(WAIVED_RULES)) {
      expect(waiverProblems(readFileSync(join(ROOT, toPosix(file, "\\")), "utf8"), rules)).toEqual([]);
    }
    expect(staleWaivers(findings)).toEqual([]);
  });

  it("the skeleton keeps its three calls to /api/documents, no more", () => {
    const text = readFileSync(join(ROOT, "public/app.js"), "utf8");
    expect(text.match(/\bfetch\b/g)).toHaveLength(EXCEPTIONS["public/app.js"]?.fetchCalls ?? 0);
    expect(new Set(directCalls(text, "public/app.js"))).toEqual(new Set(["fetch", "API URL", "image or src"]));
    expect([...text.matchAll(/`\$\{API\}([^`]*)`/g)].map((m) => m[1]?.split("/")[1])).toEqual(["documents", "documents", "documents"]);
  });
});

describe("paths read the same with Windows separators", () => {
  const win = (path: string) => toPosix(path, win32.sep);
  it.each([
    ["a\\b\\c.ts", "a/b/c.ts"],
    ["a/b\\c.ts", "a/b/c.ts"],
    ["a/b/c.ts", "a/b/c.ts"],
    [win32.relative("C:\\repo", "C:\\repo\\packages\\ui\\src\\x.ts"), "packages/ui/src/x.ts"],
  ])("%s reads as %s on Windows", (path, posixPath) => {
    expect(win(path)).toBe(posixPath);
  });

  it("keeps a backslash as part of a name where the platform separator is /", () => {
    expect(toPosix("packages/ui\\vite.config.ts", posix.sep)).toBe("packages/ui\\vite.config.ts");
    expect(directCalls('import { defineConfig } from "vite";', "packages/ui\\vite.config.ts")).toEqual(["import vite"]);
    expect(isPackagesDir("/repo\\packages", posix.sep)).toBe(false);
  });

  it("finds a list entry whatever separator the file or the key uses", () => {
    for (const file of ["public\\app.js", "public/app.js", win32.relative("C:\\repo", win32.join("C:\\repo", "public", "app.js"))]) {
      expect(listed(EXCEPTIONS, win(file))).toBe("public/app.js");
      expect(listed(Object.fromEntries([["public\\app.js", 1]]), win(file))).toBe("public\\app.js");
    }
    for (const file of ["public/app.jsx", "./public/app.js", "Public/app.js", "public/app.js ", "__proto__", "constructor", "toString"]) {
      expect(listed(EXCEPTIONS, win(file))).toBeUndefined();
    }
    expect(() => listed(Object.fromEntries([["public/app.js", 1], ["public\\app.js", 2]]), "public/app.js")).toThrow(/2 times/);
    // On Linux a "\\" key would read a decoy file of that name at the root, so a list key must already be POSIX.
    expect(nonPosixKeys(Object.fromEntries([["packages\\qa\\json.ts", {}], ["a/b\\c.ts", {}], ["a/b.ts", {}]])))
      .toEqual(["packages\\qa\\json.ts", "a/b\\c.ts"]);
  });

  it("reads config files and the packages directory with Windows separators", () => {
    const vite = 'import { defineConfig } from "vite";';
    expect(directCalls(vite, win("catalog\\vite.config.ts"))).toEqual([]);
    expect(directCalls(vite, win("packages/ui\\vite.config.ts"))).toEqual([]);
    expect(directCalls(vite, win("catalog\\src\\main.tsx"))).toEqual(["import vite"]);
    expect([isPackagesDir("C:\\repo\\packages", win32.sep), isPackagesDir("/repo/packages", posix.sep),
      isPackagesDir("C:\\repo\\src", win32.sep)]).toEqual([true, true, false]);
  });
});

describe("a waiver lifts one rule in one file, nothing more", () => {
  const FILE = "pkg/a/json.ts";
  const LINE = "  return Reflect.ownKeys(value).every(";
  const list = Object.fromEntries([["pkg\\a\\json.ts", { Reflect: LINE }]]);
  const network = ['fetch("/x")', "new XMLHttpRequest()", "navigator.sendBeacon(u, d)", "new WebSocket(u)",
    'new Image().src = "/ap" + "i/v1/health"', "Reflect.get(globalThis, name)(url)",
    'Object.getOwnPropertyDescriptor(globalThis, "fe" + "tch")!.value(u)', 'import mande from "mande"'];

  for (const path of [FILE, "pkg\\a\\json.ts", "pkg/a\\json.ts"]) {
    const file = toPosix(path, win32.sep);
    it(`lifts only Reflect in ${path} (Windows path)`, () => {
      expect(unwaived(file, directCalls(LINE, file), list)).toEqual([]);
      for (const call of network) expect(unwaived(file, directCalls(`${LINE}\n${call}\n`, file), list)).not.toEqual([]);
      expect(unwaived(file, directCalls(`${LINE}\nfetch(url);`, file), list)).toEqual(["fetch"]);
    });
  }

  for (const file of ["src/client/schema-check.ts", "./pkg/a/json.ts", "pkg/a/JSON.ts", "pkg/a/json.tsx", "pkg/a/json.ts ",
    "pkg\\a\\json.ts", "__proto__", "constructor", "toString"]) {
    it(`Reflect is still caught in ${JSON.stringify(file)}`, () => {
      expect(unwaived(file, directCalls(LINE, file), list)).toEqual(["Reflect"]);
      expect(unwaived(file, directCalls(LINE, file), Object.fromEntries([[file, {}]]))).toEqual(["Reflect"]);
    });
  }

  it("a waiver that matches no finding is stale, named in POSIX form", () => {
    expect(staleWaivers(new Map([[FILE, ["Reflect"]]]), list)).toEqual([]);
    expect(staleWaivers(new Map([[FILE, ["fetch"]]]), list)).toEqual([`${FILE}: Reflect`]);
    expect(staleWaivers(new Map(), list)).toEqual([`${FILE}: Reflect`]);
  });

  it("a waived rule matches exactly its one recorded line", () => {
    expect(waiverProblems(`x\n${LINE}\n`, { Reflect: LINE })).toEqual([]);
    expect(waiverProblems(`${LINE}\n${LINE}\n`, { Reflect: LINE })).not.toEqual([]);
    expect(waiverProblems("Reflect.has(o, k)\n", { Reflect: LINE })).not.toEqual([]);
    expect(waiverProblems(`x\r\n${LINE}\r\n`, { Reflect: LINE })).toEqual([]);
    expect(waiverProblems(`${LINE} // x\n`, { Reflect: LINE })).not.toEqual([]);
    // The recorded line commented out, another Reflect live: each form has one match, on different lines.
    expect(waiverProblems(`/*\n${LINE}\n*/\nconst k = \\u0052eflect.ownKeys(o);\n`, { Reflect: LINE })).not.toEqual([]);
    // A second match that spans a line break.
    expect(waiverProblems("img.src = url;\nother.src\n  = u;\n", { "image or src": "img.src = url;" })).not.toEqual([]);
    // A second Reflect that only decoding reveals, and one that decoding hides.
    expect(waiverProblems(`${LINE}\nconst k = \\u0052eflect.ownKeys(o);\n`, { Reflect: LINE })).not.toEqual([]);
    expect(waiverProblems(`${LINE}\n/* Reflect */\n`, { Reflect: LINE })).not.toEqual([]);
    expect(waiverProblems(`${LINE} Reflect.has(o, k)\n`, { Reflect: LINE })).not.toEqual([]);
    expect(waiverProblems(LINE, { reflect: LINE })).toEqual(["reflect: no such rule"]);
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
    'import { health } from "..\\\\e2e\\\\net"',
    'export * from "..\\\\..\\\\dist\\\\client.js"',
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
