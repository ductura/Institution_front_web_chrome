// DAN-1541: one package manager and one root lockfile, frozen installs in CI,
// every action pinned to a full commit SHA.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const workflows = readdirSync(".github/workflows")
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => [f, readFileSync(`.github/workflows/${f}`, "utf8")]);
const lines = (text) => text.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => !/^\s*#/.test(l));

test("there is at least one workflow to check", () => {
  assert.ok(workflows.length > 0);
});

test("no npm lockfile or yarn lockfile is tracked at the root", () => {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");
  for (const f of ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock"]) assert.ok(!files.includes(f), `${f} must not be tracked`);
  assert.ok(files.includes("pnpm-lock.yaml"));
});

test("every `uses:` is pinned to a 40-character commit SHA", () => {
  for (const [name, text] of workflows)
    for (const [n, l] of lines(text)) {
      const m = l.match(/^\s*-?\s*uses:\s*(\S+)/);
      if (m && !m[1].startsWith("./")) assert.match(m[1], /@[0-9a-f]{40}$/, `${name}:${n} ${m[1]}`);
    }
});

test("CI never runs npm install, npm ci, npm run or npx", () => {
  for (const [name, text] of workflows)
    for (const [n, l] of lines(text)) {
      assert.doesNotMatch(l, /\bnpm (install|ci|run|i)\b(?! -g pnpm)/, `${name}:${n} ${l.trim()}`);
      assert.doesNotMatch(l, /\bnpx\b/, `${name}:${n} ${l.trim()}`);
    }
});

test("every pnpm install in CI is frozen", () => {
  for (const [name, text] of workflows)
    for (const [n, l] of lines(text)) if (/\bpnpm install\b/.test(l)) assert.match(l, /--frozen-lockfile/, `${name}:${n} ${l.trim()}`);
});

test("setup-node caches pnpm, never npm", () => {
  for (const [name, text] of workflows) assert.doesNotMatch(text, /cache:\s*npm\b/, name);
});
