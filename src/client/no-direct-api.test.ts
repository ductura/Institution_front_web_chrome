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
// the scan is the same there; elsewhere "\\" is part of a name.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, resolve, sep, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import baselineJson from "./no-direct-api.baseline.json" with { type: "json" };

const ROOT = resolve(import.meta.dirname, "../..");
const SCANNED = ["src", "public", "packages", "catalog", "app"];
/** Skipped by name at any depth (installed or built output). */
const SKIP_ANYWHERE = new Set(["node_modules", ".git"]);
/** Skipped only directly under catalog/ or packages/<name>/ (their own e2e and build output). */
const SKIP_TOP = new Set(["e2e", "dist", "test-results", "playwright-report"]);
/** Skipped directly under src/: pages parked until their own PR moves them back (WEB-01), not built, not shipped. */
const SKIP_SRC = new Set(["_cekanje"]);
const SOURCE = /\.(?:[cm]?[jt]sx?|html?|xhtml|svg|css|svelte|vue)$/;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const CONFIG = /^(?:catalog|packages\/[^/]+|src\/[^/]+)\/(?:vite|vitest|playwright)\.config\.[cm]?[jt]s$/;

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
 * Known findings of the pages copied from the database front and not yet moved
 * onto src/client (the "_cekanje" pages are skipped, these are the rest), by
 * file. It only shrinks: a file may break no rule outside its entry, a file
 * that no longer breaks any rule must leave the list, and a new file has no
 * entry. Each page PR (WEB-xx) deletes its files' entries.
 */
export const BASELINE: Readonly<Record<string, readonly string[]>> = baselineJson;

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
  return /\/packages\/*$/.test(toPosix(dir, separator));
}

const BARE_IMPORTS = new Set(["react", "react-dom/client", "react/jsx-runtime", "@ductura/ui", "@ductura/ui/fonts.css",
  "@ductura/ui/tokens.css", "@ductura/contracts/openapi/v1.json"]);
/** Bare imports that are not network libraries: the Next, editor and storage stack of the app trees (WEB-01), and the "@/" alias. */
const BARE_PREFIXES = ["@/", "next/", "@tiptap/"];
const BARE_PACKAGES = new Set(["next", "dexie", "react-dom"]);
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
  ["test file import", /["'`][^"'`\n]*(?:\.(?:test|spec)(?:\.[cm]?[jt]sx?)?|(?:^|[/\\"'`])(?:e2e|dist|test-results|playwright-report)(?:[/\\][^"'`\n]*)?)["'`]/i],
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
  for (const spec of bareImports(plain)) {
    if (!allowed.has(spec) && !BARE_PACKAGES.has(spec) && !BARE_PREFIXES.some((prefix) => spec.startsWith(prefix))) broken.push(`import ${spec}`);
  }
  return broken;
}

/** The file system and path functions the scan walks with; a test passes path.win32 and a tree of its own. */
export interface Walk {
  readonly readdir: (dir: string) => string[];
  readonly isDirectory: (path: string) => boolean;
  readonly join: (...parts: string[]) => string;
  readonly relative: (from: string, to: string) => string;
  readonly sep: string;
}
/** The real file system with the path functions of api (node:path by default). */
export function nodeWalk(api: Pick<Walk, "join" | "relative" | "sep"> = { join, relative, sep }): Walk {
  return { readdir: (dir) => readdirSync(dir), isDirectory: (path) => statSync(path).isDirectory(),
    join: api.join, relative: api.relative, sep: api.sep };
}

function sources(dir: string, top: boolean, walk: Walk): string[] {
  let entries: string[];
  try {
    entries = walk.readdir(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = walk.join(dir, name);
    if (walk.isDirectory(path)) {
      if (SKIP_ANYWHERE.has(name) || (top && SKIP_TOP.has(name))) return [];
      if (SKIP_SRC.has(name) && /\/src$/.test(toPosix(dir, walk.sep))) return [];
      return sources(path, isPackagesDir(dir, walk.sep), walk);
    }
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });
}

/** Every scanned file, relative to the root and in POSIX form. */
export function scannedFiles(root: string, walk: Walk = nodeWalk()): string[] {
  return SCANNED.flatMap((dir) => sources(walk.join(root, dir), dir === "catalog", walk))
    .map((path) => toPosix(walk.relative(root, path), walk.sep));
}

/** The files checked for direct calls: all but the client and the closed exception list. */
export function checkedFiles(files: readonly string[], list: object = EXCEPTIONS): string[] {
  return files.filter((file) => file !== CLIENT && listed(list, file) === undefined);
}

const listed_ = (file: string): readonly string[] => BASELINE[file] ?? [];

describe("no API call outside src/client/api.ts", () => {
  const files = scannedFiles(ROOT);

  it("reads the app sources, the client and the skeleton included", () => {
    for (const file of [CLIENT, "public/app.js", "public/index.html", "src/client/schema-check.ts", "catalog/src/main.tsx"]) {
      expect(files).toContain(file);
    }
  });

  it("finds no direct call in any other file", () => {
    const found = checkedFiles(files)
      .map((file) => [file, directCalls(readFileSync(join(ROOT, file), "utf8"), file).filter((rule) => !listed_(file).includes(rule))] as const)
      .filter(([, rules]) => rules.length > 0);
    expect(found).toEqual([]);
  });

  it("the baseline lists only files that still break the rule it names", () => {
    const stale = Object.entries(BASELINE).flatMap(([file, rules]) => {
      if (!files.includes(file)) return [`${file}: not scanned`];
      const now = new Set(directCalls(readFileSync(join(ROOT, file), "utf8"), file));
      return rules.filter((rule) => !now.has(rule)).map((rule) => `${file}: ${rule}`);
    });
    expect(stale).toEqual([]);
  });

  it("the baseline holds no file of the client or the closed exception list", () => {
    expect(Object.keys(BASELINE).filter((file) => file === CLIENT || listed(EXCEPTIONS, file) !== undefined)).toEqual([]);
  });

  it("the exception list is closed", () => {
    expect(Object.keys(EXCEPTIONS).sort()).toEqual(["public/app.js"]);
  });

  it("every list key is already in POSIX form, and no scanned path holds a backslash", () => {
    expect(nonPosixKeys(EXCEPTIONS)).toEqual([]);
    expect(files.filter((file) => file.includes("\\"))).toEqual([]);
  });

  it("the skeleton keeps its three calls to /api/documents, no more", () => {
    const text = readFileSync(join(ROOT, "public/app.js"), "utf8");
    expect(text.match(/\bfetch\b/g)).toHaveLength(EXCEPTIONS["public/app.js"]?.fetchCalls ?? 0);
    expect(new Set(directCalls(text, "public/app.js"))).toEqual(new Set(["fetch", "API URL", "image or src"]));
    expect([...text.matchAll(/`\$\{API\}([^`]*)`/g)].map((m) => m[1]?.split("/")[1])).toEqual(["documents", "documents", "documents"]);
  });
});

describe("paths read the same with Windows separators", () => {
  /** A walk over a synthetic tree: absolute path -> entries (a directory) or null (a file); the drive letter case is not kept. */
  const tree = (api: typeof win32, root: string, entries: readonly string[], join = api.join): Walk => {
    const key = (path: string) => {
      // Only a path the injected join made: a "/" in a Windows path means the platform join slipped in.
      if (api === win32 && path.includes("/")) throw new Error(`not a Windows path: ${path}`);
      return api.join(path).replace(/^[a-z]:/, (drive) => drive.toUpperCase());
    };
    const nodes = new Map<string, string[] | null>([[key(root), []]]);
    for (const entry of entries) {
      const parts = entry.split("/");
      parts.forEach((name, i) => {
        const dir = key(api.join(root, ...parts.slice(0, i)));
        const path = key(api.join(dir, name));
        if (!nodes.has(path)) nodes.set(path, i === parts.length - 1 ? null : []);
        if (!nodes.get(dir)?.includes(name)) nodes.get(dir)?.push(name);
      });
    }
    return { readdir: (dir) => [...(nodes.get(key(dir)) ?? [])], isDirectory: (path) => Array.isArray(nodes.get(key(path))),
      join, relative: api.relative, sep: api.sep };
  };
  const ENTRIES = ["public/app.js", "public/index.html", "src/client/api.ts", "src/client/x.test.ts", "src/a/e2e/b.ts",
    "packages/x/vite.config.ts", "packages/x/src/y.ts", "packages/x/e2e/z.ts", "packages/x/dist/z.js", "packages/x/node_modules/m/i.js",
    "catalog/e2e/v.ts", "catalog/src/main.tsx", "app/x.svg"];
  const LISTED = ["src/client/api.ts", "src/a/e2e/b.ts", "public/app.js", "public/index.html", "packages/x/vite.config.ts",
    "packages/x/src/y.ts", "catalog/src/main.tsx", "app/x.svg"];

  it("reads a synthetic tree through path.win32 as the same POSIX list, a C:, UNC or trailing root alike", () => {
    for (const root of ["C:\\repo", "C:\\repo\\", "C:\\work\\..\\repo", "\\\\srv\\share\\repo", "\\\\srv\\share\\repo\\"]) {
      expect(scannedFiles(root, tree(win32, root, ENTRIES))).toEqual(LISTED);
    }
    expect(scannedFiles("/repo", tree(posix, "/repo", ENTRIES))).toEqual(LISTED);
  });

  it("the drive letter case of a walked path does not change the list", () => {
    const lower = (...parts: string[]) => win32.join(...parts).replace(/^C:/, "c:");
    expect(scannedFiles("C:\\repo", tree(win32, "C:\\repo", ENTRIES, lower))).toEqual(LISTED);
  });

  it("the real file list reads the same through path.win32, exceptions and the client left out", () => {
    const toReal = (path: string) => resolve(ROOT, win32.relative(WIN_ROOT, path).replaceAll("\\", "/"));
    const WIN_ROOT = "C:\\work\\web";
    const real = scannedFiles(ROOT);
    const winFiles = scannedFiles(WIN_ROOT, { ...nodeWalk(win32), readdir: (dir) => readdirSync(toReal(dir)),
      isDirectory: (path) => statSync(toReal(path)).isDirectory() });
    expect(winFiles).toEqual(real);
    expect(winFiles).toContain("public/app.js");
    expect(checkedFiles(winFiles)).toEqual(checkedFiles(real));
    expect(checkedFiles(winFiles)).not.toContain("public/app.js");
    expect(checkedFiles(winFiles)).not.toContain(CLIENT);
  });

  it.each([["a\\b\\c.ts", "a/b/c.ts"], ["a/b\\c.ts", "a/b/c.ts"], ["a/b/c.ts", "a/b/c.ts"], ["a\\b\\", "a/b/"]])(
    "%s reads as %s on Windows", (path, posixPath) => {
      expect(toPosix(path, win32.sep)).toBe(posixPath);
    });

  it("reads config files and packages directories with Windows separators, a trailing one included", () => {
    const vite = 'import { defineConfig } from "vite";';
    expect(directCalls(vite, toPosix("catalog\\vite.config.ts", win32.sep))).toEqual([]);
    expect(directCalls(vite, toPosix("packages/ui\\vite.config.ts", win32.sep))).toEqual([]);
    expect(directCalls(vite, toPosix("catalog\\src\\main.tsx", win32.sep))).toEqual(["import vite"]);
    expect(["C:\\repo\\packages", "C:\\repo\\packages\\", "/repo/packages", "/repo/packages/", "C:\\repo\\src", "C:\\repo\\mypackages"]
      .map((dir) => isPackagesDir(dir, dir.startsWith("C:") ? win32.sep : posix.sep))).toEqual([true, true, true, true, false, false]);
  });

  it("keeps a backslash as part of a name where the separator is /", () => {
    expect(toPosix("packages/ui\\vite.config.ts", posix.sep)).toBe("packages/ui\\vite.config.ts");
    expect(directCalls('import { defineConfig } from "vite";', "packages/ui\\vite.config.ts")).toEqual(["import vite"]);
    expect(isPackagesDir("/repo\\packages", posix.sep)).toBe(false);
    expect(scannedFiles("/repo", tree(posix, "/repo", ["public/a\\b.js"]))).toEqual(["public/a\\b.js"]);
  });

  it("a list key is read with \\ as /, two keys for one path fail, and nothing else matches", () => {
    expect(checkedFiles(["public/app.js", "public/x.js"], Object.fromEntries([["public\\app.js", {}]]))).toEqual(["public/x.js"]);
    expect(listed(EXCEPTIONS, "public/app.js")).toBe("public/app.js");
    expect(() => listed(Object.fromEntries([["public/app.js", 1], ["public\\app.js", 2]]), "public/app.js")).toThrow(/2 times/);
    expect(() => checkedFiles(["public/app.js"], Object.fromEntries([["public/app.js", 1], ["public\\app.js", 2]]))).toThrow(/2 times/);
    for (const file of ["public/app.jsx", "./public/app.js", "Public/app.js", "public/app.js ", "public/app.js/", "public\\app.js",
      "__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(listed(EXCEPTIONS, file)).toBeUndefined();
    }
    expect(nonPosixKeys(Object.fromEntries([["packages\\qa\\json.ts", {}], ["a/b\\c.ts", {}], ["a/b.ts", {}]])))
      .toEqual(["packages\\qa\\json.ts", "a/b\\c.ts"]);
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
    'import { health } from "..\\\\E2E\\\\net"',
    'import { c } from "../Dist/c.js"',
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
