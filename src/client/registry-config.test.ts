// Registry configuration for @ductura packages (DAN-752): the scope points at
// GitHub Packages, no token or secret is in the repo, versions are exact, and
// CI reads packages with the job token in the install step only (no persisted
// git credentials, no install scripts), and never writes packages.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

function walk(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    if (name === "node_modules" || name === ".git") return [];
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? walk(path, keep) : keep(name) ? [relative(".", path)] : [];
  });
}

const WORKFLOWS = walk(".github/workflows", (name) => /\.ya?ml$/.test(name));
const TOKEN_USE = /NODE_AUTH_TOKEN|GITHUB_TOKEN|github\.token|secrets\./;

/** Anything that looks like a credential or a place for one. */
export const SECRET = /_authToken|_auth\s*=|_password|\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|\bnpm_[A-Za-z0-9]{30,}|\/\/npm\.pkg\.github\.com\/:/;

describe("registry configuration", () => {
  it("src/client/.npmrc only names the registry of the @ductura scope", () => {
    const lines = read("src/client/.npmrc").split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
    expect(lines).toEqual(["@ductura:registry=https://npm.pkg.github.com"]);
  });

  it("no npmrc, yarnrc, package file or file under .github holds a token", () => {
    const files = [
      ...walk(".", (name) => /^(?:\.npmrc|\.yarnrc(?:\.yml)?|package\.json|pnpm-workspace\.yaml)$/.test(name)),
      ...walk(".github", () => true),
    ];
    expect(files).toContain("src/client/.npmrc");
    expect(files).toContain(".github/workflows/ci.yml");
    expect(files.filter((file) => SECRET.test(read(file)))).toEqual([]);
  });

  it("the client package runs no install script and has no pnpmfile", () => {
    const pkg = JSON.parse(read("src/client/package.json")) as { scripts?: Record<string, string> };
    expect(Object.keys(pkg.scripts ?? {}).sort()).toEqual(["test", "typecheck"]);
    expect(walk("src/client", (name) => /^\.?pnpmfile\.c?js$/.test(name))).toEqual([]);
  });

  it("the lockfile pins the published @ductura tarballs by integrity", () => {
    const lock = read("src/client/pnpm-lock.yaml");
    for (const name of ["@ductura/contracts@2.0.0", "@ductura/test-fakes@1.0.0"]) {
      expect(lock).toMatch(new RegExp(`'${name}':\\n    resolution: \\{integrity: sha512-[A-Za-z0-9+/=]+, tarball: https://npm\\.pkg\\.github\\.com/download/`));
    }
  });

  it("pins @ductura/contracts and @ductura/test-fakes to exact versions", () => {
    const pkg = JSON.parse(read("src/client/package.json")) as Record<string, Record<string, string>>;
    expect(pkg.dependencies).toEqual({ "@ductura/contracts": "2.0.0" });
    expect(pkg.devDependencies?.["@ductura/test-fakes"]).toBe("1.0.0");
    for (const version of [...Object.values(pkg.dependencies ?? {}), ...Object.values(pkg.devDependencies ?? {})]) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("every workflow names its permissions; none writes, and only the client job reads packages", () => {
    for (const file of WORKFLOWS) {
      const text = read(file);
      expect(text).toMatch(/^permissions:\n {2}contents: read\n/m);
      expect(text).not.toMatch(/:\s*["']?write\b|write-all|read-all/);
    }
    expect(WORKFLOWS.filter((file) => /packages:\s*["']?read/.test(read(file)))).toEqual([".github/workflows/ci.yml"]);
  });

  it("the job token reaches the client install step only", () => {
    const ci = read(".github/workflows/ci.yml");
    const steps = ci.split(/\n(?=\s*- )/);
    const withToken = steps.filter((step) => TOKEN_USE.test(step));
    expect(withToken).toHaveLength(1);
    expect(withToken[0]).toMatch(/run: pnpm install --ignore-workspace --frozen-lockfile --ignore-scripts\n/);
    expect(withToken[0]).toMatch(/NODE_AUTH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}$/);
    for (const file of WORKFLOWS.filter((f) => f !== ".github/workflows/ci.yml")) expect(read(file)).not.toMatch(TOKEN_USE);
  });

  it("the client job keeps no git credentials after checkout", () => {
    const client = read(".github/workflows/ci.yml").split(/\n {2}client:\n/)[1] ?? "";
    expect(client).toMatch(/- uses: actions\/checkout@v4\n {8}with: \{ persist-credentials: false \}\n/);
  });
});
