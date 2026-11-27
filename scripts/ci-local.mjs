#!/usr/bin/env node
// pnpm ci:local [--changed] [--base <ref>] [--files a,b] [--dry-run] (WEB-CI-LOKALNO).
//
// Runs on this computer the checks that CI runs for a change, read from the same
// source as CI: .github/workflows/ci.yml. Nothing is copied here: which jobs a
// change needs comes from running the `changes` block of the workflow itself
// (between `# changes:begin` and `# changes:end`), and the jobs, their matrix,
// their `if` and their steps come from the workflow's jobs. Steps that only
// prepare a runner (checkout, setup, install, browser and apt caches) are
// listed but not run: locally the dependencies are already installed.
//
//   pnpm ci:local                every job, as on a push
//   pnpm ci:local --changed      only the jobs this branch's change needs, as on
//                                a pull request against --base (default
//                                origin/migracija/kopija-ductus-front); the
//                                change is the branch's commits plus the files
//                                changed or added in the working tree
//   --files a,b                  the jobs a change of these paths would need
//   --dry-run                    print the plan, run nothing
//
// Vitest runs with --maxWorkers=2 (VITEST_MAX_WORKERS); CI=true as in CI. A job
// that is not in ci-ok's needs only reports, as in CI. A failing step prints
// the matching rows of docs/ci/nestabilni-testovi.md: information only, a
// listed test still fails the run.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const WORKFLOW = ".github/workflows/ci.yml";
export const FLAKY_LIST = "docs/ci/nestabilni-testovi.md";
const DEFAULT_BASE = "origin/migracija/kopija-ductus-front";
const SETUP_RUN = /\b(?:npm|pnpm) install\b|playwright install|install-deps|\bapt\b|\/apt|\$GITHUB_OUTPUT/;

export function readWorkflow(text = readFileSync(join(ROOT, WORKFLOW), "utf8")) {
  const doc = parseDocument(text, { uniqueKeys: true, merge: true });
  if (doc.errors.length) throw new Error(doc.errors.map((e) => e.message).join("; "));
  return doc.toJS({ maxAliasCount: 100 });
}

export function changesScript(wf) {
  const run = wf.jobs?.changes?.steps?.find((s) => typeof s?.run === "string" && s.run.includes("# changes:begin"))?.run;
  if (!run) throw new Error(`${WORKFLOW}: the changes job has no changes:begin block`);
  return run;
}

/** Git's own bash on Windows (the bash on PATH may be the WSL stub), plain bash elsewhere. */
export function bashPath() {
  if (process.platform !== "win32") return "bash";
  const exec = spawnSync("git", ["--exec-path"], { encoding: "utf8" }).stdout?.trim();
  const candidates = [
    exec && resolve(exec, "..", "..", "..", "bin", "bash.exe"),
    "C:\\Program Files\\Git\\bin\\bash.exe",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? "bash";
}

/**
 * The outputs of the workflow's `changes` block for a change of `files`: the
 * block runs in a throwaway git repository holding exactly that change, as in
 * test/unit/ci-ok.test.js. `event` other than pull_request runs every job.
 */
export function decide(wf, files, { event = "pull_request" } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "ci-local-"));
  const out = join(repo, ".github-output");
  try {
    const git = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.email", "ci-local@example.invalid");
    git("config", "user.name", "ci-local");
    git("config", "core.autocrlf", "false");
    writeFileSync(join(repo, ".seed"), "x");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD").stdout.trim();
    for (const f of files) {
      mkdirSync(join(repo, dirname(f)), { recursive: true });
      writeFileSync(join(repo, f), "y");
    }
    git("add", "-A", "--", ".", ":!.github-output");
    git("commit", "-q", "--allow-empty", "-m", "change");
    writeFileSync(out, "");
    const r = spawnSync(bashPath(), ["--noprofile", "--norc", "-c", changesScript(wf)], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, EVENT: event, BASE: base, GITHUB_OUTPUT: out },
    });
    if (r.status !== 0) throw new Error(`changes block failed: ${r.stdout}${r.stderr}`);
    return Object.fromEntries(readFileSync(out, "utf8").trim().split("\n").filter(Boolean).map((l) => l.split("=")));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

// --- GitHub expressions: the subset ci.yml uses (paths, comparisons, &&, ||, !, format, always, failure). ---

function tokens(src) {
  const re = /\s*(?:('(?:[^']|'')*')|(==|!=|&&|\|\||[!(),])|([A-Za-z_][\w.-]*)|(\d+(?:\.\d+)?))/y;
  const out = [];
  let m;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    if (!(m = re.exec(src)) || re.lastIndex === pos) break;
    pos = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: "str", v: m[1].slice(1, -1).replace(/''/g, "'") });
    else if (m[2] !== undefined) out.push({ t: "op", v: m[2] });
    else if (m[3] !== undefined) out.push({ t: "id", v: m[3] });
    else if (m[4] !== undefined) out.push({ t: "num", v: Number(m[4]) });
  }
  if (src.slice(pos).trim()) throw new Error(`expression not understood: ${src}`);
  return out;
}

const truthy = (v) => !(v === undefined || v === null || v === false || v === "" || v === 0);
const loose = (v) => (typeof v === "boolean" ? String(v) : v === undefined || v === null ? "" : String(v));

export function evaluate(expr, ctx) {
  const src = String(expr).trim().replace(/^\$\{\{([\s\S]*)\}\}$/, "$1");
  const ts = tokens(src);
  let i = 0;
  const peek = () => ts[i];
  const take = (v) => (peek()?.v === v ? (i++, true) : false);
  const lookup = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  function primary() {
    const t = ts[i++];
    if (!t) throw new Error(`expression ends early: ${src}`);
    if (t.t === "str" || t.t === "num") return t.v;
    if (t.v === "(") { const v = or(); take(")"); return v; }
    if (t.v === "!") return !truthy(primary());
    if (t.t === "id") {
      if (t.v === "true") return true;
      if (t.v === "false") return false;
      if (take("(")) {
        const args = [];
        while (!take(")")) { args.push(or()); take(","); }
        if (t.v === "always" || t.v === "success") return true;
        if (t.v === "failure" || t.v === "cancelled") return false;
        if (t.v === "format") return String(args[0]).replace(/\{(\d+)\}/g, (_, n) => loose(args[Number(n) + 1]));
        if (t.v === "toJSON") return JSON.stringify(args[0]);
        throw new Error(`function not understood: ${t.v}`);
      }
      return lookup(t.v);
    }
    throw new Error(`expression not understood: ${src}`);
  }
  function cmp() {
    let v = primary();
    while (peek()?.v === "==" || peek()?.v === "!=") {
      const op = ts[i++].v;
      const w = primary();
      v = op === "==" ? loose(v) === loose(w) : loose(v) !== loose(w);
    }
    return v;
  }
  function and() { let v = cmp(); while (take("&&")) { const w = cmp(); v = truthy(v) ? w : v; } return v; }
  function or() { let v = and(); while (take("||")) { const w = and(); v = truthy(v) ? v : w; } return v; }
  return or();
}

export const interpolate = (text, ctx) => String(text).replace(/\$\{\{([\s\S]*?)\}\}/g, (_, e) => loose(evaluate(e, ctx)));

function combos(strategy) {
  const m = strategy?.matrix;
  if (!m) return [{}];
  if (Array.isArray(m.include) && Object.keys(m).length === 1) return m.include;
  const keys = Object.keys(m).filter((k) => k !== "include" && k !== "exclude");
  let all = [{}];
  for (const k of keys) all = all.flatMap((c) => m[k].map((v) => ({ ...c, [k]: v })));
  return all;
}

/** Shards of one Playwright run are the same tests: locally they run once as 1/1. */
function localCombos(strategy) {
  const list = combos(strategy);
  const m = strategy?.matrix;
  if (m && Object.keys(m).length === 1 && Array.isArray(m.shard)) return { list: [{ shard: "1/1" }], note: `the ${m.shard.length} shards as one run` };
  return { list, note: "" };
}

const isSetup = (step) => Boolean(step.uses) || SETUP_RUN.test(String(step.run ?? ""));
const needsOf = (job) => (job.needs === undefined ? [] : [].concat(job.needs));

/**
 * The plan: for every job of the workflow (but ci-ok, which only adds up the
 * others), whether this change needs it, and its runs with their steps.
 */
export function plan(wf, outputs) {
  const required = new Set(needsOf(wf.jobs["ci-ok"] ?? {}));
  const github = { event_name: "pull_request" };
  const jobs = [];
  for (const [id, job] of Object.entries(wf.jobs)) {
    if (id === "ci-ok") continue;
    const base = { needs: { changes: { outputs } }, github, matrix: {}, steps: id === "changes" ? { paths: { outputs } } : {}, env: {} };
    const on = id === "changes" || job.if === undefined || truthy(evaluate(job.if, base));
    const { list, note } = localCombos(job.strategy);
    const runs = list.map((matrix) => {
      const ctx = { ...base, matrix, env: { ...(job.env ?? {}) } };
      const steps = (job.steps ?? []).map((step) => {
        const name = interpolate(step.name ?? step.uses ?? String(step.run).split("\n")[0], ctx);
        if (id === "changes" && String(step.run ?? "").includes("# changes:begin")) return { name, kind: "decided" };
        if (isSetup(step)) return { name, kind: "setup" };
        if (step.if !== undefined && !truthy(evaluate(step.if, ctx))) return { name, kind: "off" };
        return {
          name,
          kind: "check",
          run: interpolate(step.run, ctx),
          shell: step.shell,
          cwd: step["working-directory"],
          env: Object.fromEntries(Object.entries({ ...(job.env ?? {}), ...(step.env ?? {}) }).map(([k, v]) => [k, interpolate(v, ctx)])),
        };
      });
      return { name: job.name ? interpolate(job.name, ctx) : id, steps };
    });
    jobs.push({ id, on, required: id === "changes" || required.has(id), needs: needsOf(job), note, runs });
  }
  return jobs;
}

function git(...a) {
  const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** The branch's commits since it left `base`, and what is changed or added in the working tree. */
export function changedFiles(base) {
  const [mb] = git("merge-base", "HEAD", base);
  return [...new Set([
    ...git("diff", "--name-only", mb, "HEAD"),
    ...git("diff", "--name-only", "HEAD"),
    ...git("ls-files", "--others", "--exclude-standard"),
  ])].sort();
}

/** Rows of the shared list whose test file is named in the output (information only). */
export function flakyRows(text = readFileSync(join(ROOT, FLAKY_LIST), "utf8")) {
  return text.split("\n")
    .filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l))
    .slice(1)
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, "")))
    .map(([test, owner, date, reason]) => ({ test, owner, date, reason }));
}

function run(step) {
  const args = ["--noprofile", "--norc", "-e", ...(step.shell === "bash" ? ["-o", "pipefail"] : []), "-c", step.run];
  return new Promise((done) => {
    const out = join(tmpdir(), `ci-local-output-${process.pid}`);
    writeFileSync(out, "");
    const child = spawn(bashPath(), args, {
      cwd: step.cwd ? join(ROOT, step.cwd) : ROOT,
      env: { ...process.env, CI: "true", VITEST_MAX_WORKERS: "2", GITHUB_OUTPUT: out, ...step.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let tail = "";
    const keep = (chunk, to) => { to.write(chunk); tail = (tail + chunk).slice(-200_000); };
    child.stdout.on("data", (c) => keep(c, process.stdout));
    child.stderr.on("data", (c) => keep(c, process.stderr));
    child.on("close", (code) => { rmSync(out, { force: true }); done({ code, tail }); });
  });
}

function parseArgs(argv) {
  const a = { changed: false, dry: false, base: DEFAULT_BASE, files: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--") continue;
    else if (v === "--changed") a.changed = true;
    else if (v === "--dry-run") a.dry = true;
    else if (v === "--base") a.base = argv[++i];
    else if (v === "--files") a.files = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else throw new Error(`unknown option ${v} (use --changed, --base <ref>, --files a,b, --dry-run)`);
  }
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const wf = readWorkflow();
  let files = a.files;
  if (!files && a.changed) files = changedFiles(a.base);
  const outputs = files ? decide(wf, files) : decide(wf, ["any"], { event: "workflow_dispatch" });
  console.log(files ? `ci:local: ${files.length} changed file(s) against ${a.files ? "the given list" : a.base}` : "ci:local: every job (as on a push)");
  console.log(`changes (${WORKFLOW}): ${Object.entries(outputs).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  const jobs = plan(wf, outputs);
  for (const j of jobs) {
    const tag = j.on ? (j.required ? "runs" : "runs, report only (not in ci-ok)") : "not needed";
    console.log(`- ${j.id}: ${tag}${j.on && j.note ? `; ${j.note}` : ""}`);
    if (!j.on) continue;
    for (const r of j.runs) {
      const checks = r.steps.filter((s) => s.kind === "check");
      console.log(`    ${r.name}: ${checks.length ? checks.map((s) => s.name).join("; ") : "(no check step)"}`);
    }
  }
  if (a.dry) return 0;

  const flaky = existsSync(join(ROOT, FLAKY_LIST)) ? flakyRows() : [];
  const failed = new Set();
  const lines = [];
  for (const j of jobs) {
    if (!j.on) continue;
    const blocked = j.needs.filter((n) => failed.has(n));
    if (blocked.length) { lines.push(`SKIP ${j.id}: needs ${blocked.join(", ")}, which failed`); failed.add(j.id); continue; }
    for (const r of j.runs) {
      for (const s of r.steps.filter((x) => x.kind === "check")) {
        console.log(`\n=== ${r.name} > ${s.name}`);
        const t0 = Date.now();
        const { code, tail } = await run(s);
        const secs = Math.round((Date.now() - t0) / 1000);
        if (code === 0) { lines.push(`PASS ${r.name} > ${s.name} (${secs} s)`); continue; }
        lines.push(`FAIL ${r.name} > ${s.name} (${secs} s, exit ${code})${j.required ? "" : " [report only]"}`);
        if (j.required) failed.add(j.id);
        for (const row of flaky.filter((f) => f.test && tail.includes(f.test.split(/[\\/]/).pop().split(" > ")[0]))) {
          lines.push(`     known: ${row.test} (${row.owner}, ${row.date}): ${row.reason}; information only, the failure stands`);
        }
        break; // as in CI: a failed step ends its job run; the other runs go on
      }
    }
  }
  console.log(`\n--- ci:local summary\n${lines.join("\n")}`);
  console.log(failed.size ? `ci:local: FAIL (${[...failed].join(", ")})` : "ci:local: every needed job passed");
  return failed.size ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => process.exit(code), (e) => { console.error(`ci:local: ${e.message}`); process.exit(2); });
}
