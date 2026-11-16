// Registry configuration for @ductura packages (DAN-752): the scope points at
// GitHub Packages, no token or secret is in the repo, versions are exact, and
// CI reads packages with GITHUB_TOKEN in the install step only, never writes.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const WORKFLOWS = readdirSync(join(ROOT, ".github/workflows")).map((name) => `.github/workflows/${name}`);

/** Anything that looks like a credential or a place for one. */
export const SECRET = /_authToken|_auth\s*=|_password|\bgh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|\bnpm_[A-Za-z0-9]{30,}|\/\/npm\.pkg\.github\.com\/:/;

describe("registry configuration", () => {
  it("src/client/.npmrc only names the registry of the @ductura scope", () => {
    const lines = read("src/client/.npmrc").split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
    expect(lines).toEqual(["@ductura:registry=https://npm.pkg.github.com"]);
  });

  it("no npmrc, package file or workflow in the repo holds a token", () => {
    const files = ["src/client/.npmrc", "src/client/package.json", "package.json", ...WORKFLOWS];
    for (const extra of [".npmrc", ".yarnrc.yml", "pnpm-workspace.yaml"]) {
      try {
        read(extra);
        files.push(extra);
      } catch {
        // absent is fine
      }
    }
    expect(files.filter((file) => SECRET.test(read(file)))).toEqual([]);
  });

  it("pins @ductura/contracts and @ductura/test-fakes to exact versions", () => {
    const pkg = JSON.parse(read("src/client/package.json")) as Record<string, Record<string, string>>;
    expect(pkg.dependencies).toEqual({ "@ductura/contracts": "1.0.1" });
    expect(pkg.devDependencies?.["@ductura/test-fakes"]).toBe("0.1.1");
    for (const version of [...Object.values(pkg.dependencies ?? {}), ...Object.values(pkg.devDependencies ?? {})]) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("no workflow writes packages, and only the client job reads them", () => {
    for (const file of WORKFLOWS) expect(read(file)).not.toMatch(/packages:\s*write|permissions:\s*write-all/);
    const reading = WORKFLOWS.filter((file) => /packages:\s*read/.test(read(file)));
    expect(reading).toEqual([".github/workflows/ci.yml"]);
  });

  it("GITHUB_TOKEN reaches the client install step only", () => {
    const ci = read(".github/workflows/ci.yml");
    const steps = ci.split(/\n(?=\s*- )/);
    const withToken = steps.filter((step) => /NODE_AUTH_TOKEN|GITHUB_TOKEN|secrets\./.test(step));
    // Bootstrap: one extra lockfile-only step until the lockfile is committed.
    expect(withToken.length).toBeGreaterThanOrEqual(1);
    expect(withToken.length).toBeLessThanOrEqual(2);
    for (const step of withToken) {
      expect(step).toMatch(/run: pnpm install --ignore-workspace (?:--frozen-lockfile\n|--lockfile-only && cat pnpm-lock\.yaml\n)/);
      expect(step).toMatch(/NODE_AUTH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
    }
    for (const file of WORKFLOWS.filter((f) => f !== ".github/workflows/ci.yml")) {
      expect(read(file)).not.toMatch(/secrets\.|NODE_AUTH_TOKEN/);
    }
  });
});
