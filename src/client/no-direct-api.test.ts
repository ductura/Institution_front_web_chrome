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
// the scan is the same there; elsewhere "\\" is part of a name. A rule is
// waived only for a file whose whole content was reviewed and frozen by its
// SHA-256 (WAIVED_RULES); any other byte makes the waiver stale.
import { createHash } from "node:crypto";
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
 * Closed list of rules waived for one exact file (ODLUKA Ductus#2028
 * c.6989236137, DAN-888): POSIX path, the rules, and contentSha256 of the
 * file as reviewed. Empty until the verbatim editor-core files arrive. Every
 * other rule, the network ones included, still applies to a listed file.
 */
export const WAIVED_RULES: Readonly<Record<string, { readonly rules: readonly string[]; readonly sha256: string }>> =
  Object.freeze({});

/** Rules about what a file imports: the imported module is not frozen by the hash, so they are never waived. */
const UNWAIVABLE = new Set(["test file import", "test fakes", "generated client outside api.ts"]);

/** SHA-256 (lower-case hex) of a file's bytes with CRLF read as LF, so a Windows checkout hashes the same. */
export function contentSha256(bytes: Uint8Array): string {
  const lf = Buffer.from(Buffer.from(bytes).toString("latin1").replaceAll("\r\n", "\n"), "latin1");
  return createHash("sha256").update(lf).digest("hex");
}

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
  for (const spec of bareImports(plain)) if (!allowed.has(spec)) broken.push(`import ${spec}`);
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

/** A waiver's rules if it is a plain object of exactly two own data fields, a 64-digit lower-case sha256 and distinct rule names; else why not. */
function waiverEntry(entry: unknown): { rules: string[]; sha256: string } | string {
  const own = (value: object, key: string) => Object.getOwnPropertyDescriptor(value, key);
  if (typeof entry !== "object" || entry === null) return "not exactly rules and sha256";
  const proto: unknown = Object.getPrototypeOf(entry);
  const keys = Reflect.ownKeys(entry);
  const rulesField = own(entry, "rules");
  const shaField = own(entry, "sha256");
  if ((proto !== Object.prototype && proto !== null) || keys.length !== 2 || !rulesField || !("value" in rulesField)
    || !shaField || !("value" in shaField)) return "not exactly rules and sha256";
  const sha256: unknown = shaField.value;
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) return "sha256 is not 64 lower-case hex digits";
  // Copied by own index, not by iterator, so the names checked are the names used.
  const list: unknown = rulesField.value;
  const length = Array.isArray(list) ? own(list, "length") : undefined;
  const rules = length && typeof length.value === "number"
    ? Array.from({ length: length.value }, (_, i) => own(list as object, String(i))) : [];
  const names = rules.map((field) => (field && "value" in field && typeof field.value === "string" ? field.value : undefined));
  if (names.length === 0 || names.some((name) => name === undefined) || new Set(names).size !== names.length) {
    return "rules is not a list of distinct rule names";
  }
  return { rules: names as string[], sha256 };
}

/**
 * The rules each checked file breaks once its waiver is applied, and what is
 * wrong with the waiver list. Each file is read once; its findings and hash come
 * from the same bytes. A waiver is looked up by its exact own key and lifts its
 * rules only if the whole list has no problem (so the hash matches).
 */
export function violations(files: readonly string[], read: (file: string) => Uint8Array, list: object = WAIVED_RULES):
  { found: [string, string[]][]; problems: string[] } {
  const scanned = new Map(files.map((file) => {
    const bytes = read(file);
    // Hash and findings now, before the next read can reuse the same buffer.
    return [file, { sha256: contentSha256(bytes), broken: directCalls(Buffer.from(bytes).toString("utf8"), file) }] as const;
  }));
  const problems: string[] = [];
  if (Object.getPrototypeOf(list) !== Object.prototype) problems.push("the waiver list has another prototype");
  const waived = new Map<string, string[]>();
  for (const key of Reflect.ownKeys(list)) {
    if (typeof key !== "string") problems.push(`${String(key)}: a waiver key that is not a string`);
    else if (!Object.prototype.propertyIsEnumerable.call(list, key)) problems.push(`${key}: a hidden waiver key`);
    else if (key !== toPosix(key, "\\")) problems.push(`${key}: not in POSIX form`);
    else {
      const file = scanned.get(key);
      const entry = waiverEntry(Object.getOwnPropertyDescriptor(list, key)?.value);
      if (!file) problems.push(`${key}: not a checked file`);
      else if (typeof entry === "string") problems.push(`${key}: ${entry}`);
      else {
        for (const rule of entry.rules) {
          if (!RULES.some(([name]) => name === rule)) problems.push(`${key}: no such rule: ${rule}`);
          else if (UNWAIVABLE.has(rule)) problems.push(`${key}: ${rule} cannot be waived`);
          else if (!file.broken.includes(rule)) problems.push(`${key}: ${rule} has no hit`);
        }
        if (file.sha256 !== entry.sha256) problems.push(`${key}: stale, the content changed (sha256)`);
        waived.set(key, entry.rules);
      }
    }
  }
  // Any problem in the list lifts nothing anywhere.
  const found = [...scanned].flatMap(([file, { broken }]): [string, string[]][] => {
    const lifted = problems.length === 0 ? waived.get(file) ?? [] : [];
    const left = broken.filter((rule) => !lifted.includes(rule));
    return left.length > 0 ? [[file, left]] : [];
  });
  return { found, problems };
}

describe("no API call outside src/client/api.ts", () => {
  const files = scannedFiles(ROOT);

  it("reads the app sources, the client and the skeleton included", () => {
    for (const file of [CLIENT, "public/app.js", "public/index.html", "src/client/schema-check.ts", "catalog/src/main.tsx"]) {
      expect(files).toContain(file);
    }
  });

  it("finds no direct call in any other file, and every waiver is current", () => {
    expect(violations(checkedFiles(files), (file) => readFileSync(join(ROOT, file)))).toEqual({ found: [], problems: [] });
  });

  it("the waiver list is closed and empty until its files arrive", () => {
    expect(Reflect.ownKeys(WAIVED_RULES)).toEqual([]);
    expect(Object.isFrozen(WAIVED_RULES)).toBe(true);
    expect(Object.getPrototypeOf(WAIVED_RULES)).toBe(Object.prototype);
  });

  it("the exception list is closed", () => {
    expect(Object.keys(EXCEPTIONS).sort()).toEqual(["public/app.js"]);
  });

  it("every list key is already in POSIX form, and no scanned path holds a backslash", () => {
    expect([...nonPosixKeys(EXCEPTIONS), ...nonPosixKeys(WAIVED_RULES)]).toEqual([]);
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

describe("a waiver lifts its rules only from the file whose content it froze", () => {
  const FILE = "pkg/a/json.ts";
  const TEXT = "export function keys(value: object) {\n  return Reflect.ownKeys(value);\n}\n";
  const bytes = (text: string) => Buffer.from(text, "utf8");
  const SHA = contentSha256(bytes(TEXT));
  const disk = new Map<string, Buffer>([[FILE, bytes(TEXT)], ["pkg/a/other.ts", bytes(TEXT)], ["pkg/a/plain.ts", bytes("export const a = 1;\n")]]);
  const read = (file: string) => {
    const found = disk.get(file);
    if (!found) throw new Error(`no such file: ${file}`);
    return found;
  };
  const run = (list: object, files = [...disk.keys()], reader = read) => violations(files, reader, list);
  const entry = (rules: unknown = ["Reflect"], sha256: unknown = SHA) => ({ rules, sha256 });

  it("a current waiver lifts only its rule in only its file", () => {
    expect(run({ [FILE]: entry() })).toEqual({ found: [["pkg/a/other.ts", ["Reflect"]]], problems: [] });
    for (const call of ['fetch("/x")', "new XMLHttpRequest()", "navigator.sendBeacon(u, d)", "new WebSocket(u)",
      'new Image().src = "/ap" + "i/v1/health"', 'Object.getOwnPropertyDescriptor(globalThis, "fe" + "tch")!.value(u)',
      'import mande from "mande"']) {
      const text = `${TEXT}${call}\n`;
      const result = violations([FILE], () => bytes(text), { [FILE]: entry(["Reflect"], contentSha256(bytes(text))) });
      expect(result.problems).toEqual([]);
      const left = directCalls(text, FILE).filter((rule) => rule !== "Reflect");
      expect(left).not.toEqual([]);
      expect(result.found).toEqual([[FILE, left]]);
    }
  });

  it("the hash is SHA-256 of the content with CRLF read as LF, lower-case hex", () => {
    expect(contentSha256(bytes("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(contentSha256(bytes(TEXT.replaceAll("\n", "\r\n")))).toBe(SHA);
    for (const text of [TEXT.replaceAll("\n", "\r"), TEXT.replace("\n", "\r\r\n"), `\uFEFF${TEXT}`, TEXT.replace("ownKeys", "ownkeys")]) {
      expect(contentSha256(bytes(text))).not.toBe(SHA);
    }
  });

  it.each([
    ["one byte changed", TEXT.replace("value)", "value )")],
    ["a Reflect line added", `${TEXT}const k = Reflect.has(o, "x");\n`],
    ["a BOM added", `\uFEFF${TEXT}`],
    ["a lone CR", TEXT.replace("\n", "\r")],
  ])("%s makes the waiver stale and lifts nothing", (_, text) => {
    const result = violations([FILE], () => bytes(text), { [FILE]: entry() });
    expect(result.problems).toEqual([`${FILE}: stale, the content changed (sha256)`]);
    expect(result.found[0]?.[1]).toContain("Reflect");
  });

  it("a CRLF checkout of the same content keeps the waiver", () => {
    expect(violations([FILE], () => bytes(TEXT.replaceAll("\n", "\r\n")), { [FILE]: entry() })).toEqual({ found: [], problems: [] });
  });

  it.each([
    ["a key with a backslash", { "pkg\\a\\json.ts": entry() }, /not in POSIX form/],
    ["a file that does not exist", { "pkg/a/gone.ts": entry() }, /not a checked file/],
    ["the client", { [CLIENT]: entry() }, /not a checked file/],
    ["an exception", { "public/app.js": entry() }, /not a checked file/],
    ["a rule with no hit", { "pkg/a/plain.ts": entry(["Reflect"], contentSha256(bytes("export const a = 1;\n"))) }, /Reflect has no hit/],
    ["an unknown rule", { [FILE]: entry(["Reflect", "reflect"]) }, /no such rule: reflect/],
    ["an import", { [FILE]: entry(["import mande"]) }, /no such rule/],
    ["upper-case hex", { [FILE]: entry(["Reflect"], SHA.toUpperCase()) }, /64 lower-case hex/],
    ["63 hex digits", { [FILE]: entry(["Reflect"], SHA.slice(1)) }, /64 lower-case hex/],
    ["a non-hex digit", { [FILE]: entry(["Reflect"], `g${SHA.slice(1)}`) }, /64 lower-case hex/],
    ["a trailing newline", { [FILE]: entry(["Reflect"], `${SHA}\n`) }, /64 lower-case hex/],
    ["a space", { [FILE]: entry(["Reflect"], ` ${SHA}`) }, /64 lower-case hex/],
    ["a non-string sha256", { [FILE]: entry(["Reflect"], 1) }, /64 lower-case hex/],
    ["no rules", { [FILE]: entry([]) }, /rules/],
    ["rules that are not a list", { [FILE]: entry("Reflect") }, /rules/],
    ["a duplicate rule", { [FILE]: entry(["Reflect", "Reflect"]) }, /rules/],
    ["one key named rules,sha256", { [FILE]: { "rules,sha256": 1 } }, /exactly rules and sha256/],
    ["rules whose iterator differs from its elements", { [FILE]: entry(Object.assign([1], {
      [Symbol.iterator]: function* () { yield "Reflect"; } })) }, /distinct rule names/],
    ["a rule held by a getter", { [FILE]: entry(Object.defineProperty([], "0", { enumerable: true, get: () => "Reflect" })) }, /distinct rule names/],
    ["a rule that is not a string", { [FILE]: entry(["Reflect", 1]) }, /distinct rule names/],
    ["a getter as the entry", Object.defineProperty({}, FILE, { enumerable: true, get: () => entry() }), /exactly rules and sha256/],
    ["an extra field", { [FILE]: { ...entry(), line: "x" } }, /exactly rules and sha256/],
    ["inherited fields", { [FILE]: Object.create(entry()) as object }, /exactly rules and sha256/],
    ["a getter", { [FILE]: Object.defineProperty({ sha256: SHA }, "rules", { enumerable: true, get: () => ["Reflect"] }) }, /exactly rules and sha256/],
    ["a null entry", { [FILE]: null }, /exactly rules and sha256/],
    ["__proto__ as a path", JSON.parse(`{"__proto__": ${JSON.stringify(entry())}}`) as object, /__proto__: not a checked file/],
    ["constructor as a path", { constructor: entry() }, /not a checked file/],
    ["toString as a path", { toString: entry() }, /not a checked file/],
    ["a symbol key", { [Symbol("x")]: entry() }, /not a string/],
    ["a hidden key", Object.defineProperty({}, FILE, { enumerable: false, value: entry() }), /hidden/],
    ["another prototype", Object.setPrototypeOf({ [FILE]: entry() }, { [FILE]: entry() }) as object, /prototype/],
    ["an entry with another prototype", { [FILE]: Object.setPrototypeOf(entry(), { line: 3 }) as object }, /exactly rules and sha256/],
  ])("%s is a problem and lifts nothing, not even a valid waiver beside it", (_, list, problem) => {
    expect(run(list).problems.join("\n")).toMatch(problem);
    expect(run(list).found.find(([file]) => file === FILE)?.[1]).toEqual(["Reflect"]);
    if (Object.getPrototypeOf(list) !== Object.prototype || Reflect.ownKeys(list).includes(FILE)) return;
    const beside = Object.defineProperty(list, FILE, { enumerable: true, value: entry() });
    expect(run(beside).problems.join("\n")).toMatch(problem);
    expect(run(beside).found.find(([file]) => file === FILE)?.[1]).toEqual(["Reflect"]);
  });

  it.each(["test file import", "test fakes", "generated client outside api.ts"])("%s cannot be waived, even on a current file", (rule) => {
    const text = `${TEXT}import "./net.test";\nimport "@ductura/test-fakes";\nimport "@ductura/contracts";\n`;
    const list = { [FILE]: entry(["Reflect", rule], contentSha256(bytes(text))) };
    const result = violations([FILE], () => bytes(text), list);
    expect(directCalls(text, FILE)).toContain(rule);
    expect(result.problems).toEqual([`${FILE}: ${rule} cannot be waived`]);
    expect(result.found).toEqual([[FILE, directCalls(text, FILE)]]);
  });

  it("a changed byte that is not valid UTF-8 still makes the waiver stale", () => {
    const withByte = (byte: number) => Buffer.concat([bytes(TEXT), Buffer.from([byte])]);
    expect(withByte(0xff).toString("utf8")).toBe(withByte(0xfe).toString("utf8"));
    const result = violations([FILE], () => withByte(0xfe), { [FILE]: entry(["Reflect"], contentSha256(withByte(0xff))) });
    expect(result.problems).toEqual([`${FILE}: stale, the content changed (sha256)`]);
    expect(result.found).toEqual([[FILE, ["Reflect"]]]);
  });

  it("a waiver lifts every rule it lists, and nothing else", () => {
    const text = `${TEXT}const d = Object.getOwnPropertyDescriptor(o, k);\nfetch(u);\n`;
    const list = { [FILE]: entry(["Reflect", "property descriptor"], contentSha256(bytes(text))) };
    expect(directCalls(text, FILE)).toEqual(expect.arrayContaining(["Reflect", "property descriptor", "fetch"]));
    expect(violations([FILE], () => bytes(text), list)).toEqual({ found: [[FILE, ["fetch"]]], problems: [] });
  });

  it("a stale waiver beside a current one lifts nothing in either file", () => {
    const list = { [FILE]: entry(), "pkg/a/other.ts": entry(["Reflect"], contentSha256(bytes(`${TEXT}\n`))) };
    expect(run(list)).toEqual({ found: [[FILE, ["Reflect"]], ["pkg/a/other.ts", ["Reflect"]]],
      problems: ["pkg/a/other.ts: stale, the content changed (sha256)"] });
  });

  it("each file is hashed from its own bytes, even if the reader reuses one buffer", () => {
    // Same length, so a reader that writes each file into one buffer leaves only the last one in it.
    const own = new Map([[FILE, bytes("Reflect.ownKeys(o);\n")], ["pkg/a/other.ts", bytes("Reflect.has(o, kk);\n")]]);
    const shared = new Uint8Array(20);
    const reuse = (file: string) => {
      shared.set(own.get(file)!);
      return shared;
    };
    const list = { [FILE]: entry(["Reflect"], contentSha256(own.get("pkg/a/other.ts")!)) };
    expect(violations([FILE, "pkg/a/other.ts"], reuse, list)).toEqual({ found: [[FILE, ["Reflect"]], ["pkg/a/other.ts", ["Reflect"]]],
      problems: [`${FILE}: stale, the content changed (sha256)`] });
  });

  it("each file is read once, and the rules checked are the rules used", () => {
    let reads = 0;
    const changing = () => bytes(reads++ === 0 ? TEXT : `${TEXT}fetch(u);\n`);
    expect(violations([FILE], changing, { [FILE]: entry() })).toEqual({ found: [], problems: [] });
    expect(reads).toBe(1);
    let gets = 0;
    const rules = new Proxy(["Reflect"], { get: (target, key, receiver) =>
      key === "0" && gets++ > 0 ? "fetch" : Reflect.get(target, key, receiver) as unknown });
    const text = `${TEXT}fetch(u);\n`;
    const result = violations([FILE], () => bytes(text), { [FILE]: entry(rules, contentSha256(bytes(text))) });
    expect(result).toEqual({ found: [[FILE, ["fetch"]]], problems: [] });
  });

  it("a getter that would name more rules on a second read lifts nothing", () => {
    let reads = 0;
    const rules = { get rules() { reads += 1; return reads > 1 ? ["Reflect", "fetch"] : ["Reflect"]; } };
    const list = { [FILE]: Object.defineProperties({ sha256: SHA }, Object.getOwnPropertyDescriptors(rules)) };
    expect(run(list).problems).not.toEqual([]);
    expect(run(list).found.find(([file]) => file === FILE)?.[1]).toEqual(["Reflect"]);
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
